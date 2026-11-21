# The Chest Interface is an openable Chest Connector

Players wanted easy access to their chest storage without standing at every chest. We
considered a **remote terminal** — one block that opens any chest cluster anywhere in the
world — and rejected it: radius/remote access is exactly the model ADR 0006 rejected for
machine I/O, and applied to storage it dissolves the game's travel-and-caching economy
(every long trip collapses into a walk back to one magic block).

Instead the Chest Interface is an openable Chest Connector, and a Connector in every way:
it carries the chest link through itself — joining and merging clusters, extending them,
and letting Inserters and Planters reach through it — while storing nothing and claiming
no Inventory Grid cell. Distance access to a cluster is therefore earned with physical
Connector/Interface lines, visible and debuggable in world space. What the Interface adds
over a Chest is the **list view**: everything in the cluster grouped by kind, take one or
all, put anything that fits (the snuggest open Sack fills first). A Sack is taken whole —
the panel never opens one.

Consequences worth remembering: cluster identity and content storage keys are computed
from the Chest cells alone, so adding or breaking an Interface/Rail never changes a
cluster's stored contents; grid size counts Chests only; an Interface touching no Chest is
a dead block.
