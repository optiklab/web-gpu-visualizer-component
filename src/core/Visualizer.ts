import { Camera } from './Camera';
import { CameraControls } from './CameraControls';
import { Vec3 } from './math/Vector';
import { loadSceneDefinition } from './sceneLoader';
import type {
  LoadedModel,
  ModelTransform,
  RendererBackend,
  RendererKind,
  RenderMode,
  SceneDefinition,
  VisualizerOptions,
} from './types';
import { WebCpuBackend } from '../renderers/cpu/WebCpuBackend';
import { WebGpuBackend } from '../renderers/gpu/WebGpuBackend';

export class WebGpuVisualizer {
  private readonly camera = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, 1));
  private readonly options: Required<Pick<VisualizerOptions,
    'renderer' | 'fallbackToCpu' | 'renderMode' | 'controls' | 'keyboard' | 'backgroundColor' | 'pixelRatio'>>
    & Omit<VisualizerOptions, 'renderer' | 'fallbackToCpu' | 'renderMode' | 'controls' | 'keyboard' | 'backgroundColor' | 'pixelRatio'>;
  private backend: RendererBackend | null = null;
  private cameraControls: CameraControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame = 0;
  private sceneModels: LoadedModel[] = [];
  private sceneAbortController: AbortController | null = null;
  private inputAbortController = new AbortController();
  private pressedKeys = new Set<string>();
  private previousTimestamp = 0;
  private sceneLoadGeneration = 0;
  private disposed = false;
  private switchingBackend = false;

  constructor(private readonly canvas: HTMLCanvasElement, options: VisualizerOptions = {}) {
    this.options = {
      renderer: options.renderer ?? 'auto',
      fallbackToCpu: options.fallbackToCpu ?? true,
      renderMode: options.renderMode ?? 'textured',
      controls: options.controls ?? true,
      keyboard: options.keyboard ?? true,
      backgroundColor: options.backgroundColor ?? 0xff000000,
      pixelRatio: options.pixelRatio ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio),
      scene: options.scene,
      onRendererChange: options.onRendererChange,
      onFallback: options.onFallback,
      onError: options.onError,
    };
  }

  public async initialize(): Promise<RendererKind> {
    if (this.disposed) throw new Error('Cannot initialize a disposed visualizer.');
    this.configureCanvas();
    this.resize();

    if (this.options.controls) this.cameraControls = new CameraControls(this.canvas, this.camera);
    if (this.options.keyboard) this.bindKeyboard();

    if (this.options.scene) {
      const generation = ++this.sceneLoadGeneration;
      try {
        const models = await this.loadSceneModels(this.options.scene);
        if (generation === this.sceneLoadGeneration) this.sceneModels = models;
      } catch (error) {
        if (!this.isAbortError(error)) throw error;
      }
    }

    await this.activatePreferredBackend();
    if (this.disposed) throw new Error('Visualizer was disposed during initialization.');

    this.animationFrame = requestAnimationFrame(this.renderFrame);
    return this.backend!.kind;
  }

  public async loadScene(scene: SceneDefinition): Promise<void> {
    const generation = ++this.sceneLoadGeneration;
    let models: LoadedModel[];
    try {
      models = await this.loadSceneModels(scene);
    } catch (error) {
      if (this.isAbortError(error)) return;
      throw error;
    }
    if (this.disposed || generation !== this.sceneLoadGeneration) return;
    this.sceneModels = models;
    if (this.backend) {
      try {
        await this.backend.setScene(models);
      } catch (error) {
        if (this.backend.kind === 'webgpu' && this.options.fallbackToCpu) {
          await this.activateCpuBackend(this.toError(error));
        } else {
          throw error;
        }
      }
    }
  }

  public setRenderMode(mode: RenderMode): void {
    this.options.renderMode = mode;
    this.backend?.setRenderMode(mode);
  }

  public setModelTransform(id: string, transform: ModelTransform): boolean {
    const model = this.sceneModels.find(candidate => candidate.id === id);
    if (!model) return false;

    if (transform.translation) {
      model.mesh.translation = new Vec3(
        transform.translation.x,
        transform.translation.y,
        transform.translation.z,
      );
    }
    if (transform.rotation) {
      model.mesh.rotation = new Vec3(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
      );
    }
    if (transform.scale) {
      model.mesh.scale = new Vec3(transform.scale.x, transform.scale.y, transform.scale.z);
    }
    return true;
  }

  public resetCamera(): void {
    this.camera.yaw = 0;
    this.camera.pitch = 0;
    this.camera.direction = new Vec3(0, 0, 1);
    this.camera.updatePosition(new Vec3(0, 0, 0));
  }

  public getRendererKind(): RendererKind | null {
    return this.backend?.kind ?? null;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.sceneAbortController?.abort();
    this.inputAbortController.abort();
    this.resizeObserver?.disconnect();
    this.cameraControls?.dispose();
    this.backend?.dispose();
    this.backend = null;
  }

  private async activatePreferredBackend(): Promise<void> {
    if (this.options.renderer === 'webcpu') {
      await this.activateCpuBackend();
      return;
    }

    try {
      const gpuBackend = new WebGpuBackend(this.canvas);
      await gpuBackend.initialize();
      await gpuBackend.setScene(this.sceneModels);
      this.setBackend(gpuBackend);
      gpuBackend.onDeviceLost?.(error => {
        if (this.options.fallbackToCpu) {
          void this.activateCpuBackend(error).catch(value => this.reportError(this.toError(value)));
        }
        else this.reportError(error);
      });
    } catch (error) {
      if (!this.options.fallbackToCpu) throw error;
      await this.activateCpuBackend(this.toError(error));
    }
  }

  private async activateCpuBackend(gpuError?: Error): Promise<void> {
    if (this.switchingBackend || this.disposed) return;
    this.switchingBackend = true;
    try {
      const cpuBackend = new WebCpuBackend(this.canvas, this.options.backgroundColor);
      await cpuBackend.initialize();
      await cpuBackend.setScene(this.sceneModels);
      this.setBackend(cpuBackend);
      if (gpuError) this.options.onFallback?.(gpuError);
    } finally {
      this.switchingBackend = false;
    }
  }

  private setBackend(backend: RendererBackend): void {
    this.backend?.dispose();
    this.backend = backend;
    backend.setRenderMode(this.options.renderMode);
    backend.resize(this.canvas.width, this.canvas.height);
    this.options.onRendererChange?.(backend.kind);
  }

  private async loadSceneModels(scene: SceneDefinition): Promise<LoadedModel[]> {
    this.sceneAbortController?.abort();
    const controller = new AbortController();
    this.sceneAbortController = controller;
    return loadSceneDefinition(scene, controller.signal);
  }

  private configureCanvas(): void {
    this.canvas.classList.add('wgv-canvas');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }

  private resize(): void {
    const ratio = Math.max(0.5, Math.min(3, this.options.pixelRatio));
    const width = Math.max(1, Math.round((this.canvas.clientWidth || this.canvas.width || 800) * ratio));
    const height = Math.max(1, Math.round((this.canvas.clientHeight || this.canvas.height || 600) * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.backend?.resize(width, height);
  }

  private bindKeyboard(): void {
    const options = { signal: this.inputAbortController.signal };
    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
      this.pressedKeys.add(event.key.toLowerCase());
    }, options);
    window.addEventListener('keyup', event => this.pressedKeys.delete(event.key.toLowerCase()), options);
    window.addEventListener('blur', () => this.pressedKeys.clear(), options);
  }

  private updateCamera(deltaSeconds: number): void {
    const moveSpeed = 5 * deltaSeconds;
    const rotationSpeed = 1.5 * deltaSeconds;
    if (this.pressedKeys.has('w')) this.camera.rotatePitch(rotationSpeed);
    if (this.pressedKeys.has('s')) this.camera.rotatePitch(-rotationSpeed);
    if (this.pressedKeys.has('arrowleft')) this.camera.rotateYaw(-rotationSpeed);
    if (this.pressedKeys.has('arrowright')) this.camera.rotateYaw(rotationSpeed);

    this.camera.getLookAtTarget();
    const velocity = Vec3.mul(this.camera.direction, moveSpeed);
    if (this.pressedKeys.has('arrowup')) this.camera.updatePosition(Vec3.add(this.camera.position, velocity));
    if (this.pressedKeys.has('arrowdown')) this.camera.updatePosition(Vec3.sub(this.camera.position, velocity));
  }

  private readonly renderFrame = (timestamp: number) => {
    if (this.disposed) return;
    const deltaSeconds = this.previousTimestamp === 0
      ? 0
      : Math.min((timestamp - this.previousTimestamp) / 1000, 0.1);
    this.previousTimestamp = timestamp;
    this.updateCamera(deltaSeconds);

    try {
      this.backend?.render(this.camera);
    } catch (error) {
      const renderError = this.toError(error);
      if (this.backend?.kind === 'webgpu' && this.options.fallbackToCpu) {
        void this.activateCpuBackend(renderError).catch(value => this.reportError(this.toError(value)));
      } else {
        this.reportError(renderError);
      }
    }
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  };

  private reportError(error: Error): void {
    this.options.onError?.(error);
  }

  private toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
  }

  private isAbortError(value: unknown): boolean {
    return value instanceof Error && value.name === 'AbortError';
  }
}
