// @vitest-environment happy-dom

import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const controllerState = vi.hoisted(() => ({
  constructCount: 0,
  initializeCount: 0,
  disposeCount: 0,
  setModelTransform: vi.fn(() => true),
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
    public setModelTransform(id: string, transform: unknown) {
      return controllerState.setModelTransform(id, transform);
    }
    public resetCamera() {}
    public setRenderMode() {}
    public getRendererKind() { return 'webgpu' as const; }
    public dispose() { controllerState.disposeCount++; }
  },
}));

import { WebGpuVisualizer, type WebGpuVisualizerHandle } from './WebGpuVisualizer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const scene = {
  models: [{ objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3' }],
};

describe('React WebGpuVisualizer lifecycle', () => {
  beforeEach(() => {
    controllerState.constructCount = 0;
    controllerState.initializeCount = 0;
    controllerState.disposeCount = 0;
    controllerState.setModelTransform.mockClear();
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

  it('forwards model transform updates through its imperative handle', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const ref = createRef<WebGpuVisualizerHandle>();

    await act(async () => {
      root.render(<WebGpuVisualizer ref={ref} scene={scene} />);
    });

    const transform = { rotation: { x: 0, y: 1, z: 0 } };
    expect(ref.current?.setModelTransform('aircraft', transform)).toBe(true);
    expect(controllerState.setModelTransform).toHaveBeenCalledWith('aircraft', transform);

    await act(async () => root.unmount());
  });
});
