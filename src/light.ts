// Baked sky lighting for the renderer's "sky" mode: a Minecraft-style skylight
// flood, one light map per chunk. Light 15 arrives straight down from open sky
// (air/glass free, water 1 per cell, leaves 2 per cell), then floods through
// non-opaque cells at 1 per box (entering leaves costs 2). Maps carry a 1-cell
// halo so a chunk mesh can sample the light of the cell just past its border
// without depending on the neighbor's map being baked yet.

import { CS, CH, AIR, LEAVES, isOpaque, isWater } from "./blocks";
import { World, ckey } from "./world";

export const MAX_LIGHT = 15;
/** light-map side: chunk interior plus a 1-cell halo ring on every side */
export const LIGHT_W = CS + 2;
/** index into a chunk's light map for LOCAL coords lx,lz ∈ [-1..CS] */
export const lidx = (lx: number, lz: number, y: number) => ((lx + 1) * LIGHT_W + (lz + 1)) * CH + y;

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** cost of one horizontal flood step into this block; -1 = blocks light fully */
function sideCost(id: number): number {
  if (id === LEAVES) return 2; // leaves pass light, but cost double
  if (id === AIR) return 1;
  if (isOpaque(id)) return -1;
  return 1; // glass, water, open doors, saplings, crop gaps
}

/** cost of one step straight down the skylight column; -1 = blocks light fully */
function downCost(id: number): number {
  if (id === LEAVES) return 2; // canopy partly shades the sky
  if (isWater(id)) return 1;
  if (id === AIR) return 0;
  if (isOpaque(id)) return -1;
  return 0; // glass, open doors: sun comes straight through
}

export class SkyLighting {
  /** chunk key -> light map (Uint8Array, 0..15 per cell, LIGHT_W^2 * CH) */
  maps = new Map<string, Uint8Array>();

  invalidate(cx: number, cz: number) { this.maps.delete(ckey(cx, cz)); }

  /** baked light 0..15 at a world cell; 0 when unbaked or out of the map */
  lightAt(gx: number, gy: number, gz: number): number {
    if (gy < 0 || gy >= CH) return 0;
    const cx = Math.floor(gx / CS), cz = Math.floor(gz / CS);
    const m = this.maps.get(ckey(cx, cz));
    if (!m) return 0;
    return m[lidx(gx - cx * CS, gz - cz * CS, gy)];
  }

  /**
   * Re-bake one chunk (whole column set, bounded work — the caller budgets how
   * many chunks per frame). Seed = open-sky columns, then neighbor halo rings
   * from any already-baked neighbor, then a BFS flood. If the flood would push
   * more light into a baked neighbor than that neighbor stores, `cross` fires
   * with the neighbor coords so the renderer can re-verify it on budget.
   */
  bake(world: World, cx: number, cz: number, cross: (cx: number, cz: number) => void): Uint8Array {
    const c = world.chunk(cx, cz);
    const L = new Uint8Array(LIGHT_W * LIGHT_W * CH);
    const q: number[] = [];
    const push = (lx: number, lz: number, y: number, v: number) => {
      if (v <= 0) return;
      const i = lidx(lx, lz, y);
      if (v > L[i]) { L[i] = v; q.push(i); }
    };
    const blockAt = (lx: number, lz: number, y: number): number =>
      lx >= 0 && lx < CS && lz >= 0 && lz < CS
        ? c[(lx * CS + lz) * CH + y] // world.ts chunk layout
        : world.get(cx * CS + lx, y, cz * CS + lz);

    // open-sky columns (halo columns ride along so border faces get real light)
    for (let lx = -1; lx <= CS; lx++) for (let lz = -1; lz <= CS; lz++) {
      let lvl = MAX_LIGHT;
      for (let y = CH - 1; y >= 0; y--) {
        const cost = downCost(blockAt(lx, lz, y));
        if (cost < 0) break;
        push(lx, lz, y, lvl);
        if (cost > 0) { lvl -= cost; if (lvl <= 0) break; }
      }
    }

    // seed the halo ring from baked neighbors: halo cell == neighbor's interior cell
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const m = this.maps.get(ckey(cx + dx, cz + dz));
      if (!m) continue;
      for (let a = 0; a < CS; a++) for (let y = 0; y < CH; y++) {
        const hx = dx < 0 ? -1 : dx > 0 ? CS : a;
        const hz = dz < 0 ? -1 : dz > 0 ? CS : a;
        const nx = dx < 0 ? CS - 1 : dx > 0 ? 0 : a;
        const nz = dz < 0 ? CS - 1 : dz > 0 ? 0 : a;
        const v = m[lidx(nx, nz, y)];
        if (v > 0) push(hx, hz, y, v);
      }
    }

    // BFS flood, 1 per box (leaves 2)
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const lvl = L[i];
      if (lvl <= 1) continue;
      const lx = ((i / (LIGHT_W * CH)) | 0) - 1;
      const rem = i % (LIGHT_W * CH);
      const lz = ((rem / CH) | 0) - 1;
      const y = rem % CH;
      for (const [dx, dy, dz] of DIRS) {
        const nx = lx + dx, nz = lz + dz, ny = y + dy;
        if (ny < 0 || ny >= CH) continue;
        if (nx >= -1 && nx <= CS && nz >= -1 && nz <= CS) {
          const cost = sideCost(blockAt(nx, nz, ny));
          if (cost >= 0) push(nx, nz, ny, lvl - cost);
        } else {
          // one step past the halo: the neighbor chunk's own interior cell
          const gx = cx * CS + nx, gz = cz * CS + nz;
          const cost = sideCost(world.get(gx, ny, gz));
          if (cost < 0) continue;
          const ncx = Math.floor(gx / CS), ncz = Math.floor(gz / CS);
          const m = this.maps.get(ckey(ncx, ncz));
          if (m && m[lidx(gx - ncx * CS, gz - ncz * CS, ny)] + 1 < lvl - cost) cross(ncx, ncz);
        }
      }
    }

    this.maps.set(ckey(cx, cz), L);
    return L;
  }
}
