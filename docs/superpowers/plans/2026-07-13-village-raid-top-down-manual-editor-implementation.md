# Village Raid Top-Down Manual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual editor's isometric construction pane with a recognizable orthogonal top-down editor that starts empty and supports reserve-to-grid drag and drop for exactly 22 buildings, 50 walls, and 2 bombs on each of the three locked villages.

**Architecture:** Add one pure top-down geometry module, upgrade the editor model to a version-2 nullable-coordinate state, then adapt the browser controller to render and edit only the orthogonal canvas while the screenshot remains a fixed reference. The production layouts remain read-only roster sources and are not changed by this plan.

**Tech Stack:** Dependency-free JavaScript ES modules, Canvas 2D, native pointer/drag events, localStorage, Node `node:test`, static HTML/CSS.

## Global Constraints

- The left reference image is fixed and non-interactive.
- The right editor is a centered 48-by-32 orthogonal grid inside a 960-by-560 canvas.
- Every selected village starts with 22 buildings, 50 walls, and 2 bombs in reserve.
- Buildings and bombs use nullable coordinates; walls use an empty-to-50 variable array.
- Only the top-down grid accepts placement and movement.
- Buildings preserve canonical type, level, width, and height; the Cannon remains square 3-by-3.
- Wall brush and eraser preserve the exact capacity of 50 and one stroke is one history entry.
- Reset returns every gameplay element to reserve.
- Draft and export schema is exactly `village-raid-layout-editor-v2`; draft storage keys contain `.v2.`.
- Version-1 drafts are ignored with a French warning.
- Reference images remain local or same-origin, temporary, and absent from drafts and exports.
- Do not modify `src/village-raid-data.js`, gameplay, training, attack timing, production layout coordinates, fixtures, or champion compatibility.
- Add no dependency, build step, remote font, copied game texture, or production runtime asset.
- Run `npm run check` before every commit.
- Do not stage `.superpowers/brainstorm/` or reference screenshots.

## File Structure

- Create `src/village-raid-top-down.js`: pure orthogonal fit, projection, footprint, and inverse mapping.
- Create `test/village-raid-top-down.test.mjs`: exact geometry and outside-boundary tests.
- Modify `src/village-raid-layout-editor.js`: empty v2 state, reserve-aware commands, validation, drafts, export, and history.
- Modify `test/village-raid-layout-editor.test.mjs`: v2 reserve, command, validation, draft, export, and reset coverage.
- Modify `src/village-raid-rendering.js`: expose recognizable building artwork without combat health bars.
- Modify `test/village-raid-rendering.test.mjs`: verify editor artwork reuses canonical recognizable cues without a health bar.
- Modify `tools/village-raid-layout-editor.html`: top-down labels, focusable canvas, and reserve semantics.
- Modify `tools/village-raid-layout-editor.css`: photo/top-down/reserve layout and placed/reserve states.
- Modify `tools/village-raid-layout-editor.js`: fixed photo, top-down rendering, reserve drag/drop, keyboard placement/removal, walls, drafts, and validation.
- Modify `test/village-raid-layout-editor-ui.test.mjs`: top-down UI, imports, reserve, pointer, drag, and keyboard contracts.
- Modify `README.md`: replace the isometric calibration workflow with the empty top-down workflow.

---

### Task 1: Add Pure Orthogonal Top-Down Geometry

**Files:**
- Create: `src/village-raid-top-down.js`
- Create: `test/village-raid-top-down.test.mjs`

**Interfaces:**
- Consumes: `{ width: 48, height: 32 }` grid objects and canvas dimensions.
- Produces:
  - `createRaidTopDownGeometry(canvasWidth, canvasHeight, grid, options?)`
  - `projectRaidTopDownPoint(geometry, point)`
  - `projectRaidTopDownFootprint(geometry, entity)`
  - `unprojectRaidTopDownPoint(geometry, point)` returning a fractional grid point or `null` outside the fitted rectangle.

- [ ] **Step 1: Write the failing geometry tests**

Create `test/village-raid-top-down.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRaidTopDownGeometry,
  projectRaidTopDownFootprint,
  projectRaidTopDownPoint,
  unprojectRaidTopDownPoint,
} from "../src/village-raid-top-down.js";

const grid = Object.freeze({ width: 48, height: 32 });

test("top-down geometry fits a centered square-cell grid inside 960x560", () => {
  const geometry = createRaidTopDownGeometry(960, 560, grid);
  assert.equal(geometry.tile, 16);
  assert.deepEqual(geometry.bounds, {
    left: 96, top: 24, right: 864, bottom: 536,
  });
  assert.equal(geometry.bounds.right - geometry.bounds.left, 48 * geometry.tile);
  assert.equal(geometry.bounds.bottom - geometry.bounds.top, 32 * geometry.tile);
});

test("top-down grid points round-trip without changing axes", () => {
  const geometry = createRaidTopDownGeometry(960, 560, grid);
  for (const point of [{ x: 0, y: 0 }, { x: 24.5, y: 16.5 }, { x: 48, y: 32 }]) {
    assert.deepEqual(
      unprojectRaidTopDownPoint(geometry, projectRaidTopDownPoint(geometry, point)),
      point,
    );
  }
});

test("top-down inverse mapping rejects points outside the fitted rectangle", () => {
  const geometry = createRaidTopDownGeometry(960, 560, grid);
  assert.equal(unprojectRaidTopDownPoint(geometry, { x: 95.99, y: 100 }), null);
  assert.equal(unprojectRaidTopDownPoint(geometry, { x: 200, y: 23.99 }), null);
  assert.deepEqual(unprojectRaidTopDownPoint(geometry, { x: 96, y: 24 }), { x: 0, y: 0 });
  assert.deepEqual(unprojectRaidTopDownPoint(geometry, { x: 864, y: 536 }), { x: 48, y: 32 });
});

test("top-down footprints preserve the exact rectangular entity size", () => {
  const geometry = createRaidTopDownGeometry(960, 560, grid);
  assert.deepEqual(projectRaidTopDownFootprint(geometry, {
    x: 10, y: 8, width: 3, height: 3,
  }), { x: 256, y: 152, width: 48, height: 48 });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test test/village-raid-top-down.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/village-raid-top-down.js`.

- [ ] **Step 3: Implement the minimal geometry module**

Create `src/village-raid-top-down.js`:

```js
const DEFAULT_MARGIN = Object.freeze({ x: 48, y: 24 });

export function createRaidTopDownGeometry(canvasWidth, canvasHeight, grid, options = {}) {
  const marginX = options.marginX ?? DEFAULT_MARGIN.x;
  const marginY = options.marginY ?? DEFAULT_MARGIN.y;
  const tile = Math.floor(Math.min(
    (canvasWidth - marginX * 2) / grid.width,
    (canvasHeight - marginY * 2) / grid.height,
  ));
  if (!Number.isFinite(tile) || tile <= 0) throw new RangeError("Grid does not fit canvas");
  const width = grid.width * tile;
  const height = grid.height * tile;
  const left = (canvasWidth - width) / 2;
  const top = (canvasHeight - height) / 2;
  return Object.freeze({
    canvasWidth, canvasHeight, grid, tile,
    bounds: Object.freeze({ left, top, right: left + width, bottom: top + height }),
  });
}

export function projectRaidTopDownPoint(geometry, point) {
  return {
    x: geometry.bounds.left + point.x * geometry.tile,
    y: geometry.bounds.top + point.y * geometry.tile,
  };
}

export function projectRaidTopDownFootprint(geometry, entity) {
  const point = projectRaidTopDownPoint(geometry, entity);
  return {
    x: point.x,
    y: point.y,
    width: (entity.width ?? 1) * geometry.tile,
    height: (entity.height ?? 1) * geometry.tile,
  };
}

export function unprojectRaidTopDownPoint(geometry, point) {
  const { left, top, right, bottom } = geometry.bounds;
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return null;
  return {
    x: (point.x - left) / geometry.tile,
    y: (point.y - top) / geometry.tile,
  };
}
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node --test test/village-raid-top-down.test.mjs
npm run check
git diff --check
```

Expected: 4 focused tests pass; full suite passes; no whitespace errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/village-raid-top-down.js test/village-raid-top-down.test.mjs
git commit -m "feat: add Village Raid top-down geometry"
```

---

### Task 2: Upgrade the Editor Model to Empty Version-2 Reserve State

**Files:**
- Modify: `src/village-raid-layout-editor.js`
- Modify: `test/village-raid-layout-editor.test.mjs`

**Interfaces:**
- Consumes: locked production-shaped layout objects from `LAYOUTS`.
- Produces:
  - `LAYOUT_EDITOR_SCHEMA === "village-raid-layout-editor-v2"`
  - `createEmptyLayoutEditorState(layout)`
  - `isLayoutEditorEntityPlaced(entity)`
  - `placeLayoutEditorEntity(state, selection, cell)`
  - `removeLayoutEditorEntity(state, selection)`
  - `layoutEditorReserveCounts(state)`
  - existing wall/history/draft/export functions updated for nullable coordinates.

- [ ] **Step 1: Replace calibration-state tests with failing v2 reserve tests**

Update imports in `test/village-raid-layout-editor.test.mjs` and add:

```js
test("empty editor state preserves the locked roster entirely in reserve", () => {
  const state = createEmptyLayoutEditorState(farm);
  assert.equal(state.schema, "village-raid-layout-editor-v2");
  assert.equal(state.buildings.length, 22);
  assert.equal(state.traps.length, 2);
  assert.equal(state.walls.length, 0);
  assert.ok([...state.buildings, ...state.traps].every((entity) =>
    entity.x === null && entity.y === null
  ));
  assert.deepEqual(layoutEditorReserveCounts(state), {
    buildings: 22, walls: 50, traps: 2,
  });
});

test("placing and removing a reserved building keeps canonical metadata", () => {
  const initial = createEmptyLayoutEditorState(farm);
  const canonical = initial.buildings.find(({ id }) => id === "cannon-1");
  const placed = placeLayoutEditorEntity(
    initial,
    { kind: "building", id: canonical.id },
    { x: 6, y: 7 },
  );
  assert.equal(placed.error, null);
  assert.deepEqual(
    placed.state.buildings.find(({ id }) => id === canonical.id),
    { ...canonical, x: 6, y: 7 },
  );
  const removed = removeLayoutEditorEntity(
    placed.state,
    { kind: "building", id: canonical.id },
  );
  assert.equal(removed.error, null);
  assert.deepEqual(
    removed.state.buildings.find(({ id }) => id === canonical.id),
    canonical,
  );
});

test("reserve placement rejects footprint overlap and off-grid cells atomically", () => {
  let state = createEmptyLayoutEditorState(farm);
  state = placeLayoutEditorEntity(state, { kind: "building", id: "cannon-1" }, { x: 2, y: 2 }).state;
  const overlap = placeLayoutEditorEntity(state, { kind: "trap", id: "bomb-1" }, { x: 3, y: 3 });
  assert.equal(overlap.state, state);
  assert.match(overlap.error, /chevauche/i);
  const offGrid = placeLayoutEditorEntity(state, { kind: "building", id: "townHall-1" }, { x: 47, y: 31 });
  assert.equal(offGrid.state, state);
  assert.match(offGrid.error, /hors/i);
});

test("validation and export remain blocked until every reserve is empty", () => {
  const state = createEmptyLayoutEditorState(farm);
  const result = validateLayoutEditorState(state);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /22 batiments.*reserve/i);
  assert.match(result.errors.join(" "), /50 murs.*reserve/i);
  assert.match(result.errors.join(" "), /2 bombes.*reserve/i);
  assert.throws(() => serializeLayoutEditorExport(state), /reserve/i);
});

test("v2 drafts preserve nullable reserve coordinates and reject v1", () => {
  const initial = createEmptyLayoutEditorState(farm);
  const placed = placeLayoutEditorEntity(
    initial,
    { kind: "building", id: "builderHut-1" },
    { x: 1, y: 1 },
  ).state;
  const restored = parseLayoutEditorDraft(serializeLayoutEditorDraft(placed), initial);
  assert.deepEqual(restored.state, placed);
  assert.equal(restored.warning, null);
  const v1 = JSON.stringify({ schema: "village-raid-layout-editor-v1", state: placed });
  const rejected = parseLayoutEditorDraft(v1, initial);
  assert.equal(rejected.state, initial);
  assert.match(rejected.warning, /incompatible/i);
  assert.match(layoutEditorDraftKey("farm-111"), /\.v2\.farm-111$/);
});

test("reset returns a partially built village to the empty initial state", () => {
  const initial = createEmptyLayoutEditorState(farm);
  const partial = placeLayoutEditorEntity(
    initial,
    { kind: "building", id: "builderHut-1" },
    { x: 1, y: 1 },
  ).state;
  const history = commitLayoutEditorHistory(createLayoutEditorHistory(initial), partial);
  assert.deepEqual(resetLayoutEditorHistory(history).present, initial);
});
```

Keep existing wall/history/adversarial draft tests, updating their setup to
place the required canonical entities only when a fully valid state is needed.

- [ ] **Step 2: Run the focused suite and verify RED**

Run:

```bash
node --test test/village-raid-layout-editor.test.mjs
```

Expected: FAIL because v2 exports and reserve-aware functions do not exist.

- [ ] **Step 3: Implement v2 empty state and entity commands**

In `src/village-raid-layout-editor.js`, set:

```js
export const LAYOUT_EDITOR_SCHEMA = "village-raid-layout-editor-v2";

export function createEmptyLayoutEditorState(layout) {
  return {
    schema: LAYOUT_EDITOR_SCHEMA,
    baseId: layout.id,
    requiredBuildingIds: layout.buildings.map(({ id }) => id).sort(),
    requiredTrapIds: layout.traps.map(({ id }) => id).sort(),
    buildings: layout.buildings.map((building) => ({ ...building, x: null, y: null })),
    walls: [],
    traps: layout.traps.map((trap) => ({ ...trap, x: null, y: null })),
  };
}

export function isLayoutEditorEntityPlaced(entity) {
  return Number.isInteger(entity.x) && Number.isInteger(entity.y);
}

export function layoutEditorReserveCounts(state) {
  return {
    buildings: state.buildings.filter((entity) => !isLayoutEditorEntityPlaced(entity)).length,
    walls: LAYOUT_EDITOR_COUNTS.walls - state.walls.length,
    traps: state.traps.filter((entity) => !isLayoutEditorEntityPlaced(entity)).length,
  };
}
```

Replace `moveLayoutEditorEntity` with `placeLayoutEditorEntity` using the existing
atomic candidate validation and allow nullable starting coordinates. Split that
candidate check from `validateLayoutEditorState`: placement checks only the
selected footprint, grid bounds, and collisions, while final validation also
checks roster completeness and empty reserves. This allows the first through
the seventy-fourth placement to commit without weakening final export rules.
Add:

```js
export function removeLayoutEditorEntity(state, selection) {
  if (selection.kind !== "building" && selection.kind !== "trap") {
    return { state, error: `Type d'element inconnu: ${selection.kind}` };
  }
  const collectionName = selection.kind === "building" ? "buildings" : "traps";
  const collection = state[collectionName];
  const index = collection.findIndex(({ id }) => id === selection.id);
  if (index < 0) return { state, error: `Element inconnu: ${selection.id}` };
  if (!isLayoutEditorEntityPlaced(collection[index])) return { state, error: null };
  return {
    state: {
      ...state,
      [collectionName]: collection.map((entity, entityIndex) => entityIndex === index
        ? { ...entity, x: null, y: null }
        : entity),
    },
    error: null,
  };
}
```

Make `entityCells` return `[]` for unplaced entities. Validation must add exact
blocking messages:

```js
const reserves = layoutEditorReserveCounts(state);
if (reserves.buildings) errors.push(`${reserves.buildings} batiments restent en reserve`);
if (reserves.walls) errors.push(`${reserves.walls} murs restent en reserve`);
if (reserves.traps) errors.push(`${reserves.traps} bombes restent en reserve`);
```

Draft parsing accepts either integer pairs or `null/null`, rejects mixed pairs,
rebuilds metadata from `initialState`, and drops the old calibration field.
Export contains only `schema`, `baseId`, `buildings`, `walls`, and `traps`.
Delete obsolete calibration-state exports and their v1-only tests once no
production or tool import references them; do not leave two competing editor
state shapes in the module.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node --test test/village-raid-layout-editor.test.mjs
npm run check
git diff --check
```

Expected: all editor model tests and full suite pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/village-raid-layout-editor.js test/village-raid-layout-editor.test.mjs
git commit -m "feat: add Village Raid editor reserves"
```

---

### Task 3: Replace the Isometric Shell with a Recognizable Top-Down Reserve View

**Files:**
- Modify: `src/village-raid-rendering.js`
- Modify: `test/village-raid-rendering.test.mjs`
- Modify: `tools/village-raid-layout-editor.html`
- Modify: `tools/village-raid-layout-editor.css`
- Modify: `tools/village-raid-layout-editor.js`
- Modify: `test/village-raid-layout-editor-ui.test.mjs`

**Interfaces:**
- Consumes Task 1 geometry and Task 2 v2 reserve state.
- Produces `drawRaidBuildingArtwork(ctx, building, offsetX, offsetY, tile)` and a browser shell with `#topDownCanvas`, fixed `#sourceCanvas`, reserve/placed groups, and top-down drawing.

- [ ] **Step 1: Write failing rendering and UI tests**

In `test/village-raid-rendering.test.mjs`, add:

```js
test("editor building artwork keeps canonical cues without a combat health bar", () => {
  const ctx = recordingContext();
  drawRaidBuildingArtwork(ctx, buildingFixture("cannon"), 10, 12, 10);
  assert.ok(ctx.calls.some(({ type }) => type === "strokeRect"));
  assert.ok(ctx.calls.filter(({ type }) => type === "arc").length >= 2);
  assert.equal(ctx.calls.some(({ fillStyle }) => fillStyle === "#48c774"), false);
});
```

In `test/village-raid-layout-editor-ui.test.mjs`, replace isometric expectations
and add:

```js
test("manual editor exposes a fixed photo and focusable top-down construction grid", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /<figcaption>Photo originale<\/figcaption>/);
  assert.match(html, /id="topDownCanvas"[^>]*width="960"[^>]*height="560"[^>]*tabindex="0"/);
  assert.match(html, /aria-label="Grille top-down interactive du village"/);
  assert.doesNotMatch(html, /Vue isometrique|id="isoCanvas"/i);
});

test("editor imports top-down geometry and no isometric editor projection", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /from "\.\.\/src\/village-raid-top-down\.js"/);
  assert.match(script, /createRaidTopDownGeometry/);
  assert.match(script, /projectRaidTopDownFootprint/);
  assert.match(script, /unprojectRaidTopDownPoint/);
  assert.doesNotMatch(script, /createRaidIsoGeometry|projectRaidFootprint|unprojectRaidPoint/);
});

test("editor renders reserve and placed groups with top-down counts", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function renderReserveList\(/);
  assert.match(script, /En reserve/);
  assert.match(script, /Places/);
  assert.match(script, /batiments places/);
  assert.match(script, /bombes en reserve/);
  assert.match(script, /function renderTopDownCanvas\(/);
  assert.match(script, /drawRaidBuildingArtwork/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test test/village-raid-rendering.test.mjs test/village-raid-layout-editor-ui.test.mjs
```

Expected: FAIL for missing artwork export, old isometric markup/imports, and
missing reserve renderer.

- [ ] **Step 3: Extract reusable building artwork**

In `src/village-raid-rendering.js`, extract the existing body artwork from
`drawRaidBuilding`:

```js
export function drawRaidBuildingArtwork(ctx, building, offsetX, offsetY, tile) {
  const x = offsetX + building.x * tile;
  const y = offsetY + building.y * tile;
  const width = building.width * tile;
  const height = building.height * tile;
  const [primary, secondary] = BUILDING_PALETTES[building.type] ?? ["#88929d", "#3f4852"];
  ctx.save();
  ctx.fillStyle = secondary;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  ctx.strokeStyle = "#171b20";
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  drawBuildingDetail(ctx, building.type, x, y, width, height, primary, secondary);
  ctx.restore();
}
```

Keep `drawRaidBuilding(ctx, building, offsetX, tile)` backward compatible by
calling `drawRaidBuildingArtwork(ctx, building, offsetX, 0, tile)` and then its
existing health bar.

- [ ] **Step 4: Replace markup and toolbar terminology**

In `tools/village-raid-layout-editor.html`:

```html
<figure class="editor-canvas-card">
  <figcaption>Photo originale</figcaption>
  <canvas id="sourceCanvas" width="960" height="560"
    aria-label="Photo originale du village"></canvas>
</figure>
<figure class="editor-canvas-card">
  <figcaption>Vue top-down</figcaption>
  <canvas id="topDownCanvas" width="960" height="560" tabindex="0"
    aria-label="Grille top-down interactive du village"
    aria-describedby="canvasInstructions"></canvas>
</figure>
<aside class="entity-panel">
  <h2>Reserve et elements places</h2>
  <div id="entityList" aria-label="Reserve et elements du village"></div>
</aside>
```

Change instructions to: `Glissez les batiments et bombes de la reserve vers la grille top-down. Utilisez le pinceau pour les murs.`

The only tools are:

```js
const TOOLS = Object.freeze([
  { id: "move", label: "Deplacer un element" },
  { id: "paint", label: "Peindre un mur" },
  { id: "erase", label: "Effacer un mur" },
]);
```

- [ ] **Step 5: Render the fixed photo, top-down grid, reserves, and recognizable entities**

In `tools/village-raid-layout-editor.js`:

- replace `isoCanvas` with `topDownCanvas`;
- remove screenshot calibration imports, handles, overlays, and source pointer mapping;
- import Task 1 geometry and `drawRaidBuildingArtwork`;
- initialize histories with `createEmptyLayoutEditorState(layout)`;
- set `selectedTool = "move"`;
- make `renderSourceCanvas` draw only the contained image or its empty-state message;
- create one `createRaidTopDownGeometry(960, 560, LAYOUT_EDITOR_GRID)` per render;
- draw square orthogonal grid lines from `geometry.bounds` and `geometry.tile`;
- draw only placed entities;
- use `drawRaidBuildingArtwork(context, building, geometry.bounds.left, geometry.bounds.top, geometry.tile)`;
- draw walls as square stone cells and bombs as distinct black/red circles;
- draw selection, valid/invalid preview, keyboard cursor, and validation highlights in canvas coordinates from `projectRaidTopDownFootprint`.

Implement counts as:

```js
function renderCounts(state) {
  const reserve = layoutEditorReserveCounts(state);
  const placedBuildings = state.buildings.length - reserve.buildings;
  const placedTraps = state.traps.length - reserve.traps;
  elements.counts.textContent = [
    `${placedBuildings}/22 batiments places`,
    `${state.walls.length}/50 murs places`,
    `${placedTraps}/2 bombes placees`,
    `${reserve.buildings} batiments, ${reserve.walls} murs et ${reserve.traps} bombes en reserve`,
  ].join(" - ");
}
```

`renderReserveList` must create an `En reserve` group for nullable-coordinate
buildings and bombs, and a `Places` group for integer-coordinate buildings,
walls, and bombs. Reserve buttons have `draggable = true`, stable kind/ID data,
and French labels. Placed buttons keep selection and focus restoration.

- [ ] **Step 6: Update responsive styling**

Keep the wide three-column workspace and narrow stack. Add styles for:

```css
.entity-group--reserve button { border-color: #8b6b32; background: #211a0c; }
.entity-group--placed button { border-color: #285e59; }
.entity-group button[draggable="true"] { cursor: grab; }
.entity-group button[draggable="true"]:active { cursor: grabbing; }
#topDownCanvas:focus-visible { outline: 3px solid #5eead4; outline-offset: -3px; }
```

- [ ] **Step 7: Run focused and full verification**

Run:

```bash
node --test test/village-raid-rendering.test.mjs test/village-raid-layout-editor-ui.test.mjs
node --check tools/village-raid-layout-editor.js
npm run check
git diff --check
```

Expected: focused tests and full suite pass.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/village-raid-rendering.js test/village-raid-rendering.test.mjs tools/village-raid-layout-editor.html tools/village-raid-layout-editor.css tools/village-raid-layout-editor.js test/village-raid-layout-editor-ui.test.mjs
git commit -m "feat: render top-down Village Raid editor"
```

---

### Task 4: Wire Reserve Drag/Drop, Removal, Keyboard Editing, Drafts, and Approval

**Files:**
- Modify: `tools/village-raid-layout-editor.js`
- Modify: `test/village-raid-layout-editor-ui.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes Task 1 top-down inverse mapping and Task 2 placement/removal/history/draft commands.
- Produces the complete empty-to-approved manual workflow for all three villages.

- [ ] **Step 1: Add failing interaction wiring tests**

Add to `test/village-raid-layout-editor-ui.test.mjs`:

```js
test("reserve drag and drop places only on the top-down grid", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /dragstart/);
  assert.match(script, /dragover/);
  assert.match(script, /drop/);
  assert.match(script, /dataTransfer/);
  assert.match(script, /placeLayoutEditorEntity/);
  assert.match(script, /removeLayoutEditorEntity/);
  assert.match(script, /elements\.topDownCanvas\.addEventListener\("drop"/);
  assert.doesNotMatch(script, /elements\.sourceCanvas\.addEventListener\("pointerdown"/);
});

test("placed entities drag, remove, and edit by keyboard", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /pointerdown/);
  assert.match(script, /pointermove/);
  assert.match(script, /pointerup/);
  assert.match(script, /event\.key === "Enter"/);
  assert.match(script, /event\.key === "Delete"/);
  assert.match(script, /event\.key === "Backspace"/);
  assert.match(script, /keyboardCell/);
  assert.match(script, /removeSelectedEntity/);
});

test("top-down edits keep one history path and invalidate stale exports", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function commitEditorState\(/);
  assert.match(script, /persistCurrentDraft\(\)/);
  assert.match(script, /invalidateExport\(\)/);
  assert.match(script, /finishWallStroke/);
  assert.match(script, /resetLayoutEditorHistory/);
});
```

- [ ] **Step 2: Run the UI suite and verify RED**

Run:

```bash
node --test test/village-raid-layout-editor-ui.test.mjs
```

Expected: FAIL because reserve drag/drop and v2 keyboard removal are not wired.

- [ ] **Step 3: Wire reserve-to-grid drag and drop**

On each reserve building/bomb button:

```js
button.draggable = true;
button.addEventListener("dragstart", (event) => {
  const selection = { kind, id: entity.id };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-village-raid-entity", JSON.stringify(selection));
  selectedEntity = selection;
});
```

On `topDownCanvas`:

```js
elements.topDownCanvas.addEventListener("dragover", (event) => {
  if (!event.dataTransfer.types.includes("application/x-village-raid-entity")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

elements.topDownCanvas.addEventListener("drop", (event) => {
  event.preventDefault();
  const selection = JSON.parse(
    event.dataTransfer.getData("application/x-village-raid-entity"),
  );
  const cell = pointerGridPoint(event);
  const result = placeLayoutEditorEntity(currentHistory().present, selection, cell);
  if (result.error) {
    interactionMessage = result.error;
    render();
    return;
  }
  selectedEntity = selection;
  commitEditorState(result.state);
});
```

Guard malformed drag payloads and out-of-grid drops with French status messages
without changing history.

- [ ] **Step 4: Wire placed pointer movement and removal to reserve**

Only `topDownCanvas` receives pointer handlers. A pointer drag beginning on a
placed entity stores its grab offset and uses `placeLayoutEditorEntity` for
candidate previews. If pointerup has a valid cell, commit placement. If
pointerup is outside the fitted rectangle, call `removeLayoutEditorEntity` and
commit the result. An invalid in-grid overlap reverts without history.

Implement:

```js
function removeSelectedEntity() {
  if (!selectedEntity || selectedEntity.kind === "wall") return false;
  const result = removeLayoutEditorEntity(currentHistory().present, selectedEntity);
  if (result.error) {
    interactionMessage = result.error;
    render();
    return false;
  }
  return commitEditorState(result.state);
}
```

- [ ] **Step 5: Wire keyboard cursor, placement, movement, and deletion**

Maintain `let keyboardCell = { x: 24, y: 16 };`. When `topDownCanvas` is focused:

- arrows move a selected placed entity through `placeLayoutEditorEntity`;
- arrows move `keyboardCell` when the selection is in reserve;
- `Enter` places the reserve selection at `keyboardCell`;
- `Delete` or `Backspace` calls `removeSelectedEntity`;
- `Escape` cancels preview and selection.

Clamp the keyboard cursor to integer cells within `LAYOUT_EDITOR_GRID` and draw
its complete candidate footprint with cyan/red feedback.

- [ ] **Step 6: Keep walls, drafts, base switching, reset, validation, and export coherent**

Reuse the existing one-transaction wall stroke functions with top-down
`pointerGridPoint`. Base switching restores independent v2 histories and drafts.
Reset confirmation restores the empty `history.initial`. Validation highlights
unplaced IDs in the reserve list, blocking export until reserve counts are zero.
Any accepted edit hides the old export.

Update successful validation copy to:

```text
Village top-down valide. Les coordonnees affichees sont pretes a etre relues.
```

- [ ] **Step 7: Update README workflow**

Replace the manual editor subsection with:

```text
Serve the repository and open /tools/village-raid-layout-editor.html.
Keep the local reference photo on the left, then drag the 22 buildings and 2 bombs from reserve onto the empty top-down grid. Paint all 50 walls with the wall brush.
Each village keeps an independent local v2 draft. Validate #111, #26, and #104 separately and use only the visible approved JSON exports for a later production-layout change.
Reference screenshots are temporary and are never committed or exported.
```

- [ ] **Step 8: Run automated verification and commit**

Run:

```bash
node --test test/village-raid-top-down.test.mjs test/village-raid-layout-editor.test.mjs test/village-raid-layout-editor-ui.test.mjs test/village-raid-rendering.test.mjs
node --check tools/village-raid-layout-editor.js
npm run check
git diff --check
```

Expected: focused and full suites pass.

Commit:

```bash
git add tools/village-raid-layout-editor.js test/village-raid-layout-editor-ui.test.mjs README.md
git commit -m "feat: complete top-down Village Raid editing"
```

- [ ] **Step 9: Verify all three villages in the Codex in-app browser**

Serve the worktree and open:

```text
http://127.0.0.1:61014/tools/village-raid-layout-editor.html?source111=/.superpowers/sdd/assets/originals/th3_farm_111.jpg&source26=/.superpowers/sdd/assets/originals/th3_war_26.jpg&source104=/.superpowers/sdd/assets/originals/th3_defence_104.jpg
```

Verify at normal and narrow widths:

- photo is fixed and only top-down accepts edits;
- every base starts at 0/22 buildings, 0/50 walls, and 0/2 bombs;
- reserve building and bomb drag/drop snaps to exact square cells;
- Cannon remains square and Mortar remains visually distinct;
- overlap and off-grid drops revert with red/French feedback;
- placed entities move and return to reserve;
- wall brush consumes reserve and one stroke is one undo step;
- keyboard Enter/arrows/Delete paths work;
- switching and reload restore independent v2 drafts;
- reset empties the selected village after confirmation;
- validation blocks incomplete villages;
- browser console has no error or warning.

Leave the editor open on #111 with the empty state visible. Do not change
production layout data or import any export in this plan.

---

## Completion Boundary

The plan is complete when the empty top-down editor is tested, open on #111,
and ready for the user to rebuild the three villages. Production layouts remain
unchanged until a separate user-approved import change consumes all three
validated v2 exports.
