# The Grid trips dark under a mandatory Power Panel

Electricity models demand-vs-supply somehow; we chose a binary Grid: every connected Pole
network needs exactly one Power Panel, and whenever total draw exceeds total supply the Panel
trips — the entire Grid dies and stays dead until the player walks over and resets it. Chosen
over priority-shedding brownouts (arbitrary ordering hidden from the player) and Satisfactory-
style flow with line losses (bookkeeping the player can't see). A blackout you caused and fix
by hand is survival fiction; a silently dimmed lamp is a bug report. Consequence: generators
must be over-provisioned or buffered by Batteries for nights and calm days, which is the
intended economic pressure of the factory line.
