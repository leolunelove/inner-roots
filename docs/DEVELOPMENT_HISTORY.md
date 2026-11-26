# Hollow Trace

A playable first-person forest maze, inspired by the forest-and-light study shared by [Three.js](https://x.com/threejs/status/2123549786272100698) and originally posted by [011 / @nomoreluca](https://x.com/nomoreluca/status/2123381030362952178).

## Reference breakdown

The visible reference combines a natural forest trail, granular surface detail, a dark background, and a moving band of illumination. The light makes the terrain emerge and disappear, which gives the scene its sense of discovery. The post does not confirm how the original was made; photogrammetry, point clouds, or Gaussian splatting would be possible approaches, not established facts.

This game translates those visual qualities into mechanics: a directional flashlight follows your aim and leaves the surrounding forest dark, while a rechargeable pulse reveals up to sixteen metres of terrain and expands the field map, and pale signal beacons reward exploration. Three recovered signals power an exit. The maze generates a different layout after each completed run.

The environment is original procedural geometry, with raised earth banks, tree trunks, fern fronds, stones, canopy points, floating motes, fog, and a generated photographic material atlas. It is a stylized interpretation rather than a reproduction of the original forest scan. No video frames or creator assets are included.

## Play

- WASD: walk and strafe.
- Mouse movement: look around without holding a button. Native pointer capture is requested on Enter / Continue. If the embedded browser refuses capture, no-hold mouse look remains available, with continued turning at the window edges.
- Arrow up/down: walk. Arrow left/right or Q/E: turn.
- Shift: run.
- Left click or Space: scan; recharge takes fourteen seconds to allow the slow liquid return to finish.
- M: explored-area map.
- Escape: close the map, or pause and release the cursor. Continuing resumes mouse look.
- Touch: left thumbstick to walk, drag the scene to look, tap the pulse control to scan.

Signals collect automatically within 1.2 metres. Recover all three and enter the illuminated wooden gate. Sound is optional and begins only after the sound button is enabled. There are no jump scares or enemies. A best completion time is stored locally; active runs reset on reload.

## Run locally

Serve `dist/` using any static HTTP server, for example `python3 -m http.server 5173 --directory dist`. Open `http://localhost:5173`.

Three.js 0.181.1 is vendored under `dist/vendor/`, with its MIT license. The v0.2 forest adds shadow-casting trees, textured soil, bark, stone and moss, paired veined fern leaflets, ground litter, and player-triggered scan bands. The reveal is applied directly to opaque surfaces and leaves; the ambient light no longer brightens the whole forest during scans. Fonts are served by Google Fonts, with system fallbacks. No build or package installation is required. A WebGL-capable browser is required.

## Verification

`node verify.mjs` checks 300 maze layouts, all signal and exit routes, collision samples along the complete routes, and separation of the starting point from targets. The initial maze was also played through in the browser: all three signals collected, the exit unlocked, the finish screen appeared, and a new maze reset correctly. Scanning, map reveal, sound toggle, pause/resume, and desktop and 390 × 844 layouts were checked without browser console errors. Touch layout was checked in a resized desktop browser; physical phone input and audible sound quality still need human review.


## v0.2 verification

The updated renderer loaded without shader or console errors. Mouse movement changed the heading from 180 to 200 degrees without drag state; left click triggered a scan. WASD movement recovered the first signal, Space triggered the surface reveal, M opened the map and returned to mouse look, and Escape paused and released the cursor. The embedded WebView refused native pointer capture, so the no-hold fallback was verified there. Native pointer capture uses the browser Pointer Lock API but still needs a hands-on check in a supporting desktop browser. The previous full-run completion test applies to the unchanged objective logic.

## Material asset and generation prompt

The built-in imagegen tool generated `dist/assets/forest-materials-v2.png`, a 1254 × 1254 atlas. The image is sampled as four quadrants in the surface shaders; each tile repeats independently. It is included locally in the published game.

Prompt: “A photorealistic 2 × 2 PBR albedo atlas: top-left damp woodland path floor with brown soil, decaying small beech leaves, needles, roots and gravel; top-right rugged vertical grey-brown deciduous bark with lichen; bottom-left deep natural green moss on humus with small clover and roots; bottom-right weathered grey-brown forest limestone with fissures and lichen. Four equal square swatches, exactly divided at the horizontal and vertical centers, orthographic, flat diffuse lighting, no baked shadows, no highlights, no borders, text, perspective or stylization; each swatch independently seamless.”


## v0.2.1 — Scanning drives navigation

Removed the automatic lighting sweep from surfaces and scan points. The menu uses fixed illumination; gameplay has only a dim local light within roughly three metres. Clicking or pressing Space sends a scan out to sixteen metres, with a short illuminated wake for reading junctions before it fades completely by 4.4 seconds. The six-second recharge remains. Scanned map information persists, while footsteps reveal only the adjacent area. Both surface and point shaders share the same scan envelope.

Verified v0.2.1 in the browser: unscanned terrain stayed dark beyond the faint foot light; a scan revealed the route; it faded back to darkness before recharge finished; and the scanned map remained available afterward. No shader or console errors were reported.


## v0.3.0 — Flashlight and a varied trail

Replaced the omnidirectional foot glow with a physical spotlight offset slightly to the right and below the camera. It follows the player's aim, has a soft-edged cone, distance falloff and shadow casting. Gameplay ambient light stays dim; there is no automatic sweep. The scan still reveals a much wider area and then fades.

The trail now has a meandering worn-soil centre, darker damp patches, leaf-rich shoulders, clustered small stones, denser ferns, and exposed curved roots that follow the terrain. Roots and stones cast shadows in the beam. The walking lane remains passable.

Verified in the local browser: aiming moved the beam, walking recovered the first signal, scanning revealed the wider surroundings, and visibility returned to the narrow flashlight cone after recharge. No shader or console errors were reported. The 300 generated route checks also passed.


## v0.3.1 — Cheap handheld torch

Replaced the even spotlight with a projected reflector pattern: an off-centre, slightly elliptical warm hotspot, faint cooler spill, uneven reflector shoulders and a feathered edge. The light uses inverse-square falloff and a short range. The pattern is a linear-intensity CanvasTexture on the native shadow-casting spotlight; it is projected onto actual terrain, roots and foliage. There is no screen-space light circle or illuminated volume.

The source is at the cropped held torch's lens, with small walking motion, breathing motion and damped aim response. A small local fill reaches only the nearby torch model, with a 0.65 m range; it cannot reach the forest floor below the player. Scanning remains independent.

Verified in the browser: the dim beam was usable along the first signal route, turning moved its projected hotspot and shadows, and scanning faded back to the weak torch afterward. No browser or shader errors were reported.


## v0.4.0 — Ghostlight scan

The pulse now travels as a rippling front of cool ivory light. Fine broken filaments and surface points catch the leading edge; a faint echo follows it, and a warmer afterimage dissolves into world-anchored grain. Terrain height and low-frequency surface variation bend the front across banks, roots and trunks. Fine points are sampled from the actual ridged trunk meshes as well as the ground.

Surface materials and scan points share one field in `dist/scan-field.js`. The range remains sixteen metres, light fades completely by 4.6 seconds, and recharge remains six seconds. It is still entirely player-triggered. The cheap flashlight is independent.

Verified in the browser: captured the travelling front and later afterimage, held/repeated Space during recharge without restarting the scan, waited for full fade back to the weak torch, and checked that the map retained the scanned area. The forest and point shaders compiled without console or shader errors.


## v0.5.0 — Underground nerves and dissolving darkness

The pulse now excites a branching network along the maze's walkable routes. Thin lit strands split through the soil, attach to nearby tree bases and climb their ridged bark. Each route has its own propagation speed. The network is recomputed from the player's position on each scan, rather than expanding as a circular wave.

The arriving network loosens a black surface film: uneven fingers of darkness drain down the forest, briefly exposing the terrain, then climb upward again. The effect fully resolves back to the weak flashlight by 5.6 seconds; recharge stays six seconds. The map records reached routes and their adjacent banks within approximately sixteen metres of route distance.

Verified in the browser from two pulse origins: branching ground light, tree attachments, descending and returning ink, full recovery, signal collection, remembered map routes, cooldown, and restart followed by a fresh pulse. No shader or console errors were reported. Automated checks passed for 100 nerve graphs (connectivity, route distance, speed bounds and unequal arrival times) and 300 complete maze routes. Run both with `npm test`.

## v0.5.1 — Buried veins and heavy liquid

Ground nerves now illuminate the soil material through a soft, variable-width mask rather than floating strips. Curved paths split into tapering capillaries; soil colour and texture remain visible within their warm diffuse glow. Bark strands follow the trunk curvature, taper, and break into textured clumps. Route propagation retains its different branch speeds.

The black coating has rounded, varying-size lobes, accelerated droplets and connecting necks. It smooths the underlying surface, lowers roughness and catches small wet reflections at its thick boundary. Its returning front rises with eased motion and a broad meniscus. Full fade and the six-second recharge remain unchanged.

Verified both liquid phases and the buried glow in the browser, including scans from a second position, fade to flashlight, WASD signal collection, map controls and restart with rebuilt textures. No shader or console errors were reported. The 300 complete maze routes (377,244 collision/collection samples) and 100 nerve-graph checks passed using `node verify.mjs` and `node verify-nerves.mjs`.

## v0.5.2 — A waking forest

Branches now travel at a wider range of speeds, with individual hesitations and uneven time intervals along each route. Eased travel slows the front at those intervals before it surges ahead; propagation remains continuous in either direction. The first excitation is followed by two smaller, differently delayed pulses. Their glow swells and narrows within the soil, with related surges climbing the bark.

The black liquid moves 2.25 times more slowly through its full drain and return. Nearby droplets descend over several seconds, the path holds open briefly, then thick lobes crawl back upward. The global effect can last 13.5 seconds across the network; recharge is fourteen seconds, so another scan cannot cut the return short. Timing constants are shared by the terrain, bark, arrival texture and recharge display.

Browser verification covered early surges, descending liquid, exposed terrain, returning lobes, full fade before recharge, a second scan origin and WASD signal collection. No console or shader errors occurred. The 100 graph checks now also cover continuous monotonic propagation in both directions, hesitation bounds, arrival encoding and enough time for the liquid return; these and all 300 complete maze-route checks passed.

## v0.5.3 — Pulse-driven tree contractions

Each tree reacts when the branching network reaches its roots. A short directional contraction travels upward, recoils and settles, followed by a weaker, individually delayed after-twitch. The root contact remains anchored. Movement increases gently with height and peaks at a few centimetres in the upper tree; route distance reduces the reaction at the pulse's outer reach.

Trunks, attached branches, canopy, bark veins, surface points and shadow depth share the same deformation. Each scan updates the per-tree arrival and reach data from the nerve graph. Unreached trees remain still, and every reaction returns to its original position. Restart disposes the reaction texture, cloned tree materials and shadow materials before rebuilding them.

Verified the staggered contractions and settling in the browser, with attached veins and tree silhouettes intact. WASD signal collection, pause, restart and a fresh scan passed without console or shader errors. The 300 complete maze routes and 100 propagation-graph checks also passed.

## v0.5.4 — Quiet, reactive forest sound

Enabling Sound adds small root splinters, dry resonant wood creaks and damp friction around the twitching trees. These use the actual per-tree arrival data and the animation's shared contraction/echo delays. Up to five nearby, separated trees contribute, with quieter after-creaks. Their sources sit at the roots and trunks; stereo position and distance follow the player's camera.

The black film has a soft granular suction texture during descent and a slower, darker version during its return. Those sources follow reached maze routes and the liquid's 2.25× slower timeline. The soundscape replaces the scan's previous sine tones, lowers the ambient bed and keeps the existing signal/footstep cues quieter. All textures are synthesized locally with Web Audio; no downloaded samples or audio service is required.

The mix has gentle attack/release ramps, restrained source gains, a soft compressor and at most eight simultaneous effect voices. Sound starts off. Pause, map, loss of focus and winning fade the forest effects; resume and re-enabling Sound continue at the current visual phase without replaying expired cracks. Restart clears the old sound events.

Verified Sound on/off, scan playback, pause and restart in the browser without console or shader errors. The browser's actual OfflineAudioContext render passed stereo, quiet headroom, pause without animation frames, mute, resume, completed fade and voice-count checks: peak 0.02086, overall RMS 0.00345, maximum six effect voices in the fixture. These are digital signal checks, not a physical-headphone listening review. The PCM tests cover finite samples, headroom, silent texture boundaries, a continuous wind seam and visual/audio timing at 24, 44.1 and 48 kHz. Existing maze and nerve-graph checks passed.

Run `node verify-audio.mjs` for PCM and timing checks. To reproduce the browser render, serve the project root and open `qa/audio.html`; this test page is outside the published `dist/` directory.
