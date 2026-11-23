// Silvaris — the second planet (Phase 2). Complete procedural generation,
// standalone: every shape is a pure function of (x, z, seed). world.ts wires
// this in behind its planet dispatch; nothing here reads World internals.
//
// Vocabulary mirrors gen.ts (the Desertis generator): hash-based value noise,
// soft biome weights, cave bands that crust their walls with ore, lattices of
// deterministic structures, and WATER *Source* blocks filling water columns
// exactly like the desert oasis paint — never flow levels (the desert lays no
// WATER7..WATER1 in gen; the flow sim keeps Sources stable, so the ocean does
// too: a solid Source column from floor up to sea level).

import {
  AIR, ROCK, SAND, DIRT, GRASS, WATER, SALT, SNOW, BASALT, GRAVEL,
  TITANIUM_ORE, GRAPHITE_ORE, TUNDROOT_1, TUNDROOT_2, EMBERBUSH_1, EMBERBUSH_2,
  INSCRIPTION, DOCK_PAD, METAL_PLATING, GLASS, DOOR_CLOSED, DOOR_UPPER,
  BED, BED_EXT, CHEST, LAMP, IRON_ORE, COPPER_ORE, COAL_ORE, CAMPFIRE,
  CS, CH,
} from "./blocks";
import { fbm2, ridge2, value2, hash2, Rng } from "./noise";
import { treePlan } from "./gen";

/** Planet constants. Sea level is exactly 34: the topmost water block of any
 *  ocean column sits at y=34. Terrain never rises above y=150 — the sky
 *  ceiling (CH=160) always keeps ten cells clear. ARR_Y is the top surface
 *  of the guaranteed arrival plateau at the origin. */
export const SILVARIS = { sea: 34, arrY: 36 };
export const SIL_SEA = SILVARIS.sea;
export const SIL_PEAK_MAX = 150;
export const ARR_Y = SILVARIS.arrY;

// Biomes
export const SB_DEEP = 0, SB_SHALLOWS = 1, SB_PLAINS = 2, SB_BOREAL = 3, SB_ALPINE = 4, SB_SCORCH = 5;
export const SIL_BIOME_NAMES = ["Deep Ocean", "Shallows", "Temperate Plains", "Boreal Forest", "Alpine Peaks", "Scorch Belt"];
export const biomeName = (b: number): string => SIL_BIOME_NAMES[b] ?? "?";

/** Arrival zone: force-flat GRASS plateau centred at (0,0) with a DOCK_PAD
 *  cross at ARR_Y, fully clear above. arrivalClear() reports the core. */
const ARR_R = 17;   // flat out to r=17 so every cell of the 24x24 arrival square is level
const ARR_F = 31;   // feather out to natural terrain by here

/** Settlement lattice: ~one per 15 chunks (CS=16). Centres jitter ±60. */
export const SETTLE_L = 240;
const SETTLE_J = 60;
const SETTLE_R = 24; // the site levels ground within Chebyshev 24 of its centre
/** Trader camps ride their own, coprime lattice — different modulus than the
 *  settlements, so camps and settlements never stack sites. */
export const TRADER_L = 300;
const TRADER_J = 70;
const TRADER_R = 9;

/** Guaranteed home settlement beside the arrival pad, landlocked (the ocean
 *  basin only bites past (x+z)/sqrt2 ≈ 620, far south-east of here). */
const HOME_SETTLE: { x: number; z: number } = { x: 30, z: 16 };

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t: number) => { const u = clamp01(t); return u * u * (3 - 2 * u); };

/* ── Height field ────────────────────────────────────────────────────────────
 * base ~40 land; a south-east ocean basin floor ~20; a wide ridge field that
 * reaches the 150 clamp; volcanic scorch highlands pinned around 46. */

/** Local volcanic field: > 0.72 stands inside the Scorch Belt. */
const scorchField = (x: number, z: number, seed: number): number =>
  fbm2(x / 320 + 0.3, z / 320 - 0.7, seed + 205, 3);

const moisture = (x: number, z: number, seed: number): number =>
  fbm2(x / 300 + 0.7, z / 300 + 0.1, seed + 221, 3);

export function heightRaw(x: number, z: number, seed: number): number {
  // south-east ocean basin: signed distance toward +x+z, coastline wobbling
  // ±150 from value noise so the shore is never a straight line
  const se = (x + z) / Math.SQRT2;
  const wob = (value2(x / 260, z / 260, seed + 209) - 0.5) * 300;
  const oceanT = smooth((se + wob - 620) / 640);
  const land = 42 + fbm2(x / 430, z / 430, seed + 201) * 10 + fbm2(x / 150, z / 150, seed + 203) * 4;
  const floor = 21 + fbm2(x / 200, z / 200, seed + 207) * 3; // ocean floor ~20-24
  let h = land + (floor - land) * oceanT;
  // mountain ridge field, only out over the land: ridge^2 keeps the crests
  // thin, the range mask picks broad mountain country
  const landMask = smooth((1 - oceanT - 0.12) / 0.25);
  const ridge = ridge2(x / 300, z / 300, seed + 211, 4);
  const range = smooth((fbm2(x / 650 + 0.5, z / 650 + 0.5, seed + 213, 3) - 0.46) / 0.22);
  h += ridge * ridge * range * landMask * 105;
  // volcanic scorch highlands: the belt flattens its ground around 46
  const s = scorchField(x, z, seed);
  if (s > 0.72) {
    const k = smooth((s - 0.72) / 0.06);
    const high = 46 + fbm2(x / 90, z / 90, seed + 217) * 6 + ridge2(x / 160, z / 160, seed + 219, 2) * 10;
    h = h + (high - h) * k;
  }
  // never above 150 — the sky ceiling stays clear; never below the basin floor
  return Math.min(SIL_PEAK_MAX, Math.max(17, h));
}

/** Final terrain height of a column: heightRaw with the arrival plateau and
 *  the flattened settlement sites carved in. This is the ONLY height surface
 *  generators and queries may use, so guards and painters always agree. */
export function heightAt(x: number, z: number, seed: number): number {
  const r2 = x * x + z * z;
  if (r2 <= ARR_R * ARR_R) return ARR_Y;
  let h = heightRaw(x, z, seed);
  if (r2 < ARR_F * ARR_F) {
    const r = Math.sqrt(r2);
    h = ARR_Y + (h - ARR_Y) * smooth((r - ARR_R) / (ARR_F - ARR_R));
  }
  const site = settleSiteAt(x, z, seed);
  if (site) {
    const base = settleBase(site.cx, site.cz, seed);
    h = h + (base - h) * smooth((SETTLE_R - site.d) / 8);
  }
  return h;
}

/** Is (x,z) inside the guaranteed arrival zone (flat GRASS plateau, nothing
 *  above, DOCK_PAD cross at ARR_Y)? Pure — callers and gen agree. */
export function arrivalClear(x: number, z: number, seed: number): boolean {
  void seed;
  return x * x + z * z <= ARR_R * ARR_R;
}

/* ── Biomes ──────────────────────────────────────────────────────────────────*/

/** Biome of a column, decided by the FINAL height (arrival plateau, levelled
 *  sites included), the scorch field and a moisture field. */
export function biomeAt(x: number, z: number, seed: number): number {
  if (scorchField(x, z, seed) > 0.72) return SB_SCORCH;
  const h = heightAt(x, z, seed);
  if (h <= SIL_SEA - 5) return SB_DEEP;
  if (h <= SIL_SEA + 4) return SB_SHALLOWS;
  if (h >= 105) return SB_ALPINE;
  return moisture(x, z, seed) > 0.52 ? SB_BOREAL : SB_PLAINS;
}

/* ── Underground helpers (pure in x,y,z,seed like gen.ts) ───────────────────*/

/** Cheap trilinear value noise in 3D on hash2 — the desert caveAt machinery,
 *  same shape, our salts. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const g = (i: number, j: number, k: number) => hash2(i + k * 911, j + k * 577, seed);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(g(xi, yi, zi), g(xi + 1, yi, zi), xf);
  const x10 = lerp(g(xi, yi + 1, zi), g(xi + 1, yi + 1, zi), xf);
  const x01 = lerp(g(xi, yi, zi + 1), g(xi + 1, yi, zi + 1), xf);
  const x11 = lerp(g(xi, yi + 1, zi + 1), g(xi + 1, yi + 1, zi + 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

/** Cave band top: exactly the 4 solid cells under the surface stay rock (the
 *  desert roof rule), the band never climbs above y=46 on Silvaris — its
 *  ground sits ~10 higher than the desert's, so the whole band is shifted up. */
const caveTop = (h: number) => Math.min(h - 4, 46);

/** Is (x,y,z) cave air? Mirrors the desert band: one big-cheese 3D-noise
 *  field, two scales, threshold easing deeper. Floor never below y=3; the
 *  arrival zone's footing stays whole. */
function caveAt(x: number, y: number, z: number, seed: number, h?: number): boolean {
  if (y < 3) return false;
  if (x * x + z * z < 320) return false; // the arrival footing stays solid
  const hs = h ?? Math.round(heightAt(x, z, seed));
  const top = caveTop(hs);
  if (y > top) return false;
  const a = noise3(x / 9, y / 5.5, z / 9, seed + 401);
  const b = noise3(x / 23, y / 15, z / 23, seed + 407);
  return a * 0.55 + b * 0.45 > 0.575 + Math.max(0, top - y - 4) * 0.005;
}

/** The column's surface block stack. Sea floor and shores read like the
 *  desert oasis (sand rim, solid bowl under); salt only veins the Shallows,
 *  where the desert uses SALT. */
function surfaceBlock(x: number, z: number, y: number, h: number, bi: number, seed: number): number {
  if (bi === SB_ALPINE)
    return y >= h - 1 && h - 1 >= 115 ? SNOW : ROCK; // snow cap above ~115
  if (bi === SB_SCORCH) {
    // graphite veins near the surface of the volcanic highlands
    if (y >= h - 7 && y <= h - 2 && noise3(x / 7, y / 7, z / 7, seed + 641) > 0.84) return GRAPHITE_ORE;
    return y >= h - 4 ? BASALT : ROCK;
  }
  if (bi === SB_DEEP)
    return y >= h - 2 ? (y === h && hash2(x, z, seed + 241) > 0.9 ? GRAVEL : BASALT) : ROCK;
  if (bi === SB_SHALLOWS) {
    if (y === h) return SAND;
    if (y >= h - 2) return y < SIL_SEA && hash2(x, z + y, seed + 251) < 0.12 ? SALT : SAND;
    return BASALT;
  }
  // Plains & Boreal: GRASS over a DIRT underlayer over rock, bare dirt pockets
  return y === h ? (hash2(x, z, seed + 231) < 0.22 ? DIRT : GRASS)
    : y >= h - 3 ? DIRT : ROCK;
}

/* ── Settlements ─────────────────────────────────────────────────────────────
 * One advanced site per lattice cell (~every 15 chunks): a compact plating
 * building (Metal Plating walls, Glass windows, a proper Door), beds, a
 * Inscription by the entrance, loot Chests, and an adjoining 15x15 exposed
 * DOCK_PAD plaza. The whole site levels its ground like a camp: within
 * Chebyshev 24 of the centre the ground sits at the site's base level. */

export interface SilSite { x: number; z: number; y: number; } // centre + ground level
export interface SilDock { x: number; z: number; y: number; size: number; } // plaza centre
export interface SilTrader { x: number; z: number; y: number; }

const settleAtSeed = (tx: number, tz: number, seed: number): boolean => {
  if (tx === 0 && tz === 0) return true; // the guaranteed home settlement
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // keep the arrival zone clear
  return hash2(tx, tz, seed + 501) < 0.8;
};

const settleCenter = (tx: number, tz: number, seed: number): { x: number; z: number } => {
  if (tx === 0 && tz === 0) return HOME_SETTLE;
  const jx = (hash2(tx, tz, seed + 503) - 0.5) * 2 * SETTLE_J;
  const jz = (hash2(tx, tz, seed + 505) - 0.5) * 2 * SETTLE_J;
  return { x: Math.round(tx * SETTLE_L + jx), z: Math.round(tz * SETTLE_L + jz) };
};

/** The settlement ground level for a centre: the raw height, never drowned. */
const settleBase = (cx: number, cz: number, seed: number): number =>
  Math.max(Math.round(heightRaw(cx, cz, seed)), SIL_SEA + 2);

/** The settlement site holding (x,z) — Chebyshev <= SETTLE_R of a centre —
 *  with the distance, or null. Same 3x3 ring scan as campSiteAt: jitter 60 +
 *  reach 24 << SETTLE_L, so the ring is exact. */
function settleSiteAt(x: number, z: number, seed: number): { cx: number; cz: number; d: number } | null {
  const tx = Math.floor(x / SETTLE_L), tz = Math.floor(z / SETTLE_L);
  let best: { cx: number; cz: number; d: number } | null = null;
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (!settleAtSeed(ax, az, seed)) continue;
    const c = settleCenter(ax, az, seed);
    const d = Math.max(Math.abs(c.x - x), Math.abs(c.z - z));
    if (d <= SETTLE_R && (best === null || d < best.d)) best = { cx: c.x, cz: c.z, d };
  }
  return best;
}

/** The settlement whose site holds (x,z) — centre and ground level — or null.
 *  world.ts registers these as Landmarks. */
export function settleAt(x: number, z: number, seed: number): SilSite | null {
  const s = settleSiteAt(x, z, seed);
  if (!s) return null;
  return { x: s.cx, z: s.cz, y: settleBase(s.cx, s.cz, seed) };
}

/** The DOCK_PAD plaza holding (x,z): its centre, ground level and side (15).
 *  world.ts uses this to paint ship arrivals and register Dock landmarks. */
export function dockInfoAt(x: number, z: number, seed: number): SilDock | null {
  const s = settleSiteAt(x, z, seed);
  if (!s) return null;
  if (Math.abs(x - s.cx) > 7 || Math.abs(z - s.cz) > 7) return null; // plaza footprint
  return { x: s.cx, z: s.cz, y: settleBase(s.cx, s.cz, seed), size: 15 };
}



function paintSettlement(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = settleBase(c.x, c.z, seed);
  // the plaza first: solid to f, DOCK_PAD top, sky clear — exposed, no roof
  for (let x = c.x - 7; x <= c.x + 7; x++) for (let z = c.z - 7; z <= c.z + 7; z++) {
    for (let y = 0; y < f; y++) set(x, y, z, y >= f - 3 ? DIRT : BASALT);
    set(x, f, z, DOCK_PAD);
    for (let y = f + 1; y <= f + 10; y++) set(x, y, z, AIR);
  }
  // the building: plating shell, floor at f, interior air f+1..f+3, roof f+4 —
  // a 9x7 footprint directly south of the plaza, sharing its north edge
  const x0 = c.x - 4, x1 = c.x + 4, z0 = c.z - 14, z1 = c.z - 8;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
    for (let y = f; y <= f + 4; y++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      set(x, y, z, (y === f || y === f + 4 || (edge && y <= f + 3)) ? METAL_PLATING : AIR);
    }
  // windows on the plaza side and the north face
  set(c.x - 1, f + 2, z1, GLASS); set(c.x + 1, f + 2, z1, GLASS);
  set(c.x - 1, f + 2, z0, GLASS); set(c.x + 1, f + 2, z0, GLASS);
  // door onto the plaza (south wall centre), plus a side gap like the camps
  set(c.x, f + 1, z1, DOOR_CLOSED); set(c.x, f + 2, z1, DOOR_UPPER);
  // inside: beds, the Inscription stele by the door, lamps
  const bz = c.z - 12;
  set(c.x - 3, f + 1, bz, BED); set(c.x - 3, f + 1, bz + 1, BED_EXT);
  set(c.x + 1, f + 1, bz, BED); set(c.x + 1, f + 1, bz + 1, BED_EXT);
  set(c.x + 2, f + 1, z1 - 1, INSCRIPTION); // readable lore, right by the entrance
  set(x0 + 1, f + 3, z0 + 1, LAMP);
  set(x1 - 1, f + 3, z1 - 1, LAMP);
  // two loot Chests — game.ts rolls them with getSilvarisLoot on first open
  set(c.x - 1, f + 1, z0 + 1, CHEST);
  set(c.x + 3, f + 1, z0 + 2, CHEST);
}

/* ── Trader camps ────────────────────────────────────────────────────────────
 * Same modest scale as the desert camp's stall — a counter, awning on posts,
 * a lamp and one Chest of trade goods — never crowding a settlement or the
 * arrival zone, and only ever standing on dry ground. */

const traderAtSeed = (tx: number, tz: number, seed: number): boolean => {
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false;
  if (hash2(tx, tz, seed + 601) >= 0.65) return false;
  const c = traderCenter(tx, tz, seed);
  if (c.x * c.x + c.z * c.z < 1600) return false;
  if (settleSiteAt(c.x, c.z, seed) !== null) return false;
  if (settleNear(c.x, c.z, 30, seed)) return false;
  if (Math.round(heightRaw(c.x, c.z, seed)) <= SIL_SEA) return false; // dry ground only
  return true;
};

const traderCenter = (tx: number, tz: number, seed: number): { x: number; z: number } => {
  const jx = (hash2(tx, tz, seed + 603) - 0.5) * 2 * TRADER_J;
  const jz = (hash2(tx, tz, seed + 605) - 0.5) * 2 * TRADER_J;
  return { x: Math.round(tx * TRADER_L + jx), z: Math.round(tz * TRADER_L + jz) };
};

function settleNear(x: number, z: number, rad: number, seed: number): boolean {
  const t0 = Math.floor((x - rad) / SETTLE_L), t1 = Math.floor((x + rad) / SETTLE_L);
  const s0 = Math.floor((z - rad) / SETTLE_L), s1 = Math.floor((z + rad) / SETTLE_L);
  for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
    if (!settleAtSeed(tx, tz, seed)) continue;
    const c = settleCenter(tx, tz, seed);
    if (Math.hypot(c.x - x, c.z - z) <= rad + SETTLE_R) return true;
  }
  return false;
}

/** The trader camp whose site holds (x,z) — centre and ground — or null.
 *  Same unattackable barter rules as the desert camps; new goods. */
export function traderAt(x: number, z: number, seed: number): SilTrader | null {
  const tx = Math.floor(x / TRADER_L), tz = Math.floor(z / TRADER_L);
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (Math.abs(x - ax * TRADER_L) > TRADER_L / 2 || Math.abs(z - az * TRADER_L) > TRADER_L / 2) continue;
    if (!traderAtSeed(ax, az, seed)) continue;
    const c = traderCenter(ax, az, seed);
    if (Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) <= TRADER_R)
      return { x: c.x, z: c.z, y: Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1) };
  }
  return null;
}

function paintTrader(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1);
  // stall two cells east of the centre: plated counter, awning on wood posts,
  // lamp over the counter — the desert camp's scale, Silvaris materials
  set(c.x + 2, f + 1, c.z + 1, METAL_PLATING);
  for (const [px, pz] of [[3, 1], [2, 2], [3, 2]] as const)
    for (let y = f + 1; y <= f + 2; y++) set(c.x + px, y, c.z + pz, METAL_PLATING);
  set(c.x + 3, f + 3, c.z + 1, METAL_PLATING);
  set(c.x + 2, f + 3, c.z + 2, METAL_PLATING);
  set(c.x + 3, f + 3, c.z + 2, METAL_PLATING);
  set(c.x + 2, f + 3, c.z + 1, LAMP);
  // the trader's fire and one Chest of trade goods under the awning
  set(c.x - 2, f + 1, c.z, CAMPFIRE);
  set(c.x + 2, f + 1, c.z + 2, CHEST);
  // a lean-to shelter west of the stall: plating floor/roof, open front
  for (let x = c.x - 6; x <= c.x - 4; x++) for (let z = c.z - 2; z <= c.z; z++) {
    set(x, f, z, BASALT);
    if (z === c.z - 2) for (let y = f + 1; y <= f + 3; y++) set(x, y, z, METAL_PLATING);
    set(x, f + 4, z, METAL_PLATING);
  }
  set(c.x - 5, f + 1, c.z - 1, CHEST); // the camp's own stores
}

/* ── Loot tables ─────────────────────────────────────────────────────────────
 * The spec game.ts rolls when a Silvaris Chest is first opened, exactly how
 * the desert's townLoot works — pass a seeded rng (e.g. an Rng salted from
 * the chest's cell and the world seed) and get the stores. super_fuel NEVER
 * appears in world loot. */

export interface SilLoot { item: string; n: number; }

export function getSilvarisLoot(rng: () => number): SilLoot[] {
  const out: SilLoot[] = [
    { item: "metal_pickaxe", n: 1 }, // tier-3 pickaxe
    { item: "glass", n: 8 },
    { item: "lamp", n: 2 },
    { item: "steel_plating", n: 4 },
    { item: "titaniumrod", n: 2 },
    { item: "seed_tundroot", n: 4 },
    { item: "seed_emberbush", n: 4 },
    { item: "canister_empty", n: 2 },
  ];
  if (rng() < 0.6) out.push({ item: "insglass", n: 2 });
  if (rng() < 0.5) out.push({ item: "bed", n: 1 });
  if (rng() < 0.4) out.push({ item: "metal", n: 2 + (rng() * 3 | 0) });
  if (rng() < 0.35) out.push({ item: "chest_connector", n: 1 + (rng() * 2 | 0) });
  return out;
}

export function getSilvarisTraderLoot(rng: () => number): SilLoot[] {
  const out: SilLoot[] = [{ item: "canister_empty", n: 1 }, { item: "glass", n: 2 }];
  if (rng() < 0.8) out.push({ item: "steel_plating", n: 2 });
  if (rng() < 0.7) out.push({ item: "titaniumrod", n: 1 });
  if (rng() < 0.6) out.push({ item: "seed_emberbush", n: 2 });
  if (rng() < 0.5) out.push({ item: "metal", n: 2 });
  if (rng() < 0.4) out.push({ item: "lamp", n: 1 });
  return out;
}

/* ── Spawn tables ────────────────────────────────────────────────────────────
 * For the mobs slice. Desert fauna never spawns here; these names are the
 * exact registry ids the mobs slice will use. */

export function silvarisSpawns(biome: number): { mob: string; weight: number }[] {
  switch (biome) {
    case SB_SHALLOWS: return [{ mob: "Tideback", weight: 3 }];
    case SB_PLAINS: return [{ mob: "Brushbuck", weight: 3 }];
    case SB_BOREAL: return [{ mob: "Brushbuck", weight: 2 }, { mob: "Tideback", weight: 1 }];
    case SB_ALPINE: return [{ mob: "Snow Stalker", weight: 3 }];
    case SB_DEEP: return [{ mob: "Tideback", weight: 1 }];
    default: return []; // the Scorch Belt stands empty
  }
}

/* ── Chunk generation ────────────────────────────────────────────────────────*/

export interface SilvarisChunkArgs {
  cx: number;
  cz: number;
  seed: number;
  /** absolute-cell writer — same contract as gen.ts's setW; out-of-range and
   *  above-chunk writes are dropped by the caller or clamped here. */
  set: (x: number, y: number, z: number, id: number) => void;
}

/** Generate one Silvaris chunk. Pure in (cx, cz, seed): terrain columns, the
 *  cave band with ore-crusted walls, the ocean's Source columns, scattered
 *  flora, then structures (arrival pad, settlements with docks, trader camps)
 *  painted over the terrain, exactly like genChunk's order. No meta: doors
 *  self-orient from neighbours at mesh time (the desert never writes meta). */
export function genSilvarisChunk(args: SilvarisChunkArgs): void {
  const { cx, cz, seed, set } = args;
  const safeSet = (x: number, y: number, z: number, id: number) => {
    if (y >= 0 && y < CH) set(x, y, z, id);
  };

  // chunk-local cave mask with a 1-cell margin for the wall-ore checks, and a
  // height cache — the desert genChunk's exact pattern
  const CW = CS + 2;
  const caveM = new Uint8Array(CW * CW * CH);
  const hM = new Int16Array(CW * CW).fill(-1);
  const hCol = (wx: number, wz: number): number => {
    const i = (wx - cx * CS + 1) * CW + (wz - cz * CS + 1);
    if (hM[i] < 0) hM[i] = Math.round(heightAt(wx, wz, seed));
    return hM[i];
  };
  const caveC = (wx: number, wy: number, wz: number): boolean => {
    if (wy < 0 || wy >= CH) return false;
    const lx = wx - cx * CS + 1, lz = wz - cz * CS + 1;
    if (lx < 0 || lx >= CW || lz < 0 || lz >= CW) return caveAt(wx, wy, wz, seed);
    const idx = (lx * CW + lz) * CH + wy;
    if (!caveM[idx]) caveM[idx] = caveAt(wx, wy, wz, seed, hCol(wx, wz)) ? 2 : 1;
    return caveM[idx] === 2;
  };

  for (let x = 0; x < CS; x++) {
    for (let z = 0; z < CS; z++) {
      const wx = cx * CS + x, wz = cz * CS + z;
      const h = hCol(wx, wz);
      const bi = biomeAt(wx, wz, seed);
      for (let y = 0; y <= h; y++) safeSet(wx, y, wz, surfaceBlock(wx, wz, y, h, bi, seed));
      // the sea: a WATER Source column from the floor up to sea level, exactly
      // like the oasis paint — the flow sim keeps Sources stable; no flow
      // levels are ever placed in generation
      for (let y = h + 1; y <= SIL_SEA; y++) safeSet(wx, y, wz, WATER);

      const atOrigin = wx * wx + wz * wz < 320; // the arrival footing stays plain
      const top = caveTop(h);

      // ── the underground band: caves open the column, ores crust the walls ──
      if (!atOrigin) for (let y = 3; y <= top; y++) {
        if (caveC(wx, y, wz)) { safeSet(wx, y, wz, AIR); continue; }
        const base = surfaceBlock(wx, wz, y, h, bi, seed);
        if (base !== ROCK && base !== BASALT) continue;
        if (!(caveC(wx + 1, y, wz) || caveC(wx - 1, y, wz) || caveC(wx, y + 1, wz) ||
              caveC(wx, y - 1, wz) || caveC(wx, y, wz + 1) || caveC(wx, y, wz - 1))) continue;
        // wall crust: the desert's ore bands, raised ~8 for Silvaris ground,
        // TITANIUM in the deep band (where the desert runs COBALT) and
        // GRAPHITE in the mid band; SALT veins only under the Shallows
        if (bi === SB_ALPINE && y >= 92 && hash2(wx, wz + y, seed + 611) < 0.2) {
          safeSet(wx, y, wz, SNOW); // ice caves high in the peaks
        } else if (y <= 22 && hash2(wx * 5 + y, wz * 7 - y, seed + 333) < 0.4 &&
                   noise3(wx / 5 + 40, y / 5, wz / 5, seed + 431) > 0.886) {
          safeSet(wx, y, wz, TITANIUM_ORE);
        } else if (bi === SB_SHALLOWS && noise3(wx / 5 + 200, y / 5, wz / 5, seed + 451) > 0.85) {
          safeSet(wx, y, wz, SALT);
        } else if (y >= 20 && noise3(wx / 5, y / 5, wz / 5, seed + 413) > 0.864) safeSet(wx, y, wz, IRON_ORE);
        else if (y >= 20 && noise3(wx / 5, y / 5 + 60, wz / 5, seed + 417) > 0.878) safeSet(wx, y, wz, COPPER_ORE);
        else if (y >= 12 && noise3(wx / 5 + 120, y / 5 + 30, wz / 5, seed + 429) > 0.842) safeSet(wx, y, wz, COAL_ORE);
        else if (y >= 26 && y <= 46 && noise3(wx / 5, y / 5, wz / 5 + 70, seed + 421) > 0.883) safeSet(wx, y, wz, GRAPHITE_ORE);
      }

      // ── flora ──
      if (atOrigin) continue; // the arrival zone stands bare
      const inSettle = settleSiteAt(wx, wz, seed) !== null;
      if (inSettle) continue; // settlements own their ground
      // Boreal: dense WOOD trunks under LEAVES canopies; Plains: occasional
      // trees. Reuse the desert's mature Living Tree plan, seeded by the base.
      const growGate = bi === SB_BOREAL ? 0.905 : bi === SB_PLAINS ? 0.978 : 2;
      if (bi === SB_BOREAL || bi === SB_PLAINS) {
        if (h > SIL_SEA + 1 && h + 9 <= SIL_PEAK_MAX && hash2(wx, wz, seed + 601) > growGate) {
          const rnd = new Rng(((hash2(wx, wz, seed + 607) * 4294967296) >>> 0) || 1);
          for (const p of treePlan(wx, h + 1, wz, () => rnd.next())) safeSet(p.x, p.y, p.z, p.b);
        }
        // Tundra Root scattered across the plains: ripe stands with sprouts
        if (bi === SB_PLAINS && h > SIL_SEA + 1 && hash2(wx, wz, seed + 613) > 0.987) {
          safeSet(wx, h + 1, wz, hash2(wx, wz, seed + 617) > 0.5 ? TUNDROOT_2 : TUNDROOT_1);
        }
        // Ember Bush along the Boreal edge of the Scorch Belt
        if (bi === SB_BOREAL) {
          const nearScorch = fbm2(wx / 320 + 0.3, wz / 320 - 0.7, seed + 205, 3);
          if (nearScorch > 0.64 && hash2(wx, wz, seed + 623) > 0.96)
            safeSet(wx, h + 1, wz, hash2(wx, wz, seed + 629) > 0.66 ? EMBERBUSH_2 : EMBERBUSH_1);
        }
      }
      // basalt knobs on the scorch highlands and alpine tors
      if ((bi === SB_SCORCH || bi === SB_ALPINE) && hash2(wx, wz, seed + 21) > 0.985) {
        const n = 1 + (hash2(wx, wz, seed + 24) * 3 | 0);
        for (let i = 1; i <= n; i++) safeSet(wx, h + i, wz, bi === SB_SCORCH ? BASALT : ROCK);
      }
    }
  }

  // Arrival pad: the DOCK_PAD cross at ARR_Y on the flat plateau, nothing above
  for (let x = -ARR_R; x <= ARR_R; x++) for (let z = -ARR_R; z <= ARR_R; z++) {
    if (x * x + z * z > ARR_R * ARR_R) continue;
    const cross = (Math.abs(x) <= 1 && Math.abs(z) <= 7) || (Math.abs(z) <= 1 && Math.abs(x) <= 7);
    safeSet(x, ARR_Y, z, cross ? DOCK_PAD : GRASS);
    for (let y = 0; y < ARR_Y; y++) safeSet(x, y, z, y >= ARR_Y - 3 ? DIRT : BASALT);
    for (let y = ARR_Y + 1; y < CH; y++) safeSet(x, y, z, AIR);
  }

  // Settlements on their lattice: jitter ±60, site reach 24, so the scan
  // window adds 85 on each side (one slack cell).
  const m = SETTLE_J + SETTLE_R + 1;
  const sx0 = Math.floor((cx * CS - m) / SETTLE_L), sx1 = Math.floor((cx * CS + CS - 1 + m) / SETTLE_L);
  const sz0 = Math.floor((cz * CS - m) / SETTLE_L), sz1 = Math.floor((cz * CS + CS - 1 + m) / SETTLE_L);
  for (let tx = sx0; tx <= sx1; tx++) for (let tz = sz0; tz <= sz1; tz++) {
    if (!settleAtSeed(tx, tz, seed)) continue;
    const c = settleCenter(tx, tz, seed);
    if (cx * CS <= c.x + SETTLE_R && cx * CS + CS - 1 >= c.x - SETTLE_R &&
        cz * CS <= c.z + SETTLE_R && cz * CS + CS - 1 >= c.z - SETTLE_R)
      paintSettlement(safeSet, c, seed);
  }
  // Trader camps on their own lattice (jitter ±70, site reach ~9).
  const tm = TRADER_J + TRADER_R + 1;
  const ux0 = Math.floor((cx * CS - tm) / TRADER_L), ux1 = Math.floor((cx * CS + CS - 1 + tm) / TRADER_L);
  const uz0 = Math.floor((cz * CS - tm) / TRADER_L), uz1 = Math.floor((cz * CS + CS - 1 + tm) / TRADER_L);
  for (let tx = ux0; tx <= ux1; tx++) for (let tz = uz0; tz <= uz1; tz++) {
    if (!traderAtSeed(tx, tz, seed)) continue;
    const c = traderCenter(tx, tz, seed);
    if (cx * CS <= c.x + TRADER_R && cx * CS + CS - 1 >= c.x - TRADER_R &&
        cz * CS <= c.z + TRADER_R && cz * CS + CS - 1 >= c.z - TRADER_R)
      paintTrader(safeSet, c, seed);
  }
}
