package com.capacitor.arcore.anchor;

import android.util.Log;

import com.google.ar.core.Anchor;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ARAnchorManager
 *
 * Manages ARCore anchor metadata and lifecycle tracking.
 *
 * This simplified version tracks anchor IDs and their state.
 * Actual anchor creation happens via ARCoordinateMapper hit tests.
 *
 * Thread model: Thread-safe operations
 * AnchorID format: "anchor_N"
 */
public class ARAnchorManager {

  private static final String TAG = "ARAnchorManager";

  private final Map<String, Anchor> anchorMap = new HashMap<>();
  private final AtomicInteger anchorCounter = new AtomicInteger(0);

  /**
   * Register an anchor.
   */
  public synchronized String registerAnchor(Anchor anchor) {
    if (anchor == null) {
      Log.w(TAG, "Cannot register null anchor");
      return null;
    }

    try {
      String anchorId = generateAnchorId();
      anchorMap.put(anchorId, anchor);
      Log.d(TAG, "Anchor registered: " + anchorId);
      return anchorId;
    } catch (Exception e) {
      Log.e(TAG, "Failed to register anchor", e);
      return null;
    }
  }

  /**
   * Get anchor by ID.
   */
  public synchronized Anchor getAnchor(String anchorId) {
    return anchorMap.get(anchorId);
  }

  /**
   * Get the pose of an anchor.
   */
  public synchronized float[] getAnchorPose(String anchorId) {
    Anchor anchor = anchorMap.get(anchorId);
    if (anchor == null) {
      Log.w(TAG, "Anchor not found: " + anchorId);
      return null;
    }

    try {
      com.google.ar.core.Pose pose = anchor.getPose();
      float[] poseMatrix = new float[16];
      pose.toMatrix(poseMatrix, 0);
      return poseMatrix;
    } catch (Exception e) {
      Log.e(TAG, "Failed to get anchor pose", e);
      return null;
    }
  }

  /**
   * Check if an anchor is still tracking.
   */
  public synchronized boolean isAnchorTracking(String anchorId) {
    Anchor anchor = anchorMap.get(anchorId);
    if (anchor == null) {
      return false;
    }

    try {
      return anchor.getTrackingState() == com.google.ar.core.TrackingState.TRACKING;
    } catch (Exception e) {
      Log.e(TAG, "Failed to check anchor tracking state", e);
      return false;
    }
  }

  /**
   * Remove and release an anchor.
   */
  public synchronized void removeAnchor(String anchorId) {
    Anchor anchor = anchorMap.remove(anchorId);
    if (anchor != null) {
      try {
        anchor.detach();
        Log.d(TAG, "Anchor removed and detached: " + anchorId);
      } catch (Exception e) {
        Log.e(TAG, "Failed to detach anchor", e);
      }
    }
  }

  /**
   * Clear all anchors.
   */
  public synchronized void clearAllAnchors() {
    for (Anchor anchor : anchorMap.values()) {
      try {
        anchor.detach();
      } catch (Exception e) {
        Log.e(TAG, "Error detaching anchor during cleanup", e);
      }
    }
    anchorMap.clear();
    Log.d(TAG, "All anchors cleared");
  }

  /**
   * Get the number of currently tracked anchors.
   */
  public synchronized int getAnchorCount() {
    return anchorMap.size();
  }

  /**
   * Generate a unique anchor ID.
   */
  private String generateAnchorId() {
    return "anchor_" + anchorCounter.incrementAndGet();
  }
}
