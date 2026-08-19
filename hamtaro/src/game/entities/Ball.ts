import Phaser from "phaser";
import { getCameraRig } from "../ui/text";
import { snap } from "../utils/pixels";

const GRAVITY = 420;
const GROUND_FRICTION = 2.4;
const AIR_DRAG = 0.15;
const MIN_BOUNCE = 28;
const SETTLE_SPEED = 18;

export const BALL_TEXTURE_KEY = "object_ball";
export const BALL_TEXTURE_PATH = "assets/sprites/objects/ball.png";

/**
 * Kickable ball with fake 2.5D physics: floor velocity + height arc + bounces.
 */
export class Ball extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly habitatBounds: Phaser.Geom.Rectangle;

  private simX = 0;
  private simY = 0;
  private vx = 0;
  private vy = 0;
  /** Upward speed in "height" space. */
  private vz = 0;
  /** Height above the floor (pixels drawn upward). */
  private airHeight = 0;
  private bounceLoss = 0.62;
  private wasSettled = true;
  /** True for one update after the ball comes to rest. */
  justSettled = false;
  /** Where the last kick came from (for return volleys). */
  lastKickFromX = 0;
  lastKickFromY = 0;
  private hasKickOrigin = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    habitatBounds: Phaser.Geom.Rectangle,
  ) {
    super(scene, x, y);
    this.habitatBounds = habitatBounds;
    this.simX = x;
    this.simY = y;

    this.shadow = scene.add.graphics();
    this.sprite = scene.add.image(0, 0, BALL_TEXTURE_KEY).setOrigin(0.5, 0.5);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add([this.shadow, this.sprite]);
    this.syncVisuals();

    this.setDepth(Math.round(y));
    scene.add.existing(this);
    getCameraRig(scene)?.registerWorld(this);
  }

  isSettled(): boolean {
    return (
      this.airHeight <= 0.5 &&
      Math.hypot(this.vx, this.vy) < SETTLE_SPEED &&
      Math.abs(this.vz) < SETTLE_SPEED
    );
  }

  hasReturnTarget(): boolean {
    return this.hasKickOrigin;
  }

  /** Impulse from a hamster kick — arcs up and bounces a few times. */
  kickFrom(fromX: number, fromY: number): void {
    this.lastKickFromX = fromX;
    this.lastKickFromY = fromY;
    this.hasKickOrigin = true;

    const dx = this.simX - fromX;
    const dy = this.simY - fromY;
    this.applyKickImpulse(dx, dy);
  }

  /** Kick roughly toward a point (used to send the ball back). */
  kickToward(toX: number, toY: number, fromX: number, fromY: number): void {
    this.lastKickFromX = fromX;
    this.lastKickFromY = fromY;
    this.hasKickOrigin = true;

    const dx = toX - this.simX;
    const dy = toY - this.simY;
    this.applyKickImpulse(dx, dy);
  }

  private applyKickImpulse(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const power = Phaser.Math.FloatBetween(95, 140);

    this.vx = (dx / len) * power + Phaser.Math.FloatBetween(-12, 12);
    this.vy = (dy / len) * power + Phaser.Math.FloatBetween(-12, 12);
    this.vz = Phaser.Math.FloatBetween(160, 220);
    this.airHeight = Math.max(this.airHeight, 2);
    this.bounceLoss = 0.62;
    this.wasSettled = false;
    this.justSettled = false;
  }

  updateBall(dt: number): void {
    this.simX += this.vx * dt;
    this.simY += this.vy * dt;
    this.airHeight += this.vz * dt;
    this.vz -= GRAVITY * dt;

    const drag = this.airHeight > 0 ? AIR_DRAG : GROUND_FRICTION;
    const damp = Math.max(0, 1 - drag * dt);
    this.vx *= damp;
    this.vy *= damp;

    if (this.airHeight <= 0) {
      this.airHeight = 0;
      if (this.vz < 0) {
        const impact = -this.vz;
        if (impact > MIN_BOUNCE) {
          this.vz = impact * this.bounceLoss;
          this.bounceLoss *= 0.72;
          this.vx *= 0.88;
          this.vy *= 0.88;
        } else {
          this.vz = 0;
          this.vx *= 0.7;
          this.vy *= 0.7;
        }
      }
    }

    this.clampToHabitat();
    this.x = this.simX;
    this.y = this.simY;
    this.syncVisuals();
    // Sort with floor y; slight lift while airborne so it clears nearby feet.
    this.setDepth(Math.round(this.simY) + Math.round(this.airHeight));

    const settled = this.isSettled();
    this.justSettled = settled && !this.wasSettled;
    this.wasSettled = settled;
  }

  private clampToHabitat(): void {
    const pad = 10;
    const left = this.habitatBounds.left + pad;
    const right = this.habitatBounds.right - pad;
    const top = this.habitatBounds.top + pad;
    const bottom = this.habitatBounds.bottom - pad;

    if (this.simX < left) {
      this.simX = left;
      this.vx = Math.abs(this.vx) * 0.7;
    } else if (this.simX > right) {
      this.simX = right;
      this.vx = -Math.abs(this.vx) * 0.7;
    }

    if (this.simY < top) {
      this.simY = top;
      this.vy = Math.abs(this.vy) * 0.7;
    } else if (this.simY > bottom) {
      this.simY = bottom;
      this.vy = -Math.abs(this.vy) * 0.7;
    }
  }

  private syncVisuals(): void {
    const h = this.airHeight;
    this.sprite.setY(-h);

    const shadowScale = Phaser.Math.Clamp(1 - h / 90, 0.35, 1);
    const shadowW = Math.max(6, snap(16 * shadowScale));
    const shadowH = Math.max(3, snap(shadowW * 0.55));

    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.22);
    this.shadow.fillEllipse(0, 4, shadowW, shadowH);
  }
}
