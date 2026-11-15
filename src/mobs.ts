import * as THREE from "three";

// ---------------------------------------------------------------- definitions

export type MobKind = "snake" | "rat" | "scorpion" | "wurm";

export interface MobDef {
  kind: MobKind;
  name: string;
  hp: number;
  speed: number;            // m/s
  aggroR: number;           // chases player inside this radius (0 = never)
  fleeR: number;           // flees player inside this radius (0 = never)
  biteDmg: number;
  biteCd: number;           // seconds between bites (0 = never bites)
  hitR: number;             // approximate body radius for hit tests
  height: number;           // visual overall height
  drops: { itemId: string; count: number }[];
  dropChance?: number[];      // per-drop probability, aligned with drops (default 1)
}

export const MOB_DEFS: Record<MobKind, MobDef> = {
  snake: {
    kind: "snake", name: "Desert Snake", hp: 10, speed: 1.3,
    aggroR: 5, fleeR: 0, biteDmg: 6, biteCd: 2,
    hitR: 0.45, height: 0.3,
    drops: [{ itemId: "snake_skin", count: 1 }],
  },
  rat: {
    kind: "rat", name: "Kangaroo Rat", hp: 4, speed: 2.6,
    aggroR: 0, fleeR: 6, biteDmg: 0, biteCd: 0,
    hitR: 0.5, height: 0.5,
    drops: [{ itemId: "rat_raw", count: 1 }],
  },
  scorpion: {
    kind: "scorpion", name: "Dust Scorpion", hp: 20, speed: 1.9,
    aggroR: 3.5, fleeR: 0, biteDmg: 7, biteCd: 2.2,
    hitR: 0.6, height: 0.5,
    drops: [{ itemId: "chitin", count: 1 }, { itemId: "stinger", count: 1 }],
    dropChance: [1, 0.3],
  },
  wurm: {
    kind: "wurm", name: "Sand Wurm", hp: 45, speed: 1.0,
    aggroR: 7, fleeR: 0, biteDmg: 12, biteCd: 2.5,
    hitR: 0.8, height: 0.9,
    drops: [{ itemId: "wurm_hide", count: 2 }, { itemId: "chitin", count: 1 }],
    dropChance: [1, 0.5],
  },
};

// ---------------------------------------------------------------- shared bits

// one unit cube reused by every mob part; shapes come from mesh.scale
const BOX = new THREE.BoxGeometry(1, 1, 1);

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(draw: (g: CanvasRenderingContext2D, rnd: () => number) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  draw(g, makeRng(0x51f3e7));
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- textures

/** Snake skin: sand-tan base, dark diamond/blotch back column, pale belly band. */
function snakeTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#c8a76d";
    g.fillRect(0, 0, 64, 64);
    // fine grain speckle
    for (let i = 0; i < 420; i++) {
      const v = 0.5 + (rnd() - 0.5) * 0.22;
      g.fillStyle = v > 0.5 ? "#d4b781" : "#b89359";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // diamond blotches down the middle band
    const rows = [4, 16, 28, 40];
    for (const ry of rows) {
      for (let dy = 0; dy < 9; dy++) {
        const half = 5 - Math.abs(dy - 4);
        g.fillStyle = "#6f5230";
        g.fillRect(32 - half, ry + dy, half * 2, 1);
        g.fillStyle = "#8a6a3f";
        g.fillRect(32 - half + 1, ry + dy, Math.max(1, half * 2 - 2), 1);
      }
      // pale side flecks between diamonds
      g.fillStyle = "#a9884f";
      g.fillRect(10 + ((rnd() * 4) | 0), ry + 3, 3, 2);
      g.fillRect(48 + ((rnd() * 4) | 0), ry + 5, 3, 2);
    }
    // pale belly (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 52; y < 64; y++) {
      g.fillStyle = y >= 56 ? "#e9dab1" : "#d8c494";
      g.fillRect(0, y, 64, 1);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "#ddcba0";
      g.fillRect((rnd() * 64) | 0, 52 + ((rnd() * 12) | 0), 1, 1);
    }
  });
}

/** Rat fur: sandy speckle, white belly band, white eye-ring patch. */
function ratTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#c9a878";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() > 0.5 ? "#ddc295" : "#a9854f";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // dark flecks
    for (let i = 0; i < 60; i++) {
      g.fillStyle = "#8a6a3c";
      g.fillRect((rnd() * 64) | 0, (rnd() * 48) | 0, 1, 2);
    }
    // white belly band
    for (let y = 50; y < 64; y++) {
      g.fillStyle = y >= 54 ? "#f2ead9" : "#e2d4ba";
      g.fillRect(0, y, 64, 1);
    }
    // white eye-ring patch (upper-left corner region)
    g.fillStyle = "#efe6d2";
    g.beginPath();
    g.arc(10, 12, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6b4e2c";
    g.fillRect(8, 10, 4, 4);
  });
}

/** Scorpion chitin: sandy-red base, dark plate seams across the back, pale underside. */
function scorpionTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#a4552e";
    g.fillRect(0, 0, 64, 64);
    // grain speckle
    for (let i = 0; i < 520; i++) {
      g.fillStyle = rnd() > 0.5 ? "#b56a3c" : "#8f4526";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // plate seams: dark horizontal bands with a lighter lip
    for (const y of [6, 18, 30, 42]) {
      g.fillStyle = "#6e3018";
      g.fillRect(0, y, 64, 2);
      g.fillStyle = "#c47a4a";
      g.fillRect(0, y + 2, 64, 1);
    }
    // center ridge column
    g.fillStyle = "#8a3f20";
    g.fillRect(30, 0, 4, 50);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "#b56a3c";
      g.fillRect(30 + ((rnd() * 4) | 0), ((rnd() * 50) | 0), 1, 1);
    }
    // pale underside (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 52; y < 64; y++) {
      g.fillStyle = y >= 56 ? "#e3cfa8" : "#c9ae83";
      g.fillRect(0, y, 64, 1);
    }
  });
}

/** Wurm hide: sand-yellow base, darker plate ridges, coarse mottling. */
function wurmTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#c2a266";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 620; i++) {
      g.fillStyle = rnd() > 0.5 ? "#d3b77e" : "#ab8a52";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // plate ridges: dark band pairs with scale notches
    for (const y of [5, 17, 29, 41]) {
      g.fillStyle = "#7d5f36";
      g.fillRect(0, y, 64, 3);
      g.fillStyle = "#96744499";
      for (let x = 0; x < 64; x += 4) g.fillRect(x, y + 3, 2, 1);
    }
    // pale belly (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 54; y < 64; y++) {
      g.fillStyle = y >= 58 ? "#e6d6ac" : "#d2bf94";
      g.fillRect(0, y, 64, 1);
    }
  });
}

interface SnakeMats { body: THREE.MeshLambertMaterial; ridge: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface RatMats { fur: THREE.MeshLambertMaterial; pale: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; pink: THREE.MeshLambertMaterial; }
interface ScorpionMats { shell: THREE.MeshLambertMaterial; claw: THREE.MeshLambertMaterial; stinger: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface WurmMats { hide: THREE.MeshLambertMaterial; ridge: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }

let snakeMats: SnakeMats | null = null;
let ratMats: RatMats | null = null;
let scorpionMats: ScorpionMats | null = null;
let wurmMats: WurmMats | null = null;

function getSnakeMats(): SnakeMats {
  if (!snakeMats) {
    snakeMats = {
      body: new THREE.MeshLambertMaterial({ map: snakeTex() }),
      ridge: new THREE.MeshLambertMaterial({ color: 0x6f5230 }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return snakeMats;
}

function getRatMats(): RatMats {
  if (!ratMats) {
    ratMats = {
      fur: new THREE.MeshLambertMaterial({ map: ratTex() }),
      pale: new THREE.MeshLambertMaterial({ color: 0xe8dcc4 }),
      dark: new THREE.MeshLambertMaterial({ color: 0x5c4023 }),
      pink: new THREE.MeshLambertMaterial({ color: 0xd8a0a0 }),
    };
  }
  return ratMats;
}

function getScorpionMats(): ScorpionMats {
  if (!scorpionMats) {
    scorpionMats = {
      shell: new THREE.MeshLambertMaterial({ map: scorpionTex() }),
      claw: new THREE.MeshLambertMaterial({ color: 0x7e3a1e }),
      stinger: new THREE.MeshLambertMaterial({ color: 0x552411 }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return scorpionMats;
}

function getWurmMats(): WurmMats {
  if (!wurmMats) {
    wurmMats = {
      hide: new THREE.MeshLambertMaterial({ map: wurmTex() }),
      ridge: new THREE.MeshLambertMaterial({ color: 0x7d5f36 }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return wurmMats;
}

// ---------------------------------------------------------------- visuals

export interface MobVisual {
  group: THREE.Group;                        // origin = feet on the ground
  animate(t: number, moving: number): void;  // t = seconds, moving 0..1 gait blend
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

interface Seg { mesh: THREE.Mesh; bx: number; w: number; h: number; d: number; }
interface Ridge { mesh: THREE.Mesh; w: number; }

// snake: ~1.5 m long, ~0.25 m thick; faces +Z (head at +Z)
function makeSnake(): MobVisual {
  const mats = getSnakeMats();
  const group = new THREE.Group();

  const segs: Seg[] = [];
  const ridges: Ridge[] = [];

  // body segments (tail -> neck), head handled separately in headRoot
  const zs = [0.36, 0.13, -0.10, -0.33, -0.54, -0.72];
  const ws = [0.26, 0.27, 0.26, 0.23, 0.18, 0.12];
  const hs = [0.22, 0.23, 0.22, 0.20, 0.16, 0.11];
  const d  = 0.24;
  for (let i = 0; i < zs.length; i++) {
    const bx = Math.sin(i * 0.8) * 0.05; // shallow S at rest
    const m = box(ws[i], hs[i], d, mats.body, bx, hs[i] / 2 + 0.005, zs[i]);
    segs.push({ mesh: m, bx, w: ws[i], h: hs[i], d });
    ridges.push({ mesh: box(ws[i] * 0.3, 0.02, d * 0.92, mats.ridge, bx, hs[i] + 0.008, zs[i]), w: ws[i] });
    group.add(m, ridges[i].mesh);
  }

  // head root: sways independently; head mesh + eyes hang off it
  const headRoot = new THREE.Group();
  headRoot.position.set(Math.sin(0) * 0.05, 0.095 + 0.005, 0.60);
  const head = box(0.27, 0.19, 0.27, mats.body, 0, 0.095, 0);
  headRoot.add(head);
  headRoot.add(box(0.035, 0.035, 0.03, mats.eye, -0.115, 0.14, 0.11));
  headRoot.add(box(0.035, 0.035, 0.03, mats.eye, 0.115, 0.14, 0.11));
  group.add(headRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    const amp = 0.015 + 0.075 * mv;
    const ph = t * (3.2 + 2.6 * mv);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const wob = Math.sin(ph - i * 0.85) * amp;
      s.mesh.position.x = s.bx + wob;
      s.mesh.rotation.y = -wob * 1.4;
      const br = 1 + Math.sin(t * 1.9) * 0.03 * (1 - mv * 0.6); // faint breathing
      s.mesh.scale.set(s.w * br, s.h, s.d);
      const r = ridges[i];
      r.mesh.position.x = s.mesh.position.x;
      r.mesh.rotation.y = s.mesh.rotation.y;
      r.mesh.scale.x = r.w * 0.3 * br;
    }
    headRoot.position.x = Math.sin(ph + 0.85) * amp * 0.5;
    headRoot.rotation.y = Math.sin(t * (2.2 + 2.4 * mv)) * (0.06 + 0.14 * mv);
  };
  return { group, animate };
}

// kangaroo rat: ~0.55 m long, 0.45 m tall; faces +Z
function makeRat(): MobVisual {
  const mats = getRatMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // hopped up/down by animate
  group.add(pivot);

  const body = box(0.22, 0.26, 0.34, mats.fur, 0, 0.26, -0.02);
  pivot.add(body);

  // head root (sway/nod), head + nose + eyes
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.31, 0.19);
  headRoot.add(box(0.15, 0.14, 0.15, mats.fur, 0, 0, 0.05));
  headRoot.add(box(0.045, 0.035, 0.04, mats.pink, 0, -0.02, 0.13));
  headRoot.add(box(0.028, 0.028, 0.02, mats.dark, -0.062, 0.03, 0.10));
  headRoot.add(box(0.028, 0.028, 0.02, mats.dark, 0.062, 0.03, 0.10));
  pivot.add(headRoot);

  // big ears
  const earL = box(0.05, 0.12, 0.025, mats.fur, -0.075, 0.41, 0.16);
  const earR = box(0.05, 0.12, 0.025, mats.fur, 0.075, 0.41, 0.16);
  earL.rotation.z = 0.15;
  earR.rotation.z = -0.15;
  pivot.add(earL, earR);

  // huge hind legs: thigh + long foot
  const thighL = box(0.09, 0.14, 0.11, mats.fur, -0.12, 0.14, -0.06);
  const thighR = box(0.09, 0.14, 0.11, mats.fur, 0.12, 0.14, -0.06);
  const footL = box(0.07, 0.05, 0.22, mats.pale, -0.13, 0.028, 0.02);
  const footR = box(0.07, 0.05, 0.22, mats.pale, 0.13, 0.028, 0.02);
  pivot.add(thighL, thighR, footL, footR);

  // tiny forepaws
  pivot.add(box(0.035, 0.035, 0.07, mats.pale, -0.08, 0.11, 0.15));
  pivot.add(box(0.035, 0.035, 0.07, mats.pale, 0.08, 0.11, 0.15));

  // long thin tail with dark tuft; tailRoot flicks from the base
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.16, -0.19);
  tailRoot.add(box(0.04, 0.04, 0.24, mats.fur, 0, 0, -0.12));
  tailRoot.add(box(0.032, 0.032, 0.22, mats.fur, 0, -0.045, -0.34));
  tailRoot.add(box(0.07, 0.055, 0.11, mats.dark, 0, -0.075, -0.50));
  pivot.add(tailRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    const hop = Math.abs(Math.sin(t * (2.6 + 2.4 * mv)));
    pivot.position.y = hop * 0.13 * mv + Math.sin(t * 1.7) * 0.004; // hop bob + idle breath
    body.scale.y = 0.26 * (1 + Math.sin(t * 1.9) * 0.03 * (1 - mv));
    // hind feet tuck mid-hop
    footL.rotation.x = footR.rotation.x = -0.55 * hop * mv;
    thighL.rotation.x = thighR.rotation.x = -0.35 * hop * mv;
    // tail flicks faster when running, droops at rest
    tailRoot.rotation.y = Math.sin(t * (1.8 + 3.4 * mv)) * (0.1 + 0.3 * mv);
    tailRoot.rotation.x = -0.12 - 0.18 * mv + Math.sin(t * (2.6 + 2.4 * mv)) * 0.06 * mv;
    // idle ear twitch
    const tw = Math.max(0, Math.sin(t * 6.3)) ** 8 * (1 - mv);
    earL.rotation.z = 0.15 + tw * 0.25;
    earR.rotation.z = -0.15 - Math.max(0, Math.sin(t * 6.3 + 2.1)) ** 8 * (1 - mv) * 0.25;
    headRoot.rotation.x = -0.1 * hop * mv + Math.sin(t * 1.3) * 0.03 * (1 - mv);
  };
  return { group, animate };
}

// one unit sphere reused by rounded mob parts; shapes come from mesh.scale
const SPHERE = new THREE.SphereGeometry(1, 14, 10);

function sph(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

// dust scorpion: ~1.1 m body, ~0.5 m tall with raised tail; faces +Z (head at +Z)
function makeScorpion(): MobVisual {
  const mats = getScorpionMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // subtle walk bob
  group.add(pivot);

  const legH = 0.09;

  // flattened segmented body: prosoma + 3 abdominal plates
  const prosoma = box(0.46, 0.14, 0.34, mats.shell, 0, legH + 0.07, 0.02);
  pivot.add(prosoma);
  const segs: Seg[] = [];
  const zs = [-0.26, -0.45, -0.62];
  const ws = [0.40, 0.34, 0.26];
  const hs = [0.13, 0.12, 0.10];
  for (let i = 0; i < zs.length; i++) {
    const m = box(ws[i], hs[i], 0.20, mats.shell, 0, legH + hs[i] / 2, zs[i]);
    segs.push({ mesh: m, bx: 0, w: ws[i], h: hs[i], d: 0.20 });
    pivot.add(m);
  }

  // small head plate + eyes at the front
  const headRoot = new THREE.Group();
  headRoot.position.set(0, legH + 0.045, 0.25);
  headRoot.add(box(0.26, 0.09, 0.13, mats.shell, 0, 0, 0));
  headRoot.add(box(0.03, 0.03, 0.02, mats.eye, -0.08, 0.05, 0.05));
  headRoot.add(box(0.03, 0.03, 0.02, mats.eye, 0.08, 0.05, 0.05));
  pivot.add(headRoot);

  // clawed pedipalps: arm + two-jaw pincer, reach forward-outward
  const jaws: { up: THREE.Mesh; dn: THREE.Mesh }[] = [];
  const pedipalps: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const root = new THREE.Group();
    root.position.set(side * 0.24, legH + 0.04, 0.14);
    root.rotation.y = side * 0.5;
    root.add(box(0.075, 0.055, 0.2, mats.shell, 0, 0, 0.10));
    root.add(box(0.07, 0.05, 0.1, mats.claw, 0, 0, 0.24));
    const up = box(0.025, 0.022, 0.13, mats.claw, 0, 0.026, 0.33);
    const dn = box(0.025, 0.022, 0.13, mats.claw, 0, -0.026, 0.33);
    root.add(up, dn);
    jaws.push({ up, dn });
    pedipalps.push(root);
    pivot.add(root);
  }

  // eight legs: slanted rods, 4 pairs
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const leg = box(0.03, 0.11, 0.03, mats.shell, side * 0.30, legH * 0.5, 0.12 - i * 0.14);
      leg.rotation.z = -side * 0.55;
      legs.push(leg);
      pivot.add(leg);
    }
  }

  // upcurved 3-segment tail ending in a bulbous stinger (nested groups curve it up)
  const tail1 = new THREE.Group();
  tail1.position.set(0, legH + 0.10, -0.70);
  tail1.rotation.x = 0.5;
  tail1.add(box(0.16, 0.16, 0.22, mats.shell, 0, 0, -0.11));
  const tail2 = new THREE.Group();
  tail2.position.set(0, 0.04, -0.22);
  tail2.rotation.x = 0.7;
  tail2.add(box(0.13, 0.13, 0.18, mats.shell, 0, 0, -0.09));
  const tail3 = new THREE.Group();
  tail3.position.set(0, 0.03, -0.18);
  tail3.rotation.x = 0.8;
  tail3.add(box(0.10, 0.10, 0.15, mats.shell, 0, 0, -0.075));
  const bulb = sph(0.22, 0.20, 0.24, mats.stinger, 0, 0.06, -0.22);
  const barb = box(0.035, 0.035, 0.13, mats.stinger, 0, 0.16, -0.30);
  barb.rotation.x = 0.5;
  tail3.add(bulb, barb);
  tail2.add(tail3);
  tail1.add(tail2);
  pivot.add(tail1);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    pivot.position.y = Math.abs(Math.sin(t * (5.5 + 5 * mv))) * 0.012 * mv;
    // legs scuttle in alternating pairs
    const lp = t * (6 + 6 * mv);
    for (let i = 0; i < legs.length; i++) {
      const pair = i % 4, side = i < 4 ? 0 : Math.PI;
      legs[i].rotation.x = Math.sin(lp + pair * 1.7 + side) * 0.5 * mv;
    }
    // abdomen breathes
    const br = 1 + Math.sin(t * 1.6) * 0.03 * (1 - mv * 0.5);
    for (const s of segs) s.mesh.scale.set(s.w * br, s.h, s.d);
    // pedipalps sway forward when moving; pincers snap open/closed
    for (let i = 0; i < 2; i++) {
      const r = pedipalps[i], j = jaws[i];
      r.rotation.z = Math.sin(lp + i * Math.PI) * 0.25 * mv;
      const open = 0.06 + Math.abs(Math.sin(t * (1.4 + 1.6 * mv) + i * 1.3)) * (0.08 + 0.14 * mv);
      j.up.rotation.x = -open;
      j.dn.rotation.x = open;
    }
    // tail sweeps slowly, higher when agitated/moving
    const sway = 0.06 + 0.14 * mv;
    tail1.rotation.y = Math.sin(t * (1.1 + 1.4 * mv)) * sway;
    tail3.rotation.x = 0.8 + Math.sin(t * 1.7) * 0.08;
    headRoot.rotation.y = Math.sin(t * 1.5) * 0.05 * (1 - mv * 0.5);
  };
  return { group, animate };
}

// sand wurm: ~2.4 m long plated worm, ~0.9 m tall; faces +Z (head at +Z), sits on the ground
function makeWurm(): MobVisual {
  const mats = getWurmMats();
  const group = new THREE.Group();

  // body: separate plated sphere segments (tail -> neck) so they can wiggle
  const segs: Seg[] = [];
  const ridges: Ridge[] = [];
  const zs = [-0.95, -0.45, 0.10, 0.62];
  const ws = [0.34, 0.40, 0.44, 0.42];
  const hs = [0.30, 0.37, 0.42, 0.40];
  const d  = [0.40, 0.45, 0.48, 0.45];
  for (let i = 0; i < zs.length; i++) {
    const y = hs[i] + 0.01; // resting on the ground
    const m = sph(ws[i] * 2, hs[i] * 2, d[i] * 2, mats.hide, 0, y, zs[i]);
    segs.push({ mesh: m, bx: 0, w: ws[i] * 2, h: hs[i] * 2, d: d[i] * 2 });
    ridges.push({ mesh: box(ws[i], 0.06, d[i] * 0.8, mats.ridge, 0, y + hs[i] - 0.04, zs[i]), w: ws[i] });
    group.add(m, ridges[i].mesh);
  }

  // blunt head with small dark eyes; sways independently
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.36, 1.15);
  headRoot.add(sph(0.72, 0.68, 0.76, mats.hide, 0, 0, 0));
  headRoot.add(box(0.05, 0.05, 0.04, mats.eye, -0.19, 0.12, 0.26));
  headRoot.add(box(0.05, 0.05, 0.04, mats.eye, 0.19, 0.12, 0.26));
  group.add(headRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    const amp = 0.02 + 0.11 * mv;
    const ph = t * (1.5 + 1.5 * mv);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const wob = Math.sin(ph - i * 0.8) * amp;
      s.mesh.position.x = s.bx + wob;
      s.mesh.rotation.y = -wob * 1.1;
      const br = 1 + Math.sin(t * 1.1 - i * 0.6) * 0.03;
      s.mesh.scale.set(s.w * br, s.h, s.d * br);
      const r = ridges[i];
      r.mesh.position.x = s.mesh.position.x;
      r.mesh.rotation.y = s.mesh.rotation.y;
      r.mesh.scale.x = r.w * br;
    }
    headRoot.position.x = Math.sin(ph + 0.8) * amp * 0.7;
    headRoot.rotation.y = Math.sin(t * (1.2 + 1.4 * mv)) * (0.07 + 0.13 * mv);
  };
  return { group, animate };
}

export function makeMobMesh(kind: MobKind): MobVisual {
  switch (kind) {
    case "snake": return makeSnake();
    case "rat": return makeRat();
    case "scorpion": return makeScorpion();
    case "wurm": return makeWurm();
  }
}
