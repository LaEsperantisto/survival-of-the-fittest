import { Game } from "./game";
import { DAY_SECONDS } from "./blocks";
import { Audio } from "./audio";
import {
  WorldMeta, RunSave, Settings, listWorlds, createWorld, loadRun, deleteWorld,
  getSettings, setSettings, bestScore, exportRun, importRun,
} from "./save";
import * as hud from "./hud";

const $ = (id: string) => document.getElementById(id)!;
const $v = (id: string) => ($(id) as HTMLInputElement).value;
const show = (id: string, on = true) => $(id).classList.toggle("hidden", !on);
const SCREENS = ["screen-title", "screen-settings", "screen-instructions", "screen-pause", "screen-death", "screen-win", "ui-inventory", "ui-craft", "ui-cache"];
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
  if (game) {
    show("ui-inventory", false);
    show("ui-craft", false);
    show("ui-cache", false);
    if (game.paused) show("screen-pause");
    else game.relock();
  } else renderTitle();
}

// ---------- settings ----------

function renderSettings() {
  openOverlay("screen-settings");
  const body = $("settings-body");
  body.innerHTML = "";
  const row = (label: string, input: HTMLElement) => {
    const r = document.createElement("label");
    r.textContent = label + " ";
    r.appendChild(input);
    body.appendChild(r);
  };
  const slider = (label: string, min: number, max: number, step: number, val: number, on: (v: number) => void) => {
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = String(min); inp.max = String(max); inp.step = String(step); inp.value = String(val);
    inp.oninput = () => on(Number(inp.value));
    row(label, inp);
  };
  slider("Look sensitivity", 0.3, 3, 0.05, settings.sens, (v) => { settings.sens = v; commit(); });
  const inv = document.createElement("input"); inv.type = "checkbox"; inv.checked = settings.invertY;
  inv.onchange = () => { settings.invertY = inv.checked; commit(); };
  row("Invert Y", inv);
  slider("Volume", 0, 1, 0.05, settings.volume, (v) => { settings.volume = v; commit(); });
  slider("FOV", 60, 100, 1, settings.fov, (v) => { settings.fov = v; commit(); });
  slider("Render distance (chunks)", 3, 12, 1, settings.renderDist, (v) => { settings.renderDist = v; commit(); });
  const qual = document.createElement("select");
  for (const q of ["low", "med", "high"]) {
    const o = document.createElement("option");
    o.value = q; o.textContent = q; o.selected = settings.quality === q;
    qual.appendChild(o);
  }
  qual.onchange = () => { settings.quality = qual.value as Settings["quality"]; commit(); };
  row("Quality", qual);
  const units = document.createElement("select");
  for (const u of ["C", "F"]) {
    const o = document.createElement("option");
    o.value = u; o.textContent = u === "C" ? "Celsius" : "Fahrenheit"; o.selected = settings.units === u;
    units.appendChild(o);
  }
  units.onchange = () => { settings.units = units.value as Settings["units"]; commit(); };
  row("Temperature units", units);
  const fsBtn = document.createElement("button");
  if (document.fullscreenEnabled) {
    fsBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen";
    fsBtn.onclick = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
    };
  } else {
    fsBtn.textContent = "Fullscreen unavailable";
    fsBtn.disabled = true;
  }
  row("Display", fsBtn);
}

function commit() {
  setSettings(settings);
  if (game) game.applySettings(settings);
}

// ---------- instructions ----------

const DESKTOP_KEYS: [string, string][] = [
  ["WASD", "move"], ["Shift", "sprint (sweats, costs water)"], ["Space", "jump one block"],
  ["Mouse", "look (click the world to capture the pointer)"], ["Left click, hold", "mine a block (right tool tier matters)"],
  ["Right click", "place the selected block"], ["E", "interact: doors, beacon save, bench, campfire, oasis / water-station refill, death caches"],
  ["Q", "drink a full canister (+25 water)"], ["I", "inventory"], ["1-9 / mouse wheel", "select item"],
  ["Esc", "close open menu, or pause"], ["F1", "this screen"],
];
const MOBILE_KEYS: [string, string][] = [
  ["Left stick", "move"], ["Drag the right half of the screen", "look"],
  ["JUMP / BREAK / PLACE / ACT / DRINK / ITEM / BAG", "buttons on the right"],
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
for (const b of Array.from($("cheats").querySelectorAll("button"))) {
  (b as HTMLButtonElement).onclick = () => {
    if (!game) return;
    const frac = Number((b as HTMLButtonElement).dataset.frac);
    game.setClock(frac);
    hud.toast(`Clock set to ${b.textContent}.`);
  };
}

$("btn-respawn").onclick = () => { if (game) game.respawn(); };
$("btn-death-title").onclick = () => toTitle();
$("btn-win-continue").onclick = () => { if (game) { game.paused = false; show("screen-win", false); game.relock(); } };
$("btn-win-title").onclick = () => toTitle();

document.addEventListener("keydown", (e) => {
  if (e.code === "F1") {
    e.preventDefault();
    if ($("screen-instructions").classList.contains("hidden")) {
      renderInstructions();
      if (game && !game.paused) { game.paused = true; game.f1Paused = true; }
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      show("screen-instructions", false);
      if (game?.f1Paused) { game.paused = false; game.f1Paused = false; game.relock(); }
      if (!game) renderTitle();
    }
  }
});

renderTitle();
