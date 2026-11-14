# Three.js with a custom voxel renderer instead of Divine Voxel Engine

The user asked for Divine Voxel Engine, but its 2026 form (`@divinevoxel/vlox`) is a two-month-old beta-0.0 rewrite: single maintainer, mandatory Web Worker threading, SharedArrayBuffer requiring COOP/COEP headers (impossible on GitHub Pages, the deployment target), and debug-grade player physics. We chose Three.js (r180) with a small custom chunked voxel renderer, trading more in-house renderer code for zero external API risk and static-host compatibility.

## Considered Options

- `divine-voxel-engine` (npm, 2023): dead legacy, incompatible with the current engine. Rejected.
- `@divinevoxel/vlox` beta: full feature fit and excellent docs, but beta churn, bespoke ECS, and header requirements conflict with GitHub Pages hosting. Rejected.
- Raw Three.js + custom chunk meshing: chosen.
