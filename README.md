![Inner Roots](docs/cover.svg)

# Inner Roots — Gameplay Demo v1.0

A quiet first-person exploration game about finding your way through a living forest. Your flashlight barely reaches the next turn. Send a pulse through the buried roots: veins wake unevenly, trees contract, and a thick black film drains away before slowly crawling back.

**Three complete mazes. Nine signals. One demo ending.** All three mazes are selectable from the centred main menu, or playable in sequence. Cleared groves and best times are saved on your device.

| Maze | Environment |
| --- | --- |
| The Hollow | Dense old-growth woodland, moss, leaf litter and warm root light |
| The Drowned | Pale trunks, shallow black water, reeds, cold fog and cyan veins |
| The Cinder | Charred trunks, broken crowns, sparse ground cover and ember light |

## Play locally

No installation or build is required. Serve the `dist/` folder with Python 3:

```sh
python3 -m http.server 5173 --directory dist
```

Open **http://localhost:5173**. A WebGL 2 capable browser is required. Use a desktop browser for the full mouse-and-keyboard experience. The vendored engine, materials, logo and synthesized sound work locally; Google Fonts are optional and have system fallbacks.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Walk and strafe |
| Mouse | Look without holding a button |
| Left click / Space | Send a root pulse |
| Shift | Run |
| M | Open the explored field map |
| Escape | Pause and release the mouse |
| Arrow keys / Q E | Alternative movement and turning |

Recover three pale signals in each grove, then enter its wooden gate. The pulse recharges in fourteen seconds, allowing the slow liquid return to finish. Toggle **SOUND ON** for quiet directional creaks, root cracks and wet crawling textures. There are no enemies, jump scares or time limits. Touch controls are available; physical-phone testing remains limited.

Native Pointer Lock is requested on entry and resume. Embedded browsers that refuse it use continuous no-hold mouse look, including turning at the window edges. Refreshing resets the current run; completed groves and best times persist locally.

## Verification

```sh
node verify.mjs
node verify-nerves.mjs
node verify-audio.mjs
node verify-demo.mjs
```

The demo was played through in a real browser using keyboard movement: all nine signals collected, all three gates completed, transitions and the final ending displayed, and saved completion marks survived reload. The centred menu and instructions were reviewed at desktop size and 390 × 844. Shader and console checks passed. Native Pointer Lock in a supporting desktop browser and physical touch hardware still need hands-on checks.

The route suite covers 300 generated mazes and 377,244 collision/collection samples. Additional checks cover propagation, monotonic surges, quiet PCM textures, silent boundaries and visual/audio timing. Serve the project root and open `qa/audio.html` to render the actual sound graph offline and check stereo, headroom, mute, pause and resume. Digital output was verified; physical-headphone listening has not been reviewed.

## Source and credits

Built with vendored **Three.js 0.181.1**. Its MIT license is included in `dist/vendor/THREE-LICENSE.txt`.

Game, original vector logo, procedural environments and synthesized sound: **Leo Lune**. The included photographic material atlas was generated for this project; its prompt and development notes are in [the development history](docs/DEVELOPMENT_HISTORY.md). No reference video frames or creator assets are included.

Visual inspiration: the forest-light study by **011 / @nomoreluca**, [shared by Three.js](https://x.com/threejs/status/2123549786272100698). This demo is an original interpretation.

This is the first gameplay demo, version `1.0.0-demo.1`. Original project code and assets carry no additional license grant; the third-party Three.js license remains applicable to its files.
