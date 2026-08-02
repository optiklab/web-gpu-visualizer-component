import { Vec3 } from '../../core/math/Vector';

export class Light {
    private direction: Vec3;

    constructor(direction: Vec3) {
        this.direction = direction;
    }

    getDirection(): Vec3 {
        return this.direction;
    }

    setDirection(direction: Vec3) {
        this.direction = direction;
    }

    // Apply light intensity to a color
    // Color is uint32 (AABBGGRR or similar depending on endianness).
    // In JS/Canvas ImageData, we usually treat it as Uint8ClampedArray [R, G, B, A]
    // But if we use Uint32Array on the buffer:
    // Little Endian (common): 0xAABBGGRR (A is MSB, R is LSB).
    // Canvas putImageData expects: R, G, B, A...
    // Let's assume the colors in OBJ/Mesh are stored as 0xAABBGGRR (hex literal).
    // And we need to dim R, G, B.
    static applyIntensity(originalColor: number, percentageFactor: number): number {
        if (percentageFactor < 0) percentageFactor = 0;
        if (percentageFactor > 1) percentageFactor = 1;

        // originalColor is 32-bit integer.
        // We assume 0xAABBGGRR format (Alpha, Blue, Green, Red) for Little Endian.
        // Wait, typical hex color 0xFFFFFFFF is R=255, G=255, B=255, A=255 ???
        // In JS 0xFF0000FF => R=FF? No. 
        // Let's stick to the C logic which seemed to assume:
        // uint32_t a = (original_color & 0xFF000000);
        // uint32_t r = (original_color & 0x00FF0000) * percentage_factor;
        // This implies 0xAARRGGBB order if 0x00FF0000 is Red.
        // But usually ABGR is used for direct 32-bit writing to canvas imageData buffer on little-endian.

        // Let's just implement generic masking:
        // We need to know WHICH byte corresponds to what channel.
        // However, if we just scale all channels (except Alpha), it should be fine regardless of order,
        // AS LONG AS Alpha is the highest byte (0xFF000000).
        // If Alpha is lowest byte, we might dim it.
        // Let's assume standard format for now and adjust if colors look wrong.
        // C++ code used:
        // uint32_t a = (original_color & 0xFF000000);
        // uint32_t r = (original_color & 0x00FF0000) * percentage_factor;
        // uint32_t g = (original_color & 0x0000FF00) * percentage_factor;
        // uint32_t b = (original_color & 0x000000FF) * percentage_factor;

        const a = (originalColor & 0xFF000000) >>> 0; // Unsigned shift to keep it correct
        const r = (originalColor & 0x00FF0000) >>> 0;
        const g = (originalColor & 0x0000FF00) >>> 0;
        const b = (originalColor & 0x000000FF) >>> 0;

        const newR = Math.floor((r >>> 16) * percentageFactor) << 16;
        const newG = Math.floor((g >>> 8) * percentageFactor) << 8;
        const newB = Math.floor(b * percentageFactor);

        return (a | newR | newG | newB) >>> 0;
    }
}
