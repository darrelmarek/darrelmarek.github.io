import Phaser from "phaser";
import type { Hamster } from "./Hamster";
import { getCameraRig } from "../ui/text";
import {
  getFurniture,
  type FurnitureId,
  type FurnitureDef,
} from "../systems/ShopStock";

export type PlaceableKind = FurnitureDef["kind"];

export interface PlaceableUseDef {
  useRadius: number;
  useDuration: number;
}

const BED_USE_DEF: PlaceableUseDef = {
  useRadius: 14,
  useDuration: 12,
};

const CHAIR_USE_DEF: PlaceableUseDef = {
  useRadius: 10,
  useDuration: 6,
};

/** Rugs / props are decor: hamsters never reserve or use them. */
const DECOR_USE_DEF: PlaceableUseDef = {
  useRadius: 0,
  useDuration: 0,
};

/**
 * Rugs live below every other world object. Adding y keeps overlapping
 * rugs stacking in the usual north-to-south order.
 */
const RUG_DEPTH_BASE = -1000;

/** Shift bed art down so the nest sit-point reads higher in the bed. */
const BED_VISUAL_OFFSET_Y = 7;
/** Lift the hamster so they sit on the seat, not the chair legs. */
const CHAIR_SIT_OFFSET_Y = -10;
/** Sort chairs above their own seat point so a sitter stays in front. */
const CHAIR_DEPTH_BIAS = -CHAIR_SIT_OFFSET_Y + 4;
/**
 * Sort beds as if their feet are further north — softens how quickly
 * hamsters slip behind when walking past the upper half.
 */
const BED_DEPTH_BIAS = 14;

interface SeatSlot {
  x: number;
  y: number;
  reservedBy: Hamster | null;
}

/**
 * World object hamsters can reserve, walk to, and use.
 * Beds use a base sprite plus a sleep overlay drawn above the hamster.
 * Chairs (and couches) can expose multiple seat slots.
 */
export class PlaceableObject extends Phaser.GameObjects.Container {
  readonly furnitureId: FurnitureId;
  readonly kind: PlaceableKind;
  readonly furniture: FurnitureDef;
  readonly def: PlaceableUseDef;
  private readonly seats: SeatSlot[];
  /** Front lip of the bed — sits above a sleeping hamster. */
  private readonly sleepOverlay: Phaser.GameObjects.Image | null;
  private readonly baseImage: Phaser.GameObjects.Image;
  private readonly visualOffsetY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, furnitureId: FurnitureId) {
    super(scene, Math.round(x), Math.round(y));
    this.furnitureId = furnitureId;
    this.furniture = getFurniture(furnitureId);
    this.kind = this.furniture.kind;
    this.def =
      this.kind === "bed"
        ? BED_USE_DEF
        : this.kind === "chair"
          ? CHAIR_USE_DEF
          : DECOR_USE_DEF;
    this.visualOffsetY = this.kind === "bed" ? BED_VISUAL_OFFSET_Y : 0;
    this.seats = this.buildSeats();

    this.baseImage = scene.add
      .image(0, this.visualOffsetY, this.furniture.textureKey)
      .setOrigin(0.5, 0.5);
    this.baseImage.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add(this.baseImage);

    if (this.furniture.overlayTextureKey) {
      this.sleepOverlay = scene.add
        .image(
          this.x,
          this.y + BED_VISUAL_OFFSET_Y,
          this.furniture.overlayTextureKey,
        )
        .setOrigin(0.5, 0.5)
        .setVisible(false)
        .setDepth(this.y + 20);
      this.sleepOverlay.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      getCameraRig(scene)?.registerWorld(this.sleepOverlay);
    } else {
      this.sleepOverlay = null;
    }
    this.setDepth(this.sortDepth());

    scene.add.existing(this);
    getCameraRig(scene)?.registerWorld(this);
  }

  private buildSeats(): SeatSlot[] {
    if (this.furniture.seatOffsets?.length) {
      return this.furniture.seatOffsets.map((offset) => ({
        x: offset.x,
        y: offset.y,
        reservedBy: null,
      }));
    }
    if (this.kind === "bed") {
      return [{ x: 0, y: -1, reservedBy: null }];
    }
    if (this.kind === "chair") {
      return [{ x: 0, y: CHAIR_SIT_OFFSET_Y, reservedBy: null }];
    }
    return [];
  }

  private seatFor(hamster: Hamster): SeatSlot | null {
    return this.seats.find((seat) => seat.reservedBy === hamster) ?? null;
  }

  /** True while any seat is claimed (blocks dragging). */
  isBusy(): boolean {
    return this.seats.some((seat) => seat.reservedBy !== null);
  }

  /** Axis-aligned bounds of the base sprite in world space. */
  containsWorldPoint(worldX: number, worldY: number): boolean {
    const w = this.baseImage.displayWidth;
    const h = this.baseImage.displayHeight;
    const left = this.x - w / 2;
    const top = this.y + this.visualOffsetY - h / 2;
    return (
      worldX >= left &&
      worldX <= left + w &&
      worldY >= top &&
      worldY <= top + h
    );
  }

  /** Move within the habitat and keep depth / bed overlay in sync. */
  relocate(x: number, y: number, bounds: Phaser.Geom.Rectangle): void {
    const padX = Math.max(12, this.baseImage.displayWidth * 0.25);
    const padY = Math.max(12, this.baseImage.displayHeight * 0.25);
    const nx = Phaser.Math.Clamp(
      Math.round(x),
      Math.ceil(bounds.left + padX),
      Math.floor(bounds.right - padX),
    );
    const ny = Phaser.Math.Clamp(
      Math.round(y),
      Math.ceil(bounds.top + padY),
      Math.floor(bounds.bottom - padY),
    );
    this.setPosition(nx, ny);
    this.setDepth(this.sortDepth());
    this.syncSleepOverlayPosition();
  }

  /** Temporary lift while the player is dragging (rugs stay on the floor). */
  beginDragVisual(): void {
    this.setAlpha(0.55);
    if (this.kind !== "rug") this.setDepth(this.y + 500);
  }

  endDragVisual(): void {
    this.setAlpha(1);
    this.setDepth(this.sortDepth());
    this.syncSleepOverlayPosition();
  }

  private syncSleepOverlayPosition(): void {
    if (!this.sleepOverlay) return;
    this.sleepOverlay.setPosition(this.x, this.y + BED_VISUAL_OFFSET_Y);
  }

  /** True if at least one seat is free for this kind of furniture. */
  isAvailable(): boolean {
    if (this.kind !== "bed" && this.kind !== "chair") return false;
    return this.seats.some((seat) => seat.reservedBy === null);
  }

  isReservedBy(hamster: Hamster): boolean {
    return this.seatFor(hamster) !== null;
  }

  tryReserve(hamster: Hamster): boolean {
    if (this.seatFor(hamster)) return true;
    const free = this.seats.find((seat) => seat.reservedBy === null);
    if (!free) return false;
    free.reservedBy = hamster;
    return true;
  }

  release(hamster: Hamster): void {
    const seat = this.seatFor(hamster);
    if (!seat) return;
    seat.reservedBy = null;
    this.hideSleepOverlay();
  }

  /** Show the bed rim over a sleeping hamster (base stays under them). */
  showSleepOverlay(hamster: Hamster): void {
    if (!this.sleepOverlay) return;
    this.sleepOverlay.setPosition(this.x, this.y + BED_VISUAL_OFFSET_Y);
    this.sleepOverlay.setVisible(true);
    this.refreshSleepLayers(hamster);
  }

  hideSleepOverlay(): void {
    if (!this.sleepOverlay) return;
    this.sleepOverlay.setVisible(false);
    this.setDepth(this.sortDepth());
  }

  /** Keep base under / overlay over the hamster while they nap. */
  refreshSleepLayers(hamster: Hamster): void {
    if (!this.sleepOverlay?.visible) return;
    // Stay clearly under the sleeper without fighting nearby walkers as hard.
    this.setDepth(Math.min(this.sortDepth(), hamster.depth - 1));
    this.sleepOverlay.setPosition(this.x, this.y + BED_VISUAL_OFFSET_Y);
    this.sleepOverlay.setDepth(hamster.depth + 1);
  }

  /** Seat point for a reserved hamster (or the first free / center seat). */
  getApproachPoint(hamster?: Hamster): Phaser.Math.Vector2 {
    const seat =
      (hamster ? this.seatFor(hamster) : null) ??
      this.seats.find((slot) => slot.reservedBy === null) ??
      this.seats[0];
    const ox = seat?.x ?? 0;
    const oy = seat?.y ?? 0;
    return new Phaser.Math.Vector2(this.x + ox, this.y + oy);
  }

  private sortDepth(): number {
    if (this.kind === "rug") return RUG_DEPTH_BASE + this.y;
    if (this.kind === "bed") return this.y - BED_DEPTH_BIAS;
    if (this.kind === "chair") return this.y - CHAIR_DEPTH_BIAS;
    // Props (tables, etc.): plain y-sort with the rest of the world.
    return this.y;
  }

  destroy(fromScene?: boolean): void {
    this.sleepOverlay?.destroy();
    super.destroy(fromScene);
  }
}
