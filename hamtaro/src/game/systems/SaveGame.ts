import type { NeedsState } from "./Needs";
import type { ShopPlaceableId, FurnitureId } from "./ShopStock";
import { FURNITURE_CATALOG, TOY_CATALOG } from "./ShopStock";

export const SAVE_STORAGE_KEY = "hamtaro-life-save";
export const SAVE_VERSION = 1;

export interface InventorySaveData {
  coins: number;
  stash: Partial<Record<ShopPlaceableId, number>>;
  foods: Record<string, number>;
}

export interface HamsterSaveData {
  name: string;
  x: number;
  y: number;
  needs: NeedsState;
  favoriteDiscovered: boolean;
  happinessRewardReadyIn: number;
  wasAboveHappyReward: boolean;
}

export interface PlacedObjectSaveData {
  id: FurnitureId;
  x: number;
  y: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: number;
  inventory: InventorySaveData;
  placeables: PlacedObjectSaveData[];
  balls: { x: number; y: number }[];
  frogs: { x: number; y: number }[];
  hamsters: HamsterSaveData[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNeedsState(value: unknown): value is NeedsState {
  if (!isRecord(value)) return false;
  return (
    typeof value.hunger === "number" &&
    typeof value.energy === "number" &&
    typeof value.happiness === "number"
  );
}

function isValidPlaceableId(id: string): id is ShopPlaceableId {
  return (
    FURNITURE_CATALOG.some((item) => item.id === id) ||
    TOY_CATALOG.some((item) => item.id === id)
  );
}

function isToyId(id: ShopPlaceableId): boolean {
  return TOY_CATALOG.some((item) => item.id === id);
}

function parseSaveData(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (typeof raw.savedAt !== "number") return null;

  const inventory = raw.inventory;
  if (!isRecord(inventory) || typeof inventory.coins !== "number") return null;
  if (!isRecord(inventory.stash) || !isRecord(inventory.foods)) return null;

  const placeables: PlacedObjectSaveData[] = [];
  if (!Array.isArray(raw.placeables)) return null;
  for (const item of raw.placeables) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || !isValidPlaceableId(item.id)) continue;
    if (typeof item.x !== "number" || typeof item.y !== "number") continue;
    if (isToyId(item.id as ShopPlaceableId)) {
      // Toys belong in balls/frogs lists, not furniture placeables.
      continue;
    }
    placeables.push({
      id: item.id as FurnitureId,
      x: item.x,
      y: item.y,
    });
  }

  const balls: { x: number; y: number }[] = [];
  if (!Array.isArray(raw.balls)) return null;
  for (const item of raw.balls) {
    if (!isRecord(item)) continue;
    if (typeof item.x !== "number" || typeof item.y !== "number") continue;
    balls.push({ x: item.x, y: item.y });
  }

  const frogs: { x: number; y: number }[] = [];
  if (!Array.isArray(raw.frogs)) return null;
  for (const item of raw.frogs) {
    if (!isRecord(item)) continue;
    if (typeof item.x !== "number" || typeof item.y !== "number") continue;
    frogs.push({ x: item.x, y: item.y });
  }

  const hamsters: HamsterSaveData[] = [];
  if (!Array.isArray(raw.hamsters)) return null;
  for (const item of raw.hamsters) {
    if (!isRecord(item)) continue;
    if (typeof item.name !== "string") continue;
    if (typeof item.x !== "number" || typeof item.y !== "number") continue;
    if (!isNeedsState(item.needs)) continue;
    hamsters.push({
      name: item.name,
      x: item.x,
      y: item.y,
      needs: item.needs,
      favoriteDiscovered: item.favoriteDiscovered === true,
      happinessRewardReadyIn:
        typeof item.happinessRewardReadyIn === "number"
          ? Math.max(0, item.happinessRewardReadyIn)
          : 0,
      wasAboveHappyReward: item.wasAboveHappyReward === true,
    });
  }

  return {
    version: SAVE_VERSION,
    savedAt: raw.savedAt,
    inventory: {
      coins: Math.max(0, Math.floor(inventory.coins)),
      stash: inventory.stash as Partial<Record<ShopPlaceableId, number>>,
      foods: inventory.foods as Record<string, number>,
    },
    placeables,
    balls,
    frogs,
    hamsters,
  };
}

export function loadSave(): SaveData | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return parseSaveData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or privacy mode — ignore.
  }
}

export function clearSave(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
