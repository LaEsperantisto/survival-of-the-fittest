import { Game } from "./game";
import { DAY_SECONDS, BLOCKS } from "./blocks";
import { Audio } from "./audio";
import { ITEMS } from "./items";
import { QUESTS } from "./quests";
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
  if (run === null) game.startTutorial(); // first visit: the desert teaches in-world
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
  if (game) game.pauseSubmenu = null;
  show("screen-settings", false);
  show("screen-instructions", false);
  show("screen-catalog", false);
  if (game) {
    // closing any menu always closes the pause menu too
    show("ui-inventory", false);
    show("ui-craft", false);
    show("ui-cache", false);
    show("ui-trade", false);
    show("screen-pause", false);
    game.paused = false;
    game.relock();
  } else renderTitle();
}

// ---------- settings ----------

function renderSettings() {
  if (game) game.pauseSubmenu = game.paused ? "settings" : null;
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
  seg("Lighting", [["Baked sky light", "sky"], ["Real-time shadows", "shadow"]] as [string, Settings["lighting"]][], settings.lighting,
    (v) => { settings.lighting = v; commit(); });
  seg("Temperature units", [["Celsius", "C"], ["Fahrenheit", "F"]] as [string, Settings["units"]][], settings.units,
    (v) => { settings.units = v; commit(); });
  seg("UI size", [["Small", 0.8], ["Normal", 1], ["Large", 1.25], ["Huge", 1.6]], settings.uiScale,
    (v) => { settings.uiScale = v; commit(); });
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

function applyUiScale(v: number) { document.documentElement.style.setProperty("--ui-scale", String(v)); }

function commit() {
  setSettings(settings);
  applyUiScale(settings.uiScale);
  if (game) game.applySettings(settings);
}

// ---------- catalog ----------

let catalogTab: "items" | "recipes" = "items";

function renderCatalog() {
  if (game) game.pauseSubmenu = game.paused ? "catalog" : null;
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
      row(itemArtUrl(r.out), needs, `${ITEMS[r.out].name}${r.count > 1 ? " ×" + r.count : ""}`,
        r.station === null ? "hands" : r.station === "armory" ? "Armoury" : "Crafting Bench");
    }
    for (const s of SMELT)
      row(itemArtUrl(s.out), `1× ${ITEMS[s.in].name}`, `${ITEMS[s.out].name}${s.n && s.n > 1 ? " ×" + s.n : ""}`, "Campfire, 1 fuel charge");
  }
}
for (const t of Array.from($("catalog-tabs").querySelectorAll<HTMLButtonElement>(".tab")))
  t.onclick = () => { catalogTab = t.dataset.tab as "items" | "recipes"; renderCatalog(); };

// ---------- instructions ----------

const DESKTOP_KEYS: [string, string][] = [
  ["WASD", "move"], ["Shift", "sprint (sweats, costs water)"], ["Space", "jump one block"],
  ["Falls", "falling more than 4 blocks hurts — about 16 blocks without armour is fatal; land in water or climb down"],
  ["Mouse", "look (click the world to capture the pointer)"], ["Left click, hold", "mine a block or hit a mob (right tool tier matters)"],
  ["Metal Sword", "Crafting Bench: 2 Iron Rods + 1 Dead Wood — far harder hits, longer reach (snake dies in 2 swings, rat in 1)"],
  ["Right click", "place the selected block"], ["E", "interact: doors, beacon save, bench, campfire (hold Wood or Kindling and press E to feed the fire), Heat Regulator (set body to 37 °C), oasis / water-station refill, death caches, trade with a camp Trader, Broken Thruster on a wingtip (needs a Thruster Nozzle)"],
  ["R", "turn a held built block a quarter turn (Crafting Bench, Bed, Thruster, walls …) — it places facing that way"],
  ["G", "toss the held item away"],
  ["T", "toggle the Head Lantern — it burns one fuel charge per 4 game-minutes; refuel it at a Campfire"],
  ["Q", "use the held item: drink a full canister (+25 water, cools you a little), or eat food"], ["X", "sweat surge: spend 10 water to force your body cool (needs 20+ water, 5 s cooldown)"], ["I", "inventory — Equip gear"],
  ["1-9 / mouse wheel / click hotbar", "select item — press the number or click the already-held item to empty your hands"],
  ["Esc", "close open menu, or pause"], ["P", "pause / resume"],
];
const MOBILE_KEYS: [string, string][] = [
  ["Left stick", "move"], ["Drag the right half of the screen", "look"],
  ["JUMP / BREAK / PLACE / ACT / DRINK / SURGE / LAMP / ITEM / DROP / BAG", "buttons on the right"],
  ["BREAK, aimed at a mob", "fight it — hold the Metal Sword for far harder hits and longer reach"],
  ["Tap an item, then another cell", "move it there (occupants swap); tap an Armour Slot to wear the selected gear; tap empty space to deselect"],
  ["Bottom hotbar", "tap a slot to select that item; the ITEM button cycles through it"],
];

function renderInstructions() {
  if (game) game.pauseSubmenu = game.paused ? "instructions" : null;
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
  extra.textContent = "Keep the three bars inside their white safe bands; a pulsing ☀ beside the TEMP bar means you are overheating, ❄ means freezing. Walls block the wind but not heat: a sealed room's air drifts toward the outside temperature. Only Heat Regulator blocks hold a sealed room at ~37 °C — each covers 150 cells, they stack in bigger rooms; the Ship Interior comes with one. Direct midday sun adds a punishing +8…18 °C — shade from rocks, dunes and walls cancels it; at night the desert freezes you. Dig into the Caves: two or more cells under the terrain the air sits at a constant mild ~22 °C, and shelter there lets your body claw back toward 36.6 °C. That is the refuge — but it is dark (wear a Head Lantern, toggle with T), Scorpions and Sand Wurms live only down there, and Cobalt Ore — the one thing that can fix the Ship's engines — hides there too. The goal: mine Cobalt, smelt and craft four Thruster Nozzles, press E at each Broken Thruster on the wingtips, and lift off. Or just keep surviving and beat your best day count. Death costs everything you carry: it waits in a Death Cache where you fell. Respawning only works at a Save Beacon you activated with E. Beacons are the only save points. The desert is alive: Desert Snakes bite anything that steps too close, Kangaroo Rats bolt, Scorpions and Wurms ambush in the dark — hunt what you can, cook the meat at a Campfire, eat it to heal. Break Cacti for Prickly Pears to drink. Snake skins stitch into Reptile Armour. Backpack, Visor, Armour, Regulator and Light go in the five Armour Slots inside the inventory: select the gear, then click or tap the empty slot to wear it. The desert is bigger than it looks: Trader Camps — a windmill, a hut, a farmstead — dot the wastes hundreds of steps out, and the robed Trader there barters goods for goods; no coin, and the offer table restocks every in-game day. Watch the sky: a Sandstorm rolls in without warning — when the wind roars, get behind walls or dig in, because the open air will bake you, drink you dry and scour your skin. Arched Cave Mouths gape in rocky slopes and lead straight down to the Caves. Vultures circle the healthy but dive at the wounded; hunt Thornback Tortoises for shell armour, Fennec Foxes for pelts, and bring the skins, shells and hides back to the Trader.";
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
$("btn-pause-instructions").onclick = renderInstructions;
$("btn-catalog").onclick = renderCatalog;
$("btn-catalog-title").onclick = renderCatalog;

for (const btn of document.querySelectorAll<HTMLButtonElement>(".close-btn"))
  btn.onclick = () => {
    // Settings / Catalog opened from the pause menu: ✕ goes back to the pause
    // menu; the mouse stays free until the pause menu itself closes.
    if (game && game.pauseSubmenu) { game.closePauseSubmenu(); return; }
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
const cheatQuestSel = $("cheat-quest") as HTMLSelectElement;
QUESTS.forEach((q, i) => {
  const o = document.createElement("option");
  o.value = String(i); o.textContent = `${i + 1}. ${q.title}`;
  cheatQuestSel.appendChild(o);
});
{
  const o = document.createElement("option");
  o.value = String(QUESTS.length); o.textContent = "Finish the whole chain";
  cheatQuestSel.appendChild(o);
}
$("btn-cheat-quest").onclick = () => {
  if (!game) return;
  game.questJump(Number(cheatQuestSel.value));
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
});

applyUiScale(settings.uiScale);
renderTitle();
