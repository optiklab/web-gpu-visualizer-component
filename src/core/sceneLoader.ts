import { Mesh } from './Mesh';
import { parseMtl } from './Mtl';
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

  const mtlText = await loadMtlText(source, signal);
  if (mtlText !== undefined) {
    const materials = parseMtl(mtlText);
    const texturesByUrl = new Map<string, Texture>();
    for (const material of materials.values()) {
      if (!material.diffuseTexture) continue;
      const textureUrl = resolveTextureUrl(material.diffuseTexture, source);
      if (!textureUrl) {
        throw new Error(`Texture "${material.diffuseTexture}" for material "${material.name}" was not provided.`);
      }
      let texture = texturesByUrl.get(textureUrl);
      if (!texture) {
        texture = new Texture();
        try {
          await texture.load(textureUrl);
        } catch {
          throw new Error(
            `Texture "${material.diffuseTexture}" for material "${material.name}" could not be decoded. Use PNG, JPEG, or WebP.`,
          );
        }
        texturesByUrl.set(textureUrl, texture);
      }
      if (signal?.aborted) throw new DOMException('Scene load aborted', 'AbortError');
      mesh.materialTextures.set(material.name, texture);
    }
  }

  mesh.translation = toVec3(source.translation, new Vec3(0, 0, 5));
  mesh.rotation = toVec3(source.rotation, new Vec3(0, 0, 0));
  mesh.scale = toVec3(source.scale, new Vec3(1, 1, 1));

  return { id: source.id ?? `model-${index + 1}`, mesh };
}

async function loadMtlText(source: ModelSource, signal?: AbortSignal): Promise<string | undefined> {
  if (source.mtlText !== undefined) return source.mtlText;
  if (!source.mtlUrl) return undefined;
  const response = await fetch(source.mtlUrl, { signal });
  if (!response.ok) throw new Error(`Failed to load MTL (${response.status}): ${source.mtlUrl}`);
  return response.text();
}

function resolveTextureUrl(texturePath: string, source: ModelSource): string | undefined {
  const normalizedPath = texturePath.replace(/\\/g, '/');
  const basename = normalizedPath.split('/').pop() ?? normalizedPath;
  const entries = Object.entries(source.textureUrls ?? {});
  const normalizedPathLower = normalizedPath.toLowerCase();
  const basenameLower = basename.toLowerCase();
  const direct = entries.find(([name]) => name.replace(/\\/g, '/').toLowerCase() === normalizedPathLower)
    ?? entries.find(([name]) => name.replace(/\\/g, '/').split('/').pop()?.toLowerCase() === basenameLower);
  if (direct) return direct[1];

  const sequenceMatch = basenameLower.match(/^(.*)_\d+(\.[^.]+)$/);
  if (sequenceMatch) {
    const unsuffixedName = `${sequenceMatch[1]}${sequenceMatch[2]}`;
    const candidates = entries.filter(([name]) => (
      name.replace(/\\/g, '/').split('/').pop()?.toLowerCase() === unsuffixedName
    ));
    if (candidates.length === 1) return candidates[0][1];
  }

  if (source.mtlUrl) {
    const documentUrl = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
    return new URL(normalizedPath, new URL(source.mtlUrl, documentUrl)).toString();
  }
  return undefined;
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
