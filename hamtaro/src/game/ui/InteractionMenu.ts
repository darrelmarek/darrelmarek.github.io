import Phaser from "phaser";
import type { Hamster } from "../entities/Hamster";
import type { FoodDef } from "../data/foods";
import { COLORS } from "../config";
import { personalityColor } from "../data/quips";
import { addGameText } from "./text";
import {
  addSmoothRoundRect,
  applySmoothRoundRect,
  hexToCss,
} from "./smoothRoundRect";

export type InteractionKind = "pet" | "feed" | "talk" | "close";

interface MenuButton {
  kind: InteractionKind;
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
  x: number;
  y: number;
  width: number;
}

export type OwnedFood = { def: FoodDef; count: number };

/**
 * Screen-space caretaker menu (does not pan/zoom with the world).
 * Accent color follows the selected hamster's personality.
 */
export class InteractionMenu extends Phaser.GameObjects.Container {
  private readonly panel: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly needLines: Phaser.GameObjects.Text;
  private readonly feedHint: Phaser.GameObjects.Text;
  private readonly buttons: MenuButton[] = [];
  private readonly foodRow: Phaser.GameObjects.Container;
  private target: Hamster | null = null;
  private accent: number = COLORS.uiAccent;
  private pickingFood = false;
  private readonly onAction: (kind: InteractionKind, hamster: Hamster) => void;
  private readonly onFeedFood: (hamster: Hamster, foodId: string) => void;
  private readonly getOwnedFoods: () => OwnedFood[];

  constructor(
    scene: Phaser.Scene,
    onAction: (kind: InteractionKind, hamster: Hamster) => void,
    onFeedFood: (hamster: Hamster, foodId: string) => void,
    getOwnedFoods: () => OwnedFood[],
  ) {
    super(scene, 0, 0);
    this.onAction = onAction;
    this.onFeedFood = onFeedFood;
    this.getOwnedFoods = getOwnedFoods;

    this.panel = addSmoothRoundRect(scene, 0, 0, {
      width: 280,
      height: 116,
      radius: 10,
      fill: hexToCss(COLORS.uiPanel, 0.94),
      stroke: hexToCss(this.accent),
      strokeWidth: 2,
    });
    this.add(this.panel);

    this.title = addGameText(
      scene,
      0,
      -44,
      "",
      {
        fontSize: "18px",
        color: COLORS.uiText,
      },
      false,
    ).setOrigin(0.5, 0);
    this.add(this.title);

    this.needLines = addGameText(
      scene,
      0,
      -22,
      "",
      {
        fontSize: "13px",
        color: "#cfc6b8",
        align: "center",
      },
      false,
    ).setOrigin(0.5, 0);
    this.add(this.needLines);

    this.feedHint = addGameText(
      scene,
      0,
      14,
      "pick a snack",
      {
        fontSize: "12px",
        color: "#cfc6b8",
      },
      false,
    )
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.feedHint);

    this.foodRow = scene.add.container(0, 42);
    this.foodRow.setVisible(false);
    this.add(this.foodRow);

    this.addButton(-86, 22, "pet", "pet");
    this.addButton(0, 22, "feed", "feed");
    this.addButton(86, 22, "talk", "talk");
    this.addButton(118, -36, "✕", "close", 28);

    this.redrawChrome();

    this.setScrollFactor(0);
    this.setDepth(1000);
    this.setVisible(false);
    scene.add.existing(this);
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    kind: InteractionKind,
    width = 72,
  ): void {
    const bg = addSmoothRoundRect(this.scene, x, y, {
      width,
      height: 28,
      radius: 6,
      fill: hexToCss(kind === "close" ? 0x4a3f4a : this.accent),
    });

    const text = addGameText(
      this.scene,
      x,
      y,
      label,
      {
        fontSize: kind === "close" ? "16px" : "15px",
        color: kind === "close" ? COLORS.uiText : "#2a2430",
      },
      false,
    ).setOrigin(0.5);

    const hit = this.scene.add
      .zone(x, y, width, 28)
      .setInteractive({ useHandCursor: true })
      .setData("isUi", true);

    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (!this.target) return;
      if (kind === "close") {
        this.onAction(kind, this.target);
        return;
      }
      if (kind === "feed") {
        this.toggleFoodPicker();
        return;
      }
      if (this.pickingFood) return;
      this.hideFoodPicker();
      this.onAction(kind, this.target);
    });

    this.buttons.push({ kind, bg, label: text, hit, x, y, width });
    this.add([bg, text, hit]);
  }

  private toggleFoodPicker(): void {
    if (this.pickingFood) {
      this.hideFoodPicker();
      return;
    }
    const foods = this.getOwnedFoods();
    if (foods.length === 0) {
      this.onAction("feed", this.target!);
      return;
    }
    this.showFoodPicker(foods);
  }

  private showFoodPicker(foods: OwnedFood[]): void {
    this.pickingFood = true;
    this.foodRow.removeAll(true);

    const knownFavorite =
      this.target?.favoriteDiscovered ? this.target.favoriteFoodId : null;

    // Hide + disable action buttons so their zones can't steal snack taps.
    for (const button of this.buttons) {
      if (button.kind === "close") continue;
      button.bg.setVisible(false);
      button.label.setVisible(false);
      button.hit.disableInteractive();
    }

    const COLS = 5;
    const gapX = 48;
    const gapY = 44;
    const rows = Math.max(1, Math.ceil(foods.length / COLS));
    foods.forEach((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const colsInRow = Math.min(COLS, foods.length - row * COLS);
      const startX = -((colsInRow - 1) * gapX) / 2;
      const x = startX + col * gapX;
      const y = row * gapY;
      const slot = this.scene.add.container(x, y);

      const icon = this.scene.add
        .image(0, 0, entry.def.textureKey)
        .setScale(2)
        .setOrigin(0.5);
      icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

      const count = addGameText(
        this.scene,
        14,
        12,
        `×${entry.count}`,
        {
          fontSize: "11px",
          color: COLORS.uiText,
          stroke: "#2a2430",
          strokeThickness: 2,
        },
        false,
      ).setOrigin(0.5);

      if (knownFavorite === entry.def.id) {
        const star = addGameText(
          this.scene,
          -12,
          -12,
          "♥",
          {
            fontSize: "12px",
            color: "#f0a0b4",
          },
          false,
        ).setOrigin(0.5);
        slot.add(star);
      }

      const hit = this.scene.add
        .zone(0, 0, 46, 46)
        .setInteractive({ useHandCursor: true })
        .setData("isUi", true);
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        if (!this.target || !this.pickingFood) return;
        const hamster = this.target;
        const foodId = entry.def.id;
        this.onFeedFood(hamster, foodId);
        this.close();
      });

      slot.add([icon, count, hit]);
      // Hit on top within the slot.
      slot.bringToTop(hit);
      this.foodRow.add(slot);
    });

    this.feedHint.setVisible(true);
    this.feedHint.setPosition(0, 14);
    this.foodRow.setPosition(0, 42);
    this.foodRow.setVisible(true);
    this.bringToTop(this.foodRow);
    this.resizePanel(true, rows);
    this.reposition();
  }

  private hideFoodPicker(): void {
    this.pickingFood = false;
    this.foodRow.removeAll(true);
    this.foodRow.setVisible(false);
    this.feedHint.setVisible(false);
    this.feedHint.setPosition(0, 14);
    for (const button of this.buttons) {
      button.bg.setVisible(true);
      button.label.setVisible(true);
      button.hit.setInteractive({ useHandCursor: true });
    }
    this.resizePanel(false);
    this.reposition();
  }

  private resizePanel(expanded: boolean, foodRows = 1): void {
    const extraRows = expanded ? Math.max(0, foodRows - 1) : 0;
    const height = expanded ? 168 + extraRows * 44 : 116;
    applySmoothRoundRect(this.panel, {
      width: 280,
      height,
      radius: 10,
      fill: hexToCss(COLORS.uiPanel, 0.94),
      stroke: hexToCss(this.accent),
      strokeWidth: 2,
    });
    // Keep panel centered visually; expand downward.
    this.panel.setPosition(0, expanded ? 26 + extraRows * 22 : 0);
  }

  private redrawChrome(): void {
    this.resizePanel(this.pickingFood);

    for (const button of this.buttons) {
      applySmoothRoundRect(button.bg, {
        width: button.width,
        height: 28,
        radius: 6,
        fill: hexToCss(button.kind === "close" ? 0x4a3f4a : this.accent),
      });
      button.bg.setPosition(button.x, button.y);
    }
  }

  open(hamster: Hamster): void {
    if (this.target && this.target !== hamster) {
      this.target.setLabelsSuppressed(false);
    }
    this.hideFoodPicker();
    this.target = hamster;
    this.target.setLabelsSuppressed(true);
    this.accent = personalityColor(hamster.personality).hex;
    this.redrawChrome();
    this.title.setText(hamster.hamsterName);
    this.title.setColor(personalityColor(hamster.personality).css);
    this.refreshNeeds();
    this.reposition();
    this.setVisible(true);
  }

  close(): void {
    const hamster = this.target;
    hamster?.setLabelsSuppressed(false);
    this.target = null;
    // Hide first so picker cleanup never flashes the main buttons.
    this.setVisible(false);
    this.hideFoodPicker();
  }

  isOpen(): boolean {
    return this.visible;
  }

  isPickingFood(): boolean {
    return this.pickingFood;
  }

  refreshNeeds(): void {
    if (!this.target) return;
    const n = this.target.needs;
    this.needLines.setText(
      `hunger ${Math.round(n.hunger)}  energy ${Math.round(n.energy)}  happy ${Math.round(n.happiness)}`,
    );
  }

  updateMenu(): void {
    if (!this.visible || !this.target) return;
    this.refreshNeeds();
    this.reposition();
  }

  private reposition(): void {
    if (!this.target) return;
    const cam = this.scene.cameras.main;
    const screenX =
      cam.width / 2 + (this.target.x - (cam.scrollX + cam.width / 2)) * cam.zoom;
    const screenY =
      cam.height / 2 + (this.target.y - (cam.scrollY + cam.height / 2)) * cam.zoom;
    // Lift higher while picking snacks so the taller panel doesn't cover the hamster.
    const lift = this.pickingFood ? 150 : 90;
    this.setPosition(
      Phaser.Math.Clamp(screenX, 150, cam.width - 150),
      Phaser.Math.Clamp(screenY - lift, 70, cam.height - 80),
    );
  }
}
