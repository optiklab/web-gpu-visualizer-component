import { describe, expect, it } from 'vitest';
import { Mesh, type Face } from '../../core/Mesh';
import { Vec3 } from '../../core/math/Vector';
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
      createMaterialBatches(source: LoadedModel): Array<{ texture: Texture; faces: Face[]; transparent: boolean }>;
    }).createMaterialBatches.bind(backend);

    const batches = createMaterialBatches(model);

    expect(batches).toEqual([
      { texture: hull, faces: [mesh.faces[0]], transparent: false },
      { texture: glass, faces: [mesh.faces[1]], transparent: false },
      { texture: fallback, faces: [mesh.faces[2]], transparent: false },
    ]);
  });

  it('separates transparent faces even when they share a texture', () => {
    const mesh = new Mesh();
    mesh.parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\nf 1 3 2');
    mesh.texture = new Texture();
    mesh.faces[1].transparent = true;
    const model: LoadedModel = { id: 'glass', mesh };
    const backend = new WebGpuBackend({} as HTMLCanvasElement);
    const createMaterialBatches = (backend as unknown as {
      createMaterialBatches(source: LoadedModel): Array<{ texture: Texture; faces: Face[]; transparent: boolean }>;
    }).createMaterialBatches.bind(backend);

    expect(createMaterialBatches(model).map(batch => ({
      faces: batch.faces,
      transparent: batch.transparent,
    }))).toEqual([
      { faces: [mesh.faces[0]], transparent: false },
      { faces: [mesh.faces[1]], transparent: true },
    ]);
  });

  it('packs glTF normals and base color after positions and UVs', () => {
    const mesh = new Mesh();
    mesh.parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
    const face = mesh.faces[0];
    face.color = 0x80bf4080;
    face.a_normal = new Vec3(0, 0, 1);
    face.b_normal = new Vec3(0, 0, 1);
    face.c_normal = new Vec3(0, 0, 1);
    const model: LoadedModel = { id: 'paint', mesh };
    const backend = new WebGpuBackend({} as HTMLCanvasElement);
    const flattenVertices = (backend as unknown as {
      flattenVertices(source: LoadedModel, faces: Face[]): Float32Array;
    }).flattenVertices.bind(backend);

    const vertices = flattenVertices(model, [face]);

    expect(vertices).toHaveLength(36);
    expect(Array.from(vertices.slice(5, 8))).toEqual([0, 0, 1]);
    [128 / 255, 64 / 255, 191 / 255, 128 / 255].forEach((value, index) => {
      expect(vertices[index + 8]).toBeCloseTo(value, 6);
    });
  });
});