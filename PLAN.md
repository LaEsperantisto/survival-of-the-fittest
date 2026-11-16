# Feature Plan (2026-11-16)

Grouped into six execution batches. Each batch: edit → `npx tsc --noEmit` → live verify in browser → `npm run build` → commit/push both repos (root + `dist/` frontend), per AGENTS.md.

## Batch 1 — HUD/CSS micro-fixes (low risk)

1. **Quest pop-up above surge button — move up**: `#waypoint` `bottom: 64px` → ~96px (styles.css:61). Visual check whether the intended popup is `#waypoint` or `#tut-card` (bottom 170px); the one overlapping the surge-button row is `#waypoint`.
2. **Quest panel (top corner) — lower**: `#quest` `top: 44px` → ~56px (styles.css:38).
3. **Mining bar — lower**: `#breakbar` `top: 54%` → ~57% (styles.css:26).
4. **Sweat-surge cooldown halved**: `survival.ts:189` `surgeCooldown = 10` → `5`; update the controls-list text in `main.ts:237`.
5. **Favicon**: inline PNG data-URI `<link rel="icon">` in `index.html` head, drawn from the game's tile art.
6. **"E: Open / Close Door"**: `promptFor()` (game.ts:1267-1276) for DOOR_INNER / DOOR_INNER_UPPER (and Sealed Doors if currently asymmetric).
7. **Multi-block display names**: name map for variant blocks (BENCH_EXT, DOOR_INNER_UPPER, DOOR_INNER_OPEN, BED_EXT, curved variants) → main block's name in the block-name tooltip, prompts, and break toasts.

## Batch 2 — Rod consolidation & recipe tweaks

8. **Metal Rod ≡ Iron Rod** (item id is `metal`, name "Metal Rod"): rename `metal` → display "Iron Rod" everywhere (items.ts:52, crafting.ts, quests, tutorial, instructions, catalog, GLOSSARY); **delete the separate `ironrod` item** (items.ts:63) and the `2×ironrod → metal` recipe; SMELT: iron ore → directly Iron Rod (×2 per ore, as the ore description already promises); all consumers of `needs: { metal: n }` keep working (id unchanged — clean rename, no aliases).
9. **Iron Rod texture grey**: icons.ts rod art + `color` → grey steel (the old orange ironrod art disappears with the item).
10. **Inside Door costs 1 Iron Rod**: crafting.ts:56 `{ metal: 1, deadwood: 1 }` → `{ metal: 1 }`.
11. **Wood Log → 2× Dead Wood**: new hand-craftable recipe `{ out: deadwood ×2, needs: { wood: 1 } }` (crafting.ts).

## Batch 3 — Survival systems

12. **Fall damage**: player.ts physics — record the y where the fall began; on landing, damage ≈ `k × (fallDist − 4)` above a 4-block grace, lethal ≈ 16 blocks; cause `"fall"`; tutorial/instructions text updated.
13. **No heat damage in regulated air**: survival.ts damage gate — when the player's cell sits in a sealed Space with enough Heat Regulator capacity (same check that lights the `chip-reg` "REGULATED" chip), skip hot/cold body damage entirely; drift toward neutral still applies.
14. **Sandstorm Breaker (new block)**: next free id; `tool: "disassembler"`, hand-unbreakable; one instance placed by `paintShip` (gen.ts:455+) inside the wreck. Radius R (recommend 8): survival.ts receives a `stormShield` flag when the player is within R of a breaker — storm amplification (survival.ts:118), water-drain multiplier (:144), and sand blast (:153) all zero. HUD chip "STORM BROKEN" (pattern of `chip-reg`); renderer draws a faint red sphere (`MeshBasicMaterial`, `side: BackSide`, low opacity) at each breaker's radius only while the player is inside one.
15. **Chitin rebalance**: chitin-containing body armour loses ~10pp damage reduction (Wurmsuit 0.55 → 0.45; any other chitin gear likewise), and chitin gear grants **75% sandstorm resistance** (storm terms ×0.25 while worn — stacks under a Breaker trivially). Glossary entries for Chitin/Wurmsuit updated at implementation time.
16. **Ores not placeable**: `placeable: false` on IRON_ORE / COPPER_ORE / COBALT_ORE / ALABASTER block defs (blocks.ts); mining still yields the item; placement path already respects the flag.

## Batch 4 — New items, station, caches

17. **Armoury (new block + station)**: openable like BENCH (`openStation` mode); hosts all armour-slot gear recipes — reptile armour, chitin gear, Tortoise Cuirass, Wurmsuit, Body Heat Regulator, Backpacks, Visors (migrated from `bench: true`); Armoury block itself craftable at the bench for ~4 deadwood + 2 iron rods.
18. **Hot Water Pouch**: new item; made by standing at a lit Campfire holding `canister_full` — new prompt "E: Heat the water" → pouch into pack; using it (Q): body Heat pulse toward hot (recommend +10 °C instantaneous) and a `canister_empty` returned.
19. **Broken & Lit Thruster items**: breaking THRUSTER / THRUSTER_LIT (currently `breakTime: -1`) — see decision below — drops `thruster_broken` / `thruster_lit` item; re-placing restores the block in that state; lit thruster keeps emissive.
20. **Death Indicator**: vertical translucent beam at every death-Cache location (death kind only, not Reward Caches); beam **and** the existing ground mark (`markerEid`) are removed the moment the cache is emptied, or if it held nothing.

## Batch 5 — Renderer, rotation, fire

21. **Rotation system**: per-position rotation nibble — sparse `Map<"x,y,z", rot>` in world.ts, persisted in run-save deltas (no block-id explosion). Applied by renderer.ts chunk meshing (rotate face sets) and by placement (`place()` stores the held item's current rotation). Only non-natural blocks carry rotation; natural terrain stays rot 0.
22. **Rotate with R + ghost block**: translucent preview mesh at the `place()` target whenever the held item is placeable; **R rotates it when the held item is a rotatable placeable block** — see conflict note below.
23. **Ship & structure orientation**: gen.ts stamp code records rotations so CURVED_HULL / HULL_SLOPE chamfer the correct edges around the hull, doors face out, etc.
24. **Curved-block light leaks fixed** (user decision 2026-11-16): light must keep passing through curved blocks exactly as today — the fix is purely in meshing: geometry merging must never merge across the curved-block ↔ full-block boundary (bridge faces close the corners on their own), so no seam exposes the neighbour's culled face.
25. **Crafting Bench looks like a bench**: custom model in the renderer's ShapeFace path (working top + drawer/legs frame spanning the 2 cells); BENCH_EXT stays part of the 2-block logic but is named "Crafting Bench" (item 7).
26. **Campfire lit only with fuel**: emissive + point light gated on `campCharges > 0`; empty fire = cold coals (no light, no smelting — matches existing charge checks).
27. **Campfire refuelling**: at a Campfire holding **Wood Log** → +2 charges; **Kindling** → +0.5; prompt "E: Feed the fire".
28. **Head Lantern stronger**: higher intensity/range on the carried light (renderer light params).

## Batch 6 — Items, fuel persistence, mob polish, ship tweaks

29. **Fuel rides the item**: lantern/regulator `charges` move onto the inventory `Slot` itself — preserved across unequip, drag, drop, death-cache, chest transfer, and save/load (currently only equip slots persist, game.ts:432).
30. **Fuel-level textures**: lamp and Body Regulator textures change at charge thresholds (empty / low / full) in world texture **and** item art.
31. **Item art pass** (icons.ts): real silhouettes for tools (shovel / pickaxe / axe / bucket / disassembler), new art for **Reptile Armour** (currently missing), grey rods, pouch, thruster items, canister states.
32. **Wheat → Farmland bug**: game.ts:1406 and :2084 replace WHEAT with FARMLAND on break — change to AIR (breaking wheat leaves bare dirt it was planted on, not tilled land).
33. **Water compartment dirt floor**: paintShip (gen.ts:509) — DIRT ring around the sunken tank (and inside the compartment floor where exposed).
34. **Tutorial rework**: remove dirt from the tour's granted items (dirt is now in the ship); **skip** (Esc/button) → grant the full set of tour-given items immediately, and snap the camera straight back to the player (kill the cine tween).
35. **Traders wander**: mobs.ts `trader.speed: 0` → small wander loop within ~5 blocks of their stall mesh; while the trade UI is open, the trader faces the player.

## Open decisions (recommended defaults — say the word and they're locked)

- **R conflict**: R currently drops the held item. Plan: R *rotates* only while holding a placeable rotatable block; otherwise it still drops. Alternative: rotate on G, keep R pure-drop. Recommended: the context-sensitive first option.
- **Thruster breaking**: to drop items, thrusters must become breakable — recommendation: only with a Disassembler, and a lit thruster stays lit when re-placed. (Quest guard "immovable until nozzle" stays.)
- **Sandstorm Breaker recipe**: recommendation: bench-craftable (2 iron rods + 1 glass, catalyst-free) so expansion is possible; radius 8.
- **Numbers to set and tune visibly**: fall grace 4 blocks, pouch +10 °C, chitin gear −10pp armour, Armoury recipe 4 deadwood + 2 iron rods, campfire charge semantics otherwise unchanged.

## Glossary

New entries as each lands: **Sandstorm Breaker**, **Armoury**, **Hot Water Pouch**, **Death Indicator**; revised **Chitin / Wurmsuit / Metal Rod (→ Iron Rod)** entries.
