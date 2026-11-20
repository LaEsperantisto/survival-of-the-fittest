import {
  SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS, HULL,
  DOOR_CLOSED, DOOR_UPPER, LAMP, BEACON, BENCH, CAMPFIRE, ADOBE, ENGINECORE, REGULATOR, CHEST, CACTUS,
  FARMLAND, MELON_1, MELON_2, WHEAT_1, WHEAT_2, CACTUS_FRUIT, CHEST_CONNECTOR, METAL_PLATING,
  DOOR_INNER, DOOR_INNER_UPPER, BED, BED_EXT, GRASS, LEAVES, WOOD, SAPLING,
  CURVED_HULL, HULL_SLOPE, IRON_ORE, COPPER_ORE, ALABASTER, COBALT_ORE, STORM_BREAKER, THRUSTER, THRUSTER_LIT, ARMORY,
  REGULATOR_HUSK, STORM_BREAKER_HUSK,
  POWER_PANEL, POWER_POLE, GEN_WOOD, WATER_WHEEL, WIND_TURBINE, SOLAR_PANEL, BATTERY, ELEC_LAMP,
  INSERTER, PLANTER, HARVESTER,
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
  eat?: { water?: number; health?: number };  // eating applies these to the player
  equip?: "backpack" | "head" | "body" | "regulator" | "light"; // goes in that Armour Slot
  bag?: { w: number; h: number }; // Backpack-slot gear: grid size
  armor?: number; // Body-slot gear: fraction of every damage shrugged off
  stormResist?: boolean; // Body-slot gear wearing Chitin: Sandstorm terms bite at a quarter
  fuel?: number;             // max fuel charges (Head Lantern)
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
  I({ id: "chest", name: "Supply Chest", desc: "Stores gear in its own grid. Chests placed touching (orthogonally) merge into one bigger grid — 3×3 each, up to 3 wide, then taller.", w: 1, h: 1, mass: 5.0, block: CHEST, color: "#8a6d3b" }),
  I({ id: "canister_full", name: "Water Canister (full)", desc: "Drink to restore 25% Water. Refill at oases or the ship's water station.", w: 1, h: 2, mass: 1.0, color: "#3f8fe0" }),
  I({ id: "canister_empty", name: "Water Canister (empty)", desc: "Lighter until you find water.", w: 1, h: 1, mass: 0.3, color: "#7fa8cc" }),
  I({ id: "catalyst", name: "Catalyst", desc: "Rare alien chemistry. Found in Towns and the second wreck. Needed for Insulating Glass (M2 craft chain).", w: 1, h: 1, mass: 0.3, color: "#c07fe0" }),
  I({ id: "engine_core", name: "Engine Core", desc: "The heart of the second wreck. Quest-exclusive — place it within reach of a Save Beacon to finish the Main Quest.", w: 1, h: 1, mass: 6.0, block: ENGINECORE, color: "#c468e8" }),
  I({ id: "visor", name: "Surveyor's Visor", desc: "A Visor upgrade. Equipped in the Head slot, the HUD marks every Death Cache, Reward Cache and Supply Chest through walls with a beam.", w: 1, h: 1, mass: 0.8, equip: "head", color: "#66e5f0" }),
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
  I({ id: "seed_melon", name: "Melon Seed", desc: "Plant on Farm Land within 4 blocks of water. Loves heat (22-45 C air); stalls in the cold.", w: 1, h: 1, mass: 0.1, block: MELON_1, color: "#c8b060" }),
  I({ id: "seed_wheat", name: "Wheat Seed", desc: "Plant on Farm Land within 4 blocks of water. Grows in the cool band (2-22 C) too.", w: 1, h: 1, mass: 0.1, block: WHEAT_1, color: "#d8c878" }),
  I({ id: "dune_melon", name: "Dune Melon", desc: "Harvested from a ripe Melon. Eat it: +30 Water, +5 Health.", w: 2, h: 1, mass: 2, eat: { water: 30, health: 5 }, color: "#7a9a3a" }),
  I({ id: "wheat", name: "Desert Wheat", desc: "Cut from ripe Wheat. Too tough raw - smelt it at a Campfire into Cooked Wheat.", w: 1, h: 1, mass: 0.2, color: "#d8b048" }),
  I({ id: "cooked_wheat", name: "Cooked Wheat", desc: "Plain but dense. Eat it: +35 Health.", w: 1, h: 1, mass: 0.2, eat: { health: 35 }, color: "#b8853a" }),
  // ---- trees ----
  I({ id: "wood_log", name: "Wood Log", desc: "Trunk of a Living Tree - the renewable counterpart of Dead Wood. Fuel and crafting.", w: 1, h: 1, mass: 0.5, block: WOOD, color: "#7a5c3a" }),
  I({ id: "kindling", name: "Kindling", desc: "Leaf scraps. Campfire fuel that burns fast and small.", w: 1, h: 1, mass: 0.1, color: "#9a8a5a" }),
  I({ id: "seed_tree", name: "Tree Seed", desc: "Plant in Dirt. Grows a Living Tree stage by stage over ~8 minutes while water stays within 6 blocks. Found in Town chests and from broken Leaves.", w: 1, h: 1, mass: 0.1, block: SAPLING, color: "#7fae54" }),
  // ---- water carrying ----
  I({ id: "bucket", name: "Bucket", desc: "Scoop a water Source with it, pour it back anywhere: moves water instead of drinking it.", w: 1, h: 1, mass: 1.0, color: "#9aa0aa" }),
  I({ id: "bucket_full", name: "Bucket (full)", desc: "Water to pour. Right-click ground to place it as a new Source.", w: 1, h: 1, mass: 3.0, color: "#3f8fe0" }),
  // ---- building ----
  I({ id: "chest_connector", name: "Chest Connector", desc: "Steel rail between Supply Chests: links their grids into one bigger Inventory Grid. Stores nothing itself.", w: 1, h: 1, mass: 1, block: CHEST_CONNECTOR, color: "#8a744a" }),
  I({ id: "metal_plating", name: "Metal Plating", desc: "The ship's plated floor and skin. Same plate, same tools - disassemble it back.", w: 1, h: 1, mass: 1.2, block: METAL_PLATING, color: "#9aa0ac" }),
  I({ id: "storm_breaker", name: "Sandstorm Breaker", desc: "A humming red pylon. Stand within 8 blocks of one and the Sandstorm loses all teeth — no scorching, no wind-thirst, no sand blast.", w: 1, h: 1, mass: 4.0, block: STORM_BREAKER, color: "#c04838" }),
  I({ id: "storm_breaker_broken", name: "Broken Sandstorm Breaker", desc: "The dead pylon's frame. Repair it at a Crafting Bench — 1 Iron Rod, 1 Glass — and the calm hums again.", w: 1, h: 1, mass: 3.0, color: "#8a6158" }),
  I({ id: "door_inner", name: "Inside Door", desc: "Interior bulkhead door. It divides rooms for sight and movement - and never insulates: in temperature terms it is just air, open or closed.", w: 1, h: 1, mass: 2, block: DOOR_INNER, color: "#82868e" }),
  I({ id: "bed", name: "Bed", desc: "Curtained sleep for 8 game hours, then the cool morning. One long sleep every 8 hours; press E at the bed. Takes a 2x1 floor span.", w: 2, h: 1, mass: 6, block: BED, color: "#a84a42" }),
  // ---- underground: minerals ----
  I({ id: "iron_ore", name: "Iron Ore", desc: "Dense ore from Cave walls. Smelt it at a Campfire: one ore bakes two Iron Rods.", w: 1, h: 1, mass: 1.6, block: IRON_ORE, color: "#9e8468" }),
  I({ id: "copper_ore", name: "Copper Ore", desc: "Reddened Cave stone. Smelts into Copper Rods - the heart of tier-4 Alloy gear.", w: 1, h: 1, mass: 1.6, block: COPPER_ORE, color: "#b86b42" }),
  I({ id: "alabaster", name: "Alabaster", desc: "Pale Cave stone. Cuts soft, decorates well, and takes a Lamp's light like nothing else.", w: 1, h: 1, mass: 1.2, block: ALABASTER, color: "#dcd5bd" }),
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
  I({ id: "tortoise_shell", name: "Thornback Shell", desc: "The spiked dome of a Thornback Tortoise. Three plate a Cuirass; Traders always want them.", w: 2, h: 2, mass: 6.0, color: "#5f5a4e" }),
  I({ id: "fennec_pelt", name: "Fennec Pelt", desc: "Soft pale fur off a Fennec Fox. Worth a real price at any Trader.", w: 1, h: 2, mass: 0.5, color: "#c99a62" }),
  I({ id: "tortoise_cuirass", name: "Thornback Cuirass", desc: "Body-slot breastplate of layered Shell and Metal: shrugs off 48% of every blow. Heavy going.", w: 2, h: 2, mass: 9.0, equip: "body", armor: 0.48, color: "#6a6255" }),
  I({ id: "wurmsuit", name: "Wurmsuit", desc: "Body-slot armour of Wurm Hide and Chitin: shrugs off 45% of every blow, and the Chitin turns the Sandstorm aside — blast and wind-thirst bite at a quarter. Warmer against the cold night too.", w: 2, h: 2, mass: 5.0, equip: "body", armor: 0.45, stormResist: true, color: "#7a5c40" }),
  I({ id: "stinger_blade", name: "Stinger Blade", desc: "A Metal Sword tipped with a Scorpion Stinger: hits harder and farther than anything above ground.", w: 1, h: 2, mass: 2.4, weapon: { reach: 5.2, dmg: 12 }, color: "#c9b048" }),
  // ---- the Ship's wings ----
  I({ id: "curved_hull", name: "Curved Hull Plating", desc: "Hull Plating shaped as an elbow - insulates exactly like flat plating, and rounds any corner you build.", w: 1, h: 1, mass: 2.0, block: CURVED_HULL, color: "#7d8390" }),
  I({ id: "hull_slope", name: "Hull Slope", desc: "A beveled hull block for spines, roofs and shoulders. Same insulation, rounder silhouette.", w: 1, h: 1, mass: 2.0, block: HULL_SLOPE, color: "#767d88" }),
  // ---- Grid power: Poles carry it, the Panel guards it (ADR-0007) ----
  I({ id: "power_pole", name: "Power Pole", desc: "Carries the Grid: links to other Poles within 16 blocks and feeds anything powered within 10.", w: 1, h: 1, mass: 2.0, block: POWER_POLE, color: "#8a7455" }),
  I({ id: "power_panel", name: "Power Panel", desc: "The heart of a Grid — exactly one per Pole network. When draw outruns supply it trips and the whole Grid goes dark until you press E to reset it.", w: 1, h: 1, mass: 4.0, block: POWER_PANEL, color: "#586270" }),
  I({ id: "gen_wood", name: "Wood Generator", desc: "Burns Wood Logs and Dead Wood fed from a Supply Chest right beside it. Steady 4 units, day and night, until the wood runs out.", w: 1, h: 1, mass: 6.0, block: GEN_WOOD, color: "#755540" }),
  I({ id: "water_wheel", name: "Water Wheel", desc: "3 units while water runs past any side of it. Oasis-current or your own channel — it never sleeps.", w: 1, h: 1, mass: 5.0, block: WATER_WHEEL, color: "#70664d" }),
  I({ id: "wind_turbine", name: "Wind Turbine", desc: "Up to 8 units, scaling with the Sandstorm — the storm that punishes you powers the base. Needs open sky above.", w: 1, h: 1, mass: 5.0, block: WIND_TURBINE, color: "#b3b3bc" }),
  I({ id: "solar_panel", name: "Solar Panel", desc: "Up to 4 units in direct sun; roofs and Sandstorms cut it hard. Dead silent at night.", w: 1, h: 1, mass: 4.0, block: SOLAR_PANEL, color: "#33405f" }),
  I({ id: "battery", name: "Battery", desc: "Stores 120 units of the Grid. Sips surplus by day, hands it back when generation falls short — until it is dry and the Panel trips.", w: 1, h: 1, mass: 8.0, block: BATTERY, color: "#4d7059" }),
  I({ id: "elec_lamp", name: "Electric Lamp", desc: "Cold steady light on the Grid — brighter than an oil Lamp, zero flame. Unpowered it is just glass.", w: 1, h: 1, mass: 1.0, block: ELEC_LAMP, color: "#d8e4f2" }),
  I({ id: "inserter", name: "Inserter", desc: "Powered: pulls one item per second out of the block in front of it and pushes it into the block behind — Chests, or a Campfire's Fuel Slot. No filters, no reach; aim it with R before placing.", w: 1, h: 1, mass: 1.5, block: INSERTER, color: "#4d808c" }),
  I({ id: "planter", name: "Planter", desc: "Powered: sits under Farm Land, takes a seed from the Chest beneath it, and plants the empty cell two above. Melon and Wheat seeds.", w: 1, h: 1, mass: 2.0, block: PLANTER, color: "#4d8047" }),
  I({ id: "harvester", name: "Harvester", desc: "Powered: reaps the ripe crop directly beneath it (Melon, Wheat, Cactus) and spills the yield into the Chest directly above.", w: 1, h: 1, mass: 1.5, block: HARVESTER, color: "#8c6b33" }),
  I({ id: "thruster_nozzle", name: "Thruster Nozzle", desc: "Cobalt-and-Copper replacement engine part. Press E at a Broken Thruster to wake it. All four wake the Ship.", w: 1, h: 2, mass: 3.0, color: "#c88a50" }),
  // ---- salvaged engine modules: a Disassembler pulls thrusters off their pylons ----
  I({ id: "thruster_broken", name: "Broken Thruster", desc: "A dead wingtip engine torn off its pylon. Heavy, inert — set it down anywhere and it waits for a Thruster Nozzle.", w: 2, h: 2, mass: 22.0, block: THRUSTER, color: "#6b707c" }),
  I({ id: "thruster_lit", name: "Thruster (lit)", desc: "A running engine lifted off its pylon. It keeps burning while you carry it, and burns where you set it down.", w: 2, h: 2, mass: 22.0, block: THRUSTER_LIT, color: "#c88a50" }),
  I({ id: "armory", name: "Armoury", desc: "A forge bench for gear that guards the body: armour, backpacks, visors and the Body Heat Regulator. Built at the Crafting Bench.", w: 2, h: 2, mass: 14.0, block: ARMORY, color: "#6a6258" }),
  I({ id: "hot_water_pouch", name: "Hot Water Pouch", desc: "A full canister heated at a lit Campfire. Use it (Q): a +10 °C heat pulse toward body-warm, and the empty canister comes back.", w: 1, h: 2, mass: 1.2, color: "#e08a4f" }),
  // ---- the Map kit (needs the Surveyor's Visor worn to see any of it) ----
  I({ id: "surveyor_pin", name: "Surveyor's Pin", desc: "Press E to plant one where you stand: a named mark on the Map, forever. Rename it from the maximised Map. A Pin named \"Base\" is the point your Surveyor's Visor beams you back to.", w: 1, h: 1, mass: 0.2, color: "#66e5f0" }),
  I({ id: "tracker", name: "Hidden Landmark Tracker", desc: "Use it (Q): wakes the nearest Landmark you have never found — a Town, Trader camp, cave mouth, oasis or buried canister site — and marks it on the Map. One use, then it is gone; it can never find the one-of-a-kind second wreck.", w: 1, h: 1, mass: 0.4, color: "#c08a3c" }),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));

export const BLOCK_TO_ITEM: Record<number, string> = {};
for (const it of Object.values(ITEMS)) if (it.block !== undefined) BLOCK_TO_ITEM[it.block] = it.id;
BLOCK_TO_ITEM[DOOR_UPPER] = "door"; // both door halves drop the same item
BLOCK_TO_ITEM[DOOR_INNER_UPPER] = "door_inner";
BLOCK_TO_ITEM[BED_EXT] = "bed"; // both bed halves drop the bed
BLOCK_TO_ITEM[GRASS] = "dirt";   // grass breaks to the dirt under it
BLOCK_TO_ITEM[LEAVES] = "kindling"; // leaves crumble to Kindling
// crop fallbacks: the explicit breakBlock handlers give the real harvest drops
BLOCK_TO_ITEM[MELON_1] = "seed_melon";
BLOCK_TO_ITEM[MELON_2] = "dune_melon";
BLOCK_TO_ITEM[WHEAT_1] = "seed_wheat";
BLOCK_TO_ITEM[WHEAT_2] = "wheat";
BLOCK_TO_ITEM[CACTUS_FRUIT] = "cactus";
// Husks drop their broken frame — the item, not a placeable husk block
BLOCK_TO_ITEM[REGULATOR_HUSK] = "regulator_broken";
BLOCK_TO_ITEM[STORM_BREAKER_HUSK] = "storm_breaker_broken";

// ---------------- Inventory Grid ----------------

/** One slot holds exactly one item — items never stack, anywhere. */
export interface Slot { itemId: string; x: number; y: number; rot?: boolean; charges?: number; blockRot?: number; }

/** Effective footprint of a placed item (rot swaps w/h). */
export function slotDims(s: Slot): { w: number; h: number } {
  const d = ITEMS[s.itemId];
  return s.rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

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

  /** Add items; every instance claims its own footprint. Returns count that did NOT fit. */
  addItem(itemId: string, count = 1): number {
    const def = ITEMS[itemId];
    // try every rotation, not just the item's native one
    const variants: [number, number, boolean][] =
      def.w === def.h ? [[def.w, def.h, false]] : [[def.w, def.h, false], [def.h, def.w, true]];
    for (let i = 0; i < count; i++) {
      let placed = false;
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

  /** Held item = first tool, else first placeable, else first. Managed by selection index. */
  selected = 0;
  selectedSlot(): Slot | null { return this.slots[this.selected] ?? null; }
}
