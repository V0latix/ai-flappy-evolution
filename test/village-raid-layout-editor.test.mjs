import test from "node:test";
import assert from "node:assert/strict";
import {
  createScreenshotCalibration,
  projectEditorGridPoint,
  snapEditorGridPoint,
  unprojectEditorScreenshotPoint,
} from "../src/village-raid-layout-editor.js";

test("three handles define one invertible screenshot lattice", () => {
  const calibration = createScreenshotCalibration(
    { x: 1310, y: 600 },
    { x: 1527.5, y: 745 },
    { x: 1092.5, y: 745 },
    { x: 22, y: 16 },
  );
  assert.deepEqual(calibration.columnBasis, { x: 43.5, y: 29 });
  assert.deepEqual(calibration.rowBasis, { x: -43.5, y: 29 });
  const pixel = projectEditorGridPoint(calibration, { x: 28, y: 20 });
  assert.deepEqual(pixel, { x: 1397, y: 890 });
  assert.deepEqual(unprojectEditorScreenshotPoint(calibration, pixel), { x: 28, y: 20 });
  assert.deepEqual(snapEditorGridPoint({ x: 27.51, y: 19.49 }), { x: 28, y: 19 });
});

test("a singular screenshot lattice cannot be inverted", () => {
  const calibration = createScreenshotCalibration(
    { x: 100, y: 100 },
    { x: 200, y: 200 },
    { x: 300, y: 300 },
    { x: 22, y: 16 },
  );
  assert.equal(unprojectEditorScreenshotPoint(calibration, { x: 150, y: 150 }), null);
});
