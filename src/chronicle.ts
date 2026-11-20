// Chronicle: the running lessons of the world — first-time discoveries that
// teach how its systems work. The current step rides under the main Quest in
// the HUD; the full log lives in the pause menu (screen-chronicle).
// New factory-system lessons land with their batches.

export interface Lesson { id: string; title: string; text: string; hint: string; }

export const LESSONS: Lesson[] = [
  {
    id: "storm", title: "The Sandstorm Rises",
    hint: "shelter now; a Sandstorm Breaker calms the air",
    text: "The sky went to work against you: a Sandstorm amplifies the air, drinks your Water, and scours bare skin. It is a regime, not an event — it eases on its own. Answer it at a Crafting Bench: a Sandstorm Breaker (Iron Rods + Glass) calms the air around it and turns the storm aside. Until then, shelter beats stubbornness.",
  },
  {
    id: "oasis", title: "First Oasis",
    hint: "open water — refill your canisters here",
    text: "Open water on the horizon: an Oasis. Refill your canisters here — the water never runs dry, the walk to it is the price. Oases never run out across the world; they are just far apart.",
  },
  {
    id: "town", title: "First Town",
    hint: "Supply Chests in the shells hold loot",
    text: "The desert was lived in before you. Towns are adobe shells with Supply Chests — the first chest of a cluster holds the loot. Take what you need; the dwellers are not coming back.",
  },
  {
    id: "camp", title: "First Trader Camp",
    hint: "no coin — barter goods with the Trader",
    text: "A windmill, a hut, a market stall — and a Trader who never moves. There is no coin here: every deal swaps goods, five per camp per day. Bring shells, pelts and worked metal.",
  },
  {
    id: "mouth", title: "First Cave Mouth",
    hint: "the way down — take a Head Lantern",
    text: "An arch dug into a hillside: the way down into the Caves. Two or more cells under the terrain the air sits at a constant mild ~22 °C — the refuge, but it is dark. Take a Head Lantern before you commit.",
  },
  {
    id: "cave", title: "Deep in the Caves",
    hint: "mild dark air; ore waits in the walls",
    text: "Underground the desert's heat and cold cannot reach you — and the walls hold Iron, Copper, Alabaster and, deepest of all, Cobalt. Ore doubled at a Campfire: the dig is the expensive part, not the fire.",
  },
  {
    id: "canister", title: "A Buried Canister",
    hint: "buried sites mark the Map once dug",
    text: "You dug a Water Canister out of the open desert. Buried sites dot the dunes on recurring spacing — containers, not water. A site marks the Map only once one of its canisters is in your hands.",
  },
  {
    id: "wreck2", title: "The Second Wreck",
    hint: "its Engine Core is your way off-world",
    text: "Another ship came down out here — and at its heart glows an Engine Core. That is your way off this planet: carry the Core home beside a Save Beacon.",
  },
  {
    id: "pin", title: "Surveyor's Pins",
    hint: "maximise the Map (M) to name a Pin \"Base\"",
    text: "A Surveyor's Pin planted with E marks the Map forever — name it from the maximised Map. A Pin named \"Base\" is the point your Surveyor's Visor beams you back to, through walls.",
  },
  {
    id: "tracker", title: "Hidden Landmark Tracker",
    hint: "use it (Q) to wake the next unknown place",
    text: "One use, then it's gone: the Tracker wakes the nearest place you have never found — a Town, camp, cave mouth, oasis or buried canister site — and marks it on your Map. The second wreck repeats nowhere; no Tracker will ever point at it.",
  },
  {
    id: "husk", title: "Husk Machinery",
    hint: "a Husk breaks into a frame you repair at a Bench",
    text: "The crash burned this machine out to a Husk — dead, but its shell is salvage. A Disassembler breaks it into the broken frame; a Crafting Bench repair (about half the normal recipe) makes it live again. Break the Husk before you can pay for the repair and the machine is lost for good.",
  },
  {
    id: "regulator", title: "Heat Regulator",
    hint: "sealed air pinned at body temperature",
    text: "A live Heat Regulator pins a SEALED room's air near 37 °C whatever the sky does — up to 150 open cells per unit, and capacity stacks in bigger rooms. Sealed means sealed: one open Outside Door merges the room with the desert and switches the unit off. Draw a breath of neutral air from it any time with E.",
  },
  {
    id: "breaker", title: "Sandstorm Breaker",
    hint: "8 blocks of storm-proof calm",
    text: "A built Sandstorm Breaker hums out the storm: within 8 blocks the Sandstorm loses all teeth — no scorching, no wind-thirst, no blast. Plant one before every long trip; the recipe (Iron Rods + Glass) carries no catalyst, so a whole Base can be storm-proofed.",
  },
  {
    id: "grid", title: "The Grid",
    hint: "a Power Panel meters every Watt you draw",
    text: "Power lives on one Grid: a Power Panel is its meter and switch. Generators (Wood, Water Wheel, Wind, Solar) feed it; Poles carry it — a device joins within 10 blocks of a Pole, Poles link 16 apart. If demand outruns supply the Panel trips and everything goes dark until the shortfall clears. A Battery sips the day's surplus and pays it back when the wind dies.",
  },
  {
    id: "inserter", title: "The Inserter",
    hint: "front pulls, behind pushes — aim with R",
    text: "The universal atom of factory automation: a powered Inserter takes one item per second out of the block in front of it and pushes it into the block behind — Chest to Chest, or fuel straight into a Campfire's Fuel Slot. No filters, no reach: the whole data flow is visible in world space. Aim it with R before you place.",
  },
  {
    id: "planter", title: "The Planter",
    hint: "seeds below, Farm Land above, crop two up",
    text: "A powered Planter plants your farm for you: Chest of seeds beneath, Farm Land directly above it, and it fills the empty cell two up with a Melon or Wheat seed. Keep water within 4 of the soil and the air in the crop's temperature band, and the column never needs your hands.",
  },
  {
    id: "home", title: "Home Is a Sealed Room",
    hint: "a sealed space with a hearth or Grid hums cosy",
    text: "The walls close the desert out: inside a sealed space with a lit Campfire, a Bed, a working Storm Breaker or a Power Panel, the wind drops to a muffled moan, the fire crackles close, and the score turns warm. This is a Base — cosy on purpose. The edge feels like the edge because somewhere, the light is low and steady and yours.",
  },
  {
    id: "harvester", title: "The Harvester",
    hint: "reaps below, chest above",
    text: "A powered Harvester closes the farm loop: ripe crop directly beneath, Chest directly above — it reaps Melons (the vine keeps growing), cuts Wheat back to tilled Farmland (seeds returned), and picks Cactus fruit. Planter below, Farmland, crop, Harvester on top: a self-seeding column that pays in food.",
  },
];

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

/** Clamp a loaded save's chronicle/codex id lists against what the game knows. */
export function loadIdSet(ids: string[] | undefined, known: Set<string>): Set<string> {
  const s = new Set<string>();
  if (!ids) return s;
  for (const id of ids) if (known.has(id)) s.add(id);
  return s;
}
