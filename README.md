# Survival of the Fittest

A browser voxel-survival game. You wake up in a crashed ship in the middle of a desert. The wreck is a small, rounded hull with broken wings: a forward cockpit with an insulating-glass windscreen, a central hall with the wreck's crafting bench, a save room whose stern door is the wreck's only opening to the outside, a water compartment whose tank is a pool sunk into the ground, and a regulator room with a pre-installed Heat Regulator. The hull and doors keep sun and wind out, but a sealed space still drifts to the desert's temperature — the desert swings from ~47 °C by day to ~−5 °C by night — unless Heat Regulators hold it neutral. Only the small regulator room starts conditioned. No hunger. Water, heat, health — keep all three in their zones.

## Run it

```sh
npm install
npm run dev        # dev server
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve the built game
```

The build is fully static — `dist/` can be dropped on GitHub Pages or any static host.

## How it works

- **Bars.** Water drains steadily (faster when hot, sprinting, or overencumbered). Low water dims and vignettes your vision; empty water does damage. Body temperature drifts toward the environment: stand under open sky at noon and you cook, stand in the cold at night and you freeze — and inside a sealed space it moves on you three times faster. Body out of the 36–37.5 °C safe zone stops regen; past ~39.5 °C or below ~31.5 °C you take damage. Health at 0 = death. Best days-survived is stored locally.
- **Shelter is physical.** Partial cover is the sum of block thermal resistance straight above you (see `docs/adr/0002-sky-column-shelter-model.md`) — lean-tos, overhangs and insulating glass help. But a fully sealed space equalizes with the outside air: walls alone never save you. A craftable Heat Regulator (one is already installed in the wreck's small regulator room) holds a sealed room at body-neutral temperature — 100 open cells per Regulator, capacity stacks. Sealed means sealed: an open door disables the Regulators and the desert gets in.
- **World.** Infinite chunked voxel desert (1 voxel = 1 m), seeded and deterministic: dunes, rocky hills, salt flats, mesas, oases with water you can fill canisters from, dead-wood groves, and adobe ruins/towns. A second wreck — and its Engine Core — waits somewhere around 400 m out. 24-minute day/night cycle drives temperature, sky, and light.
- **Loop.** Follow the quest chain (step under open sky → strip the wreck → find an oasis → carry a canister to a beacon → craft a tool → survive to day 4 → find the second wreck → break free its Engine Core → set it within 10 m of a Save Beacon) tracked in the top-right HUD; block-shaped rewards land as crash pods from the sky. Explore, salvage debris and full water canisters around the wreck, dig up buried canisters, manage a carry-weight budget, campfires (warmth + light, fuel with wood), craft at the wreck's bench — or build your own two-block Crafting Bench anywhere. Beacons save your run; death stashes your inventory at the spot — play a fresh world to retrieve it. Placing the Engine Core completes the Main Quest: the relay calls rescue and you keep surviving.

## Controls

| Input | Action |
|---|---|
| WASD / stick | Move |
| Mouse / drag | Look |
| Shift | Sprint (drinks faster) |
| Space | Jump |
| E | Interact (doors, canisters, benches, campfires, beacons, caches) |
| Q | Drink a full canister (+25 Water) |
| X | Sweat Surge — force your body cool: −15 Water, −2.5 °C body, 10 s cooldown (needs ≥20 Water) |
| Left click | Mine / break (tool tier matters) |
| Right click / place | Place selected block |
| 1–9 / scroll | Hotbar |
| I | Inventory |
| P | Pause / resume |
| Esc | Close open menu, or pause (save / export world / quit) |
| F1 | Instructions |

Crafting and smelting open through E at a Crafting Bench or Campfire. The active quest shows a waypoint in the HUD — a compass arrow, distance, and a marker beam at the target; holding a craftable Surveyor's Visor beams every Death Cache, Reward Cache and Supply Chest through walls too. The Catalog (pause menu or title screen) lists every item, block, and recipe.

Inventory: drag items between cells; click a cell to select it (Rotate / Drop buttons appear beside the grid). A drag released anywhere off the grid parks the item in **Temporary Storage** next to it — the inventory can't be closed while it's occupied; drag the item back from there or use its Drop button. Dropped items pile up in front of you (never inside walls) and need a short beat before they can be picked back up.

Supply Chests are container blocks (craft: 6 dead wood + 1 metal at the bench; the cockpit starts with one). Aim at one and press E: its grid opens above yours, and you can drag items between the two or use **Move to pack**. Chests placed face-to-face merge into one bigger grid — 3×3 per chest, up to three wide, then a row taller per chest (with three chests it's 9×3, four is 9×4…). Break one and the grid shrinks; contents that no longer fit spill onto the sand.

Touch: on-screen stick + jump / break / place / act / drink / item / bag buttons and a pause button (top-left).
One finger steers the camera — extra fingers are ignored. Buttons fire when pressed; Jump and Break act while held.

## Tech

TypeScript + Vite + Three.js with a hand-rolled chunked voxel renderer (greedy-ish per-chunk meshing, dirty-chunk rebuilds, fog-tuned render distance). Audio is fully procedural WebAudio — wind bed, generative day/night ambient score (Music toggle in Settings), and event SFX; zero asset files. No workers, no SharedArrayBuffer, no server. World state is delta-saved per slot in localStorage, with JSON export/import for sharing worlds and transferring saves between machines. Design history lives in `docs/adr/`; vocabulary in `GLOSSARY.md`.
