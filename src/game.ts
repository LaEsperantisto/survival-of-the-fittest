import * as THREE from "three";
import { World, ckey } from "./world";
import { Player } from "./player";
import { Survival, REGULATOR_ROOM_MAX, SAFE_HI } from "./survival";
import { Renderer } from "./renderer";
import { Audio } from "./audio";
import { Inventory, ITEMS, BLOCK_TO_ITEM, slotDims, type ItemDef, type Slot } from "./items";
import { BLOCKS, AIR, WATER, SAND, SANDSTONE, DIRT, SALT, HULL, DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN, BEACON, BENCH, BENCH_EXT, CAMPFIRE, LAMP, ENGINECORE, CHEST, CHEST_CONNECTOR, METAL_PLATING, CACTUS, CACTUS_FRUIT, FARMLAND, MELON_1, MELON_2, WHEAT_1, WHEAT_2, BED, BED_EXT, REGULATOR, GRASS, WOOD, LEAVES, SAPLING, THRUSTER, THRUSTER_LIT, CURVED_HULL, HULL_SLOPE, INSGLASS, STORM_BREAKER, STORM_BREAKER_R, ARMORY, REGULATOR_HUSK, STORM_BREAKER_HUSK, CS, CH, DAY_SECONDS, isSolid, isWater, blockDisplayName, rotatable } from "./blocks";
import { MOB_DEFS, makeMobMesh, type MobKind, type MobVisual } from "./mobs";
import { hashStr, hash2 } from "./noise";
import { heightAt, biomeAt, TOWN_L, CAMP_L, CAVE_MOUTH_L, treePlan, TreePart, structuresOf, campTraderSpot } from "./gen";
import { offersFor, Offer } from "./trades";
import { RECIPES, SMELT, canCraft, doCraft } from "./crafting";
import { QUESTS, currentQuest, loadQuestState, questEvent, type QuestDef, type QuestState } from "./quests";
import { LESSON_BY_ID, LESSONS, loadIdSet } from "./chronicle";
import { Tutorial, INTRO_CINE, type CineSeg } from "./tutorial";
import { WorldMeta, RunSave, saveRun, exportRun, bestScore, submitBest, Settings } from "./save";
import { itemTiles, itemArtUrl } from "./icons";
import * as hud from "./hud";

const isDoorHalf = (i: number) => i === DOOR_CLOSED || i === DOOR_UPPER || i === DOOR_INNER || i === DOOR_INNER_UPPER;

// quarter-turn index -> partner-cell offset, matching the renderer's bench
// orientation indexing (0=+X, 1=+Z, 2=-X, 3=-Z)
const ROT_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Falls: the first 4 blocks are free, ~16 without armour is lethal.
const FALL_GRACE = 4, FALL_DMG_PER_BLOCK = 8.5;

export interface DroppedItem {
  id: number; x: number; y: number; z: number; itemId: string;
  charges?: number; // fuel carried by gear (Head Lantern, Regulator) survives a drop
  buried?: boolean; buriedAt?: [number, number, number]; srcIndex?: number; fall?: number;
  repickAt?: number; // game time before which auto-pickup is suppressed (manual drops)
  age?: number; // seconds since the item hit the sand; loose items rot away (buried ones never do)
}
export interface DeathCache { id: number; x: number; y: number; z: number; kind: "death" | "reward"; items: { itemId: string; count: number; charges?: number }[]; markerEid?: number; beamEid?: number }
export interface Mob {
  kind: MobKind; hp: number; x: number; y: number; z: number;
  homeX: number; homeZ: number;
  yaw: number; biteCd: number; wanderT: number; wanderYaw: number; wanderOn: boolean;
  flyBase: number; // vulture cruise height above the terrain below it
  bank: number;    // circling direction (±1) while soaring
  hitFlash?: number;  // seconds left of the red damage flash
  flashOn?: boolean;  // whether the visual currently has flash materials swapped in
  vis: MobVisual;
}
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
  // ---- the Map kit and the lessons (save v2) ----
  worldMode: "easy" | "hard" = "easy";
  pins: { id: number; x: number; z: number; name: string }[] = [];
  private pinSeq = 0;
  revealed = new Set<string>();   // landmark keys marked by the Tracker, quest guidance or a dig
  visited = new Set<string>();    // explored chunk keys "cx,cz" (world.chunks keys, seeded from the save)
  chronicle = new Set<string>();  // lesson ids seen (chronicle.ts)
  chronLast: string | null = null;
  codex = new Set<string>();      // item ids learned by carrying; "b:<blockId>" by mining
  mapMax = false;
  private tileCache = new Map<string, { rev: number; remembered: boolean; cv: HTMLCanvasElement }>();
  // living desert: mobs are runtime-only (never saved); they respawn near the player
  private mobs: Mob[] = [];
  private traderAt = new Map<string, Mob>();      // camp lattice cell -> its resident Trader
  private tradeOffers: Offer[] = [];
  private tradeCamp: { x: number; z: number } | null = null;
  private stormToast = false;
  private mobSpawnAcc = 9;
  private attackCd = 0;
  // Armour Slots: equipped gear lives here, not in the inventory grid
  equip: { backpack: Slot | null; head: Slot | null; body: Slot | null; regulator: Slot | null; light: Slot | null } =
    { backpack: null, head: null, body: null, regulator: null, light: null };
  // Head Lantern burns fuel charges while lit; the worn Body Heat Regulator burns
  // Coolant Cell charges passively. Both counts live on the equipped Slot.
  lanternOn = false;
  private lanternAcc = 0;   // seconds burned toward the next lantern charge
  private regulatorAcc = 0; // seconds burned toward the next coolant charge
  collected = new Set<number>();
  running = false;
  paused = false;
  escAt = 0;
  private relockAt = 0;
  private prevHp = 100;
  private lastHitFlash = -10;
  private lastDmgAt = -10;
  ui: null | "inv" | "bench" | "smelt" | "cache" | "liftoff" | "trade" = null;
  openCacheId: number | null = null;
  openStation: [number, number, number] | null = null;
  private breaking: { x: number; y: number; z: number; need: number; elapsed: number } | null = null;
  // planted crops: "x,y,z" -> accumulated good-conditions seconds
  crops = new Map<string, number>();
  private cropAcc = 0;
  private treeAcc = 0;
  /** Living Trees planted by the player: "x,y,z" of the planted cell → growth seconds. */
  private trees = new Map<string, number>();
  private treePlanCache = new Map<string, TreePart[]>();
  private sprintOn = false;
  private lastPrick = -9;
  private tempOrigin: Inventory | null = null;
  lastSleep = -1e9; // timeSec of the last bed sleep; one long sleep per game day
  private mouseDown = false;
  private breakMsg = false;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private mobile = matchMedia("(pointer: coarse)").matches;
  speedMul = 1; // cheat-menu movement multiplier, session-only
  private regGlow = new Map<string, number>(); // "x,y,z" -> entity mesh id of an active regulator's glow shell
  private regGlowMat: THREE.MeshLambertMaterial | null = null;
  private regTick = -1;
  // Sandstorm Breakers: positions (worldgen pylon + player-placed) and the
  // twice-a-second "am I standing in one's calm" check.
  private breakers = new Set<string>();
  private breakerTick = -1;
  stormShieldOn = false;
  private regActive = false; // cached from regulatorGlow's twice-a-second room scan
  private mobileJump = false;
  private entitySeq = 1;
  private audioTickAcc = 0;
  private autosaveAcc = 0;
  private waterAcc = 0;
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
  // guided tour (fresh worlds): the step machine, its quest-guide override,
  // and the opening cinematic camera
  tut: Tutorial | null = null;
  tutGuide: { name: string; x: number; y: number; z: number } | null = null;
  private cine: { t: number } | null = null;
  private cineSegs: CineSeg[] = [];
  private cineOnEnd: (() => void) | null = null;
  private visorBeams = new Map<string, number>(); // cache/cluster key -> beam mesh id
  private lockAt = 0;
  private guideAcc = 1;
  private lastTouchTs = 0;
  won = false;

  constructor(public meta: WorldMeta, run: RunSave | null, parent: HTMLElement, private settings: Settings, private audio: Audio) {
    this.seed = hashStr(meta.seedStr || meta.id);
    // Easy/Hard Start is fixed when the world is created; the run copy wins on load
    this.worldMode = run?.worldMode ?? meta.mode ?? "easy";
    this.world = new World(this.seed, this.worldMode);
    this.survival = new Survival(this.seed ^ 7);
    this.quests = loadQuestState(run?.quest);
    this.renderer = new Renderer(parent);
    this.renderer.fires = this.campCharges;
    this.player = new Player(this.world);
    this.inv.learn = (id) => this.codex.add(id); // the Codex learns on first pickup, not at save
    this.timeSec = run?.time ?? DAY_SECONDS * 0.7; // new worlds start mid-afternoon, near the day's hottest
    this.playSec = run?.playSec ?? 0;
    // last input modality: touch synthesises mouse events, so a recent touch means "this tap is touch"
    document.addEventListener("touchstart", () => { this.lastTouchTs = Date.now(); }, { passive: true, capture: true });

    if (run) this.restore(run);
    else this.spawnStarterEntities();
    // the wreck's ceiling lamps are worldgen (not deltas): light them explicitly
    if (this.world.get(-6, 35, 0) === LAMP) this.renderer.addPointLight(-6, 35, 0, "lamp");
    if (this.world.get(6, 35, 0) === LAMP) this.renderer.addPointLight(6, 35, 0, "lamp");
    // Sandstorm Breakers: the wreck's pylon is worldgen (not a delta) — scan the
    // hull; player-placed ones are already in the run's deltas.
    for (let x = -10; x <= 8; x++) for (let z = -14; z <= 14; z++) for (let y = 28; y <= 36; y++)
      if (this.world.get(x, y, z) === STORM_BREAKER) this.breakers.add(`${x},${y},${z}`);
    for (const [k, d] of this.world.deltas) {
      const [cx, cz] = k.split(",").map(Number);
      for (const [i, id] of d) {
        if (id !== STORM_BREAKER) continue;
        const y = i % CH, rest = (i - y) / CH, lx = rest % CS;
        this.breakers.add(`${cx * CS + lx},${y},${cz * CS + (rest - lx) / CS}`);
      }
    }

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
      this.entities.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy, z: c.z + 0.5, itemId: "canister_full", buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: i });
    });
    this.spawnStarterChest();
  }

  private spawnStarterChest() {
    // the cockpit's Supply Chest is a real chest block, stocked with three full canisters
    const [x, y, z] = [3, 31, 0];
    if (this.world.get(x, y, z) !== AIR) return;
    this.world.set(x, y, z, CHEST);
    this.chests.set(Game.chestKey([[x, y, z]]), [
      { itemId: "canister_full", x: 0, y: 0 },
      { itemId: "canister_full", x: 1, y: 0 },
      { itemId: "canister_full", x: 2, y: 0 },
    ]);
  }

  // ---------- Supply Chest blocks ----------
  // A chest block owns an Inventory Grid. Chests touching orthogonally form one
  // cluster sharing a single grid: 3×3 each, width grows to 9 (three chests),
  // then height grows one row per chest. Capacity is always 9 per chest.

  private chestCluster(x: number, y: number, z: number): [number, number, number][] {
    // Chests link through each other and through Chest Connector rails; the
    // rails themselves store nothing and don't count toward the grid size.
    const seen = new Set<string>([`${x},${y},${z}`]);
    const walk: [number, number, number][] = [[x, y, z]];
    const out: [number, number, number][] = [];
    while (walk.length) {
      const c = walk.pop()!;
      if (this.world.get(c[0], c[1], c[2]) === CHEST) out.push(c);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const nx = c[0] + dx, ny = c[1] + dy, nz = c[2] + dz;
        const k = `${nx},${ny},${nz}`;
        const nb = this.world.get(nx, ny, nz);
        if (seen.has(k) || (nb !== CHEST && nb !== CHEST_CONNECTOR)) continue;
        seen.add(k);
        walk.push([nx, ny, nz]);
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

  /** Put an existing slot (exactly one item) into a free spot of `target`; re-orients if needed. */
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

  private inTown(x: number, z: number): boolean {
    const st = this.world.gen;
    const tx = Math.floor(x / TOWN_L), tz = Math.floor(z / TOWN_L);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!st.townAt(tx + a, tz + b)) continue;
      const c = st.townCenter(tx + a, tz + b);
      if (Math.abs(c.x - x) <= 10 && Math.abs(c.z - z) <= 10) return true;
    }
    return false;
  }

  /** A town Supply Chest's stores, rolled deterministically from its position. */
  private townLoot(cx: number, cz: number): { itemId: string; count: number }[] {
    const r = (salt: number) => hash2(cx, cz, this.seed + salt);
    const items: { itemId: string; count: number }[] = [{ itemId: "canister_empty", count: 2 }];
    if (r(11) < 0.7) items.push({ itemId: "seed_wheat", count: 1 + (r(12) < 0.5 ? 1 : 0) });
    if (r(13) < 0.4) items.push({ itemId: "seed_melon", count: 1 + (r(14) < 0.4 ? 1 : 0) });
    if (r(15) < 0.6) items.push({ itemId: "cooked_wheat", count: 1 + (r(16) < 0.35 ? 1 : 0) });
    if (r(17) < 0.5) items.push({ itemId: "metal", count: 1 + Math.floor(r(18) * 3) });
    if (r(19) < 0.45) items.push({ itemId: "chest_connector", count: 1 + Math.floor(r(20) * 2) });
    if (r(21) < 0.3) items.push({ itemId: "door_inner", count: 1 });
    if (r(22) < 0.25) items.push({ itemId: "bed", count: 1 });
    if (r(23) < 0.5) items.push({ itemId: "seed_tree", count: 1 + (r(24) < 0.4 ? 1 : 0) + (r(25) < 0.2 ? 1 : 0) });
    return items;
  }

  private openChest(x: number, y: number, z: number) {
    const cells = this.chestCluster(x, y, z);
    const key = Game.chestKey(cells);
    const known = this.chests.has(key);
    if (!this.chests.has(key)) this.chests.set(key, []);
    const ci = this.emptyChestGrid(cells.length);
    ci.slots = this.chests.get(key)!;
    // world-placed Supply Chests hold stores exactly once: a cluster never
    // opened before rolls its loot now, and every later opening is bare
    if (!known && cells.some(([cx, , cz]) => this.inTown(cx, cz))) {
      for (const it of this.townLoot(cells[0][0], cells[0][2])) {
        // every instance gets its own slot — chest stores never stack
        for (let i = 0; i < it.count; i++) {
          const s: Slot = { itemId: it.itemId, x: 0, y: 0 };
          if (!Game.placeSlotFree(ci, s)) this.dropEntity(it.itemId, 1, 2);
        }
      }
      hud.toast("Someone's stores — untouched since the town emptied.");
      this.questBump("supplies");
    }
    this.chestInv = ci;
    this.gridFocus = "chest";
    this.tut?.notify("chest");
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
    for (const sl of old) if (!Game.placeSlotFree(ci, sl)) this.dropEntity(sl.itemId, 1, 2, sl.charges);
    if (ci.slots.length) this.chests.set(Game.chestKey(cells), ci.slots);
    if (cells.length > 1) hud.toast(`Chests linked — one ${ci.w}×${ci.h} inventory.`);
  }

  /** A pre-grid Supply Chest cache becomes a chest-block grid — one representation, never double-lootable. */
  private adoptLegacyChest(c: { x: number; y: number; z: number; items: { itemId: string; count: number }[] }) {
    if (this.world.get(c.x, c.y, c.z) !== CHEST) {
      if (isSolid(this.world.get(c.x, c.y, c.z))) {
        // something was built in its place: the goods spill onto the sand
        for (const it of c.items) for (let i = 0; i < it.count; i++) this.dropEntity(it.itemId, 1, 2);
        return;
      }
      this.world.set(c.x, c.y, c.z, CHEST);
    }
    const cells = this.chestCluster(c.x, c.y, c.z);
    const k = Game.chestKey(cells);
    if (!this.chests.has(k)) this.chests.set(k, []);
    const ci = this.emptyChestGrid(cells.length);
    ci.slots = this.chests.get(k)!;
    for (const it of c.items)
      for (let i = 0; i < it.count; i++) {
        const s: Slot = { itemId: it.itemId, x: 0, y: 0 };
        if (!Game.placeSlotFree(ci, s)) this.dropEntity(it.itemId, 1, 2);
      }
  }

  private cacheColor(c: DeathCache): number { return c.kind === "reward" ? 0xb08a3e : 0x6b5a44; }
  private cacheMeshPos(c: DeathCache): [number, number, number] {
    return [c.x, c.y + 0.5, c.z];
  }

  private restore(run: RunSave) {
    this.world.loadDeltas(run.deltas);
    this.player.pos.set(run.player.x, run.player.y, run.player.z);
    this.player.yaw = run.player.yaw; this.player.pitch = run.player.pitch;
    this.survival.health = run.survival.health;
    this.survival.water = run.survival.water;
    this.survival.body = run.survival.body;
    // Old saves may hold stacked slots; keep one instance per slot in place and
    // give the extra copies back so nothing occupies a stack.
    const legacyExtras: { itemId: string }[] = [];
    this.inv.slots = run.inventory.slots.map((s) => {
      const n = s.count ?? 1;
      for (let i = 1; i < n; i++) legacyExtras.push({ itemId: s.itemId });
      return { itemId: s.itemId, x: s.x, y: s.y, rot: s.rot, charges: s.charges, blockRot: s.blockRot };
    });
    for (const s of legacyExtras) this.giveOrDrop(s.itemId, 1);
    this.inv.selected = run.inventory.selected;
    if (run.inventory.w !== this.inv.w || run.inventory.h !== this.inv.h) {
      this.inv.w = run.inventory.w; this.inv.h = run.inventory.h;
      this.inv.baseLimit = 30; this.inv.bonusLimit = run.inventory.bonusLimit;
    } else this.inv.bonusLimit = run.inventory.bonusLimit;
    // Armour Slots: restore gear without touching grid sizes (the saved w/h/bonusLimit already encode them)
    for (const slot of ["backpack", "head", "body", "regulator", "light"] as const) {
      const id = run.equip?.[slot];
      if (id) this.equip[slot] = { itemId: id, x: 0, y: 0, charges: run.equip?.charges?.[slot as "regulator" | "light"] };
    }
    this.beaconMarks = run.beaconMarks ?? [];
    this.worldMode = run.worldMode ?? "easy";
    this.pins = run.pins ?? [];
    this.pinSeq = this.pins.reduce((m, p) => Math.max(m, p.id), 0);
    this.revealed = new Set(run.revealed ?? []);
    this.visited = new Set(run.visited ?? []);
    this.chronicle = loadIdSet(run.chronicle, new Set(LESSONS.map((l) => l.id)));
    this.chronLast = this.chronicle.size ? [...this.chronicle].pop()! : null;
    this.codex = loadIdSet(run.codex, new Set([...Object.keys(ITEMS), ...BLOCKS.map((_, i) => "b:" + i)]));
    this.trees = new Map(run.trees ?? []);
    this.collected = new Set(run.collected ?? []);
    const collected = this.collected;
    let idx = 0;
    const fresh: typeof this.entities = [];
    this.world.gen.canisters.forEach((c) => {
      if (c.buried && !collected.has(idx)) {
        const gy = Math.round(heightAt(this.seed, c.x, c.z));
        fresh.push({ id: this.entitySeq++, x: c.x + 0.5, y: gy, z: c.z + 0.5, itemId: "canister_full", buried: c.buried, buriedAt: c.buried ? [c.x, gy, c.z] : undefined, srcIndex: idx });
      }
      idx++;
    });
    for (const e of run.entities) {
      // old saves may hold stacked drops; split them — one item per entity
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) fresh.push({ id: this.entitySeq++, x: e.x, y: e.y, z: e.z, itemId: e.itemId, age: e.age });
    }
    this.entities = fresh;
    // chest grids: split any legacy stacked slots into individual items
    this.chests = new Map((run.chests ?? []).map((c) => {
      const ci = this.emptyChestGrid(c.cells.split("|").length);
      for (const s of c.slots) {
        ci.slots.push({ itemId: s.itemId, x: s.x, y: s.y, rot: s.rot, blockRot: s.blockRot, charges: s.charges });
        for (let i = 1; i < (s.count ?? 1); i++) {
          const extra: Slot = { itemId: s.itemId, x: 0, y: 0 };
          if (!Game.placeSlotFree(ci, extra)) this.giveOrDrop(s.itemId, 1);
        }
      }
      return [c.cells, ci.slots];
    }));
    const legacyChests: { x: number; y: number; z: number; items: { itemId: string; count: number }[] }[] = [];
    for (const c of run.caches) {
      const kind = c.kind ?? "death";
      // old saves model Supply Chests as caches; they now live on as chest-block grids
      if (kind === "chest") { legacyChests.push(c); continue; }
      const cache: DeathCache = { id: this.entitySeq++, x: c.x, y: c.y, z: c.z, kind, items: c.items.map((i) => ({ ...i })) };
      this.caches.push(cache); // crate, ring and beam get (re)built by the marker loop
    }
    this.campCharges.clear();
    for (const [k, v] of Object.entries(run.campfires ?? {})) this.campCharges.set(k, v);
    this.renderer.fires = this.campCharges;
    this.world.loadRots(run.rots ?? {});
    this.crops = new Map(run.crops ?? []);
    if (run.lastSleep) this.lastSleep = run.lastSleep;
    for (const c of legacyChests) this.adoptLegacyChest(c);
    this.pods = (run.pods ?? []).map((p) => ({
      ...p,
      ringEid: this.renderer.addGroundRing(p.x + 0.5, Math.round(heightAt(this.seed, p.x, p.z)), p.z + 0.5, 0xcc3322, 1.1),
      beamEid: this.renderer.addBeam(p.x + 0.5, Math.round(heightAt(this.seed, p.x, p.z)), p.z + 0.5, 0xcc3322),
    }));
    this.won = !!run.won;
    // re-light lamps and campfires that live in the saved deltas; a campfire
    // without fuel charges stays cold charcoal and keeps no light
    for (const [k, m] of this.world.deltas) {
      const [cx, cz] = k.split(",").map(Number);
      for (const [i, id] of m) {
        if (id !== LAMP && id !== CAMPFIRE) continue;
        const lx = Math.floor(i / (CS * CH)), rem = i % (CS * CH);
        const wx = cx * CS + lx, wy = rem % CH, wz = cz * CS + Math.floor(rem / CH);
        if (id === CAMPFIRE && (this.campCharges.get(`${wx},${wy},${wz}`) ?? 0) <= 0) continue;
        this.renderer.addPointLight(wx, wy, wz, id === LAMP ? "lamp" : "fire");
      }
    }
  }

  snapshot(): RunSave {
    // the Codex learns whatever you are carrying or wearing right now
    for (const s of this.inv.slots) this.codex.add(s.itemId);
    for (const slot of ["backpack", "head", "body", "regulator", "light"] as const) {
      const e = this.equip[slot];
      if (e) this.codex.add(e.itemId);
    }
    return {
      v: 2,
      seedStr: this.meta.seedStr,
      time: this.timeSec, playSec: this.playSec,
      days: this.dayNumber(),
      player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw, pitch: this.player.pitch },
      survival: { health: this.survival.health, water: this.survival.water, body: this.survival.body },
      quest: { i: this.quests.i, p: this.quests.p.slice() },
      inventory: { slots: this.inv.slots.map((s) => ({ ...s })), selected: this.inv.selected, w: this.inv.w, h: this.inv.h, bonusLimit: this.inv.bonusLimit },
      equip: {
        backpack: this.equip.backpack?.itemId, head: this.equip.head?.itemId, body: this.equip.body?.itemId,
        regulator: this.equip.regulator?.itemId, light: this.equip.light?.itemId,
        charges: {
          regulator: this.equip.regulator?.charges,
          light: this.equip.light?.charges,
        },
      },
      beaconMarks: this.beaconMarks,
      collected: this.collectedCanisterIndices(),
      entities: this.entities.filter((e) => !e.buried).map((e) => ({ x: e.x, y: e.y, z: e.z, itemId: e.itemId, charges: e.charges, age: Math.floor(e.age ?? 0) })),
      pods: this.pods,
      won: this.won || undefined,
      caches: this.caches.map((c) => ({ x: c.x, y: c.y, z: c.z, kind: c.kind, items: c.items.map((i) => ({ ...i })) })),
      chests: [...this.chests].map(([cells, slots]) => ({ cells, slots: slots.map((s) => ({ ...s })) })),
      campfires: Object.fromEntries(this.campCharges),
      crops: [...this.crops],
      trees: [...this.trees],
      lastSleep: this.lastSleep > 0 ? this.lastSleep : undefined,
      deltas: this.world.serializeDeltas(),
      rots: this.world.serializeRots(),
      worldMode: this.worldMode,
      pins: this.pins,
      visited: [...this.visited],
      revealed: [...this.revealed],
      chronicle: [...this.chronicle],
      codex: [...this.codex],
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
  // ---------- guided tour (fresh worlds) ----------
  startTutorial() {
    this.survival.invincible = true;
    this.setClock(0.42); // mid-morning light, air already warming
    document.getElementById("quest")!.classList.add("hidden");
    this.tut = new Tutorial(this);
    this.startCine(INTRO_CINE, () => this.tut?.onCineEnd());
  }
  endTutorial() {
    this.tut = null;
    this.tutGuide = null;
    this.survival.invincible = false;
    document.getElementById("quest")!.classList.remove("hidden");
    this.renderQuest();
    hud.toast("Tour complete. Now survive.");
    this.saveNow();
  }
  private startCine(segs: CineSeg[], onEnd: () => void) {
    this.cineSegs = segs;
    this.cine = { t: 0 };
    this.cineOnEnd = onEnd;
  }
  /** Abort the opening flyover: the camera snaps straight back to the player
   *  and the hatch the tour pushed open is re-latched. */
  skipCine() {
    if (!this.cine) return;
    this.cine = null;
    this.cineOnEnd = null;
    const w = this.world;
    if (w.get(-6, 31, 0) === DOOR_OPEN) {
      w.set(-6, 31, 0, DOOR_CLOSED);
      w.set(-6, 32, 0, DOOR_UPPER);
      w.doorSwing.delete("-6,0");
    }
    this.player.pitch = 0;
  }
  // cinematic camera: straight dolly shots, hard cuts between them
  private cineFrame(dt: number) {
    const c = this.cine!;
    c.t += dt;
    const segs = this.cineSegs;
    const seg = segs.find((s) => c.t < s.t1) ?? segs[segs.length - 1];
    if (seg.openDoor && c.t >= seg.openDoor.t) {
      const { x, y, z } = seg.openDoor;
      if (this.world.get(x, y, z) !== DOOR_OPEN) {
        this.world.set(x, y, z, DOOR_OPEN);
        for (const dy of [-1, 1]) if (isDoorHalf(this.world.get(x, y + dy, z))) this.world.set(x, y + dy, z, DOOR_OPEN);
        this.audio.door();
      }
    }
    const u = Math.min(1, Math.max(0, (c.t - seg.t0) / (seg.t1 - seg.t0)));
    const e = u * u * (3 - 2 * u);
    const cam = this.renderer.camera;
    cam.position.set(
      seg.from[0] + (seg.to[0] - seg.from[0]) * e,
      seg.from[1] + (seg.to[1] - seg.from[1]) * e,
      seg.from[2] + (seg.to[2] - seg.from[2]) * e,
    );
    cam.lookAt(seg.look[0], seg.look[1], seg.look[2]);
    if (c.t >= segs[segs.length - 1].t1) {
      this.cine = null;
      // hand control to the player without a jarring snap
      const last = segs[segs.length - 1];
      this.player.yaw = Math.atan2(-(last.look[0] - last.to[0]), -(last.look[2] - last.to[2]));
      this.player.pitch = 0;
      const cam2 = this.renderer.camera;
      cam2.position.copy(this.player.eye());
      cam2.rotation.order = "YXZ";
      cam2.rotation.set(0, this.player.yaw, 0);
      this.cineOnEnd?.();
      this.cineOnEnd = null;
    }
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
    if (this.renderer.lightingMode !== s.lighting) {
      this.renderer.setLightingMode(s.lighting);
      this.renderer.rebuildLights(this.world);
    }
    this.renderer.resetChunkMeshes();
    const pcx = Math.floor(this.player.pos.x / 16), pcz = Math.floor(this.player.pos.z / 16);
    this.renderer.ensureChunks(this.world, pcx, pcz);
  }

  dayNumber() { return 1 + Math.floor(this.timeSec / DAY_SECONDS); }

  // ---------- quests ----------

  private questBump(kind: QuestDef["kind"], n = 1) {
    if (this.tut) return; // the tour owns the player's attention; the chain starts after it
    const done = questEvent(this.quests, kind, n);
    if (!done) { if (kind === "mine") this.renderQuest(); return; }
    hud.toast(`Quest complete: ${done.title}`);
    if (done.reward) this.crashPod(done.reward.item, done.reward.n);
    this.audio.savePing();
    if (done.kind === "finish") hud.toast("Power runs through the wreck. Four dead engines left — find them a way to burn.");
    this.renderQuest();
    this.saveNow(true);
  }

  // All quest rewards arrive as a Reward Cache: a warning, a red beacon marker
  // lights where it will land (landmark caches are already marked), and the crate
  // drops out of the sky (GLOSSARY: "All block-shaped quest rewards arrive as
  // Crash Pods" — the crate itself is a Cache).
  // topmost loaded block in a column — pods must land on roofs and dune tops,
  // not at raw terrain height under a structure
  private columnTop(x: number, z: number): number {
    for (let y = CH - 1; y >= 0; y--) if (this.world.get(x, y, z)) return y;
    return Math.round(heightAt(this.seed, x, z));
  }

  private crashPod(itemId: string, n: number) {
    const p = this.player.pos;
    const x = Math.round(p.x) + 2, z = Math.round(p.z) + 1;
    const gy = this.columnTop(x, z);
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
      const gy = this.columnTop(pd.x, pd.z);
      this.caches.push({ id: this.entitySeq++, x: pd.x, y: gy, z: pd.z, kind: "reward", items: [{ itemId: pd.itemId, count: pd.n }] });
      this.renderer.addEntityMesh(this.caches[this.caches.length - 1].id, [pd.x, gy + 0.5, pd.z], this.cacheColor(this.caches[this.caches.length - 1]), 0.7);
      this.pods.splice(i, 1);
      this.audio.thud();
      hud.toast("Reward Cache landed — claim it with E.");
      this.saveNow(true);
    }
  }

  // The HUD guides the active quest: a compass heading + distance (hud.updateWaypoint)
  // and a waypoint beam at the target. With a Surveyor's Visor equipped in the
  // Head slot, every Cache and chest cluster also gets a marker beam (items.ts:
  // "equipped in the Head slot the HUD marks every Death Cache, Reward Cache and Supply Chest").
  private guideFrame(dt: number) {
    this.guideAcc += dt;
    if (this.guideAcc < 0.4) return;
    this.guideAcc = 0;
    const p = this.player.pos;

    // explored chunks are the Map's memory — every streamed chunk counts
    for (const k of this.world.chunks.keys()) this.visited.add(k);
    this.chronTick();

    const t = this.tut ? this.tutGuide : this.waypointTarget();
    if (t) {
      hud.updateWaypoint(t.name, t.x, t.z, p.x, p.z, this.player.yaw);
      const key = `${t.name}|${Math.floor(t.x)},${Math.floor(t.z)}`;
      if (key !== this.waypointKey) {
        if (this.waypointEid) { this.renderer.removeEntityMesh(this.waypointEid); this.waypointEid = 0; }
        this.waypointKey = key;
        this.waypointEid = this.renderer.addBeam(t.x, t.y, t.z, 0x35e0ff, 12);
        const lm = (t as { lmKey?: string }).lmKey;
        if (lm) this.revealed.add(lm); // the quest guide marks its Landmark on the Map
      }
    } else {
      hud.updateWaypoint(null);
      if (this.waypointEid) { this.renderer.removeEntityMesh(this.waypointEid); this.waypointEid = 0; }
      this.waypointKey = "";
    }

    const want = new Map<string, [number, number, number, number]>();
    if (this.equip.head?.itemId === "visor") {
      for (const c of this.caches)
        if (c.items.length)
          want.set(`c${c.id}`, [c.x + 0.5, c.y, c.z + 0.5, c.kind === "reward" ? 0xd8a24a : 0xcc4433]);
      for (const key of this.chests.keys()) {
        const [x, y, z] = key.split(";")[0].split(",").map(Number);
        want.set(`x${key}`, [x + 0.5, y, z + 0.5, 0xe6c96a]);
      }
      // a Surveyor's Pin named "Base" beams from anywhere, like a home port
      for (const pin of this.pins)
        if (pin.name.trim().toLowerCase() === "base")
          want.set(`p${pin.id}`, [pin.x + 0.5, Math.round(heightAt(this.seed, pin.x, pin.z)) + 1, pin.z + 0.5, 0xd8b74f]);
    }
    for (const [k, eid] of this.visorBeams)
      if (!want.has(k)) { this.renderer.removeEntityMesh(eid); this.visorBeams.delete(k); }
    for (const [k, [x, y, z, col]] of want)
      if (!this.visorBeams.has(k)) this.visorBeams.set(k, this.renderer.addBeam(x, y, z, col, 10));
    this.drawMap();
  }

  private waypointTarget(): { name: string; x: number; y: number; z: number; lmKey?: string } | null {
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
        let bi = -1, bd = Infinity;
        this.world.gen.oases.forEach((o, i) => { const d = (o.x - p.x) ** 2 + (o.z - p.z) ** 2; if (d < bd) { bd = d; bi = i; } });
        const o = bi >= 0 ? this.world.gen.oases[bi] : null;
        return o ? { name: "Oasis", x: o.x + 0.5, y: ground(o.x, o.z), z: o.z + 0.5, lmKey: `oasis:${bi}` } : null;
      }
      case "water_home":
      case "finish": {
        const b = [...this.beaconMarks, { x: -4, y: 31, z: -1 }].reverse()
          .find((b) => this.world.get(b.x, b.y, b.z) === BEACON);
        return b ? { name: "Save Beacon", x: b.x + 0.5, y: b.y, z: b.z + 0.5 } : null;
      }
      case "wreck": {
        const s = this.world.gen.secondShip;
        return { name: "Second Wreck", x: s.x + 0.5, y: ground(s.x, s.z), z: s.z + 0.5, lmKey: "wreck2" };
      }
      case "core": {
        const s = this.world.gen.secondShip;
        return { name: "Engine Core", x: s.x + 0.5, y: ground(s.x, s.z), z: s.z + 0.5, lmKey: "wreck2" };
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
      case "supplies": {
        const t = this.world.gen.nearestTown(p.x, p.z);
        return t ? { name: "Town", x: t.x + 0.5, y: ground(t.x, t.z), z: t.z + 0.5, lmKey: `town:${Math.round(t.x / TOWN_L)},${Math.round(t.z / TOWN_L)}` } : null;
      }
      case "farm": {
        if (!this.crops.size) return null; // point at the nearest plot once something is planted
        let bk: string | null = null, bd = Infinity;
        for (const k of this.crops.keys()) {
          const [x, , z] = k.split(",").map(Number);
          const d = (x + 0.5 - p.x) ** 2 + (z + 0.5 - p.z) ** 2;
          if (d < bd) { bd = d; bk = k; }
        }
        const [x, y, z] = bk!.split(",").map(Number);
        return { name: "Your Farm", x: x + 0.5, y: y + 1, z: z + 0.5 };
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
    else if (q.kind === "wreck") {
      const s = this.world.gen.secondShip;
      if ((s.x + 0.5 - p.x) ** 2 + (s.z + 0.5 - p.z) ** 2 < 169) this.questBump("wreck");
    }
  }

  /** Cheat-menu shortcut: jump the quest chain to index (== QUESTS.length
   *  finishes the chain). Skipped quests keep no progress and pay no rewards. */
  questJump(index: number) {
    if (this.tut) this.tut.finish(); // the guided tour owns the chain until it ends
    const i = Math.max(0, Math.min(QUESTS.length, index | 0));
    this.quests.i = i;
    this.questShown = "";
    this.renderQuest();
    hud.toast(i >= QUESTS.length ? "Quest chain skipped — every quest is done."
      : `Skipped to “${QUESTS[i].title}”.`);
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
    const key = q.id + ":" + p + ":" + (this.chronLast ?? "");
    if (key === this.questShown) return;
    this.questShown = key;
    const cl = this.chronLast ? LESSON_BY_ID.get(this.chronLast) : null;
    el.innerHTML =
      `<div class="q-title">Quest · ${q.title}${q.goal > 1 ? ` (${p}/${q.goal})` : ""}</div>` +
      `<div class="q-desc">${q.desc}</div>` +
      (q.goal > 1 ? `<div class="q-bar"><i style="width:${(p / q.goal) * 100}%"></i></div>` : "") +
      (cl ? `<div class="q-chron">Chronicle · ${cl.title} — ${cl.hint}</div>` : "");
  }

  // ------------------------------------------------------------------
  // Chronicle: first-time discoveries teach the world's systems
  // ------------------------------------------------------------------

  /** Unlock a lesson once; it becomes the HUD's Chronicle line. */
  lesson(id: string) {
    if (this.chronicle.has(id) || !LESSON_BY_ID.has(id)) return;
    this.chronicle.add(id);
    this.chronLast = id;
    hud.toast(`Chronicle — ${LESSON_BY_ID.get(id)!.title}`);
    this.audio.savePing();
    this.renderQuest();
  }

  /** The Chronicle re-teaches each wreck machine the first time it is built
   *  (including a Husk repair — the lesson matters most to Hard starts). */
  private craftLesson(out: string) {
    if (out === "regulator") this.lesson("regulator");
    if (out === "storm_breaker") this.lesson("breaker");
  }

  /** 0.4 s sampler: standing in/at a Landmark teaches it. */
  private chronTick() {
    const p = this.player.pos;
    const g = this.world.gen;
    if (g.nearOasis(Math.floor(p.x), Math.floor(p.z))) this.lesson("oasis");
    if (g.townNear(p.x, p.z, 96)) this.lesson("town");
    if (g.mouthNear(p.x, p.z, 14)) this.lesson("mouth");
    {
      const t0 = Math.floor((p.x - 24) / CAMP_L), t1 = Math.floor((p.x + 24) / CAMP_L);
      const s0 = Math.floor((p.z - 24) / CAMP_L), s1 = Math.floor((p.z + 24) / CAMP_L);
      for (let tx = t0; tx <= t1 && !this.chronicle.has("camp"); tx++)
        for (let tz = s0; tz <= s1; tz++) {
          if (!g.campAt(tx, tz)) continue;
          const c = g.campCenter(tx, tz);
          if (Math.hypot(c.x - p.x, c.z - p.z) <= 24) { this.lesson("camp"); break; }
        }
    }
    const s = g.secondShip;
    if ((s.x - p.x) ** 2 + (s.z - p.z) ** 2 <= 120 ** 2) this.lesson("wreck2");
    if (p.y < heightAt(this.seed, Math.floor(p.x), Math.floor(p.z)) - 3) this.lesson("cave");
  }

  // ------------------------------------------------------------------
  // The Map — visible only while the Surveyor's Visor is worn;
  // corner HUD widget, maximised by M (or tapping the Map on mobile).
  // Known terrain = chunks explored this session (world.chunks keys,
  // seeded from the save) plus remembered chunks drawn dimmed.
  // Known Landmarks = visited / quest-guided / Tracker-revealed / dug.
  // ------------------------------------------------------------------

  private landmarkKnown(key: string, x: number, z: number): boolean {
    return this.revealed.has(key) || this.visited.has(Math.floor(x / CS) + "," + Math.floor(z / CS));
  }

  private landmarkList(px: number, pz: number, rad: number): { key: string; x: number; z: number; kind: string; label: string }[] {
    const g = this.world.gen, out: { key: string; x: number; z: number; kind: string; label: string }[] = [];
    out.push({ key: "ship", x: 0, z: 0, kind: "ship", label: "The Crash" }); // you started here — always known
    const s = g.secondShip;
    if (this.landmarkKnown("wreck2", s.x, s.z)) out.push({ key: "wreck2", x: s.x, z: s.z, kind: "wreck", label: "Second Wreck" });
    for (let i = 0; i < g.oases.length; i++) {
      const o = g.oases[i], k = `oasis:${i}`;
      if (Math.abs(o.x - px) <= rad && Math.abs(o.z - pz) <= rad && this.landmarkKnown(k, o.x, o.z))
        out.push({ key: k, x: o.x, z: o.z, kind: "oasis", label: "Oasis" });
    }
    g.canisters.forEach((c, i) => {
      if (!this.collected.has(i)) return; // a buried site only appears once one of its canisters is dug
      if (Math.abs(c.x - px) <= rad && Math.abs(c.z - pz) <= rad)
        out.push({ key: `can:${i}`, x: c.x, z: c.z, kind: "canister", label: "Canister Site" });
    });
    const lat = (L: number, mk: (tx: number, tz: number) => { x: number; z: number }, kind: string, label: string) => {
      const t0 = Math.floor((px - rad) / L), t1 = Math.floor((px + rad) / L);
      const s0 = Math.floor((pz - rad) / L), s1 = Math.floor((pz + rad) / L);
      for (let tx = t0; tx <= t1; tx++) for (let tz = s0; tz <= s1; tz++) {
        if (kind === "town" ? !g.townAt(tx, tz) : kind === "camp" ? !g.campAt(tx, tz) : !g.mouthAt(tx, tz)) continue;
        const k = `${kind}:${tx},${tz}`, c = mk(tx, tz);
        if (this.landmarkKnown(k, c.x, c.z)) out.push({ key: k, x: c.x, z: c.z, kind, label });
      }
    };
    lat(TOWN_L, (tx, tz) => g.townCenter(tx, tz), "town", "Town");
    lat(CAMP_L, (tx, tz) => g.campCenter(tx, tz), "camp", "Trader Camp");
    lat(CAVE_MOUTH_L, (tx, tz) => g.mouthCenter(tx, tz), "mouth", "Cave Mouth");
    return out;
  }

  /** Plant the held Surveyor's Pin where the player stands. */
  private plantPin() {
    if (this.inv.removeItem("surveyor_pin", 1) !== 1) return;
    const x = Math.floor(this.player.pos.x), z = Math.floor(this.player.pos.z);
    this.pins.push({ id: ++this.pinSeq, x, z, name: `Pin ${this.pinSeq}` });
    this.audio.place();
    hud.toast("Surveyor's Pin planted — rename it from the maximised Map. A Pin named \"Base\" beams you home while the Visor is worn.");
    this.lesson("pin");
    this.renderPinPanel();
    this.drawMap();
  }

  /** Q with a Tracker: reveal + mark the nearest never-found Landmark. */
  private useTracker() {
    const px = this.player.pos.x, pz = this.player.pos.z;
    const g = this.world.gen;
    const cands: { key: string; x: number; z: number; kind: string; label: string }[] = [];
    g.oases.forEach((o, i) => { if (!this.landmarkKnown(`oasis:${i}`, o.x, o.z)) cands.push({ key: `oasis:${i}`, x: o.x, z: o.z, kind: "oasis", label: "an Oasis" }); });
    g.canisters.forEach((c, i) => { if (!this.collected.has(i) && !this.revealed.has(`can:${i}`)) cands.push({ key: `can:${i}`, x: c.x, z: c.z, kind: "canister", label: "a Buried Canister site" }); });
    const scan = (L: number, at: (tx: number, tz: number) => boolean, mk: (tx: number, tz: number) => { x: number; z: number }, kind: string, label: string, span: number) => {
      const cx = Math.floor(px / L), cz = Math.floor(pz / L);
      for (let tx = cx - span; tx <= cx + span; tx++) for (let tz = cz - span; tz <= cz + span; tz++) {
        if (!at(tx, tz)) continue;
        const k = `${kind}:${tx},${tz}`, c = mk(tx, tz);
        if (!this.landmarkKnown(k, c.x, c.z)) cands.push({ key: k, x: c.x, z: c.z, kind, label });
      }
    };
    scan(TOWN_L, (tx, tz) => g.townAt(tx, tz), (tx, tz) => g.townCenter(tx, tz), "town", "a Town", 5);
    scan(CAMP_L, (tx, tz) => g.campAt(tx, tz), (tx, tz) => g.campCenter(tx, tz), "camp", "a Trader Camp", 4);
    scan(CAVE_MOUTH_L, (tx, tz) => g.mouthAt(tx, tz), (tx, tz) => g.mouthCenter(tx, tz), "mouth", "a Cave Mouth", 6);
    if (!cands.length) { hud.toast("The Tracker spins uselessly — every Landmark around you is already on your Map."); this.audio.error(); return; }
    let best = cands[0], bd = Infinity;
    for (const c of cands) { const d = (c.x - px) ** 2 + (c.z - pz) ** 2; if (d < bd) { bd = d; best = c; } }
    if (this.inv.removeItem("tracker", 1) !== 1) return;
    this.revealed.add(best.key);
    this.audio.savePing();
    hud.toast(`The Tracker wakes ${best.label} at ${best.x}, ${best.z} — marked on the Map.`);
    this.lesson("tracker");
    this.renderHeld();
    this.drawMap();
  }

  renderPinPanel() {
    const el = document.getElementById("map-pins");
    if (!el) return;
    if (!this.mapMax || this.pins.length === 0) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    el.innerHTML = `<h4>Pins</h4>` + this.pins.map((p) =>
      `<div class="pin-row"><input class="pin-name" data-id="${p.id}" maxlength="16" value="${p.name.replace(/"/g, "&quot;")}"><button data-del="${p.id}" title="pull this Pin">✕</button></div>`).join("");
  }

  private mapTile(cx: number, cz: number): { remembered: boolean; cv: HTMLCanvasElement } | null {
    const k = ckey(cx, cz);
    const loaded = this.world.chunks.has(k);
    if (!loaded && !this.visited.has(k)) return null; // never explored: the Map stays black
    const rev = this.world.revs.get(k) ?? 0;
    let t = this.tileCache.get(k);
    if (t && t.remembered === !loaded && (t.remembered || t.rev === rev)) return t;
    const cv = document.createElement("canvas");
    cv.width = CS; cv.height = CS;
    const g2 = cv.getContext("2d")!;
    if (loaded) {
      const c = this.world.chunks.get(k)!;
      for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
        let id = AIR, top = -1;
        for (let y = CH - 1; y >= 0; y--) { id = c[(lx * CS + lz) * CH + y]; if (id !== AIR) { top = y; break; } }
        if (top < 0) { g2.fillStyle = "#0a0c10"; g2.fillRect(lx, lz, 1, 1); continue; }
        const col = BLOCKS[id].color;
        const sh = 0.5 + 0.5 * Math.min(1, top / 34);
        g2.fillStyle = isWater(id) ? "#2f6fb8" : `rgb(${Math.round(col[0] * sh)},${Math.round(col[1] * sh)},${Math.round(col[2] * sh)})`;
        g2.fillRect(lx, lz, 1, 1);
      }
    } else {
      // remembered terrain: relief sketch from the height field alone
      const BIOME_RGB = [[150, 128, 86], [104, 92, 74], [150, 158, 156], [120, 84, 58], [88, 66, 52]];
      for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
        const wx = cx * CS + lx, wz = cz * CS + lz;
        const h = heightAt(this.seed, wx, wz);
        const base = BIOME_RGB[biomeAt(wx, wz, this.seed)] ?? BIOME_RGB[0];
        const sh = 0.45 + 0.55 * Math.min(1, Math.max(0, h / 40));
        g2.fillStyle = `rgb(${Math.round(base[0] * sh)},${Math.round(base[1] * sh)},${Math.round(base[2] * sh)})`;
        g2.fillRect(lx, lz, 1, 1);
      }
    }
    t = { remembered: !loaded, rev, cv };
    this.tileCache.set(k, t);
    return t;
  }

  private drawMap() {
    const wrap = document.getElementById("map"), cv = document.getElementById("map-canvas");
    if (!wrap || !(cv instanceof HTMLCanvasElement)) return;
    const visor = this.equip.head?.itemId === "visor";
    const hudOn = !document.getElementById("hud")!.classList.contains("hidden");
    if (!visor || this.ui || this.paused || this.cine || this.liftoff || !hudOn) {
      if (!wrap.classList.contains("hidden")) wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    const r = this.mapMax ? 120 : 40;
    const sc = this.mapMax ? Math.max(1, Math.min(4, Math.floor(Math.min(innerWidth, innerHeight) * 0.7 / (2 * r + 1)))) : 2;
    const size = (2 * r + 1) * sc;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const g2 = cv.getContext("2d")!;
    g2.fillStyle = "#0a0c10";
    g2.fillRect(0, 0, size, size);
    const px = Math.floor(this.player.pos.x), pz = Math.floor(this.player.pos.z);
    const x0 = px - r, z0 = pz - r;
    for (let cx = Math.floor(x0 / CS); cx <= Math.floor((x0 + 2 * r) / CS); cx++)
      for (let cz = Math.floor(z0 / CS); cz <= Math.floor((z0 + 2 * r) / CS); cz++) {
        const t = this.mapTile(cx, cz);
        if (!t) continue;
        const rx = (cx * CS - x0) * sc, rz = (cz * CS - z0) * sc;
        g2.drawImage(t.cv, rx, rz, CS * sc, CS * sc);
        if (t.remembered) { g2.fillStyle = "rgba(8,10,14,0.55)"; g2.fillRect(rx, rz, CS * sc, CS * sc); }
      }
    // Landmarks
    const lmColor: Record<string, string> = { ship: "#66e5f0", wreck: "#cc4433", town: "#d8b74f", camp: "#b48ad8", mouth: "#8a8f9a", oasis: "#41d878", canister: "#e08a4f" };
    for (const l of this.landmarkList(px, pz, r + 8)) {
      const mx = (l.x - x0) * sc, mz = (l.z - z0) * sc;
      if (mx < -4 || mz < -4 || mx > size + 4 || mz > size + 4) continue;
      g2.fillStyle = "#0a0c10";
      g2.beginPath(); g2.arc(mx, mz, 4.5, 0, 7); g2.fill();
      g2.fillStyle = lmColor[l.kind] ?? "#ffffff";
      g2.beginPath(); g2.arc(mx, mz, 3, 0, 7); g2.fill();
      if (this.mapMax) {
        g2.fillStyle = "#e8e0d0"; g2.font = "10px system-ui";
        g2.fillText(l.label, mx + 6, mz + 3);
      }
    }
    // Pins — gold, labelled when maximised
    g2.font = "10px system-ui";
    for (const p of this.pins) {
      const mx = (p.x - x0) * sc, mz = (p.z - z0) * sc;
      if (mx < -4 || mz < -4 || mx > size + 4 || mz > size + 4) continue;
      g2.fillStyle = "#0a0c10";
      g2.fillRect(mx - 4, mz - 4, 8, 8);
      g2.fillStyle = "#d8b74f";
      g2.fillRect(mx - 2.5, mz - 2.5, 5, 5);
      if (this.mapMax) { g2.fillStyle = "#f2e9c9"; g2.fillText(p.name, mx + 6, mz + 3); }
    }
    // you, at the centre: a heading arrow (map north = -Z)
    const yaw = this.player.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const ang = Math.atan2(fz, fx); // screen: x east, z south
    g2.save();
    g2.translate(size / 2, size / 2);
    g2.rotate(ang);
    g2.fillStyle = "#35e0ff";
    g2.beginPath(); g2.moveTo(6, 0); g2.lineTo(-4, -4); g2.lineTo(-4, 4); g2.closePath(); g2.fill();
    g2.restore();
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
      if (ke.code === "KeyQ") this.useItem();
      if (ke.code === "KeyX") this.surge();
      if (ke.code === "KeyT") this.toggleLantern();
      if (ke.code === "KeyM" && this.equip.head?.itemId === "visor" &&
          !this.ui && !this.paused && !this.cine && !this.liftoff &&
          !(document.activeElement instanceof HTMLInputElement)) {
        this.mapMax = !this.mapMax;
        this.renderPinPanel();
        this.drawMap();
        this.audio.place();
      }
      if (ke.code === "KeyI") this.toggleInv();
      if (ke.code === "KeyC" && this.ui === "inv") { this.invCraft = !this.invCraft; this.renderCraftTab(); }
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
      if (ke.code === "KeyR" && !this.ui && !this.paused && !this.cine && !this.liftoff) {
        // in the field: R turns a held rotatable block a quarter turn;
        // anything else is left alone (G throws it away)
        const s = this.inv.selectedSlot();
        if (s) {
          const blk = ITEMS[s.itemId].block;
          if (blk !== undefined && BLOCKS[blk].placeable && rotatable(blk)) {
            s.blockRot = ((s.blockRot ?? 0) + 1) & 3;
            this.renderHeld();
            this.audio.place();
          }
        }
      }
      if (ke.code === "KeyG" && !this.ui && !this.paused && !this.cine && !this.liftoff) this.dropHeld();
      if (ke.code === "Escape") {
        if (this.liftoff) return; // the Ship is mid-flight; nothing to close
        if (this.tut && !this.ui) { this.tut.finish(true); return; }
        this.escape();
      }
      if (ke.code === "KeyP" && !this.liftoff) this.escape(true);
      if (ke.code.startsWith("Digit")) {
        const n = Number(ke.code.slice(5));
        const hb = this.hotbarItems();
        if (n >= 1 && n <= hb.length) {
          const id = hb[n - 1];
          // pressing the number of the already-held item releases it
          if (this.inv.selectedSlot()?.itemId === id) this.inv.selected = -1;
          else this.selectItem(id);
          this.renderHeld();
        }
      }
    });
    on("keyup", (e) => this.keys.delete((e as KeyboardEvent).code));
    document.getElementById("surge-btn")!.onclick = () => this.surge();
    document.getElementById("btn-inv-craft")!.onclick = () => { this.invCraft = !this.invCraft; this.renderCraftTab(); };
    document.getElementById("hotbar")!.addEventListener("pointerdown", (e) => {
      const b = (e.target as HTMLElement).closest("[data-hb]");
      if (!b) return;
      const id = this.hotbarItems()[Number((b as HTMLElement).dataset.hb)];
      if (id) {
        if (this.inv.selectedSlot()?.itemId === id) this.inv.selected = -1; // tap held item = release it
        else this.selectItem(id);
        this.renderHeld();
      }
    });
    if (this.mobile) {
      // on touch, tapping panel chrome outside any slot deselects the held selection
      document.getElementById("ui-inventory")!.addEventListener("touchstart", (e) => {
        if (this.ui !== "inv" || this.inv.selected === -1) return;
        const t = e.target as HTMLElement;
        if (t.closest(".invcell, .equip-cell, #inv-temp, #inv-bin, button")) return;
        this.inv.selected = -1;
        this.renderInv();
      });
    }

    const canvas = this.renderer.canvasEl();
    if (!this.mobile) {
      on("click", () => { if (!this.paused && !this.ui) this.requestLock(); }, canvas);
      on("mousedown", (e) => {
        const me = e as MouseEvent;
        if (me.button === 0) { this.mouseDown = true; this.breakMsg = false; }
        else if (me.button === 2 && !this.cine) this.place(); // pointer lock suppresses contextmenu: place on the click itself
      });
      on("mouseup", () => { this.mouseDown = false; this.breaking = null; });
      on("mousemove", (e) => {
        if (document.pointerLockElement !== canvas || this.ui) return;
        const me = e as MouseEvent;
        this.player.yaw -= me.movementX * 0.0022 * this.settings.sens;
        this.player.pitch -= (this.settings.invertY ? -1 : 1) * me.movementY * 0.0022 * this.settings.sens;
        this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.55, 1.55);
      });
      on("wheel", (e) => { if (!this.ui) this.cycleItem((e as WheelEvent).deltaY > 0 ? 1 : -1); });
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
    mb("m-sprint", () => {
      this.sprintOn = !this.sprintOn;
      document.getElementById("m-sprint")!.classList.toggle("on", this.sprintOn);
    });
      mb("m-break", () => this.mouseDown = true, () => { this.mouseDown = false; this.breaking = null; });
      mb("m-place", () => this.place());
      mb("m-act", () => this.act());
      mb("m-use", () => this.useItem());
      mb("m-surge", () => this.surge());
      mb("m-lamp", () => this.toggleLantern());
      mb("m-next", () => this.cycleItem(1));
      mb("m-drop", () => this.dropHeld());
      mb("m-inv", () => this.toggleInv());
      mb("m-pause", () => this.escape());
    }
    // The Map widget: click/tap maximises it; the Pin panel renames and pulls Pins.
    on("click", () => {
      if (this.equip.head?.itemId !== "visor") return;
      this.mapMax = !this.mapMax;
      this.renderPinPanel();
      this.drawMap();
      this.audio.place();
    }, document.getElementById("map")!);
    {
      const pinsEl = document.getElementById("map-pins")!;
      on("pointerdown", (e) => e.stopPropagation(), pinsEl);
      on("keydown", (e) => e.stopPropagation(), pinsEl); // typing in a Pin name never moves the player
      on("click", (e) => {
        e.stopPropagation();
        const b = (e.target as HTMLElement).closest?.("button[data-del]") as HTMLButtonElement | null;
        if (!b) return;
        this.pins = this.pins.filter((p) => p.id !== Number(b.dataset.del));
        this.renderPinPanel();
        this.drawMap();
        this.audio.place();
      }, pinsEl);
      on("change", (e) => {
        const inp = e.target as HTMLInputElement;
        if (!inp.classList?.contains("pin-name")) return;
        const pin = this.pins.find((p) => p.id === Number(inp.dataset.id));
        if (!pin) return;
        pin.name = inp.value.trim() || `Pin ${pin.id}`;
        inp.blur(); // a hidden name field must never keep swallowing game keys
        if (pin.name.toLowerCase() === "base") hud.toast("A Pin named \"Base\": the Visor beams you back to it, from anywhere.");
        this.drawMap();
      }, pinsEl);
    }
    on("beforeunload", () => this.saveNow());
    // Browsers swallow the Escape keydown while pointer-locked (it exits the lock),
    // so losing the lock without UI open *is* the first Escape press: pause.
    on("pointerlockchange", () => {
      if (document.pointerLockElement) { this.lockAt = performance.now(); return; }
      // A lock acquired and dropped right after we (re)requested it is menu-close
      // flapping, not an Escape press — only a press after real quiet opens pause.
      if (this.running && !this.paused && !this.ui
        && performance.now() - this.escAt > 400 && performance.now() - Math.max(this.lockAt, this.relockAt) > 900) {
        this.paused = true;
        document.getElementById("screen-pause")!.classList.remove("hidden");
      }
    }, document);
    // Switching tabs pauses the game too - but only when no other menu is open.
    on("visibilitychange", () => {
      if (!document.hidden || !this.running || this.paused || this.ui) return;
      const vis = (id: string) => !document.getElementById(id)!.classList.contains("hidden");
      if (vis("screen-settings") || vis("screen-instructions") || vis("screen-death") || vis("screen-win")) return;
      this.paused = true;
      document.getElementById("screen-pause")!.classList.remove("hidden");
    }, document);
    // The Bin: click it to destroy the selected item, or drag anything onto it.
    document.getElementById("inv-bin")!.onclick = () => this.binDiscard();
  }

  /** Send one item down the Bin: gone for good, no drop, no undo. */
  private binDiscard() {
    if (this.temp) {
      const n = ITEMS[this.temp.itemId].name;
      this.temp = null; this.tempOrigin = null;
      hud.toast(`${n} goes into the Bin — gone for good.`);
      this.audio.place();
      this.renderInv(); this.renderHeld();
      return;
    }
    const tgt = this.gridFocus === "chest" && this.chestInv ? this.chestInv : this.inv;
    const s = tgt.selectedSlot();
    if (!s) { hud.toast("Select an item, then send it to the Bin."); this.audio.error(); return; }
    tgt.slots.splice(tgt.slots.indexOf(s), 1);
    this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
    hud.toast(`${ITEMS[s.itemId].name} goes into the Bin — gone for good.`);
    this.audio.place();
    this.renderInv(); this.renderHeld();
  }

  private overBin(cx: number, cy: number): boolean {
    const r = document.getElementById("inv-bin")!.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  // Pause-menu submenus (Settings, Catalog): closing them returns to the pause
  // menu with the mouse still free — the pointer is only re-grabbed on the way
  // out of the pause menu itself.
  pauseSubmenu: "settings" | "catalog" | "instructions" | "chronicle" | null = null;

  closePauseSubmenu() {
    if (!this.pauseSubmenu) return;
    const id = this.pauseSubmenu === "settings" ? "screen-settings"
      : this.pauseSubmenu === "catalog" ? "screen-catalog"
      : this.pauseSubmenu === "chronicle" ? "screen-chronicle" : "screen-instructions";
    document.getElementById(id)!.classList.add("hidden");
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
    // Settings / death / win / instructions own their own dismissal buttons;
    // Esc must not pause behind them.
    if (!hidden("screen-settings") || !hidden("screen-death") || !hidden("screen-win")
      || !hidden("screen-instructions")) return;
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

  relock() {
    if (!this.paused && !this.ui && !document.pointerLockElement) {
      this.relockAt = performance.now();
      this.requestLock();
    }
  }

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

    if (!this.ui && !this.cine) {
      let mx = this.stick.x, mz = -this.stick.y;
      if (this.keys.has("KeyW")) mz += 1;
      if (this.keys.has("KeyS")) mz -= 1;
      if (this.keys.has("KeyA")) mx -= 1;
      if (this.keys.has("KeyD")) mx += 1;
      const jump = this.keys.has("Space") || this.mobileJump;
      this.player.sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.sprintOn;
      this.player.update(dt, mx, mz, jump, this.speedMul, overencumbered);
      // landing a fall: the first 4 blocks are free; ~16 without armour is lethal
      if (this.player.lastFallDist > 0) {
        const fd = this.player.lastFallDist;
        this.player.lastFallDist = 0;
        if (!this.player.inWater && fd > FALL_GRACE) {
          const armor = 1 - (this.equip.body ? (ITEMS[this.equip.body.itemId].armor ?? 0) : 0);
          const dmg = (fd - FALL_GRACE) * FALL_DMG_PER_BLOCK * armor;
          this.survival.hurt(dmg, "fall");
          hud.hitFlash();
          this.audio.hurt();
          if (this.survival.health > 0 && dmg >= 10) hud.toast("You hit the ground hard.");
        }
      }
      const fr = (this.timeSec % DAY_SECONDS) / DAY_SECONDS;
      const sa = (fr - 0.25) * Math.PI * 2;
      const sunDir = kf.sunElev > 0
        ? (() => { const inv = 1 / Math.hypot(Math.cos(sa), kf.sunElev, 0.4); return { x: Math.cos(sa) * inv, y: kf.sunElev * inv, z: 0.4 * inv }; })()
        : null;
      this.stormShieldTick();
      this.survival.update(dt, this.world, this.player.pos, {
        sprinting: this.player.sprinting && (mx !== 0 || mz !== 0),
        overencumbered, biome, tSec: this.timeSec, sunElev: kf.sunElev, sunDir, inWater: this.player.inWater,
        warmth: this.fireWarmth(this.player.pos),
        regulator: (this.equip.regulator?.charges ?? 0) > 0,
        terrainH: (x, z) => heightAt(this.seed, x, z),
        stormShield: this.stormShieldOn,
        stormMul: this.equip.body && ITEMS[this.equip.body.itemId].stormResist ? 0.25 : 1,
      });
      // sandstorm: visuals follow the Survival intensity; announce the turn
      this.renderer.setStorm(this.survival.storm, this.survival.lastOpenSky);
      this.audio.setStorm(this.survival.storm);
      if (this.survival.storm > 0.5 && !this.stormToast) {
        this.stormToast = true; this.lesson("storm"); hud.toast("A Sandstorm rolls in — get out of the open."); this.audio.error();
      } else if (this.survival.storm < 0.3 && this.stormToast) {
        this.stormToast = false; hud.toast("The Sandstorm passes.");
      }
      // worn gear burns its charges: a coolant cell holds 2 game days, a lantern charge 4 hours
      const reg = this.equip.regulator;
      if (reg && (reg.charges ?? 0) > 0) {
        this.regulatorAcc += dt;
        if (this.regulatorAcc >= 48 * 60) {
          this.regulatorAcc = 0;
          reg.charges = (reg.charges ?? 0) - 1;
          if (reg.charges <= 0) { reg.charges = 0; hud.toast("The Coolant Cell in your Regulator is spent."); this.audio.error(); }
          else hud.toast("A Coolant Cell has been used up.");
        }
      }
      const lamp = this.equip.light;
      if (this.lanternOn && lamp) {
        if ((lamp.charges ?? 0) <= 0) this.toggleLantern();
        else {
          this.lanternAcc += dt;
          if (this.lanternAcc >= 4 * 60) {
            this.lanternAcc = 0;
            lamp.charges = (lamp.charges ?? 0) - 1;
            if ((lamp.charges ?? 0) <= 0) { this.toggleLantern(); hud.toast("The Head Lantern gutters out — refuel it at a Campfire."); }
          }
        }
      }
      this.updateBreaking(dt);
      this.updatePickups();
    }
    this.audio.heartbeat(dt, this.survival.health);

    if (this.cine) this.cineFrame(dt);
    else {
      const cam = this.renderer.camera;
      cam.position.copy(this.player.eye());
      cam.rotation.order = "YXZ";
      cam.rotation.set(this.player.pitch, this.player.yaw, 0);
      if (this.liftoff) {
        // the whole ravine rattles while the Ship climbs
        cam.position.x += (Math.random() - 0.5) * 0.14;
        cam.position.y += (Math.random() - 0.5) * 0.10;
        cam.position.z += (Math.random() - 0.5) * 0.14;
      }
    }
    this.liftoffFrame(dt);

    const target = this.raycastTarget();
    this.renderer.setPlayerLight(this.lanternOn ? this.player.eye() : null);
    this.renderer.setHighlight((this.ui || this.cine) ? null : (target?.hit ?? null));
    // a held placeable block shows a translucent preview of where it lands
    {
      const gs = this.inv.selectedSlot();
      const gblk = gs ? ITEMS[gs.itemId].block : undefined;
      const hit = target?.hit, face = target?.face;
      let shown = false;
      if (!this.ui && !this.cine && gblk !== undefined && BLOCKS[gblk].placeable && hit && face) {
        const gx = hit.x + face.x, gy = hit.y + face.y, gz = hit.z + face.z;
        const at = this.world.get(gx, gy, gz);
        if (at === AIR || (isWater(at) && at !== WATER)) { this.renderer.setGhost(gx, gy, gz, gblk); shown = true; }
      }
      if (!shown) this.renderer.clearGhost();
    }
    hud.setPrompt((this.ui || this.cine) ? null : this.promptFor(target));
    hud.setBlockName((this.ui || this.cine) || !target?.hit ? null
      : blockDisplayName(this.world.get(target.hit.x, target.hit.y, target.hit.z)));
    hud.setSubmerged(this.player.headUnder);

    for (let ei = this.entities.length - 1; ei >= 0; ei--) {
      const e = this.entities[ei];
      if (!e.buried) {
        e.age = (e.age ?? 0) + dt;
        if (e.age >= 300) {
          // five minutes on the sand and the desert reclaims the thing
          this.renderer.removeEntityMesh(e.id);
          this.entities.splice(ei, 1);
          continue;
        }
      }
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
        if (e.buried && e.srcIndex !== undefined) { this.lesson("canister"); this.revealed.add(`can:${e.srcIndex}`); }
        this.renderer.addEntityMesh(e.id, [e.x, e.y, e.z], parseInt(ITEMS[e.itemId].color.slice(1), 16));
      }
    }
    for (const c of this.caches) {
      const mesh = this.renderer.entityMesh(c.id);
      if (!mesh && c.items.length) {
        this.renderer.addEntityMesh(c.id, this.cacheMeshPos(c), this.cacheColor(c), 0.7);
        // every Cache is findable from far: a ground ring in its kind colour
        c.markerEid = this.renderer.addGroundRing(c.x + 0.5, c.y, c.z + 0.5,
          c.kind === "reward" ? 0xd8a24a : 0xcc3322, 1.4);
        // a Death Cache also throws a beam up to the sky — gone the moment it runs dry
        if (c.kind === "death") c.beamEid = this.renderer.addBeam(c.x + 0.5, c.y, c.z + 0.5, 0xcc3322);
      } else if (mesh && !c.items.length) {
        this.renderer.removeEntityMesh(c.id);
        if (c.markerEid !== undefined) { this.renderer.removeEntityMesh(c.markerEid); c.markerEid = undefined; }
        if (c.beamEid !== undefined) { this.renderer.removeEntityMesh(c.beamEid); c.beamEid = undefined; }
      }
    }
    this.regulatorGlow();
    this.updateCrops(dt);
    this.updateTrees(dt);
    if (!this.ui && !this.paused && !this.cine) this.cactusPrick();
    const surgeCool = this.survival.surgeCooldown > 0;
    for (const id of ["surge-btn", "m-surge"]) {
      const b = document.getElementById(id) as HTMLButtonElement | null;
      if (b && b.disabled !== surgeCool) b.disabled = surgeCool;
    }

    hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, now, {
      regulated: this.roomRegulated(),
      stormBroken: this.stormShieldOn,
      napReady: this.timeSec - this.lastSleep >= DAY_SECONDS,
    });
    this.podFrame(dt);
    this.questFrame();
    this.guideFrame(dt);
    this.tut?.tick(dt);
    this.mobFrame(dt);
    this.waterAcc += dt;
    if (this.waterAcc > 0.4) { this.waterAcc = 0; this.world.processWater(); }
    this.audio.setDay(kf.sunElev > 0);

    this.autosaveAcc += dt;
    if (this.autosaveAcc > 30) { this.autosaveAcc = 0; this.saveNow(); }

    const dhp = this.prevHp - this.survival.health;
    if (dhp > 0) {
      const onset = this.timeSec - this.lastDmgAt > 2.5;
      this.lastDmgAt = this.timeSec;
      if (dhp >= 2 || this.timeSec - this.lastHitFlash > 1.1) {
        this.lastHitFlash = this.timeSec;
        hud.hitFlash();
        if (dhp >= 2 || onset) this.audio.hurt(); // one-shot hits always; drains sound at onset only
      }
    }
    this.prevHp = this.survival.health;
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
    const dist = (v: number, s: number) => s > 0 ? (Math.ceil(v) - v || 1) : s < 0 ? (v - Math.floor(v) || 1) : Infinity;
    const tMax = new THREE.Vector3(dist(o.x, step.x) * tDelta.x, dist(o.y, step.y) * tDelta.y, dist(o.z, step.z) * tDelta.z);
    let prev = new THREE.Vector3(x, y, z);
    let water: { x: number; y: number; z: number } | null = null;
    for (let i = 0; i < 80; i++) {
      const id = this.world.get(x, y, z);
      if (isWater(id)) {
        if (!water) water = { x, y, z };
        // Flow is see-through; a Source is aimable, so pools can be emptied for good
        if (id === WATER) return { hit: { x, y, z }, water, face: new THREE.Vector3(prev.x - x, prev.y - y, prev.z - z) };
      }
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
    if (this.nearestTrader()) return "E: Trade with the Trader";
    if (!t) return null;
    if (t.hit && this.world.get(t.hit.x, t.hit.y, t.hit.z) === CHEST) return "E: Open Supply Chest";
    const near = this.nearestCache();
    if (near) return near.kind === "reward" ? "E: Claim Reward Cache" : "E: Open death cache";
    if (t.hit) {
      const id = this.world.get(t.hit.x, t.hit.y, t.hit.z);
      if (id === DOOR_CLOSED || id === DOOR_UPPER || id === DOOR_INNER || id === DOOR_INNER_UPPER) return "E: Open door";
      if (id === DOOR_OPEN || id === DOOR_INNER_OPEN) return "E: Close door";
      if (id === BEACON) return "E: Save game (respawn point)";
      if (id === BENCH || id === BENCH_EXT) return "E: Craft";
      if (id === ARMORY) return "E: Forge armour and gear";
      if (id === CAMPFIRE) return this.canHeatWater(t.hit.x, t.hit.y, t.hit.z) ? "E: Heat the water"
        : this.canFeed(t.hit.x, t.hit.y, t.hit.z) ? "E: Feed the fire" : "E: Smelt";
      if (id === REGULATOR) return "E: Draw neutral air (37 °C)";
      if (id === THRUSTER) return this.inv.has("thruster_nozzle", 1) ? "E: Install Thruster Nozzle" : null;
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
    const slot = this.inv.selectedSlot();
    // The Voidbreaker (cheat-menu only, never craftable) shatters anything:
    // tool tiers and "cannot break" blocks alike, on the first frame.
    if (slot && ITEMS[slot.itemId].instaBreak) return { ok: true, time: 0.01 };
    const def = BLOCKS[id];
    if (def.breakTime <= 0) return { ok: false, time: 0, why: "cannot break" };
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
    // a mob under the crosshair wins over the block behind it
    const mb = this.meleeMob();
    if (mb) {
      this.breaking = null; this.showBreakBar(null);
      if (this.attackCd <= 0) {
        this.attackCd = 0.5;
        const sel = this.inv.selectedSlot();
        const it = sel ? ITEMS[sel.itemId] : null;
        const weapon = it?.weapon;
        mb.hp -= weapon ? weapon.dmg : 3 + (it?.tool?.tier ?? 0);
        mb.hitFlash = 0.18;
        this.audio.thud();
        const kx = mb.x - this.player.pos.x, kz = mb.z - this.player.pos.z;
        const kl = Math.max(0.2, Math.hypot(kx, kz));
        const kb = weapon ? 1.1 : 0.6;
        if (this.mobCanStand(mb, mb.x + (kx / kl) * kb, mb.z + (kz / kl) * kb)) { mb.x += (kx / kl) * kb; mb.z += (kz / kl) * kb; mb.y = this.mobGround(mb, mb.x, mb.z); }
        if (mb.hp <= 0) this.killMob(mb);
      }
      return;
    }
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
      // the Chronicle nags before a Husk comes down: it drops only the frame,
      // and the repair needs a Bench — break it without paying and the machine is lost
      if (id === REGULATOR_HUSK || id === STORM_BREAKER_HUSK) this.lesson("husk");
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
    this.tut?.notify("mine");
    const id = this.world.get(x, y, z);
    this.codex.add("b:" + id); // the Codex teaches what you have broken once
    this.questBump("mine");
    if (isDoorHalf(id) || id === DOOR_OPEN || id === DOOR_INNER_OPEN) {
      const inner = id === DOOR_INNER || id === DOOR_INNER_UPPER || id === DOOR_INNER_OPEN;
      this.world.set(x, y, z, AIR);
      for (const dy of [-1, 1]) {
        const n = this.world.get(x, y + dy, z);
        if (isDoorHalf(n) || n === DOOR_OPEN || n === DOOR_INNER_OPEN) this.world.set(x, y + dy, z, AIR);
      }
      this.giveOrDrop(inner ? "door_inner" : "door", 1);
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
    if (id === CACTUS) {
      // every cactus column block carries fruit: one Prickly Pear plus the block itself
      this.world.set(x, y, z, AIR);
      this.giveOrDrop("prickly_pear", 1);
      this.giveOrDrop("cactus", 1);
      this.audio.blockBreak();
      return;
    }
    if (id === CACTUS_FRUIT) {
      this.world.set(x, y, z, AIR);
      this.giveOrDrop("prickly_pear", 2);
      this.giveOrDrop("cactus", 1);
      this.audio.blockBreak();
      return;
    }
    if (id === SAPLING) {
      this.world.set(x, y, z, AIR);
      this.trees.delete(`${x},${y},${z}`);
      this.giveOrDrop("seed_tree", 1); // the seed comes back
      this.audio.blockBreak();
      return;
    }
    if (id === MELON_2 || id === MELON_1 || id === WHEAT_2 || id === WHEAT_1) {
      // breaking a crop by hand or tool yields its harvest too — rougher than
      // picking it (E) but never a wasted plant
      this.world.set(x, y, z, AIR); // wheat sits ON farmland: breaking it must not stack a second tilled block
      this.crops.delete(`${x},${y},${z}`);
      if (id === MELON_2) this.giveOrDrop("dune_melon", 1);
      if (id === WHEAT_2) { this.giveOrDrop("wheat", 1); this.giveOrDrop("seed_wheat", 1); }
      if (id === MELON_1) this.giveOrDrop("seed_melon", 1);
      if (id === WHEAT_1) this.giveOrDrop("seed_wheat", 1); // unripe wheat: just the seed
      this.audio.blockBreak();
      return;
    }
    if (id === LEAVES) {
      this.world.set(x, y, z, AIR);
      this.giveOrDrop("kindling", 1);
      if (hash2(x + 7 * z, y, this.seed + 91) < 0.2) this.giveOrDrop("seed_tree", 1); // canopy sheds seeds: farms renew
      this.audio.blockBreak();
      return;
    }
    if (id === BED || id === BED_EXT) {
      // a bed is a pair: breaking either half removes the whole bed, in
      // whichever direction the pillow half was turned
      this.world.set(x, y, z, AIR);
      const peer = this.bedPeer(x, y, z);
      if (peer) this.world.set(peer[0], peer[1], peer[2], AIR);
      this.giveOrDrop("bed", 1);
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
        if (!groups.some(([, gi]) => Game.placeSlotFree(gi, sl))) { this.dropEntity(sl.itemId, 1, 2, sl.charges); spilled = true; }
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
    if (id === LAMP || id === CAMPFIRE || id === THRUSTER_LIT) this.renderer.removePointLight(x, y, z);
    if (id === STORM_BREAKER) this.breakers.delete(`${x},${y},${z}`);
    this.world.set(x, y, z, AIR);
    const item = this.blockItemId(id);
    if (item) this.giveOrDrop(item, 1);
    this.audio.blockBreak();
  }

  // ---------- desert wildlife ----------

  /** Highest solid block top at this column, or -1 over the void. */
  private mobSurface(x: number, z: number): number {
    const fx = Math.floor(x), fz = Math.floor(z);
    const top = Math.max(30, Math.round(heightAt(this.seed, fx, fz)) + 8);
    for (let y = top; y >= 0; y--) {
      const id = this.world.get(fx, y, fz);
      if (id !== AIR && BLOCKS[id].solid) return y + 1;
    }
    return -1;
  }

  /** Ground the mob stands on in this column. Cave fauna walks on its Cave floor,
   *  never gets yanked up to the surface: scan down from the mob's own feet cell. */
  private mobGround(m: Mob, x: number, z: number): number {
    if (m.kind !== "scorpion" && m.kind !== "wurm") return this.mobSurface(x, z);
    const fx = Math.floor(x), fz = Math.floor(z);
    for (let y = Math.floor(m.y); y >= 0; y--) {
      const id = this.world.get(fx, y, fz);
      if (id !== AIR && BLOCKS[id].solid) return y + 1;
    }
    return -1;
  }

  /** Can this mob stand at (x,z): floor within one step climb, headroom above it? */
  private mobCanStand(m: Mob, x: number, z: number): boolean {
    const gy = this.mobGround(m, x, z);
    if (gy < 0 || gy > m.y + 1.01) return false;
    return this.world.get(Math.floor(x), gy, Math.floor(z)) === AIR;
  }

  private spawnMob(kind: MobKind, x: number, y: number, z: number) {
    const vis = makeMobMesh(kind);
    vis.group.position.set(x, y, z);
    vis.group.rotation.y = Math.random() * Math.PI * 2;
    this.renderer.addSceneObject(vis.group);
    const m: Mob = {
      kind, hp: MOB_DEFS[kind].hp, x, y, z, homeX: x, homeZ: z, yaw: vis.group.rotation.y,
      biteCd: 0, wanderT: Math.random() * 3, wanderYaw: Math.random() * Math.PI * 2, wanderOn: false,
      flyBase: 5 + Math.random() * 4, bank: Math.random() < 0.5 ? -1 : 1, vis,
    };
    if (kind === "vulture") { m.y += m.flyBase; vis.group.position.y = m.y; } // born in the air
    this.mobs.push(m);
  }

  private killMob(m: Mob) {
    this.renderer.removeSceneObject(m.vis.group);
    this.mobs = this.mobs.filter((x) => x !== m);
    const def = MOB_DEFS[m.kind];
    def.drops.forEach((d, i) => {
      const p = def.dropChance?.[i] ?? 1;
      if (p >= 1 || Math.random() < p) this.giveOrDrop(d.itemId, d.count);
    });
    hud.toast(`${def.name} killed.`);
  }

  /** Keep the desert stocked: a stable surface community (snakes, rats,
   *  vultures, tortoises, fennecs) and the Caves' own fauna — up to 4 Dust
   *  Scorpions and a lone Sand Wurm, spawned only while you are down in
   *  them. Traders are not spawned by chance: each Trader Camp within reach
   *  gets exactly one, and it never despawns while you keep coming back. */
  private topUpMobs() {
    const targets: Record<MobKind, number> = { snake: 4, rat: 8, scorpion: 4, wurm: 1, trader: 0, vulture: 3, tortoise: 2, fennec: 2 };
    const counts: Record<MobKind, number> = { snake: 0, rat: 0, scorpion: 0, wurm: 0, trader: 0, vulture: 0, tortoise: 0, fennec: 0 };
    // anything strayed far from the player gives its slot back — except a Trader
    const p0 = this.player.pos;
    this.mobs = this.mobs.filter((m) => {
      if (m.kind !== "trader" && Math.abs(m.x - p0.x) + Math.abs(m.z - p0.z) > 190) { this.renderer.removeSceneObject(m.vis.group); return false; }
      return true;
    });
    for (const m of this.mobs) counts[m.kind]++;
    const p = this.player.pos;
    for (const kind of ["snake", "rat", "scorpion", "wurm", "vulture", "tortoise", "fennec"] as MobKind[]) {
      const underground = kind === "scorpion" || kind === "wurm";
      if (underground && p.y > 27) continue; // the deep fauna only stirs when you are down there
      while (counts[kind] < targets[kind]) {
        counts[kind]++; // every attempt, successful or not, spends a slot this round
        const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 30;
        const x = Math.floor(p.x + Math.cos(a) * r) + 0.5, z = Math.floor(p.z + Math.sin(a) * r) + 0.5;
        if (!underground) {
          if (Math.hypot(x, z) < 24) continue; // keep the crash site quiet
          if (this.beaconMarks.some((b) => Math.hypot(b.x + 0.5 - x, b.z + 0.5 - z) < 16)) continue; // save points stay safe
          const camp = structuresOf(this.seed).nearestCamp(x, z);
          if (camp && Math.hypot(camp.x - x, camp.z - z) < 34) continue; // camps are the Trader's patch
          const gy = this.mobSurface(x, z);
          if (gy <= 1 || this.world.get(Math.floor(x), gy, Math.floor(z)) !== AIR ||
              this.world.get(Math.floor(x), gy + 1, Math.floor(z)) !== AIR) continue;
          this.spawnMob(kind, x, gy, z);
        } else {
          const lo = kind === "wurm" ? 5 : 8, hi = kind === "wurm" ? 16 : 24;
          const gy = this.caveSpot(x, z, lo, hi);
          if (gy < 0) continue;
          this.spawnMob(kind, x, gy, z);
        }
      }
    }
    this.ensureTraders();
  }

  /** One immovable Trader standing in front of each nearby camp's stall. */
  private ensureTraders() {
    const stx = structuresOf(this.seed);
    const p = this.player.pos, R = 110;
    const tx0 = Math.floor((p.x - R) / CAMP_L), tx1 = Math.floor((p.x + R) / CAMP_L);
    const tz0 = Math.floor((p.z - R) / CAMP_L), tz1 = Math.floor((p.z + R) / CAMP_L);
    for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) {
      if (!stx.campAt(tx, tz)) continue;
      const c = stx.campCenter(tx, tz);
      if (Math.hypot(c.x - p.x, c.z - p.z) > R) continue;
      const key = tx + "," + tz;
      const cur = this.traderAt.get(key);
      if (cur && this.mobs.includes(cur)) continue;
      const spot = campTraderSpot(c);
      const gy = this.mobSurface(spot.x, spot.z);
      if (gy <= 1) continue; // camp chunks not streamed in yet — next round
      this.spawnMob("trader", spot.x, gy, spot.z);
      this.traderAt.set(key, this.mobs[this.mobs.length - 1]);
    }
    if (this.traderAt.size) {
      for (const [key, m] of this.traderAt) if (!this.mobs.includes(m)) this.traderAt.delete(key);
    }
  }

  /** The Trader you are standing in front of, if any. */
  private nearestTrader(): Mob | null {
    const p = this.player.pos;
    let best: Mob | null = null, bd = 3.6;
    for (const m of this.mobs) {
      if (m.kind !== "trader") continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // ---------- Trader barter ----------
  // No coin: every offer swaps goods, five per camp per day, deterministic —
  // leave and come back the same in-game day and the table is identical.

  private openTrade(trader: Mob) {
    const camp = structuresOf(this.seed).nearestCamp(trader.x, trader.z);
    this.tradeCamp = camp ? { x: camp.x, z: camp.z } : { x: trader.x, z: trader.z };
    this.tradeOffers = offersFor(this.seed, this.tradeCamp.x, this.tradeCamp.z, this.dayNumber());
    this.ui = "trade";
    this.unlockPointer();
    this.renderTrade();
    document.getElementById("ui-trade")!.classList.remove("hidden");
    this.audio.pickup();
  }

  private renderTrade() {
    const box = document.getElementById("trade-offers")!;
    box.innerHTML = "";
    for (let i = 0; i < this.tradeOffers.length; i++) {
      const o = this.tradeOffers[i];
      const row = document.createElement("div");
      row.className = "trade-row";
      const side = (list: { itemId: string; count: number }[]) =>
        list.map((w) => `<span class="trade-item">${ITEMS[w.itemId].name}${w.count > 1 ? " ×" + w.count : ""}</span>`).join(" + ");
      row.innerHTML = `<span class="trade-side want">${side(o.want)}</span><span class="trade-arrow">→</span><span class="trade-side give">${side(o.give)}</span>`;
      const b = document.createElement("button");
      b.textContent = "Trade";
      b.onclick = () => this.trade(i);
      row.appendChild(b);
      box.appendChild(row);
    }
    (document.getElementById("trade-note")!).textContent =
      `Day ${this.dayNumber()} — the Trader restocks the table at every dawn.`;
  }

  private trade(i: number) {
    if (this.ui !== "trade") return;
    const o = this.tradeOffers[i];
    for (const w of o.want) {
      if (!this.inv.has(w.itemId, w.count)) {
        hud.toast(`You don't have ${w.count} × ${ITEMS[w.itemId].name}.`);
        this.audio.error();
        return;
      }
    }
    for (const w of o.want) this.inv.removeItem(w.itemId, w.count);
    for (const g of o.give) this.giveOrDrop(g.itemId, g.count);
    hud.toast("Traded.");
    this.audio.drink();
    this.renderTrade();
  }

  /** A floor cell inside a Cave between lo..hi: solid ground, two clear head
   *  cells, and rock within three blocks above — a proper cave dweller's pocket. */
  private caveSpot(x: number, z: number, lo: number, hi: number): number {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let y = hi; y >= lo; y--) {
      if (this.world.get(bx, y, bz) !== AIR) continue;
      if (this.world.get(bx, y - 1, bz) === AIR) continue;            // needs a floor
      if (this.world.get(bx, y + 1, bz) !== AIR) continue;            // needs headroom
      let roof = -1;
      for (let d = 1; d <= 3; d++) if (isSolid(this.world.get(bx, y + d, bz))) { roof = d; break; }
      if (roof < 0) continue;                                         // open shaft — not a cave pocket
      return y;
    }
    return -1;
  }

  /** The mob nearest the crosshair within reach, if no block is closer. A held weapon extends reach. */
  private meleeMob(): Mob | null {
    const o = this.player.eye();
    const dir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(dir);
    const sel = this.inv.selectedSlot();
    const reach = sel ? (ITEMS[sel.itemId].weapon?.reach ?? 3.2) : 3.2;
    const blk = this.raycastTarget();
    const blockDist = blk?.hit
      ? Math.hypot(blk.hit.x + 0.5 - o.x, blk.hit.y + 0.5 - o.y, blk.hit.z + 0.5 - o.z)
      : Infinity;
    let best: Mob | null = null, bestT = Infinity;
    for (const m of this.mobs) {
      if (m.kind === "trader") continue; // you cannot pick a fight with the Trader
      const def = MOB_DEFS[m.kind];
      const cx = m.x - o.x, cy = m.y + def.height / 2 - o.y, cz = m.z - o.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0.2 || t > reach || t > blockDist) continue;
      const px = o.x + dir.x * t - m.x, py = o.y + dir.y * t - (m.y + def.height / 2), pz = o.z + dir.z * t - m.z;
      if (px * px + py * py + pz * pz > (def.hitR + 0.3) * (def.hitR + 0.3)) continue;
      if (t < bestT) { bestT = t; best = m; }
    }
    return best;
  }

  /** True when every whole block column cell between (x,z; y0..y1) is passable. */
  private columnClear(x: number, z: number, y0: number, y1: number): boolean {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
      const id = this.world.get(bx, y, bz);
      if (id !== AIR && id !== WATER) return false;
    }
    return true;
  }

  private mobFrame(dt: number) {
    this.attackCd -= dt;
    this.mobSpawnAcc += dt;
    if (this.mobSpawnAcc > 4) { this.mobSpawnAcc = 0; this.topUpMobs(); }
    const p = this.player.pos, t = this.timeSec;
    for (const m of this.mobs.slice()) {
      const def = MOB_DEFS[m.kind];
      // damage feedback: swap the visual to red while hitFlash ticks down
      if (m.hitFlash) m.hitFlash = Math.max(0, m.hitFlash - dt);
      const flashing = (m.hitFlash ?? 0) > 0;
      if (flashing !== (m.flashOn ?? false)) { m.vis.setFlash(flashing); m.flashOn = flashing; }
      // a Trader paces its stall — a slow beat within a few blocks of the
      // awning, never far from the spot it was placed at — and keeps an
      // eye on whoever is bargaining with it
      if (m.kind === "trader") {
        let moving = 0;
        if (this.ui === "trade" && this.tradeCamp &&
            Math.hypot(m.x - this.tradeCamp.x, m.z - this.tradeCamp.z) < 10) {
          m.yaw = Math.atan2(p.x - m.x, p.z - m.z); // turn to the customer
        } else {
          const hx = m.x - m.homeX, hz = m.z - m.homeZ;
          const hd = Math.hypot(hx, hz);
          m.wanderT -= dt;
          if (m.wanderT <= 0) { m.wanderT = 3 + Math.random() * 5; m.wanderYaw = Math.random() * Math.PI * 2; m.wanderOn = Math.random() < 0.5; }
          if (m.wanderOn || hd > 4.5) {
            const wy = hd > 4.5 ? Math.atan2(-hx, -hz) : m.wanderYaw; // past the leash: walk back
            const vx = Math.sin(wy) * def.speed * 0.45, vz = Math.cos(wy) * def.speed * 0.45;
            m.yaw = wy;
            const nx = m.x + vx * dt, nz = m.z + vz * dt;
            if (this.mobCanStand(m, nx, nz) && Math.hypot(nx - m.homeX, nz - m.homeZ) <= 5) { m.x = nx; m.z = nz; moving = 1; }
            else m.wanderYaw = m.yaw = Math.atan2(m.homeX - m.x, m.homeZ - m.z);
          }
        }
        m.y = this.mobGround(m, m.x, m.z);
        m.vis.group.position.set(m.x, m.y, m.z);
        m.vis.group.rotation.y = m.yaw;
        m.vis.animate(t, moving);
        continue;
      }
      if (m.kind === "vulture") { this.vultureFrame(m, p, t, dt); continue; }
      const dx = p.x - m.x, dz = p.z - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 110) { this.renderer.removeSceneObject(m.vis.group); this.mobs = this.mobs.filter((x) => x !== m); continue; }
      let vx = 0, vz = 0;
      // a snake can only reach you through open column between its head and your
      // feet: one lurking under the floor you stand on stays lurking
      const canReach = this.columnClear(m.x, m.z, m.y + 0.2, p.y + 1.4);
      const aggroR = def.aggroR;
      const fleeR = def.fleeR;
      if (aggroR > 0 && dist < aggroR && dist > 0.01 && canReach) {
        vx = (dx / dist) * def.speed; vz = (dz / dist) * def.speed;
        m.yaw = Math.atan2(vx, vz);
        if (dist < 1.2 + def.hitR && m.biteCd <= 0) {
          m.biteCd = def.biteCd;
          const armor = 1 - (this.equip.body ? (ITEMS[this.equip.body.itemId].armor ?? 0) : 0);
          this.survival.hurt(def.biteDmg * armor, `${def.name.toLowerCase()} bite`);
          hud.toast(armor < 1 ? `A ${def.name.toLowerCase()} bites you — the armour soaks some of it.` : `A ${def.name.toLowerCase()} bites you!`);
        }
      } else if (fleeR > 0 && dist < fleeR && dist > 0.01) {
        vx = (-dx / dist) * def.speed; vz = (-dz / dist) * def.speed;
        m.yaw = Math.atan2(vx, vz);
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = 2 + Math.random() * 4; m.wanderYaw = Math.random() * Math.PI * 2; m.wanderOn = Math.random() < 0.55; }
        if (m.wanderOn) { vx = Math.sin(m.wanderYaw) * def.speed * 0.35; vz = Math.cos(m.wanderYaw) * def.speed * 0.35; m.yaw = m.wanderYaw; }
      }
      m.biteCd -= dt;
      let moving = 0;
      if (vx !== 0 || vz !== 0) {
        const nx = m.x + vx * dt, nz = m.z + vz * dt;
        if (this.mobCanStand(m, nx, nz)) { m.x = nx; m.z = nz; moving = 1; }
        else m.wanderYaw = m.yaw = Math.random() * Math.PI * 2; // walk into a wall -> pick a new direction
      }
      m.y = this.mobGround(m, m.x, m.z);
      m.vis.group.position.set(m.x, m.y, m.z);
      m.vis.group.rotation.y = m.yaw;
      m.vis.animate(t, moving);
    }
  }

  /** Soaring Sand Vulture: it cruises 5–9 m over the dunes in slow banked
   *  circles, never walks the sand, and only drops down to strike prey that
   *  is already bleeding. Fleeing stays airborne; obstacles at flight height
   *  bank the circle away instead of climbing the slope. */
  private vultureFrame(m: Mob, p: { x: number; y: number; z: number }, t: number, dt: number): void {
    const def = MOB_DEFS[m.kind];
    const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
    if (dist > 110) { this.renderer.removeSceneObject(m.vis.group); this.mobs = this.mobs.filter((x) => x !== m); return; }
    let vx = 0, vz = 0, bank = 0, targetY: number;
    const surf = this.mobSurface(m.x, m.z);
    // Cowards: they only commit to prey that is already bleeding.
    if (this.survival.health < 60 && dist < 14 && dist > 0.01) {
      // committed: come down onto the sand and close in
      targetY = this.mobGround(m, m.x, m.z);
      vx = (dx / dist) * def.speed; vz = (dz / dist) * def.speed;
      m.yaw = Math.atan2(vx, vz);
      if (dist < 1.2 + def.hitR && m.biteCd <= 0 && m.y <= targetY + 0.6) {
        m.biteCd = def.biteCd;
        const armor = 1 - (this.equip.body ? (ITEMS[this.equip.body.itemId].armor ?? 0) : 0);
        this.survival.hurt(def.biteDmg * armor, "sand vulture strike");
        hud.toast(armor < 1 ? "A sand vulture strikes you — the armour soaks some of it." : "A sand vulture strikes!");
      }
    } else if (dist < def.fleeR && dist > 0.01) {
      // spooked: airborne away, gaining height
      targetY = surf + m.flyBase + 2;
      vx = (-dx / dist) * def.speed; vz = (-dz / dist) * def.speed;
      m.yaw = Math.atan2(vx, vz);
    } else {
      // thermalling: one slow banked circle until it picks another
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = 6 + Math.random() * 6; m.bank = Math.random() < 0.5 ? -1 : 1; }
      m.wanderYaw += m.bank * 0.45 * dt;
      vx = Math.sin(m.wanderYaw) * def.speed * 0.6; vz = Math.cos(m.wanderYaw) * def.speed * 0.6;
      m.yaw = m.wanderYaw;
      targetY = surf + m.flyBase + Math.sin(t * 0.13 + m.homeX * 0.7) * 1.2;
      bank = m.bank;
    }
    m.biteCd -= dt;
    if (vx !== 0 || vz !== 0) {
      const nx = m.x + vx * dt, nz = m.z + vz * dt;
      // clear-cell at flight height instead of mobCanStand: dune or butte
      // rising into the path turns the bird instead of shoving it uphill
      if (this.mobSurface(nx, nz) + 1.8 < m.y) { m.x = nx; m.z = nz; }
      else { m.bank = -m.bank; m.wanderYaw = m.yaw = m.yaw + bank * 0.4; }
    }
    const rise = targetY - m.y;
    m.y += Math.max(-2.5 * dt, Math.min(2.2 * dt, rise));
    m.vis.group.position.set(m.x, m.y, m.z);
    m.vis.group.rotation.y = m.yaw;
    // visible wing-drop through the turn
    const tilt = bank * 0.3;
    m.vis.group.rotation.z += (tilt - m.vis.group.rotation.z) * Math.min(1, dt * 3);
    m.vis.animate(t, vx !== 0 || vz !== 0 ? 1 : 0);
  }

  // ---------- Armour Slots: equip / unequip ----------

  /** Would every currently-held item fit an w×h grid? (Backpack shrink guard.) */
  private gridFits(w: number, h: number): boolean {
    const probe = new Inventory();
    probe.slots = [];
    probe.w = w; probe.h = h;
    for (const s of this.inv.slots) if (!Game.placeSlotFree(probe, { ...s, x: 0, y: 0 })) return false;
    return true;
  }

  private bagSize(): { w: number; h: number; kg: number } {
    const b = this.equip.backpack ? ITEMS[this.equip.backpack.itemId].bag : null;
    return b ?? { w: 5, h: 4, kg: 0 };
  }

  private applyEquip() {
    const b = this.bagSize();
    if (this.inv.w !== b.w || this.inv.h !== b.h)
      this.inv.setBackpack(b.w, b.h, b.kg);
    if (this.inv.selected >= this.inv.slots.length) this.inv.selected = 0;
    // a slot that no longer fits after a shrink lands on the sand, fuel and all
    while (this.inv.droppedOnResize.length) {
      const s = this.inv.droppedOnResize.shift()!;
      this.dropEntity(s.itemId, 1, 2, s.charges);
    }
    this.renderInv();
  }

  private equipItem() {
    const sel = this.inv.selectedSlot();
    if (!sel) return;
    const d = ITEMS[sel.itemId];
    if (!d.equip) return;
    const slot = d.equip;
    const prev = this.equip[slot];
    // swapping out old gear puts it back in the pack — refuse if it would not fit
    if (prev && !this.inv.addSlot(prev)) {
      hud.toast("No room in your pack for the gear you are taking off.");
      this.audio.error();
      return;
    }
    this.inv.slots.splice(this.inv.slots.indexOf(sel), 1);
    if (slot === "light") this.lanternOn = false; // the new lamp starts cold
    if ((slot === "light" || slot === "regulator") && sel.charges === undefined) sel.charges = 0;
    this.equip[slot] = sel;
    this.applyEquip();
    this.audio.pickup();
    hud.toast(`${d.name} equipped in the ${slot} slot.`);
  }

  private unequipSlot(slot: "backpack" | "head" | "body" | "regulator" | "light") {
    const it = this.equip[slot];
    if (!it) return;
    // when the pack comes off, contents must fit the base 5×4 grid it shrinks to
    const b = slot === "backpack" ? { w: 5, h: 4 } : this.bagSize();
    if (!this.gridFits(b.w, b.h)) {
      hud.toast("Your pack is too full — make room before taking it off.");
      this.audio.error();
      return;
    }
    this.equip[slot] = null;
    if (slot === "light") this.lanternOn = false;
    this.applyEquip(); // grid may shrink to 5×4 before the item lands back in it
    this.inv.addSlot(it); // same Slot object — fuel charges ride along
    this.audio.place();
    hud.toast(`${ITEMS[it.itemId].name} taken off.`);
    this.renderInv(); // the item is only in the grid after applyEquip resized it
  }

  /** The other half of a two-block Crafting Bench, or null. */
  private benchPeer(x: number, y: number, z: number): [number, number, number] | null {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const id = this.world.get(x + dx, y, z + dz);
      if (id === BENCH || id === BENCH_EXT) return [x + dx, y, z + dz];
    }
    return null;
  }

  /** The other half of a two-block Bed, in whichever direction it was turned. */
  private bedPeer(x: number, y: number, z: number): [number, number, number] | null {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const id = this.world.get(x + dx, y, z + dz);
      if (id === BED || id === BED_EXT) return [x + dx, y, z + dz];
    }
    return null;
  }

  private blockItemId(id: number): string | null {
    return BLOCK_TO_ITEM[id] ?? null;
  }

  giveOrDrop(itemId: string, count: number) {
    const left = this.inv.addItem(itemId, count);
    if (left > 0) {
      this.dropEntity(itemId, left);
      hud.toast(`No room: dropped ${ITEMS[itemId].name}`);
    }
  }

  /** Toss the held item onto the sand in front of you (G key, Drop button). */
  private dropHeld() {
    const s = this.inv.selectedSlot();
    if (!s) return;
    this.inv.slots.splice(this.inv.selected, 1);
    this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
    this.dropEntity(s.itemId, 1, 1, s.charges);
    this.renderHeld();
    this.audio.place();
  }

  /** Drop items in front of the player; if that lands inside geometry, try other
   *  sides, then the feet. Manual drops get a short auto-pickup cooldown. */
  private dropEntity(itemId: string, count: number, cooldown = 0, charges?: number) {
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
    for (let i = 0; i < count; i++) {
      // spread multiple drops a little so they do not render as one lump
      const jx = i === 0 ? 0 : 0.3 * Math.sin(i * 2.4), jz = i === 0 ? 0 : 0.3 * Math.cos(i * 2.4);
      this.entities.push({
        id: this.entitySeq++, x: p.x + dx + jx, y: p.y + 0.35, z: p.z + dz + jz, itemId, charges,
        repickAt: dx === 0 && dz === 0 ? this.timeSec + Math.max(cooldown, 2.5) : this.timeSec + cooldown,
      });
    }
  }

  private place() {
    if (this.ui || this.paused) return;
    const slot = this.inv.selectedSlot();
    if (!slot) return;
    if (slot.itemId === "bucket") { this.bucketScoop(); return; }
    if (slot.itemId === "bucket_full") { this.bucketPour(); return; }
    const def = ITEMS[slot.itemId];
    if (def.block === undefined) { hud.toast("Not a placeable block"); this.audio.error(); return; }
    // raw materials (iron ore, scrap chunks) never stand as building blocks
    if (!BLOCKS[def.block].placeable) { hud.toast(`${def.name} is raw material, not a block to place.`); this.audio.error(); return; }
    const t = this.raycastTarget();
    if (!t?.hit) return;
    const bx = t.hit.x + t.face.x, by = t.hit.y + t.face.y, bz = t.hit.z + t.face.z;
    // blocks go into flowing water and push it out; still Sources stay whole
    const at = this.world.get(bx, by, bz);
    if (at !== AIR && !(isWater(at) && at !== WATER)) return;
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
    // the Crafting Bench stands two blocks wide: the open neighbour sits where
    // the held rotation points (R turns it before you place)
    let benchPeer: [number, number, number] | null = null;
    const floorAt = (x: number, y: number, z: number) => isSolid(this.world.get(x, y - 1, z));
    const inPlayer = (bx: number, by: number, bz: number) => {
      const p = this.player.pos;
      return bx + 1 > p.x - 0.3 && bx < p.x + 0.3 && bz + 1 > p.z - 0.3 && bz < p.z + 0.3 && by + 1 > p.y && by < p.y + 1.8;
    };
    if (def.block === BENCH) {
      const [dx, dz] = ROT_DIRS[(slot.blockRot ?? 0) & 3];
      const nx = bx + dx, nz = bz + dz;
      if (this.world.get(nx, by, nz) !== AIR) { hud.toast("The Bench's far half has no room there — press R to turn it."); this.audio.error(); return; }
      if (!floorAt(nx, by, nz)) { hud.toast("The Bench's far half needs solid ground under it."); this.audio.error(); return; }
      if (inPlayer(nx, by, nz)) { hud.toast("Step out of the Bench's footprint first."); this.audio.error(); return; }
      benchPeer = [nx, by, nz];
    }
    let bedPeer: [number, number, number] | null = null;
    if (def.block === BED) {
      const [dx, dz] = ROT_DIRS[(slot.blockRot ?? 0) & 3];
      const nx = bx + dx, nz = bz + dz;
      if (this.world.get(nx, by, nz) !== AIR) { hud.toast("The Bed needs an empty block for its pillow half — press R to turn it."); this.audio.error(); return; }
      if (!floorAt(bx, by, bz) || !floorAt(nx, by, nz)) { hud.toast("The Bed needs solid ground under both halves."); this.audio.error(); return; }
      if (inPlayer(nx, by, nz)) { hud.toast("Step off the Bed's footprint first."); this.audio.error(); return; }
      bedPeer = [nx, by, nz];
    }
    if (def.block === DOOR_CLOSED || def.block === DOOR_INNER) {
      if (!floorAt(bx, by, bz)) { hud.toast("A Door needs solid ground under it."); this.audio.error(); return; }
    }
    if (def.block === MELON_1 || def.block === WHEAT_1 || def.block === CACTUS || def.block === SAPLING) {
      // seeds only take in tilled ground; a cactus pad also accepts loose sand;
      // a Tree Seed wants real soil — Dirt or Farm Land
      const under = this.world.get(bx, by - 1, bz);
      const ok = def.block === SAPLING
        ? (under === DIRT || under === FARMLAND || under === GRASS)
        : under === FARMLAND || (def.block === CACTUS && (under === SAND || under === SANDSTONE || under === DIRT));
      if (!ok) {
        hud.toast(def.block === SAPLING ? "Tree Seeds go in Dirt — real soil, never sand." : "Plant on Farm Land (till with a shovel); a Cactus also accepts sand.");
        this.audio.error(); return;
      }
    }
    this.world.set(bx, by, bz, def.block);
    if (slot.blockRot && rotatable(def.block)) this.world.setRot(bx, by, bz, slot.blockRot);
    if (benchPeer) {
      this.world.set(benchPeer[0], benchPeer[1], benchPeer[2], BENCH_EXT);
      if (slot.blockRot) this.world.setRot(benchPeer[0], benchPeer[1], benchPeer[2], slot.blockRot);
    }
    if (def.block === DOOR_CLOSED && this.world.get(bx, by + 1, bz) === AIR) this.world.set(bx, by + 1, bz, DOOR_UPPER);
    if (def.block === DOOR_INNER && this.world.get(bx, by + 1, bz) === AIR) this.world.set(bx, by + 1, bz, DOOR_INNER_UPPER);
    if (bedPeer) { // a bed spans 2 blocks, pillow where you turned it
      this.world.set(bedPeer[0], bedPeer[1], bedPeer[2], BED_EXT);
      if (slot.blockRot) this.world.setRot(bedPeer[0], bedPeer[1], bedPeer[2], slot.blockRot);
    }
    if (def.block === MELON_1 || def.block === WHEAT_1) { this.crops.set(`${bx},${by},${bz}`, 0); this.tut?.notify("plant"); }
    if (def.block === SAPLING) { this.trees.set(`${bx},${by},${bz}`, 0); this.tut?.notify("plant"); hud.toast("Seed in the soil. Keep water within 6 blocks and it climbs, stage by stage."); }
    if (def.block === ENGINECORE) {
      // the Core beside a beacon wakes the wreck's power — the Ship still needs its wings
      if (this.beaconAdjacent(bx, by, bz)) {
        const q = currentQuest(this.quests);
        if (q && q.kind === "finish" && !this.tut) this.questBump("finish");
        else hud.toast("The Core hums next to the beacon. Power runs — now wake the wingtip engines.");
      } else hud.toast("The relay needs the Core right next to a Save Beacon.");
    }
    if (def.block === LAMP) this.renderer.addPointLight(bx, by, bz, "lamp");
    // a fresh campfire is cold kindling — feed it before it glows
    else if (def.block === THRUSTER_LIT) this.renderer.addPointLight(bx, by, bz, "fire"); // a carried engine keeps burning
    if (def.block === STORM_BREAKER) this.breakers.add(`${bx},${by},${bz}`);
    if (def.block === CHEST) this.linkChests(bx, by, bz, chestOld);
    this.inv.slots.splice(this.inv.selected, 1);
    this.inv.selected = Math.min(this.inv.selected, Math.max(0, this.inv.slots.length - 1));
    this.renderHeld();
    this.audio.place();
  }

  /** Is any face of this cell touching a Save Beacon block? */
  private beaconAdjacent(bx: number, by: number, bz: number): boolean {
    return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
      .some(([dx, dy, dz]) => this.world.get(bx + dx, by + dy, bz + dz) === BEACON);
  }

  private act() {
    if (this.ui || this.paused || this.cine) return;
    const t = this.raycastTarget();
    const trader = this.nearestTrader();
    if (trader) { this.openTrade(trader); return; }
    if (t?.hit && this.world.get(t.hit.x, t.hit.y, t.hit.z) === CHEST) { this.openChest(t.hit.x, t.hit.y, t.hit.z); return; }
    const cache = this.nearestCache();
    if (cache) { this.openCacheId = cache.id; this.ui = "cache"; this.unlockPointer(); this.renderCache(); document.getElementById("ui-cache")!.classList.remove("hidden"); return; }
    // a Surveyor's Pin is planted at your feet — no raycast needed
    if (this.inv.selectedSlot()?.itemId === "surveyor_pin") { this.plantPin(); return; }
    if (!t) return;
    if (t.hit) {
      const { x, y, z } = t.hit;
      const id = this.world.get(x, y, z);
      if (id === MELON_2 || id === WHEAT_2 || id === CACTUS_FRUIT) { this.harvest(x, y, z, id); return; }
      if (id === BED || id === BED_EXT) { this.sleep(); return; }
      if (isDoorHalf(id) || id === DOOR_OPEN || id === DOOR_INNER_OPEN) {
        const inner = id === DOOR_INNER || id === DOOR_INNER_UPPER || id === DOOR_INNER_OPEN;
        const openId = inner ? DOOR_INNER_OPEN : DOOR_OPEN;
        const half = (n: number) => (inner ? n === DOOR_INNER || n === DOOR_INNER_UPPER : n === DOOR_CLOSED || n === DOOR_UPPER);
        const base = inner ? DOOR_INNER : DOOR_CLOSED, upper = inner ? DOOR_INNER_UPPER : DOOR_UPPER;
        if (id === openId) {
          // a door must never close on the player standing in the doorway
          const p = this.player.pos;
          if (p.x > x - 0.2 && p.x < x + 1.2 && p.z > z - 0.2 && p.z < z + 1.2) {
            hud.toast("Step out of the doorway first.");
            this.audio.error();
            return;
          }
          // rebuild the pair with correct halves: the open block below marks us as the top
          if (this.world.get(x, y - 1, z) === openId) {
            this.world.set(x, y, z, upper);
            this.world.set(x, y - 1, z, base);
          } else if (this.world.get(x, y + 1, z) === openId) {
            this.world.set(x, y, z, base);
            this.world.set(x, y + 1, z, upper);
          } else {
            // lone open half — its neighbor tells us which half we are
            this.world.set(x, y, z, half(this.world.get(x, y + 1, z)) ? upper : base);
          }
        } else {
          // push-door: the leaf swings away from whoever opens it
          const wallAlongX = isSolid(this.world.get(x - 1, y, z)) || isSolid(this.world.get(x + 1, y, z));
          const p = this.player.pos;
          const off = wallAlongX ? p.z - (z + 0.5) : p.x - (x + 0.5);
          const k = x + "," + z;
          if (Math.abs(off) > 0.35) this.world.doorSwing.set(k, (off > 0 ? -1 : 1) as 1 | -1);
          else this.world.doorSwing.delete(k);
          this.world.set(x, y, z, openId);
          for (const dy of [-1, 1]) if (half(this.world.get(x, y + dy, z))) this.world.set(x, y + dy, z, openId);
          this.tut?.notify("door");
        }
        this.audio.door();
        return;
      }
      if (id === BEACON) {
        this.tut?.notify("save");
        if (!this.beaconMarks.some((b) => b.x === x && b.y === y && b.z === z)) this.beaconMarks.push({ x, y, z });
        this.audio.savePing();
        if (this.saveNow()) hud.toast("Saved. Death will respawn you at this beacon.");
        else hud.toast("This world is not saved — the beacon only marks it.");
        return;
      }
      if (id === BENCH || id === BENCH_EXT) { this.openStation = [x, y, z]; this.ui = "bench"; this.unlockPointer(); this.renderCraft("bench"); return; }
      if (id === ARMORY) { this.openStation = [x, y, z]; this.ui = "bench"; this.unlockPointer(); this.renderCraft("armory"); return; }
      if (id === CAMPFIRE) {
        if (this.canHeatWater(x, y, z)) { this.heatWater(x, y, z); return; }
        if (this.canFeed(x, y, z)) { this.feed(x, y, z); return; }
        this.openStation = [x, y, z]; this.ui = "smelt"; this.unlockPointer(); this.renderCraft("smelt"); return;
      }
      if (id === THRUSTER) {
        if (!this.inv.has("thruster_nozzle", 1)) {
          this.audio.error();
          hud.toast("A dead wingtip engine. It needs a Thruster Nozzle — Cobalt from the deep Caves.");
          return;
        }
        this.inv.removeItem("thruster_nozzle", 1);
        this.world.set(x, y, z, THRUSTER_LIT);
        this.renderer.addPointLight(x, y, z, "fire");
        this.questBump("thruster");
        this.audio.door();
        this.audio.win();
        hud.toast("Nozzle seated. The engine coughs, catches, holds.");
        if (!this.liftoff && this.thrustersAllLit()) this.startLiftoff();
        return;
      }
      if (id === REGULATOR) {
        // An activated Regulator (sealed room, capacity not exceeded) settles the body at 37 °C.
        let room = null as null | ReturnType<World["roomInfo"]>;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
          const r = this.world.roomInfo(x + dx, y + dy, z + dz);
          if (r.size > 0) { room = r; break; }
        }
        if (room && room.sealed && room.regulators * REGULATOR_ROOM_MAX >= room.size) {
          this.survival.body = 37;
          this.audio.drink();
          hud.toast("The Regulator's neutral air settles over you. (37 °C)");
        } else {
          this.audio.error();
          hud.toast("That Regulator is idle — its space is unsealed or too big for it.");
        }
        return;
      }
    }
    if (t.water) {
      if (this.inv.selectedSlot()?.itemId === "bucket") { hud.toast("E won't fill it — press Q or right-click with the Bucket to scoop."); this.audio.error(); return; }
      if (this.inv.has("canister_empty")) {
        this.inv.removeItem("canister_empty", 1);
        this.giveOrDrop("canister_full", 1);
        this.audio.drink();
        this.tut?.notify("refill");
        hud.toast(this.world.gen.nearOasis(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z))
          ? "Canister refilled at the oasis."
          : "Canister refilled from the ship's water tank.");
      } else hud.toast("You need an empty Water Canister.");
    }
  }

  /** E at a ripe crop: pick it. Melons re-ripen on the vine; wheat clears back to Farmland. */
  private harvest(x: number, y: number, z: number, id: number) {
    if (id === MELON_2) {
      this.world.set(x, y, z, MELON_1);
      this.crops.set(`${x},${y},${z}`, 30); // the vine keeps growing from partway
      this.giveOrDrop("dune_melon", 1 + (hash2(x, z, this.seed + 71) < 0.4 ? 1 : 0));
      this.questBump("farm");
      this.audio.pickup();
      hud.toast("Dune Melon picked — the plant keeps growing.");
    } else if (id === WHEAT_2) {
      this.world.set(x, y, z, FARMLAND);
      this.crops.delete(`${x},${y},${z}`);
      this.giveOrDrop("wheat", 2);
      this.giveOrDrop("seed_wheat", 1);
      this.questBump("farm");
      this.audio.pickup();
      hud.toast("Desert Wheat cut — the Farmland stays tilled.");
    } else {
      this.world.set(x, y, z, CACTUS);
      this.giveOrDrop("prickly_pear", 2);
      this.questBump("farm");
      this.audio.pickup();
      hud.toast("Prickly Pears picked — the cactus goes on fruiting.");
    }
  }

  /** E at a Bed: one long sleep per game day — 8 hours pass in the dark. */
  private sleep() {
    const since = this.timeSec - this.lastSleep;
    if (since < DAY_SECONDS) {
      const left = Math.ceil((DAY_SECONDS - since) / 60);
      hud.toast(`You just slept. The next long sleep comes in ${left} min.`);
      this.audio.error();
      return;
    }
    this.lastSleep = this.timeSec;
    this.timeSec += DAY_SECONDS / 3; // 8 of the 24 hours
    const fade = document.getElementById("sleepfade")!;
    fade.classList.add("on");
    this.audio.door();
    setTimeout(() => fade.classList.remove("on"), 1200);
    hud.toast("You sleep eight hours, to the cool of the morning.");
    this.saveNow();
  }

  /** A lit Campfire nearby takes the edge off the cold: +18 °C close in, +9 °C at a reach away. */
  private fireWarmth(pos: THREE.Vector3): number {
    const fx = Math.floor(pos.x), fy = Math.floor(pos.y), fz = Math.floor(pos.z);
    let best = 0;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -2; dy <= 2; dy++) {
      if (this.world.get(fx + dx, fy + dy, fz + dz) !== CAMPFIRE) continue;
      if ((this.campCharges.get(`${fx + dx},${fy + dy},${fz + dz}`) ?? 0) <= 0) continue; // cold charcoal warms nothing
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      best = Math.max(best, d <= 4 ? 18 : 9);
    }
    return best;
  }

  /** Crops advance only while their cell has water within 4 blocks and air in its temperature band. */
  private updateCrops(dt: number) {
    this.cropAcc += dt;
    if (this.cropAcc < 2) return;
    const dtc = this.cropAcc;
    this.cropAcc = 0;
    for (const [key, p] of this.crops) {
      const [x, y, z] = key.split(",").map(Number);
      const id = this.world.get(x, y, z);
      if (id !== MELON_1 && id !== MELON_2 && id !== WHEAT_1 && id !== WHEAT_2) { this.crops.delete(key); continue; }
      if (id === MELON_2 || id === WHEAT_2) continue; // ripe, waiting
      const melon = id === MELON_1;
      let wet = false;
      outer: for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = -2; dy <= 1; dy++) {
        if (isWater(this.world.get(x + dx, y + dy, z + dz))) { wet = true; break outer; }
      }
      const temp = this.survival.airTempAt(this.world, x, y, z, this.timeSec);
      const band = melon ? temp >= 22 && temp <= 45 : temp >= 2 && temp <= 42;
      if (wet && band) {
        const np = p + dtc;
        this.crops.set(key, np);
        if (np >= (melon ? 60 : 90)) this.world.set(x, y, z, melon ? MELON_2 : WHEAT_2);
      }
    }
  }

  /** Bucket at the crosshair's water: only a Source is scoopable — flowing water isn't. */
  private bucketScoop() {
    const t = this.raycastTarget();
    if (!t?.water) { hud.toast("Aim at water."); this.audio.error(); return; }
    const { x, y, z } = t.water;
    if (this.world.get(x, y, z) !== WATER) { hud.toast("Only a still Source fills the bucket — flowing water slips through."); this.audio.error(); return; }
    if (!this.inv.has("bucket", 1)) { hud.toast("You need an empty Bucket."); this.audio.error(); return; }
    this.inv.removeItem("bucket", 1);
    this.giveOrDrop("bucket_full", 1);
    this.world.set(x, y, z, AIR);
    this.audio.drink();
    hud.toast("Bucket scooped from the Source — that water is gone from here.");
    this.renderHeld();
  }

  /** Bucket (full) at an open cell: pours a new Source there. */
  private bucketPour() {
    const t = this.raycastTarget();
    if (!t?.hit) return;
    const x = t.hit.x + t.face.x, y = t.hit.y + t.face.y, z = t.hit.z + t.face.z;
    if (this.world.get(x, y, z) !== AIR) { hud.toast("Pour into open space."); this.audio.error(); return; }
    this.world.set(x, y, z, WATER);
    this.inv.removeItem("bucket_full", 1);
    this.giveOrDrop("bucket", 1);
    this.audio.drink();
    hud.toast("Water pours out and finds its level.");
    this.renderHeld();
  }

  /** Living Trees: deterministic staged growth from the planted cell, water within 6 to keep climbing. */
  private updateTrees(dt: number) {
    if (!this.trees.size) return;
    this.treeAcc += dt;
    if (this.treeAcc < 2) return;
    const dtc = this.treeAcc;
    this.treeAcc = 0;
    for (const [key, p] of this.trees) {
      const [x, y, z] = key.split(",").map(Number);
      const id = this.world.get(x, y, z);
      if (id !== SAPLING && id !== WOOD) { this.trees.delete(key); continue; } // chopped or buried: done
      let wet = false;
      trees: for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -3; dy <= 3; dy++) {
        if (isWater(this.world.get(x + dx, y + dy, z + dz))) { wet = true; break trees; }
      }
      if (!wet) continue;
      const np = Math.min(480, p + dtc); // ~8 real minutes root to canopy
      this.trees.set(key, np);
      const upto = np >= 480 ? 3 : np >= 270 ? 2 : np >= 120 ? 1 : 0;
      if (upto === 0) continue;
      let plan = this.treePlanCache.get(key);
      if (!plan) {
        let s = Math.floor(hash2(x + 7 * z, y, this.seed + 55) * 1e9) + 1;
        const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
        plan = treePlan(x, y, z, rnd);
        this.treePlanCache.set(key, plan);
      }
      for (const part of plan) {
        if (part.stage > upto) continue;
        const cur = this.world.get(part.x, part.y, part.z);
        if (cur === AIR || cur === SAPLING) this.world.set(part.x, part.y, part.z, part.b); // the seed cell itself turns to trunk
      }
    }
  }

  /** Solid cacti prick: pressing against or standing brushed by one draws blood. */
  private cactusPrick() {
    const p = this.player.pos;
    const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) {
      const id = this.world.get(fx + dx, fy + dy, fz + dz);
      if (id !== CACTUS && id !== CACTUS_FRUIT) continue;
      if (Math.abs(p.x - (fx + dx + 0.5)) > 1.15 || Math.abs(p.z - (fz + dz + 0.5)) > 1.15) continue;
      if (this.timeSec - this.lastPrick >= 1.5) {
        this.lastPrick = this.timeSec;
        this.survival.hurt(1, "cactus spines");
        this.audio.hurt();
        hud.toast("Cactus spines prick you!");
      }
      return;
    }
  }

  /** Q: consume whatever is currently held in the hands. */
  private useItem() {
    if (this.ui || this.paused) return;
    const sel = this.inv.selectedSlot();
    if (!sel) { hud.toast("Select an item first."); this.audio.error(); return; }
    const d = ITEMS[sel.itemId];
    if (sel.itemId === "canister_full") { this.drink(); return; }
    if (sel.itemId === "hot_water_pouch") {
      // a heat pulse toward body-warm — it never overshoots the safe zone
      this.inv.removeItem(sel.itemId, 1);
      this.survival.body = Math.min(this.survival.body + 10, SAFE_HI);
      this.giveOrDrop("canister_empty", 1);
      this.audio.drink();
      hud.toast("Hot water, straight down: a +10 °C warmth rolls through you. The empty canister comes back.");
      this.renderHeld();
      this.renderInv();
      return;
    }
    if (sel.itemId === "tracker") { this.useTracker(); return; }
    if (sel.itemId === "bucket") { this.bucketScoop(); return; }
    if (d.eat) { this.eat(sel, d); return; }
    if (d.tool?.type === "shovel") {
      // a shovel also tills: only real soil takes a furrow — sand never does
      const t = this.raycastTarget();
      if (t?.hit) {
        const { x, y, z } = t.hit;
        const id = this.world.get(x, y, z);
        if (t.face.y === 1 && (id === DIRT || id === GRASS)) {
          this.world.set(x, y, z, FARMLAND);
          this.audio.place();
          hud.toast("Tilled into Farm Land — plant seeds here, keep water within 4 blocks.");
          return;
        }
        if (t.face.y === 1 && (id === SAND || id === SANDSTONE || id === SALT)) {
          hud.toast("Sand won't hold a furrow — Farm Land is made from Dirt.");
          this.audio.error();
          return;
        }
      }
    }
    hud.toast(`You can't use ${d.name}.`);
    this.audio.error();
  }

  private eat(sel: Slot, d: ItemDef) {
    this.inv.removeItem(sel.itemId, 1);
    const bits: string[] = [];
    if (d.eat!.water) { this.survival.water = Math.min(100, this.survival.water + d.eat!.water); bits.push(`+${d.eat!.water} Water`); }
    if (d.eat!.health) { this.survival.health = Math.min(100, this.survival.health + d.eat!.health); bits.push(`+${d.eat!.health} Health`); }
    this.audio.drink();
    hud.toast(`Ate ${d.name}: ${bits.join(", ")}`);
    this.renderHeld();
    this.renderInv();
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
    this.tut?.notify("drink");
    this.renderHeld();
  }

  /** Heating a full canister at a LIT Campfire: the held item must be the
   *  canister itself, and the fire must have a fuel charge to spend. */
  private canHeatWater(x: number, y: number, z: number): boolean {
    return this.inv.selectedSlot()?.itemId === "canister_full" && (this.campCharges.get(`${x},${y},${z}`) ?? 0) > 0;
  }

  /** Holding Wood or Kindling in front of a Campfire: E stokes the coals
   *  instead of opening the smelter — Wood +2 charges, Kindling +0.5. */
  private canFeed(x: number, y: number, z: number): boolean {
    const s = this.inv.selectedSlot();
    return !!s && (s.itemId === "wood_log" || s.itemId === "kindling");
  }
  private feed(x: number, y: number, z: number) {
    const s = this.inv.selectedSlot();
    if (!s || !this.canFeed(x, y, z)) return;
    const was = `${s.itemId === "wood_log" ? "log" : "kindling"}`;
    const add = s.itemId === "wood_log" ? 2 : 0.5;
    this.inv.removeItem(s.itemId, 1);
    const key = `${x},${y},${z}`;
    const fuel = (this.campCharges.get(key) ?? 0) + add;
    this.campCharges.set(key, fuel);
    this.syncFire(x, y, z);
    this.audio.place();
    this.renderHeld();
    hud.toast(fuel > 0 ? `The ${was} catches — the fire breathes again.` : `The ${was} smoulders; the fire needs more.`);
  }
  /** Keep the campfire's point light in step with its fuel charges. */
  private syncFire(x: number, y: number, z: number) {
    const lit = (this.campCharges.get(`${x},${y},${z}`) ?? 0) > 0;
    if (lit && !this.renderer.hasPointLight(x, y, z)) this.renderer.addPointLight(x, y, z, "fire");
    else if (!lit && this.renderer.hasPointLight(x, y, z)) this.renderer.removePointLight(x, y, z);
    this.world.dirty.add(Math.floor(x / CS) + "," + Math.floor(z / CS)); // cold vs lit charcoal
  }

  private heatWater(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    const fuel = this.campCharges.get(key) ?? 0;
    if (!this.canHeatWater(x, y, z)) { this.audio.error(); return; }
    this.campCharges.set(key, fuel - 1);
    this.syncFire(x, y, z);
    this.inv.removeItem("canister_full", 1);
    this.giveOrDrop("hot_water_pouch", 1);
    this.audio.drink();
    hud.toast("The canister hisses over the coals — sealed hot for the cold hours.");
    this.renderHeld();
  }

  /** T: the Head Lantern — burns one fuel charge per 4 game hours. */
  private toggleLantern() {
    const lamp = this.equip.light;
    if (!lamp) { hud.toast("Nothing in your Light slot. A Head Lantern lights the dark."); this.audio.error(); return; }
    if (this.lanternOn) { this.lanternOn = false; return; }
    if ((lamp.charges ?? 0) <= 0) { hud.toast("The lantern is dry — press E at a Campfire to refuel it."); this.audio.error(); return; }
    this.lanternOn = true;
    this.lanternAcc = 0;
    hud.toast("Head Lantern on. T puts it out.");
  }

  private surge() {
    if (this.ui || this.paused) return;
    const r = this.survival.surge();
    if (r === "thirsty") { hud.toast("You need at least 20 water to sweat-surge."); this.audio.error(); return; }
    if (r === "cooling") { hud.toast("Your body is still cooling — wait a moment."); this.audio.error(); return; }
    this.tut?.notify("surge");
    hud.toast("You force yourself to sweat — evaporation cools your skin. (-10 water)");
    this.audio.drink();
  }

  // The Sandstorm Breaker's calm: standing within its radius of any pylon zeroes
  // the body's storm terms and shows that pylon's faint red dome.
  private stormShieldTick() {
    const tick = Math.floor(this.timeSec * 2); // resampled twice a second
    if (tick === this.breakerTick) return;
    this.breakerTick = tick;
    const p = this.player.pos;
    let best: [number, number, number] | null = null, bd = Infinity;
    for (const key of this.breakers) {
      const [x, y, z] = key.split(",").map(Number);
      const d = Math.hypot(p.x - (x + 0.5), p.y + 0.9 - (y + 0.5), p.z - (z + 0.5));
      if (d <= STORM_BREAKER_R && d < bd) { bd = d; best = [x, y, z]; }
    }
    this.stormShieldOn = best !== null;
    this.renderer.setStormDome(best ? [best[0] + 0.5, best[1] + 0.5, best[2] + 0.5] : null);
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
    this.regActive = active;
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
        // addSlot, not addItem: a lantern or Regulator picked off the sand keeps its fuel
        if (this.inv.addSlot({ itemId: e.itemId, x: 0, y: 0, charges: e.charges })) {
          if (e.srcIndex !== undefined) this.collected.add(e.srcIndex);
          this.entities.splice(i, 1);
          this.renderer.removeEntityMesh(e.id);
          this.audio.pickup();
        }
      }
    }
  }

  // ---------- victory ----------

  // ---------- liftoff ----------
  // All four wingtip engines lit: the Ship lifts off IN PLACE — hull rows blink
  // out top-down over ~2 s, hover in the sky as an afterimage, then re-stack
  // bottom-up in its crater. Voxel-styled lift; no physics, no new geometry.

  /** Ship materials — everything that belongs to the hull, not the desert. */
  private static readonly SHIP_IDS = new Set([
    HULL, METAL_PLATING, CURVED_HULL, HULL_SLOPE, INSGLASS,
    DOOR_CLOSED, DOOR_UPPER, DOOR_OPEN, DOOR_INNER, DOOR_INNER_UPPER, DOOR_INNER_OPEN,
    LAMP, BEACON, BENCH, BENCH_EXT, REGULATOR, ENGINECORE, BED, BED_EXT,
  ]);

  private liftoff: {
    t: number; rows: [number, number, number, number][][]; step: number; restored: number;
  } | null = null;

  private thrustersAllLit(): boolean {
    let lit = 0;
    for (let y = 29; y <= 37; y++)
      for (let x = -8; x <= 6; x++)
        for (let z = -13; z <= 13; z++) {
          const id = this.world.get(x, y, z);
          if (id === THRUSTER) return false;
          if (id === THRUSTER_LIT) lit++;
        }
    return lit >= 4;
  }

  private startLiftoff() {
    const rows: [number, number, number, number][][] = [];
    for (let y = 37; y >= 29; y--) {
      const cells: [number, number, number, number][] = [];
      for (let x = -8; x <= 6; x++)
        for (let z = -13; z <= 13; z++) {
          const id = this.world.get(x, y, z);
          if (Game.SHIP_IDS.has(id)) cells.push([x, y, z, id]);
        }
      if (cells.length) rows.push(cells);
    }
    this.liftoff = { t: 0, rows, step: 0, restored: 0 };
    this.ui = "liftoff"; // locks movement, acting, and prompts until the Ship settles
    if (document.pointerLockElement) document.exitPointerLock();
    const fx = document.getElementById("lift-fx")!;
    fx.classList.remove("hidden");
    fx.textContent = "ENGINE IGNITION";
    hud.toast("The whole Ship shudders. Every plate rattles at once.");
    this.audio.win();
  }

  /** Advances the liftoff each frame; wins when the Ship has settled back down. */
  private liftoffFrame(dt: number) {
    const L = this.liftoff;
    if (!L) return;
    L.t += dt;
    const per = 2.2 / L.rows.length;   // one hull row blinks out every `per` s
    const IGNITE_END = 2.4, HOVER_END = 4.6, LAND_END = HOVER_END + 2.2;
    const fx = document.getElementById("lift-fx")!;
    fx.textContent = L.t < IGNITE_END ? "LIFT-OFF" : L.t < HOVER_END ? "RESCUE SIGNAL LIVE" : "TOUCHDOWN";
    // rising: rows vanish top-down with a thud per row
    while (L.step < L.rows.length && L.t >= L.step * per) {
      for (const [x, y, z] of L.rows[L.step]) this.world.set(x, y, z, AIR);
      this.audio.door();
      L.step++;
    }
    // falling: the same rows re-stack bottom-up
    if (L.t > HOVER_END) {
      while (L.restored < L.rows.length && L.t - HOVER_END >= L.restored * per) {
        for (const [x, y, z, id] of L.rows[L.rows.length - 1 - L.restored]) this.world.set(x, y, z, id);
        this.audio.door();
        L.restored++;
      }
    }
    if (L.t >= LAND_END + 0.4) {
      this.liftoff = null;
      this.ui = null;
      fx.classList.add("hidden");
      this.saveNow(true);
      this.win();
    }
  }

  private win() {
    if (this.won) return;
    this.won = true;
    submitBest(this.scoreDays());
    this.audio.win();
    this.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("screen-win")!.classList.remove("hidden");
    document.getElementById("win-stats")!.textContent =
      `The Ship lifts off. All four engines burn. Survived ${this.scoreDays().toFixed(1)} days. Best: ${bestScore().toFixed(1)} days.`;
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
      // everything you carried AND everything you wore waits in the cache
      items: [
        ...this.inv.slots.map((s) => ({ itemId: s.itemId, count: 1, charges: s.charges })),
        ...(["backpack", "head", "body", "regulator", "light"] as const)
          .map((sl) => this.equip[sl])
          .filter((s): s is Slot => !!s)
          .map((s) => ({ itemId: s.itemId, count: 1, charges: s.charges })),
      ],
    });
    this.inv.slots = []; this.inv.selected = 0;
    this.equip = { backpack: null, head: null, body: null, regulator: null, light: null };
    this.lanternOn = false;
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
    for (const id of ["ui-inventory", "ui-craft", "ui-cache", "ui-trade"]) document.getElementById(id)!.classList.add("hidden");
    // closing any in-game menu also drops the pause menu, if one was open
    if (this.paused) {
      this.paused = false;
      document.getElementById("screen-pause")!.classList.add("hidden");
    }
    this.relock();
  }

  private roomRegulated(): boolean { return this.regActive; }
  private renderHeld() { hud.updateHud(this.survival, this.inv, this.timeSec, this.dayNumber(), this.settings.units, performance.now(), { regulated: this.regActive, stormBroken: this.stormShieldOn, napReady: this.timeSec - this.lastSleep >= DAY_SECONDS }); }

  /** Distinct carried item types in pack order — the hotbar's rows. */
  private hotbarItems(): string[] {
    const u: string[] = [];
    for (const s of this.inv.slots) if (!u.includes(s.itemId)) u.push(s.itemId);
    return u;
  }
  private selectItem(itemId: string) {
    this.inv.selected = this.inv.slots.findIndex(s => s.itemId === itemId);
  }
  /** Tutorial hook: pull an item into the hands (select + render). */
  selectHeld(itemId: string) {
    const i = this.inv.slots.findIndex(s => s.itemId === itemId);
    if (i >= 0) { this.inv.selected = i; this.renderHeld(); }
  }
  private cycleItem(dir: number) {
    const hb = this.hotbarItems();
    if (!hb.length) { this.inv.selected = 0; this.renderHeld(); return; }
    const cur = hb.indexOf(this.inv.selectedSlot()?.itemId ?? "");
    this.selectItem(hb[((cur + dir) % hb.length + hb.length) % hb.length]);
    this.renderHeld();
  }

  // inventory grid metrics (keep in sync with .invcell size in styles.css)
  private static readonly CELL = 64;
  private static readonly GAP = 6;
  /** current CSS zoom of panels (Settings > UI size) */
  private uiZoom(): number {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"));
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  // item currently lifted out of the grid ("temporary storage")
  temp: Slot | null = null;
  // the Craft tab of the Inventory UI (by-hand recipes, no station needed)
  invCraft = false;

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
      tempEl.style.backgroundImage = `url(${itemTiles(this.temp.itemId, this.temp.charges)[0] ?? ""})`;
      tempEl.onmousedown = (e) => {
        if (Date.now() - this.lastTouchTs < 700) { this.tapTemp(); return; }
        if (this.temp) this.startTempDrag(e);
      };
      dropTemp.textContent = `Drop ${d.name}`;
      dropTemp.onclick = () => {
        if (!this.temp) return;
        this.dropEntity(this.temp.itemId, 1, 1, this.temp.charges);
        this.temp = null;
        this.audio.place();
        this.renderInv();
      };
    } else {
      tempEl.classList.remove("filled");
      tempEl.style.background = "";
      tempEl.style.backgroundImage = "";
      // handler stays live: tapping the EMPTY shelf lifts the selected item onto it
      tempEl.onmousedown = (e) => {
        if (Date.now() - this.lastTouchTs < 700) this.tapTemp();
      };
      dropTemp.onclick = null;
    }
    dropTemp.classList.toggle("hidden", !this.temp);

    // Armour Slots row: Backpack / Head / Body / Regulator / Light
    for (const slot of ["backpack", "head", "body", "regulator", "light"] as const) {
      const el = document.getElementById("eq-" + slot)!;
      const it = this.equip[slot];
      if (it) {
        const d = ITEMS[it.itemId];
        el.classList.add("filled");
        el.style.background = d.color;
        el.style.backgroundImage = `url(${itemTiles(it.itemId, it.charges)[0] ?? ""})`;
        const ch = it.charges;
        el.textContent = ch !== undefined && ch > 0 ? String(ch) : "";
        el.title = ch !== undefined
          ? `Click to take off the ${d.name} — ${ch} charge${ch === 1 ? "" : "s"} left`
          : `Click to take off the ${d.name}`;
        el.onclick = () => this.unequipSlot(slot);
      } else {
        el.classList.remove("filled");
        el.style.background = "#23262e";
        el.style.backgroundImage = "";
        el.textContent = "";
        el.title = "";
        // tap/click an empty slot to wear the selected gear (no hunt for the side-panel button)
        el.onclick = () => {
          const sel = this.inv.selectedSlot();
          if (sel && ITEMS[sel.itemId].equip === slot) this.equipItem();
          else if (sel) { hud.toast(`The ${ITEMS[sel.itemId].name} does not fit the ${slot} slot.`); this.audio.error(); }
        };
      }
    }

    // rebuild the side panel from scratch every render (accumulating text/buttons bug)
    const side = document.getElementById("inv-side")!;
    this.renderCraftTab();
    const fInv = this.gridFocus === "chest" && this.chestInv ? this.chestInv : this.inv;
    const sel = fInv.selectedSlot();
    const shown = this.temp ?? sel;
    const kg = this.inv.weight() + (this.temp ? ITEMS[this.temp.itemId].mass : 0);
    const lim = this.inv.weightLimit();
    const dims = shown ? slotDims(shown) : null;
    side.innerHTML = "";
    const txt = document.createElement("div");
    txt.id = "side-text";
    txt.textContent = (shown
      ? `${ITEMS[shown.itemId].name} — ${ITEMS[shown.itemId].desc}`
      : "Click an item to inspect it; drag to move it.") + ` Weight ${kg.toFixed(1)} / ${lim} kg`;
    side.appendChild(txt);
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
    if (sel) {
      const d = ITEMS[sel.itemId];
      if (d.equip) {
        const eqBtn = document.createElement("button");
        eqBtn.textContent = `Equip (${d.equip} slot)`;
        eqBtn.onclick = () => this.equipItem();
        side.appendChild(eqBtn);
      }
      if (sel.itemId === "coolant_cell" && this.equip.regulator) {
        // spare Coolant Cells load straight into the worn Regulator
        const reg = this.equip.regulator;
        const full = (reg.charges ?? 0) >= 3;
        const ld = document.createElement("button");
        ld.textContent = full ? "Regulator holds 3 cells already — that's six days of neutral air"
          : "Load Coolant Cell into the Regulator (each lasts 2 game days)";
        ld.disabled = full || !this.inv.has("coolant_cell", 1);
        ld.onclick = () => {
          if (full || !this.inv.has("coolant_cell", 1)) return;
          this.inv.removeItem("coolant_cell", 1);
          reg.charges = (reg.charges ?? 0) + 1;
          this.audio.pickup();
          hud.toast(`Coolant Cell loaded — ${reg.charges} charge${reg.charges === 1 ? "" : "s"} running.`);
          this.renderInv();
        };
        side.appendChild(ld);
      }
    }
    if (sel) {
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
          this.inv.slots.splice(this.inv.slots.indexOf(sel), 1);
          this.dropEntity(sel.itemId, 1, 1, sel.charges);
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
        const tiles = itemTiles(s.itemId, s.charges);
        const idx = s.rot ? (d.h - 1 - dx) * d.w + dy : dy * d.w + dx;
        cell.style.background = d.color;
        cell.style.backgroundImage = `url(${tiles[Math.min(idx, tiles.length - 1)] ?? ""})`;
        const si = inv.slots.indexOf(s);
        if (si === inv.selected) cell.classList.add("active");
        // hover preview must only rewrite the description line, and never on
        // touch: the synthesised mouseenter after a tap used to wipe the panel's
        // buttons and weight line out from under the player
        cell.onmouseenter = () => {
          if (Date.now() - this.lastTouchTs < 700) return;
          const t = document.getElementById("side-text");
          if (t) t.textContent = `${d.name} — ${d.desc}`;
        };
        cell.onmousedown = (e) => {
          // touch taps synthesise mousedown: recent touch means this tap selects/moves, not drags
          if (Date.now() - this.lastTouchTs < 700) this.tapCell(inv, x, y);
          else this.startInvDrag(e, s, inv);
        };
      } else {
        cell.onmousedown = () => {
          if (Date.now() - this.lastTouchTs < 700) this.tapCell(inv, x, y);
        };
      }
      grid.appendChild(cell);
    }
  }

  /** Touch semantics: tap selects; tapping another cell moves the selected item there — swapping when occupied. A lifted item (temporary storage) lands wherever the next cell tap falls. There is ONE selection across pack and chest grids: tapping the far grid pulls the selected item across. */
  private tapCell(inv: Inventory, x: number, y: number) {
    const hit = inv.slots.find((s) => {
      const d = slotDims(s);
      return x >= s.x && x < s.x + d.w && y >= s.y && y < s.y + d.h;
    });
    if (this.temp) {
      const t = this.temp;
      const d = slotDims(t);
      const ax = Math.min(x, inv.w - d.w), ay = Math.min(y, inv.h - d.h);
      if (ax >= 0 && ay >= 0) {
        const s: Slot = { ...t, x: ax, y: ay };
        const oi = hit ? inv.slots.indexOf(hit) : -1;
        if (oi >= 0) inv.slots.splice(oi, 1); // open hole so the swap legs see the real board
        if (inv.fits(ax, ay, d.w, d.h, s)) {
          inv.slots.push(s);
          if (hit && !Game.placeSlotFree(inv, hit)) {
            inv.slots.splice(inv.slots.indexOf(s), 1); // no spot for the occupant: undo both legs
            inv.slots.splice(oi, 0, hit);
            hud.toast("No room to swap.");
            this.audio.error();
            return;
          }
          this.temp = null;
          this.tempOrigin = null;
          this.setSel(inv, inv.slots.indexOf(s));
          this.audio.place();
          this.renderInv();
          this.renderHeld();
          return;
        }
        if (hit) inv.slots.splice(oi, 0, hit);
      }
      hud.toast("No room there.");
      this.audio.error();
      return;
    }
    const other = inv === this.inv ? this.chestInv : this.inv;
    if (other) {
      const oSel = other.selectedSlot();
      if (oSel && oSel !== hit) {
        const da = slotDims(oSel);
        const ax = Math.min(x, inv.w - da.w), ay = Math.min(y, inv.h - da.h);
        if (ax >= 0 && ay >= 0 && inv.fits(ax, ay, da.w, da.h, oSel)) {
          other.slots.splice(other.slots.indexOf(oSel), 1);
          other.selected = -1;
          oSel.x = ax; oSel.y = ay;
          inv.slots.push(oSel);
          inv.selected = inv.slots.indexOf(oSel);
          this.audio.place();
          this.renderInv();
          this.renderHeld();
          return;
        }
        hud.toast("No room there.");
        this.audio.error();
        return;
      }
    }
    const sel = inv.selectedSlot();
    if (sel && sel !== hit) {
      const da = slotDims(sel);
      const ax = Math.min(x, inv.w - da.w), ay = Math.min(y, inv.h - da.h);
      if (ax >= 0 && ay >= 0 && this.tapMove(inv, sel, hit, ax, ay)) {
        this.audio.place();
        inv.selected = inv.slots.indexOf(sel);
        this.renderInv();
        return;
      }
    }
    if (hit) {
      this.setSel(inv, inv.slots.indexOf(hit));
      this.renderInv();
    } else if (inv.selected !== -1) {
      inv.selected = -1; // tapping empty pack space releases the selection
      this.renderInv();
    }
  }

  /** Move `a` to (ax,ay); if blocked by `hit`, swap footprints when they both fit. */
  private tapMove(inv: Inventory, a: Slot, hit: Slot | undefined, ax: number, ay: number): boolean {
    const da = slotDims(a);
    if (inv.fits(ax, ay, da.w, da.h, a)) return inv.move(a, ax, ay);
    if (!hit) return false;
    const db = slotDims(hit);
    const ai = inv.slots.indexOf(a);
    inv.slots.splice(ai, 1); // open hole: both swap legs check against the real board
    // each item must fit its new home, and the two new footprints must be disjoint
    const ok = inv.fits(a.x, a.y, db.w, db.h, hit) && inv.fits(ax, ay, da.w, da.h, hit)
      && !(ax < a.x + db.w && a.x < ax + da.w && ay < a.y + db.h && a.y < ay + da.h)
      && inv.move(hit, a.x, a.y) && inv.move(a, ax, ay);
    inv.slots.splice(ai, 0, a);
    return ok;
  }

  /** One selection across the open grids: selecting in one clears the other. */
  private setSel(inv: Inventory, i: number) {
    const other = inv === this.inv ? this.chestInv : this.inv;
    if (other) other.selected = -1;
    inv.selected = i;
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
    this.setSel(src, si);
    src.slots.splice(si, 1);
    const prev = this.temp;
    this.temp = s;
    this.tempOrigin = src;
    if (prev) {
      // dragging another item back swaps it into the vacated cell
      src.slots.push(prev);
      if (!src.move(prev, s.x, s.y)) this.giveOrDrop(prev.itemId, 1);
    }
    const STEP = (Game.CELL + Game.GAP) * this.uiZoom();
    const GAP = Game.GAP * this.uiZoom();
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - GAP + "px";
    ghost.style.height = d.h * STEP - GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    ghost.style.backgroundImage = `url(${itemArtUrl(s.itemId, s.rot ? 1 : 0, s.charges)})`;
    document.body.appendChild(ghost);
    const rect = (src === this.inv ? document.getElementById("inv-grid") : document.getElementById("chest-grid"))!.getBoundingClientRect();
    const D = { gx: e.clientX - (rect.left + s.x * STEP), gy: e.clientY - (rect.top + s.y * STEP) };
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - D.gx + "px";
      ghost.style.top = ev.clientY - D.gy + "px";
      document.getElementById("inv-bin")!.classList.toggle("hot", this.overBin(ev.clientX, ev.clientY));
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      document.getElementById("inv-bin")!.classList.remove("hot");
      if (this.overBin(ev.clientX, ev.clientY)) { this.binDiscard(); return; } // the item is already in temp
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
          this.setSel(target, target.slots.indexOf(s));
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
    this.setSel(src, si);
    src.slots.splice(si, 1);
    const prev = this.temp;
    this.temp = s;
    this.tempOrigin = src;
    if (prev) {
      src.slots.push(prev);
      if (!src.move(prev, s.x, s.y)) this.giveOrDrop(prev.itemId, 1);
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
    const STEP = (Game.CELL + Game.GAP) * this.uiZoom();
    const GAP = Game.GAP * this.uiZoom();
    const d = slotDims(s);
    const ghost = document.createElement("div");
    ghost.className = "inv-ghost";
    ghost.style.width = d.w * STEP - GAP + "px";
    ghost.style.height = d.h * STEP - GAP + "px";
    ghost.style.background = ITEMS[s.itemId].color;
    ghost.style.backgroundImage = `url(${itemArtUrl(s.itemId, s.rot ? 1 : 0, s.charges)})`;
    document.body.appendChild(ghost);
    const move = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - d.w * STEP / 2 + "px";
      ghost.style.top = ev.clientY - d.h * STEP / 2 + "px";
      document.getElementById("inv-bin")!.classList.toggle("hot", this.overBin(ev.clientX, ev.clientY));
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ghost.remove();
      document.getElementById("inv-bin")!.classList.remove("hot");
      if (this.overBin(ev.clientX, ev.clientY)) { this.binDiscard(); return; } // the item is already in temp
      const hw = (d.w * STEP - GAP) / 2, hh = (d.h * STEP - GAP) / 2;
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
          this.setSel(target, target.slots.indexOf(s));
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

  /** Mobile tap on the Temporary Storage shelf: send the held item back to the grid it came from, or lift the selected item onto the shelf. */
  private tapTemp() {
    const fInv = this.gridFocus === "chest" && this.chestInv ? this.chestInv : this.inv;
    if (this.temp) {
      const back = this.tempOrigin ?? fInv;
      const s: Slot = { ...this.temp, x: 0, y: 0 };
      if (Game.placeSlotFree(back, s)) {
        this.temp = null;
        this.tempOrigin = null;
        this.setSel(back, back.slots.indexOf(s));
        this.audio.place();
      } else {
        hud.toast("No room to put it back.");
        this.audio.error();
      }
    } else {
      const sel = fInv.selectedSlot();
      if (!sel) { hud.toast("Select an item first."); this.audio.error(); return; }
      fInv.slots.splice(fInv.slots.indexOf(sel), 1);
      this.temp = { ...sel };
      this.tempOrigin = fInv;
      fInv.selected = -1;
      this.audio.place();
    }
    this.renderInv();
    this.renderHeld();
  }

  /** The Craft tab of the Inventory UI: every by-hand recipe — no station needed. */
  private renderCraftTab() {
    const btn = document.getElementById("btn-inv-craft")!;
    const panel = document.getElementById("inv-craft")!;
    btn.textContent = this.invCraft ? "Close Craft" : "Craft by hand";
    btn.classList.toggle("on", this.invCraft);
    panel.classList.toggle("hidden", !this.invCraft);
    if (!this.invCraft) return;
    panel.innerHTML = "";
    for (const r of RECIPES) {
      if (r.station !== null) continue;
      const row = document.createElement("div");
      row.className = "craft-row";
      const label = `${ITEMS[r.out].name}${r.count > 1 ? " ×" + r.count : ""}`;
      const needs = Object.entries(r.needs).map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(", ");
      row.innerHTML = `<span class="what"><img class="craft-art" src="${itemArtUrl(r.out)}" alt="">${label} <span class="needs">(${needs})</span></span>`;
      const b = document.createElement("button");
      b.textContent = "Craft";
      b.disabled = !canCraft(this.inv, r);
      b.onclick = () => {
        const left = doCraft(this.inv, r);
        if (left === null) { this.audio.error(); return; }
        if (left > 0) this.giveOrDrop(r.out, left);
          this.tut?.notify("craft");
          this.craftLesson(r.out);
          if (ITEMS[r.out]?.tool) this.questBump("tool");
        this.audio.place();
        this.renderInv();
      };
      row.appendChild(b);
      panel.appendChild(row);
    }
  }

  renderCraft(mode: "bench" | "smelt" | "armory") {
    document.getElementById("ui-craft")!.classList.remove("hidden");
    document.getElementById("craft-title")!.textContent =
      mode === "bench" ? "Crafting Bench" : mode === "armory" ? "Armoury — gear that guards the body" : "Campfire Smelting";
    const list = document.getElementById("craft-list")!;
    list.innerHTML = "";
    const smeltUi = document.getElementById("smelt-ui")!;
    smeltUi.classList.toggle("hidden", mode !== "smelt");
    if (mode !== "smelt") {
      for (const r of RECIPES) {
        if (mode === "armory" ? r.station !== "armory" : r.station === "armory") continue;
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
          this.tut?.notify("craft");
          this.craftLesson(r.out);
          if (ITEMS[r.out]?.tool) this.questBump("tool");
          this.audio.place();
          this.renderCraft(mode);
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
        this.syncFire(pos[0], pos[1], pos[2]);
        this.renderCraft("smelt");
      };
      // an equipped Head Lantern drinks from the fire too
      const lamp = this.equip.light;
      if (lamp) {
        const lc = lamp.charges ?? 0;
        const ref = document.createElement("div");
        ref.className = "craft-row";
        ref.innerHTML = `<span class="what">Head Lantern <span class="needs">(${lc}/5 charges)</span></span>`;
        const rb = document.createElement("button");
        rb.textContent = "Refuel Lantern (+1, uses 1 fuel)";
        rb.disabled = lc >= 5 || fuel < 1;
        rb.onclick = () => {
          if (lc >= 5 || fuel < 1) return;
          this.campCharges.set(key, fuel - 1);
          this.syncFire(pos[0], pos[1], pos[2]);
          lamp.charges = lc + 1;
          this.audio.place();
          this.renderCraft("smelt");
        };
        ref.appendChild(rb);
        list.appendChild(ref);
      }
      for (const s of SMELT) {
        const row = document.createElement("div");
        row.className = "craft-row";
        row.innerHTML = `<span class="what"><img class="craft-art" src="${itemArtUrl(s.out)}" alt="">${ITEMS[s.in].name} → ${ITEMS[s.out].name}${s.n && s.n > 1 ? " ×" + s.n : ""} <span class="needs">(1 fuel charge)</span></span>`;
        const b = document.createElement("button");
        b.textContent = "Smelt";
        b.disabled = !this.inv.has(s.in, 1) || fuel < 1;
        b.onclick = () => {
          this.inv.removeItem(s.in, 1);
          this.campCharges.set(key, fuel - 1);
          this.syncFire(pos[0], pos[1], pos[2]);
          const left = this.inv.addItem(s.out, s.n ?? 1);
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
      cache?.kind === "reward" ? "Reward Cache — claim your quest reward"
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
          if (it.charges !== undefined && it.count === 1) {
            // fuel-carrying gear comes back with its charges intact
            if (this.inv.addSlot({ itemId: it.itemId, x: 0, y: 0, charges: it.charges })) {
              moved = true;
              cache.items.splice(cache.items.indexOf(it), 1);
            }
          } else {
            const left = this.inv.addItem(it.itemId, it.count);
            if (left < it.count) { moved = true; it.count = left; }
            if (left === 0) cache.items.splice(cache.items.indexOf(it), 1);
          }
        }
      }
      if (!cache.items.length) this.renderer.removeEntityMesh(cache.id);
      this.renderCache();
      if (!cache.items.length) this.closeUI();
    };
    list.appendChild(take);
  }
}
