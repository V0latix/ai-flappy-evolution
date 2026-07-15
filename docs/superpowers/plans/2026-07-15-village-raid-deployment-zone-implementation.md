# Village Raid Deployment Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Village Raid agents deploy on every valid grid cell while permanently excluding each building and its one-cell surrounding buffer.

**Architecture:** `createRaidWorld` derives a stable `deploymentCells` array from the original layout. `deployTroop` maps the current normalized-position output to an index in that array, retaining seven network outputs and saved champion compatibility. Presentation copy names this grid-wide selector accurately.

**Tech Stack:** Static ES modules, Node.js built-in `node:test`, Canvas browser app; no runtime dependencies.

## Global Constraints

- Keep static hosting compatibility and add no dependencies.
- Keep Village Raid at 37 inputs, 18 hidden nodes, and 7 outputs.
- Deploy only on initial-layout free cells whose Chebyshev distance from every building footprint is strictly greater than one.
- A building's exclusion zone remains blocked after it is destroyed.
- Preserve combat, movement, fitness, editing, normalized-position validation, and deployment cadence.
- Use ASCII in source files and run `npm run check` before every commit.

---

## File Structure

- `src/village-raid-simulation.js`: immutable valid-cell topology and selection.
- `test/village-raid-simulation.test.mjs`: validity, persistence, interior selection, and no-cell regression coverage.
- `src/main.js`, `index.html`, `README.md`: selector label and user-facing explanation.
- `test/app.test.mjs`: static UI/documentation coverage.

### Task 1: Stable Simulation Deployment Topology

**Files:**

- Modify: `test/village-raid-simulation.test.mjs:113-123`
- Modify: `src/village-raid-simulation.js:1-158`

**Interfaces:**

- Produces: `world.deploymentCells: Array<{ x: number, y: number }>` in row-major order.
- Guarantees: a troop's rounded spawn coordinates identify one entry in `world.deploymentCells`.

- [ ] **Step 1: Write the failing tests**

Replace the perimeter-only test with the following tests in `test/village-raid-simulation.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the focused test to confirm RED**

Run `node --test test/village-raid-simulation.test.mjs`.

Expected: FAIL because `deploymentCells` is undefined and spawning remains perimeter-only.

- [ ] **Step 3: Implement immutable deployment cells**

Remove `mapPerimeterPosition` from the data import. After cloning the layout entities in `createRaidWorld`, add this property to the returned world:

```js
    deploymentCells: createDeploymentCells(GRID, buildings, walls, traps),
```

Add these helpers before `deployTroop`:

```js
function createDeploymentCells(grid, buildings, walls, traps) {
  const occupied = new Set();
  for (const building of buildings) {
    for (let y = building.y; y < building.y + building.height; y += 1) {
      for (let x = building.x; x < building.x + building.width; x += 1) occupied.add(`${x},${y}`);
    }
  }
  for (const entity of [...walls, ...traps]) occupied.add(`${entity.x},${entity.y}`);
  const cells = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cell = { x, y };
      if (occupied.has(keyOf(cell))) continue;
      if (buildings.some((building) => isInDeploymentBuffer(cell, building))) continue;
      cells.push(cell);
    }
  }
  return cells;
}

function isInDeploymentBuffer(cell, building) {
  return cell.x >= building.x - 1 && cell.x <= building.x + building.width &&
    cell.y >= building.y - 1 && cell.y <= building.y + building.height;
}

function deploymentCellFor(world, normalizedPosition) {
  if (!Number.isFinite(normalizedPosition) || normalizedPosition < 0 || normalizedPosition > 1) {
    throw new RangeError("Deployment position must be between 0 and 1");
  }
  if (!world.deploymentCells.length) return null;
  const index = Math.min(world.deploymentCells.length - 1, Math.floor(normalizedPosition * world.deploymentCells.length));
  return world.deploymentCells[index];
}
```

- [ ] **Step 4: Map normalized output to the selected valid cell**

In `deployTroop`, validate first with `const cell = deploymentCellFor(world, normalizedPosition);` and retain every existing completion, inventory, and cadence check. After the cadence check, return `null` when `cell` is null. Replace the perimeter position and `perimeterOffset` with:

```js
  const offsetIndex = world.nextTroopId - 1;
  const offset = ((offsetIndex % 5) - 2) * 0.06;
  const position = {
    x: clamp(cell.x + offset, 0, world.grid.width - 1),
    y: cell.y,
  };
```

Delete `perimeterOffset`. The largest offset is `0.12`, so `Math.round(position.x)` cannot change and the troop remains in its selected valid cell.

- [ ] **Step 5: Run the focused test to confirm GREEN**

Run `node --test test/village-raid-simulation.test.mjs`.

Expected: PASS, including existing pathfinding, combat, and deterministic-replay coverage.

- [ ] **Step 6: Commit simulation behavior**

Run `npm run check`.

Then run `git add src/village-raid-simulation.js test/village-raid-simulation.test.mjs && git commit -m "feat: expand Village Raid deployment zone"`.

### Task 2: Describe the Grid-Wide Selector

**Files:**

- Modify: `test/app.test.mjs:396-400,784-786`
- Modify: `src/main.js:3435`
- Modify: `index.html:205-208`
- Modify: `README.md:114-118`

**Interfaces:**

- Consumes: unchanged `37 -> 18 -> 7` network and normalized position output.
- Produces: `deployment cell` label and French/English explanation of the permanent buffer.

- [ ] **Step 1: Write the failing tests**

In `test/app.test.mjs`, replace `"perimeter"` with `"deployment cell"` in the expected output-label array. In the static-app test that reads `html` and `readme`, add:

```js
  assert.match(html, /case de deploiement[\s\S]*plus d'une case de chaque batiment/i);
  assert.match(readme, /any free grid cell[\s\S]*more than one cell from every building/i);
```

- [ ] **Step 2: Run the focused test to confirm RED**

Run `node --test test/app.test.mjs`.

Expected: FAIL because the label and documentation still say `perimeter`.

- [ ] **Step 3: Update label and copy**

In `src/main.js`, use:

```js
    outputLabels: ["barbarian", "archer", "giant", "goblin", "wall breaker", "deployment cell", "deploy"],
```

Replace the affected `index.html` copy with:

```html
              ensuite la troupe disponible. Les deux dernieres sorties choisissent une case de
              deploiement parmi toutes les cases libres, a plus d'une case de chaque batiment, puis
              decident de deployer ou d'attendre. Une decision ne pose jamais plus d'une troupe. La
              zone interdite autour d'un batiment reste bloquee apres sa destruction.
```

Replace the matching `README.md` paragraph with:

```md
first composes exactly 70 housing spaces, then deploys one troop at a time on
any free grid cell that is more than one cell from every building. The
building exclusion zone remains blocked after destruction. The 37 -> 18 -> 7
network observes phase, time, destruction, five inventory ratios, five
living-troop ratios, and three channels for each of eight spatial sectors. Its
outputs score the five troop types, select a deployment cell, and open or
close the deployment gate.
```

- [ ] **Step 4: Run the focused test to confirm GREEN**

Run `node --test test/app.test.mjs`.

Expected: PASS, including Village Raid profile and champion-compatibility tests.

- [ ] **Step 5: Run full verification and inspect scope**

Run `npm run check && git diff --check && git status --short`.

Expected: all checks pass, no whitespace errors, and only the four Task 2 files are unstaged.

- [ ] **Step 6: Commit presentation behavior**

Run `git add src/main.js index.html README.md test/app.test.mjs && git commit -m "docs: explain Village Raid deployment cells"`.
