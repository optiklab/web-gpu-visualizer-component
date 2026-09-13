import { Camera } from '../../core/Camera';
import type { Face } from '../../core/Mesh';
import type { Texture } from '../../core/Texture';
import { Mat4 } from '../../core/math/Matrix';
import { Vec3 } from '../../core/math/Vector';
import type { LoadedModel, RenderMode, RendererBackend, RenderStats } from '../../core/types';
import { WebGpuRenderer, type GpuMesh, type RenderItem } from './WebGpuRenderer';

interface GpuSceneModel {
  source: LoadedModel;
  gpuMeshes: GpuMesh[];
}

interface MaterialBatch {
  texture: Texture;
  faces: Face[];
  transparent: boolean;
}

export class WebGpuBackend implements RendererBackend {
  public readonly kind = 'webgpu' as const;
  private readonly renderer: WebGpuRenderer;
  private models: GpuSceneModel[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGpuRenderer(canvas);
  }

  public async initialize(): Promise<void> {
    await this.renderer.init();
  }

  public async setScene(models: LoadedModel[]): Promise<void> {
    const uploaded: GpuSceneModel[] = [];
    try {
      for (const source of models) {
        const batches = this.createMaterialBatches(source);
        const gpuMeshes: GpuMesh[] = [];
        for (const { texture, faces, transparent } of batches) {
          const textureCanvas = texture.sourceCanvas;
          if (!textureCanvas) throw new Error(`Model ${source.id} has no decoded texture source.`);
          const gpuMesh = this.renderer.updateMesh(this.flattenVertices(source, faces), textureCanvas, transparent);
          if (!gpuMesh) throw new Error(`Could not upload model ${source.id} to WebGPU.`);
          gpuMeshes.push(gpuMesh);
        }
        uploaded.push({ source, gpuMeshes });
      }
    } catch (error) {
      uploaded.flatMap(model => model.gpuMeshes).forEach(mesh => this.renderer.destroyMesh(mesh));
      throw error;
    }

    this.models.flatMap(model => model.gpuMeshes).forEach(mesh => this.renderer.destroyMesh(mesh));
    this.models = uploaded;
  }

  public setRenderMode(mode: RenderMode): void {
    this.renderer.setRenderMode(mode);
  }

  public resize(width: number, height: number): void {
    this.renderer.canvas.width = Math.max(1, width);
    this.renderer.canvas.height = Math.max(1, height);
  }

  public render(camera: Camera): RenderStats {
    const target = camera.getLookAtTarget();
    const view = Mat4.lookAt(camera.position, target, new Vec3(0, 1, 0));
    const projection = Mat4.makePerspective(
      Math.PI / 3,
      this.renderer.canvas.height / this.renderer.canvas.width,
      0.1,
      100,
    );

    const items: RenderItem[] = this.models.flatMap(({ source, gpuMeshes }) => {
      const { mesh } = source;
      let matrix = Mat4.identity();
      matrix = Mat4.mulMat4(Mat4.makeScale(mesh.scale.x, mesh.scale.y, mesh.scale.z), matrix);
      matrix = Mat4.mulMat4(Mat4.makeRotationZ(mesh.rotation.z), matrix);
      matrix = Mat4.mulMat4(Mat4.makeRotationY(mesh.rotation.y), matrix);
      matrix = Mat4.mulMat4(Mat4.makeRotationX(mesh.rotation.x), matrix);
      matrix = Mat4.mulMat4(Mat4.makeTranslation(
        mesh.translation.x,
        mesh.translation.y,
        mesh.translation.z,
      ), matrix);
      matrix = Mat4.mulMat4(view, matrix);
      matrix = Mat4.mulMat4(projection, matrix);
      return gpuMeshes.map(mesh => ({ mesh, mvpMatrix: matrix }));
    });

    this.renderer.render(items);
    return {
      renderer: this.kind,
      modelCount: this.models.length,
      triangleCount: this.models.reduce((total, model) => total + model.source.mesh.faces.length, 0),
    };
  }

  public onDeviceLost(callback: (reason: Error) => void): void {
    void this.renderer.device?.lost.then(info => {
      callback(new Error(`WebGPU device lost (${info.reason}): ${info.message}`));
    });
  }

  public dispose(): void {
    this.models.flatMap(model => model.gpuMeshes).forEach(mesh => this.renderer.destroyMesh(mesh));
    this.models = [];
    this.renderer.dispose();
  }

  private createMaterialBatches(source: LoadedModel): MaterialBatch[] {
    const fallback = source.mesh.texture;
    if (!fallback) throw new Error(`Model ${source.id} has no decoded fallback texture.`);
    const batches: MaterialBatch[] = [];
    for (const face of source.mesh.faces) {
      const texture = face.materialName
        ? source.mesh.materialTextures.get(face.materialName) ?? fallback
        : fallback;
      const transparent = face.transparent ?? false;
      let batch = batches.find(candidate => candidate.texture === texture && candidate.transparent === transparent);
      if (!batch) {
        batch = { texture, faces: [], transparent };
        batches.push(batch);
      }
      batch.faces.push(face);
    }
    return batches;
  }

  private flattenVertices(source: LoadedModel, faces: Face[]): Float32Array {
    const values: number[] = [];
    for (const face of faces) {
      const vertices = [
        source.mesh.vertices[face.a - 1],
        source.mesh.vertices[face.b - 1],
        source.mesh.vertices[face.c - 1],
      ];
      const uvs = [face.a_uv, face.b_uv, face.c_uv];
      const normals = [face.a_normal, face.b_normal, face.c_normal];
      const color = [
        (face.color & 0xff) / 255,
        ((face.color >>> 8) & 0xff) / 255,
        ((face.color >>> 16) & 0xff) / 255,
        ((face.color >>> 24) & 0xff) / 255,
      ];
      for (let index = 0; index < 3; index++) {
        const vertex = vertices[index];
        const uv = uvs[index];
        const normal = normals[index];
        values.push(
          vertex.x, vertex.y, vertex.z,
          uv.x, 1 - uv.y,
          normal?.x ?? 0, normal?.y ?? 0, normal?.z ?? 0,
          ...color,
        );
      }
    }
    return new Float32Array(values);
  }
}
