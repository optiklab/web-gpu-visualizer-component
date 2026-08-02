import { useState } from 'react';
import { WebGpuVisualizer } from './react';
import type { RendererKind, RenderMode, SceneDefinition } from './core/types';
import './styles.css';
import './App.css';

const modelOptions = [
  { id: 'fullscene', label: 'Full Runway Scene' },
  { id: 'f22', label: 'F-22 Raptor' },
  { id: 'efa', label: 'Eurofighter' },
  { id: 'f117', label: 'F-117 Nighthawk' },
  { id: 'cube', label: 'Cube' },
  { id: 'crab', label: 'Crab' },
  { id: 'drone', label: 'Drone' },
  { id: 'runway', label: 'Runway' },
] as const;

type ModelId = typeof modelOptions[number]['id'];

const fighterRotation = { x: 0, y: -Math.PI / 2, z: 0 };
const modelScene = (
  id: Exclude<ModelId, 'fullscene'>,
  textureExtension: 'jpg' | 'png' = 'png',
  rotation = { x: 0, y: 0, z: 0 },
): SceneDefinition => ({
  models: [{
    id,
    objUrl: `/meshes/${id}.obj`,
    textureUrl: `/meshes/${id}.${textureExtension}`,
    translation: { x: 0, y: 0, z: 5 },
    rotation,
  }],
});

const scenes: Record<ModelId, SceneDefinition> = {
  fullscene: {
    models: [
      {
        id: 'runway',
        objUrl: '/meshes/runway.obj',
        textureUrl: '/meshes/runway.png',
        translation: { x: 0, y: -1.5, z: 23 },
      },
      {
        id: 'f22',
        objUrl: '/meshes/f22.obj',
        textureUrl: '/meshes/f22.png',
        translation: { x: 0, y: -1.3, z: 5 },
        rotation: fighterRotation,
      },
      {
        id: 'efa',
        objUrl: '/meshes/efa.obj',
        textureUrl: '/meshes/efa.png',
        translation: { x: -2, y: -1.3, z: 9 },
        rotation: fighterRotation,
      },
      {
        id: 'f117',
        objUrl: '/meshes/f117.obj',
        textureUrl: '/meshes/f117.png',
        translation: { x: 2, y: -1.3, z: 9 },
        rotation: fighterRotation,
      },
    ],
  },
  f22: modelScene('f22', 'png', fighterRotation),
  efa: modelScene('efa', 'png', fighterRotation),
  f117: modelScene('f117', 'png', fighterRotation),
  cube: modelScene('cube', 'jpg', { x: 0.35, y: 0.65, z: 0 }),
  crab: modelScene('crab'),
  drone: modelScene('drone'),
  runway: modelScene('runway'),
};

export default function App() {
  const [mode, setMode] = useState<RenderMode>('textured');
  const [renderer, setRenderer] = useState<RendererKind | 'loading'>('loading');
  const [modelId, setModelId] = useState<ModelId>('fullscene');

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <p className="eyebrow">React component package</p>
          <h1>WebGPU Visualizer</h1>
        </div>
        <span className={`renderer-state renderer-state-${renderer}`}>{renderer}</span>
      </header>

      <section className="viewer-workspace" aria-label="Visualizer example">
        <WebGpuVisualizer
          scene={scenes[modelId]}
          renderMode={mode}
          onRendererChange={setRenderer}
          onError={error => console.warn('[visualizer]', error.message)}
        />
        <div className="viewer-toolbar">
          <div className="viewer-controls">
            <select
              className="model-selector"
              aria-label="Select model"
              value={modelId}
              onChange={event => setModelId(event.target.value as ModelId)}
            >
              {modelOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <div className="mode-control" role="group" aria-label="Render mode">
              {(['wireframe', 'filled', 'textured'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p>Drag to rotate · Shift-drag to pan · Wheel to zoom · Double-click to reset</p>
        </div>
      </section>

      <section className="integration-strip">
        <code>npm install @optiklab/web-gpu-visualizer-component</code>
        <p>WebGPU is selected first. Canvas CPU rendering takes over when no adapter is available.</p>
      </section>
    </main>
  );
}
