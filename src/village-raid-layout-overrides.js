import {
  LAYOUT_EDITOR_SCHEMA,
  createEmptyLayoutEditorState,
  validateLayoutEditorState,
} from "./village-raid-layout-editor.js";

export const RAID_LAYOUT_OVERRIDE_STORAGE_KEY =
  "neuro-evolution-arcade.village-raid-layout-overrides.v1";
const STORAGE_SCHEMA = "village-raid-layout-overrides-v1";

export function readRaidLayoutOverrides(storage, layouts) {
  try {
    const serialized = storage.getItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY);
    if (!serialized) return new Map();
    const payload = JSON.parse(serialized);
    if (!isRecord(payload) || payload.schema !== STORAGE_SCHEMA || !Array.isArray(payload.overrides)) {
      return new Map();
    }

    const canonicalLayouts = new Map(layouts.map((layout) => [layout.id, layout]));
    const overrides = new Map();
    for (const override of payload.overrides) {
      const canonical = canonicalLayouts.get(override?.baseId);
      const restored = restoreLayoutOverride(override, canonical);
      if (restored) overrides.set(restored.baseId, restored);
    }
    return overrides;
  } catch {
    return new Map();
  }
}

export function saveRaidLayoutOverride(storage, state, layouts) {
  const validation = validateLayoutEditorState(state);
  if (!validation.valid || !layouts.some(({ id }) => id === state.baseId)) {
    return { ok: false, error: "Village invalide - impossible de l'appliquer." };
  }
  const overrides = readRaidLayoutOverrides(storage, layouts);
  const canonical = layouts.find(({ id }) => id === state.baseId);
  overrides.set(state.baseId, restoreLayoutOverride(exportLayout(state), canonical));
  try {
    storage.setItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY, JSON.stringify({
      schema: STORAGE_SCHEMA,
      overrides: [...overrides.values()].map(exportLayout),
    }));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Le village ne peut pas etre enregistre localement." };
  }
}

export function clearRaidLayoutOverrides(storage) {
  try {
    storage.removeItem(RAID_LAYOUT_OVERRIDE_STORAGE_KEY);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Les villages appliques ne peuvent pas etre effaces." };
  }
}

export function resolveRaidLayouts(storage, layouts) {
  const overrides = readRaidLayoutOverrides(storage, layouts);
  return layouts.map((layout) => {
    const override = overrides.get(layout.id);
    return override ? { ...layout, ...override } : layout;
  });
}

function exportLayout(state) {
  const sortById = (left, right) => left.id.localeCompare(right.id);
  const sortCells = (left, right) => left.y - right.y || left.x - right.x;
  return {
    schema: LAYOUT_EDITOR_SCHEMA,
    baseId: state.baseId,
    buildings: [...state.buildings].sort(sortById).map(({ id, x, y }) => ({ id, x, y })),
    walls: [...state.walls].sort(sortCells).map(({ x, y }) => ({ x, y })),
    traps: [...state.traps].sort(sortById).map(({ id, x, y }) => ({ id, x, y })),
  };
}

function restoreLayoutOverride(override, canonical) {
  if (!isRecord(override) || override.schema !== LAYOUT_EDITOR_SCHEMA || !canonical ||
    !Array.isArray(override.buildings) || !Array.isArray(override.walls) ||
    !Array.isArray(override.traps)) {
    return null;
  }
  const initial = createEmptyLayoutEditorState(canonical);
  const buildings = restoreStableEntities(override.buildings, initial.buildings);
  const traps = restoreStableEntities(override.traps, initial.traps);
  const walls = restoreWalls(override.walls, canonical.walls);
  if (!buildings || !traps || !walls) return null;

  const candidate = { ...initial, buildings, walls, traps };
  if (!validateLayoutEditorState(candidate).valid) return null;
  return { schema: LAYOUT_EDITOR_SCHEMA, baseId: candidate.baseId, buildings, walls, traps };
}

function restoreStableEntities(serializedEntities, canonicalEntities) {
  if (serializedEntities.length !== canonicalEntities.length) return null;
  const coordinatesById = new Map();
  for (const entity of serializedEntities) {
    if (!isRecord(entity) || typeof entity.id !== "string" ||
      !Number.isInteger(entity.x) || !Number.isInteger(entity.y) ||
      coordinatesById.has(entity.id)) {
      return null;
    }
    coordinatesById.set(entity.id, entity);
  }
  if (canonicalEntities.some(({ id }) => !coordinatesById.has(id))) return null;
  return canonicalEntities.map((entity) => {
    const { x, y } = coordinatesById.get(entity.id);
    return { ...entity, x, y };
  });
}

function restoreWalls(serializedWalls, canonicalWalls) {
  if (serializedWalls.length > 50) return null;
  const walls = [];
  for (const [index, wall] of serializedWalls.entries()) {
    if (!isRecord(wall) || !Number.isInteger(wall.x) || !Number.isInteger(wall.y)) {
      return null;
    }
    walls.push({
      id: `wall-${index + 1}`,
      type: "wall",
      level: 3,
      x: wall.x,
      y: wall.y,
    });
  }
  if (sameCells(walls, canonicalWalls)) return canonicalWalls.map((wall) => ({ ...wall }));
  return walls.sort((left, right) => left.y - right.y || left.x - right.x)
    .map((wall, index) => ({ ...wall, id: `wall-${index + 1}` }));
}

function sameCells(left, right) {
  if (left.length !== right.length) return false;
  const rightCells = new Set(right.map(({ x, y }) => `${x},${y}`));
  return left.every(({ x, y }) => rightCells.delete(`${x},${y}`)) && rightCells.size === 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
