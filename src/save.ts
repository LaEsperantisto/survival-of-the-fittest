// Persistence: world slots in localStorage, delta-chunk saves (see ADR-0002),
// and JSON file export/import so a world can exceed the localStorage cap and
// travel between devices.

export interface WorldMeta { id: string; name: string; seedStr: string; updated: number; }

const K_INDEX = "sotf:index", K_SET = "sotf:settings", K_BEST = "sotf:best";

export interface Settings {
  sens: number; invertY: boolean; fov: number; renderDist: number;
  quality: "low" | "med" | "high"; volume: number; units: "C" | "F";
  fullscreen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sens: 1, invertY: false, fov: 75, renderDist: 7, quality: "med", volume: 0.7, units: "C",
  fullscreen: false,
};

export function getSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(K_SET) || "{}") }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function setSettings(s: Settings) { localStorage.setItem(K_SET, JSON.stringify(s)); }

export function bestScore(): number { return Number(localStorage.getItem(K_BEST) || 0); }
export function submitBest(days: number) {
  if (days > bestScore()) localStorage.setItem(K_BEST, String(days));
}

export function listWorlds(): WorldMeta[] {
  try { return JSON.parse(localStorage.getItem(K_INDEX) || "[]"); } catch { return []; }
}
function writeIndex(list: WorldMeta[]) { localStorage.setItem(K_INDEX, JSON.stringify(list)); }

export function createWorld(name: string, seedStr: string): WorldMeta {
  const id = "w" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const meta = { id, name: name || seedStr || "world", seedStr, updated: Date.now() };
  const list = listWorlds();
  list.unshift(meta);
  writeIndex(list);
  return meta;
}

export function deleteWorld(id: string) {
  writeIndex(listWorlds().filter((w) => w.id !== id));
  localStorage.removeItem("sotf:w:" + id);
}

export interface RunSave {
  v: 1;
  seedStr: string;
  time: number;
  playSec: number;
  days: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  survival: { health: number; water: number; body: number };
  quest?: { i: number; p: number[] };
  inventory: { slots: { itemId: string; count: number; x: number; y: number; rot?: boolean }[]; selected: number; w: number; h: number; bonusLimit: number };
  beaconMarks: { x: number; y: number; z: number }[];
  collected: number[];
  entities: { x: number; y: number; z: number; itemId: string; count: number }[];
  pods?: { x: number; z: number; t: number; itemId: string; n: number }[];
  won?: boolean;
  caches: { x: number; y: number; z: number; kind?: "death" | "chest"; items: { itemId: string; count: number }[] }[];
  campfires: Record<string, number>;
  deltas: Record<string, number[]>;
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
    return s ? (JSON.parse(s) as RunSave) : null;
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
  if (!obj || obj.run?.v !== 1) throw new Error("Not a Survival of the Fittest world file.");
  const meta = createWorld(obj.meta?.name ?? "imported", obj.run.seedStr);
  saveRun(meta, obj.run);
  return meta;
}
