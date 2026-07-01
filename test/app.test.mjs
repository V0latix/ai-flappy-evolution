import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const championStorageKey = "neuro-evolution-arcade.flappy.champion";
const legacyChampionStorageKey = "ai-flappy-evolution.champion";
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
  const idPattern = /<([a-zA-Z0-9]+)([^>]*\sid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\sid="([^"]+)"[^>]*)\/?>/g;
  let match;

  while ((match = idPattern.exec(html))) {
    const tagName = match[1] || match[5];
    const attrs = match[2] || match[6] || "";
    const id = match[3] || match[7];
    const value = attr(attrs, "value");
    const className = attr(attrs, "class");
    const textContent = stripTags(match[4] || "");

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
    "toggleRun",
    "nextGen",
    "reset",
    "modeAi",
    "modeHuman",
    "speed",
    "population",
    "mutation",
    "pipeGap",
    "pipeSpacing",
    "preset",
    "saveChampion",
    "loadChampion",
    "clearChampion",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.match(html, /Comment les generations apprennent/);
  assert.match(html, /Neuro Evolution Arcade/);
  assert.match(script, /const INPUTS = 6;/);
  assert.match(script, /next gap/);
});

test("module boots, draws AI network labels, and reports initial training state", async () => {
  const harness = await loadHarness();

  harness.runFrame();

  assert.equal(element(harness, "generation").textContent, 1);
  assert.equal(element(harness, "alive").textContent, 10);
  assert.equal(element(harness, "score").textContent, 0);
  assert.equal(element(harness, "modeAi").classList.contains("is-active"), true);
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

test("champion save, load, clear, and incompatible payload handling work", async () => {
  const harness = await loadHarness();
  harness.runFrame();

  element(harness, "saveChampion").click();
  const saved = JSON.parse(harness.storage.getItem(championStorageKey));
  assert.equal(saved.genome.length, 57);
  assert.match(element(harness, "championStatus").textContent, /saved locally/);

  element(harness, "loadChampion").click();
  harness.runFrame();
  assert.match(element(harness, "championStatus").textContent, /loaded/);
  assert.equal(element(harness, "generation").textContent, 1);

  harness.storage.setItem(championStorageKey, JSON.stringify({ genome: [1, 2, 3] }));
  element(harness, "loadChampion").click();
  assert.match(element(harness, "championStatus").textContent, /incompatible/);

  element(harness, "clearChampion").click();
  assert.equal(harness.storage.getItem(championStorageKey), null);
  assert.match(element(harness, "championStatus").textContent, /cleared/);
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

test("source files pass Node syntax checks", async () => {
  const mainPath = join(root.pathname, "src/main.js");
  assert.equal(typeof pathToFileURL(mainPath).href, "string");
  await execFileAsync("node", ["--check", mainPath]);
});
