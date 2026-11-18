# Machine I/O is block adjacency only

Factory automation had to pick an access model; we chose Create-style adjacency — an Inserter
moves items only between the blocks it physically touches (in front → behind), a Planter works
the cell two above it off the block beneath, a Harvester reaps below and outputs above — over
the radius-based "machine vacuuming nearby chests" common in factory games. Rationale: the game
is placement- and rotation-driven (the rotation nibble already orients multi-blocks), adjacency
makes every machine's data flow visible and debuggable in world space, and radius logic would
silently teleport items past the build/salvage loop that carries the game. Rejected: radius I/O
(deferred to a late-game tier), chest-network teleport as primary transport (kept for a later
"pipes" tier).
