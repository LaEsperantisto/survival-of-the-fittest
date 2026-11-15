# Survival of the Fittest

A browser voxel-survival game. You wake up in a crashed ship in the middle of a desert. The wreck is a small, rounded hull with broken wings: a forward cockpit with an insulating-glass windscreen, a central hall with the wreck's crafting bench, a save room whose stern door is the wreck's only opening to the outside, a water compartment whose tank is a pool sunk into the ground, and a regulator room with a pre-installed Heat Regulator. The hull and doors keep sun and wind out, but a sealed space still drifts to the desert's temperature — the desert swings from ~52 °C at midday peak down to ~2 °C at night — unless Heat Regulators hold it neutral. Only the small regulator room starts conditioned. No hunger. Water, heat, health — keep all three in their zones.

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
- **Shelter is physical.** Partial cover is the sum of block thermal resistance straight above you (see `docs/adr/0002-sky-column-shelter-model.md`) — lean-tos, overhangs and insulating glass help. But a fully sealed space equalizes with the outside air: walls alone never save you. A craftable Heat Regulator (one is already installed in the wreck's small regulator room) holds a sealed room at body-neutral temperature — 100 open cells per Regulator, capacity stacks. Sealed means sealed: an open door disables the Regulators and the desert gets in. Aim at an active Regulator and press E to draw on it: your body snaps back to 37 °C on the spot, no drinking required — an idle Regulator does nothing.
- **World.** Infinite chunked voxel desert (1 voxel = 1 m), seeded and deterministic: dunes, rocky hills, salt flats, mesas, oases with water you can fill canisters from (it is a real liquid: Sources spread and fall, and breaking a Source drains its Flow for good), dead-wood groves, adobe ruins/towns, cacti heavy with prickly pears, and wildlife — desert snakes that hunt anything that steps too close, and kangaroo rats that bolt when they see you. A second wreck — and its Engine Core — waits somewhere around 400 m out. 24-minute day/night cycle drives temperature, sky, and light.
- **Loop.** Follow the quest chain (step under open sky → strip the wreck → find an oasis → carry a canister to a beacon → craft a tool → find the second wreck (the Catalyst drops there) → break free its Engine Core → set it within 10 m of a Save Beacon) tracked in the top-right HUD; block-shaped rewards land as crash pods from the sky. Explore, salvage debris and full water canisters around the wreck, dig up buried canisters, manage a carry-weight budget, campfires (warmth + light, fuel with wood), craft at the wreck's bench — or build your own two-block Crafting Bench anywhere. Eat to stay alive: break cacti for prickly pears (+8 Water each), hunt kangaroo rats and roast the meat at a campfire (+25 Health cooked), stitch snake skins into Reptile Armour (40% of all damage shrugs off). Fight bare-handed or with any tool, or forge the Metal Sword (bench: 2 Metal Rods + 1 Dead Wood) — far harder hits and longer reach: two swings kill a snake, one kills a rat. Beacons save your run; death stashes your inventory in a Death Cache at the spot — respawn at a beacon and go retrieve it. Placing the Engine Core completes the Main Quest: the relay calls rescue and you keep surviving.

## Controls

| Input | Action |
|---|---|
| WASD / stick | Move |
| Mouse / drag | Look |
| Shift | Sprint (drinks faster) |
| Space | Jump |
| E | Interact (doors, canisters, benches, campfires, beacons, caches, Heat Regulators) |
| Q | Drink a full canister (+25 Water, −1.5 °C body) |
| X | Sweat Surge — force your body cool: −10 Water, −1.5 °C body, 10 s cooldown (needs ≥20 Water) |
| Left click (hold) | Mine / break (tool tier matters) — aimed at a mob, attack it |
| Right click / place | Place selected block |
| 1–9 / scroll | Hotbar |
| I | Inventory |
| P | Pause / resume |
| Esc | Close open menu, or pause (save / export world / quit) |
| F1 | Instructions |

Crafting and smelting open through E at a Crafting Bench or Campfire. The active quest shows a waypoint in the HUD — a compass arrow, distance, and a marker beam at the target; a craftable Surveyor's Visor equipped in the Head slot beams every Death Cache, Reward Cache and Supply Chest through walls too. The Catalog (pause menu or title screen) lists every item, block, and recipe.

Inventory: drag items between cells; click a cell to select it (Rotate / Drop buttons appear beside the grid). Shift-click an item to quick-move it into the open chest (either direction); with no chest open it lifts straight into **Temporary Storage**. A drag released anywhere off the grid parks the item in **Temporary Storage** next to it — the inventory can't be closed while it's occupied; drag the item back from there or use its Drop button. Dropped items pile up in front of you (never inside walls) and need a short beat before they can be picked back up. Three Armour Slots sit above the grid — Backpack, Head, Body: select an item and click Equip — or click the empty slot directly — to wear it; click a filled slot to take it off. Backpack I (6 dead wood + 2 metal at a bench) grows the grid from 3×4 to 4×5 and adds +20 kg; a visor's upgrades only work while equipped in the Head slot; Reptile Armour (3 snake skins) in the Body slot shrugs off 40% of all damage. Edible items get an Eat button when selected — prickly pears restore Water, cooked rat restores Health.

Supply Chests are container blocks (craft: 6 dead wood + 1 metal at the bench; the cockpit starts with one). Aim at one and press E: its grid opens above yours, and you can drag items between the two or use **Move to pack**. Chests placed face-to-face merge into one bigger grid — 3×3 per chest, up to three wide, then a row taller per chest (with three chests it's 9×3, four is 9×4…). Break one and the grid shrinks; contents that no longer fit spill onto the sand.

Touch: on-screen stick + jump / break / place / act / drink / surge / item / bag buttons and a pause button (top-left).
One finger steers the camera — extra fingers are ignored. Buttons fire when pressed; Jump and Break act while held — hold BREAK aimed at a mob to fight it (a Metal Sword reaches farther and hits harder).
In the inventory: tap an item to select it, then tap another cell to move it there (the occupant swaps into its place); tap an Armour Slot to wear the selected gear.

## Tech

TypeScript + Vite + Three.js with a hand-rolled chunked voxel renderer (greedy-ish per-chunk meshing, dirty-chunk rebuilds, fog-tuned render distance). Audio is fully procedural WebAudio — wind bed, generative day/night ambient score (Music toggle in Settings), and event SFX; zero asset files. No workers, no SharedArrayBuffer, no server. World state is delta-saved per slot in localStorage, with JSON export/import for sharing worlds and transferring saves between machines. Design history lives in `docs/adr/`; vocabulary in `GLOSSARY.md`.
