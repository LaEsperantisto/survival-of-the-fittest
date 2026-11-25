// Nomad barter: every offer is a straight swap — what the Nomad wants,
// what the Nomad gives. No coin in the desert. Each camp keeps a rotating
// window of five offers, deterministic for its (x, z) and the in-game day,
// so the stock visibly changes at dawn and two visits on the same day
// always find the same table.

import { hash2 } from "./noise";

export interface Offer {
  want: { itemId: string; count: number }[];
  give: { itemId: string; count: number }[];
}

export const OFFER_POOL: Offer[] = [
  { want: [{ itemId: "rock", count: 6 }], give: [{ itemId: "metal", count: 1 }] },
  { want: [{ itemId: "sand", count: 8 }], give: [{ itemId: "glass", count: 2 }] },
  { want: [{ itemId: "cactus", count: 3 }], give: [{ itemId: "canister_empty", count: 1 }] },
  { want: [{ itemId: "prickly_pear", count: 5 }], give: [{ itemId: "canister_full", count: 1 }] },
  { want: [{ itemId: "snake_skin", count: 2 }], give: [{ itemId: "coolant_cell", count: 1 }] },
  { want: [{ itemId: "wurm_hide", count: 1 }], give: [{ itemId: "cobaltrod", count: 2 }] },
  { want: [{ itemId: "chitin", count: 4 }], give: [{ itemId: "catalyst", count: 1 }] },
  { want: [{ itemId: "metal", count: 4 }], give: [{ itemId: "copperrod", count: 2 }] },
  { want: [{ itemId: "fennec_pelt", count: 2 }], give: [{ itemId: "metal", count: 1 }] },
  { want: [{ itemId: "tortoise_shell", count: 1 }], give: [{ itemId: "canister_full", count: 2 }] },
  { want: [{ itemId: "deadwood", count: 5 }], give: [{ itemId: "adobe", count: 3 }] },
  { want: [{ itemId: "rat_raw", count: 4 }], give: [{ itemId: "prickly_pear", count: 3 }] },
  { want: [{ itemId: "stinger", count: 1 }], give: [{ itemId: "copperrod", count: 2 }] },
  { want: [{ itemId: "alabaster", count: 4 }], give: [{ itemId: "glass", count: 2 }] },
];

// The same barter rules on Silvaris: those camps swap for what that world
// mines and hunts, with a trickle of Desertis goods carried across on the
// Ship. Super Rocket Fuel is NEVER on any table — it stays craft-only.
export const SILVARIS_GOODS: Offer[] = [
  { want: [{ itemId: "metal", count: 6 }], give: [{ itemId: "titaniumrod", count: 1 }] },
  { want: [{ itemId: "metal_plating", count: 3 }], give: [{ itemId: "titaniumrod", count: 1 }] },
  { want: [{ itemId: "frost_pelt", count: 2 }], give: [{ itemId: "glass", count: 2 }] },
  { want: [{ itemId: "frost_pelt", count: 1 }], give: [{ itemId: "elec_lamp", count: 1 }] },
  { want: [{ itemId: "fennec_pelt", count: 3 }], give: [{ itemId: "glass", count: 2 }] },
  { want: [{ itemId: "brushbuck_meat", count: 4 }], give: [{ itemId: "seed_tundroot", count: 2 }] },
  { want: [{ itemId: "coal_ore", count: 6 }], give: [{ itemId: "graphite_ore", count: 2 }] },
  { want: [{ itemId: "tideback_hide", count: 1 }], give: [{ itemId: "canister_full", count: 2 }] },
  { want: [{ itemId: "ember_berry", count: 5 }], give: [{ itemId: "seed_emberbush", count: 1 }] },
  { want: [{ itemId: "leadrod", count: 2 }], give: [{ itemId: "seed_oats", count: 3 }] },
];

/** The five offers on this camp's table for this in-game day. */
export function offersFor(seed: number, campX: number, campZ: number, day: number): Offer[] {
  const picks: Offer[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < 5; i++) {
    let idx = Math.floor(hash2(campX + i * 7, campZ - i * 13, seed + day * 101 + 317) * OFFER_POOL.length);
    while (taken.has(idx)) idx = (idx + 1) % OFFER_POOL.length;
    taken.add(idx);
    picks.push(OFFER_POOL[idx]);
  }
  return picks;
}
