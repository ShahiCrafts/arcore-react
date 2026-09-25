<div align="center">

# arcore-react

### A developer-friendly AR abstraction for Capacitor, React, WebXR, ARCore and Three.js

Build product visualization and interactive augmented-reality experiences without wiring camera sessions, hit testing, plane feedback, model transforms and gesture handling into your UI code.

**Tap to place · Pinch to scale · Twist to rotate · Switch models in place · Materials & textures · AR screenshots · React DOM overlays**

![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?logo=capacitor&logoColor=white)
![React](https://img.shields.io/badge/React-16.8%2B-61DAFB?logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=threedotjs&logoColor=white)
![WebXR](https://img.shields.io/badge/WebXR-AR-5C2D91)
![Android](https://img.shields.io/badge/Android-ARCore-3DDC84?logo=android&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Why arcore-react?

AR APIs are powerful, but application code should not need to coordinate XR sessions, hit-test sources, Three.js scenes, GLTF loading, plane visualization and multi-touch math just to place a chair in a room.

arcore-react provides a higher-level `ARView` facade so your application can stay focused on products and UI:

```js
import { createARView } from 'capacitor-arcore';

const ar = createARView({ overlay: document.querySelector('#ar-overlay') });

await ar.create();
await ar.preloadModels(['/models/sofa.glb', '/models/chair.glb']);

ar.enableCustomization({
  modelUrl: () => '/models/sofa.glb',
});
```

The user can now scan a surface, **tap to place**, **pinch to scale**, and **twist with two fingers to rotate**. Your React components remain normal DOM elements above the AR view.

## Highlights

| Capability | What the plugin handles |
| --- | --- |
| Surface detection | WebXR/ARCore surface tracking with placement feedback |
| Dotted surface feedback | Lightweight detected-plane visualization so users know where AR placement is available |
| Placement reticle | Continuously follows the current hit-test surface |
| Tap to place | Converts screen interaction into an AR hit test and model placement |
| Pinch to scale | Built-in two-finger scaling without app-level gesture math |
| Twist to rotate | Built-in two-finger Y-axis rotation |
| Model switching | Replaces a placed model while preserving its AR placement and transform |
| Model preloading | Loads product models ahead of selection for faster switching |
| Customization | Runtime colors and texture application |
| Screenshots | High-level AR screenshot API with WebXR camera capture support where available |
| DOM overlay | Keep React/HTML controls interactive over the immersive AR session |
| Low-level API | Direct session, hit-test, placement and transform APIs remain available |

## Architecture

The public API is intentionally layered. Product applications should normally depend on the high-level facade rather than Three.js or WebXR internals.

```text
┌──────────────────────────────────────────────────────────┐
│                    Your Application                      │
│          React / Vue / Vanilla JS / Product UI          │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  High-level AR API                       │
│  createARView · switchModel · screenshots · gestures    │
│  textures · model preloading · surface feedback         │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                     AR Engine                            │
│     WebXR · hit testing · planes · Three.js · GLTF      │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  Platform / Device                       │
│             Browser WebXR / Android ARCore              │
└──────────────────────────────────────────────────────────┘
```

> **Current implementation note:** `createARView()` is the framework-agnostic high-level WebXR facade used by the included React demo. The package also contains the lower-level Capacitor Android ARCore bridge. Keeping these layers separate lets application code use a small API while the rendering/platform implementation evolves underneath it.

## Installation

### Requirements

- Node.js and npm
- Capacitor 8.x for Capacitor applications
- Android device with ARCore support for device AR
- Chrome/Chromium with WebXR immersive AR support for the browser path
- HTTPS when testing WebXR from another device on your network

Install the package:

```bash
npm install capacitor-arcore
```

`three` and `@capacitor/core` are runtime dependencies of the package. React applications should already provide React 16.8 or newer.

For a Capacitor application, sync after installation:

```bash
npx cap sync
```

## Quick start

### 1. Create an AR view

Use a DOM element as the WebXR DOM overlay. It can contain your complete React interface.

```jsx
import { useEffect, useRef } from 'react';
import { createARView } from 'capacitor-arcore';

export default function ProductAR() {
  const overlayRef = useRef(null);
  const arRef = useRef(null);

  const startAR = async () => {
    const ar = createARView({ overlay: overlayRef.current });
    arRef.current = ar;

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
  };

  useEffect(() => () => {
    arRef.current?.destroy();
  }, []);

  return (
    <main ref={overlayRef} className="ar-overlay">
      <button data-ui="true" onClick={startAR}>Start AR</button>
    </main>
  );
}
```

Elements marked with `data-ui="true"` are ignored by the gesture layer, so buttons, sheets, carousels and customization controls do not accidentally place or transform the model.

### 2. Place once, then switch products

The first product is placed against a detected surface:

```js
await ar.placeModel('/models/sofa.glb');
```

After placement, product selection should normally call `switchModel()` instead of asking the user to place again:

```js
await ar.switchModel('/models/chair.glb');
```

The existing placement, scale and rotation are preserved.

### 3. Add product customization

```js
ar.addTextures({
  beige: '/textures/beige-fabric.jpg',
  olive: '/textures/olive-fabric.jpg',
  walnut: '/textures/walnut.jpg',
});

await ar.applyTexture('olive');
await ar.setColor('#68705b');
```

### 4. Capture the AR view

```js
const screenshot = await ar.takeScreenshot({
  format: 'png',
  includeReticle: false,
});
```

WebXR camera capture depends on browser/device support for camera access. Applications should handle unsupported capture gracefully rather than assuming every WebXR implementation exposes the camera texture.

## High-level API

### `createARView(options?)`

Creates the framework-agnostic AR controller.

```js
const ar = createARView({ overlay: overlayElement });
```

### `ar.create(options?)`

Starts the immersive AR session.

```js
await ar.create({
  showReticle: true,
  showPlaneDots: true,
  dotSpacing: 0.14,
  dotSize: 0.014,
  showShadow: true,
  planeDetection: true,
  lightEstimation: true,
});
```

### `ar.preloadModels(urls)`

Preloads GLB/GLTF assets so product switching does not begin with a network/model-loading delay.

```js
await ar.preloadModels([
  '/models/sofa.glb',
  '/models/chair.glb',
]);
```

### `ar.placeModel(modelUrl, options?)`

Places a model using the current center hit test by default.

```js
const result = await ar.placeModel('/models/sofa.glb');

if (!result.success && result.reason === 'NO_SURFACE') {
  // Ask the user to continue scanning.
}
```

Optional `x`, `y`, `position`, `rotation`, and `scale` values can be supplied when an application needs explicit placement control.

### `ar.switchModel(modelUrl, options?)`

Replaces the active model without requiring another placement gesture.

```js
await ar.switchModel('/models/chair.glb');
```

If no model has been placed yet, `switchModel()` falls back to placement.

### `ar.enableCustomization(options?)`

Enables direct manipulation on the overlay:

- one-finger tap → place the first model
- two-finger pinch → scale
- two-finger twist → rotate

```js
const disableGestures = ar.enableCustomization({
  modelUrl: () => selectedProduct.modelUrl,
  onScale: scale => console.log(scale),
  onRotate: rotation => console.log(rotation),
});

// Later
disableGestures();
```

### `ar.addTextures(textures)` / `ar.applyTexture(nameOrUrl)`

```js
ar.addTextures({ oak: '/textures/oak.jpg' });
await ar.applyTexture('oak');
```

A direct texture URL can also be passed to `applyTexture()`.

### `ar.setColor(color)`

```js
await ar.setColor('#d9d0c3');
```

### `ar.setScale(scale)`

```js
await ar.setScale(1.25);
```

The facade constrains uniform scale to a safe range.

### `ar.rotateBy(radians)`

```js
await ar.rotateBy(Math.PI / 4);
```

### `ar.takeScreenshot(options?)`

```js
const shot = await ar.takeScreenshot({ format: 'png' });
```

### `ar.removeModel()`

```js
await ar.removeModel();
```

### `ar.destroy()`

Destroys gesture bindings and ends the active session.

```js
await ar.destroy();
```

### Surface APIs

```js
const surface = ar.getSurface();
const planes = ar.getPlanes();

ar.setReticleVisible(true);
ar.setSurfaceDotsVisible(true);

const unsubscribeFrames = ar.onFrame(frame => {});
const unsubscribePlanes = ar.onPlanes(planes => {});
```

## Functional API

Teams that prefer functions can use the exported helpers around an `ARView` instance:

```js
import {
  createARView,
  placeModel,
  switchModel,
  enableCustomization,
  addTextures,
  takeScreenshot,
} from 'capacitor-arcore';

const ar = createARView({ overlay });
await ar.create();

await placeModel(ar, '/models/sofa.glb');
await switchModel(ar, '/models/chair.glb');
addTextures(ar, { oak: '/textures/oak.jpg' });
enableCustomization(ar, { modelUrl: () => '/models/chair.glb' });
const shot = await takeScreenshot(ar);
```

## Low-level Capacitor API

For integrations that need explicit control, `ARCore` exposes the lower-level bridge:

```js
import { ARCore } from 'capacitor-arcore';

const support = await ARCore.checkSupport();
await ARCore.startSession({ planeDetection: true, lightEstimation: true });

const hit = await ARCore.hitTest({ x: 0.5, y: 0.5 });
```

The low-level API includes:

```text
checkSupport()
startSession()
stopSession()
hitTest()
placeModel()
setTransform()
setMaterial()
moveModel()
removeModel()
on()
addListener()
```

Use this layer when building custom abstractions or working directly with the native Capacitor bridge. For product applications, prefer `createARView()`.

## React hook

The package also exports `useARCore()` for applications that want reactive state around the lower-level plugin API:

```js
import { useARCore } from 'capacitor-arcore';

const {
  isSupported,
  isSessionActive,
  placedModels,
  error,
  startSession,
  stopSession,
  hitTest,
  placeModel,
  removeModel,
  transformModel,
  setModelColor,
} = useARCore();
```

For the smallest application surface, prefer `createARView()`; use the hook when its reactive state model better fits your UI.

## Testing on a physical phone over HTTPS

WebXR requires a secure context. The included React playground contains a local HTTPS workflow that generates a development certificate and exposes Vite on your LAN.

```bash
cd example
npm install
npm run dev:https
```

The command prints a network address similar to:

```text
https://192.168.x.x:5173/
```

Your computer and Android device must be on the same local network. The development CA generated by the test app must be trusted by the test device for the browser to treat the page as a valid secure context.

See [`docs/PHONE_TESTING.md`](docs/PHONE_TESTING.md) and [`docs/HTTPS_SETUP.md`](docs/HTTPS_SETUP.md) for the complete development setup.

> Never commit generated private keys or production certificates. The repository keeps generated certificate material out of source control.

## Android / ARCore setup

For a Capacitor Android application, make sure camera and AR requirements are represented in the app manifest as appropriate for your product:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature
    android:name="android.hardware.camera.ar"
    android:required="true" />
```

If AR is optional in your application, use an optional device capability strategy instead of excluding non-AR devices from installation.

After plugin changes:

```bash
npx cap sync android
```

## Performance guidelines

The engine is designed to keep application-side AR overhead small, but model assets still have a major impact on mobile performance.

- Prefer optimized binary `.glb` assets.
- Reduce unnecessary geometry before shipping models.
- Compress and resize textures for mobile hardware.
- Preload likely next models with `preloadModels()`.
- Avoid creating a new AR session when switching products.
- Keep detected-plane visualization lightweight; dotted feedback is preferable to large translucent plane meshes.
- Keep React UI animation and expensive DOM work out of the XR frame loop.
- Test on the lowest-spec device you intend to support.

Surface acquisition speed and low-light tracking ultimately depend on the device camera, sensors, ARCore/WebXR implementation and environment. The library can minimize its own overhead, but cannot guarantee tracking quality in insufficient lighting.

## Project structure

```text
arcore-react/
├── android/                  # Native Android / ARCore implementation
├── src/
│   ├── index.js              # Public exports + low-level Capacitor bridge
│   ├── ar-view.js            # High-level ARView abstraction
│   ├── gestures.js           # Tap / pinch / twist gesture controller
│   ├── hooks.js              # React integration
│   └── web.js                # WebXR + Three.js engine
├── example/                 # React/Vite integration example
├── docs/                    # API, installation, HTTPS & phone testing docs
└── README.md
```

## Browser and platform status

| Platform | Status | Notes |
| --- | --- | --- |
| Android + Chrome WebXR | Supported path | Primary browser-based AR testing path |
| Capacitor Android / ARCore | Native bridge included | Low-level native plugin architecture is included |
| Desktop browser | Development only | AR capability depends on browser/emulation support |
| iOS / ARKit | Not implemented | Requires a separate ARKit implementation |

## Error handling

Treat AR support and surface availability as runtime capabilities:

```js
const { supported, reason } = await ar.checkSupport();

if (!supported) {
  console.error(`AR unavailable: ${reason}`);
  return;
}

const placement = await ar.placeModel('/models/sofa.glb');

if (!placement.success && placement.reason === 'NO_SURFACE') {
  // Keep the scanning UI visible and let the user move the device.
}
```

A production UI should always provide a non-AR fallback for unsupported devices.

## Documentation

- [`API.md`](docs/API.md) — high-level facade overview
- [`INSTALLATION.md`](docs/INSTALLATION.md) — installation notes
- [`PHONE_TESTING.md`](docs/PHONE_TESTING.md) — physical-device testing
- [`HTTPS_SETUP.md`](docs/HTTPS_SETUP.md) — LAN HTTPS setup

## Roadmap

The project is evolving toward a consistent high-level API across the browser and native engines. Useful future work includes:

- unified `ARView` behavior across WebXR and native ARCore
- stronger TypeScript definitions
- configurable placement policies and multiple-object scenes
- material-targeted texture customization
- improved lighting/environment estimation
- anchors and persistent placement workflows
- iOS / ARKit adapter
- automated browser and Android integration tests

## Contributing

Contributions are welcome. For substantial changes, open an issue first so the public API and platform behavior can be discussed before implementation.

A good pull request should:

1. keep AR/WebXR implementation details out of application-facing APIs where possible;
2. preserve backward compatibility unless the change is intentionally versioned as breaking;
3. include a focused reproduction or test path;
4. test both the library and `example` when the change affects browser AR behavior;
5. avoid committing generated certificates, private keys, build output or `node_modules`.

## Security

Please do not publish security-sensitive issues containing private keys, credentials or exploitable details. Remove local development certificates and secrets before sharing reproduction projects.

## License

Released under the **MIT License**.

---

<div align="center">

Built to make AR integration feel like an application API — not an XR research project.

</div>
