import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLayoutEditorWallStroke,
  commitLayoutEditorHistory,
  createLayoutEditorHistory,
  createLayoutEditorState,
  createScreenshotCalibration,
  layoutEditorDraftKey,
  layoutEditorWallReserve,
  moveLayoutEditorEntity,
  parseLayoutEditorDraft,
  projectEditorGridPoint,
  redoLayoutEditorHistory,
  resetLayoutEditorHistory,
  serializeLayoutEditorDraft,
  serializeLayoutEditorExport,
  snapEditorGridPoint,
  undoLayoutEditorHistory,
  unprojectEditorScreenshotPoint,
  validateLayoutEditorState,
} from "../src/village-raid-layout-editor.js";
import { LAYOUTS } from "../src/village-raid-data.js";

const farm = LAYOUTS.find(({ id }) => id === "farm-111");
const defaultCalibration = createScreenshotCalibration(
  { x: 500, y: 231 }, { x: 650, y: 331 }, { x: 350, y: 331 }, { x: 22, y: 18 },
);

test("three handles define one invertible screenshot lattice", () => {
  const calibration = createScreenshotCalibration(
    { x: 1310, y: 600 },
    { x: 1527.5, y: 745 },
    { x: 1092.5, y: 745 },
    { x: 22, y: 16 },
  );
  assert.deepEqual(calibration.columnBasis, { x: 43.5, y: 29 });
  assert.deepEqual(calibration.rowBasis, { x: -43.5, y: 29 });
  const pixel = projectEditorGridPoint(calibration, { x: 28, y: 20 });
  assert.deepEqual(pixel, { x: 1397, y: 890 });
  assert.deepEqual(unprojectEditorScreenshotPoint(calibration, pixel), { x: 28, y: 20 });
  assert.deepEqual(snapEditorGridPoint({ x: 27.51, y: 19.49 }), { x: 28, y: 19 });
});

test("a singular screenshot lattice cannot be inverted", () => {
  const calibration = createScreenshotCalibration(
    { x: 100, y: 100 },
    { x: 200, y: 200 },
    { x: 300, y: 300 },
    { x: 22, y: 16 },
  );
  assert.equal(unprojectEditorScreenshotPoint(calibration, { x: 150, y: 150 }), null);
});

test("editor state clones the locked production inventory", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  assert.equal(state.buildings.length, 22);
  assert.equal(state.walls.length, 50);
  assert.equal(state.traps.length, 2);
  assert.equal(layoutEditorWallReserve(state), 0);
  assert.notEqual(state.buildings, farm.buildings);
});

test("valid entity moves commit while overlaps revert atomically", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const moved = moveLayoutEditorEntity(
    state,
    { kind: "building", id: "builderHut-1" },
    { x: 1, y: 1 },
  );
  assert.equal(moved.error, null);
  assert.deepEqual(
    moved.state.buildings.find(({ id }) => id === "builderHut-1"),
    { ...state.buildings.find(({ id }) => id === "builderHut-1"), x: 1, y: 1 },
  );
  const blocked = moveLayoutEditorEntity(
    state,
    { kind: "building", id: "builderHut-1" },
    { x: state.buildings[0].x, y: state.buildings[0].y },
  );
  assert.match(blocked.error, /chevauche/i);
  assert.equal(blocked.state, state);
});

test("wall erase and paint preserve the fixed capacity through reserve", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const removedCell = { x: state.walls[0].x, y: state.walls[0].y };
  const erased = applyLayoutEditorWallStroke(state, "erase", [removedCell, removedCell]);
  assert.equal(erased.state.walls.length, 49);
  assert.equal(layoutEditorWallReserve(erased.state), 1);
  const painted = applyLayoutEditorWallStroke(erased.state, "paint", [{ x: 1, y: 30 }]);
  assert.equal(painted.error, null);
  assert.equal(painted.state.walls.length, 50);
  assert.equal(layoutEditorWallReserve(painted.state), 0);
  const overCapacity = applyLayoutEditorWallStroke(
    painted.state,
    "paint",
    [{ x: 2, y: 30 }],
  );
  assert.match(overCapacity.error, /reserve/i);
  assert.equal(overCapacity.state, painted.state);
});

test("history groups one edit and supports undo redo and reset", () => {
  const initial = createLayoutEditorState(farm, defaultCalibration);
  const moved = moveLayoutEditorEntity(
    initial,
    { kind: "building", id: "builderHut-1" },
    { x: 1, y: 1 },
  ).state;
  let history = commitLayoutEditorHistory(createLayoutEditorHistory(initial), moved);
  assert.equal(history.present.buildings.find(({ id }) => id === "builderHut-1").x, 1);
  history = undoLayoutEditorHistory(history);
  assert.equal(
    history.present.buildings.find(({ id }) => id === "builderHut-1").x,
    initial.buildings.find(({ id }) => id === "builderHut-1").x,
  );
  history = redoLayoutEditorHistory(history);
  assert.equal(history.present.buildings.find(({ id }) => id === "builderHut-1").x, 1);
  history = resetLayoutEditorHistory(history);
  assert.deepEqual(history.present, initial);
});

test("moving an entity to its current cell is a no-op without phantom history", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const hut = state.buildings.find(({ id }) => id === "builderHut-1");
  const unchanged = moveLayoutEditorEntity(
    state,
    { kind: "building", id: hut.id },
    { x: hut.x, y: hut.y },
  );
  assert.equal(unchanged.error, null);
  assert.equal(unchanged.state, state);

  const history = createLayoutEditorHistory(state);
  assert.equal(commitLayoutEditorHistory(history, unchanged.state), history);
  assert.deepEqual(history.past, []);
});

test("painting only existing walls preserves the state reference", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const existingCell = { x: state.walls[0].x, y: state.walls[0].y };
  const unchanged = applyLayoutEditorWallStroke(
    state,
    "paint",
    [existingCell, existingCell],
  );
  assert.equal(unchanged.error, null);
  assert.equal(unchanged.state, state);
});

test("an unknown entity selection kind fails atomically", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const result = moveLayoutEditorEntity(
    state,
    { kind: "decoration", id: state.traps[0].id },
    { x: 1, y: 1 },
  );
  assert.match(result.error, /inconnu/i);
  assert.equal(result.state, state);
});

test("building trap and wall edits reject off-grid cells atomically", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const building = moveLayoutEditorEntity(
    state,
    { kind: "building", id: "builderHut-1" },
    { x: 47, y: 31 },
  );
  assert.match(building.error, /terrain/i);
  assert.equal(building.state, state);

  const trap = moveLayoutEditorEntity(
    state,
    { kind: "trap", id: state.traps[0].id },
    { x: -1, y: 0 },
  );
  assert.match(trap.error, /terrain/i);
  assert.equal(trap.state, state);

  const removedCell = { x: state.walls[0].x, y: state.walls[0].y };
  const erased = applyLayoutEditorWallStroke(state, "erase", [removedCell]).state;
  const wall = applyLayoutEditorWallStroke(erased, "paint", [{ x: 48, y: 0 }]);
  assert.match(wall.error, /terrain/i);
  assert.equal(wall.state, erased);
});

test("painting a wall on an entity fails atomically", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const removedCell = { x: state.walls[0].x, y: state.walls[0].y };
  const erased = applyLayoutEditorWallStroke(state, "erase", [removedCell]).state;
  const townHall = erased.buildings.find(({ id }) => id === "townHall-1");
  const blocked = applyLayoutEditorWallStroke(
    erased,
    "paint",
    [{ x: townHall.x, y: townHall.y }],
  );
  assert.match(blocked.error, /occupee/i);
  assert.equal(blocked.state, erased);
});

test("a new commit invalidates redo without mutating history arrays", () => {
  const initial = createLayoutEditorState(farm, defaultCalibration);
  const firstMove = moveLayoutEditorEntity(
    initial,
    { kind: "building", id: "builderHut-1" },
    { x: 1, y: 1 },
  ).state;
  const original = createLayoutEditorHistory(initial);
  Object.freeze(original.past);
  Object.freeze(original.future);

  const committed = commitLayoutEditorHistory(original, firstMove);
  assert.deepEqual(original.past, []);
  assert.deepEqual(original.future, []);
  Object.freeze(committed.past);
  Object.freeze(committed.future);

  const undone = undoLayoutEditorHistory(committed);
  assert.equal(committed.present, firstMove);
  assert.deepEqual(committed.future, []);
  assert.deepEqual(undone.future, [firstMove]);
  Object.freeze(undone.past);
  Object.freeze(undone.future);

  const secondMove = moveLayoutEditorEntity(
    undone.present,
    { kind: "building", id: "builderHut-1" },
    { x: 2, y: 2 },
  ).state;
  const recommitted = commitLayoutEditorHistory(undone, secondMove);
  assert.deepEqual(recommitted.future, []);
  assert.deepEqual(undone.future, [firstMove]);
  assert.notEqual(recommitted.past, undone.past);
  assert.notEqual(recommitted.future, undone.future);
});

test("validation separates blocking inventory errors from wall connectivity warnings", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const valid = validateLayoutEditorState(state);
  assert.equal(valid.valid, true);
  const missingWall = { ...state, walls: state.walls.slice(1) };
  const invalid = validateLayoutEditorState(missingWall);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /50 murs/i);
  const disconnected = { ...state, walls: state.walls.map((wall, index) =>
    index === 0 ? { ...wall, x: 0, y: 31 } : wall
  ) };
  assert.match(validateLayoutEditorState(disconnected).warnings.join(" "), /deconnect/i);
});

test("draft parsing recovers compatible state and rejects corrupt input", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  assert.equal(layoutEditorDraftKey("farm-111"),
    "neuro-evolution-arcade.village-raid-layout-editor.v1.farm-111");
  const restored = parseLayoutEditorDraft(serializeLayoutEditorDraft(state), state);
  assert.deepEqual(restored.state, state);
  assert.equal(restored.warning, null);
  const corrupt = parseLayoutEditorDraft("not-json", state);
  assert.equal(corrupt.state, state);
  assert.match(corrupt.warning, /ignore/i);
});

test("draft parsing preserves incomplete wall work", () => {
  const initial = createLayoutEditorState(farm, defaultCalibration);
  const incomplete = { ...initial, walls: initial.walls.slice(1) };
  const restored = parseLayoutEditorDraft(serializeLayoutEditorDraft(incomplete), initial);
  assert.deepEqual(restored.state, incomplete);
  assert.equal(restored.warning, null);
});

test("draft parsing never replaces the locked building inventory", () => {
  const initial = createLayoutEditorState(farm, defaultCalibration);
  const draft = {
    ...initial,
    requiredBuildingIds: initial.requiredBuildingIds.slice(1),
    buildings: initial.buildings.slice(1),
  };
  const restored = parseLayoutEditorDraft(serializeLayoutEditorDraft(draft), initial);
  assert.equal(restored.state, initial);
  assert.match(restored.warning, /ignore/i);
});

test("draft parsing never replaces the locked trap inventory", () => {
  const initial = createLayoutEditorState(farm, defaultCalibration);
  const draft = {
    ...initial,
    requiredTrapIds: initial.requiredTrapIds.slice(1),
    traps: initial.traps.slice(1),
  };
  const restored = parseLayoutEditorDraft(serializeLayoutEditorDraft(draft), initial);
  assert.equal(restored.state, initial);
  assert.match(restored.warning, /ignore/i);
});

test("export rejects incomplete wall work", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  assert.throws(
    () => serializeLayoutEditorExport({ ...state, walls: state.walls.slice(1) }),
    /50 murs/i,
  );
});

test("approved export is stable and sorts walls and bombs", () => {
  const state = createLayoutEditorState(farm, defaultCalibration);
  const first = serializeLayoutEditorExport(state);
  const second = serializeLayoutEditorExport({
    ...state,
    walls: [...state.walls].reverse(),
    traps: [...state.traps].reverse(),
  });
  assert.equal(first, second);
  const payload = JSON.parse(first);
  assert.equal(payload.schema, "village-raid-layout-editor-v1");
  assert.equal(payload.baseId, "farm-111");
  assert.equal(Object.keys(payload.buildings).length, 22);
  assert.equal(payload.walls.length, 50);
  assert.equal(payload.traps.length, 2);
});
