import assert from "node:assert/strict";
import { test } from "node:test";
import { CHICANE_SECTIONS, MONZA_SECTION_ORDER, createFormulaTrack } from "../src/formula-track.js";

function turnSigns(points) {
  const signs = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const cross = incomingX * outgoingY - incomingY * outgoingX;
    if (Math.abs(cross) > 0.0001) signs.push(Math.sign(cross));
  }
  return signs;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, point) {
  const epsilon = 0.0001;
  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const epsilon = 0.0001;
  const crosses =
    ((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
    ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon));
  if (crosses) return true;
  if (Math.abs(abC) <= epsilon && onSegment(a, b, c)) return true;
  if (Math.abs(abD) <= epsilon && onSegment(a, b, d)) return true;
  if (Math.abs(cdA) <= epsilon && onSegment(c, d, a)) return true;
  return Math.abs(cdB) <= epsilon && onSegment(c, d, b);
}

test("Monza landmarks are ordered clockwise from the Rettifilo start", () => {
  const track = createFormulaTrack();

  assert.equal(track.direction, "clockwise");
  assert.deepEqual(track.sections.map((section) => section.name), MONZA_SECTION_ORDER);
  assert.equal(track.sections[0].name, "Rettifilo");
  assert.equal(track.sections.at(-1).name, "Start finish");
  assert.ok(track.signedScreenArea > 0, "screen-coordinate route should wind clockwise");
});

test("every Monza chicane has distinct alternating turns and a narrower local width", () => {
  const track = createFormulaTrack();

  for (const name of CHICANE_SECTIONS) {
    const section = track.sections.find((candidate) => candidate.name === name);
    const signs = turnSigns(section.centerline);

    assert.equal(section.width, 48, `${name} should be 48 units wide`);
    assert.ok(signs.length >= 2, `${name} should contain at least two turns`);
    assert.ok(signs.some((sign, index) => index > 0 && sign !== signs[index - 1]), `${name} should alternate direction`);
  }

  for (const section of track.sections) {
    if (!CHICANE_SECTIONS.includes(section.name)) assert.equal(section.width, 64, `${section.name} should be 64 units wide`);
  }
  const rettifilo = track.sections.find((section) => section.name === "Variante del Rettifilo").centerline[1];
  assert.equal(track.getWidthAtClosestSegment(rettifilo.x, rettifilo.y).width, 48);
});

test("ordered checkpoints cover each chicane entry and exit with their local line width", () => {
  const track = createFormulaTrack();
  const checkpointNames = track.checkpoints.map((checkpoint) => checkpoint.section);

  for (const name of CHICANE_SECTIONS) {
    assert.ok(checkpointNames.includes(name), `missing ${name} checkpoint`);
  }

  const chicaneGates = track.checkpoints
    .filter((checkpoint) => CHICANE_SECTIONS.includes(checkpoint.section))
    .map((checkpoint) => `${checkpoint.section}:${checkpoint.phase}`);
  assert.deepEqual(chicaneGates, [
    "Variante del Rettifilo:entry",
    "Variante del Rettifilo:exit",
    "Variante della Roggia:entry",
    "Variante della Roggia:exit",
    "Variante Ascari:entry",
    "Variante Ascari:exit",
  ]);

  for (const checkpoint of track.checkpoints) {
    const expectedWidth = CHICANE_SECTIONS.includes(checkpoint.section) ? 48 : 64;
    const closest = track.getWidthAtClosestSegment(checkpoint.x, checkpoint.y);
    assert.equal(checkpoint.width, expectedWidth);
    assert.equal(checkpoint.width, closest.width);
    assert.equal(checkpoint.geometry.lineHalfWidth, checkpoint.width / 2 + 24);
  }
});

test("the normalized centerline has no non-adjacent segment intersections", () => {
  const { segments } = createFormulaTrack();

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const adjacent =
        rightIndex === leftIndex + 1 ||
        (leftIndex === 0 && rightIndex === segments.length - 1);
      if (adjacent) continue;
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      assert.equal(
        segmentsIntersect(left.from, left.to, right.from, right.to),
        false,
        `segments ${leftIndex} and ${rightIndex} must not cross`,
      );
    }
  }
});

test("the circuit follows Monza's official north-east silhouette", () => {
  const track = createFormulaTrack({ worldWidth: 1000, worldHeight: 1000, paddingX: 0, paddingY: 0 });
  const section = (name) => track.sections.find((candidate) => candidate.name === name).centerline;
  const midpoint = (points) => points[Math.floor(points.length / 2)];
  const rettifilo = section("Rettifilo");
  const curvaGrande = section("Curva Grande");
  const roggia = section("Variante della Roggia");
  const lesmo2 = section("Lesmo 2");
  const serraglio = section("Serraglio");
  const ascari = section("Variante Ascari");
  const alboreto = section("Curva Alboreto");

  assert.ok(rettifilo.every((point) => point.x < 250), "the start straight should run up the left edge");
  assert.ok(curvaGrande.at(-1).x - curvaGrande[0].x > 250, "Curva Grande should sweep from north to east");
  assert.ok(midpoint(roggia).y < curvaGrande.at(-1).y, "Roggia should be the northern chicane");
  assert.ok(lesmo2.at(-1).y > lesmo2[0].y, "the second Lesmo should feed the southern descent");
  assert.ok(serraglio.at(-1).x < serraglio[0].x && serraglio.at(-1).y > serraglio[0].y, "Serraglio should descend diagonally to Ascari");
  assert.ok(Math.max(...ascari.map((point) => point.y)) > 700, "Ascari should sit on the south side of the layout");
  assert.ok(alboreto[0].x < 300 && alboreto.at(-1).x < 250, "Alboreto should close the lower-left loop");
});
