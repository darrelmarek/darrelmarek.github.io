import Phaser from "phaser";
import { COLORS } from "../config";
import { getFood, type FoodDef } from "../data/foods";
import {
  formatCountdown,
  getFeaturedFoods,
  getFeaturedFurniture,
  getFurniture,
  getRotationIndex,
  bumpShopRotation,
  msUntilNextRotation,
  TOY_CATALOG,
  getToy,
  type FurnitureDef,
  type FurnitureId,
  type ToyId,
} from "../systems/ShopStock";
import type { PlayerInventory } from "../systems/PlayerInventory";
import { addGameText, getCameraRig } from "./text";
import { addSmoothRoundRect, hexToCss } from "./smoothRoundRect";

export type ShopBuyEvent =
  | { kind: "furniture"; id: FurnitureId }
  | { kind: "food"; id: string }
  | { kind: "toy"; id: ToyId };

/** Prefer 2× icons; shrink only when the sprite wouldn't fit the card. */
const ICON_SCALE = 2;
const ICON_MAX_W = 96;
const ICON_MAX_H = 76;
const COLUMNS = 4;
const CARD_W = 108;
const CARD_H = 104;
const CARD_GAP_X = 112;
const PANEL_W = 500;
const PANEL_H = 480;
const CONTENT_LEFT = -CARD_GAP_X * ((COLUMNS - 1) / 2) - CARD_W / 2;
const HEADER_Y = -PANEL_H / 2 + 26;
const CLOSE_X = PANEL_W / 2 - 22;

const CONFIRM_W = 220;
const CONFIRM_H = 168;

function shelfX(index: number): number {
  return -CARD_GAP_X * ((COLUMNS - 1) / 2) + index * CARD_GAP_X;
}

/**
 * Full-screen-ish shop: rotating furniture and food shelves.
 */
export class ShopPanel extends Phaser.GameObjects.Container {
  private readonly dim: Phaser.GameObjects.Graphics;
  private readonly panelBg: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly refreshText: Phaser.GameObjects.Text;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly confirmRoot: Phaser.GameObjects.Container;
  private readonly confirmDim: Phaser.GameObjects.Graphics;
  private readonly confirmPanel: Phaser.GameObjects.Image;
  private readonly confirmIcon: Phaser.GameObjects.Image;
  private readonly confirmText: Phaser.GameObjects.Text;
  private readonly confirmBuyLabel: Phaser.GameObjects.Text;
  private readonly confirmBuyHit: Phaser.GameObjects.Zone;
  private inventory: PlayerInventory | null = null;
  private featuredFoods: FoodDef[] = [];
  private featuredFurniture: FurnitureDef[] = [];
  private rotationIndex = -1;
  private pendingBuy: ShopBuyEvent | null = null;
  private readonly onBuy: (
    event: ShopBuyEvent,
    pointer: Phaser.Input.Pointer,
  ) => boolean;
  private readonly onClose: (pointer: Phaser.Input.Pointer) => void;

  constructor(
    scene: Phaser.Scene,
    onBuy: (event: ShopBuyEvent, pointer: Phaser.Input.Pointer) => boolean,
    onClose: (pointer: Phaser.Input.Pointer) => void,
  ) {
    super(scene, 0, 0);
    this.onBuy = onBuy;
    this.onClose = onClose;

    this.dim = scene.add.graphics();
    this.dim.fillStyle(0x000000, 0.45);
    this.dim.fillRect(-960, -540, 1920, 1080);
    this.add(this.dim);

    this.panelBg = addSmoothRoundRect(scene, 0, 0, {
      width: PANEL_W,
      height: PANEL_H,
      radius: 16,
      fill: hexToCss(COLORS.uiPanel, 0.97),
      stroke: hexToCss(COLORS.uiAccent),
      strokeWidth: 2,
    });
    this.add(this.panelBg);

    this.title = addGameText(scene, 0, HEADER_Y, "shop", {
      fontSize: "22px",
      color: COLORS.uiText,
    }, false).setOrigin(0.5);
    this.add(this.title);

    this.coinsText = addGameText(scene, CONTENT_LEFT, HEADER_Y, "0¢", {
      fontSize: "16px",
      color: "#e4b56a",
    }, false).setOrigin(0, 0.5);
    this.add(this.coinsText);

    this.refreshText = addGameText(scene, CLOSE_X - 70, HEADER_Y, "new stuff in 0:00", {
      fontSize: "13px",
      color: "#cfc6b8",
    }, false).setOrigin(1, 0.5);
    this.add(this.refreshText);

    const refreshBtn = addGameText(scene, CLOSE_X - 48, HEADER_Y, "↻", {
      fontSize: "16px",
      color: COLORS.uiText,
    }, false).setOrigin(0.5);
    const refreshHit = scene.add
      .zone(CLOSE_X - 48, HEADER_Y, 28, 28)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);
    refreshHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (this.pendingBuy) return;
      this.forceRefreshStock();
    });
    this.add([refreshBtn, refreshHit]);

    this.bodyContainer = scene.add.container(0, 0);
    this.add(this.bodyContainer);

    const closeHit = scene.add
      .zone(CLOSE_X, HEADER_Y, 36, 36)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);
    const closeLabel = addGameText(scene, CLOSE_X, HEADER_Y, "✕", {
      fontSize: "18px",
      color: COLORS.uiText,
    }, false).setOrigin(0.5);
    closeHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (this.pendingBuy) {
        this.hideConfirm();
        return;
      }
      this.onClose(pointer);
    });
    this.add([closeLabel, closeHit]);

    // Dim catcher so clicks don't fall through to the world.
    const blocker = scene.add
      .zone(0, 0, 1920, 1080)
      .setInteractive()
      .setData("isUi", true);
    blocker.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
    });
    this.addAt(blocker, 0);

    this.confirmRoot = scene.add.container(0, 0).setVisible(false);
    this.confirmDim = scene.add.graphics();
    this.confirmDim.fillStyle(0x000000, 0.5);
    this.confirmDim.fillRect(-480, -280, 960, 560);
    this.confirmDim.setInteractive(
      new Phaser.Geom.Rectangle(-480, -280, 960, 560),
      Phaser.Geom.Rectangle.Contains,
    );
    this.confirmDim.setData("isUi", true);
    this.confirmDim.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.hideConfirm();
    });

    this.confirmPanel = addSmoothRoundRect(scene, 0, 0, {
      width: CONFIRM_W,
      height: CONFIRM_H,
      radius: 14,
      fill: hexToCss(COLORS.uiPanel, 0.98),
      stroke: hexToCss(COLORS.uiAccent),
      strokeWidth: 2,
    });
    // Eat clicks on the panel so they don't dismiss via the dim.
    const confirmBlocker = scene.add
      .zone(0, 0, CONFIRM_W, CONFIRM_H)
      .setInteractive()
      .setData("isUi", true);
    confirmBlocker.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
    });

    if (!scene.textures.exists("shop_confirm_blank")) {
      scene.textures.createCanvas("shop_confirm_blank", 1, 1)?.refresh();
    }
    this.confirmIcon = scene.add
      .image(0, -42, "shop_confirm_blank")
      .setOrigin(0.5)
      .setVisible(false);

    this.confirmText = addGameText(scene, 0, 8, "", {
      fontSize: "14px",
      color: COLORS.uiText,
      align: "center",
      wordWrap: { width: CONFIRM_W - 28 },
    }, false).setOrigin(0.5);

    const buyBg = addSmoothRoundRect(scene, -48, 54, {
      width: 84,
      height: 32,
      radius: 8,
      fill: hexToCss(COLORS.uiAccent, 0.95),
      stroke: hexToCss(COLORS.uiAccent),
      strokeWidth: 1,
    });
    this.confirmBuyLabel = addGameText(scene, -48, 54, "buy", {
      fontSize: "14px",
      color: "#2a2430",
    }, false).setOrigin(0.5);
    this.confirmBuyHit = scene.add
      .zone(-48, 54, 84, 32)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);
    this.confirmBuyHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.confirmPurchase(pointer);
    });

    const cancelBg = addSmoothRoundRect(scene, 48, 54, {
      width: 84,
      height: 32,
      radius: 8,
      fill: hexToCss(0x4a3f4a, 0.95),
      stroke: hexToCss(0x6a5f6a),
      strokeWidth: 1,
    });
    const cancelLabel = addGameText(scene, 48, 54, "cancel", {
      fontSize: "14px",
      color: COLORS.uiText,
    }, false).setOrigin(0.5);
    const cancelHit = scene.add
      .zone(48, 54, 84, 32)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);
    cancelHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.hideConfirm();
    });

    this.confirmRoot.add([
      this.confirmDim,
      this.confirmPanel,
      confirmBlocker,
      this.confirmIcon,
      this.confirmText,
      buyBg,
      this.confirmBuyLabel,
      this.confirmBuyHit,
      cancelBg,
      cancelLabel,
      cancelHit,
    ]);
    this.add(this.confirmRoot);

    this.setScrollFactor(0);
    this.setDepth(1200);
    this.setVisible(false);
    scene.add.existing(this);
    getCameraRig(scene)?.registerUi(this);
  }

  open(inventory: PlayerInventory): void {
    this.inventory = inventory;
    this.hideConfirm();
    this.ensureStock();
    this.rebuildBody();
    this.refreshHeader();
    this.setVisible(true);
  }

  close(): void {
    this.hideConfirm();
    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.visible;
  }

  /** Call from scene update to keep countdown / rotation fresh. */
  tick(): void {
    if (!this.visible || !this.inventory) return;
    const idx = getRotationIndex();
    if (idx !== this.rotationIndex) {
      this.ensureStock();
      this.rebuildBody();
    }
    this.refreshHeader();
    if (this.pendingBuy) this.refreshConfirmAffordability();
  }

  private ensureStock(): void {
    this.rotationIndex = getRotationIndex();
    this.featuredFurniture = getFeaturedFurniture(this.rotationIndex);
    this.featuredFoods = getFeaturedFoods(this.rotationIndex);
  }

  /** Testing helper: advance the featured shelves right away. */
  private forceRefreshStock(): void {
    bumpShopRotation();
    this.ensureStock();
    this.rebuildBody();
    this.refreshHeader();
  }

  private refreshHeader(): void {
    if (!this.inventory) return;
    this.coinsText.setText(`${this.inventory.coins}¢`);
    this.refreshText.setText(
      `new stuff in ${formatCountdown(msUntilNextRotation())}`,
    );
  }

  private rebuildBody(): void {
    this.bodyContainer.removeAll(true);
    if (!this.inventory) return;

    const furnitureLabel = addGameText(this.scene, CONTENT_LEFT, -186, "furniture", {
      fontSize: "14px",
      color: "#cfc6b8",
    }, false).setOrigin(0, 0.5);
    this.bodyContainer.add(furnitureLabel);

    this.featuredFurniture.forEach((item, i) => {
      this.bodyContainer.add(
        this.makeCard({
          x: shelfX(i),
          y: -120,
          textureKey: item.textureKey,
          name: item.name,
          price: item.price,
          owned: this.inventory?.stash[item.id] ?? 0,
          accent: hexToCss(COLORS.uiAccent, 0.8),
          onPick: () => this.showConfirm({ kind: "furniture", id: item.id }),
        }),
      );
    });

    const foodLabel = addGameText(this.scene, CONTENT_LEFT, -48, "snacks", {
      fontSize: "14px",
      color: "#cfc6b8",
    }, false).setOrigin(0, 0.5);
    this.bodyContainer.add(foodLabel);

    this.featuredFoods.forEach((food, i) => {
      this.bodyContainer.add(
        this.makeCard({
          x: shelfX(i),
          y: 18,
          textureKey: food.textureKey,
          name: food.name,
          price: food.price,
          owned: this.inventory?.getFoodCount(food.id) ?? 0,
          accent: hexToCss(0x5c534c),
          onPick: () => this.showConfirm({ kind: "food", id: food.id }),
        }),
      );
    });

    const toyLabel = addGameText(this.scene, CONTENT_LEFT, 90, "toys", {
      fontSize: "14px",
      color: "#cfc6b8",
    }, false).setOrigin(0, 0.5);
    this.bodyContainer.add(toyLabel);

    TOY_CATALOG.forEach((toy, i) => {
      this.bodyContainer.add(
        this.makeCard({
          x: shelfX(i),
          y: 156,
          textureKey: toy.textureKey,
          name: toy.name,
          price: toy.price,
          owned: this.inventory?.stash[toy.id] ?? 0,
          accent: hexToCss(0x7a6a4a),
          onPick: () => this.showConfirm({ kind: "toy", id: toy.id }),
        }),
      );
    });
  }

  private showConfirm(event: ShopBuyEvent): void {
    const info = this.describeBuy(event);
    if (!info) return;

    this.pendingBuy = event;
    this.confirmIcon
      .setTexture(info.textureKey)
      .setScale(this.iconScaleFor(info.textureKey))
      .setVisible(true);
    this.confirmIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.confirmText.setText(`buy ${info.name} for ${info.price}¢?`);
    this.refreshConfirmAffordability();
    this.confirmRoot.setVisible(true);
  }

  private hideConfirm(): void {
    this.pendingBuy = null;
    this.confirmRoot.setVisible(false);
    this.confirmIcon.setVisible(false);
  }

  private refreshConfirmAffordability(): void {
    if (!this.pendingBuy || !this.inventory) return;
    const info = this.describeBuy(this.pendingBuy);
    if (!info) return;
    const canBuy = this.inventory.canAfford(info.price);
    this.confirmBuyLabel.setText(canBuy ? "buy" : "too poor");
    this.confirmBuyLabel.setColor(canBuy ? "#2a2430" : "#cfc6b8");
    this.confirmBuyHit.setActive(canBuy).setVisible(canBuy);
  }

  private confirmPurchase(pointer: Phaser.Input.Pointer): void {
    if (!this.pendingBuy || !this.inventory) return;
    const info = this.describeBuy(this.pendingBuy);
    if (!info || !this.inventory.canAfford(info.price)) return;

    const event = this.pendingBuy;
    this.hideConfirm();
    if (this.onBuy(event, pointer)) {
      this.refreshHeader();
      this.rebuildBody();
    }
  }

  private describeBuy(
    event: ShopBuyEvent,
  ): { name: string; price: number; textureKey: string } | null {
    if (event.kind === "furniture") {
      const item = getFurniture(event.id);
      return {
        name: item.name,
        price: item.price,
        textureKey: item.textureKey,
      };
    }
    if (event.kind === "toy") {
      const toy = getToy(event.id);
      return {
        name: toy.name,
        price: toy.price,
        textureKey: toy.textureKey,
      };
    }
    const food = getFood(event.id);
    if (!food) return null;
    return {
      name: food.name,
      price: food.price,
      textureKey: food.textureKey,
    };
  }

  /** Shared card so furniture and snacks are always the same size. */
  private makeCard(options: {
    x: number;
    y: number;
    textureKey: string;
    name: string;
    price: number;
    owned: number;
    accent: string;
    onPick: () => void;
  }): Phaser.GameObjects.Container {
    const card = this.scene.add.container(options.x, options.y);
    const bg = addSmoothRoundRect(this.scene, 0, 0, {
      width: CARD_W,
      height: CARD_H,
      radius: 10,
      fill: hexToCss(0x3a323c, 0.95),
      stroke: options.accent,
      strokeWidth: 1,
    });

    const iconScale = this.iconScaleFor(options.textureKey);
    const icon = this.scene.add
      .image(0, -4, options.textureKey)
      .setOrigin(0.5)
      .setScale(iconScale);
    icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const name = addGameText(this.scene, 0, 38, options.name, {
      fontSize: "12px",
      color: COLORS.uiText,
    }, false).setOrigin(0.5);

    const price = addGameText(this.scene, -46, -46, `${options.price}¢`, {
      fontSize: "11px",
      color: "#e4b56a",
    }, false).setOrigin(0, 0);

    if (options.owned > 0) {
      const badge = addGameText(this.scene, 46, -46, `×${options.owned}`, {
        fontSize: "11px",
        color: "#8ebf9a",
      }, false).setOrigin(1, 0);
      card.add(badge);
    }

    const hit = this.scene.add
      .zone(0, 0, CARD_W, CARD_H)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      options.onPick();
    });

    card.add([bg, icon, name, price, hit]);
    return card;
  }

  /** 2× when it fits; otherwise shrink just enough for the card. */
  private iconScaleFor(textureKey: string): number {
    if (!this.scene.textures.exists(textureKey)) return ICON_SCALE;
    const frame = this.scene.textures.get(textureKey).get();
    const fit = Math.min(ICON_MAX_W / frame.width, ICON_MAX_H / frame.height);
    return Math.min(ICON_SCALE, fit);
  }

  layout(width: number, height: number): void {
    this.setPosition(width / 2, height / 2);
  }
}
