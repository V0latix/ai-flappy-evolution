# Training Speed 100x Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AI training reach 100 simulation steps per animation frame in Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula Circuit.

**Architecture:** The shared animation loop already advances AI simulations once per selected speed unit and limits human play to one step. Each game profile exposes its speed cap through `maxSpeed`; updating those four values is sufficient. DOM-harness tests assert the slider cap after selecting each game.

**Tech Stack:** Static HTML, ES modules, Node.js built-in test runner.

## Global Constraints

- Keep the application dependency-free and compatible with static hosting.
- Change the four requested game profiles in `src/main.js` and the matching initial Flappy slider cap in `index.html`.
- Preserve each game's default speed and existing labels.
- Keep human play at one simulation step per animation frame.
- Leave Village Raid unchanged at its existing 100x cap.
- Run `npm run check` before committing.

---

### Task 1: Expose a 100x AI speed ceiling for the four requested games

**Files:**
- Modify: `test/app.test.mjs:1170-1285`
- Modify: `src/main.js:1070-1080`, `src/main.js:1530-1540`, `src/main.js:2530-2540`, `src/main.js:3260-3270`
- Modify: `index.html:248`

**Interfaces:**
- Consumes: each selected game profile's `maxSpeed`, copied by `selectGame()` to `ui.speed.max`.
- Produces: the existing speed slider exposes `max="100"` for pipe, lunar, hill, and formula games; `loop()` continues to use one step per frame in human mode.

- [x] **Step 1: Write the failing tests**

Replace the three affected speed-cap expectations in the existing game-picker tests and add the missing Flappy assertion:

```js
assert.equal(element(harness, "speed").max, 100);
```

Use this assertion in the Flappy boot test and the Lunar, Hill Climb, and Formula game-picker tests.

- [x] **Step 2: Run the focused test file to verify it fails**

Run: `node --test test/app.test.mjs`

Expected: FAIL because the selected profiles still expose `12`, `28`, `32`, and `16` as slider maxima.

- [x] **Step 3: Implement the minimal profile changes**

In each of the four game profiles, set only the maximum speed value:

```js
maxSpeed: 100,
```

Also update the initial Flappy range element so booting the page before any game switch exposes the same cap:

```html
<input id="speed" type="range" min="1" max="100" step="1" value="3" />
```

Do not change `defaultSpeed`, the Village Raid profile, `loop()`, or the human-mode conditional:

```js
const steps = playMode === "human" ? 1 : Number(ui.speed.value);
```

- [x] **Step 4: Run focused tests to verify the feature passes**

Run: `node --test test/app.test.mjs`

Expected: PASS with all app-harness tests green.

- [x] **Step 5: Run the project check**

Run: `npm run check`

Expected: PASS; `node --check src/main.js` and all Node tests complete successfully.

- [x] **Step 6: Review the diff and commit**

Run: `git diff --check && git status --short`

Expected: only `index.html`, `src/main.js`, `test/app.test.mjs`, and this plan document are intentional changes.

Commit:

```bash
git add index.html src/main.js test/app.test.mjs docs/superpowers/plans/2026-07-16-training-speed-100x.md
git commit -m "feat: raise training speed caps to 100x"
```
