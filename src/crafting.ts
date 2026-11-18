import { Inventory } from "./items";

export interface Recipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  station: "bench" | "armory" | null; // where it must be crafted; null = by hand
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
  { out: "sword", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "door", count: 1, needs: { metal: 2, deadwood: 2 }, station: "bench" },
  { out: "hull", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "lamp", count: 1, needs: { metal: 1, glass: 1, salt: 2 }, station: "bench" },
  { out: "beacon", count: 1, needs: { metal: 4, sandstone: 6, lamp: 1 }, station: "bench" },
  { out: "backpack1", count: 1, needs: { deadwood: 6, metal: 2 }, station: "armory" },
  { out: "insglass", count: 2, needs: { sand: 2, catalyst: 1, metal: 1 }, station: "bench" },
  { out: "regulator", count: 1, needs: { metal: 4, glass: 1, salt: 2 }, station: "bench" },
  // Husk repairs: the broken frame plus about half the build recipe.
  { out: "regulator", count: 1, needs: { regulator_broken: 1, metal: 2, glass: 1, salt: 1 }, station: "bench" },
  { out: "chest", count: 1, needs: { deadwood: 6, metal: 1 }, station: "bench" },
  { out: "visor", count: 1, needs: { metal: 2, glass: 1, salt: 2 }, station: "armory" },
  { out: "reptile_armor", count: 1, needs: { snake_skin: 3 }, station: "armory" },
  // ---- farming & building ----
  { out: "farmland", count: 1, needs: { dirt: 1 }, station: null },
  { out: "deadwood", count: 2, needs: { wood_log: 1 }, station: null },
  { out: "chest_connector", count: 1, needs: { deadwood: 2, metal: 1 }, station: null },
  { out: "metal_plating", count: 1, needs: { metal: 1 }, station: null },
  { out: "door_inner", count: 1, needs: { metal: 1 }, station: "bench" },
  // Sandstorm Breaker: catalyst-free on purpose — storm-proofing must be expandable.
  { out: "storm_breaker", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "storm_breaker", count: 1, needs: { storm_breaker_broken: 1, metal: 1, glass: 1 }, station: "bench" },
  { out: "bucket", count: 1, needs: { metal: 2 }, station: "bench" },
  { out: "bed", count: 1, needs: { deadwood: 3, snake_skin: 2 }, station: "bench" },
  // ---- the Map kit ----
  { out: "surveyor_pin", count: 4, needs: { metal: 1, glass: 1 }, station: "bench" },
  { out: "tracker", count: 1, needs: { metal: 2, copperrod: 1, glass: 1 }, station: "bench" },
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
  { in: "wheat", out: "cooked_wheat" },
  // Ore yields double: the dig is the expensive part, not the fire.
  { in: "iron_ore", out: "metal", n: 2 },
  { in: "copper_ore", out: "copperrod", n: 2 },
  { in: "cobalt_ore", out: "cobaltrod", n: 2 },
];

export function canCraft(inv: Inventory, r: Recipe): boolean {
  return Object.entries(r.needs).every(([id, n]) => inv.has(id, n));
}

/** Removes ingredients; returns leftover product count that did not fit (0 = all taken). */
export function doCraft(inv: Inventory, r: Recipe): number | null {
  if (!canCraft(inv, r)) return null;
  for (const [id, n] of Object.entries(r.needs)) inv.removeItem(id, n);
  return inv.addItem(r.out, r.count);
}
