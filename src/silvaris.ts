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
  AIR, ROCK, SAND, DIRT, GRASS, WATER, SALT, SNOW, BASALT, GRAVEL, WOOD, LEAVES,
  TITANIUM_ORE, GRAPHITE_ORE, TUNDROOT_1, TUNDROOT_2, EMBERBUSH_1, EMBERBUSH_2, EMBER_FRUIT,
  SIL_WOOD, SIL_LEAVES, OAT_1, OAT_2,
  INSCRIPTION, DOCK_PAD, METAL_PLATING, GLASS, DOOR_CLOSED, DOOR_UPPER,
  BED, BED_EXT, CHEST, CHEST_CONNECTOR, LAMP, CAMPFIRE,
  ALABASTER, OIL, OIL_SANDS, LEAD_ORE, SALTPETRE_ORE, CAMP_ANTENNA,
  POWER_CONDUIT, POWER_POLE, SHOCK_COIL,
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
  if (bi === SB_ALPINE) {
    if (y === h) { // ore outcrops weather out of the high rock, in plain sight
      const r = hash2(x, z, seed + 261);
      if (r < 0.05) return LEAD_ORE;
      if (r < 0.065) return TITANIUM_ORE; // the peaks give up their deep metal
    }
    return y >= h - 1 && h - 1 >= 115 ? SNOW : ROCK; // snow cap above ~115
  }
  if (bi === SB_SCORCH) {
    // graphite veins near the surface of the volcanic highlands
    if (y >= h - 7 && y <= h - 2 && noise3(x / 7, y / 7, z / 7, seed + 641) > 0.84) return GRAPHITE_ORE;
    if (y === h && hash2(x, z, seed + 263) < 0.04) return LEAD_ORE; // lead slag crops out
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
 * Scarce advanced sites (one per lattice cell, ~every 15 chunks), and the
 * lattice is thin: fewer than half of its cells hold a site. Three kinds,
 * picked per site by hash — a full Station, a small Outpost, and a bare
 * Waystation — but every one of them owns a 15x15 exposed DOCK_PAD plaza, an
 * Inscription and at least one loot Chest. The whole site levels its ground
 * like a camp: within Chebyshev 24 of the centre the ground sits at the
 * site's base level. */

export interface SilSite { x: number; z: number; y: number; } // centre + ground level
export interface SilDock { x: number; z: number; y: number; size: number; } // plaza centre
export interface SilTrader { x: number; z: number; y: number; }

const settleAtSeed = (tx: number, tz: number, seed: number): boolean => {
  if (tx === 0 && tz === 0) return true; // the guaranteed home settlement
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // keep the arrival zone clear
  return hash2(tx, tz, seed + 501) < 0.45; // scarce: the sites are long walks apart
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



/** Which kind of site a centre is: Station (full house), Outpost (a small
 *  hut), Waystation (an open shelter). Pure, so the Map and the gen agree. */
export type SilSettleKind = "station" | "outpost" | "waystation";
export const settleKind = (x: number, z: number, seed: number): SilSettleKind => {
  const r = hash2(x, z, seed + 511);
  return r < 0.5 ? "station" : r < 0.85 ? "outpost" : "waystation";
};

function paintSettlement(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = settleBase(c.x, c.z, seed);
  // the plaza first: solid to f, DOCK_PAD top, sky clear — exposed, no roof
  for (let x = c.x - 7; x <= c.x + 7; x++) for (let z = c.z - 7; z <= c.z + 7; z++) {
    for (let y = 0; y < f; y++) set(x, y, z, y >= f - 3 ? DIRT : BASALT);
    set(x, f, z, DOCK_PAD);
    for (let y = f + 1; y <= f + 10; y++) set(x, y, z, AIR);
  }
  const kind = settleKind(c.x, c.z, seed);
  if (kind === "station") {
    // the full house: plating shell, floor at f, interior air f+1..f+3, roof
    // f+4 — a 9x7 footprint directly south of the plaza, sharing its north edge
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
    return;
  }
  if (kind === "outpost") {
    // a single-family hut: 5x5 plating, one bed, one Chest, door on the plaza
    const x0 = c.x - 2, x1 = c.x + 2, z0 = c.z - 12, z1 = c.z - 8;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
      for (let y = f; y <= f + 4; y++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        set(x, y, z, (y === f || y === f + 4 || (edge && y <= f + 3)) ? METAL_PLATING : AIR);
      }
    set(c.x - 1, f + 2, z1, GLASS); set(c.x + 1, f + 2, z0, GLASS);
    set(c.x, f + 1, z1, DOOR_CLOSED); set(c.x, f + 2, z1, DOOR_UPPER);
    set(c.x - 1, f + 1, z0 + 1, BED); set(c.x - 1, f + 1, z0 + 2, BED_EXT);
    set(c.x + 1, f + 1, z1 - 1, INSCRIPTION);
    set(c.x, f + 3, (z0 + z1) >> 1, LAMP);
    set(c.x + 1, f + 1, z0 + 1, CHEST);
    return;
  }
  // waystation: no walls — a plating lean-to on posts, a fire, a Chest and a
  // stele open to the sky. The dwellers mark the road, they don't live on it.
  for (let x = c.x - 3; x <= c.x - 1; x++) for (let z = c.z - 10; z <= c.z - 8; z++) {
    set(x, f, z, METAL_PLATING);
    set(x, f + 4, z, METAL_PLATING);
  }
  for (const [px, pz] of [[-3, -10], [-1, -10], [-3, -8], [-1, -8]] as const)
    for (let y = f + 1; y <= f + 3; y++) set(c.x + px, y, c.z + pz, METAL_PLATING);
  set(c.x - 2, f + 3, c.z - 9, LAMP);
  set(c.x - 2, f + 1, c.z - 8, CHEST);
  set(c.x - 1, f + 1, c.z - 9, INSCRIPTION); // stele under the lean-to, facing the plaza
  set(c.x + 1, f + 1, c.z - 9, CAMPFIRE);    // a fire the road keeps burning
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

/** Is there a trader camp on lattice cell (tx,tz)? */
export const traderCellAt = (tx: number, tz: number, seed: number): boolean => traderAtSeed(tx, tz, seed);

/** Jittered centre of the trader camp on lattice cell (tx,tz). */
export const traderCellCenter = (tx: number, tz: number, seed: number): { x: number; z: number } => traderCenter(tx, tz, seed);

/** The trader camp nearest (x,z) within `rad`, with its lattice cell — the
 *  Nomad whose Keeper hears news of a deed done here. */
export function nearestTraderCamp(x: number, z: number, seed: number, rad: number): { tx: number; tz: number; x: number; z: number } | null {
  const t0 = Math.floor((x - rad) / TRADER_L), t1 = Math.floor((x + rad) / TRADER_L);
  const s0 = Math.floor((z - rad) / TRADER_L), s1 = Math.floor((z + rad) / TRADER_L);
  let best: { tx: number; tz: number; x: number; z: number } | null = null, bd = rad;
  for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
    if (!traderAtSeed(tx, tz, seed)) continue;
    const c = traderCenter(tx, tz, seed);
    const d = Math.hypot(c.x - x, c.z - z);
    if (d <= bd) { bd = d; best = { tx, tz, x: c.x, z: c.z }; }
  }
  return best;
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

/* ── Machine Camps and Relay Towers ─────────────────────────────────────────
 * The Dominion's grip on Silvaris, on lattices coprime with every other site
 * (176 = 2^4·11, 233 prime — never sharing a cell with settle 240, trader 300
 * or seep 220). A Camp is a wreck the machines never cleared: chassis slabs,
 * a dead antenna, and a store chest the machines never bothered to lock.
 * A Relay Tower is a mast with an antenna still screaming into the sky: the
 * land-mark the raid-on-Grid answers to, and a beacon on the Map. */

export const CAMP_L = 176;
export const RELAY_L = 233;
const CAMP_J = 40, RELAY_J = 45;
const CAMP_R = 8, RELAY_R = 7;

const silSeepNear = (x: number, z: number, rad: number, seed: number): boolean => {
  const i0 = Math.floor((x - rad) / SIL_SEEP_L), i1 = Math.floor((x + rad) / SIL_SEEP_L);
  const j0 = Math.floor((z - rad) / SIL_SEEP_L), j1 = Math.floor((z + rad) / SIL_SEEP_L);
  for (let ix = i0; ix <= i1; ix++) for (let iz = j0; iz <= j1; iz++) {
    const s = silSeepOf(ix, iz, seed);
    if (s && Math.hypot(s.x - x, s.z - z) <= rad + s.r + 4) return true;
  }
  return false;
};

const campAtSeed = (tx: number, tz: number, seed: number): boolean => {
  if (hash2(tx, tz, seed + 701) >= 0.62) return false;
  const c = campCenter(tx, tz, seed);
  if (c.x * c.x + c.z * c.z < 3200) return false; // arrival country stays quiet
  if (settleSiteAt(c.x, c.z, seed) !== null || settleNear(c.x, c.z, 26, seed)) return false;
  if (silSeepNear(c.x, c.z, 16, seed)) return false;
  const rx = Math.floor(c.x / RELAY_L), rz = Math.floor(c.z / RELAY_L);
  for (let ax = rx - 1; ax <= rx + 1; ax++) for (let az = rz - 1; az <= rz + 1; az++) {
    if (!relayAtSeed(ax, az, seed)) continue;
    const rc = relayCenter(ax, az, seed);
    if (Math.hypot(rc.x - c.x, rc.z - c.z) < 48) return false; // the mast outranks the wreck
  }
  if (Math.round(heightRaw(c.x, c.z, seed)) <= SIL_SEA) return false;
  return true;
};

const campCenter = (tx: number, tz: number, seed: number): { x: number; z: number } => {
  const jx = (hash2(tx, tz, seed + 703) - 0.5) * 2 * CAMP_J;
  const jz = (hash2(tx, tz, seed + 705) - 0.5) * 2 * CAMP_J;
  return { x: Math.round(tx * CAMP_L + jx), z: Math.round(tz * CAMP_L + jz) };
};

export function campAt(x: number, z: number, seed: number): { x: number; z: number; y: number } | null {
  const tx = Math.floor(x / CAMP_L), tz = Math.floor(z / CAMP_L);
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (Math.abs(x - ax * CAMP_L) > CAMP_L / 2 || Math.abs(z - az * CAMP_L) > CAMP_L / 2) continue;
    if (!campAtSeed(ax, az, seed)) continue;
    const c = campCenter(ax, az, seed);
    if (Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) <= CAMP_R)
      return { x: c.x, z: c.z, y: Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1) };
  }
  return null;
}

/** Camp layout variants, pure in the site (same world, same camp forever):
 * 0 Watchpost (the old wreck, an antenna on a raised mast deck), 1 a buried
 * supply Bunker under a hatch, 2 a low Scrapyard of broken plating rows,
 * 3 a walled Depot with a roofed shelter. Every variant stays inside
 * Chebyshev 8 of the site (the paint window's reach), leaves exactly one
 * CAMP_ANTENNA within 10 of the centre — game.ts maps a cut antenna back
 * to its camp by that distance — and lights its interior with a LAMP. */
const campVariant = (c: { x: number; z: number }, seed: number): number =>
  Math.floor(hash2(c.x, c.z, seed + 721) * 4);

/** Level a Chebyshev-r pad of ground to f and cap it with plating — every
 *  camp variant stands on one, so walls and floors never fight the slope. */
function campPad(set: (x: number, y: number, z: number, id: number) => void,
  c: { x: number; z: number }, r: number, f: number, seed: number) {
  for (let x = c.x - r; x <= c.x + r; x++) for (let z = c.z - r; z <= c.z + r; z++) {
    const h = Math.round(heightAt(x, z, seed));
    for (let y = Math.min(h, f) + 1; y <= Math.max(h, f); y++) set(x, y, z, y <= h ? AIR : BASALT);
    set(x, f, z, BASALT);
  }
}

function paintWatchpost(set: (x: number, y: number, z: number, id: number) => void,
  c: { x: number; z: number }, seed: number, f: number) {
  campPad(set, c, 4, f, seed);
  // chassis slabs: three low mounds of old plating, half-buried
  for (let i = 0; i < 3; i++) {
    const mx = c.x - 3 + Math.floor(hash2(c.x + i, c.z - i, seed + 711) * 6);
    const mz = c.z - 3 + Math.floor(hash2(c.x - i, c.z + i, seed + 713) * 6);
    const hh = 1 + Math.floor(hash2(mx, mz, seed + 715) * 2);
    for (let y = 1; y <= hh; y++) set(mx, f + y, mz, METAL_PLATING);
    if (hash2(mx, mz, seed + 717) > 0.5) set(mx + 1, f + 1, mz, METAL_PLATING);
    if (hash2(mx, mz, seed + 719) > 0.6) set(mx, f + 1, mz + 1, BASALT); // rubble
  }
  // the dead antenna on a raised mast deck: plating steps up to a platform
  const mx = c.x + 3, mz = c.z - 3;
  for (let y = 1; y <= 3; y++) set(mx, f + y, mz, BASALT);
  set(mx - 1, f + 1, mz, METAL_PLATING);
  set(mx - 1, f + 2, mz, METAL_PLATING);
  for (const [dx, dz] of [[-1, 0], [-1, -1], [0, -1]] as const)
    set(mx + dx, f + 3, mz + dz, METAL_PLATING);
  set(mx, f + 4, mz, CAMP_ANTENNA); // the dish still pointed at nothing
  set(mx - 1, f + 4, mz - 1, LAMP); // a light over the deck
  // the store they never bothered to lock: Chest — Connector — Chest
  set(c.x - 4, f + 1, c.z + 3, CHEST);
  set(c.x - 3, f + 1, c.z + 3, CHEST_CONNECTOR);
  set(c.x - 2, f + 1, c.z + 3, CHEST);
}

function paintBunker(set: (x: number, y: number, z: number, id: number) => void,
  c: { x: number; z: number }, seed: number, f: number) {
  // the yard above is nearly nothing: a small pad, gravel drifts, a mast
  campPad(set, c, 4, f, seed);
  for (let i = 0; i < 3; i++) {
    const gx = c.x - 3 + Math.floor(hash2(c.x - i, c.z + i, seed + 741) * 7);
    const gz = c.z - 3 + Math.floor(hash2(c.x + i, c.z - i, seed + 743) * 7);
    set(gx, f, gz, GRAVEL);
  }
  const mastH = Math.round(heightAt(c.x - 5, c.z + 4, seed));
  set(c.x - 5, mastH + 1, c.z + 4, BASALT);
  set(c.x - 5, mastH + 2, c.z + 4, BASALT);
  set(c.x - 5, mastH + 3, c.z + 4, CAMP_ANTENNA); // the bunker's ear to the Grid
  // the supply room, sealed in solid basalt seven down, then opened
  const fy = f - 7;
  for (let x = c.x - 7; x <= c.x + 1; x++) for (let z = c.z - 3; z <= c.z + 3; z++)
    for (let y = fy - 1; y <= fy + 4; y++) set(x, y, z, BASALT);
  for (let x = c.x - 6; x <= c.x; x++) for (let z = c.z - 2; z <= c.z + 2; z++)
    for (let y = fy + 1; y <= fy + 3; y++) set(x, y, z, AIR);
  // the hatch: a 3x3 shaft with one basalt step per level spiralling the
  // wall ring — the volcano step-well's pattern, walked down from the pad
  const sx0 = c.x - 4, sz0 = c.z;
  for (let x = sx0; x <= sx0 + 2; x++) for (let z = sz0; z <= sz0 + 2; z++)
    for (let y = fy + 1; y <= f; y++) set(x, y, z, AIR);
  const ring: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
  for (let i = 0; i <= f - 2 - fy; i++) set(sx0 + ring[i][0], fy + 1 + i, sz0 + ring[i][1], BASALT);
  for (let x = sx0 - 1; x <= sx0 + 3; x++) for (let z = sz0 - 1; z <= sz0 + 3; z++) // a collar keeps walkers off the hole
    if (x === sx0 - 1 || x === sx0 + 3 || z === sz0 - 1 || z === sz0 + 3) set(x, f + 1, z, BASALT);
  set(c.x - 3, f + 1, c.z + 1, LAMP); // the hatchway lamp, hanging over the shaft
  // inside: Chests on the rails, a dead Pole line, crates, two lamps
  set(c.x - 6, fy + 1, c.z - 1, CHEST);
  set(c.x - 6, fy + 1, c.z, CHEST_CONNECTOR);
  set(c.x - 6, fy + 1, c.z + 1, CHEST);
  set(c.x - 5, fy + 1, c.z - 2, CHEST);
  for (let y = fy + 1; y <= fy + 3; y++) set(c.x - 1, y, c.z, POWER_POLE);
  set(c.x - 1, fy + 1, c.z - 2, METAL_PLATING); // crate stacks
  set(c.x - 1, fy + 2, c.z - 2, METAL_PLATING);
  set(c.x - 3, fy + 1, c.z - 2, BASALT);
  set(c.x - 5, fy + 3, c.z - 1, LAMP);
  set(c.x - 1, fy + 3, c.z + 1, LAMP);
}

function paintScrapyard(set: (x: number, y: number, z: number, id: number) => void,
  c: { x: number; z: number }, seed: number, f: number) {
  campPad(set, c, 5, f, seed);
  // gravel drifts over the plating
  for (let x = c.x - 5; x <= c.x + 5; x++) for (let z = c.z - 5; z <= c.z + 5; z++)
    if (hash2(x, z, seed + 745) > 0.72) set(x, f, z, GRAVEL);
  // broken plating rows: three runs of four, plating and basalt stumps
  for (let i = 0; i < 3; i++) {
    const rz = c.z - 4 + i * 3 + Math.floor(hash2(c.x + i, c.z + i, seed + 747) * 2);
    const x0 = c.x - 4 + Math.floor(hash2(c.x - i, c.z - i, seed + 749) * 3);
    for (let j = 0; j < 4; j++) {
      const x = x0 + j;
      if (hash2(x, rz, seed + 751) > 0.45)
        set(x, f + 1, rz, hash2(x, rz, seed + 753) > 0.4 ? METAL_PLATING : BASALT);
      if (hash2(x, rz, seed + 755) > 0.72) set(x, f + 2, rz, METAL_PLATING);
    }
  }
  // the machines never hauled off: a plating husk with a snapped Pole
  const jx = c.x + 2, jz = c.z + 2;
  set(jx, f + 1, jz, METAL_PLATING);
  set(jx + 1, f + 1, jz, METAL_PLATING);
  set(jx, f + 1, jz + 1, BASALT);
  set(jx, f + 2, jz, METAL_PLATING);
  set(jx + 1, f + 1, jz + 1, POWER_POLE);
  // the antenna they left standing — a short mast, dish low and reachable
  set(c.x - 4, f + 1, c.z - 4, BASALT);
  set(c.x - 4, f + 2, c.z - 4, BASALT);
  set(c.x - 4, f + 3, c.z - 4, CAMP_ANTENNA);
  set(c.x - 4, f + 3, c.z - 3, LAMP);
  // the salvage that never got inventoried
  set(c.x + 4, f + 1, c.z + 3, CHEST);
  set(c.x + 4, f + 1, c.z + 4, CHEST_CONNECTOR);
  set(c.x + 4, f + 1, c.z + 5, CHEST);
}

function paintDepot(set: (x: number, y: number, z: number, id: number) => void,
  c: { x: number; z: number }, seed: number, f: number) {
  campPad(set, c, 6, f, seed);
  // the wall: basalt to a plating band, a plated gate in the south face
  for (let x = c.x - 6; x <= c.x + 6; x++) for (let z = c.z - 6; z <= c.z + 6; z++) {
    if (Math.abs(x - c.x) !== 6 && Math.abs(z - c.z) !== 6) continue;
    for (let y = f + 1; y <= f + 3; y++) set(x, y, z, y === f + 3 ? METAL_PLATING : BASALT);
  }
  set(c.x, f + 1, c.z + 6, DOOR_CLOSED);
  set(c.x, f + 2, c.z + 6, DOOR_UPPER);
  // the roofed shelter against the north wall
  const hx0 = c.x - 3, hx1 = c.x + 3, hz0 = c.z - 5, hz1 = c.z - 2;
  for (let x = hx0; x <= hx1; x++) for (let z = hz0; z <= hz1; z++)
    for (let y = f + 1; y <= f + 4; y++) {
      const e = x === hx0 || x === hx1 || z === hz0 || z === hz1;
      set(x, y, z, (y === f + 4 || (e && y <= f + 3)) ? METAL_PLATING : AIR);
    }
  set(c.x - 1, f + 2, hz1, GLASS); set(c.x + 1, f + 2, hz1, GLASS);
  set(c.x, f + 1, hz1, DOOR_CLOSED); set(c.x, f + 2, hz1, DOOR_UPPER);
  // the garrison's stores: a bed, Chests on the rails, a lamp
  set(c.x + 2, f + 1, hz0 + 1, BED); set(c.x + 2, f + 1, hz0 + 2, BED_EXT);
  set(c.x - 2, f + 1, hz0 + 1, CHEST);
  set(c.x - 2, f + 1, hz0 + 2, CHEST_CONNECTOR);
  set(c.x - 1, f + 1, hz0 + 1, CHEST);
  set(c.x - 2, f + 3, hz0 + 2, LAMP);
  set(c.x - 1, f + 3, c.z + 6, LAMP); // over the gate, in the wall band
  // corner steps to the mast cap: the antenna rides the NW wall, hip-high
  // to whoever stands on the steps (hypot 7.8 from the centre)
  set(c.x - 4, f + 1, c.z - 5, METAL_PLATING);
  set(c.x - 5, f + 1, c.z - 5, METAL_PLATING);
  set(c.x - 5, f + 2, c.z - 5, METAL_PLATING);
  set(c.x - 5, f + 4, c.z - 6, CAMP_ANTENNA);
}

function paintMachineCamp(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1);
  const v = campVariant(c, seed);
  if (v === 1) paintBunker(set, c, seed, f);
  else if (v === 2) paintScrapyard(set, c, seed, f);
  else if (v === 3) paintDepot(set, c, seed, f);
  else paintWatchpost(set, c, seed, f);
}

const relayAtSeed = (tx: number, tz: number, seed: number): boolean => {
  if (hash2(tx, tz, seed + 731) >= 0.45) return false;
  const c = relayCenter(tx, tz, seed);
  if (c.x * c.x + c.z * c.z < 5200) return false;
  if (settleSiteAt(c.x, c.z, seed) !== null || settleNear(c.x, c.z, 30, seed)) return false;
  if (Math.round(heightRaw(c.x, c.z, seed)) <= SIL_SEA) return false;
  return true;
};

const relayCenter = (tx: number, tz: number, seed: number): { x: number; z: number } => {
  const jx = (hash2(tx, tz, seed + 733) - 0.5) * 2 * RELAY_J;
  const jz = (hash2(tx, tz, seed + 735) - 0.5) * 2 * RELAY_J;
  return { x: Math.round(tx * RELAY_L + jx), z: Math.round(tz * RELAY_L + jz) };
};

export function relayAt(x: number, z: number, seed: number): { x: number; z: number; y: number } | null {
  const tx = Math.floor(x / RELAY_L), tz = Math.floor(z / RELAY_L);
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (Math.abs(x - ax * RELAY_L) > RELAY_L / 2 || Math.abs(z - az * RELAY_L) > RELAY_L / 2) continue;
    if (!relayAtSeed(ax, az, seed)) continue;
    const c = relayCenter(ax, az, seed);
    if (Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) <= RELAY_R)
      return { x: c.x, z: c.z, y: Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1) };
  }
  return null;
}

function paintRelay(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1);
  for (let x = c.x - 3; x <= c.x + 3; x++) for (let z = c.z - 3; z <= c.z + 3; z++) set(x, f, z, BASALT);
  const hh = 12 + Math.floor(hash2(c.x, c.z, seed + 737) * 5); // 12..16 tall
  for (let y = 1; y <= hh; y++) set(c.x, f + y, c.z, BASALT);
  // corner braces up to half height, plating bands where the mast passes through
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let y = 1; y <= hh >> 1; y += 2) set(c.x + dx, f + y, c.z + dz, METAL_PLATING);
    for (let y = (hh >> 1) + 2; y <= hh; y += 4) set(c.x + dx, f + y, c.z + dz, METAL_PLATING);
  }
  set(c.x, f + hh + 1, c.z, CAMP_ANTENNA); // still screaming
  set(c.x + 2, f + 1, c.z - 2, LAMP);       // the watcher's light
  set(c.x - 2, f + 1, c.z + 2, CHEST);      // the mast crew's stores
}

export const campNodeAt = (tx: number, tz: number, seed: number): { x: number; z: number; y: number } | null =>
  campAtSeed(tx, tz, seed)
    ? (() => { const c = campCenter(tx, tz, seed); return { x: c.x, z: c.z, y: Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1) }; })()
    : null;
export const relayNodeAt = (tx: number, tz: number, seed: number): { x: number; z: number; y: number } | null =>
  relayAtSeed(tx, tz, seed)
    ? (() => { const c = relayCenter(tx, tz, seed); return { x: c.x, z: c.z, y: Math.max(Math.round(heightAt(c.x, c.z, seed)), SIL_SEA + 1) }; })()
    : null;

/* ── The Volcano ────────────────────────────────────────────────────────────
 * One Volcano per world: the Scorch Belt's hot point and the Sentinel's
 * dungeon. Its centre is not a lattice point — it is a pure function of the
 * seed (the hottest scorch point in a ring around arrival, memoized). Above
 * ground: a basalt cone (radius 14, rising ~6 over the field) with an open
 * 3×3 throat. Below: three rooms stacked on the shaft, each joined to the
 * next by a step-well — a 5×5 shaft with one BASALT step per level walking
 * the wall-ring in a spiral, so the way down is walkable back up, and a
 * POWER_POLE chain hangs down the well's centre for the Arena's circuit.
 *
 *   Hall     21×17 × 5 — its walls hold three POWER_CONDUIT columns: the
 *                        Sentinel's shield feed. Cut all three, it is mortal.
 *   Gallery  15×15 × 4 — the cooling gallery. Two basalt plugs seal a 2×2
 *                        WATER Source against each plug behind the north
 *                        wall; break a plug and the Gallery floods.
 *   Arena    21×21 × 7  — the Sentinel's floor: two prebuilt Shock Coil
 *                        pylons stand ready, powered the moment a Grid
 *                        closes onto the well's Pole chain.
 *
 * The rooms' basalt shell is painted over the column pass, so caves never
 * eat the dungeon. Chunk painting claims last: the Volcano outranks every
 * lattice site (and its candidate search avoids them anyway). */

export const VOLC_R = 14;
export interface Volcano {
  x: number; z: number;   // shaft centre
  f: number;              // surface floor at the throat
  hallY: number; gallY: number; arenaY: number;
  conduits: [number, number, number][]; // the three wall cells to cut
  seals: [number, number, number][];    // the two Gallery plugs
  coils: [number, number, number][];    // prebuilt Shock Coil cells
}

const volcCache = new Map<number, Volcano>();

const clearOfLattice = (x: number, z: number, seed: number, L: number, R: number,
  atSeed: (tx: number, tz: number, s: number) => boolean,
  center: (tx: number, tz: number, s: number) => { x: number; z: number }): boolean => {
  for (let tx = Math.floor((x - R) / L); tx <= Math.floor((x + R) / L); tx++)
    for (let tz = Math.floor((z - R) / L); tz <= Math.floor((z + R) / L); tz++)
      if (atSeed(tx, tz, seed)) {
        const c = center(tx, tz, seed);
        if (Math.hypot(c.x - x, c.z - z) < R) return false;
      }
  return true;
};

export function volcano(seed: number): Volcano {
  const hit = volcCache.get(seed);
  if (hit) return hit;
  let bx = 0, bz = 0, bs = -1, ax = 0, az = 0, as = -1;
  for (let gx = -14; gx <= 14; gx++) for (let gz = -14; gz <= 14; gz++) {
    const x = gx * 64 + Math.floor(hash2(gx, gz, seed + 977) * 48) - 24;
    const z = gz * 64 + Math.floor(hash2(gx, gz, seed + 991) * 48) - 24;
    const d = Math.hypot(x, z);
    if (d < 460 || d > 920) continue;
    if (!clearOfLattice(x, z, seed, SETTLE_L, SETTLE_R + VOLC_R, settleAtSeed, settleCenter)) continue;
    if (!clearOfLattice(x, z, seed, TRADER_L, TRADER_R + VOLC_R, traderAtSeed, traderCenter)) continue;
    if (!clearOfLattice(x, z, seed, CAMP_L, CAMP_R + VOLC_R, campAtSeed, campCenter)) continue;
    if (!clearOfLattice(x, z, seed, RELAY_L, RELAY_R + VOLC_R, relayAtSeed, relayCenter)) continue;
    const s = scorchField(x, z, seed);
    if (s > as) { as = s; ax = x; az = z; }
    if (s > 0.78 && s > bs) { bs = s; bx = x; bz = z; }
  }
  if (bs < 0) { bx = ax; bz = az; } // no strong scorch in the ring: hottest point anyway
  const x = Math.round(bx), z = Math.round(bz);
  const f = Math.max(42, Math.round(heightAt(x, z, seed)));
  const hallY = f - 12, gallY = hallY - 9, arenaY = gallY - 9;
  const v: Volcano = {
    x, z, f, hallY, gallY, arenaY,
    conduits: [[x - 11, hallY + 2, z], [x + 11, hallY + 2, z], [x, hallY + 2, z - 9]],
    seals: [[x - 5, gallY, z + 8], [x + 5, gallY, z + 8]],
    coils: [[x - 6, arenaY, z - 6], [x + 6, arenaY, z - 6]],
  };
  volcCache.set(seed, v);
  return v;
}

function paintVolcano(set: (x: number, y: number, z: number, id: number) => void, v: Volcano, seed: number) {
  const { x, z, f, hallY, gallY, arenaY } = v;
  // the cone: basalt from the ground up to a rim that slopes down to the field
  for (let dx = -VOLC_R; dx <= VOLC_R; dx++) for (let dz = -VOLC_R; dz <= VOLC_R; dz++) {
    const d = Math.hypot(dx, dz);
    if (d > VOLC_R) continue;
    const wx = x + dx, wz = z + dz;
    const h = Math.round(heightAt(wx, wz, seed));
    const lift = Math.max(0, Math.round(6 * (1 - d / (VOLC_R + 1))));
    for (let y = h + 1; y <= f + lift; y++) set(wx, y, wz, BASALT);
    for (let y = Math.max(f + lift + 1, h + 1); y < CH; y++) set(wx, y, wz, AIR);
  }
  // rooms first (shell seals them from caves), then the carves that open them
  const room = (y0: number, hx: number, hz: number, hh: number) => {
    for (let dx = -hx - 1; dx <= hx + 1; dx++) for (let dz = -hz - 1; dz <= hz + 1; dz++)
      for (let y = y0 - 1; y <= y0 + hh; y++) set(x + dx, y, z + dz, BASALT);
    for (let dx = -hx; dx <= hx; dx++) for (let dz = -hz; dz <= hz; dz++)
      for (let y = y0; y < y0 + hh; y++) set(x + dx, y, z + dz, AIR);
  };
  room(hallY, 10, 8, 5);
  room(gallY, 7, 7, 4);
  room(arenaY, 10, 10, 7);
  // the throat: crater bowl down to f, then the 3×3 shaft to the Hall floor
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
    for (let y = f; y <= f + 6; y++) if (Math.hypot(dx, dz) <= 2.5) set(x + dx, y, z + dz, AIR);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
    for (let y = hallY; y <= f + 6; y++) set(x + dx, y, z + dz, AIR);
  // step-wells: 5×5 shafts, one step per level spiralling the wall ring,
  // with the Pole chain hanging down the middle (Pole reach 10 covers the
  // Gallery; the Arena coils sit within a room of the lowest Pole)
  const ring: [number, number][] = [];
  for (let dx = -2; dx <= 2; dx++) ring.push([dx, 2]);
  for (let dz = 1; dz >= -2; dz--) ring.push([2, dz]);
  for (let dx = 1; dx >= -2; dx--) ring.push([dx, -2]);
  for (let dz = -1; dz <= 1; dz++) ring.push([-2, dz]);
  const well = (yFrom: number, yTo: number) => {
    // shaft between the two rooms' floor planes: blocks yTo..yFrom-1 open,
    // both rooms' floor blocks stay — the opening is a 5×5 hole in the
    // upper floor, rimmed by the spiral: one step block per level walking
    // the wall ring, so feet drop exactly one rise per stride
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let y = yTo; y <= yFrom - 1; y++) set(x + dx, y, z + dz, AIR);
    let i = 0;
    for (let y = yTo; y <= yFrom - 1; y++) { set(x + ring[i % 16][0], y, z + ring[i % 16][1], BASALT); i++; }
    for (let y = yFrom - 3; y >= yTo + 2; y -= 6) set(x, y, z, POWER_POLE);
  };
  well(hallY, gallY);
  well(gallY, arenaY);
  // conduits: three emissive columns set into the Hall walls
  for (const [cx0, cy0, cz0] of [[x - 11, hallY + 1, z], [x + 11, hallY + 1, z], [x, hallY + 1, z - 9]] as const)
    for (let y = cy0; y < cy0 + 3; y++) set(cx0, y, cz0, POWER_CONDUIT);
  // plugs + coolant: a 2×2 WATER Source column behind each Gallery plug
  for (const sx of [x - 5, x + 5]) {
    set(sx, gallY, z + 8, BASALT); set(sx, gallY + 1, z + 8, BASALT);
    for (let dz = 9; dz <= 10; dz++) for (let y = gallY - 1; y <= gallY + 1; y++)
      set(sx, y, z + dz, y >= gallY ? WATER : BASALT);
  }
  // the Arena's pylons: prebuilt Shock Coils, inert until a Grid reaches them
  for (const [kx, ky, kz] of v.coils) set(kx, ky, kz, SHOCK_COIL);
  // light and the Sentinel's stores
  for (const [lx, ly, lz] of [[x - 10, hallY, z - 8], [x + 10, hallY, z + 8],
    [x - 7, gallY, z - 7], [x + 7, gallY, z + 7],
    [x - 10, arenaY, z + 10], [x + 10, arenaY, z - 10]] as const) set(lx, ly, lz, LAMP);
  for (const [cx0, cy0, cz0] of [[x - 9, hallY, z + 7], [x + 9, hallY, z + 7]] as const) set(cx0, cy0, cz0, CHEST);
}

/* ── Oil seeps ───────────────────────────────────────────────────────────────
 * The desert's black liquid, on its own lattice (coprime with both the
 * settlement and the Trader lattices, and with its own salts): a bowl of Oil
 * Source sunk into Oil-Sands stain, with a couple of scoopable pans off the
 * rim — the desert's seep paint, same flow-safety rules (a Source stands on
 * a stained floor, ringed by ground that never dips below the oil line).
 * Only ever dry lowland: never the sea, never the peaks, never arrival
 * country, never beside a site. The Refinery out here feeds on what this
 * world sweats. */

export const SIL_SEEP_L = 220;
const SIL_SEEP_J = 50;
const SIL_SEEP_R = 7; // biggest pool radius the paint can draw

export interface SilSeep { x: number; z: number; r: number; } // centre + pool radius

const silSeepOf = (ix: number, iz: number, seed: number): SilSeep | null => {
  if (hash2(ix, iz, seed + 701) >= 0.7) return null;
  const jx = (hash2(ix, iz, seed + 703) - 0.5) * 2 * SIL_SEEP_J;
  const jz = (hash2(ix, iz, seed + 705) - 0.5) * 2 * SIL_SEEP_J;
  const x = Math.round(ix * SIL_SEEP_L + jx), z = Math.round(iz * SIL_SEEP_L + jz);
  if (x * x + z * z < 90 * 90) return null; // arrival country stays clean
  if (Math.round(heightAt(x, z, seed)) <= SIL_SEA + 2) return null; // dry ground only
  const bi = biomeAt(x, z, seed);
  if (bi === SB_ALPINE || bi === SB_DEEP || bi === SB_SHALLOWS) return null; // lowland tar
  const hb = Math.round(heightAt(x, z, seed));
  for (let dx = -SIL_SEEP_R - 4; dx <= SIL_SEEP_R + 4; dx += 4)
    for (let dz = -SIL_SEEP_R - 4; dz <= SIL_SEEP_R + 4; dz += 4)
      if (Math.abs(Math.round(heightAt(x + dx, z + dz, seed)) - hb) > 2) return null; // the bowl needs flat ground
  if (settleSiteAt(x, z, seed) !== null || settleNear(x, z, SIL_SEEP_R + 5, seed)) return null;
  const t0 = Math.floor((x - 40) / TRADER_L), t1 = Math.floor((x + 40) / TRADER_L);
  const s0 = Math.floor((z - 40) / TRADER_L), s1 = Math.floor((z + 40) / TRADER_L);
  for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
    if (!traderAtSeed(tx, tz, seed)) continue;
    const c = traderCenter(tx, tz, seed);
    if (Math.hypot(c.x - x, c.z - z) < 40) return null; // no tar under a camp
  }
  return { x, z, r: 3.5 + hash2(ix, iz, seed + 707) * (SIL_SEEP_R - 3.5) };
};

/** Sink one Oil pan into the stained crust: a Source on oil sand with level
 *  ground all around, so the flow sim never carries the tar away. */
function silOilPan(set: (x: number, y: number, z: number, id: number) => void, seed: number, x: number, z: number): boolean {
  const h = Math.round(heightAt(x, z, seed));
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    if (Math.round(heightAt(x + ox, z + oz, seed)) < h) return false;
  set(x, h, z, OIL);
  set(x, h - 1, z, OIL_SANDS);
  return true;
}

function paintSilSeep(set: (x: number, y: number, z: number, id: number) => void, s: SilSeep, seed: number) {
  const hb = Math.round(heightAt(s.x, s.z, seed));
  for (let dx = -s.r - 4; dx <= s.r + 4; dx++) {
    for (let dz = -s.r - 4; dz <= s.r + 4; dz++) {
      const x = s.x + dx, z = s.z + dz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const h = Math.round(heightAt(x, z, seed));
      if (d <= s.r) {
        const dep = Math.max(1, Math.round(2.7 - 1.7 * (d / s.r))); // bowl: 3 .. 1
        for (let y = h; y > hb - dep; y--) set(x, y, z, AIR);
        set(x, hb - dep, z, OIL_SANDS);
        for (let y = hb - dep + 1; y <= hb; y++) set(x, y, z, OIL);
        // nothing grows in the tar: the terrain pass may have rooted a
        // tundroot, a bush or a trunk here before the pool was cut
        for (let y = hb + 1; y <= hb + 8; y++) set(x, y, z, AIR);
      } else if (d <= s.r + 1) {
        for (let y = h; y < hb + 1; y++) set(x, y, z, OIL_SANDS); // stained rim
      } else if (d <= s.r + 4) {
        set(x, h, z, OIL_SANDS); // the stain fades out over the crust
      }
    }
  }
  // one or two pans just off the rim, so a scavenger can scoop the seep dry
  // without wading the pool
  for (let i = 0; i < 2; i++) {
    if (hash2(s.x, s.z, seed + 711 + i) > 0.55) continue;
    const a0 = hash2(s.z - i, s.x + i, seed + 713 + i) * Math.PI * 2;
    const r0 = s.r + 2 + hash2(s.x + i, s.z - i, seed + 715 + i);
    for (let t = 0; t < 3; t++) {
      const a = a0 + t * 2.1, rr = r0 + t;
      if (silOilPan(set, seed, s.x + Math.round(Math.cos(a) * rr), s.z + Math.round(Math.sin(a) * rr))) break;
    }
  }
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
  // the dwellers trade in ore and rods: every store carries a little of the
  // metals this world sits on, so a Chest is a scarce but real second vein
  if (rng() < 0.55) out.push({ item: "iron_ore", n: 3 + (rng() * 3 | 0) });
  if (rng() < 0.5) out.push({ item: "alabaster", n: 3 + (rng() * 4 | 0) });
  if (rng() < 0.45) out.push({ item: "coal_ore", n: 2 + (rng() * 3 | 0) });
  if (rng() < 0.4) out.push({ item: "copper_ore", n: 2 + (rng() * 2 | 0) });
  if (rng() < 0.3) out.push({ item: "cobalt_ore", n: 1 + (rng() * 2 | 0) });
  if (rng() < 0.3) out.push({ item: "titanium_ore", n: 2 + (rng() * 2 | 0) });
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

/** A Machine Camp's stores: chassis shards, Lead and battery salt, Slugs —
 *  everything a patrol squad eats or breaks. A spare Heart is rare loot:
 *  the kill-drop stays the prime way to one. */
export function getMachineLoot(rng: () => number): SilLoot[] {
  const out: SilLoot[] = [{ item: "machine_part", n: 2 + (rng() * 3 | 0) }, { item: "slug", n: 3 + (rng() * 5 | 0) }];
  if (rng() < 0.75) out.push({ item: "scrap", n: 3 + (rng() * 4 | 0) });
  if (rng() < 0.7) out.push({ item: "leadrod", n: 1 + (rng() * 3 | 0) });
  if (rng() < 0.6) out.push({ item: "saltpetre", n: 1 + (rng() * 3 | 0) });
  if (rng() < 0.5) out.push({ item: "steel_plating", n: 2 + (rng() * 2 | 0) });
  if (rng() < 0.4) out.push({ item: "elec_lamp", n: 1 });
  if (rng() < 0.3) out.push({ item: "battery", n: 1 });
  if (rng() < 0.25) out.push({ item: "titan_plating", n: 1 + (rng() * 2 | 0) });
  if (rng() < 0.15) out.push({ item: "machine_heart", n: 1 }); // a fallen squad's spare
  return out;
}

/** A Relay Tower's maintenance cache: salt, wire, and the tower's own parts. */
export function getRelayLoot(rng: () => number): SilLoot[] {
  const out: SilLoot[] = [{ item: "saltpetre", n: 2 + (rng() * 3 | 0) }, { item: "scrap", n: 2 + (rng() * 3 | 0) }];
  if (rng() < 0.7) out.push({ item: "leadrod", n: 1 + (rng() * 2 | 0) });
  if (rng() < 0.55) out.push({ item: "machine_part", n: 1 + (rng() * 2 | 0) });
  if (rng() < 0.45) out.push({ item: "power_pole", n: 1 + (rng() * 2 | 0) });
  if (rng() < 0.35) out.push({ item: "slug", n: 2 + (rng() * 4 | 0) });
  if (rng() < 0.2) out.push({ item: "titan_plating", n: 1 + (rng() * 2 | 0) });
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
        // wall crust (ADR-0014): Silvaris stone carries Lead and Saltpetre,
        // not the desert's Iron/Copper/Cobalt/Coal; TITANIUM runs deep,
        // GRAPHITE the mid band; SALT veins only under the Shallows
        if (bi === SB_ALPINE && y >= 92 && hash2(wx, wz + y, seed + 611) < 0.2) {
          safeSet(wx, y, wz, SNOW); // ice caves high in the peaks
        } else if (y <= 22 && hash2(wx * 5 + y, wz * 7 - y, seed + 333) < 0.4 &&
                   noise3(wx / 5 + 40, y / 5, wz / 5, seed + 431) > 0.886) {
          safeSet(wx, y, wz, TITANIUM_ORE);
        } else if (bi === SB_SHALLOWS && noise3(wx / 5 + 200, y / 5, wz / 5, seed + 451) > 0.85) {
          safeSet(wx, y, wz, SALT);
        } else if (y >= 24 && y <= 52 && noise3(wx / 5 + 40, y / 5, wz / 5, seed + 415) > 0.872) {
          safeSet(wx, y, wz, LEAD_ORE); // the Wiring Bench's metal, in the middle band
        } else if (y >= 34 && noise3(wx / 5 + 300, y / 5 + 90, wz / 5, seed + 447) > 0.868) {
          safeSet(wx, y, wz, SALTPETRE_ORE); // the battery salt crusting the upper caves
        } else if (y >= 16 && y <= 32 && noise3(wx / 5 + 40, y / 5, wz / 5, seed + 425) > 0.883) {
          safeSet(wx, y, wz, ALABASTER); // the old world's stone still veins here
        } else if (y >= 26 && y <= 46 && noise3(wx / 5, y / 5, wz / 5 + 70, seed + 421) > 0.883) safeSet(wx, y, wz, GRAPHITE_ORE);
      }

      // ── flora ──
      if (atOrigin) continue; // the arrival zone stands bare
      const inSettle = settleSiteAt(wx, wz, seed) !== null;
      if (inSettle) continue; // settlements own their ground
      // Boreal: dense Silvertimber trunks under SIL_LEAVES canopies; Plains:
      // occasional trees. Same mature-tree plan as the desert, own wood.
      const growGate = bi === SB_BOREAL ? 0.905 : bi === SB_PLAINS ? 0.978 : 2;
      if (bi === SB_BOREAL || bi === SB_PLAINS) {
        if (h > SIL_SEA + 1 && h + 9 <= SIL_PEAK_MAX && hash2(wx, wz, seed + 601) > growGate) {
          const rnd = new Rng(((hash2(wx, wz, seed + 607) * 4294967296) >>> 0) || 1);
          for (const p of treePlan(wx, h + 1, wz, () => rnd.next()))
            safeSet(p.x, p.y, p.z, p.b === WOOD ? SIL_WOOD : p.b === LEAVES ? SIL_LEAVES : p.b);
        }
        // Tundra Root scattered across the plains: ripe stands with sprouts
        if (bi === SB_PLAINS && h > SIL_SEA + 1 && hash2(wx, wz, seed + 613) > 0.987) {
          safeSet(wx, h + 1, wz, hash2(wx, wz, seed + 617) > 0.5 ? TUNDROOT_2 : TUNDROOT_1);
        }
        // Frost Oats in wild stands on the plains — break ripe for grain and seed
        if (bi === SB_PLAINS && h > SIL_SEA + 1 && hash2(wx, wz, seed + 631) > 0.982) {
          safeSet(wx, h + 1, wz, hash2(wx, wz, seed + 637) > 0.4 ? OAT_2 : OAT_1);
        }
        // Ember Bush along the Boreal edge of the Scorch Belt
        if (bi === SB_BOREAL) {
          const nearScorch = fbm2(wx / 320 + 0.3, wz / 320 - 0.7, seed + 205, 3);
          if (nearScorch > 0.64 && hash2(wx, wz, seed + 623) > 0.96) {
            const grown = hash2(wx, wz, seed + 629) > 0.66;
            safeSet(wx, h + 1, wz, grown ? EMBERBUSH_2 : EMBERBUSH_1);
            // a grown bush tops itself with Ember Fruit — pick the fruit, the bush stays
            if (grown && hash2(wx, wz, seed + 643) > 0.45) safeSet(wx, h + 2, wz, EMBER_FRUIT);
          }
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

  // Oil seeps on their own lattice, painted before the structures claim
  // ground (they keep clear of sites anyway, but a site outranks tar)
  const sm = SIL_SEEP_R + 5;
  const qx0 = Math.floor((cx * CS - sm) / SIL_SEEP_L), qx1 = Math.floor((cx * CS + CS - 1 + sm) / SIL_SEEP_L);
  const qz0 = Math.floor((cz * CS - sm) / SIL_SEEP_L), qz1 = Math.floor((cz * CS + CS - 1 + sm) / SIL_SEEP_L);
  for (let ix = qx0; ix <= qx1; ix++) for (let iz = qz0; iz <= qz1; iz++) {
    const s = silSeepOf(ix, iz, seed);
    if (s) paintSilSeep(safeSet, s, seed);
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
  // Machine Camps and Relay Towers on their own lattices (jitter ±40/±45).
  const cm = CAMP_J + CAMP_R + 1;
  const vx0 = Math.floor((cx * CS - cm) / CAMP_L), vx1 = Math.floor((cx * CS + CS - 1 + cm) / CAMP_L);
  const vz0 = Math.floor((cz * CS - cm) / CAMP_L), vz1 = Math.floor((cz * CS + CS - 1 + cm) / CAMP_L);
  for (let tx = vx0; tx <= vx1; tx++) for (let tz = vz0; tz <= vz1; tz++) {
    if (!campAtSeed(tx, tz, seed)) continue;
    const c = campCenter(tx, tz, seed);
    if (cx * CS <= c.x + CAMP_R && cx * CS + CS - 1 >= c.x - CAMP_R &&
        cz * CS <= c.z + CAMP_R && cz * CS + CS - 1 >= c.z - CAMP_R)
      paintMachineCamp(safeSet, c, seed);
  }
  const rm = RELAY_J + RELAY_R + 1;
  const wx0 = Math.floor((cx * CS - rm) / RELAY_L), wx1 = Math.floor((cx * CS + CS - 1 + rm) / RELAY_L);
  const wz0 = Math.floor((cz * CS - rm) / RELAY_L), wz1 = Math.floor((cz * CS + CS - 1 + rm) / RELAY_L);
  for (let tx = wx0; tx <= wx1; tx++) for (let tz = wz0; tz <= wz1; tz++) {
    if (!relayAtSeed(tx, tz, seed)) continue;
    const c = relayCenter(tx, tz, seed);
    if (cx * CS <= c.x + RELAY_R && cx * CS + CS - 1 >= c.x - RELAY_R &&
        cz * CS <= c.z + RELAY_R && cz * CS + CS - 1 >= c.z - RELAY_R)
      paintRelay(safeSet, c, seed);
  }
  // The Volcano last: one per world, and its cone outranks every lattice
  // claim (the candidate search already keeps it clear of their sites).
  const V = volcano(seed);
  if (cx * CS <= V.x + VOLC_R && cx * CS + CS - 1 >= V.x - VOLC_R &&
      cz * CS <= V.z + VOLC_R && cz * CS + CS - 1 >= V.z - VOLC_R)
    paintVolcano(safeSet, V, seed);
}
