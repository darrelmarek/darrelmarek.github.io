import { getFood, type FoodDef } from "../data/foods";
import type { ShopPlaceableId } from "./ShopStock";

/**
 * Player wallet + stash. Placeables are spent into placement mode;
 * foods are consumed when hand-feeding.
 */
export class PlayerInventory {
  coins: number;
  /** Counts ready to place in the habitat. */
  readonly stash: Record<ShopPlaceableId, number> = {
    blue_bed: 0,
    pink_bed: 0,
    straw_bed: 0,
    blue_round_chair: 0,
    green_round_chair: 0,
    pink_round_chair: 0,
    purple_round_chair: 0,
    yellow_round_chair: 0,
    green_pillow: 0,
    pink_pillow: 0,
    light_pillow: 0,
    hamburger_chair: 0,
    wood_chair: 0,
    turtle_chair: 0,
    blue_couch: 0,
    table: 0,
    small_table: 0,
    wood_table: 0,
    huge_plant: 0,
    flower_plant: 0,
    small_flower_plant: 0,
    bookcase: 0,
    blue_rug: 0,
    green_rug: 0,
    pink_rug: 0,
    purple_rug: 0,
    sunflower_rug: 0,
    leaf_pile: 0,
    ball: 0,
    frog: 0,
  };
  /** foodId → count */
  private readonly foods = new Map<string, number>();

  constructor(startingCoins = 120) {
    this.coins = startingCoins;
  }

  canAfford(price: number): boolean {
    return this.coins >= price;
  }

  trySpend(price: number): boolean {
    if (!this.canAfford(price)) return false;
    this.coins -= price;
    return true;
  }

  addCoins(amount: number): void {
    this.coins = Math.max(0, this.coins + Math.floor(amount));
  }

  addPlaceable(id: ShopPlaceableId, count = 1): void {
    this.stash[id] += count;
  }

  /** Take one placeable from stash for placement. */
  takePlaceable(id: ShopPlaceableId): boolean {
    if (this.stash[id] <= 0) return false;
    this.stash[id] -= 1;
    return true;
  }

  addFood(id: string, count = 1): void {
    if (!getFood(id)) return;
    this.foods.set(id, (this.foods.get(id) ?? 0) + count);
  }

  getFoodCount(id: string): number {
    return this.foods.get(id) ?? 0;
  }

  totalFoodCount(): number {
    let n = 0;
    for (const c of this.foods.values()) n += c;
    return n;
  }

  listFoods(): { def: FoodDef; count: number }[] {
    const out: { def: FoodDef; count: number }[] = [];
    for (const [id, count] of this.foods) {
      if (count <= 0) continue;
      const def = getFood(id);
      if (def) out.push({ def, count });
    }
    return out;
  }

  /** Consume one of a specific food. */
  consumeFood(id: string): FoodDef | null {
    const count = this.foods.get(id) ?? 0;
    if (count <= 0) return null;
    const def = getFood(id);
    if (!def) return null;
    if (count <= 1) this.foods.delete(id);
    else this.foods.set(id, count - 1);
    return def;
  }

  /** Consume one food (first available). Returns the def if successful. */
  consumeAnyFood(): FoodDef | null {
    for (const id of this.foods.keys()) {
      const def = this.consumeFood(id);
      if (def) return def;
    }
    return null;
  }

  /** Seed a couple free snacks so Feed works before the first shop trip. */
  grantStarterFood(): void {
    this.addFood("carrot", 2);
    this.addFood("bread", 1);
  }

  toSaveData(): {
    coins: number;
    stash: Record<ShopPlaceableId, number>;
    foods: Record<string, number>;
  } {
    const foods: Record<string, number> = {};
    for (const [id, count] of this.foods) {
      if (count > 0) foods[id] = count;
    }
    return {
      coins: this.coins,
      stash: { ...this.stash },
      foods,
    };
  }

  applySaveData(data: {
    coins: number;
    stash?: Partial<Record<ShopPlaceableId, number>>;
    foods?: Record<string, number>;
  }): void {
    this.coins = Math.max(0, Math.floor(data.coins));
    for (const key of Object.keys(this.stash) as ShopPlaceableId[]) {
      this.stash[key] = 0;
    }
    if (data.stash) {
      for (const [id, count] of Object.entries(data.stash) as [
        ShopPlaceableId,
        number,
      ][]) {
        if (typeof count === "number" && count > 0) {
          this.stash[id] = Math.floor(count);
        }
      }
    }
    this.foods.clear();
    if (data.foods) {
      for (const [id, count] of Object.entries(data.foods)) {
        if (typeof count === "number" && count > 0) {
          this.foods.set(id, Math.floor(count));
        }
      }
    }
  }
}
