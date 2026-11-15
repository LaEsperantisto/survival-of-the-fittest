// Block registry. Placed blocks are items stood up; items are in items.ts.

export const AIR = 0, SAND = 1, SANDSTONE = 2, ROCK = 3, GRAVEL = 4, DIRT = 5, SALT = 6,
  DEADWOOD = 7, GLASS = 8, INSGLASS = 9, HULL = 10, DOOR_CLOSED = 11, DOOR_OPEN = 12,
  LAMP = 13, METAL = 14, BEACON = 15, BENCH = 16, CAMPFIRE = 17, WATER = 18, ADOBE = 19,
  DOOR_UPPER = 20, ENGINECORE = 21, REGULATOR = 22, CHEST = 23, BENCH_EXT = 24, CACTUS = 25,
  WATER7 = 26, WATER6 = 27, WATER5 = 28, WATER4 = 29, WATER3 = 30, WATER2 = 31, WATER1 = 32,
  FARMLAND = 33, MELON_1 = 34, MELON_2 = 35, WHEAT_1 = 36, WHEAT_2 = 37, CACTUS_FRUIT = 38,
  CHEST_CONNECTOR = 39, METAL_PLATING = 40, DOOR_INNER = 41, DOOR_INNER_UPPER = 42,
  DOOR_INNER_OPEN = 43, BED = 44, BED_EXT = 45, GRASS = 46, WOOD = 47, LEAVES = 48, SAPLING = 49,
  CURVED_HULL = 50, HULL_SLOPE = 51, IRON_ORE = 52, COPPER_ORE = 53, ALABASTER = 54,
  COBALT_ORE = 55, THRUSTER = 56, THRUSTER_LIT = 57;

export type ToolType = "pickaxe" | "shovel" | "axe" | "disassembler";

export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  opaque: boolean;      // blocks light/sky for meshing
  transparent: boolean; // rendered in transparent pass
  emissive: boolean;
  // Thermal resistance contribution of one block of this material (summed along
  // the path from the player to open sky). 2.0 seals, 0 is a gap.
  R: number;
  breakTime: number;     // seconds hand-mining; -1 = unbreakable by hand rules
  tool: ToolType | null; // required tool (null = any/mining)
  fastTool?: ToolType;   // optional: this tool type breaks it much faster, but any hand works
  minTier: number;       // minimum tool tier to break (0 = hand)
  placeable: boolean;
  color: [number, number, number];
}

const def = (d: BlockDef) => d;

export const BLOCKS: BlockDef[] = [
  def({ id: AIR, name: "Air", solid: false, opaque: false, transparent: false, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0, 0, 0] }),
  def({ id: SAND, name: "Sand", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.6, tool: "shovel", minTier: 0, placeable: true, color: [0.83, 0.72, 0.50] }),
  def({ id: SANDSTONE, name: "Sandstone", solid: true, opaque: true, transparent: false, emissive: false, R: 1.2, breakTime: 1.8, tool: "pickaxe", minTier: 1, placeable: true, color: [0.76, 0.65, 0.44] }),
  def({ id: ROCK, name: "Rock", solid: true, opaque: true, transparent: false, emissive: false, R: 1.5, breakTime: 3.2, tool: "pickaxe", minTier: 1, placeable: true, color: [0.45, 0.42, 0.40] }),
  def({ id: GRAVEL, name: "Gravel", solid: true, opaque: true, transparent: false, emissive: false, R: 0.7, breakTime: 0.7, tool: "shovel", minTier: 0, placeable: true, color: [0.55, 0.52, 0.50] }),
  def({ id: DIRT, name: "Dirt", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.6, tool: "shovel", minTier: 0, placeable: true, color: [0.42, 0.32, 0.22] }),
  def({ id: SALT, name: "Salt Crust", solid: true, opaque: true, transparent: false, emissive: false, R: 0.6, breakTime: 0.5, tool: "shovel", minTier: 0, placeable: true, color: [0.85, 0.86, 0.84] }),
  def({ id: DEADWOOD, name: "Dead Wood", solid: true, opaque: true, transparent: false, emissive: false, R: 0.6, breakTime: 1.2, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.38, 0.30, 0.22] }),
  def({ id: GLASS, name: "Glass", solid: true, opaque: false, transparent: true, emissive: false, R: 0.15, breakTime: 0.4, tool: null, minTier: 0, placeable: true, color: [0.65, 0.8, 0.9] }),
  def({ id: INSGLASS, name: "Insulating Glass", solid: true, opaque: false, transparent: true, emissive: false, R: 2.0, breakTime: 1.2, tool: null, minTier: 0, placeable: true, color: [0.55, 0.75, 0.62] }),
  def({ id: HULL, name: "Hull Plating", solid: true, opaque: true, transparent: false, emissive: false, R: 3, breakTime: 6, tool: "disassembler", minTier: 0, placeable: true, color: [0.52, 0.55, 0.6] }),
  // Doors are two blocks tall: DOOR_CLOSED is the bottom half (handle), DOOR_UPPER the top half (window).
  def({ id: DOOR_CLOSED, name: "Door (closed)", solid: true, opaque: true, transparent: false, emissive: false, R: 3, breakTime: 2, tool: "disassembler", minTier: 0, placeable: true, color: [0.60, 0.62, 0.66] }),
  // Open door: the leaf stands in the frame edge-on — see-through, walk-through.
  def({ id: DOOR_OPEN, name: "Door (open)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: "disassembler", minTier: 0, placeable: false, color: [0.35, 0.36, 0.4] }),
  def({ id: LAMP, name: "Lamp", solid: true, opaque: true, transparent: false, emissive: true, R: 1.0, breakTime: 0.5, tool: null, minTier: 0, placeable: true, color: [1.0, 0.9, 0.6] }),
  def({ id: METAL, name: "Metal Block", solid: true, opaque: true, transparent: false, emissive: false, R: 0.3, breakTime: 4, tool: "disassembler", minTier: 0, placeable: true, color: [0.6, 0.62, 0.68] }),
  def({ id: BEACON, name: "Save Beacon", solid: true, opaque: true, transparent: false, emissive: true, R: 0.5, breakTime: -1, tool: null, minTier: 0, placeable: true, color: [0.4, 0.9, 0.95] }),
  def({ id: BENCH, name: "Crafting Bench", solid: true, opaque: true, transparent: false, emissive: false, R: 0.5, breakTime: 1.0, tool: null, minTier: 0, placeable: true, color: [0.5, 0.4, 0.3] }),
  def({ id: CAMPFIRE, name: "Campfire", solid: true, opaque: false, transparent: false, emissive: true, R: 0, breakTime: 0.5, tool: null, minTier: 0, placeable: true, color: [0.9, 0.45, 0.2] }),
  def({ id: WATER, name: "Water", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.1, 0.35, 0.75] }),
  def({ id: ADOBE, name: "Adobe Brick", solid: true, opaque: true, transparent: false, emissive: false, R: 1.6, breakTime: 1.5, tool: "pickaxe", minTier: 0, placeable: true, color: [0.7, 0.58, 0.42] }),
  // Appended in id order: BLOCKS is indexed by id (DOOR_UPPER=20, ENGINECORE=21).
  def({ id: DOOR_UPPER, name: "Door (closed top)", solid: true, opaque: true, transparent: false, emissive: false, R: 3, breakTime: 2, tool: "disassembler", minTier: 0, placeable: true, color: [0.60, 0.62, 0.66] }),
  // Quest-exclusive artifact block: the heart of the second wreck.
  def({ id: ENGINECORE, name: "Engine Core", solid: true, opaque: true, transparent: false, emissive: true, R: 0.5, breakTime: 4, tool: null, minTier: 0, placeable: true, color: [0.78, 0.42, 0.9] }),
  // Heat Regulator: holds a sealed room at body-neutral temperature; 100 open cells
  // of capacity each, capacity stacks; see world.roomInfo. A bolted appliance: only
  // a Metal Disassembler takes it down.
  def({ id: REGULATOR, name: "Heat Regulator", solid: true, opaque: true, transparent: false, emissive: false, R: 0.5, breakTime: 1.5, tool: "disassembler", minTier: 1, placeable: true, color: [0.35, 0.75, 0.8] }),
  // Supply Chest: a real container block. Orthogonally linked chests merge inventories.
  def({ id: CHEST, name: "Supply Chest", solid: true, opaque: true, transparent: false, emissive: false, R: 0.9, breakTime: 1.5, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.54, 0.43, 0.27] }),
  // The Crafting Bench stands two blocks wide: BENCH is the working top, this the
  // drawer-and-legs frame. Placed and broken as a pair with BENCH.
  def({ id: BENCH_EXT, name: "Crafting Bench (frame)", solid: true, opaque: true, transparent: false, emissive: false, R: 0.5, breakTime: 1.0, tool: null, minTier: 0, placeable: false, color: [0.45, 0.36, 0.27] }),
  // Cactus: desert flora. Solid — you can't walk through it, and pressing into
  // one pricks you (game.ts). Bare blocks drop their wood; only the fruit-topped
  // variant (CACTUS_FRUIT, grown or world-generated) drops a Prickly Pear.
  def({ id: CACTUS, name: "Cactus", solid: true, opaque: true, transparent: false, emissive: false, R: 0.4, breakTime: 0.9, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.24, 0.5, 0.26] }),
  // Flowing water (see world water sim): WATER is a Source; WATER7..WATER1 are flow
  // levels 7..1 — id = 33 − level. Flow needs a feed: a Source or higher level beside
  // it, or same-or-higher level above. No feed → it drains.
  def({ id: WATER7, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.13, 0.40, 0.80] }),
  def({ id: WATER6, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.12, 0.39, 0.78] }),
  def({ id: WATER5, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.11, 0.37, 0.76] }),
  def({ id: WATER4, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.10, 0.36, 0.74] }),
  def({ id: WATER3, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.09, 0.34, 0.71] }),
  def({ id: WATER2, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.08, 0.31, 0.68] }),
  def({ id: WATER1, name: "Water (flowing)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: null, minTier: 0, placeable: false, color: [0.07, 0.29, 0.64] }),
  // Farm land: tilled sand/dirt that crops grow in. Shovel-fast, drops as item.
  def({ id: FARMLAND, name: "Farm Land", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.5, tool: null, fastTool: "shovel", minTier: 0, placeable: true, color: [0.34, 0.24, 0.14] }),
  // Crops (see survival.growCrops): you plant a Melon or Wheat seed as stage 1,
  // it matures to stage 2, and breaking the mature crop gives food plus fresh seed.
  // Crops stand non-solid in tilled ground; Wheat tolerates cold, Melon loves heat,
  // and everything but Cactus stalls if the outdoor air leaves its band.
  def({ id: MELON_1, name: "Melon Sprout", solid: false, opaque: true, transparent: false, emissive: false, R: 0, breakTime: 0.2, tool: null, minTier: 0, placeable: false, color: [0.28, 0.52, 0.28] }),
  def({ id: MELON_2, name: "Dune Melon", solid: false, opaque: true, transparent: false, emissive: false, R: 0, breakTime: 0.3, tool: null, minTier: 0, placeable: false, color: [0.42, 0.56, 0.24] }),
  def({ id: WHEAT_1, name: "Wheat Sprout", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0.2, tool: null, minTier: 0, placeable: false, color: [0.66, 0.66, 0.34] }),
  def({ id: WHEAT_2, name: "Desert Wheat", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0.3, tool: null, minTier: 0, placeable: false, color: [0.84, 0.74, 0.32] }),
  // Fruit-topped cactus column block: harvest it for a Prickly Pear, the column
  // stays and regrows the fruit on its own.
  def({ id: CACTUS_FRUIT, name: "Fruiting Cactus", solid: true, opaque: true, transparent: false, emissive: false, R: 0.4, breakTime: 0.9, tool: null, fastTool: "axe", minTier: 0, placeable: false, color: [0.3, 0.5, 0.34] }),
  // Chest Connector: a steel rail that links two Supply Chest clusters so they
  // share one Inventory Grid. It stores nothing itself.
  def({ id: CHEST_CONNECTOR, name: "Chest Connector", solid: true, opaque: true, transparent: false, emissive: false, R: 0.9, breakTime: 1.2, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.48, 0.4, 0.26] }),
  // Metal Plating: the ship's inner floor-and-skin plating — same properties as a
  // Metal Block; the wreck is plated, not roped.
  def({ id: METAL_PLATING, name: "Metal Plating", solid: true, opaque: true, transparent: false, emissive: false, R: 0.3, breakTime: 4, tool: "disassembler", minTier: 0, placeable: true, color: [0.58, 0.6, 0.66] }),
  // Inside Doors: interior bulkhead doors — in temperature terms exactly AIR,
  // open or closed (R 0; roomInfo passes air straight through them). They divide
  // rooms visually and for movement only; the Ship's outside doors insulate.
  def({ id: DOOR_INNER, name: "Inside Door (closed)", solid: true, opaque: true, transparent: false, emissive: false, R: 0, breakTime: 1.5, tool: "disassembler", minTier: 0, placeable: true, color: [0.5, 0.52, 0.56] }),
  def({ id: DOOR_INNER_UPPER, name: "Inside Door (closed top)", solid: true, opaque: true, transparent: false, emissive: false, R: 0, breakTime: 1.5, tool: "disassembler", minTier: 0, placeable: true, color: [0.5, 0.52, 0.56] }),
  def({ id: DOOR_INNER_OPEN, name: "Inside Door (open)", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0, tool: "disassembler", minTier: 0, placeable: false, color: [0.3, 0.32, 0.36] }),
  // Bed: a soft 2x1 placeable; sleeping in it skips to morning (one long sleep
  // every eight game hours). Bed + Bed (frame) are placed and broken as a pair.
  def({ id: BED, name: "Bed", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.8, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.72, 0.3, 0.28] }),
  def({ id: BED_EXT, name: "Bed (pillow)", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.8, tool: null, fastTool: "axe", minTier: 0, placeable: false, color: [0.6, 0.25, 0.24] }),
  // Grass: dirt's green living cover, found at Oases and Towns; it breaks to Dirt.
  def({ id: GRASS, name: "Grass", solid: true, opaque: true, transparent: false, emissive: false, R: 0.8, breakTime: 0.5, tool: "shovel", minTier: 0, placeable: false, color: [0.34, 0.55, 0.28] }),
  // Living Tree trunk — the renewable counterpart of Dead Wood.
  def({ id: WOOD, name: "Wood Log", solid: true, opaque: true, transparent: false, emissive: false, R: 0.6, breakTime: 1.1, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.44, 0.35, 0.24] }),
  // Leaves: walk-blocking, partly shade the sky (R 0.7 — never seals a Space),
  // and crumble into Kindling.
  def({ id: LEAVES, name: "Leaves", solid: true, opaque: true, transparent: false, emissive: false, R: 0.7, breakTime: 0.25, tool: null, minTier: 0, placeable: false, color: [0.2, 0.45, 0.2] }),
  // A planted Tree Seed — a growing tree's first stage; see game.updateTrees.
  def({ id: SAPLING, name: "Sapling", solid: false, opaque: false, transparent: true, emissive: false, R: 0, breakTime: 0.2, tool: null, minTier: 0, placeable: false, color: [0.3, 0.55, 0.3] }),
  // Curved Hull Plating: the same insulating hull metal, drawn as real geometry —
  // a corner-cut elbow and a top-slope — used to round the Ship's corners and spine.
  def({ id: CURVED_HULL, name: "Curved Hull Plating", solid: true, opaque: true, transparent: false, emissive: false, R: 3, breakTime: 6, tool: "disassembler", minTier: 0, placeable: true, color: [0.52, 0.55, 0.6] }),
  def({ id: HULL_SLOPE, name: "Hull Slope", solid: true, opaque: true, transparent: false, emissive: false, R: 3, breakTime: 6, tool: "disassembler", minTier: 0, placeable: true, color: [0.5, 0.53, 0.58] }),
  // Minerals: ore blocks that crust the walls of Caves (see gen.ts). Each drops
  // its Raw Ore; Campfires smelt Rods out of them. Cobalt veins run only in the
  // deepest stone — the Ship's repair hangs on them.
  def({ id: IRON_ORE, name: "Iron Ore", solid: true, opaque: true, transparent: false, emissive: false, R: 1.5, breakTime: 2.6, tool: "pickaxe", minTier: 1, placeable: true, color: [0.62, 0.52, 0.42] }),
  def({ id: COPPER_ORE, name: "Copper Ore", solid: true, opaque: true, transparent: false, emissive: false, R: 1.5, breakTime: 2.6, tool: "pickaxe", minTier: 1, placeable: true, color: [0.72, 0.42, 0.26] }),
  def({ id: ALABASTER, name: "Alabaster", solid: true, opaque: true, transparent: false, emissive: false, R: 1.4, breakTime: 1.8, tool: "pickaxe", minTier: 0, placeable: true, color: [0.86, 0.83, 0.74] }),
  def({ id: COBALT_ORE, name: "Cobalt Ore", solid: true, opaque: true, transparent: false, emissive: false, R: 1.6, breakTime: 4.2, tool: "pickaxe", minTier: 3, placeable: true, color: [0.36, 0.46, 0.68] }),
  // Broken Thruster: one of the wreck's four dead wingtip engines. Bolted to the
  // Ship: nothing takes it down; its only interaction is a Thruster Nozzle (E).
  def({ id: THRUSTER, name: "Broken Thruster", solid: true, opaque: true, transparent: false, emissive: false, R: 1, breakTime: -1, tool: null, minTier: 0, placeable: false, color: [0.42, 0.44, 0.5] }),
  def({ id: THRUSTER_LIT, name: "Thruster (lit)", solid: true, opaque: true, transparent: false, emissive: true, R: 1, breakTime: -1, tool: null, minTier: 0, placeable: false, color: [0.9, 0.6, 0.3] }),
];

export const CH = 96;           // world height (Y)
export const CS = 16;           // chunk side (X/Z)
export const DAY_SECONDS = 24 * 60; // one in-game day = 24 real minutes

export function isSolid(id: number): boolean { return BLOCKS[id].solid; }
export function isOpaque(id: number): boolean { return BLOCKS[id].opaque; }
// Water: WATER is a Source (strength 8); WATER7..WATER1 are flow levels 7..1 (id = 33 − level).
export function isWater(id: number): boolean { return id === WATER || (id >= WATER7 && id <= WATER1); }
export function waterStrength(id: number): number { return id === WATER ? 8 : isWater(id) ? 33 - id : 0; }
export function flowId(level: number): number { return 33 - level; }
