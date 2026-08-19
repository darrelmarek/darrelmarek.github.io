export type NeedId = "hunger" | "energy" | "happiness";

export interface NeedsState {
  hunger: number;
  energy: number;
  happiness: number;
}

/** All needs start full. */
export function createNeeds(overrides?: Partial<NeedsState>): NeedsState {
  return {
    hunger: 100,
    energy: 100,
    happiness: 100,
    ...overrides,
  };
}

/** Passive hunger drain per second. Energy only drains while moving / on kick. */
export const NEED_DRAIN_PER_SEC: NeedsState = {
  hunger: 0.5, // -1 every 2 seconds (below 50; slower while fuller)
  energy: 0,
  happiness: 0,
};

/** Hunger above this drains more slowly (fuller tummies last longer). */
export const HUNGER_SLOW_DRAIN_ABOVE = 50;

/** Multiplier on hunger drain while above HUNGER_SLOW_DRAIN_ABOVE. */
export const HUNGER_DRAIN_WHEN_FULL_MULT = 0.5;

/** Energy lost each second while walking. */
export const ENERGY_DRAIN_WHILE_MOVING = 1;

/** Energy lost when kicking the ball. */
export const ENERGY_COST_KICK = 5;

/** Happiness lost each second while sleepy. */
export const HAPPINESS_DRAIN_IN_BAD_STATE = 1;

/** A hungry hamster gets unhappy gently until hunger reaches zero. */
export const HAPPINESS_DRAIN_WHILE_HUNGRY = 0.2;

/** At zero hunger, happiness drops at exactly this rate. */
export const HAPPINESS_DRAIN_WHILE_STARVING = 1;

export const HAPPINESS_FROM_EAT = 5;
export const HAPPINESS_FROM_SLEEP = 10;
export const HAPPINESS_FROM_PET = 2;

/** Seconds hunger stays full-stable after a hand-feed. */
export const HUNGER_PAUSE_AFTER_FEED_SEC = 60;

export function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function tickNeeds(
  needs: NeedsState,
  dt: number,
  hungerDrainMult = 1,
): void {
  const fullnessMult =
    needs.hunger > HUNGER_SLOW_DRAIN_ABOVE ? HUNGER_DRAIN_WHEN_FULL_MULT : 1;
  needs.hunger = clampNeed(
    needs.hunger -
      NEED_DRAIN_PER_SEC.hunger * hungerDrainMult * fullnessMult * dt,
  );
  needs.energy = clampNeed(needs.energy - NEED_DRAIN_PER_SEC.energy * dt);
  needs.happiness = clampNeed(
    needs.happiness - NEED_DRAIN_PER_SEC.happiness * dt,
  );
}
