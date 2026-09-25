package com.capacitor.arcore.view;

import android.content.Context;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

/**
 * ARNativeView
 *
 * Custom SurfaceView for native AR rendering.
 *
 * Provides the rendering surface for Filament/ARCore.
 *
 * Responsibilities:
 * - Manage SurfaceView lifecycle
 * - Provide SurfaceHolder callbacks to ARRenderer
 * - Handle surface creation/destruction
 *
 * Thread model:
 * - Constructor: UI thread
 * - SurfaceHolder callbacks: Any thread (usually render thread)
 * - onDestroy(): UI thread
 */
public class ARNativeView extends SurfaceView implements SurfaceHolder.Callback {

  private static final String TAG = "ARNativeView";

  private ARViewRenderer renderer;

  public interface ARViewRenderer {
    void onSurfaceCreated(SurfaceHolder holder);
    void onSurfaceChanged(int width, int height);
    void onSurfaceDestroyed();
  }

  public ARNativeView(Context context, ARViewRenderer renderer) {
    super(context);
    this.renderer = renderer;

    SurfaceHolder holder = getHolder();
    holder.addCallback(this);

    Log.d(TAG, "ARNativeView created");
  }

  @Override
  public void surfaceCreated(SurfaceHolder holder) {
    Log.d(TAG, "surfaceCreated");
    if (renderer != null) {
      renderer.onSurfaceCreated(holder);
    }
  }

  @Override
  public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
    Log.d(TAG, "surfaceChanged: " + width + "x" + height);
    if (renderer != null) {
      renderer.onSurfaceChanged(width, height);
    }
  }

  @Override
  public void surfaceDestroyed(SurfaceHolder holder) {
    Log.d(TAG, "surfaceDestroyed");
    if (renderer != null) {
      renderer.onSurfaceDestroyed();
    }
  }

  /**
   * Cleanup when view is being destroyed.
   */
  public void onDestroy() {
    SurfaceHolder holder = getHolder();
    holder.removeCallback(this);
    Log.d(TAG, "ARNativeView destroyed");
  }
}
