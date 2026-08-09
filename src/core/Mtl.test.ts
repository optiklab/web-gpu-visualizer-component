import { describe, expect, it } from 'vitest';
import { parseMtl } from './Mtl';

describe('parseMtl', () => {
  it('maps named materials to diffuse textures', () => {
    const materials = parseMtl(`
      newmtl Hull
      map_Kd textures/hull.png
      newmtl Glass trim
      map_Kd -clamp on -s 1 1 1 "glass trim.jpg"
    `);

    expect(materials.get('Hull')?.diffuseTexture).toBe('textures/hull.png');
    expect(materials.get('Glass trim')?.diffuseTexture).toBe('glass trim.jpg');
  });
});