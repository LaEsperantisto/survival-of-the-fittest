import * as THREE from "three";
import { World } from "./world";
import { DAY_SECONDS } from "./blocks";
import { noise1 } from "./noise";

export const BODY_MIN = 20, BODY_MAX = 45;     // heat bar display range (°C body)
export const SAFE_LO = 36.0, SAFE_HI = 37.5;   // safe body temperature zone

const AMBIENT_MEAN = 21, AMBIENT_AMP = 26;     // 24-min desert day: ~-5 night, ~+47 peak
export const REGULATOR_ROOM_MAX = 50;          // largest sealed room (open cells) a Heat Regulator can hold

export class Survival {
  health = 100; water = 100; body = 36.6;
  causeOfDeath: string | null = null;
  vision = 0; // 0 fine .. 1 worst (low-water visual)
  lastAmbient = 0; lastShelterR = 0; lastTarget = 36.6; lastOpenSky = false;

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
    const frac = this.worldTimeToDayFrac(opts.tSec);
    const amb = this.ambient(opts.biome, frac, opts.tSec);
    const { R, openSky } = world.skyResistance(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    this.lastOpenSky = openSky;
    const shelter = 1 - Math.exp(-R);          // 0 exposed .. ~0.997 sealed
    let ambEff = amb;
    if (openSky && opts.sunElev > 0) ambEff += 8 + 10 * opts.sunElev; // direct sun beats down, even when the air is mild
    // A Heat Regulator in a small sealed room holds it at body-neutral temperature.
    const room = world.roomInfo(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    if (room.hasRegulator && room.sealed && room.size <= REGULATOR_ROOM_MAX) ambEff = 36.6;
    if (opts.inWater) {
      // desert water is cold: it pulls hard against midday heat, and is a little
      // kinder than freezing night air — the average of air and water temperature
      const wt = THREE.MathUtils.clamp(amb, 12, 24) - 3;
      ambEff = (ambEff + wt) / 2;
    }
    // body always regulates toward 36.6; exposure pulls it toward the effective air temp
    const target = 36.6 + (ambEff - 36.6) * (1 - shelter);
    this.lastAmbient = amb; this.lastShelterR = R; this.lastTarget = target;

    const k = 0.0032; // body drifts toward target, τ ≈ 5 min
    this.body += (target - this.body) * k * dt;
    this.body = THREE.MathUtils.clamp(this.body, 12, 44.5);

    // Water drain: ~1.5 days per full bar, plus sweat / sprint / overencumbrance
    let drain = 100 / (DAY_SECONDS * 1.5);
    if (this.body > 37) drain += (this.body - 37) * 0.02;
    if (opts.sprinting) drain *= 1.7;
    if (opts.overencumbered) drain += 0.05;
    this.water = Math.max(0, this.water - drain * dt);

    // Damage
    if (this.body > 39.5) this.hurt((this.body - 39.5) * 0.6, "heat stroke");
    if (this.body < 31.5) this.hurt((31.5 - this.body) * 0.7, "hypothermia");
    if (this.water <= 0) this.hurt(1.2, "dehydration");
    else if (this.water < 5) this.hurt((5 - this.water) * 0.15, "dehydration");

    // Regen: only when Water AND Heat are in their zones
    if (this.water > 25 && this.body >= SAFE_LO && this.body <= SAFE_HI && this.health > 0)
      this.health = Math.min(100, this.health + 0.25 * dt);

    this.vision = THREE.MathUtils.clamp((28 - this.water) / 28, 0, 1);
  }

  hurt(amount: number, cause: string) {
    if (this.health <= 0) return;
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.causeOfDeath = cause; }
  }

  drink() {
    this.water = Math.min(100, this.water + 25);
    // cool water straight into the gut knocks body temp down, hard, fast
    if (this.body > 34) this.body = Math.max(34, this.body - Math.min(3.5, this.body - 33.5));
  }

  reset() { this.health = 100; this.water = 100; this.body = 36.6; this.causeOfDeath = null; }
}
