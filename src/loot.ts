// World-generated Chest stores. Rolls run off a seeded hash of the Chest's
// own cell, so no two Chests hold the same hoard and no two worlds deal the
// same hands. The Silvaris tables live beside their generator in silvaris.ts.

export interface Loot { itemId: string; count: number }

/** A Nomad camp's stores: road goods and trade stock, salted and dry. */
export function campStores(rng: () => number): Loot[] {
  const out: Loot[] = [{ itemId: "canister_empty", count: 1 }, { itemId: "kindling", count: 2 + (rng() * 3 | 0) }];
  if (rng() < 0.8) out.push({ itemId: "salt", count: 1 + (rng() * 3 | 0) });
  if (rng() < 0.7) out.push({ itemId: "deadwood", count: 3 + (rng() * 4 | 0) });
  if (rng() < 0.65) out.push({ itemId: "prickly_pear", count: 1 + (rng() * 3 | 0) });
  if (rng() < 0.5) out.push({ itemId: "adobe", count: 2 + (rng() * 3 | 0) });
  if (rng() < 0.45) out.push({ itemId: "metal", count: 1 + (rng() * 2 | 0) });
  if (rng() < 0.4) out.push({ itemId: "cactus_leather", count: 1 + (rng() * 2 | 0) });
  if (rng() < 0.3) out.push({ itemId: "copperrod", count: 1 + (rng() * 2 | 0) });
  if (rng() < 0.25) out.push({ itemId: "stinger", count: 1 });
  if (rng() < 0.2) out.push({ itemId: "snake_skin", count: 1 + (rng() * 2 | 0) });
  return out;
}

/** A Grid Relic's stores: wire and salt above all — but how much, and what
 *  else survived, the relic crew never wrote down. */
export function relicStores(rng: () => number): Loot[] {
  const out: Loot[] = [{ itemId: "copperrod", count: 2 + (rng() * 3 | 0) }, { itemId: "salt", count: 1 + (rng() * 3 | 0) }];
  if (rng() < 0.7) out.push({ itemId: "metal", count: 1 + (rng() * 3 | 0) });
  if (rng() < 0.55) out.push({ itemId: "chest_connector", count: 1 + (rng() * 2 | 0) });
  if (rng() < 0.45) out.push({ itemId: "glass", count: 2 + (rng() * 4 | 0) });
  if (rng() < 0.4) out.push({ itemId: "lamp", count: 1 });
  if (rng() < 0.35) out.push({ itemId: "cobaltrod", count: 1 + (rng() * 2 | 0) });
  if (rng() < 0.3) out.push({ itemId: "adobe", count: 3 + (rng() * 4 | 0) });
  return out;
}
