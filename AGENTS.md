# AGENTS.md

## Project

Neuro Evolution Arcade is a static browser app for training neural-network
agents on small arcade games through neuroevolution. It currently includes
Flappy Bird and Pong, and the codebase should continue evolving as a multi-game
lab.

The app has no build step and no runtime dependencies. It is served directly
from `index.html`, `src/main.js`, and `src/styles.css`.

## Commands

Run this before every commit or push:

```bash
npm run check
```

This command runs:

- `node --check src/main.js`
- `npm test`

The test suite lives in `test/app.test.mjs` and uses Node's built-in
`node:test` runner with a lightweight DOM/canvas mock.

## Repository Layout

- `index.html`: app structure, controls, and explanatory content
- `src/main.js`: shared neuroevolution loop, game profiles, human mode,
  localStorage champion management, presets, and canvas drawing
- `src/styles.css`: responsive layout and control styling
- `test/app.test.mjs`: regression tests for the main app flows
- `README.md`: user-facing documentation and game roadmap

## Implementation Rules

- Keep the app dependency-free unless a feature clearly requires a package.
- Preserve static hosting compatibility. The app must still work by opening
  `index.html` or serving the folder with a static file server.
- Keep edits scoped. Avoid unrelated refactors when adding gameplay or UI
  features.
- Use ASCII in source files unless a file already requires non-ASCII text.
- If changing `src/main.js`, update or add tests in `test/app.test.mjs`.
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
adding the next game. Flappy Bird and Pong now each define their own
observation vector, action mapping, fitness function, rendering, human controls,
and champion storage keys.

## Gameplay Notes

- AI training mode uses generations, fitness, selection, crossover, and
  mutation.
- Human play mode is intentionally one physics step per animation frame, even
  when the AI speed slider is higher. This keeps keyboard control playable.
- Game switching resets the current run and activates only the selected game's
  settings and explanation panel.
- Pong uses sequential evaluation. Only one specimen rally is shown at a time,
  and the generation evolves after every specimen has played a rally.
- Pong's right-side controls differ from Flappy Bird: pipe presets are hidden,
  Pong tuning sliders are shown, and the metric label changes to the current
  specimen.
- Pong learning depends on the predicted impact signal, three discrete outputs
  (`up`, `stay`, `down`), an imperfect starter genome, and difficulty ramping
  after returns. If changing the Pong physics, keep `PONG_INPUT_LABELS`,
  `predictedImpactY`, `trackingGenome`, the fitness shaping, and champion
  compatibility tests in sync.
- Pipe gap and pipe spacing reset the current run so one generation is not
  scored across mixed difficulty settings.
- Pong ball speed and paddle size reset the current Pong run for the same
  reason. Do not add a total rally duration cap; it artificially limits the
  best score when the horizontal ball speed is constant.
- Saved Flappy Bird champions are stored in `localStorage` under the historical
  `neuro-evolution-arcade.pipe-runner.champion`.
- The previous key `neuro-evolution-arcade.flappy.champion` and legacy key
  `ai-flappy-evolution.champion` should remain loadable while older browser
  saves may still exist.
- Saved Pong champions are stored under
  `neuro-evolution-arcade.pong.champion`.

## Before Push Checklist

1. Run `npm run check`.
2. Confirm `git status --short` only contains intentional changes.
3. Commit with a focused message.
4. Push `main`.
5. Deploy to Vercel only when the user asks or when the change needs a live
   preview.
