import test from "node:test";
import assert from "node:assert/strict";

import { LAYOUTS } from "../src/village-raid-data.js";

import {
  RAID_MAX_TICKS,
  RAID_TICKS_PER_SECOND,
  chooseAvailableTroop,
  createRaidWorld,
  deployTroop,
  destructionPercent,
  findRaidPath,
  getRaidObservation,
  isRaidComplete,
  raidSecondsRemaining,
  stepRaid,
} from "../src/village-raid-simulation.js";

const BARBARIANS = { barbarian: 70, archer: 0, giant: 0, goblin: 0, wallBreaker: 0 };
const MIXED = { barbarian: 10, archer: 10, giant: 6, goblin: 10, wallBreaker: 5 };

function stripWorld(world, { buildings = true, walls = false, traps = false } = {}) {
  if (!buildings) world.buildings.length = 0;
  if (!walls) world.walls.length = 0;
  if (!traps) world.traps.length = 0;
  world.projectiles.length = 0;
  return world;
}

function run(world, ticks, action) {
  for (let index = 0; index < ticks && !isRaidComplete(world); index += 1) {
    stepRaid(world, typeof action === "function" ? action(index, world) : action);
  }
  return world;
}

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

test("creates an isolated world and a normalized 37-value observation", () => {
  const first = createRaidWorld("farm-111", MIXED);
  const second = createRaidWorld(0, MIXED);
  assert.deepEqual(second.metrics, { pathSearches: 0 });
  first.buildings[0].hp = 1;
  assert.notEqual(second.buildings[0].hp, 1);

  const observation = getRaidObservation(second);
  assert.equal(observation.length, 37);
  for (const value of observation) assert.ok(value >= 0 && value <= 1, value);
  assert.deepEqual(observation.slice(0, 3), [1, 1, 0]);
  assert.throws(() => createRaidWorld("missing", MIXED), /layout/i);
});

test("world uses a supplied derived layout without mutating the canonical data", () => {
  const canonical = LAYOUTS[0];
  const movedX = canonical.buildings[0].x + 1;
  const derivedLayouts = [
    {
      ...canonical,
      buildings: canonical.buildings.map((building, index) => (
        index === 0 ? { ...building, x: movedX } : building
      )),
    },
    ...LAYOUTS.slice(1),
  ];

  const world = createRaidWorld(0, MIXED, derivedLayouts);

  assert.equal(world.buildings[0].x, movedX);
  assert.equal(LAYOUTS[0].buildings[0].x, canonical.buildings[0].x);
});

test("A* chooses the deterministic minimum-cost route around an expensive wall", () => {
  const world = stripWorld(createRaidWorld("farm-111", MIXED));
  const target = world.buildings[0];
  world.buildings.splice(1);
  Object.assign(target, { x: 4, y: 2, width: 1, height: 1 });
  world.walls.push({ id: "costly-wall", type: "wall", x: 2, y: 2, hp: 700, maxHp: 700 });

  const expected = [
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ];
  assert.deepEqual(findRaidPath(world, { x: 0, y: 2 }, target), expected);
  assert.deepEqual(findRaidPath(world, { x: 0, y: 2 }, target), expected);
  assert.ok(expected.every(({ x, y }) => x !== 2 || y !== 2));
});

test("chooses the highest-scoring available troop with stable fallback", () => {
  const scores = [0.2, 0.9, 0.8, 0.1, 0.7];
  assert.equal(chooseAvailableTroop(scores, MIXED), "archer");
  assert.equal(chooseAvailableTroop(scores, { ...MIXED, archer: 0 }), "giant");
  assert.equal(chooseAvailableTroop([1, 1, 1, 1, 1], MIXED), "barbarian");
  assert.equal(chooseAvailableTroop(scores, {}), null);
});

test("deployment topology includes only free cells beyond every building buffer", () => {
  const world = createRaidWorld("farm-111", BARBARIANS);
  assert.ok(world.deploymentCells.length > 0);
  for (const cell of world.deploymentCells) {
    assert.equal(world.walls.some((wall) => wall.x === cell.x && wall.y === cell.y), false);
    assert.equal(world.traps.some((trap) => trap.x === cell.x && trap.y === cell.y), false);
    assert.equal(world.buildings.some((building) =>
      cell.x >= building.x - 1 && cell.x <= building.x + building.width &&
      cell.y >= building.y - 1 && cell.y <= building.y + building.height
    ), false);
  }
});

test("deployment selects interior valid cells and keeps the decision cadence", () => {
  const world = createRaidWorld("farm-111", BARBARIANS);
  const index = world.deploymentCells.findIndex(({ x, y }) => x > 0 && x < 47 && y > 0 && y < 31);
  const expected = world.deploymentCells[index];
  const troop = deployTroop(world, "barbarian", index / world.deploymentCells.length);
  assert.ok(index >= 0);
  assert.deepEqual({ x: Math.round(troop.x), y: Math.round(troop.y) }, expected);
  assert.equal(world.inventory.barbarian, 69);
  assert.equal(deployTroop(world, "barbarian", 0.5), null);
  run(world, 10);
  assert.ok(deployTroop(world, "barbarian", 0.5));
  assert.throws(() => deployTroop(world, "barbarian", 1.1), /between 0 and 1/i);
});

test("destroyed buildings retain their deployment exclusion zone", () => {
  const world = createRaidWorld("farm-111", BARBARIANS);
  const building = world.buildings.find(({ x, y }) => x > 0 && y > 0);
  const excluded = { x: building.x - 1, y: building.y - 1 };
  assert.equal(world.deploymentCells.some((cell) => cell.x === excluded.x && cell.y === excluded.y), false);
  building.hp = 0;
  assert.equal(world.deploymentCells.some((cell) => cell.x === excluded.x && cell.y === excluded.y), false);
});

test("an empty deployment topology does not spend a troop", () => {
  const world = createRaidWorld("farm-111", BARBARIANS);
  world.deploymentCells = [];
  assert.equal(deployTroop(world, "barbarian", 0), null);
  assert.equal(world.inventory.barbarian, 70);
});

test("overlapping allied troops separate gently without leaving the grid", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
  world.tick = 0;
  const first = deployTroop(world, "barbarian", 0);
  world.tick = 10;
  const second = deployTroop(world, "barbarian", 0);
  Object.assign(first, { x: 10, y: 10 });
  Object.assign(second, { x: 10, y: 10 });

  stepRaid(world);

  assert.ok(Math.hypot(first.x - second.x, first.y - second.y) > 0);
  for (const troop of [first, second]) {
    assert.ok(troop.x >= 0 && troop.x <= 47);
    assert.ok(troop.y >= 0 && troop.y <= 31);
  }
});

test("crowd separation caps each total nudge and never enters a live obstacle cell", () => {
  const world = stripWorld(createRaidWorld("farm-111", MIXED));
  const target = world.buildings[0];
  world.buildings.splice(1);
  Object.assign(target, { x: 11, y: 11, width: 1, height: 2 });
  world.walls.push({ id: "crowd-wall", type: "wall", x: 9, y: 10, hp: 700, maxHp: 700 });

  const troops = [];
  for (let index = 0; index < 6; index += 1) {
    world.tick = index * 10;
    const troop = deployTroop(world, "archer", 0);
    Object.assign(troop, index < 3 ? { x: 9.51, y: 10 } : { x: 10.49, y: 12 });
    troops.push(troop);
  }
  const starts = troops.map(({ x, y }) => ({ x, y }));

  stepRaid(world);

  for (let index = 0; index < troops.length; index += 1) {
    const troop = troops[index];
    const moved = Math.hypot(troop.x - starts[index].x, troop.y - starts[index].y);
    assert.ok(moved <= 0.0400001, `${troop.id} moved ${moved}`);
    assert.notEqual(`${Math.round(troop.x)},${Math.round(troop.y)}`, "9,10");
    assert.notEqual(`${Math.round(troop.x)},${Math.round(troop.y)}`, "11,11");
    assert.notEqual(`${Math.round(troop.x)},${Math.round(troop.y)}`, "11,12");
  }
});

test("troops select their documented targets deterministically", () => {
  const cases = [
    ["barbarian", "builderHut-1"],
    ["archer", "builderHut-1"],
    ["giant", "cannon-1"],
    ["goblin", "goldMine-1"],
  ];
  for (const [type, expected] of cases) {
    const composition = { ...MIXED, [type]: Math.max(1, MIXED[type]) };
    const world = stripWorld(createRaidWorld("farm-111", composition));
    const wanted = world.buildings.find((building) => building.id === expected);
    wanted.x = 2;
    wanted.y = 2;
    for (const building of world.buildings) {
      if (building !== wanted) {
        building.x = 35 + (building.id.length % 5);
        building.y = 20 + (building.id.length % 4);
      }
    }
    const troop = deployTroop(world, type, 0);
    stepRaid(world);
    assert.equal(troop.targetId, expected, type);
  }
});

test("melee pathfinding does not cross a wall and wall breakers destroy blocking walls", () => {
  const world = stripWorld(createRaidWorld("farm-111", { ...MIXED, wallBreaker: 1 }), {
    walls: true,
  });
  world.buildings.splice(1);
  const target = world.buildings[0];
  target.x = 8;
  target.y = 1;
  target.width = 2;
  target.height = 2;
  world.walls.splice(0);
  for (let y = 0; y < 32; y += 1) {
    world.walls.push({ id: `barrier-${y}`, type: "wall", x: 4, y, hp: 700, maxHp: 700 });
  }
  const barbarian = deployTroop(world, "barbarian", 0);
  run(world, 40);
  assert.ok(barbarian.x < 4, `barbarian crossed wall at ${barbarian.x}`);
  assert.ok(world.walls.some((wall) => wall.hp < wall.maxHp), "blocked melee must attack a wall");

  world.tick = 50;
  const breaker = deployTroop(world, "wallBreaker", 0);
  run(world, 80);
  assert.equal(breaker.alive, false);
  assert.ok(world.walls.some((wall) => wall.hp < wall.maxHp));
});

test("wall breakers choose the protective wall on the best target route, not the nearest decoration", () => {
  const world = stripWorld(createRaidWorld("farm-111", { ...MIXED, wallBreaker: 1 }));
  const target = world.buildings[0];
  world.buildings.splice(1);
  Object.assign(target, { x: 8, y: 0, width: 2, height: 2 });
  world.walls.push({
    id: "decorative-wall",
    type: "wall",
    x: 1,
    y: 3,
    hp: 700,
    maxHp: 700,
  });
  for (let y = 0; y < 32; y += 1) {
    world.walls.push({
      id: `useful-${y}`,
      type: "wall",
      x: 5,
      y,
      hp: 700,
      maxHp: 700,
    });
  }

  const breaker = deployTroop(world, "wallBreaker", 0);
  stepRaid(world);
  assert.equal(breaker.targetId, "useful-0");
  run(world, 60);
  assert.ok(world.walls.find(({ id }) => id === "useful-0").hp < 700);
  assert.equal(world.walls[0].hp, 700);
});

test("wall breakers skip an open nearby building to seek a protected target", () => {
  const world = stripWorld(createRaidWorld("farm-111", { ...MIXED, wallBreaker: 1 }));
  const [openTarget, protectedTarget] = world.buildings;
  world.buildings.splice(2);
  Object.assign(openTarget, { x: 2, y: 3, width: 1, height: 1 });
  Object.assign(protectedTarget, { x: 8, y: 0, width: 2, height: 2 });
  for (let y = 0; y < 32; y += 1) {
    world.walls.push({
      id: `protected-${y}`,
      type: "wall",
      x: 5,
      y,
      hp: 700,
      maxHp: 700,
    });
  }

  const breaker = deployTroop(world, "wallBreaker", 0);
  stepRaid(world);

  assert.equal(breaker.targetId, "protected-0");
});

test("wall breakers reuse a living wall target instead of repeating protective-path searches", () => {
  const composition = { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 5 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  const target = world.buildings[0];
  world.buildings.splice(1);
  Object.assign(target, { x: 20, y: 0, width: 2, height: 2 });
  for (let y = 0; y < 32; y += 1) {
    world.walls.push({
      id: `far-wall-${y}`,
      type: "wall",
      x: 15,
      y,
      hp: 700,
      maxHp: 700,
    });
  }
  for (let index = 0; index < 5; index += 1) {
    world.tick = index * 10;
    deployTroop(world, "wallBreaker", 0);
  }

  run(world, 60);

  assert.ok(world.metrics.pathSearches > 0);
  assert.ok(world.metrics.pathSearches <= 10, `${world.metrics.pathSearches} A* searches`);
});

test("a wall breaker recalculates only after its cached wall is destroyed", () => {
  const composition = { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 1 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  world.buildings.splice(1);
  Object.assign(world.buildings[0], { x: 15, y: 0, width: 2, height: 2 });
  for (const x of [5, 10]) {
    for (let y = 0; y < 32; y += 1) {
      world.walls.push({ id: `barrier-${x}-${y}`, type: "wall", x, y, hp: 700, maxHp: 700 });
    }
  }
  const breaker = deployTroop(world, "wallBreaker", 0);
  stepRaid(world);
  assert.equal(breaker.targetId, "barrier-5-0");
  const searchesBeforeDestruction = world.metrics.pathSearches;

  world.walls.find(({ id }) => id === "barrier-5-0").hp = 0;
  world.navigationRevision += 1;
  stepRaid(world);

  assert.equal(breaker.targetId, "barrier-10-0");
  assert.ok(world.metrics.pathSearches > searchesBeforeDestruction);
});

test("wall breakers cache the absence of a protected target until navigation changes", () => {
  const composition = { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 1 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  world.buildings.splice(1);
  Object.assign(world.buildings[0], { x: 8, y: 0, width: 2, height: 2 });
  world.walls.push({ id: "decorative", type: "wall", x: 1, y: 5, hp: 700, maxHp: 700 });
  deployTroop(world, "wallBreaker", 0);

  run(world, 30);

  assert.equal(world.metrics.pathSearches, 1);
});

test("an unchanged empty movement path is cached instead of searched every tick", () => {
  const composition = { barbarian: 0, archer: 0, giant: 1, goblin: 0, wallBreaker: 0 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  const target = world.buildings.find(({ type }) => type === "cannon");
  const blockers = world.buildings.filter(({ category }) => category !== "defense").slice(0, 2);
  world.buildings.splice(0, world.buildings.length, target, ...blockers);
  Object.assign(target, { x: 5, y: 5, width: 1, height: 1 });
  Object.assign(blockers[0], { x: 1, y: 0, width: 1, height: 1 });
  Object.assign(blockers[1], { x: 0, y: 1, width: 1, height: 1 });
  deployTroop(world, "giant", 0);

  run(world, 20);

  assert.equal(world.metrics.pathSearches, 1);
});

test("a positive movement path is recalculated when another destroyed wall opens a shorter route", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
  world.buildings.splice(1);
  Object.assign(world.buildings[0], { x: 5, y: 0, width: 1, height: 1 });
  world.walls.push({ id: "shortcut-wall", type: "wall", x: 2, y: 0, hp: 700, maxHp: 700 });
  const barbarian = deployTroop(world, "barbarian", 0);
  stepRaid(world);
  assert.ok(barbarian.path.some(({ y }) => y > 0));
  const searchesBeforeRevision = world.metrics.pathSearches;

  world.walls[0].hp = 0;
  world.navigationRevision += 1;
  stepRaid(world);

  assert.ok(world.metrics.pathSearches > searchesBeforeRevision);
  assert.ok(barbarian.path.every(({ y }) => y === 0));
});

test("a living cached protective wall is reevaluated after an unrelated navigation revision", () => {
  const world = stripWorld(createRaidWorld("farm-111", { ...MIXED, wallBreaker: 1 }));
  world.buildings.splice(1);
  Object.assign(world.buildings[0], { x: 8, y: 0, width: 2, height: 2 });
  world.walls.push({ id: "unrelated-wall", type: "wall", x: 1, y: 4, hp: 700, maxHp: 700 });
  for (let y = 0; y < 32; y += 1) {
    world.walls.push({ id: `cached-${y}`, type: "wall", x: 5, y, hp: 700, maxHp: 700 });
  }
  const breaker = deployTroop(world, "wallBreaker", 0);
  stepRaid(world);
  assert.equal(breaker.targetId, "cached-0");
  const searchesBeforeRevision = world.metrics.pathSearches;

  world.walls[0].hp = 0;
  world.navigationRevision += 1;
  stepRaid(world);

  assert.equal(breaker.targetId, "cached-0");
  assert.ok(world.metrics.pathSearches > searchesBeforeRevision);
});

test("wall breakers damage every wall in their 3x3 blast square", () => {
  const composition = { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 1 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  world.buildings.splice(1);
  Object.assign(world.buildings[0], { x: 8, y: 4, width: 1, height: 1 });
  world.walls.push(
    { id: "center", type: "wall", x: 4, y: 4, hp: 700, maxHp: 700 },
    { id: "diagonal", type: "wall", x: 5, y: 5, hp: 700, maxHp: 700 },
    { id: "edge", type: "wall", x: 3, y: 4, hp: 700, maxHp: 700 },
    { id: "outside", type: "wall", x: 6, y: 4, hp: 700, maxHp: 700 },
  );
  const breaker = deployTroop(world, "wallBreaker", 0);
  Object.assign(breaker, {
    x: 4,
    y: 4,
    targetId: "center",
    protectiveSearchRevision: world.navigationRevision,
  });

  stepRaid(world);

  assert.equal(breaker.alive, false);
  assert.deepEqual(world.walls.map(({ id, hp }) => [id, hp]), [
    ["center", 300], ["diagonal", 300], ["edge", 300], ["outside", 700],
  ]);
});

test("archers attack across walls without walking through them", () => {
  const world = stripWorld(createRaidWorld("farm-111", MIXED), { walls: true });
  world.buildings.splice(1);
  const target = world.buildings[0];
  Object.assign(target, { x: 3, y: 1, width: 2, height: 2 });
  world.walls.splice(0, world.walls.length, {
    id: "wall-test", type: "wall", x: 2, y: 1, hp: 700, maxHp: 700,
  });
  const archer = deployTroop(world, "archer", 0);
  const start = { x: archer.x, y: archer.y };
  run(world, 25);
  assert.ok(target.hp < target.maxHp);
  assert.ok(archer.x < 2);
  assert.deepEqual(start, { x: 0, y: 0 });
});

test("single-target defenses respect range and cadence", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
  const cannon = world.buildings.find((building) => building.type === "cannon");
  world.buildings.splice(0, world.buildings.length, cannon);
  Object.assign(cannon, { x: 4, y: 1, width: 2, height: 2 });
  const troop = deployTroop(world, "barbarian", 0);
  run(world, 14);
  assert.equal(troop.hp, troop.maxHp);
  run(world, 10);
  assert.ok(troop.hp < troop.maxHp);
});

test("defenses use their documented inclusive range limits", () => {
  const cases = [
    ["cannon", 9, true], ["cannon", 9.01, false],
    ["archerTower", 10, true], ["archerTower", 10.01, false],
    ["mortar", 4, true], ["mortar", 3.99, false],
    ["mortar", 11, true], ["mortar", 11.01, false],
  ];
  for (const [type, distance, shouldDamage] of cases) {
    const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
    const defense = world.buildings.find((building) => building.type === type);
    world.buildings.splice(0, world.buildings.length, defense);
    Object.assign(defense, { x: 0, y: 0, width: 3, height: 3, nextAttackTick: 0 });
    const troop = {
      id: "range-target",
      type: "wallBreaker",
      x: 1 + distance,
      y: 1,
      hp: 54,
      maxHp: 54,
      alive: true,
      targetId: null,
      protectiveSearchRevision: -1,
    };
    world.troops.push(troop);

    run(world, 80);

    assert.equal(troop.hp < troop.maxHp, shouldDamage, `${type} at ${distance}`);
  }
});

test("mortar honors minimum range and applies splash on projectile impact", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
  const mortar = world.buildings.find((building) => building.type === "mortar");
  world.buildings.splice(0, world.buildings.length, mortar);
  Object.assign(mortar, { x: 8, y: 0, width: 2, height: 2, attackInterval: 0.2 });
  mortar.nextAttackTick = 0;
  const near = deployTroop(world, "barbarian", 0);
  near.x = 9;
  near.y = 0;
  world.tick = 10;
  const far = deployTroop(world, "barbarian", 0);
  far.x = 3;
  far.y = 0;
  world.tick = 20;
  const neighbor = deployTroop(world, "barbarian", 0);
  neighbor.x = 3.4;
  neighbor.y = 0;
  run(world, 30);
  assert.equal(near.hp, near.maxHp, "minimum-range troop must not be targeted");
  assert.ok(far.hp < far.maxHp);
  assert.ok(neighbor.hp < neighbor.maxHp, "splash must damage nearby troop");
});

test("mortar damage includes the full 3x3 impact square", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS));
  const mortar = world.buildings.find((building) => building.type === "mortar");
  world.buildings.splice(0, world.buildings.length, mortar);
  mortar.nextAttackTick = Number.MAX_SAFE_INTEGER;
  const movedTarget = {
    id: "moved", type: "wallBreaker", x: 20, y: 20, hp: 20, maxHp: 20, alive: true,
  };
  const diagonal = {
    id: "diagonal", type: "wallBreaker", x: 4.49, y: 1.49, hp: 20, maxHp: 20, alive: true,
  };
  world.troops.push(movedTarget, diagonal);
  world.projectiles.push({
    id: "mortar-impact",
    impactTick: 0,
    createdTick: 0,
    targetX: 3,
    targetY: 0,
    x: 3,
    y: 0,
    damage: 20,
    splashRadius: 1.5,
  });

  stepRaid(world);

  assert.equal(movedTarget.hp, movedTarget.maxHp);
  assert.equal(diagonal.hp, 0, "the diagonal cell belongs to the 3x3 impact square");
});

test("projectiles travel from the defense to a fixed impact point instead of homing", () => {
  const composition = { barbarian: 0, archer: 0, giant: 2, goblin: 0, wallBreaker: 0 };
  const world = stripWorld(createRaidWorld("farm-111", composition));
  const mortar = world.buildings.find((building) => building.type === "mortar");
  world.buildings.splice(0, world.buildings.length, mortar);
  Object.assign(mortar, { x: 8, y: 0, width: 2, height: 2, nextAttackTick: 0 });
  const target = deployTroop(world, "giant", 0);
  Object.assign(target, { x: 3, y: 0 });
  world.tick = 10;
  const neighbor = deployTroop(world, "giant", 0);
  Object.assign(neighbor, { x: 3.4, y: 0 });

  stepRaid(world);

  const projectile = world.projectiles[0];
  assert.ok(projectile);
  assert.deepEqual(
    [projectile.createdTick, projectile.startX, projectile.startY, projectile.x, projectile.y],
    [10, 8.5, 0.5, 8.5, 0.5],
  );
  const firedTarget = world.troops.find(({ id }) => id === projectile.targetId);
  const splashNeighbor = firedTarget === target ? neighbor : target;
  assert.deepEqual([projectile.targetX, projectile.targetY], [firedTarget.x, firedTarget.y]);
  const targetHp = firedTarget.hp;
  const neighborHp = splashNeighbor.hp;
  Object.assign(firedTarget, { x: 30, y: 30 });
  stepRaid(world);
  assert.notDeepEqual([projectile.x, projectile.y], [projectile.startX, projectile.startY]);

  while (world.projectiles.includes(projectile)) stepRaid(world);

  assert.equal(firedTarget.hp, targetHp, "a troop that left the fixed impact point must escape");
  assert.ok(splashNeighbor.hp < neighborHp, "a troop near the original target point takes splash");
  assert.deepEqual([projectile.x, projectile.y], [projectile.targetX, projectile.targetY]);
});

test("bombs trigger once and deal splash damage", () => {
  const world = stripWorld(createRaidWorld("farm-111", BARBARIANS), { traps: true });
  world.buildings.splice(1);
  world.traps.splice(1);
  Object.assign(world.traps[0], { x: 0, y: 0, active: true });
  const first = deployTroop(world, "barbarian", 0);
  world.tick = 10;
  const second = deployTroop(world, "barbarian", 0);
  stepRaid(world);
  assert.equal(world.traps[0].active, false);
  assert.ok(first.hp < first.maxHp && second.hp < second.maxHp);
  const hp = first.hp;
  stepRaid(world);
  assert.equal(first.hp, hp);
});

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

test("raid completion covers destruction, tick limit, and exhausted forces", () => {
  const destroyed = createRaidWorld("farm-111", MIXED);
  for (const building of destroyed.buildings) building.hp = 0;
  assert.equal(isRaidComplete(destroyed), true);
  assert.equal(destroyed.endReason, "destroyed");

  const timeout = createRaidWorld("farm-111", MIXED);
  timeout.tick = 3600;
  assert.equal(isRaidComplete(timeout), true);
  assert.equal(timeout.endReason, "timeout");

  const exhausted = createRaidWorld("farm-111", { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 0 });
  assert.equal(isRaidComplete(exhausted), true);
  assert.equal(exhausted.endReason, "exhausted");
});

test("raid completion reports stalled only when no deployed or inventory force can act", () => {
  const wallBreakerOnly = { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 1 };

  const livingButBlocked = createRaidWorld("farm-111", wallBreakerOnly);
  deployTroop(livingButBlocked, "wallBreaker", 0);
  livingButBlocked.walls.length = 0;
  assert.equal(isRaidComplete(livingButBlocked), true);
  assert.equal(livingButBlocked.endReason, "stalled");

  const inventoryButBlocked = createRaidWorld("farm-111", wallBreakerOnly);
  inventoryButBlocked.walls.length = 0;
  assert.equal(isRaidComplete(inventoryButBlocked), true);
  assert.equal(inventoryButBlocked.endReason, "stalled");

  const ordinaryInventory = createRaidWorld("farm-111", BARBARIANS);
  ordinaryInventory.walls.length = 0;
  assert.equal(isRaidComplete(ordinaryInventory), false);

  const protectedTarget = createRaidWorld("farm-111", wallBreakerOnly);
  protectedTarget.walls.length = 0;
  for (let y = 0; y < 32; y += 1) {
    protectedTarget.walls.push({
      id: `stall-barrier-${y}`, type: "wall", x: 5, y, hp: 700, maxHp: 700,
    });
  }
  deployTroop(protectedTarget, "wallBreaker", 0);
  assert.equal(isRaidComplete(protectedTarget), false);
});

test("the same actions replay to exactly the same world state", () => {
  const actions = new Map([
    [0, { type: "barbarian", normalizedPosition: 0.1 }],
    [10, { type: "archer", normalizedPosition: 0.8 }],
    [20, { type: "giant", normalizedPosition: 0.3 }],
  ]);
  function replay() {
    const world = createRaidWorld("defence-104", MIXED);
    run(world, 160, (tick) => actions.get(tick));
    return JSON.stringify(world);
  }
  assert.equal(replay(), replay());
});
