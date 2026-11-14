import * as THREE from "three";
import { World } from "./world";
import { Player } from "./player";
import { Survival } from "./survival";
import { Renderer } from "./renderer";
import { Audio } from "./audio";
import { Inventory, ITEMS, slotDims, type Slot } from "./items";
import { BLOCKS, AIR, WATER, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, BEACON, BENCH, CAMPFIRE, LAMP, ENGINECORE, CS, CH, DAY_SECONDS, isSolid } from "./blocks";
import { hashStr, Rng } from "./noise";
import { heightAt, biomeAt } from "./gen";
import { RECIPES, SMELT, canCraft, doCraft } from "./crafting";
import { currentQuest, loadQuestState, questEvent, type QuestDef, type QuestState } from "./quests";
import { WorldMeta, RunSave, saveRun, exportRun, bestScore, submitBest, Settings } from "./save";
import * as hud from "./hud";

const isDoorHalf = (i: number) => i === DOOR_CLOSED || i === DOOR_UPPER;

export interface DroppedItem {
  id: number; x: number; y: number; z: number; itemId: string; count: number;
  buried?: boolean; buriedAt?: [number, number, number]; srcIndex?: number; fall?: number;
  repickAt?: number; // game time before which auto-pickup is suppressed (manual drops)
}
export interface DeathCache { id: number; x: number; y: number; z: number; items: { itemId: string; count: number }[] }
export interface Raycast { hit: { x: number; y: number; z: number } | null; water: { x: number; y: number; z: number } | null; face: THREE.Vector3 }

const GRAVITY_DROP_Y = 0.45;

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
  campCharges = new Map<string, number>();
  beaconMarks: { x: number; y: number; z: number }[] = [];
  collected = new Set<number>();
  running = false;
  paused = false;
  f1Paused = false;
  ui: null | "inv" | "bench" | "smelt" | "cache" = null;
  openCacheId: number | null = null;
  openStation: [number, number, number] | null = null;
  private breaking: { x: number; y: number; z: number; need: number; elapsed: number } | null = null;
  private mouseDown = false;
  private breakMsg = false;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private mobile = matchMedia("(pointer: coarse)").matches;
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
  private pods: { x: number; z: number; t: number; itemId: string; n: number }[] = [];
  won = false;

  constructor(public meta: WorldMeta, run: RunSave | null, parent: HTMLElement, private settings: Settings, private audio: Audio) {
    this.seed = hashStr(meta.seedStr || meta.id);
    this.world = new World(this.seed);
    this.survival = new Survival(this.seed ^ 7);
    this.quests = loadQuestState(run?.quest);
    this.renderer = new Renderer(parent);
    this.player = new Player(this.world);
    this.timeSec = run?.time ?? DAY_SECONDS * 0.3;
    this.playSec = run?.playSec ?? 0;

    if (run) this.restore(run);
    else this.spawnStarterEntities();
    // the wreck's ceiling lamps are worldgen (not deltas): light them explicitly
    if (this.world.get(-6, 35, 0) === LAMP) this.renderer.addPointLight(-6, 35, 0, "lamp");
    if (this.world.get(6, 35, 0) === LAMP) this.renderer.addPointLight(6, 35, 0, "lamp");

    hud.initBars();
    this.renderQuest();
    this.attach();
    if (this.mobile) document.getElementById("mobile")!.classList.remove("hidden");
    this.applySettings(settings);
  }

  // ---------- setup / persistence ----------

  private spawnStarterEntities() {
    const r = new Rng(this.seed);
    this.world.gen.canisters.forEach((c, i) => {
      const gy = Math.round(heightAt(this.seed, c.x, c.z));
      this.entities.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy + (c.buried ? 0 : GRAVITY_DROP_Y), z: c.z + 0.5, itemId: "canister_full", count: 1, buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: i });
    });
    // two canisters inside the wreck
    this.entities.push({ id: this.entitySeq++, x: -9, y: 31.45, z: -4, itemId: "canister_full", count: 1 });
    this.entities.push({ id: this.entitySeq++, x: 5, y: 31.45, z: 4, itemId: "canister_full", count: 1 });
    // catalyst loot in towns (2 each) and the second wreck (2)
    for (const t of this.world.gen.towns)
      for (const [dx, dz] of [[1, 1], [2, -2]])
        this.entities.push({ id: this.entitySeq++, x: t.x + dx + 0.5, y: Math.round(heightAt(this.seed, t.x + dx, t.z + dz)) + GRAVITY_DROP_Y, z: t.z + dz + 0.5, itemId: "catalyst", count: 1 });
    for (const [dx, dz] of [[2, 0], [-2, 1]])
      this.entities.push({ id: this.entitySeq++, x: this.world.gen.secondShip.x + dx + 0.5, y: Math.round(heightAt(this.seed, this.world.gen.secondShip.x + dx, this.world.gen.secondShip.z + dz)) + GRAVITY_DROP_Y, z: this.world.gen.secondShip.z + dz + 0.5, itemId: "catalyst", count: 1 });
    void r;
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
      if (!collected.has(idx)) {
        const gy = Math.round(heightAt(this.seed, c.x, c.z));
        fresh.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy + (c.buried ? 0 : GRAVITY_DROP_Y), z: c.z + 0.5, itemId: "canister_full", count: 1, buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: idx });
      }
      idx++;
    });
    for (const e of run.entities) fresh.push({ id: this.entitySeq++, ...e });
    this.entities = fresh;
    for (const c of run.caches) {
      const cache: DeathCache = { id: this.entitySeq++, x: c.x, y: c.y, z: c.z, items: c.items.map((i) => ({ ...i })) };
      this.caches.push(cache);
      if (cache.items.length) this.renderer.addEntityMesh(cache.id, [cache.x, cache.y + 0.5, cache.z], 0x6b5a44, 0.7);
    }
    this.campCharges = new Map(Object.entries(run.campfires ?? {}).map(([k, v]) => [k, v]));
    this.pods = (run.pods ?? []).map((p) => ({ ...p }));
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
      caches: this.caches.map((c) => ({ x: c.x, y: c.y, z: c.z, items: c.items.map((i) => ({ ...i })) })),
      campfires: Object.fromEntries(this.campCharges),
      deltas: this.world.serializeDeltas(),
    };
  }

  private collectedCanisterIndices(): number[] {
    return [...this.collected];
  }

  saveNow(manual = false): boolean {
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

  // All quest rewards arrive as Crash Pods: a warning, then the crate falls from
  // the sky next to the player (GLOSSARY: "All block-shaped quest rewards arrive
  // as Crash Pods").
  private crashPod(itemId: string, n: number) {
    const p = this.player.pos;
    this.pods.push({ x: Math.round(p.x) + 2, z: Math.round(p.z) + 1, t: 3, itemId, n });
    this.audio.warn();
    setTimeout(() => { if (this.running) hud.toast(`⚠ Crash pod inbound — look up.`); }, 1200);
  }

  private podFrame(dt: number) {
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const pd = this.pods[i];
      pd.t -= dt;
      if (pd.t > 0) continue;
      const gy = Math.round(heightAt(this.seed, pd.x, pd.z));
      this.entities.push({
        id: this.entitySeq++, x: pd.x + 0.5, y: gy + 10, z: pd.z + 0.5,
        itemId: pd.itemId, count: pd.n, fall: 10 - GRAVITY_DROP_Y,
      });
      this.pods.splice(i, 1);
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
      if (ke.code === "KeyI") this.toggleInv();
      if (ke.code === "KeyR" && this.ui === "inv") {
        const s = this.inv.selectedSlot();
        if (s && !this.inv.rotate(s)) { hud.toast("No room to rotate."); this.audio.error(); }
        this.renderInv();
      }
      if (ke.code === "Escape") this.escape();
      if (ke.code.startsWith("Digit")) {
        const n = Number(ke.code.slice(5));
        if (n >= 1 && n <= 9 && this.inv.slots[n - 1]) { this.inv.selected = n - 1; this.renderHeld(); }
      }
    });
    on("keyup", (e) => this.keys.delete((e as KeyboardEvent).code));

    const canvas = this.renderer.canvasEl();
    if (!this.mobile) {
      on("click", () => { if (!this.paused && !this.ui) void canvas.requestPointerLock(); }, canvas);
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
      let lookX = 0, lookY = 0;
      canvas.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        lookX = t.clientX; lookY = t.clientY;
        e.preventDefault();
      });
      canvas.addEventListener("touchmove", (e) => {
        const t = e.changedTouches[0];
        this.player.yaw -= (t.clientX - lookX) * 0.005 * this.settings.sens;
        this.player.pitch -= (this.settings.invertY ? -1 : 1) * (t.clientY - lookY) * 0.005 * this.settings.sens;
        this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.55, 1.55);
        lookX = t.clientX; lookY = t.clientY;
        e.preventDefault();
      });
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
      const mb = (id: string, down: () => void, up?: () => void) => {
        const el = document.getElementById(id)!;
        el.addEventListener("touchstart", (e) => { e.preventDefault(); down(); });
        el.addEventListener("touchend", (e) => { e.preventDefault(); (up ?? down)(); });
      };
      mb("m-jump", () => this.mobileJump = true, () => this.mobileJump = false);
      mb("m-break", () => this.mouseDown = true, () => { this.mouseDown = false; this.breaking = null; });
      mb("m-place", () => this.place());
      mb("m-act", () => this.act());
      mb("m-drink", () => this.drink());
      mb("m-next", () => { this.inv.cycle(1); this.renderHeld(); });
      mb("m-inv", () => this.toggleInv());
    }
    on("beforeunload", () => this.saveNow());
    // Browsers swallow the Escape keydown while pointer-locked (it exits the lock),
    // so losing the lock without UI open *is* the first Escape press: pause.
    on("pointerlockchange", () => {
      if (!document.pointerLockElement && this.running && !this.paused && !this.ui && !this.f1Paused) {
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

  private escape() {
    if (this.ui) { this.closeUI(); return; }
    const hidden = (id: string) => document.getElementById(id)!.classList.contains("hidden");
    // Settings / death / win own their own dismissal buttons; Esc must not pause behind them.
    if (!hidden("screen-settings") || !hidden("screen-death") || !hidden("screen-win")) return;
    if (!hidden("screen-instructions")) {
      document.getElementById("screen-instructions")!.classList.add("hidden");
      if (this.f1Paused) { this.paused = false; this.f1Paused = false; this.relock(); }
      return;
    }
    this.paused = !this.paused;
    document.getElementById("screen-pause")!.classList.toggle("hidden", !this.paused);
    if (this.paused && document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- pointer lock ----------
  // every overlay (pause / inventory / bench / cache / F1) must release the
  // mouse; closing one on a user gesture re-acquires it.

  requestLock() {
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
      this.player.update(dt, mx, mz, jump, 1, overencumbered);
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
      if (!mesh && c.items.length) this.renderer.addEntityMesh(c.id, [c.x, c.y + 0.5, c.z], 0x6b5a44, 0.7);
    }

    hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, now);
    this.podFrame(dt);
    this.questFrame();

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
    const near = this.nearestCache();
    if (near) return "E: Open death cache";
    if (t.hit) {
      const id = this.world.get(t.hit.x, t.hit.y, t.hit.z);
      if (id === DOOR_CLOSED || id === DOOR_UPPER) return "E: Open door";
      if (id === DOOR_OPEN) return "E: Close door";
      if (id === BEACON) return "E: Save game (respawn point)";
      if (id === BENCH) return "E: Craft";
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
    if (id === ENGINECORE) {
      this.world.set(x, y, z, AIR);
      this.giveOrDrop("engine_core", 1);
      this.questBump("core");
      this.audio.blockBreak();
      return;
    }
    if (id === LAMP || id === CAMPFIRE) this.renderer.removePointLight(x, y, z);
    this.world.set(x, y, z, AIR);
    const item = this.blockItemId(id);
    if (item) this.giveOrDrop(item, 1);
    this.audio.blockBreak();
  }

  private blockItemId(id: number): string | null {
    const map: Record<number, string> = {
      1: "sand", 2: "sandstone", 3: "rock", 4: "gravel", 5: "dirt", 6: "salt", 7: "deadwood",
      8: "glass", 9: "insglass", 10: "hull", 11: "door", 13: "lamp", 14: "metal", 16: "bench",
      17: "campfire", 19: "adobe", 21: "engine_core",
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
    this.world.set(bx, by, bz, def.block);
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
    slot.count -= 1;
    if (slot.count <= 0) this.inv.slots.splice(this.inv.selected, 1);
    this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
    this.renderHeld();
    this.audio.place();
  }

  private act() {
    if (this.ui || this.paused) return;
    const cache = this.nearestCache();
    if (cache) { this.openCacheId = cache.id; this.ui = "cache"; this.unlockPointer(); this.renderCache(); document.getElementById("ui-cache")!.classList.remove("hidden"); return; }
    const t = this.raycastTarget();
    if (!t) return;
    if (t.hit) {
      const { x, y, z } = t.hit;
      const id = this.world.get(x, y, z);
      if (isDoorHalf(id) || id === DOOR_OPEN) {
        if (id === DOOR_OPEN) {
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
          this.world.set(x, y, z, DOOR_OPEN);
          for (const dy of [-1, 1]) if (isDoorHalf(this.world.get(x, y + dy, z))) this.world.set(x, y + dy, z, DOOR_OPEN);
        }
        this.audio.door();
        return;
      }
      if (id === BEACON) {
        if (!this.beaconMarks.some((b) => b.x === x && b.y === y && b.z === z)) this.beaconMarks.push({ x, y, z });
        this.audio.savePing();
        this.saveNow(true);
        hud.toast("Saved. Death will respawn you at this beacon.");
        return;
      }
      if (id === BENCH) { this.openStation = [x, y, z]; this.ui = "bench"; this.unlockPointer(); this.renderCraft("bench"); return; }
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
    for (const id of ["ui-inventory", "ui-craft", "ui-cache"]) document.getElementById(id)!.classList.add("hidden");
    this.relock();
  }

  private renderHeld() { hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, performance.now()); }

  // inventory grid metrics (keep in sync with .invcell size in styles.css)
  private static readonly CELL = 64;
  private static readonly GAP = 6;
  // item currently lifted out of the grid ("temporary storage")
  temp: Slot | null = null;

  renderInv() {
    const CELL = Game.CELL;
    const grid = document.getElementById("inv-grid")!;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${this.inv.w}, ${CELL}px)`;
    const at = (x: number, y: number) => this.inv.slots.find((s) => {
      const d = slotDims(s);
      return x >= s.x && x < s.x + d.w && y >= s.y && y < s.y + d.h;
    });
    for (let y = 0; y < this.inv.h; y++) for (let x = 0; x < this.inv.w; x++) {
      const cell = document.createElement("div");
      cell.className = "invcell";
      const s = at(x, y);
      if (s) {
        const d = ITEMS[s.itemId];
        cell.style.background = d.color;
        if (s.x === x && s.y === y) {
          const ic = document.createElement("div");
          ic.className = "icon";
          ic.textContent = d.name.split(" ")[0].slice(0, 6);
          cell.appendChild(ic);
        }
        const si = this.inv.slots.indexOf(s);
        if (si === this.inv.selected) cell.classList.add("active");
        cell.onmouseenter = () => { document.getElementById("inv-side")!.textContent = `${d.name} — ${d.desc}`; };
        cell.onmousedown = (e) => this.startInvDrag(e, s);
      }
      grid.appendChild(cell);
    }

    // temporary storage: the slot an item sits in while being moved
    const tempEl = document.getElementById("inv-temp")!;
    tempEl.innerHTML = "";
    const dropTemp = document.getElementById("btn-drop-temp")!;
    if (this.temp) {
      const d = ITEMS[this.temp.itemId];
      tempEl.classList.add("filled");
      tempEl.style.background = d.color;
      tempEl.textContent = d.name.split(" ")[0].slice(0, 6);
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
      tempEl.onmousedown = null;
      dropTemp.onclick = null;
    }
    dropTemp.classList.toggle("hidden", !this.temp);

    const side = document.getElementById("inv-side")!;
    const kg = this.inv.weight() + (this.temp ? ITEMS[this.temp.itemId].mass * this.temp.count : 0);
    const lim = this.inv.weightLimit();
    side.textContent += `   Weight ${kg.toFixed(1)} / ${lim} kg`;
    const sel = this.inv.selectedSlot();
    if (sel) {
      const dims = slotDims(sel);
      if (dims.w !== dims.h) {
        const rotBtn = document.createElement("button");
        rotBtn.textContent = "Rotate";
        rotBtn.onclick = () => {
          if (!this.inv.rotate(sel)) { hud.toast("No room to rotate."); this.audio.error(); }
          this.renderInv();
        };
        side.appendChild(rotBtn);
      }
      const useBtn = document.createElement("button");
      if (sel.itemId === "backpack1") {
        useBtn.textContent = "Wear backpack";
        useBtn.onclick = () => {
          this.inv.removeItem("backpack1", 1);
          this.inv.setBackpack(3, 4, 20);
          hud.toast("Backpack I equipped: grid 3×4, +20 kg.");
          this.renderInv();
        };
      } else {
        useBtn.textContent = "Drop 1";
        useBtn.onclick = () => {
          this.inv.removeItem(sel.itemId, 1);
          this.dropEntity(sel.itemId, 1, 1);
          this.renderInv();
        };
      }
      side.appendChild(useBtn);
    }
  }

  private startInvDrag(e: MouseEvent, s: Slot) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Lift the item into temporary storage; it lands where the mouse is released,
    // or stays in temporary storage if dropped anywhere else.
    const si = this.inv.slots.indexOf(s);
    this.inv.selected = si;
    this.inv.slots.splice(si, 1);
    const prev = this.temp;
    this.temp = s;
    if (prev) {
      // dragging another item back swaps it into the vacated cell
      this.inv.slots.push(prev);
      if (!this.inv.move(prev, s.x, s.y)) this.giveOrDrop(prev.itemId, prev.count);
    }
    const grid = document.getElementById("inv-grid")!;
    const STEP = Game.CELL + Game.GAP;
    const rect = grid.getBoundingClientRect();
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - Game.GAP + "px";
    ghost.style.height = d.h * STEP - Game.GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    document.body.appendChild(ghost);
    const D = { gx: e.clientX - (rect.left + s.x * STEP), gy: e.clientY - (rect.top + s.y * STEP), ghost };
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - D.gx + "px";
      ghost.style.top = ev.clientY - D.gy + "px";
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      const r = grid.getBoundingClientRect();
      const ax = Math.round((ev.clientX - r.left - D.gx) / STEP);
      const ay = Math.round((ev.clientY - r.top - D.gy) / STEP);
      const dd = slotDims(s);
      if (ax >= 0 && ay >= 0 && ax <= this.inv.w - dd.w && ay <= this.inv.h - dd.h) {
        this.inv.slots.push(s);
        if (!this.inv.move(s, ax, ay)) this.inv.move(s, s.x, s.y);
        this.temp = null;
        this.audio.place();
      }
      // else: the item rests in temporary storage until placed or dropped
      this.renderInv();
      this.renderHeld();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    move(e);
  }

  /** Drag the item out of temporary storage back onto the grid. */
  private startTempDrag(e: MouseEvent) {
    if (e.button !== 0 || !this.temp) return;
    e.preventDefault();
    const s = this.temp;
    const grid = document.getElementById("inv-grid")!;
    const STEP = Game.CELL + Game.GAP;
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - Game.GAP + "px";
    ghost.style.height = d.h * STEP - Game.GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    document.body.appendChild(ghost);
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - d.w * STEP / 2 + "px";
      ghost.style.top = ev.clientY - d.h * STEP / 2 + "px";
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      const r = grid.getBoundingClientRect();
      const ax = Math.round((ev.clientX - r.left - (d.w * STEP - Game.GAP) / 2) / STEP);
      const ay = Math.round((ev.clientY - r.top - (d.h * STEP - Game.GAP) / 2) / STEP);
      if (ax >= 0 && ay >= 0 && ax <= this.inv.w - d.w && ay <= this.inv.h - d.h) {
        this.inv.selected = -1; // temp is not a grid slot; anchor the footprint at the cursor
        this.inv.slots.push(s);
        if (this.inv.move(s, ax, ay)) { this.temp = null; this.audio.place(); }
        else { this.inv.slots.splice(this.inv.slots.indexOf(s), 1); this.audio.error(); }
        this.inv.selected = this.inv.slots.indexOf(s);
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
        row.innerHTML = `<span>${label} <span class="needs">(${needs})</span></span>`;
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
        row.innerHTML = `<span>${ITEMS[s.in].name} → ${ITEMS[s.out].name} <span class="needs">(1 fuel charge)</span></span>`;
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
