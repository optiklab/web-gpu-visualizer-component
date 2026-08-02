import { Mesh } from './Mesh';
import { Texture } from './Texture';
import { Vec3 } from './math/Vector';
import type { LoadedModel, ModelSource, SceneDefinition, Vector3Value } from './types';

const toVec3 = (value: Vector3Value | undefined, fallback: Vec3) => value
  ? new Vec3(value.x, value.y, value.z)
  : fallback;

export async function loadSceneDefinition(
  scene: SceneDefinition,
  signal?: AbortSignal,
): Promise<LoadedModel[]> {
  if (scene.models.length === 0) {
    throw new Error('A scene must contain at least one model.');
  }

  return Promise.all(scene.models.map((source, index) => loadModel(source, index, signal)));
}

async function loadModel(source: ModelSource, index: number, signal?: AbortSignal): Promise<LoadedModel> {
  if (!source.objUrl && source.objText === undefined) {
    throw new Error(`Model ${source.id ?? index} requires objUrl or objText.`);
  }

  const mesh = new Mesh();
  if (source.objText !== undefined) {
    mesh.parseObj(source.objText);
  } else {
    const response = await fetch(source.objUrl!, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load OBJ (${response.status}): ${source.objUrl}`);
    }
    mesh.parseObj(await response.text());
  }

  if (signal?.aborted) throw new DOMException('Scene load aborted', 'AbortError');
  if (mesh.faces.length === 0) {
    throw new Error(`Model ${source.id ?? index} contains no triangle faces.`);
  }

  if (source.textureUrl) {
    const texture = new Texture();
    await texture.load(source.textureUrl);
    if (signal?.aborted) throw new DOMException('Scene load aborted', 'AbortError');
    mesh.texture = texture;
  } else {
    mesh.texture = createSolidTexture();
  }

  mesh.translation = toVec3(source.translation, new Vec3(0, 0, 5));
  mesh.rotation = toVec3(source.rotation, new Vec3(0, 0, 0));
  mesh.scale = toVec3(source.scale, new Vec3(1, 1, 1));

  return { id: source.id ?? `model-${index + 1}`, mesh };
}

function createSolidTexture(): Texture {
  const texture = new Texture();
  texture.width = 1;
  texture.height = 1;
  texture.data = new Uint32Array([0xffffffff]);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1, 1);
  }
  texture.sourceCanvas = canvas;
  return texture;
}
