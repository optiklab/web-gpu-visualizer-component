import { Vec2, Vec3 } from './math/Vector'; // Import 2D and 3D vector classes
import { Texture } from './Texture'; // Import Texturing logic

// Interface defining the structure of a single triangle face
export interface Face {
    a: number; // Index of the first vertex (0-based)
    b: number; // Index of the second vertex (0-based)
    c: number; // Index of the third vertex (0-based)

    a_uv: Vec2; // Texture coordinate for the first vertex
    b_uv: Vec2; // Texture coordinate for the second vertex
    c_uv: Vec2; // Texture coordinate for the third vertex // Fixed typo: c_uv

    color: number; // 32-bit integer color of the face (ARGB)
}

// Class representing a 3D model (mesh)
export class Mesh {
    public vertices: Vec3[] = []; // List of all unique vertices in object space
    public faces: Face[] = []; // List of all triangle faces connecting those vertices
    public texture: Texture | null = null; // Associated texture, if any

    // Transformation properties for this specific mesh instance
    public scale: Vec3 = new Vec3(1, 1, 1); // Scale vector (default: 1,1,1 no scaling)
    public translation: Vec3 = new Vec3(0, 0, 0); // Position vector (default: 0,0,0)
    public rotation: Vec3 = new Vec3(0, 0, 0); // Rotation vector (Euler angles in radians)

    constructor() { } // Empty constructor

    // Helper method to fetch an OBJ file from a URL and parse it
    async loadObjFromUrl(objUrl: string): Promise<void> {
        const response = await fetch(objUrl); // Fetch the file
        if (!response.ok) {
            throw new Error(`Failed to load OBJ (${response.status}): ${objUrl}`);
        }
        const text = await response.text(); // Get content as text
        this.parseObj(text); // Parse the content
    }

    // Parser for Wavefront .obj file format
    parseObj(text: string) {
        this.vertices = [];
        this.faces = [];
        const textureCoordinates: Vec2[] = [];

        const resolveIndex = (value: string, count: number, label: string): number => {
            const parsed = Number.parseInt(value, 10);
            const resolved = parsed < 0 ? count + parsed + 1 : parsed;
            if (!Number.isInteger(parsed) || resolved < 1 || resolved > count) {
                throw new Error(`Invalid OBJ ${label} index: ${value}`);
            }
            return resolved;
        };

        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(/\s+/);

            if (parts[0] === 'v') {
                const coordinates = parts.slice(1, 4).map(Number);
                if (coordinates.length !== 3 || coordinates.some(value => !Number.isFinite(value))) {
                    throw new Error(`Invalid OBJ vertex: ${line}`);
                }
                this.vertices.push(new Vec3(coordinates[0], coordinates[1], coordinates[2]));
            } else if (parts[0] === 'vt') {
                const coordinates = parts.slice(1, 3).map(Number);
                if (coordinates.length !== 2 || coordinates.some(value => !Number.isFinite(value))) {
                    throw new Error(`Invalid OBJ texture coordinate: ${line}`);
                }
                textureCoordinates.push(new Vec2(coordinates[0], coordinates[1]));
            } else if (parts[0] === 'f') {
                if (parts.length < 4) throw new Error(`OBJ face requires at least three vertices: ${line}`);
                const references = parts.slice(1).map(segment => {
                    const [vertexIndex, textureIndex] = segment.split('/');
                    return {
                        vertex: resolveIndex(vertexIndex, this.vertices.length, 'vertex'),
                        texture: textureIndex
                            ? textureCoordinates[resolveIndex(textureIndex, textureCoordinates.length, 'texture') - 1]
                            : new Vec2(0, 0),
                    };
                });

                for (let index = 1; index < references.length - 1; index++) {
                    const [a, b, c] = [references[0], references[index], references[index + 1]];
                    this.faces.push({
                        a: a.vertex,
                        b: b.vertex,
                        c: c.vertex,
                        a_uv: a.texture,
                        b_uv: b.texture,
                        c_uv: c.texture,
                        color: 0xFFFFFFFF,
                    });
                }
            }
        }
    }
}
