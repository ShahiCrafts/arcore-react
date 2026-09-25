package com.capacitor.arcore.render;

import android.content.Context;
import android.opengl.GLES20;
import android.util.Log;
import android.view.SurfaceHolder;

import com.google.ar.core.Frame;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;

import com.google.android.filament.Engine;
import com.google.android.filament.Renderer;
import com.google.android.filament.Scene;
import com.google.android.filament.View;
import com.google.android.filament.Camera;
import com.google.android.filament.SwapChain;
import com.google.android.filament.Entity;
import com.google.android.filament.EntityManager;
import com.capacitor.arcore.session.ARSessionManager;
import com.capacitor.arcore.surface.ARSurfaceManager;
import com.capacitor.arcore.events.AREventEmitter;
import com.capacitor.arcore.view.ARNativeView;
import com.getcapacitor.JSObject;

/**
 * ARRenderer
 *
 * Unified AR frame loop and Filament rendering pipeline.
 *
 * Responsibilities:
 * - Initialize Filament engine and rendering resources
 * - Own and drive the frame loop
 * - Manage SwapChain lifecycle
 * - Update Filament camera from ARCore
 * - Render camera background from ARCore texture
 * - Coordinate surface updates
 * - Handle rendering errors
 *
 * Architecture:
 * - Single frame loop runs on render thread
 * - ARSessionManager.acquireLatestFrame() called once per frame
 * - All rendering state derives from one coherent Frame
 * - No producer/consumer pipelining
 *
 * Thread model:
 * - Constructor/init: UI thread
 * - Frame loop: Render thread (created by SurfaceView)
 * - onSurfaceCreated/Changed/Destroyed: Any thread (SurfaceHolder callbacks)
 * - pause/resume: UI thread
 */
public class ARRenderer implements ARNativeView.ARViewRenderer {

  private static final String TAG = "ARRenderer";

  private static final float NEAR_PLANE = 0.01f;
  private static final float FAR_PLANE = 100.0f;

  // State flags
  private volatile boolean isSessionReady = false;
  private volatile boolean isSurfaceValid = false;
  private volatile boolean isPaused = false;

  // Render thread
  private Thread renderThread;

  // Dependencies (not owned)
  private ARSessionManager sessionManager;
  private ARSurfaceManager surfaceManager;
  private AREventEmitter eventEmitter;

  // Display
  private int viewportWidth = 0;
  private int viewportHeight = 0;

  // Filament resources (actual Filament implementation)
  private com.google.android.filament.Engine filamentEngine;
  private com.google.android.filament.Renderer filamentRenderer;
  private com.google.android.filament.View filamentView;
  private com.google.android.filament.Scene filamentScene;
  private com.google.android.filament.Camera filamentCamera;
  private com.google.android.filament.SwapChain filamentSwapChain;
  private int cameraEntity;  // Entity for camera background quad
  private ARCoreTextureBackground cameraBackground;

  // Tracking state for events
  private TrackingState lastTrackingState = null;

  public ARRenderer(Context context) {
    try {
      initializeFilament(context);
      Log.d(TAG, "ARRenderer initialized");
    } catch (Exception e) {
      Log.e(TAG, "Failed to initialize Filament", e);
    }
  }

  /**
   * Initialize Filament engine and rendering resources.
   *
   * UI thread
   */
  private void initializeFilament(Context context) {
    try {
      // Create Filament engine (singleton)
      filamentEngine = Engine.create();

      // Create renderer (draws to SwapChain)
      filamentRenderer = filamentEngine.createRenderer();

      // Create scene
      filamentScene = filamentEngine.createScene();

      // Create view
      filamentView = filamentEngine.createView();
      filamentView.setScene(filamentScene);

      // Create camera entity
      EntityManager entityManager = filamentEngine.getEntityManager();
      cameraEntity = entityManager.create();
      filamentCamera = filamentEngine.createCamera(cameraEntity);
      filamentView.setCamera(filamentCamera);

      // Create camera background renderable (for ARCore texture)
      cameraBackground = new ARCoreTextureBackground(context, filamentEngine, filamentScene);

      Log.d(TAG, "Filament initialized successfully");

    } catch (Exception e) {
      Log.e(TAG, "Failed to initialize Filament", e);
      throw new RuntimeException("Filament initialization failed: " + e.getMessage());
    }
  }

  /**
   * Set dependencies.
   *
   * Called by ARCorePlugin during initialization.
   * UI thread
   */
  public void setSessionManager(ARSessionManager manager) {
    this.sessionManager = manager;
  }

  public void setSurfaceManager(ARSurfaceManager manager) {
    this.surfaceManager = manager;
  }

  public void setEventEmitter(AREventEmitter emitter) {
    this.eventEmitter = emitter;
  }

  /**
   * Signal that ARCore session is ready.
   *
   * Called by ARSessionManager after createSession() completes.
   * UI thread
   */
  public void onSessionReady() {
    isSessionReady = true;
    startRenderLoopIfReady();
    Log.d(TAG, "Session ready");
  }

  /**
   * Signal activity pause.
   *
   * Called during Activity.onPause()
   * UI thread
   */
  public void onActivityPaused() {
    isPaused = true;
    stopRenderLoop();
    Log.d(TAG, "Activity paused");
  }

  /**
   * Signal activity resume.
   *
   * Called during Activity.onResume()
   * UI thread
   */
  public void onActivityResumed() {
    isPaused = false;
    startRenderLoopIfReady();
    Log.d(TAG, "Activity resumed");
  }

  /**
   * Signal session closed.
   *
   * Called by ARViewManager during removeARView()
   * UI thread
   */
  public void onSessionClosed() {
    isSessionReady = false;
    stopRenderLoop();
    Log.d(TAG, "Session closed");
  }

  // ========== SurfaceHolder.Callback Implementation ==========

  @Override
  public void onSurfaceCreated(SurfaceHolder holder) {
    Log.d(TAG, "onSurfaceCreated");
    isSurfaceValid = true;

    try {
      if (filamentEngine == null) {
        throw new RuntimeException("Filament engine not initialized");
      }

      // Create Filament SwapChain on the native surface
      filamentSwapChain = filamentEngine.createSwapChain(holder.getSurface());

      startRenderLoopIfReady();

    } catch (Exception e) {
      Log.e(TAG, "Error creating SwapChain", e);
      emitError("SWAPCHAIN_CREATE_FAILED", e.getMessage());
    }
  }

  @Override
  public void onSurfaceChanged(int width, int height) {
    Log.d(TAG, "onSurfaceChanged: " + width + "x" + height);
    viewportWidth = width;
    viewportHeight = height;

    // Filament 1.52.0: setViewport removed, DisplayInfo not needed
    // Filament automatically uses the SwapChain surface dimensions
    // No explicit viewport setting required
  }

  @Override
  public void onSurfaceDestroyed() {
    Log.d(TAG, "onSurfaceDestroyed");
    isSurfaceValid = false;
    stopRenderLoop();

    // Wait for render loop to finish
    if (renderThread != null) {
      try {
        renderThread.join(2000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }

    // Destroy SwapChain using Filament 1.52.0 API
    if (filamentSwapChain != null && filamentEngine != null) {
      filamentEngine.destroySwapChain(filamentSwapChain);
      filamentSwapChain = null;
    }
  }

  // ========== Render Loop Control ==========

  /**
   * Start render loop if all conditions are met.
   *
   * Synchronized to ensure only one loop starts.
   */
  private synchronized void startRenderLoopIfReady() {
    if (isSessionReady && isSurfaceValid && !isPaused && renderThread == null) {
      renderThread = new Thread(() -> {
        try {
          renderLoop();
        } finally {
          renderThread = null;
        }
      });
      renderThread.setName("ARRenderThread");
      renderThread.start();
      Log.d(TAG, "Render loop started");
    }
  }

  /**
   * Signal render loop to stop.
   */
  private void stopRenderLoop() {
    isPaused = true;
  }

  /**
   * Main unified frame loop.
   *
   * Runs on render thread.
   * Single loop: update + render per frame
   */
  private void renderLoop() {
    while (isSessionReady && isSurfaceValid && !isPaused) {
      try {
        // ========== STEP 1: FRAME ACQUISITION ==========
        // Get one coherent ARCore frame (calls Session.update() once)
        Frame arFrame = sessionManager.acquireLatestFrame();

        if (arFrame == null) {
          Thread.sleep(5);
          continue;
        }

        // ========== STEP 2: TRACKING STATE ==========
        com.google.ar.core.Camera arCamera = arFrame.getCamera();
        TrackingState trackingState = arCamera.getTrackingState();

        // Emit tracking state changes (only on change, not every frame)
        updateTrackingState(trackingState);

        // ========== STEP 3: SURFACES ==========
        if (surfaceManager != null) {
          surfaceManager.updatePlanes(arFrame);
        }

        // ========== STEP 4: CAMERA POSE & PROJECTION ==========
        float[] viewMatrix = new float[16];
        float[] projMatrix = new float[16];
        arCamera.getViewMatrix(viewMatrix, 0);
        // ARCore 1.40.0: getProjectionMatrix(float[], int, float, float)
        // Parameters: projMatrix array, offset=0, near plane, far plane
        arCamera.getProjectionMatrix(projMatrix, 0, NEAR_PLANE, FAR_PLANE);

        // ========== STEP 5: CAMERA BACKGROUND TEXTURE ==========
        // Update camera background with latest frame's camera texture
        if (cameraBackground != null) {
          cameraBackground.updateFromFrame(arFrame);
        }

        // ========== STEP 6: FILAMENT CAMERA UPDATE ==========
        if (filamentCamera != null) {
          // Apply view matrix from ARCore
          filamentCamera.setModelMatrix(viewMatrix);
          
          // Filament 1.52.0: setCustomProjection requires double[] and double near/far
          // Convert float arrays and planes to double arrays
          double[] projMatrixDouble = new double[16];
          for (int i = 0; i < 16; i++) {
            projMatrixDouble[i] = projMatrix[i];
          }
          filamentCamera.setCustomProjection(projMatrixDouble, (double) NEAR_PLANE, (double) FAR_PLANE);
        }

        // ========== STEP 7: FILAMENT RENDERING ==========
        if (filamentRenderer != null && filamentView != null) {
          // Filament 1.52.0: beginFrame requires SwapChain and timestamp
          long frameTimeNs = System.nanoTime();
          filamentRenderer.beginFrame(filamentSwapChain, frameTimeNs);
          filamentView.setCamera(filamentCamera);
          filamentRenderer.render(filamentView);
          filamentRenderer.endFrame();
        }

        // ========== CLEANUP ==========
        // ARCore 1.40.0: Frame.release() does not exist
        // Frames are automatically managed by the Session

      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      } catch (Exception e) {
        Log.e(TAG, "Render loop error", e);
        emitError("RENDER_ERROR", e.getMessage());
        break;
      }
    }

    Log.d(TAG, "Render loop ended");
  }

  /**
   * Update tracking state and emit events.
   *
   * Only emits when state actually changes.
   */
  private void updateTrackingState(TrackingState state) {
    if (state != lastTrackingState) {
      lastTrackingState = state;

      // ARCore 1.40.0: TrackingState enum has TRACKING, PAUSED, and NOT_TRACKING
      // NOT_TRACKING is available in ARCore 1.40.0
      String stateStr;
      if (state == TrackingState.TRACKING) {
        stateStr = "TRACKING";
      } else if (state == TrackingState.PAUSED) {
        stateStr = "PAUSED";
      } else {
        // Default to generic state description if NOT_TRACKING not recognized
        stateStr = state != null ? state.toString() : "UNKNOWN";
      }

      JSObject data = new JSObject();
      data.put("state", stateStr);

      if (eventEmitter != null) {
        eventEmitter.emit("trackingChanged", data);
      }

      Log.d(TAG, "Tracking state changed: " + stateStr);
    }
  }

  /**
   * Emit error event.
   */
  private void emitError(String code, String message) {
    if (eventEmitter != null) {
      JSObject data = new JSObject();
      data.put("code", code);
      data.put("message", message);
      eventEmitter.emit("error", data);
    }
    Log.e(TAG, "AR Error: " + code + " - " + message);
  }

  /**
   * Get the Filament Engine instance.
   * Public access for manager initialization.
   */
  public com.google.android.filament.Engine getFilamentEngine() {
    return filamentEngine;
  }

  /**
   * Get the Filament Scene instance.
   * Public access for manager initialization.
   */
  public com.google.android.filament.Scene getFilamentScene() {
    return filamentScene;
  }
}
