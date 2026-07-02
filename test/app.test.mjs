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
const pongChampionStorageKey = "neuro-evolution-arcade.pong.champion";
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
    "gamePong",
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
    "pongSettings",
    "pongBallSpeed",
    "pongBallSpeedValue",
    "pongPaddleSize",
    "pongPaddleSizeValue",
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
  assert.match(html, /Comment Pong apprend/);
  assert.match(html, /Comment Lunar Lander apprend/);
  assert.match(html, /Neuro Evolution Arcade/);
  assert.match(html, /Flappy Bird/);
  assert.match(html, /Pong/);
  assert.match(html, /Lunar Lander/);
  assert.doesNotMatch(html, /Snake/);
  assert.doesNotMatch(script, /createSnakeGame|gameSnake|SNAKE_INPUT_LABELS/);
  assert.match(script, /inputs: 6/);
  assert.match(script, /inputs: 8/);
  assert.match(script, /PONG_INPUT_LABELS/);
  assert.match(script, /LUNAR_INPUT_LABELS/);
  assert.match(script, /createLunarGame/);
  assert.match(script, /outputLabels: \["up", "stay", "down"\]/);
  assert.match(script, /outputLabels: \["thrust", "left", "right"\]/);
  assert.match(script, /next gap/);
  assert.match(script, /impact dy/);
  assert.match(script, /pad dx/);
  assert.match(script, /trackingGenome/);
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
  assert.equal(element(harness, "pongSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pongSettings").hidden, true);
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "lunarSettings").hidden, true);
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

test("game picker switches to Pong with sequential rally controls and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gamePong").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Pong");
  assert.equal(element(harness, "gamePong").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pongSettings").classList.contains("is-hidden"), false);
  assert.equal(element(harness, "pongSettings").hidden, false);
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "lunarSettings").hidden, true);
  assert.equal(element(harness, "presetPanel").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "aliveLabel").textContent, "Specimen");
  assert.equal(element(harness, "speedLabel").textContent, "Training speed");
  assert.equal(element(harness, "population").value, 36);
  assert.equal(element(harness, "mutation").value, "0.14");
  assert.equal(element(harness, "distanceLabel").textContent, "Ball distance");
  assert.equal(element(harness, "speed").value, 14);
  assert.equal(element(harness, "speed").max, 55);
  assert.equal(element(harness, "pongBallSpeedValue").textContent, "4.8");
  assert.equal(element(harness, "pongPaddleSizeValue").textContent, "96");
  assert.match(String(element(harness, "alive").textContent), /^[1-9]\/36$/);

  const networkCalls = element(harness, "network").getContext().calls;
  const labels = networkCalls.filter((call) => call.type === "fillText").map((call) => call.text);
  assert.deepEqual(labels.slice(0, 8), [
    "paddle y",
    "ball x",
    "ball y",
    "ball vx",
    "ball vy",
    "impact y",
    "impact dy",
    "time",
  ]);
  assert.equal(labels.includes("up"), true);
  assert.equal(labels.includes("stay"), true);
  assert.equal(labels.includes("down"), true);
});

test("game picker switches to Lunar Lander with dedicated sliders and network shape", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  harness.runFrame();

  assert.equal(element(harness, "activeGameTitle").textContent, "Lunar Lander Lite");
  assert.equal(element(harness, "gameLunar").classList.contains("is-active"), true);
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pongSettings").hidden, true);
  assert.equal(element(harness, "pongSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "lunarSettings").hidden, false);
  assert.equal(element(harness, "lunarSettings").classList.contains("is-hidden"), false);
  assert.equal(element(harness, "presetPanel").hidden, true);
  assert.equal(element(harness, "aliveLabel").textContent, "Alive");
  assert.equal(element(harness, "speedLabel").textContent, "Training speed");
  assert.equal(element(harness, "population").value, 28);
  assert.equal(element(harness, "mutation").value, "0.16");
  assert.equal(element(harness, "distanceLabel").textContent, "Pad distance");
  assert.equal(element(harness, "speed").value, 7);
  assert.equal(element(harness, "speed").max, 28);
  assert.equal(element(harness, "lunarGravityValue").textContent, "0.070");
  assert.equal(element(harness, "lunarFuelValue").textContent, "120");
  assert.equal(element(harness, "lunarPadSizeValue").textContent, "126");
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

test("Pong human mode uses arrow keys and keeps AI-only actions disabled", async () => {
  const harness = await loadHarness();

  element(harness, "gamePong").click();
  element(harness, "modeHuman").click();
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, "Human");
  assert.equal(element(harness, "alive").textContent, 1);
  assert.equal(element(harness, "nextGen").disabled, true);

  let prevented = false;
  harness.window.dispatchEvent({
    type: "keydown",
    code: "ArrowDown",
    preventDefault() {
      prevented = true;
    },
  });
  harness.runFrame(2);

  assert.equal(prevented, true);
  assert.equal(element(harness, "activeGameTitle").textContent, "Pong");
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

test("seeded Pong model can score multiple returns in AI mode", async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;

  try {
    const harness = await loadHarness();
    element(harness, "gamePong").click();
    harness.runFrame(70);

    assert.ok(Number(element(harness, "score").textContent) >= 2);
    assert.ok(Number(element(harness, "leaderFitness").textContent) > 1000);
  } finally {
    Math.random = originalRandom;
  }
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

test("Pong champions are saved under the Pong key with compatible genome length", async () => {
  const harness = await loadHarness();

  element(harness, "gamePong").click();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(pongChampionStorageKey));

  assert.equal(saved.game, "pong");
  assert.equal(saved.genome.length, 111);
  assert.equal(saved.inputs, 8);
  assert.equal(saved.hidden, 9);
  assert.equal(saved.outputs, 3);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /Pong champion loaded/);
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

test("Pong-specific sliders reset Pong without affecting pipe settings", async () => {
  const harness = await loadHarness();

  element(harness, "gamePong").click();
  harness.runFrame();
  element(harness, "nextGen").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 2);

  element(harness, "pongBallSpeed").value = "5.6";
  element(harness, "pongBallSpeed").dispatchEvent({ type: "input" });
  assert.equal(element(harness, "pongBallSpeedValue").textContent, "5.6");
  element(harness, "pongBallSpeed").dispatchEvent({ type: "change" });
  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, 1);
  assert.match(String(element(harness, "alive").textContent), /^[1-9]\/36$/);
  assert.equal(element(harness, "pipeGap").value, "150");
});

test("Lunar-specific sliders reset Lunar without exposing other game settings", async () => {
  const harness = await loadHarness();

  element(harness, "gameLunar").click();
  harness.runFrame();
  element(harness, "nextGen").click();
  harness.runFrame();
  assert.equal(element(harness, "generation").textContent, 2);

  element(harness, "lunarGravity").value = "0.085";
  element(harness, "lunarGravity").dispatchEvent({ type: "input" });
  assert.equal(element(harness, "lunarGravityValue").textContent, "0.085");
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
  assert.equal(element(harness, "pipeSettings").hidden, true);
  assert.equal(element(harness, "pipeSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pongSettings").hidden, true);
  assert.equal(element(harness, "pongSettings").classList.contains("is-hidden"), true);
  assert.equal(element(harness, "pipeGap").value, "150");
  assert.equal(element(harness, "pongBallSpeed").value, "4.8");
});

test("source files pass Node syntax checks", async () => {
  const mainPath = join(root.pathname, "src/main.js");
  assert.equal(typeof pathToFileURL(mainPath).href, "string");
  await execFileAsync("node", ["--check", mainPath]);
});
