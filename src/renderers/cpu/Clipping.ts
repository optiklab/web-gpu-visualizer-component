import { Vec3, Vec2, Vec4 } from '../../core/math/Vector';
import { Triangle } from './Triangle';

// Enumeration for the 6 planes of the View Frustum
enum FrustumPlane {
    LEFT_FRUSTUM_PLANE,
    RIGHT_FRUSTUM_PLANE,
    TOP_FRUSTUM_PLANE,
    BOTTOM_FRUSTUM_PLANE,
    NEAR_FRUSTUM_PLANE,
    FAR_FRUSTUM_PLANE,
    NUM_PLANES // Add this to track array size
}

// Interface defining a Plane geometry (Point + Normal)
interface Plane {
    point: Vec3; // A point on the plane
    normal: Vec3; // The normal vector perpendicular to the plane
}

// Class to represent a general Polygon during clipping (can have more than 3 vertices)
export class Polygon {
    public vertices: Vec3[]; // List of vertex positions
    public texcoords: Vec2[]; // List of corresponding texture coordinates
    public numVertices: number; // Number of vertices currently in the polygon

    constructor() {
        this.vertices = [];
        this.texcoords = [];
        this.numVertices = 0;
    }
}

// Static class processing View Frustum Clipping algorithm
export class Clipping {
    // Array to store the 6 defined planes of the frustum
    private static frustumPlanes: Plane[] = [];

    // Initialize the frustum planes based on Field of View and Near/Far distances
    static initFrustumPlanes(fovX: number, fovY: number, zNear: number, zFar: number) {
        const cosHalfFovX = Math.cos(fovX / 2);
        const sinHalfFovX = Math.sin(fovX / 2);
        const cosHalfFovY = Math.cos(fovY / 2);
        const sinHalfFovY = Math.sin(fovY / 2);

        this.frustumPlanes = []; // Clear array

        // Define LEFT Plane
        this.frustumPlanes[FrustumPlane.LEFT_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, 0), // Origin
            normal: new Vec3(cosHalfFovX, 0, sinHalfFovX) // Pointing inward
        };

        // Define RIGHT Plane
        this.frustumPlanes[FrustumPlane.RIGHT_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, 0),
            normal: new Vec3(-cosHalfFovX, 0, sinHalfFovX)
        };

        // Define TOP Plane
        this.frustumPlanes[FrustumPlane.TOP_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, 0),
            normal: new Vec3(0, -cosHalfFovY, sinHalfFovY)
        };

        // Define BOTTOM Plane
        this.frustumPlanes[FrustumPlane.BOTTOM_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, 0),
            normal: new Vec3(0, cosHalfFovY, sinHalfFovY)
        };

        // Define NEAR Plane (Z = zNear)
        this.frustumPlanes[FrustumPlane.NEAR_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, zNear),
            normal: new Vec3(0, 0, 1) // Normal points +Z (inside)
        };

        // Define FAR Plane (Z = zFar)
        this.frustumPlanes[FrustumPlane.FAR_FRUSTUM_PLANE] = {
            point: new Vec3(0, 0, zFar),
            normal: new Vec3(0, 0, -1) // Normal points -Z (inside)
        };
    }

    // Creates a Polygon object from a set of Triangle vertices and UVs
    static polygonFromTriangle(v0: Vec3, v1: Vec3, v2: Vec3, t0: Vec2, t1: Vec2, t2: Vec2): Polygon {
        const p = new Polygon();
        p.vertices = [v0, v1, v2]; // Set vertices
        p.texcoords = [t0, t1, t2]; // Set UVs
        p.numVertices = 3; // Initially 3 vertices
        return p;
    }

    // Converts a Polygon back into a list of Triangles (Fan triangulation)
    static trianglesFromPolygon(polygon: Polygon): Triangle[] {
        const triangles: Triangle[] = [];
        // Triangulate by connecting vertex 0 to i and i+1
        for (let i = 0; i < polygon.numVertices - 2; i++) {
            const index0 = 0;
            const index1 = i + 1;
            const index2 = i + 2;

            const t = new Triangle();
            // Convert Vec3 to Vec4 for rendering pipeline compatibility
            t.points = [
                Vec4.fromVec3(polygon.vertices[index0]),
                Vec4.fromVec3(polygon.vertices[index1]),
                Vec4.fromVec3(polygon.vertices[index2])
            ];
            // Assign corresponding texture coordinates
            t.texcoords = [
                polygon.texcoords[index0],
                polygon.texcoords[index1],
                polygon.texcoords[index2]
            ];

            triangles.push(t);
        }
        return triangles;
    }

    // Helper for linear interpolation between two values
    static floatLerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }

    // Algorithm to clip a polygon against a specific plane (Sutherland-Hodgman)
    static clipPolygonAgainstPlane(polygon: Polygon, plane: number) {
        // If polygon has no vertices, stop (fully clipped already)
        if (polygon.numVertices === 0) return;

        const planePoint = this.frustumPlanes[plane].point;
        const planeNormal = this.frustumPlanes[plane].normal;

        const insideVertices: Vec3[] = []; // Vertices kept inside
        const insideTexcoords: Vec2[] = []; // Corresponding UVs kept

        // Start with the first vertex
        let currentVertex = polygon.vertices[0];
        let currentTexcoord = polygon.texcoords[0];
        // Previous vertex is the last one (loop around)
        let previousVertex = polygon.vertices[polygon.numVertices - 1];
        let previousTexcoord = polygon.texcoords[polygon.numVertices - 1];

        // Determine if previous point is "inside" the plane
        // Dot product > 0 means inside (if normals point inward)
        let currentDot = 0;
        let previousDot = Vec3.dot(Vec3.sub(previousVertex, planePoint), planeNormal);

        // Iterate over all edges of the polygon
        for (let i = 0; i < polygon.numVertices; i++) {
            currentVertex = polygon.vertices[i];
            currentTexcoord = polygon.texcoords[i];

            // Calculate signed distance of current point to plane
            currentDot = Vec3.dot(Vec3.sub(currentVertex, planePoint), planeNormal);

            // Check if edge crosses the plane (one point inside, one outside)
            if (currentDot * previousDot < 0) {
                // Calculate interpolation factor t at intersection point
                // t = prevDot / (prevDot - currDot)
                const t = previousDot / (previousDot - currentDot);

                // Calculate intersection point (I)
                const intersectionPoint = new Vec3(
                    Clipping.floatLerp(previousVertex.x, currentVertex.x, t),
                    Clipping.floatLerp(previousVertex.y, currentVertex.y, t),
                    Clipping.floatLerp(previousVertex.z, currentVertex.z, t)
                );

                // Calculate interpolated texture coordinate at I
                const interpolatedTexcoord = new Vec2(
                    Clipping.floatLerp(previousTexcoord.x, currentTexcoord.x, t),
                    Clipping.floatLerp(previousTexcoord.y, currentTexcoord.y, t)
                );

                // Add intersection point to new vertex list
                insideVertices.push(intersectionPoint);
                insideTexcoords.push(interpolatedTexcoord);
            }

            // If current point is inside the plane
            if (currentDot > 0) {
                // Keep it
                insideVertices.push(currentVertex.clone());
                insideTexcoords.push(new Vec2(currentTexcoord.x, currentTexcoord.y)); // Clone vector
            }

            // Move forward
            previousDot = currentDot;
            previousVertex = currentVertex;
            previousTexcoord = currentTexcoord;
        }

        // Update the polygon instance with the new (clipped) vertices
        polygon.vertices = insideVertices;
        polygon.texcoords = insideTexcoords;
        polygon.numVertices = insideVertices.length;
    }

    // Main clip function: Clips the polygon against all 6 frustum planes sequentially
    static clipPolygon(polygon: Polygon) {
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.LEFT_FRUSTUM_PLANE);
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.RIGHT_FRUSTUM_PLANE);
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.TOP_FRUSTUM_PLANE);
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.BOTTOM_FRUSTUM_PLANE);
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.NEAR_FRUSTUM_PLANE);
        Clipping.clipPolygonAgainstPlane(polygon, FrustumPlane.FAR_FRUSTUM_PLANE);
    }
}
