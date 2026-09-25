# Contributing

Thanks for contributing to arcore-react.

## Development

1. Fork the repository and create a focused branch from `main`.
2. Install the SDK dependencies with `npm install`.
3. Install the example app dependencies with `cd example && npm install`.
4. Run the example with `npm run dev:https` when testing WebXR on a physical device.
5. Keep AR/WebXR/Three.js implementation details inside the SDK; the example app should consume the public API.
6. Run the available validation/build commands before opening a pull request.

## Pull requests

Keep changes focused, describe user-visible behavior, document public API changes, and include device/browser details for AR-specific fixes.

## Versioning

This project follows Semantic Versioning. Breaking public API changes require a major version increment.
