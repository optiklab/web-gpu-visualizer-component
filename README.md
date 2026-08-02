# WebGPU Visualizer Component

[![CI](https://github.com/optiklab/web-gpu-visualizer-component/actions/workflows/ci.yml/badge.svg)](https://github.com/optiklab/web-gpu-visualizer-component/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@optiklab/web-gpu-visualizer-component)](https://www.npmjs.com/package/@optiklab/web-gpu-visualizer-component)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

A dependency-light OBJ visualizer that prefers WebGPU and automatically falls back to a Canvas 2D software renderer. It provides React bindings and a framework-independent controller, with wireframe, filled, and textured rendering.

Component is built from the the [previously successful experimental project](https://github.com/optiklab/web-gpu-visualizer) converting from C++ SDL functionality to TypeScript for renderring using Web GPU  and CPU (as a fallback).

## Install

```bash
npm install @optiklab/web-gpu-visualizer-component
```

React 18.2 or newer is required when using the React entry point.

## React

```tsx
import { WebGpuVisualizer } from '@optiklab/web-gpu-visualizer-component/react';
import '@optiklab/web-gpu-visualizer-component/styles.css';

const scene = {
  models: [{
    id: 'product',
    objUrl: '/models/product.obj',
    textureUrl: '/models/product.png',
    translation: { x: 0, y: 0, z: 5 },
  }],
};

export function ProductViewer() {
  return (
    <WebGpuVisualizer
      scene={scene}
      renderMode="textured"
      style={{ width: '100%', height: 480 }}
      onFallback={error => console.info('Using CPU renderer:', error.message)}
      onError={console.error}
    />
  );
}
```

Each model accepts either `objUrl` or `objText`, plus an optional `textureUrl`, `translation`, `rotation`, and `scale`. Scene and asset URLs remain owned and hosted by the consuming application.

### Props

| Prop | Default | Purpose |
| --- | --- | --- |
| `scene` | required | Models and transforms to load |
| `renderer` | `'auto'` | `'auto'`, `'webgpu'`, or `'webcpu'` |
| `fallbackToCpu` | `true` | Use Canvas 2D if WebGPU initialization or rendering fails |
| `renderMode` | `'textured'` | `'wireframe'`, `'filled'`, or `'textured'` |
| `controls` | `true` | Enable pointer and wheel controls |
| `keyboard` | `true` | Enable keyboard camera controls |
| `pixelRatio` | device ratio | Render scale, clamped from `0.5` to `3` |
| `showStatus` | `true` | Show loading, fallback, and error status overlays |
| `onReady` | - | Receives the initialized renderer kind |
| `onRendererChange` | - | Runs whenever the active backend changes |
| `onFallback` | - | Receives the WebGPU error that caused fallback |
| `onError` | - | Receives an unrecoverable loading or rendering error |

A forwarded ref exposes `loadScene`, `resetCamera`, `setRenderMode`, and `getRendererKind`.

## Framework-Independent API

```ts
import { WebGpuVisualizer } from '@optiklab/web-gpu-visualizer-component';

const canvas = document.querySelector<HTMLCanvasElement>('#viewer')!;
const visualizer = new WebGpuVisualizer(canvas, {
  scene,
  renderer: 'auto',
  fallbackToCpu: true,
});

await visualizer.initialize();

// Call when the owning view is removed.
visualizer.dispose();
```

The canvas needs a stable CSS width and height. The controller observes it and maintains the correct backing-buffer resolution.

## Renderer Selection

`renderer: 'auto'` and `renderer: 'webgpu'` both attempt full WebGPU initialization, including adapter and device creation. If that fails and `fallbackToCpu` is enabled, the component activates the software renderer. Set `renderer: 'webcpu'` to force software rendering or `fallbackToCpu: false` to surface WebGPU failures.

WebGPU availability depends on the browser, operating system, graphics driver, security context, and hardware. The CPU backend keeps the viewer functional without a supported GPU, but complex models will render more slowly.

## Controls

- Left drag: rotate
- Right drag or Shift-drag: pan
- Wheel: zoom
- Double-click: reset
- Arrow Up/Down: move forward/backward
- Arrow Left/Right: rotate horizontally
- W/S: rotate vertically

## SSR

The React module does not access browser globals during import or render. In Next.js and similar frameworks, render the component in a client component because initialization requires a canvas. Asset URLs should be absolute or served from the application's public directory.

## OBJ Support

The parser supports positions, texture coordinates, triangle faces, polygon fan triangulation, positive indices, and negative relative indices. Normals and material (`.mtl`) files are not currently interpreted. Use one texture image per model.

## Development

Requires Node.js 20.19 or newer.

### Run the component demo

```bash
git clone https://github.com/optiklab/web-gpu-visualizer-component.git
cd web-gpu-visualizer-component
npm install
npm run dev
```

Open [http://localhost:5173/?webgpu-check=1](http://localhost:5173/?webgpu-check=1) in a browser. The demo starts with the full runway scene and provides selectors for the bundled example models and rendering modes. It attempts WebGPU first and displays `CPU fallback` when WebGPU is unavailable or initialization fails.

Vite may select another port when `5173` is already occupied. In that case, use the local URL printed by `npm run dev` and append `?webgpu-check=1`.

![1](https://github.com/optiklab/web-gpu-visualizer-component/blob/main/docs/webgpu-visualizer-demo.jpg)

### Validate the package

```bash
npm run lint
npm test
npm run build
npm run test:package
npm run pack:check
```

The repository contains model assets for its local demo. Vite excludes the public demo directory from the npm library build, so those aircraft and runway assets are not included in the published package tarball. Consumers are responsible for ensuring they have the right to distribute the models and textures they provide.

### Publish to npm

The package is published publicly under the `optiklab` npm scope. Sign in and confirm the active account without sharing an access token:

```bash
npm login
npm whoami
```

`npm whoami` must print `optiklab`. Review the files and metadata that npm will receive, then publish:

```bash
npm run pack:check
npm publish --access public
```

`prepublishOnly` automatically runs lint, all tests, the production build, and an isolated installation test before npm accepts the package. If the npm account requires two-factor authentication, enter the one-time code directly at npm's prompt.

Verify the published release:

```bash
npm view @optiklab/web-gpu-visualizer-component version
npm install @optiklab/web-gpu-visualizer-component
```

For later releases, update and commit the version first, for example with `npm version patch`, then push the commit and tag before running `npm publish --access public`.

## License

Apache-2.0. See [LICENSE](LICENSE).
