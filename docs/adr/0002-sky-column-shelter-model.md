# Thermal shelter is a vertical sky-column model, not heat diffusion

Body temperature is driven by one number per standing column: sum the thermal resistance (per-block `R`) of everything directly above the player up to open sky; shelter = 1 − e^(−R). The body always regulates toward 36.6 °C; exposure pulls it toward effective air temperature (ambient + sun bonus only when the column is fully open). Sealed hull (R ≥ 3) ⇒ shelter ≈ 0.95, the interior drifts back to 36.6 °C and regenerates health; an open door drops a column to R < 3 and the desert gets in.

## Considered Options

- Full spatial heat simulation (per-block temperature field, diffusion, sun-heated ground): rejected — a research project in itself, and it would make "inside the ship is safe" a fragile emergent property instead of an invariant.
- Hardcoded "inside ship ⇒ safe" flag: rejected — breaks the moment the player digs a hole or props a door open; the whole point is that safety is physical and destructible.
- Horizontal walls counted as shelter: rejected — sun comes from above; a lean-to open to the sky is hot even with three walls. Only the vertical column decides.

Consequences: digging a shaft in a hillside shelters you (the roof counts); an open door makes the doorway column exposed; the cockpit's insulating glass (R 2.0) counts as a weak seal on its column.
