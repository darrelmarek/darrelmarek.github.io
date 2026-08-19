import type Phaser from "phaser";

/**
 * Top-level food sprites under public/assets/sprites/food/*.png
 * (ignores nested pack folders).
 */
export interface FoodDef {
  id: string;
  name: string;
  price: number;
  /** Hunger restored when the player hand-feeds this item. */
  hungerRestore: number;
  textureKey: string;
  path: string;
}

function food(
  id: string,
  name: string,
  price: number,
  hungerRestore: number,
): FoodDef {
  return {
    id,
    name,
    price,
    hungerRestore,
    textureKey: `food_${id}`,
    path: `assets/sprites/food/${id}.png`,
  };
}

/** All buyable foods (top-level sprites only). */
export const FOOD_CATALOG: FoodDef[] = [
  food("apple", "apple", 6, 30),
  food("bagel", "bagel", 8, 30),
  food("bread", "bread", 6, 30),
  food("burger", "burger", 12, 30),
  food("cake", "cake", 11, 20),
  food("carrot", "carrot", 5, 30),
  food("cheese", "cheese", 8, 30),
  food("cherries", "cherries", 7, 30),
  food("coffee", "coffee", 6, 15),
  food("corn", "corn", 6, 30),
  food("corndog", "corndog", 10, 30),
  food("croissant", "croissant", 9, 30),
  food("donut", "donut", 10, 20),
  food("eggs_fried", "eggs", 9, 30),
  food("fruit_banana", "banana", 6, 30),
  food("glizzy", "glizzy", 11, 30),
  food("ice_cream", "ice cream", 11, 20),
  food("jam", "jam", 7, 20),
  food("juice", "juice", 5, 15),
  food("melon", "melon", 7, 30),
  food("onigiri", "onigiri", 9, 30),
  food("orange", "orange", 6, 30),
  food("peach", "peach", 7, 30),
  food("pizza", "pizza", 12, 30),
  food("pretzel", "pretzel", 8, 30),
  food("pumpkin", "pumpkin", 8, 30),
  food("soda", "soda", 5, 15),
  food("strawberry", "strawberry", 7, 30),
  food("tea", "tea", 5, 15),
  food("watermelon", "watermelon", 9, 30),
];

export function getFood(id: string): FoodDef | undefined {
  return FOOD_CATALOG.find((f) => f.id === id);
}

/** Stable favorite snack for a hamster name / seed. */
export function pickFavoriteFoodId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const item = FOOD_CATALOG[hash % FOOD_CATALOG.length];
  return item?.id ?? FOOD_CATALOG[0]!.id;
}

export function loadFoodSprites(load: Phaser.Loader.LoaderPlugin): void {
  for (const item of FOOD_CATALOG) {
    load.image(item.textureKey, item.path);
  }
}
