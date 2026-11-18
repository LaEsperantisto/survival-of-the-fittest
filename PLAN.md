# Feature Plan (2026-11-18) — Base Automation, Map, and Factory

Design settled by the grilling session (rounds 1–7). Five phased plans; full design detail
for **Interface**, **Ship**, **Worldgen**, **Grid**; shape-only for the later factory plans.
Each batch: edit → `npx tsc --noEmit` → live verify in dev browser (`npm run dev`, Playwright
tab) → `npm run build` → commit+push **both** repos (root + `dist/`), per AGENTS.md.

Terminology is canonical in GLOSSARY.md (new entries landed with this plan): **Base**, **Map**,
**Pin**, **Landmark**, **Hidden Landmark Tracker**, **Grid**, **Power Panel**, **Power Pole**,
**Inserter**, **Planter**, **Harvester**, **Fuel Slot**, **Husk**, **Easy/Hard Start**,
**Chronicle**, **Codex**. ADRs 0006 (adjacency-only machine I/O) and 0007 (Grid trips dark
under a Power Panel) record the two load-bearing calls.

Design thesis: the game should feel **cosy and safe inside a Base** and keep the **on-the-edge
feel outside** — delivered by the automated hum of a working Base plus an atmosphere system
that shifts sound and light with location, storm, and time. Outside difficulty is *not*
raised; the contrast comes from making inside warm, muffled, and self-tending.

---

## Phase 1 — Interface (mobile, hand crafting, Map, lessons)

### Batch 1 — mobile inventory sweep + hand Craft tab
- Reproduce and fix reproducible mobile Inventory bugs first (drag/select/equip/tap-to-
  deselect on touch; `#inv-*` in index.html/styles.css, touch handlers in game.ts). Gate:
  the Craft tab must be fully usable on a touch-emulated browser.
- **Craft tab in the Inventory UI** listing hand recipes (`station: null` in crafting.ts —
  currently unreachable without a station block: latent gap this fixes: bench, campfire,
  wooden tools, farmland, deadwood, chest_connector, metal_plating). Desktop key + touch
  button. Station UIs (Bench/Armory/Campfire E-menu) keep their current filtering.

### Batch 2 — Map, Pins, Tracker, save v2, Chronicle/Codex scaffold
- **Map**: minimap in the free top-left corner, drawn **only while the Surveyor's Visor is
  equipped**. Corner = local terrain slice (top-down, ~80 m) + player arrow + known
  Landmarks + Pins. Desktop **M** toggles maximise; mobile taps the map to maximise
  (maximised = larger radius + dimmed remembered terrain). Move mobile `#m-pause`
  (styles.css:182) into the `#mbtns` cluster.
- **Fog of war**: reuse `world.chunks` keys (never evicted) as the session-explored set;
  persist a compact visited-chunk array in the save.
- **Pins**: craftable **Surveyor's Pin** item; E plants it where you stand; unlimited;
  auto-named, renamed/removed from the maximised map. A pin named **"Base"** is a marked
  point the Visor beams (closes the glossary promise in GLOSSARY.md:261 and game.ts:687-722).
- **Landmark model**: Towns, Trader camps, cave mouths, oases, wreck(s) are Landmarks.
  Known = visited / quest-target / Tracker-revealed; known ones mark the Map
  automatically. Buried canister sites mark the Map only after one is dug up.
- **Hidden Landmark Tracker**: craftable consumable; Q-use reveals + pins the nearest
  never-known *recurring* landmark (Towns, camps, cave mouths, oases, canister sites;
  never the unique second wreck) and vanishes.
- **Chronicle**: lesson side-quests. Current step = second HUD line under the main Quest
  (`#quest` slot, styles.css:38); full log = pause-menu tab; unlock toasts. First-run
  beats: first Town, first Cave, first Cave Mouth, first Oasis, first Trader camp,
  second wreck, **first storm onset** (explains the Sandstorm and answers it with the
  Breaker), plus one per new factory system as it lands. Persisted "seen" set → save v2.
- **Codex**: possession-triggered (first hold/craft) knowledge entries; Catalog gains
  learned/locked state (locked greyed + Chronicle pointer) → save v2.
- **RunSave v1 → v2**: new fields — pins, visited chunks, chronicle/codex learned sets,
  world mode. `loadQuestState`-style clamping for old saves.

## Phase 2 — Ship modes and Husks

### Batch 3 — Easy Start / Hard Start + wreck strip
- New-world screen (and guest world creation) gains an **Easy Start / Hard Start** toggle;
  stored in the save; immutable per run; affects **only** wreck fixtures.
- Both modes: strip the wreck's **Bench** (gen.ts:544) and **Bed** (gen.ts:527). Keep hull/
  doors/lamps, water tank, **Save Beacon** (quest + respawn fallbacks hardcode it:
  game.ts:741,794), 4 broken wingtip Thrusters, cockpit chest (3 full canisters), loose
  plating.
- **Easy Start**: wreck keeps a *working* Heat Regulator (gen.ts:540) and Storm Breaker
  (gen.ts:547). **Hard Start**: both appear as **Husks** — dead, non-functional, visible.
- Husks: breakable, drop their **broken item**; repairing (bench craft at ~half the normal
  recipe's ingredients) turns the broken item into the working block. Breaking without the
  recipe loses the lesson — the Chronicle/Codex nags first.
- Tutorial rewire: "Craft" step → Inventory → Craft tab (hand wood shovel) instead of the
  wreck bench (tutorial.ts guide (0,31,−3)); farm/drink/chest/beacon steps unchanged;
  Regulator + Storm Breaker steps (with plain-language how-they-work text) run in Easy
  mode; in Hard mode the Husk guides the same lesson text, and the Chronicle entry teaches
  each again on first craft.
- Quest chain: unchanged (the Bench is hand-craftable now; `tool` quest accepts any
  Bench — player-built).

## Phase 3 — Worldgen lattices

### Batch 4 — infinite oases + buried canisters
- **Oasis**: replace the 6 fixed points (`Structures.oases`, gen.ts:45-47) with a jittered
  lattice (~240 m spacing, noise-jittered centers, same guards: crash site, oasis seals,
  town plots). Rewire `waypointTarget()` oasis lookup + oasis quest bump to
  `nearestOasis(x,z)` lattice query.
- **Buried canisters**: replace the 13 fixed spawns (gen.ts:57-60) with a jittered lattice
  (~150 m). Containers, not water — water economy untouched. They are the one Landmark
  that never proximity-reveals: Map marks a site only on dig (existing pickup already
  discovers them).

## Phase 4 — Grid (electricity + machines + atmosphere)

### Batch 5 — power model
- **Grid** = connected component of Power Poles + powered blocks; every Grid needs exactly
  one **Power Panel** (mandatory; connected component without one has zero power).
- Tier-1 **Power Pole**: supplies blocks within 10; links to Poles within 16 (tunable
  constants; higher tiers later).
- **Trip model (ADR-0007)**: supply = Σ generator output, draw = Σ rated draw of powered
  blocks; draw > supply ⇒ the Power Panel **trips**, the whole Grid goes dark, and stays
  dark until the player E-resets it. Re-arming needs headroom (trip clears only when
  supply ≥ draw again).
- **Generators**: Wood Generator (burns logs/kindling from a chest the adjacent Inserter
  feeds it — hopper-free, same adjacency logic), Water Wheel (needs flowing water beside
  it), Wind Turbine (output scales with storm intensity — the signature storm-powers-base
  mechanic — and needs open sky: blocked = reduced/off), Solar Panel (daylight + direct
  raycast to the sun; roofs and storms cut it). **Battery**: fixed capacity, charges from
  the Grid, discharges into supply when generation falls short.
- Old kit stays mechanical: nothing existing requires power. Electric Lamp (brighter,
  flickerless, needs Pole reach) is the first conversion target. Grid-powered Regulator is
  the named endgame fantasy — not built in this batch.

### Batch 6 — machines (ADR-0006: adjacency-only I/O)
- **Inserter** (powered): pulls one item from the block in front, pushes into the block
  behind; any container↔container pair; no filters (filters = late-game); ~1 item/s.
- **Campfire gains a Fuel Slot**: any push (hand or Inserter) can add fuel; keeps the
  hearth lit overnight — the core cosy-hum mechanic.
- **Planter** (powered): sits under the farmland; seeds from the block beneath; plants the
  empty crop cell two cells up.
- **Harvester** (powered): harvests the ripe crop **directly below**; outputs into the
  block **directly above**.
- Farm column: seed chest → Planter → farmland → crop → Harvester → output chest. Hearth:
  fuel chest → Inserter → Campfire. All faces come from the rotation nibble (rots map).
- Icons, models, recipes (numbers are tuning calls), Chronicle entries per machine.

### Batch 7 — atmosphere: cosy inside / edge outside
- **Base** = player is in a **Sealed Space** (reuse `roomInfo`, world.ts:105-127) that
  contains at least one anchor: lit Campfire, Bed, working Storm Breaker, or Power Panel.
- Resampled twice a second alongside `stormShieldTick()` (game.ts:2612).
- Crossfaded (~3–5 s), condition-aware mood switch — the inside/outside state is the
  switch; storm and time-of-day modulate it:
  - **Audio**: attenuate + low-pass the wind bed inside (muffled howl = safe); Hearth
    crackle layer near a lit fire; new generative music genre pool (warm/hearth material)
    inside, existing pools outside (audio.ts:53-135).
  - **Visual**: soft warm overlay indoors + fog near/far pull (renderer storm grading
    precedent, renderer.ts:1287-1328); outside unchanged — no new danger cues beyond the
    storm treatment that already exists.
  - No new HUD chip. Bed sleeping and the storm-powers-turbine loop do the rest.

## Phase 5 — later plans (shape fixed here; design in their own plans)

- **Logistics plan**: Conveyors first (directional from the rotation nibble, curve
  variants; splitters later) → pipes/storage over the chest-connector network for
  long-distance transfer → drones/haulers for unreachable destinations.
- **Life plan**: livestock (new desert-suitable species incl. a wool animal) in fenced
  pens; care is a **vehicle/entity that patrols the pen** — feeding, shearing, manure
  collection.
- **Motion plan**: rideable vehicles first; autonomous haulers belong to the Life/logistics
  crossover, not the first cut.
- **Grid tier 2**: longer-reach Poles, and first radius-based "advanced" blocks.

## Docs
- DONE with this plan: GLOSSARY.md (Base, Map, Pin, Landmark, Tracker, Grid, Power Panel,
  Power Pole, Inserter, Planter, Harvester, Fuel Slot, Husk, Easy/Hard Start, Chronicle,
  Codex; revised Ship, Oasis, Water Canister, Campfire, Sandstorm Breaker, Visor) +
  ADR-0006, ADR-0007.
- With implementation: README (controls M, Craft tab, Easy/Hard Start, factory basics),
  GLOSSARY tweaks per machine as it lands, tutorial copy.
