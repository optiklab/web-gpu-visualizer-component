import { describe, expect, it } from 'vitest';
import { loadSceneDefinition } from './sceneLoader';

describe('loadSceneDefinition', () => {
  it('rejects empty scenes', async () => {
    await expect(loadSceneDefinition({ models: [] })).rejects.toThrow(
      'A scene must contain at least one model.',
    );
  });

  it('rejects models without a source', async () => {
    await expect(loadSceneDefinition({ models: [{}] })).rejects.toThrow(
      'requires objUrl or objText',
    );
  });

  it('rejects OBJ sources without triangle faces before using the DOM', async () => {
    await expect(loadSceneDefinition({ models: [{ objText: 'v 0 0 0' }] })).rejects.toThrow(
      'contains no triangle faces',
    );
  });
});
