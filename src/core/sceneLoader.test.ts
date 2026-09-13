import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture } from './Texture';
import { loadSceneDefinition } from './sceneLoader';

afterEach(() => vi.restoreAllMocks());

describe('loadSceneDefinition', () => {
  it('rejects empty scenes', async () => {
    await expect(loadSceneDefinition({ models: [] })).rejects.toThrow(
      'A scene must contain at least one model.',
    );
  });

  it('rejects models without a source', async () => {
    await expect(loadSceneDefinition({ models: [{}] })).rejects.toThrow(
      'requires objUrl or objText',
    );
  });

  it('rejects OBJ sources without triangle faces before using the DOM', async () => {
    await expect(loadSceneDefinition({ models: [{ objText: 'v 0 0 0' }] })).rejects.toThrow(
      'contains no triangle faces',
    );
  });

  it('loads an embedded glTF 2.0 triangle through the shared scene path', async () => {
    vi.spyOn(Texture.prototype, 'load').mockImplementation(async function load() {
      this.sourceCanvas = {} as HTMLCanvasElement;
    });
    const bytes = new Uint8Array(36);
    new Float32Array(bytes.buffer).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const encoded = btoa(String.fromCharCode(...bytes));
    const gltfText = JSON.stringify({
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      buffers: [{ uri: `data:application/octet-stream;base64,${encoded}`, byteLength: 36 }],
    });

    const [model] = await loadSceneDefinition({ models: [{ id: 'gltf', gltfText, textureUrl: 'blob:fallback' }] });

    expect(model.id).toBe('gltf');
    expect(model.mesh.faces).toHaveLength(1);
    expect(model.mesh.translation).toMatchObject({ x: 0, y: 0, z: 5 });
  });

  it('loads MTL diffuse textures by uploaded filename and assigns them to materials', async () => {
    const loadedUrls: string[] = [];
    vi.spyOn(Texture.prototype, 'load').mockImplementation(async function load(url) {
      loadedUrls.push(url);
      this.width = 1;
      this.height = 1;
      this.data = new Uint32Array([0xffffffff]);
      this.sourceCanvas = {} as HTMLCanvasElement;
    });

    const [model] = await loadSceneDefinition({ models: [{
      objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl Hull\nf 1 2 3',
      textureUrl: 'blob:fallback',
      mtlText: 'newmtl Hull\nmap_Kd textures/hull.png',
      textureUrls: { 'hull.png': 'blob:hull' },
    }] });

    expect(loadedUrls).toEqual(['blob:fallback', 'blob:hull']);
    expect(model.mesh.faces[0].materialName).toBe('Hull');
    expect(model.mesh.materialTextures.get('Hull')).toBeInstanceOf(Texture);
  });

  it('matches case differences and exporter-added numeric texture suffixes', async () => {
    const loadedUrls: string[] = [];
    vi.spyOn(Texture.prototype, 'load').mockImplementation(async function load(url) {
      loadedUrls.push(url);
      this.sourceCanvas = {} as HTMLCanvasElement;
    });

    await loadSceneDefinition({ models: [{
      objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3',
      textureUrl: 'blob:fallback',
      mtlText: 'newmtl Metal\nmap_Kd textures/Metal0_2.JPG',
      textureUrls: { 'metal0.jpg': 'blob:metal' },
    }] });

    expect(loadedUrls).toEqual(['blob:fallback', 'blob:metal']);
  });

  it('reports a missing uploaded MTL texture clearly', async () => {
    vi.spyOn(Texture.prototype, 'load').mockImplementation(async function load() {
      this.sourceCanvas = {} as HTMLCanvasElement;
    });
    await expect(loadSceneDefinition({ models: [{
      objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3',
      textureUrl: 'blob:fallback',
      mtlText: 'newmtl Hull\nmap_Kd hull.png',
    }] })).rejects.toThrow('Texture "hull.png" for material "Hull" was not provided.');
  });

  it('adds material context when the browser cannot decode a texture', async () => {
    vi.spyOn(Texture.prototype, 'load').mockImplementation(async function load(url) {
      if (url === 'blob:gull') throw { type: 'error' };
      this.sourceCanvas = {} as HTMLCanvasElement;
    });

    await expect(loadSceneDefinition({ models: [{
      objText: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3',
      textureUrl: 'blob:fallback',
      mtlText: 'newmtl Gull body\nmap_Kd images/gull.tif',
      textureUrls: { 'GULL.TIF': 'blob:gull' },
    }] })).rejects.toThrow(
      'Texture "images/gull.tif" for material "Gull body" could not be decoded. Use PNG, JPEG, or WebP.',
    );
  });
});
