import { Inventory } from "./items";

export interface Recipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  station: "bench" | "armory" | "refinery" | "electric" | "assembly" | "fuel" | "foundry"
    | "hearth" | "workbench" | "wiring" | "tannery" | "cauldron" | "oilworks" | "still" | null; // where it must be crafted; null = by hand
  returns?: Record<string, number>; // containers handed back after crafting (the oil bucket)
  locked?: boolean; // hidden from Craft/Catalog until the Nav Core is unlocked
}

export const RECIPES: Recipe[] = [
  { out: "bench", count: 1, needs: { deadwood: 4 }, station: null },
  { out: "armory", count: 1, needs: { deadwood: 4, metal: 2 }, station: "bench" },
  { out: "campfire", count: 1, needs: { rock: 6, deadwood: 2 }, station: null },
  { out: "wood_pickaxe", count: 1, needs: { deadwood: 3 }, station: null },
  { out: "wood_shovel", count: 1, needs: { deadwood: 3 }, station: null },
  { out: "wood_axe", count: 1, needs: { deadwood: 3 }, station: null },
  // Alloy (tier 4): Copper Rods bound with Metal - faster tools, a better disassembler.
  { out: "alloy_pickaxe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_shovel", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_axe", count: 1, needs: { metal: 2, copperrod: 2, deadwood: 1 }, station: "bench" },
  { out: "alloy_disassembler", count: 1, needs: { metal: 3, copperrod: 2, rock: 2 }, station: "bench" },
  { out: "stone_pickaxe", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "stone_shovel", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "stone_axe", count: 1, needs: { rock: 3, deadwood: 2 }, station: "bench" },
  { out: "metal_pickaxe", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_shovel", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_axe", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "metal_disassembler", count: 1, needs: { metal: 4, rock: 2 }, station: "bench" },
  // ---- what the underground unlocks ----
  // body-slot gear, packs and visors are forged at the Armoury, not the Bench
  { out: "backpack2", count: 1, needs: { deadwood: 10, metal: 4, snake_skin: 2 }, station: "armory" },
  { out: "wurmsuit", count: 1, needs: { wurm_hide: 3, chitin: 1 }, station: "armory" },
  { out: "tortoise_cuirass", count: 1, needs: { tortoise_shell: 3, metal: 1 }, station: "armory" },
  { out: "stinger_blade", count: 1, needs: { metal: 2, stinger: 1, deadwood: 1 }, station: "bench" },
  { out: "body_regulator", count: 1, needs: { metal: 4, copperrod: 2, cobaltrod: 1, catalyst: 1 }, station: "armory" },
  { out: "coolant_cell", count: 1, needs: { salt: 2, canister_empty: 1, copperrod: 1 }, station: "bench" },
  { out: "head_lantern", count: 1, needs: { metal: 1, glass: 1, copperrod: 1, deadwood: 1 }, station: "bench" },
  { out: "curved_hull", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "hull_slope", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "thruster_nozzle", count: 1, needs: { cobaltrod: 1, copperrod: 2, metal: 1 }, station: "bench" },
  // The Ship kit: eight Corners declare the Frame, the yoke flies it, and a spare
  // Nozzle plus Rods builds a whole engine.
  { out: "frame_corner", count: 1, needs: { metal_plating: 2, copperrod: 1 }, station: "bench" },
  { out: "flight_controls", count: 1, needs: { metal_plating: 4, copperrod: 2, glass: 1 }, station: "bench" },
  { out: "thruster", count: 1, needs: { thruster_nozzle: 1, metal_plating: 4, cobaltrod: 1 }, station: "bench" },
  // Grid power (ADR-0007): the whole chain is Electric Bench kit (ADR-0013); Copper Rods are the wires.
  { out: "power_pole", count: 2, needs: { metal: 1, deadwood: 3 }, station: "electric" },
  { out: "power_panel", count: 1, needs: { metal: 4, copperrod: 2, glass: 1 }, station: "electric" },
  { out: "gen_wood", count: 1, needs: { metal: 4, copperrod: 2, rock: 3 }, station: "electric" },
  { out: "wind_turbine", count: 1, needs: { metal: 3, copperrod: 2, wood_log: 4 }, station: "electric" },
  { out: "solar_panel", count: 1, needs: { glass: 3, copperrod: 2, metal: 2 }, station: "electric" },
  { out: "battery", count: 1, needs: { metal: 3, copperrod: 2, salt: 3 }, station: "electric" },
  { out: "elec_lamp", count: 1, needs: { glass: 2, metal: 1, copperrod: 1 }, station: "electric" },
  { out: "inserter", count: 1, needs: { metal: 4, copperrod: 2, glass: 2 }, station: "electric" },
  { out: "planter", count: 1, needs: { wood_log: 4, metal: 2, glass: 1 }, station: "electric" },
  { out: "harvester", count: 1, needs: { metal: 5, glass: 2 }, station: "electric" },
  { out: "refinery", count: 1, needs: { metal_plating: 3, copperrod: 2, glass: 1 }, station: "bench" },
  { out: "rocket_fuel", count: 1, needs: { oil_bucket: 1, coal_ore: 1 }, station: "refinery", returns: { bucket: 1 } },
  { out: "sword", count: 1, needs: { metal: 2, deadwood: 1 }, station: "bench" },
  { out: "door", count: 1, needs: { metal: 2, deadwood: 2 }, station: "bench" },
  { out: "hull", count: 2, needs: { metal: 2, sand: 2 }, station: "bench" },
  { out: "lamp", count: 1, needs: { metal: 1, glass: 1, salt: 2 }, station: "bench" },
  { out: "beacon", count: 1, needs: { metal: 4, sandstone: 6, lamp: 1 }, station: "bench" },
  { out: "backpack1", count: 1, needs: { deadwood: 6, metal: 2 }, station: "armory" },
  { out: "insglass", count: 2, needs: { glass: 2, metal: 1 }, station: "bench" },
  { out: "regulator", count: 1, needs: { metal: 4, glass: 1, salt: 2 }, station: "electric" },
  // Husk repairs: the broken frame plus about half the build recipe.
  { out: "regulator", count: 1, needs: { regulator_broken: 1, metal: 2, glass: 1, salt: 1 }, station: "electric" },
  { out: "chest", count: 1, needs: { deadwood: 4 }, station: "electric" },
  { out: "visor", count: 1, needs: { metal: 2, glass: 1, salt: 2 }, station: "armory" },
  { out: "reptile_armor", count: 1, needs: { snake_skin: 3 }, station: "armory" },
  // ---- farming & building ----
  // Farm Land is never crafted — a shovel opens a furrow in real soil, that's it
  { out: "deadwood", count: 2, needs: { wood_log: 1 }, station: null },
  { out: "chest_connector", count: 1, needs: { deadwood: 1 }, station: "electric" },
  { out: "chest_interface", count: 1, needs: { metal: 2, glass: 1 }, station: "electric" },
  { out: "cooking_pot", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "water_cage", count: 1, needs: { metal: 2, glass: 1 }, station: "bench" },
  { out: "metal_plating", count: 1, needs: { metal: 1 }, station: null },
  { out: "door_inner", count: 1, needs: { metal: 1 }, station: "bench" },
  // Alabaster masonry: everything cut from the Cave's raw stone — no catalyst.
  { out: "alab_bricks", count: 8, needs: { alabaster: 4 }, station: "bench" },
  { out: "alab_polished", count: 1, needs: { alabaster: 1 }, station: "bench" },
  { out: "alab_chiselled", count: 1, needs: { alab_bricks: 2 }, station: "bench" },
  { out: "alab_pillar", count: 1, needs: { alabaster: 2 }, station: "bench" },
  { out: "alab_fence", count: 3, needs: { alabaster: 1 }, station: "bench" },
  { out: "alab_gate", count: 1, needs: { alab_fence: 3 }, station: "bench" },
  { out: "alab_door", count: 1, needs: { alabaster: 6 }, station: "bench" },
  // Sandstorm Breaker: catalyst-free on purpose — storm-proofing must be expandable.
  { out: "storm_breaker", count: 1, needs: { metal: 2, glass: 1 }, station: "electric" },
  { out: "storm_breaker", count: 1, needs: { storm_breaker_broken: 1, metal: 1, glass: 1 }, station: "electric" },
  { out: "bucket", count: 1, needs: { metal: 2 }, station: "bench" },
  { out: "bed", count: 1, needs: { deadwood: 3, snake_skin: 2 }, station: "bench" },
  // ---- the Map kit ----
  { out: "surveyor_pin", count: 4, needs: { metal: 1, glass: 1 }, station: "bench" },
  { out: "tracker", count: 1, needs: { metal: 2, copperrod: 1, glass: 1 }, station: "bench" },
  // ---- Sacks (ADR-0008): canvas and cord only until the cobalt rim ----
  { out: "sack1", count: 1, needs: { deadwood: 4 }, station: "bench" },
  { out: "sack2", count: 1, needs: { deadwood: 6, metal: 2 }, station: "bench" },
  { out: "sack3", count: 1, needs: { wood_log: 4, cobaltrod: 4 }, station: "bench" },
  // ---- Silvaris (Phase 2, ADR-0013/0014): each new station is built at the one before it ----
  { out: "electric_bench", count: 1, needs: { metal_plating: 4, copperrod: 2, glass: 2 }, station: "bench" },
  { out: "assembly_bench", count: 1, needs: { metal_plating: 6, copperrod: 2, glass: 2 }, station: "electric" },
  { out: "foundry", count: 1, needs: { metal_plating: 6, copperrod: 2, coal_ore: 2 }, station: "electric" },
  { out: "fuel_works", count: 1, needs: { metal_plating: 4, glass: 2, copperrod: 2 }, station: "assembly" },
  // The Engine Core is kit now — the wreck's was only the first one.
  { out: "engine_core", count: 1, needs: { metal_plating: 6, cobaltrod: 2, copperrod: 2, glass: 2 }, station: "assembly" },
  { out: "dock_pad", count: 1, needs: { steel_plating: 2, metal_plating: 1 }, station: "assembly" },
  { out: "titaniumrod", count: 1, needs: { titanium_ore: 1 }, station: "foundry" },
  { out: "steel_plating", count: 1, needs: { titaniumrod: 2, charcoal: 1 }, station: "foundry" },
  // ---- Defenses, Desertis side: spikes by hand, wired kit at the Electric Bench ----
  { out: "spikes", count: 1, needs: { deadwood: 4, rock: 2 }, station: "bench" },
  { out: "alarm_chime", count: 1, needs: { copperrod: 2, glass: 1, machine_part: 1 }, station: "electric" },
  { out: "gun_turret", count: 1, needs: { metal_plating: 4, copperrod: 2, machine_part: 2 }, station: "electric" },
  { out: "shock_coil", count: 1, needs: { copperrod: 4, glass: 2, machine_part: 2 }, station: "electric" },
  { out: "slug", count: 8, needs: { metal: 1 }, station: "foundry" },
  // ============ Phase 2 fork (2026-11-24): two chains, one Scrap seam (ADR-0014) ============
  // Nothing on the Silvaris side reads desert materials, and vice versa.
  // ---- Silvaris stations: the Workbench chain starts by hand ----
  { out: "hearth", count: 1, needs: { basalt: 6, sil_timber: 2 }, station: null },
  { out: "workbench", count: 1, needs: { basalt: 4, sil_timber: 8 }, station: null },
  { out: "tannery", count: 1, needs: { basalt: 6, bone: 4, sil_timber: 4 }, station: "workbench" },
  { out: "wiring_bench", count: 1, needs: { leadrod: 4, glass: 2, basalt: 4 }, station: "workbench" },
  { out: "oil_works", count: 1, needs: { titan_plating: 2, glass: 3, leadrod: 2 }, station: "wiring" },
  // Station twins: the Silvaris kitchen; the Recyclers eat the worlds' gear.
  { out: "cauldron", count: 1, needs: { basalt: 6, leadrod: 2 }, station: "workbench" },
  { out: "recycler", count: 1, needs: { metal_plating: 4, rock: 4 }, station: "bench" },
  { out: "sil_recycler", count: 1, needs: { titan_plating: 2, basalt: 4, charcoal: 2 }, station: "workbench" },
  // The Fuel Still only appears in the books after the Sentinel falls.
  { out: "fuel_still", count: 1, needs: { metal_plating: 4, glass: 2, coal_ore: 2 }, station: "electric", locked: true },
  { out: "fuel_still", count: 1, needs: { titan_plating: 2, glass: 2, charcoal: 2 }, station: "wiring", locked: true },
  // ---- Foundry refining: the Hearth fires, the Foundry rolls ----
  { out: "flux", count: 1, needs: { leadrod: 1, saltpetre: 1 }, station: "hearth" },
  { out: "titan_plating", count: 1, needs: { titaniumrod: 1, flux: 1 }, station: "foundry" },
  // ---- Power family, Wiring Bench twins (Lead, Glass, Saltpetre, Silvertimber) ----
  { out: "power_pole", count: 2, needs: { leadrod: 1, sil_timber: 3 }, station: "wiring" },
  { out: "power_panel", count: 1, needs: { leadrod: 4, glass: 2 }, station: "wiring" },
  { out: "gen_wood", count: 1, needs: { leadrod: 4, glass: 2, basalt: 3 }, station: "wiring" },
  { out: "battery", count: 1, needs: { leadrod: 3, glass: 2, saltpetre: 3 }, station: "wiring" },
  { out: "elec_lamp", count: 1, needs: { glass: 2, leadrod: 1, saltpetre: 1 }, station: "wiring" },
  { out: "storm_breaker", count: 1, needs: { leadrod: 2, glass: 1 }, station: "wiring" },
  { out: "regulator", count: 1, needs: { leadrod: 4, glass: 2, saltpetre: 2 }, station: "wiring" },
  { out: "regulator", count: 1, needs: { regulator_broken: 1, leadrod: 2, glass: 1, saltpetre: 1 }, station: "wiring" },
  { out: "chest", count: 1, needs: { sil_timber: 4 }, station: "workbench" },
  { out: "chest_connector", count: 1, needs: { sil_timber: 1 }, station: "wiring" },
  { out: "chest_interface", count: 1, needs: { leadrod: 2, glass: 1 }, station: "wiring" },
  // ---- Tools: the Basalt–Bone–Titanium–Carbide ladder, all at the Workbench ----
  { out: "basalt_pickaxe", count: 1, needs: { basalt: 3, sil_timber: 2 }, station: "workbench" },
  { out: "basalt_shovel", count: 1, needs: { basalt: 3, sil_timber: 2 }, station: "workbench" },
  { out: "basalt_axe", count: 1, needs: { basalt: 3, sil_timber: 2 }, station: "workbench" },
  { out: "basalt_knife", count: 1, needs: { basalt: 2, sil_timber: 1 }, station: "workbench" },
  { out: "bone_pickaxe", count: 1, needs: { bone: 3, sil_timber: 2 }, station: "workbench" },
  { out: "bone_shovel", count: 1, needs: { bone: 3, sil_timber: 2 }, station: "workbench" },
  { out: "bone_axe", count: 1, needs: { bone: 3, sil_timber: 2 }, station: "workbench" },
  { out: "bone_knife", count: 1, needs: { bone: 2, sil_timber: 1 }, station: "workbench" },
  { out: "bone_disassembler", count: 1, needs: { bone: 4, basalt: 2 }, station: "workbench" },
  { out: "bone_bucket", count: 1, needs: { bone: 3 }, station: "workbench" },
  { out: "titanium_pickaxe", count: 1, needs: { titaniumrod: 2, sil_timber: 1 }, station: "workbench" },
  { out: "titanium_shovel", count: 1, needs: { titaniumrod: 2, sil_timber: 1 }, station: "workbench" },
  { out: "titanium_axe", count: 1, needs: { titaniumrod: 2, sil_timber: 1 }, station: "workbench" },
  { out: "titanium_knife", count: 1, needs: { titaniumrod: 1, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_pickaxe", count: 1, needs: { titaniumrod: 1, charcoal: 2, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_shovel", count: 1, needs: { titaniumrod: 1, charcoal: 2, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_axe", count: 1, needs: { titaniumrod: 1, charcoal: 2, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_knife", count: 1, needs: { titaniumrod: 1, charcoal: 1, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_disassembler", count: 1, needs: { titaniumrod: 2, charcoal: 2, basalt: 2 }, station: "workbench" },
  { out: "bone_harpoon", count: 1, needs: { bone: 4, sil_timber: 2 }, station: "workbench" },
  { out: "titanium_harpoon", count: 1, needs: { titaniumrod: 2, bone: 2, sil_timber: 1 }, station: "workbench" },
  { out: "carbide_harpoon", count: 1, needs: { titaniumrod: 2, charcoal: 2, sil_timber: 1 }, station: "workbench" },
  // ---- Gear: hides at the Tannery; the desert gets one cactus kit at the Armoury ----
  { out: "buckguard", count: 1, needs: { hardhide: 3 }, station: "tannery" },
  { out: "snowcloak", count: 1, needs: { frost_pelt: 3, hardhide: 1 }, station: "tannery" },
  { out: "tideback_cuirass", count: 1, needs: { tideback_hide: 3, hardhide: 2 }, station: "tannery" },
  { out: "dune_wrap", count: 1, needs: { cactus_leather: 3, snake_skin: 2 }, station: "armory" },
  { out: "bed", count: 1, needs: { sil_timber: 3, frost_pelt: 2 }, station: "workbench" },
  // ---- Building: posts, rails, tables, stained glass — both worlds ----
  { out: "timber_post", count: 2, needs: { deadwood: 1 }, station: null },
  { out: "timber_railing", count: 3, needs: { deadwood: 1 }, station: null },
  { out: "timber_post", count: 2, needs: { sil_timber: 1 }, station: null },
  { out: "timber_railing", count: 3, needs: { sil_timber: 1 }, station: null },
  { out: "table", count: 1, needs: { deadwood: 4 }, station: "bench" },
  { out: "table", count: 1, needs: { sil_timber: 4 }, station: "workbench" },
  { out: "stained_glass", count: 2, needs: { glass: 2, coal_ore: 1 }, station: "bench" },
  { out: "stained_glass", count: 2, needs: { glass: 2, charcoal: 1 }, station: "foundry" },
  // ---- Oil, Salvage, Parts: the seams between the worlds ----
  { out: "sil_oil", count: 4, needs: { sil_timber: 1 }, station: "oilworks" },
  { out: "rocket_fuel", count: 1, needs: { sil_oil: 2, charcoal: 1 }, station: "oilworks" }, // Silvaris refinery line
  { out: "machine_part", count: 2, needs: { scrap: 3 }, station: "wiring" },
  // ---- Defenses: placed kit, Slugs feed the Turret ----
  { out: "spikes", count: 1, needs: { basalt: 4, bone: 2 }, station: "workbench" },
  { out: "alarm_chime", count: 1, needs: { leadrod: 2, glass: 1, machine_part: 1 }, station: "wiring" },
  { out: "gun_turret", count: 1, needs: { titan_plating: 4, machine_part: 2, leadrod: 2 }, station: "wiring" },
  { out: "shock_coil", count: 1, needs: { leadrod: 4, glass: 2, machine_heart: 1 }, station: "wiring" },
  { out: "lead_slug", count: 8, needs: { leadrod: 1 }, station: "foundry" },
  // ---- The Hover Sled and its upgrades ----
  { out: "hover_sled", count: 1, needs: { titan_plating: 6, machine_heart: 1, leadrod: 4, scrap: 2 }, station: "wiring" },
  { out: "cargo_sled", count: 1, needs: { titan_plating: 3, chest: 1, scrap: 2 }, station: "wiring" },
  { out: "sled_blade", count: 1, needs: { titan_plating: 4, machine_part: 2, scrap: 2 }, station: "wiring" },
  { out: "sled_drill", count: 1, needs: { titan_plating: 4, machine_part: 3, scrap: 2 }, station: "wiring" },
  // ---- The Ship kit, Silvaris side: the whole chain runs off the Wiring Bench ----
  { out: "engine_core", count: 1, needs: { titan_plating: 6, titaniumrod: 2, leadrod: 2, glass: 2 }, station: "wiring" },
  { out: "thruster_nozzle", count: 1, needs: { leadrod: 1, titaniumrod: 2, basalt: 1 }, station: "wiring" },
  { out: "thruster", count: 1, needs: { thruster_nozzle: 1, titan_plating: 4, titaniumrod: 1 }, station: "wiring" },
  { out: "frame_corner", count: 1, needs: { titan_plating: 2, leadrod: 1 }, station: "wiring" },
  { out: "flight_controls", count: 1, needs: { titan_plating: 4, leadrod: 2, glass: 1 }, station: "wiring" },
  { out: "dock_pad", count: 1, needs: { titan_plating: 2, leadrod: 1 }, station: "wiring" },
  // ---- The end of Phase 2: stills and Super Fuel, hidden until the Sentinel falls ----
  { out: "super_fuel", count: 1, needs: { rocket_fuel: 1, anthracite_ore: 2 }, station: "still", locked: true },
  { out: "super_fuel", count: 1, needs: { rocket_fuel: 1, graphite_ore: 2 }, station: "fuel", locked: true },
  { out: "nav_core", count: 1, needs: { metal_plating: 6, cobaltrod: 2, glass: 2, machine_heart: 1 }, station: "assembly", locked: true },
  { out: "nav_core", count: 1, needs: { titan_plating: 6, leadrod: 4, glass: 2, machine_heart: 1 }, station: "wiring", locked: true },
];

/** Campfire smelting: consumes one fuel charge per item. */
export const SMELT: { in: string; out: string; n?: number }[] = [
  { in: "sand", out: "glass" },
  { in: "farmland", out: "glass" }, // Farm Land is packed dirt - the kiln doesn't care
  { in: "dirt", out: "adobe" },
  { in: "sandstone", out: "rock" },
  { in: "rock", out: "metal" }, // the landlubber's chain: one Rock bakes one Iron Rod
  { in: "rat_raw", out: "rat_cooked" },
  { in: "vulture_raw", out: "vulture_cooked" },
  { in: "brushbuck_meat", out: "cooked_brushbuck_meat" },
  // Wheat bakes at the Cooking Pot, not the Campfire — the pot is the kitchen.
  // Ore yields double: the dig is the expensive part, not the fire.
  { in: "iron_ore", out: "metal", n: 2 },
  { in: "copper_ore", out: "copperrod", n: 2 },
  { in: "cobalt_ore", out: "cobaltrod", n: 2 },
  { in: "canister_full", out: "hot_water_pouch" }, // sealed hot for the cold hours
  // Campfire leather: pads cured over the fire (desert-only source).
  { in: "cactus", out: "cactus_leather" },
];

/** The Hearth (Silvaris): Lead fires, Saltpetre cleans, timber chars. No Metal here —
 *  the Rock-to-Metal chain is the desert's alone (ADR-0014). */
export const HEARTH_SMELT: { in: string; out: string; n?: number }[] = [
  { in: "sand", out: "glass" },
  { in: "dirt", out: "adobe" },
  { in: "lead_ore", out: "leadrod", n: 2 },
  { in: "saltpetre_ore", out: "saltpetre" },
  { in: "sil_timber", out: "charcoal" },
  { in: "brushbuck_meat", out: "smoked_brushbuck" },
  { in: "tideback_meat", out: "smoked_tideback" },
  { in: "canister_full", out: "hot_water_pouch" },
];

// ---------------- Cooking Pot ----------------
// The Pot keeps a Coals bank like the Campfire, but each recipe decides whether
// the fire is touched: `charges` is what one cook spends from the bank (Fruit
// Salad is 0 — chopping needs no heat). Jobs are row-pressed from the Dishes
// list; ingredients come off the pot's Input Grid.
// `*fruit` / `*meat` wildcards match any item of that tag.
export const FRUIT_ITEMS = ["apple", "dune_melon", "prickly_pear"];
export const MEAT_ITEMS = ["rat_raw", "vulture_raw", "rat_cooked", "vulture_cooked"];

export interface PotRecipe {
  out: string;
  count: number;
  needs: Record<string, number>;
  charges: number;
  seconds: number;
  station?: "pot" | "cauldron"; // which kitchen cooks it; default "pot"
  side?: { item: string; n: number }; // extra output (Stew returns the Canister empty)
  tag?: "bread" | "dish";            // bumps the matching quest counter
}

export const POT_RECIPES: PotRecipe[] = [
  { out: "bread", count: 1, needs: { wheat: 1 }, charges: 1, seconds: 12, tag: "bread" },
  { out: "sugar", count: 1, needs: { sugar_cane: 1 }, charges: 1, seconds: 6 },
  { out: "stew", count: 1, needs: { "*fruit": 1, wheat: 1, "*meat": 1, canister_full: 1 }, charges: 2, seconds: 30, side: { item: "canister_empty", n: 1 }, tag: "dish" },
  { out: "fruit_salad", count: 1, needs: { "*fruit": 2, canister_full: 1 }, charges: 0, seconds: 8, side: { item: "canister_empty", n: 1 }, tag: "dish" },
  { out: "apple_pie", count: 1, needs: { apple: 2, wheat: 1, sugar: 1 }, charges: 2, seconds: 20, tag: "dish" },
  // ---- The Cauldron (Silvaris kitchen): no wheat, no apples — root, oat, ember ----
  { out: "tundroot_flour", count: 1, needs: { tundroot: 2 }, charges: 1, seconds: 8, station: "cauldron" },
  { out: "oat_flour", count: 1, needs: { frost_oat: 2 }, charges: 1, seconds: 8, station: "cauldron" },
  { out: "oatbread", count: 1, needs: { oat_flour: 2 }, charges: 1, seconds: 14, tag: "bread", station: "cauldron" },
  { out: "flatbread", count: 1, needs: { tundroot_flour: 1, ember_berry: 2 }, charges: 1, seconds: 14, tag: "bread", station: "cauldron" },
  { out: "oat_porridge", count: 1, needs: { frost_oat: 2, canister_full: 1 }, charges: 1, seconds: 15, side: { item: "canister_empty", n: 1 }, station: "cauldron" },
  { out: "root_stew", count: 1, needs: { tundroot: 2, brushbuck_meat: 1, canister_full: 1 }, charges: 2, seconds: 30, side: { item: "canister_empty", n: 1 }, tag: "dish", station: "cauldron" },
  { out: "ember_pie", count: 1, needs: { ember_berry: 3, tundroot_flour: 1, sugar: 1 }, charges: 2, seconds: 20, tag: "dish", station: "cauldron" },
  { out: "pear_cordial", count: 1, needs: { prickly_pear: 2, sugar: 1 }, charges: 1, seconds: 12, station: "cauldron" },
];

export function potHas(inv: Inventory, r: PotRecipe): boolean {
  return Object.entries(r.needs).every(([id, n]) =>
    id === "*fruit" ? countTag(inv, FRUIT_ITEMS) >= n
    : id === "*meat" ? countTag(inv, MEAT_ITEMS) >= n
    : inv.has(id, n));
}

export function countTag(inv: Inventory, ids: string[]): number {
  let t = 0;
  for (const id of ids) t += inv.countOf(id);
  return t;
}

/** Removes a pot recipe's ingredients (specific ids first, then wildcards). */
export function potConsume(inv: Inventory, r: PotRecipe): boolean {
  if (!potHas(inv, r)) return false;
  for (const [id, n] of Object.entries(r.needs)) {
    let left = n;
    if (id === "*fruit" || id === "*meat") {
      for (const tid of id === "*fruit" ? FRUIT_ITEMS : MEAT_ITEMS) {
        if (left <= 0) break;
        left -= inv.removeItem(tid, left);
      }
    } else {
      left -= inv.removeItem(id, n);
    }
    if (left > 0) return false; // can't happen after potHas, but never half-consume
  }
  return true;
}

/** What a fuel item feeds a Campfire, in charges (a lit fire drips 1 charge per 10 real minutes). */
export const FIRE_FUEL: Record<string, number> = { kindling: 0.5, wood_log: 2, deadwood: 1, coal_ore: 6, charcoal: 4, sil_oil: 3 };
/** Wood Generator burn seconds banked per fuel item fed through its panel. */
export const GEN_FUEL: Record<string, number> = { wood_log: 30, deadwood: 6, sil_timber: 25, charcoal: 12, slug: 20 };

// ---------------- Recycler ----------------
// One seam across the two worlds (ADR-0014): any finished metal thing grinds to
// Scrap, no matter whose planet made it. Value ≈ what the thing cost to build.
export const RECYCLES: Record<string, number> = {
  metal_pickaxe: 1, metal_shovel: 1, metal_axe: 1, metal_disassembler: 2,
  alloy_pickaxe: 2, alloy_shovel: 2, alloy_axe: 2, alloy_disassembler: 3,
  sword: 1, stinger_blade: 1, bucket: 1, door: 1,
  metal_plating: 1, steel_plating: 2, titan_plating: 2,
  hull: 1, hull_slope: 1, curved_hull: 1,
  power_pole: 1, power_panel: 2, gen_wood: 2, wind_turbine: 2, solar_panel: 2,
  battery: 2, elec_lamp: 1, inserter: 2, planter: 1, harvester: 3,
  storm_breaker: 1, storm_breaker_broken: 1, regulator_broken: 2,
  coolant_cell: 1, head_lantern: 1, thruster_nozzle: 2, thruster: 5, engine_core: 10,
  flight_controls: 3, frame_corner: 2, dock_pad: 2, electric_bench: 2,
  assembly_bench: 3, foundry: 3, fuel_works: 3, fuel_still: 3, refinery: 2,
  chest_interface: 2, machine_part: 2, gun_turret: 4, shock_coil: 3, alarm_chime: 2, spikes: 1,
  titanium_pickaxe: 2, titanium_shovel: 2, titanium_axe: 2, titanium_knife: 1,
  carbide_pickaxe: 2, carbide_shovel: 2, carbide_axe: 2, carbide_knife: 1, carbide_disassembler: 3,
  hover_sled: 6, cargo_sled: 3, sled_blade: 3, sled_drill: 4, nav_core: 8,
};

export function canCraft(inv: Inventory, r: Recipe): boolean {
  return Object.entries(r.needs).every(([id, n]) => inv.has(id, n));
}

/** Removes ingredients; returns leftover product count that did not fit (0 = all taken). */
export function doCraft(inv: Inventory, r: Recipe): number | null {
  if (!canCraft(inv, r)) return null;
  for (const [id, n] of Object.entries(r.needs)) inv.removeItem(id, n);
  return inv.addItem(r.out, r.count);
}
