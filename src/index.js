/**
 * Capacitor ARCore Plugin - Native AR Foundation
 *
 * Provides access to native Android ARCore capabilities from JavaScript.
 *
 * Architecture:
 * - Single authoritative frame loop (ARRenderer)
 * - ARCore session lifecycle management (ARSessionManager)
 * - Surface/plane detection (ARSurfaceManager)
 * - Hit testing and coordinate mapping (ARCoordinateMapper)
 * - Model management (ARModelManager, ARAnchorManager)
 * - Event emission (AREventEmitter)
 *
 * Public API:
 * - Session: startSession, stopSession, checkSupport
 * - Hit Testing: hitTest
 * - Model Placement: placeModel, removeModel
 * - Model Transforms: setTransform
 * - Model Material: setMaterial
 * - Model Movement: moveModel
 * - Events: on, addListener
 *
 * @module capacitor-arcore
 */

import { registerPlugin } from '@capacitor/core';

// Event emitter for native events
const eventListeners = {};

/**
 * Register the native ARCore plugin with Capacitor.
 * This creates the JavaScript proxy that bridges to ARCorePlugin.java
 */
const ARCoreNative = registerPlugin('ARCore', {
  web: () => import('./web').then(m => new m.ARCoreWeb()),
});

/**
 * ARCore - Main public API for native AR
 *
 * @namespace ARCore
 */
export const ARCore = {
  /**
   * Start an AR session.
   *
   * @param {Object} options - Session configuration
   * @param {boolean} [options.planeDetection=true] - Enable plane detection
   * @param {boolean} [options.lightEstimation=true] - Enable light estimation
   * @returns {Promise<{success: boolean}>}
   */
  startSession: async (options = {}) => {
    try {
      const result = await ARCoreNative.startSession(options);
      return result;
    } catch (e) {
      throw new Error('Failed to start AR session: ' + e.message);
    }
  },

  /**
   * Stop the AR session.
   *
   * @returns {Promise<void>}
   */
  stopSession: async () => {
    try {
      await ARCoreNative.stopSession();
    } catch (e) {
      throw new Error('Failed to stop AR session: ' + e.message);
    }
  },

  /**
   * Perform a hit test at normalized screen coordinates.
   *
   * @param {Object} options - Hit test parameters
   * @param {number} options.x - Normalized X coordinate [0, 1]
   * @param {number} options.y - Normalized Y coordinate [0, 1]
   * @returns {Promise<Object>} Hit test result
   */
  hitTest: async (options = {}) => {
    try {
      const result = await ARCoreNative.hitTest(options);
      return result;
    } catch (e) {
      throw new Error('Hit test failed: ' + e.message);
    }
  },

  /**
   * Place a GLB model at a hit test location.
   *
   * @param {Object} options
   * @param {string} options.modelPath - Path to GLB model in assets (e.g., "models/chair.glb")
   * @param {string} [options.hitId] - Optional hit identifier
   * @returns {Promise<{modelId: string, anchorId: string}>}
   */
  placeModel: async (options = {}) => {
    try {
      const result = await ARCoreNative.placeModel(options);
      return result;
    } catch (e) {
      throw new Error('Failed to place model: ' + e.message);
    }
  },

  /**
   * Update model transform (position, rotation, scale).
   *
   * @param {Object} options
   * @param {string} options.modelId - Model identifier
   * @param {Object} [options.rotation] - Euler angles {x, y, z} in degrees
   * @param {number} [options.scale] - Uniform scale factor
   * @returns {Promise<void>}
   */
  setTransform: async (options = {}) => {
    try {
      await ARCoreNative.setTransform(options);
    } catch (e) {
      throw new Error('Failed to update transform: ' + e.message);
    }
  },

  /**
   * Set model material/color.
   *
   * @param {Object} options
   * @param {string} options.modelId - Model identifier
   * @param {string} options.color - Hex color string (e.g., "#7D8B67")
   * @returns {Promise<void>}
   */
  setMaterial: async (options = {}) => {
    try {
      await ARCoreNative.setMaterial(options);
    } catch (e) {
      throw new Error('Failed to update material: ' + e.message);
    }
  },

  /**
   * Move model to new position (hit test at screen coordinates).
   *
   * @param {Object} options
   * @param {string} options.modelId - Model identifier
   * @param {number} options.x - Normalized X coordinate [0, 1]
   * @param {number} options.y - Normalized Y coordinate [0, 1]
   * @returns {Promise<Object>} New position information
   */
  moveModel: async (options = {}) => {
    try {
      const result = await ARCoreNative.moveModel(options);
      return result;
    } catch (e) {
      throw new Error('Failed to move model: ' + e.message);
    }
  },

  /**
   * Remove a model.
   *
   * @param {Object} options
   * @param {string} options.modelId - Model identifier
   * @returns {Promise<void>}
   */
  removeModel: async (options = {}) => {
    try {
      await ARCoreNative.removeModel(options);
    } catch (e) {
      throw new Error('Failed to remove model: ' + e.message);
    }
  },

  /**
   * Register a listener for AR events.
   *
   * Event types: 'sessionStarted', 'trackingChanged', 'surfaceDetected',
   *              'surfaceLost', 'surfaceUpdated', 'sessionStopped',
   *              'modelPlaced', 'modelRemoved', 'modelTransformed',
   *              'modelMaterialChanged', 'modelMoved', 'error'
   *
   * @param {string} eventType - Type of event to listen for
   * @param {Function} callback - Callback function receiving event data
   * @returns {Function} Unsubscribe function
   */
  on: (eventType, callback) => {
    if (!eventListeners[eventType]) {
      eventListeners[eventType] = [];
    }
    eventListeners[eventType].push(callback);

    return () => {
      eventListeners[eventType] = eventListeners[eventType].filter(
        (cb) => cb !== callback
      );
    };
  },

  /**
   * Check AR support on this device.
   *
   * @returns {Promise<{supported: boolean, reason: string}>}
   */
  checkSupport: async () => {
    try {
      const result = await ARCoreNative.checkSupport();
      return result;
    } catch (e) {
      return { supported: false, reason: e.message };
    }
  },

  /**
   * Register a listener for AR events (Capacitor native event listener).
   * Internal method - use .on() for local listeners.
   *
   * @internal
   */
  addListener: (eventType, callback) => {
    return ARCoreNative.addListener(eventType, callback);
  },
};

/**
 * Setup native event routing
 */
function setupEventBridge() {
  const eventTypes = [
    'sessionStarted',
    'trackingChanged',
    'surfaceDetected',
    'surfaceLost',
    'surfaceUpdated',
    'sessionStopped',
    'modelPlaced',
    'modelRemoved',
    'modelTransformed',
    'modelMaterialChanged',
    'modelMoved',
    'error',
  ];

  eventTypes.forEach((eventType) => {
    ARCoreNative.addListener(eventType, (data) => {
      if (eventListeners[eventType]) {
        eventListeners[eventType].forEach((callback) => {
          try {
            callback(data);
          } catch (e) {
            console.error(`Error in ${eventType} listener:`, e);
          }
        });
      }
    });
  });
}

// Setup bridge when plugin loads
setupEventBridge();

export default ARCore;

// React integration. Kept as a separate module internally, exported here as the
// supported high-level API for React applications.
export { useARCore } from './hooks.js';

export { createARGestureController } from './gestures.js';

// High-level abstraction API. Prefer this for application code.
export { ARView, createARView, takeScreenshot, enableCustomization, addTextures, switchModel, placeModel } from './ar-view.js';
