import { describe, expect, it } from 'vitest';
import { Camera } from './Camera';
import { Vec3 } from './math/Vector';

describe('Camera', () => {
  it('clamps pitch before the vertical singularity', () => {
    const camera = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, 1));

    camera.rotatePitch(Math.PI);
    expect(camera.pitch).toBeCloseTo(Math.PI / 2 - 0.01);

    camera.rotatePitch(-Math.PI * 2);
    expect(camera.pitch).toBeCloseTo(-Math.PI / 2 + 0.01);
  });

  it('returns a look-at target relative to camera position', () => {
    const camera = new Camera(new Vec3(2, 3, 4), new Vec3(0, 0, 1));
    const target = camera.getLookAtTarget();

    expect(target).toMatchObject({ x: 2, y: 3, z: 5 });
  });
});
