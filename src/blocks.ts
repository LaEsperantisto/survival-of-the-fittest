// Block registry. Placed blocks are items stood up; items are in items.ts.

export const AIR = 0, SAND = 1, SANDSTONE = 2, ROCK = 3, GRAVEL = 4, DIRT = 5, SALT = 6,
  DEADWOOD = 7, GLASS = 8, INSGLASS = 9, HULL = 10, DOOR_CLOSED = 11, DOOR_OPEN = 12,
  LAMP = 13, METAL = 14, BEACON = 15, BENCH = 16, CAMPFIRE = 17, WATER = 18, ADOBE = 19,
  DOOR_UPPER = 20, ENGINECORE = 21, REGULATOR = 22, CHEST = 23, BENCH_EXT = 24, CACTUS = 25;

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
  // of capacity each, capacity stacks; see world.roomInfo.
  def({ id: REGULATOR, name: "Heat Regulator", solid: true, opaque: true, transparent: false, emissive: false, R: 0.5, breakTime: 1.5, tool: null, minTier: 0, placeable: true, color: [0.35, 0.75, 0.8] }),
  // Supply Chest: a real container block. Orthogonally linked chests merge inventories.
  def({ id: CHEST, name: "Supply Chest", solid: true, opaque: true, transparent: false, emissive: false, R: 0.9, breakTime: 1.5, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.54, 0.43, 0.27] }),
  // The Crafting Bench stands two blocks wide: BENCH is the working top, this the
  // drawer-and-legs frame. Placed and broken as a pair with BENCH.
  def({ id: BENCH_EXT, name: "Crafting Bench (frame)", solid: true, opaque: true, transparent: false, emissive: false, R: 0.5, breakTime: 1.0, tool: null, minTier: 0, placeable: false, color: [0.45, 0.36, 0.27] }),
  // Cactus: desert flora; breaking one yields its Prickly Pear fruit plus the block.
  def({ id: CACTUS, name: "Cactus", solid: true, opaque: true, transparent: false, emissive: false, R: 0.4, breakTime: 0.9, tool: null, fastTool: "axe", minTier: 0, placeable: true, color: [0.24, 0.5, 0.26] }),
];

export const CH = 96;           // world height (Y)
export const CS = 16;           // chunk side (X/Z)
export const DAY_SECONDS = 24 * 60; // one in-game day = 24 real minutes

export function isSolid(id: number): boolean { return BLOCKS[id].solid; }
export function isOpaque(id: number): boolean { return BLOCKS[id].opaque; }
