import {
  AIR, SAND, SANDSTONE, ROCK, GRAVEL, SALT, DEADWOOD, DIRT, HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL_PLATING, BEACON, CAMPFIRE, GLASS,
  WATER, ADOBE, INSGLASS, ENGINECORE, CS, CH, REGULATOR, REGULATOR_HUSK, CACTUS, CACTUS_FRUIT,
  DOOR_INNER, DOOR_INNER_UPPER, CHEST, BED, BED_EXT, MELON_1, MELON_2, WHEAT_1, WHEAT_2, FARMLAND, GRASS, WOOD, LEAVES, SUGARCANE_1, SUGARCANE_2,
  APPLE_FRUIT,
  STORM_BREAKER, STORM_BREAKER_HUSK,
  POWER_PANEL, POWER_POLE, SOLAR_PANEL, BATTERY, ELEC_LAMP,
  CURVED_HULL, HULL_SLOPE, IRON_ORE, COPPER_ORE, ALABASTER, COBALT_ORE, COAL_ORE, THRUSTER, ANTHRACITE_ORE,
  OIL, OIL_SANDS, FRAME_CORNER, THRUSTER_LIT, FLIGHT_CONTROLS,
} from "./blocks";
import { fbm2, ridge2, value2, hash2, Rng } from "./noise";

// Biomes
export const B_DUNES = 0, B_ROCKY = 1, B_SALT = 2, B_MESA = 3, B_CANYON = 4;
export const BIOME_NAMES = ["Dunes", "Rocky Desert", "Salt Flats", "Badlands", "Canyons"];

const SP = 1e6; // structure id salt

/** The Engine Core a Phase 2 wreck ships with: hall cell, where Game seeds
 *  its fuel ports and Game's fresh-world check reads the same cell. */
export const PHASE2_CORE: [number, number, number] = [0, 31, -2];

export interface Oasis { x: number; z: number; r: number; key: string; }
/** An Oil Seep: the same bowl an oasis cuts, running black instead of blue. */
export interface Seep { x: number; z: number; r: number; key: string; }
/** One block of a staged Living Tree: b is the block id, stage 1 trunk base,
 *  2 full trunk + branches, 3 leaf canopy. Stamped in stage order. */
export interface TreePart { x: number; y: number; z: number; b: number; stage: number }
export interface Town { x: number; z: number; }
/** A Nomad camp on the CAMP_L lattice: 0 windmill, 1 hut, 2 farmstead. */
export interface Camp { x: number; z: number; type: 0 | 1 | 2; }

/** Towns sit on this lattice: one sparse, jittered settlement per cell, forever —
 *  the desert never runs out of towns. */
export const TOWN_L = 320;

/** Nomad camps sit on their own sparse lattice - a flattened site with a
 *  windmill, hut or farmstead and a market stall, never near the crash. */
export const CAMP_L = 380;

/** Grid Relics sit on the sparsest lattice of all: a derelict adobe outstation
 *  of the Dwellers' power age — Panel, Battery, Solar Panel, a line of Poles
 *  running to a mast lamp, and a Chest of old-world parts. Centers
 *  jitter up to ±24 from the cell. */
export const OUTPOST_L = 520;

/** Cave mouths sit on this lattice: an arched tunnel dug into a hillside that
 *  descends into the cave band and opens on a small rock chamber. */
export const CAVE_MOUTH_L = 150;

/** Oases sit on this lattice: a jittered pool per cell, forever — the desert
 *  horizon never runs out of water. Centers jitter up to ±80 from the cell. */
export const OASIS_L = 240;

/** Oil Seeps sit on their own lattice: a jittered tar pool per cell, forever —
 *  the Refinery's supply never runs out. Centers jitter up to ±40 from the cell. */
export const SEEP_L = 170;

/** Giant oil-sand fields sit on a far sparser lattice than seeps: a broad,
 *  irregular flat of oil-stained sand some 30 across with a few Oil sources
 *  sweating through it — the desert's bulk fuel deposit. Centers jitter up to
 *  ±180 from the cell. */
export const FIELD_L = 600;

/** Buried canisters sit on this lattice — landmarks, not containers: the
 *  Map only shows a dig site once its canister has actually been dug.
 *  Sites jitter up to ±55 from their cell. */
export const CANISTER_L = 150;

export class Structures {
  secondShip = { x: 0, z: 0 };
  /** The far end of the gouge field: the trench the Second Wreck was dragged
   *  in along, ending ~200 m out on the same bearing it came from. */
  gougeFar = { x: 0, z: 0 };
  /** A guaranteed Town at a second-wreck's distance, so the goal chain can't dead-end. */
  homeTown: Town = { x: 0, z: 0 };

  constructor(public seed: number) {
    const r = new Rng(seed ^ 0x5f3a);
    const a = r.range(0, Math.PI * 2), d = r.range(450, 700);
    this.secondShip = { x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d) };
    const ta = Math.atan2(this.secondShip.z, this.secondShip.x) + 0.9;
    const td = Math.hypot(this.secondShip.x, this.secondShip.z) * r.range(0.8, 1.15);
    this.homeTown = { x: Math.round(Math.cos(ta) * td), z: Math.round(Math.sin(ta) * td) };
    const d2 = r.range(180, 260);
    this.gougeFar = { x: Math.round(Math.cos(a) * (d + d2)), z: Math.round(Math.sin(a) * (d + d2)) };
  }

  /** Is there an oasis on lattice cell (ix,iz)? Never atop the crash, never
   *  on the home Town's plot. */
  oasisAt(ix: number, iz: number): boolean {
    if (hash2(ix, iz, this.seed + 71) >= 0.62) return false;
    const c = this.oasisCenter(ix, iz);
    if (c.x * c.x + c.z * c.z < 12100) return false; // 110 m clear of the wreck
    if (Math.hypot(c.x - this.homeTown.x, c.z - this.homeTown.z) < 30) return false;
    return true;
  }

  /** Jittered centre of the oasis on lattice cell (ix,iz). */
  oasisCenter(ix: number, iz: number): { x: number; z: number } {
    const jx = (hash2(ix, iz, this.seed + 73) - 0.5) * 160;
    const jz = (hash2(ix, iz, this.seed + 75) - 0.5) * 160;
    return { x: Math.round(ix * OASIS_L + jx), z: Math.round(iz * OASIS_L + jz) };
  }

  /** The full oasis for a lattice cell, or null. */
  oasisOf(ix: number, iz: number): Oasis | null {
    if (!this.oasisAt(ix, iz)) return null;
    const c = this.oasisCenter(ix, iz);
    return { x: c.x, z: c.z, r: 3 + (hash2(ix, iz, this.seed + 77) * 3 | 0), key: `${ix},${iz}` };
  }

  /** The oasis whose pool covers (x,z). */
  nearOasis(x: number, z: number): Oasis | null {
    return oasisNearSeed(this.seed, x, z, 1);
  }

  /** The oasis nearest (x,z) within a few lattice cells — for waypoints. */
  nearestOasis(x: number, z: number, span = 4): Oasis | null {
    const cx = Math.floor(x / OASIS_L), cz = Math.floor(z / OASIS_L);
    let best: Oasis | null = null, bd = Infinity;
    for (let ix = cx - span; ix <= cx + span; ix++) for (let iz = cz - span; iz <= cz + span; iz++) {
      const o = this.oasisOf(ix, iz);
      if (!o) continue;
      const dd = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  /** Is there an Oil Seep on lattice cell (ix,iz)? Tar only breaks the crust on
   *  loose ground, never atop the crash, and never crowding an oasis, a Town, a
   *  camp, a Grid Relic, a cave mouth, a tar flat or the second wreck — the same
   *  exclusions that keep oases and Towns apart. A pool needs solid ground all
   *  round it, or the flow sim would carry the tar away. */
  seepAt(ix: number, iz: number): boolean {
    if (hash2(ix, iz, this.seed + 151) >= 0.5) return false;
    const c = this.seepCenter(ix, iz);
    if (c.x * c.x + c.z * c.z < 12100) return false; // 110 m clear of the wreck
    if (biomeAt(c.x, c.z, this.seed) === B_CANYON) return false; // a canyon floor carves the pool away
    if (Math.hypot(c.x - this.homeTown.x, c.z - this.homeTown.z) < 30) return false;
    if (oasisNearSeed(this.seed, c.x, c.z, 22) !== null) return false; // a pool never cuts an oasis grove
    if (fieldNearSeed(this.seed, c.x, c.z, 10) !== null) return false;
    if (this.mouthNear(c.x, c.z, 18) !== null) return false;
    if (this.townNear(c.x, c.z, 22) !== null) return false;
    if (this.campNear(c.x, c.z, 22) !== null) return false;
    if (this.outpostNear(c.x, c.z, 22) !== null) return false;
    if (Math.hypot(this.secondShip.x - c.x, this.secondShip.z - c.z) < 40) return false;
    return true;
  }

  /** Jittered centre of the seep on lattice cell (ix,iz). */
  seepCenter(ix: number, iz: number): { x: number; z: number } {
    const jx = (hash2(ix, iz, this.seed + 153) - 0.5) * 80;
    const jz = (hash2(ix, iz, this.seed + 155) - 0.5) * 80;
    return { x: Math.round(ix * SEEP_L + jx), z: Math.round(iz * SEEP_L + jz) };
  }

  /** The full seep for a lattice cell, or null. */
  seepOf(ix: number, iz: number): Seep | null {
    if (!this.seepAt(ix, iz)) return null;
    const c = this.seepCenter(ix, iz);
    return { x: c.x, z: c.z, r: 3 + (hash2(ix, iz, this.seed + 157) * 3 | 0), key: `${ix},${iz}` };
  }

  /** The seep whose pool, inflated by `rad`, covers (x,z). */
  seepNear(x: number, z: number, rad = 1): Seep | null {
    return seepNearSeed(this.seed, x, z, rad);
  }

  /** The seep nearest (x,z) within a few lattice cells — for waypoints and the
   *  Hidden Landmark Tracker. */
  nearestSeep(x: number, z: number, span = 4): Seep | null {
    const cx = Math.floor(x / SEEP_L), cz = Math.floor(z / SEEP_L);
    let best: Seep | null = null, bd = Infinity;
    for (let ix = cx - span; ix <= cx + span; ix++) for (let iz = cz - span; iz <= cz + span; iz++) {
      const o = this.seepOf(ix, iz);
      if (!o) continue;
      const dd = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  /** Is there a giant oil-sand field on lattice cell (tx,tz)? The big tar flats
   *  lie on open sand seas — dunes, rocky desert, salt flats — and stand well
   *  clear of the crash, oases, Towns, camps, relics and the second wreck. */
  fieldAt(tx: number, tz: number): boolean {
    if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // keeps fields far clear of the crash
    if (hash2(tx, tz, this.seed + 471) >= 0.4) return false;
    const c = this.fieldCenter(tx, tz);
    const bi = biomeAt(c.x, c.z, this.seed);
    if (bi !== B_DUNES && bi !== B_ROCKY && bi !== B_SALT) return false;
    if (c.x * c.x + c.z * c.z < 67600) return false; // 260 m clear of the wreck
    if (oasisNearSeed(this.seed, c.x, c.z, 48) !== null) return false; // a flat never clips an oasis grove
    if (this.mouthNear(c.x, c.z, 44) !== null) return false; // never tunnelled under by a cave mouth
    if (this.townNear(c.x, c.z, 45) !== null) return false;
    if (this.campNear(c.x, c.z, 40) !== null) return false;
    if (this.outpostNear(c.x, c.z, 40) !== null) return false;
    if (Math.hypot(this.secondShip.x - c.x, this.secondShip.z - c.z) < 70) return false;
    return true;
  }

  /** Jittered centre of the oil-sand field on lattice cell (tx,tz). */
  fieldCenter(tx: number, tz: number): { x: number; z: number } {
    const jx = (hash2(tx, tz, this.seed + 473) - 0.5) * 360;
    const jz = (hash2(tx, tz, this.seed + 475) - 0.5) * 360;
    return { x: Math.round(tx * FIELD_L + jx), z: Math.round(tz * FIELD_L + jz) };
  }

  /** Is there a buried canister site on lattice cell (ix,iz)? Never atop the crash. */
  canisterAt(ix: number, iz: number): boolean {
    if (hash2(ix, iz, this.seed + 81) >= 0.7) return false;
    const c = this.canisterSite(ix, iz);
    return c.x * c.x + c.z * c.z >= 12100;
  }

  /** Jittered centre of the canister site on lattice cell (ix,iz). */
  canisterSite(ix: number, iz: number): { x: number; z: number } {
    const jx = (hash2(ix, iz, this.seed + 83) - 0.5) * 110;
    const jz = (hash2(ix, iz, this.seed + 85) - 0.5) * 110;
    return { x: Math.round(ix * CANISTER_L + jx), z: Math.round(iz * CANISTER_L + jz) };
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
    if (oasisNearSeed(this.seed, c.x, c.z, 14)) return false;
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

  /** Is there a cave mouth on lattice cell (tx,tz)? Bare desert only: never
   *  near an oasis or a town. */
  mouthAt(tx: number, tz: number): boolean {
    if (!mouthAtSeed(this.seed, tx, tz)) return false;
    const c = this.mouthCenter(tx, tz);
    if (this.nearOasis(c.x, c.z)) return false;
    if (this.townNear(c.x, c.z, 20)) return false;
    return true;
  }

  /** Jittered centre of the cave mouth on lattice cell (tx,tz). */
  mouthCenter(tx: number, tz: number): { x: number; z: number } {
    return mouthCenterSeed(this.seed, tx, tz);
  }

  /** The nearest cave mouth within `rad` of (x,z), or null. */
  mouthNear(x: number, z: number, rad: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bd = rad;
    const t0 = Math.floor((x - rad) / CAVE_MOUTH_L), t1 = Math.floor((x + rad) / CAVE_MOUTH_L);
    const s0 = Math.floor((z - rad) / CAVE_MOUTH_L), s1 = Math.floor((z + rad) / CAVE_MOUTH_L);
    for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
      if (!this.mouthAt(tx, tz)) continue;
      const c = this.mouthCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d <= bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Is there a trader camp on lattice cell (tx,tz)? Pure in the seed — the
   *  oasis/wreck/town exclusions run through the seed's canonical Structures,
   *  so every caller (heightAt included) sees the same site list. */
  campAt(tx: number, tz: number): boolean { return campAtSeed(this.seed, tx, tz); }

  /** Jittered centre of the camp on lattice cell (tx,tz). */
  campCenter(tx: number, tz: number): { x: number; z: number } { return campCenterSeed(this.seed, tx, tz); }

  /** What stands on the camp at (tx,tz): 0 windmill, 1 hut, 2 farmstead. */
  campType(tx: number, tz: number): 0 | 1 | 2 { return campTypeSeed(this.seed, tx, tz); }

  /** The nearest camp within `rad` of (x,z), or null. */
  campNear(x: number, z: number, rad: number): Camp | null {
    let best: Camp | null = null, bd = rad;
    // ±1 cell beyond the radius box: a jittered centre can lean out of its
    // own lattice cell, and a caller standing at the centre must still find it
    const t0 = Math.floor((x - rad) / CAMP_L) - 1, t1 = Math.floor((x + rad) / CAMP_L) + 1;
    const s0 = Math.floor((z - rad) / CAMP_L) - 1, s1 = Math.floor((z + rad) / CAMP_L) + 1;
    for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
      if (!this.campAt(tx, tz)) continue;
      const c = this.campCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d <= bd) { bd = d; best = { x: c.x, z: c.z, type: this.campType(tx, tz) }; }
    }
    return best;
  }

  /** Nearest camp in the lattice neighbourhood of (x,z), or null if there is
   *  none close by (unlike nearestTown there is no guaranteed camp). */
  nearestCamp(x: number, z: number): Camp | null {
    let best: Camp | null = null, bd = Infinity;
    const cx = Math.floor(x / CAMP_L), cz = Math.floor(z / CAMP_L);
    for (let tx = cx - 3; tx <= cx + 3; tx++) for (let tz = cz - 3; tz <= cz + 3; tz++) {
      if (!this.campAt(tx, tz)) continue;
      const c = this.campCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = { x: c.x, z: c.z, type: this.campType(tx, tz) }; }
    }
    return best;
  }

  /** The Grid Relic on lattice cell (tx,tz), and its jittered centre. */
  outpostAt(tx: number, tz: number): boolean { return outpostAtSeed(this.seed, tx, tz); }
  outpostCenter(tx: number, tz: number): { x: number; z: number } { return outpostCenterSeed(this.seed, tx, tz); }

  /** The nearest Grid Relic within `rad` of (x,z), or null. */
  outpostNear(x: number, z: number, rad: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bd = rad;
    const t0 = Math.floor((x - rad) / OUTPOST_L), t1 = Math.floor((x + rad) / OUTPOST_L);
    const s0 = Math.floor((z - rad) / OUTPOST_L), s1 = Math.floor((z + rad) / OUTPOST_L);
    for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
      if (!this.outpostAt(tx, tz)) continue;
      const c = this.outpostCenter(tx, tz), d = Math.hypot(c.x - x, c.z - z);
      if (d <= bd) { bd = d; best = c; }
    }
    return best;
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
    30 + fbm2(x / 140, z / 140, seed + 7) * 12 + fbm2(x / 45, z / 45, seed + 8) * 3 + Math.sin(x / 9 + z / 13) * 0.9, // dunes
    29 + fbm2(x / 160, z / 160, seed + 9) * 12 + Math.max(0, value2(x / 55, z / 55, seed + 11) - 0.5) * 18,          // rocky buttes: broad low domes
    28 + fbm2(x / 220, z / 220, seed + 5) * 3,                                                                       // salt flats (calm)
    33 + Math.floor(fbm2(x / 170, z / 170, seed + 13) * 7.99) * 6,                                                   // badlands mesas
    27 - ridge2(x / 210, z / 210, seed + 17) * 13 - Math.max(0, fbm2(x / 500, z / 500, seed + 19) - 0.55) * 10,      // deep canyons
  ];
  let h = 0;
  for (let i = 0; i < 5; i++) h += w[i] * hs[i];
  return h;
}

/**
 * Flat crash-site plateau under the wreck, feathered out to natural terrain
 * by r=30 (EXACT: r<=14 is always 30 — the ship is painted at absolute y).
 * Camp sites also level the sand: inside Chebyshev 9 of a camp centre the
 * ground sits at the site's base level, feathering out to natural by 12.
 */
export function heightAt(seed: number, x: number, z: number): number {
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r <= 14) return 30;
  let h = heightRaw(seed, x, z);
  if (r < 30) {
    const t = (r - 14) / 16, s = t * t * (3 - 2 * t);
    return 30 + (h - 30) * s; // no camp can be this close to the crash: plateau wins
  }
  const site = campSiteAt(seed, x, z) ?? outpostSiteAt(seed, x, z);
  if (site) {
    const base = Math.round(heightRaw(seed, site.cx, site.cz));
    const s = Math.min(1, (12 - site.d) / 3), sm = s * s * (3 - 2 * s);
    h += (base - h) * sm;
  }
  return h;
}

/** The camp site holding (x,z) — Chebyshev <=12 from a camp centre — with the
 *  distance, or null. Jitter is at most 30 << CAMP_L, so scanning the 3x3
 *  lattice ring around the column's own cell is exact. Pure in the seed. */
function campSiteAt(seed: number, x: number, z: number): { cx: number; cz: number; d: number } | null {
  const tx = Math.floor(x / CAMP_L), tz = Math.floor(z / CAMP_L);
  let best: { cx: number; cz: number; d: number } | null = null;
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (Math.abs(x - ax * CAMP_L) > 42 || Math.abs(z - az * CAMP_L) > 42) continue; // centre can't reach
    if (!campAtSeed(seed, ax, az)) continue;
    const c = campCenterSeed(seed, ax, az);
    const d = Math.max(Math.abs(c.x - x), Math.abs(c.z - z));
    if (d <= 12 && (best === null || d < best.d)) best = { cx: c.x, cz: c.z, d };
  }
  return best;
}

/** The flattened base level of the camp site under (x,z) — Chebyshev <=11 of
 *  a camp centre — or null when (x,z) stands on ordinary ground. */
export function campFloorAt(seed: number, x: number, z: number): number | null {
  const s = campSiteAt(seed, x, z);
  if (!s || s.d > 11) return null;
  return Math.round(heightRaw(seed, s.cx, s.cz));
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

const structuresCache = new Map<number, Structures>();
/** The canonical Structures for a seed: oases, the second wreck and Towns are
 *  all pure functions of it, so lattice guards inside module fns agree with
 *  whatever live Structures the caller holds. */
export const structuresOf = (seed: number): Structures => {
  let s = structuresCache.get(seed);
  if (!s) { s = new Structures(seed); structuresCache.set(seed, s); }
  return s;
};

/** The oasis whose pool, inflated by `rad`, reaches (x,z) — scanning only the
 *  lattice cells that could. Centers jitter ±80, radii reach 5, so 86 covers
 *  the worst offset. Pure in the seed: heightAt guards and callers agree. */
function oasisNearSeed(seed: number, x: number, z: number, rad: number): Oasis | null {
  const st = structuresOf(seed);
  const m = 86 + rad;
  const i0 = Math.floor((x - m) / OASIS_L), i1 = Math.floor((x + m) / OASIS_L);
  const j0 = Math.floor((z - m) / OASIS_L), j1 = Math.floor((z + m) / OASIS_L);
  let best: Oasis | null = null, bd = Infinity;
  for (let ix = i0; ix <= i1; ix++) for (let iz = j0; iz <= j1; iz++) {
    const o = st.oasisOf(ix, iz);
    if (!o) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d <= o.r + rad && d < bd) { bd = d; best = o; }
  }
  return best;
}

/** Is a giant oil-sand Field's tar flat within `rad` of (x,z)? Centres jitter
 *  ±180 and a flat reaches ~30 out, so 210 covers the worst offset. */
function fieldNearSeed(seed: number, x: number, z: number, rad: number): { x: number; z: number } | null {
  const st = structuresOf(seed);
  const m = 210 + rad;
  const i0 = Math.floor((x - m) / FIELD_L), i1 = Math.floor((x + m) / FIELD_L);
  const j0 = Math.floor((z - m) / FIELD_L), j1 = Math.floor((z + m) / FIELD_L);
  for (let ix = i0; ix <= i1; ix++) for (let iz = j0; iz <= j1; iz++) {
    if (!st.fieldAt(ix, iz)) continue;
    const c = st.fieldCenter(ix, iz);
    if (Math.hypot(c.x - x, c.z - z) <= 30 + rad) return c;
  }
  return null;
}

/** The seep whose pool, inflated by `rad`, reaches (x,z) — same shape as
 *  oasisNearSeed. Centers jitter ±40, radii reach 5, so 46 covers the worst
 *  offset. Pure in the seed so cave guards and callers always agree. */
function seepNearSeed(seed: number, x: number, z: number, rad: number): Seep | null {
  const st = structuresOf(seed);
  const m = 46 + rad;
  const i0 = Math.floor((x - m) / SEEP_L), i1 = Math.floor((x + m) / SEEP_L);
  const j0 = Math.floor((z - m) / SEEP_L), j1 = Math.floor((z + m) / SEEP_L);
  let best: Seep | null = null, bd = Infinity;
  for (let ix = i0; ix <= i1; ix++) for (let iz = j0; iz <= j1; iz++) {
    const o = st.seepOf(ix, iz);
    if (!o) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d <= o.r + rad && d < bd) { bd = d; best = o; }
  }
  return best;
}

/** Breach patches: inside these the cave band climbs all the way to the
 *  surface and carves a real cave mouth instead of a sealed band. Constant y
 *  in the lattice keeps this a pure 2D field. */
const caveBreach = (seed: number, x: number, z: number): boolean =>
  noise3(x / 9, 0.37, z / 9, seed + 309) > 0.75;

/** The cave band's top for one column, shared by caveAt and genChunk so the
 *  chunk loop and edge cells always agree. Oasis and seep floors stay sealed,
 *  the crash site's footing stays solid, breach columns open to the sky. */
function caveCeil(seed: number, x: number, z: number, h: number): number {
  if (x * x + z * z < 240) return caveTop(h); // the crash site never opens
  const o = oasisNearSeed(seed, x, z, 1.5);
  if (o) return Math.min(caveTop(h), Math.round(heightAt(seed, o.x, o.z)) - 5); // pools stay sealed
  const sp = seepNearSeed(seed, x, z, 1.5);
  if (sp) return Math.min(caveTop(h), Math.round(heightAt(seed, sp.x, sp.z)) - 5); // tar pools too
  return caveBreach(seed, x, z) ? h : caveTop(h);
}

/** Is (x,y,z) cave air? One big-cheese 3D-noise field: two scales mixed, the
 *  threshold easing a little deeper down. Floor never below y=2, the crash
 *  site's footing stays whole, and the bowl under an oasis pool stays dry.
 *  Pass h when the caller already knows it. */
function caveAt(seed: number, x: number, y: number, z: number, h?: number): boolean {
  if (y < 3) return false;
  if (x * x + z * z < 240) return false; // the crash site's footing stays solid
  const hs = h ?? Math.round(heightAt(seed, x, z));
  const top = caveCeil(seed, x, z, hs);
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
 *  Layout: forward cockpit (x 2..3, insulating-glass windscreen, pilot's
 *  bunk); central hall
 *  with the wreck's bench; aft row: save room (z -1..1, the ONLY door to the
 *  outside is at the stern), water compartment to the left (z 3..4, its tank is
 *  a pool dug into the ground), heat-regulator room to the right (z -4..-3).
 *  All bulkhead doors are Inside Doors and start closed: open one and the two
 *  spaces behind it share one temperature. The wreck is plated — Metal Plating
 *  floors and skin, never rods. */
function paintShip(set: (x: number, y: number, z: number, id: number) => void, hard: boolean, phase2 = false) {
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
  // hull slope + curved hull chamfer all four vertical edges: orientation-symmetric,
  // so gen stamps no blockRot — doors self-orient from neighbours at mesh time
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
  // no bunk, no bench: the wreck keeps its shell, tank, beacon and plating —
  // everything craftable the player hand-crafts and builds themselves

  // water compartment: the ship's tank is a pool sunk into the ground —
  // look at the water in the hole and press E to refill canisters
  set(-4, 30, 4, WATER); set(-4, 29, 4, WATER);
  set(-3, 30, 4, WATER);
  // the pit is dug in soil, not sand: line walls and floor with Dirt so the
  // tank reads as a sunk cistern and holds its water at the edges
  for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1], [0, -2]] as const) set(-4 + dx, 29, 4 + dz, DIRT);
  set(-4, 28, 4, DIRT); // pit bottom
  set(-3, 30, 3, DIRT); set(-5, 30, 4, DIRT); // exposed compartment floor around the rim
  // one heat regulator, pre-installed in the small regulator room — the
  // wreck's heart stays body-neutral while you fly out. Hard Start burns it
  // out: the husk is dead machinery, breakable only for its broken frame.
  set(-4, 31, -4, hard ? REGULATOR_HUSK : REGULATOR);
  // save room beacon
  set(-4, 31, -1, BEACON);
  // Sandstorm Breaker: the wreck's one still-humming pylon, planted in the hall
  // so the calm it grants is visible from the very first night — and craftable.
  // Hard Start leaves the same pylon dead and cold.
  set(-1, 31, 1, hard ? STORM_BREAKER_HUSK : STORM_BREAKER);
  // ceiling lamps, one per room
  for (const [lx, lz] of [[3, 0], [0, 0], [-4, 3], [-4, -3], [-5, 0]] as const) set(lx, Y1, lz, LAMP);
  // scattered plating salvage — kept clear of every doorway approach
  for (const [sx, sz] of [[0, 3], [0, 4], [-1, 4], [2, 2]] as const) set(sx, 31, sz, METAL_PLATING);
  // Phase 2 Start: the wreck is already flight-capable — the drive's nozzles
  // never died, and a full flight fit stands inside the braced Frame: a yoke
  // in the cockpit, the Engine Core in the hall, Panel + Battery in the water
  // compartment. Fuel waits in the Core's ports (seeded by Game, not gen).
  if (phase2) {
    for (const x of [-1, 0]) { set(x, 32, 11, THRUSTER_LIT); set(x, 32, -11, THRUSTER_LIT); }
    set(3, 31, 0, FLIGHT_CONTROLS);
    set(PHASE2_CORE[0], PHASE2_CORE[1], PHASE2_CORE[2], ENGINECORE);
    set(-4, 31, 3, BATTERY);
    set(-5, 31, 3, POWER_PANEL);
  }
  // the wreck ships half-assembled: a Ship Frame already braced around it, one
  // Frame Corner at each of the eight corners of x -6..4, y 30..35, z -11..11.
  // That cuboid swallows the hull shell, both wings with their four Thrusters
  // at z ±11 and the save room, and it encloses no ground: every column under
  // it sits within 11 of the crash, where the plateau pins the sand at y 30 —
  // so the floor row rests on the sand line. computeFrame reads exactly one
  // cuboid out of these eight; the corners overwrite whatever stands there.
  for (const cx of [-6, 4]) for (const cy of [30, 35]) for (const cz of [-11, 11]) set(cx, cy, cz, FRAME_CORNER);
}

function paintSecondShip(set: (x: number, y: number, z: number, id: number) => void, t: { x: number; z: number }, seed: number, far: { x: number; z: number }) {
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
  // the gouge field: a dragged-keel trench running out from the shell toward
  // gougeFar — 5 wide, a block deep (two under the center line), the floor
  // partly plowed to glass, wreck debris scattered along the lips
  const dx = far.x - t.x, dz = far.z - t.z, len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
  const g = new Rng(SP + 91);
  for (let s = 3; s < len - 2; s += 1) {
    for (let w = -2; w <= 2; w++) {
      const cx = Math.round(t.x + ux * s + px * w), cz = Math.round(t.z + uz * s + pz * w);
      const h = Math.round(heightAt(seed, cx, cz));
      set(cx, h, cz, AIR);
      if (Math.abs(w) <= 1) {
        set(cx, h - 1, cz, g.next() < 0.25 ? GLASS : AIR);
        if (g.next() < 0.05) set(cx, h - 2, cz, AIR);
      }
      if (Math.abs(w) === 2 && g.next() < 0.06) set(cx, h + 1, cz, g.next() < 0.6 ? HULL : METAL_PLATING);
    }
  }
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

/** The mature Apple Tree — half the size of its Living Tree cousin: trunk
 *  3-4 blocks, a small crown, and exactly three fruit cells stamped
 *  APPLE_FRUIT. Same stage machinery as treePlan; the fruit slots are part
 *  of the plan, so a picked bough (LEAVES) re-ripens on the very same cell. */
export function appleTreePlan(x: number, y: number, z: number, rnd: () => number): TreePart[] {
  const H = 3 + (rnd() < 0.5 ? 1 : 0); // trunk 3..4 blocks
  const parts: TreePart[] = [];
  const at = (px: number, py: number, pz: number, b: number, stage: number) =>
    parts.push({ x: px, y: py, z: pz, b, stage });
  at(x, y, z, WOOD, 1);
  at(x, y + 1, z, WOOD, 1);
  for (let dy = 2; dy < H; dy++) at(x, y + dy, z, WOOD, 2);
  const top = y + H - 1;
  const crown: TreePart[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    const prof = dy === 1 ? 1.3 : 1.9; // leafy radius per layer
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const rr = dx * dx + dz * dz + dy * dy * 2.2;
      if (rr > prof * prof) continue;
      if (rr > (prof - 0.8) * (prof - 0.8) && rnd() < 0.3) continue; // ragged edge
      if (dx === 0 && dz === 0) continue;                            // the trunk breathes there
      crown.push({ x: x + dx, y: top + dy, z: z + dz, b: LEAVES, stage: 3 });
    }
  }
  // exactly three fruit cells, spread around the crown
  for (let i = 0; i < 3 && crown.length > i; i++)
    crown[Math.floor(((i + 0.5) / 3) * crown.length) % crown.length].b = APPLE_FRUIT;
  parts.push(...crown);
  return parts;
}

/** Stamp a whole mature Apple Tree into the world at a spot, seeded by its base. */
function stampAppleTree(set: (x: number, y: number, z: number, id: number) => void, x: number, groundTop: number, z: number, seed: number, salt: number) {
  const rnd = new Rng(((hash2(x, z, seed + salt) * 4294967296) >>> 0) || 1);
  for (const p of appleTreePlan(x, groundTop + 1, z, () => rnd.next())) set(p.x, p.y, p.z, p.b);
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
        // nothing stands in the pool: the terrain pass may have set a boulder,
        // a dead tree or a cactus at h+1 before the water was painted
        for (let y = hb + 1; y <= hb + 12; y++) set(x, y, z, AIR);
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
    // the canopy hangs over the water's edge but never above the pool itself
    stampTree((px, py, pz, b) => {
      if (py > hb && Math.hypot(px - o.x, pz - o.z) <= o.r) return;
      set(px, py, pz, b);
    }, tx, top, tz, seed, 81);
  }
  // 2-3 Apple Trees on the green ring — the oasis's sweetest gift
  const nApple = 2 + (hash2(o.x, o.z, seed + 91) < 0.6 ? 1 : 0);
  for (let i = 0; i < nApple; i++) {
    const a = i * (Math.PI * 2 / nApple) + hash2(o.x - i, o.z + i, seed + 93) * 1.4 + 0.5;
    const rr = o.r + 1 + hash2(o.x + i, o.z + i, seed + 95) * (gring + 1);
    const tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    const top = Math.max(Math.round(heightAt(seed, tx, tz)), hb);
    stampAppleTree((px, py, pz, b) => {
      if (py > hb && Math.hypot(px - o.x, pz - o.z) <= o.r) return;
      set(px, py, pz, b);
    }, tx, top, tz, seed, 97);
  }
  // ripe Dune Melons ripen on the sand at the water's edge — the desert's free drink
  for (let i = 0; i < 5; i++) {
    if (hash2(o.x, o.z, seed + 61 + i) < 0.35) continue;
    const a = i * 1.27 + hash2(o.z, o.x, seed + 67 + i) * 0.8;
    // walk the vine outward until it stands clear of the pool and its rim —
    // a ring only half a block out mostly rounds back inside the guard
    let rr = o.r + 1.5;
    let tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    for (let t = 0; t < 3 && Math.hypot(tx - o.x, tz - o.z) < o.r + 1; t++) {
      rr += 1;
      tx = o.x + Math.round(Math.cos(a) * rr); tz = o.z + Math.round(Math.sin(a) * rr);
    }
    if (Math.hypot(tx - o.x, tz - o.z) < o.r + 1) continue; // never in the pool or its sand rim
    set(tx, Math.max(Math.round(heightAt(seed, tx, tz)), hb) + 1, tz, MELON_2);
    // a young sprout just outside each vine: break it for Melon Seeds — the
    // oasis seeds itself, so farming melons never needs a town trip
    if (hash2(tx, tz, seed + 79 + i) < 0.55) {
      const sa = a + 0.9 + hash2(o.x, o.z, seed + 83 + i) * 0.7;
      const sr = rr + 1.8 + hash2(tz, tx, seed + 89 + i);
      const sx = o.x + Math.round(Math.cos(sa) * sr), sz = o.z + Math.round(Math.sin(sa) * sr);
      set(sx, Math.max(Math.round(heightAt(seed, sx, sz)), hb) + 1, sz, MELON_1);
    }
  }
  // Wild Sugar Cane at the waterline — the stalk's origin in the world. Break
  // a ripe stand for two canes; carry one home and Farm Land does the rest.
  const nCane = 3 + Math.floor(hash2(o.x, o.z, seed + 101) * 3); // 3..5 clumps
  for (let i = 0; i < nCane; i++) {
    const a = i * (Math.PI * 2 / nCane) + hash2(o.x + i, o.z - i, seed + 103) * 0.9;
    let rr = o.r + 1.6 + hash2(o.x - i, o.z + i, seed + 107) * (gring - 1);
    let tx = o.x + Math.round(Math.cos(a) * rr), tz = o.z + Math.round(Math.sin(a) * rr);
    for (let t = 0; t < 3 && Math.hypot(tx - o.x, tz - o.z) < o.r + 1; t++) {
      rr += 1;
      tx = o.x + Math.round(Math.cos(a) * rr); tz = o.z + Math.round(Math.sin(a) * rr);
    }
    if (Math.hypot(tx - o.x, tz - o.z) < o.r + 1) continue;
    const top = Math.max(Math.round(heightAt(seed, tx, tz)), hb) + 1;
    set(tx, top, tz, hash2(tx, tz, seed + 109) > 0.35 ? SUGARCANE_2 : SUGARCANE_1);
    // a companion stalk beside it, mostly ripe
    const nx = tx + (hash2(tx + 3, tz, seed + 111) < 0.5 ? 1 : -1), nz = tz + (hash2(tx, tz + 3, seed + 113) < 0.5 ? 1 : -1);
    if (Math.hypot(nx - o.x, nz - o.z) >= o.r + 1)
      set(nx, Math.max(Math.round(heightAt(seed, nx, nz)), hb) + 1, nz, hash2(nx, nz, seed + 117) > 0.6 ? SUGARCANE_1 : SUGARCANE_2);
  }
}

/* ── Oil Seeps and Oil-Sand Fields ───────────────────────────────────────────
 * Two lattices, one black liquid. A Seep is an oasis with the life taken out:
 * the same bowl, filled with Oil Source instead of water, its ground stained to
 * Oil Sands and nothing allowed to stand on it. The Fields are the bulk
 * deposit — a broad, wobbling flat of oil-stained sand 2-3 deep with a few
 * seep pans sweating through, never a rectangle and never a circle. */

/** Sink one Oil pan into the stained crust: a Source that stands on oil sand
 *  with solid ground all around it, so the flow sim never carries the tar off
 *  across the desert. False when the spot sits on a lip — the caller picks
 *  another. */
function oilPan(set: (x: number, y: number, z: number, id: number) => void, seed: number, x: number, z: number): boolean {
  const h = Math.round(heightAt(seed, x, z));
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    if (Math.round(heightAt(seed, x + ox, z + oz)) < h) return false;
  set(x, h, z, OIL);
  set(x, h - 1, z, OIL_SANDS);
  return true;
}

function paintSeep(set: (x: number, y: number, z: number, id: number) => void, o: Seep, seed: number) {
  const hb = Math.round(heightAt(seed, o.x, o.z));
  // the pool: same disc and bowl-rounded bottom as an oasis, running black
  for (let dx = -o.r - 4; dx <= o.r + 4; dx++) {
    for (let dz = -o.r - 4; dz <= o.r + 4; dz++) {
      const x = o.x + dx, z = o.z + dz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const h = Math.round(heightAt(seed, x, z));
      if (d <= o.r) {
        const dep = Math.max(1, Math.round(2.7 - 1.7 * (d / o.r))); // bowl: 3 .. 1
        for (let y = h; y > hb - dep; y--) set(x, y, z, AIR);
        set(x, hb - dep, z, OIL_SANDS);
        for (let y = hb - dep + 1; y <= hb; y++) set(x, y, z, OIL);
        // nothing grows in the tar: the terrain pass may have stood a cactus,
        // a dead tree or a boulder here before the pool was cut
        for (let y = hb + 1; y <= hb + 8; y++) set(x, y, z, AIR);
      } else if (d <= o.r + 1) {
        // the pool's rim is stained sand, level with the water line
        for (let y = h; y < hb + 1; y++) set(x, y, z, OIL_SANDS);
      } else if (d <= o.r + 4) {
        // the seep's stain fades out over the crust for a few cells
        set(x, h, z, OIL_SANDS);
      }
    }
  }
  // one or two pans just off the rim: Oil sunk into the stained sand, so a
  // scavenger can scoop the seep dry without wading the pool
  for (let i = 0; i < 2; i++) {
    if (hash2(o.x, o.z, seed + 161 + i) > 0.55) continue;
    const a0 = hash2(o.z - i, o.x + i, seed + 163 + i) * Math.PI * 2;
    const r0 = o.r + 2 + hash2(o.x + i, o.z - i, seed + 165 + i);
    for (let t = 0; t < 3; t++) {
      const a = a0 + t * 2.1, rr = r0 + t;
      if (oilPan(set, seed, o.x + Math.round(Math.cos(a) * rr), o.z + Math.round(Math.sin(a) * rr))) break;
    }
  }
}

function paintField(set: (x: number, y: number, z: number, id: number) => void, f: { x: number; z: number }, seed: number) {
  // the outline wobbles: two slow angular lobes over the whole blob plus fine
  // value noise at the rim, so the flat reads as a seep-stained scar, not a stamp
  const R = 12.5 + hash2(f.x, f.z, seed + 481) * 4.5; // 12.5..17 base radius
  const ph = hash2(f.z, f.x, seed + 483) * Math.PI * 2;
  const RM = Math.ceil(R * 1.62) + 1;
  for (let dx = -RM; dx <= RM; dx++) {
    for (let dz = -RM; dz <= RM; dz++) {
      const x = f.x + dx, z = f.z + dz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const a = Math.atan2(dz, dx);
      const wob = 1 + 0.2 * Math.sin(3 * a + ph) + 0.12 * Math.sin(5 * a + ph * 1.7)
        + (value2(x / 11, z / 11, seed + 487) - 0.5) * 0.55;
      const rr = R * wob;
      if (d > rr) continue;
      const h = Math.round(heightAt(seed, x, z));
      const dep = d < rr - 4 ? 3 : 2; // a third deeper in, two at the ragged edge
      for (let k = 0; k < dep; k++) set(x, h - k, z, OIL_SANDS);
      // a tar flat stays bare: scrub whatever the terrain pass rooted in it
      for (let y = h + 1; y <= h + 5; y++) set(x, y, z, AIR);
    }
  }
  // the field sweats: 3-6 shallow Oil pans sunk into the stained sand
  const nPan = 3 + (hash2(f.x, f.z, seed + 489) * 4 | 0); // 3..6
  for (let i = 0; i < nPan; i++) {
    const a0 = hash2(f.x + i * 7, f.z - i * 3, seed + 491) * Math.PI * 2;
    for (let t = 0; t < 3; t++) {
      const a = a0 + t * 2.1, rr = (R - 4) * hash2(f.x - i * 5, f.z + i * 11, seed + 493 + t);
      const px = f.x + Math.round(Math.cos(a) * rr), pz = f.z + Math.round(Math.sin(a) * rr);
      if (!oilPan(set, seed, px, pz)) continue;
      // some pans are a two-cell puddle
      if (hash2(px, pz, seed + 495) > 0.55)
        oilPan(set, seed, px + (hash2(pz, px, seed + 497) > 0.5 ? 1 : -1), pz);
      break;
    }
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
    // every hut left behind a Chest and a Bed; the good loot is decided
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
  // the town's dead Grid: Power Poles marching down the street with cold
  // Electric Lamps on their heads, and the Panel that served them still in the
  // market shell's wall — the line is broken, so the poles sit beyond the
  // Panel's reach and nothing ever trips; the lamps just stay dark
  for (const px of [t.x - 4, t.x + 2]) {
    const ph = Math.round(heightAt(seed, px, t.z - 6));
    for (let y = ph + 1; y <= ph + 3; y++) set(px, y, t.z - 6, POWER_POLE);
    set(px, ph + 4, t.z - 6, ELEC_LAMP);
  }
  const mh = Math.round(heightAt(seed, t.x + 3, t.z + 2));
  set(t.x + 7, mh + 1, t.z + 4, POWER_PANEL);
}

/* ── Cave mouths ─────────────────────────────────────────────────────────────
 * One lattice (CAVE_MOUTH_L) of arched tunnels cut into hillsides: an opening
 * on the side where the ground falls away, a diagonal descent into the cave
 * band, and a small rock chamber at the bottom. The whole layout is a pure
 * function of (centre, seed), so every chunk that overlaps it paints the same
 * cells. */

function mouthAtSeed(seed: number, tx: number, tz: number): boolean {
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // the crash's surroundings stay unmarked
  return hash2(tx, tz, seed + 311) < 0.55;
}

function mouthCenterSeed(seed: number, tx: number, tz: number): { x: number; z: number } {
  const jx = (hash2(tx, tz, seed + 313) - 0.5) * 60;
  const jz = (hash2(tx, tz, seed + 315) - 0.5) * 60;
  return { x: Math.round(tx * CAVE_MOUTH_L + jx), z: Math.round(tz * CAVE_MOUTH_L + jz) };
}

const MDIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Cut one cave mouth into the world. Only columns at y>=6 are ever carved;
 *  the tunnel is lined with ROCK so it reads as dug into stone even where
 *  natural caves wander past it. */
function paintCaveMouth(set: (x: number, y: number, z: number, id: number) => void, m: { x: number; z: number }, seed: number) {
  if (m.x * m.x + m.z * m.z < 1600) return; // never within 40 of the crash
  const [dx, dz] = MDIRS[hash2(m.x, m.z, seed + 317) * 4 | 0];
  const [px, pz] = [-dz, dx]; // perpendicular: the tunnel is 2 wide across
  const hm = Math.round(heightAt(seed, m.x, m.z));
  // mouths belong on slopes: the ground must fall away in direction d —
  // scan 1..3 out and take the first column at least 1 lower, else skip
  let kk = -1;
  for (let k = 1; k <= 3; k++) {
    if (Math.round(heightAt(seed, m.x + dx * k, m.z + dz * k)) <= hm - 2) { kk = k; break; }
  }
  if (kk < 0) return;
  // the opening stands on column s, its face open toward the lower cell m+kk*d
  const sx = m.x + dx * (kk - 1), sz = m.z + dz * (kk - 1);
  const hOut = Math.round(heightAt(seed, m.x + dx * kk, m.z + dz * kk));
  const hS = Math.round(heightAt(seed, sx, sz));
  const y0 = Math.max(Math.min(hOut + 1, hS), 8); // tunnel floor at the mouth
  if (hS < y0 + 2) return; // the hill must stand over the arched entry
  const len = 12 + (hash2(m.x, m.z, seed + 319) * 5 | 0); // 12..16 cells deep
  const ex = sx + dx * len, ez = sz + dz * len;
  const yEnd = caveTop(Math.round(heightAt(seed, ex, ez))) - 1; // land in the cave band
  if (yEnd < 6 || yEnd > y0 - 4) return; // not enough rock to dig into

  // the tunnel must stay buried along its whole path, or its lining and
  // ceiling would breach the surface as floating stone
  for (let k = 2; k < len; k++) {
    const x = sx + dx * k, z = sz + dz * k;
    const y = y0 - Math.round((k * (y0 - yEnd)) / len);
    if (Math.round(heightAt(seed, x, z)) < y + 2 || Math.round(heightAt(seed, x + px, z + pz)) < y + 2) return;
  }
  const air = new Set<string>();
  const carve = (x: number, y: number, z: number) => {
    if (y < 6) return;
    air.add(x + "," + y + "," + z);
    set(x, y, z, AIR);
  };
  // diagonal descent: 1 cell per step, dropping ~1 y every 2 steps, from the
  // mouth floor y0 down to the cave band at yEnd
  for (let k = 0; k <= len; k++) {
    const x = sx + dx * k, z = sz + dz * k;
    const y = k === len ? yEnd : y0 - Math.round((k * (y0 - yEnd)) / len);
    for (const s of [0, 1]) {
      carve(x + px * s, y, z + pz * s);
      carve(x + px * s, y + 1, z + pz * s);
      if (k <= 1) carve(x + px * s, y + 2, z + pz * s); // arched entry: 3 tall at the mouth
    }
  }
  // terminal chamber: 5x3x5 of open rock with a stone floor and roof
  for (let x = ex - 2; x <= ex + 2; x++) for (let z = ez - 2; z <= ez + 2; z++) {
    for (let y = yEnd; y <= yEnd + 2; y++) carve(x, y, z);
    set(x, yEnd - 1, z, ROCK);
    set(x, yEnd + 3, z, ROCK);
  }
  // stone lining: any buried air touching the tunnel becomes ROCK — the
  // tunnel keeps its own shape wherever caves or loose sand would bleed in
  for (const key of air) {
    const c = key.split(",");
    const x = +c[0], y = +c[1], z = +c[2];
    for (const [nx, ny, nz] of [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]] as const) {
      if (ny < 5 || air.has(nx + "," + ny + "," + nz)) continue;
      if (ny <= Math.round(heightAt(seed, nx, nz))) set(nx, ny, nz, ROCK);
    }
  }
  // rim: a ROCK collar around the surface opening, open toward the downhill face
  for (const [rx, rz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    if (rx === dx && rz === dz) continue;
    const x = sx + rx, z = sz + rz;
    set(x, Math.round(heightAt(seed, x, z)), z, ROCK);
  }
  for (const s of [0, 1]) { // solid floor under the arched opening
    set(sx + px * s, y0 - 1, sz + pz * s, ROCK);
  }
  set(sx + dx, y0 + 3, sz + dz, ROCK); // lintel above the entry
  // rubble scattered in front of the opening
  const nR = 2 + (hash2(m.x + 7, m.z - 3, seed + 321) * 3 | 0); // 2..4
  for (let i = 0; i < nR; i++) {
    const back = 1 + (hash2(m.x + i, m.z, seed + 323) * 3 | 0);
    const side = (hash2(m.x - i, m.z, seed + 325) * 3 | 0) - 1;
    const x = m.x + dx * (kk + back) + px * side, z = m.z + dz * (kk + back) + pz * side;
    set(x, Math.round(heightAt(seed, x, z)) + 1, z, hash2(x, z, seed + 327) > 0.5 ? GRAVEL : ROCK);
  }
}

/* ── Trader camps ────────────────────────────────────────────────────────────
 * A sparser lattice (CAMP_L) than Towns: a windmill, hut or farmstead with a
 * market stall, campfire and trader you can barter with. Each camp's site is
 * flattened — heightAt levels the sand under it — and no camp can spawn near
 * the crash, an oasis, the second wreck or a Town. */

export function campAtSeed(seed: number, tx: number, tz: number): boolean {
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // keeps camps ~300 clear of the crash
  if (hash2(tx, tz, seed + 401) >= 0.8) return false;
  const c = campCenterSeed(seed, tx, tz);
  const st = structuresOf(seed); // pure in the seed — the same world any live Structures holds
  if (oasisNearSeed(seed, c.x, c.z, 20)) return false;
  if (Math.hypot(st.secondShip.x - c.x, st.secondShip.z - c.z) < 40) return false;
  if (st.townNear(c.x, c.z, 25) !== null) return false;
  return true;
}

export function campCenterSeed(seed: number, tx: number, tz: number): { x: number; z: number } {
  const jx = (hash2(tx, tz, seed + 403) - 0.5) * 60;
  const jz = (hash2(tx, tz, seed + 405) - 0.5) * 60;
  return { x: Math.round(tx * CAMP_L + jx), z: Math.round(tz * CAMP_L + jz) };
}

export function campTypeSeed(seed: number, tx: number, tz: number): 0 | 1 | 2 {
  return (hash2(tx, tz, seed + 407) * 3 | 0) as 0 | 1 | 2;
}

/** The open cell in front of a camp's trader stall — the spot game.ts parks
 *  the trader on. That column is kept free of any structure. */
export function campTraderSpot(c: { x: number; z: number }): { x: number; z: number } {
  return { x: c.x + 1.5, z: c.z - 1.5 };
}

/** Build one camp on its flattened site (ground level f from heightAt). */
function paintCamp(set: (x: number, y: number, z: number, id: number) => void, c: Camp, seed: number) {
  const f = Math.round(heightAt(seed, c.x, c.z));

  // the trader stall, 2 cells east of the centre: adobe counter, awning on
  // wood posts, plated roof with a lamp set into the awning over the counter
  set(c.x + 2, f + 1, c.z + 1, ADOBE); // counter
  for (const [px2, pz2] of [[3, 1], [2, 2], [3, 2]] as const)
    for (let y = f + 1; y <= f + 2; y++) set(c.x + px2, y, c.z + pz2, WOOD); // awning posts
  set(c.x + 3, f + 3, c.z + 1, METAL_PLATING);
  set(c.x + 2, f + 3, c.z + 2, METAL_PLATING);
  set(c.x + 3, f + 3, c.z + 2, METAL_PLATING);
  set(c.x + 2, f + 3, c.z + 1, LAMP); // lamp under the awning, over the counter

  // campfire — for the hut camps the main house owns (c.x-2,c.z), so its fire
  // burns a little wider out
  set(c.x - 2, f + 1, c.type === 1 ? c.z + 3 : c.z, CAMPFIRE);

  // a camp hut: floor at f, interior air f+1..f+3, adobe walls f+1..f+3, roof f+4
  const hut = (hx: number, hz: number, w: number, dp: number) => {
    const x0 = hx - (w >> 1), x1 = hx + (w >> 1), z0 = hz - (dp >> 1), z1 = hz + (dp >> 1);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
      for (let y = f; y <= f + 4; y++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        const solid = y === f || y === f + 4 || (edge && y <= f + 3);
        set(x, y, z, solid ? ADOBE : AIR);
      }
    // doorway on the +x face: a proper door in one cell, an open gap beside it
    set(x1, f + 1, hz, DOOR_CLOSED); set(x1, f + 2, hz, DOOR_UPPER);
    set(x1, f + 1, hz + 1, AIR); set(x1, f + 2, hz + 1, AIR);
    set(x0 + 1, f + 1, hz + 1, CHEST);
    set(x1 - 2, f + 1, hz - 1, BED); set(x1 - 2, f + 1, hz, BED_EXT);
    set(x1 - 1, f + 3, z0 + 1, LAMP); // lamp on the wall
  };

  if (c.type === 0) {
    // windmill: a round stone drum 10 tall, its western side notched so the
    // campfire sits snug at the foot; axle and blade wheel face west
    for (let dx2 = -2; dx2 <= 2; dx2++) for (let dz2 = -2; dz2 <= 2; dz2++) {
      if (dx2 * dx2 + dz2 * dz2 > 4.5) continue;
      if (dx2 === 2 && dz2 === 0) continue; // the nook the campfire burns in
      const bx = c.x - 4 + dx2, bz = c.z + dz2;
      const b = hash2(bx * 3 + 1, bz * 5 - 2, seed + 411) > 0.62 ? ADOBE : SANDSTONE;
      for (let y = f; y <= f + 9; y++) set(bx, y, bz, b);
    }
    for (let i = 2; i <= 3; i++) set(c.x - 4 - i, f + 7, c.z, WOOD); // axle poking west
    set(c.x - 7, f + 7, c.z, METAL_PLATING); // hub
    for (let i = 1; i <= 3; i++) { // four-blade cross, 1 wide, 3 long, in the west-facing plane
      set(c.x - 7, f + 7 + i, c.z, DEADWOOD);
      set(c.x - 7, f + 7 - i, c.z, DEADWOOD);
      set(c.x - 7, f + 7, c.z + i, DEADWOOD);
      set(c.x - 7, f + 7, c.z - i, DEADWOOD);
    }
    // a 3x3 store with a chest and an open doorway facing the camp
    const sx = c.x - 7, sz = c.z + 2;
    for (let x = sx - 1; x <= sx + 1; x++) for (let z = sz - 1; z <= sz + 1; z++)
      for (let y = f; y <= f + 3; y++) {
        const door = x === sx + 1 && z === sz && (y === f + 1 || y === f + 2);
        const solid = y === f || y === f + 3 ||
          (Math.abs(x - sx) === 1 || Math.abs(z - sz) === 1) && y <= f + 2;
        if (!solid || door) set(x, y, z, AIR); else set(x, y, z, ADOBE);
      }
    set(sx, f + 1, sz, CHEST); // one step inside the doorway
  } else if (c.type === 1) {
    hut(c.x - 4, c.z, 5, 5);
  } else {
    // farmstead: a 7x5 house, a walled wheat-and-melon plot, and a rock-ringed water trough
    hut(c.x - 5, c.z - 3, 7, 5);
    for (let x = c.x + 4; x <= c.x + 9; x++) for (let z = c.z - 4; z <= c.z - 1; z++) {
      set(x, f, z, FARMLAND);
      const melon = (x === c.x + 4 && z === c.z - 4) || (x === c.x + 9 && z === c.z - 1);
      if (melon) set(x, f + 1, z, MELON_2);
      else set(x, f + 1, z, (x + z) % 2 ? WHEAT_1 : WHEAT_2);
    }
    // deadwood fence posts around the plot, one every two cells
    const post = (x: number, z: number) => { set(x, f + 1, z, DEADWOOD); set(x, f + 2, z, DEADWOOD); };
    for (let x = c.x + 3; x <= c.x + 10; x += 2) { post(x, c.z - 5); post(x, c.z); }
    for (let z = c.z - 3; z <= c.z - 1; z += 2) { post(c.x + 3, z); post(c.x + 10, z); }
    // water trough: a 2x1 pool with a rock rim, sitting on the flat ground
    for (let x = c.x; x <= c.x + 3; x++) for (let z = c.z + 3; z <= c.z + 5; z++) {
      const inner = x >= c.x + 1 && x <= c.x + 2 && z === c.z + 4;
      set(x, f + 1, z, inner ? WATER : ROCK);
    }
  }
}

/* -- Grid Relics -------------------------------------------------------------
 * The Dwellers' power age, out in the dunes: an adobe outstation whose Panel,
 * Battery and roof Solar Panel still wire a working Grid — a line of Poles
 * runs east to a small mast whose Electric Lamp has been burning for years.
 * The site flattens like a camp; the chest holds the old world's parts. */
export function outpostAtSeed(seed: number, tx: number, tz: number): boolean {
  if (Math.abs(tx) <= 1 && Math.abs(tz) <= 1) return false; // keeps relics ~520 clear of the crash
  if (hash2(tx, tz, seed + 431) >= 0.55) return false;
  const c = outpostCenterSeed(seed, tx, tz);
  const st = structuresOf(seed);
  if (oasisNearSeed(seed, c.x, c.z, 24)) return false;
  if (Math.hypot(st.secondShip.x - c.x, st.secondShip.z - c.z) < 40) return false;
  if (st.townNear(c.x, c.z, 26) !== null) return false;
  if (st.campNear(c.x, c.z, 26) !== null) return false;
  if (st.mouthNear(c.x, c.z, 26) !== null) return false;
  return true;
}
export function outpostCenterSeed(seed: number, tx: number, tz: number): { x: number; z: number } {
  const jx = (hash2(tx, tz, seed + 433) - 0.5) * 48;
  const jz = (hash2(tx, tz, seed + 435) - 0.5) * 48;
  return { x: Math.round(tx * OUTPOST_L + jx), z: Math.round(tz * OUTPOST_L + jz) };
}
/** The relic site holding (x,z) — Chebyshev <=10 from a relic centre — with the
 *  distance, or null. Same shape as campSiteAt: jitter 24 << OUTPOST_L, so the
 *  3x3 lattice ring scan is exact. */
function outpostSiteAt(seed: number, x: number, z: number): { cx: number; cz: number; d: number } | null {
  const tx = Math.floor(x / OUTPOST_L), tz = Math.floor(z / OUTPOST_L);
  let best: { cx: number; cz: number; d: number } | null = null;
  for (let ax = tx - 1; ax <= tx + 1; ax++) for (let az = tz - 1; az <= tz + 1; az++) {
    if (Math.abs(x - ax * OUTPOST_L) > OUTPOST_L / 2 + 24 || Math.abs(z - az * OUTPOST_L) > OUTPOST_L / 2 + 24) continue;
    if (!outpostAtSeed(seed, ax, az)) continue;
    const c = outpostCenterSeed(seed, ax, az);
    const d = Math.max(Math.abs(c.x - x), Math.abs(c.z - z));
    if (d <= 10 && (best === null || d < best.d)) best = { cx: c.x, cz: c.z, d };
  }
  return best;
}
function paintOutpost(set: (x: number, y: number, z: number, id: number) => void, c: { x: number; z: number }, seed: number) {
  const f = Math.round(heightAt(seed, c.x, c.z));
  // a 6x5 adobe shed, roof at f+4, door on its -z face
  for (let x = c.x - 3; x <= c.x + 2; x++) for (let z = c.z - 2; z <= c.z + 2; z++) {
    for (let y = f; y <= f + 4; y++) {
      const floor = y === f;
      const wall = (x === c.x - 3 || x === c.x + 2 || z === c.z - 2 || z === c.z + 2) && y >= f + 1 && y <= f + 3;
      const roof = y === f + 4;
      const door = x === c.x - 1 && z === c.z - 2 && y >= f + 1 && y <= f + 2;
      if (!(floor || wall || roof) || door) { set(x, y, z, AIR); continue; }
      set(x, y, z, ADOBE);
    }
  }
  set(c.x - 1, f + 1, c.z - 2, DOOR_CLOSED); set(c.x - 1, f + 2, c.z - 2, DOOR_UPPER);
  // inside: the Grid's heart on the north wall, a Battery, and a Chest
  set(c.x + 2, f + 1, c.z, POWER_PANEL);
  set(c.x + 1, f + 1, c.z + 1, BATTERY);
  set(c.x - 2, f + 1, c.z, CHEST);
  set(c.x - 2, f + 1, c.z - 1, SALT); // salted provisions of the old crew
  // the Grid itself, visible from far off: a Solar Panel on the roof, Poles
  // marching east to a mast, and its lamp lit atop
  set(c.x, f + 5, c.z, SOLAR_PANEL);
  for (let x = c.x + 5; x <= c.x + 13; x += 4) {
    for (let y = f + 1; y <= f + 4; y++) set(x, y, c.z, POWER_POLE);
  }
  for (let y = f + 1; y <= f + 7; y++) set(c.x + 16, y, c.z, POWER_POLE);
  set(c.x + 16, f + 8, c.z, ELEC_LAMP);
}
export function genChunk(seed: number, st: Structures, cx: number, cz: number, worldMode: "easy" | "hard" | "phase2" = "easy"): Uint8Array {
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
      const top = caveCeil(seed, wx, wz, h); // cave band top (breach columns reach the surface)

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
        // wall crust: rare 3D-noise blobs clinging to the cave skin
        // (thresholds picked so each ore covers ~1/10 of the wall as before)
        if (y <= 9 && hash2(wx * 7 + y, wz * 3 - y, seed + 343) < 0.35 &&
            noise3(wx / 5 + 200, y / 5, wz / 5, seed + 341) > 0.893) c[idx] = ANTHRACITE_ORE; // the deep desert's hard coal
        else if (y <= 15 && hash2(wx * 5 + y, wz * 7 - y, seed + 333) < 0.4 &&
            noise3(wx / 5 + 40, y / 5, wz / 5, seed + 331) > 0.886) c[idx] = COBALT_ORE;
        else if (y >= 12 && noise3(wx / 5, y / 5, wz / 5, seed + 313) > 0.864) c[idx] = IRON_ORE;
        else if (y >= 12 && noise3(wx / 5, y / 5 + 60, wz / 5, seed + 317) > 0.878) c[idx] = COPPER_ORE;
        else if (y >= 6 && noise3(wx / 5 + 120, y / 5 + 30, wz / 5, seed + 329) > 0.842) c[idx] = COAL_ORE;
        else if (y >= 8 && y <= 24 && noise3(wx / 5, y / 5, wz / 5 + 70, seed + 321) > 0.883) c[idx] = ALABASTER;
      }

      // occasional 1x1 entrance shaft: one column punched straight down from
      // the surface into the cave band, with a rock floor — never at the
      // crash, under a Town (its stair shaft owns those columns), an oasis, in
      // reach of a seep's pool and pans, or a breach column (those already
      // stand open to the sky)
      if (!atCrash && h >= 12 && hash2(wx, wz, seed + 201) > 0.984 &&
          !caveBreach(seed, wx, wz) &&
          st.townNear(wx, wz, 14) === null && st.nearOasis(wx, wz) === null &&
          st.seepNear(wx, wz, 7) === null) {
        const d = top - 4; // a little open headroom at the cave floor
        if (d >= 7) {
          for (let y = h - 1; y >= d; y--) c[(x * CS + z) * CH + y] = AIR;
          c[(x * CS + z) * CH + (d - 1)] = ROCK;
        }
      }

      // Badlands coal: rare seams of Coal Ore poking through the crust, only
      // where the ground runs to stone. A patch is its anchor plus a couple of
      // arms, and every column asks the five anchors that could reach it, so a
      // patch never clips at a chunk border.
      if (!atCrash) {
        let seam = false, proud = false;
        for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ax = wx - ox, az = wz - oz;
          if (hash2(ax, az, seed + 51) <= 0.992) continue;
          const abi = biomeAt(ax, az, seed);
          if (abi !== B_MESA && abi !== B_ROCKY) continue;
          if (ox === 0 && oz === 0) { seam = true; proud = true; break; }
          if (hash2(ax + ox * 7, az + oz * 13, seed + 53) > 0.45) { seam = true; break; }
        }
        if (seam) {
          c[(x * CS + z) * CH + h] = COAL_ORE;
          if (proud && c[(x * CS + z) * CH + h + 1] === 0) setW(wx, h + 1, wz, COAL_ORE);
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
          // leaning slab: 2-3 blocks stacked, the cap jutting one to the side
          const n = 2 + (hash2(wx, wz, seed + 24) * 2 | 0);
          const ld = [[1, 0], [-1, 0], [0, 1], [0, -1]][hash2(wx, wz, seed + 25) * 4 | 0];
          for (let i = 0; i < n; i++) setW(wx, h + 1 + i, wz, ROCK);
          if (inR(x + ld[0], z + ld[1])) setW(wx + ld[0], h + n, wz + ld[1], ROCK);
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

  if (cx >= -1 && cx <= 0 && cz >= -1 && cz <= 0) paintShip(setW, worldMode === "hard", worldMode === "phase2");
  // Oases on an unbounded lattice: centers jitter ±80, the painted footprint
  // reaches r+24, so the scan window adds a cell of slack on each side.
  const ox0 = Math.floor((cx * CS - 104) / OASIS_L), ox1 = Math.floor((cx * CS + CS - 1 + 104) / OASIS_L);
  const oz0 = Math.floor((cz * CS - 104) / OASIS_L), oz1 = Math.floor((cz * CS + CS - 1 + 104) / OASIS_L);
  for (let ix = ox0; ix <= ox1; ix++) for (let iz = oz0; iz <= oz1; iz++) {
    const o = st.oasisOf(ix, iz);
    if (o && Math.abs(cx * CS + 8 - o.x) < o.r + 24 && Math.abs(cz * CS + 8 - o.z) < o.r + 24) paintOasis(setW, o, seed);
  }
  // Oil-sand Fields on the rarest landmark lattice: centres jitter ±180 and a
  // tar flat reaches ~30 cells out, so the scan window adds that much slack.
  const gx0 = Math.floor((cx * CS - 210) / FIELD_L), gx1 = Math.floor((cx * CS + CS - 1 + 210) / FIELD_L);
  const gz0 = Math.floor((cz * CS - 210) / FIELD_L), gz1 = Math.floor((cz * CS + CS - 1 + 210) / FIELD_L);
  for (let ix = gx0; ix <= gx1; ix++) for (let iz = gz0; iz <= gz1; iz++) {
    if (!st.fieldAt(ix, iz)) continue;
    const fl = st.fieldCenter(ix, iz);
    if (cx * CS <= fl.x + 31 && cx * CS + CS - 1 >= fl.x - 31 && cz * CS <= fl.z + 31 && cz * CS + CS - 1 >= fl.z - 31)
      paintField(setW, fl, seed);
  }
  // Oil Seeps on their own lattice: centres jitter ±40, the pool plus its
  // stained halo reaches r+4, hence the slack on each side.
  const sx0 = Math.floor((cx * CS - 49) / SEEP_L), sx1 = Math.floor((cx * CS + CS - 1 + 49) / SEEP_L);
  const sz0 = Math.floor((cz * CS - 49) / SEEP_L), sz1 = Math.floor((cz * CS + CS - 1 + 49) / SEEP_L);
  for (let ix = sx0; ix <= sx1; ix++) for (let iz = sz0; iz <= sz1; iz++) {
    const sp = st.seepOf(ix, iz);
    if (sp && Math.abs(cx * CS + 8 - sp.x) < sp.r + 12 && Math.abs(cz * CS + 8 - sp.z) < sp.r + 12) paintSeep(setW, sp, seed);
  }
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
  // Trader camps on their own lattice (centres jitter ±30; site + buildings
  // reach ~15 cells, the trough and fence a little more — hence the slack).
  const kx0 = Math.floor((cx * CS - 48 - CAMP_L) / CAMP_L), kx1 = Math.floor((cx * CS + CS - 1 + 48 + CAMP_L) / CAMP_L);
  const kz0 = Math.floor((cz * CS - 48 - CAMP_L) / CAMP_L), kz1 = Math.floor((cz * CS + CS - 1 + 48 + CAMP_L) / CAMP_L);
  for (let tx = kx0; tx <= kx1; tx++) for (let tz = kz0; tz <= kz1; tz++) {
    if (!st.campAt(tx, tz)) continue;
    const cc = st.campCenter(tx, tz);
    if (cx * CS <= cc.x + 12 && cx * CS + CS - 1 >= cc.x - 12 && cz * CS <= cc.z + 6 && cz * CS + CS - 1 >= cc.z - 10)
      paintCamp(setW, { x: cc.x, z: cc.z, type: st.campType(tx, tz) }, seed);
  }
  // Grid Relics on their own rarest lattice: centres jitter ±24; the shed,
  // pole line and mast reach from x-3 to x+17 and y+8, hence the slack.
  const rx0 = Math.floor((cx * CS - 32 - OUTPOST_L) / OUTPOST_L), rx1 = Math.floor((cx * CS + CS - 1 + 24 + OUTPOST_L) / OUTPOST_L);
  const rz0 = Math.floor((cz * CS - 32 - OUTPOST_L) / OUTPOST_L), rz1 = Math.floor((cz * CS + CS - 1 + 12 + OUTPOST_L) / OUTPOST_L);
  for (let tx = rx0; tx <= rx1; tx++) for (let tz = rz0; tz <= rz1; tz++) {
    if (!st.outpostAt(tx, tz)) continue;
    const po = st.outpostCenter(tx, tz);
    if (cx * CS <= po.x + 17 && cx * CS + CS - 1 >= po.x - 3 && cz * CS <= po.z + 2 && cz * CS + CS - 1 >= po.z - 2)
      paintOutpost(setW, po, seed);
  }
  // Cave mouths: the tunnel + rim reach ~24 cells from the (jittered) centre
  const nx0 = Math.floor((cx * CS - 54 - CAVE_MOUTH_L) / CAVE_MOUTH_L), nx1 = Math.floor((cx * CS + CS - 1 + 54 + CAVE_MOUTH_L) / CAVE_MOUTH_L);
  const nz0 = Math.floor((cz * CS - 54 - CAVE_MOUTH_L) / CAVE_MOUTH_L), nz1 = Math.floor((cz * CS + CS - 1 + 54 + CAVE_MOUTH_L) / CAVE_MOUTH_L);
  for (let tx = nx0; tx <= nx1; tx++) for (let tz = nz0; tz <= nz1; tz++) {
    if (!st.mouthAt(tx, tz)) continue;
    const mo = st.mouthCenter(tx, tz);
    if (cx * CS <= mo.x + 24 && cx * CS + CS - 1 >= mo.x - 24 && cz * CS <= mo.z + 24 && cz * CS + CS - 1 >= mo.z - 24)
      paintCaveMouth(setW, mo, seed);
  }
  // the wreck shell (±6) and the whole gouge trench run through this chunk?
  const gsx0 = Math.min(st.secondShip.x, st.gougeFar.x) - 6, gsx1 = Math.max(st.secondShip.x, st.gougeFar.x) + 6;
  const gsz0 = Math.min(st.secondShip.z, st.gougeFar.z) - 6, gsz1 = Math.max(st.secondShip.z, st.gougeFar.z) + 6;
  if (cx * CS <= gsx1 && cx * CS + CS - 1 >= gsx0 && cz * CS <= gsz1 && cz * CS + CS - 1 >= gsz0)
    paintSecondShip(setW, st.secondShip, seed, st.gougeFar);

  return c;
}
