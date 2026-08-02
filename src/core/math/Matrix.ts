import { Vec3, Vec4 } from './Vector';

export class Mat4 {
    // 4x4 matrix, flattened or array of arrays? 
    // C++ code used m[4][4]. We'll use a double array to match logic 1:1 for now.
    public m: number[][];

    constructor() {
        this.m = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ];
    }

    static identity(): Mat4 {
        const mat = new Mat4();
        mat.m[0][0] = 1; mat.m[0][1] = 0; mat.m[0][2] = 0; mat.m[0][3] = 0;
        mat.m[1][0] = 0; mat.m[1][1] = 1; mat.m[1][2] = 0; mat.m[1][3] = 0;
        mat.m[2][0] = 0; mat.m[2][1] = 0; mat.m[2][2] = 1; mat.m[2][3] = 0;
        mat.m[3][0] = 0; mat.m[3][1] = 0; mat.m[3][2] = 0; mat.m[3][3] = 1;
        return mat;
    }

    static makeScale(sx: number, sy: number, sz: number): Mat4 {
        const mat = Mat4.identity();
        mat.m[0][0] = sx;
        mat.m[1][1] = sy;
        mat.m[2][2] = sz;
        return mat;
    }

    static makeTranslation(tx: number, ty: number, tz: number): Mat4 {
        const mat = Mat4.identity();
        mat.m[0][3] = tx;
        mat.m[1][3] = ty;
        mat.m[2][3] = tz;
        return mat;
    }

    static makeRotationX(angle: number): Mat4 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const mat = Mat4.identity();
        mat.m[1][1] = c;
        mat.m[1][2] = -s;
        mat.m[2][1] = s;
        mat.m[2][2] = c;
        return mat;
    }

    static makeRotationY(angle: number): Mat4 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const mat = Mat4.identity();
        mat.m[0][0] = c;
        mat.m[0][2] = s;
        mat.m[2][0] = -s;
        mat.m[2][2] = c;
        return mat;
    }

    static makeRotationZ(angle: number): Mat4 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const mat = Mat4.identity();
        mat.m[0][0] = c;
        mat.m[0][1] = -s;
        mat.m[1][0] = s;
        mat.m[1][1] = c;
        return mat;
    }

    static mulMat4(a: Mat4, b: Mat4): Mat4 {
        const mat = new Mat4();
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                mat.m[i][j] = a.m[i][0] * b.m[0][j] + a.m[i][1] * b.m[1][j] + a.m[i][2] * b.m[2][j] + a.m[i][3] * b.m[3][j];
            }
        }
        return mat;
    }

    static mulVec4(m: Mat4, v: Vec4): Vec4 {
        const x = m.m[0][0] * v.x + m.m[0][1] * v.y + m.m[0][2] * v.z + m.m[0][3] * v.w;
        const y = m.m[1][0] * v.x + m.m[1][1] * v.y + m.m[1][2] * v.z + m.m[1][3] * v.w;
        const z = m.m[2][0] * v.x + m.m[2][1] * v.y + m.m[2][2] * v.z + m.m[2][3] * v.w;
        const w = m.m[3][0] * v.x + m.m[3][1] * v.y + m.m[3][2] * v.z + m.m[3][3] * v.w;
        return new Vec4(x, y, z, w);
    }

    static makePerspective(fov: number, aspect: number, znear: number, zfar: number): Mat4 {
        const mat = new Mat4(); // All zeros
        mat.m[0][0] = aspect * (1 / Math.tan(fov / 2));
        mat.m[1][1] = 1 / Math.tan(fov / 2);
        mat.m[2][2] = zfar / (zfar - znear);
        mat.m[2][3] = (-zfar * znear) / (zfar - znear);
        mat.m[3][2] = 1.0;
        return mat;
    }

    static mulVec4Project(matProj: Mat4, v: Vec4): Vec4 {
        const res = Mat4.mulVec4(matProj, v);
        if (res.w !== 0.0) {
            res.x /= res.w;
            res.y /= res.w;
            res.z /= res.w;
        }
        return res;
    }

    static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
        let z = Vec3.sub(target, eye);
        Vec3.normalize(z);
        let x = Vec3.cross(up, z);
        Vec3.normalize(x);
        let y = Vec3.cross(z, x);

        const mat = new Mat4();
        mat.m[0][0] = x.x; mat.m[0][1] = x.y; mat.m[0][2] = x.z; mat.m[0][3] = -Vec3.dot(x, eye);
        mat.m[1][0] = y.x; mat.m[1][1] = y.y; mat.m[1][2] = y.z; mat.m[1][3] = -Vec3.dot(y, eye);
        mat.m[2][0] = z.x; mat.m[2][1] = z.y; mat.m[2][2] = z.z; mat.m[2][3] = -Vec3.dot(z, eye);
        mat.m[3][0] = 0; mat.m[3][1] = 0; mat.m[3][2] = 0; mat.m[3][3] = 1;

        return mat;
    }
}
