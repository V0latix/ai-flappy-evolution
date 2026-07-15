import assert from "node:assert/strict";
import { test } from "node:test";
import { LAYOUTS } from "../src/village-raid-data.js";
import {
  applyLayoutEditorWallStroke,
  createEmptyLayoutEditorState,
  placeLayoutEditorEntity,
} from "../src/village-raid-layout-editor.js";
import {
  RAID_LAYOUT_OVERRIDE_STORAGE_KEY,
  clearRaidLayoutOverrides,
  resolveRaidLayouts,
  saveRaidLayoutOverride,
} from "../src/village-raid-layout-overrides.js";

function storageStub() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function completedState(layout) {
  let state = createEmptyLayoutEditorState(layout);
  for (const building of layout.buildings) {
    state = placeLayoutEditorEntity(state, { kind: "building", id: building.id }, building).state;
  }
  for (const trap of layout.traps) {
    state = placeLayoutEditorEntity(state, { kind: "trap", id: trap.id }, trap).state;
  }
  return applyLayoutEditorWallStroke(state, "paint", layout.walls).state;
}

test("saving a valid base changes only that derived raid layout", () => {
  const storage = storageStub();
  const farm = LAYOUTS.find(({ id }) => id === "farm-111");
  assert.deepEqual(saveRaidLayoutOverride(storage, completedState(farm), LAYOUTS), { ok: true, error: null });
  const resolved = resolveRaidLayouts(storage, LAYOUTS);
  assert.notEqual(resolved[0], farm);
  assert.deepEqual(resolved[0].walls, farm.walls);
  assert.equal(resolved[1], LAYOUTS[1]);
  assert.ok(storage.getItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY));
});

test("malformed storage falls back and restore clears only applied layouts", () => {
  const storage = storageStub();
  storage.setItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY, "not-json");
  assert.deepEqual(resolveRaidLayouts(storage, LAYOUTS), LAYOUTS);
  assert.deepEqual(clearRaidLayoutOverrides(storage), { ok: true, error: null });
  assert.equal(storage.getItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY), null);
});
