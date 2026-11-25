import {
  SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS, HULL,
  DOOR_CLOSED, DOOR_UPPER, LAMP, BEACON, BENCH, CAMPFIRE, ADOBE, ENGINECORE, REGULATOR, CHEST, CACTUS,
  FARMLAND, MELON_1, MELON_2, WHEAT_1, WHEAT_2, CACTUS_FRUIT, CHEST_CONNECTOR, CHEST_INTERFACE, METAL_PLATING,
  DOOR_INNER, DOOR_INNER_UPPER, BED, BED_EXT, GRASS, LEAVES, WOOD, SAPLING,
  CURVED_HULL, HULL_SLOPE, IRON_ORE, COPPER_ORE, ALABASTER, COBALT_ORE, COAL_ORE, STORM_BREAKER, THRUSTER, THRUSTER_LIT, ARMORY,
  REGULATOR_HUSK, STORM_BREAKER_HUSK,
  POWER_PANEL, POWER_POLE, GEN_WOOD, WIND_TURBINE, SOLAR_PANEL, BATTERY, ELEC_LAMP,
  INSERTER, PLANTER, HARVESTER, REFINERY,
  ALAB_BRICK, ALAB_POLISHED, ALAB_CHISELLED, ALAB_PILLAR, ALAB_FENCE, ALAB_GATE, ALAB_DOOR,
  ALAB_DOOR_UPPER, ALAB_GATE_OPEN,
  COOKPOT, WATER_CAGE, SUGARCANE_1, APPLE_SAPLING, APPLE_FRUIT, WATER_CAGE_FULL, SUGARCANE_2,
  FRAME_CORNER, FLIGHT_CONTROLS,
  ELECTRIC_BENCH, ASSEMBLY_BENCH, FUEL_WORKS, FOUNDRY, INSCRIPTION, DOCK_PAD,
  TITANIUM_ORE, GRAPHITE_ORE, TUNDROOT_1, TUNDROOT_2, EMBERBUSH_1, EMBERBUSH_2, EMBER_FRUIT,
  RECYCLER, SIL_RECYCLER, HEARTH, WORKBENCH, TANNERY, CAULDRON, OIL_WORKS, WIRING_BENCH, FUEL_STILL,
  ANTHRACITE_ORE, LEAD_ORE, SALTPETRE_ORE, SIL_WOOD, SIL_LEAVES, SIL_SAPLING, OAT_1, OAT_2,
  SPIKE_BARRICADE, ALARM_CHIME, GUN_TURRET, SHOCK_COIL, NAV_CORE, HOVER_SLED,
  WOOD_POST, WOOD_RAILING, STAINED_GLASS, TABLE, BASALT, SNOW,
} from "./blocks";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  w: number; h: number;      // Inventory Grid footprint (every instance claims its own cells)
  mass: number;              // kg
  block?: number;            // block it places
  tool?: { type: "pickaxe" | "shovel" | "axe" | "disassembler"; tier: number };
  weapon?: { reach: number; dmg: number };   // swings reach farther and hit harder than fists/tools
  skin?: number;   // Skinning Knife: skinning a carcass yields this many hides (higher tier = faster)
  harpoon?: boolean; // the only weapon that brings down a Tideback
  eat?: { water?: number; health?: number };  // eating applies these to the player
  equip?: "backpack" | "head" | "body" | "regulator" | "light"; // goes in that Armour Slot
  bag?: { w: number; h: number }; // Backpack-slot gear: grid size
  armor?: number; // Body-slot gear: fraction of every damage shrugged off
  stormResist?: boolean; // Body-slot gear wearing Chitin: Sandstorm terms bite at a quarter
  fuel?: number;             // max fuel charges (Head Lantern)
  sack?: number;             // Sack: capacity in footprint units; one item type inside (ADR-0008)
  instaBreak?: boolean;      // Voidbreaker: every block shatters on the first swing frame
  color: string;             // icon color
}

const I = (d: ItemDef) => d;

const TOOL_DESC = (t: string, tier: number) =>
  `${t.charAt(0).toUpperCase() + t.slice(1)} (tier ${tier}). Higher tiers break faster and unlock harder blocks.`;

const toolItem = (type: "pickaxe" | "shovel" | "axe" | "disassembler", tier: number, mat: string, color: string) =>
  I({
    id: `${mat}_${type}`, name: `${mat.charAt(0).toUpperCase() + mat.slice(1)} ${type}`,
    desc: TOOL_DESC(type, tier), w: 1, h: 2, mass: 1.2 + tier * 0.8,
    tool: { type, tier }, color,
  });

const ITEM_LIST: ItemDef[] = [
  I({ id: "sand", name: "Sand", desc: "Loose desert sand. Smelt it for glass.", w: 1, h: 1, mass: 0.4, block: SAND, color: "#d4b880" }),
  I({ id: "sandstone", name: "Sandstone", desc: "Compacted sand. Decent building stone.", w: 1, h: 1, mass: 0.8, block: SANDSTONE, color: "#c2a670" }),
  I({ id: "rock", name: "Rock", desc: "Hard desert rock. Needs a pickaxe.", w: 1, h: 1, mass: 1.0, block: ROCK, color: "#736d69" }),
  I({ id: "gravel", name: "Gravel", desc: "Loose stones.", w: 1, h: 1, mass: 0.5, block: GRAVEL, color: "#8d8680" }),
  I({ id: "dirt", name: "Dirt", desc: "Dry desert soil.", w: 1, h: 1, mass: 0.5, block: DIRT, color: "#6b5238" }),
  I({ id: "salt", name: "Salt", desc: "Crust from the salt flats. Bitter, useful.", w: 1, h: 1, mass: 0.4, block: SALT, color: "#d9dbd6" }),
  I({ id: "deadwood", name: "Dead Wood", desc: "Bone-dry wood from a dead tree. Fuel and tools.", w: 1, h: 1, mass: 0.4, block: DEADWOOD, color: "#61492f" }),
  I({ id: "glass", name: "Glass", desc: "Lets light in and heat through. Caution.", w: 1, h: 1, mass: 0.6, block: GLASS, color: "#a6cfe6" }),
  I({ id: "insglass", name: "Insulating Glass", desc: "Transparent, and heat cannot pass. The wreck's cockpit is made of it. Craftable with a Catalyst.", w: 1, h: 1, mass: 0.9, block: INSGLASS, color: "#8cc0a0" }),
  I({ id: "hull", name: "Hull Plating", desc: "The ship's insulating wall block. Your best shelter material.", w: 1, h: 1, mass: 2.0, block: HULL, color: "#858a99" }),
  I({ id: "door", name: "Door", desc: "Insulates exactly like hull plating while closed. Open it and the shelter leaks.", w: 1, h: 2, mass: 3.0, block: DOOR_CLOSED, color: "#999fa8" }),
  I({ id: "lamp", name: "Lamp", desc: "Glows in the dark.", w: 1, h: 1, mass: 0.5, block: LAMP, color: "#fff0a0" }),
  I({ id: "metal", name: "Iron Rod", desc: "Forged iron — salvaged from the wreck, or baked from Rock and Iron Ore at a Campfire. The backbone of every tool, never a block to place.", w: 1, h: 1, mass: 1.0, color: "#9aa0aa" }),
  I({ id: "beacon", name: "Save Beacon", desc: "Place to permanently save. Death respawns at the newest intact beacon; beacons can never be picked back up.", w: 1, h: 2, mass: 4.0, block: BEACON, color: "#66e5f0" }),
  I({ id: "bench", name: "Crafting Bench", desc: "Unlocks the full crafting list. Stands two blocks wide in the world.", w: 1, h: 2, mass: 6.0, block: BENCH, color: "#806647" }),
  I({ id: "campfire", name: "Campfire", desc: "Burns wood. Smelts sand into glass.", w: 1, h: 2, mass: 3.0, block: CAMPFIRE, color: "#e67333" }),
  I({ id: "regulator", name: "Heat Regulator", desc: "Holds a sealed room at comfortable body temperature — 100 open cells per Regulator, capacity stacks. Sealed means sealed — an open door disables it.", w: 1, h: 1, mass: 2.5, block: REGULATOR, color: "#59bfcc" }),
  // Hard Start's wreck machinery burns out as Husks; breaking one yields this
  // frame, and a Bench repair (about half the normal recipe) makes it live again.
  I({ id: "regulator_broken", name: "Broken Heat Regulator", desc: "The gutted shell of a Heat Regulator. Repair it at a Crafting Bench — 2 Iron Rods, 1 Glass, 1 Salt — and it breathes neutral air again.", w: 1, h: 1, mass: 2.0, color: "#78868a" }),
  I({ id: "adobe", name: "Adobe Brick", desc: "Baked town mud. Warm, solid.", w: 1, h: 1, mass: 0.9, block: ADOBE, color: "#b3956b" }),
  I({ id: "chest", name: "Chest", desc: "Stores gear in its own grid. Chests placed touching (orthogonally) merge into one bigger grid — 3×3 each, up to 3 wide, then taller.", w: 1, h: 1, mass: 5.0, block: CHEST, color: "#8a6d3b" }),
  I({ id: "canister_full", name: "Water Canister (full)", desc: "Drink to restore 25% Water. Refill at oases or the ship's water station.", w: 1, h: 2, mass: 1.0, color: "#3f8fe0" }),
  I({ id: "canister_empty", name: "Water Canister (empty)", desc: "Lighter until you find water.", w: 1, h: 1, mass: 0.3, color: "#7fa8cc" }),
  I({ id: "catalyst", name: "Catalyst", desc: "Rare alien chemistry. Found in Towns and the second wreck. Needed for Insulating Glass (M2 craft chain).", w: 1, h: 1, mass: 0.3, color: "#c07fe0" }),
  I({ id: "engine_core", name: "Engine Core", desc: "The heart of the flying Ship. Stand it up inside the Ship Frame and the engines have something to burn fuel in. Build one at an Assembly Bench, or take the wreck's.", w: 1, h: 1, mass: 6.0, block: ENGINECORE, color: "#c468e8" }),
  I({ id: "visor", name: "Surveyor's Visor", desc: "A Visor upgrade. Equipped in the Head slot, the HUD marks every Death Cache, Reward Cache and Chest through walls with a beam.", w: 1, h: 1, mass: 0.8, equip: "head", color: "#66e5f0" }),
  toolItem("pickaxe", 1, "wood", "#a8834f"), toolItem("pickaxe", 2, "stone", "#8d8680"), toolItem("pickaxe", 3, "metal", "#9aa0aa"),
  toolItem("shovel", 1, "wood", "#a8834f"), toolItem("shovel", 2, "stone", "#8d8680"), toolItem("shovel", 3, "metal", "#9aa0aa"),
  toolItem("axe", 1, "wood", "#a8834f"), toolItem("axe", 2, "stone", "#8d8680"), toolItem("axe", 3, "metal", "#9aa0aa"),
  toolItem("pickaxe", 4, "alloy", "#c07848"), toolItem("shovel", 4, "alloy", "#c07848"), toolItem("axe", 4, "alloy", "#c07848"),
  toolItem("disassembler", 1, "metal", "#c0c8d8"),
  toolItem("disassembler", 2, "alloy", "#c07848"),
  I({ id: "voidbreaker", name: "Voidbreaker", desc: "Cheat gear: every block — even Ship Hull and bedrock-hard stuff — shatters the instant you swing. There is no recipe: it only comes out of the cheat menu.", w: 1, h: 2, mass: 2.0, instaBreak: true, color: "#8a5ad6" }),
  I({
    id: "sword", name: "Metal Sword",
    desc: "A forged blade. Hits Desert Snakes and rats far harder than any tool, and reaches farther.",
    w: 1, h: 2, mass: 2.2, weapon: { reach: 4.6, dmg: 7 }, color: "#c9d2dc",
  }),
  I({ id: "backpack1", name: "Backpack I", desc: "Equipped in the Backpack slot: inventory grid grows to 6×5.", w: 2, h: 2, mass: 2.0, equip: "backpack", bag: { w: 6, h: 5 }, color: "#7a5a3a" }),
  I({ id: "cactus", name: "Cactus", desc: "Tall desert column. Replantable anywhere on sand or farm land; with water it fruits on its own. Break a fruit-topped one for the Prickly Pear.", w: 1, h: 2, mass: 1.5, block: CACTUS, color: "#3d8042" }),
  I({ id: "prickly_pear", name: "Prickly Pear", desc: "Cactus fruit. Eat it: +8 Water, +1 Health.", w: 1, h: 1, mass: 0.2, eat: { water: 8, health: 1 }, color: "#d64a82" }),
  I({ id: "snake_skin", name: "Snake Skin", desc: "Tough desert hide. Three of them stitch into Reptile Armour at a Crafting Bench.", w: 1, h: 2, mass: 0.6, color: "#b3946a" }),
  I({ id: "reptile_armor", name: "Reptile Armour", desc: "Equipped in the Body slot: scales shrug off 40% of all damage.", w: 2, h: 2, mass: 3.0, equip: "body", armor: 0.4, color: "#8a6f4d" }),
  I({ id: "rat_raw", name: "Kangaroo Rat (raw)", desc: "Raw meat. Cook it at a Campfire before eating.", w: 1, h: 1, mass: 0.8, color: "#a86a5a" }),
  I({ id: "rat_cooked", name: "Cooked Rat", desc: "Roasted meat. Eat it: +25 Health.", w: 1, h: 1, mass: 0.7, eat: { health: 25 }, color: "#c07a3a" }),
  // ---- farming ----
  I({ id: "farmland", name: "Farm Land", desc: "Tilled ground. Melon and Wheat seeds must be planted on it; Cactus accepts sand too.", w: 1, h: 1, mass: 1, block: FARMLAND, color: "#573d23" }),
  I({ id: "seed_melon", name: "Melon Seed", desc: "Plant on Farm Land within 10 blocks of water. Loves heat (22-45 C air); stalls in the cold.", w: 1, h: 1, mass: 0.1, block: MELON_1, color: "#c8b060" }),
  I({ id: "seed_wheat", name: "Wheat Seed", desc: "Plant on Farm Land within 6 blocks of water. Comfortable across 2-42 C — the one crop that does not mind the heat.", w: 1, h: 1, mass: 0.1, block: WHEAT_1, color: "#d8c878" }),
  I({ id: "dune_melon", name: "Dune Melon", desc: "Harvested from a ripe Melon. Eat it: +30 Water, +5 Health.", w: 2, h: 1, mass: 2, eat: { water: 30, health: 5 }, color: "#7a9a3a" }),
  I({ id: "wheat", name: "Desert Wheat", desc: "Cut from ripe Wheat. Too tough raw - bake it at a Cooking Pot into Bread.", w: 1, h: 1, mass: 0.2, color: "#d8b048" }),
  I({ id: "bread", name: "Bread", desc: "Wheat baked at a Cooking Pot. Plain but dense. Eat it: +35 Health.", w: 1, h: 1, mass: 0.2, eat: { health: 35 }, color: "#b8853a" }),
  I({ id: "stew", name: "Stew", desc: "Fruit, Wheat and meat simmered in a full Canister at a Cooking Pot. The Canister comes back empty. Eat it: +25 Water, +35 Health.", w: 1, h: 2, mass: 1.2, eat: { water: 25, health: 35 }, color: "#a86a30" }),
  I({ id: "fruit_salad", name: "Fruit Salad", desc: "Two Fruits and a full Canister chopped together at a Cooking Pot - no fire touched. The Canister comes back empty. Eat it: +15 Water, +10 Health.", w: 1, h: 1, mass: 0.6, eat: { water: 15, health: 10 }, color: "#c47ab0" }),
  I({ id: "apple_pie", name: "Apple Pie", desc: "Apples, Wheat and Sugar baked at a Cooking Pot. Eat it: +45 Health.", w: 2, h: 1, mass: 0.8, eat: { health: 45 }, color: "#c78a4a" }),
  // ---- trees ----
  I({ id: "wood_log", name: "Wood Log", desc: "Trunk of a Living Tree - the renewable counterpart of Dead Wood. Fuel and crafting.", w: 1, h: 1, mass: 0.5, block: WOOD, color: "#7a5c3a" }),
  I({ id: "kindling", name: "Kindling", desc: "Leaf scraps. Campfire fuel that burns fast and small.", w: 1, h: 1, mass: 0.1, color: "#9a8a5a" }),
  I({ id: "seed_tree", name: "Tree Seed", desc: "Plant in Dirt. Grows a Living Tree stage by stage over ~8 minutes while water stays within 10 blocks. Found in Town chests and from broken Leaves.", w: 1, h: 1, mass: 0.1, block: SAPLING, color: "#7fae54" }),
  // ---- water carrying ----
  I({ id: "bucket", name: "Bucket", desc: "Scoop a water Source with it, pour it back anywhere: moves water instead of drinking it.", w: 1, h: 1, mass: 1.0, color: "#9aa0aa" }),
  I({ id: "bucket_full", name: "Bucket (full)", desc: "Water to pour. Right-click ground to place it as a new Source.", w: 1, h: 1, mass: 3.0, color: "#3f8fe0" }),
  I({ id: "water_cage", name: "Water Cage", desc: "A closed vessel for one Source: solid, never flowing, yet Water to every crop and tree that reaches it. Fill it with a full Bucket (E), scoop it out with an empty one; breaking it drops the Cage and lets the Water run free.", w: 1, h: 1, mass: 2.0, block: WATER_CAGE, color: "#8fa4b4" }),
  I({ id: "cooking_pot", name: "Cooking Pot", desc: "The kitchen station. Keeps Coals like a Campfire, but the recipe decides whether the fire is touched at all — a Stew spends charges, a Fruit Salad needs no heat.", w: 1, h: 2, mass: 4.0, block: COOKPOT, color: "#c86a38" }),
  I({ id: "apple", name: "Apple", desc: "Picked from an Apple Tree. Eating it leaves an Apple Pip in hand two times out of three. Eat it: +6 Water, +4 Health.", w: 1, h: 1, mass: 0.2, eat: { water: 6, health: 4 }, color: "#c03434" }),
  I({ id: "apple_pip", name: "Apple Pip", desc: "Plant it in Dirt. Grows an Apple Tree stage by stage over ~8 minutes while water stays within 10 blocks; a full-grown tree bears Apples, and picked spots re-ripen.", w: 1, h: 1, mass: 0.05, block: APPLE_SAPLING, color: "#8a6b3f" }),
  I({ id: "sugar_cane", name: "Sugar Cane", desc: "Cut from ripe Sugar Cane - it only grows with Water within 2 blocks. Refine it into Sugar at a Cooking Pot.", w: 1, h: 1, mass: 0.3, block: SUGARCANE_1, color: "#5c8f3a" }),
  I({ id: "sugar", name: "Sugar", desc: "Sugar Cane boiled down at a Cooking Pot. The sweetening in an Apple Tart.", w: 1, h: 1, mass: 0.2, color: "#e8e2d0" }),
  // ---- building ----
  I({ id: "chest_connector", name: "Chest Connector", desc: "Steel rail between Chests: links their grids into one bigger Inventory Grid. Stores nothing itself.", w: 1, h: 1, mass: 1, block: CHEST_CONNECTOR, color: "#8a744a" }),
  I({ id: "chest_interface", name: "Chest Interface", desc: "A door onto a Chest cluster: it links the Chests like a Connector rail, but adds no grid space of its own and stores nothing. Stand at it and press E for a list of everything the cluster holds — take items one by one, or stow what you hold. Inserters and generators can work through it.", w: 1, h: 1, mass: 2, block: CHEST_INTERFACE, color: "#6f7f95" }),
  I({ id: "metal_plating", name: "Metal Plating", desc: "The ship's plated floor and skin. Same plate, same tools - disassemble it back.", w: 1, h: 1, mass: 1.2, block: METAL_PLATING, color: "#9aa0ac" }),
  I({ id: "storm_breaker", name: "Sandstorm Breaker", desc: "A humming red pylon. Stand within 8 blocks of one and the Sandstorm loses all teeth — no scorching, no wind-thirst, no sand blast.", w: 1, h: 1, mass: 4.0, block: STORM_BREAKER, color: "#c04838" }),
  I({ id: "storm_breaker_broken", name: "Broken Sandstorm Breaker", desc: "The dead pylon's frame. Repair it at a Crafting Bench — 1 Iron Rod, 1 Glass — and the calm hums again.", w: 1, h: 1, mass: 3.0, color: "#8a6158" }),
  I({ id: "door_inner", name: "Inside Door", desc: "Interior bulkhead door. It divides rooms for sight and movement - and never insulates: in temperature terms it is just air, open or closed.", w: 1, h: 1, mass: 2, block: DOOR_INNER, color: "#82868e" }),
  I({ id: "bed", name: "Bed", desc: "Curtained sleep for 8 game hours, then the cool morning. One long sleep every 8 hours; press E at the bed. Takes a 2x1 floor span.", w: 2, h: 1, mass: 6, block: BED, color: "#a84a42" }),
  // ---- underground: minerals ----
  I({ id: "iron_ore", name: "Iron Ore", desc: "Dense ore from Cave walls. Smelt it at a Campfire: one ore bakes two Iron Rods.", w: 1, h: 1, mass: 1.6, block: IRON_ORE, color: "#9e8468" }),
  I({ id: "coal_ore", name: "Coal Ore", desc: "A seam of black carbon from the Cave walls. Feed it to a Campfire: one ore banks six charges of hot, steady burn.", w: 1, h: 1, mass: 1.6, block: COAL_ORE, color: "#3a3734" }),
  I({ id: "copper_ore", name: "Copper Ore", desc: "Reddened Cave stone. Smelts into Copper Rods - the heart of tier-4 Alloy gear.", w: 1, h: 1, mass: 1.6, block: COPPER_ORE, color: "#b86b42" }),
  I({ id: "alabaster", name: "Alabaster", desc: "Pale Cave stone. Cuts soft, decorates well, and takes a Lamp's light like nothing else. Placeable as-is — the Bench cuts it into prettier shapes.", w: 1, h: 1, mass: 1.2, block: ALABASTER, color: "#dcd5bd" }),
  // ---- Alabaster masonry: bench-cut building kit, no catalyst ----
  I({ id: "alab_bricks", name: "Alabaster Bricks", desc: "Cut and laid stone — the warm white wall of a Cave-base home.", w: 1, h: 1, mass: 1.0, block: ALAB_BRICK, color: "#e0dac4" }),
  I({ id: "alab_polished", name: "Polished Alabaster", desc: "Ground smooth until it drinks lamplight. Interior walls, floors, a mesa top for a trophy.", w: 1, h: 1, mass: 1.0, block: ALAB_POLISHED, color: "#eae4d0" }),
  I({ id: "alab_chiselled", name: "Chiselled Alabaster", desc: "Two bricks worked down to one pane of recessed panels — decorative masonry with shadows in it.", w: 1, h: 1, mass: 1.0, block: ALAB_CHISELLED, color: "#ddd6c0" }),
  I({ id: "alab_pillar", name: "Alabaster Pillar", desc: "A slim fluted column: a doorway's worth of stone, a porch's worth of style. You can stand right up against its edges.", w: 1, h: 1, mass: 1.6, block: ALAB_PILLAR, color: "#e7e1cd" }),
  I({ id: "alab_fence", name: "Alabaster Fence", desc: "Post and rails, 1.5 blocks tall, auto-linking to every Fence and Gate beside it. A clean barrier — you can lean into it but never hop it. Keep the critters out.", w: 1, h: 1, mass: 0.8, block: ALAB_FENCE, color: "#e0d9c3" }),
  I({ id: "alab_gate", name: "Alabaster Fence Gate", desc: "A fence section that swings: E opens it, E closes it, and it stays as you left it. Turn its axis with R before placing.", w: 1, h: 1, mass: 1.0, block: ALAB_GATE, color: "#ddd6bf" }),
  I({ id: "alab_door", name: "Alabaster Door", desc: "A stone door leaf hung in a two-block frame: E opens and closes it like any other door.", w: 1, h: 1, mass: 2.4, block: ALAB_DOOR, color: "#e3dcc7" }),
  I({ id: "cobalt_ore", name: "Cobalt Ore", desc: "Bluish ore of the deepest stone (Metal Pickaxe or better). The Ship's repair hangs on it.", w: 1, h: 1, mass: 2.2, block: COBALT_ORE, color: "#5c74a8" }),
  I({ id: "copperrod", name: "Copper Rod", desc: "Smelted from Copper Ore. Never a tool by itself - always a component of better things.", w: 1, h: 1, mass: 1.0, color: "#c07848" }),
  I({ id: "cobaltrod", name: "Cobalt Rod", desc: "Smelted from Cobalt Ore, found only in the deep underground. One Thruster Nozzle needs one.", w: 1, h: 1, mass: 1.4, color: "#6a84bc" }),
  // ---- gear: slots ----
  I({ id: "backpack2", name: "Backpack II", desc: "The big pack: inventory grid grows to 7×6. Reptile-hide stitching.", w: 3, h: 2, mass: 3.5, equip: "backpack", bag: { w: 7, h: 6 }, color: "#6a4c30" }),
  I({ id: "body_regulator", name: "Body Heat Regulator", desc: "Worn in the Regulator slot: pins your Heat toward neutral while a Coolant Cell lasts. It regulates you - never a room.", w: 2, h: 2, mass: 3.0, equip: "regulator", color: "#4fa8c8" }),
  I({ id: "coolant_cell", name: "Coolant Cell", desc: "Consumable fuel for the Body Heat Regulator: one cell carries about 2 game days of regulation. Spent cells are gone.", w: 1, h: 1, mass: 0.8, color: "#7fd4e8" }),
  I({ id: "head_lantern", name: "Head Lantern", desc: "The Portable Light: worn in the Light slot, toggled with T. Burns fuel charges (5 max) - refill at a Campfire or load Kindling.", w: 1, h: 1, mass: 1.0, equip: "light", fuel: 5, color: "#ffd76a" }),
  // ---- hunting the deep ----
  I({ id: "chitin", name: "Chitin", desc: "Dust Scorpion armor plate. Tough, thin, and very hard to burn.", w: 1, h: 1, mass: 0.3, color: "#6a4a3a" }),
  I({ id: "stinger", name: "Stinger", desc: "A Dust Scorpion's barb. Tipped onto a blade, it makes the deadliest weapon in the desert.", w: 1, h: 1, mass: 0.2, color: "#a84a3a" }),
  I({ id: "wurm_hide", name: "Wurm Hide", desc: "Sand Wurm skin - heat-tempered plating for the toughest Body gear.", w: 1, h: 2, mass: 1.2, color: "#8a6a48" }),
  I({ id: "vulture_raw", name: "Vulture Fillet (raw)", desc: "Raw meat off a Sand Vulture. Cook it at a Campfire before eating.", w: 1, h: 1, mass: 0.7, color: "#7a5a4a" }),
  I({ id: "vulture_cooked", name: "Roasted Fillet", desc: "Cooked Vulture meat. Eat it: +25 Health.", w: 1, h: 1, mass: 0.6, eat: { health: 25 }, color: "#b0764a" }),
  I({ id: "tortoise_shell", name: "Thornback Shell", desc: "The spiked dome of a Thornback Tortoise. Three plate a Cuirass; Nomads always want them.", w: 2, h: 2, mass: 6.0, color: "#5f5a4e" }),
  I({ id: "fennec_pelt", name: "Fennec Pelt", desc: "Soft pale fur off a Fennec Fox. Worth a real price at any Nomad camp.", w: 1, h: 2, mass: 0.5, color: "#c99a62" }),
  I({ id: "tortoise_cuirass", name: "Thornback Cuirass", desc: "Body-slot breastplate of layered Shell and Metal: shrugs off 48% of every blow. Heavy going.", w: 2, h: 2, mass: 9.0, equip: "body", armor: 0.48, color: "#6a6255" }),
  I({ id: "wurmsuit", name: "Wurmsuit", desc: "Body-slot armour of Wurm Hide and Chitin: shrugs off 45% of every blow, and the Chitin turns the Sandstorm aside — blast and wind-thirst bite at a quarter. Warmer against the cold night too.", w: 2, h: 2, mass: 5.0, equip: "body", armor: 0.45, stormResist: true, color: "#7a5c40" }),
  I({ id: "stinger_blade", name: "Stinger Blade", desc: "A Metal Sword tipped with a Scorpion Stinger: hits harder and farther than anything above ground.", w: 1, h: 2, mass: 2.4, weapon: { reach: 5.2, dmg: 12 }, color: "#c9b048" }),
  // ---- the Ship's wings ----
  I({ id: "curved_hull", name: "Curved Hull Plating", desc: "Hull Plating shaped as an elbow - insulates exactly like flat plating, and rounds any corner you build.", w: 1, h: 1, mass: 2.0, block: CURVED_HULL, color: "#7d8390" }),
  I({ id: "hull_slope", name: "Hull Slope", desc: "A beveled hull block for spines, roofs and shoulders. Same insulation, rounder silhouette.", w: 1, h: 1, mass: 2.0, block: HULL_SLOPE, color: "#767d88" }),
  // ---- Grid power: Poles carry it, the Panel guards it (ADR-0007) ----
  I({ id: "power_pole", name: "Power Pole", desc: "Carries the Grid: links to other Poles within 16 blocks and feeds anything powered within 10.", w: 1, h: 1, mass: 2.0, block: POWER_POLE, color: "#8a7455" }),
  I({ id: "power_panel", name: "Power Panel", desc: "The heart of a Grid — exactly one per Pole network. When draw outruns supply it trips and the whole Grid goes dark until you press E to reset it.", w: 1, h: 1, mass: 4.0, block: POWER_PANEL, color: "#586270" }),
  I({ id: "gen_wood", name: "Wood Generator", desc: "Steady 4 units, day and night. Press E for its panel: drag Wood Logs (+30 s) or Dead Wood (+6 s) onto the Fuel Charges box and it burns what you banked first — only when the bank runs dry does it feed itself from a Chest standing right beside it.", w: 1, h: 1, mass: 6.0, block: GEN_WOOD, color: "#755540" }),
  I({ id: "wind_turbine", name: "Wind Turbine", desc: "Up to 8 units, scaling with the Sandstorm — the storm that punishes you powers the base. Needs open sky above.", w: 1, h: 1, mass: 5.0, block: WIND_TURBINE, color: "#b3b3bc" }),
  I({ id: "solar_panel", name: "Solar Panel", desc: "Up to 4 units in direct sun; roofs and Sandstorms cut it hard. Dead silent at night.", w: 1, h: 1, mass: 4.0, block: SOLAR_PANEL, color: "#33405f" }),
  I({ id: "battery", name: "Battery", desc: "Stores 120 units of the Grid. Sips surplus by day, hands it back when generation falls short — until it is dry and the Panel trips.", w: 1, h: 1, mass: 8.0, block: BATTERY, color: "#4d7059" }),
  I({ id: "elec_lamp", name: "Electric Lamp", desc: "Cold steady light on the Grid — brighter than an oil Lamp, zero flame. Unpowered it is just glass.", w: 1, h: 1, mass: 1.0, block: ELEC_LAMP, color: "#d8e4f2" }),
  I({ id: "inserter", name: "Inserter", desc: "Powered: pulls one item per second out of the block in front of it and pushes it into the block behind — Chests, or a Campfire's coals. No filters, no reach; aim it with R before placing.", w: 1, h: 1, mass: 1.5, block: INSERTER, color: "#4d808c" }),
  I({ id: "planter", name: "Planter", desc: "Powered: sits under Farm Land, takes a seed from the Chest beneath it, and plants the empty cell two above. Melon and Wheat seeds.", w: 1, h: 1, mass: 2.0, block: PLANTER, color: "#4d8047" }),
  I({ id: "harvester", name: "Harvester", desc: "Powered: reaps the ripe crop directly beneath it (Melon, Wheat, Cactus) and spills the yield into the Chest directly above.", w: 1, h: 1, mass: 1.5, block: HARVESTER, color: "#8c6b33" }),
  I({ id: "refinery", name: "Refinery", desc: "Where oil meets fire: press E and cook a Bucket of oil with Coal Ore into a sealed canister of Rocket Fuel. The bucket comes back.", w: 1, h: 1, mass: 8.0, block: REFINERY, color: "#66606b" }),
  I({ id: "oil_bucket", name: "Bucket of Oil", desc: "A bucket of thick black oil — slippery, foul-smelling, and worth far more than it smells.", w: 1, h: 1, mass: 4.0, color: "#2c2620" }),
  I({ id: "rocket_fuel", name: "Rocket Fuel", desc: "A sealed canister of refined rocket fuel: oil cooked with coal at a Refinery. Burn it in the Ship's engines.", w: 1, h: 2, mass: 4.0, color: "#c8552b" }),
  I({ id: "thruster_nozzle", name: "Thruster Nozzle", desc: "Cobalt-and-Copper replacement engine part. Press E at a Broken Thruster to wake it. All four wake the Ship.", w: 1, h: 2, mass: 3.0, color: "#c88a50" }),
  // ---- salvaged engine modules: a Disassembler pulls thrusters off their pylons ----
  I({ id: "thruster_broken", name: "Broken Thruster", desc: "A dead wingtip engine torn off its pylon. Heavy, inert — set it down anywhere and it waits for a Thruster Nozzle.", w: 2, h: 2, mass: 22.0, block: THRUSTER, color: "#6b707c" }),
  I({ id: "thruster", name: "Thruster", desc: "An installed engine — it lights only in the air. A Disassembler pulls it off its pylon.", w: 2, h: 2, mass: 22.0, block: THRUSTER_LIT, color: "#c88a50" }),
  // ---- the Ship Frame: the corners declare the volume that flies ----
  I({ id: "frame_corner", name: "Ship Frame Corner", desc: "The skeleton of a flying Ship. Stand the eight corners up and every cell inside the Frame rides with it — Corners move only while the Ship is grounded.", w: 1, h: 1, mass: 2.0, block: FRAME_CORNER, color: "#9aa4b8" }),
  I({ id: "flight_controls", name: "Flight Controls", desc: "The yoke. Stand it inside the Ship Frame and press E to fly — mass, fuel, Grid and every takeoff refusal read out there.", w: 1, h: 1, mass: 4.0, block: FLIGHT_CONTROLS, color: "#3f7f8f" }),
  I({ id: "armory", name: "Armoury", desc: "A forge bench for gear that guards the body: armour, backpacks, visors and the Body Heat Regulator. Built at the Crafting Bench.", w: 2, h: 2, mass: 14.0, block: ARMORY, color: "#6a6258" }),
  I({ id: "hot_water_pouch", name: "Hot Water Pouch", desc: "A full canister heated at a lit Campfire. Use it (Q): a +10 °C heat pulse toward body-warm, and the empty canister comes back.", w: 1, h: 2, mass: 1.2, color: "#e08a4f" }),
  // ---- the Map kit (needs the Surveyor's Visor worn to see any of it) ----
  I({ id: "surveyor_pin", name: "Surveyor's Pin", desc: "Press E to plant one where you stand: a named mark on the Map, forever. Rename it from the maximised Map. A Pin named \"Base\" is the point your Surveyor's Visor beams you back to.", w: 1, h: 1, mass: 0.2, color: "#66e5f0" }),
  I({ id: "tracker", name: "Hidden Landmark Tracker", desc: "Use it (Q): wakes the nearest Landmark you have never found — a Town, Nomad camp, cave mouth, oasis or buried canister site — and marks it on the Map. One use, then it is gone; it can never find the one-of-a-kind second wreck.", w: 1, h: 1, mass: 0.4, color: "#c08a3c" }),
  I({ id: "sack1", name: "Sack I", desc: "A 1×1 pocket holding up to 10 footprint-units of ONE item type. Loose items fall into an open Sack on their own; machines and Sort never look inside — stuff and empty it from the Open Sack panel.", w: 1, h: 1, mass: 0.3, sack: 10, color: "#a8834a" }),
  I({ id: "sack2", name: "Sack II", desc: "A stitched double layer: up to 20 footprint-units of ONE item type in a single 1×1 cell. Machines never read Sacks — they only ever write into them.", w: 1, h: 1, mass: 0.5, sack: 20, color: "#8f6a3a" }),
  I({ id: "sack3", name: "Sack III", desc: "Cobalt-rimmed canvas: up to 30 footprint-units of ONE item type. A Sack in a Sack never fits, at any tier.", w: 1, h: 1, mass: 0.8, sack: 30, color: "#6d4f2e" }),
  // ---- Silvaris (Phase 2): the station chain and the second world's kit ----
  I({ id: "electric_bench", name: "Electric Bench", desc: "The powered Crafting Bench: the whole Grid and machine chain — Poles, generators, Chests, Regulators, Breakers — is built here. Built at the Crafting Bench.", w: 1, h: 1, mass: 8.0, block: ELECTRIC_BENCH, color: "#5a707f" }),
  I({ id: "assembly_bench", name: "Assembly Bench", desc: "Precision work above the Electric Bench: Engine Cores, Dock Pads and the Ship's hard parts come off this table.", w: 1, h: 1, mass: 8.0, block: ASSEMBLY_BENCH, color: "#6a7085" }),
  I({ id: "fuel_works", name: "Fuel Works", desc: "Where Rocket Fuel meets graphite: press E and cook a canister with two Graphite Ore into a sealed canister of Super Rocket Fuel.", w: 1, h: 1, mass: 9.0, block: FUEL_WORKS, color: "#7a5a48" }),
  I({ id: "foundry", name: "Foundry", desc: "Hot alloys: one Titanium Ore draws a Titanium Rod, and Metal Plating baked with Coal Ore rolls out Steel Plating.", w: 1, h: 1, mass: 9.0, block: FOUNDRY, color: "#8a6248" }),
  I({ id: "super_fuel", name: "Super Rocket Fuel", desc: "A sealed blue canister: Rocket Fuel cooked with Graphite at a Fuel Works. It never burns in the engines — it is what Leave Planet consumes to carry the Ship to another world.", w: 1, h: 2, mass: 5.0, color: "#3f7fe8" }),
  I({ id: "dock_pad", name: "Dock Pad", desc: "An inlaid deck tile of a Dock plaza. Ground the Ship's Frame on Pads and it is docked — the landing the Map remembers.", w: 1, h: 1, mass: 2.0, block: DOCK_PAD, color: "#9098a4" }),
  I({ id: "inscription", name: "Inscription", desc: "A carved Dweller stele. Press E at one to read who they were and why they left. Break one out and stand it wherever you like.", w: 1, h: 1, mass: 4.0, block: INSCRIPTION, color: "#ccc5ae" }),
  I({ id: "titanium_ore", name: "Titanium Ore", desc: "Light bright metal from the deep veins of Silvaris (Stone Pickaxe or better). Draw it into Rods at a Foundry.", w: 1, h: 1, mass: 2.0, block: TITANIUM_ORE, color: "#a9b0ba" }),
  I({ id: "graphite_ore", name: "Graphite Ore", desc: "Soft black carbon from the mid veins. Cooked with Rocket Fuel at a Fuel Works, it makes the fuel that leaves worlds.", w: 1, h: 1, mass: 1.0, block: GRAPHITE_ORE, color: "#585a5e" }),
  I({ id: "titaniumrod", name: "Titanium Rod", desc: "Drawn from Titanium Ore at a Foundry. The skeleton of Assembly Bench work.", w: 1, h: 1, mass: 1.4, color: "#b9c0ca" }),
  I({ id: "steel_plating", name: "Steel Plating", desc: "Metal Plating baked with Coal at a Foundry — a tougher, duller plate. Dock Pads eat it by the pair.", w: 1, h: 1, mass: 2.0, color: "#9fb0c2" }),
  // ---- Silvaris crops: seeds from settlement chests, grown on Farm Land ----
  I({ id: "seed_tundroot", name: "Tundra Root Seed", desc: "Plant on Farm Land. Comfortable deep into the cold — the Silvaris staple.", w: 1, h: 1, mass: 0.1, block: TUNDROOT_1, color: "#c9b57a" }),
  I({ id: "tundroot", name: "Tundra Root", desc: "Dug from a ripe Tundra Root. A cold-hardy tuber. Eat it: +8 Water, +15 Health.", w: 1, h: 1, mass: 0.6, eat: { water: 8, health: 15 }, color: "#b39a5e" }),
  I({ id: "seed_emberbush", name: "Ember Bush Seed", desc: "Plant on Farm Land. Grows best at the heat edge — the Scorch Belt suits it.", w: 1, h: 1, mass: 0.1, block: EMBERBUSH_1, color: "#a85a3a" }),
  I({ id: "ember_berry", name: "Ember Berry", desc: "Tart berry picked from a fruiting Ember Bush; the bush re-bears on its own. Eat it: +10 Water, +8 Health.", w: 1, h: 1, mass: 0.15, eat: { water: 10, health: 8 }, color: "#d94f28" }),
  // ---- Silvaris fauna ----
  I({ id: "frost_pelt", name: "Frost Pelt", desc: "Thick white fur off a Snow Stalker. Warm, and worth a real price at any Nomad camp.", w: 1, h: 2, mass: 0.8, color: "#cddbe6" }),
  I({ id: "tideback_hide", name: "Tideback Hide", desc: "The heavy wet hide off a Tideback. Thick as a door, and Nomads know what it is worth.", w: 2, h: 2, mass: 2.5, color: "#6e8a72" }),
  I({ id: "tideback_meat", name: "Tideback Meat (raw)", desc: "Raw meat off a Tideback carcass. Smoke it at a Hearth before eating.", w: 2, h: 1, mass: 2.2, color: "#7c8a70" }),
  I({ id: "smoked_tideback", name: "Smoked Tideback", desc: "Hearth-smoked Tideback meat. Eat it: +30 Health, +6 Water.", w: 2, h: 1, mass: 1.8, eat: { health: 30, water: 6 }, color: "#5c6a52" }),
  I({ id: "brushbuck_meat", name: "Brushbuck Meat (raw)", desc: "Raw meat off a Brushbuck. Cook it at a Campfire before eating.", w: 1, h: 1, mass: 1.2, color: "#a06552" }),
  I({ id: "cooked_brushbuck_meat", name: "Cooked Brushbuck", desc: "Roasted plains meat. Eat it: +25 Health.", w: 1, h: 1, mass: 1.0, eat: { health: 25 }, color: "#b87c42" }),
  // ================= Phase 2 fork (2026-11-24) =================
  // ---- Recyclers and the Scrap economy: the one chain that crosses worlds ----
  I({ id: "recycler", name: "Recycler", desc: "Desert salvage grind: feed it old-world gear - tools, plating, machine parts - and it comes out as Scrap. Runs on the Grid.", w: 1, h: 1, mass: 9.0, block: RECYCLER, color: "#7c765f" }),
  I({ id: "sil_recycler", name: "Recycler", desc: "Silvaris salvage grind: any gear - this world's or the other's - comes out as Scrap. Runs on the Grid.", w: 1, h: 1, mass: 9.0, block: SIL_RECYCLER, color: "#6b7885" }),
  I({ id: "scrap", name: "Scrap", desc: "A grind of mixed metal with no home planet. The Foundry and the Wiring Bench take it anywhere.", w: 1, h: 1, mass: 0.6, color: "#8d8d94" }),
  I({ id: "machine_part", name: "Machine Part", desc: "A shard of the machines' chassis. The Machine Camps drop them; a Recycler grinds them finer.", w: 1, h: 1, mass: 1.2, color: "#707684" }),
  I({ id: "machine_heart", name: "Machine Heart", desc: "The core of a Breaker or Warden — a palm of caged light still obeying old orders. The prize of a hard fight.", w: 2, h: 2, mass: 4.0, color: "#c05050" }),
  I({ id: "slug", name: "Slug", desc: "A cast bullet of Desertis metal. Gun Turrets eat them by the handful.", w: 1, h: 1, mass: 0.1, color: "#9aa0aa" }),
  I({ id: "lead_slug", name: "Lead Slug", desc: "A cast bullet of Silvaris lead. Gun Turrets eat them by the handful.", w: 1, h: 1, mass: 0.12, color: "#7d8290" }),
  // ---- Silvaris station twins ----
  I({ id: "hearth", name: "Hearth", desc: "Silvaris' Campfire: smelts its own ores, cooks, slow-burns Silvertimber into Charcoal and fires Flux.", w: 1, h: 2, mass: 4.0, block: HEARTH, color: "#e08040" }),
  I({ id: "workbench", name: "Workbench", desc: "Silvaris' Crafting Bench: the whole Basalt→Bone→Titanium→Carbide ladder, timber kit and the stations below it.", w: 1, h: 2, mass: 6.0, block: WORKBENCH, color: "#6b6557" }),
  I({ id: "tannery", name: "Tannery", desc: "Silvaris' armoury twin: hides into hardhide, and hardhide into gear that holds the cold out.", w: 2, h: 2, mass: 12.0, block: TANNERY, color: "#8c6b4d" }),
  I({ id: "cauldron", name: "Cauldron", desc: "Silvaris' Cooking Pot: the dishes of roots, berries and oats.", w: 1, h: 2, mass: 5.0, block: CAULDRON, color: "#c87a3a" }),
  I({ id: "oil_works", name: "Oil Works", desc: "Silvaris' Refinery: Silvaris Oil in a Bucket cooked with Charcoal into Rocket Fuel. The bucket comes back.", w: 1, h: 1, mass: 8.0, block: OIL_WORKS, color: "#5c616c" }),
  I({ id: "wiring_bench", name: "Wiring Bench", desc: "Silvaris' Electric Bench: the whole power family on Lead, Glass and Saltpetre — Panels, Poles, Batteries, Generators.", w: 1, h: 1, mass: 8.0, block: WIRING_BENCH, color: "#59787f" }),
  I({ id: "fuel_still", name: "Fuel Still", desc: "The desert's Fuel Works: Rocket Fuel raised with Anthracite Ore into Super Rocket Fuel. Unbuilt until the Sentinel's death-gift.", w: 1, h: 1, mass: 9.0, block: FUEL_STILL, color: "#66687a" }),
  // ---- New minerals & materials ----
  I({ id: "anthracite_ore", name: "Anthracite Ore", desc: "Hard black carbon from Desertis' deepest stone (Metal Pickaxe or better). The desert's answer to Graphite.", w: 1, h: 1, mass: 1.4, block: ANTHRACITE_ORE, color: "#2e2b28" }),
  I({ id: "charcoal", name: "Charcoal", desc: "Silvertimber slow-burned at a Hearth. Silvaris' carbon: Oil Works fuel, Flux, and the Foundry's breath.", w: 1, h: 1, mass: 0.6, color: "#33302e" }),
  I({ id: "lead_ore", name: "Lead Ore", desc: "Dull heavy ore of Silvaris' mid caves. Smelts at a Hearth into Lead Rods.", w: 1, h: 1, mass: 2.2, block: LEAD_ORE, color: "#80858f" }),
  I({ id: "saltpetre_ore", name: "Saltpetre Ore", desc: "Bitter salt crusting Silvaris' upper caves. Smelts at a Hearth into Saltpetre.", w: 1, h: 1, mass: 0.9, block: SALTPETRE_ORE, color: "#d8d4c2" }),
  I({ id: "leadrod", name: "Lead Rod", desc: "Smelted from Lead Ore. Silvaris' copper: wires, coils, plating, Slugs.", w: 1, h: 1, mass: 1.2, color: "#8a909c" }),
  I({ id: "saltpetre", name: "Saltpetre", desc: "The battery salt of the Wiring Bench — bitter, sharp, and common in Silvaris' upper caves.", w: 1, h: 1, mass: 0.8, color: "#d8d4c2" }),
  I({ id: "flux", name: "Flux", desc: "Lead and Saltpetre fired at a Hearth — the foundry salt that lets Titanium and plating meet.", w: 1, h: 1, mass: 0.5, color: "#b9c4a8" }),
  I({ id: "titan_plating", name: "Titan Plating", desc: "Titanium sheet rolled at the Foundry. The machines' own armour, and yours if you take it.", w: 1, h: 1, mass: 1.6, color: "#aeb6c2" }),
  // ---- Silvaris timber & crops ----
  I({ id: "sil_timber", name: "Silvertimber Log", desc: "Trunk of a Silvertimber tree — Silvaris' wood. Fuel, tools, benches and charcoal.", w: 1, h: 1, mass: 0.5, block: SIL_WOOD, color: "#5c6870" }),
  I({ id: "seed_silvertimber", name: "Silvertimber Seed", desc: "Plant in Dirt. Grows a Silvertimber tree stage by stage while water stays near; Silvaris' renewable wood.", w: 1, h: 1, mass: 0.1, block: SIL_SAPLING, color: "#7fae9a" }),
  I({ id: "seed_oats", name: "Oat Seed", desc: "Plant on Farm Land. Frost Oats: the grain that laughs at the cold.", w: 1, h: 1, mass: 0.1, block: OAT_1, color: "#c8c49a" }),
  I({ id: "frost_oat", name: "Frost Oats", desc: "Cut from ripe Oats. Grind at a Cauldron for flour, or simmer whole into porridge.", w: 1, h: 1, mass: 0.2, color: "#c8c088" }),
  I({ id: "oat_flour", name: "Oat Flour", desc: "Frost Oats ground at a Cauldron. The flour of Oatbread.", w: 1, h: 1, mass: 0.2, color: "#d4cba4" }),
  I({ id: "oatbread", name: "Oatbread", desc: "Oat flour baked at a Cauldron. Sweet-heavy and filling. Eat it: +35 Health.", w: 2, h: 1, mass: 0.4, eat: { health: 35 }, color: "#c2a878" }),
  I({ id: "tundroot_flour", name: "Tundroot Flour", desc: "Tundra Roots ground at a Cauldron. The flour of Flatbread and Ember Pie.", w: 1, h: 1, mass: 0.2, color: "#d8c8a8" }),
  I({ id: "flatbread", name: "Flatbread", desc: "Tundroot flour baked at a Cauldron. Plain, dense, cold-country bread. Eat it: +30 Health.", w: 1, h: 1, mass: 0.2, eat: { health: 30 }, color: "#c8a86a" }),
  I({ id: "root_stew", name: "Root Stew", desc: "Tundra Root and Brushbuck meat simmered in a full Canister at a Cauldron. The Canister comes back empty. Eat it: +25 Water, +35 Health.", w: 1, h: 2, mass: 1.2, eat: { water: 25, health: 35 }, color: "#a8783a" }),
  I({ id: "ember_pie", name: "Ember Pie", desc: "Ember Berries and Tundroot flour baked at a Cauldron. Sweet-fire filling. Eat it: +45 Health.", w: 2, h: 1, mass: 0.8, eat: { health: 45 }, color: "#c76a4a" }),
  I({ id: "oat_porridge", name: "Oat Porridge", desc: "Frost Oats simmered in a full Canister at a Cauldron. The Canister comes back empty. Eat it: +20 Water, +20 Health.", w: 1, h: 2, mass: 1.0, eat: { water: 20, health: 20 }, color: "#c8b88a" }),
  I({ id: "smoked_brushbuck", name: "Smoked Brushbuck", desc: "Plains meat hung over Hearth smoke. Keeps for days and travels well. Eat it: +30 Health.", w: 1, h: 1, mass: 0.9, eat: { health: 30 }, color: "#a8653f" }),
  I({ id: "pear_cordial", name: "Pear Cordial", desc: "Prickly Pears, Salt and Sugar sealed at a Cooking Pot. A desert luxury. Drink it: +20 Water, +10 Health.", w: 1, h: 2, mass: 1.0, eat: { water: 20, health: 10 }, color: "#d65a9a" }),
  // ---- Hides, leather & armour ----
  I({ id: "bone", name: "Bone", desc: "Clean bone off a Brushbuck or Stalker. Silvaris' stone: tools, buckets, needles.", w: 1, h: 1, mass: 0.5, color: "#d8d2c2" }),
  I({ id: "brushbuck_pelt", name: "Brushbuck Pelt", desc: "The hide off a Brushbuck. Skin it properly with a Skinner and you get two. Tan it at a Tannery.", w: 1, h: 2, mass: 0.7, color: "#a88a6a" }),
  I({ id: "hardhide", name: "Hardhide", desc: "Tanned pelt — stiff, warm, weatherproof. The Tannery's workhorse.", w: 1, h: 1, mass: 0.8, color: "#8c6f52" }),
  I({ id: "cactus_leather", name: "Cactus Leather", desc: "Cactus pad cured at a Campfire. Desert gear's answer to hide: cool-wearing and tough.", w: 1, h: 1, mass: 0.6, color: "#6f8f5a" }),
  I({ id: "buckguard", name: "Buckguard", desc: "Body-slot harness of Hardhide: shrugs off 40% of every blow. Silvaris workhorse armour.", w: 2, h: 2, mass: 3.5, equip: "body", armor: 0.4, color: "#8a6f50" }),
  I({ id: "snowcloak", name: "Snowcloak", desc: "Body cloak of Frost Pelts: shrugs off 30% of every blow and takes the bite out of the cold.", w: 2, h: 2, mass: 3.0, equip: "body", armor: 0.3, color: "#c4d4e0" }),
  I({ id: "tideback_cuirass", name: "Tideback Cuirass", desc: "Breastplate of Tideback Hide over Hardhide: shrugs off 48% of every blow. Swamp-forged.", w: 2, h: 2, mass: 8.0, equip: "body", armor: 0.48, color: "#5f7a64" }),
  I({ id: "dune_wrap", name: "Dune Wrap", desc: "Body wrap of Cactus Leather and Snake Skin: shrugs off 35% of every blow and breathes in the heat.", w: 2, h: 2, mass: 2.5, equip: "body", armor: 0.35, color: "#7f9a6a" }),
  // ---- Silvaris tool ladder: Basalt → Bone → Titanium → Carbide ----
  toolItem("pickaxe", 1, "basalt", "#4c4846"), toolItem("shovel", 1, "basalt", "#4c4846"), toolItem("axe", 1, "basalt", "#4c4846"),
  toolItem("pickaxe", 2, "bone", "#d8d2c2"), toolItem("shovel", 2, "bone", "#d8d2c2"), toolItem("axe", 2, "bone", "#d8d2c2"),
  toolItem("pickaxe", 3, "titanium", "#aeb6c2"), toolItem("shovel", 3, "titanium", "#aeb6c2"), toolItem("axe", 3, "titanium", "#aeb6c2"),
  toolItem("pickaxe", 4, "carbide", "#3a3f48"), toolItem("shovel", 4, "carbide", "#3a3f48"), toolItem("axe", 4, "carbide", "#3a3f48"),
  toolItem("disassembler", 1, "bone", "#d8d2c2"),
  toolItem("disassembler", 2, "carbide", "#3a3f48"),
  // Skinning Knives: skin = hides from a properly skinned carcass.
  I({ id: "basalt_knife", name: "Basalt Skinner", desc: "Skinning Knife (tier 1). Skinning a Brushbuck or Stalker carcass yields two hides. Higher tiers skin faster.", w: 1, h: 1, mass: 0.8, skin: 2, color: "#4c4846" }),
  I({ id: "bone_knife", name: "Bone Skinner", desc: "Skinning Knife (tier 2). Two hides every skin, and quicker about it.", w: 1, h: 1, mass: 0.7, skin: 2, color: "#d8d2c2" }),
  I({ id: "titanium_knife", name: "Titanium Skinner", desc: "Skinning Knife (tier 3). Two hides, fastest cut.", w: 1, h: 1, mass: 0.8, skin: 2, color: "#aeb6c2" }),
  I({ id: "carbide_knife", name: "Carbide Skinner", desc: "Skinning Knife (tier 4). Two hides, and the edge never quits.", w: 1, h: 1, mass: 0.9, skin: 2, color: "#3a3f48" }),
  // Harpoons: the only way down a Tideback.
  I({ id: "bone_harpoon", name: "Bone Harpoon", desc: "Harpoon (tier 2). A Tideback falls to nothing else: three Hides and a carcass. Doubles as a long spear.", w: 1, h: 2, mass: 1.6, harpoon: true, weapon: { reach: 4.6, dmg: 6 }, color: "#d8d2c2" }),
  I({ id: "titanium_harpoon", name: "Titanium Harpoon", desc: "Harpoon (tier 3). Hits harder; still the only thing that brings down a Tideback.", w: 1, h: 2, mass: 1.8, harpoon: true, weapon: { reach: 4.8, dmg: 8 }, color: "#aeb6c2" }),
  I({ id: "carbide_harpoon", name: "Carbide Harpoon", desc: "Harpoon (tier 4). The deadliest point on either planet.", w: 1, h: 2, mass: 2.0, harpoon: true, weapon: { reach: 5.0, dmg: 10 }, color: "#3a3f48" }),
  I({ id: "bone_bucket", name: "Bone Bucket", desc: "Silvaris' Bucket: scoop a water or oil Source, pour it back anywhere. Same work, different bone.", w: 1, h: 1, mass: 0.8, color: "#d8d2c2" }),
  // ---- Machine faction ----
  I({ id: "spikes", name: "Spike Barricade", desc: "A wall of driven spikes — anything that presses into it is hurt. Climbers, raiders and careless foxes alike.", w: 1, h: 1, mass: 1.5, block: SPIKE_BARRICADE, color: "#72593f" }),
  I({ id: "alarm_chime", name: "Alarm Chime", desc: "Powered: rings a warning when a hostile thing walks near. Wired into the Grid by Pole reach.", w: 1, h: 1, mass: 1.5, block: ALARM_CHIME, color: "#cca64e" }),
  I({ id: "gun_turret", name: "Gun Turret", desc: "Powered: fires Slugs at hostiles in range — machines, and fauna unless you tell it not to. Load Slugs from the panel (E).", w: 1, h: 1, mass: 9.0, block: GUN_TURRET, color: "#66707c" }),
  I({ id: "shock_coil", name: "Shock Coil", desc: "Powered: pulses the ground in a ring — twice as hard on metal. The machine's own weakness, thrown back at it.", w: 1, h: 1, mass: 6.0, block: SHOCK_COIL, color: "#8098c0" }),
  // ---- The Sled and the Nav Core ----
  I({ id: "hover_sled", name: "Hover Sled", desc: "Place it, board it (E), ride at double speed on a charge. Park on a powered Dock Pad to recharge. Upgrades bolt on from its panel.", w: 1, h: 1, mass: 12.0, block: HOVER_SLED, color: "#808ca4" }),
  I({ id: "cargo_sled", name: "Cargo Sled", desc: "An upgrade frame for the Hover Sled: a 3×3 sled-chest rides along, fed and emptied from the Sled panel.", w: 2, h: 2, mass: 8.0, color: "#6f6a58" }),
  I({ id: "sled_blade", name: "Sled Blade", desc: "A Sled upgrade: while riding, snow, leaves and shallow water part in your path — for a sip of charge.", w: 2, h: 1, mass: 4.0, color: "#8a90a0" }),
  I({ id: "sled_drill", name: "Sled Drill", desc: "A Sled upgrade: digs Caches and machine wreckage at the yoke — no dismounting, no swinging.", w: 2, h: 1, mass: 5.0, color: "#9a8a5a" }),
  I({ id: "nav_core", name: "Nav Core", desc: "The Ship's chartering brain: where it has been, what worlds answer, and how to reach them. The Keepers give up the design once the scattered story is told.", w: 1, h: 2, mass: 5.0, block: NAV_CORE, color: "#8a6ac8" }),
  // ---- Phase-2 stone & snow: the materials tools are cut from ----
  I({ id: "basalt", name: "Basalt", desc: "Silvaris' dark stone, torn from the rock faces. Its wood-equivalent: tools, hearths, walls.", w: 1, h: 1, mass: 1.1, block: BASALT, color: "#4c4846" }),
  I({ id: "snow_block", name: "Snow Block", desc: "Packed from Powder Snow. Melts fast in a Sealed Space; good enough for a winter wall.", w: 1, h: 1, mass: 0.4, block: SNOW, color: "#e6ecf2" }),
  // ---- Furniture ----
  I({ id: "timber_post", name: "Timber Post", desc: "A turned Silvertimber post: porches, pens, fence lines.", w: 1, h: 1, mass: 0.8, block: WOOD_POST, color: "#806a4a" }),
  I({ id: "timber_railing", name: "Timber Railing", desc: "Post and rail, auto-linking. You can lean into it but not hop it.", w: 1, h: 1, mass: 0.7, block: WOOD_RAILING, color: "#85704d" }),
  I({ id: "table", name: "Table", desc: "A worked table: the hearth of a settled room. Cut at a Crafting Bench or Workbench.", w: 2, h: 1, mass: 4.0, block: TABLE, color: "#8c6b45" }),
  I({ id: "stained_glass", name: "Stained Glass", desc: "Glass with color in it — the settlements' windows. Conducts heat like plain glass.", w: 1, h: 1, mass: 0.6, block: STAINED_GLASS, color: "#8a5a72" }),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));

export const BLOCK_TO_ITEM: Record<number, string> = {};
for (const it of Object.values(ITEMS)) if (it.block !== undefined) BLOCK_TO_ITEM[it.block] = it.id;
BLOCK_TO_ITEM[DOOR_UPPER] = "door"; // both door halves drop the same item
BLOCK_TO_ITEM[DOOR_INNER_UPPER] = "door_inner";
BLOCK_TO_ITEM[ALAB_DOOR_UPPER] = "alab_door"; // the stone door drops its leaf
BLOCK_TO_ITEM[ALAB_GATE_OPEN] = "alab_gate";  // an open gate drops the gate
BLOCK_TO_ITEM[BED_EXT] = "bed"; // both bed halves drop the bed
BLOCK_TO_ITEM[GRASS] = "dirt";   // grass breaks to the dirt under it
BLOCK_TO_ITEM[LEAVES] = "kindling"; // leaves crumble to Kindling
// crop fallbacks: the explicit breakBlock handlers give the real harvest drops
BLOCK_TO_ITEM[MELON_1] = "seed_melon";
BLOCK_TO_ITEM[MELON_2] = "dune_melon";
BLOCK_TO_ITEM[WHEAT_1] = "seed_wheat";
BLOCK_TO_ITEM[WHEAT_2] = "wheat";
BLOCK_TO_ITEM[CACTUS_FRUIT] = "cactus";
// new crop/fruit/cage fallbacks (explicit handlers give the real drops)
BLOCK_TO_ITEM[SUGARCANE_1] = "sugar_cane";
BLOCK_TO_ITEM[SUGARCANE_2] = "sugar_cane";
BLOCK_TO_ITEM[APPLE_FRUIT] = "apple";
BLOCK_TO_ITEM[WATER_CAGE_FULL] = "water_cage";
// Husks drop their broken frame — the item, not a placeable husk block
BLOCK_TO_ITEM[REGULATOR_HUSK] = "regulator_broken";
BLOCK_TO_ITEM[STORM_BREAKER_HUSK] = "storm_breaker_broken";
// Silvaris crop fallbacks (explicit handlers give the real drops)
BLOCK_TO_ITEM[TUNDROOT_1] = "seed_tundroot";
BLOCK_TO_ITEM[TUNDROOT_2] = "tundroot";
BLOCK_TO_ITEM[EMBERBUSH_1] = "seed_emberbush";
BLOCK_TO_ITEM[EMBERBUSH_2] = "ember_berry";
BLOCK_TO_ITEM[EMBER_FRUIT] = "ember_berry";
// Phase-2 fork fallbacks (explicit handlers give the real drops)
BLOCK_TO_ITEM[SIL_WOOD] = "sil_timber";
BLOCK_TO_ITEM[SIL_LEAVES] = "kindling"; // silvertimber leaves crumble too
BLOCK_TO_ITEM[OAT_1] = "seed_oats";
BLOCK_TO_ITEM[OAT_2] = "frost_oat";
// The machines leave parts, not placeable wreckage
BLOCK_TO_ITEM[136] = "machine_part"; // CAMP_ANTENNA
BLOCK_TO_ITEM[137] = "machine_part"; // RELAY_TOWER

// ---------------- Inventory Grid ----------------

/** One slot holds exactly one item — items never stack, anywhere.
 *  `charges`: partial fuel charges on an item not yet fed to a fire, or lantern charge; `cook`/`done`: Campfire cooking job progress;
 *  `stack`: contents of a Sack — one item type, ADR-0008: nobody but the player may read it. */
export interface Slot { itemId: string; x: number; y: number; rot?: boolean; charges?: number; blockRot?: number; cook?: number; done?: boolean; stack?: { itemId: string; count: number }; }

/** Effective footprint of a placed item (rot swaps w/h). */
export function slotDims(s: Slot): { w: number; h: number } {
  const d = ITEMS[s.itemId];
  return s.rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

// ---- Sacks (ADR-0008): one item type per Sack, contents priced in footprint units ----
/** Units one instance of an item takes inside a Sack (native footprint; rotation is irrelevant). */
export function sackUnits(itemId: string): number { const d = ITEMS[itemId]; return d.w * d.h; }
/** Units currently used inside a Sack slot (0 for empty Sacks and non-Sacks). */
export function sackUsed(s: Slot): number { return s.stack ? sackUnits(s.stack.itemId) * s.stack.count : 0; }
/** Free capacity of a Sack slot in units (-1 for non-Sacks). */
export function sackFree(s: Slot): number { const cap = ITEMS[s.itemId].sack; return cap === undefined ? -1 : cap - sackUsed(s); }

export class Inventory {
  slots: Slot[] = [];
  w = 5; h = 4;
  cellPx = 64; // effective on-screen cell size (rendering only; slot count never changes)
  // fired with the item id whenever an item actually lands in the pack (the Codex listens)
  learn: (id: string) => void = () => {};

  constructor() {} // fresh worlds start with an empty pack - supplies live in the cockpit chest

  capacity(): { w: number; h: number } { return { w: this.w, h: this.h }; }

  setBackpack(sizeW: number, sizeH: number) {
    const old = this.slots;
    this.w = sizeW; this.h = sizeH;
    this.slots = [];
    for (const s of old) if (!this.addSlot(s)) this.droppedOnResize.push(s);
  }
  droppedOnResize: Slot[] = [];

  /** Occupancy grid over footprint cells; `ignore` skips one slot (for move/rotate checks). */
  private occupied(x: number, y: number, ignore?: Slot): Slot | null {
    for (const s of this.slots) {
      if (s === ignore) continue;
      const d = slotDims(s);
      if (x >= s.x && x < s.x + d.w && y >= s.y && y < s.y + d.h) return s;
    }
    return null;
  }

  fits(x: number, y: number, w: number, h: number, ignore?: Slot): boolean {
    if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) return false;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        if (this.occupied(x + dx, y + dy, ignore)) return false;
    return true;
  }

  /** Move a slot's whole footprint to a new anchor cell. */
  move(s: Slot, x: number, y: number): boolean {
    const d = slotDims(s);
    if (x === s.x && y === s.y) return true;
    if (!this.fits(x, y, d.w, d.h, s)) return false;
    s.x = x; s.y = y;
    return true;
  }

  /** Swap w/h in place if the rotated footprint fits. */
  rotate(s: Slot): boolean {
    const d = slotDims(s);
    if (d.w === d.h) return false;
    if (!this.fits(s.x, s.y, d.h, d.w, s)) return false;
    s.rot = !s.rot;
    return true;
  }

  /** Add an existing Slot object (keeping charges, blockRot, ...). False if nowhere fits. */
  addSlot(s: Slot): boolean {
    const def = ITEMS[s.itemId];
    const variants: [number, number, boolean][] =
      def.w === def.h ? [[def.w, def.h, s.rot ?? false]] : [[def.w, def.h, s.rot ?? false], [def.h, def.w, !s.rot]];
    for (const [w, h, rot] of variants) {
      for (let y = 0; y <= this.h - h; y++) {
        for (let x = 0; x <= this.w - w; x++) {
          let free = true;
          for (let dy = 0; dy < h && free; dy++)
            for (let dx = 0; dx < w && free; dx++)
              if (this.occupied(x + dx, y + dy)) free = false;
          if (free) { s.x = x; s.y = y; s.rot = rot || undefined; this.slots.push(s); this.learn(s.itemId); return true; }
        }
      }
    }
    return false;
  }

  /** Pour items into open Sacks in this grid — smallest remaining capacity first,
   *  one item type per Sack; Sacks themselves never go inside. Returns count used. */
  fillSack(itemId: string, count = 1): number {
    if (ITEMS[itemId].sack !== undefined) return 0; // a Sack in a Sack never fits
    const units = sackUnits(itemId);
    let used = 0;
    while (used < count) {
      let best: Slot | null = null, bestFree = Infinity;
      for (const s of this.slots) {
        if (ITEMS[s.itemId].sack === undefined) continue;
        if (s.stack && s.stack.itemId !== itemId) continue; // the pocket already holds another kind
        const free = sackFree(s);
        if (free >= units && free < bestFree) { best = s; bestFree = free; }
      }
      if (!best) break;
      if (best.stack) best.stack.count++; else best.stack = { itemId, count: 1 };
      this.learn(itemId);
      used++;
    }
    return used;
  }

  /** Add items; every instance claims its own footprint. Returns count that did NOT fit. */
  addItem(itemId: string, count = 1): number {
    const def = ITEMS[itemId];
    // try every rotation, not just the item's native one
    const variants: [number, number, boolean][] =
      def.w === def.h ? [[def.w, def.h, false]] : [[def.w, def.h, false], [def.h, def.w, true]];
    for (let i = 0; i < count; i++) {
      let placed = false;
      // an open Sack in this grid swallows the item before it claims any cells
      if (this.fillSack(itemId, 1) > 0) continue;
      for (const [w, h, rot] of variants) {
        for (let y = 0; y <= this.h - h && !placed; y++) {
          for (let x = 0; x <= this.w - w && !placed; x++) {
            let free = true;
            for (let dy = 0; dy < h && free; dy++)
              for (let dx = 0; dx < w && free; dx++)
                if (this.occupied(x + dx, y + dy)) free = false;
            if (free) {
              this.slots.push(rot ? { itemId, x, y, rot: true } : { itemId, x, y });
              this.learn(itemId);
              placed = true;
            }
          }
        }
        if (placed) break;
      }
      if (!placed) return count - i;
    }
    return 0;
  }

  /** Remove up to `count` instances; returns how many were removed. */
  removeItem(itemId: string, count = 1): number {
    let removed = 0;
    for (let i = this.slots.length - 1; i >= 0 && removed < count; i--) {
      if (this.slots[i].itemId !== itemId) continue;
      this.slots.splice(i, 1); removed++;
    }
    return removed;
  }

  countOf(itemId: string): number {
    let n = 0;
    for (const s of this.slots) if (s.itemId === itemId) n++;
    return n;
  }

  has(itemId: string, n = 1): boolean { return this.countOf(itemId) >= n; }

  /** Order instances row-major: identical items adjacent, groups alphabetical by display
   *  name, worn charges first within a group. Rotations stay fixed; a piece with no free
   *  footprint keeps its original cell, and if that collides, the whole sort reverts.
   *  In place: the slots array keeps its identity (the chest map holds it by reference). */
  sort(): void {
    const snap = this.slots.map((s) => ({ s, x: s.x, y: s.y, rot: s.rot }));
    const order = snap.map((o) => o.s).sort((a, b) =>
      a.itemId === b.itemId ? (a.charges ?? 0) - (b.charges ?? 0)
        : ITEMS[a.itemId].name.localeCompare(ITEMS[b.itemId].name));
    const pos = new Map(snap.map((o) => [o.s, o] as const));
    const overlaps = (s: Slot, list: Slot[]): boolean => {
      const d = slotDims(s);
      for (const t of list) {
        const td = slotDims(t);
        if (s.x < t.x + td.w && t.x < s.x + d.w && s.y < t.y + td.h && t.y < s.y + d.h) return true;
      }
      return false;
    };
    const tryPlace = (s: Slot, taken: Slot[]): boolean => {
      const d = slotDims(s);
      for (let y = 0; y + d.h <= this.h; y++) for (let x = 0; x + d.w <= this.w; x++) {
        s.x = x; s.y = y;
        if (!overlaps(s, taken)) { taken.push(s); return true; }
      }
      return false;
    };
    const placed: Slot[] = [], stuck: Slot[] = [];
    for (const s of order) if (!tryPlace(s, placed)) stuck.push(s);
    if (stuck.length) {
      for (const s of stuck) { const p = pos.get(s)!; s.x = p.x; s.y = p.y; s.rot = p.rot; }
      const taken = stuck.slice();
      for (const s of order) {
        if (stuck.includes(s)) continue;
        if (!tryPlace(s, taken)) {
          const p = pos.get(s)!; s.x = p.x; s.y = p.y; s.rot = p.rot; // stuck too: stays put
          taken.push(s);
        }
      }
    }
    // no two items may end up sharing a cell; if the in-place struts collided, revert
    for (let i = 0; i < this.slots.length; i++) {
      if (overlaps(this.slots[i], this.slots.slice(0, i).concat(this.slots.slice(i + 1)))) {
        for (const o of snap) { o.s.x = o.x; o.s.y = o.y; o.s.rot = o.rot; }
        this.slots.length = 0;
        for (const o of snap) this.slots.push(o.s);
        return;
      }
    }
    // selection follows the item, not the array index
    const sel = this.slots[this.selected];
    this.slots.length = 0;
    for (const s of order) this.slots.push(s);
    if (sel) this.selected = this.slots.indexOf(sel);
  }

  /** Held item = first tool, else first placeable, else first. Managed by selection index. */
  selected = 0;
  selectedSlot(): Slot | null { return this.slots[this.selected] ?? null; }
}
