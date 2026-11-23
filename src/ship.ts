/**
 * The Ship as a real entity (Phase 1 flight, FUTURE_IDEAS.md Step C/D/P2).
 *
 * A Ship is a floating polycube: its blocks live ONLY in `cells`, keyed by
 * ship-local integer coordinates — they are never written back into world
 * chunks, even while grounded. Membership is the Ship Frame: the union of
 * cuboids declared by Frame Corner cells (shipframe.ts), always ship-local,
 * so a yaw turn never changes membership.
 *
 * pos is the yaw pivot (the Frame bbox centre at takeoff) and follows a
 * continuous flight path. While airborne the Ship flies and turns as a
 * whole: the mesh, collision and cell lookups all use the live pose and
 * yaw, so the Ship feels like an object, not a stamp. Only on landing is
 * the pose snapped — heading to a right angle, position to the block
 * lattice — and only then are cells written back to the world grid.
 * There is no pitch or roll: the Ship flies flat.
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
  yawRate: (25 * Math.PI) / 180, // ~25°/s at the controls
  /** smooth-landing spin: the hull settles to the nearest right angle at this rate */
  settleRate: (40 * Math.PI) / 180,
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

/** exact hull hit from Ship.rayHit: the local cell, the entered face (local
 *  normal), and the ray distance (identical in world and ship space) */
export interface ShipHit {
  ix: number;
  iy: number;
  iz: number;
  face: [number, number, number];
  t: number;
  id: number;
}

export const skey = (ix: number, iy: number, iz: number): string => keyOf(ix, iy, iz);

/** One Engine Core fuel port (ADR-0012): 0 empty, 1 Rocket Fuel,
 * 2 Super Rocket Fuel. A Super port NEVER burns — Leave Planet spends it.
 * `c` is charges left; `l` locks the moment the engines first drink from
 * the canister, and only an untouched canister ever comes back out. */
export interface Port { k: 0 | 1 | 2; c: number; l: boolean }
export const emptyPort = (): Port => ({ k: 0, c: 0, l: false });
/** flight-readout currency: the sum of Rocket charges only */
export const rocketCharges = (fuel: readonly Port[]): number =>
  fuel.reduce((a, pt) => a + (pt.k === 1 ? pt.c : 0), 0);
/** pre-Port saves stored ports as bare charge numbers: a non-zero port is
 * one the engines already drank from — full-grade Rocket Fuel, locked. */
export function migratePorts(raw: (number | Port)[] | null | undefined): [Port, Port] {
  const out: [Port, Port] = [emptyPort(), emptyPort()];
  for (let i = 0; i < 2; i++) {
    const e = raw?.[i];
    if (typeof e === "number") out[i] = e > 0 ? { k: 1, c: e, l: true } : emptyPort();
    else if (e && typeof e === "object")
      out[i] = { k: e.k === 1 || e.k === 2 ? e.k : 0, c: Math.max(0, e.c || 0), l: !!e.l };
  }
  return out;
}

export interface ShipSnapshot {
  id: number;
  pos: { x: number; y: number; z: number };
  yaw: number;
  fwd?: number;
  vel: { x: number; y: number; z: number };
  grounded: boolean;
  fuel: Port[] | number[]; // legacy saves hold bare charge numbers
  cells: [string, ShipCell][];
}

export function massOf(id: number): number {
  if (id === THRUSTER || id === THRUSTER_LIT) return SHIP.thrusterMass;
  return SHIP.defaultMass;
}

/** local forward vectors by facing index: 0 -Z, 1 -X, 2 +Z, 3 +X */
export const FWD_DIR: [number, number][] = [[0, -1], [-1, 0], [0, 1], [1, 0]];

export class Ship {
  cells = new Map<string, ShipCell>();
  /** world position of the Frame bbox centre (yaw pivot) */
  pos = { x: 0, y: 0, z: 0 };
  yaw = 0;
  /** "forward" for thrust: a FWD_DIR index picked from the pilot's facing
   *  at takeoff, fixed to the hull (it turns with the Ship) */
  fwd = 0;
  vel = { x: 0, y: 0, z: 0 };
  grounded = true;
  /** the two Engine Core fuel ports: Rocket burns, Super waits for the leap */
  fuel: [Port, Port] = [emptyPort(), emptyPort()];
  /** last frame's pose, so riding entities can follow the delta */
  prevPos = { x: 0, y: 0, z: 0 };
  prevYaw = 0;
  /** smooth landing: while set, the hull is turning to this yaw before
   *  its cells are written back to the lattice; not saved */
  spinTo: number | null = null;
  private bbox: Box3 | null = null;
  private shell: Set<string> | null = null;

  /** flight ceiling is this planet's playable sky (ADR-0011): the Ship that
   *  flies over Silvaris climbs far higher than the one over Desertis. */
  get ceiling(): number { return this.worldH + 32; }

  constructor(public id: number, public worldH = CH) {}

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
    return [(b.min[0] + b.max[0] + 1) / 2, (b.min[1] + b.max[1] + 1) / 2, (b.min[2] + b.max[2] + 1) / 2];
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

  /** world cell containing the local cell (exact at a landing-snap pose;
   *  cell-centre map mid-flight — the honest quantisation of a turning
   *  polycube onto the world grid) */
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

  /** A point solid in this hull's real geometry (no lattice quantisation):
   *  the world point is mapped ship-local and lands in its true cell under
   *  any yaw. Used by continuous player physics. */
  solidAt(x: number, y: number, z: number): boolean {
    const c = this.cellAtWorld(x, y, z);
    if (!c) return false;
    const { isSolid: solid } = require_isSolid();
    return solid(c.id);
  }

  /** Does an axis-aligned world box (a walking player's AABB) meet any solid
   *  cell of this hull — exactly, with no lattice quantisation? The box is
   *  mapped into ship space, where it becomes a square canted by -yaw and
   *  every cell stays a unit cube: separating-axis test along the local x/z
   *  axes (the cell's faces) and the canted box's own face normals. Yaw
   *  leaves y alone, so the vertical interval stays exact. */
  hitsBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    const box = this.getBox();
    if (!box) return false;
    const c = this.centerLocal();
    const ly0 = c[1] + (y0 - this.pos.y), ly1 = c[1] + (y1 - this.pos.y);
    if (ly1 <= box.min[1] || ly0 >= box.max[1] + 1) return false;
    const iy0 = Math.max(box.min[1], Math.floor(ly0));
    const iy1 = Math.min(box.max[1], Math.floor(ly1 - 1e-9));
    if (iy1 < iy0) return false;
    const [cos, sin] = this.rot();
    // the box's half-edge vectors, in ship space
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const ax = cos * hx, az = sin * hx; // world +x → local (cos·hx, sin·hx)
    const bx = -sin * hz, bz = cos * hz; // world +z → local (−sin·hz, cos·hz)
    const p = this.worldToLocal((x0 + x1) / 2, 0, (z0 + z1) / 2);
    // cells the canted box can possibly touch
    const ex = Math.abs(ax) + Math.abs(bx), ez = Math.abs(az) + Math.abs(bz);
    const { isSolid: solid } = require_isSolid();
    for (let ix = Math.floor(p.x - ex); ix <= Math.ceil(p.x + ex); ix++)
      for (let iz = Math.floor(p.z - ez); iz <= Math.ceil(p.z + ez); iz++)
        for (let iy = iy0; iy <= iy1; iy++) {
          const cell = this.getCell(ix, iy, iz);
          if (!cell || !solid(cell.id)) continue;
          if (iy + 1 <= ly0 || iy >= ly1) continue; // vertical intervals, exact
          const dx = p.x - (ix + 0.5), dz = p.z - (iz + 0.5);
          if (Math.abs(dx) > Math.abs(ax) + Math.abs(bx) + 0.5) continue; // local x axis
          if (Math.abs(dz) > Math.abs(az) + Math.abs(bz) + 0.5) continue; // local z axis
          if (Math.abs(dx * az - dz * ax) > Math.abs(bx * az - bz * ax) + 0.5 * (Math.abs(az) + Math.abs(ax))) continue;
          if (Math.abs(dx * bz - dz * bx) > Math.abs(ax * bz - az * bx) + 0.5 * (Math.abs(bz) + Math.abs(bx))) continue;
          return true;
        }
    return false;
  }

  /** Raycast the hull as a solid polycube: the ray is mapped into ship-local
   *  space (a rigid turn, so ray distances are unchanged) and DDA'd against
   *  the cell grid. Exact at any yaw — this is what the crosshair hits, so
   *  the block you aim at is the block you get, turned or not. `face` is the
   *  ship-local normal of the entered face. */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): ShipHit | null {
    const box = this.getBox();
    if (!box) return null;
    const [cos, sin] = this.rot();
    const o = this.worldToLocal(ox, oy, oz);
    const ldx = cos * dx - sin * dz, ldy = dy, ldz = sin * dx + cos * dz;
    // broad phase: slab-test the cell bbox so most ships cost a few flops
    let tin = 0, tout = maxDist;
    const slabs: [number, number, number, number][] = [
      [o.x, ldx, box.min[0], box.max[0] + 1],
      [o.y, ldy, box.min[1], box.max[1] + 1],
      [o.z, ldz, box.min[2], box.max[2] + 1],
    ];
    for (const [p, d, mn, mx] of slabs) {
      if (d === 0) { if (p < mn || p >= mx) return null; continue; }
      let a = (mn - p) / d, b = (mx - p) / d;
      if (a > b) { const t0 = a; a = b; b = t0; }
      if (a > tin) tin = a;
      if (b < tout) tout = b;
      if (tin > tout) return null;
    }
    if (tout <= 0) return null;
    // start the lattice walk just inside the bbox entry point
    const s = tin + 1e-6;
    let x = Math.floor(o.x + ldx * s), y = Math.floor(o.y + ldy * s), z = Math.floor(o.z + ldz * s);
    const stx = Math.sign(ldx), sty = Math.sign(ldy), stz = Math.sign(ldz);
    const td = (d: number) => (d !== 0 ? Math.abs(1 / d) : Infinity);
    const tDx = td(ldx), tDy = td(ldy), tDz = td(ldz);
    const toBoundary = (v: number, st: number) =>
      st > 0 ? (Math.ceil(v) - v || 1) : st < 0 ? (v - Math.floor(v) || 1) : Infinity;
    let tmx = tin + toBoundary(o.x + ldx * s, stx) * tDx,
      tmy = tin + toBoundary(o.y + ldy * s, sty) * tDy,
      tmz = tin + toBoundary(o.z + ldz * s, stz) * tDz;
    let entered = tin;
    let face: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 128; i++) {
      const c = this.getCell(x, y, z);
      if (c && c.id !== AIR) return { ix: x, iy: y, iz: z, face, t: entered, id: c.id };
      if (tmx < tmy && tmx < tmz) { face = [-stx, 0, 0]; x += stx; entered = tmx; tmx += tDx; }
      else if (tmy < tmz) { face = [0, -sty, 0]; y += sty; entered = tmy; tmy += tDy; }
      else { face = [0, 0, -stz]; z += stz; entered = tmz; tmz += tDz; }
      if (entered > tout) return null;
    }
    return null;
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
    return rocketCharges(this.fuel);
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
      id: this.id, pos: { ...this.pos }, yaw: this.yaw, fwd: this.fwd,
      vel: { ...this.vel }, grounded: this.grounded, fuel: this.fuel.map((pt) => ({ ...pt })),
      cells: [...this.cells.entries()],
    };
  }

  static restore(s: ShipSnapshot, worldH = CH): Ship {
    const sh = new Ship(s.id, worldH);
    sh.pos = { ...s.pos };
    sh.yaw = s.yaw;
    sh.fwd = ((s.fwd ?? 0) % 4 + 4) % 4;
    sh.vel = { ...s.vel };
    sh.grounded = s.grounded;
    sh.fuel = migratePorts(s.fuel);
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
