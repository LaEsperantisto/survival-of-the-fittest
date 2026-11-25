import * as THREE from "three";
import { GRASS, SAND, SNOW, BASALT } from "./blocks";
import { SIL_SEA, SB_BOREAL, biomeAt, silvarisSpawns } from "./silvaris";

// ---------------------------------------------------------------- definitions

export type MobKind =
  | "snake" | "rat" | "scorpion" | "wurm" | "trader" | "vulture" | "tortoise" | "fennec"
  | "stalker" | "tideback" | "brushbuck"
  | "warden" | "sentry" | "breaker" | "hauler" | "sentinel";

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
  retaliateR?: number;        // neutral-until-hit: radius it chases in after the player damages it (game.ts AI hook)
  herd?: { min: number; max: number }; // spawn batch size at one site (herd species; default 1)
  machine?: boolean;          // a Machine Dominion construct: never eats, never fears, drops metal not meat
  hide?: string;              // pelt item: one per carcass, a Skinner's skin number buys the rest
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
  trader: {
    kind: "trader", name: "Nomad", hp: 9999, speed: 1.1,
    aggroR: 0, fleeR: 0, biteDmg: 0, biteCd: 0,
    hitR: 0.5, height: 1.8,
    drops: [],
  },
  vulture: {
    kind: "vulture", name: "Sand Vulture", hp: 14, speed: 2.6,
    aggroR: 5, fleeR: 8, biteDmg: 5, biteCd: 2.2,
    hitR: 0.55, height: 0.9,
    drops: [{ itemId: "vulture_raw", count: 1 }, { itemId: "vulture_raw", count: 1 }],
    dropChance: [1, 0.5],
  },
  tortoise: {
    kind: "tortoise", name: "Thornback Tortoise", hp: 40, speed: 0.7,
    aggroR: 0, fleeR: 0, biteDmg: 0, biteCd: 0,
    hitR: 0.9, height: 0.8,
    drops: [{ itemId: "tortoise_shell", count: 1 }, { itemId: "rat_raw", count: 1 }],
    dropChance: [1, 0.4],
  },
  fennec: {
    kind: "fennec", name: "Fennec Fox", hp: 6, speed: 4.2,
    aggroR: 0, fleeR: 9, biteDmg: 0, biteCd: 0,
    hitR: 0.4, height: 0.45,
    drops: [{ itemId: "fennec_pelt", count: 1 }, { itemId: "rat_raw", count: 1 }],
    dropChance: [1, 0.3],
  },
  stalker: {
    kind: "stalker", name: "Snow Stalker", hp: 24, speed: 5.2,
    aggroR: 6, fleeR: 10, biteDmg: 8, biteCd: 1.8,
    hitR: 0.6, height: 0.85,
    drops: [],
    hide: "frost_pelt",
  },
  tideback: {
    kind: "tideback", name: "Tideback", hp: 70, speed: 0.55,
    aggroR: 0, fleeR: 0, biteDmg: 10, biteCd: 2.5,
    hitR: 1.4, height: 1.4,
    retaliateR: 8,
    // only a Harpoon gets through the hide — the kill is always a harpoon kill
    drops: [{ itemId: "tideback_hide", count: 3 }, { itemId: "tideback_meat", count: 2 }],
  },
  brushbuck: {
    kind: "brushbuck", name: "Brushbuck", hp: 10, speed: 4.6,
    aggroR: 0, fleeR: 9, biteDmg: 0, biteCd: 0,
    hitR: 0.6, height: 1.0,
    herd: { min: 2, max: 4 },
    drops: [{ itemId: "brushbuck_meat", count: 1 }, { itemId: "brushbuck_meat", count: 1 }],
    dropChance: [1, 0.5],
    hide: "brushbuck_pelt",
  },
  // the Machine Dominion's line-up (ADR: machines never eat, never flee —
  // except the desert's lone Warden, which remembers the Ship and runs)
  warden: {
    kind: "warden", name: "Warden", hp: 20, speed: 1.1,
    aggroR: 5, fleeR: 0, biteDmg: 5, biteCd: 2.2,
    hitR: 0.6, height: 1.2, machine: true,
    drops: [{ itemId: "scrap", count: 2 }, { itemId: "machine_part", count: 1 }],
  },
  sentry: {
    kind: "sentry", name: "Sentry", hp: 60, speed: 2.2,
    aggroR: 7, fleeR: 0, biteDmg: 9, biteCd: 2,
    hitR: 0.7, height: 1.7, machine: true,
    drops: [{ itemId: "metal", count: 2 }, { itemId: "scrap", count: 2 }, { itemId: "machine_part", count: 1 }],
    dropChance: [1, 1, 0.6],
  },
  breaker: {
    kind: "breaker", name: "Breaker", hp: 220, speed: 1.2,
    aggroR: 6, fleeR: 0, biteDmg: 16, biteCd: 3,
    hitR: 1.1, height: 1.9, machine: true,
    drops: [{ itemId: "metal", count: 4 }, { itemId: "machine_part", count: 2 },
            { itemId: "machine_heart", count: 1 }, { itemId: "scrap", count: 3 }],
    dropChance: [1, 1, 0.5, 1],
  },
  hauler: {
    kind: "hauler", name: "Hauler", hp: 40, speed: 1.6,
    aggroR: 0, fleeR: 0, biteDmg: 6, biteCd: 2,
    hitR: 0.9, height: 1.4, machine: true,
    retaliateR: 12, // neutral until struck — and the strike calls the neighbours down
    drops: [{ itemId: "metal", count: 3 }, { itemId: "scrap", count: 2 }, { itemId: "machine_part", count: 1 }],
    dropChance: [1, 1, 0.8],
  },
  // the Volcano's warden: shielded until its conduits are cut (game.ts gates
  // the damage), and the death-gift the Chronicle credits with the Fuel
  // Works recipes. Nothing about it spawns by chance — game.ts stations it.
  sentinel: {
    kind: "sentinel", name: "Sentinel", hp: 900, speed: 1.7,
    aggroR: 46, fleeR: 0, biteDmg: 26, biteCd: 1.8,
    hitR: 1.6, height: 5, machine: true,
    drops: [{ itemId: "metal", count: 8 }, { itemId: "machine_part", count: 4 },
            { itemId: "machine_heart", count: 1 }],
    dropChance: [1, 1, 1],
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

/** Vulture plumage: dark slate-brown base, darker ragged feather streaks, pale neck frill band. */
function vultureTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#574a41";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 640; i++) {
      g.fillStyle = rnd() > 0.5 ? "#6b5c50" : "#463b34";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // ragged feather streaks
    for (let i = 0; i < 70; i++) {
      g.fillStyle = "#382f28";
      g.fillRect((rnd() * 64) | 0, (rnd() * 50) | 0, 2, 4);
    }
    // pale frill band (top rows)
    for (let y = 0; y < 6; y++) {
      g.fillStyle = y >= 3 ? "#cfc4ae" : "#bcae92";
      g.fillRect(0, y, 64, 1);
    }
  });
}

/** Tortoise shell: olive-grey base, dark scute seams, worn pale scute centers. */
function tortoiseTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#77744f";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 520; i++) {
      g.fillStyle = rnd() > 0.5 ? "#86825c" : "#65613f";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // scute seams: dark grid
    g.fillStyle = "#4c4930";
    for (const x of [10, 31, 52]) g.fillRect(x, 0, 2, 64);
    for (const y of [12, 33, 54]) g.fillRect(0, y, 64, 2);
    // pale worn centers inside the scutes
    for (const x of [16, 37]) {
      for (const y of [3, 22, 43]) {
        g.fillStyle = "#8f8b63";
        g.fillRect(x, y, 11, 7);
      }
    }
  });
}

/** Fennec fur: pale sand base, light speckle, darker spine band, pale belly. */
function fennecTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#d8bd8e";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() > 0.5 ? "#e6cfa6" : "#c2a271";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // darker spine band (top rows)
    for (let y = 0; y < 8; y++) {
      g.fillStyle = y >= 4 ? "#b18f5c" : "#a68351";
      g.fillRect(0, y, 64, 1);
    }
    // pale belly (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 54; y < 64; y++) {
      g.fillStyle = y >= 58 ? "#f0e4c8" : "#e3d3ac";
      g.fillRect(0, y, 64, 1);
    }
  });
}

/** Nomad robe: deep teal woven base, plum hem/chest bands, pale gold trim. */
function traderTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#27474a";
    g.fillRect(0, 0, 64, 64);
    // woven vertical grain
    for (let i = 0; i < 520; i++) {
      g.fillStyle = rnd() > 0.5 ? "#2e5254" : "#1f3b3e";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 2);
    }
    // plum bands (flipY makes v=0 the canvas bottom -> hem at low rows)
    g.fillStyle = "#5c2e46";
    g.fillRect(0, 0, 64, 8);
    g.fillRect(0, 46, 64, 8);
    // pale gold trim lines
    g.fillStyle = "#b99a5e";
    g.fillRect(0, 8, 64, 1);
    g.fillRect(0, 45, 64, 1);
    // stitch speckle between the bands
    for (let i = 0; i < 34; i++) {
      g.fillStyle = "#6f4a5c";
      g.fillRect((rnd() * 64) | 0, 16 + ((rnd() * 26) | 0), 2, 2);
    }
  });
}

/** Snow Stalker pelt: near-white winter fur, slate dorsal streak, faint cold mottling. */
function stalkerTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#dde5ea";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 640; i++) {
      g.fillStyle = rnd() > 0.5 ? "#e9eef2" : "#c8d2da";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // slate dorsal streak (top rows) with a soft edge
    for (let y = 0; y < 9; y++) {
      g.fillStyle = y >= 5 ? "#5c6b78" : "#778795";
      g.fillRect(0, y, 64, 1);
    }
    for (let i = 0; i < 46; i++) {
      g.fillStyle = "#6d7c89";
      g.fillRect((rnd() * 64) | 0, 9 + ((rnd() * 4) | 0), 2, 1);
    }
    // pale belly (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 54; y < 64; y++) {
      g.fillStyle = y >= 58 ? "#f3f6f8" : "#e6ebef";
      g.fillRect(0, y, 64, 1);
    }
  });
}

/** Tideback hide: wet sea-green leather, dark scute seams, pale barnacle pocks. */
function tidebackTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#5f7166";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 560; i++) {
      g.fillStyle = rnd() > 0.5 ? "#6c7e72" : "#51615a";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // scute seams: dark grid
    g.fillStyle = "#3d4a44";
    for (const x of [10, 31, 52]) g.fillRect(x, 0, 2, 64);
    for (const y of [12, 33, 54]) g.fillRect(0, y, 64, 2);
    // barnacle pocks clustered near the seams
    for (const [cx, cy] of [[13, 15], [34, 36], [55, 13], [24, 48]]) {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = "#a9b4a8";
        g.fillRect(cx + ((rnd() * 8) | 0), cy + ((rnd() * 7) | 0), 2, 2);
      }
    }
    // pale wet underside (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 54; y < 64; y++) {
      g.fillStyle = y >= 58 ? "#93a196" : "#7d8c82";
      g.fillRect(0, y, 64, 1);
    }
  });
}

/** Brushbuck coat: tawny brown fur, darker spine band, cream belly, pale eye patch. */
function brushbuckTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#8f6b4a";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() > 0.5 ? "#a17e5a" : "#7c5a3c";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // darker spine band (top rows)
    for (let y = 0; y < 8; y++) {
      g.fillStyle = y >= 4 ? "#6b4c30" : "#78583a";
      g.fillRect(0, y, 64, 1);
    }
    // cream belly (bottom rows; flipY makes v=0 the canvas bottom)
    for (let y = 52; y < 64; y++) {
      g.fillStyle = y >= 56 ? "#e8dcc2" : "#d5c6a6";
      g.fillRect(0, y, 64, 1);
    }
    // pale eye-ring patch (upper-left corner region)
    g.fillStyle = "#d9cab0";
    g.beginPath();
    g.arc(10, 12, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3f2c19";
    g.fillRect(8, 10, 4, 4);
  });
}

interface SnakeMats { body: THREE.MeshLambertMaterial; ridge: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface RatMats { fur: THREE.MeshLambertMaterial; pale: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; pink: THREE.MeshLambertMaterial; }
interface ScorpionMats { shell: THREE.MeshLambertMaterial; claw: THREE.MeshLambertMaterial; stinger: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface WurmMats { hide: THREE.MeshLambertMaterial; ridge: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface VultureMats { plumage: THREE.MeshLambertMaterial; skin: THREE.MeshLambertMaterial; feather: THREE.MeshLambertMaterial; beak: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface TortoiseMats { shell: THREE.MeshLambertMaterial; skin: THREE.MeshLambertMaterial; thorn: THREE.MeshLambertMaterial; beak: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface FennecMats { fur: THREE.MeshLambertMaterial; pale: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; pink: THREE.MeshLambertMaterial; }
interface TraderMats { robe: THREE.MeshLambertMaterial; sash: THREE.MeshLambertMaterial; skin: THREE.MeshLambertMaterial; scarf: THREE.MeshLambertMaterial; pouch: THREE.MeshLambertMaterial; coin: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface StalkerMats { fur: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; pale: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface TidebackMats { hide: THREE.MeshLambertMaterial; skin: THREE.MeshLambertMaterial; barnacle: THREE.MeshLambertMaterial; beak: THREE.MeshLambertMaterial; eye: THREE.MeshLambertMaterial; }
interface BrushbuckMats { fur: THREE.MeshLambertMaterial; pale: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; pink: THREE.MeshLambertMaterial; }

let snakeMats: SnakeMats | null = null;
let ratMats: RatMats | null = null;
let scorpionMats: ScorpionMats | null = null;
let wurmMats: WurmMats | null = null;
let vultureMats: VultureMats | null = null;
let tortoiseMats: TortoiseMats | null = null;
let fennecMats: FennecMats | null = null;
let traderMats: TraderMats | null = null;
let stalkerMats: StalkerMats | null = null;
let tidebackMats: TidebackMats | null = null;
let brushbuckMats: BrushbuckMats | null = null;

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

function getVultureMats(): VultureMats {
  if (!vultureMats) {
    vultureMats = {
      plumage: new THREE.MeshLambertMaterial({ map: vultureTex() }),
      skin: new THREE.MeshLambertMaterial({ color: 0xc78d7c }),
      feather: new THREE.MeshLambertMaterial({ color: 0x5f4c33 }),
      beak: new THREE.MeshLambertMaterial({ color: 0x35343a }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return vultureMats;
}

function getTortoiseMats(): TortoiseMats {
  if (!tortoiseMats) {
    tortoiseMats = {
      shell: new THREE.MeshLambertMaterial({ map: tortoiseTex() }),
      skin: new THREE.MeshLambertMaterial({ color: 0x938a5e }),
      thorn: new THREE.MeshLambertMaterial({ color: 0x57513a }),
      beak: new THREE.MeshLambertMaterial({ color: 0xb0a26e }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return tortoiseMats;
}

function getFennecMats(): FennecMats {
  if (!fennecMats) {
    fennecMats = {
      fur: new THREE.MeshLambertMaterial({ map: fennecTex() }),
      pale: new THREE.MeshLambertMaterial({ color: 0xefe2c6 }),
      dark: new THREE.MeshLambertMaterial({ color: 0x6b4e2c }),
      pink: new THREE.MeshLambertMaterial({ color: 0xd8a0a0 }),
    };
  }
  return fennecMats;
}

function getTraderMats(): TraderMats {
  if (!traderMats) {
    traderMats = {
      robe: new THREE.MeshLambertMaterial({ map: traderTex() }),
      sash: new THREE.MeshLambertMaterial({ color: 0x9c5a33 }),
      skin: new THREE.MeshLambertMaterial({ color: 0xc79366 }),
      scarf: new THREE.MeshLambertMaterial({ color: 0xd8cbb0 }),
      pouch: new THREE.MeshLambertMaterial({ color: 0x6e4b2c }),
      coin: new THREE.MeshLambertMaterial({ color: 0xc9a94f }),
      eye: new THREE.MeshLambertMaterial({ color: 0x16100a }),
    };
  }
  return traderMats;
}

function getStalkerMats(): StalkerMats {
  if (!stalkerMats) {
    stalkerMats = {
      fur: new THREE.MeshLambertMaterial({ map: stalkerTex() }),
      dark: new THREE.MeshLambertMaterial({ color: 0x5c6b78 }),
      pale: new THREE.MeshLambertMaterial({ color: 0xf0f4f7 }),
      eye: new THREE.MeshLambertMaterial({ color: 0x101820 }),
    };
  }
  return stalkerMats;
}

function getTidebackMats(): TidebackMats {
  if (!tidebackMats) {
    tidebackMats = {
      hide: new THREE.MeshLambertMaterial({ map: tidebackTex() }),
      skin: new THREE.MeshLambertMaterial({ color: 0x77887c }),
      barnacle: new THREE.MeshLambertMaterial({ color: 0xa9b4a8 }),
      beak: new THREE.MeshLambertMaterial({ color: 0x9aa48e }),
      eye: new THREE.MeshLambertMaterial({ color: 0x101a14 }),
    };
  }
  return tidebackMats;
}

function getBrushbuckMats(): BrushbuckMats {
  if (!brushbuckMats) {
    brushbuckMats = {
      fur: new THREE.MeshLambertMaterial({ map: brushbuckTex() }),
      pale: new THREE.MeshLambertMaterial({ color: 0xe4d8be }),
      dark: new THREE.MeshLambertMaterial({ color: 0x4c3620 }),
      pink: new THREE.MeshLambertMaterial({ color: 0xc98f8f }),
    };
  }
  return brushbuckMats;
}

// ---------------------------------------------------------------- visuals

export interface MobVisual {
  group: THREE.Group;                        // origin = feet on the ground
  animate(t: number, moving: number): void;  // t = seconds, moving 0..1 gait blend
  setFlash(on: boolean): void;               // hit feedback: all meshes to flat red
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
function makeSnake(): MobShape {
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
function makeRat(): MobShape {
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
function makeScorpion(): MobShape {
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
function makeWurm(): MobShape {
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

// sand vulture: ~1.1 m soaring scavenger, ~2 m wingspan; faces +Z (head at +Z)
function makeVulture(): MobShape {
  const mats = getVultureMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // gentle soaring sway
  group.add(pivot);

  // dark horizontal body, slightly tail-heavy
  const body = sph(0.32, 0.34, 0.6, mats.plumage, 0, 0.66, -0.08);
  body.rotation.x = 0.06;
  pivot.add(body);

  // spread tail: a fan of flat feather slats at the back
  for (const s of [-1, 0, 1]) {
    const tail = box(0.1, 0.03, 0.36, mats.feather, s * 0.08, 0.62, -0.62);
    tail.rotation.y = s * 0.32;
    pivot.add(tail);
  }

  // long bare neck, pale frill at its root, small bald head with a hooked beak
  const neck = new THREE.Group();
  neck.position.set(0, 0.78, 0.34);
  neck.rotation.x = 0.18;
  neck.add(box(0.11, 0.3, 0.11, mats.skin, 0, 0.15, 0)); // long bare pinkish neck
  neck.add(box(0.22, 0.07, 0.22, mats.plumage, 0, 0.0, -0.01)); // pale frill collar
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.32, 0.01);
  headRoot.add(sph(0.13, 0.12, 0.15, mats.skin, 0, 0, 0.02));
  headRoot.add(box(0.08, 0.07, 0.12, mats.beak, 0, -0.01, 0.12)); // dark beak
  const hook = box(0.05, 0.06, 0.05, mats.beak, 0, -0.055, 0.175); // hooked tip
  hook.rotation.x = 0.6;
  headRoot.add(hook);
  headRoot.add(box(0.025, 0.025, 0.02, mats.eye, -0.06, 0.03, 0.08));
  headRoot.add(box(0.025, 0.025, 0.02, mats.eye, 0.06, 0.03, 0.08));
  neck.add(headRoot);
  pivot.add(neck);

  // broad tapered wings: wide root plank narrowing to long dark tips
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.16, 0.72, -0.02);
    wing.add(box(0.55, 0.05, 0.46, mats.plumage, side * 0.28, 0, 0.01));
    const tip = box(0.5, 0.04, 0.36, mats.feather, side * 0.75, 0, -0.03);
    tip.rotation.z = side * 0.1; // slight dihedral
    wing.add(tip);
    wings.push(wing);
    pivot.add(wing);
  }

  // long bare legs with dark talons, trailing in flight
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, 0.5, 0.02);
    leg.add(box(0.05, 0.34, 0.05, mats.skin, 0, -0.17, 0));
    leg.add(box(0.07, 0.03, 0.14, mats.beak, 0, -0.35, 0.05)); // talon foot
    legs.push(leg);
    pivot.add(leg);
  }

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    // airborne: deep even flaps; on the sand: wings half-folded, fluttering
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const flap = Math.sin(t * (2.2 + 2.6 * mv) + i * 0.5);
      const fold = 0.14 - 0.5 * mv; // folded at rest, raised mid-flap in flight
      wings[i].rotation.z = side * (fold + flap * (0.06 + 0.42 * mv));
    }
    // body sways with the beat; neck leads a touch
    pivot.position.y = Math.sin(t * 2.2) * 0.015 * mv;
    pivot.rotation.x = 0.04 * Math.sin(t * 2.2 + 1.2) * mv;
    headRoot.rotation.x = -0.1 + 0.12 * Math.sin(t * 0.9);
    // legs hang straight and trail while flying, stiff on the ground
    for (const leg of legs) leg.rotation.x = -0.5 * mv + Math.sin(t * 3.4 + 0.7) * 0.08 * mv;
  };
  return { group, animate };
}

// thornback tortoise: ~1.1 m long, ~0.75 m tall domed shell rimmed with thorns; faces +Z
function makeTortoise(): MobShape {
  const mats = getTortoiseMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // slow plod bob
  group.add(pivot);

  const legH = 0.14;

  // domed shell: flattened sphere
  pivot.add(sph(1.05, 0.75, 1.15, mats.shell, 0, legH + 0.31, -0.02));

  // thorns poking up around the shell rim (skip the front where the head exits)
  for (const a of [0.9, 1.4, 1.9, 2.4, 2.9, Math.PI, 3.3, 3.8, 4.3, 4.8, 5.3]) {
    const thorn = box(0.09, 0.16, 0.09, mats.thorn, Math.sin(a) * 0.52, legH + 0.44, Math.cos(a) * 0.57 - 0.02);
    thorn.rotation.z = -Math.sin(a) * 0.45; // lean outward
    thorn.rotation.x = Math.cos(a) * 0.45;
    pivot.add(thorn);
  }

  // four stout column legs
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.33, -0.35]) {
      const leg = box(0.16, legH + 0.06, 0.18, mats.skin, side * 0.32, (legH + 0.06) / 2, z);
      legs.push(leg);
      pivot.add(leg);
    }
  }

  // small head with a beaky front; headRoot breathing in/out
  const headRoot = new THREE.Group();
  headRoot.position.set(0, legH + 0.17, 0.66);
  headRoot.add(box(0.2, 0.17, 0.18, mats.skin, 0, 0, 0));
  headRoot.add(box(0.12, 0.09, 0.1, mats.beak, 0, -0.03, 0.13));
  headRoot.add(box(0.035, 0.035, 0.02, mats.eye, -0.08, 0.04, 0.09));
  headRoot.add(box(0.035, 0.035, 0.02, mats.eye, 0.08, 0.04, 0.09));
  pivot.add(headRoot);

  // short stubby tail at the rear
  pivot.add(box(0.09, 0.09, 0.16, mats.skin, 0, legH + 0.12, -0.66));

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    // slow plod: tiny body bob, legs shuffle in diagonal pairs
    pivot.position.y = Math.abs(Math.sin(t * (1.4 + 1.2 * mv))) * 0.008 * mv;
    const lp = t * (1.6 + 1.4 * mv);
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(lp + (i % 2) * Math.PI + (i < 2 ? 0 : 0.6)) * 0.3 * mv;
    // head breathes in/out at rest, extends forward while walking
    const breath = Math.sin(t * 0.9);
    headRoot.position.z = 0.66 + breath * 0.05 * (1 - mv) + 0.05 * mv;
    headRoot.rotation.x = 0.05 * mv + breath * 0.03 * (1 - mv);
  };
  return { group, animate };
}

// fennec fox: ~0.55 m long, sandy body with huge triangular ears; faces +Z
function makeFennec(): MobShape {
  const mats = getFennecMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // trot bob
  group.add(pivot);

  pivot.add(box(0.2, 0.2, 0.36, mats.fur, 0, 0.24, -0.02));

  // wedge head with pointed pale snout
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.3, 0.24);
  headRoot.add(box(0.16, 0.15, 0.14, mats.fur, 0, 0, 0));
  headRoot.add(box(0.07, 0.06, 0.13, mats.pale, 0, -0.04, 0.12));
  headRoot.add(box(0.03, 0.025, 0.02, mats.dark, -0.06, 0.03, 0.075));
  headRoot.add(box(0.03, 0.025, 0.02, mats.dark, 0.06, 0.03, 0.075));
  headRoot.add(box(0.028, 0.022, 0.02, mats.pink, 0, -0.03, 0.185));
  pivot.add(headRoot);

  // huge triangular ears with pink inner panels
  const earL = box(0.09, 0.2, 0.025, mats.fur, -0.09, 0.48, 0.18);
  const earR = box(0.09, 0.2, 0.025, mats.fur, 0.09, 0.48, 0.18);
  const earInL = box(0.055, 0.13, 0.02, mats.pink, -0.09, 0.47, 0.196);
  const earInR = box(0.055, 0.13, 0.02, mats.pink, 0.09, 0.47, 0.196);
  earL.rotation.z = 0.28;
  earR.rotation.z = -0.28;
  pivot.add(earL, earR, earInL, earInR);

  // slender legs
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.13, -0.15]) {
      const leg = box(0.05, 0.16, 0.05, mats.fur, side * 0.08, 0.08, z);
      legs.push(leg);
      pivot.add(leg);
    }
  }

  // long tail with a pale tuft; tailRoot sways from the base
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.25, -0.2);
  tailRoot.add(box(0.06, 0.06, 0.24, mats.fur, 0, -0.02, -0.12));
  tailRoot.add(box(0.09, 0.09, 0.12, mats.pale, 0, -0.03, -0.3));
  pivot.add(tailRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    // quick trot: bob + leg pump
    pivot.position.y = Math.abs(Math.sin(t * (4 + 3 * mv))) * 0.02 * mv + Math.sin(t * 2.2) * 0.003;
    const lp = t * (6 + 4 * mv);
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(lp + (i % 2) * Math.PI + (i < 2 ? 0 : 0.7)) * 0.55 * mv;
    // tail sways, raises while running
    tailRoot.rotation.y = Math.sin(t * (2.2 + 3.2 * mv)) * (0.14 + 0.22 * mv);
    tailRoot.rotation.x = -0.1 + 0.25 * mv + Math.sin(t * (2.6 + 2.4 * mv)) * 0.05 * mv;
    // idle ear twitch
    const twL = Math.max(0, Math.sin(t * 5.7)) ** 8 * (1 - mv);
    const twR = Math.max(0, Math.sin(t * 5.7 + 2.3)) ** 8 * (1 - mv);
    earL.rotation.z = 0.28 + twL * 0.3;
    earR.rotation.z = -0.28 - twR * 0.3;
    headRoot.rotation.x = Math.sin(t * 1.6) * 0.04 * (1 - mv) - 0.06 * mv;
  };
  return { group, animate };
}

// trader: 1.8 m tall robed humanoid merchant — Nomads and their Keepers share the road-worn look
function makeTrader(): MobShape {
  const mats = getTraderMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // slow weight-shift sway
  group.add(pivot);

  // tall floor-length robe with a flared hem
  pivot.add(box(0.62, 1.42, 0.42, mats.robe, 0, 0.71, 0));
  pivot.add(box(0.72, 0.18, 0.5, mats.robe, 0, 0.09, 0));
  // sash at the waist
  pivot.add(box(0.66, 0.14, 0.46, mats.sash, 0, 0.86, 0));

  // arms hang at the sides, hands clasped low in front
  for (const side of [-1, 1]) {
    pivot.add(box(0.14, 0.8, 0.16, mats.robe, side * 0.38, 0.8, 0.02));
    pivot.add(box(0.1, 0.1, 0.1, mats.skin, side * 0.16, 0.7, 0.18));
  }

  // coin-pouch bulge at the left hip, gold tie
  pivot.add(sph(0.2, 0.22, 0.16, mats.pouch, 0.28, 0.82, 0.24));
  pivot.add(box(0.06, 0.05, 0.05, mats.coin, 0.28, 0.94, 0.24));

  // head with wrapped scarf/hood: band above the forehead + neck wrap
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 1.56, 0);
  headRoot.add(box(0.26, 0.26, 0.24, mats.skin, 0, 0, 0));
  headRoot.add(box(0.3, 0.1, 0.28, mats.scarf, 0, 0.15, 0));
  headRoot.add(box(0.3, 0.09, 0.3, mats.scarf, 0, 0.21, -0.05));
  headRoot.add(box(0.3, 0.1, 0.3, mats.scarf, 0, -0.16, -0.02));
  headRoot.add(box(0.04, 0.04, 0.03, mats.eye, -0.07, 0.02, 0.12));
  headRoot.add(box(0.04, 0.04, 0.03, mats.eye, 0.07, 0.02, 0.12));
  pivot.add(headRoot);

  const animate = (t: number, moving: number): void => {
    // merchant on his beat: a weight shift at rest, a robe-cushioned shuffle walking
    const step = moving ? Math.sin(t * 5) : 0;
    pivot.rotation.z = Math.sin(t * 0.6) * 0.01 + step * 0.02;
    pivot.position.y = Math.abs(step) * 0.015;
    headRoot.position.y = 1.56 + Math.sin(t * 0.9) * 0.012 + Math.abs(step) * 0.008;
    headRoot.rotation.y = Math.sin(t * 0.35) * 0.08 + (moving ? step * 0.05 : 0);
  };
  return { group, animate };
}

// snow stalker: ~2.3 m lanky alpine hunter on four long legs; snake-model body
// scaled up and raised off the ground; faces +Z (head at +Z)
function makeStalker(): MobShape {
  const mats = getStalkerMats();
  const group = new THREE.Group();

  const legH = 0.32;
  const segs: Seg[] = [];
  const ridges: Ridge[] = [];

  // body segments (tail -> neck), same slinking chain as the snake, standing tall
  const zs = [0.78, 0.44, 0.10, -0.24, -0.58, -0.90];
  const ws = [0.28, 0.33, 0.34, 0.31, 0.24, 0.15];
  const hs = [0.24, 0.29, 0.30, 0.27, 0.21, 0.13];
  const d = 0.36;
  for (let i = 0; i < zs.length; i++) {
    const bx = Math.sin(i * 0.8) * 0.06; // shallow S at rest
    const m = box(ws[i], hs[i] * 2, d, mats.fur, bx, legH + hs[i], zs[i]);
    segs.push({ mesh: m, bx, w: ws[i], h: hs[i] * 2, d });
    ridges.push({ mesh: box(ws[i] * 0.35, 0.04, d * 0.9, mats.dark, bx, legH + hs[i] * 2 + 0.015, zs[i]), w: ws[i] });
    group.add(m, ridges[i].mesh);
  }

  // four slender legs with pale paws, planted under the mid and front segments
  const legs: THREE.Mesh[] = [];
  const paws: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.44, -0.24]) {
      const leg = box(0.09, legH + 0.02, 0.13, mats.fur, side * 0.26, (legH + 0.02) / 2, z);
      legs.push(leg);
      const paw = box(0.11, 0.06, 0.2, mats.pale, side * 0.26, 0.03, z + 0.03);
      paws.push(paw);
      group.add(leg, paw);
    }
  }

  // narrow wedge head with small dark ears; headRoot sways independently
  const headRoot = new THREE.Group();
  headRoot.position.set(Math.sin(0) * 0.06, legH + 0.44, 1.02);
  headRoot.add(box(0.28, 0.26, 0.42, mats.fur, 0, 0, 0.05));
  headRoot.add(box(0.13, 0.11, 0.16, mats.pale, 0, -0.06, 0.28)); // pale muzzle
  headRoot.add(box(0.04, 0.04, 0.03, mats.eye, -0.13, 0.07, 0.24));
  headRoot.add(box(0.04, 0.04, 0.03, mats.eye, 0.13, 0.07, 0.24));
  const earL = box(0.06, 0.11, 0.03, mats.dark, -0.1, 0.2, -0.05);
  const earR = box(0.06, 0.11, 0.03, mats.dark, 0.1, 0.2, -0.05);
  earL.rotation.z = 0.2;
  earR.rotation.z = -0.2;
  headRoot.add(earL, earR);
  group.add(headRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    const amp = 0.02 + 0.09 * mv;
    const ph = t * (3.5 + 3.5 * mv);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const wob = Math.sin(ph - i * 0.85) * amp;
      s.mesh.position.x = s.bx + wob;
      s.mesh.rotation.y = -wob * 1.2;
      const br = 1 + Math.sin(t * 1.9) * 0.03 * (1 - mv * 0.6); // faint breathing
      s.mesh.scale.set(s.w * br, s.h, s.d);
      const r = ridges[i];
      r.mesh.position.x = s.mesh.position.x;
      r.mesh.rotation.y = s.mesh.rotation.y;
      r.mesh.scale.x = r.w * br;
    }
    // legs pump in diagonal pairs while running, planted at rest
    const lp = t * (4.5 + 4.5 * mv);
    for (let i = 0; i < legs.length; i++) {
      const pair = (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI); // front-left/back-right in phase
      const sw = Math.sin(lp + pair) * 0.6 * mv;
      legs[i].rotation.x = sw;
      paws[i].rotation.x = sw * 0.5;
    }
    headRoot.position.x = Math.sin(ph + 0.85) * amp * 0.6;
    headRoot.rotation.y = Math.sin(t * (2.4 + 2.8 * mv)) * (0.06 + 0.16 * mv);
    headRoot.rotation.x = -0.08 * mv + Math.sin(t * 1.3) * 0.03 * (1 - mv);
  };
  return { group, animate };
}

// tideback: ~2 m long coastal mega-grazer, Tortoise-model scaled up; heavy
// barnacle-crusted shell on tree-trunk legs; faces +Z
function makeTideback(): MobShape {
  const mats = getTidebackMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // slow plod bob
  group.add(pivot);

  const legH = 0.26;

  // massive domed shell: flattened sphere
  pivot.add(sph(1.7, 1.2, 1.85, mats.hide, 0, legH + 0.5, -0.05));

  // barnacle clusters crusting the shell rim (skip the front where the head exits)
  for (const a of [0.9, 1.5, 2.1, 2.7, Math.PI, 3.6, 4.3, 5.1]) {
    const bump = sph(0.16, 0.13, 0.16, mats.barnacle, Math.sin(a) * 0.82, legH + 0.62, Math.cos(a) * 0.9 - 0.05);
    pivot.add(bump);
  }
  pivot.add(sph(0.13, 0.11, 0.13, mats.barnacle, 0.35, legH + 1.12, -0.4));
  pivot.add(sph(0.15, 0.12, 0.15, mats.barnacle, -0.3, legH + 1.16, 0.1));

  // four stout column legs
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.55, -0.55]) {
      const leg = box(0.3, legH + 0.12, 0.34, mats.skin, side * 0.55, (legH + 0.12) / 2, z);
      legs.push(leg);
      pivot.add(leg);
    }
  }

  // broad head with a thick beaky front; headRoot breathing in/out
  const headRoot = new THREE.Group();
  headRoot.position.set(0, legH + 0.32, 1.02);
  headRoot.add(box(0.36, 0.32, 0.34, mats.skin, 0, 0, 0));
  headRoot.add(box(0.22, 0.17, 0.17, mats.beak, 0, -0.06, 0.24));
  headRoot.add(box(0.05, 0.05, 0.025, mats.eye, -0.14, 0.08, 0.16));
  headRoot.add(box(0.05, 0.05, 0.025, mats.eye, 0.14, 0.08, 0.16));
  pivot.add(headRoot);

  // short heavy tail at the rear
  pivot.add(box(0.15, 0.15, 0.28, mats.skin, 0, legH + 0.22, -1.02));

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    // ponderous plod: tiny body bob, legs shuffle in diagonal pairs
    pivot.position.y = Math.abs(Math.sin(t * (1.1 + 0.9 * mv))) * 0.01 * mv;
    const lp = t * (1.3 + 1.1 * mv);
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(lp + (i % 2) * Math.PI + (i < 2 ? 0 : 0.6)) * 0.26 * mv;
    // head breathes in/out at rest, extends forward while walking
    const breath = Math.sin(t * 0.7);
    headRoot.position.z = 1.02 + breath * 0.06 * (1 - mv) + 0.06 * mv;
    headRoot.rotation.x = 0.05 * mv + breath * 0.03 * (1 - mv);
  };
  return { group, animate };
}

// brushbuck: ~1.2 m fleeing plains herd animal, Kangaroo-Rat model scaled up;
// long hind legs, cream belly, dark tail tuft; faces +Z
function makeBrushbuck(): MobShape {
  const mats = getBrushbuckMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // bounded up/down by animate
  group.add(pivot);

  const body = box(0.5, 0.58, 0.78, mats.fur, 0, 0.6, -0.05);
  pivot.add(body);

  // head root (sway/nod), head + nose + eyes
  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.72, 0.42);
  headRoot.add(box(0.3, 0.28, 0.3, mats.fur, 0, 0, 0.1));
  headRoot.add(box(0.09, 0.07, 0.09, mats.pink, 0, -0.05, 0.28));
  headRoot.add(box(0.05, 0.05, 0.035, mats.dark, -0.12, 0.06, 0.23));
  headRoot.add(box(0.05, 0.05, 0.035, mats.dark, 0.12, 0.06, 0.23));
  pivot.add(headRoot);

  // upright ears, smaller than the rat's but still prominent
  const earL = box(0.11, 0.26, 0.055, mats.fur, -0.15, 0.98, 0.34);
  const earR = box(0.11, 0.26, 0.055, mats.fur, 0.15, 0.98, 0.34);
  const earInL = box(0.065, 0.16, 0.045, mats.pink, -0.15, 0.97, 0.356);
  const earInR = box(0.065, 0.16, 0.045, mats.pink, 0.15, 0.97, 0.356);
  earL.rotation.z = 0.2;
  earR.rotation.z = -0.2;
  pivot.add(earL, earR, earInL, earInR);

  // huge hind legs: thigh + long pale foot
  const thighL = box(0.19, 0.3, 0.26, mats.fur, -0.26, 0.32, -0.13);
  const thighR = box(0.19, 0.3, 0.26, mats.fur, 0.26, 0.32, -0.13);
  const footL = box(0.15, 0.08, 0.46, mats.pale, -0.28, 0.06, 0.05);
  const footR = box(0.15, 0.08, 0.46, mats.pale, 0.28, 0.06, 0.05);
  pivot.add(thighL, thighR, footL, footR);

  // small forepaws
  pivot.add(box(0.075, 0.08, 0.15, mats.pale, -0.17, 0.26, 0.35));
  pivot.add(box(0.075, 0.08, 0.15, mats.pale, 0.17, 0.26, 0.35));

  // long tail with a dark tuft; tailRoot flicks from the base
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.38, -0.44);
  tailRoot.add(box(0.09, 0.09, 0.42, mats.fur, 0, 0, -0.21));
  tailRoot.add(box(0.07, 0.07, 0.4, mats.fur, 0, -0.08, -0.6));
  tailRoot.add(box(0.13, 0.1, 0.2, mats.dark, 0, -0.13, -0.88));
  pivot.add(tailRoot);

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    const hop = Math.abs(Math.sin(t * (2.4 + 2.2 * mv)));
    pivot.position.y = hop * 0.22 * mv + Math.sin(t * 1.6) * 0.006; // big hop + idle breath
    body.scale.y = 0.58 * (1 + Math.sin(t * 1.8) * 0.03 * (1 - mv));
    // hind feet tuck mid-hop
    footL.rotation.x = footR.rotation.x = -0.5 * hop * mv;
    thighL.rotation.x = thighR.rotation.x = -0.3 * hop * mv;
    // tail flicks faster when running, droops at rest
    tailRoot.rotation.y = Math.sin(t * (1.6 + 3.2 * mv)) * (0.1 + 0.28 * mv);
    tailRoot.rotation.x = -0.1 - 0.15 * mv + Math.sin(t * (2.4 + 2.2 * mv)) * 0.06 * mv;
    // idle ear twitch
    const tw = Math.max(0, Math.sin(t * 5.1)) ** 8 * (1 - mv);
    earL.rotation.z = 0.2 + tw * 0.25;
    earR.rotation.z = -0.2 - Math.max(0, Math.sin(t * 5.1 + 2.1)) ** 8 * (1 - mv) * 0.25;
    headRoot.rotation.x = -0.1 * hop * mv + Math.sin(t * 1.2) * 0.03 * (1 - mv);
  };
  return { group, animate };
}

// machine chassis plate: dull gunmetal, panel seams, bolt heads, rust bloom
function metalTex(): THREE.CanvasTexture {
  return canvasTex((g, rnd) => {
    g.fillStyle = "#5a606a";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 350; i++) {
      const v = 0.5 + (rnd() - 0.5) * 0.18;
      g.fillStyle = v > 0.5 ? "#666c76" : "#4d535c";
      g.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
    }
    // panel seams
    g.fillStyle = "#3c4148";
    g.fillRect(0, 21, 64, 1); g.fillRect(0, 43, 64, 1);
    g.fillRect(27, 0, 1, 21); g.fillRect(46, 43, 1, 21);
    // bolt heads along the seams
    g.fillStyle = "#7a808a";
    for (const [bx, by] of [[6, 18], [18, 18], [34, 18], [50, 18], [10, 46], [28, 46], [52, 46]] as const) {
      g.fillRect(bx, by, 2, 2);
      g.fillStyle = "#2e3238"; g.fillRect(bx + 2, by, 1, 2); g.fillStyle = "#7a808a";
    }
    // rust blooms at the edges
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 2 ? "#7a4a2c" : "#8a5a36";
      const rx = rnd() * 64, ry = rnd() * 64, s = 1 + rnd() * 3;
      g.fillRect(rx | 0, ry | 0, s | 0, s | 0);
    }
  });
}

interface MachineMats { plate: THREE.Material; dark: THREE.Material; optic: THREE.Material; accent: THREE.Material; }
let machineMats: MachineMats | null = null;
function getMachineMats(): MachineMats {
  if (!machineMats) machineMats = {
    plate: new THREE.MeshLambertMaterial({ map: metalTex() }),
    dark: new THREE.MeshLambertMaterial({ color: 0x2e3238 }),
    optic: new THREE.MeshBasicMaterial({ color: 0xd84040 }),
    accent: new THREE.MeshLambertMaterial({ color: 0x8a6a35 }),
  };
  return machineMats;
}

// the machine rig: three-part box chassis — legs/base, torso, head with a red
// optic — shared skeleton, per-kind proportions and attachments. Faces +Z.
function makeMachine(kind: "warden" | "sentry" | "breaker" | "hauler"): MobShape {
  const mats = getMachineMats();
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);
  const legs: THREE.Object3D[] = [];
  let torso: THREE.Mesh, headRoot: THREE.Group, optic: THREE.Mesh;

  if (kind === "hauler") {
    // a battered cart on four stub wheels with a cab at the front
    for (const side of [-1, 1]) for (const z of [0.55, -0.55]) {
      const wheel = box(0.18, 0.44, 0.44, mats.dark, side * 0.55, 0.22, z);
      wheel.rotation.z = Math.PI / 2; // disc facing sideways
      legs.push(wheel); pivot.add(wheel);
    }
    torso = box(1.1, 0.6, 1.5, mats.plate, 0, 0.78, 0);
    pivot.add(torso);
    pivot.add(box(1.0, 0.16, 1.4, mats.dark, 0, 1.16, -0.05)); // cargo deck lip
    headRoot = new THREE.Group();
    headRoot.position.set(0, 1.35, 0.55);
    headRoot.add(box(0.44, 0.34, 0.36, mats.plate, 0, 0, 0));
    optic = box(0.1, 0.1, 0.03, mats.optic, 0, 0.04, 0.19);
    headRoot.add(optic);
    pivot.add(headRoot);
    // a Crane-Arm stub — the Dominion's forklift
    const arm = box(0.14, 0.14, 0.7, mats.dark, 0, 1.0, 1.05);
    pivot.add(arm);
  } else {
    const tall = kind === "sentry";
    const heavy = kind === "breaker";
    const legH = tall ? 0.75 : heavy ? 0.6 : 0.55;
    const legW = heavy ? 0.3 : 0.18;
    for (const side of [-1, 1]) {
      const leg = box(legW, legH, legW * 1.2, mats.dark, side * (heavy ? 0.34 : 0.2), legH / 2, 0);
      legs.push(leg); pivot.add(leg);
      pivot.add(box(legW * 1.3, 0.1, legW * 1.9, mats.dark, side * (heavy ? 0.34 : 0.2), 0.05, 0.05)); // foot
    }
    const tw = heavy ? 1.1 : tall ? 0.55 : 0.45;
    const th = heavy ? 0.9 : tall ? 0.85 : 0.7;
    torso = box(tw, th, heavy ? 0.75 : 0.42, mats.plate, 0, legH + th / 2, 0);
    pivot.add(torso);
    if (heavy) {
      // drum arms: twin grinders on stubby shoulders
      for (const side of [-1, 1]) {
        pivot.add(box(0.24, 0.24, 0.5, mats.dark, side * (tw / 2 + 0.2), legH + th - 0.25, 0.15));
        const drum = box(0.3, 0.3, 0.34, mats.accent, side * (tw / 2 + 0.42), legH + th - 0.55, 0.3);
        legs.push(drum); pivot.add(drum);
      }
      pivot.add(box(tw * 0.8, 0.14, 0.5, mats.dark, 0, legH + th + 0.05, 0)); // shoulder yoke
    } else if (tall) {
      // soldier: shoulder pads and a spear-arm held forward
      for (const side of [-1, 1]) pivot.add(box(0.2, 0.14, 0.34, mats.plate, side * 0.36, legH + th + 0.02, 0));
      const arm = box(0.12, 0.12, 0.8, mats.dark, 0.28, legH + th * 0.55, 0.5);
      legs.push(arm); pivot.add(arm);
      pivot.add(box(0.06, 0.06, 0.5, mats.accent, 0.28, legH + th * 0.55, 1.05)); // the lance
    } else {
      // warden: a single sensor mast and one clutching claw-arm
      pivot.add(box(0.06, 0.5, 0.06, mats.dark, 0, legH + th + 0.25, -0.1));
      const tip = box(0.1, 0.1, 0.1, mats.optic, 0, legH + th + 0.55, -0.1);
      legs.push(tip); pivot.add(tip);
      const arm = box(0.1, 0.1, 0.55, mats.dark, 0.3, legH + th * 0.6, 0.3);
      legs.push(arm); pivot.add(arm);
    }
    headRoot = new THREE.Group();
    headRoot.position.set(0, legH + th + (heavy ? 0.25 : tall ? 0.22 : 0.18), 0);
    const hw = heavy ? 0.5 : 0.32;
    headRoot.add(box(hw, 0.26, 0.3, mats.plate, 0, 0.13, 0));
    optic = heavy
      ? box(0.3, 0.07, 0.03, mats.optic, 0, 0.15, 0.16)
      : box(0.1, 0.1, 0.03, mats.optic, 0, 0.14, 0.16);
    headRoot.add(optic);
    pivot.add(headRoot);
  }

  const animate = (t: number, moving: number): void => {
    const mv = Math.max(0, Math.min(1, moving));
    // machine gait: no breathing, a hard even stomp; idle is a sensor sweep
    const lp = t * (kind === "hauler" ? 0 : 2.2 + 1.6 * mv);
    for (let i = 0; i < legs.length; i++) {
      const o = legs[i];
      if (kind === "hauler") o.rotation.x = t * 4 * mv; // wheels roll
      else o.rotation.x = Math.sin(lp + (i % 2) * Math.PI) * 0.5 * mv;
    }
    if (kind === "hauler") pivot.position.y = Math.abs(Math.sin(t * 6)) * 0.02 * mv;
    else pivot.position.y = Math.abs(Math.sin(lp)) * 0.03 * mv;
    headRoot.rotation.y = mv === 0 ? Math.sin(t * 0.9) * 0.5 : 0; // sweeps when it stands
    optic.scale.setScalar(1 + Math.sin(t * (2.6 + mv * 2)) * 0.12); // optic pulse
  };
  return { group, animate };
}

// what the model factories build; the wrapper adds hit-flash
type MobShape = { group: THREE.Group; animate(t: number, moving: number): void; setFlash?(on: boolean): void };

// flat full-bright red swapped in while a mob is taking a hit — one shared
// material, originals parked on each mesh
const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xc83830 });
function attachFlash(vis: MobShape): MobVisual {
  const meshes: THREE.Mesh[] = [];
  vis.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const orig = meshes.map((m) => m.material);
  vis.setFlash = (on: boolean) => meshes.forEach((m, i) => { m.material = on ? FLASH_MAT : orig[i]; });
  return vis as MobVisual;
}

export function makeMobMesh(kind: MobKind): MobVisual {
  switch (kind) {
    case "snake": return attachFlash(makeSnake());
    case "rat": return attachFlash(makeRat());
    case "scorpion": return attachFlash(makeScorpion());
    case "wurm": return attachFlash(makeWurm());
    case "trader": return attachFlash(makeTrader());
    case "vulture": return attachFlash(makeVulture());
    case "tortoise": return attachFlash(makeTortoise());
    case "fennec": return attachFlash(makeFennec());
    case "stalker": return attachFlash(makeStalker());
    case "tideback": return attachFlash(makeTideback());
    case "brushbuck": return attachFlash(makeBrushbuck());
    case "warden": return attachFlash(makeMachine("warden"));
    case "sentry": return attachFlash(makeMachine("sentry"));
    case "breaker": return attachFlash(makeMachine("breaker"));
    case "hauler": return attachFlash(makeMachine("hauler"));
    case "sentinel": return attachFlash(makeSentinel());
  }
}

// The Sentinel: the breaker rig stood up to five cells tall — a shielded
// arena warden, its optic ringed by the emitter that hums over the Arena.
function makeSentinel(): MobShape {
  const v = makeMachine("breaker");
  v.group.scale.setScalar(2.3);
  return v;
}

// ---------------------------------------------------------------- fauna modes

// which planet the spawner is stocking. Game calls setFauna() on world switch;
// never calling it leaves Desertis behavior exactly as it has always been.
export type FaunaPlanet = "desertis" | "silvaris";

let faunaPlanet: FaunaPlanet = "desertis";
let faunaSeed = 0;

export function setFauna(planet: FaunaPlanet, seed: number): void {
  faunaPlanet = planet;
  faunaSeed = seed >>> 0;
}

export function getFauna(): FaunaPlanet { return faunaPlanet; }

// silvarisSpawns() tables are keyed by display name; map to registry kinds
const SIL_MOB_KIND: Record<string, MobKind> = {
  "Snow Stalker": "stalker",
  "Tideback": "tideback",
  "Brushbuck": "brushbuck",
};

/** Per-species live caps for the current planet (0 = never spawn here).
 *  Desertis values are exactly the ones the top-up loop hardcoded before. */
export function faunaTargets(): Record<MobKind, number> {
  // machines never stock by chance: game.ts stations them at sites (Camps,
  // Relays, the Wreck) — the random loop keeps its hands off them
  if (faunaPlanet === "desertis")
    return { snake: 4, rat: 8, scorpion: 4, wurm: 1, trader: 0, vulture: 3, tortoise: 2, fennec: 2, stalker: 0, tideback: 0, brushbuck: 0, warden: 0, sentry: 0, breaker: 0, hauler: 0, sentinel: 0 };
  return { snake: 0, rat: 0, scorpion: 0, wurm: 0, trader: 0, vulture: 0, tortoise: 0, fennec: 0, stalker: 3, tideback: 3, brushbuck: 6, warden: 0, sentry: 0, breaker: 0, hauler: 0, sentinel: 0 };
}

/** The kinds the top-up loop should try, in spawn order. */
export function faunaSpawnKinds(): MobKind[] {
  if (faunaPlanet === "desertis") return ["snake", "rat", "scorpion", "wurm", "vulture", "tortoise", "fennec"];
  return ["stalker", "tideback", "brushbuck"];
}

/** Weighted species pick for a candidate Silvaris site at (x,z) — biome table
 *  from silvaris.ts, plus the Snow Stalker's cold Boreal-edge fringe (weight 1).
 *  null means the site's biome stands empty (the Scorch Belt, open ocean). */
export function pickSilvarisMob(x: number, z: number): MobKind | null {
  const biome = biomeAt(x, z, faunaSeed);
  const table = silvarisSpawns(biome).slice();
  if (biome === SB_BOREAL) table.push({ mob: "Snow Stalker", weight: 1 }); // Boreal edge: stalkers hunt down off the peaks
  let total = 0;
  for (const e of table) total += e.weight;
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const e of table) {
    roll -= e.weight;
    if (roll < 0) return SIL_MOB_KIND[e.mob] ?? null;
  }
  return null;
}

/** A Silvaris spawn site stands on GRASS/SNOW/SAND/BASALT and above sea level. */
export function silvarisSiteOk(underfoot: number, y: number): boolean {
  return y > SIL_SEA && (underfoot === GRASS || underfoot === SNOW || underfoot === SAND || underfoot === BASALT);
}

/** Roll the herd batch for one site (herd species move in groups; loners return 1). */
export function herdSize(kind: MobKind): number {
  const h = MOB_DEFS[kind].herd;
  if (!h) return 1;
  return h.min + Math.floor(Math.random() * (h.max - h.min + 1));
}
