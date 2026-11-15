import {
  SAND, SANDSTONE, ROCK, GRAVEL, DIRT, SALT, DEADWOOD, GLASS, INSGLASS, HULL,
  DOOR_CLOSED, DOOR_UPPER, LAMP, METAL, BEACON, BENCH, CAMPFIRE, ADOBE, ENGINECORE, REGULATOR, CHEST,
} from "./blocks";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  w: number; h: number;      // Inventory Grid footprint (every instance claims its own cells)
  mass: number;              // kg
  block?: number;            // block it places
  tool?: { type: "pickaxe" | "shovel" | "axe" | "disassembler"; tier: number };
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
  I({ id: "metal", name: "Metal Rod", desc: "Salvaged from the wreck. The backbone of every tool.", w: 1, h: 1, mass: 1.0, block: METAL, color: "#9aa0aa" }),
  I({ id: "beacon", name: "Save Beacon", desc: "Place to permanently save. Death respawns at the newest intact beacon; beacons can never be picked back up.", w: 1, h: 2, mass: 4.0, block: BEACON, color: "#66e5f0" }),
  I({ id: "bench", name: "Crafting Bench", desc: "Unlocks the full crafting list. Stands two blocks wide in the world.", w: 1, h: 2, mass: 6.0, block: BENCH, color: "#806647" }),
  I({ id: "campfire", name: "Campfire", desc: "Burns wood. Smelts sand into glass.", w: 1, h: 2, mass: 3.0, block: CAMPFIRE, color: "#e67333" }),
  I({ id: "regulator", name: "Heat Regulator", desc: "Holds a sealed room at comfortable body temperature — 100 open cells per Regulator, capacity stacks. Sealed means sealed — an open door disables it.", w: 1, h: 1, mass: 2.5, block: REGULATOR, color: "#59bfcc" }),
  I({ id: "adobe", name: "Adobe Brick", desc: "Baked town mud. Warm, solid.", w: 1, h: 1, mass: 0.9, block: ADOBE, color: "#b3956b" }),
  I({ id: "chest", name: "Supply Chest", desc: "Stores gear in its own grid. Chests placed touching (orthogonally) merge into one bigger grid — 3×3 each, up to 3 wide, then taller.", w: 1, h: 1, mass: 5.0, block: CHEST, color: "#8a6d3b" }),
  I({ id: "canister_full", name: "Water Canister (full)", desc: "Drink to restore 25% Water. Refill at oases or the ship's water station.", w: 1, h: 2, mass: 1.0, color: "#3f8fe0" }),
  I({ id: "canister_empty", name: "Water Canister (empty)", desc: "Lighter until you find water.", w: 1, h: 1, mass: 0.3, color: "#7fa8cc" }),
  I({ id: "catalyst", name: "Catalyst", desc: "Rare alien chemistry. Found in Towns and the second wreck. Needed for Insulating Glass (M2 craft chain).", w: 1, h: 1, mass: 0.3, color: "#c07fe0" }),
  I({ id: "engine_core", name: "Engine Core", desc: "The heart of the second wreck. Quest-exclusive — place it within reach of a Save Beacon to finish the Main Quest.", w: 1, h: 1, mass: 6.0, block: ENGINECORE, color: "#c468e8" }),
  I({ id: "ironrod", name: "Iron Rod", desc: "Iron baked out of desert Rock at a Campfire. Two rods forge one Metal Rod at a Crafting Bench — tools without touching the wreck.", w: 1, h: 1, mass: 1.0, color: "#b0683f" }),
  I({ id: "visor", name: "Surveyor's Visor", desc: "A Visor upgrade. While held, the HUD marks every Death Cache, Reward Cache and Supply Chest through walls with a beam.", w: 1, h: 1, mass: 0.8, color: "#66e5f0" }),
  toolItem("pickaxe", 1, "wood", "#a8834f"), toolItem("pickaxe", 2, "stone", "#8d8680"), toolItem("pickaxe", 3, "metal", "#9aa0aa"),
  toolItem("shovel", 1, "wood", "#a8834f"), toolItem("shovel", 2, "stone", "#8d8680"), toolItem("shovel", 3, "metal", "#9aa0aa"),
  toolItem("axe", 1, "wood", "#a8834f"), toolItem("axe", 2, "stone", "#8d8680"), toolItem("axe", 3, "metal", "#9aa0aa"),
  toolItem("disassembler", 1, "metal", "#c0c8d8"),
  I({ id: "backpack1", name: "Backpack I", desc: "Inventory grid grows to 4×5. Weight limit +20 kg.", w: 2, h: 2, mass: 2.0, color: "#7a5a3a" }),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));

export const BLOCK_TO_ITEM: Record<number, string> = {};
for (const it of Object.values(ITEMS)) if (it.block !== undefined) BLOCK_TO_ITEM[it.block] = it.id;
BLOCK_TO_ITEM[DOOR_UPPER] = "door"; // both door halves drop the same item

// ---------------- Inventory Grid ----------------

export interface Slot { itemId: string; count: number; x: number; y: number; rot?: boolean; }

/** Effective footprint of a placed item (rot swaps w/h). */
export function slotDims(s: Slot): { w: number; h: number } {
  const d = ITEMS[s.itemId];
  return s.rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

export class Inventory {
  slots: Slot[] = [];
  w = 3; h = 4;
  baseLimit = 30; // kg
  bonusLimit = 0;

  constructor() { this.addItem("canister_full", 2); }

  capacity(): { w: number; h: number } { return { w: this.w, h: this.h }; }

  setBackpack(sizeW: number, sizeH: number, extraKg: number) {
    const old = this.slots;
    this.w = sizeW; this.h = sizeH; this.bonusLimit = extraKg;
    this.slots = [];
    for (const s of old) this.addItem(s.itemId, s.count);
  }

  weightLimit(): number { return this.baseLimit + this.bonusLimit; }

  weight(): number {
    let m = 0;
    for (const s of this.slots) m += ITEMS[s.itemId].mass * s.count;
    return m;
  }

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
              this.slots.push(rot ? { itemId, count: 1, x, y, rot: true } : { itemId, count: 1, x, y });
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

  /** Try to add regardless of weight (weight is not a fit constraint, only an effect). */
  removeItem(itemId: string, count = 1): number {
    let removed = 0;
    for (let i = this.slots.length - 1; i >= 0 && removed < count; i--) {
      const s = this.slots[i];
      if (s.itemId !== itemId) continue;
      const take = Math.min(s.count, count - removed);
      s.count -= take; removed += take;
      if (s.count === 0) this.slots.splice(i, 1);
    }
    return removed;
  }

  countOf(itemId: string): number {
    let n = 0;
    for (const s of this.slots) if (s.itemId === itemId) n += s.count;
    return n;
  }

  has(itemId: string, n = 1): boolean { return this.countOf(itemId) >= n; }

  /** Held item = first tool, else first placeable, else first. Managed by selection index. */
  selected = 0;
  selectedSlot(): Slot | null { return this.slots[this.selected] ?? null; }
  cycle(dir: number) {
    if (this.slots.length === 0) { this.selected = 0; return; }
    this.selected = ((this.selected + dir) % this.slots.length + this.slots.length) % this.slots.length;
  }
}
