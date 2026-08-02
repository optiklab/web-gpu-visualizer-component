// ============================================================================
// Display.ts - Framebuffer and Canvas Management
// ============================================================================
// TypeScript port of Display.cpp from the C++ software rasterizer.
// Each TypeScript line is annotated with the corresponding C++ code.
// ============================================================================

export class Display {
    private canvas: HTMLCanvasElement;

    // The 2D rendering context
    // C++: static SDL_Renderer* renderer = NULL;
    private ctx: CanvasRenderingContext2D;

    // Window width (or width of the display buffer). 800 expected.
    public width: number;

    // Window height (or height of the display buffer). 600 expected.
    public height: number;

    // C++: static uint32_t* color_buffer = NULL;
    private colorBuffer: Uint32Array; // Array holding pixel colors (32-bit: ARGB)

    // C++: static float* z_buffer = NULL;
    private zBuffer: Float32Array; // Array holding depth values (Z-buffer)

    // C++: color_buffer_texture = SDL_CreateTexture(...)
    private bufferImageData: ImageData; // The ImageData object used to put pixels onto the canvas

    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        this.canvas = canvas;
        this.width = width;
        this.height = height;

        // C++: window_width = ...; window_height = ...;
        this.canvas.width = width;
        this.canvas.height = height;

        // C++: renderer = SDL_CreateRenderer(window, -1, 0);
        const context = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error("Could not get 2D context");
        this.ctx = context;

        // C++: color_buffer_texture = SDL_CreateTexture(renderer, SDL_PIXELFORMAT_RGBA32, ...)
        this.bufferImageData = this.ctx.createImageData(width, height);

        // C++: color_buffer = (uint32_t*)malloc(sizeof(uint32_t) * window_width * window_height);
        this.colorBuffer = new Uint32Array(this.bufferImageData.data.buffer);

        // C++: z_buffer = (float*)malloc(sizeof(float) * (window_width + 1) * window_height);
        this.zBuffer = new Float32Array(width * height);
    }

    // ========================================================================
    // C++: void clear_color_buffer(uint32_t color)
    // C++: {
    // C++:     for (int i = 0; i < window_width * window_height; i++)
    // C++:     {
    // C++:         color_buffer[i] = color;
    // C++:     }
    // C++: }
    // ========================================================================
    public clearColorBuffer(color: number) {
        // C++: for (int i = 0; i < window_width * window_height; i++) { color_buffer[i] = color; }
        this.colorBuffer.fill(color);
    }

    // ========================================================================
    // C++: void clear_z_buffer(void) 
    // C++: {
    // C++:     for (int i = 0; i < (window_width + 1) * window_height; i++)
    // C++:     {
    // C++:         z_buffer[i] = 1.0;
    // C++:     }
    // C++: }
    // ========================================================================
    public clearZBuffer() {
        // C++: z_buffer[i] = 1.0;
        this.zBuffer.fill(1.0);
    }

    // ========================================================================
    // C++: void render_color_buffer(void)
    // C++: {
    // C++:     SDL_UpdateTexture(color_buffer_texture, NULL, color_buffer, (int)(window_width * sizeof(uint32_t)));
    // C++:     SDL_RenderCopy(renderer, color_buffer_texture, NULL, NULL);
    // C++:     SDL_RenderPresent(renderer);
    // C++: }
    // ========================================================================
    public renderColorBuffer() {
        // C++: SDL_UpdateTexture(color_buffer_texture, NULL, color_buffer, ...)
        this.bufferImageData.data.set(new Uint8ClampedArray(this.colorBuffer.buffer));

        // C++: SDL_RenderCopy(renderer, color_buffer_texture, NULL, NULL);
        // C++: SDL_RenderPresent(renderer);
        this.ctx.putImageData(this.bufferImageData, 0, 0);
    }

    // C++: void draw_pixel(int x, int y, uint32_t color)
    public drawPixel(x: number, y: number, color: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        this.colorBuffer[y * this.width + x] = color;
    }

    // C++: void draw_rect(int x, int y, int width, int height, uint32_t color)
    public drawRect(x: number, y: number, w: number, h: number, color: number) {

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                const currentX = x + i;
                const currentY = y + j;
                this.drawPixel(currentX, currentY, color);
            }
        }
    }

    // ========================================================================
    // C++: void draw_grid(void)
    // C++: {
    // C++:     for (int y = 0; y < window_height; y += 10)
    // C++:     {
    // C++:         for (int x = 0; x < window_width; x += 10)
    // C++:         {
    // C++:             color_buffer[(window_width * y) + x] = 0xFF444444;
    // C++:         }
    // C++:     }
    // C++: }
    // ========================================================================
    public drawGrid() {
        for (let y = 0; y < this.height; y += 10) {
            for (let x = 0; x < this.width; x += 10) {
                if (x % 10 === 0 || y % 10 === 0) {
                    this.drawPixel(x, y, 0xFF444444);
                }
            }
        }
    }

    // C++: void draw_line(int x0, int y0, int x1, int y1, uint32_t color)
    public drawLine(x0: number, y0: number, x1: number, y1: number, color: number) {
        let deltaX = x1 - x0;
        let deltaY = y1 - y0;

        const longestSideLength = (Math.abs(deltaX) >= Math.abs(deltaY)) ? Math.abs(deltaX) : Math.abs(deltaY);

        const xInc = deltaX / longestSideLength;
        const yInc = deltaY / longestSideLength;

        let currentX = x0;
        let currentY = y0;

        for (let i = 0; i <= longestSideLength; i++) {
            this.drawPixel(Math.round(currentX), Math.round(currentY), color);
            currentX += xInc;
            currentY += yInc;
        }
    }

    // C++: float get_zbuffer_at(int x, int y)
    public getZBufferAt(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height)
            return 1.0;

        return this.zBuffer[y * this.width + x];
    }

    // C++: void update_zbuffer_at(int x, int y, float value)
    public updateZBufferAt(x: number, y: number, value: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height)
            return;
        this.zBuffer[y * this.width + x] = value;
    }
}
