# AR React DOM Playground

## Run on a phone

```bash
npm install
npm run dev:https
```

Install `certs/dev-ca.crt` as a trusted CA on the Android phone, keep the phone and computer on the same LAN, then open the printed `https://<LAN-IP>:5173` URL in Chrome.

## Interaction API

The demo deliberately keeps manipulation out of sliders. `createARGestureController()` is framework-agnostic and can be attached to any React DOM overlay:

```jsx
import { createARGestureController, useARCore } from 'capacitor-arcore';

const ar = useARCore();
const overlay = useRef(null);

useEffect(() => {
  const gestures = createARGestureController({
    element: overlay.current,
    onTap: async () => {
      const hit = await ar.hitTest(.5, .5);
      if (hit.hit) await ar.placeModel('/models/sofa.glb', hit.position, hit.rotation, [1,1,1]);
    },
    onPinch: ({ factor }) => { /* update selected model scale */ },
    onRotate: ({ delta }) => { /* update selected model yaw */ },
  });
  return () => gestures.destroy();
}, []);
```

The controller ignores elements under `[data-ui]`, so React buttons/sheets remain normal DOM controls over the immersive AR session.

## Performance notes

The web implementation uses continuous WebXR hit testing for fast placement feedback, GLB caching, capped device pixel ratio, hidden plane meshes/dot grids by default, throttled plane bookkeeping, and inexpensive blob shadows. Actual tracking and low-light plane quality are ultimately controlled by the device camera, ARCore and browser; software cannot guarantee instant detection in darkness. For best results, move slowly and keep some visible texture/edges in frame.
