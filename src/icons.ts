// Item icons: every inventory cell shows the item's own pixel art. Block-backed
// items sample the world texture atlas; hand-drawn items (canisters, tools,
// backpacks, rods, visors) are painted per footprint, then sliced into 16px
// cells matching the item's Inventory Grid shape (row-major, unrotated).
import { DOOR_UPPER, DOOR_CLOSED, BENCH, BENCH_EXT, BEACON, CAMPFIRE, BED, BED_EXT, WOOD, DEADWOOD } from "./blocks";
import { ITEMS } from "./items";
import { TILE_SRC, TILE_PX, getAtlasCanvas } from "./renderer";

const T = TILE_PX;

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
const blit = (g: CanvasRenderingContext2D, dx: number, dy: number, blockId: number) => {
  const [sx, sy] = TILE_SRC(blockId);
  g.drawImage(getAtlasCanvas(), sx, sy, T, T, dx, dy, T, T);
};
const rect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};
const outline = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};
const line = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, wd = 2) => {
  g.strokeStyle = c; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
};
const poly = (g: CanvasRenderingContext2D, pts: number[][], c: string) => {
  g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fill();
};

// hand-drawn art, drawn at (def.w*16) x (def.h*16); cell 0 = top-left
/** Charge level baked into the art: "0" empty, "1" low, "2" full. A lamp or
 *  Regulator with no recorded charge has never been fuelled — it reads empty. */
export function fuelTier(id: string, charges?: number): string {
  if (id === "head_lantern") return !charges ? "0" : charges <= 2 ? "1" : "2";
  if (id === "body_regulator") return !charges ? "0" : charges <= 1 ? "1" : "2";
  // logs and dead wood sit in the Campfire's Fuel Slot burning down charge by charge
  if (id === "wood_log" || id === "deadwood") return charges === undefined ? "" : charges < 1 ? "0" : charges < 2 ? "1" : "";
  return "";
}

function drawArt(id: string, w: number, h: number, color: string, tier = ""): HTMLCanvasElement | null {
  const [cv, g] = mk(w * T, h * T);
  // shared stone silhouette for ore/rock family
  const boulder = (base: string, hi: string, lo: string) => {
    poly(g, [[3, 12], [2, 7], [5, 3], [10, 2], [14, 6], [13, 12], [8, 14]], base);
    poly(g, [[5, 3], [10, 2], [11, 6], [6, 7]], hi);
    poly(g, [[3, 12], [13, 12], [8, 14]], lo);
  };
  const specks = (c: string, lit: string, pts: number[][]) => {
    g.fillStyle = c; for (const [x, y] of pts) g.fillRect(x, y, 2, 2);
    g.fillStyle = lit; for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
  };
  const tool = id.includes("_") && (id.endsWith("pickaxe") || id.endsWith("shovel") || id.endsWith("axe") || id.endsWith("disassembler"));
  if (tool) {
    const type = id.replace(/^(wood|stone|metal|alloy)_/, "");
    const alloy = id.startsWith("alloy_");
    const edge = alloy ? "#7a4a26" : "#00000044";
    rect(g, 7, 16, 2, 14, "#6b5238");           // handle
    rect(g, 6, 14, 4, 3, "#4a4a52");            // binding
    if (type === "pickaxe") {
      line(g, 3, 12, 13, 12, color, 2); line(g, 3, 12, 3, 15, color); line(g, 13, 12, 13, 15, color);
      line(g, 4, 9, 12, 9, "#00000022", 1);
      if (alloy) line(g, 4, 11, 12, 11, "#e89a62", 1);
    } else if (type === "shovel") {
      rect(g, 5, 6, 6, 7, color); outline(g, 5, 6, 6, 7, edge);
      line(g, 6, 13, 6, 13, color); line(g, 9, 13, 9, 13, color);
      line(g, 6, 13, 7, 14, color, 1); line(g, 9, 13, 8, 14, color, 1);
      if (alloy) rect(g, 6, 7, 2, 4, "#e89a62");
    } else if (type === "axe") {
      rect(g, 9, 7, 5, 6, color); outline(g, 9, 7, 5, 6, edge);
      rect(g, 8, 8, 1, 4, color);
      if (alloy) rect(g, 10, 8, 2, 3, "#e89a62");
    } else { // disassembler: energy wrench
      rect(g, 4, 7, 8, 2, color); rect(g, 4, 7, 2, 5, color); rect(g, 10, 7, 2, 5, color);
      rect(g, 7, 11, 2, 2, "#66e5f0"); rect(g, 6, 12, 4, 1, "#2f97a6");
      if (alloy) { rect(g, 4, 8, 1, 3, "#e89a62"); rect(g, 11, 8, 1, 3, "#8a4a26"); }
    }
    if (alloy) {                                // two-tone riveted band
      rect(g, 6, 14, 4, 1, "#8a5a34"); rect(g, 6, 15, 4, 1, "#c98a56"); rect(g, 6, 16, 4, 1, "#5c3d22");
      g.fillStyle = "#f0c89a"; g.fillRect(6, 15, 1, 1); g.fillRect(9, 15, 1, 1);
    }
    return cv;
  }
  switch (id) {
    case "canister_full": case "canister_empty": {
      const full = id === "canister_full";
      const H = h * T;
      rect(g, 6, 0, 4, 3, "#8a98a8");
      rect(g, 7, 3, 2, 2, "#8a98a8");
      rect(g, 4, 5, 8, H - 7, full ? "#2f7fd6" : "#3a4750");
      outline(g, 4, 5, 8, H - 7, "#dfe6ee");
      if (full) { rect(g, 5, 10, 1, H - 13, "#5fa3ea"); rect(g, 4, 9, 8, 1, "#7f2b2b"); }
      else { rect(g, 4, 14, 8, 4, "#c8d2da"); rect(g, 6, 15, 4, 2, "#3a4750"); }
      return cv;
    }
    case "hot_water_pouch": {
      rect(g, 6, 0, 4, 3, "#8a98a8");
      rect(g, 7, 3, 2, 2, "#8a98a8");
      rect(g, 4, 5, 8, 25, "#c26a38");                 // canister hot to the touch
      outline(g, 4, 5, 8, 25, "#ffd9a8");
      rect(g, 5, 10, 1, 17, "#ff9a4f");                // inner glow
      rect(g, 4, 12, 8, 3, "#ff7a30");                 // heat band
      rect(g, 4, 16, 8, 2, "#e05a20");
      g.fillStyle = "#c8d2da";                          // steam off the cap
      g.fillRect(4, 1, 2, 1); g.fillRect(7, 0, 2, 1); g.fillRect(11, 1, 2, 1);
      return cv;
    }
    case "snake_skin": { // a hide peeled off in one piece and hung up: diamond-scaled, forked tail
      const hide = [[5, 1], [11, 1], [13, 6], [12, 20], [10, 26], [9, 31], [8, 28], [7, 31], [6, 26], [4, 20], [3, 6]];
      poly(g, hide, "#b3946a");
      g.strokeStyle = "#7a5f3e"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(hide[0][0], hide[0][1]);
      for (const [x, y] of hide) g.lineTo(x, y);
      g.closePath(); g.stroke();
      rect(g, 4, 3, 8, 1, "#8a6f4c");                 // neck ring where it was cut
      rect(g, 7, 4, 2, 22, "#cfae84");                // pale belly stripe
      g.fillStyle = "#8a6f4c";                        // diamond scale rows
      for (let y = 6; y <= 22; y += 4)
        for (let x = 5 + ((y / 4) % 2); x <= 11; x += 3) g.fillRect(x, y, 2, 1);
      g.fillStyle = "#6e5636";                        // ragged tail split
      g.fillRect(8, 26, 1, 5);
      return cv;
    }
    case "sack1": case "sack2": case "sack3": { // bound bundle: gathered neck, drawstring, tier band
      rect(g, 5, 2, 6, 3, color);
      rect(g, 4, 1, 8, 2, "#c8b58c");                // gathered cuff
      rect(g, 4, 4, 8, 1, "#4a3926");                // drawstring tie
      rect(g, 3, 5, 10, 9, color);                   // bulging belly
      outline(g, 3, 5, 10, 9, "#241a10");
      if (id === "sack2") rect(g, 3, 9, 10, 1, "#e0cfa8");   // double-layer seam
      if (id === "sack3") { rect(g, 3, 8, 10, 1, "#8fb3d9"); rect(g, 3, 9, 10, 1, "#3a5a8c"); } // cobalt rim
      g.fillStyle = "#00000033"; g.fillRect(10, 6, 2, 7);     // right-side shade
      return cv;
    }
    case "sword": // forged blade: steel edge, crossguard, wrapped grip
      rect(g, 8, 0, 1, 1, "#eef3f8"); rect(g, 7, 1, 3, 17, "#c9d2dc");
      rect(g, 8, 1, 1, 17, "#eef3f8");
      rect(g, 4, 18, 8, 2, "#4a4a52");
      rect(g, 7, 20, 3, 9, "#6b5238"); rect(g, 7, 22, 3, 1, "#4a3926"); rect(g, 7, 25, 3, 1, "#4a3926");
      rect(g, 6, 29, 5, 2, "#4a4a52");
      return cv;
    case "voidbreaker": // void-iron pick: the head looks torn out of reality
      rect(g, 7, 16, 2, 14, "#2a1d3a");
      rect(g, 6, 14, 4, 3, "#180f24");
      line(g, 3, 12, 13, 12, "#8a5ad6", 2); line(g, 3, 12, 3, 15, "#8a5ad6"); line(g, 13, 12, 13, 15, "#8a5ad6");
      g.fillStyle = "#e8d6ff"; g.fillRect(5, 9, 1, 2); g.fillRect(10, 10, 1, 1); g.fillRect(8, 11, 1, 2);
      g.fillStyle = "#00000088"; g.fillRect(7, 10, 2, 1); g.fillRect(6, 11, 1, 2);
      return cv;
    case "visor":
      rect(g, 1, 6, 14, 3, "#2e3a45");
      rect(g, 3, 4, 10, 6, "#123c44");
      rect(g, 4, 5, 8, 4, "#66e5f0");
      rect(g, 5, 5, 2, 1, "#d2f8ff");
      outline(g, 3, 4, 10, 6, "#c8d2da");
      rect(g, 1, 5, 2, 1, "#5a6875"); rect(g, 13, 5, 2, 1, "#5a6875");
      return cv;
    case "catalyst":
      rect(g, 7, 3, 2, 2, "#8898a8");
      g.fillStyle = "#c07fe0"; g.beginPath(); g.arc(8, 10, 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7a4a9a"; g.lineWidth = 1; g.beginPath(); g.arc(8, 10, 4.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#e8b8ff"; g.fillRect(6, 8, 2, 1); g.fillRect(7, 7, 1, 1);
      return cv;
    case "iron_ore":
      boulder("#5a5450", "#78716c", "#423d39");
      specks("#9e8468", "#c4a878", [[5, 6], [9, 4], [10, 9], [6, 10]]);
      return cv;
    case "copper_ore":
      boulder("#6a5a52", "#8a7466", "#4c403a");
      specks("#b86b42", "#e8935e", [[5, 6], [9, 4], [10, 9], [6, 10]]);
      return cv;
    case "cobalt_ore": {
      boulder("#4e5666", "#6a7488", "#3a4050");
      poly(g, [[7, 4], [9, 6], [7, 8], [5, 6]], "#5c74a8");        // blue crystals
      poly(g, [[10, 8], [12, 10], [10, 12], [8, 10]], "#5c74a8");
      poly(g, [[7, 4], [9, 6], [7, 6]], "#9ab8e8");
      poly(g, [[10, 8], [12, 10], [10, 10]], "#9ab8e8");
      g.fillStyle = "#c4dcf4"; g.fillRect(7, 4, 1, 1); g.fillRect(10, 8, 1, 1);
      return cv;
    }
    case "alabaster":
      boulder("#cfc8b0", "#eae3cd", "#a89f88");
      rect(g, 4, 7, 8, 1, "#b4ab92"); rect(g, 6, 10, 7, 1, "#b4ab92"); rect(g, 3, 12, 5, 1, "#b4ab92");
      g.fillStyle = "#f7f2e2"; g.fillRect(6, 3, 2, 1);
      return cv;
    case "metal":
      rect(g, 6, 1, 3, 14, "#6e747e");
      rect(g, 7, 2, 1, 12, "#b8bec8");
      g.fillStyle = "#4a4f57";
      for (const [rx, ry] of [[6, 3], [8, 7], [6, 11], [8, 13]] as const) g.fillRect(rx, ry, 1, 1);
      rect(g, 5, 1, 5, 1, "#4a4f57"); rect(g, 5, 14, 5, 1, "#4a4f57");
      return cv;
    case "copperrod":
      rect(g, 6, 1, 3, 14, "#a05a2e");
      rect(g, 7, 2, 1, 12, "#e89a62");
      g.fillStyle = "#6e3a1c";
      for (const [rx, ry] of [[6, 3], [8, 7], [6, 11], [8, 13]] as const) g.fillRect(rx, ry, 1, 1);
      rect(g, 5, 1, 5, 1, "#6e3a1c"); rect(g, 5, 14, 5, 1, "#6e3a1c");
      return cv;
    case "cobaltrod":
      rect(g, 6, 1, 3, 14, "#4a5a86");
      rect(g, 7, 2, 1, 12, "#8aa8dc");
      g.fillStyle = "#2e3a5c";
      for (const [rx, ry] of [[6, 3], [8, 7], [6, 11], [8, 13]] as const) g.fillRect(rx, ry, 1, 1);
      rect(g, 5, 1, 5, 1, "#2e3a5c"); rect(g, 5, 14, 5, 1, "#2e3a5c");
      return cv;
    case "backpack2": {
      rect(g, 8, 1, 3, 6, "#5a4229"); rect(g, 21, 1, 3, 6, "#5a4229");   // shoulder straps
      rect(g, 3, 7, 26, 22, "#6a4c30"); outline(g, 3, 7, 26, 22, "#42301e");
      rect(g, 3, 7, 26, 8, "#7d5c3c"); outline(g, 3, 7, 26, 8, "#42301e");  // flap
      rect(g, 9, 7, 4, 22, "#6a4a3a"); rect(g, 19, 7, 4, 22, "#6a4a3a");    // chitin straps
      g.fillStyle = "#c8a878";                                             // hide stitching
      for (let y = 10; y <= 27; y += 3) { g.fillRect(9, y, 1, 1); g.fillRect(12, y, 1, 1); g.fillRect(19, y, 1, 1); g.fillRect(22, y, 1, 1); }
      rect(g, 13, 17, 6, 4, "#8a6a4a"); outline(g, 13, 17, 6, 4, "#2e2018"); // chitin buckle
      rect(g, 15, 18, 2, 2, "#c8a878");
      rect(g, 5, 25, 22, 4, "#7a5a3a"); outline(g, 5, 25, 22, 4, "#42301e"); // bedroll
      return cv;
    }
    case "body_regulator": {
      const cells = tier === "0" ? 0 : tier === "1" ? 1 : 3; // coolant cells running
      rect(g, 4, 2, 3, 28, "#4c3822"); rect(g, 25, 2, 3, 28, "#4c3822");     // harness straps
      g.strokeStyle = "#3a4750"; g.lineWidth = 2;                            // hoses to the straps
      g.beginPath(); g.moveTo(10, 12); g.quadraticCurveTo(4, 10, 5, 3); g.stroke();
      g.beginPath(); g.moveTo(22, 12); g.quadraticCurveTo(28, 10, 27, 3); g.stroke();
      rect(g, 8, 8, 16, 17, "#8a98a8"); outline(g, 8, 8, 16, 17, "#3c4650"); // steel chest unit
      rect(g, 8, 8, 16, 3, "#aab4c0"); rect(g, 8, 22, 16, 3, "#6a7680");
      // frost vents: live rows stay cyan, spent rows go dull steel
      for (let r = 0; r < 3; r++) rect(g, 10, 13 + r * 3, 12, 2, r < cells ? "#2e6a78" : "#313d46");
      g.fillStyle = "#5fb8cc";
      for (const [vx, vy] of [[11, 13], [15, 16], [19, 19]] as const) if (vy <= 13 + (cells - 1) * 3 + 1) g.fillRect(vx, vy, 2, 2);
      if (cells) {
        g.fillStyle = "#d2f8ff";
        g.fillRect(9, 12, 1, 1); g.fillRect(22, 15, 1, 1);
        if (cells > 1) { g.fillRect(9, 21, 1, 1); g.fillRect(21, 12, 1, 1); }
      }
      return cv;
    }
    case "coolant_cell": {
      g.fillStyle = "#7fd4e8"; g.globalAlpha = 0.22;
      g.beginPath(); g.arc(8, 9, 7, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      rect(g, 6, 1, 4, 2, "#8a98a8"); rect(g, 7, 3, 2, 1, "#8a98a8");        // valve cap
      rect(g, 5, 4, 6, 10, "#3a8ea8"); outline(g, 5, 4, 6, 10, "#bfeef8");
      rect(g, 6, 5, 1, 8, "#7fd4e8");                                        // sheen
      rect(g, 5, 7, 6, 1, "#5fc0d8"); rect(g, 5, 11, 6, 1, "#2e6e84");       // frost bands
      g.fillStyle = "#e8fbff";
      g.fillRect(9, 6, 1, 1); g.fillRect(7, 9, 1, 1); g.fillRect(10, 12, 1, 1); g.fillRect(6, 13, 1, 1);
      return cv;
    }
    case "head_lantern": {
      if (tier !== "0") {
        g.fillStyle = "#ffd76a"; g.globalAlpha = tier === "1" ? 0.10 : 0.25;
        g.beginPath(); g.arc(8, 9, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      }
      rect(g, 1, 7, 14, 3, "#4a4a52");                                       // head strap
      rect(g, 1, 7, 14, 1, "#5f6670"); rect(g, 1, 9, 14, 1, "#33373d");
      rect(g, 7, 4, 2, 2, "#5a6875");                                        // bracket
      rect(g, 5, 6, 6, 8, "#2e3a45"); outline(g, 5, 6, 6, 8, "#8a98a8");     // housing
      rect(g, 6, 7, 4, 5, tier === "0" ? "#464e57" : tier === "1" ? "#b98a3a" : "#ffd76a"); // glass: dead / low / full
      if (tier === "2" || tier === "") rect(g, 7, 8, 2, 2, "#fff3c0");       // bright core only when full
      rect(g, 6, 11, 4, 1, "#e8a83c"); rect(g, 5, 13, 6, 1, "#232830");
      return cv;
    }
    case "reptile_armor": {                                     // scaled hauberk: overlapping plate rows
      rect(g, 6, 4, 20, 24, "#6f573c");                         // body of the harness
      outline(g, 6, 4, 20, 24, "#3f3222");
      rect(g, 2, 6, 5, 10, "#8a6f4d"); rect(g, 25, 6, 5, 10, "#8a6f4d"); // shoulder flaps
      for (let r = 0; r < 5; r++) {                             // scale rows, each over the last
        const y = 7 + r * 4;
        for (let cX = 7; cX <= 21; cX += 5) {
          poly(g, [[cX, y], [cX + 5, y], [cX + 5, y + 4], [cX + 2, y + 6], [cX, y + 4]], "#8a6f4d");
          poly(g, [[cX, y], [cX + 5, y], [cX + 5, y + 2], [cX, y + 2]], "#a08560");
          outline(g, cX, y, 5, 4, "#3f3222");
        }
      }
      rect(g, 13, 2, 6, 4, "#8a6f4d"); outline(g, 13, 2, 6, 4, "#3f3222"); // gorget collar
      g.fillStyle = "#d8cfc0"; g.fillRect(15, 12, 2, 2); g.fillRect(11, 18, 1, 1); g.fillRect(19, 20, 1, 1); // bone rivets
      return cv;
    }
    case "chitin":
      poly(g, [[8, 3], [13, 6], [14, 11], [11, 14], [5, 14], [2, 11], [3, 6]], "#6a4a3a");
      poly(g, [[8, 3], [13, 6], [8, 7], [3, 6]], "#8f6a50");
      line(g, 8, 7, 5, 13, "#4c352a", 1); line(g, 8, 7, 8, 14, "#4c352a", 1); line(g, 8, 7, 11, 13, "#4c352a", 1);
      rect(g, 4, 13, 8, 1, "#3c2a20");
      g.fillStyle = "#b08860"; g.fillRect(7, 4, 2, 1);
      return cv;
    case "stinger":
      g.strokeStyle = "#8a7a5c"; g.lineWidth = 5;                            // bone barb, outlined curve
      g.beginPath(); g.moveTo(3, 14); g.quadraticCurveTo(4, 6, 9, 3); g.stroke();
      g.strokeStyle = "#d8cbb0"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(3, 14); g.quadraticCurveTo(4, 6, 9, 3); g.stroke();
      g.strokeStyle = "#b0a284"; g.lineWidth = 1;                            // inner groove
      g.beginPath(); g.moveTo(5, 13); g.quadraticCurveTo(5.5, 7, 8, 4); g.stroke();
      poly(g, [[9, 0], [14, 1], [11, 6]], "#a84a3a");                        // venom tip
      poly(g, [[9, 0], [11, 0.5], [10, 3]], "#e0705a");
      line(g, 14, 1, 11, 6, "#6e2f24", 1);
      return cv;
    case "wurm_hide": {
      rect(g, 2, 2, 12, 15, "#7a5c40"); outline(g, 2, 2, 12, 15, "#4c3822"); // plating strip
      for (let y = 3; y < 14; y += 3) { rect(g, 3, y, 10, 2, "#8f6e4c"); rect(g, 3, y + 2, 10, 1, "#5a4228"); }
      rect(g, 2, 17, 12, 2, "#6a4c30");                                      // roll lip
      g.fillStyle = "#8a6a48"; g.beginPath(); g.arc(8, 24, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#4c3822"; g.lineWidth = 1; g.beginPath(); g.arc(8, 24, 6, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#5a4228"; g.beginPath(); g.arc(8, 24, 3, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#6a4c30"; g.fillRect(7, 23, 2, 2);
      return cv;
    }
    case "wurmsuit": {
      rect(g, 9, 8, 14, 18, "#7a5c40"); outline(g, 9, 8, 14, 18, "#42301e"); // hide-plate torso
      for (let y = 10; y <= 18; y += 4) { rect(g, 10, y, 12, 3, "#8a6a48"); rect(g, 10, y + 3, 12, 1, "#4c3822"); }
      rect(g, 11, 5, 10, 3, "#5f4830"); outline(g, 11, 5, 10, 3, "#42301e"); // collar
      poly(g, [[3, 9], [10, 6], [12, 13], [5, 15]], "#6a4a3a");              // chitin pauldrons
      poly(g, [[29, 9], [22, 6], [20, 13], [27, 15]], "#6a4a3a");
      poly(g, [[4, 9], [10, 6], [11, 9], [5, 11]], "#8f6a50");
      poly(g, [[28, 9], [22, 6], [21, 9], [27, 11]], "#8f6a50");
      line(g, 6, 8, 7, 14, "#4c352a", 1); line(g, 26, 8, 25, 14, "#4c352a", 1);
      g.fillStyle = "#c8a878";                                               // chitin stitching
      for (let y = 9; y <= 14; y += 3) { g.fillRect(4, y, 1, 1); g.fillRect(9, y, 1, 1); g.fillRect(22, y, 1, 1); g.fillRect(27, y, 1, 1); }
      rect(g, 9, 24, 14, 3, "#4c3822"); rect(g, 13, 24, 6, 3, "#6a4a3a");    // belt + chitin buckle
      outline(g, 13, 24, 6, 3, "#2e2018");
      g.fillStyle = "#c8a878"; g.fillRect(15, 25, 2, 1);
      return cv;
    }
    case "vulture_raw": {                                // raw dark-red fillet with a bone end
      poly(g, [[3, 9], [4, 5], [8, 3], [12, 4], [13, 8], [11, 12], [6, 12]], "#8a332c");
      poly(g, [[4, 5], [8, 3], [12, 4], [10, 7], [5, 7]], "#a8453a");      // lit top face
      poly(g, [[6, 12], [11, 12], [9, 13], [6, 13]], "#571f1b");           // shadow belly
      rect(g, 12, 6, 3, 3, "#d8cbb0");                                     // bone end
      rect(g, 14, 5, 1, 1, "#d8cbb0"); rect(g, 14, 9, 1, 1, "#d8cbb0");    // condyle knobs
      rect(g, 13, 6, 1, 3, "#8a7a5c"); rect(g, 12, 6, 2, 1, "#f0e6d0");
      g.fillStyle = "#c8705e";                                             // marbling
      g.fillRect(5, 7, 3, 1); g.fillRect(9, 6, 2, 1); g.fillRect(6, 10, 4, 1);
      g.fillStyle = "#e8a08a"; g.fillRect(6, 7, 1, 1); g.fillRect(8, 10, 1, 1);
      return cv;
    }
    case "vulture_cooked": {                             // roasted fillet: sear marks + steam
      g.fillStyle = "#c8d2da"; g.fillRect(5, 2, 1, 2); g.fillRect(8, 1, 1, 2); g.fillRect(11, 2, 1, 2);
      g.fillStyle = "#eef3f8"; g.fillRect(5, 1, 1, 1); g.fillRect(8, 0, 1, 1); g.fillRect(11, 1, 1, 1);
      poly(g, [[3, 10], [4, 6], [8, 4], [12, 5], [13, 9], [11, 13], [6, 13]], "#9a6132");
      poly(g, [[4, 6], [8, 4], [12, 5], [10, 8], [5, 8]], "#c08348");      // browned crust
      poly(g, [[6, 13], [11, 13], [9, 14], [6, 14]], "#5c3a1c");           // char belly
      line(g, 6, 6, 8, 12, "#4a2c14", 1); line(g, 9, 5, 11, 11, "#4a2c14", 1); // sear marks
      g.fillStyle = "#d8a05e"; g.fillRect(6, 5, 3, 1); g.fillRect(10, 6, 2, 1); // crisp lit bits
      g.fillStyle = "#f0c89a"; g.fillRect(7, 5, 1, 1);
      return cv;
    }
    case "rat_raw": {                                  // raw kangaroo rat: big ears, haunch, tufted tail
      line(g, 4, 12, 1, 13, "#8a5548", 1); line(g, 1, 13, 0, 11, "#8a5548", 1);
      g.fillStyle = "#c9a08c"; g.fillRect(0, 9, 2, 3);                    // tail tuft
      poly(g, [[4, 12], [5, 8], [8, 6], [12, 6], [15, 8], [15, 11], [12, 13], [6, 13]], "#a86a5a");
      poly(g, [[8, 6], [12, 6], [14, 8], [10, 8], [7, 9]], "#c08472");    // lit back
      poly(g, [[6, 13], [12, 13], [11, 14], [7, 14]], "#6e3f33");         // shadow belly
      g.fillStyle = "#a86a5a"; g.fillRect(11, 3, 2, 4); g.fillRect(14, 4, 2, 3); // big ears
      g.fillStyle = "#c9917e"; g.fillRect(12, 4, 1, 2); g.fillRect(14, 5, 1, 1); // inner ears
      g.fillStyle = "#2e1a14"; g.fillRect(13, 8, 1, 1);                   // closed eye
      g.fillStyle = "#c08472"; g.fillRect(15, 9, 1, 1);                   // muzzle
      g.fillStyle = "#8a5548"; g.fillRect(7, 12, 1, 2); g.fillRect(11, 12, 1, 2); // feet
      return cv;
    }
    case "rat_cooked": {                                // roasted rat: browned crust, steam
      g.fillStyle = "#c8d2da"; g.fillRect(7, 2, 1, 2); g.fillRect(10, 1, 1, 2);
      g.fillStyle = "#eef3f8"; g.fillRect(7, 1, 1, 1); g.fillRect(10, 0, 1, 1); // steam wisps
      line(g, 4, 12, 1, 13, "#5c3a1c", 1); line(g, 1, 13, 0, 11, "#5c3a1c", 1);
      g.fillStyle = "#c08a4a"; g.fillRect(0, 9, 2, 3);                    // crisp tail tuft
      poly(g, [[4, 12], [5, 8], [8, 6], [12, 6], [15, 8], [15, 11], [12, 13], [6, 13]], "#9a6132");
      poly(g, [[8, 6], [12, 6], [14, 8], [10, 8], [7, 9]], "#c08348");    // browned back
      poly(g, [[6, 13], [12, 13], [11, 14], [7, 14]], "#5c3a1c");         // char belly
      line(g, 8, 8, 9, 12, "#4a2c14", 1); line(g, 11, 7, 12, 11, "#4a2c14", 1); // sear marks
      g.fillStyle = "#9a6132"; g.fillRect(11, 3, 2, 4); g.fillRect(14, 4, 2, 3); // crisped ears
      g.fillStyle = "#4a2c14"; g.fillRect(13, 8, 1, 1);
      g.fillStyle = "#d8a05e"; g.fillRect(9, 6, 2, 1);                    // crisp lit bits
      return cv;
    }
    case "tortoise_shell": {                             // Thornback dome: scute plates, spiked rim
      poly(g, [[3, 22], [5, 12], [11, 6], [17, 4], [24, 7], [29, 14], [30, 22]], "#5f5a4e");
      poly(g, [[11, 6], [17, 4], [24, 7], [20, 13], [12, 12]], "#7d7768"); // lit crown
      poly(g, [[3, 22], [30, 22], [29, 25], [4, 25]], "#46423a");          // rim band
      g.strokeStyle = "#46423a"; g.lineWidth = 1;                          // scute seams
      g.beginPath(); g.moveTo(17, 5); g.lineTo(9, 22); g.moveTo(17, 5); g.lineTo(17, 23);
      g.moveTo(17, 5); g.lineTo(25, 22); g.stroke();
      g.beginPath(); g.moveTo(6, 15); g.lineTo(28, 15); g.stroke();
      g.fillStyle = "#6e6858"; g.fillRect(14, 8, 5, 1); g.fillRect(8, 17, 6, 1); g.fillRect(20, 18, 5, 1);
      g.fillStyle = "#8a8474"; g.fillRect(15, 6, 2, 1);                    // crown highlight
      g.fillStyle = "#cfc7b2";                                             // thorns along the rim
      for (const [x, y, w, dy] of [[3, 24, 4, 5], [9, 25, 4, 6], [15, 25, 4, 5], [21, 24, 4, 6], [26, 22, 4, 5]] as const)
        poly(g, [[x, y], [x + w, y], [x + w / 2, y + dy]], "#cfc7b2");
      poly(g, [[3, 16], [6, 16], [1, 19]], "#cfc7b2"); poly(g, [[26, 15], [29, 15], [31, 18]], "#cfc7b2");
      g.fillStyle = "#8f8874";
      for (const [x, y, w] of [[3, 24, 4], [9, 25, 4], [15, 25, 4], [21, 24, 4]] as const) g.fillRect(x, y, w, 1);
      return cv;
    }
    case "fennec_pelt": {                                // hung pelt: little head, huge ears, tail
      poly(g, [[6, 11], [2, 1], [9, 7]], "#c99a62");                       // huge ears
      poly(g, [[6, 10], [3, 3], [8, 7]], "#8f6a44");
      poly(g, [[10, 11], [14, 1], [7, 7]], "#c99a62");
      poly(g, [[10, 10], [13, 3], [8, 7]], "#8f6a44");
      g.fillStyle = "#ead4b0"; g.fillRect(2, 3, 1, 3); g.fillRect(13, 3, 1, 3);
      g.fillStyle = "#d8b488"; g.beginPath(); g.ellipse(8, 12, 5, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8a6540"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 12, 5, 4, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#ead4b0"; g.beginPath(); g.ellipse(8, 14, 2.5, 2, 0, 0, Math.PI * 2); g.fill(); // muzzle
      g.fillStyle = "#3a2a1c"; g.fillRect(6, 11, 1, 1); g.fillRect(9, 11, 1, 1);
      g.fillStyle = "#6a4a30"; g.fillRect(7, 14, 2, 1);
      rect(g, 4, 15, 8, 12, "#d8b488"); outline(g, 4, 15, 8, 12, "#8a6540"); // pelt body
      rect(g, 5, 16, 6, 9, "#e8d0a8");                                      // pale belly side
      rect(g, 2, 16, 2, 3, "#c99a62"); rect(g, 12, 16, 2, 3, "#c99a62");    // paw nubs
      rect(g, 2, 21, 2, 3, "#c99a62"); rect(g, 12, 21, 2, 3, "#c99a62");
      g.fillStyle = "#8f6a44";                                             // ragged hide edge
      for (let y = 17; y <= 25; y += 2) { g.fillRect(4, y, 1, 1); g.fillRect(11, y, 1, 1); }
      rect(g, 6, 27, 4, 3, "#c99a62"); rect(g, 6, 30, 4, 2, "#ead4b0");     // tail, pale tip
      outline(g, 6, 27, 4, 5, "#8a6540");
      return cv;
    }
    case "tortoise_cuirass": {                           // shell-plate breastplate, metal trim + rivets
      rect(g, 6, 6, 20, 23, "#3b372f"); outline(g, 6, 6, 20, 23, "#2a2722"); // chest form underlayer
      const plate = (x: number, y: number, w: number) => {                  // layered shell dome plates
        rect(g, x, y, w, 6, "#5f5a4e");
        rect(g, x, y, w, 2, "#7d7768");
        rect(g, x, y + 5, w, 1, "#3b372f");
        g.fillStyle = "#48443a";
        g.fillRect(x + Math.round(w / 3), y + 1, 1, 4); g.fillRect(x + Math.round(2 * w / 3), y + 1, 1, 4);
      };
      plate(8, 8, 16); plate(6, 14, 20); plate(7, 20, 18);
      rect(g, 10, 4, 12, 4, "#8a98a8"); rect(g, 10, 4, 12, 1, "#aab4c0");   // steel collar
      outline(g, 10, 4, 12, 4, "#3c4650");
      rect(g, 5, 13, 1, 14, "#8a98a8"); rect(g, 26, 13, 1, 14, "#8a98a8");  // side trim
      rect(g, 6, 26, 20, 4, "#8a98a8"); rect(g, 6, 26, 20, 1, "#aab4c0");   // steel belt
      rect(g, 6, 29, 20, 1, "#5c6670"); outline(g, 6, 26, 20, 4, "#3c4650");
      rect(g, 14, 26, 4, 4, "#c98a56"); rect(g, 14, 26, 4, 1, "#f0c89a");   // bronze buckle
      outline(g, 14, 26, 4, 4, "#5c3d22");
      g.fillStyle = "#cfc7b2";                                             // thornback spikes
      poly(g, [[3, 16], [6, 16], [1, 19]], "#cfc7b2"); poly(g, [[26, 16], [29, 16], [31, 19]], "#cfc7b2");
      poly(g, [[9, 29], [12, 29], [10, 31]], "#cfc7b2"); poly(g, [[19, 29], [22, 29], [21, 31]], "#cfc7b2");
      for (const [rx, ry] of [[7, 15], [23, 15], [7, 21], [23, 21], [9, 27], [21, 27], [11, 5], [18, 5]] as const) {
        rect(g, rx, ry, 2, 2, "#5c3d22"); rect(g, rx, ry, 2, 1, "#c98a56"); // two-tone rivets
        g.fillStyle = "#f0c89a"; g.fillRect(rx, ry, 1, 1);
      }
      return cv;
    }
    case "stinger_blade": {
      poly(g, [[8, 0], [10, 3], [6, 3]], "#a84a3a");                         // stinger barb tip
      poly(g, [[8, 0], [9, 2], [7, 2]], "#e0705a");
      poly(g, [[6, 3], [10, 3], [11, 6], [5, 6]], "#d8cbb0");                // bone barb collar
      line(g, 5, 6, 11, 6, "#8a7a5c", 1);
      rect(g, 6, 6, 4, 15, "#c9d2dc");                                       // steel blade
      rect(g, 7, 7, 1, 14, "#eef3f8"); rect(g, 9, 7, 1, 14, "#8a949e");
      rect(g, 3, 21, 10, 2, "#4a4a52"); rect(g, 3, 21, 10, 1, "#6a7280");    // crossguard
      rect(g, 6, 23, 4, 6, "#6b5238");                                       // wrapped grip
      rect(g, 6, 24, 4, 1, "#4a3926"); rect(g, 6, 27, 4, 1, "#4a3926");
      rect(g, 5, 29, 6, 2, "#6a4a3a"); outline(g, 5, 29, 6, 2, "#3c2a20");   // chitin pommel
      return cv;
    }
    case "curved_hull": {
      const st = "#7d8390", dk = "#4e545e", lit = "#aab2bc";
      rect(g, 6, 2, 8, 2, st); rect(g, 3, 4, 12, 2, st); rect(g, 2, 6, 13, 8, st); // stepped rounded corner
      g.clearRect(13, 13, 2, 1); g.clearRect(14, 12, 1, 1);                        // chamfered corner
      rect(g, 6, 2, 8, 1, lit); rect(g, 3, 4, 1, 2, lit); rect(g, 2, 6, 1, 8, lit); // sheen along curve
      rect(g, 2, 13, 11, 1, dk); rect(g, 14, 6, 1, 6, dk); rect(g, 12, 13, 1, 1, dk);
      rect(g, 3, 9, 12, 1, "#6b7280");                                            // panel seam
      g.fillStyle = dk; g.fillRect(11, 3, 1, 1); g.fillRect(12, 7, 1, 1); g.fillRect(5, 11, 1, 1);
      g.fillStyle = lit; g.fillRect(11, 4, 1, 1); g.fillRect(12, 8, 1, 1); g.fillRect(5, 12, 1, 1);
      return cv;
    }
    case "hull_slope": {
      poly(g, [[2, 14], [2, 4], [11, 2], [14, 8], [14, 14]], "#767d88");     // beveled plate
      poly(g, [[2, 4], [11, 2], [12, 6], [2, 8]], "#949ca8");                // lit slope band
      line(g, 11, 2, 14, 8, "#aab2bc", 1);                                   // bright bevel edge
      rect(g, 2, 13, 12, 1, "#4e545e"); rect(g, 2, 10, 12, 1, "#6b7280");    // shadow + seam
      g.fillStyle = "#5c636d"; g.fillRect(4, 6, 1, 1); g.fillRect(9, 11, 1, 1); g.fillRect(12, 9, 1, 1);
      return cv;
    }
    case "thruster_nozzle": {
      rect(g, 8, 2, 16, 5, "#8a98a8"); outline(g, 8, 2, 16, 5, "#3c4650");   // mounting flange
      rect(g, 8, 2, 16, 1, "#aab4c0");
      g.fillStyle = "#c8d2da"; g.fillRect(9, 4, 1, 1); g.fillRect(22, 4, 1, 1);
      line(g, 12, 3, 14, 5, "#5c6670", 1); line(g, 18, 5, 20, 3, "#5c6670", 1); // wrench scars
      poly(g, [[10, 7], [22, 7], [27, 21], [5, 21]], "#c88a50");             // copper cone
      poly(g, [[10, 7], [15, 7], [13, 21], [5, 21]], "#e0a86a");
      poly(g, [[20, 7], [22, 7], [27, 21], [23, 21]], "#96603a");
      line(g, 9, 12, 23, 12, "#7a4a26", 1); line(g, 7, 17, 25, 17, "#7a4a26", 1); // ring grooves
      rect(g, 5, 21, 22, 4, "#8a98a8"); outline(g, 5, 21, 22, 4, "#3c4650"); // steel collar ring
      rect(g, 5, 21, 22, 1, "#aab4c0");
      g.fillStyle = "#5c6670"; g.fillRect(8, 22, 1, 2); g.fillRect(16, 22, 1, 2); g.fillRect(23, 22, 1, 2);
      g.fillStyle = "#c8d2da"; g.fillRect(9, 23, 1, 1); g.fillRect(17, 23, 1, 1); g.fillRect(24, 23, 1, 1);
      rect(g, 7, 25, 18, 3, "#4a5560");                                      // nozzle mouth
      rect(g, 9, 26, 14, 1, "#c85a2e"); rect(g, 11, 27, 10, 1, "#8a3a1e");
      return cv;
    }
    case "backpack1":
      rect(g, 8, 1, 3, 6, "#5a4229"); rect(g, 21, 1, 3, 6, "#5a4229");
      rect(g, 5, 7, 22, 21, "#7a5a3a"); outline(g, 5, 7, 22, 21, "#4c3822");
      rect(g, 5, 7, 22, 8, "#8a6a48"); outline(g, 5, 7, 22, 8, "#4c3822");
      rect(g, 13, 13, 6, 3, "#d8b74f");
      rect(g, 9, 20, 14, 6, "#6b4d30"); outline(g, 9, 20, 14, 6, "#4c3822");
      return cv;
    case "beacon":
      g.fillStyle = "#66e5f0"; g.globalAlpha = 0.35;
      g.beginPath(); g.arc(8, 5, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.fillStyle = "#66e5f0"; g.beginPath(); g.arc(8, 5, 3, 0, Math.PI * 2); g.fill();
      rect(g, 6, 5, 1, 1, "#d2f8ff");
      rect(g, 7, 8, 2, 8, "#8a98a8");
      blit(g, 0, T, BEACON);
      return cv;
    case "campfire":
      line(g, 3, 10, 12, 4, "#61492f", 2); line(g, 4, 4, 13, 10, "#61492f", 2);
      line(g, 3, 10, 12, 4, "#7d5f3d", 1);
      blit(g, 0, T, CAMPFIRE);
      return cv;
    case "door":
      blit(g, 0, 0, DOOR_UPPER);
      blit(g, 0, T, DOOR_CLOSED);
      return cv;
    case "bed":
      blit(g, 0, 0, BED);
      blit(g, T, 0, BED_EXT);
      return cv;
    case "prickly_pear": { // cactus fruit: a magenta pear perched on a spined green pad
      g.fillStyle = "#3d8042"; g.beginPath(); g.ellipse(8, 11, 5.5, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#2b5c30"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(8, 11, 5.5, 5, 0, 0, Math.PI * 2); g.stroke();
      for (const [x, y] of [[4, 8], [12, 9], [8, 15], [5, 13], [11, 14]]) rect(g, x, y, 1, 1, "#dfe6c8");
      g.fillStyle = "#d64a82"; g.beginPath(); g.ellipse(8, 5.5, 4, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#a2366a"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(8, 5.5, 4, 4.5, 0, 0, Math.PI * 2); g.stroke();
      rect(g, 7, 1, 2, 1, "#6b5238");   // stub
      rect(g, 6, 4, 1, 1, "#f2a8c4");   // glint
      return cv;
    }
    case "dune_melon": // striped desert melon, 2x1
      g.fillStyle = "#5f7f2c"; g.beginPath(); g.ellipse(16, 11, 12, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#3c541c"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(16, 11, 12, 8, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#88a84c"; g.lineWidth = 1;
      for (const dx of [-7, 0, 7]) { g.beginPath(); g.moveTo(16 + dx, 3); g.lineTo(16 + dx, 19); g.stroke(); }
      rect(g, 15, 1, 2, 3, "#6b5238");
      return cv;
    case "wheat": { // golden stalks in a sheaf
      g.strokeStyle = "#c8a844"; g.lineWidth = 2;
      for (const dx of [4, 8, 12]) { g.beginPath(); g.moveTo(dx, 15); g.lineTo(dx, 3); g.stroke(); }
      g.fillStyle = "#e0c860";
      for (const dx of [4, 8, 12]) for (let y = 2; y < 9; y += 2) g.fillRect(dx - 2, y, 4, 2);
      g.strokeStyle = "#7a5a30"; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 12); g.lineTo(14, 12); g.stroke();
      return cv;
    }
    case "bread": // baked flatbread loaf
      g.fillStyle = "#a8712e"; g.beginPath(); g.ellipse(8, 10, 6.5, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#74501f"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 6.5, 4.5, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#d8a860"; g.fillRect(5, 8, 6, 1); g.fillRect(6, 7, 4, 1);
      return cv;
    case "apple": { // round red fruit, stem and leaf
      g.fillStyle = "#b42a26"; g.beginPath(); g.arc(8, 9.5, 5.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d8554a"; g.beginPath(); g.arc(6, 7.5, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#5a4028"; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 4); g.lineTo(8, 2); g.stroke();
      g.fillStyle = "#4a8a44"; g.beginPath(); g.ellipse(10, 3, 2, 1, 0.4, 0, Math.PI * 2); g.fill();
      return cv;
    }
    case "apple_pip": { // two pips and a sprout leaf
      g.fillStyle = "#7a5a34"; g.beginPath(); g.ellipse(6, 11, 2, 3, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(10, 12, 1.8, 2.6, 0.25, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#4a8a44"; g.lineWidth = 1; g.beginPath(); g.moveTo(9, 8); g.lineTo(9, 4); g.stroke();
      g.fillStyle = "#5fa052"; g.beginPath(); g.ellipse(11, 4, 2.5, 1.5, 0.5, 0, Math.PI * 2); g.fill();
      return cv;
    }
    case "sugar_cane": { // jointed green stalks
      for (const dx of [5, 9, 12]) {
        g.fillStyle = "#5c8f3a"; g.fillRect(dx - 1, 2, 2, 13);
        g.fillStyle = "#7ab050"; g.fillRect(dx - 1, 3, 2, 2); g.fillRect(dx - 1, 8, 2, 2);
      }
      g.strokeStyle = "#3f6a2c"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(6, 4); g.lineTo(10, 2); g.stroke();
      g.beginPath(); g.moveTo(10, 10); g.lineTo(13, 8); g.stroke();
      return cv;
    }
    case "sugar": { // pale heap with grain sparkle
      g.fillStyle = "#e8e2d0"; g.beginPath(); g.ellipse(8, 11, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(8, 8, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.fillRect(6, 7, 1, 1); g.fillRect(9, 9, 1, 1); g.fillRect(5, 11, 1, 1);
      return cv;
    }
    case "stew": { // pot with handle, ladle of stew
      g.fillStyle = "#3a3a42"; g.beginPath(); g.arc(8, 10, 6, Math.PI, 0); g.fill();
      g.fillStyle = "#a86a30"; g.beginPath(); g.ellipse(8, 10, 6, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c47a3a"; g.fillRect(5, 9, 2, 1); g.fillRect(9, 10, 2, 1);
      g.strokeStyle = "#8a8a94"; g.lineWidth = 1; g.beginPath(); g.moveTo(14, 4); g.lineTo(10, 8); g.stroke();
      g.fillStyle = "#8a8a94"; g.beginPath(); g.arc(9, 9, 1.5, 0, Math.PI * 2); g.fill();
      return cv;
    }
    case "fruit_salad": { // bowl of chopped fruit
      g.fillStyle = "#c8d2da"; g.beginPath(); g.arc(8, 10, 6, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(8, 10, 6, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c03434"; g.fillRect(4, 8, 2, 2); g.fillStyle = "#c8a844"; g.fillRect(7, 8, 2, 2);
      g.fillStyle = "#7ab050"; g.fillRect(10, 9, 2, 2); g.fillStyle = "#c47ab0"; g.fillRect(6, 10, 2, 1);
      return cv;
    }
    case "apple_pie": { // lattice-topped pie, one apple on the crust
      g.fillStyle = "#a8712e"; g.beginPath(); g.ellipse(8, 11, 7, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e0c888"; g.beginPath(); g.ellipse(8, 9.5, 6, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#c89a50"; g.lineWidth = 1;
      for (const dx of [-4, -1, 2, 5]) { g.beginPath(); g.moveTo(8 + dx - 2, 8); g.lineTo(8 + dx + 3, 11); g.stroke(); }
      g.fillStyle = "#b42a26"; g.beginPath(); g.arc(8, 6, 2, 0, Math.PI * 2); g.fill();
      return cv;
    }
    case "cooking_pot": { // iron pot over small flame
      g.fillStyle = "#2e2e36"; g.beginPath(); g.arc(8, 9, 5.5, Math.PI * 0.85, Math.PI * 0.15); g.fill();
      g.fillStyle = "#3c3c46"; g.beginPath(); g.ellipse(8, 6, 5.5, 1.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#60606c"; g.fillRect(3, 4, 10, 1); // lid rim
      g.strokeStyle = "#e08030"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, 15); g.quadraticCurveTo(8, 12.5, 8, 14.5); g.quadraticCurveTo(9, 12, 10, 15); g.stroke();
      return cv;
    }
    case "water_cage": { // steel cage with water sealed inside
      g.fillStyle = "#3a6ea0"; g.fillRect(4, 5, 8, 8);
      g.fillStyle = "#8fc0e0"; g.fillRect(4, 5, 8, 1);
      g.strokeStyle = "#98a2b0"; g.lineWidth = 1;
      g.strokeRect(3.5, 3.5, 9, 11);
      g.beginPath(); g.moveTo(7, 4); g.lineTo(7, 14); g.moveTo(10, 4); g.lineTo(10, 14); g.stroke();
      g.fillStyle = "#d0d6de"; g.fillRect(3, 3, 1, 1); g.fillRect(12, 3, 1, 1); g.fillRect(3, 14, 1, 1); g.fillRect(12, 14, 1, 1);
      return cv;
    }
    case "bucket": case "bucket_full": {
      const full = id === "bucket_full";
      rect(g, 4, 6, 8, 9, full ? "#2f7fd6" : color);
      outline(g, 4, 6, 8, 9, "#dfe6ee");
      rect(g, 3, 5, 10, 2, "#c8d2da");           // rim
      rect(g, 5, 2, 1, 3, "#8a98a8"); rect(g, 10, 2, 1, 3, "#8a98a8"); // bail ears
      line(g, 5, 3, 11, 3, "#8a98a8", 1);        // handle
      if (full) rect(g, 5, 7, 6, 1, "#5fa3ea");
      return cv;
    }
    case "oil_bucket": { // thick crude in the bucket: near-black, oily sheen
      rect(g, 4, 6, 8, 9, "#241d2b");
      outline(g, 4, 6, 8, 9, "#dfe6ee");
      rect(g, 3, 5, 10, 2, "#c8d2da");           // rim
      rect(g, 5, 2, 1, 3, "#8a98a8"); rect(g, 10, 2, 1, 3, "#8a98a8"); // bail ears
      line(g, 5, 3, 11, 3, "#8a98a8", 1);        // handle
      rect(g, 5, 7, 6, 1, "#4d3f5e");            // sheen on the crude
      return cv;
    }
    case "rocket_fuel": { // red canister, hazard band, flame mark
      const H = h * T;
      rect(g, 6, 0, 4, 3, "#8a98a8");
      rect(g, 7, 3, 2, 2, "#8a98a8");
      rect(g, 4, 5, 8, H - 7, "#8f3b2b");
      outline(g, 4, 5, 8, H - 7, "#ffd9a8");
      rect(g, 4, 12, 8, 3, "#d8612f");           // hazard band
      rect(g, 4, 15, 8, 1, "#3a2b26");
      rect(g, 5, 18, 1, 10, "#ff9a4f");          // sheen
      rect(g, 7, 22, 2, 2, "#ff9a4f");           // flame mark
      rect(g, 6, 24, 4, 5, "#ffcf5a");
      return cv;
    }
    case "wood_log": case "deadwood": {
      blit(g, 0, 0, id === "wood_log" ? WOOD : DEADWOOD);
      if (tier === "1") { // burned down halfway: charred end
        rect(g, 9, 2, 6, 12, "#2c2622");
        rect(g, 10, 5, 4, 2, "#48392c");
      } else if (tier === "0") { // a smoking stub of coals
        rect(g, 0, 0, 16, 16, "#2c2622");
        rect(g, 3, 8, 10, 5, "#241f1b");
        rect(g, 5, 9, 2, 2, "#d8612f"); rect(g, 9, 10, 2, 2, "#a34a22");
      }
      return cv;
    }
    case "kindling": // leafy twigs bundled
      line(g, 3, 21, 12, 4, "#6b5238", 2); line(g, 6, 22, 14, 8, "#5a4630", 2);
      rect(g, 11, 3, 3, 3, "#9a8a5a"); rect(g, 4, 8, 3, 3, "#9a8a5a"); rect(g, 13, 9, 3, 2, "#8a9a4a");
      return cv;
    case "seed_tree": // acorn seed with a green sprout
      rect(g, 7, 14, 6, 6, "#8a6a3a"); rect(g, 7, 13, 6, 2, "#5a4630");
      rect(g, 9, 9, 2, 4, "#5a8a3a"); rect(g, 6, 7, 3, 2, "#7fae54"); rect(g, 11, 8, 3, 2, "#7fae54");
      return cv;
    case "rock":
      boulder("#6a655f", "#877f77", "#4a4642");
      line(g, 5, 9, 11, 10, "#55504b", 1);
      g.fillStyle = "#98907f"; g.fillRect(7, 4, 2, 1);
      return cv;
    case "gravel": {
      const peb = (x: number, y: number, r: number, c: string) => {
        g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      };
      peb(5, 11, 3.2, "#7d766f"); peb(11, 12, 3.6, "#6a645e"); peb(8, 7, 3.6, "#8d8680");
      g.fillStyle = "#a49c94"; g.fillRect(6, 5, 2, 1); g.fillRect(3, 9, 2, 1);
      g.fillStyle = "#544e48"; g.fillRect(10, 14, 3, 1); g.fillRect(3, 13, 3, 1);
      return cv;
    }
    case "salt":
      poly(g, [[3, 12], [3, 7], [6, 3], [11, 2], [13, 6], [13, 12]], "#d9dbd6");
      poly(g, [[6, 3], [11, 2], [12, 5], [7, 6]], "#f2f4ef");
      poly(g, [[3, 12], [13, 12], [8, 14]], "#b4b8b2");
      line(g, 6, 7, 11, 8, "#c2c5bf", 1);
      g.fillStyle = "#ffffff"; g.fillRect(5, 6, 1, 1); g.fillRect(9, 8, 1, 1); g.fillRect(11, 5, 1, 1);
      return cv;
    case "deadwood":
      line(g, 2, 10, 13, 8, "#61492f", 4);                                   // log
      line(g, 2, 9, 13, 7, "#7d5f3d", 1);                                    // top sheen
      line(g, 4, 11, 11, 9, "#4a3926", 1);                                   // bark crack
      line(g, 7, 9, 9, 3, "#61492f", 2);                                     // snapped branch
      g.fillStyle = "#8a6a44"; g.beginPath(); g.arc(13.5, 8, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#5c4630"; g.lineWidth = 1; g.beginPath(); g.arc(13.5, 8, 2, 0, Math.PI * 2); g.stroke();
      return cv;
    case "lamp": {
      g.fillStyle = "#fff0a0"; g.globalAlpha = 0.28;
      g.beginPath(); g.arc(8, 8, 7, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      rect(g, 5, 2, 6, 2, "#4a4a52"); rect(g, 5, 2, 6, 1, "#6a7280");        // hood
      rect(g, 4, 4, 1, 9, "#3a3f46"); rect(g, 11, 4, 1, 9, "#3a3f46");       // frame posts
      rect(g, 5, 4, 6, 9, "#fff0a0"); rect(g, 6, 5, 2, 7, "#fff8d0");        // glass
      rect(g, 6, 10, 4, 2, "#e8a83c");                                       // flame pool
      rect(g, 4, 13, 8, 2, "#4a4a52");                                       // base
      return cv;
    }
    case "regulator": {
      rect(g, 5, 1, 6, 2, "#6a7680");                                        // vent stack
      rect(g, 3, 3, 10, 11, "#8a98a8"); outline(g, 3, 3, 10, 11, "#3c4650"); // steel housing
      rect(g, 3, 3, 10, 2, "#aab4c0");
      for (let x = 4; x <= 11; x += 2) rect(g, x, 6, 1, 6, "#5f6c78");       // cooling fins
      rect(g, 7, 7, 3, 4, "#59bfcc"); rect(g, 8, 8, 1, 1, "#d2f8ff");        // thermal gauge
      rect(g, 3, 12, 10, 2, "#3c4650");
      g.fillStyle = "#c8d2da"; g.fillRect(4, 4, 1, 1); g.fillRect(11, 4, 1, 1);
      return cv;
    }
    case "regulator_broken": {
      // the same steel housing, gutted: cracked face, dead gauge, scorch
      rect(g, 5, 1, 6, 2, "#525c66");                                        // vent stack, dented
      rect(g, 3, 3, 10, 11, "#6a7278"); outline(g, 3, 3, 10, 11, "#2e353c"); // dull steel housing
      rect(g, 3, 3, 10, 2, "#7d858b");
      for (let x = 4; x <= 11; x += 2) rect(g, x, 6, 1, 6, "#46505a");       // cooling fins
      rect(g, 7, 7, 3, 4, "#24282c"); rect(g, 7, 7, 3, 1, "#3a4046");        // dead gauge well
      line(g, 7, 7, 9, 10, "#9aa0a6", 1);                                    // cracked glass
      g.fillStyle = "#1c1e22"; g.fillRect(4, 9, 2, 2); g.fillRect(10, 5, 2, 1); g.fillRect(9, 12, 3, 1); // burn holes
      rect(g, 3, 12, 10, 2, "#2e353c");
      return cv;
    }
    case "storm_breaker_broken": {
      // dead pylon: dark rails, hollow sooty core
      rect(g, 4, 1, 8, 14, "#4c4640"); outline(g, 4, 1, 8, 14, "#26221e");   // casing
      rect(g, 4, 2, 8, 1, "#5e574f"); rect(g, 4, 12, 8, 1, "#5e574f");       // end bands
      for (let y = 4; y <= 11; y++) rect(g, 5, y, 1, 1, "#38332e");          // rail shadow
      rect(g, 7, 4, 3, 8, "#1e1b18");                                        // soot-filled core
      g.fillStyle = "#2c2723"; g.fillRect(6, 5, 1, 2); g.fillRect(10, 8, 1, 3); // flaking scorch
      return cv;
    }
    case "engine_core": {
      g.fillStyle = "#c468e8"; g.globalAlpha = 0.25;
      g.beginPath(); g.arc(8, 8, 7.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      rect(g, 4, 3, 8, 11, "#6a6e78"); outline(g, 4, 3, 8, 11, "#3a3e46");   // containment casing
      rect(g, 4, 3, 8, 1, "#8d929c"); rect(g, 4, 13, 8, 1, "#4a4e56");
      g.fillStyle = "#c468e8"; g.beginPath(); g.arc(8, 8, 3.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7a3a9a"; g.lineWidth = 1; g.beginPath(); g.arc(8, 8, 3.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#e8b8ff"; g.fillRect(6, 6, 2, 1); g.fillRect(7, 5, 1, 1);
      g.fillStyle = "#c8d2da"; g.fillRect(4, 4, 1, 1); g.fillRect(11, 4, 1, 1); g.fillRect(4, 12, 1, 1); g.fillRect(11, 12, 1, 1);
      return cv;
    }
    case "surveyor_pin": {                              // map pin: golden teardrop, cyan eye, dark outline
      g.fillStyle = "#0e1a1f";
      g.beginPath(); g.arc(8, 6, 5, 0, Math.PI * 2); g.fill();
      poly(g, [[8, 15], [4, 8], [12, 8]], "#0e1a1f");   // needle silhouette under the brass
      g.fillStyle = "#d8a845";
      g.beginPath(); g.arc(8, 6, 4, 0, Math.PI * 2); g.fill();
      poly(g, [[8, 14], [5, 8], [11, 8]], "#d8a845");
      poly(g, [[8, 14], [5, 8], [8, 8]], "#f2cf7c");    // lit left face
      poly(g, [[11, 8], [8, 14], [8, 8]], "#96682a");   // shaded right face
      g.fillStyle = "#66e5f0";
      g.beginPath(); g.arc(8, 6, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2f97a6"; g.fillRect(9, 7, 1, 1);  // eye shadow
      g.fillStyle = "#d2f8ff"; g.fillRect(6, 4, 1, 1); g.fillRect(7, 3, 2, 1); // glass highlight
      g.fillStyle = "#8a5f1e"; g.fillRect(7, 13, 2, 2); // point biting into the map
      return cv;
    }
    case "tracker": {                                   // brass compass puck: dark dial, cyan needle, tiny screen
      line(g, 12, 1, 11, 4, "#5c6670", 1);              // antenna stub behind the case
      g.fillStyle = "#66e5f0"; g.fillRect(12, 1, 1, 1);
      g.fillStyle = "#2a2018";
      g.beginPath(); g.arc(8, 8, 6.5, 0, Math.PI * 2); g.fill(); // dark rim so it reads on the cell
      g.fillStyle = "#c08a3c";
      g.beginPath(); g.arc(8, 8, 5.5, 0, Math.PI * 2); g.fill(); // brass case
      g.fillStyle = "#8a5f22";
      g.beginPath(); g.arc(8, 8, 5.5, -0.3, 2.0); g.fill();      // shaded lower rim
      g.fillStyle = "#12181d";
      g.beginPath(); g.arc(8, 8, 4, 0, Math.PI * 2); g.fill();   // dial face
      g.strokeStyle = "#5c6670"; g.lineWidth = 1;
      g.beginPath(); g.arc(8, 8, 4, 0, Math.PI * 2); g.stroke(); // glass ring
      g.fillStyle = "#5c6670";                                   // cardinal ticks
      g.fillRect(8, 5, 1, 1); g.fillRect(5, 8, 1, 1); g.fillRect(8, 11, 1, 1); g.fillRect(11, 8, 1, 1);
      rect(g, 6, 11, 3, 2, "#16222a");                           // status screen
      g.fillStyle = "#66e5f0"; g.fillRect(7, 12, 1, 1);          // screen dot
      poly(g, [[11, 5], [7, 7], [9, 9]], "#66e5f0");             // cyan needle half
      poly(g, [[5, 11], [9, 9], [7, 7]], "#8a949e");             // steel tail half
      g.fillStyle = "#d2f8ff"; g.fillRect(7, 7, 2, 2);           // pivot
      return cv;
    }
    case "seed_melon":
      g.fillStyle = "#c8b060"; g.beginPath(); g.ellipse(8, 10, 4, 4.8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8f7a40"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 4, 4.8, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#e0cc8c"; g.beginPath(); g.ellipse(7, 9, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill();
      rect(g, 7, 2, 2, 3, "#5a8a3a"); rect(g, 5, 1, 2, 2, "#7fae54"); rect(g, 9, 0, 2, 2, "#7fae54"); // sprout
      return cv;
    case "seed_wheat":
      g.fillStyle = "#d8c878"; g.beginPath(); g.ellipse(8, 10, 3.2, 4.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#9a8a48"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 3.2, 4.6, 0, 0, Math.PI * 2); g.stroke();
      line(g, 8, 6, 8, 14, "#b09a58", 1);                                    // kernel crease
      g.fillStyle = "#f0e2a8"; g.fillRect(6, 8, 1, 4);
      line(g, 8, 5, 7, 2, "#9a8a48", 1); line(g, 8, 5, 9, 2, "#9a8a48", 1);  // awns
      return cv;
    case "bench":
      blit(g, 0, 0, BENCH);
      blit(g, 0, T, BENCH_EXT);
      return cv;
    // ---- Silvaris (Phase 2) ----
    case "electric_bench": { // BENCH's powered heir: steel worktop, readout drawer, live volt
      rect(g, 1, 4, 14, 3, "#55606e"); rect(g, 1, 4, 14, 1, "#7d8896");      // worktop
      rect(g, 1, 7, 2, 8, "#3f4a58"); rect(g, 12, 7, 2, 8, "#3f4a58");       // legs
      rect(g, 3, 7, 8, 3, "#46505c"); rect(g, 4, 8, 3, 1, "#66e5f0");        // drawer + readout
      rect(g, 11, 5, 3, 3, "#6a7680"); outline(g, 11, 5, 3, 3, "#2e353c");   // side module
      poly(g, [[9, 1], [6, 8], [8, 8], [6, 13], [12, 5], [9, 5], [11, 1]], "#ffd76a"); // volt
      poly(g, [[9, 1], [7, 6], [9, 6]], "#fff3c0");
      return cv;
    }
    case "assembly_bench": { // precision table: gantry post and rail, live tool tip
      rect(g, 1, 9, 14, 2, "#5a5f6e"); rect(g, 1, 9, 14, 1, "#82879a");      // worktop
      rect(g, 2, 11, 2, 4, "#3f4450"); rect(g, 12, 11, 2, 4, "#3f4450");     // legs
      rect(g, 12, 2, 2, 8, "#6a707e"); rect(g, 5, 2, 8, 2, "#6a707e");       // gantry post + rail
      rect(g, 6, 4, 2, 3, "#8a92a2"); rect(g, 6, 7, 2, 2, "#66e5f0");        // head, live tip
      rect(g, 3, 8, 4, 1, "#9aa0ae"); outline(g, 3, 8, 4, 1, "#3f4450");     // part under the head
      return cv;
    }
    case "fuel_works": { // retort tank over a firebox: pipes in and out, blue flame
      rect(g, 4, 2, 8, 7, "#5f5560"); outline(g, 4, 2, 8, 7, "#332c38");     // retort tank
      rect(g, 5, 3, 6, 1, "#7d7280"); rect(g, 5, 4, 6, 2, "#3f7fe8");        // lit fuel sight
      rect(g, 1, 3, 3, 2, "#8a98a8"); rect(g, 12, 5, 3, 2, "#8a98a8");       // in/out pipes
      rect(g, 4, 10, 8, 5, "#46404a"); outline(g, 4, 10, 8, 5, "#2a2630");   // firebox
      rect(g, 6, 11, 4, 3, "#2a5aa8"); rect(g, 7, 12, 2, 2, "#6fa8f0");      // blue flame
      return cv;
    }
    case "foundry": { // brick furnace: stack, glowing mouth, pour lip
      rect(g, 5, 1, 2, 3, "#4a382c");                                        // stack
      rect(g, 2, 3, 12, 11, "#6a4f3c"); outline(g, 2, 3, 12, 11, "#3c2c20"); // brick body
      rect(g, 2, 3, 12, 1, "#8a6a50");
      line(g, 2, 6, 14, 6, "#4c382a", 1);                                    // brick course
      rect(g, 4, 7, 8, 5, "#1e1410");                                        // mouth
      rect(g, 5, 8, 6, 3, "#c8552b"); rect(g, 6, 9, 4, 1, "#ffcf5a");        // melt glow
      return cv;
    }
    case "inscription": { // carved Dweller stele: rounded stone, glyph rows
      poly(g, [[4, 15], [4, 5], [6, 2], [10, 2], [12, 5], [12, 15]], "#cfc8b2");
      poly(g, [[6, 2], [10, 2], [11, 4], [5, 4]], "#e8e1cb");                // lit top
      poly(g, [[4, 15], [12, 15], [12, 13], [4, 13]], "#a89f88");            // base band
      g.fillStyle = "#6e6653";
      g.fillRect(6, 6, 4, 1); g.fillRect(6, 8, 5, 1); g.fillRect(6, 10, 3, 1); g.fillRect(6, 12, 5, 1); // glyphs
      g.fillStyle = "#f2ecda"; g.fillRect(6, 2, 2, 1);
      return cv;
    }
    case "dock_pad": { // inlaid deck tile: steel plate, bright ring marker, corner rivets
      rect(g, 1, 1, 14, 14, "#666d78"); outline(g, 1, 1, 14, 14, "#3f454e");
      rect(g, 1, 1, 14, 1, "#8a909c");
      rect(g, 4, 4, 8, 8, "#79808c"); outline(g, 4, 4, 8, 8, "#a8aeb8");     // inset panel
      rect(g, 6, 6, 4, 4, "#59606c"); outline(g, 6, 6, 4, 4, "#c8ccd4");     // pad eye
      g.fillStyle = "#3f454e";
      g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1); g.fillRect(2, 13, 1, 1); g.fillRect(13, 13, 1, 1);
      return cv;
    }
    case "titanium_ore":
      boulder("#78808c", "#a2aab4", "#545a64");
      specks("#b9c0ca", "#e2e8ee", [[5, 6], [9, 4], [10, 9], [6, 10]]);      // bright metal flecks
      return cv;
    case "graphite_ore":
      boulder("#56524e", "#6e6a66", "#3e3b38");
      specks("#26262a", "#6a6c74", [[5, 6], [9, 4], [10, 9], [6, 10]]);      // dark flakes, slate sheen
      return cv;
    case "titaniumrod":
      rect(g, 6, 1, 3, 14, "#7c848e");
      rect(g, 7, 2, 1, 12, "#d4dae2");
      g.fillStyle = "#59616b";
      for (const [rx, ry] of [[6, 3], [8, 7], [6, 11], [8, 13]] as const) g.fillRect(rx, ry, 1, 1);
      rect(g, 5, 1, 5, 1, "#59616b"); rect(g, 5, 14, 5, 1, "#59616b");
      return cv;
    case "steel_plating": { // heavier plate: weld seams, corner bolts, dull sheen
      rect(g, 1, 2, 14, 12, "#76808e"); outline(g, 1, 2, 14, 12, "#454c56");
      rect(g, 1, 2, 14, 1, "#98a2b0"); rect(g, 2, 3, 4, 1, "#8a94a2");
      line(g, 8, 3, 8, 13, "#454c56", 1); line(g, 2, 8, 14, 8, "#454c56", 1); // weld seams
      g.fillStyle = "#3f4650";
      g.fillRect(3, 4, 1, 1); g.fillRect(12, 4, 1, 1); g.fillRect(3, 11, 1, 1); g.fillRect(12, 11, 1, 1);
      g.fillStyle = "#aeb8c6";
      g.fillRect(2, 4, 1, 1); g.fillRect(11, 4, 1, 1); g.fillRect(2, 11, 1, 1); g.fillRect(11, 11, 1, 1);
      return cv;
    }
    case "super_fuel": { // blue canister, cryo band, cold star — Rocket Fuel's elder sibling
      const H = h * T;
      rect(g, 6, 0, 4, 3, "#8a98a8");
      rect(g, 7, 3, 2, 2, "#8a98a8");
      rect(g, 4, 5, 8, H - 7, "#2a5aa8");
      outline(g, 4, 5, 8, H - 7, "#cfe4ff");
      rect(g, 4, 12, 8, 3, "#3f7fe8");           // hazard band
      rect(g, 4, 15, 8, 1, "#1e3a66");
      rect(g, 5, 18, 1, 10, "#6fa8f0");          // sheen
      rect(g, 8, 21, 1, 5, "#8fd0ff"); rect(g, 6, 23, 5, 1, "#8fd0ff"); // cold star
      g.fillStyle = "#cfeaff"; g.fillRect(6, 20, 1, 1); g.fillRect(10, 25, 1, 1); // sparkles
      return cv;
    }
    case "tundroot": { // pale tuber with a leafy crown
      g.fillStyle = "#b39a5e"; g.beginPath(); g.ellipse(8, 10.5, 5, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7d6a3c"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10.5, 5, 4.5, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#cdb47a"; g.fillRect(5, 8, 3, 1); g.fillRect(7, 11, 3, 1);   // eye dimples
      g.fillStyle = "#9a8450"; g.fillRect(9, 8, 1, 1); g.fillRect(5, 12, 1, 1);
      line(g, 8, 6, 8, 3, "#4a7a3c", 2);                                          // stalk
      g.fillStyle = "#5f9a48"; g.fillRect(4, 2, 4, 2); g.fillRect(8, 1, 4, 2);    // leaves
      return cv;
    }
    case "seed_tundroot":
      g.fillStyle = "#c9b57a"; g.beginPath(); g.ellipse(8, 10, 3.6, 4.8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8f7d4c"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 3.6, 4.8, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#e6d5a2"; g.beginPath(); g.ellipse(7, 9, 1.6, 2.4, 0, 0, Math.PI * 2); g.fill();
      rect(g, 7, 2, 2, 3, "#5a8a3a"); rect(g, 5, 1, 2, 2, "#7fae54"); rect(g, 9, 0, 2, 2, "#7fae54"); // sprout
      return cv;
    case "ember_berry": { // three scorch-red berries on a twig
      line(g, 4, 4, 12, 3, "#6b5238", 1); rect(g, 7, 3, 2, 2, "#6b5238");   // twig and stub
      g.fillStyle = "#c2451f";
      g.beginPath(); g.arc(5.5, 9.5, 3.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(10.5, 9.5, 3.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(8, 12.5, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e87a4a";
      g.beginPath(); g.arc(4.5, 8.5, 1.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9.5, 8.5, 1.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f8c79a"; g.fillRect(7, 11, 1, 1);
      return cv;
    }
    case "seed_emberbush":
      g.fillStyle = "#b86a48"; g.beginPath(); g.ellipse(8, 10, 3.4, 4.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7d4228"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 3.4, 4.6, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#e09a72"; g.beginPath(); g.ellipse(7, 9, 1.5, 2.3, 0, 0, Math.PI * 2); g.fill();
      rect(g, 7, 2, 2, 3, "#7a4a2e"); rect(g, 5, 1, 2, 2, "#a86a3a"); rect(g, 9, 0, 2, 2, "#c8683a"); // red sprout
      return cv;
    case "frost_pelt": { // hung pelt: pale guard fur, ice-blue shade, plume tail
      poly(g, [[6, 9], [3, 3], [8, 7]], "#cddbe6"); poly(g, [[6, 8], [4, 4], [7, 7]], "#8fa6b8");   // ears
      poly(g, [[10, 9], [13, 3], [8, 7]], "#cddbe6"); poly(g, [[10, 8], [12, 4], [9, 7]], "#8fa6b8");
      g.fillStyle = "#dfe9f0"; g.beginPath(); g.ellipse(8, 11.5, 4.6, 3.6, 0, 0, Math.PI * 2); g.fill();  // head
      g.strokeStyle = "#8fa6b8"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 11.5, 4.6, 3.6, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#2e3a44"; g.fillRect(6, 11, 1, 1); g.fillRect(9, 11, 1, 1); // closed eyes
      rect(g, 4, 14, 8, 12, "#c2d2de"); outline(g, 4, 14, 8, 12, "#8fa6b8");     // pelt body
      rect(g, 5, 15, 6, 10, "#e2ecf2");                                          // pale belly side
      g.fillStyle = "#9fb4c4";                                                   // ragged hide edge
      for (let y = 16; y <= 24; y += 2) { g.fillRect(4, y, 1, 1); g.fillRect(11, y, 1, 1); }
      rect(g, 6, 26, 4, 4, "#c2d2de"); rect(g, 6, 29, 4, 2, "#eef4f8");          // tail, white tip
      outline(g, 6, 26, 4, 5, "#8fa6b8");
      return cv;
    }
    case "tideback_hide": { // huge coastal hide stretched to dry: grey-green pelt, back ridge, corner pegs
      rect(g, 4, 3, 24, 26, "#6e8a72"); outline(g, 4, 3, 24, 26, "#3c5042");
      rect(g, 4, 3, 24, 6, "#7f9c82"); outline(g, 4, 3, 24, 6, "#3c5042");      // neck spread
      g.strokeStyle = "#4a5f4e"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(16, 9); g.lineTo(16, 28); g.stroke();             // back ridge
      g.strokeStyle = "#5c7460"; g.lineWidth = 1;
      for (let y = 12; y <= 26; y += 4) { g.beginPath(); g.moveTo(7, y); g.lineTo(13, y); g.stroke(); g.beginPath(); g.moveTo(19, y); g.lineTo(25, y); g.stroke(); }
      g.fillStyle = "#8fa886"; g.fillRect(7, 5, 4, 2); g.fillRect(21, 5, 4, 2); // pale flanks
      g.fillStyle = "#3c5042";                                                  // corner pegs
      for (const [x, y] of [[2, 1], [27, 1], [2, 27], [27, 27]] as const) g.fillRect(x, y, 3, 3);
      return cv;
    }
    case "brushbuck_meat": { // raw haunch on the bone
      poly(g, [[3, 10], [4, 6], [9, 3], [13, 5], [14, 10], [11, 13], [5, 13]], "#a06552");
      poly(g, [[4, 6], [9, 3], [13, 5], [10, 8], [5, 8]], "#c08372");           // lit top face
      poly(g, [[5, 13], [11, 13], [9, 14], [5, 14]], "#6e3f33");                // shadow belly
      rect(g, 13, 4, 3, 3, "#d8cbb0"); rect(g, 15, 3, 1, 1, "#d8cbb0"); rect(g, 15, 7, 1, 1, "#d8cbb0"); // bone end
      g.fillStyle = "#c8705e";                                                  // marbling
      g.fillRect(6, 7, 3, 1); g.fillRect(10, 6, 2, 1); g.fillRect(6, 10, 4, 1);
      g.fillStyle = "#e8a08a"; g.fillRect(6, 7, 1, 1); g.fillRect(9, 10, 1, 1);
      return cv;
    }
    case "cooked_brushbuck_meat": { // roasted haunch: browned crust, sear marks, steam
      g.fillStyle = "#c8d2da"; g.fillRect(5, 2, 1, 2); g.fillRect(8, 1, 1, 2); g.fillRect(11, 2, 1, 2);
      g.fillStyle = "#eef3f8"; g.fillRect(5, 1, 1, 1); g.fillRect(8, 0, 1, 1); g.fillRect(11, 1, 1, 1); // steam wisps
      poly(g, [[3, 10], [4, 6], [9, 3], [13, 5], [14, 10], [11, 13], [5, 13]], "#9a6132");
      poly(g, [[4, 6], [9, 3], [13, 5], [10, 8], [5, 8]], "#c08348");           // browned crust
      poly(g, [[5, 13], [11, 13], [9, 14], [5, 14]], "#5c3a1c");                // char belly
      line(g, 6, 6, 8, 12, "#4a2c14", 1); line(g, 9, 5, 11, 11, "#4a2c14", 1);  // sear marks
      rect(g, 13, 4, 3, 3, "#e0d6bc");                                          // crisped bone
      g.fillStyle = "#d8a05e"; g.fillRect(6, 5, 3, 1); g.fillRect(10, 6, 2, 1);
      return cv;
    }

    // ---- Phase 2: materials, harvests, gear ----
    case "scrap": {                                                            // grind of jagged shards
      poly(g, [[2, 6], [6, 3], [8, 7], [5, 10]], "#9aa0a8");
      poly(g, [[7, 9], [12, 5], [14, 9], [10, 13]], "#7d838c");
      poly(g, [[3, 11], [7, 12], [6, 15], [2, 14]], "#6a7078");
      line(g, 6, 3, 8, 7, "#c6ccd4", 1); line(g, 12, 5, 14, 9, "#aab0b8", 1);
      return cv;
    }
    case "machine_part": {                                                     // torn chassis plate with a stub strut
      poly(g, [[3, 4], [12, 3], [13, 9], [9, 9], [9, 13], [4, 12]], "#6f7684");
      poly(g, [[3, 4], [12, 3], [12, 5], [5, 6]], "#8b93a2");
      rect(g, 10, 9, 4, 2, "#4a505c");
      g.fillStyle = "#c86a3a"; g.fillRect(11, 4, 2, 2);                         // rust burn
      g.fillStyle = "#5f9fd0"; g.fillRect(5, 8, 2, 1);                          // dead circuit trace
      return cv;
    }
    case "machine_heart": {                                                    // caged light, palms wide
      poly(g, [[8, 4], [24, 4], [28, 16], [24, 28], [8, 28], [4, 16]], "#565d6a");
      poly(g, [[8, 4], [24, 4], [26, 12], [6, 12]], "#767e8c");                 // lit cage top
      for (let i = 0; i < 5; i++) line(g, 8 + i * 4, 6, 6 + i * 4, 26, "#3c424c", 2); // cage bars
      g.fillStyle = "#8fd0e8"; g.fillRect(12, 12, 8, 8);
      g.fillStyle = "#c8f0fa"; g.fillRect(14, 14, 4, 4);                        // core glow
      g.fillStyle = "#e8f8ff"; g.fillRect(15, 13, 1, 1); g.fillRect(13, 15, 1, 1);
      poly(g, [[8, 4], [24, 4], [24, 6], [8, 6]], "#a9b2c0");
      g.fillStyle = "#3c424c"; g.fillRect(10, 28, 4, 3); g.fillRect(18, 28, 4, 3); // mounting feet
      return cv;
    }
    case "slug": case "lead_slug": {                                           // cast bullet, nose up
      const dull = id === "slug" ? "#a8aeb8" : "#848a96";
      poly(g, [[6, 2], [10, 2], [11, 5], [11, 12], [5, 12], [5, 5]], dull);
      poly(g, [[6, 2], [10, 2], [10, 4], [6, 4]], "#d0d6de");                   // nose glint
      rect(g, 5, 10, 6, 2, "#5c616c");                                          // can band
      g.fillStyle = "#eef2f6"; g.fillRect(7, 3, 1, 3);
      return cv;
    }
    case "charcoal": {                                                         // cinder lump, cracked black
      poly(g, [[3, 9], [5, 4], [10, 3], [13, 7], [12, 12], [6, 13]], "#2c2a28");
      poly(g, [[5, 4], [10, 3], [11, 6], [6, 7]], "#4a4642");                   // struck face
      line(g, 6, 6, 10, 11, "#151412", 1); line(g, 9, 4, 7, 12, "#151412", 1);  // fracture grain
      g.fillStyle = "#6e6862"; g.fillRect(8, 5, 1, 1); g.fillRect(5, 10, 1, 1);  // silvery cleavage
      return cv;
    }
    case "sil_oil": {                                                        // corked jug of black oil, glossy
      g.fillStyle = "#6b5a3a"; g.fillRect(13, 2, 6, 3);                       // cork
      poly(g, [[9, 5], [23, 5], [26, 11], [24, 27], [8, 27], [6, 11]], "#2a2622"); // jug
      poly(g, [[11, 8], [21, 8], [23, 12], [21, 24], [11, 24], [9, 12]], "#141210"); // oil fill
      g.fillStyle = "#3c4a52"; g.fillRect(12, 10, 5, 2); g.fillRect(16, 15, 4, 2);   // cold gloss
      g.fillStyle = "#4a4238"; g.fillRect(9, 26, 14, 2);                      // base band
      return cv;
    }
    case "leadrod": {                                                            // dull grey rod, copperrod's kin
      line(g, 4, 12, 12, 4, "#9aa0ac", 3);
      line(g, 4, 12, 12, 4, "#c4cad4", 1);
      line(g, 5, 13, 13, 5, "#5f646e", 1);
      g.fillStyle = "#5f646e"; g.fillRect(3, 12, 2, 2); g.fillRect(12, 3, 2, 2);
      return cv;
    }
    case "saltpetre": {                                                        // pale crystal cluster
      poly(g, [[5, 13], [6, 6], [8, 5], [9, 13]], "#d8d4c2");
      poly(g, [[9, 13], [10, 7], [12, 6], [13, 13]], "#c2bca8");
      poly(g, [[7, 8], [8, 2], [10, 4], [9, 9]], "#ece8da");
      g.fillStyle = "#ffffff"; g.fillRect(8, 3, 1, 2); g.fillRect(6, 7, 1, 1);
      return cv;
    }
    case "flux": {                                                               // fired glassy slab, green-grey
      poly(g, [[3, 10], [6, 5], [12, 4], [13, 9], [8, 13]], "#b9c4a8");
      poly(g, [[6, 5], [12, 4], [12, 6], [7, 8]], "#d4dec4");
      line(g, 5, 8, 11, 11, "#7e8a70", 1);
      g.fillStyle = "#eef2e4"; g.fillRect(9, 5, 2, 1);
      return cv;
    }
    case "titan_plating": {                                                    // bright rolled sheet
      poly(g, [[2, 4], [14, 3], [14, 11], [2, 12]], "#aeb6c2");
      poly(g, [[2, 4], [14, 3], [14, 5], [2, 6]], "#ccd4de");
      poly(g, [[12, 4], [14, 3], [15, 6], [13, 7]], "#8a929e");                 // curled corner
      line(g, 2, 9, 14, 8, "#7e8690", 1);
      g.fillStyle = "#e8eef4"; g.fillRect(4, 4, 3, 1); g.fillRect(9, 4, 2, 1);
      return cv;
    }
    case "basalt_knife": case "bone_knife": case "titanium_knife": case "carbide_knife": { // skinner blade in its tier material
      poly(g, [[4, 13], [3, 9], [7, 3], [9, 3], [8, 9], [7, 13]], color);
      poly(g, [[4, 13], [3, 9], [7, 3], [8, 4], [5, 9], [6, 13]], "#f2f4f0");   // honed edge
      rect(g, 7, 12, 3, 4, "#5c4630"); outline(g, 7, 12, 3, 4, "#2e2418");      // leather grip
      g.fillStyle = "#8a6f4d"; g.fillRect(7, 13, 3, 1); g.fillRect(7, 15, 3, 1);
      return cv;
    }
    case "bone_harpoon": case "titanium_harpoon": case "carbide_harpoon": {     // long shaft, barbed head
      rect(g, 8, 12, 2, 19, "#6b5238");                                         // shaft
      g.fillStyle = "#4a3a28"; g.fillRect(8, 14, 2, 1); g.fillRect(8, 24, 2, 1);
      poly(g, [[9, 1], [12, 8], [10, 12], [6, 12], [4, 8]], color);             // head
      poly(g, [[4, 8], [6, 12], [3, 11], [2, 8]], "#c4cad2");                   // barb
      poly(g, [[6, 12], [10, 12], [9, 15], [7, 15]], "#c4cad2");                // socket
      g.fillStyle = "#eef2f6"; g.fillRect(8, 3, 1, 4);                          // edge glint
      return cv;
    }
    case "frost_oat": {                                                          // three grain stalks
      for (const bx of [4, 8, 12]) {
        line(g, bx, 14, bx - 1, 5, "#b8b078", 1);
        for (let y = 3; y <= 8; y += 2) { g.fillStyle = "#d8cf9a"; g.fillRect(bx - 2, y, 2, 2); g.fillRect(bx, y + 1, 2, 2); }
      }
      g.fillStyle = "#8a8458"; g.fillRect(3, 14, 11, 1);
      return cv;
    }
    case "oat_flour": {                                                          // pouch of pale flour
      poly(g, [[4, 14], [4, 8], [7, 6], [11, 6], [14, 8], [14, 14]], "#c8bfa0");
      poly(g, [[6, 6], [7, 3], [11, 3], [12, 6]], "#a89f80");                   // gathered neck
      g.fillStyle = "#ece4c8"; g.fillRect(6, 8, 6, 4);                          // dusting
      g.fillStyle = "#f6f0dc"; g.fillRect(7, 9, 2, 2);
      return cv;
    }
    case "seed_silvertimber": {                                                  // silver seed with wings
      poly(g, [[8, 14], [6, 8], [8, 5], [10, 8]], "#b8b8c0");
      poly(g, [[8, 5], [5, 2], [7, 6]], "#d8dae2"); poly(g, [[8, 5], [11, 2], [9, 6]], "#d8dae2");
      g.fillStyle = "#f0f2f6"; g.fillRect(7, 7, 1, 3);
      return cv;
    }
    case "tideback_meat": {                                                    // wide grey-green flank steak
      poly(g, [[2, 10], [3, 5], [10, 3], [29, 4], [30, 10], [22, 13], [5, 13]], "#7c8a70");
      poly(g, [[3, 5], [10, 3], [29, 4], [28, 7], [6, 8]], "#98a68c");          // lit top
      for (let x = 6; x <= 26; x += 4) line(g, x, 5, x - 2, 12, "#5c6a54", 1);  // muscle grain
      g.fillStyle = "#c2cbb4"; g.fillRect(12, 6, 4, 1); g.fillRect(20, 5, 3, 1); // silver skin
      return cv;
    }
    case "smoked_tideback": {                                                  // dark smoked slab over a rack
      for (let x = 4; x <= 28; x += 3) g.fillStyle = "#c8d2da", g.fillRect(x, 1, 1, 2); // smoke wisps
      poly(g, [[2, 10], [3, 5], [10, 3], [29, 4], [30, 10], [22, 13], [5, 13]], "#5c4a38");
      poly(g, [[3, 5], [10, 3], [29, 4], [28, 7], [6, 8]], "#7e6248");          // crust
      for (let x = 8; x <= 26; x += 6) line(g, x, 5, x - 2, 12, "#332418", 1);
      g.fillStyle = "#d8c8a8"; g.fillRect(28, 3, 2, 2);                         // rack peg
      return cv;
    }
    case "oatbread": {                                                           // scored golden loaf
      poly(g, [[3, 11], [4, 5], [10, 3], [22, 3], [28, 5], [29, 11], [24, 13], [7, 13]], "#c2a878");
      poly(g, [[4, 5], [10, 3], [22, 3], [28, 5], [24, 6], [8, 6]], "#dcc294"); // crust crown
      for (const sx of [10, 15, 20] as const) line(g, sx, 4, sx - 3, 8, "#8a7048", 1);                // scores
      g.fillStyle = "#f0dcae"; g.fillRect(11, 5, 3, 1); g.fillRect(17, 5, 3, 1);
      poly(g, [[7, 13], [24, 13], [22, 14], [9, 14]], "#7c6240");               // sole shadow
      return cv;
    }
    case "ember_pie": {                                                        // crimped crust, hot filling
      poly(g, [[2, 11], [4, 5], [28, 5], [30, 11], [26, 13], [5, 13]], "#d8b078");
      poly(g, [[6, 6], [26, 6], [24, 9], [8, 9]], "#b04828");                   // filling window
      g.fillStyle = "#e87a3a"; g.fillRect(10, 7, 4, 2); g.fillRect(18, 7, 5, 2); // ember glow
      g.fillStyle = "#f0c890"; for (let x = 3; x <= 28; x += 4) g.fillRect(x, 4, 2, 2); // crimp nubs
      for (const [sx] of [[12], [17], [22]] as const) line(g, sx, 5, sx - 1, 9, "#d8b078", 1); // vents
      return cv;
    }
    case "oat_porridge": {                                                     // canister pot, oatmeal swell
      rect(g, 5, 6, 6, 24, "#7e7668"); outline(g, 5, 6, 6, 24, "#4a4438");
      rect(g, 6, 7, 4, 9, "#d8cfa4");                                           // porridge fill
      g.fillStyle = "#efe8c4"; g.fillRect(6, 7, 4, 2);                          // steam-lit top
      for (let y = 2; y <= 4; y++) g.fillStyle = "#c8d2da", g.fillRect(6 + (y % 2) * 2, y, 1, 2); // steam
      rect(g, 4, 5, 8, 2, "#9a927e");                                           // rim
      g.fillStyle = "#5a5244"; g.fillRect(6, 17, 4, 1);                         // spoon slot line
      return cv;
    }
    case "smoked_brushbuck": {                                                   // hung jerky strip
      g.fillStyle = "#3f3222"; g.fillRect(7, 1, 2, 2);                          // hook
      poly(g, [[6, 3], [10, 3], [11, 8], [9, 14], [6, 14], [5, 8]], "#7e5232");
      poly(g, [[6, 3], [10, 3], [10, 5], [6, 5]], "#a06a44");                   // lit shoulder
      line(g, 7, 6, 8, 13, "#553620", 1);                                       // grain split
      g.fillStyle = "#c8946a"; g.fillRect(7, 7, 1, 3);
      return cv;
    }
    case "brushbuck_pelt": {                                                   // hung hide, four legs splayed
      poly(g, [[8, 2], [11, 2], [13, 12], [15, 26], [12, 30], [7, 30], [4, 26], [6, 12]], "#a8845e");
      poly(g, [[8, 2], [11, 2], [12, 8], [7, 8]], "#c4a276");                   // head end lit
      poly(g, [[4, 14], [2, 18], [5, 17]], "#8c6c48"); poly(g, [[15, 14], [17, 18], [14, 17]], "#8c6c48"); // leg flaps
      poly(g, [[7, 30], [12, 30], [11, 31], [8, 31]], "#6e5236");               // tail
      g.fillStyle = "#d8c4a0"; g.fillRect(8, 10, 4, 3);                         // scraped pale patch
      return cv;
    }
    case "hardhide": {                                                           // stiff folded pelt
      poly(g, [[2, 11], [5, 4], [13, 5], [14, 12], [9, 14]], "#8c6f52");
      poly(g, [[5, 4], [13, 5], [12, 7], [6, 7]], "#a8885e");                   // top fold lit
      line(g, 4, 9, 12, 10, "#5c4630", 1);                                      // crease
      g.fillStyle = "#c0a884"; g.fillRect(7, 5, 3, 1); g.fillStyle = "#3f3222"; g.fillRect(2, 11, 2, 1);
      return cv;
    }
    case "buckguard": {                                                        // hardhide work harness
      rect(g, 8, 6, 16, 20, "#8c6f52"); outline(g, 8, 6, 16, 20, "#5c4630");
      rect(g, 3, 8, 6, 8, "#a8885e"); rect(g, 23, 8, 6, 8, "#a8885e");          // shoulder wings
      for (const [px, py] of [[10, 9], [20, 9], [10, 22], [20, 22], [15, 15]] as const) g.fillStyle = "#6e5236", g.fillRect(px, py, 2, 2); // rivet studs
      rect(g, 12, 4, 8, 3, "#6e5236");                                          // neck strap
      for (let y = 11; y <= 20; y += 3) line(g, 9, y, 23, y, "#6e5236", 1);     // stitched panels
      g.fillStyle = "#c4a276"; g.fillRect(10, 12, 4, 2);                        // worn shine
      return cv;
    }
    case "snowcloak": {                                                        // pelt cloak, white fringe
      poly(g, [[6, 4], [26, 4], [28, 24], [24, 28], [8, 28], [4, 24]], "#9aa2ac");
      poly(g, [[6, 4], [26, 4], [26, 8], [6, 8]], "#c2c8d0");                   // shoulder fur lit
      for (let x = 5; x <= 26; x += 3) { g.fillStyle = "#7e8690"; g.fillRect(x, 10 + (x % 2), 1, 4); } // pelt seams
      for (let x = 6; x <= 26; x += 2) g.fillStyle = "#eef2f6", g.fillRect(x, 26, 1, 4);              // frost fringe
      g.fillStyle = "#e8eef4"; g.fillRect(8, 5, 6, 2); g.fillRect(18, 6, 5, 1); // snow caps on the shoulders
      rect(g, 13, 2, 6, 3, "#6e7680");                                          // clasp yoke
      return cv;
    }
    case "pear_cordial": {                                                     // sealed bottle, pale pear wine
      rect(g, 6, 1, 4, 3, "#8a6f4d"); outline(g, 6, 1, 4, 3, "#5c4630");        // waxed cork
      rect(g, 7, 4, 2, 4, "#b8c8c0");                                           // neck glass
      poly(g, [[5, 8], [11, 8], [13, 14], [13, 27], [3, 27], [3, 14]], "#c2d4b8");
      poly(g, [[4, 14], [12, 14], [12, 25], [4, 25]], "#a8c494");               // cordial level
      g.fillStyle = "#e8f0dc"; g.fillRect(5, 10, 2, 10);                        // glass highlight
      poly(g, [[10, 2], [13, 4], [10, 6]], "#a8c494");                          // pear stamp on the wax
      return cv;
    }
    case "cargo_sled": {                                                       // 3x3 sled-chest on hover pads
      rect(g, 4, 8, 24, 14, "#6e6656"); outline(g, 4, 8, 24, 14, "#3f3a2e");
      for (let x = 6; x <= 26; x += 5) g.fillStyle = "#8a8270", g.fillRect(x, 9, 3, 2); // crate ribs
      rect(g, 12, 12, 8, 6, "#4a4438"); outline(g, 12, 12, 8, 6, "#2e2a20");    // feed hatch
      g.fillStyle = "#c8b878"; g.fillRect(14, 14, 4, 2);                        // latched handle
      for (const cx of [7, 16, 25]) {                                          // three hover rings
        g.strokeStyle = "#66c8e0"; g.lineWidth = 1;
        g.beginPath(); g.ellipse(cx, 25, 4, 2, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#9ae0f0"; g.fillRect(cx - 1, 24, 2, 2);
      }
      return cv;
    }
    case "sled_blade": {                                                         // long plow blade on a mount
      poly(g, [[2, 8], [26, 4], [30, 8], [26, 12], [4, 12]], "#8a929c");
      poly(g, [[2, 8], [26, 4], [26, 6], [4, 9]], "#b8c0ca");                   // edge bevel
      rect(g, 10, 10, 10, 4, "#5c5648"); outline(g, 10, 10, 10, 4, "#332f26");  // yoke mount
      g.fillStyle = "#c8d0d8"; g.fillRect(6, 6, 4, 1); g.fillRect(18, 5, 3, 1); // snow-sheen
      return cv;
    }
    case "sled_drill": {                                                         // auger head in a gimbal
      for (let y = 4; y <= 13; y++) { g.fillStyle = y % 3 ? "#c0a86a" : "#9a8a5a"; g.fillRect(14 + Math.round(Math.sin(y * 0.9) * 4), y, 3, 1); } // flight spiral
      poly(g, [[14, 3], [20, 3], [19, 2], [15, 2]], "#d8c890");                 // crown
      rect(g, 4, 2, 8, 5, "#5c616c"); outline(g, 4, 2, 8, 5, "#3a3e46");        // gearbox
      rect(g, 2, 7, 24, 4, "#4a505c");                                          // gimbal bar
      g.fillStyle = "#8fd0e8"; g.fillRect(6, 3, 3, 1);                          // drive glow
      return cv;
    }
    case "mob_snake": {                                                        // hooded coil on the sand
      poly(g, [[10, 27], [22, 27], [20, 21], [12, 21]], "#776038");            // coiled base
      poly(g, [[12, 21], [20, 21], [19, 12], [14, 12]], "#8a7040");            // raised neck
      poly(g, [[13, 12], [19, 12], [17, 7], [15, 7]], "#9a7e48");              // hood
      g.fillStyle = "#241a10"; g.fillRect(15, 9, 1, 1); g.fillRect(17, 9, 1, 1); // eyes
      g.fillStyle = "#c8b088"; g.fillRect(12, 23, 8, 1);                       // belly band
      return cv;
    }
    case "mob_rat": {                                                          // big-eared hopper, long tail
      g.fillStyle = "#8a6f4a"; g.fillRect(11, 16, 9, 7);                       // body
      poly(g, [[19, 16], [24, 12], [23, 17], [20, 19]], "#9a7e58");            // haunch
      g.fillStyle = "#9a7e58"; g.fillRect(10, 12, 5, 5);                       // head
      g.fillStyle = "#c8a888"; g.fillRect(9, 8, 3, 5); g.fillRect(14, 8, 3, 5); // ears up
      g.fillStyle = "#241a10"; g.fillRect(11, 14, 1, 1);                       // eye
      g.fillStyle = "#b08868"; poly(g, [[11, 23], [13, 23], [13, 25], [11, 25]], "#b08868"); // feet
      for (let i = 0; i < 6; i++) g.fillRect(20 + i, 22 - i, 2, 1);            // tail
      return cv;
    }
    case "mob_scorpion": {                                                     // armoured plates, curled tail
      poly(g, [[9, 20], [23, 20], [21, 14], [11, 14]], "#8a5a30");             // carapace
      g.fillStyle = "#a06a38"; g.fillRect(11, 15, 10, 2);                      // plate line
      g.fillStyle = "#6a4424"; g.fillRect(6, 17, 4, 3); g.fillRect(22, 17, 4, 3); // pincer arms
      g.fillStyle = "#6a4424"; g.fillRect(4, 15, 3, 3); g.fillRect(25, 15, 3, 3); // pincers
      poly(g, [[22, 14], [26, 9], [24, 5], [21, 6], [23, 10], [20, 13]], "#7a4e28"); // tail arc
      g.fillStyle = "#c8552b"; g.fillRect(23, 4, 2, 2);                        // stinger
      return cv;
    }
    case "mob_wurm": {                                                         // segmented dune tube, maw ring
      for (let y = 8; y <= 24; y += 4) { poly(g, [[9, y], [23, y], [22, y + 3], [10, y + 3]], y % 8 ? "#8a6a44" : "#7a5c3a"); }
      g.fillStyle = "#3a2c1c"; g.fillRect(11, 8, 10, 3);                       // maw
      for (let x = 12; x <= 19; x += 2) g.fillStyle = "#d8c8a8", g.fillRect(x, 9, 1, 2); // teeth
      g.fillStyle = "#c8a878"; g.fillRect(10, 19, 12, 1);                      // segment shine
      return cv;
    }
    case "mob_trader": {                                                       // hooded roadfolk, trade staff
      poly(g, [[11, 26], [21, 26], [20, 10], [12, 10]], "#7a5c42");            // robe
      g.fillStyle = "#5c4630"; g.fillRect(12, 16, 8, 2);                       // sash
      poly(g, [[12, 10], [20, 10], [18, 4], [14, 4]], "#8a6f52");              // hood
      g.fillStyle = "#2a2018"; g.fillRect(14, 7, 4, 2);                        // shade under the hood
      g.fillStyle = "#b9c0ca"; g.fillRect(23, 6, 2, 20);                       // staff
      poly(g, [[22, 4], [26, 4], [24, 7]], "#c8a878");                         // wrap on the staff
      return cv;
    }
    case "mob_vulture": {                                                      // hooked beak, spread wing
      poly(g, [[6, 16], [26, 12], [24, 20], [8, 22]], "#3c3836");              // swept wing
      g.fillStyle = "#2c2826"; g.fillRect(14, 18, 6, 6);                       // body
      g.fillStyle = "#c8c0b8"; g.fillRect(15, 12, 4, 5);                       // grey head
      poly(g, [[19, 13], [24, 14], [19, 16]], "#c8552b");                      // hooked beak
      g.fillStyle = "#151412"; g.fillRect(16, 13, 1, 1);                       // eye
      return cv;
    }
    case "mob_tortoise": {                                                     // spiked dome, slow legs
      poly(g, [[6, 22], [9, 12], [23, 12], [26, 22]], "#5c6150");              // dome
      for (let x = 8; x <= 22; x += 5) poly(g, [[x, 12], [x + 2, 12], [x + 1, 9]], "#8a8f78"); // spikes
      g.fillStyle = "#46503c"; g.fillRect(8, 18, 16, 2);                       // rim band
      g.fillStyle = "#7a7f62"; g.fillRect(25, 17, 4, 4);                       // head
      g.fillStyle = "#46503c"; g.fillRect(8, 23, 4, 3); g.fillRect(20, 23, 4, 3); // feet
      return cv;
    }
    case "mob_fennec": {                                                       // outsized ears, small fox
      g.fillStyle = "#b98e5c"; g.fillRect(11, 17, 10, 6);                      // body
      g.fillStyle = "#c8a878"; g.fillRect(20, 15, 5, 5);                       // head
      poly(g, [[20, 15], [21, 5], [23, 14]], "#c8a878"); poly(g, [[23, 14], [26, 6], [25, 15]], "#d8bc94"); // huge ears
      g.fillStyle = "#241a10"; g.fillRect(23, 17, 1, 1);                       // eye
      poly(g, [[9, 20], [6, 23], [11, 23]], "#b98e5c");                        // brush tail
      return cv;
    }
    case "mob_stalker": {                                                      // white coat, black eyes
      poly(g, [[7, 23], [10, 14], [22, 14], [25, 23]], "#d8dee6");             // body
      g.fillStyle = "#c4ccd6"; g.fillRect(21, 9, 6, 6);                        // head low
      g.fillStyle = "#151412"; g.fillRect(24, 11, 2, 2);                       // black eyes
      g.fillStyle = "#c4ccd6"; g.fillRect(8, 24, 3, 4); g.fillRect(14, 24, 3, 4); g.fillRect(20, 24, 3, 4); // legs
      poly(g, [[7, 16], [3, 13], [7, 19]], "#e8ecf2");                         // tail flag
      return cv;
    }
    case "mob_tideback": {                                                     // plated shallows wall
      poly(g, [[4, 23], [7, 12], [24, 10], [28, 22]], "#4c6660");              // body
      for (let x = 7; x <= 23; x += 5) g.fillStyle = "#3a524c", g.fillRect(x, 13, 4, 6); // plates
      g.fillStyle = "#6a8a80"; g.fillRect(7, 11, 18, 1);                       // ridge
      g.fillStyle = "#3a524c"; g.fillRect(25, 14, 4, 4);                       // head low
      g.fillStyle = "#c8552b"; g.fillRect(27, 15, 1, 1);                       // eye
      return cv;
    }
    case "mob_brushbuck": {                                                    // antlered herd buck
      g.fillStyle = "#7a5c3a"; g.fillRect(10, 15, 11, 6);                      // body
      g.fillStyle = "#8a6f4a"; g.fillRect(20, 11, 5, 5);                       // head
      g.fillStyle = "#d8c890"; g.fillRect(21, 10, 1, 1); g.fillRect(24, 10, 1, 1); // antler nubs
      poly(g, [[21, 11], [19, 4], [22, 8]], "#c8a878"); poly(g, [[24, 11], [27, 4], [24, 8]], "#c8a878"); // antlers
      g.fillStyle = "#6a4e30"; g.fillRect(11, 21, 2, 5); g.fillRect(18, 21, 2, 5); // legs
      return cv;
    }
    case "mob_warden": {                                                       // pedestal eye
      g.fillStyle = "#4a505c"; g.fillRect(12, 18, 8, 8);                       // pedestal
      poly(g, [[11, 18], [21, 18], [19, 10], [13, 10]], "#5c6470");            // eye housing
      g.fillStyle = "#35e0ff"; g.fillRect(14, 12, 4, 4);                       // teal eye
      g.fillStyle = "#20262e"; g.fillRect(15, 13, 2, 2);                       // pupil
      g.fillStyle = "#3a4048"; g.fillRect(9, 16, 14, 2);                       // shoulder bar
      return cv;
    }
    case "mob_sentry": {                                                       // bipedal red visor
      g.fillStyle = "#4a505c"; g.fillRect(13, 8, 7, 10);                       // torso
      g.fillStyle = "#c8552b"; g.fillRect(14, 9, 5, 2);                        // visor slit
      g.fillStyle = "#3a4048"; g.fillRect(12, 18, 3, 8); g.fillRect(18, 18, 3, 8); // legs
      g.fillStyle = "#5c6470"; g.fillRect(9, 10, 3, 6); g.fillRect(21, 10, 3, 6); // arm pods
      g.fillStyle = "#8fd0e8"; g.fillRect(22, 12, 1, 2);                       // claw glow
      return cv;
    }
    case "mob_breaker": {                                                      // squat siege machine
      poly(g, [[6, 24], [6, 12], [22, 9], [26, 20], [24, 24]], "#54484e");     // mass
      g.fillStyle = "#c8552b"; g.fillRect(8, 14, 4, 2); g.fillRect(15, 12, 5, 2); // hot seams
      g.fillStyle = "#8a8f98"; poly(g, [[26, 14], [30, 12], [30, 16]], "#8a8f98"); // ram nose
      g.fillStyle = "#332c30"; g.fillRect(8, 24, 14, 4);                       // treads
      g.fillStyle = "#c05050"; g.fillRect(11, 17, 3, 3);                       // core cage
      return cv;
    }
    case "mob_hauler": {                                                       // loaded cargo carrier
      g.fillStyle = "#4a505c"; g.fillRect(7, 14, 16, 6);                       // chassis
      g.fillStyle = "#8a8f98"; g.fillRect(9, 8, 6, 6); g.fillRect(16, 10, 6, 4); // cargo crates
      g.fillStyle = "#c8a878"; g.fillRect(10, 9, 4, 1); g.fillRect(17, 11, 4, 1); // lash straps
      g.fillStyle = "#332c30"; g.fillRect(6, 20, 18, 4);                       // treads
      g.fillStyle = "#35e0ff"; g.fillRect(23, 15, 2, 2);                       // running lamp
      return cv;
    }
    case "mob_sentinel": {                                                     // monolith of the Hall
      poly(g, [[11, 28], [11, 6], [21, 4], [21, 28]], "#3c3238");              // monolith body
      g.fillStyle = "#c05050"; g.fillRect(13, 9, 6, 4);                        // the red eye
      g.fillStyle = "#8fd0e8"; g.fillRect(14, 10, 4, 1);                       // shield glint
      g.fillStyle = "#54484e"; g.fillRect(8, 14, 3, 8); g.fillRect(21, 14, 3, 8); // arm struts
      g.fillStyle = "#c8552b"; g.fillRect(12, 20, 8, 1);                       // conduit seam
      return cv;
    }
  }
  return null;
}

const tilesCache = new Map<string, string[]>();

/** One dataURL per Inventory Grid cell of the item, row-major, unrotated.
 *  `charges` selects the fuel-variant art for lamp/Regulator items. */
export function itemTiles(itemId: string, charges?: number): string[] {
  const tier = fuelTier(itemId, charges);
  const key = tier ? itemId + "|" + tier : itemId;
  const hit = tilesCache.get(key);
  if (hit) return hit;
  const def = ITEMS[itemId];
  if (!def) return tilesCache.set(key, []), tilesCache.get(key)!;
  const art = drawArt(itemId, def.w, def.h, def.color, tier);
  let cv: HTMLCanvasElement | null = art;
  if (!cv && def.block !== undefined) {
    const [c, g] = mk(def.w * T, def.h * T);
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) blit(g, x * T, y * T, def.block);
    cv = c;
  }
  const out: string[] = [];
  if (cv) {
    const [cell, cg] = mk(T, T);
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        cg.clearRect(0, 0, T, T);
        cg.drawImage(cv, x * T, y * T, T, T, 0, 0, T, T);
        out.push(cell.toDataURL());
      }
  } else {
    // color fallback for unknown items
    const [c, g] = mk(T, T); rect(g, 2, 2, T - 4, T - 4, def.color); out.push(c.toDataURL());
  }
  tilesCache.set(key, out);
  return out;
}

/** Full-footprint art as one dataURL (catalogs, tooltips, drag ghosts). */
export function itemArtUrl(itemId: string, rot = 0, charges?: number): string {
  const def = ITEMS[itemId];
  if (!def) return "";
  if (def.w === 1 && def.h === 1) return itemTiles(itemId, charges)[0] ?? "";
  const [cv, g] = mk(def.w * T, def.h * T);
  g.imageSmoothingEnabled = false;
  const art = drawArt(itemId, def.w, def.h, def.color, fuelTier(itemId, charges));
  if (art) g.drawImage(art, 0, 0);
  else if (def.block !== undefined)
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) blit(g, x * T, y * T, def.block);
  if (!rot) return cv.toDataURL();
  const [rc, rg] = mk(def.h * T, def.w * T);
  rg.imageSmoothingEnabled = false;
  rg.translate(def.h * T, 0);
  rg.rotate(Math.PI / 2);
  rg.drawImage(cv, 0, 0);
  return rc.toDataURL();
}

/** 16px atlas tile of a world block as a dataURL (catalog block preview). */
export function blockTileUrl(blockId: number): string {
  const [c, g] = mk(T, T); blit(g, 0, 0, blockId); return c.toDataURL();
}

const mobArtCache: Record<string, string> = {};
/** 16px portrait of a creature as a dataURL (Codex card). */
export function mobArtUrl(kind: string): string {
  if (!mobArtCache[kind]) {
    const [cv, g] = mk(T, T);
    g.imageSmoothingEnabled = false;
    const art = drawArt("mob_" + kind, 1, 1, "#888888");
    if (art) g.drawImage(art, 0, 0);
    mobArtCache[kind] = cv.toDataURL();
  }
  return mobArtCache[kind];
}
