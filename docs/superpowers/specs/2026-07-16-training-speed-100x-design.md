# Training speed ceiling at 100x

## Goal

Allow AI training for Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula
Circuit to run at up to 100 simulation steps per animation frame.

## Scope

- Change each of the four game profiles' `maxSpeed` value to `100`.
- Keep the existing default speeds, Flappy presets, labels, and slider UI.
- Leave Village Raid unchanged because it already uses a 100x cap.
- Preserve human play behavior: it always advances by one simulation step per
  animation frame, regardless of the selected slider value.

## Implementation and verification

The existing animation loop already uses the selected speed as the number of
AI simulation steps per frame, so no loop or physics changes are needed.
Update the game-profile values in `src/main.js` and extend `test/app.test.mjs`
to assert the 100x ceiling after selecting each affected game. Run
`npm run check` after the change.
