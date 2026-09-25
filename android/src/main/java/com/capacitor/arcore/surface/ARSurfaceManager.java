package com.capacitor.arcore.surface;

import android.util.Log;

import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.TrackingState;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ARSurfaceManager
 *
 * Detects and tracks detected planes/surfaces.
 *
 * Responsibilities:
 * - Track plane state from ARCore frames
 * - Detect when surfaces appear/disappear
 * - Provide surface state to renderer
 * - Emit surface change events
 *
 * Thread model:
 * - updatePlanes(): Render thread (called once per frame)
 * - Thread-safe state tracking for multi-threaded access
 */
public class ARSurfaceManager {

  private static final String TAG = "ARSurfaceManager";

  private Map<Plane, PlaneData> trackedPlanes = new HashMap<>();
  private SurfaceState currentState;

  public interface SurfaceCallback {
    void onSurfaceDetected(String planeType);
    void onSurfaceLost();
    void onSurfaceUpdated(String planeType, int planeCount);
  }

  private List<SurfaceCallback> callbacks = new ArrayList<>();

  public ARSurfaceManager() {
    currentState = new SurfaceState();
  }

  /**
   * Add a callback for surface events.
   */
  public void addCallback(SurfaceCallback callback) {
    if (!callbacks.contains(callback)) {
      callbacks.add(callback);
    }
  }

  /**
   * Update plane tracking from ARCore frame.
   *
   * Called once per render frame from ARRenderer.
   * Render thread
   *
   * @param frame ARCore frame containing plane data
   */
  public void updatePlanes(Frame frame) {
    if (frame == null) {
      return;
    }

    // Get all updated trackable planes
    Collection<Plane> updatedPlanes = frame.getUpdatedTrackables(Plane.class);

    if (updatedPlanes == null || updatedPlanes.isEmpty()) {
      // No planes detected
      if (currentState.hasSurface) {
        currentState.hasSurface = false;
        currentState.planeType = null;
        notifySurfaceLost();
      }
      return;
    }

    // Process planes
    boolean surfaceDetected = false;
    String primaryPlaneType = null;
    int planeCount = 0;

    for (Plane plane : updatedPlanes) {
      if (plane.getTrackingState() != TrackingState.TRACKING) {
        continue;
      }

      planeCount++;
      surfaceDetected = true;

      // Determine plane type
      String planeType = plane.getType() == Plane.Type.HORIZONTAL_UPWARD_FACING
          ? "horizontal"
          : "vertical";

      // Track first plane as primary
      if (primaryPlaneType == null) {
        primaryPlaneType = planeType;
      }

      // Track this plane
      if (!trackedPlanes.containsKey(plane)) {
        trackedPlanes.put(plane, new PlaneData(plane, planeType));
        Log.d(TAG, "New plane detected: " + planeType);
      }
    }

    // Update state
    if (surfaceDetected && !currentState.hasSurface) {
      // Surface appeared
      currentState.hasSurface = true;
      currentState.planeType = primaryPlaneType;
      currentState.planeCount = planeCount;
      notifySurfaceDetected(primaryPlaneType);
    } else if (surfaceDetected && currentState.hasSurface) {
      // Surface still detected, possibly updated
      if (!primaryPlaneType.equals(currentState.planeType)) {
        currentState.planeType = primaryPlaneType;
      }
      currentState.planeCount = planeCount;
      notifySurfaceUpdated(primaryPlaneType, planeCount);
    } else if (!surfaceDetected && currentState.hasSurface) {
      // Surface disappeared
      currentState.hasSurface = false;
      currentState.planeType = null;
      currentState.planeCount = 0;
      notifySurfaceLost();
    }
  }

  /**
   * Get current surface state.
   */
  public SurfaceState getState() {
    return currentState;
  }

  /**
   * Check if a surface is currently detected.
   */
  public boolean hasSurface() {
    return currentState.hasSurface;
  }

  /**
   * Get all tracked planes.
   */
  public Collection<Plane> getTrackedPlanes() {
    return trackedPlanes.keySet();
  }

  /**
   * Get all planes of a specific type.
   */
  public List<Plane> getPlanesByType(String type) {
    List<Plane> result = new ArrayList<>();
    for (Map.Entry<Plane, PlaneData> entry : trackedPlanes.entrySet()) {
      if (entry.getValue().type.equals(type)) {
        result.add(entry.getKey());
      }
    }
    return result;
  }

  private void notifySurfaceDetected(String planeType) {
    for (SurfaceCallback callback : callbacks) {
      try {
        callback.onSurfaceDetected(planeType);
      } catch (Exception e) {
        Log.e(TAG, "Error in surface callback", e);
      }
    }
  }

  private void notifySurfaceLost() {
    for (SurfaceCallback callback : callbacks) {
      try {
        callback.onSurfaceLost();
      } catch (Exception e) {
        Log.e(TAG, "Error in surface callback", e);
      }
    }
  }

  private void notifySurfaceUpdated(String planeType, int planeCount) {
    for (SurfaceCallback callback : callbacks) {
      try {
        callback.onSurfaceUpdated(planeType, planeCount);
      } catch (Exception e) {
        Log.e(TAG, "Error in surface callback", e);
      }
    }
  }

  /**
   * Internal plane data tracking.
   */
  private static class PlaneData {
    Plane plane;
    String type;  // "horizontal" or "vertical"

    PlaneData(Plane plane, String type) {
      this.plane = plane;
      this.type = type;
    }
  }

  /**
   * Surface state snapshot.
   */
  public static class SurfaceState {
    public boolean hasSurface = false;
    public String planeType = null;  // "horizontal" or "vertical"
    public int planeCount = 0;

    @Override
    public String toString() {
      return "SurfaceState{" +
          "hasSurface=" + hasSurface +
          ", planeType='" + planeType + '\'' +
          ", planeCount=" + planeCount +
          '}';
    }
  }
}
