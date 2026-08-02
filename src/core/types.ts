import type { Vec3 } from './math/Vector';

export type RendererKind = 'webgpu' | 'webcpu';
export type RendererPreference = 'auto' | RendererKind;
export type RenderMode = 'wireframe' | 'filled' | 'textured';

export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

export interface ModelTransform {
  translation?: Vector3Value;
  rotation?: Vector3Value;
  scale?: Vector3Value;
}

export interface ModelSource extends ModelTransform {
  id?: string;
  objUrl?: string;
  objText?: string;
  textureUrl?: string;
}

export interface SceneDefinition {
  models: ModelSource[];
}

export interface VisualizerOptions {
  renderer?: RendererPreference;
  fallbackToCpu?: boolean;
  renderMode?: RenderMode;
  scene?: SceneDefinition;
  controls?: boolean;
  keyboard?: boolean;
  backgroundColor?: number;
  pixelRatio?: number;
  onRendererChange?: (renderer: RendererKind) => void;
  onFallback?: (error: Error) => void;
  onError?: (error: Error) => void;
}

export interface LoadedModel {
  id: string;
  mesh: import('./Mesh').Mesh;
}

export interface RenderStats {
  renderer: RendererKind;
  modelCount: number;
  triangleCount: number;
}

export interface RendererBackend {
  readonly kind: RendererKind;
  initialize(): Promise<void>;
  setScene(models: LoadedModel[]): Promise<void>;
  setRenderMode(mode: RenderMode): void;
  resize(width: number, height: number): void;
  render(camera: import('./Camera').Camera): RenderStats;
  dispose(): void;
  onDeviceLost?(callback: (reason: Error) => void): void;
}

export interface CameraSnapshot {
  position: Vec3;
  yaw: number;
  pitch: number;
}
