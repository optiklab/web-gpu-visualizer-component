// ============================================================================
// Triangle.ts - Rasterization Algorithms
// ============================================================================
// TypeScript port of Triangle.cpp from the C++ software rasterizer.
// Each TypeScript line is annotated with the corresponding C++ code.
// ============================================================================

import { Vec3, Vec4, Vec2 } from '../../core/math/Vector'; // C++: #include "Vector.h"
import { Texture } from '../../core/Texture';               // C++: #include "Texture.h"
import { Display } from './Display';               // C++: #include "Display.h"

export class Triangle {
    // C++: vec4_t points[3];
    public points: Vec4[] = [];
    // C++: tex2_t texcoords[3];
    public texcoords: Vec2[] = [];
    // C++: uint32_t color;
    public color: number = 0;
    // C++: lodepng_texture_t* texture;
    public texture: Texture | null = null;

    constructor() { }
}

// ============================================================================
// Rasterizer Class - Contains all triangle drawing functions
// ============================================================================
export class Rasterizer {

    // ========================================================================
    // C++: void draw_triangle(int x0, int y0, int x1, int y1, int x2, int y2, uint32_t color)
    // C++: {
    // C++:     draw_line(x0, y0, x1, y1, color);
    // C++:     draw_line(x1, y1, x2, y2, color);
    // C++:     draw_line(x2, y2, x0, y0, color);
    // C++: }
    // ========================================================================
    static drawTriangle(display: Display, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: number) {
        // C++: draw_line(x0, y0, x1, y1, color);
        display.drawLine(x0, y0, x1, y1, color);
        // C++: draw_line(x1, y1, x2, y2, color);
        display.drawLine(x1, y1, x2, y2, color);
        // C++: draw_line(x2, y2, x0, y0, color);
        display.drawLine(x2, y2, x0, y0, color);
    }

    // ========================================================================
    // C++: vec3_t barycentric_weights(vec2_t a, vec2_t b, vec2_t c, vec2_t p)
    // C++: {
    // C++:     vec2_t ab = vec2_sub(b, a);
    // C++:     vec2_t bc = vec2_sub(c, b);
    // C++:     vec2_t ac = vec2_sub(c, a);
    // C++:     vec2_t ap = vec2_sub(p, a);
    // C++:     vec2_t bp = vec2_sub(p, b);
    // C++:     float area_triangle_abc = (ab.x * ac.y - ab.y * ac.x);
    // C++:     float alpha = (bc.x * bp.y - bp.x * bc.y) / area_triangle_abc;
    // C++:     float beta = (ap.x * ac.y - ac.x * ap.y) / area_triangle_abc;
    // C++:     float gamma = 1 - alpha - beta;
    // C++:     vec3_t weights = { alpha, beta, gamma };
    // C++:     return weights;
    // C++: }
    // ========================================================================
    static barycentricWeights(a: Vec2, b: Vec2, c: Vec2, p: Vec2): Vec3 {
        // C++: vec2_t ab = vec2_sub(b, a);
        const ab = Vec2.sub(b, a);
        // C++: vec2_t bc = vec2_sub(c, b);
        const bc = Vec2.sub(c, b);
        // C++: vec2_t ac = vec2_sub(c, a);
        const ac = Vec2.sub(c, a);
        // C++: vec2_t ap = vec2_sub(p, a);
        const ap = Vec2.sub(p, a);
        // C++: vec2_t bp = vec2_sub(p, b);
        const bp = Vec2.sub(p, b);

        // C++: float area_triangle_abc = (ab.x * ac.y - ab.y * ac.x);
        const areaTriangleAbc = (ab.x * ac.y - ab.y * ac.x);

        // Check for degenerate triangle
        if (Math.abs(areaTriangleAbc) < 0.0001) {
            return new Vec3(0, 0, 0);
        }

        // C++: float alpha = (bc.x * bp.y - bp.x * bc.y) / area_triangle_abc;
        const alpha = (bc.x * bp.y - bp.x * bc.y) / areaTriangleAbc;
        // C++: float beta = (ap.x * ac.y - ac.x * ap.y) / area_triangle_abc;
        const beta = (ap.x * ac.y - ac.x * ap.y) / areaTriangleAbc;
        // C++: float gamma = 1 - alpha - beta;
        const gamma = 1 - alpha - beta;

        // C++: vec3_t weights = { alpha, beta, gamma }; return weights;
        return new Vec3(alpha, beta, gamma);
    }

    // ========================================================================
    // C++: void draw_triangle_pixel(int x, int y, uint32_t color, vec4_t point_a, vec4_t point_b, vec4_t point_c)
    // C++: {
    // C++:     vec2_t p = { x, y };
    // C++:     vec2_t a = vec2_from_vec4(point_a);
    // C++:     vec2_t b = vec2_from_vec4(point_b);
    // C++:     vec2_t c = vec2_from_vec4(point_c);
    // C++:     vec3_t weights = barycentric_weights(a, b, c, p);
    // C++:     float alpha = weights.x; float beta = weights.y; float gamma = weights.z;
    // C++:     float interpolated_reciprocal_w = (1/point_a.w)*alpha + (1/point_b.w)*beta + (1/point_c.w)*gamma;
    // C++:     interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;
    // C++:     if (interpolated_reciprocal_w < get_zbuffer_at(x, y)) {
    // C++:         draw_pixel(x, y, color);
    // C++:         update_zbuffer_at(x, y, interpolated_reciprocal_w);
    // C++:     }
    // C++: }
    // ========================================================================
    static drawTrianglePixel(display: Display, x: number, y: number, color: number, pointA: Vec4, pointB: Vec4, pointC: Vec4) {
        // C++: vec2_t p = { x, y };
        const p = new Vec2(x, y);
        // C++: vec2_t a = vec2_from_vec4(point_a);
        const a = Vec2.fromVec4(pointA);
        // C++: vec2_t b = vec2_from_vec4(point_b);
        const b = Vec2.fromVec4(pointB);
        // C++: vec2_t c = vec2_from_vec4(point_c);
        const c = Vec2.fromVec4(pointC);

        // C++: vec3_t weights = barycentric_weights(a, b, c, p);
        const weights = Rasterizer.barycentricWeights(a, b, c, p);
        // C++: float alpha = weights.x;
        const alpha = weights.x;
        // C++: float beta = weights.y;
        const beta = weights.y;
        // C++: float gamma = weights.z;
        const gamma = weights.z;

        // C++: float interpolated_reciprocal_w = (1/point_a.w)*alpha + (1/point_b.w)*beta + (1/point_c.w)*gamma;
        let interpolatedReciprocalW = (1 / pointA.w) * alpha + (1 / pointB.w) * beta + (1 / pointC.w) * gamma;

        // C++: interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;
        interpolatedReciprocalW = 1.0 - interpolatedReciprocalW;

        // C++: if (interpolated_reciprocal_w < get_zbuffer_at(x, y))
        if (interpolatedReciprocalW < display.getZBufferAt(x, y)) {
            // C++: draw_pixel(x, y, color);
            display.drawPixel(x, y, color);
            // C++: update_zbuffer_at(x, y, interpolated_reciprocal_w);
            display.updateZBufferAt(x, y, interpolatedReciprocalW);
        }
    }

    // ========================================================================
    // C++: void draw_triangle_texel(int x, int y, lodepng_texture_t* texture,
    // C++:     vec4_t point_a, vec4_t point_b, vec4_t point_c,
    // C++:     tex2_t a_uv, tex2_t b_uv, tex2_t c_uv)
    // C++: {
    // C++:     vec2_t p = { x, y };
    // C++:     vec2_t a = vec2_from_vec4(point_a);
    // C++:     vec2_t b = vec2_from_vec4(point_b);
    // C++:     vec2_t c = vec2_from_vec4(point_c);
    // C++:     vec3_t weights = barycentric_weights(a, b, c, p);
    // C++:     float alpha = weights.x; float beta = weights.y; float gamma = weights.z;
    // C++:     float interpolated_u = (a_uv.u/point_a.w)*alpha + (b_uv.u/point_b.w)*beta + (c_uv.u/point_c.w)*gamma;
    // C++:     float interpolated_v = (a_uv.v/point_a.w)*alpha + (b_uv.v/point_b.w)*beta + (c_uv.v/point_c.w)*gamma;
    // C++:     float interpolated_reciprocal_w = (1/point_a.w)*alpha + (1/point_b.w)*beta + (1/point_c.w)*gamma;
    // C++:     interpolated_u /= interpolated_reciprocal_w;
    // C++:     interpolated_v /= interpolated_reciprocal_w;
    // C++:     int tex_x = abs((int)(interpolated_u * texture->width)) % texture->width;
    // C++:     int tex_y = abs((int)(interpolated_v * texture->height)) % texture->height;
    // C++:     interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;
    // C++:     if (interpolated_reciprocal_w < get_zbuffer_at(x, y)) {
    // C++:         draw_pixel(x, y, texture->png_texture[(texture->width * tex_y) + tex_x]);
    // C++:         update_zbuffer_at(x, y, interpolated_reciprocal_w);
    // C++:     }
    // C++: }
    // ========================================================================
    static drawTriangleTexel(display: Display, x: number, y: number, texture: Texture,
        pointA: Vec4, pointB: Vec4, pointC: Vec4,
        uA: number, vA: number, uB: number, vB: number, uC: number, vC: number) {

        // C++: vec2_t p = { x, y };
        const p = new Vec2(x, y);
        // C++: vec2_t a = vec2_from_vec4(point_a);
        const a = Vec2.fromVec4(pointA);
        // C++: vec2_t b = vec2_from_vec4(point_b);
        const b = Vec2.fromVec4(pointB);
        // C++: vec2_t c = vec2_from_vec4(point_c);
        const c = Vec2.fromVec4(pointC);

        // C++: vec3_t weights = barycentric_weights(a, b, c, p);
        const weights = Rasterizer.barycentricWeights(a, b, c, p);
        // C++: float alpha = weights.x;
        const alpha = weights.x;
        // C++: float beta = weights.y;
        const beta = weights.y;
        // C++: float gamma = weights.z;
        const gamma = weights.z;

        // Safety check for NaN weights
        if (isNaN(alpha) || isNaN(beta) || isNaN(gamma)) return;

        // C++: float interpolated_u = (a_uv.u/point_a.w)*alpha + (b_uv.u/point_b.w)*beta + (c_uv.u/point_c.w)*gamma;
        let interpolatedU = (uA / pointA.w) * alpha + (uB / pointB.w) * beta + (uC / pointC.w) * gamma;
        // C++: float interpolated_v = (a_uv.v/point_a.w)*alpha + (b_uv.v/point_b.w)*beta + (c_uv.v/point_c.w)*gamma;
        let interpolatedV = (vA / pointA.w) * alpha + (vB / pointB.w) * beta + (vC / pointC.w) * gamma;
        // C++: float interpolated_reciprocal_w = (1/point_a.w)*alpha + (1/point_b.w)*beta + (1/point_c.w)*gamma;
        let interpolatedReciprocalW = (1 / pointA.w) * alpha + (1 / pointB.w) * beta + (1 / pointC.w) * gamma;

        // C++: interpolated_u /= interpolated_reciprocal_w;
        interpolatedU /= interpolatedReciprocalW;
        // C++: interpolated_v /= interpolated_reciprocal_w;
        interpolatedV /= interpolatedReciprocalW;

        if (!texture || !texture.data) return;

        // C++: int tex_x = abs((int)(interpolated_u * texture->width)) % texture->width;
        const texWidth = texture.width;
        const texHeight = texture.height;
        const mod = (n: number, m: number) => ((n % m) + m) % m; // positive modulo
        const texX = mod(Math.floor(interpolatedU * texWidth), texWidth);
        // C++: int tex_y = abs((int)(interpolated_v * texture->height)) % texture->height;
        const texY = mod(Math.floor(interpolatedV * texHeight), texHeight);

        if (isNaN(texX) || isNaN(texY)) return;

        // C++: interpolated_reciprocal_w = 1.0 - interpolated_reciprocal_w;
        interpolatedReciprocalW = 1.0 - interpolatedReciprocalW;

        // C++: if (interpolated_reciprocal_w < get_zbuffer_at(x, y))
        if (interpolatedReciprocalW < display.getZBufferAt(x, y)) {
            // C++: draw_pixel(x, y, texture->png_texture[(texture->width * tex_y) + tex_x]);
            let color = 0xFFFF00FF; // Fallback magenta
            const index = texY * texWidth + texX;
            if (index >= 0 && index < texture.data.length) {
                color = texture.data[index];
            }
            display.drawPixel(x, y, color);
            // C++: update_zbuffer_at(x, y, interpolated_reciprocal_w);
            display.updateZBufferAt(x, y, interpolatedReciprocalW);
        }
    }

    // ========================================================================
    // C++: void draw_filled_triangle(
    // C++:     int x0, int y0, float z0, float w0,
    // C++:     int x1, int y1, float z1, float w1,
    // C++:     int x2, int y2, float z2, float w2,
    // C++:     uint32_t color)
    // C++: {
    // C++:     // Sort vertices by y-coordinate (y0 < y1 < y2)
    // C++:     if (y0 > y1) { int_swap(&y0,&y1); int_swap(&x0,&x1); float_swap(&z0,&z1); float_swap(&w0,&w1); }
    // C++:     if (y1 > y2) { int_swap(&y1,&y2); int_swap(&x1,&x2); float_swap(&z1,&z2); float_swap(&w1,&w2); }
    // C++:     if (y0 > y1) { int_swap(&y0,&y1); int_swap(&x0,&x1); float_swap(&z0,&z1); float_swap(&w0,&w1); }
    // C++:     vec4_t point_a = { x0, y0, z0, w0 };
    // C++:     vec4_t point_b = { x1, y1, z1, w1 };
    // C++:     vec4_t point_c = { x2, y2, z2, w2 };
    // C++:     // Render flat-bottom (upper) part
    // C++:     float inv_slope_1 = 0; float inv_slope_2 = 0;
    // C++:     if (y1 - y0 != 0) inv_slope_1 = (float)(x1 - x0) / abs(y1 - y0);
    // C++:     if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);
    // C++:     if (y1 - y0 != 0) { for (int y = y0; y <= y1; y++) { ... draw_triangle_pixel(...) } }
    // C++:     // Render flat-top (lower) part
    // C++:     inv_slope_1 = 0; inv_slope_2 = 0;
    // C++:     if (y2 - y1 != 0) inv_slope_1 = (float)(x2 - x1) / abs(y2 - y1);
    // C++:     if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);
    // C++:     if (y2 - y1 != 0) { for (int y = y1; y <= y2; y++) { ... draw_triangle_pixel(...) } }
    // C++: }
    // ========================================================================
    static drawFilledTriangle(display: Display,
        x0: number, y0: number, z0: number, w0: number,
        x1: number, y1: number, z1: number, w1: number,
        x2: number, y2: number, z2: number, w2: number,
        color: number) {

        // C++ receives screen coordinates as int parameters.
        x0 = Math.trunc(x0); y0 = Math.trunc(y0);
        x1 = Math.trunc(x1); y1 = Math.trunc(y1);
        x2 = Math.trunc(x2); y2 = Math.trunc(y2);

        // C++: if (y0 > y1) { int_swap(&y0, &y1); int_swap(&x0, &x1); float_swap(&z0, &z1); float_swap(&w0, &w1); }
        if (y0 > y1) {
            [y0, y1] = [y1, y0];[x0, x1] = [x1, x0];[z0, z1] = [z1, z0];[w0, w1] = [w1, w0];
        }
        // C++: if (y1 > y2) { int_swap(&y1, &y2); int_swap(&x1, &x2); float_swap(&z1, &z2); float_swap(&w1, &w2); }
        if (y1 > y2) {
            [y1, y2] = [y2, y1];[x1, x2] = [x2, x1];[z1, z2] = [z2, z1];[w1, w2] = [w2, w1];
        }
        // C++: if (y0 > y1) { ... } // check again
        if (y0 > y1) {
            [y0, y1] = [y1, y0];[x0, x1] = [x1, x0];[z0, z1] = [z1, z0];[w0, w1] = [w1, w0];
        }

        // C++: vec4_t point_a = { x0, y0, z0, w0 };
        const pointA = new Vec4(x0, y0, z0, w0);
        // C++: vec4_t point_b = { x1, y1, z1, w1 };
        const pointB = new Vec4(x1, y1, z1, w1);
        // C++: vec4_t point_c = { x2, y2, z2, w2 };
        const pointC = new Vec4(x2, y2, z2, w2);

        // C++: float inv_slope_1 = 0; float inv_slope_2 = 0;
        let invSlope1 = 0;
        let invSlope2 = 0;

        // C++: if (y1 - y0 != 0) inv_slope_1 = (float)(x1 - x0) / abs(y1 - y0);
        if (y1 - y0 !== 0) invSlope1 = (x1 - x0) / Math.abs(y1 - y0);
        // C++: if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);
        if (y2 - y0 !== 0) invSlope2 = (x2 - x0) / Math.abs(y2 - y0);

        // C++: if (y1 - y0 != 0) { for (int y = y0; y <= y1; y++) { ... } }
        if (y1 - y0 !== 0) {
            // C++: for (int y = y0; y <= y1; y++)
            for (let y = y0; y <= y1; y++) {
                // C++: int x_start = x1 + (y - y1) * inv_slope_1;
                let xStart = x1 + (y - y1) * invSlope1;
                // C++: int x_end = x0 + (y - y0) * inv_slope_2;
                let xEnd = x0 + (y - y0) * invSlope2;

                // C++: if (x_end < x_start) { int_swap(&x_start, &x_end); }
                if (xEnd < xStart) [xStart, xEnd] = [xEnd, xStart];

                // C++: for (int x = x_start; x < x_end; x++)
                for (let x = Math.floor(xStart); x < Math.floor(xEnd); x++) {
                    // C++: draw_triangle_pixel(x, y, color, point_a, point_b, point_c);
                    Rasterizer.drawTrianglePixel(display, x, y, color, pointA, pointB, pointC);
                }
            }
        }

        // C++: inv_slope_1 = 0; inv_slope_2 = 0;
        invSlope1 = 0;
        invSlope2 = 0;

        // C++: if (y2 - y1 != 0) inv_slope_1 = (float)(x2 - x1) / abs(y2 - y1);
        if (y2 - y1 !== 0) invSlope1 = (x2 - x1) / Math.abs(y2 - y1);
        // C++: if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);
        if (y2 - y0 !== 0) invSlope2 = (x2 - x0) / Math.abs(y2 - y0);

        // C++: if (y2 - y1 != 0) { for (int y = y1; y <= y2; y++) { ... } }
        if (y2 - y1 !== 0) {
            // C++: for (int y = y1; y <= y2; y++)
            for (let y = y1; y <= y2; y++) {
                // C++: int x_start = x1 + (y - y1) * inv_slope_1;
                let xStart = x1 + (y - y1) * invSlope1;
                // C++: int x_end = x0 + (y - y0) * inv_slope_2;
                let xEnd = x0 + (y - y0) * invSlope2;

                // C++: if (x_end < x_start) { int_swap(&x_start, &x_end); }
                if (xEnd < xStart) [xStart, xEnd] = [xEnd, xStart];

                // C++: for (int x = x_start; x < x_end; x++)
                for (let x = Math.floor(xStart); x < Math.floor(xEnd); x++) {
                    // C++: draw_triangle_pixel(x, y, color, point_a, point_b, point_c);
                    Rasterizer.drawTrianglePixel(display, x, y, color, pointA, pointB, pointC);
                }
            }
        }
    }

    // ========================================================================
    // C++: void draw_textured_triangle(
    // C++:     int x0, int y0, float z0, float w0, float u0, float v0,
    // C++:     int x1, int y1, float z1, float w1, float u1, float v1,
    // C++:     int x2, int y2, float z2, float w2, float u2, float v2,
    // C++:     lodepng_texture_t* texture)
    // C++: {
    // C++:     // Sort by y, flip V, create point/uv vectors, then scanline fill
    // C++: }
    // ========================================================================
    static drawTexturedTriangle(display: Display,
        x0: number, y0: number, z0: number, w0: number, u0: number, v0: number,
        x1: number, y1: number, z1: number, w1: number, u1: number, v1: number,
        x2: number, y2: number, z2: number, w2: number, u2: number, v2: number,
        texture: Texture) {

        // C++ receives screen coordinates as int parameters.
        x0 = Math.trunc(x0); y0 = Math.trunc(y0);
        x1 = Math.trunc(x1); y1 = Math.trunc(y1);
        x2 = Math.trunc(x2); y2 = Math.trunc(y2);

        // C++: if (y0 > y1) { ... swap all including uvs ... }
        if (y0 > y1) {
            [y0, y1] = [y1, y0];[x0, x1] = [x1, x0];[z0, z1] = [z1, z0];[w0, w1] = [w1, w0];[u0, u1] = [u1, u0];[v0, v1] = [v1, v0];
        }
        // C++: if (y1 > y2) { ... }
        if (y1 > y2) {
            [y1, y2] = [y2, y1];[x1, x2] = [x2, x1];[z1, z2] = [z2, z1];[w1, w2] = [w2, w1];[u1, u2] = [u2, u1];[v1, v2] = [v2, v1];
        }
        // C++: if (y0 > y1) { ... }
        if (y0 > y1) {
            [y0, y1] = [y1, y0];[x0, x1] = [x1, x0];[z0, z1] = [z1, z0];[w0, w1] = [w1, w0];[u0, u1] = [u1, u0];[v0, v1] = [v1, v0];
        }

        // C++: v0 = 1.0 - v0; v1 = 1.0 - v1; v2 = 1.0 - v2;
        v0 = 1.0 - v0;
        v1 = 1.0 - v1;
        v2 = 1.0 - v2;

        // C++: vec4_t point_a = { x0, y0, z0, w0 };
        const pointA = new Vec4(x0, y0, z0, w0);
        // C++: vec4_t point_b = { x1, y1, z1, w1 };
        const pointB = new Vec4(x1, y1, z1, w1);
        // C++: vec4_t point_c = { x2, y2, z2, w2 };
        const pointC = new Vec4(x2, y2, z2, w2);

        // C++: float inv_slope_1 = 0; float inv_slope_2 = 0;
        let invSlope1 = 0;
        let invSlope2 = 0;

        // C++: if (y1 - y0 != 0) inv_slope_1 = (float)(x1 - x0) / abs(y1 - y0);
        if (y1 - y0 !== 0) invSlope1 = (x1 - x0) / Math.abs(y1 - y0);
        // C++: if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / abs(y2 - y0);
        if (y2 - y0 !== 0) invSlope2 = (x2 - x0) / Math.abs(y2 - y0);

        // C++: if (y1 - y0 != 0) { for (int y = y0; y <= y1; y++) { ... } }
        if (y1 - y0 !== 0) {
            for (let y = y0; y <= y1; y++) {
                // C++: int x_start = x1 + (y - y1) * inv_slope_1;
                let xStart = x1 + (y - y1) * invSlope1;
                // C++: int x_end = x0 + (y - y0) * inv_slope_2;
                let xEnd = x0 + (y - y0) * invSlope2;

                // C++: if (x_end < x_start) { int_swap(&x_start, &x_end); }
                if (xEnd < xStart) [xStart, xEnd] = [xEnd, xStart];

                // C++: for (int x = x_start; x < x_end; x++)
                for (let x = Math.floor(xStart); x < Math.floor(xEnd); x++) {
                    // C++: draw_triangle_texel(x, y, texture, point_a, point_b, point_c, a_uv, b_uv, c_uv);
                    Rasterizer.drawTriangleTexel(display, x, y, texture, pointA, pointB, pointC, u0, v0, u1, v1, u2, v2);
                }
            }
        }

        // C++: inv_slope_1 = 0; inv_slope_2 = 0;
        invSlope1 = 0;
        invSlope2 = 0;

        // C++: if (y2 - y1 != 0) inv_slope_1 = (float)(x2 - x1) / (float)abs(y2 - y1);
        if (y2 - y1 !== 0) invSlope1 = (x2 - x1) / Math.abs(y2 - y1);
        // C++: if (y2 - y0 != 0) inv_slope_2 = (float)(x2 - x0) / (float)abs(y2 - y0);
        if (y2 - y0 !== 0) invSlope2 = (x2 - x0) / Math.abs(y2 - y0);

        // C++: if (y2 - y1 != 0) { for (int y = y1; y <= y2; y++) { ... } }
        if (y2 - y1 !== 0) {
            for (let y = y1; y <= y2; y++) {
                // C++: int x_start = x1 + (y - y1) * inv_slope_1;
                let xStart = x1 + (y - y1) * invSlope1;
                // C++: int x_end = x0 + (y - y0) * inv_slope_2;
                let xEnd = x0 + (y - y0) * invSlope2;

                // C++: if (x_end < x_start) { int_swap(&x_start, &x_end); }
                if (xEnd < xStart) [xStart, xEnd] = [xEnd, xStart];

                // C++: for (int x = x_start; x < x_end; x++)
                for (let x = Math.floor(xStart); x < Math.floor(xEnd); x++) {
                    // C++: draw_triangle_texel(x, y, texture, point_a, point_b, point_c, a_uv, b_uv, c_uv);
                    Rasterizer.drawTriangleTexel(display, x, y, texture, pointA, pointB, pointC, u0, v0, u1, v1, u2, v2);
                }
            }
        }
    }
}
