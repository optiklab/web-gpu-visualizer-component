import { Mesh } from './Mesh';
import { Vec2, Vec3 } from './math/Vector';

type JsonRecord = Record<string, unknown>;

interface GltfDocument extends JsonRecord {
  asset?: { version?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{ children?: number[]; matrix?: number[]; mesh?: number; rotation?: number[]; scale?: number[]; translation?: number[] }>;
  meshes?: Array<{ primitives?: GltfPrimitive[] }>;
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: Array<{ byteLength?: number; uri?: string }>;
  materials?: Array<{
    name?: string;
    alphaMode?: string;
    emissiveFactor?: number[];
    emissiveTexture?: { index?: number };
    extensions?: {
      KHR_materials_clearcoat?: { clearcoatFactor?: number };
      KHR_materials_transmission?: { transmissionFactor?: number };
    };
    pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index?: number } };
  }>;
  textures?: Array<{ source?: number }>;
  images?: Array<{ bufferView?: number; mimeType?: string; uri?: string }>;
  extensionsRequired?: string[];
}

interface GltfPrimitive {
  attributes?: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
  extensions?: JsonRecord;
}

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType?: number;
  count?: number;
  normalized?: boolean;
  sparse?: unknown;
  type?: string;
}

interface GltfBufferView {
  buffer?: number;
  byteLength?: number;
  byteOffset?: number;
  byteStride?: number;
}

export interface GltfSource {
  json: string;
  binaryChunk?: ArrayBuffer;
  baseUrl?: string;
  resourceUrls?: Record<string, string>;
}

export interface ParsedGltf {
  mesh: Mesh;
  materialTextureUrls: Map<string, string>;
  temporaryUrls: string[];
}

const componentByteSizes: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

const componentCounts: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

export function decodeGlb(data: ArrayBuffer): { json: string; binaryChunk?: ArrayBuffer } {
  if (data.byteLength < 20) throw new Error('Invalid GLB: file is too short.');
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB: missing glTF magic header.');
  if (view.getUint32(4, true) !== 2) throw new Error('Only glTF 2.0 GLB files are supported.');
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > data.byteLength) throw new Error('Invalid GLB: declared length exceeds file size.');

  let offset = 12;
  let json: string | undefined;
  let binaryChunk: ArrayBuffer | undefined;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + chunkLength > declaredLength) throw new Error('Invalid GLB: truncated chunk.');
    const chunk = data.slice(offset, offset + chunkLength);
    if (chunkType === 0x4e4f534a) json = new TextDecoder().decode(chunk).replace(/\0+$/g, '').trimEnd();
    if (chunkType === 0x004e4942) binaryChunk = chunk;
    offset += chunkLength;
  }
  if (!json) throw new Error('Invalid GLB: JSON chunk is missing.');
  return { json, binaryChunk };
}

export async function parseGltf(source: GltfSource, signal?: AbortSignal): Promise<ParsedGltf> {
  let document: GltfDocument;
  try {
    document = JSON.parse(source.json) as GltfDocument;
  } catch {
    throw new Error('Invalid glTF: JSON could not be parsed.');
  }
  if (document.asset?.version !== '2.0') throw new Error('Only glTF 2.0 assets are supported.');
  if (document.extensionsRequired?.length) {
    throw new Error(`Unsupported required glTF extensions: ${document.extensionsRequired.join(', ')}.`);
  }

  const buffers = await loadBuffers(document, source, signal);
  const mesh = new Mesh();
  const roots = document.scenes?.[document.scene ?? 0]?.nodes
    ?? document.nodes?.map((_, index) => index).filter(index => !document.nodes?.some(node => node.children?.includes(index)))
    ?? [];
  for (const nodeIndex of roots) appendNode(document, buffers, nodeIndex, identityMatrix(), mesh);
  if (mesh.faces.length === 0) throw new Error('glTF contains no supported triangle primitives.');

  const materialTextureUrls = new Map<string, string>();
  const temporaryUrls: string[] = [];
  for (let materialIndex = 0; materialIndex < (document.materials?.length ?? 0); materialIndex++) {
    const material = document.materials?.[materialIndex];
    const emissiveStrength = Math.max(...(material?.emissiveFactor ?? [0]));
    const textureIndex = emissiveStrength > 0
      ? material?.emissiveTexture?.index ?? material?.pbrMetallicRoughness?.baseColorTexture?.index
      : material?.pbrMetallicRoughness?.baseColorTexture?.index;
    if (textureIndex === undefined) continue;
    const imageIndex = document.textures?.[textureIndex]?.source;
    if (imageIndex === undefined) continue;
    const resolved = resolveImage(document, buffers, imageIndex, source);
    if (resolved.temporary) temporaryUrls.push(resolved.url);
    materialTextureUrls.set(materialName(document, materialIndex), resolved.url);
  }
  return { mesh, materialTextureUrls, temporaryUrls };
}

async function loadBuffers(document: GltfDocument, source: GltfSource, signal?: AbortSignal): Promise<ArrayBuffer[]> {
  return Promise.all((document.buffers ?? []).map(async (buffer, index) => {
    if (!buffer.uri) {
      if (index === 0 && source.binaryChunk) return source.binaryChunk;
      throw new Error(`glTF buffer ${index} has no URI or GLB binary chunk.`);
    }
    const mappedUrl = resolveResourceUrl(buffer.uri, source);
    if (mappedUrl.startsWith('data:')) return decodeDataUri(mappedUrl);
    const response = await fetch(mappedUrl, { signal });
    if (!response.ok) throw new Error(`Failed to load glTF buffer (${response.status}): ${buffer.uri}`);
    return response.arrayBuffer();
  }));
}

function appendNode(document: GltfDocument, buffers: ArrayBuffer[], nodeIndex: number, parent: number[], mesh: Mesh): void {
  const node = document.nodes?.[nodeIndex];
  if (!node) throw new Error(`Invalid glTF node index: ${nodeIndex}.`);
  const world = multiplyMatrices(parent, nodeMatrix(node));
  if (node.mesh !== undefined) appendMesh(document, buffers, node.mesh, world, mesh);
  node.children?.forEach(child => appendNode(document, buffers, child, world, mesh));
}

function appendMesh(document: GltfDocument, buffers: ArrayBuffer[], meshIndex: number, transform: number[], mesh: Mesh): void {
  const primitives = document.meshes?.[meshIndex]?.primitives;
  if (!primitives) throw new Error(`Invalid glTF mesh index: ${meshIndex}.`);
  for (const primitive of primitives) {
    if (primitive.extensions && Object.keys(primitive.extensions).length > 0) {
      throw new Error('Compressed glTF mesh primitives are not supported.');
    }
    if ((primitive.mode ?? 4) !== 4) throw new Error('Only glTF TRIANGLES primitives are supported.');
    const positionAccessor = primitive.attributes?.POSITION;
    if (positionAccessor === undefined) throw new Error('glTF primitive is missing POSITION data.');
    const positions = readAccessor(document, buffers, positionAccessor, 'VEC3');
    const normals = primitive.attributes?.NORMAL === undefined
      ? undefined
      : readAccessor(document, buffers, primitive.attributes.NORMAL, 'VEC3');
    const uvs = primitive.attributes?.TEXCOORD_0 === undefined
      ? undefined
      : readAccessor(document, buffers, primitive.attributes.TEXCOORD_0, 'VEC2');
    const vertexOffset = mesh.vertices.length;
    for (let index = 0; index < positions.length; index += 3) {
      const point = transformPoint(transform, positions[index], positions[index + 1], positions[index + 2]);
      mesh.vertices.push(new Vec3(point[0], point[1], point[2]));
    }
    const indices = primitive.indices === undefined
      ? Array.from({ length: positions.length / 3 }, (_, index) => index)
      : readAccessor(document, buffers, primitive.indices, 'SCALAR');
    if (indices.length % 3 !== 0) throw new Error('glTF triangle index count must be divisible by three.');
    for (let index = 0; index < indices.length; index += 3) {
      const triangle = indices.slice(index, index + 3).map(value => {
        if (!Number.isInteger(value) || value < 0 || value >= positions.length / 3) {
          throw new Error(`Invalid glTF vertex index: ${value}.`);
        }
        return value;
      });
      const textureCoordinate = (vertexIndex: number) => uvs
        ? new Vec2(uvs[vertexIndex * 2], 1 - uvs[vertexIndex * 2 + 1])
        : new Vec2(0, 0);
      const emissive = primitive.material !== undefined
        && Math.max(...(document.materials?.[primitive.material]?.emissiveFactor ?? [0])) > 0;
      const normal = (vertexIndex: number) => normals && !emissive
        ? transformNormal(transform, normals[vertexIndex * 3], normals[vertexIndex * 3 + 1], normals[vertexIndex * 3 + 2])
        : undefined;
      const color = primitive.material === undefined
        ? 0xffffffff
        : packMaterialColor(document.materials?.[primitive.material]);
      mesh.faces.push({
        a: vertexOffset + triangle[0] + 1,
        b: vertexOffset + triangle[2] + 1,
        c: vertexOffset + triangle[1] + 1,
        a_uv: textureCoordinate(triangle[0]),
        b_uv: textureCoordinate(triangle[2]),
        c_uv: textureCoordinate(triangle[1]),
        color,
        a_normal: normal(triangle[0]),
        b_normal: normal(triangle[2]),
        c_normal: normal(triangle[1]),
        materialName: primitive.material === undefined ? undefined : materialName(document, primitive.material),
        transparent: primitive.material !== undefined
          && document.materials?.[primitive.material]?.alphaMode === 'BLEND',
      });
    }
  }
}

function readAccessor(document: GltfDocument, buffers: ArrayBuffer[], accessorIndex: number, expectedType: string): number[] {
  const accessor = document.accessors?.[accessorIndex];
  if (!accessor || accessor.bufferView === undefined) throw new Error(`Invalid glTF accessor: ${accessorIndex}.`);
  if (accessor.sparse) throw new Error('Sparse glTF accessors are not supported.');
  if (accessor.type !== expectedType) throw new Error(`glTF accessor ${accessorIndex} must be ${expectedType}.`);
  const componentType = accessor.componentType ?? 0;
  const componentSize = componentByteSizes[componentType];
  const componentCount = componentCounts[accessor.type];
  const bufferView = document.bufferViews?.[accessor.bufferView];
  const buffer = bufferView?.buffer === undefined ? undefined : buffers[bufferView.buffer];
  if (!bufferView || !buffer || !componentSize || !componentCount || accessor.count === undefined) {
    throw new Error(`Invalid glTF accessor metadata: ${accessorIndex}.`);
  }
  const stride = bufferView.byteStride ?? componentSize * componentCount;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(buffer);
  const values: number[] = [];
  for (let element = 0; element < accessor.count; element++) {
    for (let component = 0; component < componentCount; component++) {
      const offset = start + element * stride + component * componentSize;
      if (offset + componentSize > buffer.byteLength) throw new Error(`glTF accessor ${accessorIndex} exceeds its buffer.`);
      values.push(readComponent(view, offset, componentType, accessor.normalized ?? false));
    }
  }
  return values;
}

function readComponent(view: DataView, offset: number, type: number, normalized: boolean): number {
  let value: number;
  if (type === 5120) value = view.getInt8(offset);
  else if (type === 5121) value = view.getUint8(offset);
  else if (type === 5122) value = view.getInt16(offset, true);
  else if (type === 5123) value = view.getUint16(offset, true);
  else if (type === 5125) value = view.getUint32(offset, true);
  else if (type === 5126) return view.getFloat32(offset, true);
  else throw new Error(`Unsupported glTF component type: ${type}.`);
  if (!normalized) return value;
  if (type === 5120) return Math.max(value / 127, -1);
  if (type === 5121) return value / 255;
  if (type === 5122) return Math.max(value / 32767, -1);
  if (type === 5123) return value / 65535;
  return value;
}

function resolveImage(document: GltfDocument, buffers: ArrayBuffer[], imageIndex: number, source: GltfSource) {
  const image = document.images?.[imageIndex];
  if (!image) throw new Error(`Invalid glTF image index: ${imageIndex}.`);
  if (image.uri) return { url: resolveResourceUrl(image.uri, source), temporary: false };
  if (image.bufferView === undefined || !image.mimeType) throw new Error(`glTF image ${imageIndex} has no image data.`);
  const view = document.bufferViews?.[image.bufferView];
  const buffer = view?.buffer === undefined ? undefined : buffers[view.buffer];
  if (!view || !buffer) throw new Error(`Invalid glTF image buffer view: ${image.bufferView}.`);
  const start = view.byteOffset ?? 0;
  const bytes = buffer.slice(start, start + (view.byteLength ?? 0));
  return { url: URL.createObjectURL(new Blob([bytes], { type: image.mimeType })), temporary: true };
}

function resolveResourceUrl(uri: string, source: GltfSource): string {
  if (uri.startsWith('data:')) return uri;
  const normalized = uri.replace(/\\/g, '/');
  const basename = normalized.split('/').pop()?.toLowerCase();
  const mapped = Object.entries(source.resourceUrls ?? {}).find(([name]) => {
    const candidate = name.replace(/\\/g, '/');
    return candidate.toLowerCase() === normalized.toLowerCase()
      || candidate.split('/').pop()?.toLowerCase() === basename;
  });
  if (mapped) return mapped[1];
  if (source.baseUrl) return new URL(normalized, source.baseUrl).toString();
  throw new Error(`glTF resource "${uri}" was not provided.`);
}

function decodeDataUri(uri: string): ArrayBuffer {
  const match = uri.match(/^data:[^,]*?(;base64)?,(.*)$/);
  if (!match) throw new Error('Invalid glTF data URI.');
  const decoded = match[1] ? atob(match[2]) : decodeURIComponent(match[2]);
  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  return bytes.buffer;
}

function materialName(document: GltfDocument, index: number): string {
  return `gltf-material-${index}:${document.materials?.[index]?.name ?? 'unnamed'}`;
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function nodeMatrix(node: NonNullable<GltfDocument['nodes']>[number]): number[] {
  if (node.matrix) {
    if (node.matrix.length !== 16) throw new Error('glTF node matrix must contain 16 values.');
    return node.matrix;
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * y * y - 2 * z * z) * sx, (2 * x * y + 2 * z * w) * sx, (2 * x * z - 2 * y * w) * sx, 0,
    (2 * x * y - 2 * z * w) * sy, (1 - 2 * x * x - 2 * z * z) * sy, (2 * y * z + 2 * x * w) * sy, 0,
    (2 * x * z + 2 * y * w) * sz, (2 * y * z - 2 * x * w) * sz, (1 - 2 * x * x - 2 * y * y) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiplyMatrices(left: number[], right: number[]): number[] {
  const result = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let index = 0; index < 4; index++) result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
    }
  }
  return result;
}

function transformPoint(matrix: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function packMaterialColor(material: NonNullable<GltfDocument['materials']>[number] | undefined): number {
  let [red, green, blue, alpha] = material?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
  const transmission = material?.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0;
  const clearcoat = material?.extensions?.KHR_materials_clearcoat?.clearcoatFactor ?? 0;
  if (red === 0 && green === 0 && blue === 0 && (transmission > 0 || clearcoat > 0)) {
    [red, green, blue] = transmission > 0 ? [0.1, 0.16, 0.2] : [0.32, 0.32, 0.32];
  }
  const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)));
  return ((byte(alpha) << 24) | (byte(blue) << 16) | (byte(green) << 8) | byte(red)) >>> 0;
}

function transformNormal(matrix: number[], x: number, y: number, z: number): Vec3 {
  const normal = new Vec3(
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z,
  );
  Vec3.normalize(normal);
  return normal;
}