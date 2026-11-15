import {
  AIR, SAND, SANDSTONE, ROCK, GRAVEL, SALT, DEADWOOD, HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL, BEACON,
  WATER, ADOBE, INSGLASS, BENCH, BENCH_EXT, ENGINECORE, CS, CH, REGULATOR, CACTUS,
} from "./blocks";
import { fbm2, ridge2, value2, hash2, Rng } from "./noise";

// Biomes
export const B_DUNES = 0, B_ROCKY = 1, B_SALT = 2, B_MESA = 3, B_CANYON = 4;
export const BIOME_NAMES = ["Dunes", "Rocky Desert", "Salt Flats", "Badlands", "Canyons"];

const SP = 1e6; // structure id salt

export interface Oasis { x: number; z: number; r: number; }
export interface Town { x: number; z: number; }
export interface CanisterSpawn { x: number; z: number; buried: boolean; }

export class Structures {
  oases: Oasis[] = [];
  towns: Town[] = [];
  secondShip = { x: 0, z: 0 };
  canisters: CanisterSpawn[] = [];

  constructor(public seed: number) {
    const r = new Rng(seed ^ 0x5f3a);
    for (let i = 0; i < 6; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(160, 900);
      this.oases.push({ x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), r: r.int(3, 5) });
    }
    for (let i = 0; i < 4; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(300, 1000);
      this.towns.push({ x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d) });
    }
    {
      const a = r.range(0, Math.PI * 2), d = r.range(450, 700);
      this.secondShip = { x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d) };
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
 *  All bulkhead doors start closed. */
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
        set(x, y, z, interior ? AIR : y === Y0 ? METAL : HULL);
      }
  // rounded spine along the roof
  for (let x = -3; x <= 1; x++) for (let z = -2; z <= 2; z++) set(x, 35, z, HULL);
  for (let x = -2; x <= 0; x++) for (let z = -1; z <= 1; z++) set(x, 36, z, HULL);
  // wings: thin metal planes out from the flanks, tapering at the tips
  for (let x = -2; x <= 1; x++) for (const z of [6, 7, 8, 9, -6, -7, -8, -9]) set(x, 32, z, METAL);
  for (const x of [-3, 2]) for (const z of [6, 7, 8, -6, -7, -8]) set(x, 32, z, METAL);
  for (const x of [-1, 0]) { set(x, 31, 10, METAL); set(x, 31, -10, METAL); }

  const door = (x: number, y: number, z: number) => { set(x, y, z, DOOR_CLOSED); set(x, y + 1, z, DOOR_UPPER); };
  // bulkhead between hall and cockpit, and between hall and the aft row
  for (let z = -4; z <= 4; z++) for (let y = 31; y <= 33; y++) { set(1, y, z, HULL); set(-2, y, z, HULL); }
  for (let x = -5; x <= -3; x++) for (const z of [-2, 2]) for (let y = 31; y <= 33; y++) set(x, y, z, HULL);
  door(1, 31, 0);          // hall -> cockpit
  door(-2, 31, 0);         // hall -> save room
  door(-2, 31, 3);         // hall -> water compartment
  door(-2, 31, -3);        // hall -> regulator room
  door(-6, 31, 0);         // stern: the only door to the outside

  // cockpit windscreen: insulating glass, rare but heat-safe
  for (let z = -2; z <= 2; z++) for (let y = 32; y <= 33; y++) set(4, y, z, INSGLASS);

  // water compartment: the ship's tank is a pool sunk into the ground —
  // look at the water in the hole and press E to refill canisters
  set(-4, 30, 4, WATER); set(-4, 29, 4, WATER);
  set(-3, 30, 4, WATER);
  // heat regulator, pre-installed in its (small, sealed) room
  set(-4, 31, -4, REGULATOR);
  // save room beacon
  set(-4, 31, -1, BEACON);
  // crafting bench in the hall — the bench is a two-block structure
  set(0, 31, -3, BENCH); set(0, 31, -2, BENCH_EXT);
  // ceiling lamps, one per room
  for (const [lx, lz] of [[3, 0], [0, 0], [-4, 3], [-4, -3], [-5, 0]] as const) set(lx, Y1, lz, LAMP);
  // scattered metal salvage — kept clear of every doorway approach
  for (const [sx, sz] of [[0, 3], [0, 4], [-1, 4], [2, 2]] as const) set(sx, 31, sz, METAL);
}

function paintSecondShip(set: (x: number, y: number, z: number, id: number) => void, t: { x: number; z: number }, seed: number) {
  const r = new Rng(SP + 77);
  for (let i = 0; i < 40; i++) {
    const x = t.x + r.int(-5, 5), z = t.z + r.int(-5, 5);
    const y = Math.round(heightAt(seed, x, z));
    set(x, y + r.int(0, 1), z, r.next() < 0.5 ? HULL : METAL);
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
    set(t.x + bx + 1, h + 2, t.z + bz + 2, METAL);
  }
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
        }
      }
    }
  }

  if (cx >= -1 && cx <= 0 && cz >= -1 && cz <= 0) paintShip(setW);
  for (const o of st.oases)
    if (Math.abs(cx * CS + 8 - o.x) < o.r + 8 && Math.abs(cz * CS + 8 - o.z) < o.r + 8) paintOasis(setW, o, seed);
  for (const t of st.towns)
    if (Math.abs(cx * CS + 8 - t.x) < 12 && Math.abs(cz * CS + 8 - t.z) < 12) paintTown(setW, t, seed);
  if (Math.abs(cx * CS + 8 - st.secondShip.x) < 12 && Math.abs(cz * CS + 8 - st.secondShip.z) < 12)
    paintSecondShip(setW, st.secondShip, seed);

  return c;
}
