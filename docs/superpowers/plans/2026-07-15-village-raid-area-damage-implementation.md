# Village Raid Area Damage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wall Breaker and Mortar damage exact 3x3 grid areas while preserving fixed-point projectile misses and verifying all defense-range bounds.

**Architecture:** Keep combat changes inside `src/village-raid-simulation.js`. Add one local grid-area predicate shared by Wall Breaker explosions and Mortar impacts; it compares rounded entity positions with the rounded impact point. Existing range targeting remains center-to-troop Euclidean distance, while new tests lock in the Cannon, Archer Tower, and Mortar endpoints.

**Tech Stack:** Browser ES modules, Node.js built-in `node:test` and `node:assert/strict`; no dependencies.

## Global Constraints

- Preserve static hosting and the dependency-free runtime.
- Use ASCII in source files.
- Keep the scope to Village Raid combat, documentation, and regression tests.
- A Wall Breaker damages only living walls in the 3x3 square centered on its target wall, then dies.
- A Mortar uses the target point captured at firing time and damages all living troops in that fixed 3x3 square at impact.
- Defense range limits are inclusive: Cannon 9, Archer Tower 10, Mortar 4 through 11.
- Do not change defense damage values, cadence, projectile speed, troop targeting, movement, layouts, or trap behavior.
- Run `npm run check` before the final commit.

---

## File Structure

- Modify `src/village-raid-simulation.js`: share a grid-square predicate between Wall Breaker explosions and projectile impact victim selection.
- Modify `test/village-raid-simulation.test.mjs`: prove Wall Breaker 3x3 wall damage, Mortar 3x3 impact/miss behavior, and inclusive range limits.
- Modify `test/village-raid-data.test.mjs`: state the authoritative Cannon, Archer Tower, and Mortar ranges in the snapshot assertion.
- Modify `README.md`: document the two 3x3 mechanics without changing the recorded balance values.

### Task 1: Lock in Wall Breaker and Mortar 3x3 behavior

**Files:**
- Modify: `test/village-raid-simulation.test.mjs`
- Modify: `src/village-raid-simulation.js:310-324, 490-516`

**Interfaces:**
- Consumes: `attackWithTroop(world, troop, target)`, `updateProjectiles(world)`, and `cellOf(point)`.
- Produces: `isInGridSquare(point, center, radius = 1): boolean`, local to the simulation module.

- [ ] **Step 1: Write the failing Wall Breaker area-damage test**

  Add a test after the existing Wall Breaker pathing tests. Build a stripped world with one target building, four walls around `(4, 4)`, and one Wall Breaker already adjacent to the center wall. Then call `stepRaid(world)` and assert only the 3x3 walls were damaged:

  ```js
  test("wall breakers damage every wall in their 3x3 blast square", () => {
    const world = stripWorld(createRaidWorld("farm-111", { barbarian: 0, archer: 0, giant: 0, goblin: 0, wallBreaker: 1 }));
    world.buildings.splice(1);
    Object.assign(world.buildings[0], { x: 8, y: 4, width: 1, height: 1 });
    world.walls.push(
      { id: "center", type: "wall", x: 4, y: 4, hp: 700, maxHp: 700 },
      { id: "diagonal", type: "wall", x: 5, y: 5, hp: 700, maxHp: 700 },
      { id: "edge", type: "wall", x: 3, y: 4, hp: 700, maxHp: 700 },
      { id: "outside", type: "wall", x: 6, y: 4, hp: 700, maxHp: 700 },
    );
    const breaker = deployTroop(world, "wallBreaker", 0);
    Object.assign(breaker, { x: 4, y: 4, targetId: "center", protectiveSearchRevision: world.navigationRevision });

    stepRaid(world);

    assert.equal(breaker.alive, false);
    assert.deepEqual(world.walls.map(({ id, hp }) => [id, hp]), [
      ["center", 300], ["diagonal", 300], ["edge", 300], ["outside", 700],
    ]);
  });
  ```

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `node --test --test-name-pattern="wall breakers damage every wall" test/village-raid-simulation.test.mjs`

  Expected: FAIL because `diagonal` and `edge` remain at 700 HP under the single-target implementation.

- [ ] **Step 3: Write the failing Mortar area/miss test**

  Add a test beside the current projectile test. Fire a Mortar at a stationary target, place a diagonal troop in the saved 3x3 square, move the originally targeted troop outside the square before the projectile lands, and assert the fixed-point impact damages only the diagonal troop:

  ```js
  test("mortar impacts its fixed 3x3 square and misses a target that moves away", () => {
    const composition = { barbarian: 0, archer: 0, giant: 3, goblin: 0, wallBreaker: 0 };
    const world = stripWorld(createRaidWorld("farm-111", composition));
    const mortar = world.buildings.find(({ type }) => type === "mortar");
    world.buildings.splice(0, world.buildings.length, mortar);
    Object.assign(mortar, { x: 8, y: 0, width: 2, height: 2, nextAttackTick: 0 });
    const target = deployTroop(world, "giant", 0);
    Object.assign(target, { x: 3, y: 0 });
    world.tick = 10;
    const diagonal = deployTroop(world, "giant", 0);
    Object.assign(diagonal, { x: 4, y: 1 });

    stepRaid(world);
    const projectile = world.projectiles[0];
    const targetHp = target.hp;
    Object.assign(target, { x: 20, y: 20 });
    while (world.projectiles.includes(projectile)) stepRaid(world);

    assert.equal(target.hp, targetHp);
    assert.ok(diagonal.hp < diagonal.maxHp);
  });
  ```

- [ ] **Step 4: Run the focused test and verify it fails**

  Run: `node --test --test-name-pattern="mortar impacts its fixed 3x3 square" test/village-raid-simulation.test.mjs`

  Expected: FAIL because the current circular radius `1.5` excludes the diagonal cell at `(4, 1)` from a `(3, 0)` impact.

- [ ] **Step 5: Implement the smallest shared grid-square predicate and use it**

  Add the helper near `cellOf`:

  ```js
  function isInGridSquare(point, center, radius = 1) {
    const cell = cellOf(point);
    const impact = cellOf(center);
    return Math.abs(cell.x - impact.x) <= radius && Math.abs(cell.y - impact.y) <= radius;
  }
  ```

  Replace the Wall Breaker special case with:

  ```js
  if (troop.type === "wallBreaker") {
    for (const wall of world.walls) {
      if (wall.hp > 0 && isInGridSquare(wall, target)) {
        damageRaidEntity(world, wall, TROOPS.wallBreaker.wallDamage);
      }
    }
    troop.hp = 0;
    troop.alive = false;
    return;
  }
  ```

  On projectile creation, retain `splashRadius` only for compatibility with existing projectile rendering state. In `updateProjectiles`, branch explicitly for Mortar splash projectiles:

  ```js
  const victims = projectile.splashRadius > 0
    ? world.troops.filter((troop) => troop.alive && isInGridSquare(troop, projectile))
    : world.troops.filter((troop) => troop.alive && pointDistance(troop, projectile) <= 0.45);
  ```

- [ ] **Step 6: Run the two new tests and the complete simulation suite**

  Run: `node --test test/village-raid-simulation.test.mjs`

  Expected: PASS, including the two new tests and all pre-existing simulation tests.

- [ ] **Step 7: Commit the combat behavior and simulation tests**

  ```bash
  git add src/village-raid-simulation.js test/village-raid-simulation.test.mjs
  git commit -m "fix: apply Village Raid 3x3 area damage"
  ```

### Task 2: Verify defense range boundaries and document the grid behavior

**Files:**
- Modify: `test/village-raid-simulation.test.mjs`
- Modify: `test/village-raid-data.test.mjs:118-136`
- Modify: `README.md:158-172`

**Interfaces:**
- Consumes: `BUILDING_DEFINITIONS` and the defense attack selection in `stepRaid(world)`.
- Produces: fixed snapshot-range assertions and user-facing rules for 3x3 Wall Breaker/Mortar damage.

- [ ] **Step 1: Write the failing defense-range endpoint tests**

  Add one table-driven test that creates a fresh one-defense world for each
  distance, so a Mortar splash cannot damage the out-of-range control troop.
  Use a center at `(1, 1)` by setting each defense to `x: 0, y: 0, width: 3,
  height: 3`; run long enough for projectile impact. The endpoint cases are
  `cannon: 9`, `archerTower: 10`, and `mortar: 4` and `11`; rejected cases are
  `cannon: 9.01`, `archerTower: 10.01`, `mortar: 3.99` and `11.01`.

  ```js
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
      const troop = deployTroop(world, "barbarian", 0);
      Object.assign(troop, { x: 1 + distance, y: 1 });
      run(world, 80);
      assert.equal(troop.hp < troop.maxHp, shouldDamage, `${type} at ${distance}`);
    }
  });
  ```

- [ ] **Step 2: Run the focused test and verify its observed result**

  Run: `node --test --test-name-pattern="defenses use their documented inclusive range limits" test/village-raid-simulation.test.mjs`

  Expected: PASS if the current range predicate uses the documented inclusive comparisons; if it fails, update only the comparison responsible for that boundary and rerun the test before changing documentation.

- [ ] **Step 3: Extend the data snapshot assertion**

  Update the existing defense assertions in `test/village-raid-data.test.mjs` to include exact range values:

  ```js
  assert.deepEqual(
    Object.fromEntries(["cannon", "archerTower", "mortar"].map((id) => [id, BUILDING_DEFINITIONS[id].range])),
    { cannon: 9, archerTower: 10, mortar: 11 },
  );
  assert.equal(BUILDING_DEFINITIONS.mortar.minimumRange, 4);
  ```

- [ ] **Step 4: Run the data test to verify the snapshot assertions pass**

  Run: `node --test test/village-raid-data.test.mjs`

  Expected: PASS.

- [ ] **Step 5: Update the README combat description**

  Replace the Mortar sentence with:

  ```md
  The Mortar deals 20 damage per shot, with minimum range 4 and maximum range
  11. It fires at the target position captured at launch, then damages every
  troop in the 3x3 grid square around that impact point; a moving troop can
  leave the square and avoid the shell. A level-1 Wall Breaker likewise explodes
  once for 400 damage to every wall in its own 3x3 grid square.
  ```

- [ ] **Step 6: Run the complete project verification**

  Run: `npm run check`

  Expected: exit code 0, `node --check src/main.js` succeeds, and `node --test` reports no failures.

- [ ] **Step 7: Inspect scope and commit the verification/documentation work**

  Run: `git status --short && git diff --check && git diff -- README.md test/village-raid-data.test.mjs test/village-raid-simulation.test.mjs src/village-raid-simulation.js`

  Confirm only the expected Village Raid files and pre-existing untracked `.playwright-cli/` and `package-lock.json` appear. Then commit only the intended tracked files:

  ```bash
  git add README.md test/village-raid-data.test.mjs test/village-raid-simulation.test.mjs src/village-raid-simulation.js
  git commit -m "test: verify Village Raid defense ranges"
  ```
