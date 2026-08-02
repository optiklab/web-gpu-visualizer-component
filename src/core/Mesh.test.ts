import { describe, expect, it } from 'vitest';
import { Mesh } from './Mesh';

describe('Mesh.parseObj', () => {
  it('triangulates polygon faces and preserves texture coordinates', () => {
    const mesh = new Mesh();
    mesh.parseObj(`
      v -1 -1 0
      v 1 -1 0
      v 1 1 0
      v -1 1 0
      vt 0 0
      vt 1 0
      vt 1 1
      vt 0 1
      f 1/1 2/2 3/3 4/4
    `);

    expect(mesh.faces).toHaveLength(2);
    expect(mesh.faces.map(face => [face.a, face.b, face.c])).toEqual([
      [1, 2, 3],
      [1, 3, 4],
    ]);
    expect(mesh.faces[1].c_uv).toMatchObject({ x: 0, y: 1 });
  });

  it('resolves negative indices relative to the current lists', () => {
    const mesh = new Mesh();
    mesh.parseObj(`
      v 0 0 0
      v 1 0 0
      v 0 1 0
      f -3 -2 -1
    `);

    expect(mesh.faces[0]).toMatchObject({ a: 1, b: 2, c: 3 });
  });

  it('rejects out-of-range indices', () => {
    const mesh = new Mesh();
    expect(() => mesh.parseObj('v 0 0 0\nf 1 2 3')).toThrow('Invalid OBJ vertex index');
  });
});
