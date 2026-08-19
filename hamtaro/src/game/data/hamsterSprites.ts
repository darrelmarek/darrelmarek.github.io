/**
 * Frame-folder sprite packs under public/assets/sprites/hamsters/<skin>/<anim>/###.png
 */
export interface AnimClipDef {
  frames: string[];
  frameRate: number;
  repeat: number;
}

export const HAMSTER_SKIN = "hamtaro";

function numbered(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i).padStart(3, "0"));
}

/** Available clips for the hamtaro skin. */
export const HAMTARO_CLIPS: Record<string, AnimClipDef> = {
  idle: { frames: numbered(2), frameRate: 1.5, repeat: -1 },
  blink: { frames: numbered(1), frameRate: 12, repeat: 0 },
  eat: { frames: numbered(2), frameRate: 14, repeat: -1 },
  sleep: { frames: numbered(2), frameRate: 1.2, repeat: -1 },
  sit: { frames: numbered(1), frameRate: 1, repeat: -1 },
  dance: { frames: numbered(8), frameRate: 5, repeat: -1 },
  walk_down: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_left: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_right: { frames: numbered(4), frameRate: 8, repeat: -1 },
};

/** Available clips for the bijou skin. */
export const BIJOU_CLIPS: Record<string, AnimClipDef> = {
  idle: { frames: numbered(4), frameRate: 1.5, repeat: -1 },
  blink: { frames: numbered(1), frameRate: 12, repeat: 0 },
  eat: { frames: numbered(2), frameRate: 14, repeat: -1 },
  sleep: { frames: numbered(2), frameRate: 1.2, repeat: -1 },
  sit: { frames: numbered(4), frameRate: 1.5, repeat: -1 },
  dance: { frames: numbered(12), frameRate: 5, repeat: -1 },
  walk_down: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_left: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_right: { frames: numbered(4), frameRate: 8, repeat: -1 },
};

/** Available clips for the oxnard skin. */
export const OXNARD_CLIPS: Record<string, AnimClipDef> = {
  idle: { frames: numbered(2), frameRate: 1.5, repeat: -1 },
  blink: { frames: numbered(1), frameRate: 12, repeat: 0 },
  eat: { frames: numbered(2), frameRate: 14, repeat: -1 },
  sleep: { frames: numbered(2), frameRate: 1.2, repeat: -1 },
  sit: { frames: numbered(1), frameRate: 1, repeat: -1 },
  dance: { frames: numbered(12), frameRate: 5, repeat: -1 },
  walk_down: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_left: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_right: { frames: numbered(4), frameRate: 8, repeat: -1 },
};

/** Available clips for the pashmina skin. */
export const PASHMINA_CLIPS: Record<string, AnimClipDef> = {
  idle: { frames: numbered(2), frameRate: 1.5, repeat: -1 },
  blink: { frames: numbered(1), frameRate: 12, repeat: 0 },
  eat: { frames: numbered(2), frameRate: 14, repeat: -1 },
  sleep: { frames: numbered(2), frameRate: 1.2, repeat: -1 },
  sit: { frames: numbered(1), frameRate: 1, repeat: -1 },
  dance: { frames: numbered(12), frameRate: 5, repeat: -1 },
  walk_down: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_left: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_right: { frames: numbered(4), frameRate: 8, repeat: -1 },
};

/** Available clips for the dexter skin. */
export const DEXTER_CLIPS: Record<string, AnimClipDef> = {
  idle: { frames: numbered(2), frameRate: 1.5, repeat: -1 },
  blink: { frames: numbered(1), frameRate: 12, repeat: 0 },
  eat: { frames: numbered(2), frameRate: 14, repeat: -1 },
  sleep: { frames: numbered(2), frameRate: 1.2, repeat: -1 },
  sit: { frames: numbered(1), frameRate: 1, repeat: -1 },
  dance: { frames: numbered(12), frameRate: 5, repeat: -1 },
  walk_down: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_left: { frames: numbered(4), frameRate: 8, repeat: -1 },
  walk_right: { frames: numbered(4), frameRate: 8, repeat: -1 },
};

/** Skins that have sprite packs ready to load. */
export const HAMSTER_SKINS: Record<string, Record<string, AnimClipDef>> = {
  hamtaro: HAMTARO_CLIPS,
  bijou: BIJOU_CLIPS,
  oxnard: OXNARD_CLIPS,
  pashmina: PASHMINA_CLIPS,
  dexter: DEXTER_CLIPS,
};

/** Prefer a matching character skin when one exists; otherwise fall back. */
export function skinForName(name: string): string {
  const key = name.trim().toLowerCase();
  return key in HAMSTER_SKINS ? key : HAMSTER_SKIN;
}

export function frameTextureKey(
  skin: string,
  anim: string,
  frame: string,
): string {
  return `${skin}_${anim}_${frame}`;
}

export function animKey(skin: string, anim: string): string {
  return `${skin}_${anim}`;
}

export function framePath(skin: string, anim: string, frame: string): string {
  return `assets/sprites/hamsters/${skin}/${anim}/${frame}.png`;
}

/** Queue all frame images on a Phaser loader. */
export function loadHamsterSkin(
  load: Phaser.Loader.LoaderPlugin,
  skin: string,
  clips: Record<string, AnimClipDef>,
): void {
  for (const [anim, clip] of Object.entries(clips)) {
    for (const frame of clip.frames) {
      load.image(
        frameTextureKey(skin, anim, frame),
        framePath(skin, anim, frame),
      );
    }
  }
}

/** Load every registered hamster skin. */
export function loadAllHamsterSkins(load: Phaser.Loader.LoaderPlugin): void {
  for (const [skin, clips] of Object.entries(HAMSTER_SKINS)) {
    loadHamsterSkin(load, skin, clips);
  }
}

/** Register Phaser animations after textures are loaded. */
export function createHamsterAnims(
  anims: Phaser.Animations.AnimationManager,
  skin: string,
  clips: Record<string, AnimClipDef>,
): void {
  for (const [anim, clip] of Object.entries(clips)) {
    const key = animKey(skin, anim);
    if (anims.exists(key)) continue;
    anims.create({
      key,
      frames: clip.frames.map((frame) => ({
        key: frameTextureKey(skin, anim, frame),
      })),
      frameRate: clip.frameRate,
      repeat: clip.repeat,
    });
  }
}

/** Register animations for every registered hamster skin. */
export function createAllHamsterAnims(
  anims: Phaser.Animations.AnimationManager,
): void {
  for (const [skin, clips] of Object.entries(HAMSTER_SKINS)) {
    createHamsterAnims(anims, skin, clips);
  }
}

export type WalkFacing = "left" | "right" | "down";

/** How far below horizontal still counts as left/right (radians). ~28°. */
const SIDE_WALK_DOWNWARD_SLACK = 0.5;
/** Extra band so facing doesn't flicker on near-boundary angles. */
const FACING_HYSTERESIS = 0.3;

function rawFacingFromAngle(a: number, slack: number): WalkFacing {
  // Right: up-right through exact right to slightly down-right.
  if (a > -Math.PI / 2 && a <= slack) return "right";
  // Left: up-left through exact left to slightly down-left.
  if (a <= -Math.PI / 2 || a >= Math.PI - slack) return "left";
  return "down";
}

export function facingFromAngle(
  angleRad: number,
  current?: WalkFacing,
): WalkFacing {
  // Phaser angles: 0 right, +PI/2 down, ±PI left, -PI/2 up.
  // atan2-normalize avoids infinite loops on non-finite angles.
  if (!Number.isFinite(angleRad)) return current ?? "down";
  const a = Math.atan2(Math.sin(angleRad), Math.cos(angleRad));

  const next = rawFacingFromAngle(a, SIDE_WALK_DOWNWARD_SLACK);
  if (!current || next === current) return next;

  // Keep current facing until the angle is firmly outside its sticky zone.
  if (current === "right") {
    const keep = rawFacingFromAngle(a, SIDE_WALK_DOWNWARD_SLACK + FACING_HYSTERESIS);
    if (keep === "right") return "right";
  } else if (current === "left") {
    const keep = rawFacingFromAngle(a, SIDE_WALK_DOWNWARD_SLACK + FACING_HYSTERESIS);
    if (keep === "left") return "left";
  } else {
    // Down: require a clearer horizontal heading before switching.
    const leave = rawFacingFromAngle(
      a,
      Math.max(0.15, SIDE_WALK_DOWNWARD_SLACK - FACING_HYSTERESIS),
    );
    if (leave === "down") return "down";
  }

  return next;
}
