// Item icons: every inventory cell shows the item's own pixel art. Block-backed
// items sample the world texture atlas; hand-drawn items (canisters, tools,
// backpacks, rods, visors) are painted per footprint, then sliced into 16px
// cells matching the item's Inventory Grid shape (row-major, unrotated).
import { DOOR_UPPER, DOOR_CLOSED, BENCH, BENCH_EXT, BEACON, CAMPFIRE, BED, BED_EXT } from "./blocks";
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
function drawArt(id: string, w: number, h: number, color: string): HTMLCanvasElement | null {
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
      rect(g, 4, 2, 3, 28, "#4c3822"); rect(g, 25, 2, 3, 28, "#4c3822");     // harness straps
      g.strokeStyle = "#3a4750"; g.lineWidth = 2;                            // hoses to the straps
      g.beginPath(); g.moveTo(10, 12); g.quadraticCurveTo(4, 10, 5, 3); g.stroke();
      g.beginPath(); g.moveTo(22, 12); g.quadraticCurveTo(28, 10, 27, 3); g.stroke();
      rect(g, 8, 8, 16, 17, "#8a98a8"); outline(g, 8, 8, 16, 17, "#3c4650"); // steel chest unit
      rect(g, 8, 8, 16, 3, "#aab4c0"); rect(g, 8, 22, 16, 3, "#6a7680");
      rect(g, 10, 13, 12, 2, "#2e6a78"); rect(g, 10, 16, 12, 2, "#2e6a78"); rect(g, 10, 19, 12, 2, "#2e6a78"); // frost vents
      g.fillStyle = "#5fb8cc"; g.fillRect(11, 13, 2, 2); g.fillRect(15, 16, 2, 2); g.fillRect(19, 19, 2, 2);
      g.fillStyle = "#d2f8ff"; g.fillRect(9, 12, 1, 1); g.fillRect(22, 15, 1, 1); g.fillRect(9, 21, 1, 1); g.fillRect(21, 12, 1, 1);
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
      g.fillStyle = "#ffd76a"; g.globalAlpha = 0.25;
      g.beginPath(); g.arc(8, 9, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      rect(g, 1, 7, 14, 3, "#4a4a52");                                       // head strap
      rect(g, 1, 7, 14, 1, "#5f6670"); rect(g, 1, 9, 14, 1, "#33373d");
      rect(g, 7, 4, 2, 2, "#5a6875");                                        // bracket
      rect(g, 5, 6, 6, 8, "#2e3a45"); outline(g, 5, 6, 6, 8, "#8a98a8");     // housing
      rect(g, 6, 7, 4, 5, "#ffd76a"); rect(g, 7, 8, 2, 2, "#fff3c0");        // warm glass
      rect(g, 6, 11, 4, 1, "#e8a83c"); rect(g, 5, 13, 6, 1, "#232830");
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
    case "cooked_wheat": // baked flatbread loaf
      g.fillStyle = "#a8712e"; g.beginPath(); g.ellipse(8, 10, 6.5, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#74501f"; g.lineWidth = 1; g.beginPath(); g.ellipse(8, 10, 6.5, 4.5, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#d8a860"; g.fillRect(5, 8, 6, 1); g.fillRect(6, 7, 4, 1);
      return cv;
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
    case "metal":
      line(g, 3, 13, 12, 3, "#9aa0aa", 3);                                   // salvaged steel rod
      line(g, 3, 12, 12, 2, "#c8d2da", 1);
      line(g, 4, 14, 12, 5, "#6a707a", 1);
      g.fillStyle = "#6a707a"; g.fillRect(9, 7, 1, 2);                       // nick
      g.fillStyle = "#e2e8f0"; g.fillRect(6, 9, 1, 1);
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
  }
  return null;
}

const tilesCache = new Map<string, string[]>();

/** One dataURL per Inventory Grid cell of the item, row-major, unrotated. */
export function itemTiles(itemId: string): string[] {
  const hit = tilesCache.get(itemId);
  if (hit) return hit;
  const def = ITEMS[itemId];
  if (!def) return tilesCache.set(itemId, []), tilesCache.get(itemId)!;
  const art = drawArt(itemId, def.w, def.h, def.color);
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
  tilesCache.set(itemId, out);
  return out;
}

/** Full-footprint art as one dataURL (catalogs, tooltips, drag ghosts). */
export function itemArtUrl(itemId: string, rot = 0): string {
  const def = ITEMS[itemId];
  if (!def) return "";
  if (def.w === 1 && def.h === 1) return itemTiles(itemId)[0] ?? "";
  const [cv, g] = mk(def.w * T, def.h * T);
  g.imageSmoothingEnabled = false;
  const art = drawArt(itemId, def.w, def.h, def.color);
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
