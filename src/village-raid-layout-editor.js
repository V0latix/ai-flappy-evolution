export const LAYOUT_EDITOR_SCHEMA = "village-raid-layout-editor-v1";
export const LAYOUT_EDITOR_GRID = Object.freeze({ width: 48, height: 32 });
export const LAYOUT_EDITOR_COUNTS = Object.freeze({ buildings: 22, walls: 50, traps: 2 });

export function createScreenshotCalibration(
  anchorPx,
  columnHandlePx,
  rowHandlePx,
  anchorGrid,
  axisCells = 5,
) {
  if (!Number.isFinite(axisCells) || axisCells <= 0) {
    throw new RangeError("axisCells must be positive");
  }
  return {
    anchorPx: clonePoint(anchorPx),
    anchorGrid: clonePoint(anchorGrid),
    columnBasis: {
      x: (columnHandlePx.x - anchorPx.x) / axisCells,
      y: (columnHandlePx.y - anchorPx.y) / axisCells,
    },
    rowBasis: {
      x: (rowHandlePx.x - anchorPx.x) / axisCells,
      y: (rowHandlePx.y - anchorPx.y) / axisCells,
    },
    axisCells,
  };
}

export function projectEditorGridPoint(calibration, point) {
  const columnDelta = point.x - calibration.anchorGrid.x;
  const rowDelta = point.y - calibration.anchorGrid.y;
  return roundPoint({
    x: calibration.anchorPx.x + columnDelta * calibration.columnBasis.x +
      rowDelta * calibration.rowBasis.x,
    y: calibration.anchorPx.y + columnDelta * calibration.columnBasis.y +
      rowDelta * calibration.rowBasis.y,
  });
}

export function unprojectEditorScreenshotPoint(calibration, point) {
  const determinant = calibration.columnBasis.x * calibration.rowBasis.y -
    calibration.columnBasis.y * calibration.rowBasis.x;
  if (Math.abs(determinant) < 1e-8) return null;
  const dx = point.x - calibration.anchorPx.x;
  const dy = point.y - calibration.anchorPx.y;
  const columnDelta = (dx * calibration.rowBasis.y - dy * calibration.rowBasis.x) /
    determinant;
  const rowDelta = (dy * calibration.columnBasis.x - dx * calibration.columnBasis.y) /
    determinant;
  return roundPoint({
    x: calibration.anchorGrid.x + columnDelta,
    y: calibration.anchorGrid.y + rowDelta,
  });
}

export function snapEditorGridPoint(point) {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function clonePoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function roundPoint(point) {
  return {
    x: Math.round(point.x * 1000) / 1000,
    y: Math.round(point.y * 1000) / 1000,
  };
}
