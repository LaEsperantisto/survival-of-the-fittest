import { Survival, BODY_MIN, BODY_MAX, SAFE_LO, SAFE_HI } from "./survival";
import { DAY_SECONDS } from "./blocks";
import { Inventory, ITEMS } from "./items";

const $ = (id: string) => document.getElementById(id)!;

let toastTimer = 0;

export function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toastTimer as unknown as number);
  toastTimer = setTimeout(() => (t.style.opacity = "0"), 2600) as unknown as number;
}

export function setPrompt(msg: string | null) {
  const p = $("prompt");
  if (!msg) { p.classList.add("hidden"); return; }
  p.classList.remove("hidden");
  p.textContent = msg;
}

export function setSubmerged(on: boolean) {
  $("vision-water").style.opacity = on ? "1" : "0";
}

/** safe-band markers, positioned once */
export function initBars() {
  const wSafe = document.querySelector("#bar-water .safe") as HTMLElement;
  wSafe.style.left = "25%"; wSafe.style.right = "0%";
  const hSafe = document.querySelector("#bar-heat .safe") as HTMLElement;
  hSafe.style.left = ((SAFE_LO - BODY_MIN) / (BODY_MAX - BODY_MIN) * 100).toFixed(1) + "%";
  hSafe.style.right = ((BODY_MAX - SAFE_HI) / (BODY_MAX - BODY_MIN) * 100).toFixed(1) + "%";
  (document.querySelector("#bar-health .safe") as HTMLElement).style.display = "none";
}

export function updateHud(s: Survival, inv: Inventory, tSec: number, days: number, units: "C" | "F", now: number) {
  const fill = (id: string) => document.querySelector(`#${id} .fill`) as HTMLElement;
  fill("bar-health").style.width = s.health + "%";
  fill("bar-water").style.width = s.water + "%";
  const heatPct = ((s.body - BODY_MIN) / (BODY_MAX - BODY_MIN)) * 100;
  fill("bar-heat").style.width = heatPct + "%";

  const frac = (tSec % DAY_SECONDS) / DAY_SECONDS;
  const hh = String(Math.floor(frac * 24)).padStart(2, "0");
  const mm = String(Math.floor((frac * 24 % 1) * 60)).padStart(2, "0");
  $("clock-day").textContent = "Day " + days;
  $("clock-time").textContent = hh + ":" + mm;
  const t = (v: number) => units === "C" ? Math.round(v) + "°C" : Math.round(v * 9 / 5 + 32) + "°F";
  $("clock-temp").textContent = `air ${t(s.lastAmbientEff)}  body ${t(s.body)}`;

  const slot = inv.selectedSlot();
  $("held").textContent = slot ? ITEMS[slot.itemId].name : "—";

  const kg = inv.weight(), lim = inv.weightLimit();
  const wEl = $("weight");
  wEl.textContent = `${kg.toFixed(1)} / ${lim} kg`;
  wEl.classList.toggle("encumbered", kg > lim);

  // vision overlays
  $("vision-vignette").style.opacity = String(s.vision * 0.85);
  const crit = s.water < 5 || s.health < 30;
  $("vision-red").style.opacity = crit ? String(0.35 + 0.25 * Math.sin(now / 220)) : "0";
}
