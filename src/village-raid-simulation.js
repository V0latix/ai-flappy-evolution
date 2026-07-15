import {
  BUILDING_DEFINITIONS,
  GRID,
  LAYOUTS,
  TRAP_DEFINITIONS,
  TROOPS,
  WALL_DEFINITION,
  mapPerimeterPosition,
} from "./village-raid-data.js";

export const RAID_TICKS_PER_SECOND = 20;
export const RAID_MAX_TICKS = 180 * RAID_TICKS_PER_SECOND;
export const RAID_DECISION_TICKS = 10;

const TROOP_IDS = Object.keys(TROOPS);
const SPEEDS = Object.freeze({
  barbarian: 2.4,
  archer: 2.2,
  giant: 1.6,
  goblin: 3,
  wallBreaker: 3,
});
const ATTACK_INTERVALS = Object.freeze({
  barbarian: 20,
  archer: 20,
  giant: 30,
  goblin: 20,
  wallBreaker: 1,
});
const RANGES = Object.freeze({ barbarian: 1.2, archer: TROOPS.archer.range, giant: 1.2, goblin: 1.2, wallBreaker: 1.2 });

export function createRaidWorld(baseIndex = 0, composition = {}, layouts = LAYOUTS) {
  const layout = typeof baseIndex === "number"
    ? layouts[baseIndex]
    : layouts.find(({ id }) => id === baseIndex);
  if (!layout) throw new RangeError(`Unknown raid layout: ${baseIndex}`);

  const inventory = normalizeComposition(composition);
  const buildings = layout.buildings.map((building) => ({
    ...building,
    hp: building.hp,
    maxHp: building.hp,
    nextAttackTick: Math.max(1, Math.round((building.attackInterval ?? 0) * RAID_TICKS_PER_SECOND)),
  }));
  const walls = layout.walls.map((wall) => ({
    ...wall,
    hp: WALL_DEFINITION.hp,
    maxHp: WALL_DEFINITION.hp,
  }));
  const traps = layout.traps.map((trap) => ({
    ...trap,
    ...TRAP_DEFINITIONS.bomb,
    active: true,
  }));

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
}

export function raidSecondsRemaining(world) {
  const ticks = Math.max(0, world.maxTicks - world.tick);
  return Math.ceil(ticks / RAID_TICKS_PER_SECOND);
}

export function getRaidObservation(world) {
  const observation = [
    clamp01(world.phase),
    clamp01((world.maxTicks - world.tick) / world.maxTicks),
    destructionPercent(world) / 100,
  ];
  for (const id of TROOP_IDS) {
    observation.push(ratio(world.inventory[id], world.composition[id]));
  }
  for (const id of TROOP_IDS) {
    const alive = world.troops.filter((troop) => troop.alive && troop.type === id).length;
    observation.push(ratio(alive, world.composition[id]));
  }

  const sectors = Array.from({ length: 8 }, () => ({ hp: 0, maxHp: 0, threat: 0, walls: 0 }));
  for (const building of world.buildings) {
    const sector = sectors[sectorFor(entityCenter(building))];
    sector.hp += Math.max(0, building.hp);
    sector.maxHp += building.maxHp;
    if (building.category === "defense" && building.hp > 0) sector.threat += building.dps;
  }
  for (const wall of world.walls) {
    if (wall.hp > 0) sectors[sectorFor(wall)].walls += 1;
  }
  for (const sector of sectors) {
    observation.push(
      ratio(sector.hp, sector.maxHp),
      clamp01(sector.threat / 50),
      clamp01(sector.walls / 10),
    );
  }
  return observation;
}

export function chooseAvailableTroop(scores, inventory) {
  if (!Array.isArray(scores) || scores.length !== TROOP_IDS.length) {
    throw new TypeError("Troop selection requires exactly five scores");
  }
  return TROOP_IDS
    .map((id, index) => ({ id, index, score: Number.isFinite(scores[index]) ? scores[index] : -Infinity }))
    .filter(({ id }) => (inventory[id] ?? 0) > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.id ?? null;
}

export function deployTroop(world, type, normalizedPosition) {
  if (!TROOPS[type]) throw new RangeError(`Unknown troop type: ${type}`);
  const position = mapPerimeterPosition(normalizedPosition);
  if (isRaidComplete(world) || (world.inventory[type] ?? 0) <= 0) return null;
  if (world.tick - world.lastDecisionTick < world.decisionInterval) return null;

  const offsetIndex = world.nextTroopId - 1;
  const tangentOffset = ((offsetIndex % 5) - 2) * 0.06;
  const adjusted = perimeterOffset(position, tangentOffset);
  const definition = TROOPS[type];
  const troop = {
    id: `troop-${world.nextTroopId++}`,
    type,
    x: adjusted.x,
    y: adjusted.y,
    hp: definition.hp,
    maxHp: definition.hp,
    alive: true,
    targetId: null,
    nextAttackTick: world.tick,
    path: [],
    pathTargetId: null,
    pathRevision: -1,
    protectiveSearchRevision: -1,
  };
  world.inventory[type] -= 1;
  world.lastDecisionTick = world.tick;
  world.troops.push(troop);
  return troop;
}

export function stepRaid(world, action = null) {
  if (isRaidComplete(world)) return world;
  if (action) applyAction(world, action);
  triggerBombs(world);
  updateTroops(world);
  separateTroops(world);
  updateDefenses(world);
  updateProjectiles(world);
  world.tick += 1;
  isRaidComplete(world);
  return world;
}

export function destructionPercent(world) {
  const destroyed = world.buildings.filter((building) => building.hp <= 0).length;
  return (destroyed / world.initialBuildingCount) * 100;
}

export function isRaidComplete(world) {
  if (world.complete) return true;
  if (destructionPercent(world) >= 100) return finish(world, "destroyed");
  if (world.tick >= world.maxTicks) return finish(world, "timeout");
  const hasInventory = TROOP_IDS.some((id) => (world.inventory[id] ?? 0) > 0);
  const hasLivingTroops = world.troops.some((troop) => troop.alive);
  if (!hasInventory && !hasLivingTroops) return finish(world, "exhausted");
  if (!hasActionableForces(world)) return finish(world, "stalled");
  return false;
}

export function hasActionableForces(world) {
  if (!world.buildings.some((building) => building.hp > 0)) return false;
  for (const id of TROOP_IDS) {
    if (id !== "wallBreaker" && (world.inventory[id] ?? 0) > 0) return true;
  }
  if (world.troops.some((troop) => troop.alive && troop.type !== "wallBreaker")) return true;

  const hasLivingWall = world.walls.some((wall) => wall.hp > 0);
  if ((world.inventory.wallBreaker ?? 0) > 0 && hasLivingWall) return true;
  for (const troop of world.troops) {
    if (!troop.alive || troop.type !== "wallBreaker") continue;
    const target = findTroopTarget(world, troop);
    if (target) {
      troop.targetId = target.id;
      return true;
    }
  }
  return false;
}

export function cloneRaidWorld(world) {
  return structuredClone(world);
}

function applyAction(world, action) {
  if (action.deploy === false) return;
  let type = action.type;
  if (!type && action.scores) type = chooseAvailableTroop(action.scores, world.inventory);
  if (type) deployTroop(world, type, action.normalizedPosition ?? action.position ?? 0);
}

function updateTroops(world) {
  for (const troop of world.troops) {
    if (!troop.alive) continue;
    const target = findTroopTarget(world, troop);
    troop.targetId = target?.id ?? null;
    if (!target) continue;
    const range = RANGES[troop.type];
    const distance = distanceToEntity(troop, target);
    if (distance <= range) {
      attackWithTroop(world, troop, target);
      continue;
    }
    moveTroop(world, troop, target);
  }
}

function separateTroops(world) {
  const troops = world.troops.filter((troop) => troop.alive);
  const desiredDistance = 0.3;
  const maximumNudge = 0.04;
  const nudges = new Map(troops.map((troop) => [troop.id, { x: 0, y: 0 }]));
  for (let leftIndex = 0; leftIndex < troops.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < troops.length; rightIndex += 1) {
      const left = troops[leftIndex];
      const right = troops[rightIndex];
      let deltaX = right.x - left.x;
      let deltaY = right.y - left.y;
      let distance = Math.hypot(deltaX, deltaY);
      if (distance >= desiredDistance) continue;
      if (distance === 0) {
        deltaX = left.id.localeCompare(right.id) <= 0 ? 1 : -1;
        deltaY = 0;
        distance = 1;
      }
      const nudge = (desiredDistance - Math.min(distance, desiredDistance)) / 2 || desiredDistance / 2;
      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      nudges.get(left.id).x -= normalX * nudge;
      nudges.get(left.id).y -= normalY * nudge;
      nudges.get(right.id).x += normalX * nudge;
      nudges.get(right.id).y += normalY * nudge;
    }
  }
  const occupied = occupiedCells(world);
  for (const troop of troops) {
    const vector = nudges.get(troop.id);
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude === 0) continue;
    const scale = Math.min(1, maximumNudge / magnitude);
    const candidate = {
      x: clamp(troop.x + vector.x * scale, 0, world.grid.width - 1),
      y: clamp(troop.y + vector.y * scale, 0, world.grid.height - 1),
    };
    const projected = projectOutsideObstacles(troop, candidate, occupied);
    troop.x = projected.x;
    troop.y = projected.y;
  }
}

function findTroopTarget(world, troop) {
  if (troop.type === "wallBreaker") {
    if (troop.protectiveSearchRevision === world.navigationRevision) {
      return world.walls.find((wall) => wall.id === troop.targetId && wall.hp > 0) ?? null;
    }
    troop.protectiveSearchRevision = world.navigationRevision;
    const livingWalls = new Map(
      world.walls.filter((wall) => wall.hp > 0).map((wall) => [keyOf(cellOf(wall)), wall]),
    );
    const buildingTargets = world.buildings
      .filter((building) => building.hp > 0)
      .sort((left, right) =>
        distanceToEntity(troop, left) - distanceToEntity(troop, right) || left.id.localeCompare(right.id)
      );
    for (const buildingTarget of buildingTargets) {
      const route = findRaidPath(world, troop, buildingTarget);
      for (const cell of route) {
        const protectiveWall = livingWalls.get(keyOf(cell));
        if (protectiveWall) return protectiveWall;
      }
    }
    return null;
  }
  const living = world.buildings.filter((building) => building.hp > 0);
  const priority = TROOPS[troop.type].targetPriority;
  const preferred = priority === "defense"
    ? living.filter((building) => building.category === "defense")
    : priority === "resource"
      ? living.filter((building) => building.category === "resource")
      : living;
  return nearest(troop, preferred.length ? preferred : living);
}

function attackWithTroop(world, troop, target) {
  if (world.tick < troop.nextAttackTick) return;
  if (troop.type === "wallBreaker") {
    damageRaidEntity(world, target, TROOPS.wallBreaker.wallDamage);
    troop.hp = 0;
    troop.alive = false;
    return;
  }
  let damage = TROOPS[troop.type].dps * (ATTACK_INTERVALS[troop.type] / RAID_TICKS_PER_SECOND);
  if (troop.type === "goblin" && target.category === "resource") {
    damage *= TROOPS.goblin.resourceDamageMultiplier;
  }
  damageRaidEntity(world, target, damage);
  troop.nextAttackTick = world.tick + ATTACK_INTERVALS[troop.type];
}

function moveTroop(world, troop, target) {
  if (troop.type === "archer" && distanceToEntity(troop, target) <= TROOPS.archer.range) return;
  if (
    troop.pathTargetId !== target.id ||
    troop.pathRevision !== world.navigationRevision
  ) {
    troop.path = findRaidPath(world, troop, target);
    troop.pathTargetId = target.id;
    troop.pathRevision = world.navigationRevision;
  }
  const next = troop.path[0];
  if (!next) {
    return;
  }
  const wall = world.walls.find((candidate) => candidate.hp > 0 && cellOf(candidate).x === next.x && cellOf(candidate).y === next.y);
  if (wall) {
    if (distanceToEntity(troop, wall) <= RANGES[troop.type]) attackWithTroop(world, troop, wall);
    return;
  }
  advanceTroop(troop, next);
  if (Math.abs(troop.x - next.x) < 1e-9 && Math.abs(troop.y - next.y) < 1e-9) {
    troop.path.shift();
  }
}

function advanceTroop(troop, next) {
  const speed = SPEEDS[troop.type] / RAID_TICKS_PER_SECOND;
  const deltaX = next.x - troop.x;
  const deltaY = next.y - troop.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= speed) {
    troop.x = next.x;
    troop.y = next.y;
  } else {
    troop.x += (deltaX / distance) * speed;
    troop.y += (deltaY / distance) * speed;
  }
}

export function findRaidPath(world, origin, target) {
  world.metrics.pathSearches += 1;
  const start = cellOf(origin);
  const goals = targetCells(target, origin.type === "archer" ? TROOPS.archer.range : 1, world.grid);
  const goalKeys = new Set(goals.map(keyOf));
  const blocked = blockedCells(world, target.id);
  const startKey = keyOf(start);
  const previous = new Map([[startKey, null]]);
  const bestCost = new Map([[startKey, 0]]);
  const open = [{ cell: start, cost: 0, estimate: heuristic(start, goals), order: 0 }];
  let order = 1;
  let found = null;
  while (open.length) {
    open.sort((left, right) =>
      left.cost + left.estimate - (right.cost + right.estimate) ||
      left.estimate - right.estimate ||
      left.cell.y - right.cell.y ||
      left.cell.x - right.cell.x ||
      left.order - right.order
    );
    const currentEntry = open.shift();
    const current = currentEntry.cell;
    if (currentEntry.cost !== bestCost.get(keyOf(current))) continue;
    if (goalKeys.has(keyOf(current))) {
      found = current;
      break;
    }
    for (const next of neighbors(current, world.grid)) {
      const key = keyOf(next);
      if (blocked.has(key)) continue;
      const wall = world.walls.find((candidate) => candidate.hp > 0 && keyOf(cellOf(candidate)) === key);
      const nextCost = currentEntry.cost + (wall ? 20 : 1);
      if (nextCost >= (bestCost.get(key) ?? Infinity)) continue;
      bestCost.set(key, nextCost);
      previous.set(key, current);
      open.push({ cell: next, cost: nextCost, estimate: heuristic(next, goals), order: order++ });
    }
  }
  if (!found) return [];
  const path = [];
  while (previous.get(keyOf(found))) {
    path.push(found);
    found = previous.get(keyOf(found));
  }
  path.reverse();
  return path;
}

function blockedCells(world, targetId) {
  const blocked = new Set();
  for (const building of world.buildings) {
    if (building.hp <= 0 || building.id === targetId) continue;
    for (let y = building.y; y < building.y + building.height; y += 1) {
      for (let x = building.x; x < building.x + building.width; x += 1) blocked.add(`${x},${y}`);
    }
  }
  return blocked;
}

function occupiedCells(world) {
  const occupied = blockedCells(world, null);
  for (const wall of world.walls) {
    if (wall.hp > 0) occupied.add(keyOf(cellOf(wall)));
  }
  return occupied;
}

function projectOutsideObstacles(origin, candidate, occupied) {
  if (!occupied.has(keyOf(cellOf(candidate)))) return candidate;
  const projections = [
    { x: origin.x, y: candidate.y },
    { x: candidate.x, y: origin.y },
  ];
  return projections.find((point) => !occupied.has(keyOf(cellOf(point)))) ?? origin;
}

function targetCells(target, radius, grid) {
  const cells = [];
  for (let y = Math.floor(target.y - radius); y <= Math.ceil(target.y + (target.height ?? 1) - 1 + radius); y += 1) {
    for (let x = Math.floor(target.x - radius); x <= Math.ceil(target.x + (target.width ?? 1) - 1 + radius); x += 1) {
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
      const inside = x >= target.x && x < target.x + (target.width ?? 1) && y >= target.y && y < target.y + (target.height ?? 1);
      if (!inside && distanceToEntity({ x, y }, target) <= radius) cells.push({ x, y });
    }
  }
  return cells;
}

function heuristic(cell, goals) {
  return Math.min(...goals.map((goal) => Math.abs(cell.x - goal.x) + Math.abs(cell.y - goal.y)));
}

function updateDefenses(world) {
  const livingTroops = world.troops.filter((troop) => troop.alive);
  for (const defense of world.buildings) {
    if (defense.hp <= 0 || defense.category !== "defense" || world.tick < defense.nextAttackTick) continue;
    const center = entityCenter(defense);
    const candidates = livingTroops.filter((troop) => {
      const distance = pointDistance(center, troop);
      return distance <= defense.range && distance >= (defense.minimumRange ?? 0);
    });
    const target = nearest(center, candidates);
    if (!target) continue;
    const interval = Math.max(1, Math.round(defense.attackInterval * RAID_TICKS_PER_SECOND));
    const damage = defense.dps * defense.attackInterval;
    const distance = pointDistance(center, target);
    const travelTicks = Math.max(1, Math.ceil((distance / defense.projectileSpeed) * RAID_TICKS_PER_SECOND));
    world.projectiles.push({
      id: `projectile-${world.nextProjectileId++}`,
      sourceId: defense.id,
      targetId: target.id,
      createdTick: world.tick,
      impactTick: world.tick + travelTicks,
      startX: center.x,
      startY: center.y,
      targetX: target.x,
      targetY: target.y,
      x: center.x,
      y: center.y,
      damage,
      splashRadius: defense.splashRadius ?? 0,
    });
    defense.nextAttackTick = world.tick + interval;
  }
}

function updateProjectiles(world) {
  const remaining = [];
  for (const projectile of world.projectiles) {
    if (projectile.impactTick > world.tick) {
      const duration = projectile.impactTick - projectile.createdTick;
      const progress = clamp((world.tick - projectile.createdTick) / duration, 0, 1);
      projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * progress;
      projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * progress;
      remaining.push(projectile);
      continue;
    }
    projectile.x = projectile.targetX;
    projectile.y = projectile.targetY;
    const hitRadius = projectile.splashRadius > 0 ? projectile.splashRadius : 0.45;
    const victims = world.troops.filter(
      (troop) => troop.alive && pointDistance(troop, projectile) <= hitRadius,
    );
    for (const victim of victims) damageTroop(victim, projectile.damage);
  }
  world.projectiles = remaining;
}

function triggerBombs(world) {
  for (const trap of world.traps) {
    if (!trap.active) continue;
    const victims = world.troops.filter((troop) => troop.alive && pointDistance(troop, trap) <= trap.triggerRadius);
    if (!victims.length) continue;
    trap.active = false;
    for (const troop of world.troops) {
      if (troop.alive && pointDistance(troop, trap) <= trap.splashRadius) damageTroop(troop, trap.damage);
    }
  }
}

function damageTroop(troop, damage) {
  troop.hp = Math.max(0, troop.hp - damage);
  if (troop.hp === 0) troop.alive = false;
}

function damageRaidEntity(world, entity, damage) {
  const wasAlive = entity.hp > 0;
  entity.hp = Math.max(0, entity.hp - damage);
  if (wasAlive && entity.hp === 0) world.navigationRevision += 1;
}

function normalizeComposition(composition) {
  const normalized = {};
  for (const id of TROOP_IDS) {
    const count = composition[id] ?? 0;
    if (!Number.isInteger(count) || count < 0) throw new TypeError(`Invalid ${id} count`);
    normalized[id] = count;
  }
  return normalized;
}

function nearest(origin, entities) {
  return [...entities].sort((left, right) =>
    distanceToEntity(origin, left) - distanceToEntity(origin, right) || left.id.localeCompare(right.id)
  )[0] ?? null;
}

function distanceToEntity(point, entity) {
  const width = entity.width ?? 1;
  const height = entity.height ?? 1;
  const nearestX = Math.max(entity.x, Math.min(point.x, entity.x + width - 1));
  const nearestY = Math.max(entity.y, Math.min(point.y, entity.y + height - 1));
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

function entityCenter(entity) {
  return { x: entity.x + ((entity.width ?? 1) - 1) / 2, y: entity.y + ((entity.height ?? 1) - 1) / 2 };
}

function sectorFor(point) {
  const angle = Math.atan2(point.y - (GRID.height - 1) / 2, point.x - (GRID.width - 1) / 2);
  return Math.floor((((angle + Math.PI) / (Math.PI * 2)) * 8) % 8);
}

function perimeterOffset(point, amount) {
  if (point.side === "top" || point.side === "bottom") {
    return { ...point, x: Math.max(0, Math.min(GRID.width - 1, point.x + amount)) };
  }
  return { ...point, y: Math.max(0, Math.min(GRID.height - 1, point.y + amount)) };
}

function neighbors(cell, grid) {
  return [[1, 0], [0, 1], [-1, 0], [0, -1]]
    .map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
    .filter(({ x, y }) => x >= 0 && y >= 0 && x < grid.width && y < grid.height);
}

function cellOf(point) {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function keyOf({ x, y }) {
  return `${x},${y}`;
}

function pointDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function ratio(value, maximum) {
  return maximum > 0 ? clamp01(value / maximum) : 0;
}

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finish(world, reason) {
  world.complete = true;
  world.endReason = reason;
  return true;
}
