# Inner Roots — Varied Groves

Version `1.1.0-demo.1` · 26 November 2026

- Larger 6×6, 7×7 and 8×8 maze layouts.
- Tapering narrow passages, broader tree lanes and open glades.
- Dense leafy hedges and tangled thickets mixed with tree-lined earth banks.
- Shared trail boundaries for terrain, scenery, collision and the explored map.
- Fresh best times for the larger layouts.
- Spatial forest batches let the view and flashlight skip unseen sections.
- Instanced scene buffers released when changing groves.
- Optional direct maze links using `?maze=hollow`, `?maze=drowned` or `?maze=cinder`.

The expanded Hollow was completed in the browser with all three signals and the exit. Drowned and Cinder rendering and grove switching were checked in Safari. Chromium lost graphics context support during testing, including for the unchanged v1.0 baseline; the final v1.1 Chromium rerun remains outstanding. Automated checks cover 75 larger layouts and 351,124 body-route samples in addition to the existing maze, propagation and audio suites.

---

# Inner Roots — First Gameplay Demo

Version `1.0.0-demo.1` · 26 November 2026

- Original vector identity and a centred main menu.
- Three distinct, complete maze environments: The Hollow, The Drowned and The Cinder.
- Nine recoverable signals, three exit gates, progression and a final demo ending.
- Weak handheld flashlight, uneven underground vein pulses and slowly returning liquid darkness.
- Subtle tree contractions with quiet positional wood/root and wet crawling sounds.
- WASD, mouse look, running, explored map, pause, restart and menu return.
- Local completion marks and best times for each maze.

The complete three-maze sequence was played through in the browser. All nine signals and three exits worked; the ending, transitions and saved progress were verified. Desktop and 390 × 844 menus were visually checked. Automated maze, propagation, audio and fixed-demo-route checks passed.

This release is a gameplay demo. Browser Pointer Lock support varies; embedded browsers have a no-hold fallback. Physical touch devices and subjective headphone sound balance have not received hands-on testing. Current runs restart on refresh.
