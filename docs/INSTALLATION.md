# Install

From `example` run:

```bash
npm install
npm run dev:https
```

`example`'s preinstall installs the plugin's runtime dependencies in the parent package first. This is required because Vite follows the local `file:..` package to its real source path (`../src/web.js`), so Three.js must be resolvable from the plugin root as well as declared by the test app.
