# Hill Climb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hill Climb as a playable fourth neuroevolution game with custom two-wheel arcade physics, fixed progressive terrain, coins, fuel, flips, human controls, and champion storage.

**Architecture:** Keep the existing static app architecture and add Hill Climb as another game profile in `src/main.js`. Reuse the shared sequential evaluation loop, UI controls, champion handling, and canvas rendering, while isolating Hill Climb terrain, physics, inputs, actions, and drawing inside `createHillClimbGame()`.

**Tech Stack:** Vanilla HTML, CSS, JavaScript modules, Canvas 2D, Node `node:test`, no runtime dependencies.

---

### Task 1: Add Failing Hill Climb UI And Champion Tests

**Files:**
- Modify: `test/app.test.mjs`

- [ ] **Step 1: Add Hill Climb storage key and static expectations**

Add:

```js
const hillChampionStorageKey = "neuro-evolution-arcade.hill-climb.champion";
```

Extend the primary control id list with:

```js
"gameHill",
"explanationHill",
```

Extend static text and script checks with:

```js
assert.match(html, /Hill Climb/);
assert.match(html, /Comment Hill Climb apprend/);
assert.match(script, /HILL_INPUT_LABELS/);
assert.match(script, /outputLabels: \["gas", "tilt L", "tilt R"\]/);
```

- [ ] **Step 2: Add switching test**

Add this test:

```js
test("game picker switches to Hill Climb with sequential run controls and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Hill Climb");
  assert.equal(element(harness, "gameHill").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "snakeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "presetPanel").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "aliveLabel").textContent, "Specimen");
  assert.equal(element(harness, "speedLabel").textContent, "Run speed");
  assert.equal(element(harness, "distanceLabel").textContent, "Distance");
  assert.equal(element(harness, "speed").value, 8);
  assert.equal(element(harness, "speed").max, 32);
  assert.match(String(element(harness, "alive").textContent), /^[1-9]\/10$/);

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 14), [
    "vx",
    "vy",
    "angle",
    "spin",
    "fuel",
    "front grip",
    "rear grip",
    "slope",
    "slope ahead",
    "terrain",
    "fuel x",
    "fuel y",
    "coin x",
    "coin y",
  ]);
  assert.equal(labels.includes("gas"), true);
  assert.equal(labels.includes("tilt L"), true);
  assert.equal(labels.includes("tilt R"), true);
});
```

- [ ] **Step 3: Add human controls test**

Add this test:

```js
test("Hill Climb human mode uses gas and tilt keys", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  element(harness, "modeHuman").click();
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, "Human");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, true);

  let prevented = false;
  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowUp",
    preventDefault() {
      prevented = true;
    },
  });
  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowLeft",
    preventDefault() {
      prevented = true;
    },
  });
  harness.runFrame(2);

  assert.equal(prevented, true);
  assert.equal(element(harness, "activeGameTitle").textContent, "Hill Climb");
});
```

- [ ] **Step 4: Add champion storage test**

Add this test:

```js
test("Hill Climb champions are saved under the Hill Climb key with compatible genome length", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(hillChampionStorageKey));

  assert.equal(saved.game, "hill");
  assert.equal(saved.genome.length, 129);
  assert.equal(saved.inputs, 14);
  assert.equal(saved.outputs, 3);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /Hill Climb champion loaded/);
});
```

- [ ] **Step 5: Run tests and verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `#gameHill`, `#explanationHill`, `HILL_INPUT_LABELS`, and `createHillClimbGame()` do not exist yet.

### Task 2: Add Hill Climb HTML And UI Wiring

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Add the Hill Climb game tab**

In `index.html`, add a fourth `.game-tab` in `.game-picker`:

```html
<button id="gameHill" class="game-tab" type="button">
  <strong>Hill Climb</strong>
  <span>Collines, carburant, flips</span>
</button>
```

- [ ] **Step 2: Add the Hill Climb explanation panel**

Add:

```html
<section id="explanationHill" class="panel-section explanation is-hidden">
  <h2>Comment Hill Climb apprend</h2>
  <p>
    Chaque specimen pilote une voiture a deux roues sur un niveau vallonne fixe.
    Le reseau observe la vitesse, l'angle, l'adherence, le carburant et les
    prochains bonus. Il choisit gaz, tilt gauche et tilt droite.
  </p>
  <p>
    Le carburant baisse uniquement avec le temps. Les bidons permettent donc de
    prolonger la course, tandis que les pieces et les flips ajoutent des bonus
    secondaires. La distance reste le facteur dominant du fitness.
  </p>
  <p>
    Le terrain devient plus difficile avec la distance: depart doux, longues
    collines, bosses plus rapprochees, rampes naturelles, puis pentes raides et
    receptions plus exigeantes.
  </p>
</section>
```

- [ ] **Step 3: Wire new selectors and visibility**

In `src/main.js`, add:

```js
gameHill: document.querySelector("#gameHill"),
explanationHill: document.querySelector("#explanationHill"),
```

Add `hill: createHillClimbGame()` to `games`.

Update `updateGameUi()` to toggle `ui.gameHill` and `ui.explanationHill`.

Add click listener:

```js
ui.gameHill.addEventListener("click", () => setGame("hill"));
```

- [ ] **Step 4: Make the picker fit four games**

Change `.game-picker` in `src/styles.css` to:

```css
.game-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
```

- [ ] **Step 5: Run static test**

Run:

```bash
npm test -- test/app.test.mjs
```

Expected: tests still fail until the Hill Climb profile exists.

### Task 3: Implement Hill Climb Profile And Physics

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add constants and labels**

Add:

```js
const HILL_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.hill-climb.champion";
const HILL_INPUT_LABELS = [
  "vx",
  "vy",
  "angle",
  "spin",
  "fuel",
  "front grip",
  "rear grip",
  "slope",
  "slope ahead",
  "terrain",
  "fuel x",
  "fuel y",
  "coin x",
  "coin y",
];
```

- [ ] **Step 2: Add `createHillClimbGame()`**

Implement a self-contained profile with:

```js
function createHillClimbGame() {
  const TERRAIN = [
    { x: 0, y: 430 },
    { x: 260, y: 420 },
    { x: 540, y: 395 },
    { x: 820, y: 440 },
    { x: 1120, y: 370 },
    { x: 1480, y: 445 },
    { x: 1840, y: 330 },
    { x: 2220, y: 430 },
    { x: 2600, y: 300 },
    { x: 3000, y: 455 },
    { x: 3380, y: 360 },
    { x: 3800, y: 410 },
    { x: 4200, y: 285 },
    { x: 4650, y: 460 },
    { x: 5100, y: 315 },
    { x: 5600, y: 430 },
    { x: 6100, y: 250 },
    { x: 6600, y: 455 },
    { x: 7200, y: 300 },
    { x: 7900, y: 420 },
  ];
  // terrain sampling, resetHillAgent, input vector, action decoding,
  // substep physics, collection, fitness, controls, and draw helpers live here.
}
```

Use constants that produce stable arcade physics:

```js
const CHASSIS_WIDTH = 64;
const CHASSIS_HEIGHT = 28;
const WHEEL_RADIUS = 14;
const WHEEL_BASE = 56;
const REST_SUSPENSION = 34;
const HILL_GRAVITY = 0.34;
const HILL_SUBSTEPS = 3;
const MAX_FUEL = 1200;
```

- [ ] **Step 3: Return the profile**

Return:

```js
{
  key: "hill",
  title: "Hill Climb",
  objective: "Les agents apprennent a rouler le plus loin possible en gerant l'equilibre, les sauts et le carburant.",
  hint: "IA: un specimen fait une course complete. Humain: haut/W pour gaz, gauche/A et droite/D pour incliner.",
  sequential: true,
  defaultSpeed: 8,
  maxSpeed: 32,
  speedLabel: "Run speed",
  populationLabel: "Specimens",
  leaderFitnessLabel: "Current specimen",
  inputs: 14,
  hidden: DEFAULT_HIDDEN,
  outputs: 3,
  inputLabels: HILL_INPUT_LABELS,
  outputLabels: ["gas", "tilt L", "tilt R"],
  outputLabel: "Drive",
  distanceLabel: "Distance",
  championStorageKey: HILL_CHAMPION_STORAGE_KEY,
  championStorageKeys: [HILL_CHAMPION_STORAGE_KEY],
  defaultChampionStatus: "No Hill Climb champion saved yet.",
  humanNetworkMessage: "Switch to AI training to view the Hill Climb network.",
  createWorld,
  makeAgent,
  makeHumanAgent,
  resetAgents,
  startAgent,
  resetHuman,
  stepWorld,
  updateAgent,
  updateHuman,
  humanPrimaryAction,
  handleHumanKey,
  distanceMetric,
  draw,
}
```

- [ ] **Step 4: Run syntax check**

Run:

```bash
node --check src/main.js
```

Expected: PASS.

### Task 4: Tune Rendering, Controls, And Scoring

**Files:**
- Modify: `src/main.js`
- Modify: `README.md`

- [ ] **Step 1: Ensure human controls are frame-based**

Human keydown should set `agent.controls.gas`, `agent.controls.left`, and
`agent.controls.right`; `updateHuman()` should consume the current control state
without clearing it each frame unless the user presses a different direction.
This matches the existing keydown-only test harness while keeping controls
playable enough for the first version.

- [ ] **Step 2: Draw all required game elements**

`draw()` should render sky, distant hills, terrain, coins, fuel cans, vehicle,
fuel gauge, and score badge. Use original geometric shapes only.

- [ ] **Step 3: Update README**

Add Hill Climb to current games, modules, controls, and notes. State clearly
that it uses original arcade physics and original terrain.

- [ ] **Step 4: Run full check**

Run:

```bash
npm run check
```

Expected: PASS.

### Task 5: Final Review

**Files:**
- Inspect: `git diff`

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
git diff --stat
git diff -- index.html src/main.js src/styles.css test/app.test.mjs README.md
```

Expected: only intentional Hill Climb implementation changes plus the plan file.

- [ ] **Step 2: Do not commit implementation unless requested**

Leave implementation changes unstaged unless the user asks for a commit.
