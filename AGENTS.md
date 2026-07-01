# AGENTS.md

## Project

AI Flappy Evolution is a static browser app. It has no build step and no runtime
dependencies. The app is served directly from `index.html`, `src/main.js`, and
`src/styles.css`.

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

- `index.html`: app structure and controls
- `src/main.js`: game loop, neuroevolution, human mode, localStorage champion
  management, presets, and canvas drawing
- `src/styles.css`: responsive layout and control styling
- `test/app.test.mjs`: regression tests for the main app flows
- `README.md`: user-facing documentation

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

## Gameplay Notes

- AI training mode uses generations, fitness, selection, crossover, and
  mutation.
- Human play mode is intentionally one physics step per animation frame, even
  when the AI speed slider is higher. This keeps keyboard control playable.
- Pipe gap and pipe spacing reset the current run so one generation is not
  scored across mixed difficulty settings.
- Saved champions are stored in `localStorage` under
  `ai-flappy-evolution.champion` and must be checked against the current genome
  length before loading.

## Before Push Checklist

1. Run `npm run check`.
2. Confirm `git status --short` only contains intentional changes.
3. Commit with a focused message.
4. Push `main`.
5. Deploy to Vercel only when the user asks or when the change needs a live
   preview.
