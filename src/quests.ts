// Quest chain: a fixed sequence of guided goals. Progress is a plain counter
// per quest; one-shots use goal 1. Events are pushed from Game via kind.

export interface QuestDef {
  id: string;
  kind: "sky" | "mine" | "oasis" | "water_home" | "tool" | "farm" | "supplies" | "bread" | "dish" | "wreck" | "core" | "yoke" | "grid" | "factory" | "thruster" | "core_set" | "ship_grid" | "refine" | "liftoff" | "leave" | "arrive" | "dock" | "settle" | "electric" | "foundry_set" | "superfuel" | "nomad" | "camp" | "belly" | "bearing" | "cold" | "oilworks" | "sled" | "navcore" | "dungeon" | "sentinel" | "charted";
  title: string;
  desc: string;
  goal: number;
  reward?: { item: string; n: number };
  /** Shown when this (final) quest completes and the chain ends. */
  completionText?: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: "air", kind: "sky", title: "Getting Air",
    desc: "Step out of the wreck and stand under open sky.", goal: 1,
  },
  {
    id: "salvage", kind: "mine", title: "Salvage Rights",
    desc: "Break blocks by hand to strip the desert for parts.", goal: 20,
    reward: { item: "metal", n: 3 },
  },
  {
    id: "oasis", kind: "oasis", title: "Oases of the Dune",
    desc: "Find an oasis — open water on the horizon.", goal: 1,
    reward: { item: "canister_empty", n: 2 },
  },
  {
    id: "bearer", kind: "water_home", title: "Water Bearer",
    desc: "Carry a full Water Canister within reach of a Save Beacon.", goal: 1,
    reward: { item: "backpack1", n: 1 },
  },
  {
    id: "tool", kind: "tool", title: "Handy Work",
    desc: "Craft any tool at a Crafting Bench.", goal: 1,
    reward: { item: "metal", n: 4 },
  },
  {
    id: "farm", kind: "farm", title: "Green Thumbs",
    desc: "Till Dirt with a shovel, plant a seed near water, and harvest one ripe crop.", goal: 1,
    reward: { item: "seed_melon", n: 2 },
  },
  {
    id: "supplies", kind: "supplies", title: "The Dwellers' Leftovers",
    desc: "The desert was lived in before you. Reach a Town and open a Chest — the first chest of a cluster holds the loot.", goal: 1,
    reward: { item: "canister_full", n: 1 },
  },
  {
    id: "bread", kind: "bread", title: "Bread from the Pot",
    desc: "Craft a Cooking Pot, then bake Wheat into Bread at it.", goal: 1,
    reward: { item: "seed_wheat", n: 2 },
  },
  {
    id: "dish", kind: "dish", title: "A Warm Meal",
    desc: "Make any Dish at a Cooking Pot — Stew, Fruit Salad or Apple Pie.", goal: 1,
    reward: { item: "apple_pip", n: 2 },
  },
  {
    id: "wreck", kind: "wreck", title: "The Second Wreck",
    desc: "Your visor flagged another impact site far out in the dunes. Reach it.", goal: 1,
    reward: { item: "catalyst", n: 1 },
  },
  {
    id: "core", kind: "core", title: "Heart of the Wreck",
    desc: "Break the glowing Engine Core free from the second wreck.", goal: 1,
    reward: { item: "metal", n: 4 },
  },
  {
    id: "belly", kind: "belly", title: "Belly of the Wreck",
    desc: "The Second Wreck was cut open for its heart. Stand again inside your own wreck's hull and read the same cut where its drive was taken.", goal: 1,
  },
  {
    id: "bearing", kind: "bearing", title: "Scorched Bearing",
    desc: "The sand beyond the Second Wreck wears a scar — a trench a keel dragged for a kilometer. Walk the far end of the Gouge Field.", goal: 1,
  },
  {
    id: "frame", kind: "yoke", title: "Take the Yoke",
    desc: "The wreck's Ship Frame is already declared — Corners glint at its eight vertices. Craft Flight Controls at a Crafting Bench and set the yoke inside the Frame, aboard the Ship.", goal: 1,
  },
  {
    id: "grid", kind: "grid", title: "Lights On",
    desc: "Wire the Grid the Dwellers left: a Power Panel, Poles and a generator — and hang an Electric Lamp on it. The Grid must light the lamp.", goal: 1,
    reward: { item: "elec_lamp", n: 2 },
  },
  {
    id: "factory", kind: "factory", title: "Machine Works",
    desc: "Put a machine to work: an Inserter, Planter or Harvester moves something on its own.", goal: 1,
    reward: { item: "harvester", n: 1 },
  },
  {
    id: "wings", kind: "thruster", title: "Wings of the Wreck",
    desc: "The Ship's four wingtip engines are dead. Mine Cobalt Ore in the deep Caves, smelt it at a Campfire, craft a Thruster Nozzle (Cobalt + Copper + Metal), and press E at each Broken Thruster. All four lit lifts the Ship.", goal: 4,
  },
  {
    id: "heart", kind: "core_set", title: "Heart Aboard",
    desc: "Carry the Engine Core from the second wreck and set it inside the Ship's own Frame — the Ship's grid starts there.", goal: 1,
    reward: { item: "copperrod", n: 4 },
  },
  {
    id: "shipgrid", kind: "ship_grid", title: "Self-Sufficient",
    desc: "Put a Power Panel and a Battery inside the Frame, wired to the Engine Core — the Ship runs its own grid, no poles to the ground.", goal: 1,
    reward: { item: "metal_plating", n: 6 },
  },
  {
    id: "fuel", kind: "refine", title: "Black Gold",
    desc: "Find an Oil Seep — dark sand weeping crude. Scoop Oil into an empty bucket, build a Refinery, and refine your first Rocket Fuel Canister.", goal: 1,
    reward: { item: "canister_empty", n: 2 },
  },
  {
    id: "liftoff", kind: "liftoff", title: "Lift-Off",
    desc: "Bank Rocket Fuel into the Engine Core's ports, stand at the Flight Controls and raise the Ship under its own power. Home now travels with you.", goal: 1,
    reward: { item: "super_fuel", n: 1 },
  },
  {
    id: "leave", kind: "leave", title: "Leave Planet",
    desc: "Load a canister of Super Rocket Fuel into the Engine Core by hand, stand at the Yoke and burn it for the Second Planet. The Ship climbs with everything aboard; everything on the ground stays. The desert lends one canister — after that, this fuel comes from your own hands.", goal: 1,
  },
  {
    id: "first_light", kind: "arrive", title: "First Light",
    desc: "The jump is done and the wreck's promise is paid: you are on the Second Planet. Stand under its open sky.", goal: 1,
  },
  {
    id: "the_dock", kind: "dock", title: "The Dock",
    desc: "These Settlements paved their plazas with Dock Pads before they raised a single wall. Ground the Ship on the markers and it is docked — home, parked.", goal: 1,
  },
  {
    id: "the_settlements", kind: "settle", title: "The Settlements",
    desc: "The dwellers built here to stay: alabaster walls, metal plating, beds made, Chests stocked. Reach a Settlement and open a Chest — the shells out here are houses.", goal: 1,
  },
  {
    id: "cold_tools", kind: "cold", title: "Cold Tools",
    desc: "The wreck's metal is done; this world hands out its own edges. Knap a Basalt tool at a Stone Workbench.", goal: 1,
  },
  {
    id: "nomads_debt", kind: "nomad", title: "Nomad's Debt",
    desc: "The Nomads carry what the Settlements forgot. Earn a camp's trust — three honest barters, or a deed the trade roads repeat — and hear a Keeper's chapter.", goal: 1,
  },
  {
    id: "cut_antenna", kind: "camp", title: "Cut the Antenna",
    desc: "The Machine Camps hear through their antennas. Bring one down: the patrols stand down for good — and a Reclaimer comes to answer it.", goal: 1,
  },
  {
    id: "power_silence", kind: "electric", title: "Power the Silence",
    desc: "The Wiring Bench is this world's Electric Bench — Panels, Poles and Batteries on Lead and Glass. Wire one to the Grid and craft your first thing on it.", goal: 1,
  },
  {
    id: "sled_yard", kind: "sled", title: "The Sled Yard",
    desc: "The distances out here eat walkers. Craft a Hover Sled at the Wiring Bench — it rides the ground, and it charges on a pad beside the Ship.", goal: 1,
  },
  {
    id: "alloys_engines", kind: "foundry_set", title: "Alloys & Engines",
    desc: "The alloy chain starts in your own yard: stand a Foundry on the ground and fire it up. From here, ore feeds you — no more wreck.", goal: 1,
  },
  {
    id: "long_thirst", kind: "oilworks", title: "The Long Thirst",
    desc: "This world bleeds black oil too. Work the Oilworks chain until a Fuel Works cooks your first Rocket Fuel canister.", goal: 1,
  },
  {
    id: "dust_salt", kind: "nomad", title: "Dust and Salt",
    desc: "A second camp trusts you now. Hear its Keeper — the story is kept in pieces, and pieces argue with each other.", goal: 1,
  },
  {
    id: "second_reclaimer", kind: "camp", title: "Second Reclaimer",
    desc: "Cut the second antenna. Whatever the camps call the one who silences them, the name is spreading.", goal: 1,
  },
  {
    id: "scattered_story", kind: "nomad", title: "The Scattered Story",
    desc: "Two more chapters, from Keepers who kept them apart: what dragged the wrecks out of the sky, and what still hunts the thing that ran.", goal: 2,
  },
  {
    id: "a_chart", kind: "navcore", title: "A Chart Before the Dark",
    desc: "Before the dark country: a Nav Core — the Ship's chartering brain, the only thing that reads a star chart. The recipe surfaces once the scattered story is told.", goal: 1,
  },
  {
    id: "into_scorch", kind: "dungeon", title: "Into the Scorch",
    desc: "The volcano's throat is the way down: enter the shaft in the Scorch Belt. Conduits hum in the dark, and something old waits at the bottom.", goal: 1,
  },
  {
    id: "kill_sentinel", kind: "sentinel", title: "Kill the Sentinel",
    desc: "The thing that dragged the wrecks across the sky stands at the bottom of the volcano. Cut its conduits, flood its cooling, and end it in the Arena.", goal: 1,
  },
  {
    id: "fuel_gods", kind: "superfuel", title: "Fuel of the Gods",
    desc: "The Sentinel's death-gift is its recipe: cook Rocket Fuel and Graphite Ore at a Fuel Still into Super Rocket Fuel. The canister that opens worlds now comes from your own hands.", goal: 1,
  },
  {
    id: "charted", kind: "charted", title: "Charted",
    desc: "Super fuel in the ports, Nav Core aboard: set the Ship on a charted course and burn for the stars.", goal: 1,
    completionText: "Phase 2 done: the Ship, the Settlements, the scattered story told, and fuel you make yourself. The other worlds are Phase 3's.",
  },
];

// A deed counts whenever it happened, not only while its quest is current:
// e keeps achieved counts per kind, and reconcile pays them off when the
// quest comes up.
export interface QuestState { i: number; p: number[]; e: Record<string, number>; }

export function freshQuestState(): QuestState { return { i: 0, p: QUESTS.map(() => 0), e: {} }; }

/** Clamp a loaded save's quest state against the current quest list. */
export function loadQuestState(q: { i: number; p: number[]; e?: Record<string, number> } | undefined): QuestState {
  const s = freshQuestState();
  if (!q) return s;
  s.i = Math.max(0, Math.min(QUESTS.length, q.i | 0));
  for (let k = 0; k < s.p.length; k++) {
    const goal = QUESTS[k].goal;
    s.p[k] = Math.max(0, Math.min(goal, (q.p && q.p[k]) | 0));
  }
  if (q.e) for (const [k, v] of Object.entries(q.e))
    if (QUESTS.some((qq) => qq.kind === k)) s.e[k] = Math.max(0, v | 0);
  return s;
}

/** Current active quest, or null when the chain is complete. */
export function currentQuest(s: QuestState): QuestDef | null { return s.i < QUESTS.length ? QUESTS[s.i] : null; }

/** Note a deed for the ledger; it pays off whenever its quest comes up. */
export function recordDeed(s: QuestState, kind: QuestDef["kind"], n = 1): void {
  s.e[kind] = (s.e[kind] || 0) + n;
}

/** Progress the active quest by an event of its kind. Returns true if it just completed. */
export function questEvent(s: QuestState, kind: QuestDef["kind"], n = 1): QuestDef | null {
  // the deed is achieved forever, whether or not this quest is the current one
  recordDeed(s, kind, n);
  const q = currentQuest(s);
  if (!q || q.kind !== kind) return null;
  if (s.p[s.i] >= q.goal) return null;
  s.p[s.i] = Math.min(q.goal, s.p[s.i] + n);
  if (s.p[s.i] < q.goal) return null;
  const done = q;
  s.i++;
  return done;
}

/** Pay off any current quest the player already achieved earlier; may chain. */
export function reconcile(s: QuestState): QuestDef[] {
  const done: QuestDef[] = [];
  for (;;) {
    const q = currentQuest(s);
    if (!q) return done;
    const e = s.e[q.kind];
    if (!e) return done;
    if (s.p[s.i] < q.goal) s.p[s.i] = Math.min(q.goal, e);
    if (s.p[s.i] < q.goal) return done;
    s.i++;
    done.push(q);
  }
}
