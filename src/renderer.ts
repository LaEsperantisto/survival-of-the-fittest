import * as THREE from "three";
import {
  CS, CH, BLOCKS, AIR, SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS,
  INSGLASS, HULL, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, LAMP, METAL, BEACON, BENCH, CAMPFIRE, WATER, ADOBE, ENGINECORE, REGULATOR, CHEST, BENCH_EXT, CACTUS,
  WATER7, WATER6, WATER5, WATER4, WATER3, WATER2, WATER1,
  FARMLAND, MELON_1, MELON_2, WHEAT_1, WHEAT_2, CACTUS_FRUIT, CHEST_CONNECTOR, METAL_PLATING,
  DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN, BED, BED_EXT, GRASS, WOOD, LEAVES, SAPLING,
  CURVED_HULL, HULL_SLOPE, IRON_ORE, COPPER_ORE, COBALT_ORE, ALABASTER, THRUSTER, THRUSTER_LIT, STORM_BREAKER, ARMORY, STORM_BREAKER_R,
  REGULATOR_HUSK, STORM_BREAKER_HUSK,
  POWER_PANEL, POWER_POLE, GEN_WOOD, WATER_WHEEL, WIND_TURBINE, SOLAR_PANEL, BATTERY, ELEC_LAMP,
  INSERTER, PLANTER, HARVESTER,
  isSolid, isWater, waterStrength,
} from "./blocks";
import { World, ckey, faceVisible } from "./world";
import { DAY_SECONDS } from "./blocks";
import { noise1, Rng } from "./noise";
import { SkyLighting, MAX_LIGHT, lidx } from "./light";

/** every block id that renders as a swingable door leaf */
const DOOR_BLOCKS = new Set([DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN]);
/** blocks that render as crossed blade quads instead of cubes */
const CROSS_BLOCKS = new Set([WHEAT_1, WHEAT_2, SAPLING]);

const FACES: { dir: [number, number, number]; corners: number[][]; shade: number; uv: [number, number] }[] = [
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0, uv: [0, 2] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.45, uv: [0, 2] },
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], shade: 0.8, uv: [2, 1] },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], shade: 0.7, uv: [2, 1] },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.85, uv: [0, 1] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.65, uv: [0, 1] },
];

// ---------------- non-cube hull shapes ----------------
// World storage has no rotation metadata, so these shapes are orientation-
// independent: CURVED_HULL chamfers its four vertical edges (the ship's rounded
// hull), HULL_SLOPE its four top edges. Axis faces cull against solid
// neighbours exactly like plain cubes; the 45° chamfer facets are always
// drawn. UVs are planar projections mirroring the cube face each one replaces,
// so every face keeps sampling the HULL plating tile.

const CHAMFER = 0.28;
interface ShapeFace {
  /** outward normal; axis faces cull on it, chamfers sample light on it */
  dir: [number, number, number];
  /** tile slot in FACE_T: 0 top, 1 bottom, 2 side (chamfers borrow the side) */
  kind: 0 | 1 | 2;
  /** convex ring, fan-triangulated, wound so the normal matches dir */
  pts: [number, number, number][];
  sh: number;
  uv: (p: [number, number, number]) => [number, number];
  /** model faces (bench parts) never cull: they hang inside a solid cell */
  always?: boolean;
  /** bridge face: emitted only when the cell at `fill` is solid — it plugs
   *  the gap left where that neighbour culled its shared face */
  fill?: [number, number, number];
}

function shapeFace(dir: [number, number, number], kind: 0 | 1 | 2, sh: number,
  pts: [number, number, number][], uv: (p: [number, number, number]) => [number, number]): ShapeFace {
  // flip the ring if it was written in the wrong winding
  const a = pts[1].map((v, i) => v - pts[0][i]);
  const b = pts[2].map((v, i) => v - pts[0][i]);
  const nx = a[1] * b[2] - a[2] * b[1], ny = a[2] * b[0] - a[0] * b[2], nz = a[0] * b[1] - a[1] * b[0];
  if (nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) pts.reverse();
  return { dir, kind, pts, sh, uv };
}
function fillFace(dir: [number, number, number], sh: number,
  pts: [number, number, number][], uv: (p: [number, number, number]) => [number, number]): ShapeFace {
  return { ...shapeFace(dir, 2, sh, pts, uv), fill: dir };
}

const HULL_SHAPES: Record<number, ShapeFace[]> = (() => {
  const c = CHAMFER, k = 1 - c; // k: inner chamfer coordinate
  const uvXZ = (p: [number, number, number]) => [p[0], p[2]] as [number, number];
  const uvXY = (p: [number, number, number]) => [p[0], p[1]] as [number, number];
  const uvZY = (p: [number, number, number]) => [p[2], p[1]] as [number, number];
  // 45° facets: u continues roughly the strip of one adjacent face's planar u
  const uvChamDiag = (p: [number, number, number]) => [(p[2] - p[0]) / 2 + 0.5, p[1]] as [number, number];
  const uvChamAnti = (p: [number, number, number]) => [(p[0] + p[2]) / 2, p[1]] as [number, number];
  // octagonal ring: the cell square with the corners cut by the chamfer
  const oct: [number, number][] = [[c, 0], [k, 0], [1, c], [1, k], [k, 1], [c, 1], [0, k], [0, c]];
  const curved: ShapeFace[] = [
    shapeFace([0, 1, 0], 0, 1.0, oct.map(([px, pz]) => [px, 1, pz]), uvXZ),
    shapeFace([0, -1, 0], 1, 0.45, oct.map(([px, pz]) => [px, 0, pz]), uvXZ),
    shapeFace([1, 0, 0], 2, 0.8, [[1, 0, c], [1, 0, k], [1, 1, k], [1, 1, c]], uvZY),
    shapeFace([-1, 0, 0], 2, 0.7, [[0, 0, k], [0, 1, k], [0, 1, c], [0, 0, c]], uvZY),
    shapeFace([0, 0, 1], 2, 0.85, [[c, 0, 1], [k, 0, 1], [k, 1, 1], [c, 1, 1]], uvXY),
    shapeFace([0, 0, -1], 2, 0.65, [[c, 0, 0], [c, 1, 0], [k, 1, 0], [k, 0, 0]], uvXY),
    // vertical chamfers; shade = mean of the two adjacent face shades
    shapeFace([-1, 0, -1], 2, 0.675, [[c, 0, 0], [c, 1, 0], [0, 1, c], [0, 0, c]], uvChamDiag),
    shapeFace([1, 0, -1], 2, 0.725, [[k, 0, 0], [k, 1, 0], [1, 1, c], [1, 0, c]], uvChamAnti),
    shapeFace([1, 0, 1], 2, 0.825, [[1, 0, k], [1, 1, k], [k, 1, 1], [k, 0, 1]], uvChamDiag),
    shapeFace([-1, 0, 1], 2, 0.775, [[0, 0, k], [0, 1, k], [c, 1, 1], [c, 0, 1]], uvChamAnti),
    // bridge flaps: where a neighbour is solid it culls the shared plane, but
    // the chamfer leaves the corner strips open — these close them from the
    // curved side. Only drawn when that neighbour really is there, so the
    // rounded silhouette against air is untouched and the sealed interior
    // never sees a culled backface (the old light leak).
    fillFace([1, 0, 0], 0.8, [[1, 0, 0], [1, 1, 0], [1, 1, c], [1, 0, c]], uvZY),
    fillFace([1, 0, 0], 0.8, [[1, 0, k], [1, 1, k], [1, 1, 1], [1, 0, 1]], uvZY),
    fillFace([-1, 0, 0], 0.7, [[0, 0, 0], [0, 0, c], [0, 1, c], [0, 1, 0]], uvZY),
    fillFace([-1, 0, 0], 0.7, [[0, 0, k], [0, 0, 1], [0, 1, 1], [0, 1, k]], uvZY),
    fillFace([0, 0, 1], 0.85, [[0, 0, 1], [0, 1, 1], [c, 1, 1], [c, 0, 1]], uvXY),
    fillFace([0, 0, 1], 0.85, [[k, 0, 1], [k, 1, 1], [1, 1, 1], [1, 0, 1]], uvXY),
    fillFace([0, 0, -1], 0.65, [[0, 0, 0], [c, 0, 0], [c, 1, 0], [0, 1, 0]], uvXY),
    fillFace([0, 0, -1], 0.65, [[k, 0, 0], [1, 0, 0], [1, 1, 0], [k, 1, 0]], uvXY),
  ];
  const slope: ShapeFace[] = [
    shapeFace([0, 1, 0], 0, 1.0, [[c, 1, c], [c, 1, k], [k, 1, k], [k, 1, c]], uvXZ),
    shapeFace([0, -1, 0], 1, 0.45, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvXZ),
    shapeFace([1, 0, 0], 2, 0.8, [[1, 0, 0], [1, 0, 1], [1, k, 1], [1, k, 0]], uvZY),
    shapeFace([-1, 0, 0], 2, 0.7, [[0, 0, 0], [0, k, 0], [0, k, 1], [0, 0, 1]], uvZY),
    shapeFace([0, 0, 1], 2, 0.85, [[0, 0, 1], [1, 0, 1], [1, k, 1], [0, k, 1]], uvXY),
    shapeFace([0, 0, -1], 2, 0.65, [[0, 0, 0], [0, k, 0], [1, k, 0], [1, 0, 0]], uvXY),
    // top-edge chamfers; u continues the side face below, v = y keeps them
    // seamless against that side's tile band
    shapeFace([0, 1, -1], 2, 0.825, [[0, k, 0], [1, k, 0], [1, 1, c], [0, 1, c]], uvXY),
    shapeFace([0, 1, 1], 2, 0.925, [[1, k, 1], [0, k, 1], [0, 1, c], [1, 1, c]], uvXY),
    shapeFace([-1, 1, 0], 2, 0.85, [[0, k, 1], [0, k, 0], [0, 1, c], [0, 1, k]], uvZY),
    shapeFace([1, 1, 0], 2, 0.9, [[1, k, 0], [1, k, 1], [1, 1, k], [1, 1, c]], uvZY),
  ];
  return { [CURVED_HULL]: curved, [HULL_SLOPE]: slope };
})();

// Quarter-turn helpers around the cell centre (Y axis, CCW from above). The
// rotation nibble turns the whole shape — geometry and face normals — while
// UVs keep sampling the tile the unrotated face used, so art follows the block.
const rot2 = (px: number, pz: number, r: number): [number, number] =>
  r === 0 ? [px, pz] : r === 1 ? [1 - pz, px] : r === 2 ? [1 - px, 1 - pz] : [pz, 1 - px];
const rotDir = (d: [number, number, number], r: number): [number, number, number] =>
  r === 0 ? d : r === 1 ? [-d[2], d[1], d[0]] : r === 2 ? [-d[0], d[1], -d[2]] : [d[2], d[1], -d[0]];
const rotShapes = (faces: ShapeFace[], r: number): ShapeFace[] =>
  r === 0 ? faces : faces.map((f) => ({
    ...f, dir: rotDir(f.dir, r), fill: f.fill ? rotDir(f.fill, r) : f.fill,
    pts: f.pts.map(([px, py, pz]) => { const [qx, qz] = rot2(px, pz, r); return [qx, py, qz] as [number, number, number]; }),
  }));

// The Crafting Bench stands as a workbench model across its two cells:
// a thick top slab spanning both, an apron shelf, legs at the outer ends and
// a drawer front on the near half. Templates are authored for the BENCH cell
// with its EXT neighbour on +x (drawer facing -z); the mesher rotates them by
// where the pair actually runs plus the player's rotation nibble.
const slabFaces = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ShapeFace[] => [
  shapeFace([0, 1, 0], 0, 1.0, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], (p) => [p[0], p[2]]),
  shapeFace([0, -1, 0], 1, 0.45, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], (p) => [p[0], p[2]]),
  shapeFace([1, 0, 0], 2, 0.8, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], (p) => [p[2], p[1]]),
  shapeFace([-1, 0, 0], 2, 0.7, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], (p) => [p[2], p[1]]),
  shapeFace([0, 0, 1], 2, 0.85, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], (p) => [p[0], p[1]]),
  shapeFace([0, 0, -1], 2, 0.65, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], (p) => [p[0], p[1]]),
];
const always = (faces: ShapeFace[]) => { for (const f of faces) f.always = true; return faces; };
// drop one face by index: 2 = +x, 3 = -x — the pair's worktop spans both
// cells, so the seam faces at the shared border must not double-draw
const noFace = (faces: ShapeFace[], i: number) => faces.filter((_, k) => k !== i);
const BENCH_MODEL = (() => {
  const top = noFace(slabFaces(0, 0.72, 0, 1, 0.88, 1), 2);
  const shelf = noFace(slabFaces(0, 0.18, 0.18, 1, 0.26, 0.82), 2);
  const legs = [...slabFaces(0.05, 0, 0.05, 0.2, 0.72, 0.2), ...slabFaces(0.05, 0, 0.8, 0.2, 0.72, 0.95)];
  const drawer = slabFaces(0.28, 0.3, 0, 0.72, 0.64, 0.05);
  return always([...top, ...shelf, ...legs, ...drawer]);
})();
const BENCHX_MODEL = (() => {
  const top = noFace(slabFaces(0, 0.72, 0, 1, 0.88, 1), 3);
  const shelf = noFace(slabFaces(0, 0.18, 0.18, 1, 0.26, 0.82), 3);
  const legs = [...slabFaces(0.8, 0, 0.05, 0.95, 0.72, 0.2), ...slabFaces(0.8, 0, 0.8, 0.95, 0.72, 0.95)];
  return always([...top, ...shelf, ...legs]);
})();

// ---------------- procedural texture atlas ----------------
// One 16x16 tile per face kind, drawn on a 256x256 canvas at load: a base tile
// per block id (also sampled by the item icons) plus variant tiles for faces
// whose real material differs (grass blades vs soil, log rings vs bark, lid vs
// crate side...). FACE_T maps (block id, FACES index) to the tile each face
// uses. Deterministic pixel art, no external assets; vertex colors carry the
// face shading.

export const TILE_PX = 16, ATLAS_COLS = 16;

export const TILE_LIST = [SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS,
  HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL, BEACON, BENCH, CAMPFIRE, WATER, ADOBE, DOOR_OPEN, ENGINECORE, REGULATOR, CHEST, BENCH_EXT, CACTUS,
  WATER7, WATER6, WATER5, WATER4, WATER3, WATER2, WATER1,
  FARMLAND, MELON_1, MELON_2, WHEAT_1, WHEAT_2, CACTUS_FRUIT, CHEST_CONNECTOR, METAL_PLATING,
  DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN, BED, BED_EXT, GRASS, WOOD, LEAVES, SAPLING,
  IRON_ORE, COPPER_ORE, COBALT_ORE, ALABASTER, THRUSTER, THRUSTER_LIT, STORM_BREAKER, ARMORY,
  REGULATOR_HUSK, STORM_BREAKER_HUSK,
  POWER_PANEL, POWER_POLE, GEN_WOOD, WATER_WHEEL, WIND_TURBINE, SOLAR_PANEL, BATTERY, ELEC_LAMP,
  INSERTER, PLANTER, HARVESTER];

// extra face tiles, appended after the base tiles; each recipe is shaded with
// the named block's base colour
const VARIANTS: [string, number][] = [
  ["grass_top", GRASS], ["grass_side", GRASS], ["wood_top", WOOD],
  ["farmland_side", FARMLAND], ["sandstone_top", SANDSTONE], ["hull_top", HULL],
  ["water_side", WATER], ["bed_side", BED], ["chest_top", CHEST],
  ["bench_top", BENCH], ["bench_ext_top", BENCH_EXT], ["campfire_top", CAMPFIRE],
  ["campfire_cold", CAMPFIRE],
  ["cactus_top", CACTUS],
];
const VI: Record<string, number> = {};
VARIANTS.forEach(([name], i) => (VI[name] = TILE_LIST.length + i));

let atlasCv: HTMLCanvasElement | null = null;

/** The shared 16px-per-block texture canvas; item icons sample the same atlas. */
export function getAtlasCanvas(): HTMLCanvasElement {
  if (atlasCv) return atlasCv;
  const cv = document.createElement("canvas");
  cv.width = cv.height = ATLAS_COLS * TILE_PX;
  const g = cv.getContext("2d")!;
  const rng = new Rng(0xbeef);
  const tileIdx: Record<string, number> = {};
  TILE_LIST.forEach((id, i) => (tileIdx[String(id)] = i));
  for (const name in VI) tileIdx[name] = VI[name];

  // current tile origin + base colour, set per tile just before its recipe runs
  let tx = 0, ty = 0, br = 0, bg = 0, bb = 0;
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  const col = (dl: number, a = 1, hr = 0, hg = 0, hb = 0) =>
    `rgba(${Math.round(cl(br + dl + hr) * 255)},${Math.round(cl(bg + dl + hg) * 255)},${Math.round(cl(bb + dl + hb) * 255)},${a})`;
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(tx + x, ty + y, 1, 1); };
  const fill = (c: string) => { g.fillStyle = c; g.fillRect(tx, ty, TILE_PX, TILE_PX); };
  const nz = (s: number) => (rng.next() - 0.5) * s;
  const speckle = (n: number, s: number) => {
    for (let i = 0; i < n; i++) px(rng.int(0, 15), rng.int(0, 15), col(nz(s)));
  };
  const crack = (len: number, s: number, dl = -0.15) => {
    let x = rng.int(1, 13), y = rng.int(1, 13);
    for (let i = 0; i < len; i++) {
      px(x, y, col(dl + nz(s)));
      x += rng.int(-1, 1); y += rng.int(0, 1);
      x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
    }
  };
  // tiling 2-octave value noise over the tile, in [-1, 1]: the soft mottling
  // real materials have that per-pixel static never does
  const fbm = (): number[] => {
    const layer = (gs: number): number[] => {
      const grid: number[] = [];
      for (let i = 0; i < gs * gs; i++) grid.push(rng.next());
      const at = (xx: number, yy: number) => grid[(yy % gs) * gs + (xx % gs)];
      const out: number[] = [];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const sx = (x * gs) / 16, sy = (y * gs) / 16;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
        const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
        out.push(top + (bot - top) * fy);
      }
      return out;
    };
    const a = layer(4), b = layer(8);
    return a.map((v, i) => (v * 0.65 + b[i] * 0.35 - 0.5) * 2);
  };
  // paint every pixel from the noise plus a recipe's own positional term
  const fbmFill = (fn: (x: number, y: number, n: number) => number): number[] => {
    const n = fbm();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, col(fn(x, y, n[y * 16 + x])));
    return n;
  };
  // one rounded stone: dark rim, lit from the top-left
  const pebble = (cx: number, cy: number, r: number, dl: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.3) continue;
      px(cx + dx, cy + dy, col(dl + (d > r - 0.6 ? -0.2 : dx + dy < -r * 0.5 ? 0.14 : -0.02)));
    }
  };
  // diagonal reflection streaks across a face
  const glint = (offs: number[], alpha: number, dl = 0.25) => {
    for (const k of offs) for (let i = 0; i < 16; i++) {
      const y = i - k;
      if (y >= 0 && y < 16) px(i, y, col(dl, alpha));
    }
  };
  // one metal/crystal grain set in host rock: dark rim, top-left glint,
  // tinted by (hr,hg,hb) so ores read as their mineral, not the matrix
  const grain = (cx: number, cy: number, r: number, hr: number, hg: number, hb: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.3) continue;
      px(cx + dx, cy + dy, col(d > r - 0.5 ? -0.22 : dx + dy < 0 ? 0.24 : 0.04, 1, hr, hg, hb));
    }
  };

  const recipes: Record<string, () => void> = {};
  const R = (key: string, fn: () => void) => (recipes[key] = fn);

  R(String(SAND), () => {
    fbmFill((x, y, n) => n * 0.07 + Math.sin((x + y) * 0.55 + n * 5) * 0.03); // wind ripples
    speckle(24, 0.18);                                                        // coarse grit
    for (let i = 0; i < 5; i++) px(rng.int(0, 15), rng.int(0, 15), col(-0.14));
  });
  R(String(SANDSTONE), () => {
    const n = fbm();
    for (let y = 0; y < 16; y++) {
      const band = Math.floor(((y + n[y * 16 + 8] * 1.2 + 16) % 16) / 4);     // drifting strata
      const tone = [-0.05, 0.03, -0.01, 0.05][band % 4];
      for (let x = 0; x < 16; x++) px(x, y, col(tone + n[y * 16 + x] * 0.05 + (y % 4 === 0 ? -0.12 : 0)));
    }
    speckle(26, 0.08);
  });
  R("sandstone_top", () => {
    fbmFill((x, y, n) => n * 0.06);
    for (let i = 0; i < 7; i++) { const x = rng.int(1, 14), y = rng.int(1, 14); px(x, y, col(-0.13)); px(x + 1, y, col(-0.06)); } // wind pits
    speckle(30, 0.1);
  });
  R(String(ROCK), () => {
    fbmFill((x, y, n) => n * 0.1);                                            // large mottling
    crack(11, 0.06, -0.14); crack(8, 0.06, -0.2);
    for (let i = 0; i < 4; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.2)); // mineral flecks
    speckle(16, 0.1);
  });
  R(String(GRAVEL), () => {
    fbmFill((x, y, n) => n * 0.08 - 0.06);                                    // sandy gaps
    for (let i = 0; i < 9; i++) pebble(rng.int(2, 13), rng.int(2, 13), rng.int(1, 3), nz(0.18));
  });
  R(String(DIRT), () => {
    fbmFill((x, y, n) => n * 0.13 + (Math.sin(x * 1.4) + Math.cos(y * 1.1)) * 0.03); // clods
    speckle(44, 0.2);
    for (let i = 0; i < 3; i++) { const x = rng.int(2, 13), y = rng.int(2, 13); px(x, y, col(0.16)); px(x + 1, y, col(0.08)); }
  });
  R(String(SALT), () => {
    fbmFill((x, y, n) => n * 0.05 + 0.04);                                     // bleached crust
    crack(10, 0.03, 0.06); crack(8, 0.03, 0.09);                               // polygonal plates
    for (let i = 0; i < 30; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.13)); // crystalline sparkle
  });
  R(String(DEADWOOD), () => {
    const n = fbmFill((x, y, nn) => nn * 0.04 - 0.05);
    for (let y = 0; y < 16; y++) {
      for (let x = 1; x < 15; x++)                                             // splintered grain
        if (Math.sin(x * 0.5 + y * 2.6 + n[y * 16 + x] * 4) > 0.7) px(x, y, col(-0.18));
      if (y % 5 === 2 && rng.next() > 0.4) px(rng.int(2, 13), y, col(0.12));   // light wear
    }
  });
  R(String(GLASS), () => {
    fill("rgba(170,215,232,0.22)");
    glint([5, 8, 14], 0.5, 0.3);
    glint([11], 0.32, 0.22);
  });
  R(String(INSGLASS), () => {
    fbmFill((x, y, n) => n * 0.05);                                            // frosty foam core
    crack(7, 0.02, -0.1);
    glint([9], 0.18, 0.12);                                                    // only a hint shows through
  });
  R(String(HULL), () => {
    const n = fbmFill((x, y, nn) => nn * 0.03);                               // faint panel tone
    for (let x = 0; x < 16; x++) {                                            // weld seam
      px(x, 10, col(-0.24));
      if (x % 2 === 0) px(x, 9, col(-0.08));
    }
    for (let y = 0; y < 16; y++) {                                            // rivet columns
      if (y % 4 !== 1) continue;
      for (const rx of [1, 6, 11]) {
        px(rx, y, col(0.22)); px(rx + 1, y, col(0.05)); px(rx, y + 1, col(-0.16)); px(rx + 1, y + 1, col(-0.12));
      }
    }
    for (let i = 0; i < 10; i++) px(rng.int(0, 15), rng.int(0, 15), col(-0.02, 1, 0.06, -0.01, -0.08)); // micrometeoroid pits
    if (n[3 * 16 + 12] > 0.3) px(12, 3, col(0.35, 1, 0.1, 0, 0));             // one stray bolt catch
  });
  R("hull_top", () => {
    fbmFill((x, y, n) => n * 0.03);
    for (const ry of [4, 12]) for (let x = 0; x < 16; x++) px(x, ry, col(-0.22)); // sun-bleached seams
    for (const rx of [2, 7, 12]) for (let y = 0; y < 16; y++) if (y % 4 === 2) px(rx, y, col(0.2));
    for (let i = 0; i < 8; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.28, 1, 0.05, -0.02, -0.06)); // sandblown scuffs
  });
  R(String(DOOR_CLOSED), () => {
    fbmFill((x, y, n) => n * 0.03 - 0.03);
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.26)); px(i, 15, col(-0.26)); px(0, i, col(-0.26)); px(15, i, col(-0.26)); }
    for (let y = 2; y <= 12; y++)                                             // recessed panel bevel
      for (let x = 3; x <= 12; x++) {
        if (x === 3 || x === 12 || y === 2 || y === 12) px(x, y, col(-0.2));
        else if (x === 4 && y > 3 && y < 11) px(x, y, col(0.08));             // light from the left
      }
    for (let y = 7; y <= 9; y++) { px(13, y, col(0.35)); px(12, y, col(-0.28)); } // handle + shadow
    for (let x = 5; x < 11; x++) px(x, 14, col(-0.15, 1, 0.1, 0, -0.02));     // boot scuffs
  });
  R(String(DOOR_UPPER), () => {
    fbmFill((x, y, n) => n * 0.03 - 0.03);
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.26)); px(i, 15, col(-0.26)); px(0, i, col(-0.26)); px(15, i, col(-0.26)); }
    for (let y = 4; y <= 11; y++) for (let x = 5; x <= 10; x++) px(x, y, col(-0.32, 1, -0.1, -0.02, 0.06)); // viewport
    for (const k of [5, 8])                                                   // glass glint, viewport only
      for (let x = 5; x <= 10; x++) { const y = x - k + 4; if (y >= 4 && y <= 11) px(x, y, col(0.35, 0.5)); }
    for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) px(rx, ry, col(0.2)); // bolts
  });
  R(String(DOOR_OPEN), () => {
    // leaf parked in the frame: mostly see-through, one steel edge visible
    for (let y = 0; y < 16; y++) { px(0, y, col(-0.1, 0.9)); px(1, y, col(0.05, 0.85)); px(2, y, col(-0.15, 0.7)); }
    px(1, 7, col(0.3, 0.9)); px(1, 8, col(0.3, 0.9));
  });
  R(String(LAMP), () => {
    fill(col(-0.28));
    for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(x, y, d > 3 ? col(0.12) : col(0.42 - d * 0.06, 1, 0.3, 0.18, -0.02)); // hot glass with a falloff
    }
    for (const [rx, ry] of [[4, 4], [11, 4], [4, 11], [11, 11]] as const) px(rx, ry, col(0.25)); // corner bolts
  });
  R(String(METAL), () => {
    fbmFill((x, y, n) => n * 0.03 + (y % 2 === 0 ? 0.02 : -0.02));            // brushed grain
    for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) px(rx, ry, col(0.22)); // bevel + bolts
    for (let i = 0; i < 5; i++) {                                             // rust nicks
      const x = rng.int(2, 13), y = rng.int(2, 13);
      px(x, y, col(-0.12, 1, 0.24, 0.02, -0.14)); px(x + 1, y, col(-0.2, 1, 0.16, 0, -0.1));
    }
  });
  R(String(BEACON), () => {
    fbmFill((x, y, n) => n * 0.03 - 0.25);
    for (let dy = -3; dy <= 3; dy++) {
      const w2 = 3 - Math.abs(dy);
      for (let dx = -w2; dx <= w2; dx++) {
        if (Math.hypot(dx, dy) > w2 + 0.3) continue;
        px(8 + dx, 8 + dy, col(dy === 0 ? 0.05 : 0, 1, 0.95 - Math.abs(dy) * 0.08, 0.15, 0.1)); // housing lamp, redder mid
      }
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (Math.hypot(dx, dy) < 1.6) px(8 + dx, 8 + dy, col(0.4 - Math.hypot(dx, dy) * 0.15, 1, 1, 0.3, 0.1));
    for (let y = 0; y < 16; y += 3) { const w = 3 - Math.abs((y % 6) - 3); for (let dx = -w; dx <= w; dx++) px(8 + dx, y, col(0.08)); } // housing seams
  });
  R(String(BENCH), () => {
    // side view: thick slab over legs, drawer face between them
    const n = fbmFill((x, y, nn) => nn * 0.05 + (y < 5 ? 0.02 : -0.14));
    for (let x = 0; x < 16; x++) { px(x, 0, col(0.14)); px(x, 1, col(0.06)); px(x, 4, col(-0.26)); }
    for (let y = 5; y < 16; y++) for (const lx of [1, 2, 13, 14]) px(lx, y, col(0.06 + n[y * 16 + lx] * 0.02)); // legs
    for (let y = 6; y <= 10; y++) for (let x = 4; x <= 11; x++) px(x, y, col(-0.04 + n[y * 16 + x] * 0.04));    // drawer face
    for (let x = 4; x <= 11; x++) { px(x, 6, col(-0.28)); px(x, 10, col(-0.28)); }
    px(7, 8, "rgba(190,190,190,1)"); px(8, 8, "rgba(190,190,190,1)");        // handle
    for (let x = 3; x <= 12; x++) { px(x, 13, col(0.1)); px(x, 14, col(-0.3)); } // lower shelf
  });
  R("bench_top", () => {
    // top-down planks with a saw and mallet laid out
    fbmFill((x, y, nn) => nn * 0.04 + Math.sin(y * 1.7 + nn * 3) * 0.03);
    for (let x = 0; x < 16; x++) { px(x, 0, col(-0.2)); px(x, 15, col(-0.2)); }
    for (let y = 0; y < 16; y++) if (y % 5 === 4) for (let x = 0; x < 16; x++) px(x, y, col(-0.14)); // plank seams
    for (let x = 2; x <= 11; x++) px(x, 4, "rgba(160,166,178,1)");            // saw blade
    for (let x = 2; x <= 11; x += 2) px(x, 5, "rgba(120,126,140,1)");         // teeth
    px(12, 4, "rgba(96,66,40,1)"); px(13, 4, "rgba(96,66,40,1)"); px(12, 5, "rgba(80,54,32,1)"); // handle
    for (let x = 4; x <= 6; x++) px(x, 9, "rgba(120,88,54,1)");               // mallet head
    for (let x = 4; x <= 6; x++) px(x, 10, "rgba(100,72,44,1)");
    px(5, 11, "rgba(150,156,168,1)"); px(5, 12, "rgba(150,156,168,1)"); px(5, 13, "rgba(140,146,158,1)"); // shaft
    for (let i = 0; i < 6; i++) px(rng.int(0, 15), rng.int(0, 15), col(-0.06, 1, 0.02, -0.01, -0.04)); // shavings
  });
  R(String(BENCH_EXT), () => {
    fbmFill((x, y, n) => n * 0.04 - 0.14);                                   // plainer frame under the extension
    for (let x = 0; x < 16; x++) { px(x, 0, col(0.05)); px(x, 2, col(-0.24)); }
    for (let y = 3; y < 16; y++) for (const lx of [1, 2, 13, 14]) px(lx, y, col(0.04));
    for (let x = 3; x <= 12; x++) { px(x, 11, col(0.08)); px(x, 12, col(-0.26)); } // shelf
  });
  R("bench_ext_top", () => {
    fbmFill((x, y, nn) => nn * 0.04 + Math.sin(x * 1.6 + nn * 2) * 0.03);    // plain plank top
    for (let y = 0; y < 16; y++) { px(0, y, col(-0.18)); px(15, y, col(-0.18)); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 6 === 3 && rng.next() > 0.5) px(x, y, col(-0.1));
  });
  R(String(CAMPFIRE), () => {
    // side view: stone ring, crossed logs, flame painted on the block
    fbmFill((x, y, n) => n * 0.05 - 0.1);                                     // ashy base, solid (opaque block)
    for (let i = 0; i < 5; i++) pebble(2 + i * 3, 13, 1, -0.05);             // stone ring
    g.strokeStyle = "rgba(70,50,32,1)"; g.lineWidth = 2;                    // crossed logs
    g.beginPath(); g.moveTo(tx + 4, ty + 13); g.lineTo(tx + 12, ty + 9); g.stroke();
    g.beginPath(); g.moveTo(tx + 12, ty + 13); g.lineTo(tx + 4, ty + 9); g.stroke();
    g.lineWidth = 1;
    for (let y = 2; y < 10; y++) {                                          // flame, brighter up the middle
      const w = Math.max(0, 5 - Math.abs(y - 7) - (y < 5 ? 5 - y : 0));
      for (let dx = -w; dx <= w; dx++) {
        const d = Math.abs(dx) / (w + 1);
        px(8 + dx, y, col(d * 0.1, 1, 0.85 - d * 0.4, 0.35 - d * 0.25, -0.45));
      }
    }
    px(8, 1, col(0.2, 1, 0.7, 0.15, -0.4)); px(7, 3, col(0.3, 1, 0.9, 0.4, -0.4)); // sparks
  });
  R("campfire_cold", () => {
    // unlit fire: ash, stone ring, charred logs, grey embers — no flame, no glow
    fbmFill((x, y, n) => n * 0.04 - 0.22);                                   // cold ash base
    for (let i = 0; i < 5; i++) pebble(2 + i * 3, 13, 1, -0.05);             // stone ring
    g.strokeStyle = "rgba(40,34,28,1)"; g.lineWidth = 2;                    // charred crossed logs
    g.beginPath(); g.moveTo(tx + 4, ty + 13); g.lineTo(tx + 12, ty + 9); g.stroke();
    g.beginPath(); g.moveTo(tx + 12, ty + 13); g.lineTo(tx + 4, ty + 9); g.stroke();
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++)                                             // grey ember pits
      pebble(5 + (i % 3) * 3, 9 + ((i / 3) | 0) * 2, 1, 0.08 + 0.04 * (i % 2));
  });
  R("campfire_top", () => {
    fbmFill((x, y, n) => -0.12 + n * 0.05);
    for (let i = 0; i < 16; i++) {                                          // scorched ring
      const a = (i / 16) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * 5.5), 8 + Math.round(Math.sin(a) * 5.5), col(0.12));
      px(8 + Math.round(Math.cos(a) * 4), 8 + Math.round(Math.sin(a) * 4), col(-0.3, 1, 0.1, -0.02, -0.06));
    }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.5; pebble(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), 1, 0); }
    for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {               // ember glow
      const a = (i / 8) * Math.PI * 2 + r * 0.4;
      px(8 + Math.round(Math.cos(a) * r * 1.5), 8 + Math.round(Math.sin(a) * r * 1.5), col(0.2 + (3 - r) * 0.12, 1, 0.5, -0.05, -0.35));
    }
  });
  for (const w of [WATER7, WATER6, WATER5, WATER4, WATER3, WATER2, WATER1, WATER])
    R(String(w), () => {
      const n = fbmFill((x, y, nn) => nn * 0.04 + Math.sin((x + y * 0.5) * 0.8 + nn * 4) * 0.04); // drifting ripples
      for (const ry of [2, 6, 10, 14]) for (let x = 0; x < 16; x++)
        if (n[ry * 16 + x] > -0.2) px(x, ry + (x % 4 < 2 ? 0 : 1), col(0.16, 0.75));
      for (let i = 0; i < 5; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.3, 0.5)); // bubbles
    });
  R("water_side", () => {
    fbmFill((x, y, n) => n * 0.04 + y * 0.004);                             // darker with depth
    for (let x = 0; x < 16; x++) {
      if (rng.next() > 0.3) px(x, 0, col(0.22, 0.8));                       // surface shimmer line
      if (x % 3 === 0) px(x, 1 + (x % 2), col(0.1, 0.5));
    }
    for (let y = 2; y < 16; y++) if (rng.next() > 0.75) px(rng.int(0, 15), y, col(0.12, 0.4)); // rising bubbles
  });
  R(String(ADOBE), () => {
    fbmFill((x, y, n) => n * 0.08 - 0.02);                                  // sandy mix variation
    for (let y = 0; y < 16; y++)                                            // mud courses, staggered joints
      for (let x = 0; x < 16; x++)
        if (y % 5 === 4 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 3) px(x, y, col(-0.14 + nz(0.03)));
    for (let i = 0; i < 3; i++) crack(rng.int(8, 12), 0.05, -0.1);          // sun cracks
    for (let i = 0; i < 10; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.12)); // straw bits
  });
  R(String(ENGINECORE), () => {
    // dark violet casing, glowing alien core with a bright ring
    const n = fbmFill((x, y, nn) => nn * 0.06 - 0.35);
    for (let y = 0; y < 16; y++)
      if (n[y * 16 + 1] > 0.2) px(1, y, col(-0.1, 1, 0.04, 0, 0.08));       // coolant streaks
    for (let x = 0; x <= 15; x += 5) { px(x, 0, col(0.1, 1, 0.1, 0, 0.15)); px(x, 15, col(0.1, 1, 0.1, 0, 0.15)); } // conduit runs
    for (let x = 3; x <= 12; x++) for (let y = 3; y <= 12; y++) {           // hexagonal core
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const hex = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5), Math.abs((x + y) - 15) / 2);
      if (d >= 4.2) continue;
      if (hex >= 3.4) px(x, y, col(0.15, 1, 0.55, 0.15, 0.85));             // ring
      else px(x, y, col(0.32 + (3 - d) * 0.12, 1, 0.75, 0.3, 1));           // hot core
    }
    for (const [cx, cy] of [[5, 5], [10, 10], [10, 5]] as const) if ((cx + cy) % 2 === 0) px(cx, cy, col(0.45, 1, 0.8, 0.35, 1)); // facets
  });
  R(String(REGULATOR), () => {
    // steel panel: heat-exchange fins on top, glowing teal vent ring below
    const n = fbmFill((x, y, nn) => nn * 0.03 + (y % 2 === 0 ? 0.015 : -0.015) - 0.08); // brushed steel
    for (const ry of [1, 3, 5]) {
      for (let x = 2; x <= 13; x++) px(x, ry, col(-0.28));
      for (let x = 2; x <= 13; x += 3) px(x, ry - 1, col(0.12));            // fin highlights
    }
    for (let x = 4; x <= 11; x++) for (let y = 7; y <= 14; y++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 10.5));
      if (d >= 3.2) px(x, y, col(0.1 + n[y * 16 + x] * 0.05));
      else px(x, y, col(0.24 + (3 - d) * 0.1, 1, -0.05, 0.2, 0.22));        // teal vent glow
    }
    px(5, 12, col(0.15, 1, -0.1, 0.12, 0.12)); px(10, 9, col(0.15, 1, -0.1, 0.12, 0.12)); // instrument dots
    for (let y = 7; y <= 14; y++) if (y % 2 === 1) px(14, y, col(-0.2));    // pipe stub
  });
  R(String(REGULATOR_HUSK), () => {
    // the same steel panel, burned out: fins intact, vent ring dead and hollow,
    // casing scorched along the seams
    const n = fbmFill((x, y, nn) => nn * 0.03 + (y % 2 === 0 ? 0.015 : -0.015) - 0.1); // duller steel
    for (const ry of [1, 3, 5]) {
      for (let x = 2; x <= 13; x++) px(x, ry, col(-0.28));
      for (let x = 2; x <= 13; x += 3) px(x, ry - 1, col(0.08));            // fin highlights
    }
    for (let x = 4; x <= 11; x++) for (let y = 7; y <= 14; y++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 10.5));
      if (d >= 3.2) px(x, y, col(0.05 + n[y * 16 + x] * 0.05));
      else if (d >= 2.2) px(x, y, col(-0.3));                               // dead vent ring
      else px(x, y, col(-0.42));                                            // hollow throat
    }
    for (const [cx, cy] of [[5, 12], [10, 9], [7, 8]] as const) px(cx, cy, col(-0.25)); // burnt-out instruments
    for (let y = 7; y <= 14; y++) if (y % 2 === 1) px(14, y, col(-0.22));   // pipe stub, cold
    for (let i = 0; i < 5; i++) px(rng.int(1, 14), rng.int(6, 15), col(-0.18)); // scorch speckle
  });
  R(String(CACTUS), () => {
    const n = fbmFill((x, y, nn) => nn * 0.06);
    for (const rx of [2, 7, 12]) for (let y = 0; y < 16; y++) px(rx, y, col(-0.16 + n[y * 16 + rx] * 0.03)); // ribs
    for (let x = 0; x < 16; x++) if (x % 5 !== 2 && x % 5 !== 3) for (let y = 0; y < 16; y += 3)
      if (rng.next() > 0.4) px(x, y, col(0.5, 1, 0.05, 0.02, -0.05));        // spines catch light
    for (const [ax, ay] of [[4, 3], [9, 5], [6, 8], [11, 10], [3, 13], [8, 14]] as const) {
      px(ax, ay, col(0.2)); px(ax + 1, ay, col(-0.2)); px(ax, ay + 1, col(-0.2)); // areoles
    }
    px(13, 1, "rgba(214,74,130,1)"); px(1, 6, "rgba(198,58,114,1)"); px(5, 11, "rgba(214,74,130,1)"); // rare blossom
  });
  R("cactus_top", () => {
    const n = fbmFill((x, y, nn) => nn * 0.06);                              // top-down rib rings
    for (let r = 2; r <= 6; r += 2) for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * r), 8 + Math.round(Math.sin(a) * r), col(r === 6 ? -0.14 : -0.06 + n[i] * 0.05));
    }
    for (let i = 0; i < 8; i++) {                                            // crown of spines
      const a = (i / 8) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * 1.5), 8 + Math.round(Math.sin(a) * 1.5), col(0.45, 1, 0.05, 0.03, -0.04));
    }
    px(8, 8, col(0.15));
  });
  R(String(CACTUS_FRUIT), () => {
    // same ribbed column, but a magenta fruit crown
    const n = fbmFill((x, y, nn) => nn * 0.06);
    for (const rx of [2, 7, 12]) for (let y = 0; y < 16; y++) px(rx, y, col(-0.16 + n[y * 16 + rx] * 0.03));
    for (const [ax, ay] of [[4, 4], [9, 6], [6, 10], [11, 12], [3, 14]] as const) {
      px(ax, ay, col(0.2)); px(ax + 1, ay, col(-0.2)); px(ax, ay + 1, col(-0.2));
    }
    for (let y = 0; y <= 3; y++) for (let x = 5; x <= 10; x++)
      if (y === 3 || x === 5 || x === 10 || rng.next() > 0.3) px(x, y, "rgba(214,74,130,1)"); // fruit mass
    for (let i = 0; i < 9; i++) px(5 + (i % 4) * 2, Math.floor(i / 4), "rgba(238,150,190,1)"); // seed flecks
    px(6, 0, "rgba(238,150,190,1)"); px(9, 1, "rgba(248,190,214,1)");
  });
  R(String(CHEST), () => {
    // wooden crate: planks, steel band across the lid, latch plate
    fbmFill((x, y, nn) => nn * 0.05 - 0.02 + Math.sin(x * 1.3 + nn * 3) * 0.02);
    for (let x = 0; x < 16; x++) { px(x, 0, col(-0.3)); px(x, 7, col(-0.24)); px(x, 15, col(-0.3)); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 5 === 2 && y > 7 && rng.next() > 0.4) px(x, y, col(-0.12)); // lower plank seams
    for (let x = 0; x < 16; x++) { px(x, 4, "rgba(148,154,166,1)"); px(x, 5, "rgba(120,126,138,1)"); } // steel band
    for (let y = 2; y < 5; y++) for (const lx of [7, 8]) px(lx, y, "rgba(200,205,215,1)");
    px(7, 6, "rgba(40,42,48,1)"); px(8, 6, "rgba(40,42,48,1)");              // latch
    for (let i = 0; i < 4; i++) {                                            // corner brackets
      const [cx, cy] = [[0, 0], [15, 0], [0, 15], [15, 15]][i];
      px(cx, cy, col(0.2)); px(cx + (cx ? -1 : 1), cy, col(0.1)); px(cx, cy + (cy ? -1 : 1), col(0.1));
    }
  });
  R("chest_top", () => {
    fbmFill((x, y, n) => n * 0.05 + Math.sin(y * 1.4 + n * 2) * 0.02);       // lid planks
    for (let x = 0; x < 16; x++) { px(x, 0, col(-0.26)); px(x, 15, col(-0.26)); }
    for (let x = 0; x < 16; x++) if (x !== 7 && x !== 8) { px(x, 7, "rgba(148,154,166,1)"); px(x, 8, "rgba(120,126,138,1)"); }
    for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) px(rx, ry, "rgba(200,205,215,1)"); // band rivets
  });
  R(String(FARMLAND), () => {
    // tilled rows: dark packed earth scored left-to-right, damp in the furrows
    const n = fbmFill((x, y, nn) => nn * 0.1 - 0.06);
    for (const ry of [2, 6, 10, 14]) for (let x = 0; x < 16; x++) px(x, ry, col(-0.16 + nz(0.03)));
    for (const ry of [1, 5, 9, 13]) for (let x = 0; x < 16; x++)
      if (n[ry * 16 + x] > -0.1 && rng.next() > 0.55) px(x, ry, col(0.1)); // ridge crests
    for (let i = 0; i < 8; i++) px(rng.int(0, 15), rng.int(0, 15), col(0.05, 1, 0.0, -0.02, 0.04)); // grit
  });
  R("farmland_side", () => {
    fbmFill((x, y, n) => n * 0.09 - 0.04);
    for (let x = 0; x < 16; x++) px(x, 0, col(0.14));                        // packed top crust
    for (let x = 0; x < 16; x++) for (let y = 1; y < 16; y++) if (rng.next() > 0.88) px(x, y, col(0.14)); // crumbly specks
  });
  R(String(MELON_1), () => {
    fill("rgba(0,0,0,0)");
    for (const [sx, sy] of [[7, 13], [8, 13], [7, 12], [8, 12], [9, 13], [6, 12]] as const) px(sx, sy, col(0.1)); // sprout on bare dirt
    px(6, 11, col(0.16)); px(9, 10, col(0.12)); px(7, 11, col(0.02));
    for (let i = 0; i < 4; i++) px(rng.int(5, 10), rng.int(12, 15), col(-0.05));
  });
  R(String(MELON_2), () => {
    // a ripe striped melon sitting on leafy ground
    fbmFill((x, y, n) => n * 0.04 - 0.02);
    for (let y = 4; y <= 13; y++) for (let x = 2; x <= 13; x++) {            // big fruit, fills the cell
      const d = Math.hypot((x - 7.5) * 1.1, (y - 8.5) * 1.25);
      if (d > 5.8) continue;
      const stripe = (x + ((y / 2) | 0)) % 4 === 0;
      px(x, y, stripe ? col(-0.18) : col(0.04));
      if (d > 5.2) px(x, y, col(-0.24));                                     // rim shade
      if (x < 5 && y < 7 && !stripe) px(x, y, col(0.2));                     // highlight
    }
    px(8, 3, col(-0.1)); px(7, 3, col(-0.16)); px(8, 4, col(-0.08));         // stem
    px(2, 13, col(0.1)); px(13, 12, col(0.06)); px(4, 14, col(0.08));        // leaves at the base
  });
  R(String(WHEAT_1), () => {
    fill("rgba(0,0,0,0)");                                                   // crossed-quad crop: transparent bg
    for (const sx of [4, 8, 12]) {                                           // short sprout shoots
      for (let y = 11; y <= 15; y++) { px(sx, y, col(0.08)); if (y < 14) px(sx, y, col(0.14)); }
      px(sx - 1, 12, col(0.06));
    }
  });
  R(String(WHEAT_2), () => {
    fill("rgba(0,0,0,0)");
    for (const sx of [3, 7, 11, 14]) {                                       // a stand of young blades
      const bend = sx % 2 ? 1 : -1;
      for (let y = 2; y <= 15; y++) px(sx + (y < 6 ? bend : 0), y, col(y < 7 ? 0.22 : -0.02)); // golden head, green stalk
      px(sx - bend, 4, col(0.18)); px(sx - bend, 9, col(0.06));              // leaning neighbours
      px(sx + bend, 2, col(0.3));                                            // head tip
    }
  });
  R(String(CHEST_CONNECTOR), () => {
    // steel rail bolted across a crate end: the chest link
    fbmFill((x, y, n) => n * 0.03 - 0.12);
    for (let x = 0; x < 16; x++) { px(x, 0, col(-0.26)); px(x, 15, col(-0.26)); px(x, 7, "rgba(150,156,168,1)"); px(x, 8, "rgba(110,116,128,1)"); }
    for (const [rx, ry] of [[2, 3], [13, 3], [2, 12], [13, 12]] as const) { px(rx, ry, "rgba(200,205,215,1)"); px(rx + 1, ry, "rgba(150,156,168,1)"); }
    for (let y = 2; y <= 5; y++) { px(0, y, col(0.14)); px(15, y, col(0.14)); }
  });
  R(String(METAL_PLATING), () => {
    // shipboard plate: brushed metal, rivet seams
    const n = fbmFill((x, y, nn) => nn * 0.03 + (x % 4 === 0 ? -0.04 : 0.015));
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.22)); px(i, 15, col(-0.22)); px(0, i, col(-0.16)); px(15, i, col(-0.16)); }
    for (const [rx, ry] of [[3, 3], [12, 3], [3, 12], [12, 12]] as const) {
      px(rx, ry, col(0.24)); px(rx + 1, ry, col(0.08)); px(rx, ry + 1, col(-0.14));
    }
    for (let i = 0; i < 6; i++) px(rng.int(1, 14), rng.int(1, 14), col(-0.02, 1, 0.05, -0.01, -0.06)); // dents and pits
    if (n[8] > 0.4) for (let y = 1; y < 4; y++) px(12, y, col(0.06, 1, 0.2, 0.02, -0.1)); // faint rust streak
  });
  R(String(DOOR_INNER), () => {
    // lighter interior door: recessed panel, handle
    fbmFill((x, y, n) => n * 0.03 - 0.05);
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.24)); px(i, 15, col(-0.24)); px(0, i, col(-0.24)); px(15, i, col(-0.24)); }
    for (let y = 3; y <= 12; y++) for (let x = 4; x <= 11; x++)
      if (x === 4 || x === 11 || y === 3 || y === 12) px(x, y, col(0.1));
    for (let y = 7; y <= 9; y++) { px(12, y, col(0.26)); px(11, y, col(-0.22)); }
  });
  R(String(DOOR_INNER_UPPER), () => {
    fbmFill((x, y, n) => n * 0.03 - 0.05);
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.24)); px(i, 15, col(-0.24)); px(0, i, col(-0.24)); px(15, i, col(-0.24)); }
    for (let y = 5; y <= 10; y++) for (let x = 6; x <= 9; x++) px(x, y, col(0.1, 1, -0.05, 0.1, 0.15)); // slim slit
    for (let x = 6; x <= 9; x++) { const y = x - 1; if (y >= 5 && y <= 10) px(x, y, col(0.3, 0.6)); }   // slit glint
    for (let y = 5; y <= 10; y++) for (let x = 6; x <= 9; x++) if (x === 6 || x === 9 || y === 5 || y === 10) px(x, y, col(0.1, 1, -0.05, 0.1, 0.15));
  });
  R(String(DOOR_INNER_OPEN), () => {
    for (let y = 0; y < 16; y++) { px(0, y, col(-0.12, 0.9)); px(1, y, col(0.03, 0.85)); px(2, y, col(-0.17, 0.7)); }
    px(1, 7, col(0.26, 0.9)); px(1, 8, col(0.26, 0.9));
  });
  R(String(BED), () => {
    // quilted top with a folded blanket edge
    fbmFill((x, y, nn) => nn * 0.04 + 0.02);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 5 === 0) px(x, y, col(-0.1));   // stitch lines
    for (let i = 0; i < 16; i++) { px(i, 0, "rgba(60,26,24,1)"); px(i, 15, "rgba(60,26,24,1)"); px(0, i, "rgba(60,26,24,1)"); px(15, i, "rgba(60,26,24,1)"); } // wooden rail
    for (let x = 0; x < 16; x++) { px(x, 11, "rgba(90,40,36,1)"); px(x, 12, "rgba(150,80,70,1)"); px(x, 13, "rgba(120,60,52,1)"); } // folded blanket
    for (let y = 1; y < 11; y++) { px(1, y, col(0.12)); px(14, y, col(-0.08)); }                             // pillow-side sheen
  });
  R("bed_side", () => {
    // mattress over a wooden frame, seen from the side
    fbmFill((x, y, nn) => nn * 0.04 - (y > 11 ? -0.1 : 0.04));
    for (let x = 0; x < 16; x++) { px(x, 0, col(0.14)); px(x, 10, col(-0.22)); }                              // mattress piping
    for (let y = 1; y < 10; y++) for (let x = 0; x < 16; x++) if ((x + y) % 6 === 1) px(x, y, col(-0.06));    // tufts
    for (let y = 11; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, "rgba(70,44,26,1)");                  // frame
    for (let x = 2; x < 16; x += 5) { px(x, 12, "rgba(96,62,38,1)"); px(x, 13, "rgba(52,32,18,1)"); }         // slats
  });
  R(String(BED_EXT), () => {
    // pillow end of the quilt
    fbmFill((x, y, nn) => nn * 0.04 + 0.02);
    for (let i = 0; i < 16; i++) { px(i, 0, "rgba(60,26,24,1)"); px(i, 15, "rgba(60,26,24,1)"); px(0, i, "rgba(60,26,24,1)"); px(15, i, "rgba(60,26,24,1)"); }
    for (let y = 3; y <= 11; y++) for (let x = 2; x <= 13; x++) {                                            // plump pillow
      const edge = x === 2 || x === 13 || y === 3 || y === 11;
      px(x, y, edge ? "rgba(200,192,176,1)" : `rgba(226,220,206,1)`);
      if (y === 4 && x > 3 && x < 11) px(x, y, "rgba(240,236,226,1)");                                      // crease highlight
    }
    px(4, 6, "rgba(208,200,184,1)"); px(10, 9, "rgba(208,200,184,1)");                                      // stitch dimples
    for (let x = 0; x < 16; x++) { px(x, 12, "rgba(90,40,36,1)"); }
  });
  R(String(GRASS), () => {
    // icon tile: crusty green over soil, same read as the side face
    const n = fbmFill((x, y, nn) => nn * 0.12 - (y > 4 ? 0.16 : 0.02));
    for (let x = 0; x < 16; x++) {
      const h = 2 + Math.round((n[x] + 1) * 1.5);
      for (let y = 0; y < h; y++) px(x, y, col(nz(0.1) + (y === 0 ? 0.1 : 0)));
      if (rng.next() > 0.6) px(x, h + 1, col(-0.2));                                                        // root tangle
    }
    for (let x = 0; x < 16; x += 3) { const y = 7 + (x % 5); px(x, y, col(0.2)); }                           // dry tips
  });
  R("grass_top", () => {
    fbmFill((x, y, n) => n * 0.08 - 0.02);
    for (let i = 0; i < 40; i++) {                                                                          // blades as short streaks
      const x = rng.int(0, 15), y = rng.int(0, 14), l = rng.int(1, 3);
      for (let j = 0; j < l; j++) px(x, y + j, col(j === 0 ? 0.14 : -0.02 + nz(0.08)));
    }
    for (let i = 0; i < 5; i++) px(rng.int(0, 15), rng.int(0, 15), col(-0.3));                               // bare patches
  });
  R("grass_side", () => {
    const n = fbmFill((x, y, nn) => nn * 0.12 + (y < 3 ? 0.06 : -0.1));                                                 // soil body, greener crust
    for (let x = 0; x < 16; x++) {
      const h = 1 + Math.round((n[x + 16] + 1) * 1.5);
      for (let y = 0; y < h; y++) px(x, y, col(0.08 + nz(0.08)));
    }
    for (let x = 0; x < 16; x++) for (let y = 3; y < 16; y++) if (rng.next() > 0.9) px(x, y, col(0.16, 1, -0.04, -0.02, -0.04)); // roots
  });
  R(String(WOOD), () => {
    // bark: deep vertical fissures, a knot
    const n = fbmFill((x, y, nn) => nn * 0.05);
    for (let x = 0; x < 16; x++) {
      const ph = n[x] * 2;
      for (let y = 0; y < 16; y++) {
        const fiss = Math.sin(x * 1.9 + ph + Math.sin(y * 0.35) * 1.5);
        px(x, y, col(fiss > 0.75 ? -0.26 : fiss > 0.2 ? -0.1 : 0.06 + nz(0.04)));
      }
    }
    for (let r = 1; r <= 2; r++) for (let i = 0; i < 10; i++) {                                             // knot ring
      const a = (i / 10) * Math.PI * 2;
      px(9 + Math.round(Math.cos(a) * r * 1.4), 7 + Math.round(Math.sin(a) * r), col(r === 2 ? -0.3 : -0.2));
    }
    px(9, 7, col(-0.34)); px(10, 7, col(-0.28));
  });
  R("wood_top", () => {
    fbmFill((x, y, n) => n * 0.04);
    for (let i = 0; i < 44; i++) {                                                                          // annual rings
      const a = (i / 44) * Math.PI * 2;
      for (let r = 1; r < 7; r += 2) {
        const jr = r + (r % 4 === 1 ? 0.6 : 0);                                                            // uneven growth
        px(8 + Math.round(Math.cos(a) * jr), 8 + Math.round(Math.sin(a) * jr), col(r > 4 ? -0.12 : 0.05));
      }
    }
    px(8, 8, col(-0.3)); px(8, 7, col(-0.2));                                                              // pith
    for (let i = 0; i < 16; i++) { px(i, 0, col(-0.3)); px(i, 15, col(-0.3)); px(0, i, col(-0.3)); px(15, i, col(-0.3)); } // bark rim
  });
  R(String(LEAVES), () => {
    fbmFill((x, y, nn) => nn * 0.14);                                                            // dense mottle
    for (let i = 0; i < 26; i++) {                                                                         // leaf clumps
      const x = rng.int(0, 14), y = rng.int(0, 14);
      px(x, y, col(0.16)); px(x + 1, y, col(0.06)); px(x, y + 1, col(-0.1)); px(x + 1, y + 1, col(-0.2));
    }
    for (let i = 0; i < 10; i++) { const x = rng.int(1, 14), y = rng.int(1, 14); px(x, y, col(-0.4)); px(x + 1, y, col(-0.25)); } // pinholes of shade
  });
  R(String(SAPLING), () => {
    fill("rgba(0,0,0,0)");                                                                                 // crossed-quad, transparent bg
    for (let y = 6; y < 16; y++) px(8, y, col(-0.28));                                                     // bare stalk
    px(7, 15, col(-0.2)); px(9, 15, col(-0.2));                                                            // root flare
    px(7, 5, col(0.1)); px(8, 5, col(0.15)); px(9, 5, col(0.1));
    px(6, 4, col(0.05)); px(7, 4, col(0.12)); px(8, 4, col(0.18)); px(9, 4, col(0.12)); px(10, 4, col(0.05));
    px(7, 3, col(0.08)); px(8, 3, col(0.14)); px(9, 3, col(0.08));
    px(8, 2, col(0.1));
    px(6, 5, col(0.02)); px(10, 5, col(0.02));                                                             // side leaves
  });
  R(String(IRON_ORE), () => {
    fbmFill((x, y, n) => n * 0.1 - 0.02);                                                                 // rock matrix
    crack(11, 0.06, -0.14); crack(7, 0.06, -0.18);
    for (let i = 0; i < 5; i++) grain(rng.int(3, 12), rng.int(3, 12), rng.int(1, 2), -0.06, -0.05, 0.04); // grey metal bands
    speckle(12, 0.1);
  });
  R(String(COPPER_ORE), () => {
    fbmFill((x, y, n) => n * 0.1 - 0.04);
    crack(9, 0.06, -0.14);
    for (let i = 0; i < 3; i++) grain(rng.int(3, 12), rng.int(3, 12), rng.int(1, 2), 0.26, 0.04, -0.18);  // native copper
    for (let i = 0; i < 2; i++) grain(rng.int(4, 11), rng.int(4, 11), 1, -0.12, 0.16, 0.0);               // green patina
    speckle(10, 0.08);
  });
  R(String(COBALT_ORE), () => {
    fbmFill((x, y, n) => n * 0.07 - 0.24);                                                                // dark host stone
    crack(10, 0.04, -0.08);
    for (let i = 0; i < 4; i++) {                                                                         // angular blue crystals
      const cx = rng.int(4, 11), cy = rng.int(4, 11), s = rng.int(2, 3);
      for (let dy = -s; dy <= s; dy++) {
        const w = s - Math.abs(dy);
        for (let dx = -w; dx <= w; dx++) {
          const spread = Math.abs(dx) + Math.abs(dy);
          px(cx + dx, cy + dy, col(spread === s ? -0.16 : spread === 0 ? 0.4 : 0.16, 1, -0.16, -0.06, 0.3));
        }
      }
    }
  });
  R(String(ALABASTER), () => {
    const n = fbm();
    for (let y = 0; y < 16; y++) {                                                                        // pale drifting strata
      const band = Math.floor(((y + n[y * 16 + 8] * 2 + 16) % 16) / 4);
      const tone = [-0.02, 0.05, -0.06, 0.02][band % 4];
      for (let x = 0; x < 16; x++) px(x, y, col(tone + n[y * 16 + x] * 0.03 + (y % 4 === 0 ? -0.06 : 0)));
    }
    for (let i = 0; i < 3; i++) crack(rng.int(6, 10), 0.02, 0.06);                                        // calcite veins
    speckle(10, 0.05);
  });
  // shared plate shell for both thruster variants: dark welded plates, rivets,
  // rust bleeding down the seams
  const thrusterShell = (n: number[]) => {
    for (let x = 0; x < 16; x++) { px(x, 0, col(-0.22)); px(x, 15, col(-0.22)); }
    for (const sx of [0, 8]) for (let y = 1; y < 15; y++) {
      if (n[y * 16 + sx] > -0.2) px(sx, y, col(-0.16));                                                   // weld seams
      if (sx && (y === 3 || y === 7 || y === 11)) px(sx, y, col(0.2));                                    // rivets
    }
    for (let i = 0; i < 4; i++) {                                                                         // rust streaks
      const rx = rng.int(1, 14), y0 = rng.int(1, 5), len = rng.int(4, 8);
      for (let y = y0; y < Math.min(15, y0 + len); y++)
        if (rng.next() > 0.25) px(rx, y, col(-0.06 + nz(0.04), 1, 0.3, 0.05, -0.22));
    }
    for (let i = 0; i < 8; i++) px(rng.int(1, 14), rng.int(1, 14), col(-0.05));                            // dents
  };
  R(String(THRUSTER), () => {
    const n = fbmFill((x, y, nn) => nn * 0.04 - 0.1 + (x % 8 === 0 ? -0.05 : 0));                          // dark plating
    thrusterShell(n);
    for (let i = 0; i < 30; i++) {                                                                        // big nozzle ring
      const a = (i / 30) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), col(0.16));
      px(8 + Math.round(Math.cos(a) * 5), 8 + Math.round(Math.sin(a) * 5), col(-0.26));
    }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {                                   // cold throat
      if (Math.hypot(dx, dy) > 4.2) continue;
      px(8 + dx, 8 + dy, col(-0.34 + n[(8 + dy) * 16 + 8 + dx] * 0.06));
    }
  });
  R(String(THRUSTER_LIT), () => {
    const n = fbmFill((x, y, nn) => nn * 0.04 - 0.08 + (x % 8 === 0 ? -0.05 : 0));
    thrusterShell(n);
    for (let i = 0; i < 30; i++) {                                                                        // red-hot ring lip
      const a = (i / 30) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), col(0.2));
      px(8 + Math.round(Math.cos(a) * 5), 8 + Math.round(Math.sin(a) * 5), col(-0.1, 1, 0.35, 0.05, -0.3));
    }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {                                   // ember flame throat
      const d = Math.hypot(dx, dy);
      if (d > 4.2) continue;
      px(8 + dx, 8 + dy, col(0.35 - d * 0.08 + n[(8 + dy) * 16 + 8 + dx] * 0.08, 1, 0.55 - d * 0.05, 0.12 - d * 0.04, -0.45));
    }
    for (const [sx, sy] of [[3, 2], [12, 4], [5, 13], [11, 12]] as const)                                 // stray sparks
      px(sx, sy, col(0.4, 1, 0.5, 0.1, -0.35));
  });
  R(String(STORM_BREAKER), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.22 + (x % 4 === 0 ? -0.04 : 0));                                  // dark pylon casing
    for (let y = 0; y < 16; y++) { px(2, y, col(-0.16)); px(13, y, col(-0.16)); }                         // side rails
    for (const y of [2, 13]) for (let x = 3; x < 13; x++) px(x, y, col(0.12));                            // end bands
    for (let y = 4; y <= 11; y++) {                                                                       // humming red core
      const w = y === 4 || y === 11 ? 1 : 2;
      for (let dx = -w; dx <= w; dx++) {
        const hot = w - Math.abs(dx);
        px(8 + dx, y, col(0.2 + hot * 0.15 + (y % 2) * 0.05, 1, 0.45 + hot * 0.1, 0.18, -0.5));
      }
    }
    for (let i = 0; i < 6; i++) px(rng.int(3, 12), rng.int(3, 12), col(-0.05));                           // dents
  });
  R(String(STORM_BREAKER_HUSK), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.1 + (x % 4 === 0 ? -0.04 : 0));                                   // same casing, unfaded by the hum
    for (let y = 0; y < 16; y++) { px(2, y, col(-0.1)); px(13, y, col(-0.1)); }                            // side rails
    for (const y of [2, 13]) for (let x = 3; x < 13; x++) px(x, y, col(0.08));                             // end bands
    for (let y = 4; y <= 11; y++) {                                                                        // dead core: soot where the light was
      const w = y === 4 || y === 11 ? 1 : 2;
      for (let dx = -w; dx <= w; dx++) px(8 + dx, y, col(-0.3 - (w - Math.abs(dx)) * 0.06));
    }
    for (let i = 0; i < 8; i++) px(rng.int(3, 12), rng.int(3, 12), col(-0.15));                            // burns
  });
  R(String(ARMORY), () => {
    fbmFill((x, y, nn) => nn * 0.04 - 0.18);                                                             // dark forge-room stone
    for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) px(x, y, col(0.1));                          // iron lintel
    for (const x of [3, 12]) for (let y = 3; y <= 5; y++) px(x, y, col(-0.28));                           // hanging chains
    px(3, 6, col(-0.1)); px(12, 6, col(-0.1));                                                           // hooks with gear
    for (let x = 5; x <= 10; x++) px(x, 7, col(0.14));                                                   // anvil face
    for (let x = 6; x <= 8; x++) { px(x, 8, col(-0.06)); px(x, 9, col(-0.22)); }                          // anvil body
    for (let y = 11; y <= 14; y++) {                                                                     // forge mouth aglow
      for (let x = 4; x <= 11; x++) {
        const d = Math.abs(x - 7.5) + Math.abs(y - 12.5);
        px(x, y, col(0.25 - d * 0.04 + (rng.next() * 0.08), 1, 0.55 - d * 0.03, 0.18 - d * 0.03, -0.5));
      }
    }
    for (let x = 3; x <= 12; x++) px(x, 10, col(0.08)); px(3, 15, col(0.06)); px(12, 15, col(0.06));      // hearth lip
    for (const [sx, sy] of [[6, 3], [9, 4], [7, 2]] as const) px(sx, sy, col(0.45, 1, 0.5, 0.12, -0.35)); // rising sparks
  });
  R(String(POWER_PANEL), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.12 + (y % 5 === 0 ? -0.04 : 0));                                 // steel cabinet
    for (const y of [0, 15]) for (let x = 0; x < 16; x++) px(x, y, col(-0.26));                          // frame rails
    for (let y = 3; y <= 9; y++) for (let x = 4; x <= 11; x++) {                                        // breaker window
      const edge = y === 3 || y === 9 || x === 4 || x === 11;
      px(x, y, edge ? col(0.16) : col(-0.3 + (x - 4) * 0.02, 1, 0.5, 0.42, -0.1));                       // amber gauge glass
    }
    for (let y = 4; y <= 8; y++) px(7 + ((y % 2) ? 1 : 0), y, col(0.42, 1, 0.55, 0.2, -0.45));           // tripped red needle
    for (let x = 4; x <= 11; x++) px(x, 12, col(0.2));                                                  // big reset lever
    px(6, 11, col(-0.2)); px(7, 11, col(0.28)); px(8, 13, col(-0.2));                                   // lever knuckle
    for (const [bx, by] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) px(bx, by, col(0.24));         // corner bolts
  });
  R(String(POWER_POLE), () => {
    fbmFill((x, y, nn) => nn * 0.04 - 0.05 + (Math.abs(x - 7.5) < 1.6 ? 0.1 : -0.2));                   // timber mast, sky darker
    for (let y = 0; y < 16; y++) { px(7, y, col(0.06)); px(8, y, col(-0.02)); }                          // grain down the mast
    for (let x = 3; x <= 12; x++) { px(x, 3, col(0.14)); px(x, 4, col(-0.14)); }                         // crossarm
    for (const x of [4, 8, 11]) px(x, 2, col(0.3, 1, -0.1, 0.2, 0.45));                                 // ceramic insulators
    for (let x = 0; x < 16; x++) px(x, 1, (x * x) % 3 === 0 ? col(0.1, 1, -0.15, 0.25, 0.5) : col(0));  // copper wire sag
  });
  R(String(GEN_WOOD), () => {
    fbmFill((x, y, nn) => nn * 0.04 - 0.1 + (x % 6 === 0 ? -0.05 : 0));                                 // riveted boiler casing
    for (const y of [1, 14]) for (let x = 2; x <= 13; x++) px(x, y, col(0.12));                          // bands
    for (let y = 6; y <= 12; y++) for (let x = 4; x <= 11; x++) {                                       // firebox door
      const d = Math.abs(x - 7.5) + Math.abs(y - 9.5);
      px(x, y, d > 4 ? col(-0.24) : col(0.3 - d * 0.05, 1, 0.55 - d * 0.04, 0.22 - d * 0.04, -0.55));    // embers behind
    }
    for (let y = 2; y <= 5; y++) { px(3, y, col(-0.2)); px(12, y, col(-0.2)); }                          // stack flues
    for (let i = 0; i < 10; i++) px(rng.int(2, 13), rng.int(2, 13), col(-0.06));                         // rivet dents
  });
  R(String(WATER_WHEEL), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.02);                                                            // pale timber
    for (let i = 0; i < 24; i++) {                                                                      // wheel rim
      const a = (i / 24) * Math.PI * 2;
      px(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), col(0.12));
      px(8 + Math.round(Math.cos(a) * 5), 8 + Math.round(Math.sin(a) * 5), col(-0.18));
    }
    for (let s = 0; s < 6; s++) {                                                                       // spokes and paddles
      const a = (s / 6) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      for (let r = 1; r <= 5; r++) px(8 + Math.round(cx * r), 8 + Math.round(cy * r), col(0.05));
      px(8 + Math.round(cx * 5) + 1, 8 + Math.round(cy * 5), col(0.2));
    }
    px(7, 7, col(0.25)); px(8, 7, col(0.25)); px(7, 8, col(0.15)); px(8, 8, col(0.15));                 // hub
    for (let x = 0; x < 16; x += 2) px(x, 14 + (x % 4 === 0 ? 0 : 1), col(0.1, 1, -0.2, 0.12, 0.5));    // current at the foot
  });
  R(String(WIND_TURBINE), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.04);                                                            // pale sky plate
    for (let s = 0; s < 3; s++) {                                                                       // three white blades
      const a = (s / 3) * Math.PI * 2 + 0.4;
      for (let r = 1; r <= 7; r++) {
        px(8 + Math.round(Math.cos(a) * r), 8 + Math.round(Math.sin(a) * r), col(0.26 - r * 0.012));
        px(8 + Math.round(Math.cos(a) * r) + (Math.abs(Math.sin(a)) < 0.5 ? 1 : 0), 8 + Math.round(Math.sin(a) * r), col(0.1));
      }
    }
    px(7, 7, col(-0.15)); px(8, 7, col(-0.1)); px(7, 8, col(-0.12)); px(8, 8, col(-0.06));              // nacelle
    for (let y = 9; y < 16; y++) { px(7, y, col(-0.05)); px(8, y, col(-0.16)); }                        // tower
  });
  R(String(SOLAR_PANEL), () => {
    fbmFill((x, y, nn) => nn * 0.02 - 0.36);                                                            // deep glass
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x % 4 === 0 || y % 5 === 0) px(x, y, col(0.22));                                              // bus bars
    }
    for (const [rx, ry] of [[10, 2], [11, 3], [12, 4], [13, 5]] as const) px(rx, ry, col(0.3, 0.8));    // sun glint
    for (const y of [0, 15]) for (let x = 0; x < 16; x++) px(x, y, col(0.05));                          // aluminium frame
    for (const x of [0, 15]) for (let y = 1; y < 15; y++) px(x, y, col(0.05));
  });
  R(String(BATTERY), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.16 + (y % 6 === 0 ? -0.05 : 0));                               // green cell case
    for (const y of [2, 13]) for (let x = 3; x <= 12; x++) px(x, y, col(0.14));                         // end straps
    for (const x of [4, 7, 10]) for (let y = 4; y <= 11; y++) px(x, y, col(0.32, 1, -0.25, 0.4, 0.15)); // charge plates
    for (let x = 4; x <= 11; x++) px(x, 0, col(0.1, 1, 0.35, 0.1, -0.3));                               // hot terminal
    px(5, 1, col(-0.3)); px(10, 1, col(-0.3));                                                         // vent plugs
  });
  R(String(ELEC_LAMP), () => {
    fill(col(-0.32));                                                                                 // dark fixture back
    for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {                                      // cold white glass
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(x, y, d > 3 ? col(0.1) : col(0.4 - d * 0.06, 1, -0.05, 0.08, 0.25));
    }
    for (const y of [4, 11]) for (let x = 3; x <= 12; x++) px(x, y, col(0.2));                         // steel cage rings
    for (const x of [3, 12]) for (let y = 4; y <= 11; y++) px(x, y, col(0.16));                        // cage bars
    for (const [rx, ry] of [[6, 2], [9, 2]] as const) px(rx, ry, col(0.22));                           // stem mount
  });
  R(String(INSERTER), () => {
    fill(col(-0.34));                                                                                 // dark base plate
    for (const x of [0, 15]) for (let y = 0; y < 16; y++) px(x, y, col(-0.1, 1, -0.2, 0.05, 0.1));     // teal edge rails
    for (let y = 6; y <= 9; y++) for (let x = 1; x <= 6; x++) px(x, y, col(0.12));                     // housing (the behind side)
    px(3, 7, col(0.3, 1, -0.2, 0.35, 0.1)); px(3, 8, col(0.3, 1, -0.2, 0.2, 0.1));                     // status eye
    for (let i = 0; i < 4; i++) {                                                                     // segmented arm reaching forward
      const ax = 7 + i * 2, ay = 8 - i;
      for (let t = 0; t < 2; t++) px(ax + t, ay, col(0.24 - i * 0.03));
      px(ax + 1, ay + 1, col(0.02));
    }
    for (const y of [3, 4, 5]) px(14, y, col(0.3, 1, -0.1, 0.3, 0.15));                                // gripper open at the front
    for (let x = 1; x <= 6; x++) px(x, 12, col(0.06)); px(2, 13, col(0.2, 1, -0.2, 0.1, 0.2)); px(5, 13, col(0.2, 1, -0.2, 0.1, 0.2)); // current feed
  });
  R(String(PLANTER), () => {
    fbmFill((x, y, nn) => nn * 0.03 - 0.22 + (y < 3 ? -0.1 : 0));                                      // soil-dark tray body
    for (let x = 0; x < 16; x++) { px(x, 2, col(0.16)); px(x, 13, col(0.08)); }                        // tray rims
    for (const x of [0, 15]) for (let y = 2; y <= 13; y++) px(x, y, col(0.1));
    for (const x of [3, 7, 11]) for (let y = 4; y <= 8; y++) px(x, y, col(0.34, 1, 0.25, 0.2, -0.25)); // three sprout columns
    for (const x of [4, 8, 12]) { px(x, 3, col(0.4, 1, 0.3, 0.1, -0.3)); px(x - 1, 4, col(0.3, 1, 0.2, 0.1, -0.2)); } // leaves
    for (let x = 5; x <= 10; x++) px(x, 10, col(-0.05));                                               // seed port below
    px(7, 11, col(0.3, 1, -0.2, 0.2, 0.1)); px(8, 11, col(0.3, 1, -0.2, 0.2, 0.1));                   // current pilot
  });
  R(String(HARVESTER), () => {
    fill(col(-0.3));                                                                                  // bronze housing
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x === 0 || x === 15 || y === 0 || y === 15) px(x, y, col(0.08));
    for (let i = 0; i < 4; i++) {                                                                     // rotating reel teeth
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      for (let r = 1; r <= 6; r += 2) px(8 + Math.round(Math.cos(a) * r), 7 + Math.round(Math.sin(a) * r), col(0.34 - r * 0.02, 1, 0.1, 0.15, -0.1));
    }
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) px(8 + dx, 7 + dy, col(0.12)); // reel hub
    for (let x = 5; x <= 10; x++) px(x, 12, col(0.16)); px(5, 13, col(0.3, 1, -0.1, 0.15, 0.1));       // output chute down
    px(7, 3, col(0.3, 1, -0.2, 0.25, 0.1)); px(8, 3, col(0.3, 1, -0.2, 0.15, 0.1));                    // harvest eye
  });

  // paint every registered tile into its slot
  const paint = (key: string, t: number, rgb: readonly number[]) => {
    if (!recipes[key]) return;
    tx = (t % ATLAS_COLS) * TILE_PX; ty = ((t / ATLAS_COLS) | 0) * TILE_PX;
    [br, bg, bb] = rgb as [number, number, number];
    recipes[key]();
  };
  for (const [i, id] of TILE_LIST.entries()) paint(String(id), i, BLOCKS[id].color);
  for (const [name, base] of VARIANTS) paint(name, VI[name], BLOCKS[base].color);

  atlasCv = cv;
  return cv;
}

function makeAtlasTexture(): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(getAtlasCanvas());
  tex.flipY = false; // mesher computes v from canvas top-left; default flip would sample blank rows
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// block id -> tile index (exported so item icons can sample the same atlas)
export const TILE: number[] = [];
TILE_LIST.forEach((id, i) => (TILE[id] = i));
// the chamfered hull shapes draw with the plain HULL plating, so they share
// its tile; icons sample the same sheet
TILE[CURVED_HULL] = TILE[HULL];
TILE[HULL_SLOPE] = TILE[HULL];
export const ATLAS_PX = ATLAS_COLS * TILE_PX;
export const TILE_SRC = (id: number): [number, number] => {
  const t = TILE[id] ?? 0;
  return [(t % ATLAS_COLS) * TILE_PX, ((t / ATLAS_COLS) | 0) * TILE_PX];
};

// per-face tile for the mesher: FACES order is +y, -y, +x, -x, +z, -z
export const FACE_T: number[] = [];
const setFaces = (id: number, top: number, bottom: number, side: number) => {
  FACE_T[id * 6] = top; FACE_T[id * 6 + 1] = bottom;
  for (let f = 2; f < 6; f++) FACE_T[id * 6 + f] = side;
};
for (const id of TILE_LIST) setFaces(id, TILE[id], TILE[id], TILE[id]);
setFaces(GRASS, VI.grass_top, TILE[DIRT], VI.grass_side);
setFaces(WOOD, VI.wood_top, VI.wood_top, TILE[WOOD]);
setFaces(FARMLAND, TILE[FARMLAND], TILE[DIRT], VI.farmland_side);
setFaces(SANDSTONE, VI.sandstone_top, TILE[SANDSTONE], TILE[SANDSTONE]);
setFaces(HULL, VI.hull_top, TILE[HULL], TILE[HULL]);
// hull shapes pick their FACE_T slot by kind in emitShape; chamfer facets use
// the side tile, the top octagon/square the sun-bleached hull top
setFaces(CURVED_HULL, VI.hull_top, TILE[HULL], TILE[HULL]);
setFaces(HULL_SLOPE, VI.hull_top, TILE[HULL], TILE[HULL]);
setFaces(BED, TILE[BED], TILE[BED], VI.bed_side);
setFaces(BED_EXT, TILE[BED_EXT], TILE[BED_EXT], VI.bed_side);
setFaces(CHEST, VI.chest_top, TILE[CHEST], TILE[CHEST]);
setFaces(BENCH, VI.bench_top, TILE[BENCH], TILE[BENCH]);
setFaces(BENCH_EXT, VI.bench_ext_top, TILE[BENCH_EXT], TILE[BENCH_EXT]);
setFaces(CAMPFIRE, VI.campfire_top, TILE[CAMPFIRE], TILE[CAMPFIRE]);
setFaces(CACTUS, VI.cactus_top, TILE[CACTUS], TILE[CACTUS]);
setFaces(CACTUS_FRUIT, VI.cactus_top, TILE[CACTUS], TILE[CACTUS_FRUIT]);
for (const w of [WATER, WATER7, WATER6, WATER5, WATER4, WATER3, WATER2, WATER1])
  setFaces(w, TILE[w], TILE[w], VI.water_side);

// ---------------- sky-mode shader ----------------
// Baked-light chunk material: vertex `light` (0..1) is the flood-filled
// skylight at the face's air cell; a global day factor tints it warm by day
// and blue-moonlit at night, and the dynamic point lights are evaluated in
// the fragment so lamps still work with no scene lights on the world.

const MAX_SKY_LIGHTS = 16;

const SKY_VS = `
attribute vec3 color;
attribute float light;
varying vec2 vUv;
varying vec3 vSh;        // x = face shading, y = baked skylight 0..1
varying vec3 vPos;
varying vec3 vNrm;
varying float vFogDepth;
void main() {
  vUv = uv;
  vSh = vec3(color.r, light, 0.0);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FS = `
uniform sampler2D map;
uniform vec3 uAmbient;      // day/moon ambient, lerped by the caller
uniform float uFloor;       // ambient floor for baked-light 0 (interiors)
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uNumLights;
uniform vec3 uLightPos[${MAX_SKY_LIGHTS}];
uniform vec3 uLightCol[${MAX_SKY_LIGHTS}];
uniform float uLightRange[${MAX_SKY_LIGHTS}];
varying vec2 vUv;
varying vec3 vSh;
varying vec3 vPos;
varying vec3 vNrm;
varying float vFogDepth;
void main() {
  vec4 tex = texture2D(map, vUv);
  #ifdef OPAQUE_PASS
  if (tex.a < 0.02) discard;
  #endif
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  float baked = vSh.y;
  vec3 col = tex.rgb * vSh.x * uAmbient * (uFloor + (1.0 - uFloor) * baked);
  for (int i = 0; i < ${MAX_SKY_LIGHTS}; i++) {
    if (float(i) >= uNumLights) break;
    float range = uLightRange[i];
    vec3 d = uLightPos[i] - vPos;
    float dist = length(d);
    float att = 1.0 - dist / range;
    if (att <= 0.0) continue;
    att *= att;
    col += tex.rgb * vSh.x * uLightCol[i] * att *
      (0.35 + 0.65 * max(dot(n, d / max(dist, 0.001)), 0.0));
  }
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  gl_FragColor = vec4(col, tex.a);
  #include <colorspace_fragment>
}
`;

const _dir = new THREE.Vector3();
const _p3 = new THREE.Vector3();
const _dayAmb = new THREE.Color(1.0, 0.97, 0.9);     // linear: bright warm-neutral noon
const _nightAmb = new THREE.Color(0.2, 0.27, 0.45);  // linear: dim blue moonlight
const _dustCol = new THREE.Color(0.72, 0.55, 0.35);  // a wall of airborne sand

export class Renderer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private three: THREE.WebGLRenderer;
  private chunkMeshes = new Map<string, THREE.Mesh[]>();
  private group = new THREE.Group();
  private entityGroup = new THREE.Group();
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private stars: THREE.Points;
  private sunDisc: THREE.Mesh;
  private dust: THREE.Points;
  private stormI = 0;       // sandstorm intensity 0..1 (setStorm)
  private cozyI = 0;        // inside-a-Base crossfade 0..1 (setCozy)
  private stormOpen = true; // is the player under open sky (dust rides only there)
  private moonDisc: THREE.Mesh;
  private highlight: THREE.LineSegments;
  renderDistance = 7;

  private atlas = makeAtlasTexture();
  matOpaque = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide });
  matEmissive = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide });
  matTrans = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  /** active lighting: baked skylight (default) or real-time directional shadows */
  lightingMode: "sky" | "shadow" = "sky";
  private skyLight = new SkyLighting();
  /** baked-light consistency queue: chunks whose light map lags a neighbor */
  private lightRecheck = new Set<string>();

  private skyU = {
    map: { value: this.atlas },
    uAmbient: { value: new THREE.Color(1, 1, 1) },
    uFloor: { value: 0.16 },
    uFogColor: { value: new THREE.Color(0, 0, 0) },
    uFogNear: { value: 40 },
    uFogFar: { value: 340 },
    uNumLights: { value: 0 },
    uLightPos: { value: Array.from({ length: MAX_SKY_LIGHTS }, () => new THREE.Vector3()) },
    uLightCol: { value: Array.from({ length: MAX_SKY_LIGHTS }, () => new THREE.Vector3()) },
    uLightRange: { value: new Float32Array(MAX_SKY_LIGHTS) },
  };
  matSky = new THREE.ShaderMaterial({
    uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
    side: THREE.DoubleSide, defines: { OPAQUE_PASS: "1" },
  });
  matSkyT = new THREE.ShaderMaterial({
    uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  });

  torch: THREE.PointLight;
  /** Head Lantern light: shown at the player's head while a lantern is on */
  private playerLight: THREE.PointLight;
  private dynLights: { x: number; y: number; z: number; light: THREE.PointLight; flame: boolean }[] = [];
  /** live campfire fuel charges ("x,y,z" -> heat units); the mesher dims
   *  unlit fires, the game owns the map and mutates it in place. */
  fires = new Map<string, number>();
  private ghost: THREE.Mesh | null = null;
  private ghostGeos = new Map<string, THREE.BufferGeometry>();
  private matGhost = new THREE.MeshBasicMaterial({
    map: this.atlas, vertexColors: true, transparent: true, opacity: 0.55,
    depthWrite: false, side: THREE.DoubleSide,
  });

  constructor(canvasParent: HTMLElement) {
    this.three = new THREE.WebGLRenderer({ antialias: false });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.three.setSize(innerWidth, innerHeight);
    canvasParent.appendChild(this.three.domElement);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200);
    this.scene.add(this.group, this.entityGroup, this.camera);
    // headlamp: bright at night, near-off at noon; lights must be in the scene graph
    this.torch = new THREE.PointLight(0xffd2a0, 0.4, 17, 1.4);
    this.torch.position.set(0.25, -0.15, 0.1);
    this.camera.add(this.torch);
    // head lantern: a world-space warm light toggled by setPlayerLight
    this.playerLight = new THREE.PointLight(0xffd76a, 2.4, 20, 1.4);
    this.playerLight.visible = false;
    this.scene.add(this.playerLight);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.hemi = new THREE.HemisphereLight(0xbfd4e6, 0x8a7455, 0.55);
    this.scene.add(this.sun, this.hemi);
    // real-time shadows (shadow mode): a 2048 map over an ~80-wide box that
    // follows the player; armed by setLightingMode("shadow")
    const sc = this.sun.shadow.camera;
    this.sun.shadow.mapSize.set(2048, 2048);
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 320;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.Fog(0xd8c9a0, 40, this.renderDistance * CS);

    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1);
      sp.push(Math.sin(b) * Math.cos(a) * 400, Math.abs(Math.cos(b)) * 400, Math.sin(b) * Math.sin(a) * 400);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);
    // sun and moon discs: unlit billboards riding the sky dome
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false, side: THREE.DoubleSide, toneMapped: false }));
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(15, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8e2f5, fog: false, side: THREE.DoubleSide, toneMapped: false }));
    this.scene.add(this.sunDisc, this.moonDisc);
    // sandstorm dust: a tumbling cloud of grit that rides along with the camera
    const dustGeo = new THREE.BufferGeometry();
    const dp: number[] = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 16;
      dp.push(Math.cos(a) * r, (Math.random() - 0.35) * 14, Math.sin(a) * r);
    }
    dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd6b98c, size: 0.3, transparent: true, opacity: 0, depthWrite: false }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    const hl = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(hl), new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.three.setSize(innerWidth, innerHeight);
    });
  }

  setQuality(q: "low" | "med" | "high") {
    this.three.setPixelRatio(q === "low" ? 0.75 : q === "med" ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 2));
  }

  canvasEl(): HTMLCanvasElement { return this.three.domElement; }

  resetChunkMeshes() {
    for (const ms of this.chunkMeshes.values())
      for (const m of ms) { this.group.remove(m); m.geometry.dispose(); }
    this.chunkMeshes.clear();
  }

  addPointLight(x: number, y: number, z: number, kind: "lamp" | "fire" | "cool" | "elec") {
    if (this.dynLights.length >= 12 || this.dynLights.some((d) => d.x === x && d.y === y && d.z === z)) return;
    const light = new THREE.PointLight(
      kind === "lamp" ? 0xfff0b0 : kind === "fire" ? 0xff8340 : kind === "cool" ? 0x8fd8ff : 0xcfe4ff,
      kind === "lamp" ? 0.9 : kind === "fire" ? 1.1 : kind === "cool" ? 0.8 : 1.35,
      kind === "lamp" ? 12 : kind === "fire" ? 9 : kind === "cool" ? 10 : 16, 1.3);
    light.position.set(x + 0.5, y + 0.6, z + 0.5);
    this.scene.add(light);
    this.dynLights.push({ x, y, z, light, flame: kind === "fire" });
  }

  hasPointLight(x: number, y: number, z: number): boolean {
    return this.dynLights.some((d) => d.x === x && d.y === y && d.z === z);
  }

  removePointLight(x: number, y: number, z: number) {
    const i = this.dynLights.findIndex((d) => d.x === x && d.y === y && d.z === z);
    if (i < 0) return;
    this.scene.remove(this.dynLights[i].light);
    this.dynLights.splice(i, 1);
  }

  /** Translucent preview of the block the held item would place at x,y,z —
   *  the block's real shape and texture, drawn full-bright at 55 %. */
  setGhost(x: number, y: number, z: number, id: number, rot = 0) {
    if (!this.ghost) {
      this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.matGhost);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
        new THREE.LineBasicMaterial({ color: 0xd8b74f, transparent: true, opacity: 0.7 }));
      edges.position.set(0.5, 0.5, 0.5);
      this.ghost.add(edges);
      this.ghost.renderOrder = 5;
      this.scene.add(this.ghost);
    }
    const key = `${id}:${rot}`;
    let geo = this.ghostGeos.get(key);
    if (!geo) { geo = this.buildGhostGeo(id, rot); this.ghostGeos.set(key, geo); }
    this.ghost.geometry = geo;
    this.ghost.position.set(x, y, z);
    this.ghost.visible = true;
  }

  /** Real-shape faces for one cell: models where the block has one, textured
   *  cubes otherwise — no neighbour culling, no light, geometry is cell-local. */
  private buildGhostGeo(id: number, rot: number): THREE.BufferGeometry {
    let faces: ShapeFace[];
    if (DOOR_BLOCKS.has(id)) faces = always(slabFaces(0.04, 0, 0.02, 0.96, 1, 0.16));
    else if (CROSS_BLOCKS.has(id)) faces = always([
      shapeFace([1, 0, 1], 2, 0.92, [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]], (p) => [p[0], p[1]]),
      shapeFace([1, 0, -1], 2, 0.92, [[0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1]], (p) => [p[0], p[1]]),
    ]);
    else if (id === CURVED_HULL || id === HULL_SLOPE) faces = HULL_SHAPES[id].filter((f) => !f.fill);
    else if (id === BENCH) faces = BENCH_MODEL;
    else if (id === BENCH_EXT) faces = BENCHX_MODEL;
    else if (id >= WATER7 && id <= WATER1) faces = slabFaces(0, 0, 0, 1, (33 - id) / 8, 1);
    else faces = FACES.map((f, fi) => ({
      dir: f.dir, kind: (fi === 0 ? 0 : fi === 1 ? 1 : 2) as 0 | 1 | 2,
      pts: f.corners as [number, number, number][], sh: f.shade,
      uv: (p: [number, number, number]) => [p[f.uv[0]], p[f.uv[1]]] as [number, number],
    }));
    // only the shape-bearing blocks turn with the rotation nibble
    if (rot && (DOOR_BLOCKS.has(id) || id === CURVED_HULL || id === HULL_SLOPE || id === BENCH || id === BENCH_EXT))
      faces = rotShapes(faces, rot);
    const P: number[] = [], C: number[] = [], U: number[] = [], I: number[] = [];
    for (const f of faces) {
      const ft = FACE_T[id * 6 + f.kind];
      const tx0 = (ft % ATLAS_COLS) * TILE_PX, ty0 = ((ft / ATLAS_COLS) | 0) * TILE_PX;
      const base = P.length / 3;
      for (const p of f.pts) {
        P.push(p[0], p[1], p[2]);
        C.push(f.sh, f.sh, f.sh);
        const [u, v] = f.uv(p);
        U.push((tx0 + 0.5 + u * (TILE_PX - 1)) / ATLAS_PX, (ty0 + 0.5 + v * (TILE_PX - 1)) / ATLAS_PX);
      }
      for (let t = 1; t + 1 < f.pts.length; t++) I.push(base, base + t, base + t + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(I);
    geo.computeVertexNormals();
    return geo;
  }
  clearGhost() { if (this.ghost) this.ghost.visible = false; }

  dispose() {
    this.resetChunkMeshes();
    for (const d of this.dynLights) this.scene.remove(d.light);
    this.dynLights.length = 0;
    this.three.dispose();
    this.three.domElement.remove();
  }

  keyframe(frac: number): { sky: THREE.Color; sunColor: THREE.Color; sunElev: number; sunI: number; dayT: number } {
    // frac 0..1 day; sunrise .25, sunset .75
    const sunAngle = (frac - 0.25) * Math.PI * 2;
    const elev = Math.sin(sunAngle);
    const dayT = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
    const dawnT = THREE.MathUtils.clamp(1 - Math.abs(elev) * 5, 0, 1);
    const night = new THREE.Color(0x0a1226), dawn = new THREE.Color(0xc96f3d), day = new THREE.Color(0xbfcfe0);
    const sky = night.clone().lerp(day, dayT);
    if (dawnT > 0) sky.lerp(dawn, dawnT * 0.7);
    const sunColor = new THREE.Color(0xffd9a0).lerp(new THREE.Color(0xff7b3f), dawnT);
    return { sky, sunColor, sunElev: elev, sunI: Math.max(0.06, elev * 1.15), dayT };
  }

  updateSky(worldTime: number, playerPos: THREE.Vector3) {
    const frac = (worldTime % DAY_SECONDS) / DAY_SECONDS;
    const kf = this.keyframe(frac);
    this.scene.background = kf.sky;
    (this.scene.fog as THREE.Fog).color.copy(kf.sky);
    (this.scene.fog as THREE.Fog).far = this.renderDistance * CS * 0.98;
    (this.scene.fog as THREE.Fog).near = 40; // base reach; storm/cozy pull it in below
    // sandstorm: the world goes rust, the view closes in, the light drowns
    if (this.stormI > 0.01) {
      const f = this.scene.fog as THREE.Fog;
      f.color.lerp(_dustCol, Math.min(1, this.stormI * 0.85));
      f.near = THREE.MathUtils.lerp(40, 4, this.stormI);
      f.far = Math.min(f.far, THREE.MathUtils.lerp(this.renderDistance * CS, 24, this.stormI));
      this.scene.background = f.color;
    }
    // inside a Base the view closes in: rooms feel small and close, never vast
    if (this.cozyI > 0.01) {
      const f = this.scene.fog as THREE.Fog;
      f.near = Math.min(f.near, THREE.MathUtils.lerp(f.near, 3, this.cozyI));
      f.far = Math.min(f.far, THREE.MathUtils.lerp(f.far, 60, this.cozyI));
    }
    const a = (frac - 0.25) * Math.PI * 2;
    // light direction: the sun's arc by day, the mirrored moon arc at night
    _dir.set(Math.cos(a), kf.sunElev, 0.4).normalize();
    if (kf.sunElev < 0) {
      // night: a cool moonlight takes over from the sun, from the moon's side
      this.sun.color.setHex(0x9db4e8);
      this.sun.intensity = 0.28;
      _dir.negate();
    } else {
      this.sun.color.copy(kf.sunColor);
      this.sun.intensity = kf.sunI;
    }
    this.sun.position.set(playerPos.x + _dir.x * 120, playerPos.y + _dir.y * 120, playerPos.z + _dir.z * 120);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();
    this.hemi.intensity = 0.22 + kf.sunI * 0.35;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - kf.sunI * 3);
    this.stars.position.set(playerPos.x, playerPos.y, playerPos.z);
    // discs follow the same arc as the sun light; the moon rides opposite it
    const R = 430;
    this.sunDisc.position.set(playerPos.x + Math.cos(a) * R, playerPos.y + Math.sin(a) * R, playerPos.z + R * 0.4);
    this.moonDisc.position.set(playerPos.x - Math.cos(a) * R, playerPos.y - Math.sin(a) * R, playerPos.z - R * 0.4);
    this.sunDisc.lookAt(this.camera.position);
    this.moonDisc.lookAt(this.camera.position);
    this.sunDisc.visible = Math.sin(a) > -0.12;
    this.moonDisc.visible = Math.sin(a) < 0.12;
    if (this.stormI > 0.01) {
      this.sun.intensity *= 1 - this.stormI * 0.75;
      this.hemi.intensity *= 1 - this.stormI * 0.55;
      this.sunDisc.visible &&= this.stormI < 0.5;
      this.moonDisc.visible &&= this.stormI < 0.5;
      (this.stars.material as THREE.PointsMaterial).opacity *= 1 - this.stormI;
      // grit swirls only where the storm itself is — not in your shelter or down a mineshaft
      (this.dust.material as THREE.PointsMaterial).opacity = this.stormOpen ? this.stormI * 0.75 : 0;
      this.dust.position.set(this.camera.position.x, this.camera.position.y + 2, this.camera.position.z);
      this.dust.rotation.y = worldTime * 0.7;
    } else if ((this.dust.material as THREE.PointsMaterial).opacity > 0) {
      (this.dust.material as THREE.PointsMaterial).opacity = 0;
    }
    this.torch.intensity = 0.12 + (1 - Math.min(1, kf.sunI)) * 0.85;
    for (const d of this.dynLights)
      if (d.flame) d.light.intensity = 0.9 + noise1(worldTime * 5.3 + d.x * 3.1 + d.z, 7) * 0.45;
    // baked-light shader: day→moon ambient, current fog, dynamic point lights
    const u = this.skyU;
    u.uAmbient.value.copy(_nightAmb).lerp(_dayAmb, kf.dayT);
    const fog = this.scene.fog as THREE.Fog;
    u.uFogColor.value.copy(fog.color);
    u.uFogNear.value = fog.near;
    u.uFogFar.value = fog.far;
    this.syncSkyLights();
    return kf;
  }

  /** mirror torch + dynamic point lights into the sky-mode shader uniforms */
  private syncSkyLights() {
    const u = this.skyU;
    let n = 0;
    this.torch.getWorldPosition(_p3);
    u.uLightPos.value[n].copy(_p3);
    const tc = this.torch.color;
    u.uLightCol.value[n].set(tc.r, tc.g, tc.b).multiplyScalar(this.torch.intensity);
    u.uLightRange.value[n] = this.torch.distance;
    n++;
    if (this.playerLight.visible && n < MAX_SKY_LIGHTS) {
      u.uLightPos.value[n].copy(this.playerLight.position);
      const pc = this.playerLight.color;
      u.uLightCol.value[n].set(pc.r, pc.g, pc.b).multiplyScalar(this.playerLight.intensity);
      u.uLightRange.value[n] = this.playerLight.distance;
      n++;
    }
    for (const d of this.dynLights) {
      if (n >= MAX_SKY_LIGHTS) break;
      u.uLightPos.value[n].copy(d.light.position);
      const lc = d.light.color;
      u.uLightCol.value[n].set(lc.r, lc.g, lc.b).multiplyScalar(d.light.intensity);
      u.uLightRange.value[n] = d.light.distance;
      n++;
    }
    u.uNumLights.value = n;
  }

  /** Sandstorm: fog, sky and light follow the Survival intensity (0..1);
   *  the grit cloud only rides when the player is under open sky. */
  setStorm(i: number, openSky: boolean): void { this.stormI = i; this.stormOpen = openSky; }
  /** Inside a Base: the fog pulls close — the room reads as a room (0..1 crossfade). */
  setCozy(v: number): void { this.cozyI = v; }
  private stormDome: THREE.Mesh | null = null;
  /** the Sandstorm Breaker's calm made visible: one faint red dome over the pylon
   *  the player is standing under (null turns it off). */
  setStormDome(center: [number, number, number] | null) {
    if (!center) {
      if (this.stormDome) { this.entityGroup.remove(this.stormDome); this.stormDome.geometry.dispose(); (this.stormDome.material as THREE.Material).dispose(); this.stormDome = null; }
      return;
    }
    if (!this.stormDome) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(STORM_BREAKER_R, 28, 18),
        new THREE.MeshBasicMaterial({ color: 0xd85848, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      m.renderOrder = 2; // over the world mesh; depthWrite off so it hides nothing
      this.stormDome = m;
      this.entityGroup.add(m);
    }
    this.stormDome.position.set(center[0], center[1], center[2]);
  }

  /**
   * Switch lighting at runtime (default "sky"). Flips the mode and shadow
   * arming only — call rebuildLights(world) right after so every chunk mesh
   * rebuilds with the mode's material (and baked light in "sky" mode).
   */
  setLightingMode(mode: "sky" | "shadow") {
    if (mode === this.lightingMode) return;
    this.lightingMode = mode;
    this.three.shadowMap.enabled = mode === "shadow";
    this.sun.castShadow = mode === "shadow";
  }

  /** Full re-bake: drop every light map and re-mark all loaded chunks dirty. */
  rebuildLights(world: World) {
    this.skyLight.maps.clear();
    this.lightRecheck.clear();
    for (const k of this.chunkMeshes.keys()) world.dirty.add(k);
  }

  setHighlight(target: { x: number; y: number; z: number } | null) {
    if (!target) { this.highlight.visible = false; return; }
    this.highlight.visible = true;
    this.highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  }

  /** Head Lantern: show the warm player light at pos, or hide it when null.
   *  Cheap enough for a per-frame call; the light itself is created once. */
  setPlayerLight(pos: { x: number; y: number; z: number } | null): void {
    if (!pos) { this.playerLight.visible = false; return; }
    this.playerLight.visible = true;
    this.playerLight.position.set(pos.x, pos.y, pos.z);
  }

  rebuildDirty(world: World) {
    let budget = 3;
    for (const k of world.dirty) {
      if (budget <= 0) break;
      this.buildChunk(world, k);
      world.dirty.delete(k);
      budget--;
    }
    // baked-light consistency: a chunk whose light map lagged a rebaked
    // neighbor gets its mesh rebuilt (and its map re-baked) on the same budget
    for (const k of this.lightRecheck) {
      if (budget <= 0) break;
      this.lightRecheck.delete(k);
      if (!world.dirty.has(k)) world.dirty.add(k);
      budget--;
    }
  }

  ensureChunks(world: World, pcx: number, pcz: number) {
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++)
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const k = ckey(pcx + dx, pcz + dz);
        if (!this.chunkMeshes.has(k)) world.markDirty(pcx + dx, pcz + dz);
      }
  }

  buildChunk(world: World, k: string) {
    const [cx, cz] = k.split(",").map(Number);
    const c = world.chunk(cx, cz);
    const pos: number[] = [], col: number[] = [], idx: number[] = [], uvs: number[] = [], lite: number[] = [];
    const epos: number[] = [], ecol: number[] = [], eidx: number[] = [], euvs: number[] = [];
    const tpos: number[] = [], tcol: number[] = [], tidx: number[] = [], tuv: number[] = [], tlite: number[] = [];

    // sky mode bakes the skylight into the mesh: one chunk flood per call
    // (the caller budgets chunks per frame); neighbors that would lag get
    // queued for a cheap re-verify later
    const Lb = this.lightingMode === "sky"
      ? this.skyLight.bake(world, cx, cz, (ncx, ncz) => {
          const nk = ckey(ncx, ncz);
          if (!world.dirty.has(nk) && !this.lightRecheck.has(nk)) this.lightRecheck.add(nk);
        })
      : null;
    // face light: the baked value at the face's air cell (0 below the world)
    const faceLight = (nx: number, ny: number, nz: number): number =>
      Lb && ny >= 0 && ny < CH ? Lb[lidx(nx, nz, ny)] / MAX_LIGHT : 0;

    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) for (let y = 0; y < CH; y++) {
      const id = c[(x * CS + z) * CH + y];
      if (id === AIR) continue;
      const wx = cx * CS + x, wz = cz * CS + z;
      const r = world.rots.size ? world.getRot(wx, y, wz) : 0;
      if (DOOR_BLOCKS.has(id)) {
        // the thin slab borrows the brightest light of its four sides — the
        // room it belongs to
        let dl = 0;
        if (Lb) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          dl = Math.max(dl, Lb[lidx(x + dx, z + dz, y)]);
        this.emitDoor(pos, col, idx, uvs, lite, dl / MAX_LIGHT, world, x, y, z, cx * CS, cz * CS, id);
        continue;
      }
      if (CROSS_BLOCKS.has(id)) {
        // a stand of blades on two crossed quads; crops are non-opaque, so
        // the plant's own cell carries light and shades the blades
        const ft = TILE[id];
        const tx0 = (ft % ATLAS_COLS) * TILE_PX, ty0 = ((ft / ATLAS_COLS) | 0) * TILE_PX;
        const lv = Lb ? Lb[lidx(x, z, y)] / MAX_LIGHT : 0;
        const quad = (x0: number, z0: number, x1: number, z1: number) => {
          const base = tpos.length / 3;
          tpos.push(x0, y, z0, x1, y, z1, x1, y + 1, z1, x0, y + 1, z0);
          for (let i = 0; i < 4; i++) { tcol.push(0.92, 0.92, 0.92); tlite.push(lv); }
          tuv.push(
            (tx0 + 0.5) / ATLAS_PX, (ty0 + 15.5) / ATLAS_PX,
            (tx0 + 15.5) / ATLAS_PX, (ty0 + 15.5) / ATLAS_PX,
            (tx0 + 15.5) / ATLAS_PX, (ty0 + 0.5) / ATLAS_PX,
            (tx0 + 0.5) / ATLAS_PX, (ty0 + 0.5) / ATLAS_PX,
          );
          tidx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        };
        quad(x, z, x + 1, z + 1);
        quad(x + 1, z, x, z + 1);
        continue;
      }
      if (id === CURVED_HULL || id === HULL_SLOPE) {
        // chamfered cube: axis faces cull exactly like a plain cube, the 45°
        // facets are always drawn
        this.emitShape(rotShapes(HULL_SHAPES[id], r), pos, col, idx, uvs, lite, id, world, x, y, z, cx * CS, cz * CS, faceLight);
        continue;
      }
      if (id === BENCH || id === BENCH_EXT) {
        // the two-cell workbench: orient the model by where the partner cell
        // actually is, then apply the player's rotation stored on the BENCH
        const wx2 = cx * CS + x, wz2 = cz * CS + z;
        let d: number, base: ShapeFace[], rr: number;
        if (id === BENCH) {
          d = world.get(wx2 + 1, y, wz2) === BENCH_EXT ? 0 : world.get(wx2, y, wz2 + 1) === BENCH_EXT ? 1
            : world.get(wx2 - 1, y, wz2) === BENCH_EXT ? 2 : 3;
          base = BENCH_MODEL;
          // the partner sits exactly where the stored rotation points, so the
          // nibble already carries the pair direction - never add both
          if (r !== 0) { d = 0; rr = r; } else rr = 0;
        } else {
          d = world.get(wx2 - 1, y, wz2) === BENCH ? 0 : world.get(wx2, y, wz2 - 1) === BENCH ? 1
            : world.get(wx2 + 1, y, wz2) === BENCH ? 2 : 3;
          base = BENCHX_MODEL;
          rr = world.getRot(wx2 + (d === 0 ? -1 : d === 2 ? 1 : 0), y, wz2 + (d === 1 ? -1 : d === 3 ? 1 : 0));
          if (rr !== 0) d = 0;
        }
        this.emitShape(rotShapes(base, (d + rr) & 3), pos, col, idx, uvs, lite, id, world, x, y, z, cx * CS, cz * CS, faceLight);
        continue;
      }
      if (id >= WATER7 && id <= WATER1) {
        // Flowing water lies shallower the further it has run from its
        // Source: level/8 of the cell. Top and step edges get faces; where a
        // deeper neighbour covers the cell, its own side hides ours.
        const h = (33 - id) / 8;
        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const lx = x + f.dir[0], ly = y + f.dir[1], lz = z + f.dir[2];
          const nb = world.get(cx * CS + lx, ly, cz * CS + lz);
          let bottom = 0;
          if (f.dir[1] === 0 && isWater(nb)) {
            bottom = waterStrength(nb) / 8;
            if (bottom >= h) continue;
          } else if (isWater(nb)) continue;
          else if (!faceVisible(world, cx * CS + lx, ly, cz * CS + lz, id)) continue; // flush against solid
          const ft = FACE_T[id * 6 + fi];
          const tx0 = (ft % ATLAS_COLS) * TILE_PX, ty0 = ((ft / ATLAS_COLS) | 0) * TILE_PX;
          const base = tpos.length / 3;
          const lv = faceLight(lx, ly, lz);
          for (const cn of f.corners) {
            tpos.push(x + cn[0], cn[1] ? y + h : y + bottom, z + cn[2]);
            tcol.push(f.shade, f.shade, f.shade);
            tlite.push(lv);
            tuv.push((tx0 + 0.5 + cn[f.uv[0]] * (TILE_PX - 1)) / ATLAS_PX, (ty0 + 0.5 + cn[f.uv[1]] * (TILE_PX - 1)) / ATLAS_PX);
          }
          tidx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        continue;
      }
      const def = BLOCKS[id];
      // a campfire only glows while it has fuel charges; empty ones are cold
      // charcoal — dark tile, opaque pass, no point light
      const coldFire = id === CAMPFIRE && (this.fires.get(wx + "," + y + "," + wz) ?? 0) <= 0;
      const useE = def.emissive && !coldFire, useT = def.transparent;
      const P = useT ? tpos : useE ? epos : pos;
      const C = useT ? tcol : useE ? ecol : col;
      const I = useT ? tidx : useE ? eidx : idx;
      const U = useT ? tuv : useE ? euvs : uvs;
      const LM = useT ? tlite : useE ? null : lite;
      for (let fi = 0; fi < FACES.length; fi++) {
        const f = FACES[fi];
        const fd = r ? rotDir(f.dir, r) : f.dir;
        const nx = x + fd[0], ny = y + fd[1], nz = z + fd[2];
        if (!faceVisible(world, cx * CS + nx, ny, cz * CS + nz, id)) continue;
        // cold fires draw their charcoal tile instead of the flame tile
        const ft = coldFire ? VI.campfire_cold : FACE_T[id * 6 + fi];
        const tx0 = (ft % ATLAS_COLS) * TILE_PX, ty0 = ((ft / ATLAS_COLS) | 0) * TILE_PX;
        const base = P.length / 3;
        const sh = useE ? 1 : f.shade;
        const lv = LM ? faceLight(nx, ny, nz) : 0;
        for (const cn of f.corners) {
          const [px, pz] = r ? rot2(cn[0], cn[2], r) : [cn[0], cn[2]];
          P.push(x + px, y + cn[1], z + pz);
          C.push(sh, sh, sh); // shading only; texture carries the color
          if (LM) LM.push(lv);
          U.push((tx0 + 0.5 + cn[f.uv[0]] * (TILE_PX - 1)) / ATLAS_PX, (ty0 + 0.5 + cn[f.uv[1]] * (TILE_PX - 1)) / ATLAS_PX);
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    const old = this.chunkMeshes.get(k);
    if (old) for (const m of old) { this.group.remove(m); m.geometry.dispose(); }
    const meshes: THREE.Mesh[] = [];
    const skyMode = this.lightingMode === "sky";
    const mk = (p: number[], cc: number[], i: number[], u: number[], lm: number[] | null, mat: THREE.Material) => {
      if (p.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2));
      if (lm && lm.length * 3 === p.length) geo.setAttribute("light", new THREE.Float32BufferAttribute(lm, 1));
      geo.setIndex(i);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx * CS, 0, cz * CS);
      if (!skyMode && mat !== this.matEmissive) {
        mesh.castShadow = mat !== this.matTrans;
        mesh.receiveShadow = true;
      }
      this.group.add(mesh);
      meshes.push(mesh);
    };
    mk(pos, col, idx, uvs, Lb ? lite : null, skyMode ? this.matSky : this.matOpaque);
    mk(epos, ecol, eidx, euvs, null, this.matEmissive);
    mk(tpos, tcol, tidx, tuv, Lb ? tlite : null, skyMode ? this.matSkyT : this.matTrans);
    this.chunkMeshes.set(k, meshes);
  }

  /** Door leaf: a thin slab filling the doorway cell, hinged on one vertical edge.
   *  Open doors are that same slab rotated 90 deg about the hinge into an
   *  adjoining air cell. Hinge edge picks the wall side deterministically. */
  private emitDoor(P: number[], C: number[], I: number[], U: number[], Lm: number[], dl: number, world: World,
    lx: number, ly: number, lz: number, ox: number, oz: number, id: number) {
    const wx = ox + lx, wz = oz + lz;
    const inner = id === DOOR_INNER || id === DOOR_INNER_UPPER || id === DOOR_INNER_OPEN;
    const upper = id === DOOR_UPPER || id === DOOR_INNER_UPPER ||
      (id === DOOR_OPEN && world.get(wx, ly - 1, wz) === DOOR_OPEN) ||
      (id === DOOR_INNER_OPEN && world.get(wx, ly - 1, wz) === DOOR_INNER_OPEN);
    const tile = TILE_SRC(upper ? (inner ? DOOR_INNER_UPPER : DOOR_UPPER) : (inner ? DOOR_INNER : DOOR_CLOSED));
    const open = id === DOOR_OPEN || id === DOOR_INNER_OPEN;
    // wall running along x -> leaf spans x, thin in z; running along z -> spans z, thin in x
    const wallX = isSolid(world.get(wx - 1, ly, wz)) || isSolid(world.get(wx + 1, ly, wz));
    const spanZ = !wallX && (isSolid(world.get(wx, ly, wz - 1)) || isSolid(world.get(wx, ly, wz + 1)));
    const airNeg = spanZ ? !isSolid(world.get(wx - 1, ly, wz)) : !isSolid(world.get(wx, ly, wz - 1));
    const airPos = spanZ ? !isSolid(world.get(wx + 1, ly, wz)) : !isSolid(world.get(wx, ly, wz + 1));
    // deterministic hinge: pick edge by parity so both halves of the pair agree,
    // preferring a side with air to swing into
    const parity = (wx + wz) & 1;
    let edge: 0 | 1, swing: 1 | -1;
    if (parity && airPos) { edge = 1; swing = 1; }
    else if (!parity && airNeg) { edge = 0; swing = -1; }
    else if (airPos) { edge = 1; swing = 1; }
    else { edge = 0; swing = -1; }
    // whoever pushed the door open recorded which room the leaf swings into
    const pushed = world.doorSwing.get(wx + "," + wz);
    if (pushed) swing = pushed;
    // slab corners in (s, y, t): s spans the wall, t is the thickness
    const s0 = 0.04, s1 = 0.96;
    const t0 = edge ? 0.84 : 0.02, t1 = edge ? 0.98 : 0.16;
    const hS = s0, hT = edge ? 0.98 : 0.02;
    const face = (pts: [number, number, number][], uv: [number, number][], sh: number) => {
      const base = P.length / 3;
      for (let i = 0; i < 4; i++) {
        let [s, yy, t] = pts[i];
        if (open) {
          const vs = s - hS, vt = t - hT;
          s = hS - swing * vt; t = hT + swing * vs;
        }
        P.push(spanZ ? lx + t : lx + s, ly + yy, spanZ ? lz + s : lz + t);
        C.push(sh, sh, sh);
        Lm.push(dl);
        U.push((tile[0] + 0.5 + uv[i][0] * (TILE_PX - 1)) / ATLAS_PX, (tile[1] + 0.5 + uv[i][1] * (TILE_PX - 1)) / ATLAS_PX);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const sf = (s: number) => (s - s0) / (s1 - s0);
    const tf = (t: number) => (t - t0) / (t1 - t0);
    face([[s0, 0, t1], [s1, 0, t1], [s1, 1, t1], [s0, 1, t1]], [[sf(s0), 0], [sf(s1), 0], [sf(s1), 1], [sf(s0), 1]], 0.85); // outer
    face([[s0, 0, t0], [s1, 0, t0], [s1, 1, t0], [s0, 1, t0]], [[sf(s1), 0], [sf(s0), 0], [sf(s0), 1], [sf(s1), 1]], 0.7);  // inner
    face([[s1, 0, t0], [s1, 0, t1], [s1, 1, t1], [s1, 1, t0]], [[tf(t0), 0], [tf(t1), 0], [tf(t1), 1], [tf(t0), 1]], 0.6); // +s edge
    face([[s0, 0, t0], [s0, 0, t1], [s0, 1, t1], [s0, 1, t0]], [[tf(t1), 0], [tf(t0), 0], [tf(t0), 1], [tf(t1), 1]], 0.6); // -s edge (hinge side)
    face([[s0, 1, t0], [s1, 1, t0], [s1, 1, t1], [s0, 1, t1]], [[sf(s0), tf(t0)], [sf(s1), tf(t0)], [sf(s1), tf(t1)], [sf(s0), tf(t1)]], 1.0); // top
    face([[s0, 0, t0], [s1, 0, t0], [s1, 0, t1], [s0, 0, t1]], [[sf(s0), tf(t1)], [sf(s1), tf(t1)], [sf(s1), tf(t0)], [sf(s0), tf(t0)]], 0.45); // bottom
  }

  /** CURVED_HULL / HULL_SLOPE: chamfered-cube faces. Axis faces cull against
   *  solid neighbours like plain cubes and bake the light of the air cell in
   *  front of them; the 45° facets are always drawn and take the brighter of
   *  their two adjacent axis cells (the diagonal cell has no baked value of
   *  its own in the chunk halo). Shading is per face, mirroring FACES. */
  private emitShape(faces: ShapeFace[], P: number[], C: number[], I: number[], U: number[], Lm: number[],
    id: number, world: World, x: number, y: number, z: number, ox: number, oz: number,
    faceLight: (nx: number, ny: number, nz: number) => number) {
    for (const f of faces) {
      const axis = (f.dir[0] ? 1 : 0) + (f.dir[1] ? 1 : 0) + (f.dir[2] ? 1 : 0);
      if (f.fill) {
        if (faceVisible(world, ox + x + f.fill[0], y + f.fill[1], oz + z + f.fill[2], id)) continue;
      } else if (axis === 1 && !f.always && !faceVisible(world, ox + x + f.dir[0], y + f.dir[1], oz + z + f.dir[2], id)) continue;
      const ft = FACE_T[id * 6 + f.kind];
      const tx0 = (ft % ATLAS_COLS) * TILE_PX, ty0 = ((ft / ATLAS_COLS) | 0) * TILE_PX;
      let lv = 0;
      if (f.fill) lv = faceLight(x, y, z); // coplanar with the neighbour's culled face: it took this cell's light
      if (f.dir[0]) lv = Math.max(lv, faceLight(x + f.dir[0], y, z));
      if (f.dir[1]) lv = Math.max(lv, faceLight(x, y + f.dir[1], z));
      if (f.dir[2]) lv = Math.max(lv, faceLight(x, y, z + f.dir[2]));
      const base = P.length / 3;
      for (const p of f.pts) {
        P.push(x + p[0], y + p[1], z + p[2]);
        C.push(f.sh, f.sh, f.sh);
        Lm.push(lv);
        const [u, v] = f.uv(p);
        U.push((tx0 + 0.5 + u * (TILE_PX - 1)) / ATLAS_PX, (ty0 + 0.5 + v * (TILE_PX - 1)) / ATLAS_PX);
      }
      // convex ring: fan from the first corner keeps the flat face normal
      for (let t = 1; t + 1 < f.pts.length; t++) I.push(base, base + t, base + t + 1);
    }
  }

  // ---- ground items / caches ----
  addEntityMesh(id: number, pos: [number, number, number], color: number, size = 0.35) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshLambertMaterial({ color }));
    m.position.set(...pos);
    m.userData.eid = id;
    this.entityGroup.add(m);
    return m;
  }
  removeEntityMesh(eid: number) {
    const o = this.entityGroup.children.find((ch) => ch.userData.eid === eid);
    if (o) { this.entityGroup.remove(o); (o as THREE.Mesh).geometry.dispose(); }
  }
  moveEntityMesh(eid: number, pos: [number, number, number]) {
    const o = this.entityGroup.children.find((ch) => ch.userData.eid === eid);
    if (o) o.position.set(...pos);
  }
  entityMesh(eid: number): THREE.Object3D | undefined {
    return this.entityGroup.children.find((ch) => ch.userData.eid === eid);
  }
  /** Free-floating objects (mob rigs) sharing the entity layer. */
  addSceneObject(o: THREE.Object3D) { this.entityGroup.add(o); }
  removeSceneObject(o: THREE.Object3D) { this.entityGroup.remove(o); }

  private nextEid = 1_000_000; // marker/beam ids never collide with entity ids

  /** Vertical translucent beam rising from (x, y, z); used for waypoints and
   *  the Surveyor's Visor. Returns an id accepted by removeEntityMesh. */
  addBeam(x: number, y: number, z: number, color: number, height = 14): number {
    const eid = this.nextEid++;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.28, height, 6, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y + height / 2, z);
    m.userData.eid = eid;
    this.entityGroup.add(m);
    return eid;
  }

  /** Flat pulsing ring lying on the ground at (x, y+0.06, z). */
  addGroundRing(x: number, y: number, z: number, color: number, radius = 1.1): number {
    const eid = this.nextEid++;
    const m = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.55, radius, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.06, z);
    m.userData.eid = eid;
    this.entityGroup.add(m);
    return eid;
  }

  render() { this.three.render(this.scene, this.camera); }
}
