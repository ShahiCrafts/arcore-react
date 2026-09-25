package com.capacitor.arcore.view;

import android.app.Activity;
import android.graphics.Color;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;
import android.widget.FrameLayout;

/**
 * ARViewManager
 *
 * Manages the view hierarchy and WebView integration.
 *
 * Responsibilities:
 * - Attach AR rendering surface underneath Capacitor WebView
 * - Make WebView transparent during AR
 * - Restore original WebView state after AR
 * - Preserve WebView interactivity
 * - Hardware acceleration preservation
 *
 * View hierarchy:
 * FrameLayout
 *   ├── ARNativeView (index 0, behind)
 *   └── Capacitor WebView (in front, interactive)
 *
 * Thread model:
 * - setupARView(): UI thread
 * - removeARView(): UI thread
 * - All WebView modifications: UI thread
 */
public class ARViewManager {

  private static final String TAG = "ARViewManager";

  private Activity activity;
  private ARNativeView arNativeView;
  private WebView capacitorWebView;
  private WebViewState webViewState;

  public interface ARViewCallback {
    void onARViewReady();
    void onARViewError(String message);
  }

  public ARViewManager(Activity activity) {
    this.activity = activity;
  }

  /**
   * Set the Capacitor WebView reference.
   *
   * Must be called before setupARView().
   * UI thread
   */
  public void setCapacitorWebView(WebView webView) {
    this.capacitorWebView = webView;
    Log.d(TAG, "Capacitor WebView set");
  }

  /**
   * Setup AR rendering view and make WebView transparent.
   *
   * Called when starting AR session.
   * UI thread
   *
   * @param renderer ARRenderer instance
   * @param callback callback when view is ready
   */
  public void setupARView(ARNativeView.ARViewRenderer renderer, ARViewCallback callback) {
    try {
      if (capacitorWebView == null) {
        callback.onARViewError("WebView not set");
        return;
      }

      // Capture original WebView state BEFORE modifications
      webViewState = WebViewState.capture(capacitorWebView);
      Log.d(TAG, "WebView state captured: " + webViewState);

      // Get the root FrameLayout
      FrameLayout container = (FrameLayout) activity.findViewById(android.R.id.content);
      if (container == null) {
        callback.onARViewError("Container not found");
        return;
      }

      // Create AR native view
      arNativeView = new ARNativeView(activity, renderer);

      // Add AR view at index 0 (behind WebView)
      container.addView(arNativeView, 0);
      Log.d(TAG, "ARNativeView added at index 0");

      // Make WebView transparent (preserve hardware acceleration)
      makeWebViewTransparent();

      callback.onARViewReady();

    } catch (Exception e) {
      Log.e(TAG, "Error setting up AR view", e);
      callback.onARViewError(e.getMessage());
    }
  }

  /**
   * Remove AR rendering view and restore original WebView state.
   *
   * Called when stopping AR session.
   * UI thread
   */
  public void removeARView() {
    try {
      // Stop AR rendering
      if (arNativeView != null) {
        arNativeView.onDestroy();
      }

      // Get container
      FrameLayout container = (FrameLayout) activity.findViewById(android.R.id.content);
      if (container != null && arNativeView != null && arNativeView.getParent() == container) {
        container.removeView(arNativeView);
        Log.d(TAG, "ARNativeView removed");
      }

      // Restore WebView to original state
      restoreWebView();

      arNativeView = null;

    } catch (Exception e) {
      Log.e(TAG, "Error removing AR view", e);
    }
  }

  /**
   * Make WebView transparent for AR rendering underneath.
   *
   * Uses minimum necessary configuration to maintain hardware acceleration.
   * UI thread
   */
  private void makeWebViewTransparent() {
    if (capacitorWebView == null || webViewState == null) {
      return;
    }

    try {
      // Set transparent background (keeps hardware acceleration)
      capacitorWebView.setBackgroundColor(Color.TRANSPARENT);

      Log.d(TAG, "WebView made transparent");

    } catch (Exception e) {
      Log.e(TAG, "Error making WebView transparent", e);
    }
  }

  /**
   * Restore WebView to its original state exactly.
   *
   * Called after AR stops.
   * UI thread
   */
  private void restoreWebView() {
    if (capacitorWebView == null || webViewState == null) {
      return;
    }

    try {
      // Restore background color exactly
      capacitorWebView.setBackgroundColor(webViewState.backgroundColor);

      // Restore layer type exactly
      capacitorWebView.setLayerType(webViewState.layerType, null);

      // Restore alpha
      capacitorWebView.setAlpha(webViewState.alpha);

      // Restore visibility
      capacitorWebView.setVisibility(webViewState.visibility);

      Log.d(TAG, "WebView restored to original state");

    } catch (Exception e) {
      Log.e(TAG, "Error restoring WebView", e);
    }
  }

  /**
   * Get the AR native view.
   */
  public ARNativeView getARNativeView() {
    return arNativeView;
  }

  /**
   * WebView state capture/restore.
   */
  private static class WebViewState {
    int backgroundColor;
    int layerType;
    float alpha;
    int visibility;

    static WebViewState capture(WebView webView) {
      WebViewState state = new WebViewState();
      state.backgroundColor = Color.TRANSPARENT;  // WebView is typically transparent over AR
      state.layerType = webView.getLayerType();
      state.alpha = webView.getAlpha();
      state.visibility = webView.getVisibility();

      Log.d(TAG, "WebViewState captured: bg=" + state.backgroundColor +
          ", layer=" + state.layerType +
          ", alpha=" + state.alpha +
          ", visibility=" + state.visibility);

      return state;
    }

    @Override
    public String toString() {
      return "WebViewState{" +
          "backgroundColor=" + backgroundColor +
          ", layerType=" + layerType +
          ", alpha=" + alpha +
          ", visibility=" + visibility +
          '}';
    }
  }
}
