import {
  AIR, SAND, SANDSTONE, ROCK, GRAVEL, SALT, DEADWOOD, DIRT, HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL_PLATING, BEACON,
  WATER, ADOBE, INSGLASS, BENCH, BENCH_EXT, ENGINECORE, CS, CH, REGULATOR, CACTUS, CACTUS_FRUIT,
  DOOR_INNER, DOOR_INNER_UPPER, CHEST, BED, BED_EXT, MELON_2, WHEAT_2, FARMLAND, GRASS, WOOD, LEAVES,
  CURVED_HULL, HULL_SLOPE, IRON_ORE, COPPER_ORE, ALABASTER, COBALT_ORE, THRUSTER,
} from "./blocks";
import { fbm2, ridge2, value2, hash2, Rng } from "./noise";

// Biomes
export const B_DUNES = 0, B_ROCKY = 1, B_SALT = 2, B_MESA = 3, B_CANYON = 4;
export const BIOME_NAMES = ["Dunes", "Rocky Desert", "Salt Flats", "Badlands", "Canyons"];

const SP = 1e6; // structure id salt

export interface Oasis { x: number; z: number; r: number; }
/** One block of a staged Living Tree: b is the block id, stage 1 trunk base,
 *  2 full trunk + branches, 3 leaf canopy. Stamped in stage order. */
export interface TreePart { x: number; y: number; z: number; b: number; stage: number }
export interface Town { x: number; z: number; }
export interface CanisterSpawn { x: number; z: number; buried: boolean; }

/** Towns sit on this lattice: one sparse, jittered settlement per cell, forever —
 *  the desert never runs out of towns. */
export const TOWN_L = 320;

export class Structures {
  oases: Oasis[] = [];
  secondShip = { x: 0, z: 0 };
  /** A guaranteed Town at a second-wreck's distance, so the goal chain can't dead-end. */
  homeTown: Town = { x: 0, z: 0 };
  canisters: CanisterSpawn[] = [];

  constructor(public seed: number) {
    const r = new Rng(seed ^ 0x5f3a);
    for (let i = 0; i < 6; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(160, 900);
      this.oases.push({ x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), r: r.int(3, 5) });
    }
    {
      const a = r.range(0, Math.PI * 2), d = r.range(450, 700);
      this.secondShip = { x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d) };
    }
    {
      const ta = Math.atan2(this.secondShip.z, this.secondShip.x) + 0.9;
      const td = Math.hypot(this.secondShip.x, this.secondShip.z) * r.range(0.8, 1.15);
      this.homeTown = { x: Math.round(Math.cos(ta) * td), z: Math.round(Math.sin(ta) * td) };
    }
    for (let i = 0; i < 13; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(30, 600);
      this.canisters.push({ x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), buried: r.next() < 0.4 });
    }
  }

  nearOasis(x: number, z: number): Oasis | null {
    for (const o of this.oases) if (Math.abs(o.x - x) <= o.r + 1 && Math.abs(o.z - z) <= o.r + 1) return o;
    return null;
  }

  /** Jittered center of the Town on lattice cell (tx,tz) — deterministic. */
  townCenter(tx: number, tz: number): Town {
    if (tx === this.gtx && tz === this.gtz) return this.homeTown;
    const jx = (hash2(tx, tz, this.seed + 53) - 0.5) * 110;
    const jz = (hash2(tx, tz, this.seed + 55) - 0.5) * 110;
    return { x: Math.round(tx * TOWN_L + jx), z: Math.round(tz * TOWN_L + jz) };
  }

  private get gtx() { return Math.round(this.homeTown.x / TOWN_L); }
  private get gtz() { return Math.round(this.homeTown.z / TOWN_L); }

  /** Is there a Town on lattice cell (tx,tz)? Never near the crash, never in a pool. */
  townAt(tx: number, tz: number): boolean {
    if (tx === this.gtx && tz === this.gtz) return true; // guaranteed before any exclusion
    if (Math.abs(tx) < 2 && Math.abs(tz) < 2) return false;
    if (hash2(tx, tz, this.seed + 51) >= 0.4) return false;
    const c = this.townCenter(tx, tz);
    for (const o of this.oases)
      if (Math.hypot(o.x - c.x, o.z - c.z) < o.r + 14) return false;
    if (Math.hypot(this.secondShip.x - c.x, this.secondShip.z - c.z) < 30) return false;
    return true;
  }

  /** The nearest Town within `rad` of (x,z), or null. */
  townNear(x: number, z: number, rad: number): Town | null {
    let best: Town | null = null, bd = rad;
    const t0 = Math.floor((x - rad) / TOWN_L), t1 = Math.floor((x + rad) / TOWN_L);
    const s0 = Math.floor((z - rad) / TOWN_L), s1 = Math.floor((z + rad) / TOWN_L);
    for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
      if (!this.townAt(tx, tz)) continue;
      const c = this.townCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d <= bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Nearest Town in the whole lattice neighbourhood of (x,z) — for waypoints. */
  nearestTown(x: number, z: number): Town {
    let best: Town | null = null, bd = Infinity;
    const cx = Math.floor(x / TOWN_L), cz = Math.floor(z / TOWN_L);
    for (let tx = cx - 4; tx <= cx + 4; tx++) for (let tz = cz - 4; tz <= cz + 4; tz++) {
      if (!this.townAt(tx, tz)) continue;
      const c = this.townCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ?? this.homeTown;
  }
}

/**
 * Biome membership as soft weights, not hard bands. fbm2 picks a "biome value"
 * b in 0..1; each biome owns a band center and keeps a weight that decays with
 * distance to it, so terrain (and surface blocks) blend over ~100 m borders
 * instead of snapping at a line. Near the crash site the Dunes weight is
 * boosted so the wreck's surroundings ramp smoothly into whatever lies beyond.
 */
export function biomeWeights(x: number, z: number, seed: number): number[] {
  const b = Math.min(0.999, Math.max(0.001, fbm2(x / 900 + 0.5, z / 900 + 0.5, seed, 3)));
  const centers = [0.17, 0.42, 0.57, 0.72, 0.90];
  const w = centers.map((c) => Math.exp(-Math.abs(b - c) / 0.05));
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r < 80) w[0] += Math.pow(1 - r / 80, 2) * 6;
  const s = w.reduce((a, v) => a + v, 0);
  return w.map((v) => v / s);
}

export function biomeAt(x: number, z: number, seed: number): number {
  const w = biomeWeights(x, z, seed);
  let bi = 0;
  for (let i = 1; i < 5; i++) if (w[i] > w[bi]) bi = i;
  return bi;
}

function heightRaw(seed: number, x: number, z: number): number {
  const w = biomeWeights(x, z, seed);
  const hs = [
    30 + fbm2(x / 140, z / 140, seed + 7) * 8 + Math.sin(x / 9 + z / 13) * 0.9,                    // dunes
    29 + fbm2(x / 160, z / 160, seed + 9) * 6 + Math.max(0, value2(x / 26, z / 26, seed + 11) - 0.72) * 10, // rocky
    28 + fbm2(x / 220, z / 220, seed + 5) * 3,                                                     // salt flats
    33 + Math.floor(fbm2(x / 170, z / 170, seed + 13) * 4.99) * 5,                                 // badlands mesas
    29 - ridge2(x / 210, z / 210, seed + 17) * 9,                                                  // canyons
  ];
  let h = 0;
  for (let i = 0; i < 5; i++) h += w[i] * hs[i];
  return h;
}

/** Flat crash-site plateau under the wreck, feathered out to natural terrain by r=30. */
export function heightAt(seed: number, x: number, z: number): number {
  const r = Math.max(Math.abs(x), Math.abs(z));
  const nat = heightRaw(seed, x, z);
  if (r >= 30) return nat;
  if (r <= 14) return 30;
  const t = (r - 14) / 16, s = t * t * (3 - 2 * t);
  return 30 + (nat - 30) * s;
}

function surfaceBlock(seed: number, x: number, z: number, y: number, h: number): number {
  const w = biomeWeights(x, z, seed);
  let bi = 0, b2 = 1;
  if (w[1] > w[0]) { bi = 1; b2 = 0; }
  for (let i = 2; i < 5; i++)
    if (w[i] > w[bi]) { b2 = bi; bi = i; }
    else if (w[i] > w[b2]) b2 = i;
  // near a border, speckle the surface with the runner-up biome so blocks mix too
  if (w[b2] / w[bi] > 0.35 && hash2(x, z, seed + 45) < w[b2] / (w[bi] + w[b2])) bi = b2;
  if (y === h) {
    if (bi === B_SALT) return SALT;
    if (bi === B_CANYON) return ROCK;
    if (bi === B_MESA) return SANDSTONE;
    if (bi === B_ROCKY) return hash2(x, z, seed + 41) > 0.78 ? GRAVEL : SAND;
    return SAND;
  }
  if (y >= h - 3) return bi === B_CANYON ? ROCK : SAND;
  return bi === B_MESA || bi === B_CANYON ? ROCK : SANDSTONE;
}

/* ── Underground: caves, wall ores, deep water ──────────────────────────────
 * Everything below the surface is a pure function of (seed, x, y, z), so
 * chunk edges agree no matter who evaluates a shared cell. */

/** Cheap trilinear value noise in 3D, built on hash2 (noise.ts has no 3D). */
function noise3(x: number, y: number, z: number, seed: number): number {
  const sm = (t: number) => t * t * (3 - 2 * t);
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const g = (i: number, j: number, k: number) => hash2(i + k * 911, j + k * 577, seed);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(g(xi, yi, zi), g(xi + 1, yi, zi), xf);
  const x10 = lerp(g(xi, yi + 1, zi), g(xi + 1, yi + 1, zi), xf);
  const x01 = lerp(g(xi, yi, zi + 1), g(xi + 1, yi, zi + 1), xf);
  const x11 = lerp(g(xi, yi + 1, zi + 1), g(xi + 1, yi + 1, zi + 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

/** Highest cave cell for a column: exactly the 4 solid cells under the
 *  surface stay rock (roof rule), and mesas don't drag the band above y 30. */
const caveTop = (h: number) => Math.min(h - 4, 30);

const oasisCache = new Map<number, Oasis[]>();
const oasesOf = (seed: number): Oasis[] => {
  let o = oasisCache.get(seed);
  if (!o) { o = new Structures(seed).oases; oasisCache.set(seed, o); }
  return o;
};

/** Is (x,y,z) cave air? One big-cheese 3D-noise field: two scales mixed, the
 *  threshold easing a little deeper down. Floor never below y=2, the crash
 *  site's footing stays whole, and the bowl under an oasis pool stays dry.
 *  Pass h when the caller already knows it. */
function caveAt(seed: number, x: number, y: number, z: number, h?: number): boolean {
  if (y < 3) return false;
  if (x * x + z * z < 240) return false; // the crash site's footing stays solid
  const hs = h ?? Math.round(heightAt(seed, x, z));
  let top = caveTop(hs);
  for (const o of oasesOf(seed))
    if (Math.abs(x - o.x) <= o.r + 1 && Math.abs(z - o.z) <= o.r + 1)
      top = Math.min(top, Math.round(heightAt(seed, o.x, o.z)) - 5); // keep pools sealed
  if (y > top) return false;
  const a = noise3(x / 9, y / 5.5, z / 9, seed + 301);
  const b = noise3(x / 23, y / 15, z / 23, seed + 307);
  // the cave roof hugs the solid crust (dig down half a dozen blocks and you
  // break through into something real); the field thins out deeper down
  return a * 0.55 + b * 0.45 > 0.575 + Math.max(0, top - y - 4) * 0.005;
}

/* ── Town dungeons ───────────────────────────────────────────────────────────
 * ~60% of Towns hide a small dungeon under the sand: 2-4 rooms on a 6-cell
 * lattice joined by 1-wide tunnels, a nest alcove off the first room, and a
 * 1x1 spiral stair shaft down from the surface near the plot edge. The whole
 * layout is a pure function of (townX, townZ, seed) — genChunk carves it,
 * dungeonEntrance() tells game.ts where the hole in the sand is, and any
 * chunk computes the same rooms independently. */

interface Dungeon {
  x0: number; x1: number; z0: number; z1: number; y0: number; y1: number;
  air: Set<string>;
  sh: { x: number; z: number; y0: number };
}
const DKEY = (x: number, y: number, z: number) => x + "," + y + "," + z;

function dungeonPlan(townX: number, townZ: number, seed: number): Dungeon | null {
  if (hash2(townX, townZ, seed + 121) >= 0.6) return null; // ~60% get one
  const hT = Math.round(heightAt(seed, townX, townZ));
  const yTop = hT - 4, yBot = hT - 16; // never closer than 4 below the surface
  if (yBot < 4) return null;
  const nR = 2 + (hash2(townX, townZ, seed + 123) * 3 | 0); // 2..4 rooms
  const rc: { x: number; z: number; hx: number; hz: number }[] = [];
  for (let i = 0; i < nR; i++) {
    const gx = -1 + (hash2(townX + i * 3, townZ, seed + 125) * 4 | 0); // lattice -1..2
    const gz = -1 + (hash2(townX, townZ + i * 3, seed + 127) * 4 | 0);
    rc.push({
      x: townX + gx * 6, z: townZ + gz * 6,
      hx: 1 + (hash2(townX - i, townZ + i, seed + 129) * 3 | 0), // side 3..7
      hz: 1 + (hash2(townX + i, townZ - i, seed + 131) * 3 | 0),
    });
  }
  const air = new Set<string>();
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, ya = Infinity, yb = -Infinity;
  const add = (x: number, y: number, z: number) => {
    air.add(DKEY(x, y, z));
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
    if (y < ya) ya = y; if (y > yb) yb = y;
  };
  const carveRect = (ax: number, bx: number, az: number, bz: number, ya2: number, yb2: number) => {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++)
        for (let y = ya2; y <= yb2; y++) add(x, y, z);
  };
  for (const r of rc) carveRect(r.x - r.hx, r.x + r.hx, r.z - r.hz, r.z + r.hz, yBot, yTop);
  // 1-wide tunnels, room centre to room centre (L-shaped)
  for (let i = 1; i < rc.length; i++) {
    carveRect(rc[i - 1].x, rc[i].x, rc[i - 1].z, rc[i - 1].z, yBot, yTop);
    carveRect(rc[i].x, rc[i].x, rc[i - 1].z, rc[i].z, yBot, yTop);
  }
  // nest alcove: a 2x2 pocket hanging off the first room's seaward wall
  const r0 = rc[0];
  const asx = hash2(townX, townZ + 1, seed + 133) > 0.5 ? 1 : -1;
  const asz = hash2(townX + 1, townZ, seed + 135) > 0.5 ? 1 : -1;
  const azx = r0.x + asx * (r0.hx + 1), azz = r0.z + asz * (r0.hz + 1);
  carveRect(azx, azx + 1, azz, azz + 1, yBot, yTop - 3);
  // entrance shaft: a 1x1 spiral stair near the plot edge — each step drops
  // one block around a 2x2 well, so it stays walkable all the way down
  const cand = [[9, -6], [9, 7], [-11, -5]] as const;
  const off = cand[hash2(townX, townZ, seed + 137) * 3 | 0];
  const sh = { x: townX + off[0], z: townZ + off[1] };
  const hS = Math.round(heightAt(seed, sh.x, sh.z));
  const y0 = hS, yEnd = Math.min(yTop - 8, hS - 3);
  if (y0 - yEnd < 4) return null; // surface too low here — no sensible shaft
  const ring = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  for (let k = 0; k <= y0 - yEnd; k++) {
    const p = ring[k & 3];
    const y = y0 - k;
    add(sh.x + p[0], y, sh.z + p[1]);
    add(sh.x + p[0], y + 1, sh.z + p[1]); // headroom
  }
  // bottom gallery at stair foot -> room 1 centre (2 tall to walk through):
  // one x-run at the shaft's z, then one z-run into the room
  carveRect(sh.x, r0.x, sh.z, sh.z, yEnd, yEnd + 1);
  carveRect(r0.x, r0.x, sh.z, r0.z, yEnd, yEnd + 1);
  return { x0, x1, z0, z1, y0: ya, y1: yb, air, sh: { ...sh, y0 } };
}

/** Carve one town's dungeon into this chunk and line its shell with Adobe,
 *  streaking in Alabaster — the reline is computed from the pure layout, so
 *  the lining matches across every chunk border. */
function paintDungeon(set: (x: number, y: number, z: number, id: number) => void, t: Town, seed: number) {
  const p = dungeonPlan(t.x, t.z, seed);
  if (!p) return;
  for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++)
    for (let y = p.y0; y <= p.y1; y++)
      if (p.air.has(DKEY(x, y, z))) set(x, y, z, AIR);
  for (let x = p.x0 - 1; x <= p.x1 + 1; x++) for (let z = p.z0 - 1; z <= p.z1 + 1; z++)
    for (let y = p.y0 - 1; y <= p.y1 + 1; y++) {
      if (p.air.has(DKEY(x, y, z))) continue;
      const exposed =
        p.air.has(DKEY(x + 1, y, z)) || p.air.has(DKEY(x - 1, y, z)) ||
        p.air.has(DKEY(x, y + 1, z)) || p.air.has(DKEY(x, y - 1, z)) ||
        p.air.has(DKEY(x, y, z + 1)) || p.air.has(DKEY(x, y, z - 1));
      if (exposed) set(x, y, z, hash2(x * 3 + z * 7, y * 5 + z, seed + 139) < 0.16 ? ALABASTER : ADOBE);
    }
}

/** Where the buried stair into this Town's dungeon pokes through the surface,
 *  or null if this Town has no dungeon. Pure and deterministic; game.ts marks
 *  these without gen.ts importing anything back. */
export function dungeonEntrance(seed: number, townX: number, townZ: number): { x: number; y: number; z: number } | null {
  const p = dungeonPlan(townX, townZ, seed);
  return p ? { x: p.sh.x, y: p.sh.y0, z: p.sh.z } : null;
}

/** Paint the crashed ship: a small, rounded wreck with wings and a raised spine.
 *  Interior x -5..3, z -4..4, floor y=30, interior y 31..33, ceiling y=34.
 *  Layout: forward cockpit (x 2..3, insulating-glass windscreen); central hall
 *  with the wreck's bench; aft row: save room (z -1..1, the ONLY door to the
 *  outside is at the stern), water compartment to the left (z 3..4, its tank is
 *  a pool dug into the ground), heat-regulator room to the right (z -4..-3).
 *  All bulkhead doors are Inside Doors and start closed: open one and the two
 *  spaces behind it share one temperature. The wreck is plated — Metal Plating
 *  floors and skin, never rods. */
function paintShip(set: (x: number, y: number, z: number, id: number) => void) {
  const Y0 = 30, Y1 = 34;
  // solid shell outline in plan view (rounded corners, tapered bow/stern tips)
  const outline = (x: number, z: number): boolean => {
    if (x === 4 || x === -6) return Math.abs(z) <= 4;      // bow / stern faces
    if (z === 5 || z === -5) return x >= -5 && x <= 3;     // flanks
    return x >= -5 && x <= 3 && z >= -4 && z <= 4;         // walls around interior
  };
  // rounding: clip the outer corners of the bow/stern faces, top and bottom
  const clipped = (x: number, y: number, z: number): boolean =>
    (x === 4 || x === -6) && Math.abs(z) >= 3 && (y === Y0 || y === Y1);
  // rounded corners: the four outer shell corner posts (every y in the shell)
  // and the flank cells the wings bolt into are Curved Hull, not flat HULL
  const cornerPost = (x: number, z: number) => Math.abs(z) === 5 && (x === 3 || x === -5);
  const wingJoint = (x: number, z: number, y: number) =>
    Math.abs(z) === 5 && x >= -3 && x <= 2 && y >= 31 && y <= 33;
  for (let x = -6; x <= 4; x++)
    for (let z = -5; z <= 5; z++)
      for (let y = Y0; y <= Y1; y++) {
        if (!outline(x, z) || clipped(x, y, z)) continue;
        // the cockpit tapers narrower than the rest of the hull
        const narrow = x >= 2 && Math.abs(z) > 2;
        const interior = x >= -5 && x <= 3 && z >= -4 && z <= 4 && y >= 31 && y <= 33 && !narrow;
        set(x, y, z, interior ? AIR : cornerPost(x, z) || wingJoint(x, z, y) ? CURVED_HULL : y === Y0 ? METAL_PLATING : HULL);
      }
  // rounded spine along the roof — sloped hull plates catch the light right
  for (let x = -3; x <= 1; x++) for (let z = -2; z <= 2; z++) set(x, 35, z, HULL_SLOPE);
  for (let x = -2; x <= 0; x++) for (let z = -1; z <= 1; z++) set(x, 36, z, HULL_SLOPE);
  // wings: thin plated planes out from the flanks, tapering at the tips
  for (let x = -2; x <= 1; x++) for (const z of [6, 7, 8, 9, -6, -7, -8, -9]) set(x, 32, z, METAL_PLATING);
  for (const x of [-3, 2]) for (const z of [6, 7, 8, -6, -7, -8]) set(x, 32, z, METAL_PLATING);
  for (const x of [-1, 0]) { set(x, 31, 10, METAL_PLATING); set(x, 31, -10, METAL_PLATING); }
  // the wingtips' last plating step, then the wreck's only surviving drive:
  // exactly 4 Thruster nozzles, one per wingtip, a hand's reach from a player
  // standing on the wing (their feet are at y 33, the nozzles sit at y 32)
  for (const x of [-1, 0]) { set(x, 31, 11, METAL_PLATING); set(x, 31, -11, METAL_PLATING); }
  for (const x of [-1, 0]) { set(x, 32, 11, THRUSTER); set(x, 32, -11, THRUSTER); }

  const door = (x: number, y: number, z: number) => { set(x, y, z, DOOR_CLOSED); set(x, y + 1, z, DOOR_UPPER); };
  // Inside Doors: interior bulkheads. Closed they keep rooms apart on their own
  // temperature; leave one open and the spaces merge into one room.
  const doorIn = (x: number, y: number, z: number) => { set(x, y, z, DOOR_INNER); set(x, y + 1, z, DOOR_INNER_UPPER); };
  // bulkhead between hall and cockpit, and between hall and the aft row
  for (let z = -4; z <= 4; z++) for (let y = 31; y <= 33; y++) { set(1, y, z, HULL); set(-2, y, z, HULL); }
  for (let x = -5; x <= -3; x++) for (const z of [-2, 2]) for (let y = 31; y <= 33; y++) set(x, y, z, HULL);
  doorIn(1, 31, 0);        // hall -> cockpit
  doorIn(-2, 31, 0);       // hall -> save room
  doorIn(-2, 31, 3);       // hall -> water compartment
  doorIn(-2, 31, -3);      // hall -> regulator room
  door(-6, 31, 0);         // stern: the only door to the outside

  // cockpit windscreen: insulating glass, rare but heat-safe
  for (let z = -2; z <= 2; z++) for (let y = 32; y <= 33; y++) set(4, y, z, INSGLASS);

  // water compartment: the ship's tank is a pool sunk into the ground —
  // look at the water in the hole and press E to refill canisters
  set(-4, 30, 4, WATER); set(-4, 29, 4, WATER);
  set(-3, 30, 4, WATER);
  // one heat regulator, pre-installed in the small regulator room — the
  // wreck's heart stays body-neutral while you fly out
  set(-4, 31, -4, REGULATOR);
  // save room beacon
  set(-4, 31, -1, BEACON);
  // crafting bench in the hall — the bench is a two-block structure
  set(0, 31, -3, BENCH); set(0, 31, -2, BENCH_EXT);
  // ceiling lamps, one per room
  for (const [lx, lz] of [[3, 0], [0, 0], [-4, 3], [-4, -3], [-5, 0]] as const) set(lx, Y1, lz, LAMP);
  // scattered plating salvage — kept clear of every doorway approach
  for (const [sx, sz] of [[0, 3], [0, 4], [-1, 4], [2, 2]] as const) set(sx, 31, sz, METAL_PLATING);
}

function paintSecondShip(set: (x: number, y: number, z: number, id: number) => void, t: { x: number; z: number }, seed: number) {
  const r = new Rng(SP + 77);
  // a stub of the hull still stands where she hit: a 5x5 shell outline,
  // three tall, rounded at the corner posts like her sister wreck — but this
  // one burned through her drive, so no thrusters survive out here
  const h = Math.round(heightAt(seed, t.x, t.z));
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (Math.abs(x) !== 2 && Math.abs(z) !== 2) continue;
    const corner = Math.abs(x) === 2 && Math.abs(z) === 2;
    for (let y = h + 1; y <= h + 3; y++) set(t.x + x, y, t.z + z, corner ? CURVED_HULL : HULL);
  }
  for (let y = h + 1; y <= h + 2; y++) set(t.x, y, t.z - 2, AIR); // a gap to walk in through
  for (let i = 0; i < 40; i++) {
    const x = t.x + r.int(-5, 5), z = t.z + r.int(-5, 5);
    const y = Math.round(heightAt(seed, x, z));
    const roll = r.next();
    set(x, y + r.int(0, 1), z, roll < 0.45 ? HULL : roll < 0.55 ? CURVED_HULL : METAL_PLATING);
  }
  // the Engine Core sits at the exact center of the debris field, on the ground
  set(t.x, Math.round(heightAt(seed, t.x, t.z)) + 1, t.z, ENGINECORE);
}

/** The full mature Living Tree rooted at (x, y, z) — (x, y, z) is the FIRST
 *  trunk block above the ground — as staged entries in stamping order:
 *  stage 1 trunk base, stage 2 rest of trunk + branch stubs, stage 3 leaf
 *  canopy. Trunk 5-7 tall (WOOD), blobby LEAVES crown. Pure and deterministic:
 *  same base + same `rnd` stream ⇒ identical tree. gen.ts stamps every stage;
 *  game.ts replays the same plan to grow a sapling stage by stage. */
export function treePlan(x: number, y: number, z: number, rnd: () => number): TreePart[] {
  const H = 5 + Math.floor(rnd() * 3); // trunk 5..7 blocks
  const parts: TreePart[] = [];
  const at = (px: number, py: number, pz: number, b: number, stage: number) =>
    parts.push({ x: px, y: py, z: pz, b, stage });
  // stage 1: the trunk's first two blocks
  at(x, y, z, WOOD, 1);
  at(x, y + 1, z, WOOD, 1);
  // stage 2: the rest of the trunk, plus 2-3 branch stubs reaching into the crown
  for (let dy = 2; dy < H; dy++) at(x, y + dy, z, WOOD, 2);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const nBranch = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < nBranch; i++) {
    const d = dirs[Math.floor(rnd() * 4)];
    at(x + d[0], y + H - 2 + (i % 2), z + d[1], WOOD, 2);
  }
  // stage 3: blobby canopy — a squashed ellipsoid around the trunk top with a
  // deterministically ragged rim; branches and trunk keep their own blocks
  const filled = new Set(parts.map((p) => p.x + "," + p.y + "," + p.z));
  const top = y + H - 1;
  for (let dy = -1; dy <= 2; dy++) {
    const prof = dy === -1 || dy === 2 ? 1.7 : 2.4; // leafy radius per layer
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const rr = dx * dx + dz * dz + dy * dy * 2.2;
      if (rr > prof * prof) continue;
      if (rr > (prof - 0.9) * (prof - 0.9) && rnd() < 0.3) continue; // ragged edge
      if (dx === 0 && dz === 0) continue;                            // the trunk breathes there
      const px = x + dx, py = top + dy, pz = z + dz;
      if (filled.has(px + "," + py + "," + pz)) continue;
      at(px, py, pz, LEAVES, 3);
    }
  }
  return parts;
}

/** Stamp a whole mature tree into the world at a spot, seeded by its base. */
function stampTree(set: (x: number, y: number, z: number, id: number) => void, x: number, groundTop: number, z: number, seed: number, salt: number) {
  const rnd = new Rng(((hash2(x, z, seed + salt) * 4294967296) >>> 0) || 1);
  for (const p of treePlan(x, groundTop + 1, z, () => rnd.next())) set(p.x, p.y, p.z, p.b);
}

function paintOasis(set: (x: number, y: number, z: number, id: number) => void, o: Oasis, seed: number) {
  const hb = Math.round(heightAt(seed, o.x, o.z));
  // a ROUND pool: disc with a bowl-rounded bottom — 3 deep at the middle,
  // sloping through 2 to 1 at the rim — water surface flush with the rim
  for (let dx = -o.r - 1; dx <= o.r + 1; dx++) {
    for (let dz = -o.r - 1; dz <= o.r + 1; dz++) {
      const x = o.x + dx, z = o.z + dz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const h = Math.round(heightAt(seed, x, z));
      if (d <= o.r) {
        const dep = Math.max(1, Math.round(2.7 - 1.7 * (d / o.r))); // bowl: 3 .. 1
        for (let y = h; y > hb - dep; y--) set(x, y, z, AIR);
        set(x, hb - dep, z, SAND);
        for (let y = hb - dep + 1; y <= hb; y++) set(x, y, z, WATER);
      } else if (d <= o.r + 1) {
        for (let y = h; y < hb + 1; y++) set(x, y, z, SAND);
      }
    }
  }
  // a living ring: GRASS over DIRT, 3-4 wide, hugging the pool rim
  const gring = 3 + (hash2(o.x, o.z, seed + 73) < 0.5 ? 1 : 0);
  for (let dx = -o.r - gring; dx <= o.r + gring; dx++) {
    for (let dz = -o.r - gring; dz <= o.r + gring; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= o.r || d > o.r + gring) continue;
      const x = o.x + dx, z = o.z + dz;
      const top = Math.max(Math.round(heightAt(seed, x, z)), hb);
      for (let y = top - 2; y <= top; y++) set(x, y, z, y === top ? GRASS : DIRT);
    }
  }
  // 4-7 mature Living Trees scattered on and just past the green ring
  const nTree = 4 + Math.floor(hash2(o.x, o.z, seed + 75) * 4); // 4..7
  for (let i = 0; i < nTree; i++) {
    const a = i * (Math.PI * 2 / nTree) + hash2(o.x + i, o.z - i, seed + 77) * 1.1;
    const rr = o.r + 1.5 + hash2(o.x - i, o.z + i, seed + 79) * (gring + 2);
    const tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    const top = Math.max(Math.round(heightAt(seed, tx, tz)), hb);
    stampTree(set, tx, top, tz, seed, 81);
  }
  // ripe Dune Melons ripen on the sand at the water's edge — the desert's free drink
  for (let i = 0; i < 5; i++) {
    if (hash2(o.x, o.z, seed + 61 + i) < 0.35) continue;
    const a = i * 1.27 + hash2(o.z, o.x, seed + 67 + i) * 0.8;
    const rr = o.r + 0.5;
    const tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    if (Math.hypot(tx - o.x, tz - o.z) < o.r) continue; // never in the pool
    set(tx, Math.max(Math.round(heightAt(seed, tx, tz)), hb) + 1, tz, MELON_2);
  }
}

function paintTown(set: (x: number, y: number, z: number, id: number) => void, t: Town, seed: number) {
  // 5x5 huts dug a foot into the sand: floor at h-1, interior air h..h+2,
  // roof at h+3 — a person walks in upright through the doorway and stands
  // inside with room to spare. The shell is filled in around the hollow.
  for (const [bx, bz] of [[-4, -3], [3, 2], [-3, 5]] as const) {
    const h = Math.round(heightAt(seed, t.x + bx, t.z + bz));
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
      for (let y = h - 1; y <= h + 3; y++) {
        const floor = y === h - 1;
        const wall = (x === 0 || x === 4 || z === 0 || z === 4) && y >= h && y <= h + 2;
        const roof = y === h + 3;
        // doorway on the -x face: two cells wide so turning inside is easy
        const door = x === 0 && (z === 2 || z === 3) && y >= h && y <= h + 2;
        if (!(floor || wall || roof) || door) { set(t.x + bx + x, y, t.z + bz + z, AIR); continue; }
        set(t.x + bx + x, y, t.z + bz + z, ADOBE);
      }
    }
    // every hut left behind a Supply Chest and a Bed; the good loot is decided
    // when the chest is first opened (seeded, game.ts)
    set(t.x + bx + 1, h, t.z + bz + 1, CHEST);
    set(t.x + bx + 2, h, t.z + bz + 1, BED);
    set(t.x + bx + 3, h, t.z + bz + 1, BED_EXT);
  }
  // a pocket of greenery the town once watered: a GRASS/DIRT patch 5-9 wide
  // with 3-6 mature Living Trees rooted in and around it
  const gx = t.x + 3 + Math.round((hash2(t.x, t.z, seed + 83) - 0.5) * 8);
  const gz = t.z - 3 + Math.round((hash2(t.z, t.x, seed + 85) - 0.5) * 8);
  const pr = 2.5 + hash2(t.x, t.z, seed + 87) * 2; // radius 2.5-4.5 → 5-9 wide
  // keep greenery clear of the hut footprints (with a block of margin so tree
  // canopies never poke through a roof)
  const inHut = (x: number, z: number) =>
    [[-4, -3], [3, 2], [-3, 5]].some(([bx, bz]) => x >= bx - 1 + t.x && x <= bx + 5 + t.x && z >= bz - 1 + t.z && z <= bz + 5 + t.z);
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
    if (Math.sqrt(dx * dx + dz * dz) > pr) continue;
    const x = gx + dx, z = gz + dz;
    if (inHut(x, z)) continue;
    const h = Math.round(heightAt(seed, x, z));
    for (let y = h - 2; y <= h; y++) set(x, y, z, y === h ? GRASS : DIRT);
  }
  const nTree = 3 + Math.floor(hash2(t.x, t.z, seed + 89) * 4); // 3..6
  for (let i = 0; i < nTree; i++) {
    const a = i * (Math.PI * 2 / nTree) + hash2(t.x + i, t.z - i, seed + 91) * 1.3;
    const rr = 1 + hash2(t.x - i, t.z + i, seed + 93) * pr;
    const tx = gx + Math.round(Math.cos(a) * rr), tz = gz + Math.round(Math.sin(a) * rr);
    if (inHut(tx, tz)) continue;
    stampTree(set, tx, Math.round(heightAt(seed, tx, tz)), tz, seed, 95);
  }
  // someone's farm, gone to seed: a plot of Farmland with a few survivors standing
  const fh = Math.round(heightAt(seed, t.x, t.z + 11));
  for (let x = 0; x < 5; x++) for (let z = 0; z < 3; z++) set(t.x - 8 + x, fh, t.z + 10 + z, FARMLAND);
  set(t.x - 7, fh + 1, t.z + 11, WHEAT_2);
  set(t.x - 5, fh + 1, t.z + 10, WHEAT_2);
  set(t.x - 4, fh + 1, t.z + 12, MELON_2);
}

export function genChunk(seed: number, st: Structures, cx: number, cz: number): Uint8Array {
  const c = new Uint8Array(CS * CS * CH);
  const setW = (wx: number, wy: number, wz: number, id: number) => {
    const x = wx - cx * CS, z = wz - cz * CS;
    if (x >= 0 && x < CS && z >= 0 && z < CS && wy >= 0 && wy < CH) c[(x * CS + z) * CH + wy] = id;
  };

  // Chunk-local cave mask with a 1-cell margin for the wall-ore checks:
  // 0 = not asked yet, 1 = solid, 2 = cave air. caveAt is pure in
  // (seed, wx, wy, wz), so shared chunk edges agree no matter who evaluates.
  const CW = CS + 2;
  const caveM = new Uint8Array(CW * CW * CH);
  const hM = new Int16Array(CW * CW).fill(-1);
  const hCol = (wx: number, wz: number): number => {
    const i = (wx - cx * CS + 1) * CW + (wz - cz * CS + 1);
    if (hM[i] < 0) hM[i] = Math.round(heightAt(seed, wx, wz));
    return hM[i];
  };
  const caveC = (wx: number, wy: number, wz: number): boolean => {
    const lx = wx - cx * CS + 1, lz = wz - cz * CS + 1;
    if (lx < 0 || lx >= CW || lz < 0 || lz >= CW) return caveAt(seed, wx, wy, wz);
    const idx = (lx * CW + lz) * CH + wy;
    if (!caveM[idx]) caveM[idx] = caveAt(seed, wx, wy, wz, hCol(wx, wz)) ? 2 : 1;
    return caveM[idx] === 2;
  };

  for (let x = 0; x < CS; x++) {
    for (let z = 0; z < CS; z++) {
      const wx = cx * CS + x, wz = cz * CS + z;
      const h = Math.round(heightAt(seed, wx, wz));
      for (let y = 0; y <= h; y++) c[(x * CS + z) * CH + y] = surfaceBlock(seed, wx, wz, y, h);
      const atCrash = wx * wx + wz * wz < 240; // keep the crash site clear of scenery
      const top = caveTop(h); // cave ceiling: >= 4 solid cells under the surface

      // ── the underground band: caves, ores crusting the walls, rare pools ──
      if (!atCrash) for (let y = 3; y <= top; y++) {
        const idx = (x * CS + z) * CH + y;
        if (caveC(wx, y, wz)) {
          // a Deep Water pocket: one rare blob of Source blocks per big cave —
          // the desert's buried drink, reachable by canister chains
          c[idx] = y >= 8 && y <= 18 && noise3(wx / 26, y / 19, wz / 26, seed + 401) > 0.785
            ? WATER : AIR;
          continue;
        }
        const base = c[idx];
        if (base !== ROCK && base !== SANDSTONE) continue;
        if (!(caveC(wx + 1, y, wz) || caveC(wx - 1, y, wz) || caveC(wx, y + 1, wz) ||
              caveC(wx, y - 1, wz) || caveC(wx, y, wz + 1) || caveC(wx, y, wz - 1))) continue;
        // wall crust: 3D-noise blobs clinging to the cave skin
        if (y <= 15 && hash2(wx * 5 + y, wz * 7 - y, seed + 333) < 0.4 &&
            noise3(wx / 5 + 40, y / 5, wz / 5, seed + 331) > 0.72) c[idx] = COBALT_ORE;
        else if (y >= 12 && noise3(wx / 5, y / 5, wz / 5, seed + 313) > 0.665) c[idx] = IRON_ORE;
        else if (y >= 12 && noise3(wx / 5, y / 5 + 60, wz / 5, seed + 317) > 0.7) c[idx] = COPPER_ORE;
        else if (y >= 8 && y <= 24 && noise3(wx / 5, y / 5, wz / 5 + 70, seed + 321) > 0.715) c[idx] = ALABASTER;
      }

      // occasional 1x1 entrance shaft: one column punched straight down from
      // the surface into the cave band, with a rock floor — never at the
      // crash, under a Town (its stair shaft owns those columns) or an oasis
      if (!atCrash && h >= 12 && hash2(wx, wz, seed + 201) > 0.984 &&
          st.townNear(wx, wz, 14) === null && st.nearOasis(wx, wz) === null) {
        const d = top - 4; // a little open headroom at the cave floor
        if (d >= 7) {
          for (let y = h - 1; y >= d; y--) c[(x * CS + z) * CH + y] = AIR;
          c[(x * CS + z) * CH + (d - 1)] = ROCK;
        }
      }

      // stone formations — biome-flavoured surface outcrops (boulder density)
      if (!atCrash && hash2(wx, wz, seed + 21) > 0.988) {
        const bi = biomeAt(wx, wz, seed);
        const inR = (xx: number, zz: number) => xx >= 0 && xx < CS && zz >= 0 && zz < CS;
        if (bi === B_MESA || bi === B_CANYON) {
          // monolith: a crooked column of dead rock, 3-5 tall
          const mh = 3 + (hash2(wx, wz, seed + 22) * 3 | 0);
          for (let dy = 1; dy <= mh; dy++) setW(wx, h + dy, wz, ROCK);
          if (x > 0 && hash2(wx, wz, seed + 27) > 0.5) setW(wx - 1, h + 1, wz, ROCK);
        } else if (bi === B_ROCKY) {
          // leaning slab: 2-3 blocks stacked over by one at the top
          const n = 2 + (hash2(wx, wz, seed + 24) * 2 | 0);
          const ld = [[1, 0], [-1, 0], [0, 1], [0, -1]][hash2(wx, wz, seed + 25) * 4 | 0];
          for (let i = 0; i < n; i++) {
            const o = i === n - 1 ? 1 : 0;
            if (inR(x + ld[0] * o, z + ld[1] * o)) setW(wx + ld[0] * o, h + 1 + i, wz + ld[1] * o, ROCK);
          }
        } else if (bi === B_SALT) {
          // salt raft: a flat plate of SALT standing proud of the crust
          for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
            if (inR(x + ox, z + oz)) setW(wx + ox, h + 1, wz + oz, SALT);
        } else {
          // rubble: a scatter of loose stones in the dunes
          const n = 2 + (hash2(wx, wz, seed + 26) * 3 | 0);
          for (let i = 0; i < n; i++) {
            const ox = (hash2(wx + i, wz, seed + 33) * 3 | 0) - 1, oz = (hash2(wx, wz + i, seed + 35) * 3 | 0) - 1;
            if (!inR(x + ox, z + oz)) continue;
            setW(wx + ox, h + 1, wz + oz, hash2(wx + i, wz - i, seed + 43) > 0.5 ? ROCK : SANDSTONE);
          }
        }
      }
      // dead trees
      if (!atCrash && hash2(wx, wz, seed + 23) > 0.9935) {
        const bi = biomeAt(wx, wz, seed);
        if (bi !== B_MESA && bi !== B_CANYON) {
          const th = 3 + (hash2(wx, wz, seed + 29) * 3 | 0);
          for (let y = h + 1; y <= h + th; y++) setW(wx, y, wz, DEADWOOD);
        }
      }
      // cacti: ribbed columns, sometimes with a short side arm
      if (!atCrash && c[(x * CS + z) * CH + h + 1] === 0 && hash2(wx, wz, seed + 31) > 0.9915) {
        const bi = biomeAt(wx, wz, seed);
        if (bi === B_DUNES || bi === B_ROCKY) {
          const ct = 2 + (hash2(wx, wz, seed + 37) * 3 | 0);
          for (let y = h + 1; y <= h + ct; y++) setW(wx, y, wz, CACTUS);
          if (ct >= 3 && hash2(wx, wz, seed + 41) > 0.55) setW(wx + (hash2(wx, wz, seed + 43) > 0.5 ? 1 : -1), h + 2, wz, CACTUS);
          // some tall columns already carry a Prickly Pear on top
          if (ct >= 3 && hash2(wx, wz, seed + 47) > 0.7) setW(wx, h + ct, wz, CACTUS_FRUIT);
        }
      }
    }
  }

  if (cx >= -1 && cx <= 0 && cz >= -1 && cz <= 0) paintShip(setW);
  for (const o of st.oases)
    if (Math.abs(cx * CS + 8 - o.x) < o.r + 24 && Math.abs(cz * CS + 8 - o.z) < o.r + 24) paintOasis(setW, o, seed);
  // Towns on an unbounded lattice: check which lattice cells touch this chunk.
  // Centers jitter up to ±55 from their lattice point (the home Town can sit a
  // whole half-cell away), so the scan window adds a cell of slack.
  const tx0 = Math.floor((cx * CS - 14 - TOWN_L) / TOWN_L), tx1 = Math.floor((cx * CS + CS + 14 + TOWN_L) / TOWN_L);
  const tz0 = Math.floor((cz * CS - 14 - TOWN_L) / TOWN_L), tz1 = Math.floor((cz * CS + CS + 14 + TOWN_L) / TOWN_L);
  for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) {
    if (!st.townAt(tx, tz)) continue;
    const t = st.townCenter(tx, tz);
    // paint into any chunk whose cells overlap the town footprint (huts span ±8, the plot reaches further)
    if (cx * CS <= t.x + 16 && cx * CS + CS - 1 >= t.x - 12 && cz * CS <= t.z + 12 && cz * CS + CS - 1 >= t.z - 16) paintTown(setW, t, seed);
    // the dungeon and its stair shaft reach ~30 cells from the town centre —
    // paintDungeon early-bails for the ~40% of towns without one
    if (cx * CS <= t.x + 30 && cx * CS + CS - 1 >= t.x - 30 && cz * CS <= t.z + 30 && cz * CS + CS - 1 >= t.z - 30) paintDungeon(setW, t, seed);
  }
  if (Math.abs(cx * CS + 8 - st.secondShip.x) < 12 && Math.abs(cz * CS + 8 - st.secondShip.z) < 12)
    paintSecondShip(setW, st.secondShip, seed);

  return c;
}
