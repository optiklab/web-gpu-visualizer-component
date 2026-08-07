import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mat4 } from '../../core/math/Matrix';
import type { GpuMesh } from './WebGpuRenderer';
import { WebGpuRenderer } from './WebGpuRenderer';

describe('WebGpuRenderer depth texture lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUTextureUsage', { RENDER_ATTACHMENT: 1 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reuses its depth texture until the canvas size changes', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const renderer = new WebGpuRenderer(canvas);
    const depthTextures: Array<{ destroy: ReturnType<typeof vi.fn>; createView: ReturnType<typeof vi.fn> }> = [];
    const pass = {
      end: vi.fn(),
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      setVertexBuffer: vi.fn(),
      draw: vi.fn(),
    };
    const device = {
      createCommandEncoder: vi.fn(() => ({
        beginRenderPass: vi.fn(() => pass),
        finish: vi.fn(() => ({})),
      })),
      createTexture: vi.fn(() => {
        const texture = { destroy: vi.fn(), createView: vi.fn(() => ({})) };
        depthTextures.push(texture);
        return texture;
      }),
      destroy: vi.fn(),
      queue: { writeBuffer: vi.fn(), submit: vi.fn() },
    };
    renderer.device = device as unknown as GPUDevice;
    renderer.context = {
      getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => ({})) })),
    } as unknown as GPUCanvasContext;
    renderer.pipeline = {} as GPURenderPipeline;

    const mesh = {
      uniformBuffer: {},
      bindGroup: {},
      vertexBuffer: {},
      vertexCount: 3,
    } as GpuMesh;
    const items = [{ mesh, mvpMatrix: Mat4.identity() }];

    renderer.render(items);
    renderer.render(items);
    expect(device.createTexture).toHaveBeenCalledTimes(1);

    canvas.width = 1024;
    renderer.render(items);
    expect(device.createTexture).toHaveBeenCalledTimes(2);
    expect(depthTextures[0].destroy).toHaveBeenCalledTimes(1);

    renderer.dispose();
    expect(depthTextures[1].destroy).toHaveBeenCalledTimes(1);
    expect(device.destroy).toHaveBeenCalledTimes(1);
  });
});
