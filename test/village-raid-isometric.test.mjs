import test from "node:test";
import assert from "node:assert/strict";
import {
  createRaidIsoGeometry,
  createRaidRenderQueue,
  findFrontmostRaidBuilding,
  pointInConvexPolygon,
  projectRaidFootprint,
  projectRaidPoint,
  unprojectRaidPoint,
} from "../src/village-raid-isometric.js";

const GRID = Object.freeze({ width: 48, height: 32 });

test("isometric geometry fits the complete 48x32 diamond inside 960x560", () => {
  const geometry = createRaidIsoGeometry(960, 560, GRID);
  assert.equal(geometry.halfTileWidth, 10.85);
  assert.equal(geometry.halfTileHeight, 5.425);
  assert.deepEqual(projectRaidPoint(geometry, { x: 0, y: 0 }), { x: 393.2, y: 72 });
  assert.deepEqual(projectRaidPoint(geometry, { x: 48, y: 0 }), { x: 914, y: 332.4 });
  assert.deepEqual(projectRaidPoint(geometry, { x: 48, y: 32 }), { x: 566.8, y: 506 });
  assert.deepEqual(projectRaidPoint(geometry, { x: 0, y: 32 }), { x: 46, y: 245.6 });
});

test("isometric points round-trip through the fixed camera", () => {
  const geometry = createRaidIsoGeometry(960, 560, GRID);
  const world = { x: 24.25, y: 13.75 };
  const restored = unprojectRaidPoint(geometry, projectRaidPoint(geometry, world));
  assert.ok(Math.abs(restored.x - world.x) < 0.001);
  assert.ok(Math.abs(restored.y - world.y) < 0.001);
});

test("projected footprints use all four world-footprint corners", () => {
  const geometry = createRaidIsoGeometry(960, 560, GRID);
  const entity = { x: 20, y: 12, width: 3, height: 3 };
  assert.deepEqual(projectRaidFootprint(geometry, entity), [
    projectRaidPoint(geometry, { x: 20, y: 12 }),
    projectRaidPoint(geometry, { x: 23, y: 12 }),
    projectRaidPoint(geometry, { x: 23, y: 15 }),
    projectRaidPoint(geometry, { x: 20, y: 15 }),
  ]);
});

test("polygon hit testing includes edges and rejects nearby ground", () => {
  const polygon = [{ x: 50, y: 10 }, { x: 90, y: 30 }, { x: 50, y: 50 }, { x: 10, y: 30 }];
  assert.equal(pointInConvexPolygon({ x: 50, y: 30 }, polygon), true);
  assert.equal(pointInConvexPolygon({ x: 50, y: 10 }, polygon), true);
  assert.equal(pointInConvexPolygon({ x: 91, y: 30 }, polygon), false);
});

test("mixed entities sort deterministically from back to front", () => {
  const queue = createRaidRenderQueue({
    walls: [{ id: "wall-1", x: 4, y: 3, hp: 100 }],
    traps: [{ id: "bomb-1", x: 7, y: 5, active: true }],
    buildings: [{ id: "townHall-1", x: 8, y: 8, width: 4, height: 4, hp: 100 }],
    projectiles: [{ id: "projectile-1", x: 16, y: 10 }],
    troops: [{ id: "troop-1", x: 15, y: 12, alive: true, hp: 20 }],
  });
  assert.deepEqual(queue.map(({ kind, entity }) => `${kind}:${entity.id}`), [
    "wall:wall-1", "trap:bomb-1", "building:townHall-1",
    "projectile:projectile-1", "troop:troop-1",
  ]);
});

test("frontmost living building wins an overlapping projected hit", () => {
  const geometry = createRaidIsoGeometry(960, 560, GRID);
  const buildings = [
    { id: "back", x: 20, y: 12, width: 4, height: 4, hp: 100 },
    { id: "front", x: 21, y: 13, width: 3, height: 3, hp: 100 },
    { id: "destroyed", x: 21, y: 13, width: 3, height: 3, hp: 0 },
  ];
  const point = projectRaidPoint(geometry, { x: 22.5, y: 14.5 });
  assert.equal(findFrontmostRaidBuilding(buildings, point, geometry)?.id, "front");
});
