import test from "node:test";
import assert from "node:assert/strict";
import {
  RAID_BUILDING_NAMES,
  RAID_TROOP_VISUALS,
  drawRaidBuilding,
  drawRaidBuildingArtwork,
  drawRaidBuildingTooltip,
  drawRaidTroop,
  drawRaidTroopKey,
  findRaidBuildingAtPoint,
} from "../src/village-raid-rendering.js";
import { BUILDING_DEFINITIONS } from "../src/village-raid-data.js";

test("building names expose all 13 French inspection labels", () => {
  assert.deepEqual(RAID_BUILDING_NAMES, {
    townHall: "Hotel de ville",
    clanCastle: "Chateau de clan",
    armyCamp: "Camp militaire",
    barracks: "Caserne",
    laboratory: "Laboratoire",
    goldMine: "Mine d'or",
    elixirCollector: "Extracteur d'elixir",
    goldStorage: "Reserve d'or",
    elixirStorage: "Reserve d'elixir",
    builderHut: "Cabane d'ouvrier",
    cannon: "Canon",
    archerTower: "Tour d'archers",
    mortar: "Mortier",
  });
});

test("building hit testing respects complete footprints and living state", () => {
  const buildings = [
    { id: "cannon-1", x: 4, y: 5, width: 3, height: 3, hp: 100 },
    { id: "mortar-1", x: 10, y: 5, width: 3, height: 3, hp: 0 },
  ];

  assert.equal(findRaidBuildingAtPoint(buildings, { x: 44, y: 42 }, 10, 8)?.id, "cannon-1");
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 65.9, y: 63.9 }, 10, 8)?.id, "cannon-1");
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 66, y: 64 }, 10, 8), null);
  assert.equal(findRaidBuildingAtPoint(buildings, { x: 94, y: 42 }, 10, 8), null);
});

test("building tooltip shows French name, level, and rounded current/max HP", () => {
  const ctx = recordingContext();
  drawRaidBuildingTooltip(ctx, {
    ...buildingFixture("townHall"),
    level: 3,
    hp: 1234.4,
    maxHp: 1600.2,
  }, 0, 10, 320, 180);

  assert.deepEqual(
    ctx.calls.filter(({ type }) => type === "fillText").map(({ text }) => text),
    ["Hotel de ville", "Niv. 3", "HP 1234/1600"],
  );
});

test("building tooltip solid rectangle stays within every Canvas edge", () => {
  for (const [label, x, y] of [
    ["top-left", -3, -2],
    ["top-right", 9, -2],
    ["bottom-left", -3, 7],
    ["bottom-right", 9, 7],
  ]) {
    const ctx = recordingContext();
    drawRaidBuildingTooltip(ctx, {
      ...buildingFixture("archerTower"),
      x,
      y,
      level: 3,
    }, 0, 10, 120, 90);
    const box = ctx.calls.find((call) =>
      call.type === "fillRect" && call.fillStyle === "#172026"
    );
    assert.ok(box, `${label} tooltip box`);
    assert.ok(box.x >= 0 && box.x + box.width <= 120, `${label} x clamp`);
    assert.ok(box.y >= 0 && box.y + box.height <= 90, `${label} y clamp`);
  }
});

test("all 13 building types draw their own recognizable label-free cues", () => {
  const cueChecks = {
    townHall: (calls) => countCalls(calls, "closePath") >= 2 && hasFill(calls, "#f5d77a"),
    clanCastle: (calls) => detailRects(calls, "#aeb8c4").length >= 3,
    armyCamp: (calls) => countCalls(calls, "closePath") >= 2 && countCalls(calls, "arc") >= 1,
    barracks: (calls) => countCalls(calls, "closePath") >= 1 && countCalls(calls, "moveTo") >= 3,
    laboratory: (calls) => calls.some((call) =>
      call.type === "ellipse" && call.radiusX >= 7 && call.radiusY >= 7
    ) && detailRects(calls, "#72d6df").length >= 1,
    goldMine: (calls) => countCalls(calls, "lineTo") >= 2 && detailRects(calls, "#d6a42f").length >= 1,
    elixirCollector: (calls) => countCalls(calls, "lineTo") >= 2 && countCalls(calls, "ellipse") >= 1,
    goldStorage: (calls) => detailRects(calls, "#8a6428").length >= 1 && countCalls(calls, "arc") >= 3,
    elixirStorage: (calls) => countCalls(calls, "ellipse") >= 2 && detailRects(calls, "#67366f").some(isStopper),
    builderHut: (calls) => countCalls(calls, "closePath") >= 1 && countCalls(calls, "moveTo") >= 2,
    cannon: (calls) => countCalls(calls, "arc") >= 2 && detailRects(calls).some(isLongRect),
    archerTower: (calls) => countCalls(calls, "lineTo") >= 4 && countCalls(calls, "arc") >= 1,
    mortar: (calls) => countCalls(calls, "rotate") === 1 && countCalls(calls, "ellipse") >= 1,
  };
  const missing = [];

  for (const [type, check] of Object.entries(cueChecks)) {
    const ctx = recordingContext();
    drawRaidBuilding(ctx, buildingFixture(type), 0, 10);
    if (!check(ctx.calls)) missing.push(type);
    assert.equal(countCalls(ctx.calls, "fillText"), 0, `${type} permanent label`);
  }

  assert.deepEqual(missing, []);
});

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

test("the cannon keeps its square outline and draws wheels, a base, and a long barrel", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, cannonFixture(), 0, 10);
  const outlines = ctx.calls.filter((call) => call.type === "strokeRect");
  assert.deepEqual(outlines[0], {
    type: "strokeRect", x: 32, y: 42, width: 26, height: 26,
  });
  assert.ok(ctx.calls.filter((call) => call.type === "arc").length >= 2, "two wheels");
  const detailRects = ctx.calls.filter((call) =>
    call.type === "fillRect" && call.fillStyle !== "#20262d" && call.fillStyle !== "#48c774"
  ).slice(1);
  assert.ok(detailRects.some((call) => call.width === call.height), "square masonry base");
  assert.ok(detailRects.some((call) => call.width >= call.height * 2.5), "long barrel");
});

test("editor building artwork keeps canonical cues without a combat health bar", () => {
  const ctx = recordingContext();
  drawRaidBuildingArtwork(ctx, buildingFixture("cannon"), 10, 12, 10);
  assert.ok(ctx.calls.some(({ type }) => type === "strokeRect"));
  assert.ok(ctx.calls.filter(({ type }) => type === "arc").length >= 2);
  assert.equal(ctx.calls.some(({ fillStyle }) => fillStyle === "#48c774"), false);
});

test("the mortar draws a round turntable and a rotated open tube", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, buildingFixture("mortar"), 0, 10);

  const rotateIndex = ctx.calls.findIndex((call) => call.type === "rotate");
  assert.ok(ctx.calls.some((call) => call.type === "arc" && call.radius >= 6), "turntable");
  assert.ok(rotateIndex > 0, "elevated tube rotation");
  assert.ok(ctx.calls.slice(rotateIndex).some((call) =>
    call.type === "fillRect" && call.width >= call.height * 2.5
  ), "thick tube");
  assert.ok(ctx.calls.slice(rotateIndex).some((call) =>
    (call.type === "arc" || call.type === "ellipse") &&
    (call.radius ?? call.radiusX) < 4
  ), "dark tube opening");
  assertMortarTransformWithin(ctx.calls, { left: 30, top: 40, right: 60, bottom: 70 });
});

test("gold mine uses rails and a cart rather than a storage sphere", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, buildingFixture("goldMine"), 0, 10);

  assert.ok(ctx.calls.filter((call) => call.type === "lineTo").length >= 2, "rail lines");
  assert.ok(detailRects(ctx.calls, "#d6a42f").some((call) =>
    call.y >= 55 && call.width >= 8 && call.width <= 12 && call.height >= 4 && call.height <= 7
  ), "small gold cart below the mine entrance");
  assert.equal(ctx.calls.some((call) =>
    call.type === "ellipse" && call.radiusX >= 7 && call.radiusY >= 7
  ), false, "no large spherical storage ellipse");
});

test("gold storage draws a reinforced bin filled with coins", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, buildingFixture("goldStorage"), 0, 10);

  assert.ok(detailRects(ctx.calls, "#8a6428").some((call) =>
    call.width >= 18 && call.width <= 22 && call.height >= 15 && call.height <= 18
  ), "large bin");
  assert.ok(ctx.calls.filter((call) => call.type === "arc" && call.radius <= 3).length >= 3, "coins");
});

test("elixir collector draws pipes and a small vat", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, buildingFixture("elixirCollector"), 0, 10);

  assert.ok(ctx.calls.filter((call) => call.type === "lineTo").length >= 2, "pipe lines");
  assert.ok(ctx.calls.some((call) =>
    call.type === "ellipse" && call.radiusX < 7 && call.radiusY < 7
  ), "small vat");
});

test("elixir storage draws a large spherical tank and stopper", () => {
  const ctx = recordingContext();
  drawRaidBuilding(ctx, buildingFixture("elixirStorage"), 0, 10);

  assert.ok(ctx.calls.some((call) =>
    call.type === "ellipse" && call.radiusX >= 7 && call.radiusY >= 7
  ), "large spherical tank");
  assert.ok(detailRects(ctx.calls, "#67366f").some(isStopper), "small top stopper rectangle");
});

test("building health bars sit above the footprint", () => {
  for (const type of Object.keys(BUILDING_DEFINITIONS)) {
    const building = buildingFixture(type);
    const ctx = recordingContext();
    drawRaidBuilding(ctx, building, 0, 10);
    const bars = ctx.calls.filter((call) =>
      call.type === "fillRect" && ["#20262d", "#48c774"].includes(call.fillStyle)
    );
    assert.equal(bars.length, 2, type);
    assert.ok(bars.every((call) => call.y < building.y * 10), type);
  }

  const topEdgeBuilding = { ...buildingFixture("elixirCollector"), y: 0 };
  const topEdgeCtx = recordingContext();
  drawRaidBuilding(topEdgeCtx, topEdgeBuilding, 0, 10);
  const topEdgeBars = topEdgeCtx.calls.filter((call) =>
    call.type === "fillRect" && ["#20262d", "#48c774"].includes(call.fillStyle)
  );
  assert.ok(topEdgeBars.every((call) => call.y < 0), "top-edge health bars");
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
      if (["#20262d", "#48c774"].includes(call.fillStyle)) continue;
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

function assertMortarTransformWithin(calls, bounds) {
  const translation = calls.find((call) => call.type === "translate");
  const rotation = calls.find((call) => call.type === "rotate");
  const transformedCalls = calls.slice(calls.indexOf(rotation) + 1);
  const tube = transformedCalls.find((call) => call.type === "fillRect");
  const opening = transformedCalls.find((call) => call.type === "ellipse");
  assert.ok(translation && rotation && tube && opening, "complete mortar transform");

  for (const [localX, localY] of [
    [tube.x, tube.y],
    [tube.x + tube.width, tube.y],
    [tube.x + tube.width, tube.y + tube.height],
    [tube.x, tube.y + tube.height],
  ]) {
    const point = transformPoint(localX, localY, translation, rotation.angle);
    assert.ok(point.x >= bounds.left && point.x <= bounds.right, "mortar tube x");
    assert.ok(point.y >= bounds.top && point.y <= bounds.bottom, "mortar tube y");
  }

  const center = transformPoint(opening.x, opening.y, translation, rotation.angle);
  const angle = rotation.angle + opening.rotation;
  const radiusX = Math.hypot(opening.radiusX * Math.cos(angle), opening.radiusY * Math.sin(angle));
  const radiusY = Math.hypot(opening.radiusX * Math.sin(angle), opening.radiusY * Math.cos(angle));
  assert.ok(center.x - radiusX >= bounds.left && center.x + radiusX <= bounds.right, "mortar opening x");
  assert.ok(center.y - radiusY >= bounds.top && center.y + radiusY <= bounds.bottom, "mortar opening y");
}

function transformPoint(x, y, translation, angle) {
  return {
    x: translation.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: translation.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

function countCalls(calls, type) {
  return calls.filter((call) => call.type === type).length;
}

function hasFill(calls, fillStyle) {
  return calls.some((call) => call.type === "fillStyle" && call.value === fillStyle);
}

function detailRects(calls, fillStyle) {
  return calls.filter((call) =>
    call.type === "fillRect" &&
    call.width < 26 && call.height < 26 &&
    !["#20262d", "#48c774"].includes(call.fillStyle) &&
    (!fillStyle || call.fillStyle === fillStyle)
  );
}

function isLongRect(call) {
  return call.width >= call.height * 2.5;
}

function isStopper(call) {
  return call.y < 48 && call.width < 10 && call.height < 5;
}

function cannonFixture() {
  return buildingFixture("cannon");
}

function buildingFixture(type) {
  const definition = BUILDING_DEFINITIONS[type];
  return {
    id: `${type}-test`,
    type,
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
  ctx.measureText = (text) => ({ width: text.length * 7 });
  return ctx;
}
