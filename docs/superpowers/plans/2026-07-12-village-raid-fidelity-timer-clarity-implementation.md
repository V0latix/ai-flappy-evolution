# Village Raid Fidelity, Timer, and Building Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Village Raid visibly count down from 180 seconds, accurately reproduce the gameplay topology of references #111/#26/#104, and make every building recognizable through a minimalist procedural miniature plus on-demand inspection.

**Architecture:** Keep reference geometry in `village-raid-data.js`, derive countdown state purely from simulation ticks, and extend the focused renderer with semantic building visuals and hit testing. `main.js` remains the state orchestrator for hover/selection and synchronizes Canvas and DOM telemetry without changing combat or neuroevolution.

**Tech Stack:** Static HTML, CSS, dependency-free ES modules, Canvas 2D, pointer events, Node `node:test`, existing DOM/canvas mock harness, in-app browser smoke testing.

## Global Constraints

- Preserve static hosting and direct `index.html` compatibility; add no build step or runtime dependency.
- Do not bundle or display reference screenshots, official textures, logos, or watermarks in the app.
- Preserve the 48x32 simulation grid, the 22-building roster, 50 walls, and 2 bombs per layout.
- Preserve the 37 -> 18 -> 7 network, all combat values, target priorities, the fixed base order, and strict mean-destruction fitness.
- Reconstruct only buildings, walls, and traps; ignore decorative trees, bushes, stones, and seasonal scenery.
- Keep Canvas buildings label-free during normal play; text appears only in the inspection tooltip.
- Keep the Cannon's complete collision and visual footprint square at 3x3.
- Keep source changes ASCII and run `npm run check` before every commit.
- Preserve unrelated user changes and never stage `.superpowers/brainstorm/` artifacts.

---

## File Structure

- Modify `src/village-raid-data.js`: calibrated coordinates, exact reference topology, layout compatibility version.
- Create `test/fixtures/village-raid-reference-layouts.mjs`: independent expected building, wall, and trap signatures derived from the three screenshots.
- Modify `test/village-raid-data.test.mjs`: exact fixture comparison and topology regression tests.
- Modify `src/village-raid-simulation.js`: pure remaining-seconds helper.
- Modify `src/village-raid-rendering.js`: recognizable miniatures, health bars above footprints, hit testing, French names, tooltip.
- Modify `src/main.js`: countdown synchronization and inspected-building orchestration.
- Modify `index.html`: side-panel countdown output.
- Modify `src/styles.css`: countdown styling using existing stat patterns.
- Modify `test/village-raid-simulation.test.mjs`: countdown boundaries.
- Modify `test/village-raid-rendering.test.mjs`: semantic silhouettes, health bars, hit testing, tooltip bounds.
- Modify `test/app.test.mjs`: compatibility version, Canvas/DOM timer synchronization, pointer/click behavior.
- Modify `README.md`: calibrated-layout, countdown, and inspection documentation.

---

### Task 1: Calibrate the Three Reference Layouts

**Files:**
- Modify: `src/village-raid-data.js`
- Create: `test/fixtures/village-raid-reference-layouts.mjs`
- Modify: `test/village-raid-data.test.mjs`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Produces: `RAID_LAYOUT_VERSION = "th3-reference-layouts-v3"`.
- Preserves: `LAYOUTS` order `farm-111`, `war-26`, `defence-104`.
- Produces test fixture shape `{ buildings: Record<string, [number, number]>, walls: Array<[number, number]>, traps: Array<[number, number]> }` for each layout ID.

- [ ] **Step 1: Record independent screenshot-derived fixtures**

Create `test/fixtures/village-raid-reference-layouts.mjs`. Read the three supplied references at full size and record gameplay entities only. The file must not import production data.

Export `EXPECTED_REFERENCE_LAYOUTS`, keyed by `farm-111`, `war-26`, and `defence-104`. Each value contains:

- `buildings`: all 22 stable production building IDs mapped to calibrated integer `[x, y]` top-left cells;
- `walls`: all 50 unique `[x, y]` cells, stored in `y,x` order;
- `traps`: both bomb `[x, y]` cells, stored in `y,x` order.

Use the Town Hall center as the translation anchor and preserve the image's relative spacing; do not spread entities independently to fill the 48x32 board. The completed fixture must contain 66 building entries, 150 wall points, and 6 trap points before production data is changed.

- [ ] **Step 2: Write failing exact-layout tests**

In `test/village-raid-data.test.mjs`, import the fixture and compare complete production signatures:

```js
import { EXPECTED_REFERENCE_LAYOUTS } from "./fixtures/village-raid-reference-layouts.mjs";

function layoutSignature(layout) {
  return {
    buildings: Object.fromEntries(
      layout.buildings.map(({ id, x, y }) => [id, [x, y]]).sort(([left], [right]) => left.localeCompare(right)),
    ),
    walls: layout.walls.map(({ x, y }) => [x, y]).sort(comparePoints),
    traps: layout.traps.map(({ x, y }) => [x, y]).sort(comparePoints),
  };
}

function comparePoints([leftX, leftY], [rightX, rightY]) {
  return leftY - rightY || leftX - rightX;
}

test("reference layouts exactly match the calibrated screenshot fixtures", () => {
  assert.equal(RAID_LAYOUT_VERSION, "th3-reference-layouts-v3");
  for (const layout of LAYOUTS) {
    assert.deepEqual(layoutSignature(layout), EXPECTED_REFERENCE_LAYOUTS[layout.id], layout.id);
  }
});
```

Add explicit topology tests that encode the recognizable reference invariants rather than only bounds:

```js
test("war-26 preserves the screenshot axes and exterior resource groups", () => {
  const layout = LAYOUTS.find(({ id }) => id === "war-26");
  const byId = Object.fromEntries(layout.buildings.map((building) => [building.id, building]));
  assert.ok(byId["builderHut-1"].y < byId["archerTower-1"].y);
  assert.ok(byId["builderHut-2"].y < byId["archerTower-1"].y);
  assert.ok(byId["elixirCollector-1"].x < byId["townHall-1"].x);
  assert.ok(byId["goldMine-1"].x > byId["townHall-1"].x);
  assert.ok(byId["barracks-1"].y > byId["townHall-1"].y);
});

test("defence-104 preserves north resources, south mines, and opposite huts", () => {
  const layout = LAYOUTS.find(({ id }) => id === "defence-104");
  const townHall = layout.buildings.find(({ type }) => type === "townHall");
  assert.ok(layout.buildings.filter(({ type }) => type === "elixirCollector").every(({ y }) => y < townHall.y));
  assert.ok(layout.buildings.filter(({ type }) => type === "goldMine").every(({ y }) => y > townHall.y));
  const huts = layout.buildings.filter(({ type }) => type === "builderHut").sort((a, b) => a.x - b.x);
  assert.ok(huts[0].x < townHall.x && huts[1].x > townHall.x);
});
```

For `farm-111`, add exact assertions for the reference's wall junctions around the Town Hall and for the separate left, upper, and lower-right compartments. Because the complete sorted wall set is also compared to the independent fixture, opening, closing, or relocating any wall cell must fail the test. This must fail for the current single rectangular enclosure.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test test/village-raid-data.test.mjs
```

Expected: FAIL because production still uses the v2 coordinate maps and `farm-111` lacks the reference's small compartments.

- [ ] **Step 4: Replace the three production coordinate maps**

In `src/village-raid-data.js`:

```js
export const RAID_LAYOUT_VERSION = "th3-reference-layouts-v3";
```

Replace `FARM_111_BUILDING_POSITIONS`, `WAR_26_BUILDING_POSITIONS`, `DEFENCE_104_BUILDING_POSITIONS`, their wall arrays, and trap arrays with the exact values already recorded in the independent fixture. Use named wall runs and `uniquePoints()` in production, but require the resulting sorted points to equal the fixture.

For `farm-111`, use multiple connected wall runs that preserve the visible small compartments; do not collapse them into one rectangle. For `war-26` and `defence-104`, preserve the diamond topology by orthogonal diagonal runs and the visible wall gaps.

- [ ] **Step 5: Update champion compatibility tests**

In `test/app.test.mjs`, replace only Village Raid layout-version fixtures and assertions:

```js
assert.equal(saved.layoutVersion, "th3-reference-layouts-v3");
```

Keep `SNAPSHOT_VERSION = "th3-2026-07-11-v2"` unchanged because combat data did not change.

- [ ] **Step 6: Verify GREEN and commit**

```bash
node --test test/village-raid-data.test.mjs test/app.test.mjs
npm run check
git add src/village-raid-data.js test/fixtures/village-raid-reference-layouts.mjs test/village-raid-data.test.mjs test/app.test.mjs
git commit -m "fix: calibrate Village Raid reference layouts"
```

Expected: all focused tests and the full suite pass; no unrelated visual or combat file is staged.

---

### Task 2: Add the 180-to-0 Countdown

**Files:**
- Modify: `src/village-raid-simulation.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `test/village-raid-simulation.test.mjs`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Produces: `raidSecondsRemaining(world): number`.
- Adds DOM ID: `raidTime`.
- Preserves: timeout at `RAID_MAX_TICKS` and per-base world recreation.

- [ ] **Step 1: Write failing pure countdown tests**

```js
import {
  RAID_MAX_TICKS,
  RAID_TICKS_PER_SECOND,
  raidSecondsRemaining,
} from "../src/village-raid-simulation.js";

test("raid countdown converts simulation ticks into 180-to-0 seconds", () => {
  const world = createRaidWorld("farm-111", MIXED);
  assert.equal(raidSecondsRemaining(world), 180);
  world.tick = 1;
  assert.equal(raidSecondsRemaining(world), 180);
  world.tick = RAID_TICKS_PER_SECOND;
  assert.equal(raidSecondsRemaining(world), 179);
  world.tick = RAID_MAX_TICKS - 1;
  assert.equal(raidSecondsRemaining(world), 1);
  world.tick = RAID_MAX_TICKS;
  assert.equal(raidSecondsRemaining(world), 0);
  world.tick = RAID_MAX_TICKS + 50;
  assert.equal(raidSecondsRemaining(world), 0);
});
```

- [ ] **Step 2: Write failing DOM and Canvas timer tests**

Add `raidTime` to the primary ID list in `test/app.test.mjs`. In the Village Raid boot test:

```js
assert.equal(element(harness, "raidTime").textContent, "180 s");
assert.ok(
  element(harness, "game").getContext().calls.some(
    (call) => call.type === "fillText" && call.text === "Temps 180 s",
  ),
);
```

Advance exactly 20 simulation steps at speed 1 and assert both surfaces show `179 s`. In the existing forced-base-transition test, assert each newly created base returns to `180 s`.

- [ ] **Step 3: Verify RED**

```bash
node --test test/village-raid-simulation.test.mjs test/app.test.mjs
```

Expected: FAIL because `raidSecondsRemaining` and `#raidTime` do not exist.

- [ ] **Step 4: Implement the pure helper**

In `src/village-raid-simulation.js`:

```js
export function raidSecondsRemaining(world) {
  const ticks = Math.max(0, world.maxTicks - world.tick);
  return Math.ceil(ticks / RAID_TICKS_PER_SECOND);
}
```

Do not change `stepRaid` or `isRaidComplete` timeout logic.

- [ ] **Step 5: Add the side-panel output and synchronize it**

In `index.html`, add beside the base line:

```html
<div class="stat-line"><span>Temps restant</span><strong id="raidTime">180 s</strong></div>
```

Add `raidTime` to `ui` and update it in `updateRaidPanel`:

```js
ui.raidTime.textContent = `${raidWorld ? raidSecondsRemaining(raidWorld) : 180} s`;
```

Use existing `.stat-line` styling; add only a narrow `.raid-time` rule if visual alignment requires it.

- [ ] **Step 6: Expand the Canvas HUD**

Import `raidSecondsRemaining` in `main.js`. Replace the 86-pixel box with a 108-pixel box and draw four non-overlapping lines:

```js
targetCtx.fillRect(18, 18, 280, 108);
targetCtx.fillText(`Base ${targetWorld.raidBaseIndex + 1}/3`, 32, 43);
targetCtx.fillText(`Temps ${raidSecondsRemaining(raidWorld)} s`, 32, 65);
targetCtx.fillText(`Destruction ${current.toFixed(2)}%`, 32, 87);
targetCtx.fillText(`Moyenne ${average.toFixed(2)}%`, 32, 109);
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
node --test test/village-raid-simulation.test.mjs test/app.test.mjs
npm run check
git add src/village-raid-simulation.js src/main.js index.html src/styles.css test/village-raid-simulation.test.mjs test/app.test.mjs
git commit -m "feat: show Village Raid countdown"
```

---

### Task 3: Redesign Buildings as Recognizable Minimalist Miniatures

**Files:**
- Modify: `src/village-raid-rendering.js`
- Modify: `test/village-raid-rendering.test.mjs`

**Interfaces:**
- Produces: `RAID_BUILDING_NAMES: Readonly<Record<BuildingType, string>>`.
- Preserves: `drawRaidBuilding(ctx, building, offsetX, tile): void`.
- Moves building health bars above the footprint.

- [ ] **Step 1: Write failing semantic renderer tests**

Import `RAID_BUILDING_NAMES` and assert all 13 French names:

```js
assert.deepEqual(RAID_BUILDING_NAMES, {
  townHall: "Hotel de ville",
  clanCastle: "Chateau de clan",
  armyCamp: "Camp militaire",
  barracks: "Caserne",
  laboratory: "Laboratoire",
  goldMine: "Mine d'or",
  elixirCollector: "Extracteur d'elixir",
  goldStorage: "Reserve d'or",
  elixirStorage: "Reserve d'elixir",
  builderHut: "Cabane d'ouvrier",
  cannon: "Canon",
  archerTower: "Tour d'archers",
  mortar: "Mortier",
});
```

Add contract tests using the recording context:

- Cannon: square footprint outline, two wheel arcs, base rectangle, and barrel rectangle whose width exceeds its height by at least 2.5x.
- Mortar: circular turntable plus rotated tube and a smaller dark opening ellipse/arc.
- Gold Mine: at least two rail lines and a cart rectangle; no large spherical storage ellipse.
- Gold Storage: large bin plus at least three coin circles.
- Elixir Collector: pipe lines and a small vat ellipse.
- Elixir Storage: large spherical ellipse and a stopper rectangle.
- Health bars: dark and green rectangles have `y < building.y * tile`, rather than being inside the footprint.

- [ ] **Step 2: Verify RED**

```bash
node --test test/village-raid-rendering.test.mjs
```

Expected: FAIL because names are absent, current primitive signatures are too generic, and health bars are inside footprints.

- [ ] **Step 3: Implement the names and explicit silhouettes**

In `src/village-raid-rendering.js`:

```js
export const RAID_BUILDING_NAMES = Object.freeze({
  townHall: "Hotel de ville",
  clanCastle: "Chateau de clan",
  armyCamp: "Camp militaire",
  barracks: "Caserne",
  laboratory: "Laboratoire",
  goldMine: "Mine d'or",
  elixirCollector: "Extracteur d'elixir",
  goldStorage: "Reserve d'or",
  elixirStorage: "Reserve d'elixir",
  builderHut: "Cabane d'ouvrier",
  cannon: "Canon",
  archerTower: "Tour d'archers",
  mortar: "Mortier",
});
```

Replace shared `goldMine || elixirCollector` and `goldStorage || elixirStorage` branches with four independent branches. Use most of the available footprint, preserve the outer outline, and implement the primitive cues specified by the tests.

For the Cannon, keep the outer footprint square, draw two visible wheels, then a long barrel entirely inside the footprint. For Mortar, draw the open tube on a saved/rotated context above a round base.

Move the health bar call:

```js
drawHealthBar(ctx, x + 3, Math.max(1, y - 5), width - 6, building.hp, building.maxHp);
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --test test/village-raid-rendering.test.mjs
npm run check
git add src/village-raid-rendering.js test/village-raid-rendering.test.mjs
git commit -m "feat: clarify Village Raid building miniatures"
```

---

### Task 4: Add Hover and Click Building Inspection

**Files:**
- Modify: `src/village-raid-rendering.js`
- Modify: `src/main.js`
- Modify: `test/village-raid-rendering.test.mjs`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Produces: `findRaidBuildingAtPoint(buildings, point, offsetX, tile): Building | null`.
- Produces: `drawRaidBuildingTooltip(ctx, building, offsetX, tile, canvasWidth, canvasHeight): void`.
- Adds game-profile hooks: `handleCanvasPointerMove`, `handleCanvasPointerLeave`, and existing `handleCanvasClick` behavior for Raid.

- [ ] **Step 1: Write failing pure hit-test and tooltip tests**

```js
test("building hit testing respects complete footprints and living state", () => {
  const buildings = [
    { id: "cannon-1", x: 4, y: 5, width: 3, height: 3, hp: 100 },
    { id: "mortar-1", x: 10, y: 5, width: 3, height: 3, hp: 0 },
  ];
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 44, y: 42 }, 10, 8)?.id, "cannon-1");
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 65.9, y: 63.9 }, 10, 8)?.id, "cannon-1");
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 66, y: 64 }, 10, 8), null);
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 94, y: 42 }, 10, 8), null);
});
```

Add tooltip tests for French name, `Niv. X`, `HP current/max`, and clamping near all four Canvas edges.

- [ ] **Step 2: Write failing app interaction tests**

Extend `MockElement` with `getBoundingClientRect()` and dispatchable `pointermove`, `pointerleave`, and `click` coordinates. In the Village Raid test:

1. Pause after base creation.
2. Convert the active Town Hall center to client coordinates.
3. Dispatch `pointermove` and assert Canvas `fillText` includes `Hotel de ville`, level, and HP.
4. Dispatch `pointerleave` and assert a subsequent frame does not draw the tooltip.
5. Click the Town Hall, move away, and assert selection keeps the tooltip visible.
6. Click empty ground and assert it clears.

- [ ] **Step 3: Verify RED**

```bash
node --test test/village-raid-rendering.test.mjs test/app.test.mjs
```

Expected: FAIL because hit testing, tooltip drawing, and pointer hooks do not exist.

- [ ] **Step 4: Implement pure renderer helpers**

```js
export function findRaidBuildingAtPoint(buildings, point, offsetX, tile) {
  return buildings.find((building) => {
    if (building.hp <= 0) return false;
    const left = offsetX + building.x * tile;
    const top = building.y * tile;
    return point.x >= left && point.x < left + building.width * tile &&
      point.y >= top && point.y < top + building.height * tile;
  }) ?? null;
}
```

`drawRaidBuildingTooltip` must use `RAID_BUILDING_NAMES[building.type]`, show level and rounded HP, measure or conservatively size the box, and clamp its `x/y` so the solid tooltip rectangle remains within `canvasWidth/canvasHeight`.

- [ ] **Step 5: Add Raid inspection orchestration**

Add top-level IDs:

```js
let raidHoveredBuildingId = null;
let raidSelectedBuildingId = null;
```

Use one shared `canvasPointFromEvent(event)` helper for click and pointer movement. Add optional game hooks:

```js
handleCanvasPointerMove(point, targetWorld) {
  const geometry = raidCanvasGeometry();
  raidHoveredBuildingId = findRaidBuildingAtPoint(
    targetWorld.raidWorld?.buildings ?? [], point, geometry.offsetX, geometry.tile,
  )?.id ?? null;
},
handleCanvasPointerLeave() {
  raidHoveredBuildingId = null;
},
handleCanvasClick(point, targetWorld) {
  const geometry = raidCanvasGeometry();
  raidSelectedBuildingId = findRaidBuildingAtPoint(
    targetWorld.raidWorld?.buildings ?? [], point, geometry.offsetX, geometry.tile,
  )?.id ?? null;
  return true;
},
```

Reset both IDs on game switches and Raid resets. In `drawRaidWorld`, prefer the hovered ID, fall back to selected ID, find the living building, and draw its tooltip after entities and before the fixed HUD.

Register:

```js
gameCanvas.addEventListener("pointermove", handleCanvasPointerMove);
gameCanvas.addEventListener("pointerleave", handleCanvasPointerLeave);
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
node --test test/village-raid-rendering.test.mjs test/app.test.mjs
npm run check
git add src/village-raid-rendering.js src/main.js test/village-raid-rendering.test.mjs test/app.test.mjs
git commit -m "feat: inspect Village Raid buildings"
```

---

### Task 5: Documentation and Visual Acceptance

**Files:**
- Modify: `README.md`
- Modify: `index.html`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Documents: v3 layout compatibility, `180 s` countdown, calibrated gameplay topology, minimalist inspection behavior.

- [ ] **Step 1: Write failing documentation assertions**

```js
assert.match(readme, /th3-reference-layouts-v3/);
assert.match(readme, /180 s[\s\S]*0 s/);
assert.match(readme, /calibrated[\s\S]*#111[\s\S]*#26[\s\S]*#104/i);
assert.match(readme, /hover[\s\S]*click[\s\S]*building/i);
assert.match(html, /180[^\n]*0/);
assert.doesNotMatch(readme, /th3-reference-layouts-v2/);
```

- [ ] **Step 2: Verify RED, update copy, and verify GREEN**

```bash
node --test test/app.test.mjs
```

Expected RED: README and explanation copy still describe v2 and omit the timer/inspection behavior.

Update the Village Raid README and `#explanationRaid` without claiming pixel-identical isometric fidelity. State that gameplay topology is calibrated into an orthogonal arcade grid, not copied artwork.

```bash
node --test test/app.test.mjs
```

Expected GREEN: app tests pass.

- [ ] **Step 3: Run full static verification**

```bash
node --check src/main.js
node --check src/village-raid-data.js
node --check src/village-raid-simulation.js
node --check src/village-raid-rendering.js
npm run check
git diff --check
git status --short
```

Expected: all syntax checks exit 0, the suite reports zero failures, the diff has no whitespace errors, and only intentional files are present.

- [ ] **Step 4: Run in-app browser acceptance against all three references**

Serve the static app and use the in-app browser. For each base:

1. Pause at base start and confirm `180 s` in both HUD and side panel.
2. Advance simulation and confirm the values decrease together.
3. Compare walls, compartments, and relative building positions against its reference screenshot.
4. Confirm Cannon, Mortar, Gold Mine, Gold Storage, Elixir Collector, and Elixir Storage are distinguishable without permanent labels.
5. Hover and click at least one building; confirm French name, level, and HP.
6. Confirm empty click and game switch clear inspection.
7. Confirm no external game asset request and no browser console warning/error.

- [ ] **Step 5: Commit documentation**

```bash
npm run check
git add README.md index.html test/app.test.mjs
git commit -m "docs: describe calibrated Village Raid attacks"
```

- [ ] **Step 6: Inspect final history**

```bash
git status --short
git log --oneline -8
```

Expected: five focused feature commits after the design/plan commits and no `.superpowers/brainstorm/` artifact staged.
