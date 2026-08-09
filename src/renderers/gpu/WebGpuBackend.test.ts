import { describe, expect, it } from 'vitest';
import { Mesh, type Face } from '../../core/Mesh';
import { Texture } from '../../core/Texture';
import type { LoadedModel } from '../../core/types';
import { WebGpuBackend } from './WebGpuBackend';

describe('WebGpuBackend material batches', () => {
  it('groups faces by material texture and retains the fallback batch', () => {
    const mesh = new Mesh();
    mesh.parseObj(`
      v 0 0 0
      v 1 0 0
      v 1 1 0
      v 0 1 0
      usemtl Hull
      f 1 2 3
      usemtl Glass
      f 1 3 4
      usemtl Missing
      f 1 4 2
    `);
    const fallback = new Texture();
    const hull = new Texture();
    const glass = new Texture();
    mesh.texture = fallback;
    mesh.materialTextures.set('Hull', hull);
    mesh.materialTextures.set('Glass', glass);
    const model: LoadedModel = { id: 'ship', mesh };
    const backend = new WebGpuBackend({} as HTMLCanvasElement);
    const createMaterialBatches = (backend as unknown as {
      createMaterialBatches(source: LoadedModel): Map<Texture, Face[]>;
    }).createMaterialBatches.bind(backend);

    const batches = createMaterialBatches(model);

    expect(batches.get(hull)).toEqual([mesh.faces[0]]);
    expect(batches.get(glass)).toEqual([mesh.faces[1]]);
    expect(batches.get(fallback)).toEqual([mesh.faces[2]]);
  });
});