import { Inventory } from "./items";

export interface Recipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  bench: boolean; // requires a Crafting Bench nearby (interacted)
}

export const RECIPES: Recipe[] = [
  { out: "bench", count: 1, needs: { deadwood: 4 }, bench: false },
  { out: "campfire", count: 1, needs: { rock: 6, deadwood: 2 }, bench: false },
  { out: "wood_pickaxe", count: 1, needs: { deadwood: 3 }, bench: false },
  { out: "wood_shovel", count: 1, needs: { deadwood: 3 }, bench: false },
  { out: "wood_axe", count: 1, needs: { deadwood: 3 }, bench: false },
  // Alloy (tier 4): Copper Rods bound with Metal - faster tools, a better disassembler.
  { out: "alloy_pickaxe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, bench: true },
  { out: "alloy_shovel", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, bench: true },
  { out: "alloy_axe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, bench: true },
  { out: "alloy_disassembler", count: 1, needs: { metal: 3, copperrod: 2, rock: 2 }, bench: true },
  { out: "stone_pickaxe", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "stone_shovel", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "stone_axe", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "metal_pickaxe", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_shovel", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_axe", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_disassembler", count: 1, needs: { metal: 4, rock: 2 }, bench: true },
  // ---- what the underground unlocks ----
  { out: "backpack2", count: 1, needs: { deadwood: 10, metal: 4, snake_skin: 2 }, bench: true },
  { out: "wurmsuit", count: 1, needs: { wurm_hide: 3, chitin: 1 }, bench: true },
  { out: "tortoise_cuirass", count: 1, needs: { tortoise_shell: 3, metal: 1 }, bench: true },
  { out: "stinger_blade", count: 1, needs: { metal: 2, stinger: 1, deadwood: 1 }, bench: true },
  { out: "body_regulator", count: 1, needs: { metal: 4, copperrod: 2, cobaltrod: 1, catalyst: 1 }, bench: true },
  { out: "coolant_cell", count: 1, needs: { salt: 2, canister_empty: 1, copperrod: 1 }, bench: true },
  { out: "head_lantern", count: 1, needs: { metal: 1, glass: 1, copperrod: 1, deadwood: 1 }, bench: true },
  { out: "curved_hull", count: 2, needs: { metal: 2, sand: 2 }, bench: true },
  { out: "hull_slope", count: 2, needs: { metal: 2, sand: 2 }, bench: true },
  { out: "thruster_nozzle", count: 1, needs: { cobaltrod: 1, copperrod: 2, metal: 1 }, bench: true },
  { out: "sword", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "door", count: 1, needs: { metal: 2, deadwood: 2 }, bench: true },
  { out: "hull", count: 2, needs: { metal: 2, sand: 2 }, bench: true },
  { out: "lamp", count: 1, needs: { metal: 1, glass: 1, salt: 2 }, bench: true },
  { out: "beacon", count: 1, needs: { metal: 4, sandstone: 6, lamp: 1 }, bench: true },
  { out: "backpack1", count: 1, needs: { deadwood: 6, metal: 2 }, bench: true },
  { out: "insglass", count: 2, needs: { sand: 2, catalyst: 1, metal: 1 }, bench: true },
  { out: "regulator", count: 1, needs: { metal: 4, glass: 1, salt: 2 }, bench: true },
  { out: "chest", count: 1, needs: { deadwood: 6, metal: 1 }, bench: true },
  // the landlubber's metal chain: bake Rock into Iron Rods, forge them at a bench
  { out: "metal", count: 1, needs: { ironrod: 2 }, bench: true },
  { out: "visor", count: 1, needs: { metal: 2, glass: 1, salt: 2 }, bench: true },
  { out: "reptile_armor", count: 1, needs: { snake_skin: 3 }, bench: true },
  // ---- farming & building ----
  { out: "farmland", count: 1, needs: { dirt: 1 }, bench: false },
  { out: "chest_connector", count: 1, needs: { deadwood: 2, metal: 1 }, bench: false },
  { out: "metal_plating", count: 1, needs: { metal: 1 }, bench: false },
  { out: "door_inner", count: 1, needs: { metal: 1, deadwood: 1 }, bench: true },
  { out: "bucket", count: 1, needs: { metal: 2 }, bench: true },
  { out: "bed", count: 1, needs: { deadwood: 3, snake_skin: 2 }, bench: true },
];

/** Campfire smelting: consumes one fuel charge per item. */
export const SMELT: { in: string; out: string; n?: number }[] = [
  { in: "sand", out: "glass" },
  { in: "farmland", out: "glass" }, // Farm Land is packed dirt - the kiln doesn't care
  { in: "dirt", out: "adobe" },
  { in: "sandstone", out: "rock" },
  { in: "rock", out: "ironrod" },
  { in: "rat_raw", out: "rat_cooked" },
  { in: "vulture_raw", out: "vulture_cooked" },
  { in: "wheat", out: "cooked_wheat" },
  // Ore yields double: the dig is the expensive part, not the fire.
  { in: "iron_ore", out: "ironrod", n: 2 },
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
