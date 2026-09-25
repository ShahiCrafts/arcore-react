/**
 * ARCore Web Implementation
 *
 * Features:
 * - Surface/plane detection with dot grid visualization
 * - Placement reticle indicator
 * - Vertical AND horizontal plane detection using WebXR Plane Detection API
 * - 3D model placement with realistic shadows
 * - Model manipulation (move, rotate, scale, color)
 */

import { WebPlugin } from "@capacitor/core";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ARCoreWeb extends WebPlugin {
  constructor() {
    super();
    // WebXR session state
    this.session = null;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.xrGlBinding = null;
    this.pendingScreenshot = null;

    // Model management
    this.anchors = new Map();
    this.loadedModels = new Map();
    this.modelCache = new Map();
    this.modelShadows = new Map();
    this.modelBaseRings = new Map();

    // Plane visualization - using WebXR Plane Detection API
    this.detectedPlanes = new Map(); // Map<XRPlane, { mesh, dots, orientation }>
    this.planesMeshGroup = null;
    this.planeDotsGroup = null;

    // Event listeners
    this.planeListeners = [];
    this.frameListeners = [];

    // Three.js components
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.gltfLoader = null;
    this.textureLoader = new THREE.TextureLoader();

    // Surface reticle (placement indicator)
    this.reticle = null;
    this.reticleVisible = false;
    this.lastHitPosition = null;
    this.lastHitRotation = null;
    this.lastPlaneType = null;
    this.lastDetectedPlane = null; // Store reference to XRPlane from detectedPlanes

    // Surface detection state (for React hook)
    this.surfaceState = {
      hasSurface: false,
      position: null,
      rotation: null,
      planeType: null,
      confidence: 0,
    };

    // Configuration
    this.config = {
      showReticle: true,
      showPlanes: false, // Keep expensive plane meshes off by default
      showPlaneDots: true, // Lightweight dotted surface feedback; meshes remain disabled
      showShadow: true,
      showBaseRing: false,
      reticleColor: 0x00ff88, // Green for horizontal
      reticleColorVertical: 0xff6b6b, // Red for vertical
      planeColorHorizontal: 0x00ff88,
      planeColorVertical: 0xff6b6b,
      shadowOpacity: 0.4,
      shadowSize: 1.2,
      dotSize: 0.02,
      dotSpacing: 0.1,
    };

    // Render loop state
    this.isRendering = false;
    this.modelPlaced = false;

    // Plane detection feature availability
    this.planeDetectionSupported = false;
  }

  /**
   * Configure AR visual features
   */
  setConfig(options = {}) {
    this.config = { ...this.config, ...options };
  }

  getConfig() {
    return { ...this.config };
  }

  async checkSupport() {
    if (typeof navigator === "undefined" || !navigator.xr) {
      return { supported: false, reason: "WebXR not available" };
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      return {
        supported,
        reason: supported ? "WebXR AR supported" : "immersive-ar not supported",
      };
    } catch (error) {
      return {
        supported: false,
        reason: error.message || "Unknown error checking AR support",
      };
    }
  }

  /**
   * Create the placement reticle
   */
  createReticle() {
    const reticleGroup = new THREE.Group();
    reticleGroup.name = "ar-reticle";

    // Outer ring
    const ringGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.config.reticleColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.name = "outer-ring";
    reticleGroup.add(ring);

    // Inner ring
    const innerRingGeometry = new THREE.RingGeometry(0.05, 0.06, 32);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
      color: this.config.reticleColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.name = "inner-ring";
    reticleGroup.add(innerRing);

    // Center dot
    const dotGeometry = new THREE.CircleGeometry(0.02, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const centerDot = new THREE.Mesh(dotGeometry, dotMaterial);
    centerDot.rotation.x = -Math.PI / 2;
    centerDot.position.y = 0.001;
    centerDot.name = "center-dot";
    reticleGroup.add(centerDot);

    // Crosshair lines
    const lineLength = 0.04;
    const lineOffset = 0.07;
    const lineMaterial = new THREE.LineBasicMaterial({
      color: this.config.reticleColor,
      transparent: true,
      opacity: 0.8,
    });

    const directions = [
      [[0, 0.001, -lineOffset], [0, 0.001, -lineOffset - lineLength]],
      [[0, 0.001, lineOffset], [0, 0.001, lineOffset + lineLength]],
      [[-lineOffset, 0.001, 0], [-lineOffset - lineLength, 0.001, 0]],
      [[lineOffset, 0.001, 0], [lineOffset + lineLength, 0.001, 0]],
    ];

    directions.forEach(([start, end]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...start),
        new THREE.Vector3(...end),
      ]);
      const line = new THREE.Line(geometry, lineMaterial.clone());
      line.name = "crosshair";
      reticleGroup.add(line);
    });

    // Pulsing outer ring for animation
    const pulseGeometry = new THREE.RingGeometry(0.14, 0.15, 32);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: this.config.reticleColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pulseRing = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.name = "pulse-ring";
    reticleGroup.add(pulseRing);

    reticleGroup.visible = false;
    return reticleGroup;
  }

  /**
   * Update reticle color based on plane type
   */
  updateReticleColor(planeType) {
    if (!this.reticle) return;

    const color = planeType === "vertical"
      ? this.config.reticleColorVertical
      : this.config.reticleColor;

    this.reticle.traverse((child) => {
      if (child.material && child.name !== "center-dot") {
        child.material.color.setHex(color);
      }
    });
  }

  /**
   * Animate reticle pulse
   */
  animateReticle(timestamp) {
    if (!this.reticle || !this.reticle.visible) return;

    const pulseRing = this.reticle.getObjectByName("pulse-ring");
    if (pulseRing) {
      const scale = 1 + Math.sin(timestamp * 0.005) * 0.15;
      pulseRing.scale.set(scale, scale, 1);
      pulseRing.material.opacity = 0.4 - Math.sin(timestamp * 0.005) * 0.2;
    }
  }

  /**
   * Create a mesh visualization for a detected plane using XRPlane.polygon
   */
  createPlaneMesh(plane, pose, orientation) {
    const polygon = plane.polygon;
    if (!polygon || polygon.length < 3) return null;

    const color = orientation === "vertical"
      ? this.config.planeColorVertical
      : this.config.planeColorHorizontal;

    // Create geometry from polygon vertices
    const vertices = [];
    const indices = [];

    // XRPlane.polygon vertices are in the plane's local coordinate system
    // Y is always 0 for these points
    for (let i = 0; i < polygon.length; i++) {
      vertices.push(polygon[i].x, polygon[i].y, polygon[i].z);
    }

    // Create triangles using fan triangulation (works for convex polygons)
    for (let i = 1; i < polygon.length - 1; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;

    // Apply the plane's pose
    if (pose) {
      const matrix = new THREE.Matrix4();
      matrix.fromArray(pose.transform.matrix);
      mesh.matrix.copy(matrix);
    }

    return mesh;
  }

  /**
   * Create dots grid on a detected plane
   */
  createPlaneDots(plane, pose, orientation) {
    const polygon = plane.polygon;
    if (!polygon || polygon.length < 3) return null;

    const color = orientation === "vertical"
      ? this.config.planeColorVertical
      : this.config.planeColorHorizontal;

    // Calculate bounding box of polygon
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }

    // Create dots within the bounding box
    const dotsGroup = new THREE.Group();
    const dotGeometry = new THREE.CircleGeometry(this.config.dotSize, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const spacing = this.config.dotSpacing;

    for (let x = minX; x <= maxX; x += spacing) {
      for (let z = minZ; z <= maxZ; z += spacing) {
        // Check if point is inside polygon (simple ray casting)
        if (this.isPointInPolygon(x, z, polygon)) {
          const dot = new THREE.Mesh(dotGeometry, dotMaterial.clone());
          dot.position.set(x, 0.001, z); // Slightly above plane
          dot.rotation.x = -Math.PI / 2;
          dotsGroup.add(dot);
        }
      }
    }

    dotsGroup.matrixAutoUpdate = false;

    // Apply the plane's pose
    if (pose) {
      const matrix = new THREE.Matrix4();
      matrix.fromArray(pose.transform.matrix);
      dotsGroup.matrix.copy(matrix);
    }

    return dotsGroup;
  }

  /**
   * Check if a point is inside a polygon using ray casting algorithm
   */
  isPointInPolygon(x, z, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;

      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * Process detected planes from WebXR frame
   */
  processDetectedPlanes(frame) {
    if (!frame.detectedPlanes) {
      return;
    }

    const currentPlanes = frame.detectedPlanes;

    // Remove planes that are no longer detected
    for (const [xrPlane, planeData] of this.detectedPlanes) {
      if (!currentPlanes.has(xrPlane)) {
        // Remove mesh and dots from scene
        if (planeData.mesh) {
          this.planesMeshGroup.remove(planeData.mesh);
          planeData.mesh.geometry.dispose();
          planeData.mesh.material.dispose();
        }
        if (planeData.dots) {
          this.planeDotsGroup.remove(planeData.dots);
        }
        this.detectedPlanes.delete(xrPlane);
        console.log(`[ARCore] Plane removed: ${planeData.orientation}`);
      }
    }

    // Add or update planes
    for (const plane of currentPlanes) {
      const pose = frame.getPose(plane.planeSpace, this.referenceSpace);
      if (!pose) continue;

      const orientation = plane.orientation || "horizontal";

      if (!this.detectedPlanes.has(plane)) {
        // New plane detected
        console.log(`[ARCore] New plane detected: ${orientation}, polygon points: ${plane.polygon?.length || 0}`);

        const mesh = this.config.showPlanes ? this.createPlaneMesh(plane, pose, orientation) : null;
        const dots = this.config.showPlaneDots ? this.createPlaneDots(plane, pose, orientation) : null;

        if (mesh) {
          this.planesMeshGroup.add(mesh);
        }
        if (dots) {
          this.planeDotsGroup.add(dots);
        }

        this.detectedPlanes.set(plane, { mesh, dots, orientation, lastChangedTime: plane.lastChangedTime });

        // Notify listeners
        this.planeListeners.forEach(cb => cb({
          type: "planeAdded",
          orientation,
          polygon: plane.polygon,
        }));
      } else {
        // Update existing plane if changed
        const planeData = this.detectedPlanes.get(plane);

        if (plane.lastChangedTime !== planeData.lastChangedTime) {
          console.log(`[ARCore] Plane updated: ${orientation}`);

          // Remove old visualization
          if (planeData.mesh) {
            this.planesMeshGroup.remove(planeData.mesh);
            planeData.mesh.geometry.dispose();
            planeData.mesh.material.dispose();
          }
          if (planeData.dots) {
            this.planeDotsGroup.remove(planeData.dots);
          }

          // Create new visualization
          const mesh = this.config.showPlanes ? this.createPlaneMesh(plane, pose, orientation) : null;
          const dots = this.config.showPlaneDots ? this.createPlaneDots(plane, pose, orientation) : null;

          if (mesh) {
            this.planesMeshGroup.add(mesh);
          }
          if (dots) {
            this.planeDotsGroup.add(dots);
          }

          planeData.mesh = mesh;
          planeData.dots = dots;
          planeData.lastChangedTime = plane.lastChangedTime;
        } else {
          // Just update the pose
          if (planeData.mesh) {
            const matrix = new THREE.Matrix4();
            matrix.fromArray(pose.transform.matrix);
            planeData.mesh.matrix.copy(matrix);
          }
          if (planeData.dots) {
            const matrix = new THREE.Matrix4();
            matrix.fromArray(pose.transform.matrix);
            planeData.dots.matrix.copy(matrix);
          }
        }
      }
    }

    // Update plane counts for listeners
    let horizontalCount = 0;
    let verticalCount = 0;
    for (const [, data] of this.detectedPlanes) {
      if (data.orientation === "horizontal") horizontalCount++;
      else if (data.orientation === "vertical") verticalCount++;
    }

    if (this.detectedPlanes.size > 0) {
      this.planeListeners.forEach(cb => cb({
        type: "planesUpdated",
        total: this.detectedPlanes.size,
        horizontal: horizontalCount,
        vertical: verticalCount,
      }));
    }
  }

  /**
   * Find plane at hit test position - uses detectedPlanes API
   */
  findPlaneAtPosition(hitPosition, frame) {
    if (!frame.detectedPlanes || !this.referenceSpace) {
      return null;
    }

    // Find the closest plane to the hit position
    let closestPlane = null;
    let closestDistance = Infinity;

    for (const plane of frame.detectedPlanes) {
      const pose = frame.getPose(plane.planeSpace, this.referenceSpace);
      if (!pose) continue;

      // Calculate distance from hit position to plane center
      const planePos = pose.transform.position;
      const dx = hitPosition[0] - planePos.x;
      const dy = hitPosition[1] - planePos.y;
      const dz = hitPosition[2] - planePos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < closestDistance && distance < 1.0) { // Within 1 meter
        closestDistance = distance;
        closestPlane = plane;
      }
    }

    return closestPlane;
  }

  /**
   * Create soft blurred shadow plane for a model
   */
  createShadowPlane(size = 1) {
    // Make shadow larger for more blur area
    const shadowSize = size * this.config.shadowSize * 1.5;
    const shadowGeometry = new THREE.CircleGeometry(shadowSize, 64);

    const shadowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: this.config.shadowOpacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center) * 2.0;

          // Multi-step falloff for softer, more blurred shadow
          float innerShadow = 1.0 - smoothstep(0.0, 0.3, dist);  // Dark center
          float midShadow = 1.0 - smoothstep(0.2, 0.6, dist);    // Mid falloff
          float outerShadow = 1.0 - smoothstep(0.4, 1.0, dist);  // Soft outer edge

          // Blend the layers for natural blur effect
          float alpha = opacity * (innerShadow * 0.5 + midShadow * 0.3 + outerShadow * 0.2);

          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    shadow.name = "model-shadow";

    return shadow;
  }

  /**
   * Calculate the footprint (base size) of a model.
   *
   * @param {THREE.Object3D} model - The model to measure
   * @returns {number} Approximate radius of the model's base
   */
  getModelFootprint(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Use the larger of width or depth for shadow radius
    return Math.max(size.x, size.z) / 2;
  }

  initThreeJS() {
    // Create WebGL renderer with transparency for AR
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Transparent background (shows camera)
      preserveDrawingBuffer: false, // Avoid a large mobile GPU/memory penalty
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true; // Enable WebXR mode

    // Tone mapping prevents washed-out look and adds depth
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Position canvas behind the DOM overlay
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.zIndex = "0";

    // Create scene to hold all 3D objects
    this.scene = new THREE.Scene();

    // Create camera (WebXR will replace this with its tracked camera)
    this.camera = new THREE.PerspectiveCamera(
      70, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.01, // Near clipping plane (1cm)
      100 // Far clipping plane (100m)
    );

    // Ambient light - reduced to allow directional light to create contrast
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Hemisphere light - adds natural sky/ground color variation for depth
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    // Main directional light - creates shadows and highlights for 3D depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = false; // Blob shadows are cheaper and more stable on mobile AR
    this.scene.add(directionalLight);

    // Fill light from opposite side - prevents harsh shadows, adds realism
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    this.gltfLoader = new GLTFLoader();

    // Create planes visualization groups
    this.planesMeshGroup = new THREE.Group();
    this.planesMeshGroup.name = "detected-planes-mesh";
    this.scene.add(this.planesMeshGroup);

    this.planeDotsGroup = new THREE.Group();
    this.planeDotsGroup.name = "detected-planes-dots";
    this.scene.add(this.planeDotsGroup);

    // Create reticle
    this.reticle = this.createReticle();
    this.scene.add(this.reticle);
    console.log("[ARCore] Three.js initialized, reticle created");

    return this.renderer;
  }

  async startSession(options = {}) {
    const {
      planeDetection = true,
      lightEstimation = true,
      domOverlay = null,
    } = options;

    if (!this.renderer) {
      this.initThreeJS();
    }

    if (domOverlay && domOverlay.parentElement) {
      domOverlay.parentElement.insertBefore(
        this.renderer.domElement,
        domOverlay
      );
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    const sessionOptions = {
      requiredFeatures: ["local-floor", "hit-test"],
      optionalFeatures: [],
    };

    // Add plane-detection as optional feature
    if (planeDetection) {
      sessionOptions.optionalFeatures.push("plane-detection");
    }

    if (lightEstimation) {
      sessionOptions.optionalFeatures.push("light-estimation");
      // Raw camera access lets takeScreenshot() capture the real-world passthrough
      // instead of only Three.js' transparent WebGL layer. It is optional so AR
      // still starts on browsers that do not implement the module.
      sessionOptions.optionalFeatures.push("camera-access");
    }

    if (domOverlay) {
      sessionOptions.domOverlay = { root: domOverlay };
      sessionOptions.optionalFeatures.push("dom-overlay");
    }

    try {
      this.session = await navigator.xr.requestSession(
        "immersive-ar",
        sessionOptions
      );
      await this.renderer.xr.setSession(this.session);

      try {
        const gl = this.renderer.getContext();
        if (typeof XRWebGLBinding !== "undefined") {
          this.xrGlBinding = new XRWebGLBinding(this.session, gl);
        }
      } catch (_) {
        this.xrGlBinding = null;
      }

      this.referenceSpace = await this.session.requestReferenceSpace(
        "local-floor"
      );
      this.viewerSpace = await this.session.requestReferenceSpace("viewer");

      // Request hit test source for instant positioning
      this.hitTestSource = await this.session.requestHitTestSource({
        space: this.viewerSpace,
      });

      // Check if plane detection is supported
      this.planeDetectionSupported = typeof XRFrame !== 'undefined' && 'detectedPlanes' in XRFrame.prototype;
      console.log(`[ARCore] Plane detection API supported: ${this.planeDetectionSupported}`);

      this.session.addEventListener("end", () => {
        this.frameListeners.forEach((cb) => cb({ type: "sessionEnded" }));
        this.stopRendering();
        this.session = null;
        this.hitTestSource = null;
        this.referenceSpace = null;
        this.viewerSpace = null;
      });

      // Reset state
      this.modelPlaced = false;
      this.reticleVisible = false;
      this.config.showReticle = true;

      console.log("[ARCore] Session started - showReticle:", this.config.showReticle, "planeDetection:", this.planeDetectionSupported);

      this.startRendering();

      return { success: true, hasOverlay: !!domOverlay, planeDetection: this.planeDetectionSupported };
    } catch (error) {
      throw new Error(
        `Failed to start AR session: ${error.message || "Unknown error"}`
      );
    }
  }

  startRendering() {
    if (this.isRendering) return;
    this.isRendering = true;

    let frameCount = 0;
    let lastLoggedPlaneType = null;

    this.renderer.setAnimationLoop((timestamp, frame) => {
      if (!frame) return;

      frameCount++;

      // Process detected planes using the WebXR Plane Detection API
      if (this.planeDetectionSupported && (this.detectedPlanes.size === 0 || frameCount % 8 === 0)) {
        try {
          this.processDetectedPlanes(frame);
        } catch (e) {
          if (frameCount === 1) {
            console.log("[ARCore] Plane detection not available in this frame:", e.message);
          }
        }
      }

      // Hit testing for reticle positioning
      if (this.hitTestSource && this.referenceSpace) {
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);

        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(this.referenceSpace);

          if (pose) {
            // Store hit position
            this.lastHitPosition = [
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z,
            ];
            this.lastHitRotation = [
              pose.transform.orientation.x,
              pose.transform.orientation.y,
              pose.transform.orientation.z,
              pose.transform.orientation.w,
            ];

            // Try to find the plane at this position using detectedPlanes API
            let planeType = "horizontal"; // Default

            // Hit-test success is the authoritative fast path. Plane polygon
            // classification is comparatively expensive, so do it periodically
            // instead of blocking every XR frame.
            if (this.planeDetectionSupported && frame.detectedPlanes && frameCount % 8 === 0) {
              const plane = this.findPlaneAtPosition(this.lastHitPosition, frame);
              if (plane && plane.orientation) {
                planeType = plane.orientation;
                this.lastDetectedPlane = plane;
              }
            }
            if (!this.lastDetectedPlane) {
              planeType = this.inferPlaneTypeFromQuaternion(pose.transform.orientation);
            } else if (this.lastDetectedPlane.orientation) {
              planeType = this.lastDetectedPlane.orientation;
            }

            this.lastPlaneType = planeType;

            // Update surface state
            this.surfaceState = {
              hasSurface: true,
              position: this.lastHitPosition,
              rotation: this.lastHitRotation,
              planeType: planeType,
              confidence: 1,
            };

            // Reticle visibility
            const shouldShowReticle = this.config.showReticle && this.reticle;

            if (shouldShowReticle) {
              this.reticle.visible = true;
              this.reticleVisible = true;

              this.reticle.position.set(
                pose.transform.position.x,
                pose.transform.position.y,
                pose.transform.position.z
              );

              if (planeType === "horizontal") {
                this.reticle.quaternion.set(0, 0, 0, 1);
              } else {
                this.reticle.quaternion.set(
                  pose.transform.orientation.x,
                  pose.transform.orientation.y,
                  pose.transform.orientation.z,
                  pose.transform.orientation.w
                );
              }

              this.updateReticleColor(planeType);
            } else if (this.reticle) {
              this.reticle.visible = false;
              this.reticleVisible = false;
            }

            // Notify listeners
            this.frameListeners.forEach((cb) =>
              cb({
                type: "surfaceDetected",
                hasSurface: true,
                position: this.lastHitPosition,
                rotation: this.lastHitRotation,
                planeType: planeType,
                confidence: 1,
              })
            );

            // Debug logging
            if (planeType !== lastLoggedPlaneType || (frameCount % 180 === 0 && frameCount < 900)) {
              console.log(`[ARCore] Surface: ${planeType}, planes: ${this.detectedPlanes.size}, reticle: ${shouldShowReticle ? 'visible' : 'hidden'}`);
              lastLoggedPlaneType = planeType;
            }
          }
        } else {
          if (this.reticle) {
            this.reticle.visible = false;
          }
          this.reticleVisible = false;

          this.surfaceState = {
            hasSurface: false,
            position: null,
            rotation: null,
            planeType: null,
            confidence: 0,
          };

          this.frameListeners.forEach((cb) =>
            cb({
              type: "surfaceLost",
              hasSurface: false,
            })
          );
        }
      }

      // Animate reticle
      this.animateReticle(timestamp);

      // Update model positions
      this.updateModelPositions(frame);

      // Render
      this.renderer.render(this.scene, this.camera);

      // Camera textures are only valid while the XR animation frame is active.
      // Fulfil screenshot requests here so callers can use a simple async API.
      if (this.pendingScreenshot) {
        const request = this.pendingScreenshot;
        this.pendingScreenshot = null;
        this._captureXRFrame(frame, request.options)
          .then(request.resolve)
          .catch((error) => request.resolve({ success: false, error: error.message || "Screenshot failed" }));
      }
    });
  }

  /**
   * Fallback method to infer plane type from quaternion when plane detection API is not available
   */
  inferPlaneTypeFromQuaternion(quaternion) {
    const qx = quaternion.x;
    const qy = quaternion.y;
    const qz = quaternion.z;
    const qw = quaternion.w;

    // Calculate the Y component of the normal vector
    const normalY = 1 - 2 * (qx * qx + qz * qz);

    // If normal mostly points up/down, it's horizontal
    // Threshold of 0.5 (45 degrees)
    return Math.abs(normalY) > 0.5 ? "horizontal" : "vertical";
  }

  stopRendering() {
    if (!this.isRendering) return;
    this.isRendering = false;

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }
  }

  updateModelPositions(frame) {
    this.loadedModels.forEach((model, anchorId) => {
      const anchorData = this.anchors.get(anchorId);
      if (!anchorData) return;

      if (anchorData.position) {
        model.position.set(
          anchorData.position[0],
          anchorData.position[1],
          anchorData.position[2]
        );

        const shadow = this.modelShadows.get(anchorId);
        if (shadow) {
          shadow.position.set(
            anchorData.position[0],
            anchorData.position[1] + 0.001,
            anchorData.position[2]
          );
        }
      }

      if (anchorData.rotation) {
        model.quaternion.set(
          anchorData.rotation[0],
          anchorData.rotation[1],
          anchorData.rotation[2],
          anchorData.rotation[3]
        );
      }

      if (anchorData.scale) {
        model.scale.set(
          anchorData.scale[0],
          anchorData.scale[1],
          anchorData.scale[2]
        );

        const shadow = this.modelShadows.get(anchorId);
        if (shadow) {
          const avgScale = (anchorData.scale[0] + anchorData.scale[2]) / 2;
          shadow.scale.set(avgScale, avgScale, 1);
        }
      }
    });
  }

  async stopSession() {
    this.stopRendering();

    this.loadedModels.forEach((model) => this.scene.remove(model));
    this.modelShadows.forEach((shadow) => this.scene.remove(shadow));
    this.modelBaseRings.forEach((ring) => this.scene.remove(ring));

    this.loadedModels.clear();
    this.modelShadows.clear();
    this.modelBaseRings.clear();

    // Clear plane visualizations
    this.detectedPlanes.forEach((planeData) => {
      if (planeData.mesh) {
        this.planesMeshGroup.remove(planeData.mesh);
        planeData.mesh.geometry.dispose();
        planeData.mesh.material.dispose();
      }
      if (planeData.dots) {
        this.planeDotsGroup.remove(planeData.dots);
      }
    });
    this.detectedPlanes.clear();

    if (this.reticle) {
      this.reticle.visible = false;
    }

    this.modelPlaced = false;

    if (this.session) {
      await this.session.end();
      this.session = null;
      this.hitTestSource = null;
      this.referenceSpace = null;
      this.viewerSpace = null;
      this.anchors.clear();
    }

    if (this.renderer && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement
      );
    }
  }

  async hitTest({ x, y }) {
    if (!this.session || !this.hitTestSource || !this.referenceSpace) {
      return { hit: false, error: "Session not active" };
    }

    // Use cached hit result if available
    if (this.lastHitPosition && this.reticleVisible) {
      return {
        hit: true,
        position: this.lastHitPosition,
        rotation: this.lastHitRotation,
        planeType: this.lastPlaneType || "horizontal",
      };
    }

    return new Promise((resolve) => {
      const onFrame = (time, frame) => {
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);

        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(this.referenceSpace);

          if (pose) {
            let planeType = "horizontal";

            // Try to get plane type from detected planes
            if (this.planeDetectionSupported && frame.detectedPlanes) {
              const position = [
                pose.transform.position.x,
                pose.transform.position.y,
                pose.transform.position.z,
              ];
              const plane = this.findPlaneAtPosition(position, frame);
              if (plane && plane.orientation) {
                planeType = plane.orientation;
              }
            }

            resolve({
              hit: true,
              position: [
                pose.transform.position.x,
                pose.transform.position.y,
                pose.transform.position.z,
              ],
              rotation: [
                pose.transform.orientation.x,
                pose.transform.orientation.y,
                pose.transform.orientation.z,
                pose.transform.orientation.w,
              ],
              planeType: planeType,
            });
            return;
          }
        }

        resolve({ hit: false });
      };

      this.session.requestAnimationFrame(onFrame);
    });
  }

  getSurfaceState() {
    return {
      detected: this.reticleVisible,
      hasSurface: this.reticleVisible,
      position: this.lastHitPosition,
      rotation: this.lastHitRotation,
      planeType: this.lastPlaneType,
      planesCount: this.detectedPlanes.size,
    };
  }

  getSurfaceDetectionState() {
    return this.surfaceState;
  }

  getDetectedPlanes() {
    const planes = [];
    for (const [xrPlane, data] of this.detectedPlanes) {
      planes.push({
        orientation: data.orientation,
        polygon: xrPlane.polygon ? Array.from(xrPlane.polygon).map(p => ({ x: p.x, y: p.y, z: p.z })) : [],
      });
    }
    return planes;
  }

  setReticleVisible(visible) {
    console.log(`[ARCore] setReticleVisible(${visible})`);
    this.config.showReticle = visible;
    if (!visible && this.reticle) {
      this.reticle.visible = false;
      this.reticleVisible = false;
    }
  }

  async loadModel(modelUrl) {
    if (this.modelCache.has(modelUrl)) {
      return this.modelCache.get(modelUrl).scene.clone();
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          this.modelCache.set(modelUrl, gltf);
          resolve(gltf.scene.clone());
        },
        (progress) => {
          const percent = ((progress.loaded / progress.total) * 100).toFixed(0);
          console.log(`Loading model: ${percent}%`);
        },
        (error) => {
          console.error("Error loading model:", error);
          reject(error);
        }
      );
    });
  }

  async placeModel({
    modelUrl,
    modelPath,
    position,
    rotation = [0, 0, 0, 1],
    scale = [1, 1, 1],
  }) {
    modelUrl = modelUrl || modelPath;
    position = position || this.lastHitPosition;
    rotation = rotation || this.lastHitRotation || [0, 0, 0, 1];
    if (!modelUrl) throw new Error("modelUrl/modelPath is required");
    if (!position) throw new Error("No surface hit available. Scan a surface before placing a model.");
    const anchorId = `anchor_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.anchors.set(anchorId, {
      modelUrl,
      position,
      rotation,
      scale,
    });

    try {
      const model = await this.loadModel(modelUrl);
      model.traverse(child => {
        if (!child.isMesh || !child.material) return;
        child.material = Array.isArray(child.material)
          ? child.material.map(material => material.clone())
          : child.material.clone();
      });

      model.position.set(position[0], position[1], position[2]);
      model.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
      model.scale.set(scale[0], scale[1], scale[2]);

      // Add to scene and track
      this.scene.add(model);
      this.loadedModels.set(anchorId, model);

      const footprint = this.getModelFootprint(model);

      if (this.config.showShadow) {
        const shadow = this.createShadowPlane(footprint);
        shadow.position.set(position[0], position[1] + 0.001, position[2]);
        this.scene.add(shadow);
        this.modelShadows.set(anchorId, shadow);
      }

      // Keep surface feedback active after placement. This lets users see where
      // another object could be placed and avoids losing spatial context.
      this.modelPlaced = true;
      this.config.showReticle = true;

      this.frameListeners.forEach((cb) =>
        cb({
          type: "modelPlaced",
          anchorId,
          modelUrl,
          position,
          rotation,
          scale,
        })
      );

      return { anchorId };
    } catch (error) {
      this.anchors.delete(anchorId);
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  async removeModel({ anchorId }) {
    const model = this.loadedModels.get(anchorId);
    if (model) {
      this.scene.remove(model);
      this.loadedModels.delete(anchorId);
    }

    const shadow = this.modelShadows.get(anchorId);
    if (shadow) {
      this.scene.remove(shadow);
      this.modelShadows.delete(anchorId);
    }

    const baseRing = this.modelBaseRings.get(anchorId);
    if (baseRing) {
      this.scene.remove(baseRing);
      this.modelBaseRings.delete(anchorId);
    }

    this.anchors.delete(anchorId);

    this.modelPlaced = this.loadedModels.size > 0;
    this.config.showReticle = true;

    this.frameListeners.forEach((cb) => cb({ type: "modelRemoved", anchorId }));
  }

  async transformModel({ anchorId, position, rotation, scale }) {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    if (position) anchor.position = position;
    if (rotation) anchor.rotation = rotation;
    if (scale) anchor.scale = scale;

    const model = this.loadedModels.get(anchorId);
    if (model) {
      if (position) model.position.set(position[0], position[1], position[2]);
      if (rotation)
        model.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
      if (scale) model.scale.set(scale[0], scale[1], scale[2]);
    }

    this.frameListeners.forEach((cb) =>
      cb({ type: "modelTransformed", anchorId, ...anchor })
    );
  }

  setShadowVisible(anchorId, visible) {
    const shadow = this.modelShadows.get(anchorId);
    if (shadow) shadow.visible = visible;
  }

  addPlaneListener(callback) {
    this.planeListeners.push(callback);
    return () => {
      this.planeListeners = this.planeListeners.filter((cb) => cb !== callback);
    };
  }

  addFrameListener(callback) {
    this.frameListeners.push(callback);
    return () => {
      this.frameListeners = this.frameListeners.filter((cb) => cb !== callback);
    };
  }

  getSession() {
    return this.session;
  }
  getAnchors() {
    return this.anchors;
  }
  getRenderer() {
    return this.renderer;
  }
  getScene() {
    return this.scene;
  }
  getCamera() {
    return this.camera;
  }

  async setModelColor({ anchorId, color }) {
    const model = this.loadedModels.get(anchorId);
    if (!model) throw new Error(`Model with anchorId ${anchorId} not found`);

    const threeColor = new THREE.Color(color);

    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            mat.color = threeColor;
            mat.needsUpdate = true;
          });
        } else {
          child.material.color = threeColor;
          child.material.needsUpdate = true;
        }
      }
    });

    this.frameListeners.forEach((cb) =>
      cb({ type: "modelColorChanged", anchorId, color })
    );
  }

  async setModelMaterial({ anchorId, metalness, roughness, opacity }) {
    const model = this.loadedModels.get(anchorId);
    if (!model) throw new Error(`Model with anchorId ${anchorId} not found`);

    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat) => {
          if (metalness !== undefined) mat.metalness = metalness;
          if (roughness !== undefined) mat.roughness = roughness;
          if (opacity !== undefined) {
            mat.opacity = opacity;
            mat.transparent = opacity < 1;
          }
          mat.needsUpdate = true;
        });
      }
    });
  }

  /** Swap geometry at an existing anchor while preserving placement and transforms. */
  async switchModel({ anchorId, modelUrl, preserveMaterial = true }) {
    const anchor = this.anchors.get(anchorId);
    const oldModel = this.loadedModels.get(anchorId);
    if (!anchor || !oldModel) throw new Error(`Anchor ${anchorId} not found`);
    const next = await this.loadModel(modelUrl);
    next.traverse(child => {
      if (!child.isMesh || !child.material) return;
      child.material = Array.isArray(child.material)
        ? child.material.map(material => material.clone())
        : child.material.clone();
    });
    next.position.copy(oldModel.position);
    next.quaternion.copy(oldModel.quaternion);
    next.scale.copy(oldModel.scale);
    if (preserveMaterial) {
      let sourceMaterial = null;
      oldModel.traverse(c => { if (!sourceMaterial && c.isMesh && c.material) sourceMaterial = Array.isArray(c.material) ? c.material[0] : c.material; });
      if (sourceMaterial) next.traverse(c => { if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => { if (m.color && sourceMaterial.color) m.color.copy(sourceMaterial.color); if (sourceMaterial.map) m.map = sourceMaterial.map; m.needsUpdate = true; });
      }});
    }
    this.scene.add(next);
    this.scene.remove(oldModel);
    this.loadedModels.set(anchorId, next);
    anchor.modelUrl = modelUrl;
    const oldShadow = this.modelShadows.get(anchorId);
    if (oldShadow) { this.scene.remove(oldShadow); this.modelShadows.delete(anchorId); }
    if (this.config.showShadow) {
      const shadow = this.createShadowPlane(this.getModelFootprint(next));
      shadow.position.set(anchor.position[0], anchor.position[1] + .001, anchor.position[2]);
      this.scene.add(shadow); this.modelShadows.set(anchorId, shadow);
    }
    this.frameListeners.forEach(cb => cb({ type:'modelSwitched', anchorId, modelUrl }));
    return { anchorId, modelUrl };
  }

  async setModelTexture({ anchorId, textureUrl, materialName }) {
    const model = this.loadedModels.get(anchorId);
    if (!model) throw new Error(`Model with anchorId ${anchorId} not found`);
    const texture = await this.textureLoader.loadAsync(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    model.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (!materialName || mat.name === materialName) { mat.map = texture; mat.needsUpdate = true; }
      });
    });
    return { success:true, anchorId, textureUrl };
  }

  // Capacitor facade compatibility: the native API uses modelId/setTransform/setMaterial.
  // On web the model identifier is the anchor id, so normalize both forms here.
  async setTransform(options = {}) {
    const anchorId = options.anchorId || options.modelId;
    const rotation = options.rotation && !Array.isArray(options.rotation)
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
          THREE.MathUtils.degToRad(options.rotation.x || 0),
          THREE.MathUtils.degToRad(options.rotation.y || 0),
          THREE.MathUtils.degToRad(options.rotation.z || 0)
        )).toArray()
      : options.rotation;
    const scale = typeof options.scale === "number"
      ? [options.scale, options.scale, options.scale]
      : options.scale;
    return this.transformModel({ anchorId, position: options.position, rotation, scale });
  }

  async setMaterial(options = {}) {
    const anchorId = options.anchorId || options.modelId;
    if (options.color) await this.setModelColor({ anchorId, color: options.color });
    if (options.metalness !== undefined || options.roughness !== undefined || options.opacity !== undefined) {
      await this.setModelMaterial({ anchorId, metalness: options.metalness, roughness: options.roughness, opacity: options.opacity });
    }
    return { success: true };
  }

  async moveModel(options = {}) {
    const anchorId = options.anchorId || options.modelId;
    const hit = await this.hitTest({ x: options.x ?? 0.5, y: options.y ?? 0.5 });
    if (!hit.hit) return hit;
    await this.transformModel({ anchorId, position: hit.position, rotation: hit.rotation });
    return { ...hit, success: true };
  }

  // ============================================================
  // Shadow Configuration
  // ============================================================

  /**
   * Configure shadow appearance for all models
   */
  setShadowConfig(config = {}) {
    if (config.enabled !== undefined) this.config.showShadow = config.enabled;
    if (config.opacity !== undefined) this.config.shadowOpacity = config.opacity;
    if (config.size !== undefined) this.config.shadowSize = config.size;

    // Update existing shadows
    this.modelShadows.forEach((shadow) => {
      if (shadow.material.uniforms) {
        shadow.material.uniforms.opacity.value = this.config.shadowOpacity;
      }
      shadow.visible = this.config.showShadow;
    });
  }

  /**
   * Get current shadow configuration
   */
  getShadowConfig() {
    return {
      enabled: this.config.showShadow,
      opacity: this.config.shadowOpacity,
      size: this.config.shadowSize,
    };
  }

  // ============================================================
  // Screenshot
  // ============================================================

  /**
   * Take a screenshot of the current AR view
   */
  async takeScreenshot(options = {}) {
    if (!this.renderer || !this.scene || !this.camera || !this.session) {
      return { success: false, error: 'AR session not active' };
    }
    if (!this.xrGlBinding || typeof this.xrGlBinding.getCameraImage !== 'function') {
      return {
        success: false,
        code: 'CAMERA_CAPTURE_UNAVAILABLE',
        error: 'This browser does not expose WebXR camera frames. AR remains active.',
      };
    }
    if (this.pendingScreenshot) {
      return { success: false, code: 'CAPTURE_BUSY', error: 'A screenshot is already being captured' };
    }
    return new Promise((resolve) => { this.pendingScreenshot = { resolve, options }; });
  }

  async _captureXRFrame(frame, options = {}) {
    const pose = frame.getViewerPose(this.referenceSpace);
    const view = pose?.views?.find(v => v.camera) || pose?.views?.[0];
    if (!view?.camera) throw new Error('WebXR camera access was not granted');

    const gl = this.renderer.getContext();
    const texture = this.xrGlBinding.getCameraImage(view.camera);
    if (!texture) throw new Error('Camera frame is unavailable');

    const width = Math.max(1, options.width || window.innerWidth);
    const height = Math.max(1, options.height || window.innerHeight);
    const cameraPixels = this._readCameraTexture(gl, texture, width, height);

    // Render the virtual scene into a transparent offscreen target with the exact
    // tracked XR camera, then alpha-composite it over the camera frame.
    const target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false
    });
    const oldTarget = this.renderer.getRenderTarget();
    const oldXr = this.renderer.xr.enabled;
    const xrCamera = this.renderer.xr.getCamera(this.camera);
    const captureCamera = xrCamera.cameras?.[0] || xrCamera;
    const reticleWasVisible = this.reticle?.visible;
    if (options.includeReticle === false && this.reticle) this.reticle.visible = false;
    try {
      this.renderer.xr.enabled = false;
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, captureCamera);
      const virtualPixels = new Uint8Array(width * height * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, virtualPixels);
      return this._composeScreenshot(cameraPixels, virtualPixels, width, height, options);
    } finally {
      if (this.reticle) this.reticle.visible = reticleWasVisible;
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.xr.enabled = oldXr;
      target.dispose();
      this.renderer.resetState();
    }
  }

  _readCameraTexture(gl, cameraTexture, width, height) {
    const vs = `attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*.5; gl_Position=vec4(p,0.,1.);}`;
    const fs = `precision mediump float; varying vec2 uv; uniform sampler2D tex; void main(){gl_FragColor=texture2D(tex, vec2(uv.x, 1.0-uv.y));}`;
    const shader=(type,src)=>{const x=gl.createShader(type);gl.shaderSource(x,src);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x)||'Camera shader failed');return x;};
    const program=gl.createProgram(), v=shader(gl.VERTEX_SHADER,vs), f=shader(gl.FRAGMENT_SHADER,fs);
    gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Camera capture program failed');
    const outTex=gl.createTexture(), fb=gl.createFramebuffer(), buf=gl.createBuffer();
    const pixels=new Uint8Array(width*height*4);
    try {
      gl.bindTexture(gl.TEXTURE_2D,outTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,outTex,0);
      gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cameraTexture);gl.uniform1i(gl.getUniformLocation(program,'tex'),0);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      return pixels;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteBuffer(buf);gl.deleteFramebuffer(fb);gl.deleteTexture(outTex);gl.deleteProgram(program);gl.deleteShader(v);gl.deleteShader(f);
      this.renderer.resetState();
    }
  }

  _composeScreenshot(cameraPixels, virtualPixels, width, height, options = {}) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
    const out=ctx.createImageData(width,height), dst=out.data;
    // Both readbacks originate at the GL bottom-left. Flip rows while composing.
    for(let y=0;y<height;y++){for(let x=0;x<width;x++){
      const src=((height-1-y)*width+x)*4, d=(y*width+x)*4, a=virtualPixels[src+3]/255, ia=1-a;
      dst[d]=virtualPixels[src]*a+cameraPixels[src]*ia;dst[d+1]=virtualPixels[src+1]*a+cameraPixels[src+1]*ia;dst[d+2]=virtualPixels[src+2]*a+cameraPixels[src+2]*ia;dst[d+3]=255;
    }}
    ctx.putImageData(out,0,0);
    const format=options.format==='jpeg'?'jpeg':'png', mime=format==='jpeg'?'image/jpeg':'image/png', quality=options.quality??0.92;
    return { success:true, dataUrl:canvas.toDataURL(mime,quality), width, height, timestamp:new Date().toISOString(), includesCamera:true };
  }

  // ============================================================
  // Plane Visualization Controls
  // ============================================================

  /**
   * Show or hide plane visualization (mesh overlay and dots)
   */
  setPlaneVisualization(visible) {
    this.config.showPlanes = visible;
    this.config.showPlaneDots = visible;

    if (this.planesMeshGroup) {
      this.planesMeshGroup.visible = visible;
    }
    if (this.planeDotsGroup) {
      this.planeDotsGroup.visible = visible;
    }
  }

  /**
   * Get whether plane visualization is enabled
   */
  isPlaneVisualizationEnabled() {
    return this.config.showPlanes || this.config.showPlaneDots;
  }
}
