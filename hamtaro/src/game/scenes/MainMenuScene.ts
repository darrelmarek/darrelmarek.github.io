import Phaser from "phaser";
import { COLORS } from "../config";
import { addGameText } from "../ui/text";
import { addSmoothRoundRect, hexToCss } from "../ui/smoothRoundRect";

const PLAY_W = 160;
const PLAY_H = 48;

export class MainMenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private playBtn!: Phaser.GameObjects.Container;
  private starting = false;

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.outside);
    this.starting = false;

    this.title = addGameText(
      this,
      0,
      0,
      "Hamtaro Life",
      {
        fontSize: "52px",
        color: COLORS.uiText,
        stroke: "#2a2430",
        strokeThickness: 6,
      },
      false,
    ).setOrigin(0.5);

    const bg = addSmoothRoundRect(this, 0, 0, {
      width: PLAY_W,
      height: PLAY_H,
      radius: 14,
      fill: hexToCss(COLORS.uiPanel, 0.94),
      stroke: hexToCss(COLORS.uiAccent),
      strokeWidth: 2,
    });

    const label = addGameText(
      this,
      0,
      0,
      "Play",
      {
        fontSize: "22px",
        color: COLORS.uiText,
      },
      false,
    ).setOrigin(0.5);

    const hit = this.add
      .zone(0, 0, PLAY_W, PLAY_H)
      .setInteractive({ useHandCursor: true });

    hit.on("pointerover", () => this.playBtn.setScale(1.05));
    hit.on("pointerout", () => this.playBtn.setScale(1));
    hit.on("pointerdown", () => this.playBtn.setScale(0.97));
    hit.on("pointerup", () => {
      this.playBtn.setScale(1);
      this.startGame();
    });

    this.playBtn = this.add.container(0, 0, [bg, label, hit]);
    this.playBtn.setDepth(10);

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.layout();
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    this.scene.start("HabitatScene");
  }

  private layout = (): void => {
    const w = this.scale.width;
    const h = this.scale.height;
    this.title.setPosition(w / 2, h / 2 - 42);
    this.playBtn.setPosition(w / 2, h / 2 + 36);
  };
}
