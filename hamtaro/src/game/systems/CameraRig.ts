import Phaser from "phaser";

/**
 * Split rendering: world camera pans/zooms; UI camera stays at zoom 1.
 * Phaser still applies camera zoom to scrollFactor-0 objects, so HUD/labels
 * must live only on the UI camera.
 */
export class CameraRig {
  readonly world: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.world = scene.cameras.main;
    this.world.setName("world");
    this.world.setRoundPixels(true);

    this.ui = scene.cameras.add(
      0,
      0,
      scene.scale.width,
      scene.scale.height,
    );
    this.ui.setName("ui");
    this.ui.setZoom(1);
    this.ui.setScroll(0, 0);
    this.ui.setRoundPixels(true);
    // Overlay on top of the world camera without clearing it.
    this.ui.setBackgroundColor("rgba(0,0,0,0)");
    this.ui.transparent = true;

    scene.scale.on("resize", this.onResize, this);
  }

  destroy(scene: Phaser.Scene): void {
    scene.scale.off("resize", this.onResize, this);
  }

  /** World gameplay object — hidden from the UI camera. */
  registerWorld(object: Phaser.GameObjects.GameObject): void {
    this.ui.ignore(object);
  }

  /** HUD / labels — hidden from the world camera (avoids zoom distortion). */
  registerUi(object: Phaser.GameObjects.GameObject): void {
    this.world.ignore(object);
  }

  /** Keep the overlay camera pinned every frame. */
  update(): void {
    this.ui.setZoom(1);
    this.ui.scrollX = 0;
    this.ui.scrollY = 0;
  }

  private onResize(
    gameSize: Phaser.Structs.Size,
  ): void {
    this.ui.setSize(gameSize.width, gameSize.height);
    this.ui.setZoom(1);
    this.ui.setScroll(0, 0);
  }
}
