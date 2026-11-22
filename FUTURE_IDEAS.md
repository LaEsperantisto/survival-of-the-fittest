# Ship Flight — Phase 1 Design

Settled by a grilling session (2026-11-22), four rounds, no open decisions. This file is
the scratchpad and source doc; a later pass folds it into `GLOSSARY.md` and
`docs/adr/` as NEW files (existing files stay untouched — another agent owns them).
Scope: **Phase 1 only**. Not implemented yet.

## Phase plan

- **P1 — Getting into the air**: this document.
- **P2 — Planetary flight**: next real milestone; full 3D flight, pitch/roll, the Ship
  as saviour (player comfortable away from spawn because home travels).
- **P3 — Interplanetary**: space, stations. Explicitly out of scope, different time.

Feel target per phase: P1 "safe in the base, on edge outside"; P2 "the Ship is the
saviour"; P3 "safe on the home planet, not in space".

## Core model

### The Ship is an entity

- Real entity: position, **yaw**, velocity — not the scripted `liftoffFrame` animation.
  **Yaw-only in P1**: continuous heading (~25°/s at the controls); pitch/roll deferred
  to P2 (a cosmetic render bank may come then; block geometry never rotates).
- The player walks inside, places / breaks / interacts with blocks even in the air.
  In-flight placement targets **Ship-local cells** (new blocks align to heading, not
  world axes); nothing can be placed outside the Ship Frame while airborne.
- **Frame Corners may only be placed / broken / moved while grounded.** All other
  ship blocks are editable in flight; mass updates live (overloading mid-flight makes
  you sink).
- Carried entities (player, Survivors, mobs, dropped items) live in **ship space**
  while on/inside the Ship — walk, fall, fight as if it were ground; no inertia
  simulation in P1. Step off an open door → world gravity applies from that instant.
- Piloting at the **Flight Controls**: W/S drive along heading, climb/descend keys,
  A/D yaw. Interacting shows a 3rd-person view of the Ship, scroll = zoom.
  Player aboard but off-panel = **hover** (holds altitude, drifts to a stop).
  **Nobody aboard = slow sinking** (falling out is forgiving).
- Flight envelope P1: ~10 m/s horizontal, ~4 m/s climb, ceiling the world height (96).
  Speed = base × **fuel-grade multiplier** (Rocket Fuel upgrades plug in here).
- Collisions with terrain, buildings, other Ships: **soft stop**, no damage, no
  overlap. Takeoff/landing from partial burial is free — the volume lifts, whatever
  is not claimed stays.

### Ship Frame (membership)

- **Frame Corner** blocks, placed at cuboid vertices — corners only, no outline.
  Two Corner Blocks differing in all three axes **declare a cuboid iff all eight of
  its corner cells hold Corner Blocks**; the **Ship Frame** = union of every declared
  cuboid. Concave/"inside" corners arise naturally as one cuboid's corner lying on
  another's face.
- The Corner assembly must be connected (so separate assemblies = separate Ships).
- A known ambiguity: a vertex set can accidentally brace a spanning cuboid (a U-
  shape's notch lifts). Mitigation: the computed volume is shown as a **debug outline**
  at the Flight Controls, and takeoff refuses an invalid Frame. Players fix their own
  outline — you can only add volume by placing corners, never subtract.
- **Claim rule: every cell inside the Ship Frame volume rides with the Ship** —
  blocks, terrain, water, containers, contents. No material exceptions. Enclosing
  ground is the player's error: a Frame sunk in sand lifts a plug and leaves a hole
  (the hole must persist as a world edit so generated terrain does not regrow it);
  a dug cellar inside the Frame lifts as an air pocket and the desert heals beneath.
- Two Ship Frames whose volumes overlap: **both invalid**, takeoff refused, shown in
  the outline.
- The wreck is **pre-framed** by `paintShip` (a valid Frame from world creation,
  floor above the sand; the water-compartment pool sits outside the Frame).
- Frame Corner craft: Crafting Bench — 2 Metal Plating + 1 Copper Rod.

### Mass budget

- Every block weighs **1** (Thruster 22, matching its item mass; dense families may
  cost more). Wreck ≈ **700**. Each Thruster's lift capacity **250**.
- Over capacity: slow, cannot climb, gently sinks — a forgiving failure, not a
  locked door.

### Takeoff checklist (Flight Controls refuse + one line per failure)

1. Frame Corners form a valid connected polycuboid; no other Ship Frame overlaps.
2. An **Engine Core** stands inside the volume, inside the Ship's Grid, and that Grid
   is powered **and self-sufficient** — its own charged Battery or generation; Pole
   reach into a ground Grid does not count.
3. Engine Core fuel > minimum.
4. No Chest cluster straddles the volume boundary (break the link; move goods by
   Inserters instead).
5. The Ship is grounded.

Deliberately NOT gated: sealed interior, closed doors, survivors aboard, thrust
vs. mass (that failure is the gentle sink).

### Engine Core

- The **Phase 1 final quest item** (still quest-exclusive, still not craftable; the
  game's phases may hand out more such artifacts later). Recovered from the second
  wreck (`paintSecondShip` loot), carried, stood up inside the Ship Frame.
- A machine block on the Grid: draws electricity; carries **two Rocket Fuel ports**
  (= fuel reserve capacity, not double burn); feeds the Thrusters while airborne.

### Thrusters

- **Broken Thruster** (wreck's four, and only those — no more Broken ones exist):
  press E with a **Thruster Nozzle** → becomes a **Thruster**.
- Post-quest, craftable: **Thruster Nozzle + 4 Metal Plating + 1 Cobalt Rod**.
- A Thruster is **lit only while airborne** (no idle burning on the ground).
- Any Thruster inside the volume counts toward lift; the four originals give 1000
  capacity ≈ 40% slack over the wreck. Expansion = crafted Thrusters.

### Fuel chain

- **Coal Ore**: Ore Vein in the Iron/Copper cave band + rare Badlands surface
  outcrops. Raw ore burns at a Campfire for ~6 charges.
- **Oil**: a second fluid behaving exactly like Water (Source + Flow) except no
  plants grow near it. Harmless in P1 — **fire is a deliberate later system**.
  Scooped with the Bucket → **Oil Bucket** (same "move the fluid" verb as Water).
- **Oil Sands** blocks hold Oil; **Oil Seeps** are recurring Landmarks (oasis-shaped,
  vegetation-free) findable by the Hidden Landmark Tracker; rare **giant oil-sand
  fields** ~30×30, irregular, realistic outlines.
- **Refinery**: new station block (1×1, E panel, two inputs + output; Bench-crafted:
  3 Metal Plating + 2 Copper Rod + 1 Glass). Recipe: 1 Oil Bucket + 1 Coal →
  1 **Rocket Fuel Canister** (1×2 item); the Bucket comes back empty. Canisters are
  consumed whole at the Engine Core (by hand or Inserter — adjacency law holds).
- Burn: ~1 Canister per ~2 flight-minutes at 4 engines. Future fuel grades multiply
  speed/burn.

### Power

- Grids follow the existing model (one Panel per network, binary trip, ADR 0007).
- **Ship Grid ↔ ground Grid connect only while grounded** — dock-and-charge is real
  gameplay; airborne the domains are sealed. Machines aboard run off the Ship Grid.
- Trip at altitude: **graceful descent** — forgiving, at the cost of the lesson.
  (Softens ADR 0007's teeth for Ships only; the ground rule is untouched.)
- Solar Panels day-only (already true); **Water Wheel deleted entirely** (removes the
  unlimited-power exploit).

### Weather, survival, death

- The desert follows you up: Sandstorms bite exactly as on open ground; a Storm
  Breaker riding the Ship still calms its radius; insulation only helps inside.
  No wind drift, no block damage in P1.
- A **Save Beacon inside the Ship** → respawn **in the Ship**, even while airborne.
  Beacon broken → crash site.

### Flight HUD

At the Flight Controls: all normal HUD except the hotbar (Map, Quest/Chronicle,
Water/Heat/Health, warnings), plus panel readouts: **mass vs. total Thruster capacity**
(red over capacity), **fuel** (both ports), **altitude**, **heading**, **Ship Grid
status**, and the **Frame validity / volume outline** toggle. Refused takeoff prints
one line per failed checklist item.

## Deletions

- **Score entirely**: no days-survived metric, no best score, no finished screen —
  and with it the glossary's "completing the game scores higher with fewer days".
  The Main Quest guides; P1 completion is celebrated ("the desert is yours now") and
  play simply continues. The in-game day cycle itself stays (solar, dawn Trade
  Tables, Bed, crops).
- **Water Wheel** block + recipe.
- The scripted Lift-off cinematic as an ending trigger and `thrustersAllLit()`'s
  fixed scan box (x −8..6, y 29..37, z −13..13) — replaced by the real Ship entity.
- Deadwood **3 → 1** Campfire charge (Log 2, Kindling ½, raw Coal 6).

## P1 quest spine (Main Quest, Phase 1)

1. **Wings of the Wreck** (exists): deep-cave materials → Thruster Nozzles → wake the
   four Broken Thrusters.
2. Find the **second wreck** and recover the **Engine Core**; stand it up inside the
   Ship Frame.
3. Wire the Ship: own Power Panel + Battery aboard (teaches self-sufficiency).
4. Fuel: mine Coal, find an Oil Seep, build the Refinery, refine Canisters.
5. **Lift-off**: Flight Controls, takeoff under your own power = Phase 1 complete.

Chronicle teaches Frame extension (grounded corner moves) along the way.

## Glossary changes this implies (for the later docs pass)

New: **Frame Corner**, **Ship Frame**, **Flight Controls**, **Thruster**, **Rocket
Fuel (Canister)**, **Refinery**, **Oil**, **Oil Sands**, **Oil Seep**, **Oil Bucket**,
**Coal Ore**. Revised: **Engine Core** (Phase 1 artifact, installed machine), **Ship**
(flying entity with a Frame), **Lift-off** (piloted; ends Phase 1, not the game),
**Broken Thruster** / **Thruster Nozzle** (nozzle-installed Thruster), **Main Quest**
(phased), **Landmark** + **Hidden Landmark Tracker** (Oil Seeps), **Save Point**
(respawn aboard), **Campfire/Coals** (Deadwood 1, Coal 6), **Water Bucket** (scoops
Oil too), **Ore Vein** family (Coal). Deleted: **Score**, **Vehicle** ("later addition"
— now P1/P2 reality), Water Wheel mentions.

## ADR candidates (new files at docs/adr/ in the docs pass)

- **Ships are floating block entities claimed by Corner-Block polycuboids, yaw-only in
  P1.** Hard to reverse, surprising without context, real tradeoff (rejected: the
  current material-set membership `SHIP_IDS`, which would steal any hull-plated shack
  200 m away; rejected: membership by contact to the Core; rejected: no rotation).
- **Ship Grids seal from ground Grids while airborne; self-sufficiency gates takeoff.**
  Tradeoff vs. the uniform reach-based Grid law.
- (Marginal, maybe skip:) Oil as a second fluid; Water Wheel removal are balance calls.

## Implementation brief for a future session

Read this whole section before touching code. Line numbers drift (another agent works
in this repo) — find everything by **symbol**. Follow AGENTS.md at the end of each
landed step: `npx tsc --noEmit`, browser-verify, `npm run build`, commit/push both
repos (root + `dist/`).

### Current state to know (verified 2026-11-22, re-verify)

- `ENGINECORE` block id 21 **already exists** (`blocks.ts`), item `engine_core`
  (`items.ts`, desc: "place it within reach of a Save Beacon to finish the Main
  Quest"); `gen.ts` `paintSecondShip` scatters it on the surface near the second
  wreck; `Game.place()` has an `ENGINECORE` branch that **fires the win**.
- Win/score path: `Game.win()` (two call sites: liftoff cinematic and ENGINECORE
  placement), `scoreDays()`, `playSec`, `submitBest`/`bestScore`/`K_BEST` in
  `save.ts`. The Main Quest flag lives in `quests.ts`.
- `THRUSTER`=56 / `THRUSTER_LIT`=57; items `thruster_broken`/`thruster_lit` (2×2,
  mass 22); `act()` installs a Nozzle: THRUSTER → THRUSTER_LIT + `questBump`;
  `thrustersAllLit()` (fixed scan box) → `startLiftoff` → `liftoffFrame`
  snapshots/restacks `Game.SHIP_IDS` rows.
- Power (`game.ts`): `powerCells: Map<"x,y,z",id>`, `isPowerBlock(id)` = **contiguous
  id range** POWER_PANEL..HARVESTER, `rebuildPower()` union-find (Pole↔Pole ≤
  `POLE_LINK`=16, device↔Pole ≤ `DEVICE_REACH`=10), `updatePower(dt)` 4 Hz with
  `genOutput` (Wood 4 / Water Wheel 3 / Wind ≤8 / Solar ≤4), `ratedDraw`,
  `batteryCharge`, `trippedPanels`, `runMachines()` 1 Hz.
- Everything else is world-coord keyed: `chests: Map<clusterKey, Slot[]>` +
  `chestCluster` BFS, `crops = Map<"x,y,z",progress>`, `breakers = Set<"x,y,z">`
  (Storm Breaker radius check `game.ts` hypot loop), `rots`, `FireState` fires,
  `World.roomInfo(x,y,z,400)` (Sealed Space / regulators / Base anchors),
  `survival.ts` reads `roomInfo` + block `R`.
- Water sim: `WATER` + `WATER7..WATER1` in `processWater/drainFlow/floodFrom`;
  `isWater/waterStrength/flowId`; Bucket scoop/pour in `act()`.
- Ores: cave-band noise blobs in `genChunk` (Cobalt y<12 @0.886; Iron y≥12 @0.864;
  Copper y≥12 @0.878; Alabaster y 8–24). `FIRE_FUEL`: kindling .5, wood_log 2,
  deadwood 3.

### Step A — removals and rebalances (no new systems; land first)

1. **Delete Score**: remove `scoreDays`, `submitBest`/`bestScore`/`K_BEST`, score
   displays in HUD/`index.html`/pause menu, both `win()` victory screens. Keep
   `playSec` and the in-game day clock (`survival.ts`, `DAY_SECONDS`) — solar, dawn
   Trade Table shuffle, Bed, and crop timing all depend on the cycle.
2. **Delete Water Wheel**: `WATER_WHEEL` const + def, item, recipe, `genOutput`
   case, renderer art, any Grid Relic generation that places it. **Do not renumber
   block ids** — leave the number a permanent gap.
3. **Rebalance fuels**: `FIRE_FUEL` deadwood 3→1.
4. **Merge thruster items**: one `thruster` item (block `THRUSTER`, 2×2, mass 22).
   `thruster_lit` item id deleted — on load, migrate item `thruster_lit`→`thruster`
   and block `THRUSTER_LIT`→`THRUSTER` (keep the id reserved for migration only).
   Nozzle install now produces an **unlit** Thruster; keep `questBump("thruster")`.

### Step B — content that runs on the ground

5. **Coal Ore**: new id (next free, 84+). Def like other ores (pickaxe, minTier 1,
   `placeable:false`); `genChunk` cave crust alongside Iron/Copper (y≥12, threshold
   ~0.87) + rare Badlands surface outcrops (reuse the surface-vein approach or a
   small patch rule). Item `coal_ore`; `FIRE_FUEL.coal_ore = 6`; Catalog/Codex
   entries; Chronicle "coal" lesson.
6. **Oil fluid family**: `OIL` source + `OIL7..OIL1` levels, def mirrors Water
   (solid:false, opaque:true, low R). Generalize the sim: pull the water rules into
   a per-fluid spec `{source, maxLevel}` and run `processWater/drainFlow/floodFrom`
   over `[WATER, OIL]`; rename `isWater→isFluid` family helpers. **Crop/Planter
   water-proximity checks must test Water ids only** (`cropPause`, `planterAct`) —
   oil never waters. Bucket `act()`: scoop/pour works on any fluid source; scooped
   oil is item `oil_bucket`; pouring `oil_bucket` places an OIL source. Bucket
   comes back on pour; refining returns the bare Bucket too.
7. **Oil Sands + Oil Seeps**: `OIL_SANDS` block (sand variant look, `placeable:false`,
   breaking always yields `oil_bucket` — that is the bulk supply). New Landmark
   `OIL_SEEP` in the `Structures` lattice (oasis-shaped, vegetation-free: OIL source
   pools on OIL_SANDS-stained ground). Rare **giant fields**: separate sparse lattice
   cell, noise-perturbed blob radius ~15, depth 2–3 — not rectangular. Register both
   with the Landmark registry and the Hidden Landmark Tracker (they recur, so the
   tracker rule holds).
8. **Refinery**: block + item; bench recipe 3 Metal Plating + 2 Copper Rod + 1 Glass;
   renderer art case; `station: "refinery"` in `Recipe`; station UI reuses the
   Campfire-style staging panel (two input slots, one output). Recipe:
   `oil_bucket + coal_ore → rocket_fuel(+bucket back)`. Item `rocket_fuel` =
   **Rocket Fuel Canister**, 1×2 footprint, mass ~4.
9. **Frame Corner + Frame logic**: block + item; bench recipe 2 Metal Plating +
   1 Copper Rod. **`src/shipframe.ts` already exists — pure module, written and
   behavior-checked 2026-11-22** (strict tsc clean, 9 standalone checks passed):
   `computeFrame(corners)` → `{cuboids, errors, bbox, cellCount}`,
   `boxesOverlap`, `framesOverlap`, `keyOf/parseCornerKey`. Union connectivity is
   exact on the cuboid complex (face-overlap/face-touch links; edge/corner contact
   splits). Errors are ready-made refusal lines for the Flight Controls panel.
   Findings baked into the tests: two cuboids aligned on two axes **brace their own
   spanning box** — the D12 ambiguity fires between arms alone, so separate Ships
   need Frame volumes whose bands are offset or gap-separated, and the debug
   outline is mandatory UI, not a nicety.
   No gameplay effect yet — the module only powers a debug outline
   (`THREE.LineSegments`) and the pre-framing check.
10. **Pre-frame the wreck**: in `paintShip`, place Frame Corners at the vertices of
    the wreck's bounding volume (must contain hull shell y 30–34, both wings and
    their 4 THRUSTER blocks at z ±11, and the Save Room; **floor above the sand line
    so the Frame encloses no terrain**). Verify: `shipframe` reports the wreck's
    frame valid from world creation.

### Step C — the Ship entity (translation only, no yaw yet)

Suggest new module `src/ship.ts`; `Game` gains `ships: Ship[]`.

11. **Data**: `Ship { id, pos (world anchor of local origin), yaw=0 (P1), vel,
    grounded, cells: Map<localIdx,{id,rot}>, corners registry, per-ship state:
    chest clusters, powerCells keys, crops keys, fires, battery, engine fuel }`.
    **Ship blocks live only in `ship.cells`** — never written back into chunks, even
    grounded. A grounded Ship floats at its rest height; world chunks hold nothing of
    it.
12. **Takeoff snapshot**: on takeoff, for every cell in the (grounded, yaw-0) volume:
    copy `(id, rot)` into `ship.cells` at local idx and `world.set(x,y,z,AIR)` —
    that AIR delta is what makes the lifted plug/hole **permanent** (generated
    terrain must not regrow it). Move keyed state with the cells: `chests` cluster
    entries, `powerCells`, `crops`, `rots`, fire states, breaker set. Checklist
    gate (see design): valid frame incl. no overlap, Engine Core + powered
    self-sufficient ship Grid, fuel > min, no straddling Chest cluster, grounded.
    Print one refusal line per failure in the Flight Controls panel.
13. **Flight tick** (replace `liftoffFrame`): panel input drives velocity along
    heading + vertical; integrate; collide by testing the target local cell's world
    transform against world `isSolid` + other ships' cells → **soft stop**;
    grounded when resting on support. Fuel burn at `updatePower` cadence
    (Engine Core draw + `engineFuel` two canister slots, ~1 canister/2 min at 4
    lit Thrusters); over-mass → climb disabled + slow sink; no player aboard →
    slow sink; airborne Thrusters get the `jet` FX (reuse renderer "jet").
14. **Carried entities**: player, mobs, dropped items standing on/inside a flying
    Ship get a ship-carry flag; each frame transform their positions by the ship's
    translation/yaw delta. Clear on step-off → normal gravity. Dropped items
    overboard rot as usual.
15. **In-flight build/mine**: raycast must include ship meshes; `breakBlock`/`place`
    branch to ship-local mutators (`ship.cells` set/delete + state maps keyed
    local); drops and tools unchanged; mass recomputed instantly; **Frame Corners
    refuse break/move while any Ship carrying them is airborne**.
16. **Keyed-state rework** (the long tail — do not skip):
    - `roomInfo`: refactor to a block-provider function (`get(local/world cell)`),
      with providers = world, or a Ship; `survival.ts`, Regulator `act()`, Base
      anchors query the Ship provider when the position is aboard. Sealed Space,
      Heat Regulators, and Base anchoring must keep working in a flying Ship.
    - Storm Breakers aboard: register ship breakers, transform to world pos in the
      radius check.
    - `powerCells`: single map, ship cells keyed `"s<id>,ix,iy,iz"`; `rebuildPower`
      uses world-transformed positions for reach; **ship↔ground links only when
      `grounded`**; make `isPowerBlock` an explicit Set (add ENGINECORE + draw for
      the Core; range assumption breaks once new ids land anyway).
    - `chestCluster` BFS walks providers too; straddle detection = BFS from an
      inside chest reaching any outside cell → takeoff refusal.
    - `crops`: ship-local keys; `cropAir`/water-reach for ship crops uses ship-local
      roomInfo + ship-local Water reach (P1: ship farmland works aboard).
17. **Respawn/Save**: `save.ts` RunSave gains `ships` (pos, yaw, grounded, cells +
    per-ship state); ignore old score fields. Save Beacon inside a ship → respawn
    into ship-space at the beacon's room (works airborne); beacon broken → crash
    site (existing fallback).
18. **Engine Core rework**: place branch no longer wins — instead lesson +
    "install it inside the Ship Frame"; it is a Grid device (draws power, holds the
    two Rocket Fuel Canister slots, hand-insert or Inserter); `engine_core` item
    desc: quest-exclusive heart of the flying Ship. Flight controls gate + checklist
    read it.
19. **Flight Controls**: block + item (bench: 4 Metal Plating + 2 Copper Rod +
    1 Glass); `act()` opens `ui="flight"`: 3rd-person orbit cam around that Ship
    (renderer cam mode; wheel = zoom), W/S along heading, A/D yaw (yaw math only
    once Step D lands — for Step C allow translate-only steering), Space/Ctrl-ish
    climb/descend, Esc = off-panel hover. HUD keeps everything except the hotbar,
    plus readouts: mass vs capacity (red over), both fuel ports, altitude,
    heading, Ship Grid status, frame-outline toggle, refusal lines.

### Step D — yaw

20. Ship-local mesh gets a Y rotation transform for render + collision (cells stay
    axis-aligned **in ship space**; the whole structure turns around the anchor).
    Raycast/collision go through the yaw transform. Riding entities rotate with it
    (delta-rotate their positions about the ship anchor). Yaw rate ~25°/s; Frame
    volumes are always ship-local (so rotating never changes membership). No pitch/
    roll anywhere in P1.

### Step E — quest, onboarding, polish

21. **P1 spine in `quests.ts`** (replaces the old Wings→liftoff auto-trigger):
    Wings (nozzles, keep) → recover Engine Core → ship Grid with own Panel+Battery
    (detect aboard) → Refinery + first Canister → **Lift-off quest**: takeoff event
    completes Phase 1 → celebration (toast/Chronicle), **no victory screen**, play
    continues. Chronicle lessons: oil seep, refining, frame extension while grounded
    (player moves a wreck corner once to learn it).
22. Numbers live in one constants block (`ship.ts`): weights (default 1, Thruster
    22), capacity 250, wreck ≈700, 10 m/s / 4 m/s / ceiling `CH`, 25°/s,
    ~120 s/canister/4 engines, speed = base × fuel-grade multiplier (constant now,
    hook for upgrades).

### Verify (browser, before build/commit)

Break coal ore; scoop Oil at a seep; refine a Canister; place/remove a Frame Corner
→ outline + validity change; the wreck frame valid at creation; straddling Chest
blocks takeoff with a printed reason; trip at altitude = graceful descent; dock a
grounded ship to a ground Panel and watch the Battery charge; take off, walk inside,
mine + place blocks mid-flight (aligned to heading), over-load by building, watch
the sink; step off (fall); unmanned ship sinks; die aboard → respawn aboard;
fly into a cliff → soft stop; second Frame assembly overlaps the first → both
refused.

## Explicitly open implementation choice (not design)

- **Water flow on a moving Ship**: default = fluid sim runs ship-local for claimed
  sources/flow (spilled water drains through the ship's own floor, not out the back
  mid-flight). Player-visible; flag it to the user if the local sim proves too costly
  and world-space flow is attempted instead.

## Session log

Round 1 + amendment (corner-vs-contact, thruster freedom) → Round 2 (phases, entity,
mass, oil, forgiving rules) → Round 3 (yaw, pre-framing, ship-space, grid sealing,
quest spine) → Round 4 (Refinery, Score deletion, flight HUD). Frontier empty
2026-11-22; implementation brief added same day.
