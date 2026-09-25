# High-level AR API

Application code should use `createARView()` instead of coordinating WebXR, Three.js, hit tests and gestures itself.

```js
import { createARView } from 'capacitor-arcore';

const ar = createARView({ overlay: document.querySelector('#ar-overlay') });
await ar.create({ showReticle: true, showPlaneDots: true });
await ar.preloadModels(['/models/sofa.glb', '/models/chair.glb']);

ar.enableCustomization({ modelUrl: () => '/models/sofa.glb' });
await ar.placeModel('/models/sofa.glb');       // center hit-test + anchor
await ar.switchModel('/models/chair.glb');     // preserves placement/scale/rotation
ar.addTextures({ oak: '/textures/oak.jpg' });
await ar.applyTexture('oak');
await ar.setColor('#68705b');
const shot = await ar.takeScreenshot();
```

## Surface feedback

`showReticle` keeps the center placement reticle visible whenever a hit-test surface exists, including after a model has been placed. `showPlaneDots` draws a sparse dotted visualization over WebXR planes. Plane meshes remain disabled by default to reduce GPU cost.

## Gestures

`enableCustomization()` provides tap-to-place, pinch-to-scale and two-finger twist-to-rotate. UI elements marked `data-ui="true"` are ignored by the gesture layer.

## Functional API

For codebases that prefer functions, the package also exports `takeScreenshot(view)`, `enableCustomization(view)`, `addTextures(view)`, `switchModel(view)`, and `placeModel(view)`.
