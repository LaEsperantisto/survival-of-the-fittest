import * as THREE from "three";
import { World, subBoxes } from "./world";
import { isSolid, isWater, waterStrength, ALAB_PILLAR, ALAB_FENCE, ALAB_GATE, ALAB_GATE_OPEN } from "./blocks";

const W = 0.6, H = 1.8, EYE = 1.62;
/** cells whose solid is a model, not a cube: collides against its boxes only,
 *  so you can lean into a fence rail or stand beside a pillar's shaft */
const SHAPE_SOLID = new Set([ALAB_PILLAR, ALAB_FENCE, ALAB_GATE, ALAB_GATE_OPEN]);

export class Player {
  pos = new THREE.Vector3(0.5, 31.01, 2.5); // feet center; inside ship, beside beacon
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = false;
  sprinting = false;
  inWater = false;    // body touches water at feet or waist (checked at both)
  headUnder = false;
  fallPeakY = this.pos.y; // highest point since last leaving the ground
  private prevJump = false; // edge-detect the jump press for the unstick eject
  lastFallDist = 0;       // metres of the fall that just landed (reset by the reader)

  constructor(private world: World) {}

  private waterAt(dy: number): boolean {
    const y = this.pos.y + dy;
    const by = Math.floor(y);
    const id = this.world.get(Math.floor(this.pos.x), by, Math.floor(this.pos.z));
    if (!isWater(id)) return false;
    // shallow flow only submerges up to its surface, level/8 of the cell
    return y - by < waterStrength(id) / 8;
  }

  private collides(x: number, y: number, z: number): boolean {
    const x0 = Math.floor(x - W / 2), x1 = Math.floor(x + W / 2);
    const z0 = Math.floor(z - W / 2), z1 = Math.floor(z + W / 2);
    const y0 = Math.floor(y), y1 = Math.floor(y + H - 0.001);
    for (let bx = x0; bx <= x1; bx++)
      for (let bz = z0; bz <= z1; bz++)
        for (let by = y0; by <= y1; by++) {
          const id = this.world.get(bx, by, bz);
          if (!isSolid(id)) continue;
          if (!SHAPE_SOLID.has(id)) return true;
          for (const b of subBoxes(this.world, id, bx, by, bz))
            if (x - W / 2 < b[3] && x + W / 2 > b[0] && y < b[4] && y + H > b[1] && z - W / 2 < b[5] && z + W / 2 > b[2])
              return true;
        }
    return false;
  }

  /** move & collide; returns true if a collision stopped horizontal motion this axis-step */
  update(dt: number, moveX: number, moveZ: number, jump: boolean, speedMul: number) {
    if (this.onGround) this.fallPeakY = this.pos.y;
    else if (this.pos.y > this.fallPeakY) this.fallPeakY = this.pos.y;
    this.inWater = this.waterAt(0.1) || this.waterAt(1.0);
    this.headUnder = this.waterAt(EYE);
    const swim = this.inWater;
    const speed = (this.sprinting ? 7.2 : 4.5) * speedMul * (swim ? 0.55 : 1);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));
    if (wish.lengthSq() > 1) wish.normalize();
    const accel = this.onGround ? 40 : swim ? 12 : 8;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    if (swim) {
      // water pulls you down — you sink unless you hold jump to swim up
      this.vel.y -= 7 * dt;
      if (jump) {
        if (this.onGround) { this.vel.y = 6.0; this.onGround = false; } // hop out of pools onto banks
        else this.vel.y += 22 * dt;
      }
      this.vel.y = THREE.MathUtils.clamp(this.vel.y, -3.2, 3.4);
      this.vel.y *= 1 - Math.min(0.9, 2.2 * dt);
    } else {
      this.vel.y -= 24 * dt;
      // trapped inside a block (a Ship settled on you, a misplaced wall):
      // an impulse is useless there — the collision zeroes it the same
      // frame. A jump press instead ejects you up past the cell your
      // feet stand in; press again if two blocks deep.
      const stuck = this.collides(this.pos.x, this.pos.y + 0.02, this.pos.z);
      if (jump && !this.prevJump && stuck) {
        this.pos.y = Math.floor(this.pos.y + 0.02) + 1;
        this.fallPeakY = this.pos.y;
        this.vel.y = 0;
        this.onGround = true;
      } else if (jump && this.onGround) {
        this.vel.y = 8.2;
        this.onGround = false;
      }
    }
    this.prevJump = jump;

    this.moveAxis(this.vel.x * dt, 0);
    this.moveAxis(this.vel.z * dt, 2);
    this.moveAxis(this.vel.y * dt, 1);

    // fell out of world failsafe
    if (this.pos.y < -5) { this.pos.set(0, 40, 0); this.vel.set(0, 0, 0); this.fallPeakY = 40; this.lastFallDist = 0; }
    if (this.pos.y <= 0.5 && Math.abs(this.pos.x) <= 24 && Math.abs(this.pos.z) <= 24 && this.vel.y <= 0)
      this.onGround = true;
  }

  private moveAxis(d: number, axis: 0 | 1 | 2) {
    if (d === 0) return;
    const p = this.pos;
    const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.3));
    const step = d / steps;
    for (let i = 0; i < steps; i++) {
      const nx = p.x + (axis === 0 ? step : 0);
      const ny = p.y + (axis === 1 ? step : 0);
      const nz = p.z + (axis === 2 ? step : 0);
      if (!this.collides(nx, ny, nz)) { p.set(nx, ny, nz); continue; }
      if (axis === 1) {
        if (step < 0) { this.lastFallDist = Math.max(0, this.fallPeakY - p.y); this.onGround = true; }
        this.vel.y = 0;
      } else if (axis === 0) this.vel.x *= 0.25;
      else this.vel.z *= 0.25;
      return;
    }
    if (axis === 1 && d !== 0) this.onGround = false;
  }

  eye(): THREE.Vector3 { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }
}
