import { Vec3, Vec4 } from './math/Vector'; // Import 3D and 4D Vectors
import { Mat4 } from './math/Matrix'; // Import Matrix class

export class Camera {
    public position: Vec3; // Camera's position in world space
    public direction: Vec3; // Direction vector the camera is facing
    public forwardVelocity: Vec3; // Velocity vector for forward/backward movement
    public yaw: number; // Horizontal rotation angle (Y-axis)
    public pitch: number; // Vertical rotation angle (X-axis)

    constructor(position: Vec3, direction: Vec3) {
        this.position = position;
        this.direction = direction;
        this.forwardVelocity = new Vec3(0, 0, 0); // Start stationary
        this.yaw = 0.0;
        this.pitch = 0.0;
    }

    // Adjusts horizontal rotation (Yaw)
    rotateYaw(angle: number) {
        this.yaw += angle;
        // Recalculate direction vector based on new yaw
        // Rotate around Y axis
        this.direction = Vec3.rotateY(this.direction, angle);
    }

    // Adjusts vertical rotation (Pitch)
    rotatePitch(angle: number) {
        const pitchLimit = Math.PI / 2 - 0.01;
        const nextPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch + angle));
        const appliedAngle = nextPitch - this.pitch;
        this.pitch = nextPitch;
        // Recalculate direction vector based on new pitch
        // Rotate around X axis
        this.direction = Vec3.rotateX(this.direction, appliedAngle);
    }

    // Updates camera position by adding velocity
    updatePosition(p: Vec3) {
        this.position = p;
    }

    // Updates forward velocity vector
    updateForwardVelocity(v: Vec3) {
        this.forwardVelocity = v;
    }

    // Returns the calculated target point the camera is looking at
    getLookAtTarget(): Vec3 {
        // Initialize the target looking at the positive z-axis
        let target = new Vec3(0, 0, 1);

        const cameraYawRotation = Mat4.makeRotationY(this.yaw);
        const cameraPitchRotation = Mat4.makeRotationX(this.pitch);

        // Create camera rotation matrix based on yaw and pitch
        let cameraRotation = Mat4.identity();
        cameraRotation = Mat4.mulMat4(cameraPitchRotation, cameraRotation);
        cameraRotation = Mat4.mulMat4(cameraYawRotation, cameraRotation);

        // Update camera direction based on the rotation
        const cameraDirVec4 = Mat4.mulVec4(cameraRotation, Vec4.fromVec3(target));
        this.direction = Vec3.fromVec4(cameraDirVec4);

        // Offset the camera position in the direction where the camera is pointing at
        target = Vec3.add(this.position, this.direction);

        return target;
    }
}
