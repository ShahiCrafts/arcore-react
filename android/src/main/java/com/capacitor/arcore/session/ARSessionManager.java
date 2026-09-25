package com.capacitor.arcore.session;

import android.content.Context;
import android.util.Log;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;

/**
 * ARSessionManager
 *
 * Sole owner of the ARCore Session lifecycle.
 *
 * Responsibilities:
 * - Create and configure ARCore Session
 * - Provide acquireLatestFrame() for the render loop
 * - Handle pause/resume
 * - Safe session cleanup
 *
 * Thread model:
 * - Constructor/create/close: UI thread
 * - acquireLatestFrame(): Render thread (called once per frame)
 * - pause/resume: UI thread
 */
public class ARSessionManager {

  private static final String TAG = "ARSessionManager";

  private Session arSession;
  private boolean isSessionActive = false;
  private boolean isPaused = false;
  private Context context;

  // Callback for session events
  public interface ARSessionCallback {
    void onSessionReady();
    void onSessionError(String errorCode, String message);
  }

  private ARSessionCallback callback;

  public ARSessionManager(Context context) {
    this.context = context;
  }

  /**
   * Create and configure the ARCore session.
   *
   * Called on UI thread.
   *
   * @param planeDetection whether to detect horizontal and vertical planes
   * @param lightEstimation whether to estimate environmental lighting
   * @param callback callback for session events
   */
  public void createSession(
      boolean planeDetection,
      boolean lightEstimation,
      ARSessionCallback callback) {

    this.callback = callback;

    try {
      // Check ARCore availability
      ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(context);

      if (availability.isTransient()) {
        // Transient condition, retry after delay
        new android.os.Handler().postDelayed(() -> {
          createSession(planeDetection, lightEstimation, callback);
        }, 200);
        return;
      }

      if (!availability.isSupported()) {
        callback.onSessionError("ARCORE_NOT_SUPPORTED", "ARCore not supported on this device");
        return;
      }

      // Install/update ARCore if needed
      ArCoreApk.InstallStatus installStatus =
          ArCoreApk.getInstance().requestInstall(
              (android.app.Activity) context, true);

      if (installStatus != ArCoreApk.InstallStatus.INSTALLED) {
        callback.onSessionError("ARCORE_INSTALL_FAILED", "ARCore installation required");
        return;
      }

      // Create session
      arSession = new Session(context);

      // Configure session
      Config config = new Config(arSession);

      // Plane detection
      if (planeDetection) {
        config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
      } else {
        config.setPlaneFindingMode(Config.PlaneFindingMode.DISABLED);
      }

      // Light estimation
      if (lightEstimation) {
        config.setLightEstimationMode(Config.LightEstimationMode.ENVIRONMENTAL_HDR);
      } else {
        config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
      }

      // Other configuration
      config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
      config.setFocusMode(Config.FocusMode.AUTO);

      arSession.configure(config);

      isSessionActive = true;
      isPaused = false;

      Log.d(TAG, "ARCore session created");

      // Signal renderer to start
      callback.onSessionReady();

    } catch (UnavailableArcoreNotInstalledException e) {
      callback.onSessionError("ARCORE_NOT_INSTALLED", "ARCore not installed");
    } catch (UnavailableDeviceNotCompatibleException e) {
      callback.onSessionError("DEVICE_NOT_COMPATIBLE", "Device not compatible with ARCore");
    } catch (UnavailableApkTooOldException e) {
      callback.onSessionError("ARCORE_APK_TOO_OLD", "ARCore APK too old, please update");
    } catch (UnavailableSdkTooOldException e) {
      callback.onSessionError("SDK_TOO_OLD", "App SDK too old for ARCore");
    } catch (Exception e) {
      Log.e(TAG, "Session creation failed", e);
      callback.onSessionError("SESSION_CREATE_FAILED", e.getMessage());
    }
  }

  /**
   * Acquire the latest ARCore frame.
   *
   * Called once per render frame from ARRenderer's frame loop.
   * Thread: Render thread
   *
   * This is where Session.update() is called - the sole authoritative update point.
   *
   * @return latest Frame, or null if session not active
   */
  public synchronized Frame acquireLatestFrame() {
    if (arSession == null || !isSessionActive) {
      return null;
    }

    try {
      Frame frame = arSession.update();
      return frame;
    } catch (CameraNotAvailableException e) {
      Log.e(TAG, "Camera not available", e);
      throw new RuntimeException("Camera not available");
    } catch (Exception e) {
      Log.e(TAG, "Frame update failed", e);
      return null;
    }
  }

  /**
   * Pause the session.
   *
   * Called during Activity.onPause()
   * UI thread
   *
   * Resources are NOT released; session is paused and can be resumed.
   */
  public synchronized void pauseSession() {
    if (arSession == null) {
      return;
    }

    try {
      isPaused = true;
      arSession.pause();
      Log.d(TAG, "ARCore session paused");
    } catch (Exception e) {
      Log.e(TAG, "Session pause failed", e);
    }
  }

  /**
   * Resume the session.
   *
   * Called during Activity.onResume()
   * UI thread
   */
  public synchronized void resumeSession() {
    if (arSession == null) {
      return;
    }

    try {
      isPaused = false;
      arSession.resume();
      Log.d(TAG, "ARCore session resumed");
    } catch (CameraNotAvailableException e) {
      Log.e(TAG, "Camera not available on resume", e);
    } catch (Exception e) {
      Log.e(TAG, "Session resume failed", e);
    }
  }

  /**
   * Close and release the session.
   *
   * Called during stopSession()
   * UI thread
   *
   * After this, the session is destroyed and cannot be reused.
   */
  public synchronized void closeSession() {
    if (arSession != null) {
      try {
        arSession.close();
        arSession = null;
        isSessionActive = false;
        isPaused = false;
        Log.d(TAG, "ARCore session closed");
      } catch (Exception e) {
        Log.e(TAG, "Session close failed", e);
      }
    }
  }

  /**
   * Check if session is currently active.
   */
  public boolean isSessionActive() {
    return isSessionActive && !isPaused;
  }

  /**
   * Check if session is paused.
   */
  public boolean isSessionPaused() {
    return isPaused;
  }

  /**
   * Get the ARCore session (for advanced usage only).
   * Do NOT call update() on this directly - use acquireLatestFrame().
   */
  public Session getSession() {
    return arSession;
  }
}
