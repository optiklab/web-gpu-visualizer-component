// ============================================================================
// basic.wgsl - WebGPU Shader Language (WGSL) Shaders
// ============================================================================
// This file contains both the Vertex Shader and Fragment Shader for the
// WebGPU 3D renderer. WGSL is the official shading language for WebGPU.
//
// Pipeline Overview:
// 1. Vertex Shader (vs_main): Transforms 3D vertices to 2D screen positions
// 2. Fragment Shader (fs_main): Colors each pixel using texture sampling
// ============================================================================

// ============================================================================
// UNIFORMS STRUCTURE
// ============================================================================
// Uniforms are global values that stay constant for all vertices/fragments
// in a single draw call. They are set by the CPU (JavaScript/TypeScript).

struct Uniforms {
    // The combined Model-View-Projection matrix (4x4)
    // This single matrix transforms vertices from object space directly to clip space
    // MVP = Projection × View × Model
    modelViewProjectionMatrix: mat4x4<f32>,
};

// Bind the uniform buffer to group 0, binding 0
// This must match the bind group layout defined in Renderer.ts
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// ============================================================================
// VERTEX SHADER INPUT STRUCTURE
// ============================================================================
// Defines the per-vertex data coming from the vertex buffer.
// The @location decorators must match the vertex buffer layout in the pipeline.

struct VertexInput {
    @location(0) position: vec3<f32>,  // 3D position (x, y, z) in object space
    @location(1) uv: vec2<f32>,        // Texture coordinates (u, v)
};

// ============================================================================
// VERTEX SHADER OUTPUT / FRAGMENT SHADER INPUT STRUCTURE
// ============================================================================
// Data passed from vertex shader to fragment shader.
// The GPU automatically interpolates these values across triangles.

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,  // Required: clip-space position for rasterizer
    @location(0) uv: vec2<f32>,              // Interpolated texture coordinates
};

// ============================================================================
// VERTEX SHADER
// ============================================================================
// Entry point: vs_main
// 
// Purpose: Transform each vertex from object space to clip space.
// 
// Object Space → World Space → View Space → Clip Space
//       ↑                                        ↑
//   (original vertices)              (used by GPU rasterizer)
//
// The MVP matrix combines all three transformations into one.

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    // Create output structure
    var output: VertexOutput;
    
    // Transform the 3D position to 4D homogeneous coordinates (w=1.0)
    // Then multiply by the MVP matrix to get clip-space position
    // 
    // Clip space coordinates range from -1 to +1 on X, Y
    // Z is used for depth testing (0 to 1 after perspective division)
    output.Position = uniforms.modelViewProjectionMatrix * vec4<f32>(input.position, 1.0);
    
    // Pass through the UV coordinates unchanged
    // These will be interpolated across the triangle by the rasterizer
    output.uv = input.uv;
    
    return output;
}

// ============================================================================
// TEXTURE AND SAMPLER BINDINGS
// ============================================================================
// These bindings provide access to the texture and sampler from the bind group.
// The sampler controls how textures are filtered and wrapped.

@group(0) @binding(1) var mySampler: sampler;        // Texture sampler
@group(0) @binding(2) var myTexture: texture_2d<f32>; // 2D texture (float RGBA)

// ============================================================================
// FRAGMENT SHADER
// ============================================================================
// Entry point: fs_main
//
// Purpose: Determine the final color of each pixel (fragment).
//
// This shader runs once for every pixel covered by a triangle.
// The input UV coordinates have been interpolated from the triangle vertices.

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Sample the texture at the interpolated UV coordinates
    // 
    // textureSample() performs:
    // 1. Coordinate transformation based on sampler settings (repeat, clamp, etc.)
    // 2. Filtering based on magnification/minification settings (linear, nearest)
    // 3. Returns the RGBA color at those coordinates
    //
    // Note: UV coordinates should be in range [0, 1]
    // - U=0 is left edge, U=1 is right edge
    // - V=0 is top edge, V=1 is bottom edge (WebGPU default)
    //
    // OBJ files typically use bottom-left origin for UVs, so we flip V
    // in the TypeScript code when building the vertex buffer.
    
    return textureSample(myTexture, mySampler, uv);
    
    // Alternative: Return a solid color for debugging
    // return vec4<f32>(uv.x, uv.y, 0.5, 1.0);  // Visualize UV coordinates
}

@fragment
fn fs_filled() -> @location(0) vec4<f32> {
    return vec4<f32>(0.72, 0.76, 0.82, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4<f32> {
    return vec4<f32>(0.95, 0.97, 1.0, 1.0);
}
