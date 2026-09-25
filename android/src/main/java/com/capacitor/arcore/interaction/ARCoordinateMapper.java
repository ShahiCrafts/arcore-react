package com.capacitor.arcore.interaction;

import android.content.Context;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;

import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Trackable;

import java.util.List;

/**
 * ARCoordinateMapper
 *
 * Maps between coordinate systems:
 * - Normalized screen coordinates [0, 1]
 * - Pixel coordinates
 * - ARCore hit test coordinates
 * - 3D world coordinates
 *
 * Responsibilities:
 * - Convert normalized screen coords to ARCore hit test coords
 * - Perform hit testing against detected planes
 * - Return world position and plane type
 *
 * Thread model:
 * - initialize(): UI thread (once)
 * - screenToWorldHitTest(): Render thread (called from hitTest)
 */
public class ARCoordinateMapper {

  private static final String TAG = "ARCoordinateMapper";

  private int displayWidth;
  private int displayHeight;
  private float displayDensity;

  public ARCoordinateMapper() {
  }

  /**
   * Initialize with display information.
   *
   * Call once during AR setup.
   * UI thread
   */
  public void initialize(Context context) {
    try {
      DisplayMetrics metrics = new DisplayMetrics();
      WindowManager wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
      
      if (wm != null && wm.getDefaultDisplay() != null) {
        wm.getDefaultDisplay().getMetrics(metrics);
        displayWidth = metrics.widthPixels;
        displayHeight = metrics.heightPixels;
        displayDensity = metrics.density;

        Log.d(TAG, "Display initialized: " + displayWidth + "x" + displayHeight +
            " (density: " + displayDensity + ")");
      }
    } catch (Exception e) {
      Log.e(TAG, "Failed to initialize display", e);
      // Fallback defaults
      displayWidth = 1080;
      displayHeight = 2400;
      displayDensity = 1.0f;
    }
  }

  /**
   * Convert normalized screen coordinates to a world hit test result.
   *
   * Input: normalized [0, 1] coordinates (0,0 = top-left, 1,1 = bottom-right)
   * Output: HitTestResult with 3D position and plane type, or null if no hit
   *
   * Called from hitTest() method.
   * Render thread
   *
   * @param screenX normalized X coordinate [0, 1]
   * @param screenY normalized Y coordinate [0, 1]
   * @param frame ARCore frame to hit test against
   * @return HitTestResult or null
   */
  public HitTestResult screenToWorldHitTest(float screenX, float screenY, Frame frame) {
    if (frame == null) {
      return null;
    }

    // Validate input
    if (screenX < 0 || screenX > 1 || screenY < 0 || screenY > 1) {
      Log.w(TAG, "Hit test coordinates out of range: " + screenX + ", " + screenY);
      return null;
    }

    // Convert normalized to pixel coordinates
    int pixelX = (int) (screenX * displayWidth);
    int pixelY = (int) (screenY * displayHeight);

    // Clamp to valid range
    pixelX = Math.max(0, Math.min(pixelX, displayWidth - 1));
    pixelY = Math.max(0, Math.min(pixelY, displayHeight - 1));

    try {
      // Perform ARCore hit test
      List<HitResult> hits = frame.hitTest(pixelX, pixelY);

      if (hits.isEmpty()) {
        // No surface hit
        return null;
      }

      // Get closest hit
      HitResult hit = hits.get(0);

      // Extract hit data
      float[] position = new float[3];
      hit.getHitPose().getTranslation(position, 0);

      float[] rotation = new float[4];
      hit.getHitPose().getRotationQuaternion(rotation, 0);

      // Determine plane type
      String planeType = "horizontal";
      Trackable trackable = hit.getTrackable();
      if (trackable instanceof Plane) {
        Plane plane = (Plane) trackable;
        planeType = plane.getType() == Plane.Type.HORIZONTAL_UPWARD_FACING
            ? "horizontal"
            : "vertical";
      }

      return new HitTestResult(
          position, rotation, planeType, pixelX, pixelY
      );

    } catch (Exception e) {
      Log.e(TAG, "Hit test failed", e);
      return null;
    }
  }

  /**
   * Hit test result containing 3D world position and metadata.
   */
  public static class HitTestResult {
    public float[] position;      // [x, y, z] in world space
    public float[] rotation;      // [qx, qy, qz, qw] quaternion
    public String planeType;      // "horizontal" or "vertical"
    public int pixelX;            // Original pixel coordinate
    public int pixelY;            // Original pixel coordinate

    public HitTestResult(float[] position, float[] rotation, String planeType,
                         int pixelX, int pixelY) {
      this.position = position;
      this.rotation = rotation;
      this.planeType = planeType;
      this.pixelX = pixelX;
      this.pixelY = pixelY;
    }
  }
}
