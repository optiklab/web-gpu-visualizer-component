export class Vec2 {
    constructor(public x: number, public y: number) { }

    static add(a: Vec2, b: Vec2): Vec2 {
        return new Vec2(a.x + b.x, a.y + b.y);
    }

    static sub(a: Vec2, b: Vec2): Vec2 {
        return new Vec2(a.x - b.x, a.y - b.y);
    }

    static mul(v: Vec2, factor: number): Vec2 {
        return new Vec2(v.x * factor, v.y * factor);
    }

    static div(v: Vec2, factor: number): Vec2 {
        return new Vec2(v.x / factor, v.y / factor);
    }

    static length(v: Vec2): number {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static fromVec4(v: Vec4): Vec2 {
        return new Vec2(v.x, v.y);
    }
}

export class Vec3 {
    constructor(public x: number, public y: number, public z: number) { }

    clone(): Vec3 {
        return new Vec3(this.x, this.y, this.z);
    }

    static add(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    static sub(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static mul(v: Vec3, factor: number): Vec3 {
        return new Vec3(v.x * factor, v.y * factor, v.z * factor);
    }

    static div(v: Vec3, factor: number): Vec3 {
        return new Vec3(v.x / factor, v.y / factor, v.z / factor);
    }

    static cross(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    static dot(a: Vec3, b: Vec3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static length(v: Vec3): number {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    static normalize(v: Vec3): void {
        const len = Vec3.length(v);
        if (len > 0) {
            v.x /= len;
            v.y /= len;
            v.z /= len;
        }
    }

    static rotateX(v: Vec3, angle: number): Vec3 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec3(
            v.x,
            v.y * c - v.z * s,
            v.y * s + v.z * c
        );
    }

    static rotateY(v: Vec3, angle: number): Vec3 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec3(
            v.x * c - v.z * s,
            v.y,
            v.x * s + v.z * c
        );
    }

    static rotateZ(v: Vec3, angle: number): Vec3 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec3(
            v.x * c - v.y * s,
            v.x * s + v.y * c,
            v.z
        );
    }

    static fromVec4(v: Vec4): Vec3 {
        return new Vec3(v.x, v.y, v.z);
    }
}

export class Vec4 {
    constructor(public x: number, public y: number, public z: number, public w: number) { }

    static fromVec3(v: Vec3): Vec4 {
        return new Vec4(v.x, v.y, v.z, 1.0);
    }
}
