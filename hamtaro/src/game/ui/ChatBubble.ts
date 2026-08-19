import Phaser from "phaser";
import { addGameText, getCameraRig, worldToScreen } from "./text";

const PAD_X = 10;
const PAD_Y = 6;
const RADIUS = 10;
const TAIL_W = 10;
const TAIL_H = 7;
const MAX_TEXT_WIDTH = 180;
/** Bake bubble art at 2× so corners stay smooth under antialias:false. */
const BAKE_SCALE = 2;
const FILL = "#fff6ec";
const STROKE = "#4a3f48";
const STROKE_WIDTH = 1.75;
/** Padding so antialiased stroke isn't clipped. */
const EDGE_PAD = 3;

let bubbleId = 0;

/**
 * Cute screen-space speech bubble with a bottom-center tail.
 * Origin is the tip of the tail so it pins cleanly above a hamster.
 */
export class ChatBubble extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly textureKey: string;
  private popTween: Phaser.Tweens.Tween | null = null;
  private bakedW = 0;
  private bakedH = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.textureKey = `chat_bubble_${bubbleId++}`;
    const blank = scene.textures.createCanvas(this.textureKey, 2, 2);
    blank?.refresh();

    this.bg = scene.add.image(0, 0, this.textureKey).setOrigin(0.5, 1);
    this.bg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Parent container is UI-registered; don't also register the label
    // (avoids camera ignore-list growth).
    this.label = addGameText(
      scene,
      0,
      0,
      "",
      {
        fontSize: "15px",
        color: "#3a3038",
        align: "center",
      },
      false,
    ).setOrigin(0.5, 1);
    this.label.setWordWrapWidth(MAX_TEXT_WIDTH * 2);

    this.add([this.bg, this.label]);
    this.setScrollFactor(0);
    this.setDepth(22);
    this.setVisible(false);

    scene.add.existing(this);
    getCameraRig(scene)?.registerUi(this);
  }

  show(text: string): void {
    const next = text.trim();
    if (!next) {
      this.hide();
      return;
    }

    const changed = this.label.text !== next;
    const wasHidden = !this.visible;

    if (changed) {
      this.label.setText(next);
      this.redraw();
    }

    this.setVisible(true);
    if (changed || wasHidden) this.playPop();
  }

  hide(): void {
    this.popTween?.stop();
    this.popTween = null;
    this.setVisible(false);
    this.setScale(1);
    this.setAlpha(1);
    this.label.setText("");
  }

  destroy(fromScene?: boolean): void {
    this.popTween?.stop();
    if (this.scene?.textures.exists(this.textureKey)) {
      this.scene.textures.remove(this.textureKey);
    }
    super.destroy(fromScene);
  }

  /** Pin the tail tip to a world point (screenOffsetY in screen pixels). */
  pinToWorld(
    worldCamera: Phaser.Cameras.Scene2D.Camera,
    worldX: number,
    worldY: number,
    screenOffsetY = 0,
  ): void {
    const screen = worldToScreen(worldCamera, worldX, worldY);
    this.setPosition(
      Math.round(screen.x),
      Math.round(screen.y + screenOffsetY),
    );
  }

  private playPop(): void {
    this.popTween?.stop();
    this.setScale(0.78);
    this.setAlpha(0.85);
    this.popTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 240,
      ease: "Back.Out",
    });
  }

  private redraw(): void {
    const displayW = Math.max(24, this.label.width * 0.5);
    const displayH = Math.max(14, this.label.height * 0.5);
    const boxW = displayW + PAD_X * 2;
    const boxH = displayH + PAD_Y * 2;
    // Pad top/sides for soft stroke; tip sits on the bottom edge.
    const totalW = boxW + EDGE_PAD * 2;
    const totalH = boxH + TAIL_H + EDGE_PAD;

    this.label.setPosition(0, -(TAIL_H + PAD_Y));
    this.label.setScale(
      (this.label.getData("baseScale") as number | undefined) ?? 0.5,
    );

    this.bakeBubbleTexture(totalW, totalH, boxW, boxH);
    this.bg.setDisplaySize(totalW, totalH);
    this.bg.setPosition(0, 0);
  }

  private bakeBubbleTexture(
    totalW: number,
    totalH: number,
    boxW: number,
    boxH: number,
  ): void {
    const tw = Math.max(2, Math.ceil(totalW * BAKE_SCALE));
    const th = Math.max(2, Math.ceil(totalH * BAKE_SCALE));

    // Reuse one canvas texture — remove/recreate was leaking GPU memory
    // and freezing the game after a few minutes of chatter.
    let canvasTex: Phaser.Textures.CanvasTexture | null = null;
    if (this.scene.textures.exists(this.textureKey)) {
      canvasTex = this.scene.textures.get(
        this.textureKey,
      ) as Phaser.Textures.CanvasTexture;
      if (this.bakedW !== tw || this.bakedH !== th) {
        canvasTex.setSize(tw, th);
        this.bakedW = tw;
        this.bakedH = th;
      }
    } else {
      canvasTex = this.scene.textures.createCanvas(this.textureKey, tw, th);
      this.bakedW = tw;
      this.bakedH = th;
    }
    if (!canvasTex) return;

    const canvas = canvasTex.getSourceImage() as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tw, th);
    ctx.save();
    ctx.scale(BAKE_SCALE, BAKE_SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const bodyX = EDGE_PAD;
    const bodyY = EDGE_PAD;
    const tipX = totalW / 2;
    const tipY = totalH - STROKE_WIDTH * 0.5;

    traceBubble(ctx, bodyX, bodyY, boxW, boxH, RADIUS, tipX, tipY, TAIL_W);

    ctx.fillStyle = FILL;
    ctx.fill();
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.stroke();

    ctx.restore();
    canvasTex.refresh();
    this.bg.setTexture(this.textureKey);
    this.bg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Single path: rounded body + bottom-center tail. */
function traceBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  tipX: number,
  tipY: number,
  tailW: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;
  const halfTail = tailW / 2;

  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.arcTo(right, top, right, bottom, r);
  ctx.arcTo(right, bottom, left, bottom, r);
  ctx.lineTo(tipX + halfTail, bottom);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - halfTail, bottom);
  ctx.lineTo(left + r, bottom);
  ctx.arcTo(left, bottom, left, top, r);
  ctx.arcTo(left, top, right, top, r);
  ctx.closePath();
}
