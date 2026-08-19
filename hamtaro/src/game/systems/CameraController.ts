import Phaser from "phaser";
import {
  CAMERA_ZOOM_DEFAULT,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  nextZoomStep,
  quantizeZoom,
} from "../config";

export interface CameraControllerOptions {
  /** Return true to ignore pan starting from this pointer (UI chrome). */
  shouldBlockPointer?: (pointer: Phaser.Input.Pointer) => boolean;
}

/**
 * World-space camera: drag to pan, wheel / pinch to zoom (1.0–2.0).
 *
 * Phaser scrollX/Y are NOT the top-left of the visible world when zoom ≠ 1.
 * The view is centered on (scrollX + width/2, scrollY + height/2); visible size
 * is (width/zoom × height/zoom). All pan/zoom math follows that model.
 */
export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly shouldBlockPointer?: (pointer: Phaser.Input.Pointer) => boolean;

  private panPointerId: number | null = null;
  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollX = 0;
  private panStartScrollY = 0;
  private didPan = false;
  private blockedPan = false;
  private gestureConsumed = false;

  private pinching = false;
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private pinchWorldX = 0;
  private pinchWorldY = 0;

  private readonly dragThresholdPx = 8;

  constructor(scene: Phaser.Scene, options: CameraControllerOptions = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.shouldBlockPointer = options.shouldBlockPointer;

    this.camera.setZoom(CAMERA_ZOOM_DEFAULT);
    this.camera.setRoundPixels(true);
    this.camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.clampScroll();

    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
    scene.input.on("pointerupoutside", this.onPointerUp, this);
    scene.input.on("wheel", this.onWheel, this);
    scene.scale.on("resize", this.onResize, this);
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.scene.input.off("pointerupoutside", this.onPointerUp, this);
    this.scene.input.off("wheel", this.onWheel, this);
    this.scene.scale.off("resize", this.onResize, this);
  }

  /** True if the just-finished gesture was a pan or pinch (not a tap). */
  didConsumeGesture(): boolean {
    return this.gestureConsumed;
  }

  private onResize(): void {
    this.clampScroll();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const active = this.activePointers();

    if (active.length >= 2) {
      this.beginPinch(active[0], active[1]);
      return;
    }

    if (this.shouldBlockPointer?.(pointer)) {
      this.blockedPan = true;
      this.panPointerId = null;
      return;
    }

    this.blockedPan = false;
    this.didPan = false;
    this.gestureConsumed = false;
    this.panPointerId = pointer.id;
    this.panStartX = pointer.x;
    this.panStartY = pointer.y;
    this.panStartScrollX = this.camera.scrollX;
    this.panStartScrollY = this.camera.scrollY;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const active = this.activePointers();

    if (active.length >= 2) {
      if (!this.pinching) this.beginPinch(active[0], active[1]);
      this.updatePinch(active[0], active[1]);
      return;
    }

    if (this.pinching && active.length < 2) {
      this.pinching = false;
    }

    if (this.blockedPan || this.panPointerId === null) return;
    if (pointer.id !== this.panPointerId || !pointer.isDown) return;

    const dx = pointer.x - this.panStartX;
    const dy = pointer.y - this.panStartY;
    if (!this.didPan && Math.hypot(dx, dy) < this.dragThresholdPx) return;

    this.didPan = true;
    this.gestureConsumed = true;
    this.camera.scrollX = Math.round(
      this.panStartScrollX - dx / this.camera.zoom,
    );
    this.camera.scrollY = Math.round(
      this.panStartScrollY - dy / this.camera.zoom,
    );
    this.clampScroll();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.panPointerId) {
      this.panPointerId = null;
      this.blockedPan = false;
      this.scene.time.delayedCall(0, () => {
        this.gestureConsumed = false;
        this.didPan = false;
      });
    }

    if (this.activePointers().filter((p) => p.id !== pointer.id).length < 2) {
      if (this.pinching) {
        this.gestureConsumed = true;
        this.scene.time.delayedCall(0, () => {
          this.gestureConsumed = false;
        });
      }
      this.pinching = false;
    }
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const direction: 1 | -1 = deltaY > 0 ? -1 : 1;
    this.zoomAtScreenPoint(
      pointer.x,
      pointer.y,
      nextZoomStep(this.camera.zoom, direction),
    );
  }

  private beginPinch(a: Phaser.Input.Pointer, b: Phaser.Input.Pointer): void {
    this.pinching = true;
    this.gestureConsumed = true;
    this.panPointerId = null;
    this.pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.pinchStartZoom = this.camera.zoom;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const world = this.screenToWorld(midX, midY);
    this.pinchWorldX = world.x;
    this.pinchWorldY = world.y;
  }

  private updatePinch(a: Phaser.Input.Pointer, b: Phaser.Input.Pointer): void {
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const nextZoom = quantizeZoom(
      Phaser.Math.Clamp(
        this.pinchStartZoom * (dist / this.pinchStartDistance),
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX,
      ),
    );

    this.camera.setZoom(nextZoom);
    this.scrollSoWorldIsAtScreen(this.pinchWorldX, this.pinchWorldY, midX, midY);
    this.clampScroll();
  }

  private zoomAtScreenPoint(screenX: number, screenY: number, nextZoom: number): void {
    const zoom = quantizeZoom(
      Phaser.Math.Clamp(nextZoom, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX),
    );
    if (Math.abs(zoom - this.camera.zoom) < 0.0001) return;

    const world = this.screenToWorld(screenX, screenY);
    this.camera.setZoom(zoom);
    this.scrollSoWorldIsAtScreen(world.x, world.y, screenX, screenY);
    this.clampScroll();
  }

  /**
   * Convert a screen (camera viewport) point to world coordinates.
   * Avoids Camera.getWorldPoint, which depends on a matrix only updated in preRender.
   */
  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cam = this.camera;
    return {
      x: cam.scrollX + cam.width / 2 + (screenX - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (screenY - cam.height / 2) / cam.zoom,
    };
  }

  private scrollSoWorldIsAtScreen(
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
  ): void {
    const cam = this.camera;
    cam.scrollX = worldX - cam.width / 2 - (screenX - cam.width / 2) / cam.zoom;
    cam.scrollY = worldY - cam.height / 2 - (screenY - cam.height / 2) / cam.zoom;
  }

  /**
   * Keep the visible world within [0, WORLD_*], matching Phaser's zoom-aware scroll
   * model. When the view is larger than the world, center the world on screen.
   */
  private clampScroll(): void {
    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;

    if (viewW >= WORLD_WIDTH) {
      cam.scrollX = WORLD_WIDTH / 2 - cam.width / 2;
    } else {
      const minX = (viewW - cam.width) / 2;
      const maxX = minX + WORLD_WIDTH - viewW;
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, minX, maxX);
    }

    if (viewH >= WORLD_HEIGHT) {
      cam.scrollY = WORLD_HEIGHT / 2 - cam.height / 2;
    } else {
      const minY = (viewH - cam.height) / 2;
      const maxY = minY + WORLD_HEIGHT - viewH;
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, minY, maxY);
    }

    cam.scrollX = Math.round(cam.scrollX);
    cam.scrollY = Math.round(cam.scrollY);
  }

  private activePointers(): Phaser.Input.Pointer[] {
    const input = this.scene.input;
    const list: Phaser.Input.Pointer[] = [];
    if (input.pointer1.isDown) list.push(input.pointer1);
    if (input.pointer2.isDown) list.push(input.pointer2);
    if (input.mousePointer.isDown && !list.some((p) => p.id === input.mousePointer.id)) {
      list.push(input.mousePointer);
    }
    return list;
  }
}
