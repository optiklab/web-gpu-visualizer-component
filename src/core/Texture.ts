export class Texture {
    public width: number = 0; // Width of the texture mapping
    public height: number = 0; // Height of the texture mapping
    public data: Uint32Array | null = null; // Buffer of pixels (32-bit uint)
    public sourceCanvas: HTMLCanvasElement | null = null;

    constructor() { }

    // Load from URL (blob or path) and decode into raw pixel buffer
    async load(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image(); // Create DOM Image object

            // Handler when image is retrieved
            img.onload = () => {
                this.width = img.width;
                this.height = img.height;

                // Create a temporary canvas to extract pixel data
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject("Could not get canvas context for texture");
                    return;
                }

                // Draw image onto canvas
                ctx.drawImage(img, 0, 0);
                // Extract RGBA bytes
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                this.sourceCanvas = canvas;

                // Convert bytes to Uint32Array for fast access
                // ImageData.data is Uint8ClampedArray (RGBA sequence)
                // We manually pack 0xAABBGGRR (Little Endian standard for ABGR view of RGBA bytes)
                // to match the expected format for Main.ts render loop

                const data = imageData.data;
                this.data = new Uint32Array(this.width * this.height);

                for (let i = 0; i < this.data.length; i++) {
                    const r = data[i * 4 + 0]; // Red byte
                    const g = data[i * 4 + 1]; // Green byte
                    const b = data[i * 4 + 2]; // Blue byte
                    const a = data[i * 4 + 3]; // Alpha byte

                    // Pack as 0xAABBGGRR (Little Endian uint32)
                    // Byte 0 (lowest) = R
                    // Byte 1          = G
                    // Byte 2          = B
                    // Byte 3 (highest)= A
                    this.data[i] = (a << 24) | (b << 16) | (g << 8) | r;
                }

                console.log(`Texture loaded: ${url} (${this.width}x${this.height})`); // Log successful load
                resolve();
            };

            // Handler for errors
            img.onerror = (e) => {
                console.error(`Failed to load texture: ${url}`, e);
                reject(e);
            };

            // Start loading
            img.src = url;
        });
    }

    // Clone texture object (shallow copy of data)
    clone(): Texture {
        const t = new Texture(); // Create new Texture instance
        t.width = this.width; // Copy width
        t.height = this.height; // Copy height
        if (this.data) {
            t.data = new Uint32Array(this.data); // Create a new Uint32Array with the same data
        }
        t.sourceCanvas = this.sourceCanvas;
        return t;
    }
}
