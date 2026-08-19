import Phaser from "phaser";

const BAKE_SCALE = 2;
const EDGE_PAD = 3;

export interface RoundRectStyle {
  width: number;
  height: number;
  radius: number;
  /** CSS color, e.g. "#2a2430" or "rgba(...)" */
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

/** Convert 0xRRGGBB (+ optional alpha) to a canvas fill string. */
export function hexToCss(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  if (alpha >= 1) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function roundRectTextureKey(style: RoundRectStyle): string {
  const sw = style.strokeWidth ?? 0;
  const stroke = style.stroke ?? "none";
  return `smooth_rr_${style.width}x${style.height}_r${style.radius}_f${style.fill}_s${stroke}_w${sw}`;
}

/**
 * Bake a supersampled rounded rect (linear-filtered) so corners stay smooth
 * under the game's antialias:false / pixelArt settings.
 */
export function ensureRoundRectTexture(
  scene: Phaser.Scene,
  style: RoundRectStyle,
  key = roundRectTextureKey(style),
): string {
  if (scene.textures.exists(key)) return key;

  const strokeW = style.strokeWidth ?? 0;
  const totalW = style.width + EDGE_PAD * 2;
  const totalH = style.height + EDGE_PAD * 2;
  const tw = Math.ceil(totalW * BAKE_SCALE);
  const th = Math.ceil(totalH * BAKE_SCALE);

  const canvasTex = scene.textures.createCanvas(key, tw, th);
  if (!canvasTex) return key;

  const canvas = canvasTex.getSourceImage() as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return key;

  ctx.clearRect(0, 0, tw, th);
  ctx.save();
  ctx.scale(BAKE_SCALE, BAKE_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const x = EDGE_PAD + strokeW * 0.5;
  const y = EDGE_PAD + strokeW * 0.5;
  const w = style.width - strokeW;
  const h = style.height - strokeW;
  const r = Math.max(
    0,
    Math.min(style.radius, w / 2, h / 2),
  );

  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = style.fill;
  ctx.fill();

  if (style.stroke && strokeW > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = strokeW;
    ctx.stroke();
  }

  ctx.restore();
  canvasTex.refresh();
  return key;
}

/** Image sized to the logical rect; origin defaults to center. */
export function addSmoothRoundRect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  style: RoundRectStyle,
): Phaser.GameObjects.Image {
  const key = ensureRoundRectTexture(scene, style);
  const img = scene.add.image(x, y, key).setOrigin(0.5);
  img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  img.setDisplaySize(
    style.width + EDGE_PAD * 2,
    style.height + EDGE_PAD * 2,
  );
  return img;
}

/** Swap an existing image to a (possibly new) rounded-rect style. */
export function applySmoothRoundRect(
  image: Phaser.GameObjects.Image,
  style: RoundRectStyle,
): void {
  const key = ensureRoundRectTexture(image.scene, style);
  image.setTexture(key);
  image.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  image.setDisplaySize(
    style.width + EDGE_PAD * 2,
    style.height + EDGE_PAD * 2,
  );
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
