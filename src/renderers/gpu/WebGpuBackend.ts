import { Camera } from '../../core/Camera';
import { Mat4 } from '../../core/math/Matrix';
import { Vec3 } from '../../core/math/Vector';
import type { LoadedModel, RenderMode, RendererBackend, RenderStats } from '../../core/types';
import { WebGpuRenderer, type GpuMesh, type RenderItem } from './WebGpuRenderer';

interface GpuSceneModel {
  source: LoadedModel;
  gpuMesh: GpuMesh;
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
        const vertices = this.flattenVertices(source);
        const texture = source.mesh.texture?.sourceCanvas;
        if (!texture) throw new Error(`Model ${source.id} has no decoded texture source.`);
        const gpuMesh = this.renderer.updateMesh(vertices, texture);
        if (!gpuMesh) throw new Error(`Could not upload model ${source.id} to WebGPU.`);
        uploaded.push({ source, gpuMesh });
      }
    } catch (error) {
      uploaded.forEach(model => this.renderer.destroyMesh(model.gpuMesh));
      throw error;
    }

    this.models.forEach(model => this.renderer.destroyMesh(model.gpuMesh));
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

    const items: RenderItem[] = this.models.map(({ source, gpuMesh }) => {
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
      return { mesh: gpuMesh, mvpMatrix: matrix };
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
    this.models.forEach(model => this.renderer.destroyMesh(model.gpuMesh));
    this.models = [];
    this.renderer.dispose();
  }

  private flattenVertices(source: LoadedModel): Float32Array {
    const values: number[] = [];
    for (const face of source.mesh.faces) {
      const vertices = [
        source.mesh.vertices[face.a - 1],
        source.mesh.vertices[face.b - 1],
        source.mesh.vertices[face.c - 1],
      ];
      const uvs = [face.a_uv, face.b_uv, face.c_uv];
      for (let index = 0; index < 3; index++) {
        const vertex = vertices[index];
        const uv = uvs[index];
        values.push(vertex.x, vertex.y, vertex.z, uv.x, 1 - uv.y);
      }
    }
    return new Float32Array(values);
  }
}
