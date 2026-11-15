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

// hand-drawn art, drawn at (def.w*16) x (def.h*16); cell 0 = top-left
function drawArt(id: string, w: number, h: number, color: string): HTMLCanvasElement | null {
  const [cv, g] = mk(w * T, h * T);
  const tool = id.includes("_") && (id.endsWith("pickaxe") || id.endsWith("shovel") || id.endsWith("axe") || id.endsWith("disassembler"));
  if (tool) {
    const type = id.replace(/^(wood|stone|metal)_/, "");
    rect(g, 7, 16, 2, 14, "#6b5238");           // handle
    rect(g, 6, 14, 4, 3, "#4a4a52");            // binding
    if (type === "pickaxe") {
      line(g, 3, 12, 13, 12, color, 2); line(g, 3, 12, 3, 15, color); line(g, 13, 12, 13, 15, color);
      line(g, 4, 9, 12, 9, "#00000022", 1);
    } else if (type === "shovel") {
      rect(g, 5, 6, 6, 7, color); outline(g, 5, 6, 6, 7, "#00000044");
      line(g, 6, 13, 6, 13, color); line(g, 9, 13, 9, 13, color);
      line(g, 6, 13, 7, 14, color, 1); line(g, 9, 13, 8, 14, color, 1);
    } else if (type === "axe") {
      rect(g, 9, 7, 5, 6, color); outline(g, 9, 7, 5, 6, "#00000044");
      rect(g, 8, 8, 1, 4, color);
    } else { // disassembler: energy wrench
      rect(g, 4, 7, 8, 2, color); rect(g, 4, 7, 2, 5, color); rect(g, 10, 7, 2, 5, color);
      rect(g, 7, 11, 2, 2, "#66e5f0"); rect(g, 6, 12, 4, 1, "#2f97a6");
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
    case "sword": // forged blade: steel edge, crossguard, wrapped grip
      rect(g, 8, 0, 1, 1, "#eef3f8"); rect(g, 7, 1, 3, 17, "#c9d2dc");
      rect(g, 8, 1, 1, 17, "#eef3f8");
      rect(g, 4, 18, 8, 2, "#4a4a52");
      rect(g, 7, 20, 3, 9, "#6b5238"); rect(g, 7, 22, 3, 1, "#4a3926"); rect(g, 7, 25, 3, 1, "#4a3926");
      rect(g, 6, 29, 5, 2, "#4a4a52");
      return cv;
    case "ironrod":
      rect(g, 6, 1, 3, 14, "#8a4f2e");
      rect(g, 7, 2, 1, 12, "#d08a52");
      g.fillStyle = "#5c3319";
      for (const [rx, ry] of [[6, 3], [8, 7], [6, 11], [8, 13]] as const) g.fillRect(rx, ry, 1, 1);
      rect(g, 5, 1, 5, 1, "#5c3319"); rect(g, 5, 14, 5, 1, "#5c3319");
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
