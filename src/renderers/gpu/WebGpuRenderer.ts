// ============================================================================
// Renderer.ts - WebGPU Rendering Engine
// ============================================================================
// This class manages the WebGPU device, pipeline, and frame rendering.
// It handles GPU resource creation, mesh/texture uploads, and draw calls.
// ============================================================================

import { Mat4 } from '../../core/math/Matrix'; // Import 4x4 Matrix class for MVP calculations
import shaderSource from './shaders/basic.wgsl?raw'; // Vite: Import shader as raw text string

export type RenderMode = 'wireframe' | 'filled' | 'textured';

export interface GpuMesh {
    vertexBuffer: GPUBuffer;
    vertexCount: number;
    wireVertexBuffer: GPUBuffer;
    wireVertexCount: number;
    uniformBuffer: GPUBuffer;
    texture: GPUTexture;
    bindGroup: GPUBindGroup;
}

export interface RenderItem {
    mesh: GpuMesh;
    mvpMatrix: Mat4;
}

/**
 * Renderer Class
 * 
 * Encapsulates all WebGPU rendering logic including:
 * - GPU device and adapter initialization
 * - Render pipeline creation (shaders, buffers, bind groups)
 * - Mesh and texture uploading
 * - Per-frame rendering with MVP matrix updates
 */
export class WebGpuRenderer {
    // ========================================================================
    // Public Properties - Core WebGPU Objects
    // ========================================================================

    public canvas: HTMLCanvasElement;           // The HTML canvas element we render to
    public adapter: GPUAdapter | null = null;   // GPU adapter (represents the physical GPU)
    public device: GPUDevice | null = null;     // GPU device (logical connection to the GPU)
    public context: GPUCanvasContext | null = null; // WebGPU context for the canvas
    public format: GPUTextureFormat = 'bgra8unorm'; // Preferred texture format for the swap chain

    // ========================================================================
    // Pipeline Objects
    // ========================================================================

    public pipeline: GPURenderPipeline | null = null; // The render pipeline (shaders + state)
    private filledPipeline: GPURenderPipeline | null = null;
    private wirePipeline: GPURenderPipeline | null = null;
    private renderMode: RenderMode = 'textured';

    // ========================================================================
    // Texture Resources
    // ========================================================================

    public sampler: GPUSampler | null = null;   // Texture sampler (filtering, wrapping)
    private depthTexture: GPUTexture | null = null;
    private depthTextureWidth = 0;
    private depthTextureHeight = 0;

    // ========================================================================
    // Constructor
    // ========================================================================

    /**
     * Creates a new Renderer instance.
     * @param canvas - The HTMLCanvasElement to render to
     */
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas; // Store reference to canvas
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize WebGPU - must be called before any rendering.
     * This is async because GPU operations require waiting for the browser.
     */
    async init() {
        // Step 1: Check if WebGPU is supported in this browser
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        // Step 2: Request a GPU adapter (represents the physical GPU)
        // The adapter is the first step in accessing GPU capabilities
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) throw new Error("No GPU adapter found.");

        // Step 3: Request a logical device from the adapter
        // The device is what we use to create resources and submit commands
        this.device = await this.adapter.requestDevice();

        // Step 4: Get the WebGPU rendering context from the canvas
        // This is similar to getting a 2D or WebGL context
        this.context = this.canvas.getContext('webgpu');
        if (!this.context) throw new Error("Could not get WebGPU context.");

        // Step 5: Get the preferred texture format for this GPU/display
        // Usually 'bgra8unorm' on most systems
        this.format = navigator.gpu.getPreferredCanvasFormat();

        // Step 6: Configure the canvas context with our device and format
        this.context.configure({
            device: this.device,          // Which device to use
            format: this.format,          // Texture format for the swap chain
            alphaMode: 'premultiplied',   // How to handle alpha (transparency)
        });

        // Step 7: Create the render pipeline (shaders, vertex layout, etc.)
        await this.createPipeline();

        // Step 8: Create default/fallback assets
        await this.createAssets();
    }

    // ========================================================================
    // Pipeline Creation
    // ========================================================================

    /**
     * Creates the GPU render pipeline.
     * The pipeline defines how vertices are transformed and pixels are colored.
     */
    private async createPipeline() {
        if (!this.device) return; // Guard: device must be initialized

        // Create shader module from the WGSL shader source code
        // Shader module contains both vertex and fragment shaders
        const shaderModule = this.device.createShaderModule({
            code: shaderSource // The raw WGSL text imported at the top
        });

        // ====================================================================
        // Bind Group Layout
        // ====================================================================
        // Defines what resources (buffers, textures, samplers) the shaders expect
        // This layout must match the @group and @binding annotations in the shader

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,                         // @binding(0) in shader
                    visibility: GPUShaderStage.VERTEX, // Used by vertex shader
                    buffer: { type: 'uniform' }         // It's a uniform buffer (MVP matrix)
                },
                {
                    binding: 1,                           // @binding(1) in shader
                    visibility: GPUShaderStage.FRAGMENT, // Used by fragment shader
                    sampler: { type: 'filtering' }        // A filtering sampler (linear interpolation)
                },
                {
                    binding: 2,                           // @binding(2) in shader
                    visibility: GPUShaderStage.FRAGMENT, // Used by fragment shader
                    texture: { sampleType: 'float' }      // A 2D texture with float values
                }
            ]
        });

        // Create pipeline layout from the bind group layout(s)
        // We only have one bind group (group 0)
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        // ====================================================================
        // Render Pipeline
        // ====================================================================
        // The complete pipeline configuration: shaders, vertex format, render state

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout, // Use our defined layout

            // Vertex Stage Configuration
            vertex: {
                module: shaderModule,      // Shader module containing vs_main
                entryPoint: 'vs_main',     // Name of the vertex shader function
                buffers: [
                    {
                        // Vertex buffer layout: how to read vertex data
                        arrayStride: 5 * 4, // Each vertex is 5 floats × 4 bytes = 20 bytes
                        // Format: [x, y, z, u, v]
                        attributes: [
                            {
                                shaderLocation: 0,     // @location(0) in shader = position
                                offset: 0,             // Position starts at byte 0
                                format: 'float32x3'    // 3 floats for x, y, z
                            },
                            {
                                shaderLocation: 1,     // @location(1) in shader = uv
                                offset: 3 * 4,         // UV starts after 3 floats (12 bytes)
                                format: 'float32x2'    // 2 floats for u, v
                            }
                        ]
                    }
                ]
            },

            // Fragment Stage Configuration
            fragment: {
                module: shaderModule,      // Same module, different entry point
                entryPoint: 'fs_main',     // Name of the fragment shader function
                targets: [
                    {
                        format: this.format, // Output format (matches swap chain)
                        // Alpha blending configuration for transparency
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                            }
                        }
                    }
                ]
            },

            // Primitive Configuration
            primitive: {
                topology: 'triangle-list', // Each 3 vertices form a triangle
                frontFace: 'cw',           // Match C++ winding after framebuffer Y inversion
                cullMode: 'back',          // Don't draw back-facing triangles (optimization)
            },

            // Depth/Stencil Configuration (for proper 3D depth sorting)
            depthStencil: {
                depthWriteEnabled: true,   // Write to depth buffer
                depthCompare: 'less',      // Pass if new depth < existing depth
                format: 'depth24plus',     // 24-bit depth buffer format
            }
        });

        this.filledPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 5 * 4,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 3 * 4, format: 'float32x2' }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_filled',
                targets: [{ format: this.format }]
            },
            primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'back' },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });

        this.wirePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 5 * 4,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 3 * 4, format: 'float32x2' }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_wire',
                targets: [{ format: this.format }]
            },
            primitive: { topology: 'line-list' },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less-equal',
                format: 'depth24plus'
            }
        });

        // ====================================================================
        // Texture Sampler
        // ====================================================================
        // Defines how textures are sampled (filtering, wrapping)

        this.sampler = this.device.createSampler({
            magFilter: 'linear',    // Linear interpolation when texture is magnified
            minFilter: 'linear',    // Linear interpolation when texture is minified
            addressModeU: 'repeat', // Repeat texture horizontally (U axis)
            addressModeV: 'repeat', // Repeat texture vertically (V axis)
        });
    }

    // ========================================================================
    // Default Assets (Placeholder)
    // ========================================================================

    /**
     * Creates default/fallback assets.
     * Currently empty - we use updateMesh() to load actual mesh data.
     */
    private async createAssets() {
        if (!this.device) return;
        // Placeholder: actual mesh loading happens via updateMesh()
    }

    // ========================================================================
    // Mesh and Texture Upload
    // ========================================================================

    /**
     * Upload mesh vertex data and texture to the GPU.
     * 
     * @param vertices - Float32Array of vertex data [x, y, z, u, v, ...]
     * @param textureImage - The texture image (ImageBitmap or HTMLCanvasElement)
     */
    public updateMesh(vertices: Float32Array, textureImage: ImageBitmap | HTMLCanvasElement): GpuMesh | null {
        // Guard: all required resources must be initialized
        if (!this.device || !this.pipeline || !this.sampler) return null;
        if (vertices.length === 0) throw new Error('Cannot upload an empty mesh.');

        // ====================================================================
        // Vertex Buffer Creation
        // ====================================================================

        // Calculate number of vertices (each vertex has 5 floats: x,y,z,u,v)
        const vertexCount = vertices.length / 5;

        // Create GPU buffer for vertices
        const vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,  // Size in bytes
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true       // Map immediately so we can write to it
        });

        // Copy vertex data to the GPU buffer
        new Float32Array(vertexBuffer.getMappedRange()).set(vertices);

        // Unmap the buffer so the GPU can use it
        vertexBuffer.unmap();

        const wireVertices: number[] = [];
        const appendVertex = (offset: number) => {
            for (let component = 0; component < 5; component++) {
                wireVertices.push(vertices[offset + component]);
            }
        };
        for (let triangle = 0; triangle < vertexCount; triangle += 3) {
            const a = triangle * 5;
            const b = (triangle + 1) * 5;
            const c = (triangle + 2) * 5;
            appendVertex(a); appendVertex(b);
            appendVertex(b); appendVertex(c);
            appendVertex(c); appendVertex(a);
        }

        const wireData = new Float32Array(wireVertices);
        const wireVertexCount = wireData.length / 5;
        const wireVertexBuffer = this.device.createBuffer({
            size: wireData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(wireVertexBuffer.getMappedRange()).set(wireData);
        wireVertexBuffer.unmap();

        // ====================================================================
        // Texture Creation
        // ====================================================================

        // Create GPU texture with the same dimensions as the source image
        const texture = this.device.createTexture({
            size: [textureImage.width, textureImage.height], // Width × Height
            format: 'rgba8unorm', // 8-bit RGBA normalized format
            usage: GPUTextureUsage.TEXTURE_BINDING |  // Can be bound as texture
                GPUTextureUsage.COPY_DST |         // Can receive data
                GPUTextureUsage.RENDER_ATTACHMENT  // Can be rendered to (optional)
        });

        // Copy the image data to the GPU texture
        // This uses the browser's built-in image decoding
        this.device.queue.copyExternalImageToTexture(
            { source: textureImage },                    // Source image
            { texture },                                 // Destination texture
            [textureImage.width, textureImage.height]    // Size to copy
        );

        // ====================================================================
        // Bind Group Creation
        // ====================================================================
        // Create bind group that bundles all resources together for the shader

        const uniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0), // Get layout from pipeline
            entries: [
                {
                    binding: 0,                              // Uniform buffer (MVP matrix)
                    resource: { buffer: uniformBuffer }
                },
                {
                    binding: 1,                              // Texture sampler
                    resource: this.sampler
                },
                {
                    binding: 2,                              // Texture view
                    resource: texture.createView()             // Create view from texture
                }
            ]
        });

        return {
            vertexBuffer,
            vertexCount,
            wireVertexBuffer,
            wireVertexCount,
            uniformBuffer,
            texture,
            bindGroup,
        };
    }

    public destroyMesh(mesh: GpuMesh) {
        mesh.vertexBuffer.destroy();
        mesh.wireVertexBuffer.destroy();
        mesh.uniformBuffer.destroy();
        mesh.texture.destroy();
    }

    public dispose() {
        this.depthTexture?.destroy();
        this.depthTexture = null;
        this.depthTextureWidth = 0;
        this.depthTextureHeight = 0;
        this.device?.destroy();
        this.device = null;
        this.context = null;
    }

    public setRenderMode(mode: RenderMode) {
        this.renderMode = mode;
    }

    // ========================================================================
    // Frame Rendering
    // ========================================================================

    /**
     * Render a single frame.
     * 
     * @param items - Mesh resources paired with their transforms
     */
    public render(items: RenderItem[]) {
        // Guard: all required resources must be ready
        if (!this.device || !this.context || !this.pipeline || items.length === 0) return;

        // ====================================================================
        // Update Uniform Buffer (MVP Matrix)
        // ====================================================================

        for (const item of items) {
            // WGSL matrices are stored column-major, while Mat4.m is indexed [row][column].
            const matrixData = new Float32Array(16);
            for (let row = 0; row < 4; row++) {
                for (let column = 0; column < 4; column++) {
                    matrixData[column * 4 + row] = item.mvpMatrix.m[row][column];
                }
            }
            this.device.queue.writeBuffer(item.mesh.uniformBuffer, 0, matrixData);
        }

        // ====================================================================
        // Command Encoder
        // ====================================================================
        // Commands are recorded to an encoder, then submitted as a batch

        const commandEncoder = this.device.createCommandEncoder();

        // ====================================================================
        // Depth Texture
        // ====================================================================
        const depthTexture = this.getDepthTexture();

        // ====================================================================
        // Render Pass Configuration
        // ====================================================================

        // Get the current swap chain texture to render to
        const textureView = this.context.getCurrentTexture().createView();

        // Configure the render pass
        const renderPassDescriptor: GPURenderPassDescriptor = {
            // Color attachment: the texture we render colors to
            colorAttachments: [
                {
                    view: textureView,                        // Target texture
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Clear to black
                    loadOp: 'clear',                          // Clear before rendering
                    storeOp: 'store',                         // Keep results after rendering
                }
            ],
            // Depth attachment: the depth buffer for depth testing
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,    // Clear to far plane (1.0 = farthest)
                depthLoadOp: 'clear',    // Clear depth buffer before rendering
                depthStoreOp: 'store',   // Keep depth results
            }
        };

        // ====================================================================
        // Render Pass Execution
        // ====================================================================

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        const activePipeline = this.renderMode === 'wireframe'
            ? this.wirePipeline
            : this.renderMode === 'filled'
                ? this.filledPipeline
                : this.pipeline;
        if (!activePipeline) {
            passEncoder.end();
            return;
        }

        passEncoder.setPipeline(activePipeline);
        for (const item of items) {
            const vertexBuffer = this.renderMode === 'wireframe'
                ? item.mesh.wireVertexBuffer
                : item.mesh.vertexBuffer;
            const vertexCount = this.renderMode === 'wireframe'
                ? item.mesh.wireVertexCount
                : item.mesh.vertexCount;

            passEncoder.setBindGroup(0, item.mesh.bindGroup);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.draw(vertexCount);
        }

        passEncoder.end(); // End the render pass

        // ====================================================================
        // Submit Commands
        // ====================================================================
        // Finalize and submit the command buffer to the GPU queue

        this.device.queue.submit([commandEncoder.finish()]);
    }

    private getDepthTexture(): GPUTexture {
        if (!this.device) throw new Error('Cannot create a depth texture without a GPU device.');
        const width = Math.max(1, this.canvas.width);
        const height = Math.max(1, this.canvas.height);
        if (this.depthTexture && this.depthTextureWidth === width && this.depthTextureHeight === height) {
            return this.depthTexture;
        }

        this.depthTexture?.destroy();
        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.depthTextureWidth = width;
        this.depthTextureHeight = height;
        return this.depthTexture;
    }
}
