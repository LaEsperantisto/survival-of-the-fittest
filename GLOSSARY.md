# Desert Survival (Survival of the Fittest)

Infinite procedurally generated desert world, seeded at creation; the crashed Ship always sits at the world origin. Survival is Minecraft-style: break/place blocks, craft, no creative mode.

## Language

### Survival bars

**Health**:
The player's vitality. Reaches zero → death (respawn at last Save Point). Damaged by extreme Heat and severe dehydration; regenerates only while both Water and Heat are in their safe zones.
_Avoid_: HP, lives

**Water**:
The player's hydration. Drains steadily, faster when Hot (sweating) and when Overencumbered. Low Water worsens vision; very low Water damages Health. There is no hunger.
_Avoid_: thirst bar, hydration meter

**Heat**:
The player's body temperature, measured in Celsius (Fahrenheit optional in Settings). Driven by the surroundings; must stay in its safe zone. Not hardcoded per location: safety emerges from insulation.
_Avoid_: temperature bar

### Thermal world

**Insulating Block**:
A block that heat and cold do not pass through: Hull Plating, a closed Door, Insulating Glass.
_Avoid_: safe wall

**Conducting Block**:
A block that transmits heat. Ordinary Glass conducts — it is the exception the player must engineer around.

**Insulating Glass**:
A rare, hard-to-craft transparent Insulating Block. The wreck's cockpit already has it.

**Door**:
An opening in the Hull that insulates exactly like Hull Plating while closed.

**Heat Regulator**:
A craftable device that holds a sealed Space at body-neutral temperature — 100 open cells of capacity each, and multiple Regulators covering one Space stack their capacity. It works by enclosure, not by region tag: if the space stops being sealed, the Regulators do nothing. Without enough Regulator capacity, a sealed Space is as hot or as cold as the outside.
_Avoid_: heater, AC, thermostat

**Sealed Space**:
A connected body of open cells enclosed on every side by solid blocks or closed Doors — an open Door, a gap, or enough size that the region's bounds cannot be checked means it is not sealed.

**Compartment**:
A sub-space of the Ship or a Base separated by Insulating Blocks and a Door, sealable on its own.

**Hull Plating**:
The ship's insulating wall block.

**Ship**:
The small wreck at the world origin — a rounded hull with broken wings — split into sealable Compartments: a forward cockpit, a central hall, a Save Room whose stern Door is the wreck's only opening to the outside, a water compartment, and a regulator room. Fully customizable: any block can be broken or placed, so the Ship can be expanded anywhere.

**Save Room**:
The wreck's Compartment containing the starting Save Beacon, reachable only through the hall — the safest room in the crash site.

**Water Station**:
The wreck's water compartment: its tank is a pool sunk into the ground, an effectively bottomless refill point for Water Canisters, unlike finite Oases.

**Ship Interior**:
Whatever space the player has enclosed with Insulating Blocks. Enclosing alone only keeps out sun and wind; a Sealed Space's air still matches the outside until Heat Regulators hold it neutral.

### World

**World Seed**:
Chosen or randomly generated at world creation. The same Seed yields the same world on any device.

**Biome**:
Terrain regions: Dunes, Rocky Desert, Badlands/mountains, Salt Flats, dry canyons.

**Oasis**:
A structure with a finite water source, green trees and plants that can be farmed.

**Town**:
A structure out in the world holding rare loot.

**Dead Tree**:
A leafless tree scattered through the desert.

**Save Point**:
A craftable, permanently placed block (the Save Beacon). Cannot be picked back up. The world persists only at Save Points; death respawns the player at the most recent intact one — if all are destroyed, at the crash site.
_Avoid_: checkpoint, bed

**Death Cache**:
the container holding a dead player's items at the death spot. It accepts no new items and vanishes only when emptied.
_Avoid_: grave, drop bag

**Supply Chest**:
A fixed container in the wreck's cockpit holding the first drinkable Water. Behaves like a Death Cache to open and empty, but holds its own goods, not the player's.

**World Export / Import**:
A file format for a world, so the same world can be played on different devices.

### Systems

**Main Quest**:
The goal line: rescuing other survivors and other objectives; finishing it completes the game.

**Survivor**:
A rescuable person. Needs exactly what the player needs — Water, safe Heat, Health — and no food of any kind. Vulnerable like the player: they need genuine shelter and water wherever they live, including a rebuilt Ship. Nothing about them is tied to the original wreck: any equivalent insulated structure has exactly the same properties.
_Avoid_: NPC (generic), crew

**Crash Pod**:
A supply container a quest drops from the sky near the player, with a pre-impact warning marker and SFX. Either a reusable chest or a single-use container. All block-shaped quest rewards arrive as Crash Pods.
_Avoid_: airdrop, supply drop

**Catalyst**:
A rare material required to craft Insulating Glass; found in Town and second-ship loot, but eventually also synthesizable.

**Strength Hormones**:
An inventory mass boost. Contraband (loot-only) crashes afterward; Synthesized (craftable) does not.

**Vehicle**:
Not in scope for M1 or M2; a definite later addition.

**Score**:
Two parts: days survived and Main Quest progress. Completing the game scores higher with fewer days. Best score persists across deaths.

**Water Canister**:
A drinkable item (1×2 in the Inventory Grid). Buried in the world, or waiting in the Supply Chest; finite per world. Oases provide finite water; a late-game method synthesizes water.

**Farming**:
Growing Oasis plants where Heat is not too high and Water is not too low.

**Inventory Grid**:
A rectangular grid of slots; items occupy footprints (Water Canister 1×2). Expandable via Backpacks. Every item instance claims its own cells — duplicates never share a slot, so more of something means more space taken.
_Avoid_: stacking, merging slots

**Temporary Storage**:
The parked state of an item lifted out of the Inventory Grid by a drag that wasn't completed. An item at rest in Temporary Storage blocks closing the inventory until it is placed back or dropped.
_Avoid_: held item, cursor slot

**Weight Limit**:
How much mass the Inventory Grid may hold. Exceedable by at most 10% — while Overencumbered the player is incredibly slow and Water drains. Weight itself never affects Water or Heat except through Overencumbrance.

**Overencumbrance**:
The state of carrying above the Weight Limit (max +10%): incredibly slow, draining Water.

**Visor**:
The player's HUD. Upgradeable to show more: heat fluctuations, marked points (the Ship, the player's Base).

**Water**:
Exists as source blocks (Oasis pools, Bucket-placed). A placed source flows — spreading over terrain and draining — until it meets a new source or runs out. Bucket-carrying lifts exactly one source.
_Avoid_: liquid sim, flood sim

**Salvage Tools**:
Typed: Shovel (sand, dirt), Pickaxe (rock), Axe (chops Dead Wood faster than hands, which still work), Bucket (moves Water), Disassembler (buildings). Each family has its own tier ladder; ladder length varies per family (Wood/Stone/Metal is the baseline, more or fewer tiers per family are allowed).
_Avoid_: universal tool

**Disassemble**:
Removing a player-placed block with the Disassembler returns the item itself — placed blocks are just items stood up.
_Avoid_: unbuild, demolish

**Recycler**:
A station that breaks down crafted items (tools, gear — not placed blocks) into ~75% of their ingredients, always at least one unit of each.
_Avoid_: scrap bin

**Wanderer**:
A rare traveling trader in Towns: barters rare loot for Water Canisters; finite stock per spawn, respawns rarely with new stock.

**Engine Core**:
The single quest-exclusive item — the final quest artifact. Everything else in the game is eventually craftable.

**Backpack**:
An upgrade expanding the Inventory Grid and/or raising the Weight Limit.

**Settings**:
Menu with units (Celsius/Fahrenheit), controls, and rendering options.
