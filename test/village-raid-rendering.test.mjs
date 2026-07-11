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
      call.x === 44 &&
      call.y === 42 &&
      call.width === definition.width * 8 - 4 &&
      call.height === definition.height * 8 - 4
    );
    assert.deepEqual(outline, {
      type: "strokeRect",
      x: 44,
      y: 42,
      width: definition.width * 8 - 4,
      height: definition.height * 8 - 4,
    });
  }
});

test("the cannon keeps a square base while drawing a round barrel assembly", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, cannonFixture(), 0, 10);
  const outlines = ctx.calls.filter((call) => call.type === "strokeRect");
  assert.deepEqual(outlines[0], {
    type: "strokeRect", x: 32, y: 42, width: 26, height: 26,
  });
  assert.ok(outlines.some((call) =>
    call !== outlines[0] && call.width === call.height && call.width < outlines[0].width
  ));
  assert.ok(ctx.calls.some((call) => call.type === "arc" && call.x === 45 && call.y === 55));
});

test("principal building details stay within their natural footprint", () => {
  for (const [type, definition] of Object.entries(BUILDING_DEFINITIONS)) {
    const ctx = recordingContext();
    const building = {
      id: `${type}-bounds`,
      type,
      category: definition.category,
      x: 4,
      y: 5,
      width: definition.width,
      height: definition.height,
      hp: definition.hp,
      maxHp: definition.hp,
    };
    drawRaidBuilding(ctx, building, 10, 8);
    assertGeometryWithin(ctx.calls, {
      left: 42,
      top: 40,
      right: 42 + definition.width * 8,
      bottom: 40 + definition.height * 8,
    }, type);
  }
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
  const barbarianCtx = recordingContext();
  drawRaidTroop(barbarianCtx, troopFixture("barbarian"), 0, 10);
  assert.ok(barbarianCtx.calls.some((call) =>
    call.type === "lineTo" && call.x === 65 && call.y === 65
  ));
  const keyCtx = recordingContext();
  drawRaidTroopKey(keyCtx, 730, 18);
  assert.deepEqual(
    keyCtx.calls.filter((call) => call.type === "fillText").map(({ text }) => text),
    ["B", "A", "G", "Go", "S"],
  );
});

test("an injured troop draws a proportional health bar", () => {
  const ctx = recordingContext();
  drawRaidTroop(ctx, { ...troopFixture("archer"), hp: 25 }, 0, 10);

  assert.deepEqual(
    ctx.calls.find((call) => call.type === "fillRect" && call.fillStyle === "#20262d"),
    { type: "fillRect", x: 55.5, y: 63, width: 9, height: 3, fillStyle: "#20262d" },
  );
  assert.deepEqual(
    ctx.calls.find((call) => call.type === "fillRect" && call.fillStyle === "#48c774"),
    { type: "fillRect", x: 55.5, y: 63, width: 4.5, height: 3, fillStyle: "#48c774" },
  );
});

function assertGeometryWithin(calls, bounds, label) {
  const transformIndex = calls.findIndex((call) => call.type === "translate");
  const worldCalls = transformIndex < 0 ? calls : calls.slice(0, transformIndex);
  for (const call of worldCalls) {
    if (call.type === "fillRect" || call.type === "strokeRect") {
      assert.ok(call.x >= bounds.left && call.x + call.width <= bounds.right, `${label} rect x`);
      assert.ok(call.y >= bounds.top && call.y + call.height <= bounds.bottom, `${label} rect y`);
    } else if (call.type === "moveTo" || call.type === "lineTo") {
      assert.ok(call.x >= bounds.left && call.x <= bounds.right, `${label} path x`);
      assert.ok(call.y >= bounds.top && call.y <= bounds.bottom, `${label} path y`);
    } else if (call.type === "arc") {
      assert.ok(call.x - call.radius >= bounds.left && call.x + call.radius <= bounds.right, `${label} arc x`);
      assert.ok(call.y - call.radius >= bounds.top && call.y + call.radius <= bounds.bottom, `${label} arc y`);
    } else if (call.type === "ellipse") {
      assert.ok(call.x - call.radiusX >= bounds.left && call.x + call.radiusX <= bounds.right, `${label} ellipse x`);
      assert.ok(call.y - call.radiusY >= bounds.top && call.y + call.radiusY <= bounds.bottom, `${label} ellipse y`);
    }
  }
}

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
  let currentFillStyle = "";
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
      const call = Object.fromEntries([
        ["type", method],
        ...args.map((value, index) => [names[index] ?? `arg${index}`, value]),
      ]);
      if (method === "fillRect") call.fillStyle = currentFillStyle;
      calls.push(call);
    };
  }
  for (const property of ["fillStyle", "strokeStyle"]) {
    Object.defineProperty(ctx, property, {
      set(value) {
        if (property === "fillStyle") currentFillStyle = value;
        calls.push({ type: property, value });
      },
    });
  }
  return ctx;
}
