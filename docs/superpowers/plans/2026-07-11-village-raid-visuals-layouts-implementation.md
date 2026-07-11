# Village Raid HDV 3 Visuals and Reference Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Village Raid's generic bases with structured reconstructions of references #111, #26, and #104, then add original procedural building textures, distinct troop silhouettes, and a hybrid troop legend.

**Architecture:** Keep combat data and reference geometry in `village-raid-data.js`, while extracting Canvas-only drawing into a focused `village-raid-rendering.js` module. `main.js` remains the orchestrator: it delegates drawing to the rendering module and updates the DOM legend from the active raid world's inventory.

**Tech Stack:** Static HTML, CSS, dependency-free ES modules, Canvas 2D, Node `node:test`, the existing DOM/canvas test harness.

## Global Constraints

- Preserve static hosting and direct `index.html` compatibility; add no build step or runtime dependency.
- Ship only original procedural Canvas visuals; do not bundle screenshots, official Clash of Clans textures, logos, or watermarks.
- Use exactly the 22 buildings visible in each reference: 1 Town Hall, 1 Clan Castle, 2 Army Camps, 1 Barracks, 1 Laboratory, 3 Gold Mines, 3 Elixir Collectors, 2 Gold Storages, 2 Elixir Storages, 2 Builder Huts, 2 Cannons, 1 Archer Tower, and 1 Mortar.
- Preserve every building's collision footprint. In particular, the Cannon remains a square 3x3 building.
- Keep the 37 -> 18 -> 7 neural-network shape, combat values, sequential three-base evaluation, and strict mean-destruction fitness unchanged.
- Use ASCII in source files and run `npm run check` before every commit.
- Preserve unrelated user changes and never stage `.superpowers/brainstorm/` artifacts.

---

## File Structure

- Modify `src/village-raid-data.js`: authoritative 22-building roster, reference URLs, three reconstructed layouts, validation, compatibility versions.
- Modify `src/village-raid-simulation.js`: retain a captured initial building count and calculate variable-denominator destruction.
- Create `src/village-raid-rendering.js`: deterministic building, troop, health-bar, and compact troop-key Canvas drawing.
- Modify `src/main.js`: import the renderer, delegate raid drawing, and update detailed troop quantities.
- Modify `index.html`: detailed five-entry Village Raid troop legend.
- Modify `src/styles.css`: compact responsive legend styling consistent with the current UI.
- Modify `test/village-raid-data.test.mjs`: reference IDs, source URLs, 22-building inventory, geometry validation.
- Modify `test/village-raid-simulation.test.mjs`: variable denominator and filtered-array regression coverage.
- Create `test/village-raid-rendering.test.mjs`: deterministic type-specific Canvas contracts.
- Modify `test/app.test.mjs`: renderer import/integration, legend visibility and live quantities.
- Modify `README.md`: new reference bases, 22-building roster, original visual treatment, legend behavior, compatibility versions.

---

### Task 1: Authoritative Reference Layouts and Variable Destruction Denominator

**Files:**
- Modify: `src/village-raid-data.js`
- Modify: `src/village-raid-simulation.js`
- Test: `test/village-raid-data.test.mjs`
- Test: `test/village-raid-simulation.test.mjs`

**Interfaces:**
- Produces: `LAYOUT_SOURCES: Readonly<Record<string, string>>`.
- Produces: `LAYOUTS` entries with IDs `farm-111`, `war-26`, and `defence-104`.
- Produces: `world.initialBuildingCount: number` from `createRaidWorld(layoutId, composition)`.
- Preserves: `destructionPercent(world): number` in the inclusive range 0 through 100.

- [ ] **Step 1: Write failing roster and reference-layout tests**

Replace the old 25-building and generic-layout assertions in `test/village-raid-data.test.mjs` with exact contracts:

```js
import {
  LAYOUT_SOURCES,
  ARMY_CAPACITY,
  BUILDING_DEFINITIONS,
  BUILDING_ROSTER,
  GRID,
  LAYOUTS,
  RAID_LAYOUT_VERSION,
  SNAPSHOT_VERSION,
  TRAP_DEFINITIONS,
  TROOPS,
  WALL_DEFINITION,
  composeArmy,
  mapPerimeterPosition,
  usedHousing,
  validateLayout,
} from "../src/village-raid-data.js";

const REFERENCE_BUILDING_COUNTS = {
  townHall: 1,
  clanCastle: 1,
  armyCamp: 2,
  barracks: 1,
  laboratory: 1,
  goldMine: 3,
  elixirCollector: 3,
  goldStorage: 2,
  elixirStorage: 2,
  builderHut: 2,
  cannon: 2,
  archerTower: 1,
  mortar: 1,
};

test("the dated TH3 snapshot matches the 22 buildings visible in every reference", () => {
  assert.equal(SNAPSHOT_VERSION, "th3-2026-07-11-v2");
  assert.equal(BUILDING_ROSTER.length, 22);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(BUILDING_DEFINITIONS).map(([type, definition]) => [type, definition.count]),
    ),
    REFERENCE_BUILDING_COUNTS,
  );
  assert.equal(BUILDING_DEFINITIONS.builderHut.count, 2);
});

test("the three reference layouts preserve their source identity and exact inventory", () => {
  assert.equal(RAID_LAYOUT_VERSION, "th3-reference-layouts-v2");
  assert.deepEqual(LAYOUTS.map(({ id }) => id), ["farm-111", "war-26", "defence-104"]);
  assert.deepEqual(LAYOUT_SOURCES, {
    "farm-111": "https://clashofclans-layouts.com/fr/plans/th_3/farm_111.html",
    "war-26": "https://clashofclans-layouts.com/fr/plans/th_3/war_26.html",
    "defence-104": "https://clashofclans-layouts.com/fr/plans/th_3/defence_104.html",
  });

  for (const layout of LAYOUTS) {
    assert.equal(layout.buildings.length, 22, layout.id);
    assert.equal(layout.walls.length, 50, layout.id);
    assert.equal(layout.traps.length, 2, layout.id);
    assert.equal(validateLayout(layout).valid, true, layout.id);
    assert.deepEqual(
      Object.fromEntries(
        Object.keys(REFERENCE_BUILDING_COUNTS).map((type) => [
          type,
          layout.buildings.filter((building) => building.type === type).length,
        ]),
      ),
      REFERENCE_BUILDING_COUNTS,
      layout.id,
    );
  }
});
```

- [ ] **Step 2: Write failing variable-denominator simulation tests**

Replace the two historical 25-building tests in `test/village-raid-simulation.test.mjs`:

```js
test("destruction uses the 22-building reference denominator", () => {
  const world = createRaidWorld("farm-111", MIXED);
  assert.equal(world.initialBuildingCount, 22);
  world.buildings[0].hp = 0;
  world.walls[0].hp = 0;
  world.traps[0].active = false;
  assert.equal(destructionPercent(world), 100 / 22);
  for (const building of world.buildings) building.hp = 0;
  assert.equal(destructionPercent(world), 100);
});

test("destruction keeps the captured denominator when the live array is filtered", () => {
  const world = createRaidWorld("farm-111", MIXED);
  world.buildings[0].hp = 0;
  world.buildings.splice(1);
  assert.equal(world.initialBuildingCount, 22);
  assert.equal(destructionPercent(world), 100 / 22);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --test test/village-raid-data.test.mjs test/village-raid-simulation.test.mjs
```

Expected: FAIL because the current versions are `v1`, the layout IDs are generic, Builder Hut count is 5, `LAYOUT_SOURCES` is absent, and `initialBuildingCount` is absent.

- [ ] **Step 4: Implement the 22-building roster and reference metadata**

In `src/village-raid-data.js`, change only the Builder Hut count, bump compatibility versions, and export exact source metadata:

```js
export const SNAPSHOT_VERSION = "th3-2026-07-11-v2";
export const RAID_LAYOUT_VERSION = "th3-reference-layouts-v2";

export const LAYOUT_SOURCES = deepFreeze({
  "farm-111": "https://clashofclans-layouts.com/fr/plans/th_3/farm_111.html",
  "war-26": "https://clashofclans-layouts.com/fr/plans/th_3/war_26.html",
  "defence-104": "https://clashofclans-layouts.com/fr/plans/th_3/defence_104.html",
});

// Keep the existing hp, size, level, category, and combat fields unchanged.
builderHut: { count: 2, level: 1, category: "core", hp: 250, width: 2, height: 2 },
```

Replace `OPEN_BUILDING_POSITIONS`, `COMPARTMENT_BUILDING_POSITIONS`, and `CENTRAL_BUILDING_POSITIONS` with three named maps: `FARM_111_BUILDING_POSITIONS`, `WAR_26_BUILDING_POSITIONS`, and `DEFENCE_104_BUILDING_POSITIONS`. Manually transcribe every one of the 22 buildings from the corresponding reference, using the existing IDs from `BUILDING_ROSTER` and integer top-left grid coordinates.

Build each wall array from named `line(...)` segments that follow the screenshot compartments. Deduplicate junctions with a new helper:

```js
function uniquePoints(points) {
  return [...new Map(points.map((position) => [`${position.x},${position.y}`, position])).values()];
}
```

Each final wall array must contain exactly 50 unique points and must not overlap a complete building footprint. Place the two bombs only where the screenshots show the small black trap markers; when one is partially obscured, use the nearest unoccupied cell inside the same compartment.

Construct the layouts in the documented order:

```js
export const LAYOUTS = deepFreeze([
  makeLayout("farm-111", FARM_111_BUILDING_POSITIONS, FARM_111_WALLS, FARM_111_TRAPS),
  makeLayout("war-26", WAR_26_BUILDING_POSITIONS, WAR_26_WALLS, WAR_26_TRAPS),
  makeLayout(
    "defence-104",
    DEFENCE_104_BUILDING_POSITIONS,
    DEFENCE_104_WALLS,
    DEFENCE_104_TRAPS,
  ),
]);
```

Replace the central-layout-only test with three anchor assertions derived from the screenshots: Town Hall inside the main wall cluster for every layout, `war-26` Builder Huts above the main enclosure, and `defence-104` Builder Huts on opposite exterior sides.

- [ ] **Step 5: Capture the denominator explicitly**

In `createRaidWorld`, replace `totalBuildings` with a clearer immutable-at-construction field and update `destructionPercent`:

```js
return {
  layoutId: layout.id,
  grid: { ...GRID },
  phase: 1,
  tick: 0,
  maxTicks: RAID_MAX_TICKS,
  decisionInterval: RAID_DECISION_TICKS,
  lastDecisionTick: -RAID_DECISION_TICKS,
  composition: { ...inventory },
  inventory,
  initialBuildingCount: buildings.length,
  buildings,
  walls,
  traps,
  troops: [],
  projectiles: [],
  nextTroopId: 1,
  nextProjectileId: 1,
  navigationRevision: 0,
  metrics: { pathSearches: 0 },
  complete: false,
  endReason: null,
};

export function destructionPercent(world) {
  const destroyed = world.buildings.filter((building) => building.hp <= 0).length;
  return (destroyed / world.initialBuildingCount) * 100;
}
```

Update any test helper or assertion that still reads `totalBuildings`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --test test/village-raid-data.test.mjs test/village-raid-simulation.test.mjs test/village-raid-training.test.mjs
```

Expected: all Village Raid data, simulation, and training tests PASS.

- [ ] **Step 7: Run the required check and commit**

```bash
npm run check
git add src/village-raid-data.js src/village-raid-simulation.js test/village-raid-data.test.mjs test/village-raid-simulation.test.mjs
git commit -m "feat: reconstruct Village Raid reference bases"
```

Expected: `npm run check` exits 0 before the commit is created.

---

### Task 2: Procedural Building and Troop Renderer

**Files:**
- Create: `src/village-raid-rendering.js`
- Create: `test/village-raid-rendering.test.mjs`

**Interfaces:**
- Produces: `RAID_TROOP_VISUALS: Readonly<Record<TroopId, { color: string, label: string }>>`.
- Produces: `drawRaidBuilding(ctx, building, offsetX, tile): void`.
- Produces: `drawRaidTroop(ctx, troop, offsetX, tile): void`.
- Produces: `drawRaidTroopKey(ctx, x, y): void`.

- [ ] **Step 1: Write the renderer contract tests**

Create `test/village-raid-rendering.test.mjs` with a recording Canvas context that implements `save`, `restore`, `translate`, `rotate`, `beginPath`, `closePath`, `moveTo`, `lineTo`, `arc`, `ellipse`, `fill`, `stroke`, `fillRect`, `strokeRect`, and `fillText`. Record method calls and assigned `fillStyle`/`strokeStyle` values.

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  RAID_TROOP_VISUALS,
  drawRaidBuilding,
  drawRaidTroop,
  drawRaidTroopKey,
} from "../src/village-raid-rendering.js";
import { BUILDING_DEFINITIONS } from "../src/village-raid-data.js";

test("every building type draws inside its complete footprint", () => {
  for (const [type, definition] of Object.entries(BUILDING_DEFINITIONS)) {
    const ctx = recordingContext();
    drawRaidBuilding(ctx, {
      id: `${type}-test`,
      type,
      category: definition.category,
      x: 4,
      y: 5,
      width: definition.width,
      height: definition.height,
      hp: definition.hp,
      maxHp: definition.hp,
    }, 10, 8);
    const outline = ctx.calls.find((call) =>
      call.type === "strokeRect" &&
      call.x === 42 &&
      call.y === 42 &&
      call.width === definition.width * 8 - 4 &&
      call.height === definition.height * 8 - 4
    );
    assert.deepEqual(outline, {
      type: "strokeRect",
      x: 42,
      y: 42,
      width: definition.width * 8 - 4,
      height: definition.height * 8 - 4,
    });
  }
});

test("the cannon keeps a square base while drawing a round barrel assembly", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, cannonFixture(), 0, 10);
  assert.ok(ctx.calls.some((call) => call.type === "strokeRect" && call.width === call.height));
  assert.ok(ctx.calls.some((call) => call.type === "arc"));
});

test("troops have five distinct visual identities and a compact key", () => {
  assert.deepEqual(Object.keys(RAID_TROOP_VISUALS), [
    "barbarian", "archer", "giant", "goblin", "wallBreaker",
  ]);
  assert.equal(new Set(Object.values(RAID_TROOP_VISUALS).map(({ color }) => color)).size, 5);
  for (const type of Object.keys(RAID_TROOP_VISUALS)) {
    const ctx = recordingContext();
    drawRaidTroop(ctx, troopFixture(type), 0, 10);
    assert.ok(
      ctx.calls.some(
        (call) => call.type === "fillStyle" && call.value === RAID_TROOP_VISUALS[type].color,
      ),
      type,
    );
  }
  const keyCtx = recordingContext();
  drawRaidTroopKey(keyCtx, 730, 18);
  assert.deepEqual(
    keyCtx.calls.filter((call) => call.type === "fillText").map(({ text }) => text),
    ["B", "A", "G", "Go", "S"],
  );
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```bash
node --test test/village-raid-rendering.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/village-raid-rendering.js`.

- [ ] **Step 3: Implement the deterministic renderer module**

Create `src/village-raid-rendering.js`. Define the shared troop palette and dispatch building details by `building.type`:

```js
export const RAID_TROOP_VISUALS = Object.freeze({
  barbarian: Object.freeze({ color: "#f2c14e", label: "B" }),
  archer: Object.freeze({ color: "#e887b7", label: "A" }),
  giant: Object.freeze({ color: "#c88d5a", label: "G" }),
  goblin: Object.freeze({ color: "#4fae63", label: "Go" }),
  wallBreaker: Object.freeze({ color: "#edf2f4", label: "S" }),
});

const BUILDING_PALETTES = Object.freeze({
  townHall: ["#f0a43a", "#855027"],
  clanCastle: ["#aeb8c4", "#596575"],
  armyCamp: ["#d79a53", "#7a4a2d"],
  barracks: ["#c94f43", "#6e342f"],
  laboratory: ["#b8c3cf", "#4d5968"],
  goldMine: ["#d6a42f", "#6d4826"],
  elixirCollector: ["#b968c8", "#5d3568"],
  goldStorage: ["#efbd36", "#755024"],
  elixirStorage: ["#d66be0", "#67366f"],
  builderHut: ["#7a5034", "#3b2b25"],
  cannon: ["#b64b3c", "#333b46"],
  archerTower: ["#9a704b", "#4d3528"],
  mortar: ["#59636f", "#242a31"],
});
```

`drawRaidBuilding` must:

1. Return when `building.hp <= 0`.
2. Compute the outer rectangle from `offsetX`, `tile`, `building.x/y/width/height`.
3. Draw a square footprint background and an exact `strokeRect` outline at `x + 2`, `y + 2`, with width and height reduced by 4 pixels.
4. Draw type-specific details inside the rectangle: roof panels, tanks, tent, hut roof, tower supports, Mortar tube, or Cannon circular assembly and barrel.
5. Draw a dark health-bar track and green health fill above the type detail.

`drawRaidTroop` must use one unique shape cue per type: sword line for Barbarian, bow arc for Archer, larger double-circle body for Giant, pointed ears for Goblin, and a bomb circle for Wall Breaker. Keep the existing health bar.

`drawRaidTroopKey` must draw a small translucent panel containing the five colors and short labels without covering the raid statistics panel at `(18, 18, 280, 86)`.

- [ ] **Step 4: Run the renderer tests and verify GREEN**

Run:

```bash
node --test test/village-raid-rendering.test.mjs
```

Expected: all renderer tests PASS.

- [ ] **Step 5: Run the required check and commit**

```bash
npm run check
git add src/village-raid-rendering.js test/village-raid-rendering.test.mjs
git commit -m "feat: add procedural Village Raid renderer"
```

---

### Task 3: Integrate Textured Rendering and the Compact Canvas Key

**Files:**
- Modify: `src/main.js`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Consumes: `drawRaidBuilding`, `drawRaidTroop`, and `drawRaidTroopKey` from `src/village-raid-rendering.js`.
- Preserves: `drawRaidWorld(targetCtx, targetWorld, agent): void`.

- [ ] **Step 1: Write failing app integration assertions**

Add static and runtime assertions to `test/app.test.mjs`:

```js
assert.match(script, /from "\.\/village-raid-rendering\.js"/);
assert.match(script, /drawRaidBuilding\(targetCtx, building, offsetX, tile\)/);
assert.match(script, /drawRaidTroop\(targetCtx, troop, offsetX, tile\)/);
assert.match(script, /drawRaidTroopKey\(targetCtx,/);
assert.doesNotMatch(script, /barbarian: "#f2c14e", archer: "#e887b7"/);
```

In the Village Raid boot test, assert that the game canvas records the five compact labels `B`, `A`, `G`, `Go`, and `S` after switching to Village Raid.

Extend `createMockContext()` before importing the new renderer so the integration test records every Canvas primitive used by the module:

```js
save() {},
restore() {},
translate() {},
rotate() {},
closePath() {},
moveTo() {},
lineTo() {},
quadraticCurveTo() {},
strokeRect(x, y, width, height) {
  calls.push({ type: "strokeRect", x, y, width, height });
},
```

Retain the existing `beginPath`, `arc`, `ellipse`, `fill`, `stroke`, `fillRect`, and `fillText` recorders. This is test-harness support, not production behavior.

- [ ] **Step 2: Run the app test and verify RED**

Run:

```bash
node --test test/app.test.mjs
```

Expected: FAIL because `main.js` still owns flat rectangle/circle drawing and has no compact key.

- [ ] **Step 3: Delegate raid entity drawing to the new module**

Add the import near the existing Village Raid imports:

```js
import {
  drawRaidBuilding,
  drawRaidTroop,
  drawRaidTroopKey,
} from "./village-raid-rendering.js";
```

In `drawRaidWorld`:

```js
for (const building of raidWorld.buildings) {
  drawRaidBuilding(targetCtx, building, offsetX, tile);
}
for (const troop of raidWorld.troops) {
  if (troop.alive) drawRaidTroop(targetCtx, troop, offsetX, tile);
}
drawRaidTroopKey(targetCtx, WIDTH - 220, 18);
```

Delete the old inline troop circles and the local `drawRaidBuilding` function. Keep wall, trap, projectile, grid, destruction, average, and base-number drawing in `main.js`.

- [ ] **Step 4: Run app and renderer tests and verify GREEN**

```bash
node --test test/app.test.mjs test/village-raid-rendering.test.mjs
```

Expected: both files PASS.

- [ ] **Step 5: Run the required check and commit**

```bash
npm run check
git add src/main.js test/app.test.mjs
git commit -m "feat: render textured Village Raid entities"
```

---

### Task 4: Detailed Responsive Troop Legend

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.js`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Adds DOM IDs: `raidTroopLegend`, `raidLegendBarbarian`, `raidLegendArcher`, `raidLegendGiant`, `raidLegendGoblin`, `raidLegendWallBreaker`.
- Consumes: `raidWorld.inventory` from `updateRaidPanel(agent, targetWorld)`.

- [ ] **Step 1: Write failing static and behavioral legend tests**

Add all six IDs to the primary-control ID list in `test/app.test.mjs`. Extend the Village Raid boot test:

```js
assert.equal(element(harness, "raidTroopLegend").hidden, false);
assert.match(html, /Cible : defenses/);
assert.match(html, /Cible : ressources/);
assert.match(html, /Cible : murs/);

const inventoryText = element(harness, "raidInventory").textContent;
for (const [label, outputId] of [
  ["Barbares", "raidLegendBarbarian"],
  ["Archeres", "raidLegendArcher"],
  ["Geants", "raidLegendGiant"],
  ["Gobelins", "raidLegendGoblin"],
  ["Sapeurs", "raidLegendWallBreaker"],
]) {
  const count = inventoryText.match(new RegExp(`${label} (\\d+)`));
  assert.ok(count, label);
  assert.equal(element(harness, outputId).textContent, count[1]);
}
```

After the frame starts a raid, derive the expected values from the displayed inventory string and assert that each dedicated quantity matches it. After switching back to Flappy Bird, assert `raidPanel.hidden === true`; the legend is nested in that panel and therefore hidden with it.

- [ ] **Step 2: Run the app test and verify RED**

```bash
node --test test/app.test.mjs
```

Expected: FAIL because the six legend elements do not exist.

- [ ] **Step 3: Add the five-entry semantic legend**

Insert inside `#raidPanel`, after the existing inventory block:

```html
<section id="raidTroopLegend" class="raid-troop-legend" aria-label="Legende des troupes">
  <h3>Legende des troupes</h3>
  <div class="raid-troop-row raid-troop-barbarian"><span class="raid-troop-icon" aria-hidden="true">B</span><span><strong>Barbare niv. 2</strong><small>Cible : tous batiments</small></span><output id="raidLegendBarbarian">0</output></div>
  <div class="raid-troop-row raid-troop-archer"><span class="raid-troop-icon" aria-hidden="true">A</span><span><strong>Archere niv. 2</strong><small>Cible : tous batiments</small></span><output id="raidLegendArcher">0</output></div>
  <div class="raid-troop-row raid-troop-giant"><span class="raid-troop-icon" aria-hidden="true">G</span><span><strong>Geant niv. 1</strong><small>Cible : defenses</small></span><output id="raidLegendGiant">0</output></div>
  <div class="raid-troop-row raid-troop-goblin"><span class="raid-troop-icon" aria-hidden="true">Go</span><span><strong>Gobelin niv. 2</strong><small>Cible : ressources</small></span><output id="raidLegendGoblin">0</output></div>
  <div class="raid-troop-row raid-troop-wall-breaker"><span class="raid-troop-icon" aria-hidden="true">S</span><span><strong>Sapeur niv. 1</strong><small>Cible : murs</small></span><output id="raidLegendWallBreaker">0</output></div>
</section>
```

Keep ASCII source text as shown. Use CSS pseudo-elements and the five selected colors to distinguish silhouettes without loading image assets.

- [ ] **Step 4: Style the legend without crowding the panel**

Add focused CSS:

```css
.raid-troop-legend {
  display: grid;
  gap: 7px;
  padding-top: 10px;
}

.raid-troop-legend h3 {
  margin: 0;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.raid-troop-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.raid-troop-row small {
  display: block;
  color: var(--muted);
  font-size: 0.68rem;
}

.raid-troop-icon {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 2px solid var(--fg);
  border-radius: 50%;
  box-shadow: 2px 2px 0 var(--fg);
  font-size: 0.66rem;
  font-weight: 900;
}

.raid-troop-barbarian .raid-troop-icon { background: #f2c14e; }
.raid-troop-archer .raid-troop-icon { background: #e887b7; }
.raid-troop-giant .raid-troop-icon { width: 32px; height: 32px; background: #c88d5a; }
.raid-troop-goblin .raid-troop-icon { background: #4fae63; }
.raid-troop-wall-breaker .raid-troop-icon { background: #edf2f4; }
```

- [ ] **Step 5: Wire live inventory quantities**

Add the six new elements to `ui`, then update them from one stable mapping:

```js
const RAID_LEGEND_OUTPUTS = Object.freeze({
  barbarian: ui.raidLegendBarbarian,
  archer: ui.raidLegendArcher,
  giant: ui.raidLegendGiant,
  goblin: ui.raidLegendGoblin,
  wallBreaker: ui.raidLegendWallBreaker,
});

function updateRaidPanel(agent, targetWorld) {
  const raidWorld = targetWorld?.raidWorld;
  // retain the existing base, composition, inventory, and average updates
  for (const [type, output] of Object.entries(RAID_LEGEND_OUTPUTS)) {
    output.textContent = String(raidWorld?.inventory?.[type] ?? 0);
  }
}
```

The legend needs no separate visibility switch because it is nested in `#raidPanel`, which `setSettingsPanel` already hides outside Village Raid.

- [ ] **Step 6: Run the app test and verify GREEN**

```bash
node --test test/app.test.mjs
```

Expected: all app tests PASS.

- [ ] **Step 7: Run the required check and commit**

```bash
npm run check
git add index.html src/styles.css src/main.js test/app.test.mjs
git commit -m "feat: add Village Raid troop legend"
```

---

### Task 5: Documentation, Compatibility, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `index.html`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Documents: `SNAPSHOT_VERSION = "th3-2026-07-11-v2"`.
- Documents: `RAID_LAYOUT_VERSION = "th3-reference-layouts-v2"`.
- Documents: three fixed base IDs and source URLs.

- [ ] **Step 1: Write failing documentation assertions**

In `test/app.test.mjs`, replace historical roster copy assertions and add:

```js
assert.match(readme, /th3-2026-07-11-v2/);
assert.match(readme, /th3-reference-layouts-v2/);
assert.match(readme, /farm-111[\s\S]*war-26[\s\S]*defence-104/);
assert.match(readme, /22\s+buildings,\s+50 walls,\s+and 2 bombs/i);
assert.match(readme, /Builder Hut \| 2 \| 1 \| 250/);
assert.match(readme, /procedural Canvas/i);
assert.match(readme, /troop legend/i);
assert.match(html, /22 batiments/);
assert.doesNotMatch(readme, /open, compartmented,\s+and central Town Hall/);
```

- [ ] **Step 2: Run the documentation test and verify RED**

```bash
node --test test/app.test.mjs
```

Expected: FAIL because README and explanation copy still describe 25 buildings and the generic layouts.

- [ ] **Step 3: Update user-facing documentation**

Update the Village Raid README section to name the three fixed references, link all three source pages, state the 22-building roster, show Builder Hut quantity 2 in the table, explain the variable captured denominator, and describe original procedural Canvas building textures plus the hybrid troop legend.

Update `#explanationRaid` in `index.html` to state that each specimen attacks reconstructed #111, #26, and #104 bases containing 22 buildings each. Preserve the existing statement that visuals are original and no runtime network request occurs.

- [ ] **Step 4: Run the documentation test and verify GREEN**

```bash
node --test test/app.test.mjs
```

Expected: all app tests PASS.

- [ ] **Step 5: Run final static and full-suite verification**

```bash
node --check src/main.js
node --check src/village-raid-data.js
node --check src/village-raid-simulation.js
node --check src/village-raid-rendering.js
npm run check
git diff --check
git status --short
```

Expected:

- every syntax check exits 0;
- the full test suite reports zero failures;
- `git diff --check` produces no output;
- `git status --short` lists only the intentional implementation and documentation files plus any pre-existing `.superpowers/brainstorm/` state that must not be staged.

- [ ] **Step 6: Perform a browser smoke test**

Serve the repository with an available static server, open Village Raid, and verify:

1. Bases appear in order #111, #26, #104.
2. Buildings are distinguishable and keep square footprint outlines.
3. The Cannon's base remains square.
4. All five troop silhouettes are distinguishable at normal speed.
5. The compact Canvas key does not cover destruction or average telemetry.
6. The side legend shows correct live inventory counts and disappears for other games.
7. No network request is needed for a game asset.

- [ ] **Step 7: Run the required check and commit**

```bash
npm run check
git add README.md index.html test/app.test.mjs
git commit -m "docs: describe Village Raid reference layouts"
```

- [ ] **Step 8: Inspect the final diff**

```bash
git status --short
git log --oneline -7
```

Expected: five focused implementation commits follow the approved design/plan commits, with no `.superpowers/brainstorm/` artifact included in any implementation commit.
