import type { Game } from "./game";
import { DIRT, DOOR_CLOSED, DOOR_OPEN, DOOR_UPPER, SAND, SANDSTONE } from "./blocks";

// The guided tour for fresh worlds: a cinematic flyover of the wreck, then steps
// the player performs in the real game world. Coordinates are the main wreck's
// fixed layout (gen.ts: interior x -5..3, z -4..4, floor y 30, interior y 31..33,
// stern door at (-6,31,0), water tank (-4,30,4), regulator (-4,31,-4),
// beacon (-4,31,-1), bench (0,31,-3)).

export interface CineSeg {
  t0: number; t1: number;
  from: [number, number, number];
  to: [number, number, number];
  look: [number, number, number];
  openDoor?: { t: number; x: number; y: number; z: number };
}

export const INTRO_CINE: CineSeg[] = [
  { t0: 0, t1: 5.5, from: [26, 38.5, 15], to: [11, 33.5, 5], look: [-1, 31.5, 0] },
  { t0: 5.5, t1: 9.5, from: [11, 33.5, 5], to: [-9.5, 31.9, 0], look: [-6, 31.7, 0] },
  { t0: 9.5, t1: 13.5, from: [-9.5, 31.9, 0], to: [-0.5, 32.3, 1.5], look: [-1.5, 31.4, -2.5],
    openDoor: { t: 10.2, x: -6, y: 31, z: 0 } },
  { t0: 13.5, t1: 16.5, from: [-0.5, 32.3, 1.5], to: [0.5, 32.62, 2.5], look: [2.6, 31.5, -1.5] },
];

type Goal = "door" | "surge" | "refill" | "drink" | "chest" | "craft" | "mine" | "plant" | "save";

interface TutStep {
  t: string;
  cap: string;
  guide?: { name: string; x: number; y: number; z: number };
  goal?: Goal;            // the event that ends the step early
  hold: number;           // seconds before the tour moves on regardless
  enter?: (g: Game) => void;
  poll?: (g: Game) => boolean;
}

const STEPS: TutStep[] = [
  { t: "Getting Out",
    cap: "The hull is what kept you breathing. Its one working exit is the stern hatch — follow the cyan beam, look at the door, press <b>E</b>, step outside.",
    guide: { name: "Stern Hatch", x: -6, y: 31, z: 0 }, goal: "door", hold: 90 },
  { t: "The Furnace",
    cap: "Midday. Under open sky your body climbs toward 50 °C — watch the <b>TEMP</b> bar slide out of its white band. Walls, doors and shade push it back down.",
    guide: { name: "Stern Hatch", x: -6, y: 31, z: 0 },
    enter: (g) => g.setClock(0.56), poll: (g) => g.survival.body > 37.6, hold: 28 },
  { t: "Sweat Surge",
    cap: "When the climb gets dangerous, press <b>X</b>: a Sweat Surge spends 10 water to force your body cool.",
    goal: "surge", hold: 22 },
  { t: "Water",
    cap: "Back inside — the ship's tank sits in the aft-left compartment. Look into the pool and press <b>E</b>; an empty canister is already in your pack.",
    guide: { name: "Water Tank", x: -4, y: 30, z: 4 }, goal: "refill",
    enter: (g) => { if (!g.inv.has("canister_empty")) g.giveOrDrop("canister_empty", 1); }, hold: 75 },
  { t: "Drink",
    cap: "The full canister is already in your hands — press <b>Q</b> to drink: +25 water, and the cold water chases off a little heat. Q <i>uses whatever you hold</i>: food works the same way. Water is the desert's first tax — budget every trip around it.",
    guide: { name: "Water Tank", x: -4, y: 30, z: 4 }, goal: "drink", hold: 30,
    enter: (g) => g.selectHeld("canister_full") },
  { t: "Supply Chest",
    cap: "The cockpit's Supply Chest is stocked — look at it and press <b>E</b>. Chests are real blocks: place them anywhere, and touching ones share one bigger grid.",
    guide: { name: "Supply Chest", x: 3, y: 31, z: 0 }, goal: "chest", hold: 60 },
  { t: "Craft",
    cap: "The wreck's Crafting Bench stands in the hall — press <b>E</b> at it and make a Wood shovel; there is dead wood in your pack.",
    guide: { name: "Crafting Bench", x: 0, y: 31, z: -3 }, goal: "craft",
    enter: (g) => g.giveOrDrop("deadwood", 4), hold: 60 },
  { t: "Mine",
    cap: "Select the shovel on the bottom hotbar — click it, scroll, or press its number — then hold <b>Left-click</b> on sand until it breaks. Rock outcrops need a pickaxe; you will craft one soon enough.",
    goal: "mine", hold: 45 },
  { t: "Farming",
    cap: "A shovel has a second use: press <b>Q</b> while aiming at <b>dirt or grass</b> to till it into <b>Farm Land</b> — sand refuses the blade. Plant seeds in the tilled soil. Crops ripen only while water sits within 4 blocks and the air stays in their band — melons love the heat, wheat does not. Dirt is precious out here; oasis rims and town fields still hold it.",
    goal: "plant", hold: 40,
    enter: (g) => {
      g.giveOrDrop("seed_wheat", 2);
      g.selectHeld("shovel");
      // the dunes here are pure sand: lay a patch of soil right under the player's feet
      const p = g.player.pos;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      for (let y = Math.floor(p.y) - 1; y > 20; y--) {
        const id = g.world.get(x, y, z);
        if (id === SAND || id === SANDSTONE) {
          g.world.set(x, y, z, DIRT);
          g.tutGuide = { name: "Dirt", x, y, z };
          break;
        }
      }
    } },
  { t: "Save Points",
    cap: "Last lesson: a Save Beacon waits in the aft cabin. Press <b>E</b> at it. Beacons are the only save points and the only respawns — craft more and set one before every long trip. After this, the desert is yours.",
    guide: { name: "Save Beacon", x: -4, y: 31, z: -1 }, goal: "save", hold: 30 },
];

export class Tutorial {
  private step = -1;                 // -1: the opening flyover is still airborne
  private acc = 0;
  private advanceAt: number | null = null;
  private ended = false;
  private card = document.getElementById("tut-card")!;
  private ttlEl = document.getElementById("tut-title")!;
  private capEl = document.getElementById("tut-cap")!;
  private dotsEl = document.getElementById("tut-dots")!;

  constructor(private g: Game) {
    document.getElementById("btn-tut-skip")!.onclick = () => this.finish();
    this.card.classList.remove("hidden");
    this.setCard("Crash Landing", "Something gave out over the dunes. What is left is this wreck — and inside it, you are still safe.");
  }

  // events fired by Game at the exact moments the tour cares about
  notify(ev: Goal) {
    if (this.step >= 0 && this.advanceAt === null && STEPS[this.step].goal === ev) this.advanceAt = this.acc + 1.4;
  }

  tick(dt: number) {
    if (this.step < 0 || this.ended) return;
    this.acc += dt;
    const s = STEPS[this.step];
    if (this.advanceAt === null) {
      if (s.poll?.(this.g)) this.advanceAt = this.acc + 1.4;
      else if (this.acc >= s.hold) this.advance();
    } else if (this.acc >= this.advanceAt) this.advance();
  }

  // called by Game when the opening cinematic lands
  onCineEnd() {
    // the fly-through pushed the stern hatch open — re-latch it so the ship is
    // sealed again, and step 0 gets to teach opening it
    const w = this.g.world;
    if (w.get(-6, 31, 0) === DOOR_OPEN) {
      w.set(-6, 31, 0, DOOR_CLOSED);
      w.set(-6, 32, 0, DOOR_UPPER);
      w.doorSwing.delete("-6,0");
    }
    this.beginStep(0);
  }

  private advance() {
    if (this.step + 1 >= STEPS.length) { this.finish(); return; }
    this.beginStep(this.step + 1);
  }

  private beginStep(i: number) {
    this.step = i;
    this.acc = 0;
    this.advanceAt = null;
    const s = STEPS[i];
    this.setCard(s.t, s.cap);
    this.g.tutGuide = s.guide ?? null;
    s.enter?.(this.g);
  }

  private setCard(title: string, cap: string) {
    this.ttlEl.textContent = title;
    this.capEl.innerHTML = cap;
    this.dotsEl.textContent = STEPS.map((_, i) => (i === this.step ? "●" : i < this.step ? "–" : "○")).join(" ");
    this.card.classList.remove("pop");
    void this.card.offsetWidth;      // restart the caption animation
    this.card.classList.add("pop");
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.card.classList.add("hidden");
    this.g.tutGuide = null;
    this.g.endTutorial();
  }
}
