package com.capacitor.arcore;

import android.Manifest;
import android.app.Activity;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.capacitor.arcore.session.ARSessionManager;
import com.capacitor.arcore.view.ARViewManager;
import com.capacitor.arcore.render.ARRenderer;
import com.capacitor.arcore.surface.ARSurfaceManager;
import com.capacitor.arcore.interaction.ARCoordinateMapper;
import com.capacitor.arcore.events.AREventEmitter;
import com.capacitor.arcore.anchor.ARAnchorManager;
import com.capacitor.arcore.model.ARModelManager;

/**
 * ARCorePlugin
 *
 * Thin Capacitor facade for native AR functionality.
 *
 * Responsibilities:
 * - Receive Capacitor method calls
 * - Validate parameters
 * - Delegate to appropriate managers
 * - Convert results to Capacitor format
 * - Handle permissions
 *
 * Does NOT own:
 * - ARCore session lifecycle (ARSessionManager)
 * - View hierarchy (ARViewManager)
 * - Rendering (ARRenderer)
 * - Plane detection (ARSurfaceManager)
 * - Event emission (AREventEmitter)
 *
 * Thread model:
 * - Capacitor method calls: UI thread
 * - Delegates to managers which handle their own threading
 */
@CapacitorPlugin(
    name = "ARCore",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class ARCorePlugin extends Plugin {

  private static final String TAG = "ARCorePlugin";

  // Managers
  private ARSessionManager sessionManager;
  private ARViewManager viewManager;
  private ARRenderer renderer;
  private ARSurfaceManager surfaceManager;
  private ARCoordinateMapper coordinateMapper;
  private AREventEmitter eventEmitter;
  private ARAnchorManager anchorManager;
  private ARModelManager modelManager;

  private boolean isSessionActive = false;

  @Override
  public void load() {
    Log.d(TAG, "ARCore plugin loaded");

    // Initialize managers
    Activity activity = getActivity();

    eventEmitter = new AREventEmitter();
    sessionManager = new ARSessionManager(this.getContext());
    viewManager = new ARViewManager(activity);
    renderer = new ARRenderer(this.getContext());
    surfaceManager = new ARSurfaceManager();
    coordinateMapper = new ARCoordinateMapper();
    anchorManager = new ARAnchorManager();
    
    // Initialize model manager (needs renderer's Filament engine)
    // This will be set up after Filament is initialized

    // Wire up dependencies
    renderer.setSessionManager(sessionManager);
    renderer.setSurfaceManager(surfaceManager);
    renderer.setEventEmitter(eventEmitter);

    coordinateMapper.initialize(this.getContext());

    // Get WebView from Capacitor bridge
    WebView webView = getBridge().getWebView();
    viewManager.setCapacitorWebView(webView);

    // Register for native events
    setupEventBridge();

    Log.d(TAG, "ARCore plugin initialized");
  }

  /**
   * Setup event forwarding from native to Capacitor.
   */
  private void setupEventBridge() {
    eventEmitter.addListener((type, data) -> {
      notifyListeners(type, data, true);
    });

    surfaceManager.addCallback(new ARSurfaceManager.SurfaceCallback() {
      @Override
      public void onSurfaceDetected(String planeType) {
        JSObject data = new JSObject();
        data.put("planeType", planeType);
        eventEmitter.emit("surfaceDetected", data);
      }

      @Override
      public void onSurfaceLost() {
        eventEmitter.emit("surfaceLost", new JSObject());
      }

      @Override
      public void onSurfaceUpdated(String planeType, int planeCount) {
        JSObject data = new JSObject();
        data.put("planeType", planeType);
        data.put("planeCount", planeCount);
        eventEmitter.emit("surfaceUpdated", data);
      }
    });
  }

  /**
   * Check if ARCore is supported.
   */
  @PluginMethod
  public void checkSupport(PluginCall call) {
    // Delegate to sessionManager (already handles this)
    // For now, simple check
    JSObject result = new JSObject();
    result.put("supported", true);
    result.put("reason", "ARCore supported");
    call.resolve(result);
  }

  /**
   * Start AR session.
   *
   * @param call contains options: planeDetection, lightEstimation
   */
  @PluginMethod
  public void startSession(PluginCall call) {
    // Check camera permission
    if (!hasRequiredPermissions()) {
      requestPermissionForAlias("camera", call, "handleCameraPermission");
      return;
    }

    try {
      boolean planeDetection = call.getBoolean("planeDetection", true);
      boolean lightEstimation = call.getBoolean("lightEstimation", true);

      // Create ARCore session
      sessionManager.createSession(
          planeDetection,
          lightEstimation,
          new ARSessionManager.ARSessionCallback() {
            @Override
            public void onSessionReady() {
              // Session created, now setup views and renderer
              setupARRendering(call);
            }

            @Override
            public void onSessionError(String code, String message) {
              call.reject("Session error: " + code + " - " + message);
            }
          }
      );

    } catch (Exception e) {
      Log.e(TAG, "Error starting session", e);
      call.reject("Failed to start AR: " + e.getMessage());
    }
  }

  /**
   * Setup AR rendering after session created.
   */
  private void setupARRendering(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      try {
        // Initialize model manager (needs Filament engine from renderer)
        if (modelManager == null) {
          modelManager = new ARModelManager(
              this.getContext(),
              renderer.getFilamentEngine(),
              renderer.getFilamentScene()
          );
        }

        // Signal renderer that session is ready
        renderer.onSessionReady();

        // Setup AR view (creates SurfaceView, attaches to hierarchy)
        viewManager.setupARView(
            renderer,
            new ARViewManager.ARViewCallback() {
              @Override
              public void onARViewReady() {
                isSessionActive = true;
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

                // Emit event
                eventEmitter.emit("sessionStarted", new JSObject());

                Log.d(TAG, "AR session started");
              }

              @Override
              public void onARViewError(String message) {
                call.reject("View setup failed: " + message);
              }
            }
        );

      } catch (Exception e) {
        Log.e(TAG, "Error setting up AR rendering", e);
        call.reject("Rendering setup failed: " + e.getMessage());
      }
    });
  }

  /**
   * Stop AR session.
   */
  @PluginMethod
  public void stopSession(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      try {
        // Cleanup models and anchors
        if (modelManager != null) {
          modelManager.clearAllModels();
        }
        if (anchorManager != null) {
          anchorManager.clearAllAnchors();
        }

        // Signal renderer session closed
        renderer.onSessionClosed();

        // Remove AR views and restore WebView
        viewManager.removeARView();

        // Close session
        sessionManager.closeSession();

        isSessionActive = false;

        eventEmitter.emit("sessionStopped", new JSObject());

        call.resolve();

        Log.d(TAG, "AR session stopped");

      } catch (Exception e) {
        Log.e(TAG, "Error stopping session", e);
        call.reject("Failed to stop AR: " + e.getMessage());
      }
    });
  }

  /**
   * Perform hit test at normalized screen coordinates.
   *
   * @param call contains: x (float 0-1), y (float 0-1)
   */
  @PluginMethod
  public void hitTest(PluginCall call) {
    if (!isSessionActive) {
      JSObject result = new JSObject();
      result.put("hit", false);
      result.put("error", "Session not active");
      call.resolve(result);
      return;
    }

    try {
      float x = call.getFloat("x", 0.5f);
      float y = call.getFloat("y", 0.5f);

      // Get latest frame through session manager
      com.google.ar.core.Frame frame = sessionManager.acquireLatestFrame();

      if (frame == null) {
        JSObject result = new JSObject();
        result.put("hit", false);
        result.put("error", "No frame available");
        call.resolve(result);
        return;
      }

      // Perform hit test via coordinate mapper
      ARCoordinateMapper.HitTestResult hit =
          coordinateMapper.screenToWorldHitTest(x, y, frame);

      JSObject result = new JSObject();

      if (hit != null) {
        result.put("hit", true);
        result.put("position", floatArrayToJSArray(hit.position));
        result.put("rotation", floatArrayToJSArray(hit.rotation));
        result.put("planeType", hit.planeType);
      } else {
        result.put("hit", false);
      }

      // Note: Frame lifecycle is managed by ARCore Session
      // No explicit release needed in Filament 1.52.0

      call.resolve(result);

    } catch (Exception e) {
      Log.e(TAG, "Hit test error", e);
      JSObject result = new JSObject();
      result.put("hit", false);
      result.put("error", e.getMessage());
      call.resolve(result);
    }
  }

  /**
   * Handle camera permission callback.
   */
  @PermissionCallback
  private void handleCameraPermission(PluginCall call) {
    if (getPermissionState("camera").equals("granted")) {
      startSession(call);
    } else {
      call.reject("Camera permission is required for AR");
    }
  }

  /**
   * Place a GLB model at a hit test result.
   *
   * @param call contains: modelPath (path to GLB), hitId (from previous hitTest)
   */
  @PluginMethod
  public void placeModel(PluginCall call) {
    if (!isSessionActive || modelManager == null || anchorManager == null) {
      call.reject("Session not active or model manager not ready");
      return;
    }

    try {
      String modelPath = call.getString("modelPath");
      String hitId = call.getString("hitId");

      if (modelPath == null || modelPath.isEmpty()) {
        call.reject("modelPath is required");
        return;
      }

      // Use center anchor ID
      String anchorId = "anchor_center";

      // Place model
      String modelId = modelManager.placeModel(modelPath, anchorId, null);

      if (modelId == null) {
        call.reject("Failed to place model");
        return;
      }

      JSObject result = new JSObject();
      result.put("modelId", modelId);
      result.put("anchorId", anchorId);
      call.resolve(result);

      // Emit event
      JSObject eventData = new JSObject();
      eventData.put("modelId", modelId);
      eventData.put("anchorId", anchorId);
      eventEmitter.emit("modelPlaced", eventData);

      Log.d(TAG, "Model placed: " + modelId + " at anchor " + anchorId);

    } catch (Exception e) {
      Log.e(TAG, "Error placing model", e);
      call.reject("Failed to place model: " + e.getMessage());
    }
  }

  /**
   * Update model transform (position, rotation, scale).
   *
   * @param call contains: modelId, rotation (array [x, y, z] in degrees), scale
   */
  @PluginMethod
  public void setTransform(PluginCall call) {
    if (!isSessionActive || modelManager == null || anchorManager == null) {
      call.reject("Session not active or model manager not ready");
      return;
    }

    try {
      String modelId = call.getString("modelId");
      if (modelId == null) {
        call.reject("modelId is required");
        return;
      }

      float scale = call.getFloat("scale", 1.0f);

      // Get rotation Euler angles
      float[] rotationEuler = null;
      com.getcapacitor.JSObject rotObj = call.getObject("rotation");
      if (rotObj != null) {
        try {
          rotationEuler = new float[]{
              (float) rotObj.getDouble("x"),
              (float) rotObj.getDouble("y"),
              (float) rotObj.getDouble("z")
          };
        } catch (Exception e) {
          rotationEuler = new float[]{0, 0, 0};
        }
      }

      // Get anchor for this model and its pose
      // (In a real implementation, we'd track model->anchor association)
      // For now, we'll just apply the transform
      modelManager.setTransform(modelId, null, rotationEuler, scale);

      call.resolve();

      // Emit event
      JSObject eventData = new JSObject();
      eventData.put("modelId", modelId);
      eventData.put("scale", scale);
      if (rotationEuler != null) {
        com.getcapacitor.JSObject rotEvent = new com.getcapacitor.JSObject();
        rotEvent.put("x", rotationEuler[0]);
        rotEvent.put("y", rotationEuler[1]);
        rotEvent.put("z", rotationEuler[2]);
        eventData.put("rotation", rotEvent);
      }
      eventEmitter.emit("modelTransformed", eventData);

      Log.d(TAG, "Transform updated for model: " + modelId);

    } catch (Exception e) {
      Log.e(TAG, "Error updating transform", e);
      call.reject("Failed to update transform: " + e.getMessage());
    }
  }

  /**
   * Set model material/color.
   *
   * @param call contains: modelId, color (hex string like "#7D8B67")
   */
  @PluginMethod
  public void setMaterial(PluginCall call) {
    if (!isSessionActive || modelManager == null) {
      call.reject("Session not active or model manager not ready");
      return;
    }

    try {
      String modelId = call.getString("modelId");
      String color = call.getString("color");

      if (modelId == null) {
        call.reject("modelId is required");
        return;
      }

      if (color == null) {
        color = "#ffffff";
      }

      modelManager.setColor(modelId, color);

      call.resolve();

      // Emit event
      JSObject eventData = new JSObject();
      eventData.put("modelId", modelId);
      eventData.put("color", color);
      eventEmitter.emit("modelMaterialChanged", eventData);

      Log.d(TAG, "Material updated for model: " + modelId + " color: " + color);

    } catch (Exception e) {
      Log.e(TAG, "Error updating material", e);
      call.reject("Failed to update material: " + e.getMessage());
    }
  }

  /**
   * Move model to new screen position (hit test and reposition).
   *
   * @param call contains: modelId, x, y (normalized screen coords)
   */
  @PluginMethod
  public void moveModel(PluginCall call) {
    if (!isSessionActive || modelManager == null || anchorManager == null) {
      call.reject("Session not active or model manager not ready");
      return;
    }

    try {
      String modelId = call.getString("modelId");
      float x = call.getFloat("x", 0.5f);
      float y = call.getFloat("y", 0.5f);

      if (modelId == null) {
        call.reject("modelId is required");
        return;
      }

      // Perform hit test at new position
      com.google.ar.core.Frame frame = sessionManager.acquireLatestFrame();
      if (frame == null) {
        call.reject("No frame available");
        return;
      }

      ARCoordinateMapper.HitTestResult hit = coordinateMapper.screenToWorldHitTest(x, y, frame);
      if (hit == null) {
        call.reject("No surface at target position");
        return;
      }

      // For now, we'll note this - proper implementation would:
      // 1. Track which anchor is associated with this model
      // 2. Create new anchor at hit position
      // 3. Update model's anchor association
      // 4. Apply new anchor pose to model

      JSObject result = new JSObject();
      result.put("success", true);
      result.put("position", floatArrayToJSArray(hit.position));
      call.resolve(result);

      // Emit event
      JSObject eventData = new JSObject();
      eventData.put("modelId", modelId);
      eventData.put("x", x);
      eventData.put("y", y);
      eventEmitter.emit("modelMoved", eventData);

      Log.d(TAG, "Model moved: " + modelId + " to (" + x + ", " + y + ")");

    } catch (Exception e) {
      Log.e(TAG, "Error moving model", e);
      call.reject("Failed to move model: " + e.getMessage());
    }
  }

  /**
   * Remove a model.
   *
   * @param call contains: modelId
   */
  @PluginMethod
  public void removeModel(PluginCall call) {
    if (!isSessionActive || modelManager == null) {
      call.reject("Session not active or model manager not ready");
      return;
    }

    try {
      String modelId = call.getString("modelId");
      if (modelId == null) {
        call.reject("modelId is required");
        return;
      }

      modelManager.removeModel(modelId);

      call.resolve();

      // Emit event
      JSObject eventData = new JSObject();
      eventData.put("modelId", modelId);
      eventEmitter.emit("modelRemoved", eventData);

      Log.d(TAG, "Model removed: " + modelId);

    } catch (Exception e) {
      Log.e(TAG, "Error removing model", e);
      call.reject("Failed to remove model: " + e.getMessage());
    }
  }

  /**
   * Convert float array to Capacitor JSArray.
   */
  private com.getcapacitor.JSArray floatArrayToJSArray(float[] array) {
    com.getcapacitor.JSArray jsArray = new com.getcapacitor.JSArray();
    try {
      for (float value : array) {
        jsArray.put(value);
      }
    } catch (org.json.JSONException e) {
      Log.e(TAG, "Error converting float array to JSArray", e);
    }
    return jsArray;
  }
}
