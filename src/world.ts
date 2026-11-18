import { AIR, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN, LEAVES, REGULATOR, INSGLASS, BENCH, BENCH_EXT, CURVED_HULL, HULL_SLOPE, CS, CH, isOpaque, isWater, waterStrength, flowId } from "./blocks";
import { genChunk, Structures } from "./gen";

export const ckey = (cx: number, cz: number) => cx + "," + cz;
const bidx = (x: number, z: number, y: number) => (x * CS + z) * CH + y;
const ROOM_DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Cells a Space's air flows straight through for roomInfo: real air, open doors,
 *  Inside Doors (open or closed — exactly air thermally, they never seal or split
 *  a Space), and Leaves (walk-blocking, but never part of a room's sealing). */
const ROOM_OPEN = new Set<number>([AIR, DOOR_OPEN, DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN, LEAVES]);
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
  /** cell "x,y,z" -> quarter-turn rotation (1..3) for player-placed blocks.
   *  Sparse: unrotated cells are absent, so terrain costs nothing. */
  rots = new Map<string, number>();
  /** cells whose water situation may have changed (Minecraft-style flow sim). */
  private waterQ = new Set<string>();
  gen: Structures;

  constructor(public seed: number, public worldMode: "easy" | "hard" = "easy") {
    this.gen = new Structures(seed);
  }

  chunk(cx: number, cz: number): Uint8Array {
    const k = ckey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = genChunk(this.seed, this.gen, cx, cz, this.worldMode);
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

  /** sum of thermal resistance in the column straight up.
   *  openSky: the path to sky stays open. Inside Doors and open doors are exactly
   *  air here (R 0 — zero contribution); Leaves are special: their partial R (0.7
   *  per block) sums into the shade budget but a canopy never blocks the sky. */
  skyResistance(x: number, y: number, z: number, maxUp = 40): { R: number; openSky: boolean } {
    let R = 0, seal = 0;
    for (let i = 1; i <= maxUp; i++) {
      const id = this.get(x, y + i, z);
      if (id === AIR) continue;
      const r = BLOCKRES[id];
      if (!r) continue; // air-equivalent thermally: open door, Inside Door, water…
      R += r;
      if (id === LEAVES) continue; // leaves only partly shade: they never seal off the sky
      seal += r;
      if (seal >= 6) return { R, openSky: false };
    }
    return { R, openSky: seal === 0 };
  }

  /** Is this cell in direct Sunlight from a sun sitting in direction (dx,dy,dz)
   *  (normalized, dy > 0)? Marches from the cell centre toward the sun: any
   *  opaque block stops the beam — and so does Insulating Glass, which is
   *  see-through but never lets sunlight through. */
  sunVisible(x: number, y: number, z: number, dx: number, dy: number, dz: number, maxDist = 64): boolean {
    if (dy <= 0) return false;
    let cx = x, cy = y, cz = z;
    const sx = Math.sign(dx), sy = 1, sz = Math.sign(dz);
    const tdx = sx ? Math.abs(1 / dx) : Infinity, tdy = 1 / dy, tdz = sz ? Math.abs(1 / dz) : Infinity;
    // distance along the ray to the first cell boundary on each axis
    let tmx = sx ? (sx > 0 ? cx + 1 - (x + 0.5) : x + 0.5 - cx) * tdx : Infinity;
    let tmy = (y + 1 - (y + 0.5)) * tdy; // dy > 0: first boundary is always the cell top
    let tmz = sz ? (sz > 0 ? cz + 1 - (z + 0.5) : z + 0.5 - cz) * tdz : Infinity;
    for (let steps = 0; steps < 192; steps++) {
      let t: number;
      if (tmx <= tmy && tmx <= tmz) { cx += sx; t = tmx; tmx += tdx; }
      else if (tmy <= tmz) { cy += sy; t = tmy; tmy += tdy; }
      else { cz += sz; t = tmz; tmz += tdz; }
      if (t > maxDist) return true; // reached far enough: treat as clear sky
      const id = this.get(cx, cy, cz);
      if (id === INSGLASS || isOpaque(id)) return false;
    }
    return true;
  }

  /**
   * Flood the open region containing (x,y,z), bounded at `cap` cells.
   * Open doors leak (they are passable); Inside Doors are exactly air — closed,
   * they neither bound a room nor split two rooms; Leaves never seal or boundary
   * a room. Water and other solid blocks bound it.
   * Reaching the cap, or the top of the world, means the region is not sealed.
   * Regulator capacity stacks: each Heat Regulator bordering the region covers
   * REGULATOR_ROOM_MAX open cells.
   */
  roomInfo(x: number, y: number, z: number, cap = 400): { size: number; sealed: boolean; regulators: number; regCells: string[] } {
    if (!ROOM_OPEN.has(this.get(x, y, z))) return { size: 0, sealed: false, regulators: 0, regCells: [] };
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
        if (ROOM_OPEN.has(id)) {
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
    if (isWater(id) || isWater(prev) || id === AIR) { // water appeared, vanished, or a cell opened beside water — re-check this cell and its neighbours
      this.queueWater(x, y, z);
      for (const [dx, dy, dz] of ROOM_DIRS) this.queueWater(x + dx, y + dy, z + dz);
    }
    let d = this.deltas.get(ckey(cx, cz));
    if (!d) this.deltas.set(ckey(cx, cz), (d = new Map()));
    d.set(i, id);
    this.rots.delete(x + "," + y + "," + z); // a new block starts unrotated
    this.markDirty(cx, cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lx === CS - 1) this.markDirty(cx + 1, cz);
    if (lz === CS - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx: number, cz: number) {
    this.dirty.add(ckey(cx, cz));
    const k = ckey(cx, cz);
    this.revs.set(k, (this.revs.get(k) ?? 0) + 1); // map tiles rebuild on bump
  }
  /** per-chunk edit counter — a Map tile cache keys its staleness on this */
  revs = new Map<string, number>();

  getRot(x: number, y: number, z: number): number { return this.rots.get(x + "," + y + "," + z) ?? 0; }
  setRot(x: number, y: number, z: number, r: number) {
    const k = x + "," + y + "," + z;
    if (r & 3) this.rots.set(k, r & 3); else this.rots.delete(k);
  }

  private queueWater(x: number, y: number, z: number) {
    if (y >= 0 && y < CH) this.waterQ.add(x + "," + y + "," + z);
  }

  /**
   * Run queued Minecraft-style flow: Sources (WATER) spread 7 cells sideways and
   * fall straight down; flow keeps the feed alive downstream and drains away when
   * its feed vanishes. One propagation step per call — water placed during this
   * call is queued for the next, so a spill crawls outward a cell at a time.
   * A flow cell sitting under any water refills to a full block; flow spreads
   * sideways only when it stands on something — water falls to the ground
   * before it wanders, and never rests on air.
   */
  processWater(budget = 4000): number {
    let ops = 0;
    const wave = [...this.waterQ];
    this.waterQ.clear();
    for (const k of wave) {
      if (ops >= budget) break;
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
    // falling in from above: water directly overhead feeds this cell and
    // refills it to a full block, so it stays while that feed stands
    return waterStrength(this.get(x, y + 1, z)) > 0;
  }

  private floodFrom(sx: number, sy: number, sz: number, budget: number): number {
    let ops = 0;
    // the queued cell only — each call advances the front exactly one cell;
    // placements re-queue themselves for the next generation (see set())
    const q: [number, number, number][] = [[sx, sy, sz]];
    while (q.length && ops++ < budget) {
      const [x, y, z] = q.shift()!;
      const below = this.get(x, y - 1, z);
      // a flow cell under any water is a full block: its level resets
      let s = waterStrength(this.get(x, y, z));
      if (s && s !== 8 && s < 7 && waterStrength(this.get(x, y + 1, z)) > 0) {
        this.set(x, y, z, flowId(7));
        s = 7;
      }
      if (!s) continue;
      if (y > 0) { // fall straight down: a Source sends level 7, flow keeps its level
        if ((below === AIR || isWater(below)) && waterStrength(below) < s)
          this.set(x, y - 1, z, flowId(s === 8 ? 7 : s));
      }
      // flow only spreads sideways when it stands on something — water must
      // reach the ground first, instead of floating across open air
      if (below === AIR || isWater(below)) continue;
      const out = s === 8 ? 7 : s - 1; // Sources spread 7; flow decays by 1 per cell
      if (out < 1) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const side = this.get(x + dx, y, z + dz);
        if ((side === AIR || isWater(side)) && waterStrength(side) < out)
          this.set(x + dx, y, z + dz, flowId(out));
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

  serializeRots(): Record<string, number> { return Object.fromEntries(this.rots); }
  loadRots(rec: Record<string, number>) {
    this.rots = new Map(Object.entries(rec ?? {}).map(([k, v]) => [k, v]));
  }
}

// Block thermal resistances, kept local to avoid an import cycle with blocks.ts.
import { BLOCKS } from "./blocks";
const BLOCKRES: number[] = BLOCKS.map((b) => b.R);

export function faceVisible(world: World, x: number, y: number, z: number, selfId: number): boolean {
  const n = world.get(x, y, z);
  // a closed door is a thin slab, not a full cube: keep the neighbouring wall's
  // faces so no see-through gap opens at the door jamb
  if (n === DOOR_CLOSED || n === DOOR_UPPER || n === DOOR_INNER || n === DOOR_INNER_UPPER) return true;
  // model-shaped blocks (the bench's legs and slab, the chamfered hulls'
  // clipped corners) do not cover their cell faces: keeping the neighbour's
  // face is the only thing that stops those gaps reading as holes in the ground
  if (n === BENCH || n === BENCH_EXT || n === CURVED_HULL || n === HULL_SLOPE) return true;
  if (isOpaque(n)) return false;
  if (n === selfId) return false; // hide interior faces between same transparent block
  return true;
}
