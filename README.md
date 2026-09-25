<div align="center">
<h1>arcore-react</h1>

<h3>A developer-friendly AR abstraction for React, Capacitor, WebXR, ARCore and Three.js</h3>

Build interactive augmented-reality experiences without wiring XR
sessions, hit testing, model transforms, gesture handling, and rendering
infrastructure into your application code.

**Tap to place · Pinch to scale · Twist to rotate · Switch models in
place · Materials & textures · AR screenshots · React DOM overlays**

![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?logo=capacitor&logoColor=white)
![React](https://img.shields.io/badge/React-16.8%2B-61DAFB?logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=threedotjs&logoColor=white)
![WebXR](https://img.shields.io/badge/WebXR-AR-5C2D91)
![Android](https://img.shields.io/badge/Android-ARCore-3DDC84?logo=android&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
</div>

------------------------------------------------------------------------

## Why arcore-react?

Building product AR should not require every application to implement
WebXR sessions, Three.js scenes, GLTF loading, hit testing, plane
visualization, and multi-touch gesture math.

**arcore-react** provides a higher-level AR API so your application can
focus on products and UI while the library manages the underlying AR
infrastructure.

```js
import { createARView } from 'capacitor-arcore';

const ar = createARView({
  overlay: document.querySelector('#ar-overlay'),
});

await ar.create({
  showReticle: true,
  showPlaneDots: true,
});

await ar.preloadModels([
  '/models/sofa.glb',
  '/models/chair.glb',
]);

await ar.placeModel('/models/sofa.glb');
```

Users can then interact naturally with the scene: **tap to place, pinch
to scale, and twist with two fingers to rotate**.

## Features

- **Surface detection** with dotted plane feedback and a placement reticle
- **Tap-to-place** GLB/GLTF models
- **Pinch-to-scale** and **two-finger rotation**
- **Model switching** without losing placement, scale, or rotation
- **Model preloading and caching** for faster product switching
- **Runtime colors and textures**
- **AR screenshot capture**
- **React DOM overlays** over immersive AR
- **WebXR + Three.js** browser AR
- **Native Android ARCore bridge**
- High-level API with lower-level controls available when needed

## Installation

```bash
npm install capacitor-arcore
```

For Capacitor applications:

```bash
npx cap sync
```

### Requirements

- Node.js and npm
- Capacitor 8.x when used in a Capacitor application
- ARCore-capable Android device for native/device AR
- WebXR-capable Chrome/Chromium for browser AR
- HTTPS for WebXR testing on physical devices

## Quick Start

```js
import { createARView } from 'capacitor-arcore';

const ar = createARView({
  overlay: document.querySelector('#ar-overlay'),
});

await ar.create({
  showReticle: true,
  showPlaneDots: true,
  planeDetection: true,
  lightEstimation: true,
});

await ar.preloadModels([
  '/models/sofa.glb',
  '/models/chair.glb',
  '/models/table.glb',
]);

ar.enableCustomization({
  modelUrl: () => '/models/sofa.glb',
});
```

### Place once, switch products in place

```js
await ar.placeModel('/models/sofa.glb');

// Preserves the existing AR placement and transform
await ar.switchModel('/models/chair.glb');
```

### Customize materials

```js
ar.addTextures({
  beige: '/textures/beige-fabric.jpg',
  olive: '/textures/olive-fabric.jpg',
  walnut: '/textures/walnut.jpg',
});

await ar.applyTexture('olive');
await ar.setColor('#68705b');
```

### Capture the AR view

```js
const screenshot = await ar.takeScreenshot({
  format: 'png',
  includeReticle: false,
});
```

Camera-inclusive WebXR screenshots depend on browser and device
camera-access support.

## React DOM Overlay

Your React interface can remain normal DOM above the AR experience.

Elements marked with `data-ui="true"` are ignored by the AR gesture
layer:

```jsx
<button data-ui="true" onClick={() => ar.switchModel('/models/chair.glb')}>
  Chair
</button>
```

This allows product selectors, customization sheets, buttons, and other
UI to remain interactive without accidentally placing or transforming a
model.

## Platform Support

| Platform | Status |
| --- | --- |
| Android + Chrome WebXR | ✅ Supported browser AR path |
| Capacitor Android / ARCore | ✅ Native bridge included |
| Desktop browser | 🛠 Development / capability dependent |
| iOS / ARKit | 📋 Planned |

## Example App

The repository includes an [`example/`](example/) React/Vite application demonstrating:

- surface detection and placement feedback
- furniture placement
- gesture interaction
- model switching
- product customization
- screenshot capture
- React DOM overlays
- HTTPS testing on a physical Android device

Run it with:

```bash
cd example
npm install
npm run dev:https
```

## Documentation

Detailed documentation lives outside the README:

- [`API.md`](docs/API.md) — API reference and advanced usage
- [`INSTALLATION.md`](docs/INSTALLATION.md) — installation and integration
- [`PHONE_TESTING.md`](docs/PHONE_TESTING.md) — physical-device testing
- [`HTTPS_SETUP.md`](docs/HTTPS_SETUP.md) — local HTTPS and LAN setup

## Project Structure

```text
arcore-react/
├── android/          # Native Android / ARCore implementation
├── src/              # Public SDK, ARView, gestures, hooks and WebXR engine
├── example/          # React/Vite example application
├── docs/             # Detailed documentation
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

## Performance

For production AR experiences:

- Prefer optimized binary `.glb` models.
- Compress and resize textures for mobile hardware.
- Preload likely next models with `preloadModels()`.
- Avoid restarting the AR session when switching products.
- Keep expensive React/DOM work outside the XR frame loop.
- Test on the lowest-spec device you intend to support.

Surface acquisition and low-light tracking ultimately depend on the
device camera, sensors, ARCore/WebXR implementation, and environment.

## Contributing

Contributions are welcome. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting substantial
changes.

Bug reports and feature proposals are also welcome through GitHub
Issues.

## License

Released under the [MIT License](LICENSE).

------------------------------------------------------------------------

<div align="center">
**Build AR experiences like application features — not XR infrastructure.**
</div>
