# Feature Plan (2026-11-23) — Phase 2: Silvaris, the Second Planet

Settled by the grilling session (2026-11-23, four rounds + close-out, decisions Q1–Q30,
glossary rewritten, ADRs 0010–0013). Supersedes the completed Chest Interface plan
(history in git). This file is the contract for every implementation slice: names,
ids and signatures here are FIXED — do not rename.

## Canon (design decisions, verbatim outcomes)

- **Phase** = milestone AND world-creation start point. **Phase 0 (Hard)**: survival
  only, wreck husks. **Phase 1 (Easy, recommended)**: fix the Ship on **Desertis**.
  **Phase 2**: use the Ship for planetary travel on **Silvaris**. **Phase 3**
  (not built): interplanetary travel. Old code modes kept: `"hard"` = Phase 0,
  `"easy"` = Phase 1, `"phase2"` = **starts on Silvaris** with a fixed, docked Ship
  (the old flight-capable-desert-wreck meaning is deleted).
- **Desertis** (Desert Planet) / **Silvaris** (Second Planet). The Phase-1 finale
  (new last quest, kind `leave`) ends Phase 1; the Phase-2 chain ends with the
  player crafting **Super Rocket Fuel** themselves; it rests there until Phase 3.
- **Super Rocket Fuel** (`super_fuel`): blue 1×2 canister. Inert for flight — it
  NEVER supplies charges; consumed ONLY by **Leave Planet**. Phase 1: quest loot
  only (Reward Cache on Lift-Off). Phase 2 finale: craftable at the Fuel Works.
  Speed-grade bonus deferred (`SHIP.fuelGrade` stays unused).
- **Engine Core panel**: E opens a panel with **two separated physical canister
  slots** (drawn 2×1 each). A rocket canister in a slot banks 60 charges and burns;
  it is consumed (slot empties) exactly when its charges run out. **First draw
  locks the slot forever** — only untouched canisters can be removed; breaking a
  Core spills untouched canisters (with their charges) and DESTROYS locked fuel.
  Inserters load rocket canisters into empty ports only; Super loads by hand only.
- **Leave Planet**: button in the Flight Controls panel, beside Lift-Off. Enabled
  when: takeoff checklist holds, ≥1 port holds a Super canister, and ≥1 port still
  has flight fuel (rocket charges > 0), and the player is at the Yoke. Press →
  warning dialog ("…Consumed: 1 Super Rocket Fuel canister. Travels with you: the
  Ship and everything aboard it, your inventory. Left behind: everything on the
  ground. You will not return until you make Super Rocket Fuel yourself.") →
  confirm burns exactly the Super canister → scripted **lift-off cinematic** →
  arrive on Silvaris, Ship **docked on the Dock pad at the arrival site** near the
  Silvaris origin (guaranteed advanced settlement, flattened like the crash
  plateau; respawn fallback there = the Ship). One-shot: Desertis stays in the
  save, dormant and intact, unreachable until Phase 3.
- **Save**: ONE world slot, `RunSave v3` = global run + `worlds.desertis` +
  optional `worlds.silvaris`, each a `WorldRun` record (ADR 0010). v2 → v3
  migration wraps the planet-scoped v2 fields into `worlds.desertis`.
- **Height**: `CH = 160` globally (array capacity; ADR 0011). Each planet gets a
  `worldH` for playable sky/ceiling: Desertis 96 (flight ceiling `worldH + 32`),
  Silvaris 160. Desert terrain unchanged (max ~75).
- **Silvaris biomes**: Deep Ocean, Shallows, Temperate Plains, Boreal Forest,
  Alpine Peaks, Scorch Belt. No desert. Sea level y = 56; peaks to ~150; ocean
  floors ~20. Hazards: Alpine cold, **Blizzard** (amplifies cold, scours),
  **Ashstorm** (amplifies heat, scours) over the Scorch Belt, lava-adjacent
  scorch heat (no fire-propagation system). A Storm Breaker calms ANY storm.
  Oceans run on the existing Water Source/Flow sim.
- **Settlements**: advanced uninhabited structures (loot chests, beds, Alabaster-
  family + Metal Plating builds), each with a **Dock** plaza of `DOCK_PAD` blocks.
  Trader Camps exist on Silvaris too (same unattackable barter rules, new goods).
  **Inscriptions**: readable lore blocks in settlements — resolve the Dwellers
  (who they were / why they left) and open the Phase-3 question (what worlds remain).
- **Stations (4 new)** + global recipe-home shift (ADR 0013):
  **Electric Bench** (crafted at Crafting Bench): Power Panel, Power Pole, Battery,
  Wood/Wind/Solar generators, Electric Lamp, Inserter, Planter, Harvester, Chest,
  Chest Connector, Chest Interface, Heat Regulator, Storm Breaker.
  **Assembly Bench** (crafted at Electric Bench): Engine Core (CRAFTABLE — the
  "single quest-exclusive item" line dies), Dock Pad, and future ship parts.
  **Fuel Works** (crafted at Assembly Bench): `rocket_fuel + graphite_ore →
  super_fuel`. **Foundry** (crafted at Electric Bench): titanium_ore → titaniumrod,
  metal_plating + coal_ore → steel_plating.
  NOTHING Phase-1-critical moves off the Crafting Bench (Frame Corners, Flight
  Controls, Thruster Nozzle, Refinery, Campfire, Cooking Pot, tools stay home).
- **Fauna**: 3 new mobs, Silvaris only — **Snow Stalker** (Alpine predator),
  **Tideback** (huge coastal grazer), **Brushbuck** (plains herd). Desert fauna
  never spawns on Silvaris and vice versa.
- **Crops**: 2 new, via settlement chests: **Tundra Root** (cold-tolerant tuber)
  and **Ember Bush** (scorch-edge berry). Existing food chain keeps working.
- **Quests**: ONE continuous Main Quest array; phase derived from index. Kill the
  dead "wait for the rescue ship" HUD string and retire `won` for it.
- Traders, pins, Map, Landmarks: per-planet records; Codex/Chronicle/quests/inventory global.

## Fixed ids (do not change)

Block ids (append in id order — `BLOCKS` is indexed by id; 65 stays the Rusted
Machine tombstone gap):

```
104 ELECTRIC_BENCH   105 ASSEMBLY_BENCH   106 FUEL_WORKS    107 FOUNDRY
108 INSCRIPTION      109 DOCK_PAD         110 TITANIUM_ORE  111 GRAPHITE_ORE
112 SNOW             113 BASALT           114 TUNDROOT_1    115 TUNDROOT_2
116 EMBERBUSH_1      117 EMBERBUSH_2      118 EMBER_FRUIT
```

Item ids: `super_fuel`, `electric_bench`, `assembly_bench`, `fuel_works`,
`foundry`, `dock_pad`, `titanium_ore` (raw), `titaniumrod`, `steel_plating`,
`graphite_ore`, `tundroot`, `seed_tundroot`, `ember_berry`, `seed_emberbush`,
`frost_pelt`, `tideback_hide`, `brushbuck_meat`, `cooked_brushbuck_meat`.

Quest kinds appended: `leave` (Phase-1 finale), then Phase-2 chain kinds.

Constants appended (Silvaris, one block in gen.ts): `SIL_SEA = 56`,
`SIL_PEAK_MAX = 150`, `SIL_ORIGIN_PAD_Y = 60` (arrival plateau top; pad is flat
32×32 of DOCK_PAD centred at origin ± a few cells, guaranteed settlement beside it).

## Slice contracts

### Slice F — foundation (save/world/planet switch)
- `blocks.ts`: `export const CH = 160; export const DESERTIS_H = 96;`
- `save.ts`: `export type Planet = "desertis" | "silvaris";`
  `interface WorldRun { seedStr; deltas; rots?; visited?; revealed?; pins?;
  chests?; campfires; pots?; battery?; genFuel?; trippedPanels?; crops?; trees?;
  appleTrees?; fruitRegrow?; coreFuel?; ships?; beaconMarks; entities; pods?;
  caches; }` — reuse the existing field types. `RunSave v: 1|2|3`; v3 fields:
  `planet?: Planet` (default desertis), `worlds?: { desertis: WorldRun; silvaris?:
  WorldRun }`. Top-level v2 fields stay for v2 loads; `migrateRun(run)` upgrades.
  `WorldMeta.mode` keeps `"easy"|"hard"|"phase2"`; `planet` is runtime state in the run.
- `world.ts`: `new World(seed, worldMode, planet)` — `genChunk(seed, structures,
  cx, cz, worldMode, planet)`; `worldH` getter (96 desertis / 160 silvaris).
- `game.ts`: `Game.planet`; active `WorldRun` bag swapped on planet switch: keep
  the live fields (`this.chests`, `this.crops`, …) but re-assign them from
  `planets: { desertis, silvaris? }` in `switchPlanet(to, shipLandPose)`.
  `snapshot()` writes live fields into the active bag then serializes `worlds`;
  `restore()` reads the bag for the active planet (v2 path via migrateRun).
  Ships: per-planet `ships` lists; jump moves the ShipSnapshot + its `"s<id>"`-keyed
  state (battery/genFuel/coreFuel/tripped entries ride inside the bag swap since
  they live in the planet maps already).
- `ship.ts`: `ceiling` → `this.worldH + 32` (pass worldH into Ship or read from
  provider); flight ceiling check uses it.
- `main.ts` + `index.html`: Phase 2 option text: "Phase 2 (Silvaris) — the Ship is
  already fixed, docked on another world"; `phase2` creates a run with
  `planet: "silvaris"` (Slice Q does the world content; F only pipes the flag).
- Desertis `paintShip(phase2)` legacy paint for mode phase2 is DELETED.

### Slice D — data (blocks/items/crafting/icons)
Blocks per the id table with sensible defs (stations like REFINERY: solid,
breakTime ~1.5–2, placeable, disassembler-removable; SNOW soft/breakable, BASALT
like ROCK; crops like MELON_*; INSCRIPTION solid 2×1? keep 1×1 solid). Items per
id table (super_fuel: 1×2, mass 5, blue #3f7fe8; stations mass 8-ish, block refs).
`crafting.ts`: station union += `"electric" | "assembly" | "fuel" | "foundry"`.
MOVE (home-shift, ADR 0013): power_panel, power_pole, battery, gen_wood,
wind_turbine, solar_panel, elec_lamp, inserter, planter, harvester, chest,
chest_connector, chest_interface, regulator, storm_breaker → `station: "electric"`.
ADD: electric_bench (bench: 4 metal_plating + 2 copperrod + 2 glass),
assembly_bench (electric: 6 metal_plating + 2 titaniumrod),
foundry (electric: 6 metal_plating + 2 steel? NO — foundry: 6 metal_plating +
2 copperrod + 2 coal_ore), fuel_works (assembly: 4 metal_plating + 2 glass +
2 titaniumrod), engine_core (assembly: 6 metal_plating + 2 titaniumrod +
2 copperrod + 2 glass), titaniumrod (foundry: titanium_ore → titaniumrod),
steel_plating (foundry: metal_plating + coal_ore), super_fuel (fuel:
rocket_fuel + graphite_ore → super_fuel), dock_pad (assembly: 2 steel_plating +
1 metal_plating), tundroot food + seeds (planting, not bench), recipes for
cooked_brushbuck_meat (campfire). Seeds plant at FARMLAND like the others.
icons.ts: draw icons for every new item in house style.

### Slice G — Silvaris generation (gen.ts)
`genChunk(..., planet)` dispatches: desertis path untouched. Silvaris:
biome weights on own fbm (Dunes-equivalent five+ocean centers): ocean/shallows
below/around `SIL_SEA`, plains, boreal forest (WOOD+LEAVES trees, denser), alpine
peaks (heightRaw up to 150, SNOW above y≈105, rock faces), scorch belt (BASALT,
LAVA-safe: just heat-stained rock, NO lava fluid; keep it thermal scenery +
Ashstorm biome flag). Ocean: WATER sources fill y ≤ 56 in ocean biome; Shallows
~y 50–57. Cave band same model + new ores: TITANIUM_ORE (deep band like cobalt),
GRAPHITE_ORE (mid band); keep iron/copper/coal/alabaster bands; NO cobalt? keep
all ores. Structures for Silvaris (own lattice, denser than Towns): SETTLEMENT
(one guaranteed at origin, `SIL_ORIGIN_PAD_Y` plateau + 32×32 DOCK_PAD plaza +
advanced build + loot chests + beds + Inscription + Trade stall): lattice ~260.
Trader Camps reuse camp model on Silvaris lattice. Inscriptions inside
settlements. Chronicle/Landmark registry entries: Settlement, Dock.
Spawn tables: Brushbuck (plains), Tideback (shallows/coast), Snow Stalker (peaks).

### Slice E — Engine Core fuel model + Leave Planet (game.ts, ship.ts, index.html)
Port state: `type Port = { k: 0 | 1 | 2; c: number; l: boolean }`
(0 empty, 1 rocket, 2 super; k=2 never burns). `coreFuel: Map<key, [Port, Port]>`
with legacy migration from `number[]`. `sh.fuel: [Port, Port]` + snapshot update.
Burn in `flightTick`: drain k=1 ports only (first drain sets l=true; c≤0 →
empty). `engineCoreAct` → new panel (`ui="core"`): two slot cells drawn 2×1;
click a slot with rocket_fuel/super_fuel to load an EMPTY port; click a loaded
port: unlocked → take back, locked → refusal toast. Inserters → `machinePush`
into core: rocket only into empty ports. `flyCheckComp` fuel line counts k=1
charges only. Break Core: untouched ports spill items (carry charges), locked
ports destroyed + toast.
Leave Planet: `ui-flight` button (disabled unless `leaveCheck()` ok: flyCheck +
super in a port + rocket fuel > 0 + player aboard the grounded-or-airborne Ship).
Press → confirm dialog → `departPlanet(sh)`: consume one k=2 port → cinematic
(scripted climb ~6 s: engine audio, sky fade via fog/dark lerp, camera chase) →
`switchPlanet("silvaris", arrival landing pose)` → land docked on the plaza
(performLanding at pad pose) → questBump("leave") → Chronicle beat + Codex.
Desertis stays in `worlds.desertis`.

### Slice Q — quests, phase starts, storms, inscriptions, docks
`quests.ts`: append `{id:"leave", kind:"leave", title:"Leave Planet", ...}` AFTER
liftoff; liftoff gets `reward: { item: "super_fuel", n: 1 }`. Then Phase-2 chain:
"First Light" (arrive — kind leave? auto), "The Dock" (land the Ship on a Dock
pad, kind `dock`), "The Settlements" (reach a Settlement, open a Chest, kind
`settle`), "Clean Currents" (craft at an Electric Bench, kind `electric`),
"Alloys & Engines" (craft at Foundry AND Assembly Bench, kind `bench2` goal 2),
"Heart for Hire" (craft an Engine Core, kind `core2`), "Fuel of the Gods"
(craft Super Rocket Fuel at the Fuel Works, kind `superfuel`) — chain ends;
completion text: Phase 2 done, Phase 3 waits.
Phase 2 Start (`mode phase2`): run planet=silvaris; pre-docked flight-capable
Ship at the arrival plaza (lit thrusters, Core with 2 full rocket canisters,
Yoke, Panel+Battery wired); quest i = first Phase-2 quest; chronicle pre-seeded.
Storm system: generalize the Sandstorm state into `stormKind: "sand"|"blizzard"|
"ash"` chosen by planet + biome (peaks/forest → blizzard, scorch → ash);
blizzard amplifies COLD (mirrors sandstorm's heat amplification), scours and
drains Water the same way; Storm Breaker calms any kind. HUD/toast wording per
kind.
Inscription: E → panel with the site's lore text (hash pick from ~8 texts).
Dock: ship grounded whose Frame footprint sits on DOCK_PAD → `docked` flag
(toast + Chronicle first time; respawn anchor alongside Ship beacons).
Delete "wait for the rescue ship" HUD string; keep `won` for nothing else — remove
its use, keep the save field harmless.

### Slice M — mobs (mobs.ts + spawn)
Snow Stalker (fast alpine predator, Snake-model+; drops `frost_pelt`), Tideback
(huge slow coastal grazer, Tortoise-model+; drops `tideback_hide`), Brushbuck
(fleeing herd, Kangaroo-Rat-model+; drops `brushbuck_meat`, cook →
`cooked_brushbuck_meat`). Spawn gated by planet + biome table from Slice G. No
desert fauna on Silvaris; new fauna never on Desertis.

### Slice R — renderer (renderer.ts)
Art cases for all new ids: stations (distinct silhouettes, house voxel style),
Inscription (carved stele), Dock Pad (inlaid marker pattern), Snow/Basalt, new
ores, crops, EMBER_FRUIT. Ocean water already renders as WATER (fine). Silvaris
sky/sun tint: slight hue shift (cooler, wetter) keyed by planet. Cinematic FX
hook from Slice E (fog/dark lerp is enough).

### Slice V — verify + ship
`npx tsc --noEmit` clean. Browser: create each Phase start; Phase 2 Start lands
on Silvaris; walk the plaza; mine new ores; craft at all 4 stations; Chest
Interface now at Electric Bench; storms fire; Phase 1 path: cheat-load a full
ship, load super fuel, Leave Planet warning, jump → Silvaris, docked, quest
advances; old v2 world loads (migration). `npm run build`; commit+push BOTH repos
(AGENTS.md).

## Build order

F (foundation) → D (data, parallel with F, disjoint files) → G, E (after F+D;
G=gen.ts, E=game.ts disjoint) → Q, M, R (after G/E; Q=game.ts/quests/survival,
M=mobs.ts, R=renderer.ts) → V (me). One game.ts writer per wave.
