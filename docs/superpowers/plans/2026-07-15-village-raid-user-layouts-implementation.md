# Village Raid User Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three user-completed TH3 layouts the bundled Village Raid defaults and render army camps as 4 by 4 cells.

**Architecture:** The three static maps remain the sole source of gameplay coordinates in `src/village-raid-data.js`. The independently maintained reference fixture is updated first, making the existing full-layout equality assertion fail until the source constants match; `makeLayout` then propagates the 4 by 4 camp definition to rendering, collision, editor placement, and raids.

**Tech Stack:** Dependency-free ES modules, Node built-in `node:test`.

## Global Constraints

- Preserve static hosting and introduce no dependency.
- Every bundled layout contains exactly 22 buildings, 50 walls, and 2 bombs.
- Preserve the editor v2 storage schema and existing local override behavior.
- Treat disconnected wall compartments as valid.
- Do not alter combat stats, troop AI, reference images, or the other game profiles.

---

### Task 1: Calibrate the default TH3 data and camp footprint

**Files:**
- Modify: `src/village-raid-data.js:60-295`
- Modify: `test/fixtures/village-raid-reference-layouts.mjs:4-154`
- Modify: `test/village-raid-data.test.mjs:204-354`

**Interfaces:**
- Consumes: the three validated `village-raid-layout-editor-v2` payloads supplied by the user for `farm-111`, `war-26`, and `defence-104`.
- Produces: `LAYOUTS`, each accepted by `validateLayout(layout)`, with exact coordinate equality to `EXPECTED_REFERENCE_LAYOUTS`.
- Produces: `BUILDING_DEFINITIONS.armyCamp.width === 4` and `.height === 4`; `BUILDING_ROSTER` inherits these values through its existing construction.

- [ ] **Step 1: Write the failing reference assertions and fixture values**

  Replace each fixture map in `test/fixtures/village-raid-reference-layouts.mjs` with the complete user payload for the matching base. Keep only the payload content: building IDs mapped to `[x, y]`, walls as `[x, y]`, and traps as `[x, y]`. Change the footprint test in `test/village-raid-data.test.mjs` so it explicitly requires:

  ```js
  test("army camps use their TH3 4 by 4 footprint", () => {
    assert.deepEqual(
      { width: BUILDING_DEFINITIONS.armyCamp.width, height: BUILDING_DEFINITIONS.armyCamp.height },
      { width: 4, height: 4 },
    );
    assert.ok(
      BUILDING_ROSTER.filter(({ type }) => type === "armyCamp")
        .every(({ width, height }) => width === 4 && height === 4),
    );
  });
  ```

  Replace the three old screenshot-shape tests (`farm-111 walls form three...`, `war-26 preserves...`, and `defence-104 preserves...`) with assertions whose expected cells are in the new fixture. Do not assert a single wall component: each submitted layout is valid even with separate wall groups.

- [ ] **Step 2: Run the focused test suite and verify it is red**

  Run: `node --test test/village-raid-data.test.mjs`

  Expected: FAIL because the bundled source maps still describe the previous screenshot transcription and `armyCamp` is still 5 by 5.

- [ ] **Step 3: Replace the source maps with the supplied coordinates**

  In `src/village-raid-data.js`, change the definition exactly once:

  ```js
  armyCamp: { count: 2, level: 3, category: "army", hp: 290, width: 4, height: 4 },
  ```

  Replace `FARM_111_BUILDING_POSITIONS`, `FARM_111_WALLS`, and `FARM_111_TRAPS` with the complete `farm-111` payload. Replace `WAR_26_BUILDING_POSITIONS`, `WAR_26_WALLS`, and `WAR_26_TRAPS` with the complete `war-26` payload. Replace `DEFENCE_104_BUILDING_POSITIONS`, `DEFENCE_104_WALLS`, and `DEFENCE_104_TRAPS` with the complete `defence-104` payload. Use `point(x, y)` for every position and `deepFreeze([...])` for the wall and trap arrays; retain `makeLayout` unchanged.

  Remove the former geometric helper constants (`rectanglePerimeter`, `line`, `stairStep`, and `uniquePoints`) only if no new layout uses them after replacement. Do not change `validateLayout`.

- [ ] **Step 4: Run the focused data suite and verify it is green**

  Run: `node --test test/village-raid-data.test.mjs`

  Expected: PASS. The equality test proves every submitted coordinate is now the bundled game data, and the generic validation proves no full-footprint overlap, out-of-grid entity, duplicate wall, or roster-count error was introduced.

- [ ] **Step 5: Verify the complete application and commit**

  Run:

  ```bash
  npm run check
  git diff --check
  git status --short
  ```

  Expected: `npm run check` exits 0 with all tests passing; only the three intentional files are staged. Leave unrelated `.playwright-cli/` files untracked.

  Commit:

  ```bash
  git add src/village-raid-data.js test/fixtures/village-raid-reference-layouts.mjs test/village-raid-data.test.mjs
  git commit -m "feat: calibrate default Village Raid layouts"
  ```
