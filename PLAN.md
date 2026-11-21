# Feature Plan (2026-11-21)

Decisions from the grilling session; the model lives in `GLOSSARY.md` (new **Sack**, new **Catalog**, revised **Farming**) and `docs/adr/0008-sacks-are-opaque-machines-may-fill-but-never-read.md`. README already describes the target behaviour (Batch 0) — code must catch up to it.

Batch workflow (AGENTS.md): edit → `npx tsc --noEmit` → live verify in browser → `npm run build` → commit+push **root** and **dist/** repos.

## Batch 0 — docs (done this pass)
- `PLAN.md` (this file), `GLOSSARY.md` (Sack, Catalog, Farming radii + reaping), `docs/adr/0008-…`, README: radii 6/10/10, seed economics, **Sacks** bullet, merged-cell + Catalog-button copy, machine↔Sack rule, oasis sprouts.

## Batch 1 — Grids: merged cells + rotation everywhere
Rotation already exists (`Slot.rot`, `itemArtUrl(itemId, rot, …)` in `icons.ts`); extend, don't reinvent.
- `icons.ts`: add whole-art variant — one canvas for the full w×h footprint (cached per `id:rot:charges`), so a multi-cell item draws ONE image instead of per-cell tiles.
- Merged cell: pack grid, chest grid, Campfire Fuel/Input/Output, Temporary Storage, Bin, harvest/drop popups, Catalog cards — the footprint renders as one bordered cell, whole art, single click target; `Slot.rot` semantics unchanged (quarter turn, footprint swap as today).
- R-while-selected (context-sensitive: grid open → rotate held/selected item) covers every 2D surface; Drop button stays pure drop.
- Verify in browser: rotate a 1×2 canister in pack + chest + Campfire input; 2×2 Reptile Armour in a grid shows one merged tile; popup after a kill rotates.

## Batch 2 — Catalog
Anchor: `renderCatalog`/`CAT_TAB` in `main.ts` (~161-236).
- Sections, alphabetical (Tools & Gear / Food & Water / Materials & Building / Machines & Power / Oddities); items alphabetical inside; locked entries greyed IN section.
- Recipes tab grouped by station: Hand / Crafting Bench / Armoury / Campfire cook / Disassembler; locked recipes stay in their station group.
- Cross-links on every entry as clickable chips: recipes that make it · recipes that consume it · the block it places (`BLOCK_TO_ITEM` inverse) · what drops it (break/harvest/mob/town-loot tables). Chip click jumps to that entry.
- Open-Catalog button: Inventory (besides Sort), Crafting Bench, Armoury, Campfire panel, Disassembler — from Inventory with a selection scrolls to that entry.

## Batch 3 — Sacks (I / II / III)
- `items.ts`: `sack1/2/3` — "Sack I/II/III", 1×1, cap 10/20/30 footprint-units; desc names cap + opacity rule. `crafting.ts` RECIPES (bench): 4 dead wood / 6 dead wood + 2 iron rods / 4 wood logs + 4 cobalt rods.
- Slot model (`game.ts`, `save.ts` slot serial types ~54-86): optional `stack?: { itemId: string; count: number }`; save/load round-trip; whole-Sack drop/transfer keeps contents; tooltip "Sack II — Rock ×17 (17/20)".
- ONE insert helper used by every grid insertion (pickup `giveOrDrop`→pack, Shift-click both directions, Harvester/Inserter/Planter output, cache reward): fill the matching open Sack with the **least remaining capacity** first; reject sack-in-sack at any tier; item only fits if `w*h*count` ≤ free units.
- Read-opaque guards (ADR-0008): Wood Generator fuel pull, Inserter take-from, Campfire Fuel Slot acceptance (scan and auto-feed), Planter seed pull, Trader barter counting, Sort (moves the Sack whole, never opens it). Machines may WRITE to Sacks (via insert helper) but never READ contents.
- UI: selected Sack shows **Open Sack** in the side button row (Equip/Move to pack/Drop/Catalog); toggles to **Close Sack**; panel like Temporary Storage with two slots — in-slot (only matching non-Sack item that fits units; adding decrements nothing, it merges) and out-slot (one item; take → selected grid / pack).
- Codex learns sacks on craft; death/reward caches may contain empty Sacks (townLoot small chance).
- Verify: craft Sack I, mine 12 rock → auto-fill stops at 10, next goes to grid; open panel in/out; generator beside chest with Sack of logs burns the loose logs first then refuses; whole-Sack Campfire drag feeds nothing; save→reload keeps counts.

## Batch 4 — Crops: radii, readout, seed economy
Anchors in `game.ts`: `updateCrops` (~2999, ±4 scan), farm-aim wetness scan (~2971-2975), tree tick (~3344-3356, ±6), `cropDisplayName` (~2990), toasts 2749/3427; `items.ts` seed descs 94/95/102; `townLoot` 366-367; `gen.ts` oasis melons 748/804/1028; wheat yield paths 2059/2935/hand-harvest; melon pick ~3270s.
- Water reach per species: Wheat 6, Melon 10, Tree 10 (scans and the wetness-scan thresholds follow).
- Readout: `<Name> — <pct>% — growing` / `— paused: no Water within 6 blocks` (species-correct radius) / `— paused: too hot (47 °C, Wheat wants 2–42 °C)` / `— paused: too cold (…)`; trees get the same wording ("Living Tree — 40 % — paused: …"); ripe keeps existing "— ripe"; Farm Land bare name unchanged.
- Reaping: wheat yields 1 seed + 50 % second on ALL THREE paths (break 2059, break 2935, hand-harvest).
- Melon: pick ripe → fruit + 50 % `seed_melon`; `townLoot` melon seed 0.4 → 0.7 (parity with wheat); `gen.ts` adds 1-2 `MELON_1` sprouts beside each oasis ripe-vine cluster; first-pick one-time hint toast ("Break an oasis sprout, or pick with luck, for Melon Seeds"); seed descs to new radii.
- Verify: plant a melon from sprout-broken seed; readout shows each pause reason; ~50 % seed rolls over repeated harvests.

## Batch 5 — Rat art
- `icons.ts`: hand-drawn pixel `rat_raw` + `rat_cooked` replacing flat block-color art; rotation-aware via existing pipeline; Codex shows them. Verify: hunt a rat, both art states in pack + Catalog.

## Batch 6 — Block animations (renderer overlay pass)
Near-player set (budget ~400 blocks), updated per frame in `renderer.ts`:
- Campfire: flame billboard flicker + light flicker while lit; lit Thruster: jet flicker.
- Save Beacon slow pulse; Sandstorm Breaker red hum pulse (harder during a storm); Power Panel steady blink live / hard-red blink tripped; Wood Generator smoke wisp while burning; Heat Regulator vent pulse.
- Wind Turbine blades rotate (storm = faster); Water Wheel rotates while water flows past; Lamp/Electric Lamp gentle night glow flicker.
- Verify: test world with every animated block placed and powered; storm toggled from console.

## Out of scope (recorded, not built)
Unpacker block (future), Sack-in-Sack nesting (late-game tier only), new mob/block content beyond above.
