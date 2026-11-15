import * as THREE from "three";
import { World } from "./world";
import { DAY_SECONDS } from "./blocks";
import { noise1 } from "./noise";

export const BODY_MIN = 20, BODY_MAX = 45;     // heat bar display range (°C body)
export const SAFE_LO = 36.0, SAFE_HI = 37.5;   // safe body temperature zone
// where Health starts draining — the HUD paints a mark on each bar here
export const HOT_LIMIT = 39.5, COLD_LIMIT = 31.5, WATER_LIMIT = 5;

const AMBIENT_MEAN = 21, AMBIENT_AMP = 26;     // 24-min desert day: ~-5 night, ~+47 peak
export const REGULATOR_ROOM_MAX = 100;         // open cells (sealed) one Heat Regulator can hold at neutral

export class Survival {
  health = 100; water = 100; body = 36.6;
  invincible = false;          // cheat: hurt() becomes a no-op; bars still move
  surgeCooldown = 0;           // sweat surge lockout seconds
  causeOfDeath: string | null = null;
  vision = 0; // 0 fine .. 1 worst (low-water visual)
  lastAmbient = 0; lastAmbientEff = 0; lastShelterR = 0; lastTarget = 36.6; lastOpenSky = false;
  lastRoom: { size: number; sealed: boolean; regulators: number } = { size: 0, sealed: false, regulators: 0 };

  private embedKey = "";
  private embedAir: { R: number; openSky: boolean; shelter: number; ambEff: number; room: ReturnType<World["roomInfo"]> } | null = null;

  constructor(private weatherSeed: number) {}

  worldTimeToDayFrac(t: number) { return (t % DAY_SECONDS) / DAY_SECONDS; }

  ambient(biome: number, frac: number, tSec: number): number {
    // desert diurnal curve: coldest at sunrise (frac .25), hottest mid-afternoon
    let T = AMBIENT_MEAN - AMBIENT_AMP * Math.cos((frac - 0.28) * Math.PI * 2);
    if (biome === 2) T -= 2;                 // salt flats reflect
    if (biome === 3 || biome === 4) T += 3;  // rock retains heat
    // 10-s stepped weather fluctuation, deterministic timeline (±8°C)
    const w = noise1(Math.floor(tSec / 10) / 60, this.weatherSeed) * 2 - 1;
    return T + w * 8;
  }

  /** body-temp target from shelter + sun; nothing hardcoded "inside ship". */
  update(dt: number, world: World, pos: THREE.Vector3, opts: {
    sprinting: boolean; overencumbered: boolean; biome: number; tSec: number; sunElev: number; inWater: boolean;
  }) {
    if (this.health <= 0) return;
    if (this.surgeCooldown > 0) this.surgeCooldown -= dt;
    const frac = this.worldTimeToDayFrac(opts.tSec);
    const amb = this.ambient(opts.biome, frac, opts.tSec);
    const fx = Math.floor(pos.x), fy = Math.floor(pos.y), fz = Math.floor(pos.z);

    // One cell's air: column shelter + sun + sealed-room regulators.
    // A sealed space's air drifts to the outside temperature — walls alone don't
    // save you. Only Heat Regulators, whose capacity (100 cells each) stacks,
    // hold a sealed room at body-neutral temperature.
    const cellAir = (x: number, y: number, z: number) => {
      const { R, openSky } = world.skyResistance(x, y, z);
      let shelter = 1 - Math.exp(-R);        // 0 exposed .. ~0.997 sealed
      let ambEff = amb;
      if (openSky && opts.sunElev > 0) ambEff += 8 + 10 * opts.sunElev; // direct sun beats down
      const room = world.roomInfo(x, y, z);
      if (room.sealed) {
        if (room.regulators * REGULATOR_ROOM_MAX >= room.size) { ambEff = 36.6; shelter = 1; }
        else { ambEff = amb; shelter = 0; }
      }
      return { R, openSky, shelter, ambEff, room };
    };

    let here = cellAir(fx, fy, fz);
    // Standing inside a block (an open door's cell, a wall you're clipped into):
    // the cell itself holds no air, so ask every surrounding cell and breathe
    // whichever is nearest body temperature — a doorway borrows the closest side.
    if (here.room.size === 0) {
      const key = `${fx},${fy},${fz}|${Math.floor(opts.tSec * 2)}`; // resampled twice a second
      if (this.embedKey !== key) {
        let best = here;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dy && !dz) continue;
          const cand = cellAir(fx + dx, fy + dy, fz + dz);
          if (cand.room.size === 0) continue;
          if (Math.abs(cand.ambEff - 37) < Math.abs(best.ambEff - 37)) best = cand;
        }
        this.embedKey = key; this.embedAir = best;
      }
      if (this.embedAir) here = this.embedAir;
    }
    this.lastOpenSky = here.openSky;
    let shelter = here.shelter;
    let ambEff = here.ambEff;
    const room = here.room;
    this.lastRoom = room;
    if (opts.inWater) {
      // desert water is cold: it pulls hard against midday heat, and is a little
      // kinder than freezing night air — the average of air and water temperature
      const wt = THREE.MathUtils.clamp(amb, 12, 24) - 3;
      ambEff = (ambEff + wt) / 2;
    }
    // body always regulates toward 36.6; exposure pulls it toward the effective air temp
    const target = 36.6 + (ambEff - 36.6) * (1 - shelter);
    this.lastAmbient = amb; this.lastAmbientEff = ambEff; this.lastShelterR = here.R; this.lastTarget = target;

    // sealed air moves the body fast — a hot room cooks you in minutes, and so does a cold one
    const k = room.sealed ? 0.022 : 0.0075; // tau ~45 s inside, ~2 min out in the open
    this.body += (target - this.body) * k * dt;
    this.body = THREE.MathUtils.clamp(this.body, 12, 44.5);

    // Water drain: ~1.5 days per full bar, plus sweat / sprint / overencumbrance
    let drain = 100 / (DAY_SECONDS * 1.5);
    if (this.body > 37) drain += (this.body - 37) * 0.02;
    if (opts.sprinting) drain *= 1.7;
    if (opts.overencumbered) drain += 0.05;
    this.water = Math.max(0, this.water - drain * dt);

    // Damage
    if (this.body > HOT_LIMIT) this.hurt((this.body - HOT_LIMIT) * 0.6, "heat stroke");
    if (this.body < COLD_LIMIT) this.hurt((COLD_LIMIT - this.body) * 0.7, "hypothermia");
    if (this.water <= 0) this.hurt(1.2, "dehydration");
    else if (this.water < WATER_LIMIT) this.hurt((WATER_LIMIT - this.water) * 0.15, "dehydration");

    // Regen: only when Water AND Heat are in their zones
    if (this.water > 25 && this.body >= SAFE_LO && this.body <= SAFE_HI && this.health > 0)
      this.health = Math.min(100, this.health + 0.25 * dt);

    this.vision = THREE.MathUtils.clamp((28 - this.water) / 28, 0, 1);
  }

  hurt(amount: number, cause: string) {
    if (this.health <= 0 || this.invincible) return;
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.causeOfDeath = cause; }
  }

  /** Sweat surge: spend water to force the body cool. Returns why it failed, if it did. */
  surge(): "ok" | "thirsty" | "cooling" {
    if (this.surgeCooldown > 0) return "cooling";
    if (this.water < 20) return "thirsty";
    this.water -= 10;
    this.body = Math.max(30, this.body - 1.5);
    this.surgeCooldown = 10;
    return "ok";
  }

  drink() {
    this.water = Math.min(100, this.water + 25);
    // cool water straight into the gut knocks body temp down a little
    if (this.body > 34) this.body = Math.max(34, this.body - Math.min(1.5, this.body - 33.5));
  }

  reset() { this.health = 100; this.water = 100; this.body = 36.6; this.causeOfDeath = null; }
}
