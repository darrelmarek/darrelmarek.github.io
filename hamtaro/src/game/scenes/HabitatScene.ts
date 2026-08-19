import Phaser from "phaser";
import {
  COLORS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  HAMSTER_PALETTES,
} from "../config";
import {
  createAllHamsterAnims,
  loadAllHamsterSkins,
  skinForName,
} from "../data/hamsterSprites";
import { loadFoodSprites, getFood } from "../data/foods";
import { Ball, BALL_TEXTURE_KEY, BALL_TEXTURE_PATH } from "../entities/Ball";
import {
  createFrogAnims,
  Frog,
  loadFrogSprites,
} from "../entities/Frog";
import { Hamster } from "../entities/Hamster";
import { PlaceableObject } from "../entities/PlaceableObject";
import { CameraController } from "../systems/CameraController";
import { CameraRig } from "../systems/CameraRig";
import { PlayerInventory } from "../systems/PlayerInventory";
import {
  loadSave,
  SAVE_VERSION,
  writeSave,
  type HamsterSaveData,
  type SaveData,
} from "../systems/SaveGame";
import {
  FURNITURE_CATALOG,
  TOY_CATALOG,
  getFurniture,
  getToy,
  getRotationIndex,
  loadFurnitureSprites,
  type ShopPlaceableId,
} from "../systems/ShopStock";
import { InteractionMenu } from "../ui/InteractionMenu";
import { ShopPanel, type ShopBuyEvent } from "../ui/ShopPanel";
import { addGameText, setCameraRig } from "../ui/text";
import { addSmoothRoundRect, hexToCss } from "../ui/smoothRoundRect";
import { type Personality } from "../data/quips";

/** One test hamster per personality, named after matching Hamtaro cast. */
const TEST_HAMSTERS: { name: string; personality: Personality }[] = [
  { name: "dexter", personality: "chill" }, // easygoing / laid-back
  { name: "hamtaro", personality: "playful" }, // adventurous goofball
  { name: "bijou", personality: "shy" }, // timid & soft-spoken
  { name: "pashmina", personality: "dramatic" }, // stylish & theatrical
  { name: "oxnard", personality: "foodie" }, // always thinking about snacks
];

type PlaceMode = ShopPlaceableId;

const AUTOSAVE_INTERVAL_SEC = 20;

export class HabitatScene extends Phaser.Scene {
  private hamsters: Hamster[] = [];
  private placeables: PlaceableObject[] = [];
  private balls: Ball[] = [];
  private frogs: Frog[] = [];
  private menu!: InteractionMenu;
  private shop!: ShopPanel;
  private inventory = new PlayerInventory(9999);
  private cameraController!: CameraController;
  private cameraRig!: CameraRig;
  private habitatBounds!: Phaser.Geom.Rectangle;
  private placeMode: PlaceMode | null = null;
  /** upTime of a tap already handled by the shop, so the world ignores it. */
  private handledPointerUpTime = -1;
  private draggingPlaceable: PlaceableObject | null = null;
  private dragPointerId = -1;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private didDragFurniture = false;
  private hudShopBtn!: Phaser.GameObjects.Container;
  private shopBadge!: Phaser.GameObjects.Graphics;
  private lastSeenShopRotation = getRotationIndex();
  private hasOpenedShop = false;
  private hudCoins!: Phaser.GameObjects.Text;
  private hudStash!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;
  private saveTimer = 0;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    super("HabitatScene");
  }

  preload(): void {
    loadAllHamsterSkins(this.load);
    this.load.image(BALL_TEXTURE_KEY, BALL_TEXTURE_PATH);
    loadFrogSprites(this.load);
    loadFurnitureSprites(this.load);
    loadFoodSprites(this.load);
  }

  create(): void {
    createAllHamsterAnims(this.anims);
    createFrogAnims(this.anims);

    this.cameraRig = new CameraRig(this);
    setCameraRig(this, this.cameraRig);

    this.habitatBounds = new Phaser.Geom.Rectangle(
      16,
      16,
      WORLD_WIDTH - 32,
      WORLD_HEIGHT - 32,
    );
    this.drawRoom();
    this.bootstrapWorld();

    this.menu = new InteractionMenu(
      this,
      (kind, hamster) => {
        if (kind === "close") {
          this.menu.close();
          return;
        }
        if (kind === "pet") {
          hamster.applyPet();
          this.inventory.addCoins(2);
          this.refreshHud();
          this.persistGameState();
        }
        if (kind === "feed") {
          // Empty snack stash — Feed opens picker only when you have food.
          this.hudHint.setText("buy snacks in the shop first");
          this.hudHint.setVisible(true);
          this.time.delayedCall(2200, () => this.hudHint.setVisible(false));
          return;
        }
        if (kind === "talk") hamster.applyTalk();
        this.menu.refreshNeeds();
        this.time.delayedCall(400, () => this.menu.close());
      },
      (hamster, foodId) => {
        const food = this.inventory.consumeFood(foodId);
        if (!food) return;
        const { favorite } = hamster.applyFeed(food);
        this.hudHint.setText(
          favorite
            ? `${hamster.hamsterName} loves ${food.name}!`
            : `gave ${food.name}`,
        );
        this.hudHint.setVisible(true);
        this.time.delayedCall(favorite ? 2200 : 1400, () =>
          this.hudHint.setVisible(false),
        );
        this.refreshHud();
        this.persistGameState();
      },
      () => this.inventory.listFoods(),
    );
    this.cameraRig.registerUi(this.menu);

    this.shop = new ShopPanel(
      this,
      (event, pointer) => this.handleShopBuy(event, pointer),
      (pointer) => {
        this.handledPointerUpTime = pointer.upTime;
        this.shop.close();
      },
    );
    this.cameraRig.registerUi(this.shop);

    this.hudCoins = addGameText(this, 16, 16, "9999¢", {
      fontSize: "18px",
      color: "#e4b56a",
      stroke: "#2a2430",
      strokeThickness: 3,
    })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setData("isUi", true);
    this.cameraRig.registerUi(this.hudCoins);

    this.hudStash = addGameText(this, 16, 42, "", {
      fontSize: "14px",
      color: COLORS.uiText,
      stroke: "#2a2430",
      strokeThickness: 3,
    })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setData("isUi", true);
    this.cameraRig.registerUi(this.hudStash);

    this.hudHint = addGameText(this, 0, 0, "", {
      fontSize: "15px",
      color: "#f5efe6",
      stroke: "#2a2430",
      strokeThickness: 3,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(910)
      .setVisible(false)
      .setData("isUi", true);
    this.cameraRig.registerUi(this.hudHint);

    this.hudShopBtn = this.createShopButton();
    this.cameraRig.registerUi(this.hudShopBtn);

    // Tap stash line to cycle into place mode for owned furniture.
    this.hudStash.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 280, 24),
      Phaser.Geom.Rectangle.Contains,
    );
    this.hudStash.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.cycleStashPlaceMode();
    });

    this.layoutHud();
    this.refreshHud();
    this.scale.on("resize", this.layoutHud, this);

    this.cameraController = new CameraController(this, {
      shouldBlockPointer: (pointer) => this.shouldBlockCameraPan(pointer),
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.tryBeginFurnitureDrag(pointer);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.updateFurnitureDrag(pointer);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.endFurnitureDrag(pointer)) return;
      if (this.cameraController.didConsumeGesture()) return;
      if (pointer.upTime === this.handledPointerUpTime) return;
      if (this.isUiPointer(pointer)) return;
      if (this.shop.isOpen()) return;

      const worldPoint = this.screenToWorld(pointer.x, pointer.y);

      if (this.placeMode) {
        if (this.menu.isOpen()) return;
        if (!this.habitatBounds.contains(worldPoint.x, worldPoint.y)) return;

        const kind = this.placeMode;
        const stashId: ShopPlaceableId = kind;
        if (!this.inventory.takePlaceable(stashId)) {
          this.placeMode = null;
          this.refreshHud();
          return;
        }

        if (kind === "ball") {
          this.balls.push(
            new Ball(this, worldPoint.x, worldPoint.y, this.habitatBounds),
          );
        } else if (kind === "frog") {
          this.frogs.push(
            new Frog(this, worldPoint.x, worldPoint.y, this.habitatBounds),
          );
        } else {
          this.placeables.push(
            new PlaceableObject(this, worldPoint.x, worldPoint.y, kind),
          );
        }

        // Keep placing if more of the same remain.
        if (this.inventory.stash[stashId] <= 0) this.placeMode = null;
        this.refreshHud();
        this.persistGameState();
        return;
      }

      const tapped = this.pickHamsterAt(worldPoint.x, worldPoint.y);
      if (tapped) {
        this.menu.open(tapped);
      } else if (this.menu.isOpen()) {
        this.menu.close();
      }
    });
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      this.endFurnitureDrag(pointer);
    });

    this.saveTimer = 0;
    this.visibilityHandler = () => {
      if (document.visibilityState === "hidden") this.persistGameState();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onSceneShutdown, this);
    this.time.delayedCall(500, () => this.persistGameState());
  }

  private onSceneShutdown = (): void => {
    this.persistGameState();
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  };

  /** Camera must not pan when the pointer is starting a furniture drag. */
  private shouldBlockCameraPan(pointer: Phaser.Input.Pointer): boolean {
    if (this.draggingPlaceable) return true;
    if (this.isUiPointer(pointer)) return true;
    if (this.shop.isOpen() || this.placeMode || this.menu.isOpen()) return false;
    const world = this.screenToWorld(pointer.x, pointer.y);
    if (this.pickHamsterAt(world.x, world.y)) return false;
    const item = this.pickPlaceableAt(world.x, world.y);
    return !!item && !item.isBusy();
  }

  private tryBeginFurnitureDrag(pointer: Phaser.Input.Pointer): void {
    if (this.draggingPlaceable) return;
    if (this.isUiPointer(pointer)) return;
    if (this.shop.isOpen() || this.placeMode || this.menu.isOpen()) return;

    const world = this.screenToWorld(pointer.x, pointer.y);
    if (this.pickHamsterAt(world.x, world.y)) return;

    const item = this.pickPlaceableAt(world.x, world.y);
    if (!item || item.isBusy()) return;

    this.draggingPlaceable = item;
    this.dragPointerId = pointer.id;
    this.dragOffsetX = item.x - world.x;
    this.dragOffsetY = item.y - world.y;
    this.didDragFurniture = false;
    item.beginDragVisual();
  }

  private updateFurnitureDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingPlaceable) return;
    if (pointer.id !== this.dragPointerId || !pointer.isDown) return;

    const world = this.screenToWorld(pointer.x, pointer.y);
    const nextX = world.x + this.dragOffsetX;
    const nextY = world.y + this.dragOffsetY;
    if (!this.didDragFurniture) {
      const dx = nextX - this.draggingPlaceable.x;
      const dy = nextY - this.draggingPlaceable.y;
      if (Math.hypot(dx, dy) < 3) return;
      this.didDragFurniture = true;
    }
    this.draggingPlaceable.relocate(nextX, nextY, this.habitatBounds);
  }

  /** @returns true if this pointer ended a furniture drag (skip other tap actions). */
  private endFurnitureDrag(pointer: Phaser.Input.Pointer): boolean {
    if (!this.draggingPlaceable || pointer.id !== this.dragPointerId) {
      return false;
    }
    const dragged = this.didDragFurniture;
    this.draggingPlaceable.endDragVisual();
    this.draggingPlaceable = null;
    this.dragPointerId = -1;
    this.didDragFurniture = false;
    if (dragged) {
      // Don't also treat the release as a hamster tap / empty deselect.
      this.handledPointerUpTime = pointer.upTime;
      this.persistGameState();
    }
    return dragged;
  }

  private handleShopBuy(
    event: ShopBuyEvent,
    pointer: Phaser.Input.Pointer,
  ): boolean {
    // The same tap must not also count as a floor tap once the shop closes.
    this.handledPointerUpTime = pointer.upTime;

    if (event.kind === "furniture") {
      const furniture = getFurniture(event.id);
      if (!this.inventory.trySpend(furniture.price)) return false;
      this.inventory.addPlaceable(event.id);
      this.refreshHud();
      this.persistGameState();
      // Leave shop and enter place mode for what you just bought.
      this.shop.close();
      this.placeMode = event.id;
      this.hudHint.setText(
        `tap the floor to place your ${furniture.name}`,
      );
      this.hudHint.setVisible(true);
      this.time.delayedCall(2200, () => this.hudHint.setVisible(false));
      return true;
    }

    if (event.kind === "toy") {
      const toy = getToy(event.id);
      if (!this.inventory.trySpend(toy.price)) return false;
      this.inventory.addPlaceable(toy.id);
      this.refreshHud();
      this.persistGameState();
      this.shop.close();
      this.placeMode = toy.id;
      this.hudHint.setText(`tap the floor to place your ${toy.name}`);
      this.hudHint.setVisible(true);
      this.time.delayedCall(2200, () => this.hudHint.setVisible(false));
      return true;
    }

    const food = getFood(event.id);
    if (!food) return false;
    if (!this.inventory.trySpend(food.price)) return false;
    this.inventory.addFood(food.id);
    this.refreshHud();
    this.persistGameState();
    return true;
  }

  private cycleStashPlaceMode(): void {
    if (this.shop.isOpen()) return;
    const order: PlaceMode[] = [
      ...FURNITURE_CATALOG.map((item) => item.id),
      ...TOY_CATALOG.map((item) => item.id),
    ];
    const owned = order.filter((id) => this.inventory.stash[id] > 0);
    if (owned.length === 0) {
      this.placeMode = null;
      return;
    }
    const idx = this.placeMode ? owned.indexOf(this.placeMode) : -1;
    this.placeMode = owned[(idx + 1) % owned.length] ?? null;
    this.refreshHud();
  }

  private refreshHud(): void {
    this.hudCoins.setText(`${this.inventory.coins}¢`);
    const placeParts: string[] = [];
    for (const furniture of FURNITURE_CATALOG) {
      const count = this.inventory.stash[furniture.id];
      if (count > 0) placeParts.push(`${furniture.name}×${count}`);
    }
    for (const toy of TOY_CATALOG) {
      const count = this.inventory.stash[toy.id];
      if (count > 0) placeParts.push(`${toy.name}×${count}`);
    }

    if (this.placeMode) {
      const label =
        this.placeMode === "ball" || this.placeMode === "frog"
          ? getToy(this.placeMode).name
          : getFurniture(this.placeMode).name;
      this.hudStash.setText(`placing ${label}… (tap to switch)`);
    } else if (placeParts.length > 0) {
      this.hudStash.setText(`${placeParts.join("  ")} · tap to place`);
    } else {
      this.hudStash.setText("");
    }

    this.layoutHud();
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (screenX - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (screenY - cam.height / 2) / cam.zoom,
    };
  }

  private pickHamsterAt(worldX: number, worldY: number): Hamster | null {
    let best: Hamster | null = null;
    let bestDist = Infinity;
    for (const hamster of this.hamsters) {
      if (!hamster.containsWorldPoint(worldX, worldY)) continue;
      const d = Phaser.Math.Distance.Between(hamster.x, hamster.y, worldX, worldY);
      if (d < bestDist) {
        bestDist = d;
        best = hamster;
      }
    }
    return best;
  }

  /** Prefer the front-most placeable when several overlap (chairs over rugs). */
  private pickPlaceableAt(
    worldX: number,
    worldY: number,
  ): PlaceableObject | null {
    let best: PlaceableObject | null = null;
    let bestDepth = -Infinity;
    for (const obj of this.placeables) {
      if (!obj.containsWorldPoint(worldX, worldY)) continue;
      if (obj.depth >= bestDepth) {
        bestDepth = obj.depth;
        best = obj;
      }
    }
    return best;
  }

  update(time: number, delta: number): void {
    this.cameraRig.update();
    const dt = delta / 1000;

    for (const ball of this.balls) {
      ball.updateBall(dt);
    }
    for (const frog of this.frogs) {
      frog.updateFrog(dt);
    }

    let earned = 0;
    for (const hamster of this.hamsters) {
      hamster.updateHamster(
        dt,
        this.hamsters,
        this.placeables,
        this.balls,
        this.frogs,
      );
      earned += hamster.collectHappinessBonus(time);
    }
    if (earned > 0) {
      this.inventory.addCoins(earned);
      this.refreshHud();
      this.persistGameState();
    }
    this.menu.updateMenu();
    this.shop.tick();
    this.refreshShopBadge();

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL_SEC) {
      this.saveTimer = 0;
      this.persistGameState();
    }
  }

  private isUiPointer(pointer: Phaser.Input.Pointer): boolean {
    if (this.shop.isOpen()) return true;

    if (this.menu.isOpen()) {
      const dx = Math.abs(pointer.x - this.menu.x);
      const dy = Math.abs(pointer.y - this.menu.y);
      const hitH = this.menu.isPickingFood() ? 140 : 90;
      if (dx <= 140 && dy <= hitH) return true;
    }

    const hits = this.input.hitTestPointer(pointer);
    return hits.some((obj) => {
      if (obj.getData("isUi")) return true;
      const parent = (obj as Phaser.GameObjects.Zone).parentContainer;
      return !!parent?.getData("isUi");
    });
  }

  private drawRoom(): void {
    const g = this.add.graphics();
    // Below rugs, which sit far under the rest of the world objects.
    g.setDepth(-2000);
    this.cameraRig.registerWorld(g);

    g.fillStyle(COLORS.outside, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    g.fillStyle(COLORS.wall, 1);
    g.fillRect(
      this.habitatBounds.x - 16,
      this.habitatBounds.y - 16,
      this.habitatBounds.width + 32,
      this.habitatBounds.height + 32,
    );

    g.fillStyle(COLORS.floor, 1);
    g.fillRect(
      this.habitatBounds.x,
      this.habitatBounds.y,
      this.habitatBounds.width,
      this.habitatBounds.height,
    );

    // Evenly spaced 4×4 squares on an 8px lattice (same as the original floor).
    g.fillStyle(COLORS.floorGrain, 0.45);
    for (let y = this.habitatBounds.y; y < this.habitatBounds.bottom; y += 8) {
      for (let x = this.habitatBounds.x; x < this.habitatBounds.right; x += 8) {
        if ((x + y) % 16 === 0) g.fillRect(x, y, 4, 4);
      }
    }

    g.lineStyle(2, 0x457880, 1);
    g.strokeRect(
      this.habitatBounds.x,
      this.habitatBounds.y,
      this.habitatBounds.width,
      this.habitatBounds.height,
    );
  }

  private bootstrapWorld(): void {
    const save = loadSave();
    if (save) {
      this.restoreFromSave(save);
    } else {
      this.spawnStarterObjects();
      this.spawnHamsters();
      this.inventory.grantStarterFood();
    }
  }

  private restoreFromSave(save: SaveData): void {
    this.inventory.applySaveData(save.inventory);

    for (const placed of save.placeables) {
      this.placeables.push(
        new PlaceableObject(this, placed.x, placed.y, placed.id),
      );
    }
    for (const ball of save.balls) {
      this.balls.push(new Ball(this, ball.x, ball.y, this.habitatBounds));
    }
    for (const frog of save.frogs) {
      this.frogs.push(new Frog(this, frog.x, frog.y, this.habitatBounds));
    }

    const savedByName = new Map(save.hamsters.map((h) => [h.name, h]));
    this.spawnHamsters(savedByName);
  }

  private persistGameState(): void {
    writeSave({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      inventory: this.inventory.toSaveData(),
      placeables: this.placeables.map((item) => ({
        id: item.furnitureId,
        x: item.x,
        y: item.y,
      })),
      balls: this.balls
        .filter((ball) => ball.active)
        .map((ball) => ({ x: ball.x, y: ball.y })),
      frogs: this.frogs
        .filter((frog) => frog.active)
        .map((frog) => ({ x: frog.x, y: frog.y })),
      hamsters: this.hamsters.map((hamster) => hamster.getSaveState()),
    });
  }

  private spawnStarterObjects(): void {
    this.placeables.push(
      new PlaceableObject(
        this,
        WORLD_WIDTH - 140,
        WORLD_HEIGHT - 120,
        "blue_bed",
      ),
      new PlaceableObject(this, 200, WORLD_HEIGHT - 140, "pink_bed"),
    );
    this.balls.push(
      new Ball(this, WORLD_WIDTH * 0.55, WORLD_HEIGHT * 0.5, this.habitatBounds),
    );
  }

  private spawnHamsters(savedByName?: Map<string, HamsterSaveData>): void {
    const count = TEST_HAMSTERS.length;
    const cx = WORLD_WIDTH * 0.5;
    const cy = WORLD_HEIGHT * 0.5;
    const radius = Math.min(WORLD_WIDTH, WORLD_HEIGHT) * 0.22;

    this.hamsters = TEST_HAMSTERS.map(({ name, personality }, index) => {
      const palette = HAMSTER_PALETTES[index % HAMSTER_PALETTES.length]!;
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const saved = savedByName?.get(name);
      const hamster = new Hamster(
        this,
        {
          name,
          personality,
          skin: skinForName(name),
          x: saved?.x ?? cx + Math.cos(angle) * radius,
          y: saved?.y ?? cy + Math.sin(angle) * radius,
          bodyColor: palette.body,
          bellyColor: palette.belly,
          outlineColor: palette.outline,
          initialNeeds: saved?.needs,
          favoriteDiscovered: saved?.favoriteDiscovered,
        },
        this.habitatBounds,
      );
      if (saved) {
        hamster.applySaveState({
          x: saved.x,
          y: saved.y,
          needs: saved.needs,
          favoriteDiscovered: saved.favoriteDiscovered,
          happinessRewardReadyIn: saved.happinessRewardReadyIn,
          wasAboveHappyReward: saved.wasAboveHappyReward,
        });
      }
      return hamster;
    });
  }

  private createShopButton(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const bg = addSmoothRoundRect(this, 0, 0, {
      width: 88,
      height: 36,
      radius: 10,
      fill: hexToCss(COLORS.uiPanel, 0.92),
      stroke: hexToCss(COLORS.uiAccent),
      strokeWidth: 1,
    });

    const text = addGameText(this, 0, 0, "shop", {
      fontSize: "16px",
      color: COLORS.uiText,
    }).setOrigin(0.5);

    const badge = this.add.graphics();
    badge.fillStyle(0xe4455a, 1);
    badge.fillCircle(0, 0, 5);
    badge.setPosition(36, -14);
    badge.setVisible(false);
    this.shopBadge = badge;

    const hit = this.add
      .zone(0, 0, 88, 36)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);

    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.menu.close();
      this.placeMode = null;
      this.hasOpenedShop = true;
      this.lastSeenShopRotation = getRotationIndex();
      this.shopBadge.setVisible(false);
      this.shop.open(this.inventory);
      this.refreshHud();
    });

    container.add([bg, text, badge, hit]);
    container.setScrollFactor(0);
    container.setDepth(900);
    container.setData("isUi", true);
    return container;
  }

  private refreshShopBadge(): void {
    const idx = getRotationIndex();
    if (this.shop.isOpen()) {
      this.hasOpenedShop = true;
      this.lastSeenShopRotation = idx;
      this.shopBadge.setVisible(false);
      return;
    }
    this.shopBadge.setVisible(
      !this.hasOpenedShop || idx !== this.lastSeenShopRotation,
    );
  }

  private layoutHud = (): void => {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hudShopBtn.setPosition(w - 56, h - 36);
    this.hudCoins.setPosition(16, 14);
    this.hudStash.setPosition(16, 42);
    this.hudHint.setPosition(w / 2, h - 72);
    this.shop.layout(w, h);
  };
}
