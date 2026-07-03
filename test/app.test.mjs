import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const pipeChampionStorageKey = "neuro-evolution-arcade.pipe-runner.champion";
const legacyChampionStorageKey = "ai-flappy-evolution.champion";
const lunarChampionStorageKey = "neuro-evolution-arcade.lunar.champion";
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
  constructor({ id, tagName, value = "", textContent = "", className = "" }) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = value;
    this.textContent = textContent;
    this.disabled = false;
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
    strokeRect() {},
    moveTo() {},
    lineTo() {},
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
    const textContent = closingText(html, match.index, tagName);

    elements.set(
      id,
      new MockElement({
        id,
        tagName,
        value,
        className,
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

test("static app includes every primary control and asset reference", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
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
    "leaderFitnessLabel",
    "saveChampion",
    "loadChampion",
    "clearChampion",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.match(html, /Comment les generations apprennent/);
  assert.match(html, /Comment Lunar Lander apprend/);
  assert.match(html, /Neuro Evolution Arcade/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\.\/assets\/favicon\.svg"/);
  assert.match(html, /Flappy Bird/);
  assert.match(html, /Lunar Lander/);
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
  assert.match(script, /LUNAR_INPUT_LABELS/);
  assert.match(script, /createLunarGame/);
  assert.match(script, /outputLabels: \["thrust", "left", "right"\]/);
  assert.match(script, /sequential: true/);
  assert.match(script, /startAgent\(agent, targetWorld\)/);
  assert.match(script, /sequentialScore\(nextAgents\)/);
  assert.match(script, /Math\.max\(0, \.\.\.nextAgents\.map\(\(agent\) => agent\.score\)\)/);
  assert.doesNotMatch(script, /nextAgents\.reduce\(\(total, agent\) => total \+ agent\.score, 0\)/);
  assert.match(script, /agent\.score \+= 1/);
  assert.match(script, /makeTargetSequence/);
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
  assert.match(script, /const desiredVx = clamp\(signedPadDx \/ 260, -1\.35, 1\.35\)/);
  assert.match(script, /targetReward \* padDifficulty/);
  assert.match(script, /agent\.vx \* signedPadDx < -0\.08/);
  assert.match(script, /wallPenalty \* 2\.8/);
  assert.match(script, /next gap/);
  assert.match(script, /pad dx/);
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
  assert.equal(element(harness, "lunarThrustValue").textContent, "0.145");

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 8), ["x", "altitude", "vx", "vy", "angle", "fuel", "pad dx", "spin"]);
  assert.equal(labels.includes("thrust"), true);
  assert.equal(labels.includes("left"), true);
  assert.equal(labels.includes("right"), true);
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
