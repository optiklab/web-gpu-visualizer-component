import { describe, expect, it } from 'vitest';
import { Display } from './Display';

describe('Display transparency', () => {
  it('blends translucent gray over red without hiding the red channel', () => {
    const colorBuffer = new Uint32Array([0xff000080]);
    const display = Object.create(Display.prototype) as Display;
    Object.assign(display, { width: 1, height: 1, colorBuffer });

    display.blendPixel(0, 0, 0x80525252);

    expect(colorBuffer[0]).toBe(0xff292969);
  });
});