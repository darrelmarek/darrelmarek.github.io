import Phaser from "phaser";
import { HabitatScene } from "./game/scenes/HabitatScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";

/** Prefer even canvas sizes so 1× camera centering lands on whole pixels. */
function evenSize(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: evenSize(window.innerWidth),
  height: evenSize(window.innerHeight),
  backgroundColor: "#1a1520",
  pixelArt: true,
  antialias: false,
  // Allow subpixel positions — canvas is upscaled, so whole-pixel snapping
  // makes movement stutter. Textures stay nearest-neighbor via pixelArt.
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  scene: [MainMenuScene, HabitatScene],
  input: {
    activePointers: 3,
  },
};

async function boot(): Promise<void> {
  if (document.fonts?.load) {
    try {
      await document.fonts.load("500 16px Fredoka");
      await document.fonts.ready;
    } catch {
      // Fall back to system UI font if Google Fonts is blocked.
    }
  }

  const game = new Phaser.Game(config);

  // Keep size even after browser resize (RESIZE otherwise uses raw innerWidth).
  let resizing = false;
  window.addEventListener("resize", () => {
    if (resizing) return;
    const w = evenSize(window.innerWidth);
    const h = evenSize(window.innerHeight);
    if (game.scale.width === w && game.scale.height === h) return;
    resizing = true;
    game.scale.resize(w, h);
    resizing = false;
  });
}

void boot();
