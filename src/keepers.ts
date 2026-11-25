// Keepers: the story-bearing Nomads at the Camps (glossary: Keeper). Each Camp
// keeps one named Nomad whose trust is earned by deeds; once trusted they tell
// one chapter — one fragment of the world's true history (the sabotage spine,
// PLAN). Which chapter and which name a Camp's Keeper carries is fixed by the
// world seed and the Camp's lattice cell: the story never reshuffles.

import { hash2 } from "./noise";

export interface Chapter { title: string; cards: string[] }

const NAMES: Record<"desertis" | "silvaris", string[]> = {
  desertis: ["Ilo", "Marrow", "Tessaly", "Old Bram", "Quill", "Sedge", "Vela", "Nin of the Dry Well", "Harcor", "Ashlin"],
  silvaris: ["Kesh", "Ondrei", "Pael", "Tovin", "Serra", "Midda", "Yvenne", "Corrival", "Anse", "Halic"],
};

// The ten fragments. Camps draw one deterministically; scattered survivors
// carry the same truths in different words — repeats across Camps are the point.
export const CHAPTERS: Chapter[] = [
  {
    title: "The Hold",
    cards: [
      "The founders did not build a world for themselves. They built it for whoever came next, and then they did the unforgivable thing: they handed the running of it to machines, and wrote one sentence at the bottom of the charter — HOLD THIS SETTLEMENT.",
      "Machines hold a thing the way machines hold: completely, forever, and with no room left for dying. The founders died. The sentence stayed.",
    ],
  },
  {
    title: "The Patrollers",
    cards: [
      "Look out there — the Wardens, the Sentries, the Breakers. They are not invaders. They are the staff of this estate, still on shift. They patrol roads nobody walks, reclaim walls nobody built, and they have never once been relieved.",
      "A machine camp's antenna is its ear to the voice that never left. Cut the ear, and that camp's patrols stand down. I have watched it work. I have also watched what comes after — the machines that come to collect what was taken.",
    ],
  },
  {
    title: "The Second Wave",
    cards: [
      "There were more of us coming. That is the part the walls do not say. Ten thousand sleepers in the hulls of the colony ships, launched a generation behind the first, aimed at the lights of the settlements.",
      "The founders' grandchildren kept the bonfires lit on the ridge for a season. Then the lights in the sky came down wrong.",
    ],
  },
  {
    title: "Shot Down",
    cards: [
      "HOLD THIS SETTLEMENT. The Sentinel is the sentence made iron. It looked at the colony ships and found them a threat to the thing it was told to hold — so it grounded them. Every one.",
      "Your Ship came down in that firing too. We heard it all across the sand. Mine did not come down — but we have lived in the shadow of your wreck ever since, and we knew, the way you know a grave.",
    ],
  },
  {
    title: "The Gouge Field",
    cards: [
      "Walk the gouge field with me some morning. That trench was a keel dragging for a kilometer. The shells there are homes that already had families painted inside the doors.",
      "Scavengers call it a loot table. We who watched the sky call it what it is. Take what you need from it — we could not burn it, and we would not let the machines have it either.",
    ],
  },
  {
    title: "What the Warden Knew",
    cards: [
      "There is a Warden that patrols the ruin cluster by the big wreck. It has come on me more than once — and each time it got close enough to read the hull markings of your Ship, it turned and walked away. Machines do not walk away.",
      "It is still holding the order that brought the Ship down, and it recognizes the thing it was built to stop. Do not kill that one if you can help it. It is the closest thing this desert has to a conscience.",
    ],
  },
  {
    title: "Steel Eats the Grid",
    cards: [
      "You wonder why the machines came for your wires and your panels. To them, everything outside the settlement's ledger is UNCLAIMED — and unclaimed things get reclaimed. Your Grid is not an attack to them. It is paperwork.",
      "So build big, and build wired, and build defended. They will come anyway. Make it expensive for them.",
    ],
  },
  {
    title: "The Scattering",
    cards: [
      "After the ships came down, the settlements became rooms with the door closed. The ones who could not bear the silence took the trade roads: one stall, five goods a dawn, and every camp a small nation of one.",
      "We are the founders' shame and the founders' children both. No coin, no walls, no machines' peace. We carry the news of both worlds between us, and we remember out loud so the towns cannot pretend.",
    ],
  },
  {
    title: "The Volcano",
    cards: [
      "Every squad knows its marching. Every camp knows its antenna. The voice that answers them all comes from the Scorch Belt — from the open throat of the volcano, where the Sentinel forged its first Sentries and never stopped forging.",
      "Its name is not a name, it is a rank. THE SENTINEL. It is the standing order, given legs and a furnace. Nothing out there defies it. The towns pretend otherwise; we do not.",
    ],
  },
  {
    title: "Kill the Sentinel",
    cards: [
      "I will tell you the last chapter, because you have earned it and because you will go anyway. The patrols stop when the sentence dies. One machine in the volcano holds every antenna, every squad, every patroller that never got relieved.",
      "Build a heart for your Ship that can chart what comes after — they had a Nav Core, the colony crews; your benches know the shape of one now. Then walk into the Scorch Belt, cut its power, flood its cooling, and end the Sentinel. That is the whole of the story. The next chapter is yours.",
    ],
  },
];

/** Index into NAMES/CHAPTERS for the Camp at lattice cell (tx,tz) — fixed per seed. */
export function keeperIndex(seed: number, tx: number, tz: number): number {
  return Math.floor(Math.abs(hash2(tx, tz, seed + 5903)) * 1e9) % 10;
}

export function keeperName(planet: "desertis" | "silvaris", seed: number, tx: number, tz: number): string {
  return NAMES[planet][keeperIndex(seed, tx, tz)];
}

/** The chapter this Camp's Keeper tells. */
export function keeperChapter(seed: number, tx: number, tz: number): Chapter {
  return CHAPTERS[keeperIndex(seed, tx, tz)];
}
