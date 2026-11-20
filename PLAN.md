# Feature Plan (2026-11-20)

Supersedes the 2026-11-19 plan (all of it shipped). Everything from the earlier micro-fix list (waypoint height, quest panel, breakbar, surge cooldown 5 s, favicon, door prompts, multi-block display names, rod consolidation) verified already in place — only these remain. Four batches; each: edit → `npx tsc --noEmit` → live verify in a browser tab → `npm run build` → commit/push both repos (root + `dist/`), per AGENTS.md.

## Batch 1 — Inventory UI truth
1. **Icon tiling bug** (styles.css `.invcell`): cell `background-image` is a 16 px tile in a 64 px cell with default `repeat`/`auto` size — the texture renders "copied 16 times". Add `background-size: 100% 100%; background-repeat: no-repeat; image-rendering: pixelated;` to `.invcell`, `#inv-temp`, `.eqslot`.
2. **Prickly Pear art** (icons.ts `drawArt`): no case → magenta color blob. Draw a real fruit: magenta pear on a green pad with spines.
3. **Chest grids grow wide, not tall** (game.ts `chestDims`): width-first growth to a max of 18 (n≤6 → [3n, 3]; then height grows, width capped at 18: `h = max(3, ceil(9n/18))`, `w = min(18, ceil(9n/h/3)*3)`). GLOSSARY Linked-Chests entry follows.
4. **Auto-shrink the grids when they'd force a scroll** (game.ts `renderGrid` + styles.css): cell size becomes a per-grid value `--cell` (CSS `var`), default 64 px, clamped so a grid that overflows the panel shrinks it down to at most 4× (16 px floor); slot COUNT never changes, only appearance. Drag math (`startInvDrag`/`startTempDrag` STEP, ghost size) reads the effective cell size, not `Game.CELL`.
5. **Temporary storage never traps you** (game.ts `closeUI`, drag/shift paths): closing the UI with an item lifted no longer refuses — the item goes back to the grid it came from (`placeSlotFree`), else onto the ground in front of the player. Lifting any item out of a grid into temp must always succeed (the swap-into-vacated-cell leg never fails). Physical movement never clears temp (verify in browser).

## Batch 2 — Survival & death behaviour
6. **Sleep cooldown: 6 real minutes, not a whole day** (game.ts `sleep`, `napReady` at 1770/3658): gate on `SLEEP_COOLDOWN = 360` s; toast math unchanged ("comes in X min"); comments/tut text follow.
7. **Kill the heaviness feature** (items.ts, survival.ts, player.ts, game.ts, hud.ts, GLOSSARY, README): delete the Overencumbered state end to end — `weight()/weightLimit()/baseLimit/bonusLimit`, the `slow` multiplier in `player.update`, the +0.05 water drain, the kg/lim HUD line and the "Weight X / Y kg" side-text, `bag.kg`. Weight is no longer a game mechanic at all; backpacks expand the grid only. Delete GLOSSARY entries **Weight Limit** and **Overencumbered**; trim the Backpack entry and README's "carry-weight budget" clause.
8. **Death restores the pack honestly** (game.ts `die`): after clearing gear, reset the grid to base 5×4 (`setBackpack(5, 4)`-equivalent) — dying with a Backpack equipped must not leave a 7×6 grid.
9. **"Keep inventory on death" cheat** (index.html `#cheats` + main.ts wiring + game.ts `keepInventory` flag): toggle button beside Immortality, session-only like the other cheats; with it on, `die()` creates no Death Cache and loses nothing.

## Batch 3 — World, water, machines
10. **Harvesting must not stack Farmland** (game.ts `harvest` WHEAT_2 branch and `harvesterAct` WHEAT_2 branch): the wheat cell goes to AIR — the Farmland it stood on stays tilled below. (Breaking already does this; the user's "harvester replaces crop with a dirt block" is the stacked-tile look.)
11. **Water falls slower** (world.ts `processWater`): generation counter; the vertical step applies every other pass (0.4 s lateral spread, 0.8 s fall) — cascades crawl down instead of teleporting.
12. **Electric Lamps honour real power** (game.ts `updatePower`): `g.powered` is true only while supply+batteries actually meet the draw — a Panel + Lamp grid with dead generators stays dark and does NOT complete "Lights On"; trip logic unchanged otherwise.
13. **Soil darkens near water** (renderer.ts mesher): DIRT and GRASS cells with any Water within 3 (Chebyshev, ±2 y) get ~0.7× face shade — mud reads damp.
14. **Plating mines 4× faster** (blocks.ts): HULL 6→1.5, CURVED_HULL 6→1.5, HULL_SLOPE likewise, METAL_PLATING 4→1.

## Batch 4 — Beacons, caches, far markers
15. **Death beams always, and taller** (game.ts cache loop + renderer defaults): Death Cache beams render regardless of the Visor (they already do — keep), height 14→40; Reward Cache beams unchanged (Visor-only).
16. **Save Beacons beam too** (game.ts `guideFrame`): maintain a beaconBeam set diffed from `beaconMarks` each guide tick — every standing Save Beacon throws a tall cyan beam; breaking/saving updates it (marks already maintain; beams follow).
17. **Too far → colour-coded edge arrow** (game.ts + hud.ts + index.html + styles.css): for every always-beam marker (Death Caches red, Reward Caches gold, Save Beacons cyan), when the marker is beyond ~96 m, hide the 3D beam and show a HUD arrow pinned to the screen edge pointing at it (bearing vs. player yaw), tinted in the marker's colour, with distance. Near → beam, far → arrow, never both.

## Verification protocol
Dev server + headless tab (`globalThis.game`): icon cell shows ONE texture (screenshot); prickly pear art; open 4-chest cluster → 12×3 grid, 8 chests → 18×4; tall chest grid shrinks cells, never slot count; lift item, press Esc → item back in pack; sleep twice → second toast says ~X min; no kg line anywhere, heavy pack no longer slows (walk 200+ kg); keep-inventory cheat → death keeps slots; wheat harvest (E and Harvester) → crop cell AIR, Farmland below intact; pour water atop a cliff → visibly crawls; Panel+Lamp with no supply → lamp dark, `grid` quest not bumped; DIRT tile by a pool darker; hull break ~1.5 s; cache beam tall without visor; walk past a beacon → cyan beam; teleport far → edge arrow appears with colour+distance.
