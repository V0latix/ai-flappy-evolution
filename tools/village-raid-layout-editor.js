import { LAYOUTS } from "../src/village-raid-data.js";
import {
  createRaidIsoGeometry,
  projectRaidFootprint,
  projectRaidPoint,
  unprojectRaidPoint,
} from "../src/village-raid-isometric.js";
import {
  applyLayoutEditorWallStroke,
  commitLayoutEditorHistory,
  createLayoutEditorHistory,
  createLayoutEditorState,
  createScreenshotCalibration,
  LAYOUT_EDITOR_GRID,
  layoutEditorDraftKey,
  layoutEditorWallReserve,
  moveLayoutEditorEntity,
  parseLayoutEditorDraft,
  projectEditorGridPoint,
  redoLayoutEditorHistory,
  resetLayoutEditorHistory,
  serializeLayoutEditorDraft,
  serializeLayoutEditorExport,
  setLayoutEditorCalibration,
  snapEditorGridPoint,
  undoLayoutEditorHistory,
  unprojectEditorScreenshotPoint,
  validateLayoutEditorState,
} from "../src/village-raid-layout-editor.js";

const SOURCE_KEYS = Object.freeze({
  "farm-111": "source111",
  "war-26": "source26",
  "defence-104": "source104",
});
const BASE_LABELS = Object.freeze({
  "farm-111": "Ferme 111",
  "war-26": "Guerre 26",
  "defence-104": "Defense 104",
});
const TOOLS = Object.freeze([
  { id: "align", label: "Aligner la grille" },
  { id: "move", label: "Deplacer un element" },
  { id: "paint", label: "Peindre un mur" },
  { id: "erase", label: "Effacer un mur" },
]);
const KIND_LABELS = Object.freeze({
  building: "Batiments",
  wall: "Murs",
  trap: "Bombes",
});
const ENTITY_TYPE_LABELS = Object.freeze({
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
  wall: "Mur",
  bomb: "Bombe",
});

const elements = {
  baseTabs: document.querySelector("#baseTabs"),
  toolButtons: document.querySelector("#toolButtons"),
  sourceImage: document.querySelector("#sourceImage"),
  sourceCanvas: document.querySelector("#sourceCanvas"),
  isoCanvas: document.querySelector("#isoCanvas"),
  entityList: document.querySelector("#entityList"),
  counts: document.querySelector("#counts"),
  status: document.querySelector("#status"),
  undoEditor: document.querySelector("#undoEditor"),
  redoEditor: document.querySelector("#redoEditor"),
  resetEditor: document.querySelector("#resetEditor"),
  validateEditor: document.querySelector("#validateEditor"),
  exportPanel: document.querySelector("#exportPanel"),
  exportJson: document.querySelector("#exportJson"),
};

const params = new URLSearchParams(location.search);
const histories = new Map();
const draftWarnings = new Map();
const sourceImages = new Map();
const sourceMessages = new Map();

for (const layout of LAYOUTS) {
  const townHall = layout.buildings.find(({ id }) => id === "townHall-1");
  const calibration = createScreenshotCalibration(
    { x: 480, y: 280 },
    { x: 630, y: 380 },
    { x: 330, y: 380 },
    { x: townHall.x + townHall.width / 2, y: townHall.y + townHall.height / 2 },
  );
  const initial = createLayoutEditorState(layout, calibration);
  const serialized = readDraft(layout.id);
  const storageWarning = draftWarnings.get(layout.id);
  const restored = serialized
    ? parseLayoutEditorDraft(serialized, initial)
    : { state: initial, warning: null };
  // History.initial always remains the production proposal. A restored draft is
  // only the present state, so reset cannot accidentally restore the draft.
  histories.set(layout.id, {
    ...createLayoutEditorHistory(initial),
    present: restored.state,
  });
  draftWarnings.set(layout.id, restored.warning ?? storageWarning ?? null);
}

let selectedBaseId = LAYOUTS[0].id;
let selectedTool = "align";
let selectedEntity = null;
let preview = null;
let activePointerId = null;
let activePointerOwner = null;
let pointerInteraction = null;
let wallStroke = null;
let validationFeedback = null;
let interactionMessage = null;

function currentHistory() {
  return histories.get(selectedBaseId);
}

function render() {
  const focusTarget = captureEditorFocus();
  const state = currentHistory().present;
  const geometry = createRaidIsoGeometry(960, 560, LAYOUT_EDITOR_GRID);
  renderToolbar(state);
  renderCounts(state, layoutEditorWallReserve(state));
  renderEntityList(state, selectedEntity);
  renderStatus(state);
  // Both renderers deliberately receive the exact same canonical state object.
  renderSourceCanvas(state, preview);
  renderIsoCanvas(state, preview, geometry);
  restoreEditorFocus(focusTarget);
}

function captureEditorFocus() {
  const active = document.activeElement;
  if (elements.baseTabs.contains(active)) return { group: "base", id: active.dataset.baseId };
  if (elements.toolButtons.contains(active)) return { group: "tool", id: active.dataset.tool };
  if (elements.entityList.contains(active)) {
    return { group: "entity", kind: active.dataset.entityKind, id: active.dataset.entityId };
  }
  return null;
}

function restoreEditorFocus(target) {
  if (!target) return;
  const container = {
    base: elements.baseTabs,
    tool: elements.toolButtons,
    entity: elements.entityList,
  }[target.group];
  const button = [...container.querySelectorAll("button")].find((candidate) => {
    if (target.group === "base") return candidate.dataset.baseId === target.id;
    if (target.group === "tool") return candidate.dataset.tool === target.id;
    return candidate.dataset.entityKind === target.kind && candidate.dataset.entityId === target.id;
  });
  button?.focus({ preventScroll: true });
}

function renderToolbar(state) {
  elements.baseTabs.replaceChildren(...LAYOUTS.map((layout) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = BASE_LABELS[layout.id];
    button.dataset.baseId = layout.id;
    button.setAttribute("aria-pressed", String(layout.id === selectedBaseId));
    button.addEventListener("click", () => selectBase(layout.id));
    return button;
  }));

  const reserve = layoutEditorWallReserve(state);
  elements.toolButtons.replaceChildren(...TOOLS.map((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tool.label;
    button.dataset.tool = tool.id;
    button.setAttribute("aria-pressed", String(tool.id === selectedTool));
    button.disabled = tool.id === "paint" && reserve === 0;
    button.addEventListener("click", () => {
      cancelPointerInteraction();
      selectedTool = tool.id;
      validationFeedback = null;
      interactionMessage = tool.id === "align"
        ? "Faites glisser une des trois poignees dans la vue de la capture."
        : null;
      render();
    });
    return button;
  }));

  elements.undoEditor.disabled = currentHistory().past.length === 0;
  elements.redoEditor.disabled = currentHistory().future.length === 0;
}

function renderCounts(state, reserve) {
  elements.counts.textContent = [
    `${state.buildings.length} batiments`,
    `${state.walls.length} murs places`,
    `${reserve} murs en reserve`,
    `${state.traps.length} bombes`,
  ].join(" - ");
}

function renderEntityList(state, selection) {
  const groups = [
    ["building", state.buildings],
    ["wall", state.walls],
    ["trap", state.traps],
  ];
  elements.entityList.replaceChildren(...groups.map(([kind, entities]) => {
    const section = document.createElement("section");
    section.className = "entity-group";
    const heading = document.createElement("h3");
    heading.textContent = `${KIND_LABELS[kind]} (${entities.length})`;
    section.append(heading);
    for (const entity of entities) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.entityKind = kind;
      button.dataset.entityId = entity.id;
      button.setAttribute("aria-pressed", String(
        selection?.kind === kind && selection.id === entity.id,
      ));
      button.classList.toggle(
        "is-invalid",
        Boolean(validationFeedback?.highlights.errorIds.has(entity.id)),
      );
      button.classList.toggle(
        "is-warning",
        Boolean(validationFeedback?.highlights.warningIds.has(entity.id)),
      );
      const name = ENTITY_TYPE_LABELS[entity.type] ?? "Element";
      const label = document.createElement("span");
      label.textContent = name;
      const stableId = document.createElement("small");
      stableId.textContent = entity.id;
      button.append(label, stableId);
      button.addEventListener("click", () => {
        selectedEntity = { kind, id: entity.id };
        validationFeedback = null;
        render();
      });
      section.append(button);
    }
    return section;
  }));
}

function renderStatus() {
  const parts = [];
  const draftWarning = draftWarnings.get(selectedBaseId);
  const sourceMessage = sourceMessages.get(selectedBaseId);
  if (draftWarning) parts.push(`Avertissement de brouillon : ${draftWarning}.`);
  if (sourceMessage) parts.push(sourceMessage);
  if (interactionMessage) parts.push(interactionMessage);
  if (validationFeedback) parts.push(validationFeedback.message);
  if (!parts.length) {
    parts.push("Brouillon local charge. Validez le village avant d'utiliser les coordonnees.");
  }
  elements.status.textContent = parts.join(" ");
  elements.status.classList.toggle("is-invalid", validationFeedback?.kind === "error");
  elements.status.classList.toggle(
    "is-warning",
    Boolean(draftWarning) || validationFeedback?.kind === "warning" ||
      Boolean(interactionMessage && /impossible|hors|chevauche|insuffisante/i.test(interactionMessage)),
  );
}

function renderSourceCanvas(state, activePreview) {
  const canvas = elements.sourceCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b111a";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const record = sourceImages.get(state.baseId);
  let drawRect = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  let naturalWidth = canvas.width;
  let naturalHeight = canvas.height;
  if (record?.image?.complete && record.image.naturalWidth > 0) {
    naturalWidth = record.image.naturalWidth;
    naturalHeight = record.image.naturalHeight;
    drawRect = containRect(
      naturalWidth,
      naturalHeight,
      canvas.width,
      canvas.height,
    );
    context.drawImage(record.image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  } else {
    context.fillStyle = "#8492a6";
    context.font = "20px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("Choisissez une capture locale pour cette vue", canvas.width / 2, 48);
  }
  if (record) record.drawRect = drawRect;
  const transform = { drawRect, naturalWidth, naturalHeight };
  const renderedState = activePreview?.kind === "alignment"
    ? setLayoutEditorCalibration(state, activePreview.calibration)
    : state;

  drawSourceGrid(context, renderedState.calibration, transform);
  drawSourceEntities(context, renderedState, transform, activePreview);
  drawSourceValidationHighlights(context, renderedState, transform);
  if (selectedTool === "align") {
    drawCalibrationHandles(context, renderedState.calibration, transform, activePreview);
  }
}

function renderIsoCanvas(state, activePreview, geometry) {
  const canvas = elements.isoCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111a23";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawIsoGrid(context, geometry);
  for (const [kind, entities] of stateEntities(state)) {
    for (const entity of entities) {
      const normalized = normalizedEntity(entity);
      drawPolygon(
        context,
        projectRaidFootprint(geometry, normalized),
        entityFill(kind),
        entityStroke(kind, entity.id),
      );
    }
  }
  if (activePreview?.kind === "entity") {
    drawPolygon(context, projectRaidFootprint(geometry, normalizedEntity(activePreview.entity)),
      previewFill(activePreview.valid), previewStroke(activePreview.valid));
  }
  if (activePreview?.kind === "wall-stroke") {
    for (const cell of activePreview.cells) {
      drawPolygon(context, projectRaidFootprint(geometry, { ...cell, width: 1, height: 1 }),
        previewFill(activePreview.valid), previewStroke(activePreview.valid));
    }
  }
  drawIsoValidationHighlights(context, geometry);
}

function drawSourceGrid(context, calibration, transform) {
  context.save();
  context.strokeStyle = "rgba(148, 163, 184, .22)";
  context.lineWidth = 1;
  for (let x = 0; x <= LAYOUT_EDITOR_GRID.width; x += 1) {
    drawSourceLine(context, calibration, transform, { x, y: 0 }, {
      x,
      y: LAYOUT_EDITOR_GRID.height,
    });
  }
  for (let y = 0; y <= LAYOUT_EDITOR_GRID.height; y += 1) {
    drawSourceLine(context, calibration, transform, { x: 0, y }, {
      x: LAYOUT_EDITOR_GRID.width,
      y,
    });
  }
  context.restore();
}

function drawSourceLine(context, calibration, transform, from, to) {
  const start = sourcePoint(calibration, transform, from);
  const end = sourcePoint(calibration, transform, to);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawSourceEntities(context, state, transform, activePreview) {
  for (const [kind, entities] of stateEntities(state)) {
    for (const entity of entities) {
      const width = entity.width ?? 1;
      const height = entity.height ?? 1;
      const points = [
        { x: entity.x, y: entity.y },
        { x: entity.x + width, y: entity.y },
        { x: entity.x + width, y: entity.y + height },
        { x: entity.x, y: entity.y + height },
      ].map((point) => sourcePoint(state.calibration, transform, point));
      drawPolygon(context, points, entityFill(kind), entityStroke(kind, entity.id));
    }
  }
  if (activePreview?.kind === "entity") {
    drawSourcePreviewEntity(context, state.calibration, transform, activePreview.entity,
      activePreview.valid);
  }
  if (activePreview?.kind === "wall-stroke") {
    for (const cell of activePreview.cells) {
      drawSourcePreviewEntity(context, state.calibration, transform,
        { ...cell, width: 1, height: 1 }, activePreview.valid);
    }
  }
}

function drawSourcePreviewEntity(context, calibration, transform, entity, valid) {
  const width = entity.width ?? 1;
  const height = entity.height ?? 1;
  const points = [
    { x: entity.x, y: entity.y },
    { x: entity.x + width, y: entity.y },
    { x: entity.x + width, y: entity.y + height },
    { x: entity.x, y: entity.y + height },
  ].map((point) => sourcePoint(calibration, transform, point));
  drawPolygon(context, points, previewFill(valid), previewStroke(valid));
}

function previewFill(valid) {
  return valid ? "rgba(94, 234, 212, .26)" : "rgba(251, 113, 133, .28)";
}

function previewStroke(valid) {
  return valid ? "#5eead4" : "#fb7185";
}

function drawIsoGrid(context, geometry) {
  context.save();
  context.strokeStyle = "rgba(148, 163, 184, .2)";
  context.lineWidth = 1;
  for (let x = 0; x <= LAYOUT_EDITOR_GRID.width; x += 1) {
    const start = projectRaidPoint(geometry, { x, y: 0 });
    const end = projectRaidPoint(geometry, { x, y: LAYOUT_EDITOR_GRID.height });
    drawLine(context, start, end);
  }
  for (let y = 0; y <= LAYOUT_EDITOR_GRID.height; y += 1) {
    const start = projectRaidPoint(geometry, { x: 0, y });
    const end = projectRaidPoint(geometry, { x: LAYOUT_EDITOR_GRID.width, y });
    drawLine(context, start, end);
  }
  context.restore();
}

function drawLine(context, start, end) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawPolygon(context, points, fill, stroke) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = stroke === "#fb7185" ? 3 : 1.5;
  context.stroke();
}

function sourcePoint(calibration, transform, point) {
  const projected = projectEditorGridPoint(calibration, point);
  return sourceImageToCanvasPoint(transform, projected);
}

function sourceImageToCanvasPoint(transform, point) {
  const { drawRect, naturalWidth, naturalHeight } = transform;
  return {
    x: drawRect.x + point.x / naturalWidth * drawRect.width,
    y: drawRect.y + point.y / naturalHeight * drawRect.height,
  };
}

function calibrationHandles(calibration) {
  const { anchorPx, columnBasis, rowBasis, axisCells } = calibration;
  return {
    anchor: { ...anchorPx },
    column: {
      x: anchorPx.x + columnBasis.x * axisCells,
      y: anchorPx.y + columnBasis.y * axisCells,
    },
    row: {
      x: anchorPx.x + rowBasis.x * axisCells,
      y: anchorPx.y + rowBasis.y * axisCells,
    },
  };
}

function drawCalibrationHandles(context, calibration, transform, activePreview) {
  const colors = { anchor: "#f8fafc", column: "#5eead4", row: "#60a5fa" };
  for (const [name, imagePoint] of Object.entries(calibrationHandles(calibration))) {
    const point = sourceImageToCanvasPoint(transform, imagePoint);
    context.beginPath();
    context.arc(point.x, point.y, activePreview?.handle === name ? 10 : 7, 0, Math.PI * 2);
    context.fillStyle = colors[name];
    context.fill();
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
    context.stroke();
  }
}

function stateEntities(state) {
  return [
    ["wall", state.walls],
    ["trap", state.traps],
    ["building", state.buildings],
  ];
}

function createValidationHighlights(state, result) {
  const errorIds = new Set();
  const errorCells = new Set();
  const warningIds = new Set();
  const warningCells = new Set();
  const buildingIds = new Set(state.buildings.map(({ id }) => id));
  const trapIds = new Set(state.traps.map(({ id }) => id));
  const missingBuildingIds = state.requiredBuildingIds.filter((id) => !buildingIds.has(id));
  const missingTrapIds = state.requiredTrapIds.filter((id) => !trapIds.has(id));
  const unexpectedBuildingIds = [...buildingIds].filter(
    (id) => !state.requiredBuildingIds.includes(id),
  );
  const unexpectedTrapIds = [...trapIds].filter((id) => !state.requiredTrapIds.includes(id));

  if (result.errors.some((message) => /22 batiments/i.test(message))) {
    addEntitiesToHighlights(state.buildings, errorIds, errorCells);
    for (const id of missingBuildingIds) errorIds.add(id);
  }
  if (result.errors.some((message) => /50 murs/i.test(message))) {
    addEntitiesToHighlights(state.walls, errorIds, errorCells);
  }
  if (result.errors.some((message) => /2 bombes/i.test(message))) {
    addEntitiesToHighlights(state.traps, errorIds, errorCells);
    for (const id of missingTrapIds) errorIds.add(id);
  }
  for (const id of [
    ...missingBuildingIds,
    ...missingTrapIds,
    ...unexpectedBuildingIds,
    ...unexpectedTrapIds,
  ]) errorIds.add(id);
  addEntitiesToHighlights(
    state.buildings.filter(({ id }) => unexpectedBuildingIds.includes(id)),
    errorIds,
    errorCells,
  );
  addEntitiesToHighlights(
    state.traps.filter(({ id }) => unexpectedTrapIds.includes(id)),
    errorIds,
    errorCells,
  );

  const occupied = new Map();
  const overlap = new Set();
  const offGrid = new Set();
  for (const [, entities] of stateEntities(state)) {
    for (const entity of entities) {
      for (const cell of entityFootprintCells(entity)) {
        const key = cellKey(cell);
        if (!insideEditorGrid(cell)) {
          offGrid.add(key);
          errorIds.add(entity.id);
          errorCells.add(key);
        }
        const previousId = occupied.get(key);
        if (previousId) {
          overlap.add(key);
          errorIds.add(previousId);
          errorIds.add(entity.id);
          errorCells.add(key);
        } else {
          occupied.set(key, entity.id);
        }
      }
    }
  }

  const components = wallComponents(state.walls).sort((left, right) => right.length - left.length);
  const disconnectedWallCells = result.warnings.some((message) => /deconnect/i.test(message))
    ? components.slice(1).flat()
    : [];
  for (const wall of disconnectedWallCells) {
    warningIds.add(wall.id);
    warningCells.add(cellKey(wall));
  }
  return {
    errorIds,
    errorCells,
    warningIds,
    warningCells,
    missingBuildingIds,
    missingTrapIds,
    overlap,
    offGrid,
    disconnectedWallCells,
  };
}

function addEntitiesToHighlights(entities, ids, cells) {
  for (const entity of entities) {
    ids.add(entity.id);
    for (const cell of entityFootprintCells(entity)) cells.add(cellKey(cell));
  }
}

function entityFootprintCells(entity) {
  const width = entity.width ?? 1;
  const height = entity.height ?? 1;
  return Array.from({ length: width * height }, (_, index) => ({
    x: entity.x + index % width,
    y: entity.y + Math.floor(index / width),
  }));
}

function insideEditorGrid({ x, y }) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
    x < LAYOUT_EDITOR_GRID.width && y < LAYOUT_EDITOR_GRID.height;
}

function cellKey({ x, y }) {
  return `${x},${y}`;
}

function parseCellKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function wallComponents(walls) {
  const byCell = new Map(walls.map((wall) => [cellKey(wall), wall]));
  const remaining = new Set(byCell.keys());
  const components = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    const queue = [first];
    const component = [];
    remaining.delete(first);
    while (queue.length) {
      const key = queue.shift();
      const wall = byCell.get(key);
      component.push(wall);
      for (const neighbor of [
        { x: wall.x + 1, y: wall.y },
        { x: wall.x - 1, y: wall.y },
        { x: wall.x, y: wall.y + 1 },
        { x: wall.x, y: wall.y - 1 },
      ].map(cellKey)) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function normalizedEntity(entity) {
  return { ...entity, width: entity.width ?? 1, height: entity.height ?? 1 };
}

function entityFill(kind) {
  if (kind === "wall") return "rgba(148, 163, 184, .72)";
  if (kind === "trap") return "rgba(251, 191, 36, .7)";
  return "rgba(45, 212, 191, .5)";
}

function entityStroke(kind, id) {
  if (validationFeedback?.highlights.errorIds.has(id)) return "#fb7185";
  if (validationFeedback?.highlights.warningIds.has(id)) return "#facc15";
  if (selectedEntity?.kind === kind && selectedEntity.id === id) return "#facc15";
  return kind === "building" ? "#99f6e4" : "#e2e8f0";
}

function drawSourceValidationHighlights(context, state, drawRect) {
  const highlights = validationFeedback ? validationFeedback.highlights : null;
  if (!highlights) return;
  const projectCell = ({ x, y }) => [
    { x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 },
  ].map((point) => sourcePoint(state.calibration, drawRect, point));
  drawCellHighlights(context, highlights.warningCells, projectCell, "#facc15");
  drawCellHighlights(context, highlights.errorCells, projectCell, "#fb7185");
}

function drawIsoValidationHighlights(context, geometry) {
  const highlights = validationFeedback ? validationFeedback.highlights : null;
  if (!highlights) return;
  const projectCell = (cell) => projectRaidFootprint(
    geometry,
    { ...cell, width: 1, height: 1 },
  );
  drawCellHighlights(context, highlights.warningCells, projectCell, "#facc15");
  drawCellHighlights(context, highlights.errorCells, projectCell, "#fb7185");
}

function drawCellHighlights(context, cells, projectCell, color) {
  for (const key of cells) {
    drawPolygon(context, projectCell(parseCellKey(key)), "rgba(0, 0, 0, 0)", color);
  }
}

function containRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function selectBase(baseId) {
  if (baseId === selectedBaseId) return;
  cancelPointerInteraction();
  selectedBaseId = baseId;
  selectedEntity = null;
  validationFeedback = null;
  interactionMessage = null;
  elements.sourceImage.value = "";
  invalidateExport();
  render();
}

function persistCurrentDraft() {
  try {
    localStorage.setItem(
      layoutEditorDraftKey(selectedBaseId),
      serializeLayoutEditorDraft(currentHistory().present),
    );
  } catch {
    sourceMessages.set(selectedBaseId, "Le brouillon ne peut pas etre enregistre localement.");
  }
}

function readDraft(baseId) {
  try {
    return localStorage.getItem(layoutEditorDraftKey(baseId));
  } catch {
    draftWarnings.set(baseId, "Stockage local indisponible");
    return null;
  }
}

function replaceCurrentHistory(nextHistory) {
  histories.set(selectedBaseId, nextHistory);
  validationFeedback = null;
  interactionMessage = null;
  invalidateExport();
  persistCurrentDraft();
  render();
}

function commitEditorState(nextState) {
  const history = currentHistory();
  const nextHistory = commitLayoutEditorHistory(history, nextState);
  preview = null;
  if (nextHistory === history) {
    render();
    return false;
  }
  histories.set(selectedBaseId, nextHistory);
  validationFeedback = null;
  interactionMessage = null;
  persistCurrentDraft();
  invalidateExport();
  render();
  return true;
}

function invalidateExport() {
  elements.exportPanel.hidden = true;
  elements.exportJson.value = "";
}

elements.undoEditor.addEventListener("click", () => {
  replaceCurrentHistory(undoLayoutEditorHistory(currentHistory()));
});

elements.redoEditor.addEventListener("click", () => {
  replaceCurrentHistory(redoLayoutEditorHistory(currentHistory()));
});

elements.resetEditor.addEventListener("click", () => {
  const accepted = window.confirm("Reinitialiser ce village ?");
  if (!accepted) return;
  replaceCurrentHistory(resetLayoutEditorHistory(currentHistory()));
});

elements.validateEditor.addEventListener("click", () => {
  const state = currentHistory().present;
  const result = validateLayoutEditorState(state);
  const highlights = createValidationHighlights(state, result);
  if (!result.valid) {
    validationFeedback = {
      kind: "error",
      highlights,
      message: `Validation bloquee : ${result.errors.join(" ; ")}. ${highlightSummary(highlights)}`,
    };
    invalidateExport();
    render();
    return;
  }
  elements.exportJson.value = serializeLayoutEditorExport(state);
  elements.exportPanel.hidden = false;
  validationFeedback = {
    kind: result.warnings.length ? "warning" : "success",
    highlights,
    message: result.warnings.length
      ? `Village valide avec avertissement : ${result.warnings.join(" ; ")}. ${highlightSummary(highlights)}`
      : "Village valide. Les coordonnees affichees correspondent aux deux vues.",
  };
  render();
});

function highlightSummary(highlights) {
  const ids = [...new Set([...highlights.errorIds, ...highlights.warningIds])];
  const cells = [...new Set([...highlights.errorCells, ...highlights.warningCells])];
  const summarize = (values) => {
    const visible = values.slice(0, 8).join(", ");
    return values.length > 8 ? `${visible} (+${values.length - 8})` : visible;
  };
  const parts = [];
  if (ids.length) parts.push(`IDs : ${summarize(ids)}`);
  if (cells.length) parts.push(`cases : ${summarize(cells)}`);
  return parts.length ? `A verifier - ${parts.join(" ; ")}.` : "";
}

elements.sourceImage.addEventListener("change", () => {
  const [file] = elements.sourceImage.files;
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  loadSourceImage(selectedBaseId, objectUrl, true);
});

function loadSourceImage(baseId, source, isObjectUrl = false) {
  if (!isObjectUrl) {
    const url = new URL(source, location.href);
    if (url.origin !== location.origin) {
      sourceMessages.set(baseId, "Source refusee : l'URL doit utiliser la meme origine.");
      if (baseId === selectedBaseId) render();
      return;
    }
    source = url.href;
  }

  revokeSourceImage(baseId);
  const image = new Image();
  const record = { image, url: source, isObjectUrl, drawRect: null };
  sourceImages.set(baseId, record);
  sourceMessages.set(
    baseId,
    isObjectUrl
      ? "Image locale temporaire chargee pour ce village."
      : "Image de developpement same-origin chargee pour ce village.",
  );
  image.addEventListener("load", () => {
    if (sourceImages.get(baseId) !== record) return;
    if (baseId === selectedBaseId) render();
  }, { once: true });
  image.addEventListener("error", () => {
    if (sourceImages.get(baseId) !== record) return;
    sourceMessages.set(baseId, "Image source illisible - choisissez un autre fichier");
    revokeSourceImage(baseId);
    if (baseId === selectedBaseId) render();
  }, { once: true });
  image.src = source;
}

function revokeSourceImage(baseId) {
  const previous = sourceImages.get(baseId);
  if (previous?.isObjectUrl) URL.revokeObjectURL(previous.url);
  sourceImages.delete(baseId);
}

function pointerPosition(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height,
  };
}

function pointInsideRect(point, rect) {
  return point.x >= rect.x && point.y >= rect.y &&
    point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}

function currentSourceTransform() {
  const canvas = elements.sourceCanvas;
  const record = sourceImages.get(selectedBaseId);
  if (record?.image?.complete && record.image.naturalWidth > 0) {
    return {
      drawRect: record.drawRect ?? containRect(
        record.image.naturalWidth,
        record.image.naturalHeight,
        canvas.width,
        canvas.height,
      ),
      naturalWidth: record.image.naturalWidth,
      naturalHeight: record.image.naturalHeight,
    };
  }
  return {
    drawRect: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  };
}

function sourceImagePoint(canvasPoint) {
  const transform = currentSourceTransform();
  if (!pointInsideRect(canvasPoint, transform.drawRect)) return null;
  return {
    x: (canvasPoint.x - transform.drawRect.x) / transform.drawRect.width *
      transform.naturalWidth,
    y: (canvasPoint.y - transform.drawRect.y) / transform.drawRect.height *
      transform.naturalHeight,
  };
}

function pointerGridPoint(canvas, event, state) {
  const canvasPoint = pointerPosition(event, canvas);
  if (canvas === elements.isoCanvas) {
    return snapEditorGridPoint(unprojectRaidPoint(
      createRaidIsoGeometry(960, 560, LAYOUT_EDITOR_GRID),
      canvasPoint,
    ));
  }
  const imagePoint = sourceImagePoint(canvasPoint);
  if (!imagePoint) return null;
  const world = unprojectEditorScreenshotPoint(state.calibration, imagePoint);
  return world ? snapEditorGridPoint(world) : null;
}

function capturePointer(event) {
  activePointerId = event.pointerId;
  activePointerOwner = event.currentTarget;
  activePointerOwner.setPointerCapture(event.pointerId);
}

function findDraggableEntity(state, cell) {
  const candidates = [
    ...state.traps.map((entity) => ({ kind: "trap", entity })),
    ...state.buildings.map((entity) => ({ kind: "building", entity })),
  ];
  const selected = candidates.find(({ kind, entity }) =>
    selectedEntity?.kind === kind && selectedEntity.id === entity.id &&
    entityContainsCell(entity, cell)
  );
  return selected ?? candidates.find(({ entity }) => entityContainsCell(entity, cell)) ?? null;
}

function entityContainsCell(entity, cell) {
  return cell.x >= entity.x && cell.x < entity.x + (entity.width ?? 1) &&
    cell.y >= entity.y && cell.y < entity.y + (entity.height ?? 1);
}

function updateEntityPreview(cell) {
  if (!pointerInteraction) return;
  if (!cell) {
    preview = {
      ...preview,
      kind: "entity",
      cell: null,
      valid: false,
      error: "Pointeur hors de l'image source",
    };
    interactionMessage = preview.error;
    render();
    return;
  }
  const state = currentHistory().present;
  const collection = pointerInteraction.selection.kind === "building"
    ? state.buildings
    : state.traps;
  const entity = collection.find(({ id }) => id === pointerInteraction.selection.id);
  if (!entity) return;
  const candidateOrigin = {
    x: cell.x - pointerInteraction.grabOffset.x,
    y: cell.y - pointerInteraction.grabOffset.y,
  };
  const result = moveLayoutEditorEntity(state, pointerInteraction.selection, candidateOrigin);
  preview = {
    kind: "entity",
    selection: pointerInteraction.selection,
    entity: { ...entity, ...candidateOrigin },
    cell: candidateOrigin,
    valid: !result.error,
    error: result.error,
  };
  interactionMessage = result.error;
  render();
}

function commitEntityDrop(cell) {
  const history = currentHistory();
  const result = moveLayoutEditorEntity(history.present, selectedEntity, cell);
  if (result.error) {
    interactionMessage = result.error;
    preview = null;
    render();
    return;
  }
  commitEditorState(result.state);
}

function startWallStroke(mode, cell) {
  wallStroke = {
    mode,
    cells: new Map([[cellKey(cell), cell]]),
    lastCell: cell,
  };
  extendWallStroke(cell);
}

function extendWallStroke(cell) {
  if (!wallStroke || !cell) return;
  for (const interpolated of interpolateWallCells(wallStroke.lastCell, cell)) {
    wallStroke.cells.set(cellKey(interpolated), interpolated);
  }
  wallStroke.lastCell = cell;
  const cells = [...wallStroke.cells.values()];
  const result = applyLayoutEditorWallStroke(
    currentHistory().present,
    wallStroke.mode,
    cells,
  );
  preview = {
    kind: "wall-stroke",
    mode: wallStroke.mode,
    cells,
    valid: !result.error,
    error: result.error,
  };
  interactionMessage = result.error;
  render();
}

function interpolateWallCells(from, to) {
  const cells = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;
  while (true) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) break;
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }
  }
  return cells;
}

function finishWallStroke() {
  if (!wallStroke) return;
  const history = currentHistory();
  const result = applyLayoutEditorWallStroke(
    history.present,
    wallStroke.mode,
    [...wallStroke.cells.values()],
  );
  wallStroke = null;
  preview = null;
  if (result.error) {
    interactionMessage = result.error;
    render();
    return;
  }
  commitEditorState(result.state);
}

function closestCalibrationHandle(event) {
  const canvasPoint = pointerPosition(event, elements.sourceCanvas);
  const transform = currentSourceTransform();
  const handles = calibrationHandles(currentHistory().present.calibration);
  let closest = null;
  for (const [name, imagePoint] of Object.entries(handles)) {
    const point = sourceImageToCanvasPoint(transform, imagePoint);
    const distance = Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y);
    if (distance <= 18 && (!closest || distance < closest.distance)) {
      closest = { name, distance };
    }
  }
  return closest?.name ?? null;
}

function updateAlignmentPreview(event) {
  const imagePoint = sourceImagePoint(pointerPosition(event, elements.sourceCanvas));
  if (pointerInteraction?.kind !== "alignment") return;
  if (!imagePoint) {
    preview = null;
    interactionMessage = "Poignee hors de l'image source - alignement annule.";
    render();
    return;
  }
  const handles = calibrationHandles(pointerInteraction.calibration);
  handles[pointerInteraction.handle] = imagePoint;
  preview = {
    kind: "alignment",
    handle: pointerInteraction.handle,
    calibration: createScreenshotCalibration(
      handles.anchor,
      handles.column,
      handles.row,
      pointerInteraction.calibration.anchorGrid,
      pointerInteraction.calibration.axisCells,
    ),
  };
  interactionMessage = "Apercu d'alignement - relachez pour appliquer.";
  render();
}

function beginPointerInteraction(event) {
  if (activePointerId !== null || event.button !== 0) return;
  const canvas = event.currentTarget;
  const state = currentHistory().present;
  if (selectedTool === "align") {
    if (canvas !== elements.sourceCanvas) {
      interactionMessage = "Les poignees d'alignement se reglent sur la capture originale.";
      render();
      return;
    }
    const handle = closestCalibrationHandle(event);
    if (!handle) {
      interactionMessage = "Saisissez une poignee blanche, cyan ou bleue.";
      render();
      return;
    }
    pointerInteraction = { kind: "alignment", handle, calibration: state.calibration };
    capturePointer(event);
    updateAlignmentPreview(event);
    return;
  }

  const cell = pointerGridPoint(canvas, event, state);
  if (!cell) return;
  if (selectedTool === "move") {
    const hit = findDraggableEntity(state, cell);
    if (!hit) {
      interactionMessage = "Selectionnez directement un batiment ou une bombe.";
      render();
      return;
    }
    selectedEntity = { kind: hit.kind, id: hit.entity.id };
    pointerInteraction = {
      kind: "entity",
      selection: selectedEntity,
      grabOffset: { x: cell.x - hit.entity.x, y: cell.y - hit.entity.y },
    };
    capturePointer(event);
    updateEntityPreview(cell);
    return;
  }

  if (selectedTool === "paint" || selectedTool === "erase") {
    if (selectedTool === "paint" && layoutEditorWallReserve(state) === 0) {
      interactionMessage = "Reserve de murs insuffisante.";
      render();
      return;
    }
    pointerInteraction = { kind: "wall-stroke" };
    startWallStroke(selectedTool, cell);
    capturePointer(event);
  }
}

function updatePointerInteraction(event) {
  if (event.pointerId !== activePointerId || !pointerInteraction) return;
  if (pointerInteraction.kind === "alignment") {
    updateAlignmentPreview(event);
    return;
  }
  const cell = pointerGridPoint(event.currentTarget, event, currentHistory().present);
  if (pointerInteraction.kind === "entity") updateEntityPreview(cell);
  if (pointerInteraction.kind === "wall-stroke") extendWallStroke(cell);
}

function endPointerInteraction(event) {
  if (event.pointerId !== activePointerId || !pointerInteraction) return;
  updatePointerInteraction(event);
  const completed = pointerInteraction;
  if (completed.kind === "alignment" && preview?.calibration) {
    commitEditorState(setLayoutEditorCalibration(currentHistory().present, preview.calibration));
  } else if (completed.kind === "entity" && preview?.cell) {
    if (preview.valid) commitEntityDrop(preview.cell);
    else {
      interactionMessage = preview.error;
      preview = null;
      render();
    }
  } else if (completed.kind === "wall-stroke") {
    finishWallStroke();
  }
  cancelPointerInteraction();
  render();
}

function cancelPointerInteraction() {
  const ownsPointer = activePointerOwner !== null && activePointerId !== null &&
    activePointerOwner.hasPointerCapture(activePointerId);
  if (ownsPointer) activePointerOwner.releasePointerCapture(activePointerId);
  activePointerId = null;
  activePointerOwner = null;
  pointerInteraction = null;
  wallStroke = null;
  preview = null;
}

for (const canvas of [elements.sourceCanvas, elements.isoCanvas]) {
  canvas.addEventListener("pointerdown", beginPointerInteraction);
  canvas.addEventListener("pointermove", updatePointerInteraction);
  canvas.addEventListener("pointerup", endPointerInteraction);
  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    cancelPointerInteraction();
    interactionMessage = "Interaction annulee.";
    render();
  });
  canvas.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId !== activePointerId) return;
    cancelPointerInteraction();
    render();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    cancelPointerInteraction();
    interactionMessage = "Interaction annulee.";
    render();
    return;
  }
  if (!selectedEntity || selectedEntity.kind === "wall" ||
    event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  let delta = null;
  if (event.key === "ArrowUp") delta = { x: 0, y: -1 };
  if (event.key === "ArrowDown") delta = { x: 0, y: 1 };
  if (event.key === "ArrowLeft") delta = { x: -1, y: 0 };
  if (event.key === "ArrowRight") delta = { x: 1, y: 0 };
  if (!delta) return;
  const state = currentHistory().present;
  const entities = selectedEntity.kind === "building" ? state.buildings : state.traps;
  const entity = entities.find(({ id }) => id === selectedEntity.id);
  if (!entity) return;
  event.preventDefault();
  commitEntityDrop({ x: entity.x + delta.x, y: entity.y + delta.y });
});

window.addEventListener("beforeunload", () => {
  for (const baseId of sourceImages.keys()) revokeSourceImage(baseId);
});

for (const [baseId, key] of Object.entries(SOURCE_KEYS)) {
  const source = params.get(key);
  if (source) loadSourceImage(baseId, source);
}
render();
