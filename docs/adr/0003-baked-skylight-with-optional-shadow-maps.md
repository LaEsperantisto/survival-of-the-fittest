# World lighting is baked per-chunk skylight; real-time shadows are an opt-in mode

Chunk meshes carry a baked skylight value per face (a per-chunk flood fill of sky
level, `light.ts`), consumed by a custom shader that tints it with the day→moon
ambient and adds campfire/lamp point lights in the fragment — no Three.js scene
lights on the world at all. This is the default ("Baked sky light"). A second
mode ("Real-time shadows") swaps in a directional light with shadow maps;
switching re-bakes every loaded chunk. Any cover dims the sky, and Leaves cost
double, which is what makes canopies shade the ground — and it is exactly the
same attenuation budget the thermal column model (`docs/adr/0002`) spends, so
light and shelter can never disagree.

## Considered Options

- Per-fragment scene lighting only (Three.js directional + point lights): rejected — per-pixel point-light falloff for dozens of campfires/lamps over infinite chunks blows the draw-call and fragment budget on mid-range mobile, and caves/interiors need the *flood-filled* sky value anyway; it is not expressible as a light position.
- Baked lightmap textures per chunk: rejected — an extra 16×16×CH texture array, filtering seams between chunks, and UV plumbing; per-vertex/per-face attributes cost nothing extra since the meshes are rebuilt on edit regardless.
- Real-time shadows as the only mode: rejected — shadow maps can't reach the render-distance edge at usable resolution, can't darken sealed interiors, and re-shade every frame even where the world is static; the flood model is static until a block changes.

Consequences: the default mode's light only updates where the world changed
(dirty-chunk budget per frame, with a lagging-neighbor recheck pass); placing a
torch lights instantly, digging a roof-hole re-lights within a few frames.
Shadow mode is prettier near the player (crisp sun silhouettes, moving cloud of
mob shapes) and costs GPU per frame — hence a Settings toggle, and switching it
drops every light map and marks all chunks dirty once. Sun and moon ride one
arc as billboards; moonlight is the night ambient of whichever mode is on.
