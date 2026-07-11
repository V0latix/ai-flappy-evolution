# AGENTS.md

## Project

Neuro Evolution Arcade is a static browser app for training neural-network
agents on small arcade games through neuroevolution. It currently includes
Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula Circuit. The codebase
should continue evolving as a multi-game lab.

The app has no build step and no runtime dependencies. It is served directly
from `index.html`, `src/main.js`, `src/formula-track.js`, `src/formula-training.js`,
and `src/styles.css`.

## Commands

Run this before every commit or push:

```bash
npm run check
```

This command runs:

- `node --check src/main.js`
- `npm test`

The test suite uses Node's built-in `node:test` runner. `test/app.test.mjs`
uses a lightweight DOM/canvas mock; `test/formula-track.test.mjs` and
`test/formula-training.test.mjs` cover Formula Circuit's pure modules.

## Repository Layout

- `index.html`: app structure, controls, and explanatory content
- `src/main.js`: shared neuroevolution loop, game profiles, human mode,
  localStorage champion management, presets, and canvas drawing
- `src/formula-track.js`: Formula Circuit's normalized Monza-inspired centerline,
  segments, track widths, and ordered checkpoint geometry
- `src/formula-training.js`: Formula Circuit's two-phase fitness-session state
  and phase-two population seeding helpers
- `src/styles.css`: responsive layout and control styling
- `test/app.test.mjs`: regression tests for the main app flows
- `test/formula-track.test.mjs`: Formula Circuit geometry and checkpoint tests
- `test/formula-training.test.mjs`: Formula Circuit training-phase and fitness tests
- `README.md`: user-facing documentation and game roadmap

## Implementation Rules

- Keep the app dependency-free unless a feature clearly requires a package.
- Preserve static hosting compatibility. The app must still work by opening
  `index.html` or serving the folder with a static file server.
- Keep edits scoped. Avoid unrelated refactors when adding gameplay or UI
  features.
- Use ASCII in source files unless a file already requires non-ASCII text.
- If changing `src/main.js`, update or add tests in `test/app.test.mjs`.
- If changing Formula Circuit's track geometry or training-session helpers,
  update the matching `test/formula-track.test.mjs` or
  `test/formula-training.test.mjs` coverage.
- If adding a new control in `index.html`, add coverage that proves the control
  exists and affects app state.
- If changing neural-network shape, update:
  - `INPUTS`, `HIDDEN`, or genome sizing in `src/main.js`
  - network labels in `INPUT_LABELS`
  - champion compatibility tests
  - explanatory text in `index.html` and `README.md`

## Multi-Game Direction

Future games should be added as game profiles or modules with clear
boundaries:

- Game state and physics
- Agent input vector
- Action mapping
- Fitness function
- Rendering
- Human-control adapter, when applicable
- Tests for boot, controls, scoring, and reset behavior

Avoid hard-coding game-specific concepts into shared neuroevolution logic when
adding the next game. Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula
Circuit each define their own observation vector, action mapping, fitness
function, rendering, human controls, and champion storage keys.

## Gameplay Notes

- AI training mode uses generations, fitness, selection, crossover, and
  mutation.
- Human play mode is intentionally one physics step per animation frame, even
  when the AI speed slider is higher. This keeps keyboard control playable.
- Lunar human controls are held-state controls: `keydown` enables thrust or
  rotation and `keyup` disables it. Do not reset Lunar human control flags in
  `updateHuman`; otherwise human thrust and rotation become weaker than the AI
  controls, which are applied continuously frame by frame.
- Game switching resets the current run and activates only the selected game's
  settings and explanation panel.
- Pipe gap and pipe spacing reset the current run so one generation is not
  scored across mixed difficulty settings.
- Lunar Lander Lite uses a dedicated settings panel for gravity, initial fuel,
  platform size, and engine power. The gravity slider is expressed as a fraction
  of Earth gravity, so the default Moon-like value is `0.17g`. The default
  engine power is `0.190`, giving the lander enough upward authority while
  tilted toward side targets. These controls must be hidden for Flappy Bird, and
  changing them should reset Lunar training.
- Flappy Bird pipe controls (`pipeSettings`, `pipeGap`, `pipeSpacing`, and
  `presetPanel`) must be visible only for Flappy Bird. Lunar, Hill Climb, and
  Formula Circuit should never show pipe sliders.
- Lunar Lander Lite has eight inputs (`x`, `altitude`, `vx`, `vy`, `angle`,
  `fuel`, `pad dx`, `spin`) and three outputs (`thrust`, `left`, `right`).
  Lunar uses sequential evaluation with a shared per-generation target
  sequence. One specimen plays at a time, starts from target index 0, and keeps
  playing after a successful landing: score and fitness increase, the platform
  advances to the next target in the sequence, and the lander restarts from the
  same deterministic centered state. Crashing or timing out ends that
  specimen's turn; the next specimen restarts at target index 0 of the same
  sequence and the same initial state. The displayed score and best score are
  the best individual specimen score observed in the current generation, never
  the sum of all specimen scores. Fitness is also optimized per specimen: keep
  maximizing the strongest individual `agent.fitness`, not a generation-wide
  sum. Failed attempts should reward horizontal progress and closest approach
  mostly at terminal state, not passive stability while falling. Landers should
  spawn from the center of the simulation, while pads may
  appear across the full visible width. Target-oriented fitness rewards are
  multiplied by pad difficulty, so reaching or landing on edge targets is worth
  more than doing the same on a central target. Do not multiply generic
  survival/stability by pad difficulty; otherwise agents learn to drift toward
  edges. Penalize wrong-way horizontal velocity and wall-hugging away from the
  target. Lunar approach rewards must be based on horizontal pad-distance
  reduction, not diagonal distance reduction, because diagonal distance shrinks
  when a lander simply falls vertically. The touchdown bonus should dominate
  continuous shaping rewards; otherwise passive falling can outscore a real
  landing strategy. Keep its physics, fitness shaping, slider tests, score
  metric tests, and champion compatibility tests in sync.
- Saved Flappy Bird champions are stored in `localStorage` under the historical
  `neuro-evolution-arcade.pipe-runner.champion`.
- The previous key `neuro-evolution-arcade.flappy.champion` and legacy key
  `ai-flappy-evolution.champion` should remain loadable while older browser
  saves may still exist.
- Saved Lunar Lander champions are stored under
  `neuro-evolution-arcade.lunar.champion`.
- Hill Climb is a sequential, fixed-course game. Its fourteen inputs cover
  vehicle motion, angle, fuel, wheel contact, terrain slope, upcoming terrain,
  fuel, and coins; its two outputs are gas and brake. Preserve its original
  countryside terrain, fuel and coin behavior, and distance-dominant fitness
  when changing its physics or controls. Saved Hill Climb champions use
  `neuro-evolution-arcade.hill-climb.champion`.
- Formula Circuit is a simultaneous, ghost-car top-down race on a large,
  scrolling Monza-inspired circuit. Its eight inputs are forward speed plus
  seven forward-facing vision rays; its four combinable outputs are gas, brake,
  left, and right. Keep the human held-state arrow/WASD controls, focused-car
  camera, clickable minimap, and ordered checkpoint scoring in sync with the
  game profile and UI tests.
- Formula Circuit's hand-authored track lives in `src/formula-track.js`. The
  circuit must remain clockwise, non-self-intersecting, and preserve the named
  section order. The three chicanes (Rettifilo, Roggia, and Ascari) are narrower
  than other sections and need distinct entry and exit checkpoints; update
  geometry tests whenever that layout changes.
- Formula Circuit training begins in the distance phase: only ordered
  checkpoints and validated on-track progress earn fitness. When the first AI
  car completes three laps, finish that generation under distance fitness, then
  seed the following speed-phase population with an exact copy of that champion
  plus mutations. Do not compare or carry over fitness between phases. In the
  speed phase, positive forward speed while on track may increase validated
  progress fitness by at most 25 percent; it must not add an independent
  per-frame, checkpoint, or timing bonus. Reversing, leaving the track, or
  stalling ends the attempt. Lap time is telemetry, and the best score is the
  fastest completed lap time.
- Formula Circuit agents stop after three completed laps. Keep the HUD phase
  label, checkpoint total, phase-transition/reset behavior, phase-specific
  tests, and champion compatibility aligned. Saved Formula Circuit champions
  use `neuro-evolution-arcade.formula-circuit.champion`.

## Before Push Checklist

1. Run `npm run check`.
2. Confirm `git status --short` only contains intentional changes.
3. Commit with a focused message.
4. Push `main`.
5. Deploy to Vercel only when the user asks or when the change needs a live
   preview.
