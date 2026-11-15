import { AIR, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, REGULATOR, CS, CH, isOpaque, isWater, waterStrength, flowId } from "./blocks";
import { genChunk, Structures } from "./gen";

export const ckey = (cx: number, cz: number) => cx + "," + cz;
const bidx = (x: number, z: number, y: number) => (x * CS + z) * CH + y;
const ROOM_DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/**
 * Infinite voxel world: base terrain is regenerated deterministically from the
 * seed; only player modifications (deltas) are persisted.
 */
export class World {
  chunks = new Map<string, Uint8Array>();
  deltas = new Map<string, Map<number, number>>();
  dirty = new Set<string>();
  /** door column "x,z" -> swing side; set when a player pushes the door open,
   *  absent means the renderer's deterministic default. Visual state only. */
  doorSwing = new Map<string, 1 | -1>();
  /** cells whose water situation may have changed (Minecraft-style flow sim). */
  private waterQ = new Set<string>();
  gen: Structures;

  constructor(public seed: number) {
    this.gen = new Structures(seed);
  }

  chunk(cx: number, cz: number): Uint8Array {
    const k = ckey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = genChunk(this.seed, this.gen, cx, cz);
      const d = this.deltas.get(k);
      if (d) for (const [i, id] of d) c[i] = id;
      this.chunks.set(k, c);
    }
    return c;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= CH) return AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunk(cx, cz);
    return c[bidx(x - cx * CS, z - cz * CS, y)];
  }

  /** sum of thermal resistance in the column straight up; open sky iff nothing blocks the column */
  skyResistance(x: number, y: number, z: number, maxUp = 40): { R: number; openSky: boolean } {
    let R = 0;
    for (let i = 1; i <= maxUp; i++) {
      const id = this.get(x, y + i, z);
      if (id === AIR) continue;
      R += BLOCKRES[id];
      if (R >= 6) return { R, openSky: false };
    }
    return { R, openSky: R === 0 };
  }

  /**
   * Flood the open region containing (x,y,z), bounded at `cap` cells.
   * Open doors leak (they are passable); water and solid blocks bound it.
   * Reaching the cap, or the top of the world, means the region is not sealed.
   * Regulator capacity stacks: each Heat Regulator bordering the region covers
   * REGULATOR_ROOM_MAX open cells.
   */
  roomInfo(x: number, y: number, z: number, cap = 400): { size: number; sealed: boolean; regulators: number; regCells: string[] } {
    if (this.get(x, y, z) !== AIR) return { size: 0, sealed: false, regulators: 0, regCells: [] };
    const seen = new Set<string>([`${x},${y},${z}`]);
    const stack: [number, number, number][] = [[x, y, z]];
    const regs = new Set<string>();
    let size = 0, sealed = true;
    while (stack.length) {
      const [cx, cy, cz] = stack.pop()!;
      if (++size > cap) { sealed = false; break; }
      for (const [dx, dy, dz] of ROOM_DIRS) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        if (ny >= CH) { sealed = false; continue; }
        const id = this.get(nx, ny, nz);
        if (id === AIR || id === DOOR_OPEN) {
          const k = nx + "," + ny + "," + nz;
          if (!seen.has(k)) { seen.add(k); stack.push([nx, ny, nz]); }
        } else if (id === REGULATOR) regs.add(nx + "," + ny + "," + nz);
      }
    }
    return { size, sealed, regulators: regs.size, regCells: [...regs] };
  }

  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CH) return;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunk(cx, cz);
    const i = bidx(x - cx * CS, z - cz * CS, y);
    if (c[i] === id) return;
    const prev = c[i];
    c[i] = id;
    if (isWater(id) || isWater(prev)) { // water appeared or vanished: re-check this cell and its neighbours
      this.queueWater(x, y, z);
      for (const [dx, dy, dz] of ROOM_DIRS) this.queueWater(x + dx, y + dy, z + dz);
    }
    let d = this.deltas.get(ckey(cx, cz));
    if (!d) this.deltas.set(ckey(cx, cz), (d = new Map()));
    d.set(i, id);
    this.markDirty(cx, cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lx === CS - 1) this.markDirty(cx + 1, cz);
    if (lz === CS - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx: number, cz: number) { this.dirty.add(ckey(cx, cz)); }

  private queueWater(x: number, y: number, z: number) {
    if (y >= 0 && y < CH) this.waterQ.add(x + "," + y + "," + z);
  }

  /**
   * Run queued Minecraft-style flow: Sources (WATER) spread 7 cells sideways and
   * fall straight down; flow keeps the feed alive downstream and drains away when
   * its feed vanishes. Bounded work per call — the queue persists across frames.
   */
  processWater(budget = 4000): number {
    let ops = 0;
    while (this.waterQ.size && ops < budget) {
      const k = this.waterQ.values().next().value as string;
      this.waterQ.delete(k);
      const [x, y, z] = k.split(",").map(Number);
      ops += this.drainFlow(x, y, z, budget - ops);
      ops += this.floodFrom(x, y, z, budget - ops);
    }
    return ops;
  }

  private drainFlow(sx: number, sy: number, sz: number, budget: number): number {
    let ops = 0;
    const stack: [number, number, number][] = [[sx, sy, sz],
      [sx + 1, sy, sz], [sx - 1, sy, sz], [sx, sy, sz + 1], [sx, sy, sz - 1]];
    const seen = new Set<string>();
    while (stack.length && ops++ < budget) {
      const [x, y, z] = stack.pop()!;
      const s = waterStrength(this.get(x, y, z));
      if (!s || s === 8) continue; // air, solid, or Source: sources never drain on their own
      const k = x + "," + y + "," + z;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!this.waterSupported(x, y, z, s)) {
        this.set(x, y, z, AIR); // re-queues the neighbours; flood() gets the last word
        for (const [dx, dy, dz] of ROOM_DIRS) stack.push([x + dx, y + dy, z + dz]);
      }
    }
    return ops;
  }

  private waterSupported(x: number, y: number, z: number, s: number): boolean {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      if (waterStrength(this.get(x + dx, y, z + dz)) > s) return true; // fed sideways by a Source or stronger flow
    return waterStrength(this.get(x, y + 1, z)) >= s;                   // falling in from above
  }

  private floodFrom(sx: number, sy: number, sz: number, budget: number): number {
    let ops = 0;
    const q: [number, number, number][] = [[sx, sy, sz],
      [sx + 1, sy, sz], [sx - 1, sy, sz], [sx, sy, sz + 1], [sx, sy, sz - 1]];
    while (q.length && ops++ < budget) {
      const [x, y, z] = q.shift()!;
      const s = waterStrength(this.get(x, y, z));
      if (!s) continue;
      if (y > 0) { // fall straight down: a Source sends level 7, flow keeps its level
        const below = this.get(x, y - 1, z);
        if ((below === AIR || isWater(below)) && waterStrength(below) < s) {
          this.set(x, y - 1, z, flowId(s === 8 ? 7 : s));
          q.push([x, y - 1, z]);
        }
      }
      const out = s === 8 ? 7 : s - 1; // Sources spread 7; flow decays by 1 per cell
      if (out < 1) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const side = this.get(x + dx, y, z + dz);
        if ((side === AIR || isWater(side)) && waterStrength(side) < out) {
          this.set(x + dx, y, z + dz, flowId(out));
          q.push([x + dx, y, z + dz]);
        }
      }
    }
    return ops;
  }

  surface(x: number, z: number): number {
    for (let y = CH - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id !== AIR) return y;
    }
    return 0;
  }

  serializeDeltas(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [k, d] of this.deltas) {
      const arr: number[] = [];
      for (const [i, id] of d) arr.push(i, id);
      out[k] = arr;
    }
    return out;
  }

  loadDeltas(rec: Record<string, number[]>) {
    this.deltas.clear();
    for (const [k, arr] of Object.entries(rec)) {
      const m = new Map<number, number>();
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
      this.deltas.set(k, m);
    }
    this.chunks.clear();
    this.dirty.clear();
    for (const k of this.deltas.keys()) this.dirty.add(k);
  }
}

// Block thermal resistances, kept local to avoid an import cycle with blocks.ts.
import { BLOCKS } from "./blocks";
const BLOCKRES: number[] = BLOCKS.map((b) => b.R);

export function faceVisible(world: World, x: number, y: number, z: number, selfId: number): boolean {
  const n = world.get(x, y, z);
  // a closed door is a thin slab, not a full cube: keep the neighbouring wall's
  // faces so no see-through gap opens at the door jamb
  if (n === DOOR_CLOSED || n === DOOR_UPPER) return true;
  if (isOpaque(n)) return false;
  if (n === selfId) return false; // hide interior faces between same transparent block
  return true;
}
