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
A settlement out in the world: huts, Supply Chests with rare loot, Beds, and the only source of Desert Wheat Seed. No living soul is home — yet.

**Dead Tree**:
A leafless tree scattered through the desert.

**Living Tree**:
A green tree with trunk, branches and a Leaf canopy, found at Oases and in Towns. It blocks sunlight from above and no one can walk through its parts. Chopping its trunk yields Wood Log.
_Avoid_: plant, bush

**Wood Farm**:
A player's own grove of Living Trees, grown from Tree Seeds in Dirt and kept growing by keeping moisture close.

**Tree Seed**:
Found in Town Supply Chests; planted in Dirt it grows a Living Tree stage by stage while moisture stays near.

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
A 2×1 block in every Town and a craftable comfort of one's own. Sleeping in a Bed passes 8 in-game hours no matter the hour, but only once per game day — and a game day is 24 real minutes.
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
the pair of markers on any Cache with items in it: a ground ring in the Cache's kind-colour (red for a Death Cache, gold for a Reward Cache) and, for Death Caches only, a red beam of light rising from the spot. Both go dark the moment the Cache runs dry.
_Avoid_: grave marker, beacon (reserved for the Save Beacon)

**Reward Cache**:
the Crash Pod form a quest reward takes: a warning, a marker where it will land, then a container holding exactly that reward. It empties when claimed and is marked like every Cache.

**Supply Chest**:
A craftable container block owning an Inventory Grid of its own — 3×3 each. Chests placed face-to-face are Linked Chests and share one Grid. The wreck's cockpit holds one, stocked with the first drinkable Water. Unlike a Death Cache, it accepts and keeps the player's goods.
_Avoid_: crate, locker

**Linked Chests**:
Chests touching face-to-face form one cluster with a single Grid: 3×3 per chest, growing sideways up to three wide, then taller — one extra row per further chest. Capacity is always 9 per chest. Breaking one chest shrinks the cluster; contents that no longer fit fall to the ground. The link is pure adjacency — break the chain and the grids split immediately, contents split with them (spilling when necessary).

**Chest Rail**:
A cheap connector that carries a chest link through itself: a Chest sits against a Rail links to the Chest on the Rail's far side, though the Rail itself stores nothing and is never opened.

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

**Hot Water Pouch**:
A full Water Canister heated at a lit Campfire — it costs the fire one fuel charge. Using it (Q) is a heat pulse: +10 °C toward body-warm, clamped at the top of the safe zone so it can never overshoot, and the empty canister comes back.
_Avoid_: canteen, thermos, heat pack (the wearable is the Hot Pad idea, dead)

**Campfire**:
A fuel-charged heat source. It glows and warms only while it has charges; an empty fire is cold charcoal — no light, no glow, no smelting. Feed it (E, holding fuel): a Wood Log adds 2 charges, Kindling half a charge. Charges decay over time; smelting and heating draw from them.
_Avoid_: bonfire, furnace

**Water Bucket**:
A carrying vessel for Water itself: it scoops from a Source and pours back as a Source, moving water rather than drinking it.
_Avoid_: pail, canteen

**Farming**:
Growing crops on Farmland where Air Temperature suits the species and Water is within reach. Growth follows Air Temperature, not sun or shade: the reason outdoor farming is dangerous is that the danger that costs you health is the same danger that costs you time.
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

**Inventory Grid**:
A rectangular grid of slots; items occupy footprints (Water Canister 1×2). Expandable via Backpacks. Every item instance claims its own cells — duplicates never share a slot, so more of something means more space taken.
_Avoid_: stacking, merging slots

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

**Weight Limit**:
How much mass the Inventory Grid may hold. Exceedable by at most 10% — while Overencumbered the player is incredibly slow and Water drains. Weight itself never affects Water or Heat except through Overencumbrance.

**Overencumbrance**:
The state of carrying above the Weight Limit (max +10%): incredibly slow, draining Water.

**Visor**:
Head-slot gear powering the player's HUD. Upgradeable to show more: heat fluctuations, marked points (the Ship, the player's Base). Upgrades count only while equipped.

**Waypoint**:
The HUD's guide to the active quest: a compass heading, a distance, and a marker at the target. A Surveyor's Visor equipped in the Head slot — a craftable Visor upgrade — additionally marks every Cache and Supply Chest through walls.

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
A station that breaks down crafted items (tools, gear — not placed blocks) into ~75% of their ingredients, always at least one unit of each.
_Avoid_: scrap bin

**Trader**:
A desert merchant who keeps a stall at a Trader Camp. Traders do not travel, do not fight, and cannot be killed — barter is the only exchange, and there is no coin anywhere in the desert.
_Avoid_: NPC (generic), merchant, vendor, wanderer (the abandoned Town-based idea)

**Trader Camp**:
A homestead on the trade roads — a windmill tower, a waystation hut, or a farmstead with a water trough — each kept by a single Trader and their stall.

**Trade Table**:
A Trader's offers: five straight goods-for-goods swaps per Camp, fixed for that Camp for the whole in-game day and reshuffled at every dawn.

**Sandstorm**:
A passing state of the open desert: wind-borne sand that amplifies whatever the Air Temperature already is, drinks the player's Water faster, and scours bare skin. Walls, shade and Caves ride it out; only the open air changes.
_Avoid_: dust storm, weather (there is nothing else)

**Sandstorm Breaker**:
A humming red pylon block. Standing within its radius, the Sandstorm loses all teeth on the body: no amplification, no extra Water drain, no scouring. The wreck holds one still-working pylon in its hall; more are craftable at a Crafting Bench, and each new one extends the calm. A Breaker's calm is visible as a faint red dome and a "STORM BROKEN" chip.
_Avoid_: windmill, storm lantern (it is not a light)

**Engine Core**:
The single quest-exclusive item — the final quest artifact. Everything else in the game is eventually craftable.

**Cave**:
A hollow in the ground: tunnel networks and chambers dug through rock, entered at dark surface mouths in the rocky biomes. Deep Air Temperature barely moves with the sky — caves are a refuge at noon and a warmth at night. Without light underground there is only blackness.
_Avoid_: tunnel, hole, mine (as the natural hollow)

**Cave Pool**:
A rare standing Water Source deep underground: drinkable supply, paid for in danger and darkness.

**Cave Mouth**:
An arched opening into the Caves, gaping in the side of a rocky slope — the natural way down. Distinct from a Dungeon's built, sealed entrance.
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

**Broken Thruster**:
One of the wreck's four dead wingtip engines. A Disassembler takes it off its pylon — it comes down as an item and can be stood back up anywhere. Its only interaction while dead is a Thruster Nozzle (E); a lit Thruster keeps burning when broken and re-placed.

**Armoury**:
A station block (2×2), crafted at the Crafting Bench from 4 Dead Wood and 2 Iron Rods. It is where everything that guards the body is forged: all armour, Backpacks, the Visor and the Body Heat Regulator. The Crafting Bench keeps everything else.
_Avoid_: forge (it is a bench, not a smithy), armory (spelling: British, like the rest)

**Thruster Nozzle**:
The replacement part that wakes a Broken Thruster: crafted from what the deep caves give up (Cobalt, Copper). Installing all four completes the Main Quest.

**Lift-off**:
The ending: with every Thruster woken, the Ship takes off. The player may then continue on the ground where it lands again — the sky, and what is up there, stays for later.

**Sand Wurm**:
A rare, blind, segmented deep predator: slow, nearly unkillable by early gear, and usually best outrun. Its Hide is the warmest armour there is.

**Wurm Hide**:
Sand Wurm skin — thick, heat-tempered plating for the toughest Body gear.

**Wurmsuit**:
Body-slot armour stitched from Wurm Hide and Chitin; shrugs off most of every hit — less plate than a Cuirass-tier shell in exchange — and the Chitin layers keep the Sandstorm at a quarter strength against the wearer.

**Sand Vulture**:
A bold scavenger that follows misfortune: it keeps its distance from the healthy and dives only at prey that is already hurt. Its meat is food once cooked.

**Thornback Tortoise**:
A slow, high-tempered grazer armored in a spiked dome; it neither hunts nor flees. Its Shell is heavy armour material, and Traders covet it.

**Tortoise Cuirass**:
Body armour of layered Thornback shell plates — the heaviest plate per blow short of nothing; lighter Chitin armour gives ground to it in exchange for Sandstorm resistance.

**Fennec Fox**:
A small, enormous-eared desert fox that outruns everything and fights nothing; its Pelt is soft, warm and prized in trade.
_Avoid_: fennec (bare, in prose)

**Head Lantern**:
The Portable Light worn in the Light slot: toggled at will, it burns fuel charges and must be refueled — the only way to carry a Cave's worth of darkness back out.

**Backpack**:
An upgrade worn in the Backpack slot, expanding the Inventory Grid and/or raising the Weight Limit. (Backpack I, then the larger Backpack II.)

**Voidbreaker**:
A Cheat Menu tool that shatters any block on the spot — Tool tiers, break times and unbreakable blocks (even a Broken Thruster) all lose the argument. It has no recipe and exists only for play-mode mischief.

**Settings**:
Menu with units (Celsius/Fahrenheit), controls, and rendering options.
