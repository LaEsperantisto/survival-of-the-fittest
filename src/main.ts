import { Game } from "./game";
import { DAY_SECONDS, BLOCKS } from "./blocks";
import { Audio } from "./audio";
import { ITEMS } from "./items";
import { RECIPES, SMELT } from "./crafting";
import { itemArtUrl, blockTileUrl } from "./icons";
import {
  WorldMeta, RunSave, Settings, listWorlds, createWorld, loadRun, deleteWorld,
  getSettings, setSettings, bestScore, exportRun, importRun,
} from "./save";
import * as hud from "./hud";

const $ = (id: string) => document.getElementById(id)!;
const $v = (id: string) => ($(id) as HTMLInputElement).value;
const show = (id: string, on = true) => $(id).classList.toggle("hidden", !on);
const SCREENS = ["screen-title", "screen-settings", "screen-instructions", "screen-pause", "screen-death", "screen-win", "screen-catalog", "ui-inventory", "ui-craft", "ui-cache"];
const hideAll = () => SCREENS.forEach((s) => show(s, false));

const audio = new Audio();
let settings: Settings = getSettings();
let game: Game | null = null;

document.addEventListener("click", () => audio.resume(), { once: true });
document.addEventListener("touchstart", () => audio.resume(), { once: true });

// ---------- title / world list ----------

function renderTitle() {
  hideAll();
  show("screen-title");
  $("best-score").textContent = bestScore() > 0 ? `Best run: ${bestScore().toFixed(1)} days` : "";
  const list = $("worldlist");
  list.innerHTML = "";
  const worlds = listWorlds();
  if (!worlds.length) list.innerHTML = `<div class="needs">No worlds yet. Type a seed (or leave it blank) and create one.</div>`;
  for (const w of worlds) {
    const row = document.createElement("div");
    row.className = "world-row";
    const run = loadRun(w.id);
    const label = document.createElement("span");
    label.textContent = `${w.name} — seed “${w.seedStr}” — ${run ? `day ${run.days}, survived ${(run.playSec / DAY_SECONDS).toFixed(1)} days` : "never played"}`;
    const load = document.createElement("button");
    load.textContent = "Load";
    load.onclick = () => startGame(w, run);
    const exp = document.createElement("button");
    exp.textContent = "Export";
    exp.onclick = () => { if (run) exportRun(w, run); else hud.toast("Nothing saved for this world yet."); };
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = () => {
      if (del.textContent === "Sure?") deleteWorld(w.id), renderTitle();
      else { del.textContent = "Sure?"; setTimeout(() => (del.textContent = "Delete"), 2500); }
    };
    row.append(label, load, exp, del);
    list.appendChild(row);
  }
}

// ---------- game lifecycle ----------

function startGame(meta: WorldMeta, run: RunSave | null) {
  hideAll();
  show("cheats", false);
  $("hud").classList.remove("hidden");
  // joining a world with Fullscreen on goes straight fullscreen — this click is
  // the user gesture the browser requires; if it refuses, requestLock retries
  if (settings.fullscreen && document.fullscreenEnabled && !document.fullscreenElement)
    void document.documentElement.requestFullscreen().catch(() => {});
  // guest worlds are ephemeral: no save/export affordances
  $("btn-save").classList.toggle("hidden", meta.id.startsWith("guest"));
  $("btn-exportworld").classList.toggle("hidden", meta.id.startsWith("guest"));
  audio.resume();
  game = new Game(meta, run, $("game-wrap"), settings, audio);
  (globalThis as Record<string, unknown>).game = game;
  game.start();
}

function toTitle() {
  if (game) game.saveNow(), game.stop();
  game = null;
  delete (globalThis as Record<string, unknown>).game;
  $("hud").classList.add("hidden");
  renderTitle();
}

/** screens that sit on top of pause/title; closing returns to the right base */
function openOverlay(id: string) {
  hideAll();
  show(id);
}
function closeOverlays() {
  show("screen-settings", false);
  show("screen-instructions", false);
  show("screen-catalog", false);
  if (game) {
    // closing any menu always closes the pause menu too
    show("ui-inventory", false);
    show("ui-craft", false);
    show("ui-cache", false);
    show("screen-pause", false);
    game.paused = false;
    game.f1Paused = false;
    game.relock();
  } else renderTitle();
}

// ---------- settings ----------

function renderSettings() {
  openOverlay("screen-settings");
  const body = $("settings-body");
  body.innerHTML = "";
  // One row per setting: label + a group of choice buttons, the active one lit.
  const seg = <T extends string | number | boolean>(label: string, opts: [string, T][], cur: T, on: (v: T) => void) => {
    const r = document.createElement("div"); r.className = "setting";
    const lb = document.createElement("span"); lb.textContent = label;
    const grp = document.createElement("div"); grp.className = "seg";
    const btns: HTMLButtonElement[] = [];
    for (const [text, val] of opts) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = text;
      if (String(val) === String(cur)) b.classList.add("on");
      b.onclick = () => { for (const x of btns) x.classList.remove("on"); b.classList.add("on"); on(val); };
      btns.push(b); grp.appendChild(b);
    }
    r.append(lb, grp); body.appendChild(r);
  };
  seg("Look sensitivity", [["Slow", 0.6], ["Normal", 1], ["Fast", 1.6], ["Turbo", 2.5]], settings.sens,
    (v) => { settings.sens = v; commit(); });
  seg("Invert Y", [["Off", false], ["On", true]], settings.invertY,
    (v) => { settings.invertY = v; commit(); });
  seg("Volume", [["Mute", 0], ["Low", 0.34], ["Medium", 0.67], ["High", 1]], settings.volume,
    (v) => { settings.volume = v; commit(); });
  seg("Music", [["Off", false], ["On", true]], settings.music,
    (v) => { settings.music = v; commit(); });
  seg("Field of view", [["60", 60], ["70", 70], ["80", 80], ["90", 90], ["100", 100]], settings.fov,
    (v) => { settings.fov = v; commit(); });
  seg("Render distance", [["Low", 4], ["Medium", 6], ["High", 8], ["Far", 10], ["Ultra", 12]], settings.renderDist,
    (v) => { settings.renderDist = v; commit(); });
  seg("Quality", [["Low", "low"], ["Medium", "med"], ["High", "high"]] as [string, Settings["quality"]][], settings.quality,
    (v) => { settings.quality = v; commit(); });
  seg("Temperature units", [["Celsius", "C"], ["Fahrenheit", "F"]] as [string, Settings["units"]][], settings.units,
    (v) => { settings.units = v; commit(); });
  if (document.fullscreenEnabled) {
    seg("Fullscreen", [["Off", false], ["On", true]], settings.fullscreen, (on) => {
      settings.fullscreen = on; commit();
      if (on) void document.documentElement.requestFullscreen().catch(() => {
        settings.fullscreen = false; commit(); renderSettings(); // browser refused: unlight the button
      });
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    });
  } else {
    const r = document.createElement("div"); r.className = "setting";
    r.append(document.createTextNode("Fullscreen"), Object.assign(document.createElement("span"), { className: "needs", textContent: "not available in this browser" }));
    body.appendChild(r);
  }
}

function commit() {
  setSettings(settings);
  if (game) game.applySettings(settings);
}

// ---------- catalog ----------

let catalogTab: "items" | "recipes" = "items";

function renderCatalog() {
  openOverlay("screen-catalog");
  for (const t of Array.from($("catalog-tabs").querySelectorAll<HTMLButtonElement>(".tab")))
    t.classList.toggle("active", t.dataset.tab === catalogTab);
  const body = $("catalog-body");
  body.innerHTML = "";
  if (catalogTab === "items") {
    const grid = document.createElement("div");
    grid.className = "cat-grid";
    const push = (art: string, name: string, meta: string, desc: string) => {
      const card = document.createElement("div");
      card.className = "cat-card";
      const img = document.createElement("img");
      img.src = art; img.alt = "";
      const txt = document.createElement("div");
      txt.innerHTML = `<b>${name}</b><div class="cat-meta">${meta}</div><div class="cat-desc">${desc}</div>`;
      card.append(img, txt);
      grid.append(card);
    };
    for (const it of Object.values(ITEMS).sort((a, b) => a.name.localeCompare(b.name)))
      push(itemArtUrl(it.id), it.name, `${it.w}×${it.h} cell · ${it.mass} kg${it.block !== undefined ? " · placeable" : ""}`, it.desc);
    for (const b of BLOCKS) {
      if (b.id === 0 || b.name === "Air") continue;
      const item = Object.values(ITEMS).find((i) => i.block === b.id);
      const meta = `${b.placeable ? "placeable" : "world only"} · ${b.R > 0 ? `R ${b.R}` : "no insulation"}${b.emissive ? " · light source" : ""}`;
      push(item ? itemArtUrl(item.id) : blockTileUrl(b.id), b.name, meta, item?.desc ?? "Found in the world; mine it to collect it." + (b.minTier > 0 ? ` Needs a tier-${b.minTier} ${b.tool ?? "tool"}.` : ""));
    }
    body.append(grid);
  } else {
    const row = (art: string, left: string, right: string, where: string) => {
      const d = document.createElement("div");
      d.className = "cat-recipe";
      const img = document.createElement("img");
      img.src = art; img.alt = ""; img.style.width = "36px"; img.style.height = "36px";
      img.style.imageRendering = "pixelated";
      d.append(img, Object.assign(document.createElement("span"), { innerHTML: `${left} <span class="arrow">→</span> <b>${right}</b> <span class="needs">(${where})</span>` }));
      body.append(d);
    };
    for (const r of RECIPES) {
      const needs = Object.entries(r.needs).map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(" + ");
      row(itemArtUrl(r.out), needs, `${ITEMS[r.out].name}${r.count > 1 ? " ×" + r.count : ""}`, r.bench ? "Crafting Bench" : "hands");
    }
    for (const s of SMELT)
      row(itemArtUrl(s.out), `1× ${ITEMS[s.in].name}`, ITEMS[s.out].name, "Campfire, 1 fuel charge");
  }
}
for (const t of Array.from($("catalog-tabs").querySelectorAll<HTMLButtonElement>(".tab")))
  t.onclick = () => { catalogTab = t.dataset.tab as "items" | "recipes"; renderCatalog(); };

// ---------- instructions ----------

const DESKTOP_KEYS: [string, string][] = [
  ["WASD", "move"], ["Shift", "sprint (sweats, costs water)"], ["Space", "jump one block"],
  ["Mouse", "look (click the world to capture the pointer)"], ["Left click, hold", "mine a block (right tool tier matters)"],
  ["Right click", "place the selected block"], ["E", "interact: doors, beacon save, bench, campfire, oasis / water-station refill, death caches"],
  ["Q", "drink a full canister (+25 water)"], ["X", "sweat surge: spend 15 water to force your body cool (needs 20+ water, 10 s cooldown)"], ["I", "inventory"], ["1-9 / mouse wheel", "select item"],
  ["Esc", "close open menu, or pause"], ["P", "pause / resume"], ["F1", "this screen"],
];
const MOBILE_KEYS: [string, string][] = [
  ["Left stick", "move"], ["Drag the right half of the screen", "look"],
  ["JUMP / BREAK / PLACE / ACT / DRINK / SURGE / ITEM / BAG", "buttons on the right"],
];

function renderInstructions() {
  openOverlay("screen-instructions");
  const body = $("instr-body");
  body.innerHTML = "";
  const rows = matchMedia("(pointer: coarse)").matches ? MOBILE_KEYS : DESKTOP_KEYS;
  for (const [k, v] of rows) {
    const d = document.createElement("div");
    d.innerHTML = `<b>${k}</b> — ${v}`;
    body.appendChild(d);
  }
  const extra = document.createElement("div");
  extra.className = "needs";
  extra.textContent = "Keep the three bars inside their white safe bands. The Ship Interior is always sealed: your body heat drifts back to 36.6 °C there. Outside, midday cooks you and night freezes you — shade, walls and doors change what you are exposed to. Death costs everything you carry: it waits in a Death Cache where you fell. Respawning only works at a Save Beacon you activated with E. Beacons are the only save points.";
  body.appendChild(extra);
}

// ---------- wiring ----------

$("btn-create").onclick = () => {
  const seedStr = $v("seed-input").trim() || Math.random().toString(36).slice(2, 10);
  const name = $v("world-name").trim() || seedStr;
  const meta = createWorld(name, seedStr);
  startGame(meta, null);
};

$("btn-guest").onclick = () => {
  // never enters the world index, never autosaves, random seed every time
  const seedStr = Math.random().toString(36).slice(2, 10);
  startGame({ id: "guest:" + Date.now().toString(36), name: "Guest world", seedStr, updated: Date.now() }, null);
};

$("btn-import").onclick = () => $("import-file").click();
($("import-file") as HTMLInputElement).onchange = async () => {
  const f = ($("import-file") as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const meta = await importRun(f);
    hud.toast("World imported.");
    startGame(meta, loadRun(meta.id));
  } catch (e) {
    hud.toast(`Import failed: ${(e as Error).message}`);
  }
};

$("btn-settings").onclick = renderSettings;
$("btn-pause-settings").onclick = renderSettings;
$("btn-instructions").onclick = renderInstructions;
$("btn-catalog").onclick = renderCatalog;
$("btn-catalog-title").onclick = renderCatalog;

for (const btn of document.querySelectorAll<HTMLButtonElement>(".close-btn"))
  btn.onclick = () => {
    if (game) game.closeUI();
    // closeUI refuses to close the inventory while temporary storage is occupied;
    // don't let closeOverlays sneak past that guard
    if (!game || !(game.ui === "inv" && game.temp)) closeOverlays();
  };

$("btn-resume").onclick = () => { if (game) { game.paused = false; show("screen-pause", false); show("cheats", false); game.relock(); } };
$("btn-save").onclick = () => hud.toast("Manual saves are not allowed — save at Save Beacons (the world auto-persists).");
$("btn-exportworld").onclick = () => { if (game) game.exportWorld(); };
$("btn-quit").onclick = () => toTitle();
$("btn-cheats").onclick = () => show("cheats", $("cheats").classList.contains("hidden"));
const cheatItemSel = $("cheat-item") as HTMLSelectElement;
for (const [id, def] of Object.entries(ITEMS).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
  const o = document.createElement("option");
  o.value = id; o.textContent = def.name;
  cheatItemSel.appendChild(o);
}
$("btn-cheat-add").onclick = () => {
  if (!game) return;
  const id = cheatItemSel.value;
  if (game.inv.addItem(id, 1)) hud.toast("No room in your pack.");
  else hud.toast(`Added ${ITEMS[id].name}.`);
};
for (const b of Array.from($("cheats").querySelectorAll<HTMLButtonElement>("button[data-speed], button[data-immortal], button[data-frac]"))) {
  b.onclick = () => {
    if (!game) return;
    if (b.dataset.speed !== undefined) {
      game.speedMul = Number(b.dataset.speed);
      hud.toast(`Player speed ×${b.dataset.speed}.`);
      return;
    }
    if (b.dataset.immortal !== undefined) {
      game.survival.invincible = b.dataset.immortal === "1";
      hud.toast(`Immortality ${game.survival.invincible ? "on" : "off"}.`);
      return;
    }
    const frac = Number(b.dataset.frac);
    game.setClock(frac);
    hud.toast(`Clock set to ${b.textContent}.`);
  };
}

$("btn-respawn").onclick = () => { if (game) game.respawn(); };
$("btn-death-title").onclick = () => toTitle();
$("btn-win-continue").onclick = () => { if (game) { game.paused = false; show("screen-win", false); game.relock(); } };
$("btn-win-title").onclick = () => toTitle();

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && !$("screen-title").classList.contains("hidden") && document.fullscreenElement) {
    // main menu: Esc drops fullscreen (browsers that deliver Esc to the page at all)
    void document.exitFullscreen().catch(() => {});
    return;
  }
  if (e.code === "F1") {
    e.preventDefault();
    if ($("screen-instructions").classList.contains("hidden")) {
      renderInstructions();
      if (game && !game.paused) { game.paused = true; game.f1Paused = true; }
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      closeOverlays();
    }
  }
});

renderTitle();
