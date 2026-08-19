import type Phaser from "phaser";
import { FOOD_CATALOG, type FoodDef } from "../data/foods";

export type FurnitureId =
  | "blue_bed"
  | "pink_bed"
  | "straw_bed"
  | "blue_round_chair"
  | "green_round_chair"
  | "pink_round_chair"
  | "purple_round_chair"
  | "yellow_round_chair"
  | "green_pillow"
  | "pink_pillow"
  | "light_pillow"
  | "hamburger_chair"
  | "wood_chair"
  | "turtle_chair"
  | "blue_couch"
  | "table"
  | "small_table"
  | "wood_table"
  | "huge_plant"
  | "flower_plant"
  | "small_flower_plant"
  | "bookcase"
  | "blue_rug"
  | "green_rug"
  | "pink_rug"
  | "purple_rug"
  | "sunflower_rug"
  | "leaf_pile";

export type ShopPlaceableId = FurnitureId | ToyId;

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  price: number;
  /**
   * bed/chair: hamsters use them.
   * prop: normal y-sort decor (tables, etc.).
   * rug: always drawn under everything else.
   */
  kind: "bed" | "chair" | "prop" | "rug";
  textureKey: string;
  basePath: string;
  overlayTextureKey?: string;
  overlayPath?: string;
  /** Sit/sleep offsets from the object origin. Defaults to one center seat. */
  seatOffsets?: readonly { x: number; y: number }[];
}

/** Furniture that can appear in the rotating shop shelf. */
export const FURNITURE_CATALOG: FurnitureDef[] = [
  {
    id: "blue_bed",
    name: "blue bed",
    price: 45,
    kind: "bed",
    textureKey: "furniture_blue_bed",
    basePath: "assets/sprites/objects/blue_bed/000.png",
    overlayTextureKey: "furniture_blue_bed_overlay",
    overlayPath: "assets/sprites/objects/blue_bed/001.png",
  },
  {
    id: "pink_bed",
    name: "pink bed",
    price: 45,
    kind: "bed",
    textureKey: "furniture_pink_bed",
    basePath: "assets/sprites/objects/pink_bed/000.png",
    overlayTextureKey: "furniture_pink_bed_overlay",
    overlayPath: "assets/sprites/objects/pink_bed/001.png",
  },
  {
    id: "straw_bed",
    name: "straw bed",
    price: 35,
    kind: "bed",
    textureKey: "furniture_straw_bed",
    basePath: "assets/sprites/objects/straw_bed/000.png",
    overlayTextureKey: "furniture_straw_bed_overlay",
    overlayPath: "assets/sprites/objects/straw_bed/001.png",
  },
  {
    id: "blue_round_chair",
    name: "round blue pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_blue_round_chair",
    basePath: "assets/sprites/objects/blue_round_pillow.png",
  },
  {
    id: "green_round_chair",
    name: "round green pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_green_round_chair",
    basePath: "assets/sprites/objects/green_round_pillow.png",
  },
  {
    id: "pink_round_chair",
    name: "round pink pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_pink_round_chair",
    basePath: "assets/sprites/objects/pink_round_pillow.png",
  },
  {
    id: "purple_round_chair",
    name: "round purple pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_purple_round_chair",
    basePath: "assets/sprites/objects/purple_round_pillow.png",
  },
  {
    id: "yellow_round_chair",
    name: "round yellow pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_yellow_round_chair",
    basePath: "assets/sprites/objects/yellow_round_pillow.png",
  },
  {
    id: "green_pillow",
    name: "square green pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_green_pillow",
    basePath: "assets/sprites/objects/green_pillow.png",
  },
  {
    id: "pink_pillow",
    name: "square pink pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_pink_pillow",
    basePath: "assets/sprites/objects/pink_pillow.png",
  },
  {
    id: "light_pillow",
    name: "light pillow",
    price: 30,
    kind: "chair",
    textureKey: "furniture_light_pillow",
    basePath: "assets/sprites/objects/light_pillow.png",
  },
  {
    id: "hamburger_chair",
    name: "burger chair",
    price: 40,
    kind: "chair",
    textureKey: "furniture_hamburger_chair",
    basePath: "assets/sprites/objects/hamburger_chair.png",
  },
  {
    id: "wood_chair",
    name: "wood chair",
    price: 30,
    kind: "chair",
    textureKey: "furniture_wood_chair",
    basePath: "assets/sprites/objects/wood_chair.png",
  },
  {
    id: "turtle_chair",
    name: "turtle chair",
    price: 45,
    kind: "chair",
    textureKey: "furniture_turtle_chair",
    basePath: "assets/sprites/objects/turtle_chair.png",
  },
  {
    id: "blue_couch",
    name: "blue couch",
    price: 50,
    kind: "chair",
    textureKey: "furniture_blue_couch",
    basePath: "assets/sprites/objects/blue_couch.png",
    // Two-seater: spaced on the cushions, a bit lower than regular chairs.
    seatOffsets: [
      { x: -16, y: -3 },
      { x: 16, y: -3 },
    ],
  },
  {
    id: "table",
    name: "table",
    price: 35,
    kind: "prop",
    textureKey: "furniture_table",
    basePath: "assets/sprites/objects/table.png",
  },
  {
    id: "small_table",
    name: "small table",
    price: 20,
    kind: "prop",
    textureKey: "furniture_small_table",
    basePath: "assets/sprites/objects/small_table.png",
  },
  {
    id: "wood_table",
    name: "wood table",
    price: 40,
    kind: "prop",
    textureKey: "furniture_wood_table",
    basePath: "assets/sprites/objects/wood_table.png",
  },
  {
    id: "huge_plant",
    name: "huge plant",
    price: 40,
    kind: "prop",
    textureKey: "furniture_huge_plant",
    basePath: "assets/sprites/objects/huge_plant.png",
  },
  {
    id: "flower_plant",
    name: "flower plant",
    price: 25,
    kind: "prop",
    textureKey: "furniture_flower_plant",
    basePath: "assets/sprites/objects/flower_plant.png",
  },
  {
    id: "small_flower_plant",
    name: "small flower plant",
    price: 15,
    kind: "prop",
    textureKey: "furniture_small_flower_plant",
    basePath: "assets/sprites/objects/small_flower_plant.png",
  },
  {
    id: "bookcase",
    name: "bookcase",
    price: 45,
    kind: "prop",
    textureKey: "furniture_bookcase",
    basePath: "assets/sprites/objects/bookcase.png",
  },
  {
    id: "blue_rug",
    name: "blue rug",
    price: 35,
    kind: "rug",
    textureKey: "furniture_blue_rug",
    basePath: "assets/sprites/objects/blue_rug.png",
  },
  {
    id: "green_rug",
    name: "green rug",
    price: 35,
    kind: "rug",
    textureKey: "furniture_green_rug",
    basePath: "assets/sprites/objects/green_rug.png",
  },
  {
    id: "pink_rug",
    name: "pink rug",
    price: 35,
    kind: "rug",
    textureKey: "furniture_pink_rug",
    basePath: "assets/sprites/objects/pink_rug.png",
  },
  {
    id: "purple_rug",
    name: "purple rug",
    price: 35,
    kind: "rug",
    textureKey: "furniture_purple_rug",
    basePath: "assets/sprites/objects/purple_rug.png",
  },
  {
    id: "sunflower_rug",
    name: "sunflower rug",
    price: 25,
    kind: "rug",
    textureKey: "furniture_sunflower_rug",
    basePath: "assets/sprites/objects/sunflower_rug.png",
  },
  {
    id: "leaf_pile",
    name: "leaf pile",
    price: 20,
    kind: "rug",
    textureKey: "furniture_leaf_pile",
    basePath: "assets/sprites/objects/leaf_pile.png",
  },
];

/** How often the featured furniture and food shelves rotate. */
export const FOOD_ROTATION_MS = 10 * 60 * 1000;

/** How many foods appear on the shelf at once. */
export const FOOD_STOCK_COUNT = 4;
/** How many furniture items appear on the shelf at once. */
export const FURNITURE_STOCK_COUNT = 4;

export type ToyId = "ball" | "frog";

export interface ToyDef {
  id: ToyId;
  name: string;
  price: number;
  textureKey: string;
}

/** Toys that can appear in the shop (always listed for now). */
export const TOY_CATALOG: ToyDef[] = [
  {
    id: "ball",
    name: "red ball",
    price: 25,
    textureKey: "object_ball",
  },
  {
    id: "frog",
    name: "frog",
    price: 40,
    textureKey: "frog_idle_000",
  },
];

export function getToy(id: ToyId): ToyDef {
  return TOY_CATALOG.find((item) => item.id === id)!;
}

/** Extra rotation steps from the shop's testing refresh button. */
let rotationBump = 0;

export function getRotationIndex(now = Date.now()): number {
  return Math.floor(now / FOOD_ROTATION_MS) + rotationBump;
}

export function msUntilNextRotation(now = Date.now()): number {
  return FOOD_ROTATION_MS - (now % FOOD_ROTATION_MS);
}

/** Advance the featured shelves immediately (testing helper). */
export function bumpShopRotation(): number {
  rotationBump += 1;
  return getRotationIndex();
}

/** Deterministic shuffle for a rotation slot (stable across reloads). */
export function getFeaturedFoods(rotationIndex = getRotationIndex()): FoodDef[] {
  return shuffled(FOOD_CATALOG, rotationIndex, 0x9e3779b9).slice(
    0,
    Math.min(FOOD_STOCK_COUNT, FOOD_CATALOG.length),
  );
}

export function getFeaturedFurniture(
  rotationIndex = getRotationIndex(),
): FurnitureDef[] {
  return shuffled(FURNITURE_CATALOG, rotationIndex, 0x85ebca6b).slice(
    0,
    Math.min(FURNITURE_STOCK_COUNT, FURNITURE_CATALOG.length),
  );
}

function shuffled<T>(catalog: readonly T[], rotationIndex: number, salt: number): T[] {
  const items = [...catalog];
  let seed = (Math.imul(rotationIndex, 2654435761) ^ salt) >>> 0;
  for (let i = items.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function getFurniture(id: FurnitureId): FurnitureDef {
  return FURNITURE_CATALOG.find((item) => item.id === id)!;
}

export function loadFurnitureSprites(load: Phaser.Loader.LoaderPlugin): void {
  for (const item of FURNITURE_CATALOG) {
    load.image(item.textureKey, item.basePath);
    if (item.overlayTextureKey && item.overlayPath) {
      load.image(item.overlayTextureKey, item.overlayPath);
    }
  }
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
