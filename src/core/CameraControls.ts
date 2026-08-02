import { Camera } from './Camera';
import { Vec3 } from './math/Vector';

export class CameraControls {
    private pointerId: number | null = null;
    private isPanning = false;
    private readonly initialPosition: Vec3;
    private readonly canvas: HTMLCanvasElement;
    private readonly camera: Camera;
    private readonly abortController = new AbortController();

    constructor(canvas: HTMLCanvasElement, camera: Camera) {
        this.canvas = canvas;
        this.camera = camera;
        this.initialPosition = new Vec3(camera.position.x, camera.position.y, camera.position.z);
        this.bindEvents();
    }

    private bindEvents() {
        const options = { signal: this.abortController.signal };
        this.canvas.addEventListener('pointerdown', (event) => {
            if (event.button > 2) return;
            this.pointerId = event.pointerId;
            this.isPanning = event.button !== 0 || event.shiftKey;
            this.canvas.setPointerCapture(event.pointerId);
            this.canvas.classList.add('wgv-is-dragging');
            event.preventDefault();
        }, options);

        this.canvas.addEventListener('pointermove', (event) => {
            if (event.pointerId !== this.pointerId) return;

            if (this.isPanning) {
                this.pan(event.movementX, event.movementY);
            } else {
                const sensitivity = 0.005;
                this.camera.rotateYaw(-event.movementX * sensitivity);
                this.camera.rotatePitch(-event.movementY * sensitivity);
            }
        }, options);

        const stopDragging = (event: PointerEvent) => {
            if (event.pointerId !== this.pointerId) return;
            this.pointerId = null;
            this.canvas.classList.remove('wgv-is-dragging');
        };

        this.canvas.addEventListener('pointerup', stopDragging, options);
        this.canvas.addEventListener('pointercancel', stopDragging, options);
        this.canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.camera.getLookAtTarget();
            const distance = -Math.max(-100, Math.min(100, event.deltaY)) * 0.01;
            this.camera.updatePosition(Vec3.add(
                this.camera.position,
                Vec3.mul(this.camera.direction, distance),
            ));
        }, { passive: false, signal: this.abortController.signal });

        this.canvas.addEventListener('dblclick', () => this.reset(), options);
    }

    private pan(deltaX: number, deltaY: number) {
        const scale = 0.005;
        const right = new Vec3(Math.cos(this.camera.yaw), 0, -Math.sin(this.camera.yaw));
        const horizontal = Vec3.mul(right, -deltaX * scale);
        const vertical = new Vec3(0, deltaY * scale, 0);
        this.camera.updatePosition(Vec3.add(this.camera.position, Vec3.add(horizontal, vertical)));
    }

    private reset() {
        this.camera.yaw = 0;
        this.camera.pitch = 0;
        this.camera.direction = new Vec3(0, 0, 1);
        this.camera.updatePosition(new Vec3(
            this.initialPosition.x,
            this.initialPosition.y,
            this.initialPosition.z,
        ));
    }

    public dispose() {
        this.abortController.abort();
        this.canvas.classList.remove('wgv-is-dragging');
    }
}