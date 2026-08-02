// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const controllerState = vi.hoisted(() => ({
  constructCount: 0,
  initializeCount: 0,
  disposeCount: 0,
}));

vi.mock('../core/Visualizer', () => ({
  WebGpuVisualizer: class {
    constructor() {
      controllerState.constructCount++;
    }

    public async initialize() {
      controllerState.initializeCount++;
      return 'webgpu' as const;
    }

    public async loadScene() {}
    public resetCamera() {}
    public setRenderMode() {}
    public getRendererKind() { return 'webgpu' as const; }
    public dispose() { controllerState.disposeCount++; }
  },
}));

import { WebGpuVisualizer } from './WebGpuVisualizer';

const scene = {
  models: [{ objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3' }],
};

describe('React WebGpuVisualizer lifecycle', () => {
  beforeEach(() => {
    controllerState.constructCount = 0;
    controllerState.initializeCount = 0;
    controllerState.disposeCount = 0;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('initializes one controller and disposes it on unmount', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<WebGpuVisualizer scene={scene} />);
    });

    expect(controllerState.constructCount).toBe(1);
    expect(controllerState.initializeCount).toBe(1);
    expect(container.querySelector('canvas')).not.toBeNull();

    await act(async () => root.unmount());
    expect(controllerState.disposeCount).toBe(1);
  });
});
