import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { backendState, MockBackend } = vi.hoisted(() => {
  const state = {
    gpuInitializeError: null as Error | null,
    gpuDisposeCount: 0,
    cpuInitializeCount: 0,
    cpuDisposeCount: 0,
    deviceLostCallback: null as ((error: Error) => void) | null,
  };

  class Backend {
    public readonly kind: 'webgpu' | 'webcpu';

    constructor(kind: 'webgpu' | 'webcpu') {
      this.kind = kind;
    }

    public async initialize(): Promise<void> {
      if (this.kind === 'webgpu' && state.gpuInitializeError) {
        throw state.gpuInitializeError;
      }
      if (this.kind === 'webcpu') state.cpuInitializeCount++;
    }

    public async setScene(): Promise<void> {}
    public setRenderMode(): void {}
    public resize(): void {}
    public render() {
      return { renderer: this.kind, modelCount: 0, triangleCount: 0 };
    }

    public dispose(): void {
      if (this.kind === 'webgpu') state.gpuDisposeCount++;
      else state.cpuDisposeCount++;
    }

    public onDeviceLost(callback: (error: Error) => void): void {
      state.deviceLostCallback = callback;
    }
  }

  return { backendState: state, MockBackend: Backend };
});

vi.mock('../renderers/gpu/WebGpuBackend', () => ({
  WebGpuBackend: class extends MockBackend {
    constructor() {
      super('webgpu');
    }
  },
}));

vi.mock('../renderers/cpu/WebCpuBackend', () => ({
  WebCpuBackend: class extends MockBackend {
    constructor() {
      super('webcpu');
    }
  },
}));

import { WebGpuVisualizer } from './Visualizer';

class ResizeObserverStub {
  public observe = vi.fn();
  public disconnect = vi.fn();
}

const createCanvas = () => ({
  width: 800,
  height: 600,
  clientWidth: 800,
  clientHeight: 600,
  classList: { add: vi.fn(), remove: vi.fn() },
}) as unknown as HTMLCanvasElement;

const createVisualizer = (options = {}) => new WebGpuVisualizer(createCanvas(), {
  controls: false,
  keyboard: false,
  ...options,
});

describe('WebGpuVisualizer backend lifecycle', () => {
  beforeEach(() => {
    backendState.gpuInitializeError = null;
    backendState.gpuDisposeCount = 0;
    backendState.cpuInitializeCount = 0;
    backendState.cpuDisposeCount = 0;
    backendState.deviceLostCallback = null;
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the CPU backend when WebGPU initialization fails', async () => {
    const gpuError = new Error('No GPU adapter');
    const onFallback = vi.fn();
    backendState.gpuInitializeError = gpuError;
    const visualizer = createVisualizer({ onFallback });

    await expect(visualizer.initialize()).resolves.toBe('webcpu');
    expect(visualizer.getRendererKind()).toBe('webcpu');
    expect(backendState.cpuInitializeCount).toBe(1);
    expect(onFallback).toHaveBeenCalledWith(gpuError);
    visualizer.dispose();
  });

  it('surfaces WebGPU initialization failure when fallback is disabled', async () => {
    const gpuError = new Error('No GPU adapter');
    backendState.gpuInitializeError = gpuError;
    const visualizer = createVisualizer({ fallbackToCpu: false });

    await expect(visualizer.initialize()).rejects.toBe(gpuError);
    expect(backendState.cpuInitializeCount).toBe(0);
    visualizer.dispose();
  });

  it('switches to CPU after WebGPU device loss', async () => {
    const onFallback = vi.fn();
    const visualizer = createVisualizer({ onFallback });
    await visualizer.initialize();

    const deviceError = new Error('Device lost');
    backendState.deviceLostCallback?.(deviceError);
    await vi.waitFor(() => expect(visualizer.getRendererKind()).toBe('webcpu'));

    expect(onFallback).toHaveBeenCalledWith(deviceError);
    expect(backendState.gpuDisposeCount).toBe(1);
    visualizer.dispose();
  });

  it('disposes animation, observer, and active backend exactly once', async () => {
    const visualizer = createVisualizer();
    await visualizer.initialize();

    visualizer.dispose();
    visualizer.dispose();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(backendState.gpuDisposeCount).toBe(1);
  });
});
