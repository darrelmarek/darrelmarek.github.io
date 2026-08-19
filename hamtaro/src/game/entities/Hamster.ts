import Phaser from "phaser";
import {
  createNeeds,
  tickNeeds,
  clampNeed,
  HAPPINESS_DRAIN_IN_BAD_STATE,
  HAPPINESS_DRAIN_WHILE_HUNGRY,
  HAPPINESS_DRAIN_WHILE_STARVING,
  HAPPINESS_FROM_EAT,
  HAPPINESS_FROM_SLEEP,
  HAPPINESS_FROM_PET,
  ENERGY_DRAIN_WHILE_MOVING,
  ENERGY_COST_KICK,
  HUNGER_PAUSE_AFTER_FEED_SEC,
  type NeedsState,
} from "../systems/Needs";
import {
  moodFromNeeds,
  personalityTraits,
  pickPersonality,
  pickQuip,
  type Personality,
} from "../data/quips";
import {
  HAMSTER_SKIN,
  animKey,
  facingFromAngle,
  frameTextureKey,
  type WalkFacing,
} from "../data/hamsterSprites";
import { pickFavoriteFoodId, type FoodDef } from "../data/foods";
import { getCameraRig } from "../ui/text";
import { ChatBubble } from "../ui/ChatBubble";
import type { Ball } from "./Ball";
import type { Frog } from "./Frog";
import type { PlaceableObject, PlaceableKind } from "./PlaceableObject";

export type HamsterState =
  | "idle"
  | "wander"
  | "social"
  | "seek"
  | "use"
  | "play"
  | "followFrog"
  | "dance"
  | "busy";

export interface HamsterOptions {
  name: string;
  x: number;
  y: number;
  bodyColor: number;
  bellyColor: number;
  outlineColor: number;
  personality?: Personality;
  /** Sprite pack folder under assets/sprites/hamsters/ */
  skin?: string;
  /** Restore persisted needs instead of starting full. */
  initialNeeds?: Partial<NeedsState>;
  favoriteDiscovered?: boolean;
}

const WANDER_SPEED = 28;
const SEEK_SPEED = 34;
const PLAY_SPEED = 48;
const SPRITE_W = 31;
const SPRITE_H = 32;

const HUNGER_SEEK_BELOW = 50;
const HAPPY_ENOUGH_TO_PLAY = 75;
const SOCIAL_STOP_RANGE = 22;
const ARRIVE_EPSILON = 3;
const KICK_RANGE = 16;
/** How close a settled ball must be to trigger a return volley. */
const RETURN_NOTICE_RANGE = 72;
/** Chance an eligible hamster starts a return kick when the ball lands nearby. */
const RETURN_KICK_CHANCE = 0.28;
/** Only one hamster should chase a given ball at a time. */
const MAX_BALL_CHASERS = 1;
const FROG_FOLLOW_STOP_RANGE = 24;
/** Hand-held snack offset from hamster center (local). */
const HELD_FOOD_X = 1;
const HELD_FOOD_Y = 7;
/** Pause with food held on eat frame 0 before munching. */
const EAT_HOLD_SEC = 1.5;
const CRUMB_COLORS = [0xf5efe6, 0xe8c4a0, 0xffb4a8, 0xffe08a, 0xc4e0a8];
/** Soft cartoon note colors for dance. */
const NOTE_COLORS = [0x2a2430, 0xd4788c, 0xe4b56a, 0x7eb8d4, 0xb8a6d9];

interface MunchCrumb {
  g: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  life: number;
}

interface DanceNote {
  g: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  wobble: number;
}

interface SleepZ {
  g: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  wobble: number;
  startScale: number;
}

/** Tiny pixel-y eighth note (♪) or beamed pair (♫). */
function drawMusicNote(
  g: Phaser.GameObjects.Graphics,
  color: number,
  beamed: boolean,
): void {
  g.clear();
  g.fillStyle(color, 1);

  const drawOne = (ox: number) => {
    // Note head (tilted oval feel via ellipse).
    g.fillEllipse(ox, 3, 5, 3.5);
    // Stem
    g.fillRect(ox + 1.5, -7, 1.5, 10);
  };

  if (beamed) {
    drawOne(-3);
    drawOne(4);
    // Beam connecting stems
    g.fillRect(-1.5, -7, 9, 2);
  } else {
    drawOne(0);
    // Flag / hook
    g.fillTriangle(1.5, -7, 7, -5, 1.5, -3);
  }
}

/** Chunky cartoon Z for sleep snoring. */
function drawSleepZ(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x1a1520, 1);
  g.fillRect(-3, -4, 7, 2);
  g.fillRect(2, -3, 2, 2);
  g.fillRect(1, -1, 2, 2);
  g.fillRect(-1, 1, 2, 2);
  g.fillRect(-3, 2, 2, 2);
  g.fillRect(-3, 4, 7, 2);
}

/**
 * Hamster actor — AI + needs + frame-folder sprite animations.
 */
export class Hamster extends Phaser.GameObjects.Container {
  readonly hamsterName: string;
  readonly personality: Personality;
  readonly needs: NeedsState;
  readonly skin: string;
  /** Secret favorite snack id from the food catalog. */
  readonly favoriteFoodId: string;
  /** True after the player has fed them their favorite at least once. */
  favoriteDiscovered = false;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly chatBubble: ChatBubble;
  private aiState: HamsterState = "idle";
  private stateTimer = 0;
  private moveTarget: Phaser.Math.Vector2 | null = null;
  private targetObject: PlaceableObject | null = null;
  private readonly habitatBounds: Phaser.Geom.Rectangle;
  private placeablesRef: PlaceableObject[] = [];
  private peersRef: Hamster[] = [];
  private ballsRef: Ball[] = [];
  private frogsRef: Frog[] = [];
  private targetBall: Ball | null = null;
  private targetFrog: Frog | null = null;
  private returnKickDelay = 0;
  private preferReturnKick = false;
  private labelsSuppressed = false;
  private speechLine: string | null = null;
  private speechTimer = 0;
  private chatterCooldown = 0;
  /** Float simulation + display position for smooth upscaled movement. */
  private simX = 0;
  private simY = 0;
  private facing: WalkFacing = "down";
  private movedThisFrame = false;
  /** Tiny unique bias so equal-Y hamsters don't depth-flicker. */
  private readonly depthBias: number;
  private blinkCooldown = 0;
  /** While > 0, idle frame 0 is replaced by the blink texture. */
  private blinkTimer = 0;
  private wasAboveHappyReward = false;
  /** Earliest time (scene clock ms) this hamster can pay the >90 happiness bonus. */
  private happinessRewardReadyAt = 0;
  private wasInBadNeed = false;
  private eating = false;
  private eatDuration = 0;
  private eatTimer = 0;
  private eatHoldTimer = 0;
  private heldFood: Phaser.GameObjects.Image | null = null;
  private heldFoodStartScale = 1;
  private crumbSpawnTimer = 0;
  private readonly crumbs: MunchCrumb[] = [];
  private noteSpawnTimer = 0;
  private readonly danceNotes: DanceNote[] = [];
  private sleepZSpawnTimer = 0;
  private readonly sleepZs: SleepZ[] = [];
  /** Countdown while hunger should not drain after a feed. */
  private hungerPauseTimer = 0;
  /** Brief lockout after waking so they don't park on the nest. */
  private bedCooldown = 0;

  constructor(
    scene: Phaser.Scene,
    options: HamsterOptions,
    habitatBounds: Phaser.Geom.Rectangle,
  ) {
    super(scene, options.x, options.y);

    this.hamsterName = options.name;
    this.personality = options.personality ?? pickPersonality(options.name);
    this.favoriteFoodId = pickFavoriteFoodId(options.name);
    this.skin = options.skin ?? HAMSTER_SKIN;
    // Stable 0..0.9 bias from name so overlapping y-sorts don't fight.
    let bias = 0;
    for (let i = 0; i < options.name.length; i++) {
      bias = (bias * 31 + options.name.charCodeAt(i)) >>> 0;
    }
    this.depthBias = (bias % 900) / 1000;
    this.needs = createNeeds(options.initialNeeds);
    if (options.favoriteDiscovered) {
      this.favoriteDiscovered = true;
    }
    this.wasAboveHappyReward = this.needs.happiness > 90;
    this.wasInBadNeed = this.isInBadNeedState();
    this.habitatBounds = habitatBounds;
    this.simX = options.x;
    this.simY = options.y;
    this.syncDisplayPosition();

    this.sprite = scene.add
      .sprite(0, 0, `${this.skin}_idle_000`)
      .setOrigin(0.5, 0.5);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add(this.sprite);
    this.playClip("idle");

    this.chatBubble = new ChatBubble(scene);

    this.setSize(SPRITE_W, SPRITE_H);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-SPRITE_W / 2, -SPRITE_H / 2, SPRITE_W, SPRITE_H),
      Phaser.Geom.Rectangle.Contains,
    );

    scene.add.existing(this);
    this.setDepth(options.y + this.depthBias);
    getCameraRig(scene)?.registerWorld(this);
    this.blinkCooldown = Phaser.Math.FloatBetween(0.8, 2.2);
    this.chatterCooldown = this.rollChatterGap(true);
    this.pickNextState();
  }

  getAiState(): HamsterState {
    return this.aiState;
  }

  /** Brief lockout while player interaction runs. */
  setBusy(durationSec: number): void {
    this.releaseTargetObject();
    this.targetBall = null;
    this.targetFrog = null;
    this.clearSpeech();
    this.aiState = "busy";
    this.stateTimer = durationSec;
    this.moveTarget = null;
  }

  applyPet(): void {
    this.needs.happiness = clampNeed(this.needs.happiness + HAPPINESS_FROM_PET);
    this.setBusy(1.2);
  }

  applyFeed(food: FoodDef): { favorite: boolean } {
    const favorite = food.id === this.favoriteFoodId;
    const eatSec = favorite ? 1.8 : 1.35;
    if (favorite) {
      this.needs.hunger = 100;
      this.needs.happiness = 100;
      this.favoriteDiscovered = true;
      this.startEating(food, eatSec);
      this.speak(`${food.name}!! my favorite!!`, 3.2);
    } else {
      this.needs.hunger = clampNeed(this.needs.hunger + food.hungerRestore);
      this.needs.happiness = clampNeed(
        this.needs.happiness + HAPPINESS_FROM_EAT,
      );
      this.startEating(food, eatSec);
    }
    this.hungerPauseTimer = HUNGER_PAUSE_AFTER_FEED_SEC;
    return { favorite };
  }

  private startEating(food: FoodDef, durationSec: number): void {
    this.endEating();
    this.setBusy(EAT_HOLD_SEC + durationSec);
    this.eating = true;
    this.eatHoldTimer = EAT_HOLD_SEC;
    this.eatDuration = durationSec;
    this.eatTimer = durationSec;
    this.crumbSpawnTimer = 0;
    this.freezeEatPose();

    const held = this.scene.add
      .image(HELD_FOOD_X, HELD_FOOD_Y, food.textureKey)
      .setOrigin(0.5, 0.5)
      .setScale(1.15);
    held.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add(held);
    this.heldFood = held;
    this.heldFoodStartScale = 1.15;
  }

  private endEating(): void {
    this.eating = false;
    this.eatTimer = 0;
    this.eatDuration = 0;
    this.eatHoldTimer = 0;
    if (this.heldFood) {
      this.heldFood.destroy();
      this.heldFood = null;
    }
    for (const crumb of this.crumbs) crumb.g.destroy();
    this.crumbs.length = 0;
  }

  /** Hold first eat frame with food visible; no munching yet. */
  private freezeEatPose(): void {
    const key = animKey(this.skin, "eat");
    if (!this.scene.anims.exists(key)) return;
    const current = this.sprite.anims.currentAnim?.key;
    if (current !== key) {
      this.sprite.play(key);
    }
    this.sprite.anims.pause();
    this.sprite.anims.setProgress(0);
  }

  private startMunching(): void {
    const key = animKey(this.skin, "eat");
    if (!this.scene.anims.exists(key)) return;
    this.sprite.play(key);
  }

  private updateEating(dt: number): void {
    if (!this.eating) return;

    // Present the snack first, then start chewing.
    if (this.eatHoldTimer > 0) {
      this.eatHoldTimer -= dt;
      if (this.heldFood) {
        this.heldFood.setPosition(HELD_FOOD_X, HELD_FOOD_Y);
        this.heldFood.setScale(this.heldFoodStartScale);
        this.heldFood.setAlpha(1);
      }
      this.freezeEatPose();
      if (this.eatHoldTimer <= 0) {
        this.eatHoldTimer = 0;
        this.startMunching();
      }
      return;
    }

    this.eatTimer -= dt;
    const progress =
      this.eatDuration > 0
        ? Phaser.Math.Clamp(1 - this.eatTimer / this.eatDuration, 0, 1)
        : 1;

    if (this.heldFood) {
      // Shrink as they munch; bob slightly with the eat frames.
      const bob = Math.sin(this.eatTimer * 28) * 0.5;
      this.heldFood.setPosition(HELD_FOOD_X, HELD_FOOD_Y + bob);
      this.heldFood.setScale(
        this.heldFoodStartScale * (1 - progress * 0.88),
      );
      this.heldFood.setAlpha(1 - progress * 0.15);
    }

    this.crumbSpawnTimer -= dt;
    if (this.crumbSpawnTimer <= 0 && this.heldFood && progress < 0.92) {
      this.spawnMunchCrumbs(2 + Math.floor(Math.random() * 2));
      this.crumbSpawnTimer = Phaser.Math.FloatBetween(0.045, 0.09);
    }

    this.updateMunchCrumbs(dt);

    if (this.eatTimer <= 0) this.endEating();
  }

  private spawnMunchCrumbs(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = this.scene.add.graphics();
      const color = CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)]!;
      const size = Math.random() < 0.45 ? 1 : 2;
      g.fillStyle(color, 1);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.setPosition(
        HELD_FOOD_X + Phaser.Math.FloatBetween(-3, 3),
        HELD_FOOD_Y + Phaser.Math.FloatBetween(-2, 2),
      );
      this.add(g);
      this.crumbs.push({
        g,
        vx: Phaser.Math.FloatBetween(-38, 38),
        vy: Phaser.Math.FloatBetween(-55, -18),
        life: Phaser.Math.FloatBetween(0.22, 0.45),
      });
    }
  }

  private updateMunchCrumbs(dt: number): void {
    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const c = this.crumbs[i]!;
      c.life -= dt;
      c.vy += 120 * dt;
      c.g.x += c.vx * dt;
      c.g.y += c.vy * dt;
      c.g.setAlpha(Phaser.Math.Clamp(c.life * 3, 0, 1));
      if (c.life <= 0) {
        c.g.destroy();
        this.crumbs.splice(i, 1);
      }
    }
  }

  applyTalk(): void {
    this.needs.happiness = clampNeed(this.needs.happiness + 4);
    this.setBusy(2.8);
    // Set after setBusy so the quip isn't cleared.
    this.speak(
      pickQuip(
        this.personality,
        moodFromNeeds(
          this.needs,
          personalityTraits(this.personality).energySeekBelow,
        ),
      ),
      2.8,
    );
  }

  /**
   * When happiness crosses above 90, pays 5¢ once per 5 minutes (per hamster).
   * Returns coins earned this check (0 or 5).
   */
  collectHappinessBonus(timeMs: number): number {
    const above = this.needs.happiness > 90;
    let payout = 0;
    if (
      above &&
      !this.wasAboveHappyReward &&
      timeMs >= this.happinessRewardReadyAt
    ) {
      payout = 5;
      this.happinessRewardReadyAt = timeMs + 5 * 60 * 1000;
    }
    this.wasAboveHappyReward = above;
    return payout;
  }

  /** Rough world-space pick radius for scene-level tap handling. */
  containsWorldPoint(worldX: number, worldY: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, worldX, worldY) <= 22;
  }

  isInBadNeedState(): boolean {
    const energyFloor = personalityTraits(this.personality).energySeekBelow;
    return (
      this.needs.hunger < HUNGER_SEEK_BELOW || this.needs.energy < energyFloor
    );
  }

  getSaveState(): {
    name: string;
    x: number;
    y: number;
    needs: NeedsState;
    favoriteDiscovered: boolean;
    happinessRewardReadyIn: number;
    wasAboveHappyReward: boolean;
  } {
    return {
      name: this.hamsterName,
      x: this.simX,
      y: this.simY,
      needs: {
        hunger: this.needs.hunger,
        energy: this.needs.energy,
        happiness: this.needs.happiness,
      },
      favoriteDiscovered: this.favoriteDiscovered,
      happinessRewardReadyIn: Math.max(
        0,
        this.happinessRewardReadyAt - this.scene.time.now,
      ),
      wasAboveHappyReward: this.wasAboveHappyReward,
    };
  }

  applySaveState(state: {
    x: number;
    y: number;
    needs: NeedsState;
    favoriteDiscovered: boolean;
    happinessRewardReadyIn: number;
    wasAboveHappyReward: boolean;
  }): void {
    this.releaseTargetObject();
    this.targetBall = null;
    this.targetFrog = null;
    this.moveTarget = null;
    this.simX = state.x;
    this.simY = state.y;
    this.syncDisplayPosition();
    this.needs.hunger = state.needs.hunger;
    this.needs.energy = state.needs.energy;
    this.needs.happiness = state.needs.happiness;
    this.favoriteDiscovered = state.favoriteDiscovered;
    this.happinessRewardReadyAt =
      this.scene.time.now + state.happinessRewardReadyIn;
    this.wasAboveHappyReward = state.wasAboveHappyReward;
    this.wasInBadNeed = this.isInBadNeedState();
    this.aiState = "idle";
    this.stateTimer = Phaser.Math.FloatBetween(1, 3);
    this.pickNextState();
  }

  /** Hide name/status while the interaction menu is open on this hamster. */
  setLabelsSuppressed(suppressed: boolean): void {
    this.labelsSuppressed = suppressed;
    if (suppressed) {
      this.chatBubble.setVisible(false);
    } else {
      this.refreshSpeechLabel();
    }
  }

  updateHamster(
    dt: number,
    peers: Hamster[],
    placeables: PlaceableObject[],
    balls: Ball[] = [],
    frogs: Frog[] = [],
  ): void {
    this.placeablesRef = placeables;
    this.peersRef = peers;
    this.ballsRef = balls;
    this.frogsRef = frogs;
    this.movedThisFrame = false;

    try {
      if (this.hungerPauseTimer > 0) {
        this.hungerPauseTimer = Math.max(0, this.hungerPauseTimer - dt);
      }
      if (this.bedCooldown > 0) {
        this.bedCooldown = Math.max(0, this.bedCooldown - dt);
      }

      // Needs still tick while seeking; slow hunger drain only while sleeping.
      // Hunger stays put for a bit after a hand-feed.
      const hungerMult =
        this.hungerPauseTimer > 0
          ? 0
          : personalityTraits(this.personality).hungerDrain;
      if (this.isSleeping()) {
        tickNeeds(this.needs, dt * 0.25, hungerMult);
      } else if (this.aiState !== "busy") {
        tickNeeds(this.needs, dt, hungerMult);
      }

      // Just became hungry/sleepy — complain right away.
      const badNeed = this.isInBadNeedState();
      if (badNeed && !this.wasInBadNeed) {
        this.complainAboutNeeds();
      }
      this.wasInBadNeed = badNeed;

      // Hunger is a gentle mood penalty until it reaches zero. Sleepiness
      // keeps its stronger personality-adjusted penalty when not in bed.
      if (this.aiState !== "busy") {
        const traits = personalityTraits(this.personality);
        const hungerDrain =
          this.needs.hunger <= 0
            ? HAPPINESS_DRAIN_WHILE_STARVING
            : this.needs.hunger < HUNGER_SEEK_BELOW
              ? HAPPINESS_DRAIN_WHILE_HUNGRY * traits.happinessDrain
              : 0;
        const sleepyDrain =
          !this.isSleeping() && this.needs.energy < traits.energySeekBelow
            ? HAPPINESS_DRAIN_IN_BAD_STATE * traits.happinessDrain
            : 0;
        const happinessDrain = Math.max(hungerDrain, sleepyDrain);
        this.needs.happiness = clampNeed(
          this.needs.happiness - happinessDrain * dt,
        );
      }

      this.stateTimer -= dt;
      if (this.returnKickDelay > 0) this.returnKickDelay -= dt;

      // Ball just landed nearby — often volley it back after a beat.
      if (
        this.aiState === "idle" ||
        this.aiState === "wander" ||
        this.aiState === "social" ||
        this.aiState === "play" ||
        this.aiState === "dance"
      ) {
        this.tryNoticeReturnKick();
      }

      // Drop current idle/wander/social plan if a need becomes urgent.
      if (
        this.aiState === "idle" ||
        this.aiState === "wander" ||
        this.aiState === "social" ||
        this.aiState === "play" ||
        this.aiState === "followFrog" ||
        this.aiState === "dance"
      ) {
        if (this.tryStartObjectUse()) {
          this.targetBall = null;
          this.targetFrog = null;
          return;
        }
      }

      if (this.aiState === "busy") {
        if (this.eating) this.updateEating(dt);
        if (this.stateTimer <= 0) {
          this.endEating();
          this.pickNextState();
        }
        return;
      }

      if (this.aiState === "seek") {
        this.updateSeek(dt);
        return;
      }

      if (this.aiState === "use") {
        this.updateUse(dt);
        return;
      }

      if (this.aiState === "play") {
        this.updatePlay(dt);
        return;
      }

      if (this.aiState === "followFrog") {
        this.updateFollowFrog(dt);
        return;
      }

      if (this.aiState === "dance") {
        this.noteSpawnTimer -= dt;
        if (this.noteSpawnTimer <= 0) {
          this.spawnDanceNotes(1 + (Math.random() < 0.4 ? 1 : 0));
          this.noteSpawnTimer = Phaser.Math.FloatBetween(0.38, 0.7);
        }
        if (this.stateTimer <= 0 || this.needs.happiness < HAPPY_ENOUGH_TO_PLAY) {
          this.pickNextState();
        }
        return;
      }

      if (this.aiState === "wander" && this.moveTarget) {
        this.stepToward(this.moveTarget, dt);
        if (
          Phaser.Math.Distance.Between(
            this.x,
            this.y,
            this.moveTarget.x,
            this.moveTarget.y,
          ) < 2
        ) {
          this.moveTarget = null;
          this.pickNextState();
        } else if (this.stateTimer <= 0) {
          this.pickNextState();
        }
        return;
      }

      if (this.aiState === "social") {
        const buddy = peers.find((p) => p !== this);
        if (buddy) {
          const dist = Phaser.Math.Distance.Between(
            this.simX,
            this.simY,
            buddy.x,
            buddy.y,
          );
          if (dist > SOCIAL_STOP_RANGE) {
            this.stepToward(
              new Phaser.Math.Vector2(buddy.x, buddy.y),
              dt,
              WANDER_SPEED * 0.7,
            );
          } else {
            // Hang out nearby — face buddy without walking into them.
            const angle = Phaser.Math.Angle.Between(
              this.simX,
              this.simY,
              buddy.x,
              buddy.y,
            );
            this.facing = facingFromAngle(angle, this.facing);
            this.needs.happiness = clampNeed(this.needs.happiness + 0.5 * dt);
            buddy.needs.happiness = clampNeed(buddy.needs.happiness + 0.5 * dt);
          }
        }
        if (this.stateTimer <= 0) this.pickNextState();
        return;
      }

      // idle
      if (this.stateTimer <= 0) this.pickNextState();
    } finally {
      if (this.movedThisFrame) {
        const energyMult = personalityTraits(this.personality).energyCost;
        this.needs.energy = clampNeed(
          this.needs.energy - ENERGY_DRAIN_WHILE_MOVING * energyMult * dt,
        );
      }
      this.tickSpeech(dt);
      this.updateDanceNotes(dt);
      this.updateSleepZs(dt);
      this.updateAnimation(dt);
      this.refreshSpeechLabel();
      this.syncLabels();
    }
  }

  private syncLabels(): void {
    const cam = this.scene.cameras.main;
    const aboveHead = -(SPRITE_H / 2 + 6) * cam.zoom;
    this.chatBubble.pinToWorld(cam, this.x, this.y, aboveHead);
  }

  /**
   * Status bubble shows chat quips (player talk + autonomous chatter).
   */
  private refreshSpeechLabel(): void {
    if (this.labelsSuppressed) {
      this.chatBubble.setVisible(false);
      return;
    }

    if (this.speechLine) {
      this.chatBubble.show(this.speechLine);
      return;
    }

    this.chatBubble.hide();
  }

  private speak(
    line: string,
    durationSec: number,
    options?: { urgent?: boolean },
  ): void {
    this.speechLine = line;
    this.speechTimer = durationSec;
    if (options?.urgent) {
      // Keep need complaints frequent until the need is fixed.
      this.chatterCooldown = durationSec + Phaser.Math.FloatBetween(2, 3.5);
    } else {
      this.chatterCooldown = durationSec + this.rollChatterGap(false);
    }
  }

  private clearSpeech(): void {
    this.speechLine = null;
    this.speechTimer = 0;
    this.chatBubble.hide();
  }

  private isSleeping(): boolean {
    return this.aiState === "use" && this.targetObject?.kind === "bed";
  }

  private complainAboutNeeds(): void {
    if (this.labelsSuppressed) {
      this.chatterCooldown = 0;
      return;
    }
    // Still queue a complaint if busy; it will fire after lockout.
    if (this.aiState === "busy") {
      this.chatterCooldown = 0;
      return;
    }
    this.speak(
      pickQuip(
        this.personality,
        moodFromNeeds(
          this.needs,
          personalityTraits(this.personality).energySeekBelow,
        ),
      ),
      Phaser.Math.FloatBetween(2.4, 3.6),
      { urgent: true },
    );
  }

  private rollChatterGap(initial: boolean): number {
    const traits = personalityTraits(this.personality);
    const base = initial
      ? Phaser.Math.FloatBetween(12, 48)
      : Phaser.Math.FloatBetween(22, 55);
    return base * traits.chatterCooldown;
  }

  private tickSpeech(dt: number): void {
    if (this.labelsSuppressed) return;

    // Sleep uses floating Zs instead of chat; keep quiet while napping.
    if (this.isSleeping()) return;

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) {
        this.speechLine = null;
        this.speechTimer = 0;
      }
      return;
    }

    // Don't auto-chat over player pet/feed lockout.
    if (this.aiState === "busy") return;

    this.chatterCooldown -= dt;
    if (this.chatterCooldown > 0) return;

    // Hungry / sleepy: always keep saying so until it's fixed.
    if (this.isInBadNeedState()) {
      this.complainAboutNeeds();
      return;
    }

    const traits = personalityTraits(this.personality);
    // Often defer instead of speaking — keeps timing sparse and unsynced.
    if (Math.random() > traits.chatterChance) {
      this.chatterCooldown =
        Phaser.Math.FloatBetween(6, 20) * traits.chatterCooldown;
      return;
    }

    this.speak(
      pickQuip(
        this.personality,
        moodFromNeeds(
          this.needs,
          personalityTraits(this.personality).energySeekBelow,
        ),
      ),
      Phaser.Math.FloatBetween(2.2, 3.6),
    );
  }

  private updateSeek(dt: number): void {
    if (!this.targetObject || !this.targetObject.active) {
      this.releaseTargetObject();
      this.pickNextState();
      return;
    }

    const approach = this.targetObject.getApproachPoint(this);
    this.stepToward(approach, dt, SEEK_SPEED);

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      approach.x,
      approach.y,
    );

    if (dist <= this.targetObject.def.useRadius) {
      this.beginUse(this.targetObject);
      return;
    }

    if (this.stateTimer <= 0) {
      this.releaseTargetObject();
      this.pickNextState();
    }
  }

  private updateUse(dt: number): void {
    if (!this.targetObject) {
      this.pickNextState();
      return;
    }

    if (this.targetObject.kind === "chair") {
      // A need becoming urgent interrupts lounging.
      if (this.isInBadNeedState() || this.stateTimer <= 0) {
        this.finishFurnitureUse();
      }
      return;
    }

    this.needs.energy = clampNeed(this.needs.energy + 14 * dt);
    this.sleepZSpawnTimer -= dt;
    if (this.sleepZSpawnTimer <= 0) {
      this.spawnSleepZs(1);
      this.sleepZSpawnTimer = Phaser.Math.FloatBetween(0.55, 0.95);
    }

    if (this.stateTimer <= 0) {
      this.finishSleep();
    }
  }

  private beginUse(object: PlaceableObject): void {
    this.aiState = "use";
    this.stateTimer =
      object.kind === "bed"
        ? Phaser.Math.FloatBetween(
            object.def.useDuration - 2,
            object.def.useDuration + 2,
          ) * personalityTraits(this.personality).sleepDuration
        : Phaser.Math.FloatBetween(12, 24);
    this.moveTarget = null;
    const seat = object.getApproachPoint(this);
    this.simX = seat.x;
    this.simY = seat.y;
    this.syncDisplayPosition();

    if (object.kind === "chair") {
      return;
    }

    this.needs.happiness = clampNeed(
      this.needs.happiness + HAPPINESS_FROM_SLEEP,
    );
    this.clearSpeech();
    this.sleepZSpawnTimer = 0.2;
    object.showSleepOverlay(this);
  }

  /** Leave the nest promptly so waking doesn't look like lingering sleep. */
  private finishSleep(): void {
    this.releaseTargetObject();
    this.bedCooldown = Phaser.Math.FloatBetween(10, 16);
    this.startWander();
  }

  private finishFurnitureUse(): void {
    this.releaseTargetObject();
    this.startWander();
  }

  private pickNextState(): void {
    // Need-driven object use takes priority when something is available.
    if (this.tryStartObjectUse()) return;

    // Comfortable hamsters sometimes lounge on an open chair.
    if (this.tryStartChairSit()) return;

    // Chill types take optional naps even before energy is critical.
    if (this.tryStartChillNap()) return;

    // Content, well-rested hamsters rarely decide to trail after a frog.
    if (this.tryStartFollowFrog()) return;

    // Happy playful types may chase the ball.
    if (this.canPlayBall() && this.tryStartPlay()) return;

    // Happy hamsters sometimes bust a move instead of standing around.
    if (this.tryStartDance()) return;

    const roll = Math.random();
    // Prefer lingering in place more often than constant wandering.
    if (roll < 0.58) {
      this.aiState = "idle";
      this.stateTimer = Phaser.Math.FloatBetween(3, 8);
      this.moveTarget = null;
      this.targetBall = null;
    } else if (roll < 0.82) {
      this.startWander();
    } else {
      this.aiState = "social";
      this.stateTimer = Phaser.Math.FloatBetween(2, 4);
      this.moveTarget = null;
      this.targetBall = null;
    }
  }

  /** Chill hamsters often head to bed for a cozy nap. */
  private tryStartChillNap(): boolean {
    if (this.personality !== "chill") return false;
    if (this.bedCooldown > 0) return false;
    if (this.needs.energy >= 85) return false;
    if (Math.random() > 0.35) return false;
    const bed = this.findNearestAvailable("bed");
    if (!bed) return false;
    return this.startSeek(bed);
  }

  private tryStartChairSit(): boolean {
    if (this.isInBadNeedState()) return false;
    if (!this.scene.anims.exists(animKey(this.skin, "sit"))) return false;
    const chance = this.personality === "chill" ? 0.24 : 0.07;
    if (Math.random() > chance) return false;
    const chair = this.findNearestAvailable("chair");
    if (!chair) return false;
    return this.startSeek(chair);
  }

  private tryStartDance(): boolean {
    if (this.needs.happiness < HAPPY_ENOUGH_TO_PLAY) return false;
    if (this.isInBadNeedState()) return false;
    if (!this.scene.anims.exists(animKey(this.skin, "dance"))) return false;

    const chance =
      this.personality === "playful"
        ? 0.1
        : this.personality === "dramatic"
          ? 0.08
          : this.personality === "shy"
            ? 0.02
            : 0.05;
    if (Math.random() > chance) return false;

    this.aiState = "dance";
    this.stateTimer = Phaser.Math.FloatBetween(7, 14);
    this.moveTarget = null;
    this.targetBall = null;
    this.noteSpawnTimer = 0.12;
    return true;
  }

  private canPlayBall(): boolean {
    return (
      this.needs.happiness >= HAPPY_ENOUGH_TO_PLAY && !this.isInBadNeedState()
    );
  }

  private tryStartFollowFrog(): boolean {
    if (this.frogsRef.length === 0) return false;
    if (this.needs.happiness < HAPPY_ENOUGH_TO_PLAY) return false;
    if (this.isInBadNeedState()) return false;

    const chance = this.personality === "playful" ? 0.035 : 0.02;
    if (Math.random() > chance) return false;

    const frog = this.findNearestFrog();
    if (!frog) return false;

    this.releaseTargetObject();
    this.aiState = "followFrog";
    this.targetFrog = frog;
    this.targetBall = null;
    this.moveTarget = null;
    this.stateTimer = Phaser.Math.FloatBetween(8, 14);
    return true;
  }

  private findNearestFrog(): Frog | null {
    let best: Frog | null = null;
    let bestDist = Infinity;
    for (const frog of this.frogsRef) {
      if (!frog.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, frog.x, frog.y);
      if (dist < bestDist) {
        best = frog;
        bestDist = dist;
      }
    }
    return best;
  }

  private updateFollowFrog(dt: number): void {
    const frog = this.targetFrog;
    if (
      !frog?.active ||
      this.stateTimer <= 0 ||
      this.needs.happiness < HAPPY_ENOUGH_TO_PLAY ||
      this.isInBadNeedState()
    ) {
      this.targetFrog = null;
      this.pickNextState();
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, frog.x, frog.y);
    if (dist > FROG_FOLLOW_STOP_RANGE) {
      this.stepToward(
        new Phaser.Math.Vector2(frog.x, frog.y),
        dt,
        SEEK_SPEED,
      );
    } else {
      const angle = Phaser.Math.Angle.Between(
        this.simX,
        this.simY,
        frog.x,
        frog.y,
      );
      this.facing = facingFromAngle(angle, this.facing);
    }
  }

  /** True while this hamster is actively chasing / kicking this ball. */
  isChasingBall(ball: Ball): boolean {
    return this.aiState === "play" && this.targetBall === ball;
  }

  private ballHasOpenSlot(ball: Ball): boolean {
    let chasers = 0;
    for (const peer of this.peersRef) {
      if (peer !== this && peer.isChasingBall(ball)) chasers += 1;
    }
    return chasers < MAX_BALL_CHASERS;
  }

  private tryStartPlay(): boolean {
    if (this.ballsRef.length === 0) return false;
    // Occasional spontaneous chase — playful types a bit more often.
    const chance =
      this.personality === "playful"
        ? 0.06
        : this.personality === "shy"
          ? 0.015
          : 0.03;
    if (Math.random() > chance) return false;

    const ball = this.findNearestBall();
    if (!ball || !this.ballHasOpenSlot(ball)) return false;

    this.beginPlay(ball, false);
    return true;
  }

  /** React when a kicked ball settles near this hamster. */
  private tryNoticeReturnKick(): void {
    if (!this.canPlayBall()) return;
    if (this.returnKickDelay > 0) return;
    // Already playing — don't restart / stack another chase.
    if (this.aiState === "play") return;

    const chance =
      this.personality === "playful"
        ? RETURN_KICK_CHANCE
        : RETURN_KICK_CHANCE * 0.55;

    for (const ball of this.ballsRef) {
      if (!ball.active || !ball.justSettled || !ball.hasReturnTarget()) continue;
      if (!this.ballHasOpenSlot(ball)) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, ball.x, ball.y);
      if (d > RETURN_NOTICE_RANGE) continue;
      if (Math.random() > chance) continue;

      this.beginPlay(ball, true);
      return;
    }
  }

  private beginPlay(ball: Ball, asReturn: boolean): void {
    this.releaseTargetObject();
    this.targetBall = ball;
    this.targetObject = null;
    this.aiState = "play";
    this.preferReturnKick = asReturn && ball.hasReturnTarget();
    this.returnKickDelay = asReturn
      ? Phaser.Math.FloatBetween(0.25, 0.65)
      : 0;
    this.stateTimer = Phaser.Math.FloatBetween(4, 8);
    this.moveTarget = null;
  }

  private findNearestBall(): Ball | null {
    let best: Ball | null = null;
    let bestDist = Infinity;
    for (const ball of this.ballsRef) {
      if (!ball.active) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, ball.x, ball.y);
      if (d < bestDist) {
        bestDist = d;
        best = ball;
      }
    }
    return best;
  }

  private updatePlay(dt: number): void {
    if (!this.canPlayBall()) {
      this.targetBall = null;
      this.preferReturnKick = false;
      this.pickNextState();
      return;
    }

    const ball = this.targetBall?.active ? this.targetBall : this.findNearestBall();
    this.targetBall = ball;
    if (!ball) {
      this.preferReturnKick = false;
      this.pickNextState();
      return;
    }

    // During the return wind-up, ease toward the ball but don't kick yet.
    const waitingToReturn = this.preferReturnKick && this.returnKickDelay > 0;
    this.stepToward(
      new Phaser.Math.Vector2(ball.x, ball.y),
      dt,
      waitingToReturn ? PLAY_SPEED * 0.65 : PLAY_SPEED,
    );

    const dist = Phaser.Math.Distance.Between(this.x, this.y, ball.x, ball.y);
    if (dist <= KICK_RANGE && ball.isSettled() && !waitingToReturn) {
      if (this.preferReturnKick && ball.hasReturnTarget()) {
        ball.kickToward(
          ball.lastKickFromX,
          ball.lastKickFromY,
          this.x,
          this.y,
        );
      } else {
        ball.kickFrom(this.x, this.y);
      }

      const wasReturn = this.preferReturnKick;
      this.preferReturnKick = false;
      const energyMult = personalityTraits(this.personality).energyCost;
      this.needs.energy = clampNeed(
        this.needs.energy - ENERGY_COST_KICK * energyMult,
      );
      this.needs.happiness = clampNeed(this.needs.happiness + 1);
      // Stay in the rally more often after a return kick.
      this.stateTimer = Phaser.Math.FloatBetween(0.8, 1.6);
      const dropChance = wasReturn ? 0.28 : 0.55;
      if (Math.random() < dropChance) {
        this.targetBall = null;
        this.aiState = "idle";
      }
    }

    if (this.stateTimer <= 0) {
      this.targetBall = null;
      this.preferReturnKick = false;
      this.pickNextState();
    }
  }

  private tryStartObjectUse(): boolean {
    if (this.bedCooldown > 0) return false;
    const traits = personalityTraits(this.personality);
    const energyUrgent = this.needs.energy < traits.energySeekBelow;

    if (!energyUrgent) return false;
    const bed = this.findNearestAvailable("bed");
    return !!bed && this.startSeek(bed);
  }

  private findNearestAvailable(kind: PlaceableKind): PlaceableObject | null {
    let best: PlaceableObject | null = null;
    let bestDist = Infinity;

    for (const obj of this.placeablesRef) {
      if (obj.kind !== kind || !obj.isAvailable()) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, obj.x, obj.y);
      if (d < bestDist) {
        bestDist = d;
        best = obj;
      }
    }

    return best;
  }

  private spawnDanceNotes(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = this.scene.add.graphics();
      const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]!;
      const beamed = Math.random() < 0.28;
      drawMusicNote(g, color, beamed);
      g.setPosition(
        Phaser.Math.FloatBetween(-10, 10),
        -SPRITE_H * 0.35 + Phaser.Math.FloatBetween(-2, 2),
      );
      g.setScale(Phaser.Math.FloatBetween(0.85, 1.15));
      g.setRotation(Phaser.Math.FloatBetween(-0.25, 0.25));
      this.add(g);
      const life = Phaser.Math.FloatBetween(0.9, 1.45);
      this.danceNotes.push({
        g,
        vx: Phaser.Math.FloatBetween(-14, 14),
        vy: Phaser.Math.FloatBetween(-28, -16),
        life,
        maxLife: life,
        wobble: Phaser.Math.FloatBetween(0, Math.PI * 2),
      });
    }
  }

  private updateDanceNotes(dt: number): void {
    for (let i = this.danceNotes.length - 1; i >= 0; i--) {
      const n = this.danceNotes[i]!;
      n.life -= dt;
      n.wobble += dt * 6;
      n.g.x += (n.vx + Math.sin(n.wobble) * 10) * dt;
      n.g.y += n.vy * dt;
      n.g.setAlpha(Phaser.Math.Clamp(n.life / (n.maxLife * 0.45), 0, 1));
      n.g.setRotation(n.g.rotation + dt * 0.35 * Math.sign(n.vx || 1));
      if (n.life <= 0) {
        n.g.destroy();
        this.danceNotes.splice(i, 1);
      }
    }
  }

  private clearDanceNotes(): void {
    for (const n of this.danceNotes) n.g.destroy();
    this.danceNotes.length = 0;
  }

  private spawnSleepZs(count: number): void {
    for (let i = 0; i < count; i++) {
      const g = this.scene.add.graphics();
      drawSleepZ(g);
      // Sleep pose faces left — drift out from the snout.
      g.setPosition(
        Phaser.Math.FloatBetween(-12, -7),
        Phaser.Math.FloatBetween(-3, 2),
      );
      const startScale = Phaser.Math.FloatBetween(0.7, 0.95);
      g.setScale(startScale);
      g.setRotation(Phaser.Math.FloatBetween(-0.2, 0.35));
      this.add(g);
      const life = Phaser.Math.FloatBetween(1.1, 1.7);
      this.sleepZs.push({
        g,
        vx: Phaser.Math.FloatBetween(-18, -6),
        vy: Phaser.Math.FloatBetween(-22, -12),
        life,
        maxLife: life,
        wobble: Phaser.Math.FloatBetween(0, Math.PI * 2),
        startScale,
      });
    }
  }

  private updateSleepZs(dt: number): void {
    for (let i = this.sleepZs.length - 1; i >= 0; i--) {
      const z = this.sleepZs[i]!;
      z.life -= dt;
      z.wobble += dt * 4.5;
      const t = 1 - z.life / z.maxLife;
      z.g.x += (z.vx + Math.sin(z.wobble) * 6) * dt;
      z.g.y += z.vy * dt;
      // Classic cartoon Zs grow as they drift away.
      z.g.setScale(z.startScale * (1 + t * 0.85));
      z.g.setAlpha(Phaser.Math.Clamp(z.life / (z.maxLife * 0.4), 0, 1));
      z.g.setRotation(z.g.rotation + dt * 0.25);
      if (z.life <= 0) {
        z.g.destroy();
        this.sleepZs.splice(i, 1);
      }
    }
  }

  private clearSleepZs(): void {
    for (const z of this.sleepZs) z.g.destroy();
    this.sleepZs.length = 0;
  }

  private startSeek(object: PlaceableObject): boolean {
    this.releaseTargetObject();
    if (!object.tryReserve(this)) return false;

    this.targetObject = object;
    this.aiState = "seek";
    this.stateTimer = 8;
    this.moveTarget = object.getApproachPoint(this);
    return true;
  }

  private releaseTargetObject(): void {
    if (this.targetObject) {
      this.targetObject.release(this);
      this.targetObject = null;
    }
  }

  private startWander(): void {
    this.aiState = "wander";
    this.stateTimer = Phaser.Math.FloatBetween(1.8, 3.5);
    const pad = 16;
    this.moveTarget = new Phaser.Math.Vector2(
      Phaser.Math.Between(
        this.habitatBounds.left + pad,
        this.habitatBounds.right - pad,
      ),
      Phaser.Math.Between(
        this.habitatBounds.top + pad,
        this.habitatBounds.bottom - pad,
      ),
    );
  }

  private stepToward(
    target: Phaser.Math.Vector2,
    dt: number,
    speed = WANDER_SPEED,
  ): void {
    const dist = Phaser.Math.Distance.Between(
      this.simX,
      this.simY,
      target.x,
      target.y,
    );
    // Already on top of the target — moving would jitter angle/facing.
    if (dist < ARRIVE_EPSILON) {
      this.syncDisplayPosition();
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.simX,
      this.simY,
      target.x,
      target.y,
    );
    this.simX += Math.cos(angle) * speed * dt;
    this.simY += Math.sin(angle) * speed * dt;
    this.simX = Phaser.Math.Clamp(
      this.simX,
      this.habitatBounds.left + 10,
      this.habitatBounds.right - 10,
    );
    this.simY = Phaser.Math.Clamp(
      this.simY,
      this.habitatBounds.top + 10,
      this.habitatBounds.bottom - 16,
    );
    this.syncDisplayPosition();
    this.facing = facingFromAngle(angle, this.facing);
    this.movedThisFrame = true;
  }

  private syncDisplayPosition(): void {
    // Keep fractional world positions so upscaled canvases can interpolate
    // between game pixels (whole-pixel snap looks jittery when zoomed out).
    this.x = this.simX;
    this.y = this.simY;
    // Lower on screen (higher y) draws in front; bias breaks exact-y ties.
    this.setDepth(this.y + this.depthBias);
    if (this.isSleeping()) {
      this.targetObject?.refreshSleepLayers(this);
    }
  }

  private playClip(clip: string): void {
    const key = animKey(this.skin, clip);
    if (!this.scene.anims.exists(key)) return;
    if (this.sprite.anims.currentAnim?.key === key) return;
    this.blinkTimer = 0;
    this.sprite.play(key);
  }

  private updateAnimation(dt: number): void {
    if (this.eating) {
      this.blinkTimer = 0;
      if (this.eatHoldTimer > 0) {
        this.freezeEatPose();
      } else {
        this.playClip("eat");
      }
      return;
    }

    if (this.movedThisFrame) {
      this.playClip(`walk_${this.facing}`);
      this.blinkCooldown = Math.max(this.blinkCooldown, 0.6);
      return;
    }

    if (this.aiState === "dance") {
      this.playClip("dance");
      this.blinkCooldown = Math.max(this.blinkCooldown, 0.6);
      return;
    }

    if (this.aiState === "use" && this.targetObject?.kind === "bed") {
      this.playClip("sleep");
      this.blinkCooldown = Math.max(this.blinkCooldown, 0.6);
      return;
    }

    if (this.aiState === "use" && this.targetObject?.kind === "chair") {
      this.playClip("sit");
      this.blinkCooldown = Math.max(this.blinkCooldown, 0.6);
      return;
    }

    // Standing idle: occasionally swap blink in for one idle-frame beat.
    this.playClip("idle");
    this.updateIdleBlink(dt);
  }

  /**
   * Blink swaps the texture during idle's first frame only — the idle loop
   * itself keeps running, so its timing is never interrupted.
   */
  private updateIdleBlink(dt: number): void {
    const anims = this.sprite.anims;
    const frame = anims.currentFrame;
    const blinkTex = frameTextureKey(this.skin, "blink", "000");
    if (
      anims.currentAnim?.key !== animKey(this.skin, "idle") ||
      !frame ||
      !this.scene.textures.exists(blinkTex)
    ) {
      this.blinkTimer = 0;
      return;
    }

    if (this.blinkTimer > 0) {
      // The idle loop moved on — the blink is over either way.
      if (!frame.isFirst) {
        this.blinkTimer = 0;
        return;
      }
      this.blinkTimer -= dt;
      this.sprite.setTexture(this.blinkTimer > 0 ? blinkTex : frame.textureKey);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }

    this.blinkCooldown -= dt;
    if (this.blinkCooldown > 0) return;
    // Wait for the first frame to come back around before blinking.
    if (!frame.isFirst) return;

    const frameSec = (anims.currentAnim.msPerFrame ?? 1000 / 1.5) / 1000;
    this.blinkTimer = frameSec / 6;
    this.blinkCooldown = Phaser.Math.FloatBetween(1.4, 3.5);
    this.sprite.setTexture(blinkTex);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  destroy(fromScene?: boolean): void {
    this.endEating();
    this.clearDanceNotes();
    this.clearSleepZs();
    this.releaseTargetObject();
    this.chatBubble.destroy();
    super.destroy(fromScene);
  }
}
