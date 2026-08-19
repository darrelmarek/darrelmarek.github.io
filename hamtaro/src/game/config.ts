/** Fixed habitat world size in game pixels. */
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;

/** @deprecated Use WORLD_WIDTH — kept for any leftover imports. */
export const GAME_WIDTH = WORLD_WIDTH;
/** @deprecated Use WORLD_HEIGHT */
export const GAME_HEIGHT = WORLD_HEIGHT;

export const CAMERA_ZOOM_MIN = 1;
export const CAMERA_ZOOM_MAX = 2;
export const CAMERA_ZOOM_DEFAULT = 1;

/** Discrete zoom stops — only integers so nearest-neighbor scaling stays even. */
export const CAMERA_ZOOM_STEPS = [1, 2] as const;

export function quantizeZoom(zoom: number): number {
  let best: number = CAMERA_ZOOM_STEPS[0];
  let bestDist = Math.abs(zoom - best);
  for (const step of CAMERA_ZOOM_STEPS) {
    const d = Math.abs(zoom - step);
    if (d < bestDist) {
      best = step;
      bestDist = d;
    }
  }
  return best;
}

export function nextZoomStep(current: number, direction: 1 | -1): number {
  const quantized = quantizeZoom(current);
  let index = CAMERA_ZOOM_STEPS.findIndex((step) => step === quantized);
  if (index < 0) index = 0;
  const next = Math.max(0, Math.min(CAMERA_ZOOM_STEPS.length - 1, index + direction));
  return CAMERA_ZOOM_STEPS[next];
}

export const COLORS = {
  floor: 0xa4e2e4,
  floorGrain: 0x8cd2dc,
  wall: 0x548490,
  outside: 0x1a1520,
  uiPanel: 0x2a2430,
  uiText: "#f5efe6",
  uiAccent: 0x7ec8c0, // light blue-green
} as const;

export const HAMSTER_PALETTES = [
  { body: 0xe8c4a0, belly: 0xf5e6d3, outline: 0x5c4033 },
  { body: 0xc9a0dc, belly: 0xe8d4f0, outline: 0x4a3560 },
  { body: 0xa8d5a2, belly: 0xd4ecd0, outline: 0x3d5c38 },
] as const;
