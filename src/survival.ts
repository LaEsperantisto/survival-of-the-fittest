import * as THREE from "three";
import { World } from "./world";
import { DAY_SECONDS } from "./blocks";
import { noise1 } from "./noise";

export const BODY_MIN = 20, BODY_MAX = 45;     // heat bar display range (°C body)
export const SAFE_LO = 36.0, SAFE_HI = 37.5;   // safe body temperature zone
// where Health starts draining — the HUD paints a mark on each bar here
export const HOT_LIMIT = 39.5, COLD_LIMIT = 31.5, WATER_LIMIT = 5;
export const CAVE_AMBIENT = 22;              // Deep Air Temperature: near-constant mild (ADR-0004)

const AMBIENT_MEAN = 27, AMBIENT_AMP = 25;     // 24-min desert day: ~2 °C night, ~52 °C peak
export const REGULATOR_ROOM_MAX = 150;         // open cells (sealed) one Heat Regulator can hold at neutral

export class Survival {
  health = 100; water = 100; body = 36.6;
  invincible = false;          // cheat: hurt() becomes a no-op; bars still move
  surgeCooldown = 0;           // sweat surge lockout seconds
  causeOfDeath: string | null = null;
  vision = 0; // 0 fine .. 1 worst (low-water visual)
  storm = 0;   // Sandstorm intensity 0..1 — raw outdoors: amplified air, hard sweat, sand blast
  lastAmbient = 0; lastAmbientEff = 0; lastShelterR = 0; lastTarget = 36.6; lastOpenSky = false;
  lastRoom: { size: number; sealed: boolean; regulators: number } = { size: 0, sealed: false, regulators: 0 };
  regulatedAir = false; // standing in a sealed Space its Regulators hold at neutral

  private embedKey = "";
  private embedAir: { R: number; openSky: boolean; shelter: number; ambEff: number; room: ReturnType<World["roomInfo"]>; deep: boolean } | null = null;

  constructor(private weatherSeed: number) {}

  worldTimeToDayFrac(t: number) { return (t % DAY_SECONDS) / DAY_SECONDS; }

  ambient(biome: number, frac: number, tSec: number): number {
    // desert diurnal curve: coldest at sunrise (frac .28), hottest early afternoon (frac .58);
    // it climbs through the morning and drifts down over the long night
    const d = (frac - 0.28 + 1) % 1;
    let T = AMBIENT_MEAN - AMBIENT_AMP * (d <= 0.3
      ? Math.cos((d / 0.3) * Math.PI)
      : Math.cos((1 + ((d - 0.3) / 0.7)) * Math.PI));
    if (biome === 2) T -= 2;                 // salt flats reflect
    if (biome === 3 || biome === 4) T += 3;  // rock retains heat
    // 10-s stepped weather fluctuation, deterministic timeline (±8°C)
    const w = noise1(Math.floor(tSec / 10) / 60, this.weatherSeed) * 2 - 1;
    return T + w * 8;
  }

  /** Sandstorm regime: slow deterministic 5-min steps; about a third of
   *  regimes blow, easing in and out through the noise itself. */
  stormAt(tSec: number): number {
    const s = noise1(Math.floor(tSec / 300) / 15, this.weatherSeed + 911);
    return s > 0.7 ? Math.min(1, (s - 0.7) / 0.15) : 0;
  }

  /** body-temp target from shelter + sun; nothing hardcoded "inside ship". */
  update(dt: number, world: World, pos: THREE.Vector3, opts: {
    sprinting: boolean; overencumbered: boolean; biome: number; tSec: number; sunElev: number;
    sunDir: { x: number; y: number; z: number } | null; inWater: boolean; warmth: number;
    regulator: boolean; terrainH: (x: number, z: number) => number;
    stormShield: boolean; stormMul: number; // Breaker calm zeroes the storm; Chitin armour quarters it
  }) {
    if (this.health <= 0) return;
    if (this.surgeCooldown > 0) this.surgeCooldown -= dt;
    const frac = this.worldTimeToDayFrac(opts.tSec);
    const amb = this.ambient(opts.biome, frac, opts.tSec);
    const fx = Math.floor(pos.x), fy = Math.floor(pos.y), fz = Math.floor(pos.z);

    // One cell's air: column shelter + directional Sunlight + sealed-room regulators.
    // A sealed space's air drifts to the outside temperature — walls alone don't
    // save you. Only Heat Regulators, whose capacity (150 cells each) stacks,
    // hold a sealed room at body-neutral temperature.
    // Underground (ADR-0004): Deep Air Temperature is near-constant mild — two
    // or more cells below the terrain surface, the rock swallows the day's swing.
    // Caves trade darkness and enemies for thermal refuge; that is the trade.
    const cellAir = (x: number, y: number, z: number) => {
      const deep = y <= opts.terrainH(x, z) - 2;
      const amb0 = deep ? CAVE_AMBIENT : amb;
      const { R, openSky } = world.skyResistance(x, y, z);
      let shelter = 1 - Math.exp(-R);        // 0 exposed .. ~0.997 sealed
      let ambEff = amb0;
      // direct sun is a line to the sun, like the shader's shadow — shade from
      // rocks, trees and roofs falls where the line is broken, not just overhead
      if (!deep && opts.sunElev > 0 && opts.sunDir && world.sunVisible(x, y, z, opts.sunDir.x, opts.sunDir.y, opts.sunDir.z))
        ambEff += 8 + 10 * opts.sunElev; // direct sun beats down
      const room = world.roomInfo(x, y, z);
      if (room.sealed) {
        if (room.regulators * REGULATOR_ROOM_MAX >= room.size) { ambEff = 36.6; shelter = 1; }
        else { ambEff = amb0; if (!deep) shelter = 0; } // "walls don't insulate" is a Ship rule; underground, the rock itself shelters you
      }
      return { R, openSky, shelter, ambEff, room, deep };
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
    // Sandstorm: a slow regime that amplifies whatever the open air already
    // is — a scorching noon becomes murderous, a freezing night bites harder.
    // Walls, caves and sealed shade ride it out untouched.
    const stormTarget = this.stormAt(opts.tSec);
    this.storm += (stormTarget - this.storm) * Math.min(1, dt * 0.08);
    // effective storm on the body: a Breaker's calm zeroes every storm term;
    // Chitin armour quarters what's left. The visible storm (this.storm) is raw.
    const storm = opts.stormShield ? 0 : this.storm * opts.stormMul;
    if (storm > 0.02 && !here.deep && here.shelter < 0.6)
      ambEff = 36.6 + (ambEff - 36.6) * (1 + 0.35 * storm);
    this.lastRoom = room;
    this.regulatedAir = room.sealed && room.regulators * REGULATOR_ROOM_MAX >= room.size;
    if (opts.inWater) {
      // desert water is cold: it pulls hard against midday heat, and is a little
      // kinder than freezing night air — the average of air and water temperature
      const wt = THREE.MathUtils.clamp(amb, 12, 24) - 3;
      ambEff = (ambEff + wt) / 2;
    }
    // a campfire at your back — but a room its Regulators hold at neutral
    // stays neutral: the fire never pushes regulated air off 37 °C
    if (opts.warmth && !this.regulatedAir) ambEff += opts.warmth;
    // body always regulates toward 36.6; exposure pulls it toward the effective air temp.
    // A worn Body Heat Regulator short-circuits that: while its Coolant Cell lasts,
    // the body just holds at 36.6 no matter the air. It regulates you, never the room.
    const target = opts.regulator ? 36.6 : 36.6 + (ambEff - 36.6) * (1 - shelter);
    this.lastAmbient = here.deep ? CAVE_AMBIENT : amb; this.lastAmbientEff = ambEff; this.lastShelterR = here.R; this.lastTarget = target;

    // sealed air moves the body fast — a hot room cooks you in minutes, and so does a cold one
    const k = room.sealed ? 0.022 : 0.0075; // tau ~45 s inside, ~2 min out in the open
    this.body += (target - this.body) * k * dt;
    this.body = THREE.MathUtils.clamp(this.body, 12, 44.5);

    // Water drain: ~1.5 days per full bar, plus sweat / sprint / overencumbrance
    let drain = 100 / (DAY_SECONDS * 1.5);
    if (this.body > 37) drain += (this.body - 37) * 0.02;
    if (opts.sprinting) drain *= 1.7;
    if (opts.overencumbered) drain += 0.05;
    if (storm > 0.05 && here.shelter < 0.8) drain *= 1 + 0.7 * storm; // the wind drinks you
    this.water = Math.max(0, this.water - drain * dt);

    // Damage — penalties are gentle: dying takes sustained, deep exposure.
    // Regulated air never hurts: while the room's Regulators hold it neutral,
    // hot/cold damage is skipped outright — the body only drifts toward neutral.
    if (!this.regulatedAir) {
      if (this.body > HOT_LIMIT) this.hurt((this.body - HOT_LIMIT) * 0.15, "heat stroke");
      if (this.body < COLD_LIMIT) this.hurt((COLD_LIMIT - this.body) * 0.175, "hypothermia");
    }
    if (this.water <= 0) this.hurt(0.3, "dehydration");
    else if (this.water < WATER_LIMIT) this.hurt((WATER_LIMIT - this.water) * 0.0375, "dehydration");
    // full-strength storm on bare ground: endless scouring — a cut-short visit, not a killer
    if (storm > 0.35 && here.openSky) this.hurt((storm - 0.35) * 0.55 * dt, "sand blast");

    // Regen: only when Water AND Heat are in their zones
    if (this.water > 25 && this.body >= SAFE_LO && this.body <= SAFE_HI && this.health > 0)
      this.health = Math.min(100, this.health + 0.25 * dt);

    this.vision = THREE.MathUtils.clamp((28 - this.water) / 28, 0, 1);
  }

  /** Standalone air temperature at one cell (same model as update's cellAir) — used by crops. */
  airTempAt(world: World, x: number, y: number, z: number, tSec: number): number {
    const frac = this.worldTimeToDayFrac(tSec);
    const amb = this.ambient(0, frac, tSec);
    let ambEff = amb;
    const a = (frac - 0.25) * Math.PI * 2, elev = Math.sin(a); // same sun arc the renderer draws
    if (elev > 0) {
      const inv = 1 / Math.hypot(Math.cos(a), elev, 0.4);
      if (world.sunVisible(x, y, z, Math.cos(a) * inv, elev * inv, 0.4 * inv)) ambEff += 8 + 10 * elev;
    }
    const room = world.roomInfo(x, y, z);
    if (room.sealed) ambEff = room.regulators * REGULATOR_ROOM_MAX >= room.size ? 36.6 : amb;
    return ambEff;
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
    this.surgeCooldown = 5;
    return "ok";
  }

  drink() {
    this.water = Math.min(100, this.water + 25);
    // cool water straight into the gut knocks body temp down only a little
    if (this.body > 34) this.body = Math.max(34, this.body - Math.min(0.7, this.body - 33.7));
  }

  reset() { this.health = 100; this.water = 100; this.body = 36.6; this.causeOfDeath = null; }
}
