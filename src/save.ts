// Persistence: world slots in localStorage, delta-chunk saves (see ADR-0002),
// and JSON file export/import so a world can exceed the localStorage cap and
// travel between devices.
import type { Port, ShipSnapshot } from "./ship";

export interface WorldMeta { id: string; name: string; seedStr: string; updated: number; mode?: "easy" | "hard" | "phase2"; }

const K_INDEX = "sotf:index", K_SET = "sotf:settings";

export interface Settings {
  sens: number; invertY: boolean; fov: number; renderDist: number;
  quality: "low" | "med" | "high"; volume: number; units: "C" | "F";
  fullscreen: boolean; music: boolean; uiScale: number;
  lighting: "sky" | "shadow";
}

export const DEFAULT_SETTINGS: Settings = {
  sens: 1, invertY: false, fov: 70, renderDist: 6, quality: "med", volume: 0.67, units: "C",
  fullscreen: false, music: true, uiScale: 1,
  lighting: "shadow",
};

export function getSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(K_SET) || "{}") }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function setSettings(s: Settings) { localStorage.setItem(K_SET, JSON.stringify(s)); }

export function listWorlds(): WorldMeta[] {
  try { return JSON.parse(localStorage.getItem(K_INDEX) || "[]"); } catch { return []; }
}
function writeIndex(list: WorldMeta[]) { localStorage.setItem(K_INDEX, JSON.stringify(list)); }

export function createWorld(name: string, seedStr: string, mode: "easy" | "hard" | "phase2" = "easy"): WorldMeta {
  const id = "w" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const meta = { id, name: name || seedStr || "world", seedStr, updated: Date.now(), mode };
  const list = listWorlds();
  list.unshift(meta);
  writeIndex(list);
  return meta;
}

export function deleteWorld(id: string) {
  writeIndex(listWorlds().filter((w) => w.id !== id));
  localStorage.removeItem("sotf:w:" + id);
}

export interface FireSave {
  lit: boolean; drip?: number;
  charge?: number; // fuel charges banked in the coals
  fuel?: { itemId: string; x: number; y: number; rot?: boolean; charges?: number; stack?: { itemId: string; count: number } }[]; // legacy: pre-pool fuel items
  input: { itemId: string; x: number; y: number; rot?: boolean; charges?: number; cook?: number; done?: boolean; stack?: { itemId: string; count: number } }[];
  output: { itemId: string; x: number; y: number; rot?: boolean; charges?: number; stack?: { itemId: string; count: number } }[];
}

export interface PotSave {
  lit: boolean; drip?: number;
  charge?: number; // fuel charges banked in the coals
  input: { itemId: string; x: number; y: number; rot?: boolean; charges?: number; stack?: { itemId: string; count: number } }[];
  output: { itemId: string; x: number; y: number; rot?: boolean; charges?: number; stack?: { itemId: string; count: number } }[];
  jobs?: { out: string; cook: number }[]; // dishes mid-simmer, by their output item id
}

/** The two worlds a run can hold (ADR-0010). */
export type Planet = "desertis" | "silvaris";

/** One Hover Sled: cell key -> charge, bolted upgrades, stowed cargo kinds. */
export type SledSave = [string, { charge: number; up?: Record<string, true>; cargo?: [string, number][] }];

/** Everything that belongs to one planet rather than to the run: chunk edits,
 *  Grid state, stations, farms, Ships, Pins, explored map (ADR-0010). ADR-0011's
 *  per-planet seed lives here; a record made from the run's own seed leaves it
 *  implicit. */
export interface WorldRun {
  seedStr?: string;               // this planet's seed (defaults to the run's)
  deltas: Record<string, number[]>;
  rots?: Record<string, number>;
  visited?: string[];
  revealed?: string[];
  pins?: { id: number; x: number; z: number; name: string }[];
  chests?: RunSave["chests"];
  campfires: RunSave["campfires"];
  pots?: RunSave["pots"];
  recyclers?: RunSave["recyclers"];
  turretAmmo?: RunSave["turretAmmo"];
  battery?: RunSave["battery"];
  genFuel?: RunSave["genFuel"];
  trippedPanels?: RunSave["trippedPanels"];
  crops?: RunSave["crops"];
  trees?: RunSave["trees"];
  appleTrees?: RunSave["appleTrees"];
  fruitRegrow?: RunSave["fruitRegrow"];
  coreFuel?: RunSave["coreFuel"];
  sleds?: SledSave[];                 // placed Hover Sleds: cell -> charge/upgrades/cargo
  ships?: ShipSnapshot[];
  beaconMarks: RunSave["beaconMarks"];
  entities: RunSave["entities"];
  pods?: RunSave["pods"];
  caches: RunSave["caches"];
  collected?: RunSave["collected"];
  melonHint?: boolean;
}

export interface RunSave {
  v: 1 | 2 | 3 | 4;
  seedStr: string;
  time: number;
  playSec: number;
  days: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  survival: { health: number; water: number; body: number };
  quest?: { i: number; p: number[]; e?: Record<string, number> };
  inventory: { slots: { itemId: string; count?: number; x: number; y: number; rot?: boolean; blockRot?: number; charges?: number; stack?: { itemId: string; count: number } }[]; selected: number; w: number; h: number }; // count: legacy only - items never stack now
  equip?: { backpack?: string; head?: string; body?: string; regulator?: string; light?: string;
            charges?: { regulator?: number; light?: number } };
  // ---- v2-only planet-scoped fields: migrateRun wraps these into worlds.desertis
  // (ADR-0010); a v3 save writes them into the active WorldRun instead ----
  beaconMarks?: { x: number; y: number; z: number; ck?: string }[]; // ck: ship-local key when the Beacon rides a Ship
  collected?: string[];
  entities?: { x: number; y: number; z: number; itemId: string; count?: number; charges?: number; age?: number; stack?: { itemId: string; count: number } }[];
  pods?: { x: number; z: number; t: number; itemId: string; n: number; ringEid?: number; beamEid?: number }[];
  caches?: { x: number; y: number; z: number; kind?: "death" | "chest" | "reward"; items: { itemId: string; count: number; charges?: number; stack?: { itemId: string; count: number } }[] }[];
  chests?: { cells: string; slots: { itemId: string; count?: number; x: number; y: number; rot?: boolean; blockRot?: number; charges?: number; stack?: { itemId: string; count: number } }[] }[];
  campfires?: Record<string, number | FireSave>;
  battery?: [string, number][];      // Battery cell -> stored Grid units
  genFuel?: [string, number][];      // Wood Generator cell -> burn seconds left
  trippedPanels?: string[];          // Power Panel cells latched off (ADR-0007)
  crops?: [string, number][]; // planted crop key -> accumulated good seconds
  trees?: [string, number][]; // planted Living Tree key -> growth seconds
  appleTrees?: [string, number][]; // planted Apple Pip key -> growth seconds
  fruitRegrow?: [string, number][]; // picked bough leaf key -> seconds until re-ripe
  pots?: Record<string, PotSave>;   // Cooking Pot key -> state (fires ride campfires)
  recyclers?: Record<string, PotSave>; // Recycler key -> staging grids (both planets)
  turretAmmo?: [string, number][];     // Gun Turret cell -> Slugs loaded
  deltas?: Record<string, number[]>;
  rots?: Record<string, number>; // cell "x,y,z" -> quarter-turn for player-placed blocks
  ships?: ShipSnapshot[];                 // airborne/grounded Ships (cells are ship-local)
  coreFuel?: [string, number[] | Port[]][]; // Engine Core before takeoff: world cell -> ports (legacy saves hold bare charge numbers)
  pins?: { id: number; x: number; z: number; name: string }[];   // Surveyor's Pins
  visited?: string[];                     // explored chunk keys "cx,cz"
  revealed?: string[];                    // landmark keys the Tracker/quests marked
  melonHint?: boolean;                  // one-time Melon Seed hint already shown
  // ---- global run state (v2 and v3) ----
  won?: boolean;
  lastSleep?: number;         // timeSec of the last bed sleep
  worldMode?: "easy" | "hard" | "phase2"; // fixed at world creation (Phase 0/1/2 Start)
  cheats?: { immortal?: boolean; keep?: boolean }; // cheat-menu toggles that persist with the world
  chronicle?: string[];                   // lesson ids seen (chronicle.ts)
  codex?: string[];                       // item ids (and "b:<blockId>") first carried/crafted/mined
  dominion?: { silentCamps?: string[]; raidedRelays?: string[]; campTrust?: string[]; campTrade?: Record<string, number>; chaptersRead?: string[]; unlocks?: Record<string, true> }; // cut Camp antennas (tx,tz) / Relays that already raided (tx|tz|day) / trusted Keeper camps ("d:tx,tz"/"s:tx,tz") / trades per camp / chapters already heard / locked recipes the world has revealed
  // ---- v4: Phase 2 run state (clean break: v3 worlds' block ids no longer exist) ----
  sentinel?: boolean;                     // the Sentinel has fallen
  wrath?: number;                         // machine provocation level: squads escalate with it
  // ---- v3: one record per planet (ADR-0010) ----
  planet?: Planet;                        // the world the player is standing on
  worlds?: { desertis: WorldRun; silvaris?: WorldRun };
}

/** A planet record with nothing on it — a fresh world's starting state. */
export function emptyWorldRun(seedStr?: string): WorldRun {
  return { seedStr, deltas: {}, beaconMarks: [], entities: [], caches: [], campfires: {} };
}

const V2_PLANET_FIELDS = [
  "deltas", "rots", "visited", "revealed", "pins", "chests", "campfires", "pots", "battery",
  "genFuel", "trippedPanels", "crops", "trees", "appleTrees", "fruitRegrow", "coreFuel",
  "ships", "beaconMarks", "entities", "pods", "caches", "collected", "melonHint",
] as const;

/** v1/v2 → v3 wrapped the planet-scoped fields into worlds.desertis (ADR-0010);
 *  v4 (ADR-0014) renumbered every block id, so older saves are a clean break:
 *  loadRun rejects them outright. */
export function migrateRun(run: RunSave): RunSave {
  if (run.v === 4 && run.worlds?.desertis) return run;
  const out: RunSave = { ...run, v: 4 };
  const w: WorldRun = run.worlds?.desertis ?? emptyWorldRun(run.seedStr);
  if (run.v < 3) for (const k of V2_PLANET_FIELDS) {
    const v = run[k];
    if (v !== undefined) (w as unknown as Record<string, unknown>)[k] = v;
    delete out[k];
  }
  out.planet = run.planet ?? "desertis";
  out.worlds = { ...(run.worlds ?? {}), desertis: w };
  return out;
}

export function saveRun(meta: WorldMeta, run: RunSave): boolean {
  try {
    localStorage.setItem("sotf:w:" + meta.id, JSON.stringify(run));
    const list = listWorlds();
    const m = list.find((w) => w.id === meta.id);
    if (m) { m.updated = Date.now(); writeIndex(list); }
    return true;
  } catch { return false; } // quota exceeded
}

export function loadRun(id: string): RunSave | null {
  try {
    const s = localStorage.getItem("sotf:w:" + id);
    if (!s) return null;
    const run = JSON.parse(s) as RunSave;
    if (run.v < 4) return null; // clean break: pre-Phase-2 worlds use dead block ids
    return migrateRun(run);
  } catch { return null; }
}

export function exportRun(meta: WorldMeta, run: RunSave) {
  const blob = new Blob([JSON.stringify({ meta, run })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meta.name.replace(/[^\w.-]+/g, "_")}.sotfworld.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importRun(file: File): Promise<WorldMeta> {
  const obj = JSON.parse(await file.text());
  if (!obj || obj.run?.v !== 4) throw new Error("Not a Survival of the Fittest world file (Phase 2 worlds only).");
  const meta = createWorld(obj.meta?.name ?? "imported", obj.run.seedStr, obj.run.worldMode);
  saveRun(meta, migrateRun(obj.run));
  return meta;
}
