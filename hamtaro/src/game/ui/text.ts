import Phaser from "phaser";
import { CameraRig } from "../systems/CameraRig";

/** Cozy readable UI face — loaded in index.html. */
export const UI_FONT = "Fredoka, system-ui, sans-serif";

export type GameTextStyle = Phaser.Types.GameObjects.Text.TextStyle;

const SUPER_SAMPLE = 2;
const RIG_KEY = "cameraRig";

export function setCameraRig(scene: Phaser.Scene, rig: CameraRig): void {
  scene.registry.set(RIG_KEY, rig);
}

export function getCameraRig(scene: Phaser.Scene): CameraRig | undefined {
  return scene.registry.get(RIG_KEY) as CameraRig | undefined;
}

function parsePxSize(fontSize: string | number | undefined, fallback: number): number {
  if (typeof fontSize === "number") return fontSize;
  if (typeof fontSize === "string") {
    const n = Number.parseFloat(fontSize);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/**
 * Crisp Phaser text via glyph supersampling (draw 2×, show at 0.5).
 * Registers on the UI camera when a CameraRig is present.
 */
export function addGameText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  style: GameTextStyle = {},
  registerWithRig = true,
): Phaser.GameObjects.Text {
  const displaySize = parsePxSize(style.fontSize, 14);
  const stroke = style.strokeThickness ?? 0;

  const text = scene.add.text(x, y, content, {
    fontFamily: UI_FONT,
    color: "#f5efe6",
    ...style,
    fontSize: `${displaySize * SUPER_SAMPLE}px`,
    strokeThickness: stroke * SUPER_SAMPLE,
  });

  text.setData("baseScale", 1 / SUPER_SAMPLE);
  text.setScale(1 / SUPER_SAMPLE);
  text.setResolution(1);
  text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

  const originalUpdateText = text.updateText.bind(text);
  text.updateText = () => {
    originalUpdateText();
    text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return text;
  };

  if (registerWithRig) getCameraRig(scene)?.registerUi(text);
  return text;
}

/** Convert world coords → screen (camera viewport) coords using the world camera. */
export function worldToScreen(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  return {
    x: camera.width / 2 + (worldX - (camera.scrollX + camera.width / 2)) * camera.zoom,
    y: camera.height / 2 + (worldY - (camera.scrollY + camera.height / 2)) * camera.zoom,
  };
}

/**
 * Pin a UI-camera label to a world point.
 * Size stays constant; `screenOffsetY` is in screen pixels from the anchor.
 */
export function pinLabelToWorld(
  label: Phaser.GameObjects.Text,
  worldCamera: Phaser.Cameras.Scene2D.Camera,
  worldX: number,
  worldY: number,
  screenOffsetY = 0,
): void {
  const screen = worldToScreen(worldCamera, worldX, worldY);
  const baseScale = (label.getData("baseScale") as number | undefined) ?? 1;

  label.setScrollFactor(0);
  label.setScale(baseScale);
  label.setPosition(Math.round(screen.x), Math.round(screen.y + screenOffsetY));
}
