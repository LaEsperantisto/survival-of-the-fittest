import {
  AIR, SAND, SANDSTONE, ROCK, GRAVEL, SALT, DEADWOOD, HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL_PLATING, BEACON,
  WATER, ADOBE, INSGLASS, BENCH, BENCH_EXT, ENGINECORE, CS, CH, REGULATOR, CACTUS, CACTUS_FRUIT,
  DOOR_INNER, DOOR_INNER_UPPER, CHEST, BED, BED_EXT, MELON_2, WHEAT_2, FARMLAND,
} from "./blocks";
import { fbm2, ridge2, value2, hash2, Rng } from "./noise";

// Biomes
export const B_DUNES = 0, B_ROCKY = 1, B_SALT = 2, B_MESA = 3, B_CANYON = 4;
export const BIOME_NAMES = ["Dunes", "Rocky Desert", "Salt Flats", "Badlands", "Canyons"];

const SP = 1e6; // structure id salt

export interface Oasis { x: number; z: number; r: number; }
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
    if (Math.abs(tx) < 2 && Math.abs(tz) < 2) return false;
    if (tx === this.gtx && tz === this.gtz) return true;
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
  for (let x = -6; x <= 4; x++)
    for (let z = -5; z <= 5; z++)
      for (let y = Y0; y <= Y1; y++) {
        if (!outline(x, z) || clipped(x, y, z)) continue;
        // the cockpit tapers narrower than the rest of the hull
        const narrow = x >= 2 && Math.abs(z) > 2;
        const interior = x >= -5 && x <= 3 && z >= -4 && z <= 4 && y >= 31 && y <= 33 && !narrow;
        set(x, y, z, interior ? AIR : y === Y0 ? METAL_PLATING : HULL);
      }
  // rounded spine along the roof
  for (let x = -3; x <= 1; x++) for (let z = -2; z <= 2; z++) set(x, 35, z, HULL);
  for (let x = -2; x <= 0; x++) for (let z = -1; z <= 1; z++) set(x, 36, z, HULL);
  // wings: thin plated planes out from the flanks, tapering at the tips
  for (let x = -2; x <= 1; x++) for (const z of [6, 7, 8, 9, -6, -7, -8, -9]) set(x, 32, z, METAL_PLATING);
  for (const x of [-3, 2]) for (const z of [6, 7, 8, -6, -7, -8]) set(x, 32, z, METAL_PLATING);
  for (const x of [-1, 0]) { set(x, 31, 10, METAL_PLATING); set(x, 31, -10, METAL_PLATING); }

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
  // heat regulators, pre-installed: the small regulator room and the main hall
  // (54 cells) — the wreck's heart stays body-neutral while you fly out
  set(-4, 31, -4, REGULATOR);
  set(-1, 33, 0, REGULATOR);
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
  for (let i = 0; i < 40; i++) {
    const x = t.x + r.int(-5, 5), z = t.z + r.int(-5, 5);
    const y = Math.round(heightAt(seed, x, z));
    set(x, y + r.int(0, 1), z, r.next() < 0.5 ? HULL : METAL_PLATING);
  }
  // the Engine Core sits at the exact center of the debris field, on the ground
  set(t.x, Math.round(heightAt(seed, t.x, t.z)) + 1, t.z, ENGINECORE);
}

function paintOasis(set: (x: number, y: number, z: number, id: number) => void, o: Oasis, seed: number) {
  const hb = Math.round(heightAt(seed, o.x, o.z));
  for (let dx = -o.r - 1; dx <= o.r + 1; dx++) {
    for (let dz = -o.r - 1; dz <= o.r + 1; dz++) {
      const x = o.x + dx, z = o.z + dz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const h = Math.round(heightAt(seed, x, z));
      if (d <= o.r) {
        for (let y = h; y > hb - 2; y--) set(x, y, z, AIR);
        set(x, hb - 2, z, SAND);
        for (let y = hb - 1; y <= hb; y++) set(x, y, z, WATER);
      } else if (d <= o.r + 1) {
        for (let y = h; y < hb + 1; y++) set(x, y, z, SAND);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const tx = o.x + Math.round(Math.cos(i * 2.1) * (o.r + 2));
    const tz = o.z + Math.round(Math.sin(i * 2.1) * (o.r + 2));
    const h = Math.round(heightAt(seed, tx, tz));
    for (let y = h + 1; y <= h + 4; y++) set(tx, y, tz, DEADWOOD);
  }
  // ripe Dune Melons ripen on the sand at the water's edge — the desert's free drink
  for (let i = 0; i < 5; i++) {
    if (hash2(o.x, o.z, seed + 61 + i) < 0.35) continue;
    const a = i * 1.27 + hash2(o.z, o.x, seed + 67 + i) * 0.8;
    const rr = o.r - 0.4;
    const tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    if (Math.hypot(tx - o.x, tz - o.z) < o.r) continue; // never in the pool
    set(tx, hb + 1, tz, MELON_2);
  }
}

function paintTown(set: (x: number, y: number, z: number, id: number) => void, t: Town, seed: number) {
  for (const [bx, bz] of [[-4, -3], [2, 2], [-2, 4]] as const) {
    const h = Math.round(heightAt(seed, t.x + bx, t.z + bz));
    for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
      for (let y = h + 1; y <= h + 3; y++) {
        const shell = x === 0 || x === 3 || z === 0 || z === 3 || y === h + 1 || y === h + 3;
        if (!shell) { set(t.x + bx + x, y, t.z + bz + z, AIR); continue; }
        if (!(x === 0 && z === 1 && y <= h + 2)) set(t.x + bx + x, y, t.z + bz + z, ADOBE);
      }
    }
    // every hut left behind a Supply Chest and a Bed; the good loot is decided
    // when the chest is first opened (seeded, game.ts)
    set(t.x + bx + 1, h + 2, t.z + bz + 1, CHEST);
    set(t.x + bx + 1, h + 2, t.z + bz + 2, BED);
    set(t.x + bx + 2, h + 2, t.z + bz + 2, BED_EXT);
  }
  // someone's farm, gone to seed: a plot of Farmland with a few survivors standing
  const fh = Math.round(heightAt(seed, t.x, t.z + 9));
  for (let x = 0; x < 5; x++) for (let z = 0; z < 3; z++) set(t.x - 6 + x, fh, t.z + 8 + z, FARMLAND);
  set(t.x - 5, fh + 1, t.z + 9, WHEAT_2);
  set(t.x - 3, fh + 1, t.z + 8, WHEAT_2);
  set(t.x - 2, fh + 1, t.z + 10, MELON_2);
}

export function genChunk(seed: number, st: Structures, cx: number, cz: number): Uint8Array {
  const c = new Uint8Array(CS * CS * CH);
  const setW = (wx: number, wy: number, wz: number, id: number) => {
    const x = wx - cx * CS, z = wz - cz * CS;
    if (x >= 0 && x < CS && z >= 0 && z < CS && wy >= 0 && wy < CH) c[(x * CS + z) * CH + wy] = id;
  };

  for (let x = 0; x < CS; x++) {
    for (let z = 0; z < CS; z++) {
      const wx = cx * CS + x, wz = cz * CS + z;
      const h = Math.round(heightAt(seed, wx, wz));
      for (let y = 0; y <= h; y++) c[(x * CS + z) * CH + y] = surfaceBlock(seed, wx, wz, y, h);
      const atCrash = wx * wx + wz * wz < 240; // keep the crash site clear of scenery
      // boulders
      if (!atCrash && hash2(wx, wz, seed + 21) > 0.988) {
        const bi = biomeAt(wx, wz, seed);
        if (bi === B_DUNES || bi === B_ROCKY) {
          for (let dy = 1; dy <= 2; dy++) setW(wx, h + dy, wz, ROCK);
          if (x > 0) setW(wx - 1, h + 1, wz, ROCK);
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
    if (Math.abs(cx * CS + 8 - o.x) < o.r + 8 && Math.abs(cz * CS + 8 - o.z) < o.r + 8) paintOasis(setW, o, seed);
  // Towns on an unbounded lattice: check which lattice cells touch this chunk.
  // Centers jitter up to ±55 from their lattice point (the home Town can sit a
  // whole half-cell away), so the scan window adds a cell of slack.
  const tx0 = Math.floor((cx * CS - 14 - TOWN_L) / TOWN_L), tx1 = Math.floor((cx * CS + CS + 14 + TOWN_L) / TOWN_L);
  const tz0 = Math.floor((cz * CS - 14 - TOWN_L) / TOWN_L), tz1 = Math.floor((cz * CS + CS + 14 + TOWN_L) / TOWN_L);
  for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) {
    if (!st.townAt(tx, tz)) continue;
    const t = st.townCenter(tx, tz);
    // paint into any chunk whose cells overlap the town footprint (huts span ±8, the plot reaches further)
    if (cx * CS <= t.x + 12 && cx * CS + CS - 1 >= t.x - 12 && cz * CS <= t.z + 12 && cz * CS + CS - 1 >= t.z - 10) paintTown(setW, t, seed);
  }
  if (Math.abs(cx * CS + 8 - st.secondShip.x) < 12 && Math.abs(cz * CS + 8 - st.secondShip.z) < 12)
    paintSecondShip(setW, st.secondShip, seed);

  return c;
}
