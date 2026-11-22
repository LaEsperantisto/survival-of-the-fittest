/**
 * Ship Frame logic (Phase 1 flight design, FUTURE_IDEAS.md).
 *
 * Pure and game-state-free on purpose: it is the exact-membership core a future
 * session wires into place()/breakBlock()/Flight Controls. A Ship Frame is the
 * union of cuboids whose eight corner cells all hold Frame Corner blocks
 * (ship-local, axis-aligned). The assembly's union must be one face-connected
 * volume; two separate assemblies are two Ships, and overlapping Ship volumes
 * are both invalid.
 *
 * Cells are inclusive on both ends: a declared cuboid (a→b) claims every cell
 * with a ≤ c ≤ b per axis, including the Frame Corner cells themselves.
 */

export interface Box3 {
  min: [number, number, number];
  max: [number, number, number];
}

export interface FrameResult {
  /** Every eight-corner-braced cuboid the corner set declares, deduplicated. */
  cuboids: Box3[];
  /** Human-readable failure lines; an empty array means the Frame is valid. */
  errors: string[];
  /** Bounding box of the union of all cuboids (null if there are none). */
  bbox: Box3 | null;
  /** Sum of claimed cells over the union (deduplicated). */
  cellCount: number;
}

export const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export function parseCornerKey(k: string): [number, number, number] | null {
  const p = k.split(",");
  if (p.length !== 3) return null;
  const x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (x !== Math.trunc(x) || y !== Math.trunc(y) || z !== Math.trunc(z)) return null;
  return [x, y, z];
}

/**
 * Find every cuboid the corner set declares. For each pair of corners that
 * differs on all three axes, the pair braces a cuboid iff all eight vertices
 * of their bounding box are themselves corner cells. Pairs sharing an axis
 * bound no 3-D volume and are skipped.
 */
export function computeFrame(corners: Iterable<string>): FrameResult {
  const set = new Set<string>();
  const pts: [number, number, number][] = [];
  for (const k of corners) {
    const c = parseCornerKey(k);
    if (!c) continue;
    const kk = keyOf(c[0], c[1], c[2]);
    if (!set.has(kk)) {
      set.add(kk);
      pts.push(c);
    }
  }

  const cuboids: Box3[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    for (let j = i + 1; j < pts.length; j++) {
      const b = pts[j];
      if (a[0] === b[0] || a[1] === b[1] || a[2] === b[2]) continue; // flat pair
      // check the six remaining vertices of the box a→b
      let ok = true;
      for (let m = 0; m < 8 && ok; m++) {
        const x = m & 1 ? b[0] : a[0];
        const y = m & 2 ? b[1] : a[1];
        const z = m & 4 ? b[2] : a[2];
        if (!set.has(keyOf(x, y, z))) ok = false;
      }
      if (!ok) continue;
      const min: [number, number, number] = [
        Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]),
      ];
      const max: [number, number, number] = [
        Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]),
      ];
      const bkey = keyOf(min[0], min[1], min[2]) + "|" + keyOf(max[0], max[1], max[2]);
      if (!seen.has(bkey)) {
        seen.add(bkey);
        cuboids.push({ min, max });
      }
    }
  }

  const errors: string[] = [];
  if (set.size === 0) {
    errors.push("No Frame Corners are placed.");
  } else if (cuboids.length === 0) {
    errors.push("No complete cuboid: every corner of a cuboid needs a Frame Corner.");
  } else {
    // Union connectivity on the cuboid complex, exact and cell-exact without
    // enumerating cells: two cuboids link iff they overlap in all three axes,
    // or touch face-to-face (one axis flush with no gap, positive overlap on
    // the other two). Edge- or corner-only contact does not link.
    const n = cuboids.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (boxesLink(cuboids[i], cuboids[j])) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
    const comp = new Array<number>(n).fill(-1);
    let comps = 0;
    for (let i = 0; i < n; i++) {
      if (comp[i] !== -1) continue;
      const stack = [i];
      comp[i] = comps;
      while (stack.length) {
        const u = stack.pop()!;
        for (const v of adj[u]) if (comp[v] === -1) { comp[v] = comps; stack.push(v); }
      }
      comps++;
    }
    if (comps > 1) {
      errors.push(`The Ship Frame splits into ${comps} disconnected pieces — cuboids must share faces.`);
    }
  }

  let bbox: Box3 | null = null;
  if (cuboids.length) {
    bbox = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    for (const c of cuboids) {
      for (let a = 0; a < 3; a++) {
        bbox.min[a] = Math.min(bbox.min[a], c.min[a]);
        bbox.max[a] = Math.max(bbox.max[a], c.max[a]);
      }
    }
    // Deduplicated union cell count via inclusion of a hashed cell set —
    // bounded by the Frame's own volume; fine at wreck-to-mansion sizes.
    const cells = new Set<string>();
    for (const c of cuboids) {
      for (let x = c.min[0]; x <= c.max[0]; x++)
        for (let y = c.min[1]; y <= c.max[1]; y++)
          for (let z = c.min[2]; z <= c.max[2]; z++)
            cells.add(keyOf(x, y, z));
    }
    return { cuboids, errors, bbox, cellCount: cells.size };
  }
  return { cuboids, errors, bbox, cellCount: 0 };
}

/**
 * True iff two cuboids overlap (all three axes share ≥1 cell) or touch
 * face-to-face (exactly one axis flush with a 1-cell gap boundary, i.e.
 * hi+1 === lo with positive overlap on the other two). Used only for union
 * connectivity — NOT for the overlap rule between two Ships.
 */
export function boxesLink(a: Box3, b: Box3): boolean {
  let faceTouchAxis = -1;
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(a.min[i], b.min[i]);
    const hi = Math.min(a.max[i], b.max[i]);
    if (hi >= lo) continue; // positive overlap on this axis
    // no overlap: only a face touch may rescue this axis
    if (a.max[i] + 1 === b.min[i] || b.max[i] + 1 === a.min[i]) {
      if (faceTouchAxis !== -1) return false; // two disjoint axes: edge/corner touch
      faceTouchAxis = i;
    } else {
      return false; // real gap on this axis
    }
  }
  return true;
}

/** Strict positive volume overlap — the two-Ships collision rule. */
export function boxesOverlap(a: Box3, b: Box3): boolean {
  return (
    a.min[0] <= b.max[0] && b.min[0] <= a.max[0] &&
    a.min[1] <= b.max[1] && b.min[1] <= a.max[1] &&
    a.min[2] <= b.max[2] && b.min[2] <= a.max[2]
  );
}

/** Any pair of cuboids strictly overlapping → both Frames invalid. */
export function framesOverlap(a: FrameResult, b: FrameResult): boolean {
  for (const x of a.cuboids)
    for (const y of b.cuboids)
      if (boxesOverlap(x, y)) return true;
  return false;
}
