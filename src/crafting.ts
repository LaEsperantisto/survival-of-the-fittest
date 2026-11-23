import { Inventory } from "./items";

export interface Recipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  station: "bench" | "armory" | "refinery" | null; // where it must be crafted; null = by hand
  returns?: Record<string, number>; // containers handed back after crafting (the oil bucket)
}

export const RECIPES: Recipe[] = [
  { out: "bench", count: 1, needs: { deadwood: 4 }, station: null },
  { out: "armory", count: 1, needs: { deadwood: 4, metal: 2 }, station: "bench" },
  { out: "campfire", count: 1, needs: { rock: 6, deadwood: 2 }, station: null },
  { out: "wood_pickaxe", count: 1, needs: { deadwood: 3 }, station: null },
  { out: "wood_shovel", count: 1, needs: { deadwood: 3 }, station: null },
  { out: "wood_axe", count: 1, needs: { deadwood: 3 }, station: null },
  // Alloy (tier 4): Copper Rods bound with Metal - faster tools, a better disassembler.
  { out: "alloy_pickaxe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_shovel", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_axe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_disassembler", count: 1, needs: { metal: 3, copperrod: 2, rock: 2 }, station: "bench" },
  { out: "stone_pickaxe", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "stone_shovel", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "stone_axe", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "metal_pickaxe", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_shovel", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_axe", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_disassembler", count: 1, needs: { metal: 4, rock: 2 }, station: "bench" },
  // ---- what the underground unlocks ----
  // body-slot gear, packs and visors are forged at the Armoury, not the Bench
  { out: "backpack2", count: 1, needs: { deadwood: 10, metal: 4, snake_skin: 2 }, station: "armory" },
  { out: "wurmsuit", count: 1, needs: { wurm_hide: 3, chitin: 1 }, station: "armory" },
  { out: "tortoise_cuirass", count: 1, needs: { tortoise_shell: 3, metal: 1 }, station: "armory" },
  { out: "stinger_blade", count: 1, needs: { metal: 2, stinger: 1, deadwood: 1 }, station: "bench" },
  { out: "body_regulator", count: 1, needs: { metal: 4, copperrod: 2, cobaltrod: 1, catalyst: 1 }, station: "armory" },
  { out: "coolant_cell", count: 1, needs: { salt: 2, canister_empty: 1, copperrod: 1 }, station: "bench" },
  { out: "head_lantern", count: 1, needs: { metal: 1, glass: 1, copperrod: 1, deadwood: 1 }, station: "bench" },
  { out: "curved_hull", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "hull_slope", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "thruster_nozzle", count: 1, needs: { cobaltrod: 1, copperrod: 2, metal: 1 }, station: "bench" },
  // The Ship kit: eight Corners declare the Frame, the yoke flies it, and a spare
  // Nozzle plus Rods builds a whole engine.
  { out: "frame_corner", count: 1, needs: { metal_plating: 2, copperrod: 1 }, station: "bench" },
  { out: "flight_controls", count: 1, needs: { metal_plating: 4, copperrod: 2, glass: 1 }, station: "bench" },
  { out: "thruster", count: 1, needs: { thruster_nozzle: 1, metal_plating: 4, cobaltrod: 1 }, station: "bench" },
  // Grid power (ADR-0007): the whole chain is Bench kit; Copper Rods are the wires.
  { out: "power_pole", count: 2, needs: { metal: 1, deadwood: 3 }, station: "bench" },
  { out: "power_panel", count: 1, needs: { metal: 4, copperrod: 2, glass: 1 }, station: "bench" },
  { out: "gen_wood", count: 1, needs: { metal: 4, copperrod: 2, rock: 3 }, station: "bench" },
  { out: "wind_turbine", count: 1, needs: { metal: 3, copperrod: 2, wood_log: 4 }, station: "bench" },
  { out: "solar_panel", count: 1, needs: { glass: 3, copperrod: 2, metal: 2 }, station: "bench" },
  { out: "battery", count: 1, needs: { metal: 3, copperrod: 2, salt: 3 }, station: "bench" },
  { out: "elec_lamp", count: 1, needs: { glass: 2, metal: 1, copperrod: 1 }, station: "bench" },
  { out: "inserter", count: 1, needs: { metal: 4, copperrod: 2, glass: 2 }, station: "bench" },
  { out: "planter", count: 1, needs: { wood_log: 4, metal: 2, glass: 1 }, station: "bench" },
  { out: "harvester", count: 1, needs: { metal: 5, glass: 2 }, station: "bench" },
  { out: "refinery", count: 1, needs: { metal_plating: 3, copperrod: 2, glass: 1 }, station: "bench" },
  { out: "rocket_fuel", count: 1, needs: { oil_bucket: 1, coal_ore: 1 }, station: "refinery", returns: { bucket: 1 } },
  { out: "sword", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "door", count: 1, needs: { metal: 2, deadwood: 2 }, station: "bench" },
  { out: "hull", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "lamp", count: 1, needs: { metal: 1, glass: 1, salt: 2 }, station: "bench" },
  { out: "beacon", count: 1, needs: { metal: 4, sandstone: 6, lamp: 1 }, station: "bench" },
  { out: "backpack1", count: 1, needs: { deadwood: 6, metal: 2 }, station: "armory" },
  { out: "insglass", count: 2, needs: { glass: 2, metal: 1 }, station: "bench" },
  { out: "regulator", count: 1, needs: { metal: 4, glass: 1, salt: 2 }, station: "bench" },
  // Husk repairs: the broken frame plus about half the build recipe.
  { out: "regulator", count: 1, needs: { regulator_broken: 1, metal: 2, glass: 1, salt: 1 }, station: "bench" },
  { out: "chest", count: 1, needs: { deadwood: 4 }, station: "bench" },
  { out: "visor", count: 1, needs: { metal: 2, glass: 1, salt: 2 }, station: "armory" },
  { out: "reptile_armor", count: 1, needs: { snake_skin: 3 }, station: "armory" },
  // ---- farming & building ----
  // Farm Land is never crafted — a shovel opens a furrow in real soil, that's it
  { out: "deadwood", count: 2, needs: { wood_log: 1 }, station: null },
  { out: "chest_connector", count: 1, needs: { deadwood: 1 }, station: null },
  { out: "chest_interface", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "cooking_pot", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "water_cage", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "metal_plating", count: 1, needs: { metal: 1 }, station: null },
  { out: "door_inner", count: 1, needs: { metal: 1 }, station: "bench" },
  // Alabaster masonry: everything cut from the Cave's raw stone — no catalyst.
  { out: "alab_bricks", count: 8, needs: { alabaster: 4 }, station: "bench" },
  { out: "alab_polished", count: 1, needs: { alabaster: 1 }, station: "bench" },
  { out: "alab_chiselled", count: 1, needs: { alab_bricks: 2 }, station: "bench" },
  { out: "alab_pillar", count: 1, needs: { alabaster: 2 }, station: "bench" },
  { out: "alab_fence", count: 3, needs: { alabaster: 1 }, station: "bench" },
  { out: "alab_gate", count: 1, needs: { alab_fence: 3 }, station: "bench" },
  { out: "alab_door", count: 1, needs: { alabaster: 6 }, station: "bench" },
  // Sandstorm Breaker: catalyst-free on purpose — storm-proofing must be expandable.
  { out: "storm_breaker", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "storm_breaker", count: 1, needs: { storm_breaker_broken: 1, metal: 1, glass: 1 }, station: "bench" },
  { out: "bucket", count: 1, needs: { metal: 2 }, station: "bench" },
  { out: "bed", count: 1, needs: { deadwood: 3, snake_skin: 2 }, station: "bench" },
  // ---- the Map kit ----
  { out: "surveyor_pin", count: 4, needs: { metal: 1, glass: 1 }, station: "bench" },
  { out: "tracker", count: 1, needs: { metal: 2, copperrod: 1, glass: 1 }, station: "bench" },
  // ---- Sacks (ADR-0008): canvas and cord only until the cobalt rim ----
  { out: "sack1", count: 1, needs: { deadwood: 4 }, station: "bench" },
  { out: "sack2", count: 1, needs: { deadwood: 6, metal: 2 }, station: "bench" },
  { out: "sack3", count: 1, needs: { wood_log: 4, cobaltrod: 4 }, station: "bench" },
];

/** Campfire smelting: consumes one fuel charge per item. */
export const SMELT: { in: string; out: string; n?: number }[] = [
  { in: "sand", out: "glass" },
  { in: "farmland", out: "glass" }, // Farm Land is packed dirt - the kiln doesn't care
  { in: "dirt", out: "adobe" },
  { in: "sandstone", out: "rock" },
  { in: "rock", out: "metal" }, // the landlubber's chain: one Rock bakes one Iron Rod
  { in: "rat_raw", out: "rat_cooked" },
  { in: "vulture_raw", out: "vulture_cooked" },
  // Wheat bakes at the Cooking Pot, not the Campfire — the pot is the kitchen.
  // Ore yields double: the dig is the expensive part, not the fire.
  { in: "iron_ore", out: "metal", n: 2 },
  { in: "copper_ore", out: "copperrod", n: 2 },
  { in: "cobalt_ore", out: "cobaltrod", n: 2 },
  { in: "canister_full", out: "hot_water_pouch" }, // sealed hot for the cold hours
];

// ---------------- Cooking Pot ----------------
// The Pot keeps a Coals bank like the Campfire, but each recipe decides whether
// the fire is touched: `charges` is what one cook spends from the bank (Fruit
// Salad is 0 — chopping needs no heat). Jobs are row-pressed from the Dishes
// list; ingredients come off the pot's Input Grid.
// `*fruit` / `*meat` wildcards match any item of that tag.
export const FRUIT_ITEMS = ["apple", "dune_melon", "prickly_pear"];
export const MEAT_ITEMS = ["rat_raw", "vulture_raw", "rat_cooked", "vulture_cooked"];

export interface PotRecipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  charges: number;
  seconds: number;
  side?: { item: string; n: number }; // extra output (Stew returns the Canister empty)
  tag?: "bread" | "dish";            // bumps the matching quest counter
}

export const POT_RECIPES: PotRecipe[] = [
  { out: "bread", count: 1, needs: { wheat: 1 }, charges: 1, seconds: 12, tag: "bread" },
  { out: "sugar", count: 1, needs: { sugar_cane: 1 }, charges: 1, seconds: 6 },
  { out: "stew", count: 1, needs: { "*fruit": 1, wheat: 1, "*meat": 1, canister_full: 1 }, charges: 2, seconds: 30, side: { item: "canister_empty", n: 1 }, tag: "dish" },
  { out: "fruit_salad", count: 1, needs: { "*fruit": 2, canister_full: 1 }, charges: 0, seconds: 8, side: { item: "canister_empty", n: 1 }, tag: "dish" },
  { out: "apple_pie", count: 1, needs: { apple: 2, wheat: 1, sugar: 1 }, charges: 2, seconds: 20, tag: "dish" },
];

export function potHas(inv: Inventory, r: PotRecipe): boolean {
  return Object.entries(r.needs).every(([id, n]) =>
    id === "*fruit" ? countTag(inv, FRUIT_ITEMS) >= n
    : id === "*meat" ? countTag(inv, MEAT_ITEMS) >= n
    : inv.has(id, n));
}

export function countTag(inv: Inventory, ids: string[]): number {
  let t = 0;
  for (const id of ids) t += inv.countOf(id);
  return t;
}

/** Removes a pot recipe's ingredients (specific ids first, then wildcards). */
export function potConsume(inv: Inventory, r: PotRecipe): boolean {
  if (!potHas(inv, r)) return false;
  for (const [id, n] of Object.entries(r.needs)) {
    let left = n;
    if (id === "*fruit" || id === "*meat") {
      for (const tid of id === "*fruit" ? FRUIT_ITEMS : MEAT_ITEMS) {
        if (left <= 0) break;
        left -= inv.removeItem(tid, left);
      }
    } else {
      left -= inv.removeItem(id, n);
    }
    if (left > 0) return false; // can't happen after potHas, but never half-consume
  }
  return true;
}

/** What a fuel item feeds a Campfire, in charges (a lit fire drips 1 charge per 10 real minutes). */
export const FIRE_FUEL: Record<string, number> = { kindling: 0.5, wood_log: 2, deadwood: 1, coal_ore: 6 };
/** Wood Generator burn seconds banked per fuel item fed through its panel. */
export const GEN_FUEL: Record<string, number> = { wood_log: 30, deadwood: 6 };

export function canCraft(inv: Inventory, r: Recipe): boolean {
  return Object.entries(r.needs).every(([id, n]) => inv.has(id, n));
}

/** Removes ingredients; returns leftover product count that did not fit (0 = all taken). */
export function doCraft(inv: Inventory, r: Recipe): number | null {
  if (!canCraft(inv, r)) return null;
  for (const [id, n] of Object.entries(r.needs)) inv.removeItem(id, n);
  return inv.addItem(r.out, r.count);
}
