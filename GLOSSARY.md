# Desert Survival (Survival of the Fittest)

Infinite procedurally generated desert world, seeded at creation; the crashed Ship always sits at the world origin. Survival is Minecraft-style: break/place blocks, craft, no creative mode.

## Language

### Survival bars

**Health**:
The player's vitality. Reaches zero → death (respawn at last Save Point). Damaged by extreme Heat and severe dehydration; regenerates only while both Water and Heat are in their safe zones.
_Avoid_: HP, lives

**Water**:
The player's hydration. Drains steadily, faster when Hot (sweating). Low Water worsens vision; very low Water damages Health. There is no hunger.
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
A rare, hard-to-craft transparent Insulating Block. The wreck's cockpit already has it. It is see-through, but it never lets Sunlight through.

**Sunlight**:
Direct light from the Sun. Only an unbroken line to the Sun counts as sunlit: any opaque block — and Insulating Glass, see-through though it is — breaks the line. Shade falls where the Sun actually is, not merely overhead.
_Avoid_: UV, daylight bonus

**Sealed Door**:
An opening in the Hull that insulates exactly like Hull Plating while closed.
_Avoid_: metal door

**Inside Door**:
A door that never insulates: in temperature terms it is just air. It divides rooms visually and for movement, but never helps seal a Space. Every door inside the Ship's interior is one; only openings to the outside are Sealed Doors.

**Heat Regulator**:
A craftable device that holds a sealed Space at body-neutral temperature — 150 open cells of capacity each, and multiple Regulators covering one Space stack their capacity. It works by enclosure, not by region tag: if the space stops being sealed, the Regulators do nothing. Without enough Regulator capacity, a sealed Space is as hot or as cold as the outside. Drawing on an active Regulator restores the Body to neutral on the spot; an idle one does nothing.
_Avoid_: heater, AC, thermostat

**Sealed Space**:
A connected body of open cells enclosed on every side by solid blocks or closed Doors — an open Door, a gap, or enough size that the region's bounds cannot be checked means it is not sealed.

**Compartment**:
A sub-space of the Ship or a Base separated by Insulating Blocks and a Door, sealable on its own.

**Hull Plating**:
The ship's insulating wall block.

**Ship**:
The small wreck at the world origin — a rounded hull with broken wings — split into sealable Compartments: a forward cockpit (its Chest), a central hall, a Save Room whose stern Door is the wreck's only opening to the outside, a water compartment, and a regulator room. On a Phase 1 Start the hall and regulator room hold a working Storm Breaker and Heat Regulator; on a Phase 0 Start they hold only their Husks. The Ship can fly — and it can leave its planet (see **Lift-off**, **Leave Planet**); on a Phase 2 Start the world begins on Silvaris, its Ship already fixed and **docked** at a Settlement. It holds no Crafting Bench and no Bed — bench and bunk must be earned. Fully customizable: any block can be broken or placed, so the Ship can be expanded anywhere.

**Save Room**:
The wreck's Compartment containing the starting Save Beacon, reachable only through the hall — the safest room in the crash site.

**Water Station**:
The wreck's water compartment: its tank is a pool sunk into the ground — a refill point for Water Canisters that never runs dry, oasis-style.

**Ship Interior**:
Whatever space the player has enclosed with Insulating Blocks. Enclosing alone only keeps out sun and wind; a Sealed Space's air still matches the outside until Heat Regulators hold it neutral.

### World

**World Seed**:
Chosen or randomly generated at world creation. The same Seed yields the same world on any device.

**Biome**:
Terrain regions. Desertis: Dunes, Rocky Desert, Badlands/mountains, Salt Flats, dry Canyons. Silvaris: Deep Ocean, Shallows, Temperate Plains, Boreal Forest, Alpine Peaks, Scorch Belt.

**Desertis**:
the Desert Planet, where every normal run begins; the crashed Ship sits at its world origin. After Leave Planet its world record survives in the save — Base, caches and edits intact and waiting — but nothing reaches it until the player can make Super Rocket Fuel themselves.
_Avoid_: the first planet, homeworld

**Silvaris**:
the Second Planet: oceans you can drown in, plains, a boreal forest, mountains tall enough to bite cold, and the Scorch Belt. It opens as the stage of Phase 2 — reached by Leave Planet at the end of Phase 1, or chosen directly at world creation. One save, one world record each: Silvaris has its own Landmarks, Pins, fauna, crops and Map.

**Settlement**:
an advanced ruin on Silvaris — better-built structures, better loot, Beds, a Trader stall, Inscriptions, and a **Dock**. No living soul is home — yet.

**Dock**:
a plaza of Dock Pads at every Settlement, laid out for a Ship to stand on. A grounded Ship standing on Docks is **docked**: the arrival cinematic aims for it, ground Grids join it naturally, and its moorings are the planet's familiar anchor.

**Inscription**:
a carved stele read with E. Settlements keep the Dwellers' memories in these; reading one earns its Codex entry. They resolve who the Dwellers were and why they left — and ask what worlds remain.

**Scorch Belt**:
the Silvaris biome of black basalt and heat-soaked ground near volcanic fires — no open flame to fear yet, but the Air Temperature and the Ashstorm bite there.

**Oasis**:
A recurring Landmark of the deep desert — open water ringed by green trees and plants that can be farmed. Ripe Dune Melon vines hang at the water's edge and young sprouts just beyond them: break a sprout for Melon Seeds, so the oasis seeds itself. Widely spaced, never scarce per world; the danger is the walk, not the shortage.
_Avoid_: watering hole, spring

**Town**:
A ruin out in the world: huts, Chests with rare loot, Beds, and the only source of Desert Wheat Seed. No living soul is home — yet.

**Dead Tree**:
A leafless tree scattered through the desert.

**Living Tree**:
A green tree with trunk, branches and a Leaf canopy, found at Oases and in Towns. It blocks sunlight from above and no one can walk through its parts. Chopping its trunk yields Wood Log.
_Avoid_: plant, bush

**Wood Farm**:
A player's own grove of Living Trees, grown from Tree Seeds in Dirt and kept growing by keeping moisture close. A young tree re-grows parts you break off; once full grown it stands final — chopped branches and canopy stay chopped, so harvest the canopy and re-plant seeds to keep the grove young.

**Tree Seed**:
Found in Town Chests; planted in Dirt it grows a Living Tree stage by stage while moisture stays near.

**Leaf**:
The canopy part of a Living Tree: walk-blocking but not insulating, partly shading the sky above. Broken Leaf crumbles into Kindling.

**Kindling**:
Leaf scraps — campfire fuel that burns fast and small.

**Wood Log**:
The Living Tree's trunk — the renewable counterpart of Dead Wood for fuel and crafting.

**Dirt**:
The Oasis's dark soil and the only thing a shovel can turn into Farm Land; Towns have it too.
_Avoid_: soil (as the block's name)

**Grass**:
Dirt's green living cover, found wherever there is living water — Oases and Towns. Breaking it yields Dirt.

**Cactus**:
A spined desert plant standing in the open sand. Cacti actually grow: a replanted piece climbs over time, and a mature column develops Fruit-Bearing blocks.
_Avoid_: prickly pear plant

**Fruit-Bearing Block**:
The cactus variant that carries Prickly Pears. Only it gives fruit; breaking any other Cactus block yields just the replantable block. Breaking a fruiting block leaves the column standing.

**Prickly Pear**:
Cactus fruit — eating is the first way to drink away from water.
_Avoid_: cactus berry

**Bed**:
A 2×1 block in every Town and a craftable comfort of one's own. Sleeping in a Bed passes 8 in-game hours no matter the hour, but only once every six real minutes.
_Avoid_: cot, sleep (as the block's name)

**Metal Plating**:
The Ship's structural metal — a placeable block with Iron Rod's properties. Rods themselves are crafting material and are never placed.

**Save Point**:
A craftable, permanently placed block (the Save Beacon). Cannot be picked back up. The world persists only at Save Points; death respawns the player at the most recent intact one — if all are destroyed, at the crash site.
_Avoid_: checkpoint

**Death Cache**:
the container holding a dead player's items at the death spot. It accepts no new items and vanishes only when emptied.
_Avoid_: grave, drop bag

**Death Indicator**:
the markers on any Cache with items in it: a ground ring in the Cache's kind-colour (red for a Death Cache, gold for a Reward Cache) plus a tall light beam for whatever the player is currently tracking — always a red beam for a Death Cache, a cyan beam for every standing Save Beacon, a gold beam for a Reward Cache only through the Visor. Past about 96 m a tracked marker swaps its beam for an edge-pinned HUD arrow in the same colour with a distance readout — never both. Everything goes dark the moment a Cache runs dry.
_Avoid_: grave marker, beacon (reserved for the Save Beacon)

**Reward Cache**:
the Crash Pod form a quest reward takes: a warning, a marker where it will land, then a container holding exactly that reward. It empties when claimed and is marked like every Cache.

**Chest**:
A craftable container block owning an Inventory Grid of its own — 3×3 each. Chests placed face-to-face are Linked Chests and share one Grid. The wreck's cockpit holds one, stocked with the first drinkable Water. Unlike a Death Cache, it accepts and keeps the player's goods.
_Avoid_: crate, locker, supply chest

**Linked Chests**:
Chests touching face-to-face form one cluster with a single Grid: 3×3 per chest, growing sideways up to three wide, then taller — one extra row per further chest. Capacity is always 9 per chest. Breaking one chest shrinks the cluster; contents that no longer fit fall to the ground. The link is pure adjacency — break the chain and the grids split immediately, contents split with them (spilling when necessary).

**Chest Connector**:
A cheap steel rail that carries a chest link through itself: a Chest sits against a Connector links to the Chest on the Connector's far side, though the Connector itself stores nothing and is never opened.
_Avoid_: chest rail, pipe

**Chest Interface**:
A door onto a Chest cluster that is not itself storage: it carries the chest link through itself exactly like a Chest Connector — joining clusters, extending them, and letting Inserters and Planters reach through — while holding nothing and claiming no Grid cell. Opened, it lists everything in the cluster by kind: goods put in find their own cells (a matching open Sack fills first), goods taken come back out; a Sack is taken whole, never opened from the panel. An Interface touching no cluster does nothing.
_Avoid_: terminal, hub, remote chest

**Alabaster Masonry**:
The decorative building family cut from Alabaster: Bricks, Polished, Chiselled and the Pillar, plus the slim Fence and the swingable Fence Gate (opened with E, like a door). An Alabaster Door is the pale twin of the hatchway Door — same two-cell pair, same open/close rules. The Gate keeps its quarter-turn when it swings.
_Avoid_: stone brick, railing, turnstile

**World Export / Import**:
A file format for a world, so the same world can be played on different devices.

### Wildlife

**Desert Snake**:
A low predator that attacks whatever steps too close. Its skin is Reptile Armour's material.
_Avoid_: mob, viper

**Kangaroo Rat**:
A skittish desert creature that bolts rather than fights; its cooked meat restores Health.
_Avoid_: jerboa

**Reptile Armour**:
Armour stitched from Desert Snake skins; worn in the Body slot it shrugs off a fixed share of every damage taken.

**Metal Sword**:
The only Weapon: a forged blade that, while held, hits far harder than fists or Salvage Tools and extends melee reach.
_Avoid_: weapon (as the item's name), blade, sword (bare — material always qualifies it)

### Systems

**Main Quest**:
The goal line: one fixed chain of guided goals running across every planet. Each Phase is derived from how far the chain has run; completing a stretch closes a planet's story, not the game. Its deeds count whenever they happen, not only while their quest is current — something done early is paid off the moment its quest comes up, Reward Cache included.

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

**Water Canister**:
A drinkable item (1×2 in the Inventory Grid). Buried sites dot the desert on a recurring spacing — containers, not water, so finding them never makes drinking easy. Refilling at an Oasis or the ship's tank costs nothing; a late-game method synthesizes water. A buried site marks the Map only once one of its canisters is dug up.

**Hot Water Pouch**:
A full Water Canister heated at a lit Campfire — it costs the fire one fuel charge. Using it (Q) is a heat pulse: +10 °C toward body-warm, clamped at the top of the safe zone so it can never overshoot, and the empty canister comes back.
_Avoid_: canteen, thermos, heat pack (the wearable is the Hot Pad idea, dead)

**Campfire**:
a heat source and cooking station. Fuel is consumed going in: drop a Wood Log, Deadwood or Kindling into the Coals box — or have a powered Inserter push it in — and the item burns away on the spot, its charges banked in the fire (a Log carries 2 charges, a Deadwood 3, Kindling half); the fire keeps the charges and no fuel item sits inside it. A lit fire burns one charge every 10 in-game minutes; with no charges left it goes out — cold charcoal, no light, no glow, no cooking. A lit fire glows, warms whoever stands close, and cooks: an Input Slot job costs one fuel charge up front and takes six seconds, finished cooking lands in the Output Slot. Pressing <b>E</b> at a Campfire opens its panel inside the Inventory — a gauge of the charges burning or waiting, plus the Coals drop box.
_Avoid_: bonfire, furnace

**Water Bucket**:
A carrying vessel for Water itself: it scoops from a Source and pours back as a Source, moving water rather than drinking it.
_Avoid_: pail, canteen

**Farming**:
Growing crops on Farmland where Air Temperature suits the species and Water is within that species' reach — Desert Wheat 6 blocks, Dune Melon 10, a Living Tree 10. Growth follows Air Temperature, not sun or shade: the reason outdoor farming is dangerous is that the danger that costs you health is the same danger that costs you time. Aiming at a Crop (or the Farmland under it, or a young Living Tree) names it with its growth percentage toward Ripe and says why it stands still when it does. Ripe Wheat yields its sheaf and seeds; a picked Melon usually leaves a seed too, and re-ripens on the vine.
_Avoid_: greenhouse (crops are not tied to glass), gardening

**Farmland**:
Farm Land is Dirt tilled by a shovel — never sand. A crop grows on it only while a Water block is within 4 tiles; trees want moisture within 6. Cacti tolerate bare Sand too.

**Crop**:
A planted plant that advances through growth stages over time while its species' Air Temperature band and its moisture hold. Out of band a Crop pauses, never dies.

**Seed**:
The planted form of a crop. Breaking a mature crop yields its food plus seeds.

**Dune Melon**:
The first crop found — wild at Oases. Eaten raw: a big drink with a little healing. Its seeds start a farm.

**Desert Wheat**:
The harder crop, discovered in Town loot: it tolerates cold but not the midday, and its cooked food heals more than anything else on the farm.

**Tundra Root**:
a hardy Silvaris tuber grown on Farmland from seed tubers — the cold biome's staple, food for the player and for a pen of animals.

**Ember Bush**:
a small Silvaris shrub bearing pungent red berries — grown from cuttings, eaten raw or cooked.

**Bread**:
Desert Wheat baked at a Cooking Pot — the farm's best healing.
_Avoid_: Cooked Wheat (old name), loaf

**Apple Tree**:
The fruiting tree species: an Apple Pip planted in Dirt grows it stage by stage while moisture stays near, and while it stands its canopy bears Apples — a picked fruit spot re-ripens. A felled tree gives Wood like any tree; fruit is the tree's while it lives.
_Avoid_: orchard tree (an orchard is a plantation of them, not a species)

**Apple Pip**:
What eating an Apple leaves in hand; planted in Dirt it starts an Apple Tree.
_Avoid_: apple seed (seeds are the grasses' planted form)

**Sugar Cane**:
The thirstiest crop — it grows on Sand, Dirt or Farm Land but only with Water very close. Its yield is cooked down to Sugar for the Pot.

**Sugar**:
Refined Sugar Cane; the sweetening in the Apple Tart.
_Avoid_: sugar cane (that's the plant)

**Cooking Pot**:
The kitchen station: it keeps Coals like a Campfire, but recipes decide whether the fire is touched at all — a Stew spends charges, a Fruit Salad needs no heat at all. Every multi-ingredient Dish has its home here, never at a Campfire.
_Avoid_: cauldron, stove, kitchen

**Dish**:
A cooked food of two or more ingredients, made only at a Cooking Pot — Stew, Fruit Salad, Apple Tart.
_Avoid_: meal, recipe (a recipe is the instruction, a Dish is the thing)

**Water Cage**:
A closed vessel holding one Source block of Water: solid, never flowing, yet Water to every Crop and Tree that can reach it. Breaking it drops the Cage and lets the Water run free; a Bucket scoops it out instead.
_Avoid_: tank, cistern, reservoir

**Inventory Grid**:
A rectangular grid of slots; items occupy footprints (Water Canister 1×2). Expandable via Backpacks. Every item instance claims its own cells — duplicates never share a slot, so more of something means more space taken. A Sort button on every Grid (pack, Chests, each Campfire slot) arranges items alphabetically, identical items adjacent.
_Avoid_: stacking, merging slots

**Sack** (Sack I, Sack II, Sack III):
A bound bundle of identical goods. A Sack holds exactly one kind of item up to its tier's capacity — 10, 20 or 30 units, counted in footprint area (a 2×2 item costs 4) — and stands as one cell wherever it sits; moving the Sack moves the whole bundle. Any insertion, by hand or machine, fills a matching open Sack first; only hands empty one, one item at a time. A Sack never holds another Sack, and is opaque to machines and Traders: they may fill it but never read inside it.
_Avoid_: bag, bundle, stack (items still never stack)

**Armour Slot**:
One of five dedicated equipment places above the Inventory Grid: Backpack, Head, Body, Regulator, Light. Gear in an Armour Slot works passively, takes no room in the Grid, and comes off by clicking the filled slot.
_Avoid_: equip slot, paper doll

**Temporary Storage**:
The parked state of an item lifted out of the Inventory Grid by a drag that wasn't completed. An item at rest in Temporary Storage blocks closing the inventory until it is placed back or dropped.
_Avoid_: held item, cursor slot

**Bin**:
A slot in the inventory that destroys whatever is sent to it — by click or by drag. There is no undo and no recovery: unlike dropping, the Bin leaves nothing behind.
_Avoid_: trash can, delete button

**Dropped Item**:
An item thrown out of the pack (the R key, a botched drag, death). Loose items rot away in the open desert within minutes; a Death Cache does not rot.
_Avoid_: ground item, loose loot

**Visor**:
Head-slot gear powering the player's HUD. While equipped it draws the Map, beams Caches, Chests, and Pins through walls, and marks known Landmarks — the marked points being the Ship and the player's Base. Upgradeable to show more: heat fluctuations. Upgrades count only while equipped.
_Avoid_: goggles, HUD (the thing it powers, not it)

**Waypoint**:
The HUD's guide to the active quest: a compass heading, a distance, and a marker at the target. A Surveyor's Visor equipped in the Head slot — a craftable Visor upgrade — additionally marks every Cache and Chest through walls.

**Air Temperature**:
The temperature of the air in a given cell — what Crops and Living Trees grow by, and what the body drifts toward. Inside a Sealed Space the Air Temperature still tracks the outside until Heat Regulators hold it neutral.
_Avoid_: ambient bar, ground temperature

**Water**:
Exists as Source blocks (Oasis pools, Water Station tanks). A Source feeds Flow — water that spreads over terrain and falls — until it meets a new Source or runs out; when a Source breaks, its Flow drains away, so an Oasis can be emptied for good.
_Avoid_: liquid sim, flood sim

**Salvage Tools**:
Typed: Shovel (sand, dirt), Pickaxe (rock), Axe (chops Dead Wood faster than hands, which still work), Bucket (moves Water), Disassembler (buildings). Each family has its own tier ladder; ladder length varies per family (Wood/Stone/Metal is the baseline, more or fewer tiers per family are allowed).
_Avoid_: universal tool

**Disassemble**:
Removing a player-placed block with the Disassembler returns the item itself — placed blocks are just items stood up.
_Avoid_: unbuild, demolish

**Recycler**:
A station that breaks down crafted items (tools, gear — not placed blocks) into ~75% of their ingredients, always at least one unit of each. Each planet keeps its own Recycler, built from that planet's materials. An item that is not of that planet cannot yield that planet's ingredients — it comes out whole as Scrap instead.
_Avoid_: scrap bin

**Scrap**:
The only material that belongs to no planet: a crumpled mixed residue that a Recycler grinds any off-planet crafted item into. A few recipes on each planet accept it, so cargo brought across worlds always still means something. Nothing else is shared between the planets' crafting.
_Avoid_: junk, scrap metal

**Nomad**:
A wandering survivor who keeps a stall at a Nomad Camp — descended from the founders who scattered. A Nomad paces a small beat around the stall — never far from it, and it turns to face whoever is bartering — but it does not fight and cannot be killed. Barter is the only exchange, and there is no coin anywhere. Beyond trade, each Camp keeps a **Keeper**: a named Nomad whose trust is earned, and whose stories carry the world's true history. Silvaris keeps the same kind of camp — an outpost stall with the advanced goods the settlements don't hold.
_Avoid_: Trader (retired name), NPC (generic), merchant, vendor, wanderer (the abandoned Town-based idea)

**Nomad Camp**:
A homestead on the trade roads — a windmill tower, a waystation hut, or a farmstead with a water trough — each kept by a single Nomad and their stall, and home to a Keeper once trust is earned.

**Trade Table**:
A Nomad's offers: five straight goods-for-goods swaps per Camp, fixed for that Camp for the whole in-game day and reshuffled at every dawn.

**Sentinel**:
The central automation the founders left on Desertis — still obeying an old "hold the settlement" directive, and the thing that shot the colony ships down. The head of the machine factions that now spread across Silvaris. The Phase-2 finale kills it in the Scorch Belt volcano core.
_Avoid_: AI (generic), boss (as a name)

**Machine Faction**:
The Sentinel's scattered crews — Wardens (scout-relics, the only machines left on Desertis), Sentries (line soldiers), Breakers (armored heavies at the camps) and non-combat Haulers trudging between camps. Built from the metal of the planet they stand on, and they drop it.
_Avoid_: robot horde, enemies

**Machine Camp**:
A hostile Landmark: a scrap-forged camp with an antenna that coordinates its patrols. Destroying the antenna stops the patrols — and calls down a Reclaimer squad; the machines answer provocation, they never grow from mere waiting. Expansion is scripted: story beats and entering certain places make more camps, never a timer.

**Relay Tower**:
A machine structure raised in wild country near a player Grid that has reached too far — it anchors hostile patrols in its radius, and the machines inside it treat exposed player Grid hardware as a target. Destroying the Tower ends the threat.
_Avoid_: turret (that's the player's)

**Machine Part**:
The generic innards every robot yields — alien to both planets' native chains, so it rides the Scrap economy: recyclable into Scrap, eaten raw by the vehicle line.

**Machine Heart**:
The command sliver carried only by elite machines (Breakers, arena guardians) — the raw intelligence behind late-game gear and the arena gadgets.
_Avoid_: Sentinel Core (misleading)

**Keeper**:
The named Nomad at each Camp whose trust is earned by deeds — usually smashing the Machine Camp that threatens them — and whose story chapter carries one fragment of the world's true history.

**Sandstorm**:
A passing state of the open desert: wind-borne sand that amplifies whatever the Air Temperature already is, drinks the player's Water faster, and scours bare skin. Walls, shade and Caves ride it out; only the open air changes.
_Avoid_: dust storm, weather (there is nothing else)

**Blizzard**:
Silvaris' twin of the Sandstorm over the Alpine Peaks and the cold forest: driving snow that amplifies Cold exactly as sand amplifies heat, drinks Water and scours bare skin. Shelter and Storm Breakers ride it out the same way.

**Ashstorm**:
Silvaris' twin over the Scorch Belt: airborne ash that amplifies Heat and scours — the belt's double bite. A Storm Breaker calms any storm kind; the desert's Breakers were never kind-specific.

**Sandstorm Breaker**:
A humming red pylon block. Standing within its radius, the Sandstorm loses all teeth on the body: no amplification, no extra Water drain, no scouring. The Ship's hall holds a working one on a Phase 1 Start, and only its Husk on a Phase 0 Start; more are craftable at a Crafting Bench, and each new one extends the calm. A Breaker's calm is visible as a faint red dome and a "STORM BROKEN" chip. The housing only comes down for an Alloy Disassembler.
_Avoid_: windmill, storm lantern (it is not a light)

**Engine Core**:
The Ship's heart: a Grid machine that burns Rocket Fuel to drive the Thrusters. The first one is quest loot on Desertis — from Phase 2 on it is craftable at an Assembly Bench, so a player can raise more than one Ship. It shows **two physical canister slots**: a Rocket Fuel canister put in a slot banks fuel that burns until it is spent, and the slot then empties itself. The moment the engines draw on a slot, that canister is **locked** in — an untouched canister can be taken back out; a locked one belongs to the Ship until it is dry, and breaking the Core destroys it. A Super Rocket Fuel canister in a slot never burns: it waits there for Leave Planet.

**Cave**:
A hollow in the ground: tunnel networks and chambers dug through rock, entered at dark surface mouths in the rocky biomes. Deep Air Temperature barely moves with the sky — caves are a refuge at noon and a warmth at night. Without light underground there is only blackness.
_Avoid_: tunnel, hole, mine (as the natural hollow)

**Cave Pool**:
A rare standing Water Source deep underground: drinkable supply, paid for in danger and darkness.

**Cave Mouth**:
An opening into the Caves where the cave band carves all the way up through the crust — the natural way down, ringed by broken sandstone lips. Distinct from a Dungeon's built, sealed entrance.
_Avoid_: sinkhole, mine entrance

**Ore Vein**:
A visible seam of a Mineral embedded in cave stone. Mining a vein yields its Raw Ore.
_Avoid_: deposit (ambiguous with Cache)

**Iron Ore**:
The densest source of Iron; smelts at a Campfire into Iron Rod where surface Rock yields only one.
_Avoid_: iron (bare)

**Copper Ore**:
A reddish Mineral. Smelts into Copper Rod — never a tool by itself, always a component of higher things.
_Avoid_: bronze

**Alabaster**:
A pale Mineral stone, mined and worked whole: decorative and a component, not structural.

**Dungeon**:
A buried structure: a findable sealed entrance on the surface descending into procedurally generated rooms holding valuable loot — and enemies. One per Town lattice cell, deterministic per World Seed.
_Avoid_: cave nest (dungeons are built, not grown)

**Dust Scorpion**:
An armored cave predator, neutral until approached. Its Chitin and Stinger are crafting materials.

**Chitin**:
Dust Scorpion armor plates — component of tougher gear. Body armour that carries it shrugs off the Sandstorm too: storm terms bite at a quarter while worn.

**Stinger**:
A Dust Scorpion's barb — tips the deadliest weapons.

**Body Heat Regulator**:
Worn gear in its own Armour Slot that regulates the wearer's own Heat, not a Space: it pins the Body toward neutral while a Coolant Cell is spent. Unlike a Heat Regulator, it travels with you; unlike the Heat Regulator, it is not a block and never touches Air Temperature.
_Avoid_: heating vest, suit (it is a device, not clothing)

**Coolant Cell**:
A consumable that fuels a Body Heat Regulator for a stretch of game time; spent cells are gone, craft more.
_Avoid_: battery (it is thermal, not electric)

**Portable Light**:
A carried Lamp worn in its own Armour Slot, casting real light on whatever the player walks into; it burns fuel and must be refueled.

**Curved Hull Plating**:
Hull Plating shaped as an elbow or a slope rather than a cube — insulating exactly like Hull Plating, used to round the Ship's corners and spine.

**Stone Formation**:
Free-standing stone scenery: arches, leaning slabs, tall monoliths, and rubble clusters — each biome getting its own mix.
_Avoid_: boulder (the lone L-shaped lump it replaces)

**Cobalt Ore**:
A deep bluish Mineral, found only near the bottom of the underground — the material the Ship's repair hangs on.
_Avoid_: cobalt (bare)

**Titanium Ore**:
A light silvery Mineral of Silvaris' deep caves — the bones of its advanced machines, smelted at a Foundry into Titanium Rod.

**Graphite Ore**:
A soft black Mineral of Silvaris' middle caves — the catalyst a Fuel Works needs to raise Rocket Fuel into Super Rocket Fuel.

**Broken Thruster**:
One of the wreck's four dead wingtip engines. A Disassembler takes it off its pylon — it comes down as an item and can be stood back up anywhere. Its only interaction while dead is a Thruster Nozzle (E); a lit Thruster keeps burning when broken and re-placed.

**Armoury**:
A station block (2×2), crafted at the Crafting Bench from 4 Dead Wood and 2 Iron Rods. It is where everything that guards the body is forged: all armour, Backpacks, the Visor and the Body Heat Regulator. The Crafting Bench keeps everything else.
_Avoid_: forge (it is a bench, not a smithy), armory (spelling: British, like the rest)

**Thruster Nozzle**:
The replacement part that wakes a Broken Thruster: crafted from what the deep caves give up (Cobalt, Copper). Installing all four completes the Main Quest.

**Lift-off**:
Piloted takeoff at the Yoke: the Ship rises under its own power and completes the Phase-1 flight quest. Home now travels with the Ship — it may fly and land anywhere on its planet. Not the game's ending: that role belongs to **Leave Planet**.

**Super Rocket Fuel**:
a sealed blue canister — the key between worlds. In the Ship it never burns for flight: it sits inert in an Engine Core slot until **Leave Planet** consumes it. Phase 1 hands out exactly one as a quest reward. No recipe for it exists in the Catalog until the Sentinel dies — its dying broadcast is what teaches the fuel works, on both planets (Silvaris' Fuel Works, Desertis' Fuel Still — ADR-0015). Until then, the planet you left stays unreachable.
_Avoid_: blue fuel, warp fuel

**Leave Planet**:
the interplanetary jump: at the Yoke with a Super Rocket Fuel canister loaded in an Engine Core slot and real flight fuel still in the other, press the button — after a warning that spells out what is consumed, what travels, and what is left behind, the Ship climbs under its own power and arrives **docked** on a Settlement's Dock on the next planet. It consumes the one Super canister; everything aboard the Ship travels, everything on the ground does not. One departure per jump; return is Phase 3's promise.

**Sand Wurm**:
A rare, blind, segmented deep predator: slow, nearly unkillable by early gear, and usually best outrun. Its Hide is the warmest armour there is.

**Wurm Hide**:
Sand Wurm skin — thick, heat-tempered plating for the toughest Body gear.

**Wurmsuit**:
Body-slot armour stitched from Wurm Hide and Chitin; shrugs off most of every hit — less plate than a Cuirass-tier shell in exchange — and the Chitin layers keep the Sandstorm at a quarter strength against the wearer.

**Sand Vulture**:
A dark scavenger that soars the sky in slow banked circles, never walking the sand. It keeps its distance from the healthy and drops from the sky only at prey that is already hurt. Its meat is food once cooked.

**Thornback Tortoise**:
A slow, high-tempered grazer armored in a spiked dome; it neither hunts nor flees. Its Shell is heavy armour material, and Traders covet it.

**Tortoise Cuirass**:
Body armour of layered Thornback shell plates — the heaviest plate per blow short of nothing; lighter Chitin armour gives ground to it in exchange for Sandstorm resistance.

**Fennec Fox**:
A small, enormous-eared desert fox that outruns everything and fights nothing; its Pelt is soft, warm and prized in trade.
_Avoid_: fennec (bare, in prose)

**Snow Stalker**:
a lean pale predator of the Alpine Peaks and the cold forest — the only Silvaris animal that hunts the player. Its Frost Pelt is the warmest wearable leather.

**Tideback**:
a heavy placid coastal grazer of Silvaris' Shallows; it flees rather than fights, and yields Hide for trade.

**Brushbuck**:
a plain-dwelling Silvaris herd animal — the planet's main source of Meat and common Pelt.

**Frost Pelt**:
the Snow Stalker's pale fur — the cold-weather warmest of the pelts, and the Silvaris fur the Trader prizes.

**Head Lantern**:
The Portable Light worn in the Light slot: toggled at will, it burns fuel charges and must be refueled — the only way to carry a Cave's worth of darkness back out.

**Backpack**:
An upgrade worn in the Backpack slot, expanding the Inventory Grid. The bare Grid is 5×4; Backpack I grows it to 6×5, then the larger Backpack II to 7×6.

**Voidbreaker**:
A Cheat Menu tool that shatters any block on the spot — Tool tiers, break times and unbreakable blocks (even a Broken Thruster) all lose the argument. It has no recipe and exists only for play-mode mischief.

**Settings**:
Menu with units (Celsius/Fahrenheit), controls, and rendering options.

### Home and automation

**Base**:
a Sealed Space that holds at least one anchor — a Campfire, a Bed, a Storm Breaker, or a Power Panel. Only then does the desert call it home: muffled wind, warm light, a hearth that tends itself.
_Avoid_: home, shelter (as a mechanic), camp

**Phase**:
a stage of the game and one of the beginnings a world is made with, chosen at world creation and fixed for the run. **Phase 0 (Hard)**: the wreck is dead — only Husks of a Regulator and Storm Breaker; the stage is pure survival. **Phase 1 (Easy, recommended)**: a living Heat Regulator and Storm Breaker; the stage is fixing the Ship on Desertis. **Phase 2**: the world begins on Silvaris with the Ship already fixed and docked at a Settlement; the stage is using the Ship across one planet. **Phase 3** (unbuilt): interplanetary travel. Reaching a stage means finishing the previous one's Main Quest chain: Lift-off and Leave Planet close Phase 1; killing the Sentinel, refining your first own Super Rocket Fuel and making the charted final flight close Phase 2. Phase 0 and 1 are stripped of Bench and bunk; nothing else changes between Phases.
_Avoid_: easy/hard mode (nothing else changes), P1/P2/P3 milestones (retired)

**Husk**:
a dead wrecked fixture — a Regulator or Storm Breaker frozen mid-failure, teaching what might have been. Breaking it yields the broken thing; repairing it (about half a fresh build's parts) sets it working again.

**Electric Bench**:
the advanced workbench of the Grid: every power and machine part — Panel, Pole, generators, Battery, Inserter, Planter, Harvester, Chest, Chest Interface, Pump, Water Tower, Water Extractor, Refinery, Regulator, Storm Breaker, Lamp, Cooker — is built here, on every planet, and the plain Crafting Bench makes none of them. The Bench itself is a Crafting Bench recipe, cheap and early.

**Assembly Bench**:
the station of Ship-shape: assembles whole Engine Cores, Thruster Nozzles and Dock Pads from ingots, rods and glass.

**Fuel Works**:
the Silvaris fuel plant: presses Rocket Fuel into **Super Rocket Fuel** — a sealed Rocket Fuel Canister and Graphite Ore, nothing else. Its recipe is the Sentinel's death-gift (ADR-0015). Desertis' twin is the **Fuel Still**.

**Fuel Still**:
the Desertis fuel plant: Anthracite instead of Graphite; it only learns its recipe after the Sentinel dies. Built to give Desertis its own launch path for Phase 3.

**Anthracite**:
a hard black mineral of Desertis' deepest caves — the desert's carbon for Super Rocket Fuel.

**Charcoal**:
Desertis coal's Silvaris twin: native timber slow-burned at the Campfire twin — the carbon that raises Rocket Fuel with Silvaris oil.

**Flux**:
a Silvaris campfire compound of Lead and Saltpetre — the Body Regulator's answer to Desertis' Catalyst.

**Nav Core**:
the Ship's charting brain, craftable from the Keepers' final chapter onward — Titanium, Graphite, Lead and Scrap. Installed before the finale is fought: the player prepares for a killing they already know they must do. With it aboard, the charted final flight ends Phase 2.

**Hover Sled**:
the Silvaris vehicle: a built item you set down and board — battery-driven, recharged on a powered pad, and grown by bolted-on upgrades (Cargo Sled, Blade, Drill). The branch the main quest never walks. The block-built machine vehicle is Phase 3 territory.

**Slug**:
fired ammunition cast from that planet's own metal — the Gun Turret's appetite.

**Defenses**:
the player's engineered line, each with a per-planet recipe: **Spike Barricade** (passive wall that hurts climbers), **Alarm Chime** (wire-tapped radius sensor — the raid early-warning), **Gun Turret** (powered, eats Slugs, targets machines and hostile fauna, fauna-targeting toggleable), **Shock Coil** (powered ammo-free pulse, extra cruel to metal).
_Avoid_: traps (they are engineered, not dug)

**Foundry**:
the smelting floor beyond the Campfire: refines raw Ore into Metal Plating, melts Titanium Ore into Titanium Rod, and hardens Metal Plating and Coal into Steel Plating.

**Grid**:
a connected network of Power Poles and powered blocks under one Power Panel. No Panel, no power; when draw outstrips supply the Panel trips and the Grid goes dark until someone resets it.

**Power Panel**:
the Grid's mandatory supervisor — the box you visit to relight the world after a trip.
_Avoid_: breaker (reserved for the Sandstorm Breaker), fuse box, supervisor

**Power Pole**:
carries power to whatever stands within its reach, and links to Poles within twice that; higher tiers reach farther.

**Grid Relic**:
a derelict outstation of the Dwellers' power age, on the world's rarest lattice — an adobe shed with its Panel, Battery and Chest intact, a Solar Panel still on the roof, and a line of Poles running to a mast whose Electric Lamp has been burning for years. One of the few Grids in the desert still working; the Towns' own Grids are dead husks — cold lamps on street Poles, a Panel still in the market shell's wall.

**Inserter**:
a powered block that takes one item from the block in front of it and puts it into the block behind. The universal atom of automation — no filters, no reach.
_Avoid_: arm, conveyor (belts move things sideways; Inserters push between blocks)

**Planter**:
a powered block that sits under Farm Land, takes seed from the block beneath it, and plants the empty cell two cells up.

**Harvester**:
a powered block that reaps the ripe crop directly beneath it and spills the yield into the block directly above.

**Coals**:
the Campfire's banked fuel charges — fuel burns away going in, by hand or Inserter alike, and only the heat stays.
_Avoid_: Fuel Slot (the old grid of burning items is gone)

### Map and lessons

**Map**:
the panel the Surveyor's Visor draws while worn — local terrain, known Landmarks, Pins, and your own heading; maximised on demand.
_Avoid_: minimap, radar

**Landmark**:
a named feature the Map knows: Towns, Oases, Nomad Camps, Cave Mouths, wrecks, buried canister sites — and on Silvaris, Settlements, their Docks and Nomad Camps. A Landmark becomes known by reaching it, by the Tracker, or (canisters) by digging one up; known ones mark themselves on the Map. Every planet's Map knows only its own.

**Pin**:
a player-marked point planted by a craftable Surveyor's Pin, freely named. A Pin named "Base" is a marked point the Visor beams.

**Hidden Landmark Tracker**:
a one-use device: it finds the nearest never-known Landmark and marks it, then vanishes. It finds only what the world repeats — never the second wreck.
_Avoid_: compass (the Map's arrow is something else)

**Chronicle**:
the running lessons of the world — guided side goals and first-time discoveries that teach how its systems work. The current step rides under the main Quest in the HUD; the full log lives in the pause menu.
_Avoid_: tutorial (the guided first minutes), achievement

**Catalog**:
The handbook of every item and block, organised in alphabetical sections, its Recipes grouped by Crafting Station. Each entry cross-links every place it appears — recipes that make it, recipes that consume it, the block it places, what drops it — and the Catalog opens from the Inventory as well as from every Crafting Station.
_Avoid_: catalogue (the repo spelling is Catalog), wiki (see Codex)

**Codex**:
knowledge earned by holding a thing: the first time you carry or craft an item or block, its Catalog entry teaches itself. Unlearned entries stay locked.
_Avoid_: wiki, bestiary
