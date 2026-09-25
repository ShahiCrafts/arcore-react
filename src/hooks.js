/**
 * React Hooks for ARCore Plugin
 *
 * This module provides a React hook interface for the ARCore plugin,
 * making it easy to integrate AR functionality into React applications.
 * The hook manages AR session lifecycle, model state, and provides
 * convenient methods for common AR operations.
 *
 * @module hooks
 *
 * @example
 * // Basic usage in a React component
 * import { useARCore } from 'capacitor-arcore';
 *
 * function ARComponent() {
 *   const {
 *     isSupported,
 *     isSessionActive,
 *     startSession,
 *     placeModel
 *   } = useARCore();
 *
 *   if (!isSupported) return <div>AR not supported</div>;
 *
 *   return (
 *     <button onClick={() => startSession({ domOverlay: myOverlayRef })}>
 *       Start AR
 *     </button>
 *   );
 * }
 */

import { useState, useEffect, useCallback, useRef } from "react";

// Import ARCore from web implementation directly to avoid circular dependency
// We import the class directly rather than the singleton to maintain hook isolation
import { ARCoreWeb } from "./web.js";

// Create a module-level instance for the hook to use
// This ensures all hook consumers share the same AR session
const arCore = new ARCoreWeb();

/**
 * React hook for using ARCore functionality in React components.
 *
 * This hook provides:
 * - Automatic AR support detection on mount
 * - Session lifecycle management (start/stop)
 * - Real-time tracking of placed models
 * - Hit testing for surface detection
 * - Model placement, transformation, and customization
 * - Automatic cleanup on component unmount
 *
 * @returns {Object} AR state and methods
 * @returns {boolean|null} returns.isSupported - Whether AR is supported (null while checking)
 * @returns {boolean} returns.isSessionActive - Whether an AR session is currently running
 * @returns {Array} returns.placedModels - Array of currently placed model objects
 * @returns {string|null} returns.error - Current error message, if any
 * @returns {Function} returns.startSession - Start an AR session
 * @returns {Function} returns.stopSession - Stop the current AR session
 * @returns {Function} returns.hitTest - Perform a hit test at screen coordinates
 * @returns {Function} returns.placeModel - Place a 3D model in the scene
 * @returns {Function} returns.removeModel - Remove a placed model
 * @returns {Function} returns.transformModel - Move, rotate, or scale a model
 * @returns {Function} returns.setModelColor - Change a model's color
 * @returns {Function} returns.setModelMaterial - Set material properties
 * @returns {Function} returns.clearError - Clear the current error state
 * @returns {Function} returns.getRenderer - Get the Three.js WebGLRenderer
 * @returns {Function} returns.getScene - Get the Three.js Scene
 * @returns {Function} returns.getCamera - Get the Three.js Camera
 *
 * @example
 * const {
 *   isSupported,
 *   isSessionActive,
 *   placedModels,
 *   error,
 *   startSession,
 *   stopSession,
 *   hitTest,
 *   placeModel,
 *   removeModel,
 *   transformModel,
 *   setModelColor,
 *   setModelMaterial,
 *   clearError,
 * } = useARCore();
 */
export function useARCore() {
  // ============================================================
  // State Management
  // ============================================================

  /**
   * Whether AR is supported on this device
   * null = still checking, true = supported, false = not supported
   */
  const [isSupported, setIsSupported] = useState(null);

  /**
   * Whether an AR session is currently active
   * Used to guard operations that require an active session
   */
  const [isSessionActive, setIsSessionActive] = useState(false);

  /**
   * Array of currently placed models in the scene
   * Each model object contains: anchorId, modelUrl, position, rotation, scale
   */
  const [placedModels, setPlacedModels] = useState([]);

  /**
   * Current error message, if any operation has failed
   * Use clearError() to reset after handling
   */
  const [error, setError] = useState(null);

  /**
   * Detected planes state - updated in real-time as planes are detected
   * Contains horizontal and vertical plane counts for faster feedback
   */
  const [detectedPlanes, setDetectedPlanes] = useState({
    horizontal: 0,
    vertical: 0,
    total: 0,
  });

  /**
   * Real-time surface detection state - updated every frame (~60fps)
   * This is the fastest way to know if a surface is detected
   */
  const [surfaceState, setSurfaceState] = useState({
    hasSurface: false,
    position: null,
    rotation: null,
    planeType: null,
    confidence: 0,
  });

  // ============================================================
  // Refs for tracking session state across renders
  // ============================================================

  /**
   * Tracks whether a session is active (survives re-renders)
   * Used in cleanup to know if we need to stop the session
   */
  const sessionRef = useRef(false);

  /**
   * Array of cleanup functions for event listeners
   * Called when session stops or component unmounts
   */
  const cleanupRef = useRef([]);

  // ============================================================
  // Support Check (runs once on mount)
  // ============================================================

  /**
   * Check AR support when the component mounts
   * This runs once and sets isSupported to true/false
   */
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const result = await arCore.checkSupport();
        setIsSupported(result.supported);
      } catch (err) {
        setIsSupported(false);
        setError(err.message || "Unknown error");
      }
    };

    checkSupport();
  }, []);

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Start an AR session with optional configuration.
   *
   * This method:
   * 1. Initializes the WebXR session with camera access
   * 2. Sets up Three.js rendering
   * 3. Attaches event listeners for model updates
   * 4. Enables the DOM overlay for React UI
   *
   * @param {Object} options - Session configuration
   * @param {HTMLElement} options.domOverlay - DOM element to overlay on AR view
   * @returns {Promise<boolean>} True if session started successfully
   *
   * @example
   * const overlayRef = useRef(null);
   *
   * const handleStartAR = async () => {
   *   const success = await startSession({
   *     domOverlay: overlayRef.current
   *   });
   *   if (!success) {
   *     console.error('Failed to start AR');
   *   }
   * };
   */
  const startSession = useCallback(async (options = {}) => {
    try {
      setError(null);
      await arCore.startSession(options);
      setIsSessionActive(true);
      sessionRef.current = true;

      // Set up frame listener to track model state changes and surface detection
      // This keeps React state in sync with Three.js scene
      const removeFrameListener = arCore.addFrameListener((data) => {
        if (data.type === "modelPlaced") {
          // A new model was placed - add to our tracked models
          setPlacedModels((prev) => [
            ...prev,
            {
              anchorId: data.anchorId,
              modelUrl: data.modelUrl,
              position: data.position,
              rotation: data.rotation,
              scale: data.scale,
            },
          ]);
        } else if (data.type === "modelRemoved") {
          // A model was removed - filter it out
          setPlacedModels((prev) =>
            prev.filter((m) => m.anchorId !== data.anchorId)
          );
        } else if (data.type === "modelTransformed") {
          // A model's transform changed - update its properties
          setPlacedModels((prev) =>
            prev.map((m) =>
              m.anchorId === data.anchorId
                ? {
                    ...m,
                    position: data.position || m.position,
                    rotation: data.rotation || m.rotation,
                    scale: data.scale || m.scale,
                  }
                : m
            )
          );
        } else if (data.type === "surfaceDetected") {
          // Real-time surface detection - updates every frame when surface is visible
          console.log("[useARCore] Surface detected event received");
          setSurfaceState({
            hasSurface: true,
            position: data.position,
            rotation: data.rotation,
            planeType: data.planeType,
            confidence: data.confidence,
          });
        } else if (data.type === "surfaceLost") {
          // Surface is no longer detected
          console.log("[useARCore] Surface lost event received");
          setSurfaceState({
            hasSurface: false,
            position: null,
            rotation: null,
            planeType: null,
            confidence: 0,
          });
        }
      });

      // Store cleanup function to remove listener later
      if (removeFrameListener) {
        cleanupRef.current.push(removeFrameListener);
      }

      // Set up plane listener for real-time plane detection feedback
      const removePlaneListener = arCore.addPlaneListener((data) => {
        if (data.type === "planesUpdated") {
          setDetectedPlanes({
            horizontal: data.horizontalPlanes?.length || 0,
            vertical: data.verticalPlanes?.length || 0,
            total: data.planes?.length || 0,
          });
        }
      });

      if (removePlaneListener) {
        cleanupRef.current.push(removePlaneListener);
      }

      return true;
    } catch (err) {
      setError(err.message || "Unknown error");
      setIsSessionActive(false);
      return false;
    }
  }, []);

  /**
   * Stop the current AR session and clean up resources.
   *
   * This method:
   * 1. Ends the WebXR session
   * 2. Cleans up event listeners
   * 3. Clears placed models from state
   * 4. Releases Three.js resources
   *
   * @returns {Promise<void>}
   *
   * @example
   * const handleExitAR = async () => {
   *   await stopSession();
   *   navigate('/home'); // Return to non-AR view
   * };
   */
  const stopSession = useCallback(async () => {
    try {
      await arCore.stopSession();
      setIsSessionActive(false);
      sessionRef.current = false;

      // Run all cleanup functions (remove event listeners)
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];

      // Clear the placed models since they're no longer valid
      setPlacedModels([]);
    } catch (err) {
      setError(err.message || "Unknown error");
    }
  }, []);

  // ============================================================
  // Hit Testing
  // ============================================================

  /**
   * Perform a hit test at screen coordinates to find real-world surfaces.
   *
   * Hit testing is how you find where the user tapped in 3D space.
   * The x,y coordinates should be normalized (0-1 range) or pixel values.
   *
   * @param {number} x - X coordinate of the tap/touch
   * @param {number} y - Y coordinate of the tap/touch
   * @returns {Promise<Object>} Hit test result with position if successful
   * @returns {boolean} returns.hit - Whether a surface was found
   * @returns {Object} returns.position - 3D position {x, y, z} if hit
   * @returns {string} returns.error - Error message if failed
   *
   * @example
   * const handleTap = async (event) => {
   *   const result = await hitTest(event.clientX, event.clientY);
   *   if (result.hit) {
   *     await placeModel('/models/chair.glb', result.position);
   *   }
   * };
   */
  const hitTest = useCallback(
    async (x, y) => {
      // Guard: require active session for hit testing
      if (!isSessionActive) {
        return { hit: false, error: "Session not active" };
      }

      try {
        return await arCore.hitTest({ x, y });
      } catch (err) {
        const errorMsg = err.message || "Unknown error";
        setError(errorMsg);
        return { hit: false, error: errorMsg };
      }
    },
    [isSessionActive]
  );

  // ============================================================
  // Model Management
  // ============================================================

  /**
   * Place a 3D model at a specific position in the AR scene.
   *
   * Models should be in GLTF/GLB format for best compatibility.
   * The position is typically obtained from a hit test result.
   *
   * @param {string} modelUrl - URL or path to the GLTF/GLB model
   * @param {Object} position - Position in 3D space {x, y, z}
   * @param {Object} [rotation] - Rotation in radians {x, y, z}
   * @param {Object} [scale] - Scale multiplier {x, y, z}
   * @returns {Promise<Object>} Result with anchorId if successful
   * @returns {string} returns.anchorId - Unique ID for the placed model
   * @returns {string} returns.error - Error message if failed
   *
   * @example
   * const result = await placeModel(
   *   '/models/sofa.glb',
   *   { x: 0, y: 0, z: -2 },
   *   { x: 0, y: Math.PI / 4, z: 0 }, // Rotated 45 degrees
   *   { x: 1, y: 1, z: 1 }
   * );
   *
   * if (result.anchorId) {
   *   setCurrentModelId(result.anchorId);
   * }
   */
  const placeModel = useCallback(
    async (modelUrl, position, rotation, scale) => {
      // Guard: require active session for placing models
      if (!isSessionActive) {
        return { error: "Session not active" };
      }

      try {
        const result = await arCore.placeModel({
          modelUrl,
          position,
          rotation,
          scale,
        });
        return result;
      } catch (err) {
        const errorMsg = err.message || "Unknown error";
        setError(errorMsg);
        return { error: errorMsg };
      }
    },
    [isSessionActive]
  );

  /**
   * Remove a placed model from the AR scene.
   *
   * @param {string} anchorId - The ID of the model to remove
   * @returns {Promise<void>}
   *
   * @example
   * await removeModel(currentModelId);
   * setCurrentModelId(null);
   */
  const removeModel = useCallback(async (anchorId) => {
    try {
      await arCore.removeModel({ anchorId });
    } catch (err) {
      setError(err.message || "Unknown error");
    }
  }, []);

  /**
   * Transform a placed model (move, rotate, or scale).
   *
   * You can provide any combination of position, rotation, and scale.
   * Only the properties you provide will be updated.
   *
   * @param {string} anchorId - The ID of the model to transform
   * @param {Object} transforms - Transform properties to apply
   * @param {Object} [transforms.position] - New position {x, y, z}
   * @param {Object} [transforms.rotation] - New rotation {x, y, z}
   * @param {Object} [transforms.scale] - New scale {x, y, z}
   * @returns {Promise<void>}
   *
   * @example
   * // Rotate the model 90 degrees
   * await transformModel(modelId, {
   *   rotation: { x: 0, y: Math.PI / 2, z: 0 }
   * });
   *
   * // Scale up by 50%
   * await transformModel(modelId, {
   *   scale: { x: 1.5, y: 1.5, z: 1.5 }
   * });
   */
  const transformModel = useCallback(async (anchorId, transforms) => {
    try {
      await arCore.transformModel({
        anchorId,
        ...transforms,
      });
    } catch (err) {
      setError(err.message || "Unknown error");
    }
  }, []);

  // ============================================================
  // Material Customization
  // ============================================================

  /**
   * Change the color of a placed model.
   *
   * This applies a color tint to the model's materials.
   * Works best with models that have neutral base colors.
   *
   * @param {string} anchorId - The ID of the model to color
   * @param {string} color - CSS color value (hex, rgb, or named color)
   * @returns {Promise<void>}
   *
   * @example
   * // Set model to blue
   * await setModelColor(modelId, '#3498db');
   *
   * // Set model to red
   * await setModelColor(modelId, 'rgb(255, 0, 0)');
   */
  const setModelColor = useCallback(async (anchorId, color) => {
    try {
      await arCore.setModelColor({ anchorId, color });
    } catch (err) {
      setError(err.message || "Unknown error");
    }
  }, []);

  /**
   * Set material properties on a placed model.
   *
   * Allows fine-grained control over material appearance including
   * metalness, roughness, and opacity for realistic rendering.
   *
   * @param {string} anchorId - The ID of the model to modify
   * @param {Object} properties - Material properties to set
   * @param {number} [properties.metalness] - Metallic look (0-1)
   * @param {number} [properties.roughness] - Surface roughness (0-1)
   * @param {number} [properties.opacity] - Transparency (0-1)
   * @returns {Promise<void>}
   *
   * @example
   * // Make model look like polished metal
   * await setModelMaterial(modelId, {
   *   metalness: 0.9,
   *   roughness: 0.1
   * });
   *
   * // Make model semi-transparent wood
   * await setModelMaterial(modelId, {
   *   metalness: 0,
   *   roughness: 0.8,
   *   opacity: 0.7
   * });
   */
  const setModelMaterial = useCallback(async (anchorId, properties) => {
    try {
      await arCore.setModelMaterial({ anchorId, ...properties });
    } catch (err) {
      setError(err.message || "Unknown error");
    }
  }, []);

  // ============================================================
  // Error Handling
  // ============================================================

  /**
   * Clear the current error state.
   * Call this after displaying an error to the user.
   *
   * @returns {void}
   *
   * @example
   * useEffect(() => {
   *   if (error) {
   *     showToast(error);
   *     clearError();
   *   }
   * }, [error]);
   */
  const clearError = useCallback(() => setError(null), []);

  /**
   * Get detailed information about detected planes.
   * Useful for advanced plane visualization or debugging.
   *
   * @returns {Object} Object with all, horizontal, and vertical plane arrays
   */
  const getDetectedPlanes = useCallback(() => {
    return arCore.getDetectedPlanes();
  }, []);

  /**
   * Show or hide the reticle indicator.
   * The reticle shows where surfaces are detected in the AR view.
   *
   * @param {boolean} visible - Whether to show the reticle
   */
  const setReticleVisible = useCallback((visible) => {
    arCore.setReticleVisible(visible);
  }, []);

  /**
   * Set plugin configuration.
   * Use this to customize colors, sizes, and features.
   *
   * @param {Object} config - Configuration options
   */
  const setConfig = useCallback((config) => {
    arCore.setConfig(config);
  }, []);

  /**
   * Get current plugin configuration.
   *
   * @returns {Object} Current configuration
   */
  const getConfig = useCallback(() => {
    return arCore.getConfig();
  }, []);

  /**
   * Show or hide plane visualization (mesh overlay and dots).
   *
   * @param {boolean} visible - Whether plane visualization should be visible
   */
  const setPlaneVisualization = useCallback((visible) => {
    arCore.setPlaneVisualization(visible);
  }, []);

  // ============================================================
  // Cleanup on Unmount
  // ============================================================

  /**
   * Automatic cleanup when the component using this hook unmounts.
   * Ensures the AR session is properly stopped and resources released.
   */
  useEffect(() => {
    return () => {
      // Stop session if it's still running when component unmounts
      if (sessionRef.current) {
        arCore.stopSession().catch(() => {});
      }
      // Clean up any remaining event listeners
      cleanupRef.current.forEach((cleanup) => cleanup());
    };
  }, []);

  // ============================================================
  // Three.js Access (for advanced usage)
  // ============================================================

  /**
   * Get the Three.js WebGLRenderer instance.
   * Use this for advanced rendering customization.
   * @returns {THREE.WebGLRenderer|null}
   */
  const getRenderer = useCallback(() => arCore.getRenderer(), []);

  /**
   * Get the Three.js Scene instance.
   * Use this to add custom 3D objects beyond loaded models.
   * @returns {THREE.Scene|null}
   */
  const getScene = useCallback(() => arCore.getScene(), []);

  /**
   * Get the Three.js Camera instance.
   * The camera is controlled by WebXR for AR tracking.
   * @returns {THREE.Camera|null}
   */
  const getCamera = useCallback(() => arCore.getCamera(), []);

  // ============================================================
  // Screenshot
  // ============================================================

  /**
   * Take a screenshot of the current AR view.
   * Captures the Three.js rendered scene including placed models.
   *
   * @param {Object} [options] - Screenshot options
   * @param {string} [options.format='png'] - Image format ('png' or 'jpeg')
   * @param {number} [options.quality=0.92] - JPEG quality (0-1)
   * @returns {Promise<Object>} Screenshot result
   * @returns {boolean} returns.success - Whether screenshot was captured
   * @returns {string} returns.dataUrl - Base64 data URL of the image
   * @returns {number} returns.width - Image width in pixels
   * @returns {number} returns.height - Image height in pixels
   * @returns {string} returns.timestamp - ISO timestamp of capture
   * @returns {string} returns.error - Error message if failed
   *
   * @example
   * const result = await takeScreenshot({ format: 'jpeg', quality: 0.9 });
   * if (result.success) {
   *   // Download the screenshot
   *   const link = document.createElement('a');
   *   link.href = result.dataUrl;
   *   link.download = `ar-screenshot-${result.timestamp}.jpg`;
   *   link.click();
   * }
   */
  const takeScreenshot = useCallback(
    async (options = {}) => {
      if (!isSessionActive) {
        return { success: false, error: "Session not active" };
      }

      const result = await arCore.takeScreenshot(options);

      // Set error state if screenshot failed
      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    },
    [isSessionActive]
  );

  // ============================================================
  // Shadow Controls
  // ============================================================

  /**
   * Configure shadow appearance for placed models.
   * @param {Object} config - { enabled, opacity, size }
   */
  const setShadowConfig = useCallback((config) => {
    arCore.setShadowConfig(config);
  }, []);

  /**
   * Get current shadow configuration.
   * @returns {Object} Current shadow config
   */
  const getShadowConfig = useCallback(() => {
    return arCore.getShadowConfig();
  }, []);

  /**
   * Show or hide shadow for a specific model.
   * @param {string} anchorId - ID of the model
   * @param {boolean} visible - Whether shadow should be visible
   */
  const setShadowVisible = useCallback((anchorId, visible) => {
    arCore.setShadowVisible(anchorId, visible);
  }, []);

  // ============================================================
  // Return Hook API
  // ============================================================

  return {
    // State
    isSupported,
    isSessionActive,
    placedModels,
    error,
    detectedPlanes, // Plane counts (horizontal, vertical, total)
    surfaceState, // Real-time surface detection (hasSurface, position, rotation, planeType, confidence)

    // Session management
    startSession,
    stopSession,

    // AR operations
    hitTest,
    placeModel,
    removeModel,
    transformModel,

    // Customization
    setModelColor,
    setModelMaterial,

    // Configuration
    setConfig,
    getConfig,

    // Shadow controls
    setShadowConfig,
    getShadowConfig,
    setShadowVisible,

    // Plane detection & visualization
    getDetectedPlanes,
    setReticleVisible, // Show/hide the surface indicator
    setPlaneVisualization, // Show/hide plane mesh and dots

    // Utilities
    clearError,

    // Three.js accessors (advanced)
    getRenderer,
    getScene,
    getCamera,

    // Screenshot
    takeScreenshot,
  };
}
