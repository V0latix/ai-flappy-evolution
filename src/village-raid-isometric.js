const DEFAULT_VIEW = Object.freeze({ marginX: 46, top: 72, bottom: 54 });
const KIND_ORDER = Object.freeze({ wall: 0, trap: 1, building: 2, projectile: 3, troop: 4 });

export function createRaidIsoGeometry(canvasWidth, canvasHeight, grid, options = {}) {
  const view = { ...DEFAULT_VIEW, ...options };
  const cells = grid.width + grid.height;
  const widthLimit = (canvasWidth - view.marginX * 2) / cells;
  const heightLimit = (canvasHeight - view.top - view.bottom) * 2 / cells;
  const halfTileWidth = round(Math.min(widthLimit, heightLimit));
  const halfTileHeight = round(halfTileWidth / 2);
  const diamondWidth = cells * halfTileWidth;
  const diamondHeight = cells * halfTileHeight;
  const left = round((canvasWidth - diamondWidth) / 2);
  const originX = round(left + grid.height * halfTileWidth);
  return Object.freeze({
    canvasWidth, canvasHeight, grid, halfTileWidth, halfTileHeight,
    originX, originY: view.top,
    bounds: Object.freeze({ left, top: view.top, right: round(left + diamondWidth), bottom: round(view.top + diamondHeight) }),
  });
}

export function projectRaidPoint(geometry, point) {
  return {
    x: round(geometry.originX + (point.x - point.y) * geometry.halfTileWidth),
    y: round(geometry.originY + (point.x + point.y) * geometry.halfTileHeight),
  };
}

export function unprojectRaidPoint(geometry, point) {
  const horizontal = (point.x - geometry.originX) / geometry.halfTileWidth;
  const vertical = (point.y - geometry.originY) / geometry.halfTileHeight;
  return {
    x: round((horizontal + vertical) / 2),
    y: round((vertical - horizontal) / 2),
  };
}

export function projectRaidFootprint(geometry, entity) {
  const width = entity.width ?? 0;
  const height = entity.height ?? 0;
  return [
    projectRaidPoint(geometry, { x: entity.x, y: entity.y }),
    projectRaidPoint(geometry, { x: entity.x + width, y: entity.y }),
    projectRaidPoint(geometry, { x: entity.x + width, y: entity.y + height }),
    projectRaidPoint(geometry, { x: entity.x, y: entity.y + height }),
  ];
}

export function pointInConvexPolygon(point, polygon) {
  let direction = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
    if (Math.abs(cross) < 1e-7) continue;
    const next = Math.sign(cross);
    if (direction && next !== direction) return false;
    direction = next;
  }
  return true;
}

export function raidRenderDepth(entity) {
  return (entity.x ?? 0) + (entity.width ?? 0) + (entity.y ?? 0) + (entity.height ?? 0);
}

export function createRaidRenderQueue(world) {
  const entries = [
    ...(world.walls ?? []).filter(({ hp }) => hp > 0).map((entity) => entry("wall", entity, 1, 1)),
    ...(world.traps ?? []).filter(({ active }) => active).map((entity) => entry("trap", entity, 1, 1)),
    ...(world.buildings ?? []).filter(({ hp }) => hp > 0).map((entity) => entry("building", entity)),
    ...(world.projectiles ?? []).map((entity, index) => entry("projectile", { ...entity, id: entity.id ?? `projectile-${index}` }, 0, 0)),
    ...(world.troops ?? []).filter(({ alive, hp }) => alive && hp > 0).map((entity) => entry("troop", entity, 0, 0)),
  ];
  return entries.sort((left, right) => left.depth - right.depth ||
    KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
    (left.entity.y ?? 0) - (right.entity.y ?? 0) ||
    (left.entity.x ?? 0) - (right.entity.x ?? 0) ||
    String(left.entity.id).localeCompare(String(right.entity.id)));
}

export function findFrontmostRaidBuilding(buildings, point, geometry) {
  return [...buildings].filter(({ hp }) => hp > 0)
    .sort((left, right) => raidRenderDepth(right) - raidRenderDepth(left) ||
      (right.y ?? 0) - (left.y ?? 0) ||
      (right.x ?? 0) - (left.x ?? 0) ||
      String(right.id).localeCompare(String(left.id)))
    .find((building) => pointInConvexPolygon(point, projectRaidFootprint(geometry, building))) ?? null;
}

function entry(kind, entity, width = entity.width, height = entity.height) {
  const normalized = { ...entity, width, height };
  return { kind, entity, depth: raidRenderDepth(normalized) };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
