// Quest chain: a fixed sequence of guided goals. Progress is a plain counter
// per quest; one-shots use goal 1. Events are pushed from Game via kind.

export interface QuestDef {
  id: string;
  kind: "sky" | "mine" | "oasis" | "water_home" | "tool" | "wreck" | "core" | "finish";
  title: string;
  desc: string;
  goal: number;
  reward?: { item: string; n: number };
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
    id: "finish", kind: "finish", title: "Escape Vector",
    desc: "Carry the Engine Core home and set it within reach of a Save Beacon.", goal: 1,
  },
];

export interface QuestState { i: number; p: number[]; }

export function freshQuestState(): QuestState { return { i: 0, p: QUESTS.map(() => 0) }; }

/** Clamp a loaded save's quest state against the current quest list. */
export function loadQuestState(q: { i: number; p: number[] } | undefined): QuestState {
  const s = freshQuestState();
  if (!q) return s;
  s.i = Math.max(0, Math.min(QUESTS.length, q.i | 0));
  for (let k = 0; k < s.p.length; k++) {
    const goal = QUESTS[k].goal;
    s.p[k] = Math.max(0, Math.min(goal, (q.p && q.p[k]) | 0));
  }
  return s;
}

/** Current active quest, or null when the chain is complete. */
export function currentQuest(s: QuestState): QuestDef | null { return s.i < QUESTS.length ? QUESTS[s.i] : null; }

/** Progress the active quest by an event of its kind. Returns true if it just completed. */
export function questEvent(s: QuestState, kind: QuestDef["kind"], n = 1): QuestDef | null {
  const q = currentQuest(s);
  if (!q || q.kind !== kind) return null;
  if (s.p[s.i] >= q.goal) return null;
  s.p[s.i] = Math.min(q.goal, s.p[s.i] + n);
  if (s.p[s.i] < q.goal) return null;
  const done = q;
  s.i++;
  return done;
}
