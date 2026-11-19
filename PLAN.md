# Feature Plan (2026-11-19)

Six batches. Each batch: edit → `npx tsc --noEmit` → live verify in a browser tab → `npm run build` → commit/push both repos (root + `dist/`), per AGENTS.md.

## Batch 1 — Water economy & heat
1. **Refilling a canister consumes water** (game.ts `act()`, `t.water` branch): spending one canister drains one water unit from the aimed cell — a `WATER` Source drops one strength (`set(x,y,z, flowId(strength-1))`), a flow cell goes to AIR; the sim spreads what's left. Oasis sources run down too (~8 fills per source): water is finite, the journey is the cost.
2. **Regulated air ignores campfire warmth** (survival.ts `update()`): `if (opts.warmth) ambEff += opts.warmth` only when `!this.regulatedAir` — inside a Regulator-held room the air reads 37 °C even at the fire's side (HUD `air ${lastAmbientEff}`).
3. **Hot Water Pouch = full canister + lit Campfire** (game.ts `canHeat`/heat path, ~3228): verify the E-at-campfire conversion already does exactly this; fix only if broken.

## Batch 2 — Crafting & placeability rules
4. **Bench shows only bench recipes** (game.ts `renderCraft`): filter bug — bench mode currently lists hand (`station: null`) recipes too; gate to `r.station === "bench"`. Hand-craftable ⇒ never at the bench.
5. **Chest at the Bench** (crafting.ts): chest recipe → bench, cost `4 deadwood` (drop the metal).
6. **No crafting Farm Land** (crafting.ts + items): delete the `dirt → farmland` hand recipe; tilling stays the only way (shovel Q/right-click path, game.ts ~3178 — verify it tills the blocks the quest text names and fix the toast text if they mismatch).
7. **Rods are not blocks** (items.ts + blocks.ts): `metal` ("Iron Rod") loses its `block: METAL` field; `METAL` def goes `placeable: false` (id stays for old saves; breaking legacy Iron Rod blocks still drops rods). Placing a rod now toasts "raw material, not a block".

## Batch 3 — Quests are earned, not timed
8. **Retroactive completion** (quests.ts + game.ts + save.ts): a one-shot deed counts whenever it happened, not only while its quest is current.
   - `QuestState` gains `e: Record<string, number>` (kind → achieved count), serialized as `quest.e`, clamped in `loadQuestState`.
   - `questEvent` records the achievement for *any* kind even when the quest isn't current; when a quest becomes current (completion advance, load, or skip), `reconcile` fills progress from the achieved counts and completes it.
   - `tool` kind: bumped on every bench/hand tool craft (both craft UIs already call `questBump("tool")` — make it record regardless of active quest).
   - `farm` kind: recorded on every ripe-crop harvest (the "Green Thumbs" fix — the user's wheat harvest landed while the quest wasn't active); desc keeps the till→plant→harvest wording, completion keys on the harvest deed.
   - Retro-completion pays its Reward Cache pod like normal (guard from Batch 4 applies).

## Batch 4 — Reward Cache honesty
9. **Empty caches never speak** (game.ts `crashPod`/`podFrame`/claim): a pod only spawns when the reward item exists and `n > 0`; the inbound toast/beam/ring never fire for nothing; a Cache whose items list is empty is hidden, unmarked, unbeam'd (mesh path already does this) and cannot be opened or claimed — remove dead entries from `caches`.

## Batch 5 — Ghosts & water transparency
10. **Multi-block ghosts** (renderer.ts `setGhost` + game.ts ghost block): the preview must show every cell placement occupies — Bench shows its `BENCH_EXT` half (rotation nibble direction), Bed shows `BED_EXT`, doors show their UPPER half when the cell above is air. Ghost becomes a group of per-cell meshes sharing the existing geometry cache.
11. **Seed ghost sits on the ground** (renderer.ts `buildGhostGeo` CROSS branch): crop/sapling ghost quads anchored to the cell floor like the real planted mesh, verified side-by-side against a planted crop in the browser.
12. **Water is semi-transparent** (renderer.ts water tile art + mesh pass): water surface/side tiles get ~60 % alpha; water is already in the transparent pass (`def.transparent: true`, `depthWrite: false`) — see through pools from above and sideways.

## Batch 6 — The quest line uses the Grid
13. **Two new main-chain quests** (quests.ts + game.ts events), inserted after "Escape Vector" and before "Wings of the Wreck":
    - `grid` — **Lights On**: "A Power Panel, Poles and a generator: run an Electric Lamp off the Grid." Event: a Grid with ≥1 `ELEC_LAMP` flips `powered` false→true (gridFrame, ~2931). Reward: 2 × elec_lamp.
    - `factory` — **Machine Works**: "Put a machine to work: an Inserter, Planter or Harvester moves something on its own." Event: first successful `inserterAct/planterAct/harvesterAct` in machineFrame (~2983). Reward: 1 × harvester (block-shaped ✓).
    - Both kinds recorded as achievements like Batch 3 (a player who already has a powered lamp + running machines gets them retro-completed).
14. **Structures with electric blocks** (gen.ts):
    - New lattice structure (camp-style: `outpostAtSeed`/`outpostCenterSeed` + `paintOutpost` + `genChunk` hook + `Structures` helpers): a Dweller **Grid Relic** — adobe shed with a Power Panel, Battery, a working Solar Panel and lit Electric Lamp, Poles running to a small mast lamp; a Supply Chest holding copper rods, salt and an iron rod. It genuinely generates + distributes power when loaded.
    - Towns (`paintTown`): Power Poles along the street with dark Electric Lamps and a Power Panel in the market shell — the desert already spoke electric.
    - GLOSSARY: Grid Relic entry + quest-name updates; README tech line gets one clause.

## Verification protocol
Dev server + headless browser tab (`globalThis.game`): refill drains a source; regulated room reads 37 at the fire; bench hand-recipe list empty; rod place refused; till-only farmland; tool/farm retro-completion (set flags, advance quest → pod); empty-reward guard; bench/bed/door ghost cells visible; seed ghost anchored; water alpha visible under surface; new quests fire from events; outpost paints and its lamp lights (query `grids`).
