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
    id: "belly", title: "Belly of the Wreck",
    hint: "the drive was cut out, not broken",
    text: "Stand in the wreck's hull and look up: the drive mounts were not sheared by the landing — they were cut. Clean edges, one heart taken out whole. The Second Wreck carries the same cut. Whatever put these ships in the ground went through them first, and took something.",
  },
  {
    id: "bearing", title: "The Gouge Field",
    hint: "the wreck was dragged here — something hauled it",
    text: "The trench runs out of the dunes in one straight bearing and ends at the Second Wreck. A keel, dragged for a kilometer, plowed the sand to glass. Wrecks do not walk. Something hauled this one out of its impact, laid it down, and cut its heart on the spot.",
  },
  {
    id: "town", title: "First Town",
    hint: "Chests in the shells hold loot",
    text: "The desert was lived in before you. Towns are adobe shells with Chests — the first chest of a cluster holds the loot. Take what you need; the dwellers are not coming back.",
  },
  {
    id: "camp", title: "First Nomad Camp",
    hint: "no coin — barter goods with the Nomad",
    text: "A windmill, a hut, a market stall — and a Nomad who never moves. There is no coin here: every deal swaps goods, five per camp per day. Bring shells, pelts and worked metal.",
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
    text: "Power lives on one Grid: a Power Panel is its meter and switch. Generators (Wood, Wind, Solar) feed it; Poles carry it — a device joins within 10 blocks of a Pole, Poles link 16 apart. If demand outruns supply the Panel trips and everything goes dark until the shortfall clears. A Battery sips the day's surplus and pays it back when the wind dies.",
  },
  {
    id: "inserter", title: "The Inserter",
    hint: "front pulls, behind pushes — aim with R",
    text: "The universal atom of factory automation: a powered Inserter takes one item per second out of the block in front of it and pushes it into the block behind — Chest to Chest, or fuel straight into a Campfire's coals. No filters, no reach: the whole data flow is visible in world space. Aim it with R before you place.",
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
  {
    id: "leave", title: "The Jump",
    hint: "one-way until you mix the blue canister yourself",
    text: "A canister of Super Rocket Fuel burned at the Yoke, and the planet fell away. This was never the wreck's trick — it is the dwellers' trick, and you just bought it. The Ship carries what is aboard and abandons everything on the ground. Desertis keeps its dunes and its dead; the way back waits until you mix that blue canister yourself.",
  },
  {
    id: "arrive", title: "The Second Planet",
    hint: "the Ship is home here; the sky is the door",
    text: "You came down on Silvaris — the Ship's log has always carried the name: ocean, forest, cold stone, and a Scorch belt that breathes ash. Desertis is now a place you used to live. The Ship docks at the plaza here; nothing moves between worlds until you make Super Rocket Fuel with your own hands.",
  },
  {
    id: "dock", title: "The Dock",
    hint: "grounded on Dock Pads — parked home, a respawn point",
    text: "A Ship grounded on a plaza's Dock Pads is docked: the beacons anchor here, and you wake beside it. The dwellers paved these pads before they raised a single wall. Landing was their first architecture; finish yours on top of it.",
  },
  {
    id: "settle", title: "First Settlement",
    hint: "alabaster houses, beds, chests — and an Inscription",
    text: "Not shells this time. The dwellers built here to stay: alabaster walls, metal plating, beds made, chests stocked, a Dock plaza out front. The desert kept their junk; this world kept their homes. Read the stele in the plaza — they left words on purpose.",
  },
  {
    id: "scorch", title: "The Volcano's Throat",
    hint: "the shaft down; something keeps the floor below",
    text: "The hottest ground on Silvaris is a door: one cone in the Scorch Belt with an open throat, and no lava behind it. Someone cut a road down — halls, wells, stairs stepped one rise at a time — and left something walking at the bottom. The chapters spoke of a thing that dragged wrecks across the sky. It is still down there, and it is still awake.",
  },
  {
    id: "sentinel", title: "The Sentinel Falls",
    hint: "its recipe is yours — cook it at a Fuel Works",
    text: "The thing that dragged the wrecks is scrap now. Its recipe rides out of the wreck of it: the dwellers wrote it into its core, betting whoever killed it deserved the inheritance — Rocket Fuel and graphite, cooked at a Fuel Works into Super Rocket Fuel. The dwellers could not kill it. You did. The fuel of the gods is yours to make.",
  },
  {
    id: "superfuel", title: "Fuel of the Gods",
    hint: "the blue canister; only Leave Planet burns it",
    text: "Rocket fuel and graphite, cooked at a Fuel Works into Super Rocket Fuel. It banks no charge and flies nothing by itself — it opens worlds, and it loads by hand alone. The dwellers made this, then chose not to come back. Whatever they found out there, no fuel ever came home looking for them.",
  },
  {
    id: "charted", title: "Charted",
    hint: "the course is drawn; the far mark is unwritten",
    text: "The Nav Core kept its secret the way charts do. The dwellers' route reads Desertis — Silvaris — and one more mark, unnamed, with fuel arithmetic beside it that only closes at a scale this world has not reached yet. The Sentinel is dead, the Fuel Works hums, and the blue canister comes from your own hands now. Phase 2 ends the way the dwellers' log ends: mid-sentence, aimed at a dark they could reach and did not return from.",
  },
];

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

/** Inscriptions: the carved steles the dwellers left in their Settlement
 *  plazas, in their own voice. The game picks one per site by hash.
 *  Canon they resolve: the dwellers built the Ship's parts on Desertis,
 *  left under their own power before you, and never came back — and the
 *  stones leave the Phase-3 question open: what worlds remain? */
export const INSCRIPTION_TEXTS: string[] = [
  "We built the frames and the burners on Desertis, and we flew them out to the sea-line and back. The wreck you fell in on was not the first, and you are not the first to dig yourself out of the desert. We went on. The sky kept its directions from us.",
  "Desertis made us pay for everything and gave nothing back. We built the Engines there, filled them with its own oil, and left on our own account. Do not curse the desert for letting you go; it never held us either.",
  "On the second world the rain does the digging for you. We came from the dunes and we still squint. When the snow storms rise, climb; when the Scorch breathes ash, answer with a Breaker and a wall. Shelter beats stubbornness on this planet too.",
  "The Ship is not a boat and not a promise. It carries what you load and leaves what you leave, and the fuel for the long leg must be mixed in your own hands. We mixed ours.",
  "We paved the plazas before we raised the houses, because a Ship you cannot land is only a bonfire waiting to happen. The pads you are standing on are the first words every Settlement says.",
  "Count the wrecks. None of them are ours. The dwellers are not dead — that is what these stones are for. Wherever the next plaza is, we are reading your dirt off a newer stone.",
  "The camps on this shore still trade desert weights and desert goods. We left them here on purpose, so the next ones down would learn to barter before they learned to fly.",
  "Every world so far has been survivable, quiet and empty. We have crossed the maps the Ship could reach, and the maps stop. The question we leave to whoever reads this next, with fuel of their own making: what worlds remain?",
];

/** Clamp a loaded save's chronicle/codex id lists against what the game knows. */
export function loadIdSet(ids: string[] | undefined, known: Set<string>): Set<string> {
  const s = new Set<string>();
  if (!ids) return s;
  for (const id of ids) if (known.has(id)) s.add(id);
  return s;
}
