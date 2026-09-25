package com.capacitor.arcore.events;

import android.util.Log;

import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * AREventEmitter
 *
 * Thread-safe event bus for AR events.
 *
 * Emits semantic state changes only (not frame data).
 *
 * Events are sent to Capacitor bridge for JavaScript consumption.
 *
 * Thread model:
 * - Emit from: Any thread (frame loop, update thread, UI thread)
 * - Thread-safe via CopyOnWriteArrayList
 */
public class AREventEmitter {

  private static final String TAG = "AREventEmitter";

  public interface EventListener {
    void onEvent(String eventType, JSObject data);
  }

  private CopyOnWriteArrayList<EventListener> listeners = new CopyOnWriteArrayList<>();

  /**
   * Register an event listener.
   *
   * @param listener callback that receives events
   */
  public void addListener(EventListener listener) {
    if (!listeners.contains(listener)) {
      listeners.add(listener);
    }
  }

  /**
   * Unregister an event listener.
   */
  public void removeListener(EventListener listener) {
    listeners.remove(listener);
  }

  /**
   * Emit an event to all registered listeners.
   *
   * Thread-safe. Can be called from any thread.
   *
   * @param type event type (e.g., "sessionStarted", "trackingChanged")
   * @param data event data as JSObject
   */
  public void emit(String type, JSObject data) {
    for (EventListener listener : listeners) {
      try {
        listener.onEvent(type, data);
      } catch (Exception e) {
        Log.e(TAG, "Error in event listener for " + type, e);
      }
    }
  }

  /**
   * Emit an event with a simple message.
   */
  public void emit(String type, String message) {
    JSObject data = new JSObject();
    data.put("message", message);
    emit(type, data);
  }

  /**
   * Clear all listeners.
   */
  public void clear() {
    listeners.clear();
  }
}
