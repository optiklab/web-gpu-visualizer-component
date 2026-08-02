import { Camera } from '../../core/Camera';
import { Mat4 } from '../../core/math/Matrix';
import { Vec3, Vec4 } from '../../core/math/Vector';
import type { LoadedModel, RenderMode, RendererBackend, RenderStats } from '../../core/types';
import { Clipping } from './Clipping';
import { Display } from './Display';
import { Light } from './Light';
import { Rasterizer } from './Triangle';

export class WebCpuBackend implements RendererBackend {
  public readonly kind = 'webcpu' as const;
  private display: Display;
  private models: LoadedModel[] = [];
  private renderMode: RenderMode = 'textured';
  private projection = Mat4.identity();
  private readonly light = new Light(new Vec3(0, 0, 1));

  constructor(private readonly canvas: HTMLCanvasElement, private readonly backgroundColor = 0xff000000) {
    this.display = new Display(canvas, Math.max(1, canvas.width), Math.max(1, canvas.height));
    this.configureProjection();
  }

  public async initialize(): Promise<void> {
    // Canvas 2D initialization is synchronous in Display's constructor.
  }

  public async setScene(models: LoadedModel[]): Promise<void> {
    this.models = models;
  }

  public setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;
  }

  public resize(width: number, height: number): void {
    if (width === this.display.width && height === this.display.height) return;
    this.display = new Display(this.canvas, Math.max(1, width), Math.max(1, height));
    this.configureProjection();
  }

  public render(camera: Camera): RenderStats {
    this.display.clearColorBuffer(this.backgroundColor);
    this.display.clearZBuffer();

    const target = camera.getLookAtTarget();
    const viewMatrix = Mat4.lookAt(camera.position, target, new Vec3(0, 1, 0));
    let triangleCount = 0;

    for (const { mesh } of this.models) {
      const worldMatrix = this.createWorldMatrix(mesh.scale, mesh.rotation, mesh.translation);

      for (const face of mesh.faces) {
        const transformed = [face.a, face.b, face.c].map(index => {
          let point = Vec4.fromVec3(mesh.vertices[index - 1]);
          point = Mat4.mulVec4(worldMatrix, point);
          return Mat4.mulVec4(viewMatrix, point);
        });

        const normal = this.getTriangleNormal(transformed);
        const cameraRay = Vec3.sub(new Vec3(0, 0, 0), Vec3.fromVec4(transformed[0]));
        if (Vec3.dot(normal, cameraRay) < 0) continue;

        const polygon = Clipping.polygonFromTriangle(
          Vec3.fromVec4(transformed[0]),
          Vec3.fromVec4(transformed[1]),
          Vec3.fromVec4(transformed[2]),
          face.a_uv,
          face.b_uv,
          face.c_uv,
        );
        Clipping.clipPolygon(polygon);

        for (const triangle of Clipping.trianglesFromPolygon(polygon)) {
          const points = triangle.points.map(point => {
            const projected = Mat4.mulVec4Project(this.projection, point);
            projected.x = projected.x * this.display.width / 2 + this.display.width / 2;
            projected.y = -projected.y * this.display.height / 2 + this.display.height / 2;
            return projected;
          });

          const intensity = -Vec3.dot(normal, this.light.getDirection());
          const color = Light.applyIntensity(face.color, intensity);
          triangleCount++;

          if (this.renderMode === 'filled') {
            Rasterizer.drawFilledTriangle(
              this.display,
              points[0].x, points[0].y, points[0].z, points[0].w,
              points[1].x, points[1].y, points[1].z, points[1].w,
              points[2].x, points[2].y, points[2].z, points[2].w,
              color,
            );
          } else if (this.renderMode === 'textured' && mesh.texture) {
            Rasterizer.drawTexturedTriangle(
              this.display,
              points[0].x, points[0].y, points[0].z, points[0].w, triangle.texcoords[0].x, triangle.texcoords[0].y,
              points[1].x, points[1].y, points[1].z, points[1].w, triangle.texcoords[1].x, triangle.texcoords[1].y,
              points[2].x, points[2].y, points[2].z, points[2].w, triangle.texcoords[2].x, triangle.texcoords[2].y,
              mesh.texture,
            );
          } else {
            Rasterizer.drawTriangle(
              this.display,
              points[0].x, points[0].y,
              points[1].x, points[1].y,
              points[2].x, points[2].y,
              0xffffffff,
            );
          }
        }
      }
    }

    this.display.renderColorBuffer();
    return { renderer: this.kind, modelCount: this.models.length, triangleCount };
  }

  public dispose(): void {
    this.models = [];
  }

  private configureProjection(): void {
    const fieldOfView = Math.PI / 3;
    const aspect = this.display.height / this.display.width;
    this.projection = Mat4.makePerspective(fieldOfView, aspect, 0.1, 100);
    const fieldOfViewX = Math.atan(Math.tan(fieldOfView / 2) * this.display.width / this.display.height) * 2;
    Clipping.initFrustumPlanes(fieldOfViewX, fieldOfView, 0.1, 100);
  }

  private createWorldMatrix(scale: Vec3, rotation: Vec3, translation: Vec3): Mat4 {
    let matrix = Mat4.identity();
    matrix = Mat4.mulMat4(Mat4.makeScale(scale.x, scale.y, scale.z), matrix);
    matrix = Mat4.mulMat4(Mat4.makeRotationZ(rotation.z), matrix);
    matrix = Mat4.mulMat4(Mat4.makeRotationY(rotation.y), matrix);
    matrix = Mat4.mulMat4(Mat4.makeRotationX(rotation.x), matrix);
    return Mat4.mulMat4(Mat4.makeTranslation(translation.x, translation.y, translation.z), matrix);
  }

  private getTriangleNormal(vertices: Vec4[]): Vec3 {
    const edgeA = Vec3.sub(Vec3.fromVec4(vertices[1]), Vec3.fromVec4(vertices[0]));
    const edgeB = Vec3.sub(Vec3.fromVec4(vertices[2]), Vec3.fromVec4(vertices[0]));
    Vec3.normalize(edgeA);
    Vec3.normalize(edgeB);
    const normal = Vec3.cross(edgeA, edgeB);
    Vec3.normalize(normal);
    return normal;
  }
}
