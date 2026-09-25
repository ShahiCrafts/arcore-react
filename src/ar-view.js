import * as THREE from 'three';
import { ARCoreWeb } from './web.js';
import { createARGestureController } from './gestures.js';

/** High-level, framework-agnostic AR facade. React/Vue/plain DOM can all use this. */
export class ARView {
  constructor(options = {}) {
    this.engine = options.engine || new ARCoreWeb();
    this.overlay = options.overlay || null;
    this.activeModelId = null;
    this.activeModelUrl = null;
    this.gestures = null;
    this.textures = new Map();
    this.transform = { scale: 1, rotationY: 0 };
  }

  async checkSupport() { return this.engine.checkSupport(); }

  async create(options = {}) {
    if (options.overlay) this.overlay = options.overlay;
    this.engine.setConfig({
      showReticle: options.showReticle !== false,
      showPlanes: false,
      showPlaneDots: options.showPlaneDots !== false,
      dotSpacing: options.dotSpacing ?? 0.14,
      dotSize: options.dotSize ?? 0.014,
      showShadow: options.showShadow !== false,
    });
    const result = await this.engine.startSession({
      domOverlay: this.overlay,
      planeDetection: options.planeDetection !== false,
      lightEstimation: options.lightEstimation !== false,
    });
    // Ensure groups reflect config immediately even if created before setConfig.
    if (this.engine.planesMeshGroup) this.engine.planesMeshGroup.visible = false;
    if (this.engine.planeDotsGroup) this.engine.planeDotsGroup.visible = options.showPlaneDots !== false;
    return result;
  }

  async destroy() {
    this.gestures?.destroy();
    this.gestures = null;
    await this.engine.stopSession();
  }

  onFrame(callback) { return this.engine.addFrameListener(callback); }
  onPlanes(callback) { return this.engine.addPlaneListener(callback); }
  getSurface() { return this.engine.getSurfaceDetectionState(); }
  getPlanes() { return this.engine.getDetectedPlanes(); }
  setReticleVisible(visible) { this.engine.setReticleVisible(visible); }
  setSurfaceDotsVisible(visible) {
    this.engine.config.showPlaneDots = visible;
    if (this.engine.planeDotsGroup) this.engine.planeDotsGroup.visible = visible;
  }

  async preloadModels(urls = []) { await Promise.all(urls.map(url => this.engine.loadModel(url))); }

  async placeModel(modelUrl, options = {}) {
    const hit = options.position ? { hit: true, position: options.position, rotation: options.rotation } : await this.engine.hitTest({ x: options.x ?? .5, y: options.y ?? .5 });
    if (!hit.hit) return { success: false, reason: 'NO_SURFACE' };
    const scale = options.scale ?? this.transform.scale;
    const rotation = options.rotation || hit.rotation || [0,0,0,1];
    const result = await this.engine.placeModel({ modelUrl, position: hit.position, rotation, scale: Array.isArray(scale) ? scale : [scale,scale,scale] });
    this.activeModelId = result.anchorId;
    this.activeModelUrl = modelUrl;
    return { success: true, modelId: result.anchorId, ...result };
  }

  /** Replace the placed model without asking the user to place again. Position/rotation/scale are preserved. */
  async switchModel(modelUrl, options = {}) {
    if (!this.activeModelId) return this.placeModel(modelUrl, options);
    const result = await this.engine.switchModel({ anchorId: this.activeModelId, modelUrl, preserveMaterial: options.preserveMaterial !== false });
    this.activeModelUrl = modelUrl;
    return { success: true, modelId: this.activeModelId, ...result };
  }

  async removeModel() {
    if (!this.activeModelId) return;
    await this.engine.removeModel({ anchorId: this.activeModelId });
    this.activeModelId = null;
    this.activeModelUrl = null;
  }

  async setScale(scale) {
    if (!this.activeModelId) return;
    this.transform.scale = Math.max(.1, Math.min(5, scale));
    const s = this.transform.scale;
    await this.engine.transformModel({ anchorId: this.activeModelId, scale: [s,s,s] });
  }

  async rotateBy(radians) {
    if (!this.activeModelId) return;
    this.transform.rotationY += radians;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.transform.rotationY, 0)).toArray();
    await this.engine.transformModel({ anchorId: this.activeModelId, rotation: q });
  }

  async setColor(color) {
    if (!this.activeModelId) return;
    await this.engine.setModelColor({ anchorId: this.activeModelId, color });
  }

  addTextures(textures) {
    Object.entries(textures || {}).forEach(([name, url]) => this.textures.set(name, url));
    return this;
  }

  async applyTexture(nameOrUrl, options = {}) {
    if (!this.activeModelId) throw new Error('Place a model before applying a texture');
    const url = this.textures.get(nameOrUrl) || nameOrUrl;
    return this.engine.setModelTexture({ anchorId: this.activeModelId, textureUrl: url, materialName: options.materialName });
  }

  enableCustomization(options = {}) {
    if (!this.overlay) throw new Error('createARView requires an overlay element before enabling gestures');
    this.gestures?.destroy();
    this.gestures = createARGestureController({
      element: this.overlay,
      onTap: async ({ x, y, event }) => {
        if (!this.activeModelId && options.modelUrl) await this.placeModel(options.modelUrl(), { x: x / innerWidth, y: y / innerHeight });
        options.onTap?.({ x, y, event });
      },
      onPinch: ({ factor }) => {
        if (!this.activeModelId) return;
        this.setScale(this.transform.scale * factor);
        options.onScale?.(this.transform.scale);
      },
      onRotate: ({ delta }) => {
        if (!this.activeModelId) return;
        this.rotateBy(-delta);
        options.onRotate?.(this.transform.rotationY);
      },
    });
    return () => { this.gestures?.destroy(); this.gestures = null; };
  }

  takeScreenshot(options = {}) { return this.engine.takeScreenshot(options); }
}

export function createARView(options = {}) { return new ARView(options); }

// Functional helpers for teams that prefer a small explicit API over class methods.
export const takeScreenshot = (view, options) => view.takeScreenshot(options);
export const enableCustomization = (view, options) => view.enableCustomization(options);
export const addTextures = (view, textures) => view.addTextures(textures);
export const switchModel = (view, modelUrl, options) => view.switchModel(modelUrl, options);
export const placeModel = (view, modelUrl, options) => view.placeModel(modelUrl, options);
