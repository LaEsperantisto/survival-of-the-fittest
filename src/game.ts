import * as THREE from "three";
import { World } from "./world";
import { Player } from "./player";
import { Survival, REGULATOR_ROOM_MAX } from "./survival";
import { Renderer } from "./renderer";
import { Audio } from "./audio";
import { Inventory, ITEMS, slotDims, type Slot } from "./items";
import { BLOCKS, AIR, WATER, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, BEACON, BENCH, BENCH_EXT, CAMPFIRE, LAMP, ENGINECORE, CHEST, CS, CH, DAY_SECONDS, isSolid } from "./blocks";
import { hashStr } from "./noise";
import { heightAt, biomeAt } from "./gen";
import { RECIPES, SMELT, canCraft, doCraft } from "./crafting";
import { currentQuest, loadQuestState, questEvent, type QuestDef, type QuestState } from "./quests";
import { WorldMeta, RunSave, saveRun, exportRun, bestScore, submitBest, Settings } from "./save";
import { itemTiles, itemArtUrl } from "./icons";
import * as hud from "./hud";

const isDoorHalf = (i: number) => i === DOOR_CLOSED || i === DOOR_UPPER;

export interface DroppedItem {
  id: number; x: number; y: number; z: number; itemId: string; count: number;
  buried?: boolean; buriedAt?: [number, number, number]; srcIndex?: number; fall?: number;
  repickAt?: number; // game time before which auto-pickup is suppressed (manual drops)
}
export interface DeathCache { id: number; x: number; y: number; z: number; kind: "death" | "chest" | "reward"; items: { itemId: string; count: number }[]; markerEid?: number }
export interface Raycast { hit: { x: number; y: number; z: number } | null; water: { x: number; y: number; z: number } | null; face: THREE.Vector3 }

export class Game {
  seed: number;
  world: World;
  survival: Survival;
  player: Player;
  inv = new Inventory();
  renderer: Renderer;
  timeSec: number;
  playSec = 0;
  entities: DroppedItem[] = [];
  caches: DeathCache[] = [];
  chests = new Map<string, Slot[]>();   // linked-chest cluster key -> grid slots
  chestInv: Inventory | null = null;    // live view of the open chest's cluster
  private gridFocus: "inv" | "chest" = "inv";
  campCharges = new Map<string, number>();
  beaconMarks: { x: number; y: number; z: number }[] = [];
  collected = new Set<number>();
  running = false;
  paused = false;
  f1Paused = false;
  escAt = 0;
  ui: null | "inv" | "bench" | "smelt" | "cache" = null;
  openCacheId: number | null = null;
  openStation: [number, number, number] | null = null;
  private breaking: { x: number; y: number; z: number; need: number; elapsed: number } | null = null;
  private mouseDown = false;
  private breakMsg = false;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private mobile = matchMedia("(pointer: coarse)").matches;
  speedMul = 1; // cheat-menu movement multiplier, session-only
  private regGlow = new Map<string, number>(); // "x,y,z" -> entity mesh id of an active regulator's glow shell
  private regGlowMat: THREE.MeshLambertMaterial | null = null;
  private regTick = -1;
  private mobileJump = false;
  private entitySeq = 1;
  private audioTickAcc = 0;
  private autosaveAcc = 0;
  private raf = 0;
  private last = 0;
  private bound = new Map<string, (e: Event) => void>();
  onDeathCb: (() => void) | null = null;
  deathCause = "";
  private quests: QuestState;
  private questShown = "";
  private pods: { x: number; z: number; t: number; itemId: string; n: number; ringEid: number; beamEid: number }[] = []; // inbound Reward Caches
  private waypointEid = 0;
  private waypointKey = "";
  private visorBeams = new Map<string, number>(); // cache/cluster key -> beam mesh id
  private lockAt = 0;
  private guideAcc = 1;
  won = false;

  constructor(public meta: WorldMeta, run: RunSave | null, parent: HTMLElement, private settings: Settings, private audio: Audio) {
    this.seed = hashStr(meta.seedStr || meta.id);
    this.world = new World(this.seed);
    this.survival = new Survival(this.seed ^ 7);
    this.quests = loadQuestState(run?.quest);
    this.renderer = new Renderer(parent);
    this.player = new Player(this.world);
    this.timeSec = run?.time ?? DAY_SECONDS * 0.7; // new worlds start mid-afternoon, near the day's hottest
    this.playSec = run?.playSec ?? 0;

    if (run) this.restore(run);
    else this.spawnStarterEntities();
    // the wreck's ceiling lamps are worldgen (not deltas): light them explicitly
    if (this.world.get(-6, 35, 0) === LAMP) this.renderer.addPointLight(-6, 35, 0, "lamp");
    if (this.world.get(6, 35, 0) === LAMP) this.renderer.addPointLight(6, 35, 0, "lamp");

    hud.initBars();
    this.renderQuest();
    this.attach();
    if (!this.mobile) document.getElementById("surge-btn")!.classList.remove("hidden");
    if (this.mobile) document.getElementById("mobile")!.classList.remove("hidden");
    this.applySettings(settings);
  }

  // ---------- setup / persistence ----------

  private spawnStarterEntities() {
    // generated loot is only the buried canisters — nothing lies loose on the sand;
    // ready water comes from the Supply Chest in the cockpit
    this.world.gen.canisters.forEach((c, i) => {
      if (!c.buried) return;
      const gy = Math.round(heightAt(this.seed, c.x, c.z));
      this.entities.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy, z: c.z + 0.5, itemId: "canister_full", count: 1, buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: i });
    });
    this.spawnStarterChest();
  }

  private spawnStarterChest() {
    // the cockpit's Supply Chest is a real chest block, stocked with three full canisters
    const [x, y, z] = [3, 31, 0];
    if (this.world.get(x, y, z) !== AIR) return;
    this.world.set(x, y, z, CHEST);
    this.chests.set(Game.chestKey([[x, y, z]]), [
      { itemId: "canister_full", count: 1, x: 0, y: 0 },
      { itemId: "canister_full", count: 1, x: 1, y: 0 },
      { itemId: "canister_full", count: 1, x: 2, y: 0 },
    ]);
  }

  // ---------- Supply Chest blocks ----------
  // A chest block owns an Inventory Grid. Chests touching orthogonally form one
  // cluster sharing a single grid: 3×3 each, width grows to 9 (three chests),
  // then height grows one row per chest. Capacity is always 9 per chest.

  private chestCluster(x: number, y: number, z: number): [number, number, number][] {
    const seen = new Set<string>([`${x},${y},${z}`]);
    const stack: [number, number, number][] = [[x, y, z]];
    const out: [number, number, number][] = [];
    while (stack.length) {
      const c = stack.pop()!;
      out.push(c);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const nx = c[0] + dx, ny = c[1] + dy, nz = c[2] + dz;
        const k = `${nx},${ny},${nz}`;
        if (seen.has(k) || this.world.get(nx, ny, nz) !== CHEST) continue;
        seen.add(k);
        stack.push([nx, ny, nz]);
      }
    }
    return out;
  }

  private static chestKey(cells: [number, number, number][]): string {
    return [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map((c) => c.join(",")).join(";");
  }

  private static chestDims(n: number): [number, number] {
    return n <= 3 ? [3 * n, 3] : [9, 3 + (n - 3)];
  }

  /** Put an existing slot (stack count and all) into a free spot of `target`; re-orients if needed. */
  private static placeSlotFree(target: Inventory, s: Slot): boolean {
    const d = ITEMS[s.itemId];
    const rots = d.w === d.h ? [!!s.rot] : [!!s.rot, !s.rot];
    for (const rot of rots) {
      const w = rot ? d.h : d.w, h = rot ? d.w : d.h;
      for (let y = 0; y + h <= target.h; y++) for (let x = 0; x + w <= target.w; x++) {
        if (target.fits(x, y, w, h)) {
          s.x = x; s.y = y; s.rot = rot || undefined;
          target.slots.push(s);
          return true;
        }
      }
    }
    return false;
  }

  private emptyChestGrid(n: number): Inventory {
    const ci = new Inventory();
    ci.slots = [];
    const [w, h] = Game.chestDims(n);
    ci.w = w; ci.h = h;
    ci.baseLimit = 1e9; // chests carry no weight limit
    return ci;
  }

  private openChest(x: number, y: number, z: number) {
    const cells = this.chestCluster(x, y, z);
    const key = Game.chestKey(cells);
    if (!this.chests.has(key)) this.chests.set(key, []);
    const ci = this.emptyChestGrid(cells.length);
    ci.slots = this.chests.get(key)!;
    this.chestInv = ci;
    this.gridFocus = "chest";
    this.ui = "inv";
    this.unlockPointer();
    this.audio.door();
    this.renderInv();
    document.getElementById("ui-inventory")!.classList.remove("hidden");
  }

  /** After placing a chest, fold every neighbouring cluster's contents into the new cluster. */
  private linkChests(bx: number, by: number, bz: number, old: Slot[]) {
    const cells = this.chestCluster(bx, by, bz);
    const ci = this.emptyChestGrid(cells.length);
    for (const sl of old) if (!Game.placeSlotFree(ci, sl)) this.dropEntity(sl.itemId, sl.count, 2);
    if (ci.slots.length) this.chests.set(Game.chestKey(cells), ci.slots);
    if (cells.length > 1) hud.toast(`Chests linked — one ${ci.w}×${ci.h} inventory.`);
  }

  private cacheColor(c: DeathCache): number { return c.kind === "chest" ? 0x8a6d3b : c.kind === "reward" ? 0xb08a3e : 0x6b5a44; }
  private cacheMeshPos(c: DeathCache): [number, number, number] {
    return [c.x, c.y + (c.kind === "chest" ? 0.36 : 0.5), c.z];
  }

  private restore(run: RunSave) {
    this.world.loadDeltas(run.deltas);
    this.player.pos.set(run.player.x, run.player.y, run.player.z);
    this.player.yaw = run.player.yaw; this.player.pitch = run.player.pitch;
    this.survival.health = run.survival.health;
    this.survival.water = run.survival.water;
    this.survival.body = run.survival.body;
    this.inv.slots = run.inventory.slots.map((s) => ({ ...s }));
    // Old saves may hold stacked slots; split them so every instance has its own footprint.
    const legacyStacks = this.inv.slots.filter((s) => s.count > 1);
    if (legacyStacks.length) {
      this.inv.slots = this.inv.slots.filter((s) => s.count === 1);
      for (const s of legacyStacks) this.giveOrDrop(s.itemId, s.count);
    }
    this.inv.selected = run.inventory.selected;
    if (run.inventory.w !== this.inv.w || run.inventory.h !== this.inv.h) {
      this.inv.w = run.inventory.w; this.inv.h = run.inventory.h;
      this.inv.baseLimit = 30; this.inv.bonusLimit = run.inventory.bonusLimit;
    } else this.inv.bonusLimit = run.inventory.bonusLimit;
    this.beaconMarks = run.beaconMarks ?? [];
    this.collected = new Set(run.collected ?? []);
    const collected = this.collected;
    let idx = 0;
    const fresh: typeof this.entities = [];
    this.world.gen.canisters.forEach((c) => {
      if (c.buried && !collected.has(idx)) {
        const gy = Math.round(heightAt(this.seed, c.x, c.z));
        fresh.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy, z: c.z + 0.5, itemId: "canister_full", count: 1, buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: idx });
      }
      idx++;
    });
    for (const e of run.entities) fresh.push({ id: this.entitySeq++, ...e });
    this.entities = fresh;
    for (const c of run.caches) {
      const cache: DeathCache = { id: this.entitySeq++, x: c.x, y: c.y, z: c.z, kind: c.kind ?? "death", items: c.items.map((i) => ({ ...i })) };
      this.caches.push(cache);
      if (cache.items.length) this.renderer.addEntityMesh(cache.id, this.cacheMeshPos(cache), this.cacheColor(cache), 0.7);
    }
    this.campCharges = new Map(Object.entries(run.campfires ?? {}).map(([k, v]) => [k, v]));
    this.chests = new Map((run.chests ?? []).map((c) => [c.cells, c.slots.map((s) => ({ ...s }))]));
    this.pods = (run.pods ?? []).map((p) => ({
      ...p,
      ringEid: this.renderer.addGroundRing(p.x + 0.5, Math.round(heightAt(this.seed, p.x, p.z)), p.z + 0.5, 0xcc3322, 1.1),
      beamEid: this.renderer.addBeam(p.x + 0.5, Math.round(heightAt(this.seed, p.x, p.z)), p.z + 0.5, 0xcc3322),
    }));
    this.won = !!run.won;
    // re-light lamps and campfires that live in the saved deltas
    for (const [k, m] of this.world.deltas) {
      const [cx, cz] = k.split(",").map(Number);
      for (const [i, id] of m) {
        if (id !== LAMP && id !== CAMPFIRE) continue;
        const lx = Math.floor(i / (CS * CH)), rem = i % (CS * CH);
        this.renderer.addPointLight(cx * CS + lx, rem % CH, cz * CS + Math.floor(rem / CH), id === LAMP ? "lamp" : "fire");
      }
    }
  }

  snapshot(): RunSave {
    return {
      v: 1,
      seedStr: this.meta.seedStr,
      time: this.timeSec, playSec: this.playSec,
      days: this.dayNumber(),
      player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw, pitch: this.player.pitch },
      survival: { health: this.survival.health, water: this.survival.water, body: this.survival.body },
      quest: { i: this.quests.i, p: this.quests.p.slice() },
      inventory: { slots: this.inv.slots.map((s) => ({ ...s })), selected: this.inv.selected, w: this.inv.w, h: this.inv.h, bonusLimit: this.inv.bonusLimit },
      beaconMarks: this.beaconMarks,
      collected: this.collectedCanisterIndices(),
      entities: this.entities.filter((e) => !e.buried).map((e) => ({ x: e.x, y: e.y, z: e.z, itemId: e.itemId, count: e.count })),
      pods: this.pods,
      won: this.won || undefined,
      caches: this.caches.map((c) => ({ x: c.x, y: c.y, z: c.z, kind: c.kind, items: c.items.map((i) => ({ ...i })) })),
      chests: [...this.chests].map(([cells, slots]) => ({ cells, slots: slots.map((s) => ({ ...s })) })),
      campfires: Object.fromEntries(this.campCharges),
      deltas: this.world.serializeDeltas(),
    };
  }

  private collectedCanisterIndices(): number[] {
    return [...this.collected];
  }

  get isGuest() { return this.meta.id.startsWith("guest"); }

  setClock(frac: number) {
    // cheat: jump to `frac` of the current in-game day (0 = midnight)
    const day = Math.floor(this.timeSec / DAY_SECONDS);
    this.timeSec = (day + frac) * DAY_SECONDS;
  }

  saveNow(manual = false): boolean {
    if (this.isGuest) {
      if (manual) hud.toast("Guest worlds are never saved.");
      return false;
    }
    const ok = saveRun(this.meta, this.snapshot());
    if (manual) hud.toast(ok ? "Game saved." : "Storage full — use Export World.");
    return ok;
  }

  exportWorld() { exportRun(this.meta, this.snapshot()); }

  // ---------- lifecycle ----------

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt, t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    for (const [ev, fn] of this.bound) removeEventListener(ev, fn as EventListener);
    this.bound.clear();
    document.getElementById("mobile")!.classList.add("hidden");
    this.renderer.dispose();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.renderer.renderDistance = s.renderDist;
    this.renderer.camera.fov = s.fov;
    this.renderer.camera.updateProjectionMatrix();
    this.renderer.setQuality(s.quality);
    this.audio.setVolume(s.volume);
    this.audio.setMusic(s.music);
    this.renderer.resetChunkMeshes();
    const pcx = Math.floor(this.player.pos.x / 16), pcz = Math.floor(this.player.pos.z / 16);
    this.renderer.ensureChunks(this.world, pcx, pcz);
  }

  dayNumber() { return 1 + Math.floor(this.timeSec / DAY_SECONDS); }

  // ---------- quests ----------

  private questBump(kind: QuestDef["kind"], n = 1) {
    const done = questEvent(this.quests, kind, n);
    if (!done) { if (kind === "mine") this.renderQuest(); return; }
    hud.toast(`Quest complete: ${done.title}`);
    if (done.reward) this.crashPod(done.reward.item, done.reward.n);
    this.audio.savePing();
    if (done.kind === "finish") this.win();
    this.renderQuest();
    this.saveNow(true);
  }

  // All quest rewards arrive as a Reward Cache: a warning, a red beacon marker
  // lights where it will land (landmark caches are already marked), and the crate
  // drops out of the sky (GLOSSARY: "All block-shaped quest rewards arrive as
  // Crash Pods" — the crate itself is a Cache).
  private crashPod(itemId: string, n: number) {
    const p = this.player.pos;
    const x = Math.round(p.x) + 2, z = Math.round(p.z) + 1;
    const gy = Math.round(heightAt(this.seed, x, z));
    const ringEid = this.renderer.addGroundRing(x + 0.5, gy, z + 0.5, 0xcc3322, 1.1);
    const beamEid = this.renderer.addBeam(x + 0.5, gy, z + 0.5, 0xcc3322);
    this.pods.push({ x, z, t: 3, itemId, n, ringEid, beamEid });
    this.audio.warn();
    setTimeout(() => { if (this.running) hud.toast(`⚠ Reward Cache inbound — follow the red marker.`); }, 1200);
  }

  private podFrame(dt: number) {
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const pd = this.pods[i];
      pd.t -= dt;
      if (pd.t > 0) continue;
      this.renderer.removeEntityMesh(pd.ringEid);
      this.renderer.removeEntityMesh(pd.beamEid);
      const gy = Math.round(heightAt(this.seed, pd.x, pd.z));
      this.caches.push({ id: this.entitySeq++, x: pd.x, y: gy, z: pd.z, kind: "reward", items: [{ itemId: pd.itemId, count: pd.n }] });
      this.renderer.addEntityMesh(this.caches[this.caches.length - 1].id, [pd.x, gy + 0.5, pd.z], this.cacheColor(this.caches[this.caches.length - 1]), 0.7);
      this.pods.splice(i, 1);
      this.audio.thud();
      hud.toast("Reward Cache landed — claim it with E.");
      this.saveNow(true);
    }
  }

  // The HUD guides the active quest: a compass heading + distance (hud.updateWaypoint)
  // and a waypoint beam at the target. With a Surveyor's Visor selected, every
  // Cache and chest cluster also gets a marker beam (items.ts: "while held the HUD
  // marks every Death Cache, Reward Cache and Supply Chest").
  private guideFrame(dt: number) {
    this.guideAcc += dt;
    if (this.guideAcc < 0.4) return;
    this.guideAcc = 0;
    const p = this.player.pos;

    const t = this.waypointTarget();
    if (t) {
      hud.updateWaypoint(t.name, t.x, t.z, p.x, p.z, this.player.yaw);
      const key = `${t.name}|${Math.floor(t.x)},${Math.floor(t.z)}`;
      if (key !== this.waypointKey) {
        if (this.waypointEid) { this.renderer.removeEntityMesh(this.waypointEid); this.waypointEid = 0; }
        this.waypointKey = key;
        this.waypointEid = this.renderer.addBeam(t.x, t.y, t.z, 0x35e0ff, 12);
      }
    } else {
      hud.updateWaypoint(null);
      if (this.waypointEid) { this.renderer.removeEntityMesh(this.waypointEid); this.waypointEid = 0; }
      this.waypointKey = "";
    }

    const want = new Map<string, [number, number, number, number]>();
    if (this.inv.selectedSlot()?.itemId === "visor") {
      for (const c of this.caches)
        if (c.items.length)
          want.set(`c${c.id}`, [c.x + 0.5, c.y, c.z + 0.5, c.kind === "chest" ? 0xe6c96a : c.kind === "reward" ? 0xd8a24a : 0xcc4433]);
      for (const key of this.chests.keys()) {
        const [x, y, z] = key.split(";")[0].split(",").map(Number);
        want.set(`x${key}`, [x + 0.5, y, z + 0.5, 0xe6c96a]);
      }
    }
    for (const [k, eid] of this.visorBeams)
      if (!want.has(k)) { this.renderer.removeEntityMesh(eid); this.visorBeams.delete(k); }
    for (const [k, [x, y, z, col]] of want)
      if (!this.visorBeams.has(k)) this.visorBeams.set(k, this.renderer.addBeam(x, y, z, col, 10));
  }

  private waypointTarget(): { name: string; x: number; y: number; z: number } | null {
    const q = currentQuest(this.quests);
    if (!q) return null;
    const p = this.player.pos;
    const ground = (x: number, z: number) => Math.round(heightAt(this.seed, x, z)) + 1;
    const nearest = <T extends { x: number; z: number }>(pts: T[]) => {
      let best = pts[0], bd = Infinity;
      for (const o of pts) { const d = (o.x - p.x) ** 2 + (o.z - p.z) ** 2; if (d < bd) { bd = d; best = o; } }
      return best;
    };
    switch (q.kind) {
      case "oasis": {
        const o = nearest(this.world.gen.oases);
        return o ? { name: "Oasis", x: o.x + 0.5, y: ground(o.x, o.z), z: o.z + 0.5 } : null;
      }
      case "water_home":
      case "finish": {
        const b = [...this.beaconMarks, { x: -4, y: 31, z: -1 }].reverse()
          .find((b) => this.world.get(b.x, b.y, b.z) === BEACON);
        return b ? { name: "Save Beacon", x: b.x + 0.5, y: b.y, z: b.z + 0.5 } : null;
      }
      case "wreck": {
        const s = this.world.gen.secondShip;
        return { name: "Second Wreck", x: s.x + 0.5, y: ground(s.x, s.z), z: s.z + 0.5 };
      }
      case "core": {
        const s = this.world.gen.secondShip;
        return { name: "Engine Core", x: s.x + 0.5, y: ground(s.x, s.z), z: s.z + 0.5 };
      }
      case "tool": {
        const cells: { x: number; y: number; z: number }[] = [];
        if (this.world.get(0, 31, -3) === BENCH) cells.push({ x: 0, y: 31, z: -3 });
        for (const [k, d] of this.world.deltas) {
          const [cx, cz] = k.split(",").map(Number);
          for (const [i, id] of d) {
            if (id !== BENCH) continue;
            const y = i % CH, z = Math.floor(i / CH) % CS, x = Math.floor(i / (CH * CS));
            cells.push({ x: cx * CS + x, y, z: cz * CS + z });
          }
        }
        if (!cells.length) return null;
        const b = nearest(cells);
        return { name: "Crafting Bench", x: b.x + 0.5, y: b.y, z: b.z + 0.5 };
      }
      default: return null; // sky / mine / day: nothing to point at
    }
  }

  private questFrame() {
    const q = currentQuest(this.quests);
    if (!q) return;
    const p = this.player.pos;
    if (q.kind === "sky" && this.survival.lastOpenSky) this.questBump("sky");
    else if (q.kind === "oasis" && this.world.gen.nearOasis(Math.floor(p.x), Math.floor(p.z))) this.questBump("oasis");
    else if (q.kind === "water_home" && this.inv.slots.some((s) => s.itemId === "canister_full") &&
      [...this.beaconMarks, { x: -4, y: 31, z: -1 }].some((b) =>
        this.world.get(b.x, b.y, b.z) === BEACON &&
        (b.x + 0.5 - p.x) ** 2 + (b.y + 1 - p.y) ** 2 + (b.z + 0.5 - p.z) ** 2 < 25)) this.questBump("water_home");
    else if (q.kind === "day" && this.dayNumber() >= 4) this.questBump("day");
    else if (q.kind === "wreck") {
      const s = this.world.gen.secondShip;
      if ((s.x + 0.5 - p.x) ** 2 + (s.z + 0.5 - p.z) ** 2 < 169) this.questBump("wreck");
    }
  }

  private renderQuest() {
    const el = document.getElementById("quest");
    if (!el) return;
    const q = currentQuest(this.quests);
    if (!q) {
      if (this.questShown !== "done") {
        this.questShown = "done";
        el.innerHTML = this.won
          ? `<div class="q-title">Main Quest complete</div><div class="q-desc">The beacon relay is live. Survive as long as you can while you wait for the rescue ship.</div>`
          : `<div class="q-title">All quests complete</div><div class="q-desc">Now just survive as long as you can.</div>`;
      }
      return;
    }
    const p = this.quests.p[this.quests.i];
    const key = q.id + ":" + p;
    if (key === this.questShown) return;
    this.questShown = key;
    el.innerHTML =
      `<div class="q-title">Quest · ${q.title}${q.goal > 1 ? ` (${p}/${q.goal})` : ""}</div>` +
      `<div class="q-desc">${q.desc}</div>` +
      (q.goal > 1 ? `<div class="q-bar"><i style="width:${(p / q.goal) * 100}%"></i></div>` : "");
  }

  // ---------- input ----------

  private attach() {
    const on = (ev: string, fn: (e: Event) => void, target: EventTarget = window) => {
      target.addEventListener(ev, fn as EventListener);
      this.bound.set(ev + (target === window ? "" : ":el"), fn);
    };

    on("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (ke.repeat) return;
      this.keys.add(ke.code);
      if (ke.code === "KeyE") this.act();
      if (ke.code === "KeyQ") this.drink();
      if (ke.code === "KeyX") this.surge();
      if (ke.code === "KeyI") this.toggleInv();
      if (ke.code === "KeyR" && this.ui === "inv") {
        if (this.temp) {
          this.temp.rot = !this.temp.rot; // temp is off-grid: always free to rotate
          this.audio.place();
        } else {
          const tgt = this.gridFocus === "chest" && this.chestInv ? this.chestInv : this.inv;
          const s = tgt.selectedSlot();
          if (s && !tgt.rotate(s)) { hud.toast("No room to rotate."); this.audio.error(); }
        }
        this.renderInv();
      }
      if (ke.code === "Escape") this.escape();
      if (ke.code === "KeyP") this.escape(true);
      if (ke.code.startsWith("Digit")) {
        const n = Number(ke.code.slice(5));
        if (n >= 1 && n <= 9 && this.inv.slots[n - 1]) { this.inv.selected = n - 1; this.renderHeld(); }
      }
    });
    on("keyup", (e) => this.keys.delete((e as KeyboardEvent).code));
    document.getElementById("surge-btn")!.onclick = () => this.surge();

    const canvas = this.renderer.canvasEl();
    if (!this.mobile) {
      on("click", () => { if (!this.paused && !this.ui) this.requestLock(); }, canvas);
      on("mousedown", (e) => {
        const me = e as MouseEvent;
        if (me.button === 0) { this.mouseDown = true; this.breakMsg = false; }
        else if (me.button === 2) this.place(); // pointer lock suppresses contextmenu: place on the click itself
      });
      on("mouseup", () => { this.mouseDown = false; this.breaking = null; });
      on("mousemove", (e) => {
        if (document.pointerLockElement !== canvas || this.ui) return;
        const me = e as MouseEvent;
        this.player.yaw -= me.movementX * 0.0022 * this.settings.sens;
        this.player.pitch -= (this.settings.invertY ? -1 : 1) * me.movementY * 0.0022 * this.settings.sens;
        this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.55, 1.55);
      });
      on("wheel", (e) => { this.inv.cycle((e as WheelEvent).deltaY > 0 ? 1 : -1); this.renderHeld(); });
      on("contextmenu", (e) => e.preventDefault());
    } else {
      // One designated finger drives the camera; any additional touch (including
      // a stray near the stick) is ignored — two fingers never fight over yaw.
      let camId = -1, lookX = 0, lookY = 0;
      canvas.addEventListener("touchstart", (e) => {
        if (camId < 0) {
          const t = e.changedTouches[0];
          camId = t.identifier; lookX = t.clientX; lookY = t.clientY;
        }
        e.preventDefault();
      });
      canvas.addEventListener("touchmove", (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== camId) continue;
          this.player.yaw -= (t.clientX - lookX) * 0.005 * this.settings.sens;
          this.player.pitch -= (this.settings.invertY ? -1 : 1) * (t.clientY - lookY) * 0.005 * this.settings.sens;
          this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.55, 1.55);
          lookX = t.clientX; lookY = t.clientY;
        }
        e.preventDefault();
      });
      const camEnd = (e: TouchEvent) => { for (const t of e.changedTouches) if (t.identifier === camId) camId = -1; };
      canvas.addEventListener("touchend", camEnd);
      canvas.addEventListener("touchcancel", camEnd);
      document.addEventListener("contextmenu", (e) => e.preventDefault()); // long-press must not cancel holds
      // virtual stick
      const stick = document.getElementById("stick")!;
      const knob = document.getElementById("knob")!;
      let stickId = -1;
      const stickUpdate = (e: TouchEvent) => {
        const r = stick.getBoundingClientRect();
        for (const t of e.changedTouches) if (t.identifier === stickId) {
          const dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
          const len = Math.max(1, Math.hypot(dx, dy)), cap = Math.min(len, r.width / 2) / (r.width / 2);
          this.stick.x = (dx / len) * cap; this.stick.y = (dy / len) * cap;
          knob.style.left = 38 + (dx / len) * cap * 38 + "px";
          knob.style.top = 38 + (dy / len) * cap * 38 + "px";
        }
      };
      stick.addEventListener("touchstart", (e) => { stickId = e.changedTouches[0].identifier; stickUpdate(e); e.preventDefault(); });
      stick.addEventListener("touchmove", (e) => { stickUpdate(e); e.preventDefault(); });
      const stickEnd = () => { this.stick.x = 0; this.stick.y = 0; stickId = -1; knob.style.left = "38px"; knob.style.top = "38px"; };
      stick.addEventListener("touchend", stickEnd);
      stick.addEventListener("touchcancel", stickEnd);
      // Press fires; release only ends holds (jump, break). Momentary buttons
      // never fire twice.
      const mb = (id: string, down: () => void, up?: () => void) => {
        const el = document.getElementById(id)!;
        el.addEventListener("touchstart", (e) => { e.preventDefault(); down(); });
        el.addEventListener("touchend", (e) => { e.preventDefault(); if (up) up(); });
        el.addEventListener("touchcancel", () => { if (up) up(); });
      };
      mb("m-jump", () => this.mobileJump = true, () => this.mobileJump = false);
      mb("m-break", () => this.mouseDown = true, () => { this.mouseDown = false; this.breaking = null; });
      mb("m-place", () => this.place());
      mb("m-act", () => this.act());
      mb("m-drink", () => this.drink());
      mb("m-surge", () => this.surge());
      mb("m-next", () => { this.inv.cycle(1); this.renderHeld(); });
      mb("m-inv", () => this.toggleInv());
      mb("m-pause", () => this.escape());
    }
    on("beforeunload", () => this.saveNow());
    // Browsers swallow the Escape keydown while pointer-locked (it exits the lock),
    // so losing the lock without UI open *is* the first Escape press: pause.
    on("pointerlockchange", () => {
      if (document.pointerLockElement) { this.lockAt = performance.now(); return; }
      // Lock acquired and lost again within a breath is menu-close flapping
      // (re-request racing the browser), not an Escape press: don't pause.
      if (this.running && !this.paused && !this.ui && !this.f1Paused
        && performance.now() - this.escAt > 400 && performance.now() - this.lockAt > 900) {
        this.paused = true;
        document.getElementById("screen-pause")!.classList.remove("hidden");
      }
    }, document);
    // Switching tabs pauses the game too - but only when no other menu is open.
    on("visibilitychange", () => {
      if (!document.hidden || !this.running || this.paused || this.ui || this.f1Paused) return;
      const vis = (id: string) => !document.getElementById(id)!.classList.contains("hidden");
      if (vis("screen-settings") || vis("screen-instructions") || vis("screen-death") || vis("screen-win")) return;
      this.paused = true;
      document.getElementById("screen-pause")!.classList.remove("hidden");
    }, document);
  }

  // Pause-menu submenus (Settings, Catalog): closing them returns to the pause
  // menu with the mouse still free — the pointer is only re-grabbed on the way
  // out of the pause menu itself.
  pauseSubmenu: "settings" | "catalog" | null = null;

  closePauseSubmenu() {
    if (!this.pauseSubmenu) return;
    document.getElementById(this.pauseSubmenu === "settings" ? "screen-settings" : "screen-catalog")!
      .classList.add("hidden");
    this.pauseSubmenu = null;
    if (this.paused) document.getElementById("screen-pause")!.classList.remove("hidden");
  }

  private escape(fromP = false) {
    // Escape's browser default can release a pointer lock we re-acquire while
    // closing a menu; that spurious lock-loss must not open the pause screen.
    this.escAt = performance.now();
    if (this.pauseSubmenu) { this.closePauseSubmenu(); return; }
    if (this.ui) { this.closeUI(); return; }
    const hidden = (id: string) => document.getElementById(id)!.classList.contains("hidden");
    // Settings / death / win own their own dismissal buttons; Esc must not pause behind them.
    if (!hidden("screen-settings") || !hidden("screen-death") || !hidden("screen-win")) return;
    if (!hidden("screen-instructions")) {
      document.getElementById("screen-instructions")!.classList.add("hidden");
      if (this.f1Paused) { this.paused = false; this.f1Paused = false; this.relock(); }
      else if (this.paused) {
        this.paused = false;
        document.getElementById("screen-pause")!.classList.add("hidden");
        this.relock();
      }
      return;
    }
    // the only Esc that leaves fullscreen: one pressed while the pause menu is up
    if (!fromP && this.paused && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    this.paused = !this.paused;
    document.getElementById("screen-pause")!.classList.toggle("hidden", !this.paused);
    if (this.paused) { if (document.pointerLockElement) document.exitPointerLock(); }
    else if (fromP) this.relock();
  }

  // ---------- pointer lock ----------
  // every overlay (pause / inventory / bench / cache / F1) must release the
  // mouse; closing one on a user gesture re-acquires it.

  requestLock() {
    // fullscreen-on means fullscreen whenever the mouse is grabbed; outside a user
    // gesture the browser rejects this, which is fine — the next gesture re-applies it
    if (this.settings.fullscreen && !document.fullscreenElement)
      void document.documentElement.requestFullscreen().catch(() => {});
    const p = this.renderer.canvasEl().requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => { /* browser cooldown: canvas click re-locks */ });
  }

  private unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }

  relock() { if (!this.paused && !this.ui && !document.pointerLockElement) this.requestLock(); }

  // ---------- frame ----------

  private frame(dt: number, now: number) {
    if (this.paused) { this.renderer.render(); return; }
    this.timeSec += dt;
    this.playSec += dt;

    const pcx = Math.floor(this.player.pos.x / 16), pcz = Math.floor(this.player.pos.z / 16);
    this.renderer.ensureChunks(this.world, pcx, pcz);
    this.renderer.rebuildDirty(this.world);

    const kf = this.renderer.updateSky(this.timeSec, this.player.pos);
    const biome = biomeAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z), this.seed);
    const overencumbered = this.inv.weight() > this.inv.weightLimit();

    if (!this.ui) {
      let mx = this.stick.x, mz = -this.stick.y;
      if (this.keys.has("KeyW")) mz += 1;
      if (this.keys.has("KeyS")) mz -= 1;
      if (this.keys.has("KeyA")) mx -= 1;
      if (this.keys.has("KeyD")) mx += 1;
      const jump = this.keys.has("Space") || this.mobileJump;
      this.player.sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      this.player.update(dt, mx, mz, jump, this.speedMul, overencumbered);
      this.survival.update(dt, this.world, this.player.pos, {
        sprinting: this.player.sprinting && (mx !== 0 || mz !== 0),
        overencumbered, biome, tSec: this.timeSec, sunElev: kf.sunElev, inWater: this.player.inWater,
      });
      this.updateBreaking(dt);
      this.updatePickups();
    }
    this.audio.heartbeat(dt, this.survival.health);

    const cam = this.renderer.camera;
    cam.position.copy(this.player.eye());
    cam.rotation.order = "YXZ";
    cam.rotation.set(this.player.pitch, this.player.yaw, 0);

    const target = this.raycastTarget();
    this.renderer.setHighlight(this.ui ? null : (target?.hit ?? null));
    hud.setPrompt(this.ui ? null : this.promptFor(target));
    hud.setSubmerged(this.player.headUnder);

    for (const e of this.entities) {
      if (e.fall !== undefined) {
        const step = Math.min(e.fall, 14 * dt);
        e.y -= step; e.fall -= step;
        if (e.fall <= 0.001) { e.fall = undefined; this.audio.thud(); }
        this.renderer.moveEntityMesh(e.id, [e.x, e.y, e.z]);
      }
      const mesh = this.renderer.entityMesh(e.id);
      if (e.buried && e.buriedAt && this.world.get(e.buriedAt[0], e.buriedAt[1], e.buriedAt[2]) !== AIR) {
        if (mesh) this.renderer.removeEntityMesh(e.id);
      } else if (!mesh) {
        this.renderer.addEntityMesh(e.id, [e.x, e.y, e.z], parseInt(ITEMS[e.itemId].color.slice(1), 16));
      }
    }
    for (const c of this.caches) {
      const mesh = this.renderer.entityMesh(c.id);
      if (!mesh && c.items.length) {
        this.renderer.addEntityMesh(c.id, this.cacheMeshPos(c), this.cacheColor(c), 0.7);
        // every Cache is findable from far: a ground ring in its kind colour
        c.markerEid = this.renderer.addGroundRing(c.x + 0.5, c.y, c.z + 0.5,
          c.kind === "chest" ? 0xe6c96a : c.kind === "reward" ? 0xd8a24a : 0xcc3322, 1.4);
      } else if (mesh && !c.items.length) {
        this.renderer.removeEntityMesh(c.id);
        if (c.markerEid !== undefined) { this.renderer.removeEntityMesh(c.markerEid); c.markerEid = undefined; }
      }
    }
    this.regulatorGlow();
    const surgeCool = this.survival.surgeCooldown > 0;
    for (const id of ["surge-btn", "m-surge"]) {
      const b = document.getElementById(id) as HTMLButtonElement | null;
      if (b && b.disabled !== surgeCool) b.disabled = surgeCool;
    }

    hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, now);
    this.podFrame(dt);
    this.questFrame();
    this.guideFrame(dt);
    this.audio.setDay(kf.sunElev > 0);

    this.autosaveAcc += dt;
    if (this.autosaveAcc > 30) { this.autosaveAcc = 0; this.saveNow(); }

    if (this.survival.health <= 0 && this.running) this.die();
    this.renderer.render();
  }

  // ---------- targeting / interaction ----------

  raycastTarget(): Raycast | null {
    const o = this.player.eye();
    const dir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(dir);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const step = new THREE.Vector3(Math.sign(dir.x), Math.sign(dir.y), Math.sign(dir.z));
    const tDelta = new THREE.Vector3(dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity, dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity, dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity);
    const dist = (v: number, s: number) => s > 0 ? Math.ceil(v) - v : s < 0 ? v - Math.floor(v) : Infinity;
    const tMax = new THREE.Vector3(dist(o.x, step.x) * tDelta.x, dist(o.y, step.y) * tDelta.y, dist(o.z, step.z) * tDelta.z);
    let prev = new THREE.Vector3(x, y, z);
    let water: { x: number; y: number; z: number } | null = null;
    for (let i = 0; i < 80; i++) {
      const id = this.world.get(x, y, z);
      if (id === WATER && !water) water = { x, y, z };
      else if (id !== AIR && id !== WATER) return { hit: { x, y, z }, water, face: new THREE.Vector3(prev.x - x, prev.y - y, prev.z - z) };
      prev.set(x, y, z);
      if (tMax.x < tMax.y && tMax.x < tMax.z) { x += step.x; tMax.x += tDelta.x; }
      else if (tMax.y < tMax.z) { y += step.y; tMax.y += tDelta.y; }
      else { z += step.z; tMax.z += tDelta.z; }
      if (new THREE.Vector3(x - o.x, y - o.y, z - o.z).length() > 5.5) break;
    }
    return { hit: null, water, face: new THREE.Vector3(0, 0, 0) };
  }

  private promptFor(t: Raycast | null): string | null {
    if (!t) return null;
    if (t.hit && this.world.get(t.hit.x, t.hit.y, t.hit.z) === CHEST) return "E: Open Supply Chest";
    const near = this.nearestCache();
    if (near) return near.kind === "chest" ? "E: Open supply chest" : near.kind === "reward" ? "E: Claim Reward Cache" : "E: Open death cache";
    if (t.hit) {
      const id = this.world.get(t.hit.x, t.hit.y, t.hit.z);
      if (id === DOOR_CLOSED || id === DOOR_UPPER) return "E: Open door";
      if (id === DOOR_OPEN) return "E: Close door";
      if (id === BEACON) return "E: Save game (respawn point)";
      if (id === BENCH || id === BENCH_EXT) return "E: Craft";
      if (id === CAMPFIRE) return "E: Smelt";
    }
    if (t.water) return "E: Refill canister";
    return null;
  }

  private nearestCache(): DeathCache | null {
    for (const c of this.caches)
      if (c.items.length && this.player.pos.distanceTo(new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5)) < 2.4) return c;
    return null;
  }

  private canBreakWith(id: number): { ok: boolean; time: number; why?: string } {
    const def = BLOCKS[id];
    if (def.breakTime <= 0) return { ok: false, time: 0, why: "cannot break" };
    const slot = this.inv.selectedSlot();
    const tool = slot ? ITEMS[slot.itemId].tool : undefined;
    if (def.tool !== null) {
      if (!tool || tool.type !== def.tool) return { ok: false, time: 0, why: `need a ${def.tool}` };
      if (tool.tier < def.minTier) return { ok: false, time: 0, why: `need a tier ${def.minTier} ${def.tool}` };
      return { ok: true, time: def.breakTime * Math.pow(0.55, tool.tier - 1) };
    }
    return { ok: true, time: def.breakTime * (def.fastTool && tool && tool.type === def.fastTool ? Math.pow(0.55, tool.tier) : 1) };
  }

  private showBreakBar(frac: number | null) {
    const bar = document.getElementById("breakbar")!;
    if (frac === null) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    (document.getElementById("breakfill") as HTMLElement).style.width = (frac * 100) + "%";
  }

  private updateBreaking(dt: number) {
    if (!this.mouseDown) { this.breaking = null; this.showBreakBar(null); return; }
    const t = this.raycastTarget();
    if (!t?.hit) { this.breaking = null; this.showBreakBar(null); return; }
    const { x, y, z } = t.hit;
    const id = this.world.get(x, y, z);
    if (!this.breaking || this.breaking.x !== x || this.breaking.y !== y || this.breaking.z !== z) {
      const cb = this.canBreakWith(id);
      if (!cb.ok) {
        if (cb.why && !this.breakMsg) {
          this.breakMsg = true;
          hud.toast(cb.why === "cannot break" ? "That cannot be broken." : `You can't mine that — ${cb.why}.`);
          this.audio.error();
        }
        this.breaking = null; this.showBreakBar(null); return;
      }
      this.breaking = { x, y, z, need: cb.time, elapsed: 0 };
    }
    this.breaking.elapsed += dt;
    this.audioTickAcc += dt;
    if (this.audioTickAcc > 0.25) { this.audioTickAcc = 0; this.audio.tick(); }
    this.showBreakBar(this.breaking.elapsed / this.breaking.need);
    if (this.breaking.elapsed >= this.breaking.need) {
      this.breakBlock(x, y, z);
      this.breaking = null;
      this.showBreakBar(null);
    }
  }

  private breakBlock(x: number, y: number, z: number) {
    const id = this.world.get(x, y, z);
    this.questBump("mine");
    if (isDoorHalf(id) || id === DOOR_OPEN) {
      this.world.set(x, y, z, AIR);
      for (const dy of [-1, 1]) {
        const n = this.world.get(x, y + dy, z);
        if (isDoorHalf(n) || n === DOOR_OPEN) this.world.set(x, y + dy, z, AIR);
      }
      this.giveOrDrop("door", 1);
      this.audio.blockBreak();
      return;
    }
    if (id === BEACON) {
      this.world.set(x, y, z, AIR);
      this.beaconMarks = this.beaconMarks.filter((b) => !(b.x === x && b.y === y && b.z === z));
      hud.toast("Save beacon destroyed. Respawn falls back to the newest intact beacon.");
      this.audio.blockBreak();
      return;
    }
    if (id === CAMPFIRE) this.campCharges.delete(`${x},${y},${z}`);
    if (id === CHEST) {
      // breaking one chest of a linked cluster: the grid shrinks; contents that
      // no longer fit spill onto the sand. The chest block itself drops too.
      const cells = this.chestCluster(x, y, z);
      const old = this.chests.get(Game.chestKey(cells)) ?? [];
      this.chests.delete(Game.chestKey(cells));
      this.world.set(x, y, z, AIR);
      const rest = cells.filter(([cx, cy, cz]) => cx !== x || cy !== y || cz !== z);
      const groups: [string, Inventory][] = [];
      for (const c of rest) {
        const g = this.chestCluster(c[0], c[1], c[2]);
        const k = Game.chestKey(g);
        if (groups.some(([gk]) => gk === k)) continue;
        groups.push([k, this.emptyChestGrid(g.length)]);
      }
      let spilled = false;
      for (const sl of old) {
        if (!groups.some(([, gi]) => Game.placeSlotFree(gi, sl))) { this.dropEntity(sl.itemId, sl.count, 2); spilled = true; }
      }
      for (const [k, gi] of groups) if (gi.slots.length) this.chests.set(k, gi.slots);
      this.giveOrDrop("chest", 1);
      this.audio.blockBreak();
      if (spilled) hud.toast("The remaining chests were full — some contents fell to the sand.");
      return;
    }
    if (id === ENGINECORE) {
      this.world.set(x, y, z, AIR);
      this.giveOrDrop("engine_core", 1);
      this.questBump("core");
      this.audio.blockBreak();
      return;
    }
    if (id === BENCH || id === BENCH_EXT) {
      const peer = this.benchPeer(x, y, z);
      this.world.set(x, y, z, AIR);
      if (peer) this.world.set(peer[0], peer[1], peer[2], AIR);
      this.giveOrDrop("bench", 1);
      this.audio.blockBreak();
      return;
    }
    if (id === LAMP || id === CAMPFIRE) this.renderer.removePointLight(x, y, z);
    this.world.set(x, y, z, AIR);
    const item = this.blockItemId(id);
    if (item) this.giveOrDrop(item, 1);
    this.audio.blockBreak();
  }

  /** The other half of a two-block Crafting Bench, or null. */
  private benchPeer(x: number, y: number, z: number): [number, number, number] | null {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const id = this.world.get(x + dx, y, z + dz);
      if (id === BENCH || id === BENCH_EXT) return [x + dx, y, z + dz];
    }
    return null;
  }

  private blockItemId(id: number): string | null {
    const map: Record<number, string> = {
      1: "sand", 2: "sandstone", 3: "rock", 4: "gravel", 5: "dirt", 6: "salt", 7: "deadwood",
      8: "glass", 9: "insglass", 10: "hull", 11: "door", 13: "lamp", 14: "metal", 16: "bench",
      17: "campfire", 19: "adobe", 21: "engine_core", 22: "regulator", 23: "chest", 24: "bench",
    };
    return map[id] ?? null;
  }

  giveOrDrop(itemId: string, count: number) {
    const left = this.inv.addItem(itemId, count);
    if (left > 0) {
      this.dropEntity(itemId, left);
      hud.toast(`No room: dropped ${ITEMS[itemId].name}`);
    }
  }

  /** Drop items in front of the player; if that lands inside geometry, try other
   *  sides, then the feet. Manual drops get a short auto-pickup cooldown. */
  private dropEntity(itemId: string, count: number, cooldown = 0) {
    const p = this.player.pos;
    const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
    const clear = (dx: number, dz: number) => {
      const bx = Math.floor(p.x + dx), bz = Math.floor(p.z + dz);
      return !isSolid(this.world.get(bx, Math.floor(p.y), bz)) && !isSolid(this.world.get(bx, Math.floor(p.y + 1), bz));
    };
    const cands: [number, number][] = [
      [fx * 1.8, fz * 1.8], [-fx * 1.8, -fz * 1.8], [fz * 1.8, -fx * 1.8], [-fz * 1.8, fx * 1.8], [0, 0],
    ];
    const [dx, dz] = cands.find(([ax, az]) => clear(ax, az)) ?? [0, 0];
    this.entities.push({
      id: this.entitySeq++, x: p.x + dx, y: p.y + 0.35, z: p.z + dz, itemId, count,
      repickAt: dx === 0 && dz === 0 ? this.timeSec + Math.max(cooldown, 2.5) : this.timeSec + cooldown,
    });
  }

  private place() {
    if (this.ui || this.paused) return;
    const slot = this.inv.selectedSlot();
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (def.block === undefined) { hud.toast("Not a placeable block"); this.audio.error(); return; }
    const t = this.raycastTarget();
    if (!t?.hit) return;
    const bx = t.hit.x + t.face.x, by = t.hit.y + t.face.y, bz = t.hit.z + t.face.z;
    if (this.world.get(bx, by, bz) !== AIR) return;
    if (isSolid(def.block)) {
      // refuse placing a solid block inside the player
      const p = this.player.pos;
      if (bx + 1 > p.x - 0.3 && bx < p.x + 0.3 && bz + 1 > p.z - 0.3 && bz < p.z + 0.3 && by + 1 > p.y && by < p.y + 1.8) return;
    }
    // a chest placed against existing chests merges the inventories up front
    let chestOld: Slot[] = [];
    if (def.block === CHEST) {
      const done = new Set<string>();
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        if (this.world.get(bx + dx, by + dy, bz + dz) !== CHEST) continue;
        const k = Game.chestKey(this.chestCluster(bx + dx, by + dy, bz + dz));
        if (done.has(k)) continue;
        done.add(k);
        chestOld.push(...(this.chests.get(k) ?? []));
        this.chests.delete(k);
      }
    }
    // the Crafting Bench stands two blocks wide: it needs an open neighbour
    let benchPeer: [number, number, number] | null = null;
    if (def.block === BENCH) {
      const p = this.player.pos;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = bx + dx, nz = bz + dz;
        if (this.world.get(nx, by, nz) !== AIR) continue;
        if (nx + 1 > p.x - 0.3 && nx < p.x + 0.3 && nz + 1 > p.z - 0.3 && nz < p.z + 0.3 && by + 1 > p.y && by < p.y + 1.8) continue;
        benchPeer = [nx, by, nz];
        break;
      }
      if (!benchPeer) { hud.toast("The Crafting Bench needs an open block beside it."); this.audio.error(); return; }
    }
    this.world.set(bx, by, bz, def.block);
    if (benchPeer) this.world.set(benchPeer[0], benchPeer[1], benchPeer[2], BENCH_EXT);
    if (def.block === DOOR_CLOSED && this.world.get(bx, by + 1, bz) === AIR) this.world.set(bx, by + 1, bz, DOOR_UPPER);
    if (def.block === ENGINECORE) {
      const q = currentQuest(this.quests);
      if (q && q.kind === "finish") {
        const near = [...this.beaconMarks, { x: -4, y: 31, z: -1 }].some((b) =>
          this.world.get(b.x, b.y, b.z) === BEACON && (b.x + 0.5 - bx) ** 2 + (b.z + 0.5 - bz) ** 2 < 100);
        if (near) this.questBump("finish");
        else hud.toast("Too far from a Save Beacon — the relay needs the Core within 10 m.");
      }
    }
    if (def.block === LAMP) this.renderer.addPointLight(bx, by, bz, "lamp");
    else if (def.block === CAMPFIRE) this.renderer.addPointLight(bx, by, bz, "fire");
    if (def.block === CHEST) this.linkChests(bx, by, bz, chestOld);
    slot.count -= 1;
    if (slot.count <= 0) this.inv.slots.splice(this.inv.selected, 1);
    this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
    this.renderHeld();
    this.audio.place();
  }

  private act() {
    if (this.ui || this.paused) return;
    const t = this.raycastTarget();
    if (t?.hit && this.world.get(t.hit.x, t.hit.y, t.hit.z) === CHEST) { this.openChest(t.hit.x, t.hit.y, t.hit.z); return; }
    const cache = this.nearestCache();
    if (cache) { this.openCacheId = cache.id; this.ui = "cache"; this.unlockPointer(); this.renderCache(); document.getElementById("ui-cache")!.classList.remove("hidden"); return; }
    if (!t) return;
    if (t.hit) {
      const { x, y, z } = t.hit;
      const id = this.world.get(x, y, z);
      if (isDoorHalf(id) || id === DOOR_OPEN) {
        if (id === DOOR_OPEN) {
          // a door must never close on the player standing in the doorway
          const p = this.player.pos;
          if (p.x > x - 0.2 && p.x < x + 1.2 && p.z > z - 0.2 && p.z < z + 1.2) {
            hud.toast("Step out of the doorway first.");
            this.audio.error();
            return;
          }
          // rebuild the pair with correct halves: the open block below marks us as the top
          if (this.world.get(x, y - 1, z) === DOOR_OPEN) {
            this.world.set(x, y, z, DOOR_UPPER);
            this.world.set(x, y - 1, z, DOOR_CLOSED);
          } else if (this.world.get(x, y + 1, z) === DOOR_OPEN) {
            this.world.set(x, y, z, DOOR_CLOSED);
            this.world.set(x, y + 1, z, DOOR_UPPER);
          } else {
            // lone open half — its neighbor tells us which half we are
            this.world.set(x, y, z, isDoorHalf(this.world.get(x, y + 1, z)) ? DOOR_UPPER : DOOR_CLOSED);
          }
        } else {
          // push-door: the leaf swings away from whoever opens it
          const wallAlongX = isSolid(this.world.get(x - 1, y, z)) || isSolid(this.world.get(x + 1, y, z));
          const p = this.player.pos;
          const off = wallAlongX ? p.z - (z + 0.5) : p.x - (x + 0.5);
          const k = x + "," + z;
          if (Math.abs(off) > 0.35) this.world.doorSwing.set(k, (off > 0 ? -1 : 1) as 1 | -1);
          else this.world.doorSwing.delete(k);
          this.world.set(x, y, z, DOOR_OPEN);
          for (const dy of [-1, 1]) if (isDoorHalf(this.world.get(x, y + dy, z))) this.world.set(x, y + dy, z, DOOR_OPEN);
        }
        this.audio.door();
        return;
      }
      if (id === BEACON) {
        if (!this.beaconMarks.some((b) => b.x === x && b.y === y && b.z === z)) this.beaconMarks.push({ x, y, z });
        this.audio.savePing();
        if (this.saveNow()) hud.toast("Saved. Death will respawn you at this beacon.");
        else hud.toast("This world is not saved — the beacon only marks it.");
        return;
      }
      if (id === BENCH || id === BENCH_EXT) { this.openStation = [x, y, z]; this.ui = "bench"; this.unlockPointer(); this.renderCraft("bench"); return; }
      if (id === CAMPFIRE) { this.openStation = [x, y, z]; this.ui = "smelt"; this.unlockPointer(); this.renderCraft("smelt"); return; }
    }
    if (t.water) {
      if (this.inv.has("canister_empty")) {
        this.inv.removeItem("canister_empty", 1);
        this.giveOrDrop("canister_full", 1);
        this.audio.drink();
        hud.toast(this.world.gen.nearOasis(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z))
          ? "Canister refilled at the oasis."
          : "Canister refilled from the ship's water tank.");
      } else hud.toast("You need an empty Water Canister.");
    }
  }

  private drink() {
    if (this.ui || this.paused) return;
    if (!this.inv.has("canister_full")) { hud.toast("No full Water Canister."); this.audio.error(); return; }
    this.inv.removeItem("canister_full", 1);
    const before = this.survival.body;
    this.survival.drink();
    if (this.survival.body < before - 0.4) hud.toast("Cold water slides down your throat — your body cools.");
    this.inv.addItem("canister_empty", 1);
    this.audio.drink();
    this.renderHeld();
  }

  private surge() {
    if (this.ui || this.paused) return;
    const r = this.survival.surge();
    if (r === "thirsty") { hud.toast("You need at least 20 water to sweat-surge."); this.audio.error(); return; }
    if (r === "cooling") { hud.toast("Your body is still cooling — wait a moment."); this.audio.error(); return; }
    hud.toast("You force yourself to sweat — evaporation cools your skin. (-15 water)");
    this.audio.drink();
  }

  // Heat Regulators light up while they are actively holding their sealed room at neutral.
  private regulatorGlow() {
    const tick = Math.floor(this.timeSec * 2); // resampled twice a second
    if (tick === this.regTick) return;
    this.regTick = tick;
    const p = this.player.pos;
    const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
    let room = this.world.roomInfo(fx, fy, fz);
    if (room.size === 0) {
      // standing in a doorway or wall cell — borrow the nearest room, like Survival does
      outer: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const r2 = this.world.roomInfo(fx + dx, fy + dy, fz + dz);
        if (r2.size > 0) { room = r2; break outer; }
      }
    }
    const active = room.sealed && room.regulators > 0 && room.regulators * REGULATOR_ROOM_MAX >= room.size;
    const want = new Set(active ? room.regCells : []);
    for (const [key, eid] of this.regGlow) {
      if (want.has(key)) continue;
      this.renderer.removeEntityMesh(eid);
      const [x, y, z] = key.split(",").map(Number);
      this.renderer.removePointLight(x, y, z);
      this.regGlow.delete(key);
    }
    for (const key of want) {
      if (this.regGlow.has(key)) continue;
      const [x, y, z] = key.split(",").map(Number);
      if (!this.regGlowMat) this.regGlowMat = new THREE.MeshLambertMaterial({ color: 0x8fd8ff, emissive: 0x8fd8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.38, depthWrite: false });
      const eid = this.entitySeq++;
      const m = this.renderer.addEntityMesh(eid, [x + 0.5, y + 0.5, z + 0.5], 0x8fd8ff, 1.03);
      m.material = this.regGlowMat!;
      this.renderer.addPointLight(x, y, z, "cool");
      this.regGlow.set(key, eid);
    }
  }

  private updatePickups() {
    const p = this.player.pos;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.buried && e.buriedAt && this.world.get(e.buriedAt[0], e.buriedAt[1], e.buriedAt[2]) !== AIR) continue;
      if (e.repickAt !== undefined) { if (this.timeSec < e.repickAt) continue; e.repickAt = undefined; }
      if (p.distanceTo(new THREE.Vector3(e.x, e.y, e.z)) < 1.3) {
        const left = this.inv.addItem(e.itemId, e.count);
        if (left === 0) {
          if (e.srcIndex !== undefined) this.collected.add(e.srcIndex);
          this.entities.splice(i, 1);
          this.renderer.removeEntityMesh(e.id);
          this.audio.pickup();
        } else e.count = left;
      }
    }
  }

  // ---------- victory ----------

  private win() {
    if (this.won) return;
    this.won = true;
    submitBest(this.scoreDays());
    this.audio.win();
    this.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("screen-win")!.classList.remove("hidden");
    document.getElementById("win-stats")!.textContent =
      `Main Quest complete. Survived ${this.scoreDays().toFixed(1)} days. Best: ${bestScore().toFixed(1)} days. The beacon relay is live — rescuers are on their way.`;
  }

  // ---------- death / respawn ----------

  private die() {
    if (this.caches.some((c) => Math.abs(c.x - this.player.pos.x) < 0.5)) return;
    this.deathCause = this.survival.causeOfDeath ?? "exposure";
    this.audio.death();
    this.caches.push({
      id: this.entitySeq++,
      x: Math.floor(this.player.pos.x), y: Math.floor(this.player.pos.y), z: Math.floor(this.player.pos.z),
      kind: "death",
      items: this.inv.slots.map((s) => ({ itemId: s.itemId, count: s.count })),
    });
    this.inv.slots = []; this.inv.selected = 0;
    submitBest(this.scoreDays());
    this.survival.health = 0; // stay dead until respawn button
    this.running = true;
    this.paused = true;
    document.getElementById("screen-death")!.classList.remove("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("death-cause")!.textContent = `Cause: ${this.deathCause}.`;
    document.getElementById("death-stats")!.textContent =
      `Survived ${this.scoreDays().toFixed(1)} days in this run. Best: ${bestScore().toFixed(1)} days. Your belongings wait in a Death Cache where you fell.`;
    this.saveNow();
    if (this.onDeathCb) this.onDeathCb();
  }

  scoreDays() { return this.playSec / DAY_SECONDS; }

  respawn() {
    document.getElementById("screen-death")!.classList.add("hidden");
    this.paused = false;
    this.survival.reset();
    const beacon = [...this.beaconMarks].reverse()
      .find((b) => this.world.get(b.x, b.y, b.z) === BEACON);
    if (beacon) this.player.pos.set(beacon.x + 0.5, beacon.y + 1.01, beacon.z + 0.5);
    else this.player.pos.set(0.5, 31.01, 0.5);
    this.player.vel.set(0, 0, 0);
    this.saveNow();
  }

  // ---------- UI panels ----------

  toggleInv() {
    if (this.ui === "inv") this.closeUI();
    else if (!this.paused) { this.unlockPointer(); this.ui = "inv"; this.renderInv(); document.getElementById("ui-inventory")!.classList.remove("hidden"); }
  }

  closeUI() {
    if (this.ui === "inv" && this.temp) {
      hud.toast("Temporary storage is occupied — place or drop the item first.");
      this.audio.error();
      return;
    }
    this.ui = null; this.openStation = null; this.openCacheId = null;
    this.chestInv = null; this.gridFocus = "inv";
    for (const id of ["ui-inventory", "ui-craft", "ui-cache"]) document.getElementById(id)!.classList.add("hidden");
    // closing any in-game menu also drops the pause menu, if one was open
    if (this.paused) {
      this.paused = false;
      document.getElementById("screen-pause")!.classList.add("hidden");
    }
    this.relock();
  }

  private renderHeld() { hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, performance.now()); }

  // inventory grid metrics (keep in sync with .invcell size in styles.css)
  private static readonly CELL = 64;
  private static readonly GAP = 6;
  // item currently lifted out of the grid ("temporary storage")
  temp: Slot | null = null;

  renderInv() {
    this.renderGrid(this.inv, document.getElementById("inv-grid")!);
    const cs = document.getElementById("chest-section")!;
    if (this.chestInv) {
      cs.classList.remove("hidden");
      document.getElementById("chest-info")!.textContent = `(${this.chestInv.w}×${this.chestInv.h})`;
      this.renderGrid(this.chestInv, document.getElementById("chest-grid")!);
    } else cs.classList.add("hidden");

    // temporary storage: the slot an item sits in while being moved
    const tempEl = document.getElementById("inv-temp")!;
    tempEl.innerHTML = "";
    const dropTemp = document.getElementById("btn-drop-temp")!;
    if (this.temp) {
      const d = ITEMS[this.temp.itemId];
      tempEl.classList.add("filled");
      tempEl.style.background = d.color;
      tempEl.style.backgroundImage = `url(${itemTiles(this.temp.itemId)[0] ?? ""})`;
      tempEl.textContent = this.temp.count > 1 ? `${this.temp.count}` : "";
      tempEl.onmousedown = (e) => this.startTempDrag(e);
      dropTemp.textContent = `Drop ${this.temp.count > 1 ? this.temp.count + "× " : ""}${d.name}`;
      dropTemp.onclick = () => {
        if (!this.temp) return;
        this.dropEntity(this.temp.itemId, this.temp.count, 1);
        this.temp = null;
        this.audio.place();
        this.renderInv();
      };
    } else {
      tempEl.classList.remove("filled");
      tempEl.style.background = "";
      tempEl.style.backgroundImage = "";
      tempEl.textContent = "";
      tempEl.onmousedown = null;
      dropTemp.onclick = null;
    }
    dropTemp.classList.toggle("hidden", !this.temp);

    // rebuild the side panel from scratch every render (accumulating text/buttons bug)
    const side = document.getElementById("inv-side")!;
    const fInv = this.gridFocus === "chest" && this.chestInv ? this.chestInv : this.inv;
    const sel = fInv.selectedSlot();
    const shown = this.temp ?? sel;
    const kg = this.inv.weight() + (this.temp ? ITEMS[this.temp.itemId].mass * this.temp.count : 0);
    const lim = this.inv.weightLimit();
    const dims = shown ? slotDims(shown) : null;
    side.textContent = shown
      ? `${ITEMS[shown.itemId].name} — ${ITEMS[shown.itemId].desc}`
      : "Click an item to inspect it; drag to move it.";
    side.textContent += ` Weight ${kg.toFixed(1)} / ${lim} kg`;
    if (shown && dims && dims.w !== dims.h) {
      const rotBtn = document.createElement("button");
      rotBtn.textContent = "Rotate";
      rotBtn.onclick = () => {
        if (this.temp) this.temp.rot = !this.temp.rot;
        else if (!fInv.rotate(sel!)) { hud.toast("No room to rotate."); this.audio.error(); }
        this.renderInv();
      };
      side.appendChild(rotBtn);
    }
    if (sel && sel.itemId === "backpack1") {
      const useBtn = document.createElement("button");
      useBtn.textContent = "Wear backpack";
      useBtn.onclick = () => {
        fInv.removeItem("backpack1", 1);
        this.inv.setBackpack(4, 5, 20);
        hud.toast("Backpack I equipped: grid 4×5, +20 kg.");
        this.renderInv();
      };
      side.appendChild(useBtn);
    } else if (sel) {
      if (fInv === this.chestInv) {
        const packBtn = document.createElement("button");
        packBtn.textContent = "Move to pack";
        packBtn.onclick = () => {
          const i = fInv.slots.indexOf(sel);
          fInv.slots.splice(i, 1);
          if (!Game.placeSlotFree(this.inv, sel)) {
            fInv.slots.splice(i, 0, sel); // it would not fit — contents stay put
            hud.toast("No room in your pack.");
            this.audio.error();
          }
          this.renderInv();
        };
        side.appendChild(packBtn);
      } else {
        const useBtn = document.createElement("button");
        useBtn.textContent = "Drop 1";
        useBtn.onclick = () => {
          this.inv.removeItem(sel.itemId, 1);
          this.dropEntity(sel.itemId, 1, 1);
          this.renderInv();
        };
        side.appendChild(useBtn);
      }
    }
  }

  /** Render one Inventory Grid (backpack or linked-chest cluster) into a container element. */
  private renderGrid(inv: Inventory, grid: HTMLElement) {
    const CELL = Game.CELL;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${inv.w}, ${CELL}px)`;
    const at = (x: number, y: number) => inv.slots.find((s) => {
      const d = slotDims(s);
      return x >= s.x && x < s.x + d.w && y >= s.y && y < s.y + d.h;
    });
    for (let y = 0; y < inv.h; y++) for (let x = 0; x < inv.w; x++) {
      const cell = document.createElement("div");
      cell.className = "invcell";
      const s = at(x, y);
      if (s) {
        const d = ITEMS[s.itemId];
        const dx = x - s.x, dy = y - s.y;
        // the art is one picture across the whole footprint: pick this cell's slice
        const tiles = itemTiles(s.itemId);
        const idx = s.rot ? (d.h - 1 - dx) * d.w + dy : dy * d.w + dx;
        cell.style.background = d.color;
        cell.style.backgroundImage = `url(${tiles[Math.min(idx, tiles.length - 1)] ?? ""})`;
        if (s.count > 1 && dx === 0 && dy === 0) {
          const ic = document.createElement("div");
          ic.className = "icon";
          ic.textContent = `${s.count}`;
          cell.appendChild(ic);
        }
        const si = inv.slots.indexOf(s);
        if (si === inv.selected) cell.classList.add("active");
        cell.onmouseenter = () => { document.getElementById("inv-side")!.textContent = `${d.name} — ${d.desc}`; };
        cell.onmousedown = (e) => this.startInvDrag(e, s, inv);
      }
      grid.appendChild(cell);
    }
  }

  private startInvDrag(e: MouseEvent, s: Slot, src: Inventory) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Shift-click: quick-move — into the open chest if one is up, otherwise lift
    // the item into temporary storage with no drag.
    if (e.shiftKey) { this.shiftMove(s, src); return; }
    // Lift the item into temporary storage; it lands where the mouse is released,
    // or stays in temporary storage if dropped anywhere else.
    const si = src.slots.indexOf(s);
    src.selected = si;
    src.slots.splice(si, 1);
    const prev = this.temp;
    this.temp = s;
    if (prev) {
      // dragging another item back swaps it into the vacated cell
      src.slots.push(prev);
      if (!src.move(prev, s.x, s.y)) this.giveOrDrop(prev.itemId, prev.count);
    }
    const STEP = Game.CELL + Game.GAP;
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - Game.GAP + "px";
    ghost.style.height = d.h * STEP - Game.GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    ghost.style.backgroundImage = `url(${itemArtUrl(s.itemId, s.rot ? 1 : 0)})`;
    document.body.appendChild(ghost);
    const rect = (src === this.inv ? document.getElementById("inv-grid") : document.getElementById("chest-grid"))!.getBoundingClientRect();
    const D = { gx: e.clientX - (rect.left + s.x * STEP), gy: e.clientY - (rect.top + s.y * STEP) };
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - D.gx + "px";
      ghost.style.top = ev.clientY - D.gy + "px";
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      const dd = slotDims(s);
      let target: Inventory | null = null, ax = 0, ay = 0;
      for (const [el, inv] of this.gridsEls()) {
        const r = el.getBoundingClientRect();
        ax = Math.round((ev.clientX - r.left - D.gx) / STEP);
        ay = Math.round((ev.clientY - r.top - D.gy) / STEP);
        if (ax >= 0 && ay >= 0 && ax <= inv.w - dd.w && ay <= inv.h - dd.h) { target = inv; break; }
      }
      if (target) {
        target.slots.push(s);
        if (target.move(s, ax, ay) || (target === src && target.move(s, s.x, s.y))) {
          this.temp = null;
          this.audio.place();
          // selection follows the moved instance, not its old index
          target.selected = target.slots.indexOf(s);
        } else target.slots.splice(target.slots.indexOf(s), 1);
      }
      // else: the item rests in temporary storage until placed or dropped
      this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
      this.renderInv();
      this.renderHeld();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    move(e);
  }

  /** Shift-click quick-move: pack ⇄ open chest; with no chest open, lift the
   *  item into temporary storage (a lifted item swaps into the vacated cell). */
  private shiftMove(s: Slot, src: Inventory) {
    const target = this.chestInv
      ? (src === this.inv ? this.chestInv : src === this.chestInv ? this.inv : null)
      : null;
    if (target) {
      const i = src.slots.indexOf(s);
      src.slots.splice(i, 1);
      if (!Game.placeSlotFree(target, s)) {
        src.slots.splice(i, 0, s); // it would not fit — contents stay put
        hud.toast(src === this.inv ? "No room in the chest." : "No room in your pack.");
        this.audio.error();
        this.renderInv();
        return;
      }
      this.audio.place();
      this.renderInv();
      this.renderHeld();
      return;
    }
    const si = src.slots.indexOf(s);
    src.selected = si;
    src.slots.splice(si, 1);
    const prev = this.temp;
    this.temp = s;
    if (prev) {
      src.slots.push(prev);
      if (!src.move(prev, s.x, s.y)) this.giveOrDrop(prev.itemId, prev.count);
    }
    this.renderInv();
    this.renderHeld();
  }

  private gridsEls(): [HTMLElement, Inventory][] {
    const els: [HTMLElement, Inventory][] = [[document.getElementById("inv-grid")!, this.inv]];
    if (this.chestInv) els.push([document.getElementById("chest-grid")!, this.chestInv]);
    return els;
  }

  /** Drag the item out of temporary storage back onto a grid, anchored at the cursor. */
  private startTempDrag(e: MouseEvent) {
    if (e.button !== 0 || !this.temp) return;
    e.preventDefault();
    const s = this.temp;
    const STEP = Game.CELL + Game.GAP;
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - Game.GAP + "px";
    ghost.style.height = d.h * STEP - Game.GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    ghost.style.backgroundImage = `url(${itemArtUrl(s.itemId, s.rot ? 1 : 0)})`;
    document.body.appendChild(ghost);
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - d.w * STEP / 2 + "px";
      ghost.style.top = ev.clientY - d.h * STEP / 2 + "px";
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      const hw = (d.w * STEP - Game.GAP) / 2, hh = (d.h * STEP - Game.GAP) / 2;
      let target: Inventory | null = null, ax = 0, ay = 0;
      for (const [el, inv] of this.gridsEls()) {
        const r = el.getBoundingClientRect();
        ax = Math.round((ev.clientX - r.left - hw) / STEP);
        ay = Math.round((ev.clientY - r.top - hh) / STEP);
        if (ax >= 0 && ay >= 0 && ax <= inv.w - d.w && ay <= inv.h - d.h) { target = inv; break; }
      }
      if (target) {
        target.slots.push(s);
        if (target.move(s, ax, ay)) {
          this.temp = null;
          this.audio.place();
          target.selected = target.slots.indexOf(s);
          if (target === this.inv) this.inv.selected = target.selected;
        } else {
          target.slots.splice(target.slots.indexOf(s), 1);
          this.audio.error();
        }
      }
      this.renderInv();
      this.renderHeld();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    move(e);
  }

  renderCraft(mode: "bench" | "smelt") {
    document.getElementById("ui-craft")!.classList.remove("hidden");
    document.getElementById("craft-title")!.textContent = mode === "bench" ? "Crafting Bench" : "Campfire Smelting";
    const list = document.getElementById("craft-list")!;
    list.innerHTML = "";
    const smeltUi = document.getElementById("smelt-ui")!;
    smeltUi.classList.toggle("hidden", mode !== "smelt");
    if (mode === "bench") {
      for (const r of RECIPES) {
        const row = document.createElement("div");
        row.className = "craft-row";
        const label = `${ITEMS[r.out].name}${r.count > 1 ? " ×" + r.count : ""}`;
        const needs = Object.entries(r.needs).map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(", ");
        const ok = canCraft(this.inv, r);
        row.innerHTML = `<span class="what"><img class="craft-art" src="${itemArtUrl(r.out)}" alt="">${label} <span class="needs">(${needs})</span></span>`;
        const b = document.createElement("button");
        b.textContent = "Craft";
        b.disabled = !ok;
        b.onclick = () => {
          const left = doCraft(this.inv, r);
          if (left === null) { this.audio.error(); return; }
          if (left > 0) this.giveOrDrop(r.out, left);
          if (ITEMS[r.out]?.tool) this.questBump("tool");
          this.audio.place();
          this.renderCraft("bench");
        };
        row.appendChild(b);
        list.appendChild(row);
      }
    } else {
      const pos = this.openStation!;
      const key = `${pos[0]},${pos[1]},${pos[2]}`;
      const fuel = this.campCharges.get(key) ?? 0;
      document.getElementById("smelt-fuel")!.textContent = `${fuel} charges`;
      document.getElementById("btn-addfuel")!.onclick = () => {
        if (!this.inv.has("deadwood", 1)) { hud.toast("No Dead Wood to burn."); this.audio.error(); return; }
        this.inv.removeItem("deadwood", 1);
        this.campCharges.set(key, fuel + 3);
        this.renderCraft("smelt");
      };
      for (const s of SMELT) {
        const row = document.createElement("div");
        row.className = "craft-row";
        row.innerHTML = `<span class="what"><img class="craft-art" src="${itemArtUrl(s.out)}" alt="">${ITEMS[s.in].name} → ${ITEMS[s.out].name} <span class="needs">(1 fuel charge)</span></span>`;
        const b = document.createElement("button");
        b.textContent = "Smelt";
        b.disabled = !this.inv.has(s.in, 1) || fuel < 1;
        b.onclick = () => {
          this.inv.removeItem(s.in, 1);
          this.campCharges.set(key, fuel - 1);
          const left = this.inv.addItem(s.out, 1);
          if (left > 0) this.giveOrDrop(s.out, left);
          this.audio.place();
          this.renderCraft("smelt");
        };
        row.appendChild(b);
        list.appendChild(row);
      }
    }
  }

  renderCache() {
    const cache = this.caches.find((c) => c.id === this.openCacheId);
    document.getElementById("cache-title")!.textContent =
      cache?.kind === "chest" ? "Supply Chest — take what you need"
        : cache?.kind === "reward" ? "Reward Cache — claim your quest reward"
        : "Death Cache — take your belongings";
    const list = document.getElementById("cache-list")!;
    list.innerHTML = "";
    if (!cache || !cache.items.length) { this.closeUI(); return; }
    for (const it of cache.items) {
      const div = document.createElement("div");
      div.className = "cache-item";
      div.textContent = `${it.count}× ${ITEMS[it.itemId].name}`;
      list.appendChild(div);
    }
    const take = document.createElement("button");
    take.textContent = "Take everything";
    take.onclick = () => {
      let moved = true;
      while (moved) {
        moved = false;
        for (const it of cache.items) {
          const left = this.inv.addItem(it.itemId, it.count);
          if (left < it.count) { moved = true; it.count = left; }
          if (left === 0) cache.items.splice(cache.items.indexOf(it), 1);
        }
      }
      if (!cache.items.length) this.renderer.removeEntityMesh(cache.id);
      this.renderCache();
      if (!cache.items.length) this.closeUI();
    };
    list.appendChild(take);
  }
}
