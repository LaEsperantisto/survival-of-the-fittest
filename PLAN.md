# Feature Plan (2026-11-21) — Chest Interface + Chest rename

Settled by the grilling session (decisions 1–7, glossary, ADR 0009). The Engine Core
change is a separate branch the user will describe after this lands — do not design it
unasked.

## A. Rename: "Supply Chest" -> "Chest"
- `blocks.ts` CHEST def name, `items.ts` chest item name, `promptFor` ("E: Open Chest"),
  quests.ts tutorial.ts captions/goal, chronicle text, `index.html` chest panel header,
  README wording. Glossary already done.

## B. Chest Interface block
- New block `CHEST_INTERFACE` (next free id): like CHEST_CONNECTOR — solid, breakTime ~2,
  placeable, not natural; renderer art case (Connector body + lit front panel).
- Item `chest_interface` "Chest Interface"; bench recipe: 2 metal + 1 glass.
- Cluster membership, rail-equal in every way except openable:
  - `chestCluster` BFS walks CHEST | CHEST_CONNECTOR | CHEST_INTERFACE.
  - Cluster content key + grid sizing count **Chest cells only** — adding/breaking an
    Interface or Connector never changes stored contents or grid size.
  - Placing an Interface touching several clusters merges them (like a Chest).
- Machines reach through it: `chestSlotsAt` resolves the cluster from any member cell, so
  Inserters (front and back), the Wood Generator's beside-chest read, and the Planter's
  seed check all work through Interfaces and Connectors.
- Aim prompt: "E: Open Chest Interface"; touching no Chest -> toast "Nothing is linked
  yet.", error sound.

## C. List UI (opens instead of the tiling grid)
- Panel bound to the cluster: rows grouped by item kind with total count, alphabetical,
  search field (like the Catalogue's).
- Take: one / all of that kind. Sacks appear as whole entries — take/place whole only,
  never open one in the panel.
- Put: drag from the inventory grid onto the list = auto-stow into the cluster's first
  free cell; the snuggest matching open Sack fills first (existing hand-insertion rule).
- Plain Chests keep their grid panel; the Interface is the list door.

## D. Docs + ship
- README: rename pass + Chest Interface paragraph (craft recipe, list door, rail-equal).
- ADR 0009 already written; glossary entries already written.
- `npx tsc --noEmit`; live-verify each behaviour in the browser; `npm run build`;
  commit/push both repos (root + `dist/` frontend).
