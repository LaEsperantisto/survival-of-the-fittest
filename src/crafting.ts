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
  { out: "stone_pickaxe", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "stone_shovel", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "stone_axe", count: 1, needs: { rock: 3, deadwood: 2 }, bench: true },
  { out: "metal_pickaxe", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_shovel", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_axe", count: 1, needs: { metal: 2, deadwood: 1 }, bench: true },
  { out: "metal_disassembler", count: 1, needs: { metal: 4, rock: 2 }, bench: true },
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
];

/** Campfire smelting: consumes one fuel charge per item. */
export const SMELT: { in: string; out: string }[] = [
  { in: "sand", out: "glass" },
  { in: "dirt", out: "adobe" },
  { in: "sandstone", out: "rock" },
  { in: "rock", out: "ironrod" },
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
