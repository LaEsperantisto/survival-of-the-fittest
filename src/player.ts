import * as THREE from "three";
import { World } from "./world";
import { isSolid, WATER } from "./blocks";

const W = 0.6, H = 1.8, EYE = 1.62;

export class Player {
  pos = new THREE.Vector3(0.5, 31.01, 2.5); // feet center; inside ship, beside beacon
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = false;
  sprinting = false;
  inWater = false;    // body touches water at feet or waist (checked at both)
  headUnder = false;

  constructor(private world: World) {}

  private waterAt(dy: number): boolean {
    return this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + dy), Math.floor(this.pos.z)) === WATER;
  }

  private collides(x: number, y: number, z: number): boolean {
    const x0 = Math.floor(x - W / 2), x1 = Math.floor(x + W / 2);
    const z0 = Math.floor(z - W / 2), z1 = Math.floor(z + W / 2);
    const y0 = Math.floor(y), y1 = Math.floor(y + H - 0.001);
    for (let bx = x0; bx <= x1; bx++)
      for (let bz = z0; bz <= z1; bz++)
        for (let by = y0; by <= y1; by++)
          if (isSolid(this.world.get(bx, by, bz))) return true;
    return false;
  }

  /** move & collide; returns true if a collision stopped horizontal motion this axis-step */
  update(dt: number, moveX: number, moveZ: number, jump: boolean, speedMul: number, slow: boolean) {
    this.inWater = this.waterAt(0.1) || this.waterAt(1.0);
    this.headUnder = this.waterAt(EYE);
    const swim = this.inWater;
    const speed = (this.sprinting ? 7.2 : 4.5) * speedMul * (slow ? 0.25 : 1) * (swim ? 0.55 : 1);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));
    if (wish.lengthSq() > 1) wish.normalize();
    const accel = this.onGround ? 40 : swim ? 12 : 8;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    if (swim) {
      // water: weak sink + buoyancy, Space swims up; no jump impulse needed to leave
      this.vel.y -= 6 * dt;
      if (this.headUnder) this.vel.y += 9 * dt;
      if (jump) this.vel.y += 22 * dt;
      this.vel.y = THREE.MathUtils.clamp(this.vel.y, -2.2, 3.4);
      this.vel.y *= 1 - Math.min(0.9, 2.2 * dt);
    } else {
      this.vel.y -= 24 * dt;
      if (jump && this.onGround) { this.vel.y = 8.2; this.onGround = false; }
    }

    this.moveAxis(this.vel.x * dt, 0);
    this.moveAxis(this.vel.z * dt, 2);
    this.moveAxis(this.vel.y * dt, 1);

    // fell out of world failsafe
    if (this.pos.y < -5) { this.pos.set(0, 40, 0); this.vel.set(0, 0, 0); }
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
        if (step < 0) this.onGround = true;
        this.vel.y = 0;
      } else if (axis === 0) this.vel.x *= 0.25;
      else this.vel.z *= 0.25;
      return;
    }
    if (axis === 1 && d !== 0) this.onGround = false;
  }

  eye(): THREE.Vector3 { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }
}
