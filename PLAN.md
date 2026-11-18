# Feature Plan (2026-11-18)

Five execution batches. Each batch: edit → `npx tsc --noEmit` → live verify in dev browser
(`npm run dev`, Playwright tab) → `npm run build` → commit+push **both** repos (root + `dist/`), per AGENTS.md.

## Batch 1 — copy, icons, block defs (low risk)
1. **Favicon = the Sun**: replace the PNG data-URI in `index.html` with an inline SVG favicon — orange
   disc + rays matching the `#warn-hot` overheating indicator (☀ U+2600, `#ff7a2e`, styles.css:213).
2. **Storm Breaker needs an Alloy Disassembler**: `STORM_BREAKER` def (blocks.ts:167) `minTier: 0` → `2`
   (disassemblers top out at tier 2 = alloy). Same for `THRUSTER`/`THRUSTER_LIT`? — no, only the
   breaker was asked.
3. **Bag sizes**: default grid 3×4 → **5×4** (`items.ts:167` `w=3;h=4`, `game.ts bagSize()` fallback
   `{w:3,h:4}`); Backpack I bag 4×5 → **6×5** (items.ts:77, desc too); Backpack II bag 5×6 → **7×6**
   (items.ts:112, desc too) and its item footprint 2×2 → **3×2**. Update GLOSSARY Backpack entry and any
   README grid numbers.
4. **Mobile button labels** (`index.html:61-62`): "Act" → "Use Block", "Use" → "Use Item".
5. **Snake Skin item icon**: `icons.ts` has no `snake_skin` case → renders transparent. Add a case:
   a 1×2 hanging hide pelt with scale pattern, base `#b3946a`.
6. **Armoury / Sandstorm Breaker popup names swapped** (user-reported): code defs look correct
   (blocks.ts:167-169); reproduce live first (place both, look, read `#block-name`), then fix whatever
   layer is swapped (id map, display name, or model texture pairing).

## Batch 2 — renderer polish
7. **Storm dome**: `renderer.setStormDome` — `opacity 0.05` → `0.12`, `side: BackSide` → `DoubleSide`
   (visible from inside AND outside).
8. **Ghost block = real texture/model**: `renderer.setGhost` currently shows a flat coloured cube.
   Rebuild: geometry from the block's actual look — atlas-tiled cube (with the block's TILE faces),
   chamfer shapes for curved hull/slope, bench/bed models, door slab, crossed quads for sapling/crops.
   Constant full-bright vertex colours, `MeshBasicMaterial` + atlas map, opacity ~0.55, `depthWrite: false`,
   cache geometry per `(id, rot)`.
9. **Mobs flash red when hit**: `MobVisual` gains `setFlash(on)`; at model build, collect every mesh;
   while flashing swap to a shared red material, then restore. Trigger: game.ts:1408 attack →
   `m.hitFlash = 0.15`; decay in `mobFrame`. A few frames of pure red, no tint blending.

## Batch 3 — caves
10. **Ore density ÷10**: wall-crust thresholds (gen.ts:996-999: cobalt 0.72, iron 0.665, copper 0.7,
    alabaster 0.715). Measure current ore-cell rate with a tsx sampling script against the real noise
    functions, find thresholds giving ~10 % of the current yield, apply, re-measure to confirm.
11. **Cave openings to the surface**: add a deterministic breach field (value noise at ~1/9 scale) —
    inside a breach patch the cave ceiling rises to the surface so the cave band carves an actual hole
    (genChunk underground loop already carves any `caveC` cell up to the local `top`; keep `caveAt` and
    the chunk loop consistent via a shared `caveCeil(seed,x,z,h)`). Guards stay: crash site, oasis
    seals, town plots. Verify from the air (screenshot) and by standing in a hole.

## Batch 4 — vultures
12. **Flight**: vultures are airborne — cruise 5–9 m above terrain, slow circling wander (banked yaw),
    no gravity/ground-snap, no `mobCanStand` (instead: clear-cell check at flight height); descend to
    ground to bite committed (bleeding) prey, fly away from non-prey (flee unchanged but airborne).
    Spawn height handled in spawn code; despawn unchanged.
13. **Vulture model**: replace the hunched 0.9 m walker: dark body, long pale neck + small bald head with
    hooked beak, broad tapered wings that flap on `animate(t, moving)`, spread tail, long bare legs.
    Verify with close-range screenshots from several angles.

## Batch 5 — rotation & multi-block placement
14. **R rotates, G drops**: field R key handler (game.ts:858) stops throwing items — R rotates a held
    rotatable block only (no-op otherwise, keep the inventory-grid R behaviour). New G key: drop the
    currently-held item (same path as the old throw branch + mobile Drop parity). Update the controls
    list in main.ts:238 and README instructions sentence.
15. **Rotation actually does something on placement**: `place()` picks the bench peer cell and the bed's
    second cell from `slot.blockRot` direction (0→+x, 1→+z, 2→−x, 3→−z) instead of the first open
    neighbour / fixed +x; store the rot nibble on every constituent cell. Meshing already derives
    orientation from partner position + stored rot — verify bench, bed, curved hull visibly turn with R.
16. **Multi-block placement validation**: Bed — require BOTH cells air, solid floor under both, refuse
    with a toast if the rotated partner cell is blocked (no more silent 1×1 beds). Bench — peer cell must
    be air at the rotated direction AND have solid floor; doors — floor under the lower cell required.
    Check every multi-block pair (bed+pillow, bench+ext, door+upper) for the same hole/occupancy bugs.

## Docs
GLOSSARY: Backpack entry (new grids), Sandstorm Breaker (alloy disassembler only), Cave Mouth entry
(surface openings), Vulture (flies). README: controls (R/G), backpack grid numbers if present.
