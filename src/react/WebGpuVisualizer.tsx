import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { WebGpuVisualizer as VisualizerController } from '../core/Visualizer';
import type {
  RendererKind,
  RendererPreference,
  RenderMode,
  SceneDefinition,
} from '../core/types';

export interface WebGpuVisualizerHandle {
  loadScene(scene: SceneDefinition): Promise<void>;
  resetCamera(): void;
  setRenderMode(mode: RenderMode): void;
  getRendererKind(): RendererKind | null;
}

export interface WebGpuVisualizerProps {
  scene: SceneDefinition;
  renderer?: RendererPreference;
  fallbackToCpu?: boolean;
  renderMode?: RenderMode;
  controls?: boolean;
  keyboard?: boolean;
  pixelRatio?: number;
  className?: string;
  style?: CSSProperties;
  canvasClassName?: string;
  showStatus?: boolean;
  loadingLabel?: string;
  onReady?: (renderer: RendererKind) => void;
  onRendererChange?: (renderer: RendererKind) => void;
  onFallback?: (error: Error) => void;
  onError?: (error: Error) => void;
}

export const WebGpuVisualizer = forwardRef<WebGpuVisualizerHandle, WebGpuVisualizerProps>(
  function WebGpuVisualizerComponent({
    scene,
    renderer = 'auto',
    fallbackToCpu = true,
    renderMode = 'textured',
    controls = true,
    keyboard = true,
    pixelRatio,
    className,
    style,
    canvasClassName,
    showStatus = true,
    loadingLabel = 'Loading 3D scene...',
    onReady,
    onRendererChange,
    onFallback,
    onError,
  }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const controllerRef = useRef<VisualizerController | null>(null);
    const sceneRef = useRef(scene);
    const loadedSceneRef = useRef<SceneDefinition | null>(null);
    const callbacksRef = useRef({ onReady, onRendererChange, onFallback, onError });
    const [status, setStatus] = useState<'loading' | RendererKind | 'error'>('loading');

    sceneRef.current = scene;
    callbacksRef.current = { onReady, onRendererChange, onFallback, onError };

    useImperativeHandle(ref, () => ({
      loadScene: nextScene => {
        if (!controllerRef.current) return Promise.reject(new Error('Visualizer is not ready.'));
        return controllerRef.current.loadScene(nextScene);
      },
      resetCamera: () => controllerRef.current?.resetCamera(),
      setRenderMode: mode => controllerRef.current?.setRenderMode(mode),
      getRendererKind: () => controllerRef.current?.getRendererKind() ?? null,
    }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let active = true;
      const controller = new VisualizerController(canvas, {
        renderer,
        fallbackToCpu,
        renderMode,
        controls,
        keyboard,
        pixelRatio,
        scene: sceneRef.current,
        onRendererChange: kind => {
          if (!active) return;
          setStatus(kind);
          callbacksRef.current.onRendererChange?.(kind);
        },
        onError: error => {
          if (!active) return;
          callbacksRef.current.onError?.(error);
        },
        onFallback: error => callbacksRef.current.onFallback?.(error),
      });
      controllerRef.current = controller;
      loadedSceneRef.current = sceneRef.current;

      void controller.initialize()
        .then(kind => {
          if (!active) return;
          setStatus(kind);
          callbacksRef.current.onReady?.(kind);
        })
        .catch(value => {
          if (!active) return;
          const error = value instanceof Error ? value : new Error(String(value));
          setStatus('error');
          callbacksRef.current.onError?.(error);
        });

      return () => {
        active = false;
        controller.dispose();
        controllerRef.current = null;
      };
    }, [renderer, fallbackToCpu, controls, keyboard, pixelRatio]);

    useEffect(() => {
      if (!controllerRef.current || scene === loadedSceneRef.current) return;
      loadedSceneRef.current = scene;
      void controllerRef.current.loadScene(scene).catch(value => {
        const error = value instanceof Error ? value : new Error(String(value));
        setStatus('error');
        callbacksRef.current.onError?.(error);
      });
    }, [scene]);

    useEffect(() => {
      controllerRef.current?.setRenderMode(renderMode);
    }, [renderMode]);

    const rootClassName = ['wgv-root', className].filter(Boolean).join(' ');
    const mergedCanvasClassName = ['wgv-canvas', canvasClassName].filter(Boolean).join(' ');

    return (
      <div className={rootClassName} style={style} data-renderer={status}>
        <canvas ref={canvasRef} className={mergedCanvasClassName} aria-label="3D model visualizer" />
        {showStatus && status === 'loading' && <div className="wgv-status">{loadingLabel}</div>}
        {showStatus && status === 'webcpu' && <div className="wgv-badge">CPU fallback</div>}
        {showStatus && status === 'error' && <div className="wgv-status wgv-status-error">Unable to start visualizer</div>}
      </div>
    );
  },
);
