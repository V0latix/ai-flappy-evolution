import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { GRID as RAID_GRID, LAYOUTS as RAID_LAYOUTS } from "../src/village-raid-data.js";

const root = new URL("../", import.meta.url);
const pipeChampionStorageKey = "neuro-evolution-arcade.pipe-runner.champion";
const legacyChampionStorageKey = "ai-flappy-evolution.champion";
const lunarChampionStorageKey = "neuro-evolution-arcade.lunar.champion";
const hillChampionStorageKey = "neuro-evolution-arcade.hill-climb.champion";
const formulaChampionStorageKey = "neuro-evolution-arcade.formula-circuit.champion";
const raidChampionStorageKey = "neuro-evolution-arcade.village-raid-th3.champion";
const execFileAsync = promisify(execFile);

class ClassList {
  constructor(initial = "") {
    this.classes = new Set(initial.split(/\s+/).filter(Boolean));
  }

  add(name) {
    this.classes.add(name);
  }

  remove(name) {
    this.classes.delete(name);
  }

  contains(name) {
    return this.classes.has(name);
  }

  toggle(name, force) {
    if (force) {
      this.add(name);
      return true;
    }
    this.remove(name);
    return false;
  }

  toString() {
    return [...this.classes].join(" ");
  }
}

class MockElement {
  constructor({ id, tagName, value = "", textContent = "", className = "", min = "", max = "", step = "" }) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = value;
    this.min = min;
    this.max = max;
    this.step = step;
    this.textContent = textContent;
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.classList = new ClassList(className);
    this.context = tagName.toLowerCase() === "canvas" ? createMockContext() : null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    event.target = this;
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: "click" });
  }

  getContext() {
    return this.context;
  }

  getBoundingClientRect() {
    return { left: 100, top: 50, width: 480, height: 270 };
  }
}

class MockDocument {
  constructor(elements) {
    this.elements = elements;
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      throw new Error(`Unsupported selector in test DOM: ${selector}`);
    }
    const element = this.elements.get(selector.slice(1));
    if (!element) throw new Error(`Missing test DOM element: ${selector}`);
    return element;
  }
}

class MockWindow {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
  }
}

function createMockContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: "left",
    beginPath() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect(x, y, width, height) {
      calls.push({ type: "strokeRect", x, y, width, height });
    },
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    clearRect() {},
    setLineDash() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    measureText(text) {
      return { width: text.length * 7 };
    },
    fillText(text, x, y) {
      calls.push({ type: "fillText", text, x, y });
    },
  };
}

function parseElements(html) {
  const elements = new Map();
  const idPattern = /<([a-zA-Z0-9]+)([^>]*\sid="([^"]+)"[^>]*)>/g;
  let match;

  while ((match = idPattern.exec(html))) {
    const tagName = match[1];
    const attrs = match[2] || "";
    const id = match[3];
    const value = attr(attrs, "value");
    const className = attr(attrs, "class");
    const min = attr(attrs, "min");
    const max = attr(attrs, "max");
    const step = attr(attrs, "step");
    const textContent = closingText(html, match.index, tagName);

    elements.set(
      id,
      new MockElement({
        id,
        tagName,
        value,
        className,
        min,
        max,
        step,
        textContent,
      }),
    );
  }

  return elements;
}

function closingText(html, startIndex, tagName) {
  const openEnd = html.indexOf(">", startIndex);
  const closeStart = html.indexOf(`</${tagName}>`, openEnd);
  if (openEnd === -1 || closeStart === -1) return "";
  return stripTags(html.slice(openEnd + 1, closeStart));
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : "";
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function localStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

async function loadHarness() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const elements = parseElements(html);
  const document = new MockDocument(elements);
  const window = new MockWindow();
  const frames = [];
  const storage = localStorageMock();

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = storage;
  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };

  const moduleUrl = new URL(`../src/main.js?test=${Date.now()}-${Math.random()}`, import.meta.url);
  await import(moduleUrl.href);

  return {
    elements,
    storage,
    window,
    runFrame(count = 1) {
      for (let i = 0; i < count; i += 1) {
        const callback = frames.shift();
        assert.equal(typeof callback, "function", "expected a queued animation frame");
        callback();
      }
    },
  };
}

function element(harness, id) {
  return harness.elements.get(id);
}

function runUntil(harness, predicate, maxFrames) {
  for (let frameIndex = 0; frameIndex < maxFrames; frameIndex += 1) {
    if (predicate()) return frameIndex;
    harness.runFrame();
  }
  assert.fail(`condition not reached within ${maxFrames} frames`);
}

test("static app includes every primary control and asset reference", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const favicon = await readFile(new URL("../assets/favicon.svg", import.meta.url), "utf8");

  for (const id of [
    "game",
    "network",
    "aliveLabel",
    "toggleRun",
    "nextGen",
    "reset",
    "modeAi",
    "modeHuman",
    "gamePipe",
    "gameLunar",
    "gameHill",
    "gameFormula",
    "gameRaid",
    "activeGameTitle",
    "gameObjective",
    "gameHint",
    "speedLabel",
    "speed",
    "populationLabel",
    "population",
    "mutation",
    "pipeSettings",
    "pipeGap",
    "pipeSpacing",
    "lunarSettings",
    "lunarGravity",
    "lunarGravityValue",
    "lunarFuel",
    "lunarFuelValue",
    "lunarPadSize",
    "lunarPadSizeValue",
    "lunarThrust",
    "lunarThrustValue",
    "presetPanel",
    "preset",
    "explanationHill",
    "explanationFormula",
    "explanationRaid",
    "raidPanel",
    "raidTroopLegend",
    "raidLegendBarbarian",
    "raidLegendArcher",
    "raidLegendGiant",
    "raidLegendGoblin",
    "raidLegendWallBreaker",
    "raidBase",
    "raidTime",
    "raidComposition",
    "raidInventory",
    "raidAverage",
    "leaderFitnessLabel",
    "saveChampion",
    "loadChampion",
    "clearChampion",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.match(html, /Comment les generations apprennent/);
  assert.match(html, /Comment Lunar Lander apprend/);
  assert.match(html, /Comment Hill Climb apprend/);
  assert.match(html, /Neuro Evolution Arcade/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\.\/assets\/favicon\.svg"/);
  assert.match(html, /Flappy Bird/);
  assert.match(html, /Lunar Lander/);
  assert.match(html, /Hill Climb/);
  assert.match(html, /Formula Circuit/);
  assert.match(html, /Village Raid HDV 3/);
  assert.match(html, /37[^\n]*18[^\n]*7/);
  assert.match(html, /trois bases/);
  assert.match(html, /Les trois chicanes sont volontairement plus etroites/);
  assert.match(readme, /hand-authored arcade approximation/);
  assert.match(readme, /The three chicanes are\s+narrower than fast sections/);
  assert.match(readme, /Village Raid HDV 3/);
  assert.match(readme, /2026-07-11/);
  assert.match(readme, /Barbarian[^\n]*12[^\n]*54[^\n]*1/);
  assert.match(readme, /th3-2026-07-11-v2/);
  assert.match(readme, /th3-reference-layouts-v3/);
  assert.match(readme, /180 s[\s\S]*0 s/);
  assert.match(readme, /calibrated[\s\S]*#111[\s\S]*#26[\s\S]*#104/i);
  assert.match(readme, /hover[\s\S]*click[\s\S]*building/i);
  assert.match(html, /180[^\n]*0/);
  assert.doesNotMatch(readme, /th3-reference-layouts-v2/);
  assert.match(readme, /farm-111[\s\S]*war-26[\s\S]*defence-104/);
  assert.match(readme, /\[farm-111\]\(https:\/\/clashofclans-layouts\.com\/fr\/plans\/th_3\/farm_111\.html\)/);
  assert.match(readme, /\[war-26\]\(https:\/\/clashofclans-layouts\.com\/fr\/plans\/th_3\/war_26\.html\)/);
  assert.match(readme, /\[defence-104\]\(https:\/\/clashofclans-layouts\.com\/fr\/plans\/th_3\/defence_104\.html\)/);
  assert.match(readme, /gameplay topology is calibrated[\s\S]*orthogonal arcade grid/i);
  assert.match(html, /topologies de jeu calibrees[\s\S]*grille arcade[\s\S]*orthogonale/i);
  assert.match(readme, /22\s+buildings,\s+50 walls,\s+and 2 bombs/i);
  assert.match(readme, /procedural Canvas/i);
  assert.match(readme, /troop legend/i);
  assert.match(html, /22 batiments/);
  assert.doesNotMatch(readme, /th3-2026-07-11-v1/);
  assert.doesNotMatch(readme, /th3-layouts-v1/);
  assert.doesNotMatch(readme, /25 buildings/i);
  assert.doesNotMatch(readme, /5 Builder Huts/i);
  assert.doesNotMatch(readme, /open, compartmented,\s+and central Town Hall/);
  assert.match(readme, /37[^\n]*18[^\n]*7/);
  assert.match(readme, /strict mean[^\n]*destruction/i);
  assert.match(readme, /clashofclans\.fandom\.com/);
  assert.match(readme, /clash\.ninja/);
  assert.match(readme, /\| Town Hall \| 1 \| 3 \| 1600 \|/);
  assert.match(readme, /\| Builder Hut \| 2 \| 1 \| 250 \|/);
  assert.match(readme, /\| Cannon \| 2 \| 4 \| 500 \| 17 \| 9 \| 0\.8 s \|/);
  assert.match(readme, /\| Archer Tower \| 1 \| 3 \| 460 \| 19 \| 10 \| 0\.5 s \|/);
  assert.match(readme, /\| Mortar \| 1 \| 1 \| 400 \| 4 \| 11 \| 5 s \|/);
  assert.match(readme, /minimum range 4[^\n]*splash radius 1\.5/i);
  assert.match(readme, /50 walls[\s\S]{0,60}level 3[\s\S]{0,60}400 HP/i);
  assert.match(readme, /2 bombs[\s\S]{0,60}level 2[\s\S]{0,60}24 damage[\s\S]{0,60}1\.5[\s\S]{0,60}3/i);
  for (const page of [
    "Town_Hall", "Cannon/Home_Village", "Archer_Tower/Home_Village", "Mortar/Home_Village",
    "Wall/Home_Village", "Bomb", "Barbarian", "Archer", "Giant", "Goblin", "Wall_Breaker",
  ]) {
    assert.match(readme, new RegExp(`clashofclans\\.fandom\\.com/wiki/${page.replace("/", "\\/")}`));
  }
  assert.doesNotMatch(html, /Collines, carburant, flips/);
  assert.match(favicon, /<svg/);
  assert.match(favicon, /Neuro Evolution Arcade/);
  assert.match(favicon, /#1a56db/);
  assert.doesNotMatch(html, /Vol, timing, tuyaux/);
  assert.doesNotMatch(html, /Fuel, angle, touchdown/);
  assert.doesNotMatch(html, /Snake/);
  assert.doesNotMatch(html, /Pong/);
  assert.doesNotMatch(script, /createSnakeGame|gameSnake|SNAKE_INPUT_LABELS/);
  assert.doesNotMatch(script, /createPongGame|gamePong|PONG_INPUT_LABELS|pongSettings/);
  assert.match(script, /inputs: 6/);
  assert.match(script, /inputs: 8/);
  assert.match(script, /inputs: 14/);
  assert.match(script, /key: "formula"[\s\S]*?inputs: 8/);
  assert.match(script, /LUNAR_INPUT_LABELS/);
  assert.match(script, /HILL_INPUT_LABELS/);
  assert.match(script, /FORMULA_INPUT_LABELS/);
  assert.doesNotMatch(script, /"target vx"/);
  assert.doesNotMatch(script, /"pad align"/);
  assert.match(script, /createLunarGame/);
  assert.match(script, /createHillClimbGame/);
  assert.match(script, /createFormulaCircuitGame/);
  assert.match(script, /createVillageRaidGame/);
  assert.match(script, /from "\.\/village-raid-data\.js"/);
  assert.match(script, /from "\.\/village-raid-simulation\.js"/);
  assert.match(script, /from "\.\/village-raid-rendering\.js"/);
  assert.match(script, /drawRaidBuilding\(targetCtx, building, offsetX, tile\)/);
  assert.match(script, /drawRaidTroop\(targetCtx, troop, offsetX, tile\)/);
  assert.match(script, /drawRaidTroopKey\(targetCtx,/);
  assert.doesNotMatch(script, /barbarian: "#f2c14e", archer: "#e887b7"/);
  assert.match(script, /wall\.hp \/ wall\.maxHp/);
  assert.match(script, /outputLabels: \["thrust", "left", "right"\]/);
  assert.match(script, /outputLabels: \["gas", "brake"\]/);
  assert.match(script, /outputLabels: \["gas", "brake", "left", "right"\]/);
  assert.match(script, /const FORMULA_WORLD_WIDTH = 3600/);
  assert.match(script, /const FORMULA_WORLD_HEIGHT = 2450/);
  assert.match(script, /const MAX_FORMULA_LAPS = 3/);
  assert.match(script, /createFormulaTrainingSession/);
  assert.match(script, /resetFormulaTrainingSession/);
  assert.match(script, /recordFirstTripleLapGenome/);
  assert.match(script, /consumeSpeedPhaseTransition/);
  assert.match(script, /calculateFormulaProgressFitness/);
  assert.match(script, /FORMULA_FITNESS_PHASE_DISTANCE/);
  assert.match(script, /FORMULA_FITNESS_PHASE_SPEED/);
  assert.match(script, /const SENSOR_RANGE = Math\.hypot\(FORMULA_WORLD_WIDTH, FORMULA_WORLD_HEIGHT\)/);
  assert.match(script, /const SENSOR_INPUT_DISTANCE = 190/);
  assert.match(script, /const FORMULA_SENSOR_OFFSETS = \[/);
  assert.match(script, /function sensorHitDistance/);
  assert.match(script, /return 1 - Math\.exp\(-sensorHitDistance\(agent, offset\) \/ SENSOR_INPUT_DISTANCE\)/);
  assert.match(script, /const onTrackSpeed = Math\.max\(0, agent\.vx \* Math\.cos\(nextTrack\.angle\) \+ agent\.vy \* Math\.sin\(nextTrack\.angle\)\)/);
  assert.doesNotMatch(script, /FORMULA_SPEED_FITNESS/);
  assert.match(script, /if \(agent\.laps >= MAX_FORMULA_LAPS\) \{\s+if \(isAi\) recordFirstTripleLapGenome\(formulaTrainingSession, agent\.genome\);\s+agent\.alive = false/);
  assert.match(script, /function drawFormulaSensors/);
  assert.match(script, /#2ee7ff/);
  assert.match(script, /const focusAgent = ordered\.find\(\(agent\) => agent\.alive\) \|\| ordered\[0\]/);
  assert.match(script, /import \{ createFormulaTrack \} from "\.\/formula-track\.js"/);
  assert.match(script, /const FORMULA_TRACK = createFormulaTrack\(\{/);
  assert.match(script, /const TRACK = FORMULA_TRACK\.centerline/);
  assert.match(script, /const SEGMENTS = FORMULA_TRACK\.segments/);
  assert.match(script, /const CHECKPOINTS = FORMULA_TRACK\.checkpoints/);
  assert.match(script, /closest\.width \/ 2/);
  assert.match(script, /const CAR_LENGTH = 22/);
  assert.match(script, /const CAR_WIDTH = 11/);
  assert.match(script, /targetWorld\.cameraX/);
  assert.match(script, /targetWorld\.cameraY/);
  assert.match(script, /function drawFormulaMiniMap/);
  assert.match(script, /function formulaMiniMapGeometry/);
  assert.match(script, /const MINI_MAP_CHICANE_LABELS = \{/);
  assert.match(script, /"Variante della Roggia": "Roggia"/);
  assert.match(script, /arrowTipX/);
  assert.match(script, /handleCanvasClick/);
  assert.match(script, /gameCanvas\.addEventListener\("click", handleCanvasClick\)/);
  assert.match(script, /function crossedCheckpointLine/);
  assert.match(script, /checkpoint\.geometry\.startX/);
  assert.match(script, /checkpoint\.geometry\.endX/);
  assert.doesNotMatch(script, /cameraY \* 0\.28/);
  assert.match(script, /const startY = -\(cameraY % 56\) - 56/);
  assert.match(script, /const CHECKPOINT_PROGRESS_FITNESS = 16/);
  assert.match(script, /function forwardDistanceBetween/);
  assert.match(script, /function checkpointSegmentProgress/);
  assert.match(script, /agent\.lastCheckpointFrame = 0/);
  assert.match(script, /agent\.lastCheckpointSplit = 0/);
  assert.match(script, /agent\.bestCheckpointSplit = 0/);
  assert.match(script, /agent\.bestCheckpointProgress = 0/);
  assert.match(script, /agent\.bestCheckpointProgress = 0;\n    agent\.lastProgressFrame = agent\.age;/);
  assert.match(script, /const segmentProgress = checkpointSegmentProgress\(agent, nextTrack\.progress\)/);
  assert.match(script, /const segmentProgressGain = segmentProgress - agent\.bestCheckpointProgress/);
  assert.match(script, /calculateFormulaProgressFitness\(\{[\s\S]*?phase: formulaTrainingSession\.phase/);
  assert.match(script, /recordFirstTripleLapGenome\(formulaTrainingSession, agent\.genome\)/);
  assert.match(script, /consumeSpeedPhaseTransition\(formulaTrainingSession/);
  assert.match(script, /resetAll\(\{ resetFormulaSession: false \}\)/);
  assert.match(script, /if \(resetFormulaSession && activeGameKey === "formula"\) \{\s+formulaTrainingSession = resetFormulaTrainingSession\(\);/);
  assert.match(script, /updateFormula\(agent, chooseAction\(agent\), true\)/);
  assert.match(script, /updateFormula\(agent, controlsForHuman\(agent\), false\)/);
  assert.match(script, /Phase parcours/);
  assert.match(script, /Phase vitesse/);
  assert.doesNotMatch(script, /checkpointSpeedBonus|lapSpeedBonus|TARGET_LAP_TIME|LAP_SPEED_MULTIPLIER|CHECKPOINT_SPEED_MULTIPLIER/);
  assert.match(script, /bestScoreMetric\(nextAgents\)/);
  assert.match(script, /lowerBestScoreIsBetter: true/);
  assert.match(script, /formatFormulaTime/);
  assert.match(script, /agent\.bestLapTime = agent\.bestLapTime > 0 \? Math\.min\(agent\.bestLapTime, agent\.lastLapTime\) : agent\.lastLapTime/);
  assert.match(script, /agent\.alive = false;\n      agent\.fitness -= 900;/);
  assert.doesNotMatch(script, /radius: index === START_INDEX/);
  assert.doesNotMatch(script, /agent\.fitness \+= progressDelta \* 3\.4/);
  assert.doesNotMatch(script, /bestNextCheckpointDistance/);
  assert.doesNotMatch(script, /checkpointDistance/);
  assert.doesNotMatch(script, /agent\.offroadFrames > 115/);
  assert.match(script, /const CHASSIS_WIDTH = 125/);
  assert.match(script, /const CHASSIS_HEIGHT = 40/);
  assert.match(script, /const WHEEL_RADIUS = 17/);
  assert.match(script, /const WHEEL_BASE = CHASSIS_WIDTH - WHEEL_RADIUS \* 2\.4/);
  assert.match(script, /const CODE_BULLET_MOTOR_SPEED = 13 \* Math\.PI/);
  assert.match(script, /const CODE_BULLET_REAR_TORQUE = 700/);
  assert.match(script, /const CODE_BULLET_FRONT_TORQUE = 350/);
  assert.match(script, /const CODE_BULLET_MOTOR_RESPONSE = 30/);
  assert.match(script, /const CODE_BULLET_WHEEL_FRICTION = 1\.5/);
  assert.match(script, /const CODE_BULLET_WHEEL_RESTITUTION = 0\.1/);
  assert.match(script, /const CODE_BULLET_RIM_FRICTION = 0\.99/);
  assert.match(script, /const CODE_BULLET_RIM_RESTITUTION = 0\.2/);
  assert.match(script, /const CODE_BULLET_SUSPENSION_FREQUENCY = 70/);
  assert.match(script, /const CODE_BULLET_SUSPENSION_DAMPING = 25/);
  assert.match(script, /const HILL_MAX_SPIN = 0\.085/);
  assert.match(script, /const HILL_GROUND_TILT = 0\.00026/);
  assert.match(script, /const HILL_AIR_TILT = 0\.0024/);
  assert.match(script, /const HILL_BRAKE_FORCE = 0\.42/);
  assert.match(script, /const HILL_AIR_PEDAL_TORQUE = 0\.0032/);
  assert.match(script, /const WHEEL_BASE_STIFFNESS = 0\.58/);
  assert.match(script, /const CHASSIS_MASS = 5\.8/);
  assert.match(script, /const WHEEL_MASS = 0\.32/);
  assert.match(script, /const SUSPENSION_STIFFNESS = 0\.22/);
  assert.match(script, /const SUSPENSION_DAMPING = 0\.34/);
  assert.match(script, /const SUSPENSION_MAX_FORCE = 3\.2/);
  assert.match(script, /const CHASSIS_ANGLE_FOLLOW = 0\.1/);
  assert.match(script, /const HILL_AIR_ANGLE_FOLLOW = 0\.006/);
  assert.match(script, /const HILL_AIR_ROTATION_DAMPING = 0\.996/);
  assert.match(script, /const CHASSIS_BODY_LIFT = 26/);
  assert.match(script, /const CHASSIS_SCRAPE_LIMIT = 40/);
  assert.match(script, /const CHASSIS_HARD_IMPACT_SPEED = 7\.2/);
  assert.match(script, /const HILL_SUBSTEPS = 4/);
  assert.match(script, /const SUSPENSION_REST_LENGTH = 12/);
  assert.match(script, /const MAX_SUSPENSION_EXTENSION = SUSPENSION_REST_LENGTH \+ WHEEL_RADIUS \* 0\.85/);
  assert.match(script, /const FUEL_SPACING = 900/);
  assert.match(script, /const COIN_X = Array\.from/);
  assert.match(script, /const COIN_LIFTS = \[42, 32, 38\]/);
  assert.match(script, /function makeWheel\(x\)/);
  assert.match(script, /agent\.rearWheel = makeWheel\(START_X - WHEEL_BASE \* 0\.5\)/);
  assert.match(script, /agent\.frontWheel = makeWheel\(START_X \+ WHEEL_BASE \* 0\.5\)/);
  assert.match(script, /function wheelTangentialGravity\(ground\)/);
  assert.match(script, /angularVelocity: 0/);
  assert.match(script, /function applyCodeBulletMotor\(wheel, side, action, dt\)/);
  assert.match(script, /const targetSpeed = -CODE_BULLET_MOTOR_SPEED/);
  assert.match(script, /const maxTorque = side < 0 \? CODE_BULLET_REAR_TORQUE : CODE_BULLET_FRONT_TORQUE/);
  assert.match(script, /const torque = clamp\(speedError \* CODE_BULLET_MOTOR_RESPONSE, -maxTorque, maxTorque\)/);
  assert.match(script, /function integrateWheel\(agent, wheel, side, action, dt\)/);
  assert.match(script, /function enforceWheelBase\(agent\)/);
  assert.match(script, /function solveSuspensionJoint\(agent, wheel, side, dt\)/);
  assert.match(script, /function alignChassisToWheels\(agent, action, dt\)/);
  assert.match(script, /function suspensionWheel\(agent, side\)/);
  assert.match(script, /drawDriver\(targetCtx\)/);
  assert.match(script, /drawRollCage\(targetCtx\)/);
  assert.match(script, /function drawHillDistanceBadge\(targetCtx, currentScore\)/);
  assert.match(script, /targetCtx\.fillText\(`\$\{currentScore\} m`/);
  assert.doesNotMatch(script, /tilt L/);
  assert.doesNotMatch(script, /tilt R/);
  assert.match(script, /const pedalTilt = action\.gas \? -1 : action\.brake \? 1 : 0/);
  assert.match(script, /pedalTilt \* \(grounded \? HILL_GROUND_TILT : HILL_AIR_TILT\)/);
  assert.match(script, /grounded \? CHASSIS_ANGLE_FOLLOW : HILL_AIR_ANGLE_FOLLOW/);
  assert.match(script, /grounded \? 0\.78 : HILL_AIR_ROTATION_DAMPING/);
  assert.doesNotMatch(script, /UNCORRECTED_GAS/);
  assert.doesNotMatch(script, /uncorrectedGasFrames/);
  assert.match(script, /const rear = suspensionWheel\(agent, -1\);/);
  assert.match(script, /drawSuspension\(targetCtx, rear, cameraX\)/);
  assert.match(script, /drawHillDistanceBadge\(targetCtx, currentScore\)/);
  assert.match(script, /targetCtx\.lineWidth = 2/);
  assert.match(script, /applyCodeBulletMotor\(wheel, side, action, dt\)/);
  assert.match(script, /solveSuspensionJoint\(agent, agent\.rearWheel, -1, dt\)/);
  assert.match(script, /solveSuspensionJoint\(agent, agent\.frontWheel, 1, dt\)/);
  assert.doesNotMatch(script, /constrainWheelToChassis/);
  assert.match(script, /deepest > CHASSIS_SCRAPE_LIMIT/);
  assert.doesNotMatch(script, /function applyForce\(agent, point, forceX, forceY/);
  assert.doesNotMatch(script, /function applyWheel\(agent, side, action, contact\)/);
  assert.match(script, /if \(action\.brake && wheel\.contact\)/);
  assert.match(script, /tangentSpeed \*= Math\.max\(0\.2, 1 - HILL_BRAKE_FORCE \* dt\)/);
  assert.doesNotMatch(script, /side < 0 \? 0\.11 : 0\.075/);
  assert.match(script, /\{ x: 3340, y: 342 \}/);
  assert.match(script, /\{ x: 3520, y: 462 \}/);
  assert.match(script, /\{ x: 3720, y: 304 \}/);
  assert.match(script, /\{ x: 3900, y: 456 \}/);
  assert.match(script, /\{ x: 4180, y: 304 \}/);
  assert.match(script, /\{ x: 4380, y: 456 \}/);
  assert.match(script, /\{ x: 4620, y: 286 \}/);
  assert.match(script, /\{ x: 4860, y: 494 \}/);
  assert.match(script, /\{ x: 5720, y: 486 \}/);
  assert.match(script, /\{ x: 5900, y: 300 \}/);
  assert.match(script, /\{ x: 6080, y: 492 \}/);
  assert.match(script, /\{ x: 6260, y: 304 \}/);
  assert.match(script, /\{ x: 6460, y: 482 \}/);
  assert.match(script, /\{ x: 6660, y: 318 \}/);
  assert.match(script, /\{ x: 9120, y: 296 \}/);
  assert.match(script, /\{ x: 9300, y: 482 \}/);
  assert.match(script, /\{ x: 7040, y: 330 \}/);
  assert.match(script, /\{ x: 7440, y: 316 \}/);
  assert.match(script, /\{ x: 12000, y: 390 \}/);
  assert.match(script, /\{ x: 48280, y: 488 \}/);
  assert.match(script, /\{ x: 62000, y: 390 \}/);
  assert.match(script, /const FUEL_X = Array\.from/);
  assert.match(script, /function chassisCollisionPoints\(agent\)/);
  assert.match(script, /handleHumanKeyUp\(event, agent\)/);
  assert.match(script, /agent\.controls\[action\] = true/);
  assert.match(script, /agent\.controls\[action\] = false/);
  assert.match(script, /spaceControlsPrimaryAction: false/);
  assert.doesNotMatch(script, /Space: "gas"/);
  assert.doesNotMatch(script, /if \(!agent\.alive\) resetHillAgent\(agent\)/);
  assert.doesNotMatch(script, /setTimedControl/);
  assert.match(script, /window\.addEventListener\("keyup", handleKeyup\)/);
  assert.match(script, /handleHumanKeyUp\(event, agent\)/);
  assert.match(script, /sequential: true/);
  assert.match(script, /startAgent\(agent, targetWorld\)/);
  assert.match(script, /sequentialScore\(nextAgents\)/);
  assert.match(script, /Math\.max\(0, \.\.\.nextAgents\.map\(\(agent\) => agent\.score\)\)/);
  assert.doesNotMatch(script, /nextAgents\.reduce\(\(total, agent\) => total \+ agent\.score, 0\)/);
  assert.match(script, /agent\.score \+= 1/);
  assert.match(script, /makeTargetSequence/);
  assert.match(script, /makeSequencePad\(\)/);
  assert.doesNotMatch(script, /const guidedRatios/);
  assert.match(script, /advanceLandingTarget\(agent, targetWorld\)/);
  assert.match(script, /targetWorld\.targetIndex = 0/);
  assert.match(script, /targetWorld\.pad = targetWorld\.targetSequence\[targetWorld\.targetIndex\]/);
  assert.match(script, /agent\.y = 48/);
  assert.match(script, /agent\.vx = 0/);
  assert.match(script, /agent\.angle = 0/);
  assert.doesNotMatch(script, /const MAX_ATTEMPTS/);
  assert.doesNotMatch(script, /resetLander\(agent, targetWorld, false\)/);
  assert.doesNotMatch(script, /targetCtx\.setLineDash/);
  assert.match(script, /const EARTH_GRAVITY_ACCEL = 0\.42/);
  assert.match(script, /lunarGravityG\(\) \* EARTH_GRAVITY_ACCEL/);
  assert.match(script, /const SIDE_THRUST_ASSIST = 1\.55/);
  assert.match(script, /const margin = width \/ 2/);
  assert.match(script, /agent\.x = WIDTH \/ 2/);
  assert.match(script, /function padDifficultyMultiplier\(targetWorld\)/);
  assert.match(script, /normalizedOffset/);
  assert.match(script, /const desiredVx = desiredHorizontalVelocity\(agent, targetWorld\)/);
  assert.match(script, /function desiredHorizontalVelocity\(agent, targetWorld\)/);
  assert.match(script, /const previousPadDx = agent\.lastPadDx/);
  assert.match(script, /const horizontalApproach = previousPadDx - padDx/);
  assert.match(script, /agent\.horizontalProgress = Math\.max\(agent\.horizontalProgress, agent\.startPadDx - padDx\)/);
  assert.match(script, /const passiveFallPenalty = agent\.horizontalProgress < targetWorld\.pad\.width \* 0\.2 \? 2600 : 0/);
  assert.match(script, /targetReward \* padDifficulty/);
  assert.match(script, /48000 \+ agent\.score \* 9000/);
  assert.match(script, /agent\.fitness -= 4200 \+ padDx \* 3\.2 \+ speed \* 520 \+ angleAbs \* 900 \+ altitude \* 1\.4/);
  assert.doesNotMatch(script, /const approach = previousDistance - distance/);
  assert.doesNotMatch(script, /targetReward \+= approach \* 0\.12/);
  assert.doesNotMatch(script, /12000 \+ agent\.fuel \* 22 - agent\.age \* 1\.8/);
  assert.match(script, /agent\.vx \* signedPadDx < -0\.08/);
  assert.match(script, /wallPenalty \* 2\.8/);
  assert.doesNotMatch(script, /agent\.pendingThrust = false;\n      agent\.pendingLeft = false;\n      agent\.pendingRight = false;/);
  assert.match(script, /next gap/);
  assert.match(script, /pad dx/);
  assert.match(script, /vision -90/);
  assert.match(script, /vision 90/);
});

test("game picker switches to AI-only Village Raid with its profile and HUD", async () => {
  const harness = await loadHarness();

  element(harness, "gameRaid").click();
  assert.equal(element(harness, "speed").value, 30);
  element(harness, "speed").value = 1;
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Village Raid HDV 3");
  assert.equal(element(harness, "gameRaid").classList.contains("is-active"), true);
  assert.equal(element(harness, "aliveLabel").textContent, "Specimen");
  assert.equal(element(harness, "alive").textContent, "1/24");
  assert.equal(element(harness, "population").value, 24);
  assert.equal(element(harness, "mutation").value, "0.12");
  assert.equal(element(harness, "speed").max, 100);
  assert.equal(element(harness, "raidPanel").hidden, false);
  assert.equal(element(harness, "raidTroopLegend").hidden, false);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "lunarSettings").hidden, true);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "modeHuman").disabled, true);
  assert.equal(element(harness, "raidBase").textContent, "1/3");
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.match(element(harness, "raidComposition").textContent, /Barbares/);
  assert.match(element(harness, "raidInventory").textContent, /Barbares/);
  assert.equal(element(harness, "raidAverage").textContent, "0.00%");
  assert.ok(
    element(harness, "game").getContext().calls.some(
      (call) => call.type === "fillText" && call.text === "Temps 180 s",
    ),
  );

  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Cible : defenses/);
  assert.match(html, /Cible : ressources/);
  assert.match(html, /Cible : murs/);

  const inventoryText = element(harness, "raidInventory").textContent;
  for (const [label, outputId] of [
    ["Barbares", "raidLegendBarbarian"],
    ["Archeres", "raidLegendArcher"],
    ["Geants", "raidLegendGiant"],
    ["Gobelins", "raidLegendGoblin"],
    ["Sapeurs", "raidLegendWallBreaker"],
  ]) {
    const count = inventoryText.match(new RegExp(`${label} (\\d+)`));
    assert.ok(count, label);
    assert.equal(element(harness, outputId).textContent, count[1]);
  }

  const raidOverlayLabels = element(harness, "game").getContext().calls
    .filter((call) => call.type === "fillText" && /^(Destruction|Moyenne)/.test(call.text));
  assert.equal(raidOverlayLabels.length, 2);
  assert.ok(
    Math.abs(raidOverlayLabels[0].y - raidOverlayLabels[1].y) >= 18,
    "raid destruction and average labels need separate readable lines",
  );

  harness.runFrame(20);
  assert.equal(element(harness, "raidTime").textContent, "179 s");
  const raidTimeLabels = element(harness, "game").getContext().calls
    .filter((call) => call.type === "fillText" && call.text.startsWith("Temps "));
  assert.equal(raidTimeLabels.at(-1)?.text, "Temps 179 s");

  const troopKeyLabels = element(harness, "game").getContext().calls
    .filter((call) => call.type === "fillText")
    .map((call) => call.text);
  for (const label of ["B", "A", "G", "Go", "S"]) {
    assert.equal(troopKeyLabels.includes(label), true, `missing troop key label ${label}`);
  }

  const labels = element(harness, "network").getContext().calls
    .filter((call) => call.type === "fillText")
    .map((call) => call.text);
  assert.equal(labels.includes("phase"), true);
  assert.equal(labels.includes("sector 1: hp/threat/walls"), true);
  assert.equal(labels.includes("sector 8: hp/threat/walls"), true);
  assert.equal(labels.includes("sector 1 threat"), false);
  for (const output of ["barbarian", "archer", "giant", "goblin", "wall breaker", "perimeter", "deploy"]) {
    assert.equal(labels.includes(output), true, `missing network output ${output}`);
  }

  element(harness, "modeHuman").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 1);

  element(harness, "gamePipe").click();
  harness.runFrame();
  assert.equal(element(harness, "modeHuman").disabled, false);
  assert.equal(element(harness, "raidPanel").hidden, true);
});

test("Village Raid inspects living buildings on hover and click without permanent labels", async () => {
  const harness = await loadHarness();
  const canvas = element(harness, "game");
  const context = canvas.getContext();
  element(harness, "gameRaid").click();
  element(harness, "toggleRun").click();
  harness.runFrame();

  const townHall = RAID_LAYOUTS[0].buildings.find(({ type }) => type === "townHall");
  const tile = Math.min(960 / RAID_GRID.width, 560 / RAID_GRID.height);
  const offsetX = (960 - RAID_GRID.width * tile) / 2;
  const center = {
    x: offsetX + (townHall.x + townHall.width / 2) * tile,
    y: (townHall.y + townHall.height / 2) * tile,
  };
  const clientPoint = canvasClientPoint(canvas, center);

  context.calls.length = 0;
  canvas.dispatchEvent({ type: "pointermove", ...clientPoint });
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), [
    "Hotel de ville", `Niv. ${townHall.level}`, `HP ${townHall.hp}/${townHall.hp}`,
  ]);

  context.calls.length = 0;
  canvas.dispatchEvent({ type: "pointerleave" });
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), []);

  canvas.dispatchEvent({ type: "click", ...clientPoint, preventDefault() {} });
  const emptyClientPoint = canvasClientPoint(canvas, { x: 4, y: 530 });
  canvas.dispatchEvent({ type: "pointermove", ...emptyClientPoint });
  context.calls.length = 0;
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), [
    "Hotel de ville", `Niv. ${townHall.level}`, `HP ${townHall.hp}/${townHall.hp}`,
  ]);

  canvas.dispatchEvent({ type: "click", ...emptyClientPoint, preventDefault() {} });
  context.calls.length = 0;
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), []);

  canvas.dispatchEvent({ type: "click", ...clientPoint, preventDefault() {} });
  element(harness, "reset").click();
  context.calls.length = 0;
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), [], "reset clears pinned inspection");

  canvas.dispatchEvent({ type: "click", ...clientPoint, preventDefault() {} });
  element(harness, "gamePipe").click();
  element(harness, "gameRaid").click();
  element(harness, "toggleRun").click();
  context.calls.length = 0;
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), [], "game switching clears pinned inspection");

  canvas.dispatchEvent({ type: "click", ...clientPoint, preventDefault() {} });
  element(harness, "speed").value = 100;
  element(harness, "toggleRun").click();
  runUntil(harness, () => element(harness, "raidBase").textContent === "2/3", 50);
  element(harness, "toggleRun").click();
  context.calls.length = 0;
  harness.runFrame();
  assert.deepEqual(raidInspectionLabels(context), [], "base transition clears pinned inspection");
});

function canvasClientPoint(canvas, point) {
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: rect.left + point.x / 960 * rect.width,
    clientY: rect.top + point.y / 560 * rect.height,
  };
}

function raidInspectionLabels(context) {
  return context.calls
    .filter(({ type, text }) => type === "fillText" &&
      (/^(Niv\. |HP )/.test(text) || text === "Hotel de ville"))
    .map(({ text }) => text);
}

function lastRaidTimeLabel(context) {
  return context.calls
    .filter(({ type, text }) => type === "fillText" && text.startsWith("Temps "))
    .at(-1)?.text;
}

test("Village Raid champions carry and enforce the profile, dataset, and layout versions", async () => {
  const harness = await loadHarness();
  element(harness, "gameRaid").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(raidChampionStorageKey));
  assert.equal(saved.game, "raid");
  assert.equal(saved.inputs, 37);
  assert.equal(saved.hidden, 18);
  assert.equal(saved.outputs, 7);
  assert.equal(saved.datasetVersion, "th3-2026-07-11-v2");
  assert.equal(saved.layoutVersion, "th3-reference-layouts-v3");
  assert.equal(saved.genome.length, 817);

  for (const incompatible of [
    { ...saved, game: "pipe" },
    { ...saved, inputs: 36 },
    { ...saved, hidden: 17 },
    { ...saved, outputs: 6 },
    { ...saved, datasetVersion: "obsolete" },
    { ...saved, layoutVersion: "obsolete" },
  ]) {
    harness.storage.setItem(raidChampionStorageKey, JSON.stringify(incompatible));
    element(harness, "loadChampion").click();
    assert.match(element(harness, "championStatus").textContent, /incompatible/);
  }
});

test("Village Raid converts saturated output probabilities into a specialized army", async () => {
  const harness = await loadHarness();
  element(harness, "gameRaid").click();
  harness.runFrame();
  const genome = Array.from({ length: 817 }, () => 0);
  const outputBiasIndices = [702, 721, 740, 759, 778, 797, 816];
  for (const [output, bias] of [20, -20, -20, -20, -20].entries()) {
    genome[outputBiasIndices[output]] = bias;
  }
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome,
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();
  harness.runFrame();

  assert.equal(
    element(harness, "raidComposition").textContent,
    "Barbares 70 · Archeres 0 · Geants 0 · Gobelins 0 · Sapeurs 0",
  );
  assert.equal(element(harness, "raidInventory").textContent, element(harness, "raidComposition").textContent);
});

test("Village Raid evaluates the three bases before advancing to the next specimen", async () => {
  const harness = await loadHarness();
  element(harness, "gameRaid").click();
  harness.runFrame();
  element(harness, "speed").value = 100;
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome: Array.from({ length: 817 }, () => 0),
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();
  harness.runFrame();

  const composition = element(harness, "raidComposition").textContent;
  const firstInventory = element(harness, "raidInventory").textContent;

  runUntil(harness, () => element(harness, "raidBase").textContent === "2/3", 40);
  assert.equal(element(harness, "alive").textContent, "1/24");
  assert.equal(element(harness, "raidBase").textContent, "2/3");
  assert.equal(element(harness, "raidComposition").textContent, composition);
  assert.equal(element(harness, "raidInventory").textContent, firstInventory);
  runUntil(harness, () => element(harness, "raidBase").textContent === "3/3", 40);
  assert.equal(element(harness, "alive").textContent, "1/24");
  assert.equal(element(harness, "raidBase").textContent, "3/3");
  assert.equal(element(harness, "raidComposition").textContent, composition);
  assert.equal(element(harness, "raidInventory").textContent, firstInventory);
  runUntil(harness, () => element(harness, "alive").textContent === "2/24", 40);
  assert.equal(element(harness, "alive").textContent, "2/24");
  assert.equal(element(harness, "raidBase").textContent, "1/3");
  assert.equal(element(harness, "bestScore").textContent, "0.00%");
});

test("Village Raid renders timeout zero before resetting the next base at high speed", async () => {
  const harness = await loadHarness();
  const context = element(harness, "game").getContext();
  element(harness, "gameRaid").click();
  element(harness, "speed").value = 30;
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome: Array.from({ length: 817 }, () => 0),
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();

  context.calls.length = 0;
  runUntil(harness, () => element(harness, "raidTime").textContent === "0 s", 125);
  assert.equal(element(harness, "raidBase").textContent, "1/3");
  assert.equal(
    lastRaidTimeLabel(context),
    "Temps 0 s",
  );

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidBase").textContent, "2/3");
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 180 s");
});

test("Village Raid renders 180 before accelerating its initial base", async () => {
  const harness = await loadHarness();
  const context = element(harness, "game").getContext();
  element(harness, "gameRaid").click();
  assert.equal(element(harness, "speed").value, 30);

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 180 s");

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "179 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 179 s");
});

test("Village Raid renders 180 before accelerating after Reset", async () => {
  const harness = await loadHarness();
  const context = element(harness, "game").getContext();
  element(harness, "gameRaid").click();
  harness.runFrame();

  element(harness, "reset").click();
  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 180 s");

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "179 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 179 s");
});

test("Village Raid renders 180 before accelerating a new generation", async () => {
  const harness = await loadHarness();
  const context = element(harness, "game").getContext();
  element(harness, "gameRaid").click();
  element(harness, "population").value = 1;
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome: Array.from({ length: 817 }, () => 0),
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();

  context.calls.length = 0;
  runUntil(harness, () => element(harness, "generation").textContent === 2, 370);
  assert.equal(element(harness, "raidBase").textContent, "1/3");
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 180 s");

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "179 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 179 s");
});

test("Village Raid renders 180 for exactly one frame between specimens", async () => {
  const harness = await loadHarness();
  const context = element(harness, "game").getContext();
  element(harness, "gameRaid").click();
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome: Array.from({ length: 817 }, () => 0),
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();

  context.calls.length = 0;
  runUntil(harness, () => element(harness, "alive").textContent === "2/24", 370);
  assert.equal(element(harness, "raidBase").textContent, "1/3");
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 180 s");

  context.calls.length = 0;
  harness.runFrame();
  assert.equal(element(harness, "raidTime").textContent, "179 s");
  assert.equal(lastRaidTimeLabel(context), "Temps 179 s");
});

test("Village Raid restores a depleted specialized army at each base transition", async () => {
  const harness = await loadHarness();
  element(harness, "gameRaid").click();
  harness.runFrame();
  element(harness, "speed").value = 1;
  const genome = Array.from({ length: 817 }, () => 0);
  const outputBiasIndices = [702, 721, 740, 759, 778, 797, 816];
  for (const [output, bias] of [10, -10, -10, -10, -10, 0, 10].entries()) {
    genome[outputBiasIndices[output]] = bias;
  }
  harness.storage.setItem(raidChampionStorageKey, JSON.stringify({
    game: "raid",
    genome,
    inputs: 37,
    hidden: 18,
    outputs: 7,
    datasetVersion: "th3-2026-07-11-v2",
    layoutVersion: "th3-reference-layouts-v3",
  }));
  element(harness, "loadChampion").click();
  harness.runFrame(3);

  const fullArmy = "Barbares 70 · Archeres 0 · Geants 0 · Gobelins 0 · Sapeurs 0";
  assert.equal(element(harness, "raidComposition").textContent, fullArmy);
  assert.match(element(harness, "raidInventory").textContent, /^Barbares 69\b/);

  runUntil(harness, () => element(harness, "raidBase").textContent === "2/3", 3601);
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(element(harness, "raidInventory").textContent, fullArmy);
  harness.runFrame(3);
  assert.match(element(harness, "raidInventory").textContent, /^Barbares 69\b/);

  runUntil(harness, () => element(harness, "raidBase").textContent === "3/3", 3601);
  assert.equal(element(harness, "raidTime").textContent, "180 s");
  assert.equal(element(harness, "raidInventory").textContent, fullArmy);
});

test("module boots, draws AI network labels, and reports initial training state", async () => {
  const harness = await loadHarness();

  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, 1);
  assert.equal(element(harness, "alive").textContent, 10);
  assert.equal(element(harness, "score").textContent, 0);
  assert.equal(element(harness, "modeAi").classList.contains("is-active"), true);
  assert.equal(element(harness, "gamePipe").classList.contains("is-active"), true);
  assert.equal(element(harness, "activeGameTitle").textContent, "Flappy Bird");
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "lunarSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("settings-visible"), true);
  assert.equal(element(harness, "lunarSettings").classList.contains("settings-visible"), false);
  assert.equal(element(harness, "nextGen").disabled, false);

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 6), [
    "height",
    "velocity",
    "pipe x",
    "gap top",
    "gap bottom",
    "next gap",
  ]);
  assert.equal(labels.includes("flap"), true);
});

test("game picker switches to Lunar Lander with dedicated sliders and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Lunar Lander Lite");
  assert.equal(element(harness, "gameLunar").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pipeSettings").classList.contains("settings-visible"), false);
  assert.equal(element(harness, "lunarSettings").hidden, false);
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), false);
  assert.equal(element(harness, "lunarSettings").classList.contains("settings-visible"), true);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "aliveLabel").textContent, "Specimen");
  assert.equal(element(harness, "alive").textContent, "1/28");
  assert.equal(element(harness, "speedLabel").textContent, "Training speed");
  assert.equal(element(harness, "population").value, 28);
  assert.equal(element(harness, "mutation").value, "0.16");
  assert.equal(element(harness, "distanceLabel").textContent, "Pad distance");
  assert.equal(element(harness, "leaderFitnessLabel").textContent, "Specimen fitness");
  assert.equal(element(harness, "speed").value, 7);
  assert.equal(element(harness, "speed").max, 28);
  assert.equal(element(harness, "lunarGravityValue").textContent, "0.17g");
  assert.equal(element(harness, "lunarFuelValue").textContent, "120");
  assert.equal(element(harness, "lunarPadSizeValue").textContent, "150");
  assert.equal(element(harness, "lunarThrust").value, "0.190");
  assert.equal(element(harness, "lunarThrust").max, "0.260");
  assert.equal(element(harness, "lunarThrustValue").textContent, "0.190");

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 8), [
    "x",
    "altitude",
    "vx",
    "vy",
    "angle",
    "fuel",
    "pad dx",
    "spin",
  ]);
  assert.equal(labels.includes("thrust"), true);
  assert.equal(labels.includes("left"), true);
  assert.equal(labels.includes("right"), true);
});

test("game picker switches to Hill Climb with sequential run controls and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Hill Climb");
  assert.equal(element(harness, "gameHill").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pipeSettings").classList.contains("settings-visible"), false);
  assert.equal(element(harness, "lunarSettings").hidden, true);
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "lunarSettings").classList.contains("settings-visible"), false);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "aliveLabel").textContent, "Specimen");
  assert.equal(element(harness, "alive").textContent, "1/10");
  assert.equal(element(harness, "speedLabel").textContent, "Run speed");
  assert.equal(element(harness, "population").value, 10);
  assert.equal(element(harness, "mutation").value, "0.10");
  assert.equal(element(harness, "distanceLabel").textContent, "Distance");
  assert.equal(element(harness, "leaderFitnessLabel").textContent, "Current specimen");
  assert.equal(element(harness, "speed").value, 8);
  assert.equal(element(harness, "speed").max, 32);

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
  assert.equal(labels.includes("brake"), true);
  assert.equal(labels.includes("tilt L"), false);
  assert.equal(labels.includes("tilt R"), false);
});

test("game picker switches to Formula Circuit with full-population cars and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gameFormula").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Formula Circuit");
  assert.equal(element(harness, "gameFormula").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "lunarSettings").hidden, true);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "aliveLabel").textContent, "Alive");
  assert.equal(element(harness, "alive").textContent, 10);
  assert.equal(element(harness, "speedLabel").textContent, "Race speed");
  assert.equal(element(harness, "population").value, 10);
  assert.equal(element(harness, "mutation").value, "0.12");
  assert.equal(element(harness, "distanceLabel").textContent, "Checkpoints");
  assert.equal(element(harness, "leaderFitnessLabel").textContent, "Lead car");
  assert.equal(element(harness, "speed").value, 4);
  assert.equal(element(harness, "speed").max, 16);

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 8), [
    "speed",
    "vision -90",
    "vision -60",
    "vision -30",
    "vision 0",
    "vision 30",
    "vision 60",
    "vision 90",
  ]);
  assert.equal(labels.includes("track L"), false);
  assert.equal(labels.includes("track F"), false);
  assert.equal(labels.includes("checkpoint x"), false);
  assert.equal(labels.includes("gas"), true);
  assert.equal(labels.includes("brake"), true);
  assert.equal(labels.includes("left"), true);
  assert.equal(labels.includes("right"), true);
});

test("Formula Circuit HUD starts in the distance fitness phase", async () => {
  const harness = await loadHarness();

  element(harness, "gameFormula").click();
  harness.runFrame();

  const gameLabels = element(harness, "game").getContext().calls
    .filter((call) => call.type === "fillText")
    .map((call) => call.text);
  assert.equal(gameLabels.includes("Phase parcours"), true);
  assert.equal(gameLabels.includes("Phase vitesse"), false);
});

test("training controls evolve generations and difficulty presets update numeric settings", async () => {
  const harness = await loadHarness();
  harness.runFrame();

  element(harness, "nextGen").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 2);

  element(harness, "preset").value = "hard";
  element(harness, "preset").dispatchEvent({ type: "change" });
  harness.runFrame();

  assert.equal(element(harness, "speed").value, 4);
  assert.equal(element(harness, "speedValue").textContent, "4x");
  assert.equal(element(harness, "mutation").value, "0.12");
  assert.equal(element(harness, "pipeGap").value, 120);
  assert.equal(element(harness, "pipeSpacing").value, 215);
  assert.equal(element(harness, "generation").textContent, 1);
});

test("human play mode uses Space, disables AI-only actions, and can return to AI", async () => {
  const harness = await loadHarness();

  element(harness, "modeHuman").click();
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, "Human");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, true);
  assert.equal(element(harness, "saveChampion").disabled, true);

  let prevented = false;
  harness.window.dispatchEvent({
    type: "keydown",
    code: "Space",
    preventDefault() {
      prevented = true;
    },
  });
  harness.runFrame(2);
  assert.equal(prevented, true);
  assert.equal(element(harness, "generation").textContent, "Human");

  element(harness, "modeAi").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, false);
});

test("Lunar human mode uses thrust and rotation controls", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  element(harness, "modeHuman").click();
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, "Human");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, true);

  let prevented = false;
  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowRight",
    preventDefault() {
      prevented = true;
    },
  });
  harness.window.dispatchEvent({
    type: "keydown",
    code: "Space",
    preventDefault() {},
  });
  harness.runFrame(2);

  assert.equal(prevented, true);
  assert.equal(element(harness, "activeGameTitle").textContent, "Lunar Lander Lite");
});

test("Hill Climb human mode uses gas and brake keys", async () => {
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

test("Formula Circuit human mode uses gas, brake, and steering keys", async () => {
  const harness = await loadHarness();

  element(harness, "gameFormula").click();
  element(harness, "modeHuman").click();
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, "Human");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, true);

  let prevented = 0;
  for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
    harness.window.dispatchEvent({
      type: "keydown",
      code,
      preventDefault() {
        prevented += 1;
      },
    });
  }
  harness.runFrame(2);

  assert.equal(prevented, 4);
  assert.equal(element(harness, "activeGameTitle").textContent, "Formula Circuit");
});

test("Hill Climb human mode restarts a crashed run with Space", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  element(harness, "modeHuman").click();
  harness.runFrame();

  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowRight",
    preventDefault() {},
  });
  for (let i = 0; i < 5000 && element(harness, "alive").textContent !== "0"; i += 1) {
    harness.runFrame();
  }
  harness.window.dispatchEvent({
    type: "keyup",
    code: "ArrowRight",
    preventDefault() {},
  });
  harness.runFrame();

  assert.equal(element(harness, "toggleRun").textContent, "Resume");
  assert.equal(element(harness, "alive").textContent, 0);

  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowRight",
    preventDefault() {},
  });
  harness.runFrame();

  assert.equal(element(harness, "toggleRun").textContent, "Resume");
  assert.equal(element(harness, "alive").textContent, 0);

  let prevented = false;
  harness.window.dispatchEvent({
    type: "keydown",
    code: "Space",
    preventDefault() {
      prevented = true;
    },
  });
  harness.runFrame();

  assert.equal(prevented, true);
  assert.equal(element(harness, "toggleRun").textContent, "Pause");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "score").textContent, 0);
});

test("champion save, load, clear, and incompatible payload handling work", async () => {
  const harness = await loadHarness();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(pipeChampionStorageKey));
  assert.equal(saved.genome.length, 57);
  assert.match(element(harness, "championStatus").textContent, /saved locally/);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /loaded/);
  assert.equal(element(harness, "generation").textContent, 1);

  harness.storage.setItem(pipeChampionStorageKey, JSON.stringify({ genome: [1, 2, 3] }));
  element(harness, "loadChampion").click();
  assert.match(element(harness, "championStatus").textContent, /incompatible/);

  element(harness, "clearChampion").click();
  assert.equal(harness.storage.getItem(pipeChampionStorageKey), null);
  assert.match(element(harness, "championStatus").textContent, /cleared/);
});

test("Lunar champions are saved under the Lunar key with compatible genome length", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(lunarChampionStorageKey));

  assert.equal(saved.game, "lunar");
  assert.equal(saved.genome.length, 99);
  assert.equal(saved.inputs, 8);
  assert.equal(saved.hidden, 8);
  assert.equal(saved.outputs, 3);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /Lunar Lander Lite champion loaded/);
});

test("Hill Climb champions are saved under the Hill Climb key with compatible genome length", async () => {
  const harness = await loadHarness();

  element(harness, "gameHill").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(hillChampionStorageKey));

  assert.equal(saved.game, "hill");
  assert.equal(saved.genome.length, 121);
  assert.equal(saved.inputs, 14);
  assert.equal(saved.hidden, 7);
  assert.equal(saved.outputs, 2);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /Hill Climb champion loaded/);
});

test("Formula Circuit champions are saved under the Formula key with compatible genome length", async () => {
  const harness = await loadHarness();

  element(harness, "gameFormula").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(formulaChampionStorageKey));

  assert.equal(saved.game, "formula");
  assert.equal(saved.genome.length, 95);
  assert.equal(saved.inputs, 8);
  assert.equal(saved.hidden, 7);
  assert.equal(saved.outputs, 4);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /Formula Circuit champion loaded/);
});

test("Formula Circuit rejects champions saved with the previous five-input network", async () => {
  const harness = await loadHarness();

  element(harness, "gameFormula").click();
  harness.runFrame();
  harness.storage.setItem(formulaChampionStorageKey, JSON.stringify({
    game: "formula",
    genome: Array.from({ length: 74 }, () => 0),
    inputs: 5,
    hidden: 7,
    outputs: 4,
  }));

  element(harness, "loadChampion").click();
  harness.runFrame();

  assert.match(element(harness, "championStatus").textContent, /incompatible/);
});

test("legacy champion storage key remains loadable after project rename", async () => {
  const harness = await loadHarness();
  harness.runFrame();

  const legacyPayload = {
    genome: Array.from({ length: 57 }, () => 0),
    bestFitness: 123,
    bestScore: 4,
  };
  harness.storage.setItem(legacyChampionStorageKey, JSON.stringify(legacyPayload));
  element(harness, "loadChampion").click();
  harness.runFrame();

  assert.match(element(harness, "championStatus").textContent, /loaded/);
  assert.equal(element(harness, "bestFitness").textContent, 123);
});

test("pipe controls switch to custom preset and reset the active run", async () => {
  const harness = await loadHarness();
  harness.runFrame();

  element(harness, "nextGen").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 2);

  element(harness, "pipeGap").value = "190";
  element(harness, "pipeGap").dispatchEvent({ type: "change" });
  harness.runFrame();

  assert.equal(element(harness, "preset").value, "custom");
  assert.equal(element(harness, "generation").textContent, 1);
  assert.equal(element(harness, "alive").textContent, 10);
});

test("Lunar-specific sliders reset Lunar without exposing other game settings", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  harness.runFrame();
  element(harness, "nextGen").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 2);

  element(harness, "lunarGravity").value = "0.24";
  element(harness, "lunarGravity").dispatchEvent({ type: "input" });
  assert.equal(element(harness, "lunarGravityValue").textContent, "0.24g");
  element(harness, "lunarGravity").dispatchEvent({ type: "change" });
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, 1);

  element(harness, "lunarPadSize").value = "160";
  element(harness, "lunarPadSize").dispatchEvent({ type: "input" });
  assert.equal(element(harness, "lunarPadSizeValue").textContent, "160");
  element(harness, "lunarThrust").value = "0.160";
  element(harness, "lunarThrust").dispatchEvent({ type: "input" });
  assert.equal(element(harness, "lunarThrustValue").textContent, "0.160");

  assert.equal(element(harness, "lunarSettings").hidden, false);
  assert.equal(element(harness, "lunarSettings").classList.contains("settings-visible"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pipeSettings").classList.contains("settings-visible"), false);
  assert.equal(element(harness, "pipeGap").value, "150");
});

test("source files pass Node syntax checks", async () => {
  const mainPath = join(root.pathname, "src/main.js");
  assert.equal(typeof pathToFileURL(mainPath).href, "string");
  await execFileAsync("node", ["--check", mainPath]);
});
