import * as THREE from "three";
import {
  CS, CH, BLOCKS, AIR, SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS,
  INSGLASS, HULL, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, LAMP, METAL, BEACON, BENCH, CAMPFIRE, WATER, ADOBE, ENGINECORE, REGULATOR,
  isSolid,
} from "./blocks";
import { World, ckey, faceVisible } from "./world";
import { DAY_SECONDS } from "./blocks";
import { noise1, Rng } from "./noise";

const FACES: { dir: [number, number, number]; corners: number[][]; shade: number; uv: [number, number] }[] = [
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0, uv: [0, 2] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.45, uv: [0, 2] },
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], shade: 0.8, uv: [2, 1] },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], shade: 0.7, uv: [2, 1] },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.85, uv: [0, 1] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.65, uv: [0, 1] },
];

// ---------------- procedural texture atlas ----------------
// One 16x16 tile per block id, drawn on a 256x256 canvas at load. Pixel art,
// deterministic, no external assets. Vertex colors still carry face shading.

const TILE_PX = 16, ATLAS_COLS = 16;

function makeAtlasTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = ATLAS_COLS * TILE_PX;
  const g = cv.getContext("2d")!;
  const rng = new Rng(0xbeef);
  const TILE_LIST = [SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS,
    HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL, BEACON, BENCH, CAMPFIRE, WATER, ADOBE, DOOR_OPEN, ENGINECORE, REGULATOR];
  const tileOf: Record<number, number> = {};
  TILE_LIST.forEach((id, i) => (tileOf[id] = i));

  const cl = (v: number) => Math.max(0, Math.min(1, v));
  const draw = (id: number) => {
    const t = tileOf[id];
    const tx = (t % ATLAS_COLS) * TILE_PX, ty = ((t / ATLAS_COLS) | 0) * TILE_PX;
    const [br, bg, bb] = BLOCKS[id].color;
    const col = (dl: number, a = 1, hr = 0, hg = 0, hb = 0) =>
      `rgba(${Math.round(cl(br + dl + hr) * 255)},${Math.round(cl(bg + dl + hg) * 255)},${Math.round(cl(bb + dl + hb) * 255)},${a})`;
    const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(tx + x, ty + y, 1, 1); };
    const fill = (c: string) => { g.fillStyle = c; g.fillRect(tx, ty, TILE_PX, TILE_PX); };
    const nz = (s: number) => (rng.next() - 0.5) * s;
    const speckle = (n: number, s: number) => {
      for (let i = 0; i < n; i++) px(rng.int(0, 15), rng.int(0, 15), col(nz(s)));
    };
    const crack = (len: number, s: number) => {
      let x = rng.int(1, 13), y = rng.int(1, 13);
      for (let i = 0; i < len; i++) { px(x, y, col(nz(s) - 0.15)); x += rng.int(-1, 1); y += rng.int(0, 1); x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y)); }
    };
    switch (id) {
      case SAND: fill(col(0)); speckle(50, 0.14); break;
      case SANDSTONE:
        fill(col(0)); speckle(30, 0.1);
        for (const ry of [3, 8, 12]) for (let x = 0; x < 16; x++) if (rng.next() > 0.25) px(x, ry + (x % 2), col(-0.12));
        break;
      case ROCK: fill(col(nz(0.08))); speckle(40, 0.12); crack(9, 0.05); crack(7, 0.05); break;
      case GRAVEL:
        fill(col(-0.04));
        for (let i = 0; i < 14; i++) {
          const x = rng.int(1, 14), y = rng.int(1, 14);
          px(x, y, col(0.12)); px(x + 1, y, col(0.05)); px(x, y + 1, col(-0.15)); px(x - 1, y, col(-0.1));
        }
        break;
      case DIRT: fill(col(0)); speckle(70, 0.22); break;
      case SALT:
        fill(col(0.04)); speckle(25, 0.08);
        for (let y = 2; y < 16; y += 5) for (let x = 0; x < 16; x++) if (rng.next() > 0.4) px(x, y + (x % 3 === 2 ? 1 : 0), col(-0.12));
        break;
      case DEADWOOD:
        fill(col(0));
        for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) px(x, y, col(nz(0.16) + Math.sin(y * 0.9 + x) * 0.03));
        px(5, 6, col(-0.2)); px(6, 6, col(-0.25)); px(5, 7, col(-0.15));
        break;
      case GLASS:
        fill(col(0, 0.16));
        for (let i = 0; i < 16; i++) { px(i, 0, col(0.12, 0.4)); px(i, 15, col(0.12, 0.4)); px(0, i, col(0.12, 0.4)); px(15, i, col(0.12, 0.4)); }
        for (let i = 2; i < 8; i++) px(i, i + 2, col(0.3, 0.4));
        break;
      case INSGLASS:
        fill(col(0, 0.26));
        for (let i = 0; i < 16; i++) { px(i, 0, col(0.1, 0.55)); px(i, 15, col(0.1, 0.55)); px(0, i, col(0.1, 0.55)); px(15, i, col(0.1, 0.55)); px(8, i, col(0.06, 0.5)); px(i, 8, col(0.06, 0.5)); }
        break;
      case HULL:
        fill(col(0));
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, col(-y * 0.006 + nz(0.05)));
        for (let x = 0; x < 16; x++) px(x, 10, col(-0.22));
        for (const rx of [1, 5, 9, 13]) { px(rx, 9, col(0.18)); px(rx, 11, col(0.12)); }
        break;
      case DOOR_CLOSED:
        // bottom half: recessed panel + handle
        fill(col(-0.03)); speckle(12, 0.06);
        for (let i = 0; i < 16; i++) { px(i, 0, col(-0.22)); px(i, 15, col(-0.22)); px(0, i, col(-0.22)); px(15, i, col(-0.22)); }
        g.strokeStyle = col(0.08); g.strokeRect(tx + 3.5, ty + 2.5, 8, 10);
        for (let y = 7; y <= 9; y++) px(12, y, col(0.3));
        break;
      case DOOR_UPPER:
        // top half: same frame, but a viewport instead of a handle
        fill(col(-0.03)); speckle(12, 0.06);
        for (let i = 0; i < 16; i++) { px(i, 0, col(-0.22)); px(i, 15, col(-0.22)); px(0, i, col(-0.22)); px(15, i, col(-0.22)); }
        for (let y = 4; y <= 11; y++) for (let x = 5; x <= 10; x++) px(x, y, col(-0.3, 1, -0.1, -0.02, 0.06));
        g.strokeStyle = col(0.14); g.strokeRect(tx + 4.5, ty + 3.5, 7, 9);
        break;
      case DOOR_OPEN:
        // leaf parked in the frame: mostly see-through, one steel edge visible
        for (let y = 0; y < 16; y++) { px(0, y, col(-0.1, 0.9)); px(1, y, col(0.05, 0.85)); px(2, y, col(-0.15, 0.7)); }
        px(1, 7, col(0.3, 0.9)); px(1, 8, col(0.3, 0.9));
        break;
      case LAMP:
        fill(col(-0.25));
        for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) px(x, y, col(y > 5 && y < 10 && x > 5 && x < 10 ? 0.38 : 0.2));
        for (let x = 4; x <= 11; x++) { px(x, 4, col(-0.15)); px(x, 11, col(-0.15)); }
        break;
      case METAL:
        fill(col(0));
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, col((y % 3 === 0 ? -0.06 : 0.03) + nz(0.05)));
        for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) px(rx, ry, col(0.2));
        break;
      case BEACON:
        fill(col(-0.25)); speckle(10, 0.08);
        for (let dy = -3; dy <= 3; dy++) { const w2 = 3 - Math.abs(dy); for (let dx = -w2; dx <= w2; dx++) px(8 + dx, 8 + dy, col(dy === 0 ? 0 : 0.05, 1)); }
        px(8, 7, col(0.3, 1)); px(7, 8, col(0.2, 1));
        break;
      case BENCH:
        fill(col(0));
        for (const ry of [5, 11]) for (let x = 0; x < 16; x++) px(x, ry, col(-0.2));
        speckle(25, 0.14);
        for (let i = 0; i < 6; i++) px(rng.int(3, 12), rng.int(0, 4), col(0.1));
        break;
      case CAMPFIRE:
        fill(col(-0.1));
        for (let i = 0; i < 16; i += 2) { px(i, 13, col(0.15, 1, 0.02, -0.02, 0)); px(i + 1, 14, col(0.08)); }
        for (let i = 2; i < 12; i++) { px(i, 14 - i + 2, col(0.05, 1, -0.1, -0.15, -0.25)); px(i, i - 1, col(0.0, 1, -0.12, -0.18, -0.3)); }
        for (let y = 5; y <= 10; y++) for (let x = 6; x <= 9; x++) px(x, y, col(y < 8 ? 0.3 : 0.18, 1, 0.25, -0.05, -0.3));
        px(7, 6, col(0.45, 1, 0.3, 0.1, -0.25)); px(8, 5, col(0.4, 1, 0.25, 0.05, -0.25));
        break;
      case WATER:
        fill(col(0, 0.72));
        for (const ry of [2, 6, 10, 14]) for (let x = 0; x < 16; x++) if (rng.next() > 0.45) px(x, ry + (x % 4 < 2 ? 0 : 1), col(0.15, 0.8));
        speckle(10, 0.08);
        break;
      case ADOBE:
        fill(col(nz(0.06)));
        for (const ry of [3, 7, 11]) for (let x = 0; x < 16; x++) px(x, ry, col(-0.18));
        for (let band = 0, y0 = 0; y0 < 16; y0 += 4, band++)
          for (let x = (band % 2) * 4; x < 16; x += 8) for (let y = y0; y < y0 + 3; y++) px(x, y, col(-0.15));
        break;
      case ENGINECORE:
        // dark violet casing, glowing alien core with a bright ring
        fill(col(-0.35, 1, 0.05, 0, 0.1));
        for (let i = 0; i < 24; i++) px(rng.int(0, 15), rng.int(0, 15), col(-0.25, 1, 0.1, 0, 0.18));
        for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          if (d >= 3.5) px(x, y, col(0.12, 1, 0.55, 0.15, 0.85));       // ring
          else px(x, y, col(0.3 + (3 - d) * 0.15, 1, 0.75, 0.3, 1));     // hot core
        }
        break;
      case REGULATOR:
        // steel panel: heat-exchange fins on top, glowing teal vent ring below
        fill(col(-0.08)); speckle(10, 0.05);
        for (const ry of [1, 3, 5]) for (let x = 2; x <= 13; x++) px(x, ry, col(-0.25));
        for (let x = 4; x <= 11; x++) for (let y = 7; y <= 14; y++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 10.5));
          if (d >= 3.2) px(x, y, col(0.12));
          else px(x, y, col(0.22 + (3 - d) * 0.1, 1, -0.05, 0.15, 0.2));
        }
        break;
    }
  };
  for (const id of TILE_LIST) draw(id);

  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; // mesher computes v from canvas top-left; default flip would sample blank rows
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// block id -> tile index (exported so item icons can sample the same atlas)
export const TILE: number[] = [];
{
  const list = [SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS,
    HULL, DOOR_CLOSED, DOOR_UPPER, LAMP, METAL, BEACON, BENCH, CAMPFIRE, WATER, ADOBE, DOOR_OPEN, ENGINECORE, REGULATOR];
  list.forEach((id, i) => (TILE[id] = i));
}
export const ATLAS_PX = ATLAS_COLS * TILE_PX;
export const TILE_SRC = (id: number): [number, number] => {
  const t = TILE[id] ?? 0;
  return [(t % ATLAS_COLS) * TILE_PX, ((t / ATLAS_COLS) | 0) * TILE_PX];
};

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
  private moonDisc: THREE.Mesh;
  private highlight: THREE.LineSegments;
  renderDistance = 7;

  private atlas = makeAtlasTexture();
  matOpaque = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide });
  matEmissive = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide });
  matTrans = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  torch: THREE.PointLight;
  private dynLights: { x: number; y: number; z: number; light: THREE.PointLight; flame: boolean }[] = [];

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
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.hemi = new THREE.HemisphereLight(0xbfd4e6, 0x8a7455, 0.55);
    this.scene.add(this.sun, this.hemi);
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

  addPointLight(x: number, y: number, z: number, kind: "lamp" | "fire") {
    if (this.dynLights.length >= 12 || this.dynLights.some((d) => d.x === x && d.y === y && d.z === z)) return;
    const light = new THREE.PointLight(kind === "lamp" ? 0xfff0b0 : 0xff8340, kind === "lamp" ? 0.9 : 1.1, kind === "lamp" ? 12 : 9, 1.3);
    light.position.set(x + 0.5, y + 0.6, z + 0.5);
    this.scene.add(light);
    this.dynLights.push({ x, y, z, light, flame: kind === "fire" });
  }

  removePointLight(x: number, y: number, z: number) {
    const i = this.dynLights.findIndex((d) => d.x === x && d.y === y && d.z === z);
    if (i < 0) return;
    this.scene.remove(this.dynLights[i].light);
    this.dynLights.splice(i, 1);
  }

  dispose() {
    this.resetChunkMeshes();
    for (const d of this.dynLights) this.scene.remove(d.light);
    this.dynLights.length = 0;
    this.three.dispose();
    this.three.domElement.remove();
  }

  keyframe(frac: number): { sky: THREE.Color; sunColor: THREE.Color; sunElev: number; sunI: number } {
    // frac 0..1 day; sunrise .25, sunset .75
    const sunAngle = (frac - 0.25) * Math.PI * 2;
    const elev = Math.sin(sunAngle);
    const dayT = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
    const dawnT = THREE.MathUtils.clamp(1 - Math.abs(elev) * 5, 0, 1);
    const night = new THREE.Color(0x0a1226), dawn = new THREE.Color(0xc96f3d), day = new THREE.Color(0xbfcfe0);
    const sky = night.clone().lerp(day, dayT);
    if (dawnT > 0) sky.lerp(dawn, dawnT * 0.7);
    const sunColor = new THREE.Color(0xffd9a0).lerp(new THREE.Color(0xff7b3f), dawnT);
    return { sky, sunColor, sunElev: elev, sunI: Math.max(0.06, elev * 1.15) };
  }

  updateSky(worldTime: number, playerPos: THREE.Vector3) {
    const frac = (worldTime % DAY_SECONDS) / DAY_SECONDS;
    const kf = this.keyframe(frac);
    this.scene.background = kf.sky;
    (this.scene.fog as THREE.Fog).color.copy(kf.sky);
    (this.scene.fog as THREE.Fog).far = this.renderDistance * CS * 0.98;
    this.sun.color.copy(kf.sunColor);
    this.sun.intensity = kf.sunI;
    if (kf.sunElev < 0) {
      // night: a cool moonlight takes over from the sun
      this.sun.color.setHex(0x9db4e8);
      this.sun.intensity = 0.28;
    }
    this.sun.position.set(playerPos.x + Math.cos((frac - 0.25) * Math.PI * 2) * 100,
      playerPos.y + kf.sunElev * 100, playerPos.z + 40);
    this.hemi.intensity = 0.22 + kf.sunI * 0.35;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - kf.sunI * 3);
    this.stars.position.set(playerPos.x, playerPos.y, playerPos.z);
    // discs follow the same arc as the sun light; the moon rides opposite it
    const a = (frac - 0.25) * Math.PI * 2;
    const R = 430;
    this.sunDisc.position.set(playerPos.x + Math.cos(a) * R, playerPos.y + Math.sin(a) * R, playerPos.z + R * 0.4);
    this.moonDisc.position.set(playerPos.x - Math.cos(a) * R, playerPos.y - Math.sin(a) * R, playerPos.z - R * 0.4);
    this.sunDisc.lookAt(this.camera.position);
    this.moonDisc.lookAt(this.camera.position);
    this.sunDisc.visible = Math.sin(a) > -0.12;
    this.moonDisc.visible = Math.sin(a) < 0.12;
    this.torch.intensity = 0.12 + (1 - Math.min(1, kf.sunI)) * 0.85;
    for (const d of this.dynLights)
      if (d.flame) d.light.intensity = 0.9 + noise1(worldTime * 5.3 + d.x * 3.1 + d.z, 7) * 0.45;
    return kf;
  }

  setHighlight(target: { x: number; y: number; z: number } | null) {
    if (!target) { this.highlight.visible = false; return; }
    this.highlight.visible = true;
    this.highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  }

  rebuildDirty(world: World) {
    let budget = 3;
    for (const k of world.dirty) {
      if (budget <= 0) break;
      this.buildChunk(world, k);
      world.dirty.delete(k);
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
    const pos: number[] = [], col: number[] = [], idx: number[] = [], uvs: number[] = [];
    const epos: number[] = [], ecol: number[] = [], eidx: number[] = [], euvs: number[] = [];
    const tpos: number[] = [], tcol: number[] = [], tidx: number[] = [], tuv: number[] = [];

    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) for (let y = 0; y < CH; y++) {
      const id = c[(x * CS + z) * CH + y];
      if (id === AIR) continue;
      if (id === DOOR_CLOSED || id === DOOR_UPPER || id === DOOR_OPEN) {
        this.emitDoor(pos, col, idx, uvs, world, x, y, z, cx * CS, cz * CS, id);
        continue;
      }
      const def = BLOCKS[id];
      const useE = def.emissive, useT = def.transparent;
      const P = useT ? tpos : useE ? epos : pos;
      const C = useT ? tcol : useE ? ecol : col;
      const I = useT ? tidx : useE ? eidx : idx;
      const U = useT ? tuv : useE ? euvs : uvs;
      const [tx0, ty0] = TILE_SRC(id);
      for (const f of FACES) {
        const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
        if (!faceVisible(world, cx * CS + nx, ny, cz * CS + nz, id)) continue;
        const base = P.length / 3;
        const sh = useE ? 1 : f.shade;
        for (const cn of f.corners) {
          P.push(x + cn[0], y + cn[1], z + cn[2]);
          C.push(sh, sh, sh); // shading only; texture carries the color
          U.push((tx0 + 0.5 + cn[f.uv[0]] * (TILE_PX - 1)) / ATLAS_PX, (ty0 + 0.5 + cn[f.uv[1]] * (TILE_PX - 1)) / ATLAS_PX);
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    const old = this.chunkMeshes.get(k);
    if (old) for (const m of old) { this.group.remove(m); m.geometry.dispose(); }
    const meshes: THREE.Mesh[] = [];
    const mk = (p: number[], cc: number[], i: number[], u: number[], mat: THREE.Material) => {
      if (p.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2));
      geo.setIndex(i);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx * CS, 0, cz * CS);
      this.group.add(mesh);
      meshes.push(mesh);
    };
    mk(pos, col, idx, uvs, this.matOpaque);
    mk(epos, ecol, eidx, euvs, this.matEmissive);
    mk(tpos, tcol, tidx, tuv, this.matTrans);
    this.chunkMeshes.set(k, meshes);
  }

  /** Door leaf: a thin slab filling the doorway cell, hinged on one vertical edge.
   *  Open doors are that same slab rotated 90 deg about the hinge into an
   *  adjoining air cell. Hinge edge picks the wall side deterministically. */
  private emitDoor(P: number[], C: number[], I: number[], U: number[], world: World,
    lx: number, ly: number, lz: number, ox: number, oz: number, id: number) {
    const wx = ox + lx, wz = oz + lz;
    const upper = id === DOOR_UPPER || (id === DOOR_OPEN && world.get(wx, ly - 1, wz) === DOOR_OPEN);
    const tile = TILE_SRC(upper ? DOOR_UPPER : DOOR_CLOSED);
    const open = id === DOOR_OPEN;
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

  render() { this.three.render(this.scene, this.camera); }
}
