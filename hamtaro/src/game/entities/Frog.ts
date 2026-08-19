import Phaser from "phaser";
import { getCameraRig } from "../ui/text";
import { ChatBubble } from "../ui/ChatBubble";

const FROG_ROOT = "assets/sprites/objects/frog";
const HOP_FRAME_COUNT = 6;
const CROAK_FRAME_COUNT = 8;
const HOP_FRAME_RATE = 10;
const CROAK_FRAME_RATE = 8;

type FrogState = "idle" | "hop" | "hopPause" | "croak";
type HopFacing = "left" | "right" | "down";

const HOP_PAUSE = 0.18;

function textureKey(anim: string, frame: number): string {
  return `frog_${anim}_${String(frame).padStart(3, "0")}`;
}

function animKey(anim: string): string {
  return `frog_${anim}`;
}

export const FROG_SHOP_TEXTURE_KEY = "frog_idle_000";

export function loadFrogSprites(load: Phaser.Loader.LoaderPlugin): void {
  load.image(FROG_SHOP_TEXTURE_KEY, `${FROG_ROOT}/idle/000.png`);
  for (const direction of ["down", "left", "right"]) {
    for (let i = 0; i < HOP_FRAME_COUNT; i++) {
      load.image(
        textureKey(`hop_${direction}`, i),
        `${FROG_ROOT}/hop_${direction}/${String(i).padStart(3, "0")}.png`,
      );
    }
  }
  for (let i = 0; i < CROAK_FRAME_COUNT; i++) {
    load.image(
      textureKey("croak", i),
      `${FROG_ROOT}/croak/${String(i).padStart(3, "0")}.png`,
    );
  }
}

export function createFrogAnims(anims: Phaser.Animations.AnimationManager): void {
  for (const direction of ["down", "left", "right"]) {
    const name = `hop_${direction}`;
    if (!anims.exists(animKey(name))) {
      anims.create({
        key: animKey(name),
        frames: Array.from({ length: HOP_FRAME_COUNT }, (_, i) => ({
          key: textureKey(name, i),
        })),
        frameRate: HOP_FRAME_RATE,
        repeat: 0,
      });
    }
  }
  if (!anims.exists(animKey("croak"))) {
    anims.create({
      key: animKey("croak"),
      frames: Array.from({ length: CROAK_FRAME_COUNT }, (_, i) => ({
        key: textureKey("croak", i),
      })),
      frameRate: CROAK_FRAME_RATE,
      repeat: 0,
    });
  }
}

/** A small autonomous toy that hops around and occasionally croaks. */
export class Frog extends Phaser.GameObjects.Sprite {
  private readonly habitatBounds: Phaser.Geom.Rectangle;
  private readonly chatBubble: ChatBubble;
  private frogState: FrogState = "idle";
  private stateTimer = 0;
  private startX = 0;
  private startY = 0;
  private targetX = 0;
  private targetY = 0;
  private hopDuration = HOP_FRAME_COUNT / HOP_FRAME_RATE;
  /** Extra hops still queued after the current one. */
  private hopsRemaining = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    habitatBounds: Phaser.Geom.Rectangle,
  ) {
    super(scene, x, y, FROG_SHOP_TEXTURE_KEY);
    this.habitatBounds = habitatBounds;
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.setOrigin(0.5);
    this.setDepth(Math.round(y));
    scene.add.existing(this);
    getCameraRig(scene)?.registerWorld(this);
    this.chatBubble = new ChatBubble(scene);
    this.beginIdle();
  }

  updateFrog(dt: number): void {
    this.stateTimer -= dt;
    this.chatBubble.pinToWorld(
      this.scene.cameras.main,
      this.x,
      this.y,
      -18 * this.scene.cameras.main.zoom,
    );

    if (this.frogState === "hop") {
      const progress = Phaser.Math.Clamp(
        1 - this.stateTimer / this.hopDuration,
        0,
        1,
      );
      this.x = Phaser.Math.Linear(this.startX, this.targetX, progress);
      this.y = Phaser.Math.Linear(this.startY, this.targetY, progress);
      this.setDepth(Math.round(this.y));
      if (this.stateTimer <= 0) {
        this.setPosition(this.targetX, this.targetY);
        if (this.hopsRemaining > 0) {
          this.hopsRemaining -= 1;
          this.beginHopPause();
        } else {
          this.beginIdle();
        }
      }
      return;
    }

    if (this.frogState === "hopPause") {
      if (this.stateTimer <= 0) this.beginHop();
      return;
    }

    if (this.frogState === "croak") {
      if (this.stateTimer <= 0) this.beginIdle();
      return;
    }

    if (this.stateTimer > 0) return;
    // Croaking only happens while idle; otherwise start a hop (sometimes a burst).
    if (Math.random() < 0.3) this.beginCroak();
    else this.beginHopBurst();
  }

  private beginIdle(): void {
    this.frogState = "idle";
    this.stateTimer = Phaser.Math.FloatBetween(1.5, 4);
    this.chatBubble.hide();
    this.stop();
    this.setTexture(FROG_SHOP_TEXTURE_KEY);
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private beginHopPause(): void {
    this.frogState = "hopPause";
    this.stateTimer = HOP_PAUSE;
    this.stop();
    this.setTexture(FROG_SHOP_TEXTURE_KEY);
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private beginCroak(): void {
    this.frogState = "croak";
    this.stateTimer = CROAK_FRAME_COUNT / CROAK_FRAME_RATE;
    this.chatBubble.show("ribbit");
    this.play(animKey("croak"));
  }

  /** Start hopping — often just once, sometimes a short chain. */
  private beginHopBurst(): void {
    // 55% single hop, otherwise 2–4 hops in a row.
    this.hopsRemaining =
      Math.random() < 0.55 ? 0 : Phaser.Math.Between(1, 3);
    this.beginHop();
  }

  private beginHop(): void {
    const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
    const distance = 48;
    const pad = 12;
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = Phaser.Math.Clamp(
      this.x + Math.cos(angle) * distance,
      this.habitatBounds.left + pad,
      this.habitatBounds.right - pad,
    );
    this.targetY = Phaser.Math.Clamp(
      this.y + Math.sin(angle) * distance,
      this.habitatBounds.top + pad,
      this.habitatBounds.bottom - pad,
    );

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    // hop_down only when nearly straight down; otherwise left/right
    // (including most downward hops more than ~10° off vertical).
    const angleFromDown = Math.abs(Math.atan2(dx, dy));
    const nearlyStraightDown =
      dy > 0 && angleFromDown <= Phaser.Math.DegToRad(10);
    const facing: HopFacing = nearlyStraightDown
      ? "down"
      : dx < 0
        ? "left"
        : "right";

    this.frogState = "hop";
    this.hopDuration = HOP_FRAME_COUNT / HOP_FRAME_RATE;
    this.stateTimer = this.hopDuration;
    this.play(animKey(`hop_${facing}`));
  }
}
