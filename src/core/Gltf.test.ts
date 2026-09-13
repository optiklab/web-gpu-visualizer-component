import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeGlb, parseGltf } from './Gltf';

const triangleBytes = () => {
  const buffer = new ArrayBuffer(68);
  new Float32Array(buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  new Float32Array(buffer, 36, 6).set([0, 0, 1, 0, 0, 1]);
  new Uint16Array(buffer, 60, 3).set([0, 1, 2]);
  return buffer;
};

const triangleDocument = (buffer: { uri?: string; byteLength: number }) => ({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, translation: [2, 3, 4] }],
  meshes: [{ primitives: [{
    attributes: { POSITION: 0, TEXCOORD_0: 1 },
    indices: 2,
  }] }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
    { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
    { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 24 },
    { buffer: 0, byteOffset: 60, byteLength: 6 },
  ],
  buffers: [buffer],
});

const createGlb = (jsonValue: object, binary: ArrayBuffer) => {
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(JSON.stringify(jsonValue));
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const binaryLength = Math.ceil(binary.byteLength / 4) * 4;
  const glb = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(glb);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(glb, 20, jsonLength).fill(0x20);
  new Uint8Array(glb, 20, jsonBytes.length).set(jsonBytes);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  new Uint8Array(glb, binaryHeader + 8, binary.byteLength).set(new Uint8Array(binary));
  return glb;
};

afterEach(() => vi.restoreAllMocks());

describe('glTF 2.0 decoding', () => {
  it('loads mapped external buffers and flattens node transforms', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(triangleBytes(), { status: 200 }),
    );

    const result = await parseGltf({
      json: JSON.stringify(triangleDocument({ uri: 'geometry.bin', byteLength: 68 })),
      resourceUrls: { 'GEOMETRY.BIN': 'blob:geometry' },
    });

    expect(fetchMock).toHaveBeenCalledWith('blob:geometry', { signal: undefined });
    expect(result.mesh.vertices).toMatchObject([
      { x: 2, y: 3, z: 4 },
      { x: 3, y: 3, z: 4 },
      { x: 2, y: 4, z: 4 },
    ]);
    expect(result.mesh.faces[0]).toMatchObject({
      a: 1,
      b: 3,
      c: 2,
      a_uv: { x: 0, y: 1 },
      b_uv: { x: 0, y: 0 },
      c_uv: { x: 1, y: 1 },
    });
  });

  it('decodes a GLB JSON and binary chunk into a triangle mesh', async () => {
    const document = triangleDocument({ byteLength: 68 });
    document.meshes[0].primitives[0] = { ...document.meshes[0].primitives[0], material: 0 };
    Object.assign(document, {
      materials: [{ name: 'Paint', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      textures: [{ source: 0 }],
      images: [{ bufferView: 3, mimeType: 'image/png' }],
    });
    document.bufferViews.push({ buffer: 0, byteOffset: 66, byteLength: 2 });
    const glb = createGlb(document, triangleBytes());
    const decoded = decodeGlb(glb);
    const result = await parseGltf(decoded);

    expect(result.mesh.vertices).toHaveLength(3);
    expect(result.mesh.faces).toHaveLength(1);
    expect(result.mesh.faces[0].materialName).toBe('gltf-material-0:Paint');
    expect(result.materialTextureUrls.get('gltf-material-0:Paint')).toMatch(/^blob:/);
    expect(result.temporaryUrls).toHaveLength(1);
    URL.revokeObjectURL(result.temporaryUrls[0]);
  });

  it('preserves factor-only material colors and transformed vertex normals', async () => {
    const buffer = new ArrayBuffer(72);
    new Float32Array(buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    new Float32Array(buffer, 36, 9).set([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const bytes = new Uint8Array(buffer);
    const encoded = btoa(String.fromCharCode(...bytes));
    const result = await parseGltf({ json: JSON.stringify({
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
      ],
      buffers: [{ uri: `data:application/octet-stream;base64,${encoded}`, byteLength: 72 }],
      materials: [{
        name: 'CARPAINT',
        pbrMetallicRoughness: { baseColorFactor: [0.5, 0.25, 0.75, 0.5] },
      }],
    }) });

    expect(result.mesh.faces[0]).toMatchObject({
      color: 0x80bf4080,
      a_normal: { x: 0, y: 0, z: 1 },
      b_normal: { x: 0, y: 0, z: 1 },
      c_normal: { x: 0, y: 0, z: 1 },
      materialName: 'gltf-material-0:CARPAINT',
    });
  });

  it('approximates transmission glass and prefers emissive lamp textures', async () => {
    const bytes = new Uint8Array(36);
    new Float32Array(bytes.buffer).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const encoded = btoa(String.fromCharCode(...bytes));
    const result = await parseGltf({ json: JSON.stringify({
      asset: { version: '2.0' },
      scenes: [{ nodes: [0, 1, 2, 3] }],
      nodes: [{ mesh: 0 }, { mesh: 1 }, { mesh: 2 }, { mesh: 3 }],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
        { primitives: [{ attributes: { POSITION: 0 }, material: 1 }] },
        { primitives: [{ attributes: { POSITION: 0 }, material: 2 }] },
        { primitives: [{ attributes: { POSITION: 0 }, material: 3 }] },
      ],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      buffers: [{ uri: `data:application/octet-stream;base64,${encoded}`, byteLength: 36 }],
      materials: [
        {
          name: 'WINDOWS',
          alphaMode: 'BLEND',
          pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 0.25] },
          extensions: { KHR_materials_transmission: { transmissionFactor: 1 } },
        },
        {
          name: 'LAMPS',
          pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
          emissiveFactor: [0.5, 0.5, 0.5],
          emissiveTexture: { index: 1 },
        },
        {
          name: 'Red_Glass',
          alphaMode: 'BLEND',
          pbrMetallicRoughness: { baseColorFactor: [0.5, 0, 0, 0.25] },
          extensions: { KHR_materials_transmission: { transmissionFactor: 1 } },
        },
        {
          name: 'GLASS_LIGHT',
          alphaMode: 'BLEND',
          pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 0.5] },
          extensions: { KHR_materials_clearcoat: { clearcoatFactor: 1 } },
        },
      ],
      textures: [{ source: 0 }, { source: 1 }],
      images: [
        { uri: 'base.png' },
        { uri: 'emissive.png' },
      ],
    }), resourceUrls: {
      'base.png': 'blob:base',
      'emissive.png': 'blob:emissive',
    } });

    expect(result.mesh.faces[0]).toMatchObject({ color: 0x4033291a, transparent: true });
    expect(result.materialTextureUrls.get('gltf-material-1:LAMPS')).toBe('blob:emissive');
    expect(result.mesh.faces[2]).toMatchObject({ color: 0x40000080, transparent: true });
    expect(result.mesh.faces[3]).toMatchObject({ color: 0x80525252, transparent: true });
  });

  it('rejects unsupported required extensions clearly', async () => {
    await expect(parseGltf({ json: JSON.stringify({
      asset: { version: '2.0' },
      extensionsRequired: ['KHR_draco_mesh_compression'],
    }) })).rejects.toThrow('Unsupported required glTF extensions: KHR_draco_mesh_compression.');
  });

  it('rejects invalid GLB headers', () => {
    expect(() => decodeGlb(new ArrayBuffer(20))).toThrow('missing glTF magic header');
  });
});