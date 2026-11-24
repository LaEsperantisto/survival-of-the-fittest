# Feature Plan (2026-11-24) — Phase 2 Redesign: Two Disjoint Worlds, the Sentinel War

Settled by the grilling session (2026-11-24, seven rounds; glossary updated in place;
ADRs 0014 disjoint-planets/Scrap-bridge, 0015 super-fuel death-gift). Supersedes the
completed 2026-11-23 Silvaris plan (history in git — its blocks/items/foundation stay,
this plan forks and extends them). This file is the contract for every implementation
slice: names, ids and signatures here are FIXED — do not rename.

## Canon (settled decisions)

- **Disjoint worlds** (ADR-0014): every raw material, ore, flora/fauna drop, tool, gear
  item and Crafting Station is planet-native. No material item is obtainable from both
  worlds. Both planets alone can raise the full chain: tools → food → power → Rocket
  Fuel → ship hardware. Functional ship/fuel items (`rocket_fuel`, `super_fuel`,
  `oil_bucket`, `canister_*`, `thruster`, `thruster_nozzle`, `engine_core`, `hull*`,
  `frame_corner`, `flight_controls`, power-device ids) stay SHARED ids with per-planet
  recipes at per-planet stations. Materials/tools/stations/gear fork.
- **Silvaris ore swap** (reverses "every ore in Silvaris caves"): DELETE iron/copper/
  cobalt/alabaster/coal bands from Silvaris worldgen. Silvaris cave ores:
  TITANIUM_ORE (deep, keep band), GRAPHITE_ORE (mid, keep), **LEAD_ORE** (mid),
  **SALTPETRE_ORE** (common upper-mid; Salt veins under Shallows stay), gravel (Deep
  Ocean floor, exists). Desertis keeps its bands + gains **ANTHRACITE_ORE** in the
  deepest cave layer.
- **Tool ladders** (same 5 families, per-planet materials, same minTier gates):
  Desertis unchanged (wood/stone/metal/alloy). Silvaris: **Basalt** (t1: basalt+sil
  timber), **Bone** (t2: bone+sil timber), **Titanium** (t3), **Carbide** (t4:
  titaniumrod+graphite). Disassembler: bone (t1) / carbide (t2). Bucket: bone_bucket
  (silvaris). New families, Silvaris-only: **Skinning Knife** (basalt/bone/titanium
  tiers) — required to skin Brushbuck/Snow Stalker pelts (hides yield 2× with knife;
  without: 1 raw), **Harpoon** (bone/titanium/carbide) — required to harvest Tidebacks
  (tideback_hide 3×) and opens Shallows hunting.
- **Silvaris stations (twins)**: **Hearth** (campfire twin: smelt+cook+charcoal+flux),
  **Workbench** (bench twin), **Tannery** (armoury twin), **Cauldron** (cooking-pot
  twin), **Oil Works** (refinery twin: oil_bucket+charcoal → rocket_fuel),
  **Wiring Bench** (electric twin: all power devices from lead/glass/saltpetre).
  FOUNDRY, ASSEMBLY_BENCH, FUEL_WORKS stay (Silvaris-flavored) but their recipes
  switch to Silvaris inputs only. Desertis gains **Fuel Still** (rocket_fuel +
  anthracite_ore → super_fuel; built at the Crafting Bench).
- **Recycler** (the glossary term, never implemented): RECYCLER (Desertis, bench) +
  **SIL_RECYCLER** (Wiring Bench). Station UI: drop any crafted item → ~75 % of its
  ingredients (≥1 each), existing rule. An item NOT of the current planet instead
  yields **Scrap** (universal, `scrap`). Scrap spent by: Hover Sled + upgrades,
  defense gear recipes, foreign-gear repair (`repair` action: 2 Scrap + 1 of that
  planet's plating? NO — keep simple: right tool broken? skip repair; instead a few
  cheap recipes: desert `chest` alt, one utility recipe each side).
- **Carbon**: Silvaris charcoal (Hearth slow-burn of sil timber log; log→charcoal×1),
  Rocket Fuel via Oil Works. Desertis coal chain unchanged. Super Fuel recipe
  (`fuel_works` AND `fuel_still`) is **Catalog-locked until `sentinel_dead`** (ADR-0015):
  hidden entries, unlock flag on the run save. Never loot, never traded (already true).
- **Story spine (sabotage)**: founders automated Desertis; the **Sentinel** ("hold the
  settlement") shot the colony ships down; survivors scattered as **Nomads** (rename
  all Trader code/UI text: `Nomad`, `Nomad Camp`, Keeper). **Keepers**: one named Nomad
  per Camp, unlocked by that Camp's deed-quest, telling one story chapter (text cards).
  Phase 1 foreshadowing is EXPLICIT (crash-investigation beats; one desert Warden
  recognizes the Ship and flees). Machine factions (Warden/Sentry/Breaker + Hauler)
  run **Machine Camps** (hostile Landmarks, antenna block; destroy antenna → patrols
  stop + one Reclaimer squad responds; never grow on a timer — expansion is scripted:
  quest beats + entering flagged areas). **Relay Towers** rise next to player Grids
  that reach wild country (scripted per tower, quest-driven); towers anchor patrols AND
  enable one scripted **raid squad** per energize beat (machines eat exposed Grid
  blocks, despawn at dawn; destroying the tower cancels its squads).
- **Finale order (locked)**: last Keeper chapter names the Sentinel → Keeper shares
  **Nav Core** recipe (titanium+graphite+lead+Scrap, Assembly twin) → player builds +
  installs Nav Core (block on the Ship like Flight Controls) → expedition into the
  authored **volcano core dungeon** (Scorch Belt) → **Sentinel boss** fight: waves of
  Sentries/Breakers + environment levers (cut 3 power conduits, open 2 cooling
  channels to flood steam, Shock Coils) strip its shield → kill (`sentinel_dead` flag,
  Catalog teaches Super Fuel both planets) → refine own Super Fuel → **charted final
  flight** (Nav Core + Super port + Lift-off at the ship's yoke) → cinematic charts the
  system; Phase 2 complete.
- **Hover Sled** (Silvaris only): place HOVER_SLED block (1×1) → E mounts: walk-speed
  ×1.9, battery drains (sled holds a charge 0–100; dismount on/next to a DOCK_PAD
  fed by Grid recharges 8/s). Upgrades bolted on (E-menu on the sled): **Cargo Sled**
  (chest-adjacency 12-slot storage), **Blade** (riding shatters SNOW/LEAVES/GRASS and
  Spike Barricades you touch), **Drill** (while riding, digging Caches/Machine-Camp
  blocks is ×2.5 speed). Sled survives disassembly (Disassembler returns item).
- **Defenses** (per-planet recipes): SPIKE_BARRICADE (passive; mobs/machines that
  touch it take damage), ALARM_CHIME (wired; rings + HUD flash when a machine/hostile
  enters 10 cells), GUN_TURRET (wired; internal magazine 30; hand-load with planet
  Slugs (`slug` desert / `lead_slug` sil); targets machines + hostile fauna within
  8 cells, hitscan ~1.2 s cadence; fauna-target toggle in its panel), SHOCK_COIL
  (wired; 2 s pulse, 4 damage in radius 4, ×3 vs machines; Machine Heart in recipe).
- **Craft depth** (both worlds): Desertis — cactus_leather (campfire: 2 cactus) →
  Dune Wrap light heat gear; pear_cordial (Cooking Pot: 2 prickly_pear + sugar →
  Hydration drink); adobe furniture (Table at bench); sugar cane finally has an origin
  (Oasis pool banks grow SUGARCANE). Silvaris — **Frost Oats** crop (seed_oats from
  settlement chests/barter; grows cold-tolerant) → oat_flour (Hearth) → oatbread +
  porridge (Cauldron); tundroot → tundroot_flour (Hearth) → flatbread (Cauldron);
  dishes: root_stew, ember_pie, smoked_brushbuck (Hearth cold-smoke); gear: hardhide
  (Tannery: pelt+knife output) → Buckguard, Snowcloak (frost pelts, warmest),
  Tideback Cuirass. Posts/Railings/Stained Glass both planets (shared blocks, forked
  items, planet-tinted tiles).
- **Visuals** (procedural pipeline already exists): repaint every tile recipe (all
  naturals, ores, stations), per-planet tiles for lookalikes (GRASS/DIRT/ROCK/snow
  look), custom geometry for cube-only offenders (chest lid, bed, campfire logs,
  hearth logs, thruster nozzle, dock pad rim, turret, coil, chime, tower, antenna,
  sled, posts/railing/table, crops as cross-silhouettes, all new stations), hand-drawn
  icons for every new item, robot mob shapes from block palettes.
- **Save**: clean break — bump run version to **v4**; v3 and older worlds are
  rejected (fresh start). No migration.

## Fixed ids (append in id order; current max is 118 EMBER_FRUIT)

```
119 RECYCLER        120 SIL_RECYCLER     121 HEARTH          122 WORKBENCH
123 TANNERY         124 CAULDRON         125 OIL_WORKS       126 WIRING_BENCH
127 FUEL_STILL      128 ANTHRACITE_ORE   129 LEAD_ORE        130 SALTPETRE_ORE
131 SIL_WOOD        132 SIL_LEAVES       133 SIL_SAPLING     134 OAT_1
135 OAT_2           136 CAMP_ANTENNA     137 RELAY_TOWER     138 SPIKE_BARRICADE
139 ALARM_CHIME     140 GUN_TURRET       141 SHOCK_COIL      142 NAV_CORE
143 HOVER_SLED      144 WOOD_POST        145 WOOD_RAILING    146 STAINED_GLASS
147 TABLE           148 SUGARCANE (crop block, also grows on Desertis oasis now)
```

Item ids (append): `recycler, sil_recycler, hearth, workbench, tannery, cauldron,
oil_works, wiring_bench, fuel_still, scrap, machine_part, machine_heart, slug,
lead_slug, nav_core, hover_sled, sled_cargo, sled_blade, sled_drill, charcoal,
anthracite_ore, lead_ore, leadrod, lead_plating, saltpetre, flux, titan_plating,
bone, basalt_pickaxe, basalt_shovel, basalt_axe, bone_pickaxe, bone_shovel,
bone_axe, titanium_pickaxe, titanium_shovel, titanium_axe, carbide_pickaxe,
carbide_shovel, carbide_axe, bone_disassembler, carbide_disassembler, bone_bucket,
basalt_knife, bone_knife, titanium_knife, bone_harpoon, titanium_harpoon,
carbide_harpoon, brushbuck_pelt, hardhide, buckguard, snowcloak, tideback_cuirass,
dune_wrap, cactus_leather, pear_cordial, tundroot_flour, oat_flour, frost_oat,
seed_oats, flatbread, oatbread, porridge, root_stew, ember_pie, smoked_brushbuck,
sil_timber, wood_post, wood_railing, stained_glass, table`.

Recipe homes (`crafting.ts` station union adds): `"recycler"` (no recipes — a
deconstructor UI, not a recipe station). Station union stays:
`null|bench|armory|refinery|electric|assembly|fuel|foundry|hearth|workbench|
tannery|cauldron|oilworks|wiring|still`.

Quest kinds appended: `nomad` (talk to a Keeper — completes on chapter end),
`camp` (destroy a Machine Camp antenna), `raid` (survive/destroy — auto by questPump
events), `dungeon` (enter volcano core), `sentinel` (kill), `navcore` (craft Nav
Core), `charted` (final flight — Phase 2 end), `sled` (craft the Hover Sled).

Run save flags added: `sentinel_dead: boolean`, `unlocks: Record<string, true>`
(Catalog recipe locks keyed by recipe id), `towersRisen: string[]` (keyed by world
cell), `sledKey` not needed (sled is a block + per-block charge in world bag
`sleds: Map<key,{charge:number, up:Record<string,true>}>`).

## Slice contracts

### Slice D0 — data (blocks.ts, items.ts, save.ts)
New blocks per the table with defs in house style (stations solid ~2 breakTime,
disassembler-removable minTier 1; LEAD_ORE minTier 1, SALTPETRE minTier 1,
ANTHRACITE minTier 3; SIL_WOOD like WOOD, SIL_LEAVES like LEAVES; OAT_* like
MELON_*; CAMP_ANTENNA/RELAY_TOWER solid machine-removable; SPIKE_BARRICADE solid
1.5; turrets/coil/chime like machines; NAV_CORE like FLIGHT_CONTROLS; HOVER_SLED
solid 2 placeable; WOOD_POST/RAILING thin? plain solid; TABLE 1×1). `save.ts`:
version 4, reject <4 cleanly (fresh-start message), new fields above.

### Slice D1 — crafting fork (crafting.ts, trades.ts)
Every existing recipe gets a planet home list; the station a recipe is crafted at
becomes planet-resolved: DESERT recipes keep current homes; SILVARIS twin recipes
added at twin stations with Silvaris inputs. REMOVE desert materials from
Silvaris homes: foundry/assembly/fuel_works inputs switch (engine_core silvaris:
6 titan_plating + 2 titaniumrod + 2 leadrod + 2 glass; dock_pad: 2 titan_plating +
1 lead_plating; assembly_bench itself moves to wiring; foundry: 6 stone + 4 leadrod
+ 2 charcoal at workbench). thruster/thruster_nozzle get a silvaris recipe
(thruster_nozzle sil: 1 titaniumrod + 2 leadrod + 1 metal? no metal — titaniumrod +
leadrod + stone). Campfire smelt list stays desert-only (rock→metal NEVER on
Silvaris); HEARTH smelt: basalt→rock, lead_ore→leadrod×2, saltpetre_ore→saltpetre,
farmland/sand→glass, sil_timber→charcoal, raw meats→cooked. Tools/gear/food per
Canon. trades.ts: rename Trader→Nomad (code + strings); add Nomad sells of
`seed_oats`; keeper quests separate.

### Slice G — worldgen (gen.ts, silvaris.ts)
Ore bands per Canon (desert anthracite deepest; silvaris swap). Silvaris trees use
SIL_WOOD/SIL_LEAVES/SIL_SAPLING + `sil_timber` drops. OAT wild stands near
settlements. SUGARCANE origin: oasis pools gain SUGARCANE blocks (desert gen).
Machine Camps: new lattice (sparser than settlements, ~520) — authored scrap shack
+ CAMP_ANTENNA + chest (machine loot: machine_part, metals, Logic→Machine Hearts
rare). Volcano core: one authored structure in the Scorch Belt (fixed pick by seed
hash): shaft down through 3 levels — Conduit Hall (3 power conduits = leadrod-lined
walls that break), Cooling Gallery (2 channels sealed by stone; bucket/blast opens,
WATER sources behind), Arena (21×21 basalt chamber, 2 shock-pylon anchors) — and its
Landmark. Arrival-pad guaranteed settlement stays.

### Slice M — mobs (mobs.ts)
Robot mob family (shared AI skeleton, non-eating, no knockback fear): WARDEN (slow
scout, 20 hp, drops its planet's 2 metal + machine_part×1; Desertis relic: one
patrolling the ruin cluster flees when the player is within 12 of the WRECK),
SENTRY (60 hp shooter? melee w/ lunge — keep melee line soldier, drops metal+parts),
BREAKER (220 hp armored heavy at camps; drops metal×4 + parts×2 + machine_heart 50 %),
HAULER (non-hostile, walks camp↔camp, 40 hp, drops metal×3, parts×1; attacking it
makes nearby machines hostile). Spawn: camps (Silvaris) + patrols + Warden desert
count ~3. Pelt drops doubled when killed with knife/harpoon per Canon. Squad
support: `spawnSquad(world, from, targetKey)` — 3 Sentries + 1 Breaker pathing to a
Grid node, attacking grid blocks (new `attackBlock` mob state), despawn at dawn.

### Slice S — systems (new files + game.ts hooks) — the big wave (one game.ts writer)
- `recycler.ts` / game panel: drop-item grid UI, per-planet output rules, scrap.
- `defense.ts`: turret/coil/chime/barricade ticks hooked into machine tick pass;
  slug magazine on block state; targeting list (machines + hostile fauna); toggle.
- `sled.ts`: mount/dismount, speed, charge, upgrades, pad recharge, blade/drill.
- `crops.ts` or game: OAT growth handler + TUNDROOT/EMBERBUSH growth (fix the dead
  seeds), Planter/Harvester accept oat/tundroot/ember.
- `keeper.ts` or game: Keeper entities at camps (named, non-killable like Nomad),
  E → chapter panel (text cards), trust = the camp's deed-quest done.
- `endgame.ts` or game: `sentinel_dead` flag, Catalog lock UI (locked entries hidden;
  unlock toast wave), volcano dungeon triggers (conduit cut / channel flood / coil
  states feed `bossShield`), Sentinel boss entity (hp 900, `shielded: true` until
  all 3 conduits cut; +50 % dmg per channel opened; Shock Coil pulse ×2 vs it),
  death → unlock wave + Chronicle + questBump("sentinel").
- Final flight: Nav Core block present aboard + Super port + flyCheck → new
  "Charted Flight" button (only when `sentinel_dead` and quest `charted` active):
  cinematic (reuse lift-off cinematic + star-chart overlay) → quest complete,
  Phase-2-done Chronicle; world continues (Phase 3 later).
- Quests (quests.ts rewrite of the Phase-2 chain, Phase-1 additions):
  Phase-1 appended beats after existing: "Belly of the Wreck" (examine scar —
  kind `craft`? use new `inspect` reuse: make it `reach` on wreck cell) +
  "Scorched Bearing" (reach the gouge field) BEFORE `leave`; Warden-flee is a
  scripted encounter beat (chronicle line). Phase-2 chain (replaces the old
  post-arrival chain): arrival beats ("First Light" keep, "The Dock" keep,
  "The Settlements" keep) → "Cold Tools" (craft a basalt tool) → "Nomad's Debt"
  (talk to first Keeper; deed: kill 1 Warden nearby? deed = camp? first camp is
  camp-1) → "Cut the Antenna" (kind `camp`, camp 1) → "Power the Silence"
  (Wire: craft at Wiring Bench, kind `electric`) → "Alloys & Engines" (Foundry +
  Assembly twin, kind `bench2`) → "The Long Thirst" (Oil Works rocket fuel) →
  "Dust and Salt" (Keeper 2 chapter, kind `nomad`) → "Second Reclaimer" (kind
  `camp` camp 2) → "The Scattered Story" (Keeper 3+4 chapters, kind `nomad`,
  goal 2) → "A Chart Before the Dark" (kind `navcore`) → "Into the Scorch"
  (kind `dungeon`) → "Kill the Sentinel" (kind `sentinel`) → "Fuel of the Gods"
  (craft own Super Fuel, kind `superfuel`) → "Charted" (kind `charted`, end).
  Hover Sled: side quest `sled` off the settlement (reward recipe).

### Slice R — renderer/atlas/icons (renderer.ts, icons.ts)
Full repaint of tile recipes + planet-keyed natural tiles + all custom geometry +
new icons (per Canon). Robot bodies: 3-part box rigs from the existing mob draw
path. Sentinel: 5-cell tall boss rig. Keep budget: atlas stays one 256 texture.

### Slice V — verify + ship
`npx tsc --noEmit` clean; dev-server walk: new Phase-2 start on Silvaris (basalt
tool craft, hearth smelt, wiring bench chain, recycler scrap on a carried desert
item, camp + antenna clear, sled, turrets vs squad, dungeon + boss kill unlocks
super fuel, charted flight ends); Phase-1 path intact (foreshadow quests, anthracite
visible only deep); v3 world rejected with fresh-start notice; `npm run build`;
commit+push BOTH repos (AGENTS.md).

## Build order

D0 → D1 (me). Then PARALLEL, disjoint files: G-agent (gen.ts, silvaris.ts),
M-agent (mobs.ts), R-agent (renderer.ts, icons.ts). Then me only: S (game.ts +
new modules + quests.ts), then R-fixes if ids drift. V at the end.
Never two writers in one file; agents report id drift instead of editing shared
files.
