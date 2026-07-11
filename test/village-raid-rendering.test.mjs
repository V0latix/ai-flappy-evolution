import test from "node:test";
import assert from "node:assert/strict";
import {
  RAID_TROOP_VISUALS,
  drawRaidBuilding,
  drawRaidTroop,
  drawRaidTroopKey,
} from "../src/village-raid-rendering.js";
import { BUILDING_DEFINITIONS } from "../src/village-raid-data.js";

test("every building type draws inside its complete footprint", () => {
  for (const [type, definition] of Object.entries(BUILDING_DEFINITIONS)) {
    const ctx = recordingContext();
    drawRaidBuilding(ctx, {
      id: `${type}-test`,
      type,
      category: definition.category,
      x: 4,
      y: 5,
      width: definition.width,
      height: definition.height,
      hp: definition.hp,
      maxHp: definition.hp,
    }, 10, 8);
    const outline = ctx.calls.find((call) =>
      call.type === "strokeRect" &&
      call.x === 42 &&
      call.y === 42 &&
      call.width === definition.width * 8 - 4 &&
      call.height === definition.height * 8 - 4
    );
    assert.deepEqual(outline, {
      type: "strokeRect",
      x: 42,
      y: 42,
      width: definition.width * 8 - 4,
      height: definition.height * 8 - 4,
    });
  }
});

test("the cannon keeps a square base while drawing a round barrel assembly", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, cannonFixture(), 0, 10);
  assert.ok(ctx.calls.some((call) => call.type === "strokeRect" && call.width === call.height));
  assert.ok(ctx.calls.some((call) => call.type === "arc"));
});

test("troops have five distinct visual identities and a compact key", () => {
  assert.deepEqual(Object.keys(RAID_TROOP_VISUALS), [
    "barbarian", "archer", "giant", "goblin", "wallBreaker",
  ]);
  assert.equal(new Set(Object.values(RAID_TROOP_VISUALS).map(({ color }) => color)).size, 5);
  for (const type of Object.keys(RAID_TROOP_VISUALS)) {
    const ctx = recordingContext();
    drawRaidTroop(ctx, troopFixture(type), 0, 10);
    assert.ok(
      ctx.calls.some(
        (call) => call.type === "fillStyle" && call.value === RAID_TROOP_VISUALS[type].color,
      ),
      type,
    );
  }
  const keyCtx = recordingContext();
  drawRaidTroopKey(keyCtx, 730, 18);
  assert.deepEqual(
    keyCtx.calls.filter((call) => call.type === "fillText").map(({ text }) => text),
    ["B", "A", "G", "Go", "S"],
  );
});

function cannonFixture() {
  const definition = BUILDING_DEFINITIONS.cannon;
  return {
    id: "cannon-test",
    type: "cannon",
    category: definition.category,
    x: 3,
    y: 4,
    width: definition.width,
    height: definition.height,
    hp: definition.hp,
    maxHp: definition.hp,
  };
}

function troopFixture(type) {
  return {
    id: `${type}-test`,
    type,
    x: 6,
    y: 7,
    hp: 50,
    maxHp: 50,
  };
}

function recordingContext() {
  const calls = [];
  const ctx = { calls };
  for (const method of [
    "save", "restore", "translate", "rotate", "beginPath", "closePath", "moveTo",
    "lineTo", "arc", "ellipse", "fill", "stroke", "fillRect", "strokeRect", "fillText",
  ]) {
    ctx[method] = (...args) => {
      const names = {
        translate: ["x", "y"],
        rotate: ["angle"],
        moveTo: ["x", "y"],
        lineTo: ["x", "y"],
        arc: ["x", "y", "radius", "startAngle", "endAngle", "counterclockwise"],
        ellipse: ["x", "y", "radiusX", "radiusY", "rotation", "startAngle", "endAngle"],
        fillRect: ["x", "y", "width", "height"],
        strokeRect: ["x", "y", "width", "height"],
        fillText: ["text", "x", "y"],
      }[method] ?? [];
      calls.push(Object.fromEntries([
        ["type", method],
        ...args.map((value, index) => [names[index] ?? `arg${index}`, value]),
      ]));
    };
  }
  for (const property of ["fillStyle", "strokeStyle"]) {
    Object.defineProperty(ctx, property, {
      set(value) {
        calls.push({ type: property, value });
      },
    });
  }
  return ctx;
}
