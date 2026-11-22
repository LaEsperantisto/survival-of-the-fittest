/**
 * The Ship as a real entity (Phase 1 flight, FUTURE_IDEAS.md Step C/D/P2).
 *
 * A Ship is a floating polycube: its blocks live ONLY in `cells`, keyed by
 * ship-local integer coordinates — they are never written back into world
 * chunks, even while grounded. Membership is the Ship Frame: the union of
 * cuboids declared by Frame Corner cells (shipframe.ts), always ship-local,
 * so a yaw turn never changes membership.
 *
 * pos is the world position of the Frame bbox centre (the yaw pivot). With
 * yaw = 0 the local origin sits at (pos − bbox centre). Block geometry only
 * ever rotates in yaw for collision and occupancy — there is no pitch or
 * roll: the Ship flies flat, and landings snap the heading to a right angle.
 */

import { AIR, CH, THRUSTER, THRUSTER_LIT, ENGINECORE, FRAME_CORNER, FLIGHT_CONTROLS } from "./blocks";
import { computeFrame, boxesOverlap, keyOf, type Box3, type FrameResult } from "./shipframe";

export const SHIP = {
  /** every block weighs 1 unless listed (dense families cost more) */
  defaultMass: 1,
  thrusterMass: 22,
  /** one lit Thruster lifts this many blocks */
  liftCapacity: 250,
  /** flight envelope, P1 numbers */
  speed: 10,          // m/s horizontal at full thrust
  climb: 4,           // m/s
  ceiling: CH,        // world height
  yawRate: (25 * Math.PI) / 180, // ~25°/s at the controls
  /** one Rocket Fuel Canister banks this many charges; ~1 canister per
   *  2 flight-minutes at 4 lit Thrusters */
  canisterCharges: 60,
  fuelPorts: 2,
  /** per lit Thruster per second at full burn */
  burnPerThruster: 60 / (120 * 4),
  /** fuel-grade hook: future grades multiply speed and burn */
  fuelGrade: 1,
  /** an uncrewed Ship drifts down at this speed; over-mass sinks similarly */
  sinkSpeed: 2,
};

export interface ShipCell {
  id: number;
  rot: number;
}

export const skey = (ix: number, iy: number, iz: number): string => keyOf(ix, iy, iz);

export interface ShipSnapshot {
  id: number;
  pos: { x: number; y: number; z: number };
  yaw: number;
  vel: { x: number; y: number; z: number };
  grounded: boolean;
  fuel: number[];
  cells: [string, ShipCell][];
}

export function massOf(id: number): number {
  if (id === THRUSTER || id === THRUSTER_LIT) return SHIP.thrusterMass;
  return SHIP.defaultMass;
}

export class Ship {
  cells = new Map<string, ShipCell>();
  /** world position of the Frame bbox centre (yaw pivot) */
  pos = { x: 0, y: 0, z: 0 };
  yaw = 0;
  vel = { x: 0, y: 0, z: 0 };
  grounded = true;
  /** the two Engine Core Rocket Fuel ports, in charges */
  fuel: number[] = [0, 0];
  /** last frame's pose, so riding entities can follow the delta */
  prevPos = { x: 0, y: 0, z: 0 };
  prevYaw = 0;
  private bbox: Box3 | null = null;
  private shell: Set<string> | null = null;

  constructor(public id: number) {}

  getCell(ix: number, iy: number, iz: number): ShipCell | undefined {
    return this.cells.get(skey(ix, iy, iz));
  }
  /** CellProvider (renderer.ts): local-coord reads for hull meshing. */
  get(ix: number, iy: number, iz: number): number { return this.getCell(ix, iy, iz)?.id ?? AIR; }
  getRot(ix: number, iy: number, iz: number): number { return this.getCell(ix, iy, iz)?.rot ?? 0; }
  setCell(ix: number, iy: number, iz: number, id: number, rot = 0) {
    this.cells.set(skey(ix, iy, iz), { id, rot });
    this.bbox = null;
    this.shell = null;
    this.aabb = null;
  }
  deleteCell(ix: number, iy: number, iz: number) {
    if (this.cells.delete(skey(ix, iy, iz))) {
      this.bbox = null;
      this.shell = null;
      this.aabb = null;
    }
  }

  /** local bbox of every block cell (null when empty) */
  getBox(): Box3 | null {
    if (this.bbox) return this.bbox;
    if (!this.cells.size) return (this.bbox = null);
    let mn: [number, number, number] = [Infinity, Infinity, Infinity];
    let mx: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const k of this.cells.keys()) {
      const p = k.split(",").map(Number);
      for (let a = 0; a < 3; a++) {
        if (p[a] < mn[a]) mn[a] = p[a];
        if (p[a] > mx[a]) mx[a] = p[a];
      }
    }
    return (this.bbox = { min: mn, max: mx });
  }

  /** centre of the block bbox in LOCAL coords (yaw pivot offset) */
  centerLocal(): [number, number, number] {
    const b = this.getBox();
    if (!b) return [0, 0, 0];
    return [(b.min[0] + b.max[0] + 1) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2] + 1) / 2];
  }

  private rotYaw = NaN;
  private rotC = 0;
  private rotS = 0;
  rot(): [number, number] {
    if (this.rotYaw === this.yaw) return [this.rotC, this.rotS];
    // at right-angle headings (the landing snap) cos/sin must be exactly
    // 0 and ±1, or cell maps drift by a cell
    let cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    if (Math.abs(cos) < 1e-9) cos = 0; else if (Math.abs(cos - 1) < 1e-9) cos = 1; else if (Math.abs(cos + 1) < 1e-9) cos = -1;
    if (Math.abs(sin) < 1e-9) sin = 0; else if (Math.abs(sin - 1) < 1e-9) sin = 1; else if (Math.abs(sin + 1) < 1e-9) sin = -1;
    this.rotYaw = this.yaw; this.rotC = cos; this.rotS = sin;
    return [cos, sin];
  }

  localToWorld(ix: number, iy: number, iz: number): { x: number; y: number; z: number } {
    const c = this.centerLocal();
    const dx = ix - c[0], dy = iy - c[1], dz = iz - c[2];
    const [cos, sin] = this.rot();
    return {
      x: this.pos.x + cos * dx + sin * dz,
      y: this.pos.y + dy,
      z: this.pos.z - sin * dx + cos * dz,
    };
  }

  worldToLocal(x: number, y: number, z: number): { x: number; y: number; z: number } {
    const c = this.centerLocal();
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
    const [cos, sin] = this.rot();
    return {
      x: c[0] + cos * dx - sin * dz,
      y: c[1] + dy,
      z: c[2] + sin * dx + cos * dz,
    };
  }

  /** world cell containing the local cell (exact at yaw 0; cell-centre map
   *  otherwise — good enough for a soft-stop polycube) */
  cellToWorld(ix: number, iy: number, iz: number): [number, number, number] {
    const w = this.localToWorld(ix + 0.5, iy + 0.5, iz + 0.5);
    return [Math.floor(w.x), Math.floor(w.y), Math.floor(w.z)];
  }

  /** local cell holding a world point */
  cellAtWorld(x: number, y: number, z: number): ShipCell | undefined {
    const [cos, sin] = this.rot();
    const c = this.centerLocal();
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
    return this.getCell(
      Math.floor(c[0] + cos * dx - sin * dz),
      Math.floor(c[1] + dy),
      Math.floor(c[2] + sin * dx + cos * dz),
    );
  }

  isSolid(x: number, y: number, z: number): boolean {
    const c = this.cellAtWorld(x, y, z);
    if (!c) return false;
    // doors and other groups: reuse the block table's own solidity
    const { isSolid: solid } = require_isSolid();
    return solid(c.id);
  }

  /** the Ship Frame declared by this Ship's own corners */
  private frameCacheKey: string | null = null;
  private frameCache: FrameResult | null = null;
  frame(): FrameResult {
    let key = "";
    const corners: string[] = [];
    for (const [k, c] of this.cells) if (c.id === FRAME_CORNER) { corners.push(k); key += k + ";"; }
    if (this.frameCache && key === this.frameCacheKey) return this.frameCache;
    return (this.frameCache = computeFrame(corners), this.frameCacheKey = key, this.frameCache);
  }

  /** world-space Frame cuboids (for the outline and the overlap rule) */
  frameWorld(): Box3[] {
    return this.frame().cuboids.map((b) => {
      const lo = this.localToWorld(b.min[0], b.min[1], b.min[2]);
      const hi = this.localToWorld(b.max[0] + 1, b.max[1] + 1, b.max[2] + 1);
      const mn: [number, number, number] = [Infinity, Infinity, Infinity];
      const mx: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (const p of [lo, hi])
        for (const [a, v] of [["x", p.x], ["y", p.y], ["z", p.z]] as const) {
          const i = a === "x" ? 0 : a === "y" ? 1 : 2;
          if (v < mn[i]) mn[i] = v;
          if (v > mx[i]) mx[i] = v;
        }
      return { min: mn, max: mx };
    });
  }

  /** Does the (world) cell sit inside the claimed Frame volume? */
  claimsLocal(ix: number, iy: number, iz: number): boolean {
    const f = this.frame();
    if (f.errors.length) {
      // an invalid Frame still claims its bbox while grounded so nothing of
      // the wreck leaks out; while airborne an invalid frame cannot exist
      const b = f.bbox;
      return !!b && ix >= b.min[0] && ix <= b.max[0] && iy >= b.min[1] && iy <= b.max[1] && iz >= b.min[2] && iz <= b.max[2];
    }
    for (const c of f.cuboids)
      if (ix >= c.min[0] && ix <= c.max[0] && iy >= c.min[1] && iy <= c.max[1] && iz >= c.min[2] && iz <= c.max[2])
        return true;
    return false;
  }

  /** world AABB of all block cells (cheap broad phase); cached per pose+cells,
   *  because World's cellProvider consults it on every cell read */
  private aabbKey: [number, number, number, number] | null = null;
  private aabb: Box3 | null = null;
  worldAABB(): Box3 {
    const b = this.getBox();
    if (this.aabb && this.aabbKey && this.aabbKey[0] === this.pos.x && this.aabbKey[1] === this.pos.y &&
        this.aabbKey[2] === this.pos.z && this.aabbKey[3] === this.yaw) return this.aabb;
    this.aabbKey = [this.pos.x, this.pos.y, this.pos.z, this.yaw];
    if (!b) return (this.aabb = { min: [this.pos.x, this.pos.y, this.pos.z], max: [this.pos.x, this.pos.y, this.pos.z] });
    const pts = [
      this.localToWorld(b.min[0], b.min[1], b.min[2]),
      this.localToWorld(b.max[0] + 1, b.min[1], b.min[2]),
      this.localToWorld(b.min[0], b.max[1] + 1, b.min[2]),
      this.localToWorld(b.max[0] + 1, b.max[1] + 1, b.max[2] + 1),
    ];
    const mn: [number, number, number] = [Infinity, Infinity, Infinity];
    const mx: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) {
      mn[0] = Math.min(mn[0], p.x); mx[0] = Math.max(mx[0], p.x);
      mn[1] = Math.min(mn[1], p.y); mx[1] = Math.max(mx[1], p.y);
      mn[2] = Math.min(mn[2], p.z); mx[2] = Math.max(mx[2], p.z);
    }
    return (this.aabb = { min: mn, max: mx });
  }

  mass(): number {
    let m = 0;
    for (const c of this.cells.values()) m += massOf(c.id);
    return m;
  }

  thrusters(): { ix: number; iy: number; iz: number; cell: ShipCell }[] {
    const out: { ix: number; iy: number; iz: number; cell: ShipCell }[] = [];
    for (const [k, cell] of this.cells) {
      if (cell.id !== THRUSTER && cell.id !== THRUSTER_LIT) continue;
      const [ix, iy, iz] = k.split(",").map(Number);
      out.push({ ix, iy, iz, cell });
    }
    return out;
  }

  capacity(): number {
    // installed Thrusters lift; a Broken (uninstalled) Thruster is dead weight
    let n = 0;
    for (const c of this.cells.values()) if (c.id === THRUSTER_LIT) n++;
    return n * SHIP.liftCapacity;
  }

  engineCore(): [number, number, number] | null {
    for (const [k] of this.cells) {
      const [ix, iy, iz] = k.split(",").map(Number);
      if (this.getCell(ix, iy, iz)!.id === ENGINECORE) return [ix, iy, iz];
    }
    return null;
  }

  controls(): [number, number, number] | null {
    for (const [k, c] of this.cells) {
      if (c.id !== FLIGHT_CONTROLS) continue;
      const [ix, iy, iz] = k.split(",").map(Number);
      return [ix, iy, iz];
    }
    return null;
  }

  fuelTotal(): number {
    return this.fuel.reduce((a, b) => a + b, 0);
  }

  /** cells with at least one empty face — the only cells that can touch the
   *  world; collision sampling walks these, never the whole interior */
  shellCells(): [number, number, number][] {
    if (!this.shell) {
      const s = new Set<string>();
      for (const k of this.cells.keys()) {
        const [ix, iy, iz] = k.split(",").map(Number);
        const open =
          !this.cells.has(skey(ix + 1, iy, iz)) || !this.cells.has(skey(ix - 1, iy, iz)) ||
          !this.cells.has(skey(ix, iy + 1, iz)) || !this.cells.has(skey(ix, iy - 1, iz)) ||
          !this.cells.has(skey(ix, iy, iz + 1)) || !this.cells.has(skey(ix, iy, iz - 1));
        if (open) s.add(k);
      }
      this.shell = s;
    }
    return [...this.shell].map((k) => k.split(",").map(Number) as [number, number, number]);
  }

  snapshot(): ShipSnapshot {
    return {
      id: this.id, pos: { ...this.pos }, yaw: this.yaw,
      vel: { ...this.vel }, grounded: this.grounded, fuel: [...this.fuel],
      cells: [...this.cells.entries()],
    };
  }

  static restore(s: ShipSnapshot): Ship {
    const sh = new Ship(s.id);
    sh.pos = { ...s.pos };
    sh.yaw = s.yaw;
    sh.vel = { ...s.vel };
    sh.grounded = s.grounded;
    sh.fuel = (s.fuel ?? [0, 0]).slice(0, SHIP.fuelPorts);
    while (sh.fuel.length < SHIP.fuelPorts) sh.fuel.push(0);
    for (const [k, c] of s.cells) sh.cells.set(k, c);
    sh.prevPos = { ...sh.pos };
    sh.prevYaw = sh.yaw;
    return sh;
  }
}

// late-bound to dodge an import cycle only if one ever appears
import { isSolid as _isSolid } from "./blocks";
const require_isSolid = () => ({ isSolid: _isSolid });

/** overlap rule between two Frame volumes, both in the same coord space */
export function framesOverlapWorld(a: Box3[], b: Box3[]): boolean {
  for (const x of a) for (const y of b) if (boxesOverlap(x, y)) return true;
  return false;
}

/** enumerate every local cell claimed by a valid Frame (takeoff snapshot) */
export function frameCells(f: FrameResult): [number, number, number][] {
  const seen = new Set<string>();
  const out: [number, number, number][] = [];
  for (const c of f.cuboids) {
    for (let x = c.min[0]; x <= c.max[0]; x++)
      for (let y = c.min[1]; y <= c.max[1]; y++)
        for (let z = c.min[2]; z <= c.max[2]; z++) {
          const k = skey(x, y, z);
          if (!seen.has(k)) { seen.add(k); out.push([x, y, z]); }
        }
  }
  return out;
}

export const airCells = AIR; // re-export convenience for callers
