import { Survival, BODY_MIN, BODY_MAX, SAFE_LO, SAFE_HI, HOT_LIMIT, COLD_LIMIT, WATER_LIMIT } from "./survival";
import { DAY_SECONDS } from "./blocks";
import { Inventory, ITEMS } from "./items";
import { itemArtUrl } from "./icons";

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

/** Name of the block the crosshair is pointing at (null hides it). */
export function setBlockName(name: string | null) {
  const el = $("blockname");
  if (!name) { el.classList.add("hidden"); return; }
  el.textContent = name;
  el.classList.remove("hidden");
}

/** Brief red screen pulse when the player takes damage. */
export function hitFlash() {
  const el = $("vision-hit");
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

/** Bottom hotbar: one slot per distinct carried item type, in pack order. */
let hbKey = "";
export function renderHotbar(inv: Inventory) {
  const selId = inv.selectedSlot()?.itemId ?? "";
  const key = inv.slots.map(s => s.itemId + ":" + (s.charges ?? "")).join(",") + "|" + selId;
  if (key === hbKey) return;
  hbKey = key;
  const uniq: { itemId: string; count: number; charges?: number }[] = [];
  for (const s of inv.slots) {
    const u = uniq.find(q => q.itemId === s.itemId);
    if (u) u.count += 1; else uniq.push({ itemId: s.itemId, count: 1, charges: s.charges });
  }
  const el = $("hotbar");
  el.innerHTML = "";
  uniq.slice(0, 9).forEach((u, i) => {
    const d = document.createElement("div");
    d.className = "hb-slot" + (u.itemId === selId ? " sel" : "");
    d.dataset.hb = String(i);
    const img = document.createElement("img");
    img.src = itemArtUrl(u.itemId, 0, u.charges);
    img.alt = ITEMS[u.itemId].name;
    d.appendChild(img);
    const k = document.createElement("span");
    k.className = "hb-key"; k.textContent = String(i + 1);
    d.appendChild(k);
    if (u.count > 1) {
      const c = document.createElement("span");
      c.className = "hb-count"; c.textContent = String(u.count);
      d.appendChild(c);
    }
    el.appendChild(d);
  });
}

/** safe-band markers, positioned once; plus small marks where Health starts draining */
export function initBars() {
  const wSafe = document.querySelector("#bar-water .safe") as HTMLElement;
  wSafe.style.left = "25%"; wSafe.style.right = "0%";
  const hSafe = document.querySelector("#bar-heat .safe") as HTMLElement;
  hSafe.style.left = ((SAFE_LO - BODY_MIN) / (BODY_MAX - BODY_MIN) * 100).toFixed(1) + "%";
  hSafe.style.right = ((BODY_MAX - SAFE_HI) / (BODY_MAX - BODY_MIN) * 100).toFixed(1) + "%";
  (document.querySelector("#bar-health .safe") as HTMLElement).style.display = "none";

  const mark = (barId: string, pct: number, title: string) => {
    const el = document.createElement("span");
    el.className = "dmg"; el.style.left = pct.toFixed(1) + "%"; el.title = title;
    document.getElementById(barId)!.appendChild(el);
  };
  mark("bar-water", WATER_LIMIT, "below this, dehydration drains Health");
  const hp = (v: number) => (v - BODY_MIN) / (BODY_MAX - BODY_MIN) * 100;
  mark("bar-heat", hp(COLD_LIMIT), "below this, hypothermia drains Health");
  mark("bar-heat", hp(HOT_LIMIT), "above this, heat stroke drains Health");
}

/** Compass arrow + distance label pointing at the current quest waypoint. */
export function updateWaypoint(name: string | null, wx = 0, wz = 0, px = 0, pz = 0, yaw = 0) {
  const wp = document.getElementById("waypoint")!;
  if (!name) { wp.classList.add("hidden"); return; }
  const dx = wx - px, dz = wz - pz;
  // world angle of the target vs the camera's facing (yaw=0 looks down -z)
  const ang = Math.atan2(dx, -dz) + yaw;
  $("wp-arrow").style.transform = `rotate(${ang * 180 / Math.PI}deg)`;
  $("wp-name").textContent = name;
  $("wp-dist").textContent = `${Math.round(Math.hypot(dx, dz))} m`;
  wp.classList.remove("hidden");
}

/** Edge-pinned arrows for markers too far for a 3D beam: bearing vs camera yaw,
 *  tinted per marker kind, with the straight-line distance. */
export function updateMarkArrows(list: { ang: number; dist: number; color: string }[]) {
  const box = document.getElementById("mark-arrows")!;
  box.textContent = "";
  const W = window.innerWidth, H = window.innerHeight;
  const rx = W / 2 - 70, ry = H / 2 - 70;
  const placed: number[][] = [];
  for (const m of [...list].sort((a, b) => a.dist - b.dist)) {
    // screen direction: 0 rad is up, +x right, +y down
    const sx = Math.sin(m.ang), sy = -Math.cos(m.ang);
    const t = Math.min(rx / Math.max(Math.abs(sx), 1e-6), ry / Math.max(Math.abs(sy), 1e-6));
    let x = W / 2 + sx * t, y = H / 2 + sy * t;
    // co-bearing markers slide apart instead of stacking
    while (placed.some(([px, py]) => Math.abs(px - x) < 60 && Math.abs(py - y) < 60)) y += 44;
    placed.push([x, y]);
    const el = document.createElement("div");
    el.className = "mark-arrow";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.color = m.color;
    el.innerHTML = `<span class="ma-glyph" style="transform: rotate(${m.ang * 180 / Math.PI}deg)">&#9650;</span><span class="ma-dist">${Math.round(m.dist)} m</span>`;
    box.appendChild(el);
  }
}

export function updateHud(s: Survival, inv: Inventory, tSec: number, days: number, units: "C" | "F", now: number,
  status?: { regulated: boolean; napReady: boolean; stormBroken: boolean }) {
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
  renderHotbar(inv);

  $("warn-hot").classList.toggle("hidden", s.body <= SAFE_HI);
  $("warn-cold").classList.toggle("hidden", s.body >= SAFE_LO);

  // status chips beside the clock: what the current room and the bed currently allow
  $("chip-reg").classList.toggle("hidden", !status?.regulated);
  $("chip-storm").classList.toggle("hidden", !status?.stormBroken);
  $("chip-nap").classList.toggle("hidden", !status?.napReady);

  // vision overlays
  $("vision-vignette").style.opacity = String(s.vision * 0.85);
  const crit = s.water < 5 || s.health < 30;
  $("vision-red").style.opacity = crit ? String(0.35 + 0.25 * Math.sin(now / 220)) : "0";
}
