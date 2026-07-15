import { LAYOUTS } from "../src/village-raid-data.js";
import {
  createRaidTopDownGeometry,
  projectRaidTopDownFootprint,
  projectRaidTopDownPoint,
  unprojectRaidTopDownPoint,
} from "../src/village-raid-top-down.js";
import {
  applyLayoutEditorWallStroke,
  commitLayoutEditorHistory,
  createEmptyLayoutEditorState,
  createLayoutEditorHistory,
  isLayoutEditorEntityPlaced,
  LAYOUT_EDITOR_COUNTS,
  LAYOUT_EDITOR_GRID,
  layoutEditorDraftKey,
  layoutEditorReserveCounts,
  parseLayoutEditorDraft,
  placeLayoutEditorEntity,
  redoLayoutEditorHistory,
  removeLayoutEditorEntity,
  resetLayoutEditorHistory,
  serializeLayoutEditorDraft,
  serializeLayoutEditorExport,
  undoLayoutEditorHistory,
  validateLayoutEditorState,
} from "../src/village-raid-layout-editor.js";
import {
  drawRaidBuildingArtwork,
  RAID_BUILDING_NAMES,
} from "../src/village-raid-rendering.js";

const SOURCE_KEYS = Object.freeze({
  "farm-111": "source111",
  "war-26": "source26",
  "defence-104": "source104",
});
const BUNDLED_REFERENCE_SOURCES = Object.freeze({
  "farm-111": "../assets/village-raid-references/farm-111.jpg",
  "war-26": "../assets/village-raid-references/war-26.jpg",
  "defence-104": "../assets/village-raid-references/defence-104.jpg",
});
const BASE_LABELS = Object.freeze({
  "farm-111": "Ferme 111",
  "war-26": "Guerre 26",
  "defence-104": "Defense 104",
});
const TOOLS = Object.freeze([
  { id: "move", label: "Deplacer un element" },
  { id: "paint", label: "Peindre un mur" },
  { id: "erase", label: "Effacer un mur" },
]);
const ENTITY_DRAG_TYPE = "application/x-village-raid-entity";

const elements = {
  baseTabs: document.querySelector("#baseTabs"),
  toolButtons: document.querySelector("#toolButtons"),
  sourceImage: document.querySelector("#sourceImage"),
  sourceCanvas: document.querySelector("#sourceCanvas"),
  topDownCanvas: document.querySelector("#topDownCanvas"),
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
const sourceAttempts = new Map();
const bundledSourceAttempts = new Map();
const sourceMessages = new Map();

for (const layout of LAYOUTS) {
  const initial = createEmptyLayoutEditorState(layout);
  const storedDraft = readDraft(layout.id);
  const restored = storedDraft.serialized !== null
    ? parseLayoutEditorDraft(storedDraft.serialized, initial)
    : { state: initial, warning: null };
  histories.set(layout.id, {
    ...createLayoutEditorHistory(initial),
    present: restored.state,
  });
  draftWarnings.set(layout.id, restored.warning ?? storedDraft.warning ?? null);
}

let selectedBaseId = LAYOUTS[0].id;
let selectedTool = "move";
let selectedEntity = null;
let preview = null;
let keyboardCell = { x: 24, y: 16 };
let pointerInteraction = null;
let wallStroke = null;
let reserveDrag = null;
let validationFeedback = null;
let interactionMessage = null;
let interactionSeverity = null;

function currentHistory() {
  return histories.get(selectedBaseId);
}

function render() {
  const focusTarget = captureEditorFocus();
  const state = currentHistory().present;
  const geometry = createRaidTopDownGeometry(
    elements.topDownCanvas.width,
    elements.topDownCanvas.height,
    LAYOUT_EDITOR_GRID,
  );
  renderToolbar(state);
  const renderedState = wallStroke?.candidateState ?? state;
  renderCounts(renderedState);
  renderReserveList(state, selectedEntity);
  renderStatus();
  renderSourceCanvas();
  renderTopDownCanvas(renderedState, preview, geometry);
  restoreEditorFocus(focusTarget);
}

function renderTopDownOnly() {
  const geometry = createRaidTopDownGeometry(
    elements.topDownCanvas.width,
    elements.topDownCanvas.height,
    LAYOUT_EDITOR_GRID,
  );
  renderTopDownCanvas(currentHistory().present, preview, geometry);
}

function captureEditorFocus() {
  const active = document.activeElement;
  if (elements.baseTabs.contains(active)) return { group: "base", id: active.dataset.baseId };
  if (elements.toolButtons.contains(active)) return { group: "tool", id: active.dataset.tool };
  if (elements.entityList.contains(active)) {
    return { group: "entity", kind: active.dataset.entityKind, id: active.dataset.entityId };
  }
  return active === elements.topDownCanvas ? { group: "canvas" } : null;
}

function restoreEditorFocus(target) {
  if (!target) return;
  if (target.group === "canvas") {
    elements.topDownCanvas.focus({ preventScroll: true });
    return;
  }
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

  const reserve = layoutEditorReserveCounts(state);
  elements.toolButtons.replaceChildren(...TOOLS.map((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tool.label;
    button.dataset.tool = tool.id;
    button.setAttribute("aria-pressed", String(tool.id === selectedTool));
    button.disabled = tool.id === "paint" && reserve.walls === 0;
    button.addEventListener("click", () => {
      selectedEntity = null;
      selectedTool = tool.id;
      preview = null;
      validationFeedback = null;
      setInteractionMessage(null);
      render();
    });
    return button;
  }));

  elements.undoEditor.disabled = currentHistory().past.length === 0;
  elements.redoEditor.disabled = currentHistory().future.length === 0;
}

function renderCounts(state) {
  const reserve = layoutEditorReserveCounts(state);
  const placedBuildings = state.buildings.length - reserve.buildings;
  const placedTraps = state.traps.length - reserve.traps;
  elements.counts.textContent = [
    `${placedBuildings}/${LAYOUT_EDITOR_COUNTS.buildings} batiments places`,
    `${state.walls.length}/${LAYOUT_EDITOR_COUNTS.walls} murs places`,
    `${placedTraps}/${LAYOUT_EDITOR_COUNTS.traps} bombes placees`,
    `${reserve.buildings} batiments, ${reserve.walls} murs et ${reserve.traps} bombes en reserve`,
  ].join(" - ");
}

function renderReserveList(state, selection) {
  const reserve = [
    ...state.buildings.filter((entity) => !isLayoutEditorEntityPlaced(entity))
      .map((entity) => ({ kind: "building", entity })),
    ...state.traps.filter((entity) => !isLayoutEditorEntityPlaced(entity))
      .map((entity) => ({ kind: "trap", entity })),
  ];
  const placed = [
    ...state.buildings.filter(isLayoutEditorEntityPlaced)
      .map((entity) => ({ kind: "building", entity })),
    ...state.walls.map((entity) => ({ kind: "wall", entity })),
    ...state.traps.filter(isLayoutEditorEntityPlaced)
      .map((entity) => ({ kind: "trap", entity })),
  ];
  elements.entityList.replaceChildren(
    createEntityGroup("En reserve", "reserve", reserve, selection),
    createEntityGroup("Places", "placed", placed, selection),
  );
}

function createEntityGroup(title, variant, entries, selection) {
  const section = document.createElement("section");
  section.className = `entity-group entity-group--${variant}`;
  const heading = document.createElement("h3");
  heading.textContent = `${title} (${entries.length})`;
  section.append(heading);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "entity-group-empty";
    empty.textContent = variant === "reserve" ? "Reserve vide" : "Aucun element place";
    section.append(empty);
    return section;
  }
  for (const { kind, entity } of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.draggable = variant === "reserve";
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
    const label = document.createElement("span");
    label.textContent = entityLabel(kind, entity);
    const detail = document.createElement("small");
    detail.textContent = variant === "placed"
      ? `${entity.id} - case ${entity.x}, ${entity.y}`
      : `${entity.id} - ${entity.width ?? 1}x${entity.height ?? 1}`;
    button.append(label, detail);
    button.addEventListener("click", () => {
      selectedEntity = { kind, id: entity.id };
      if (isLayoutEditorEntityPlaced(entity)) keyboardCell = { x: entity.x, y: entity.y };
      validationFeedback = null;
      render();
      elements.topDownCanvas.focus({ preventScroll: true });
    });
    if (variant === "reserve") {
      button.addEventListener("dragstart", (event) => {
        const selection = { kind, id: entity.id };
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(ENTITY_DRAG_TYPE, JSON.stringify(selection));
        selectedEntity = selection;
        selectedTool = "move";
        reserveDrag = { accepted: false, rejectionReported: false };
        preview = null;
        validationFeedback = null;
        setInteractionMessage(null);
      });
      button.addEventListener("dragend", () => {
        const dragEndError = reserveDragEndError(reserveDrag);
        reserveDrag = null;
        preview = null;
        if (dragEndError) setInteractionMessage(dragEndError, "error");
        render();
      });
    }
    section.append(button);
  }
  return section;
}

function entityLabel(kind, entity) {
  if (kind === "building") return RAID_BUILDING_NAMES[entity.type] ?? entity.type;
  if (kind === "trap") return "Bombe";
  return "Mur";
}

function classifyEditorStatus(validationKind, hasDraftWarning, severity) {
  if (validationKind === "error" || severity === "error") return "error";
  if (validationKind === "warning" || hasDraftWarning || severity === "warning") {
    return "warning";
  }
  return null;
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
    parts.push("Village vide pret. Placez les elements en vous aidant de la photo originale.");
  }
  const severity = classifyEditorStatus(
    validationFeedback?.kind,
    Boolean(draftWarning),
    interactionSeverity,
  );
  elements.status.textContent = parts.join(" ");
  elements.status.classList.toggle("is-invalid", severity === "error");
  elements.status.classList.toggle("is-warning", severity === "warning");
}

function setInteractionMessage(message, severity = null) {
  interactionMessage = message;
  interactionSeverity = message ? severity : null;
}

function renderSourceCanvas() {
  const canvas = elements.sourceCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b111a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const record = sourceImages.get(selectedBaseId);
  if (record?.image?.complete && record.image.naturalWidth > 0) {
    const drawRect = containRect(
      record.image.naturalWidth,
      record.image.naturalHeight,
      canvas.width,
      canvas.height,
    );
    context.drawImage(record.image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    return;
  }
  context.fillStyle = "#8492a6";
  context.font = "20px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("Choisissez la photo originale de ce village", canvas.width / 2, 48);
}

function renderTopDownCanvas(state, activePreview, geometry) {
  const canvas = elements.topDownCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111a23";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#517c36";
  context.fillRect(
    geometry.bounds.left,
    geometry.bounds.top,
    geometry.bounds.right - geometry.bounds.left,
    geometry.bounds.bottom - geometry.bounds.top,
  );
  drawTopDownGrid(context, geometry);
  for (const wall of state.walls) drawWall(context, wall, geometry);
  for (const trap of state.traps.filter(isLayoutEditorEntityPlaced)) {
    drawBomb(context, trap, geometry);
  }
  for (const building of state.buildings.filter(isLayoutEditorEntityPlaced)) {
    drawRaidBuildingArtwork(
      context,
      building,
      geometry.bounds.left,
      geometry.bounds.top,
      geometry.tile,
    );
  }
  drawEntitySelection(context, state, geometry);
  drawTopDownPreview(context, activePreview, geometry);
  drawKeyboardCursor(context, geometry);
  drawTopDownValidationHighlights(context, geometry);
}

function drawTopDownGrid(context, geometry) {
  context.save();
  context.strokeStyle = "rgba(226, 232, 240, .2)";
  context.lineWidth = 1;
  for (let x = 0; x <= LAYOUT_EDITOR_GRID.width; x += 1) {
    drawLine(
      context,
      projectRaidTopDownPoint(geometry, { x, y: 0 }),
      projectRaidTopDownPoint(geometry, { x, y: LAYOUT_EDITOR_GRID.height }),
    );
  }
  for (let y = 0; y <= LAYOUT_EDITOR_GRID.height; y += 1) {
    drawLine(
      context,
      projectRaidTopDownPoint(geometry, { x: 0, y }),
      projectRaidTopDownPoint(geometry, { x: LAYOUT_EDITOR_GRID.width, y }),
    );
  }
  context.restore();
}

function drawLine(context, start, end) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawWall(context, wall, geometry) {
  const rect = projectRaidTopDownFootprint(geometry, { ...wall, width: 1, height: 1 });
  context.fillStyle = "#9099a3";
  context.fillRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  context.strokeStyle = "#303943";
  context.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  context.strokeStyle = "rgba(255, 255, 255, .28)";
  context.beginPath();
  context.moveTo(rect.x + 3, rect.y + rect.height / 2);
  context.lineTo(rect.x + rect.width - 3, rect.y + rect.height / 2);
  context.stroke();
}

function drawBomb(context, trap, geometry) {
  const rect = projectRaidTopDownFootprint(geometry, { ...trap, width: 1, height: 1 });
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  context.save();
  context.fillStyle = "#17191d";
  context.strokeStyle = "#050607";
  context.beginPath();
  context.arc(centerX, centerY, geometry.tile * 0.36, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = "#ef4444";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(centerX, centerY - geometry.tile * 0.3);
  context.lineTo(centerX + geometry.tile * 0.24, centerY - geometry.tile * 0.48);
  context.stroke();
  context.restore();
}

function drawEntitySelection(context, state, geometry) {
  if (!selectedEntity) return;
  const collection = selectedEntity.kind === "building"
    ? state.buildings
    : selectedEntity.kind === "trap" ? state.traps : state.walls;
  const entity = collection.find(({ id }) => id === selectedEntity.id);
  if (!entity || !isLayoutEditorEntityPlaced(entity)) return;
  drawRectOutline(context, projectRaidTopDownFootprint(geometry, normalizedEntity(entity)), "#facc15", 3);
}

function drawTopDownPreview(context, activePreview, geometry) {
  if (!activePreview?.entity || !isLayoutEditorEntityPlaced(activePreview.entity)) return;
  const color = activePreview.valid ? "#5eead4" : "#fb7185";
  const rect = projectRaidTopDownFootprint(geometry, normalizedEntity(activePreview.entity));
  context.fillStyle = activePreview.valid
    ? "rgba(94, 234, 212, .24)"
    : "rgba(251, 113, 133, .28)";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  drawRectOutline(context, rect, color, 3);
}

function drawKeyboardCursor(context, geometry) {
  const state = currentHistory().present;
  const entity = selectedEntity ? findSelectedEntity(state, selectedEntity) : null;
  const candidate = entity && selectedEntity.kind !== "wall"
    ? { ...entity, ...keyboardCell }
    : { ...keyboardCell, width: 1, height: 1 };
  const result = entity && selectedEntity.kind !== "wall"
    ? placeLayoutEditorEntity(state, selectedEntity, keyboardCell)
    : { error: null };
  const rect = projectRaidTopDownFootprint(geometry, normalizedEntity(candidate));
  drawRectOutline(context, rect, result.error ? "#fb7185" : "#5eead4", 2);
}

function drawRectOutline(context, rect, color, width) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  context.restore();
}

function stateEntities(state) {
  return [state.walls, state.traps, state.buildings];
}

function createValidationHighlights(state, result) {
  const errorIds = new Set();
  const errorCells = new Set();
  const warningIds = new Set();
  const warningCells = new Set();
  const missingBuildingIds = state.buildings
    .filter((entity) => !isLayoutEditorEntityPlaced(entity))
    .map(({ id }) => id);
  const missingTrapIds = state.traps
    .filter((entity) => !isLayoutEditorEntityPlaced(entity))
    .map(({ id }) => id);
  for (const id of [...missingBuildingIds, ...missingTrapIds]) errorIds.add(id);

  const occupied = new Map();
  const overlap = new Set();
  const offGrid = new Set();
  for (const entities of stateEntities(state)) {
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

function entityFootprintCells(entity) {
  if (!isLayoutEditorEntityPlaced(entity)) return [];
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

function drawTopDownValidationHighlights(context, geometry) {
  const highlights = validationFeedback ? validationFeedback.highlights : null;
  if (!highlights) return;
  drawCellHighlights(context, geometry, highlights.warningCells, "#facc15");
  drawCellHighlights(context, geometry, highlights.errorCells, "#fb7185");
}

function drawCellHighlights(context, geometry, cells, color) {
  for (const key of cells) {
    const rect = projectRaidTopDownFootprint(
      geometry,
      { ...parseCellKey(key), width: 1, height: 1 },
    );
    drawRectOutline(context, rect, color, 3);
  }
}

function normalizedEntity(entity) {
  return { ...entity, width: entity.width ?? 1, height: entity.height ?? 1 };
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
  selectedBaseId = baseId;
  selectedEntity = null;
  preview = null;
  keyboardCell = { x: 24, y: 16 };
  pointerInteraction = null;
  wallStroke = null;
  reserveDrag = null;
  validationFeedback = null;
  setInteractionMessage(null);
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

function legacyLayoutEditorDraftKey(baseId) {
  return `neuro-evolution-arcade.village-raid-layout-editor.v1.${baseId}`;
}

function resolveStoredDraft(storage, currentKey, legacyKey) {
  const serialized = storage.getItem(currentKey);
  if (serialized !== null) return { serialized, warning: null };
  const legacy = storage.getItem(legacyKey);
  return {
    serialized: null,
    warning: legacy === null ? null : "Brouillon v1 incompatible ignore",
  };
}

function readDraft(baseId) {
  try {
    return resolveStoredDraft(
      localStorage,
      layoutEditorDraftKey(baseId),
      legacyLayoutEditorDraftKey(baseId),
    );
  } catch {
    return { serialized: null, warning: "Stockage local indisponible" };
  }
}

function replaceCurrentHistory(nextHistory) {
  histories.set(selectedBaseId, nextHistory);
  preview = null;
  pointerInteraction = null;
  wallStroke = null;
  reserveDrag = null;
  validationFeedback = null;
  setInteractionMessage(null);
  invalidateExport();
  persistCurrentDraft();
  render();
}

function commitEditorState(nextState) {
  const history = currentHistory();
  const nextHistory = commitLayoutEditorHistory(history, nextState);
  preview = null;
  pointerInteraction = null;
  wallStroke = null;
  if (nextHistory === history) {
    render();
    return false;
  }
  histories.set(selectedBaseId, nextHistory);
  validationFeedback = null;
  setInteractionMessage(null);
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
  if (!window.confirm("Reinitialiser ce village et remettre tous les elements en reserve ?")) return;
  selectedEntity = null;
  pointerInteraction = null;
  wallStroke = null;
  replaceCurrentHistory(resetLayoutEditorHistory(currentHistory()));
});

elements.validateEditor.addEventListener("click", () => {
  setInteractionMessage(null);
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
      ? `Village valide avec avertissement : ${result.warnings.join(" ; ")}.`
      : "Village top-down valide. Les coordonnees affichees sont pretes a etre relues.",
  };
  render();
});

function highlightSummary(highlights) {
  const ids = [...new Set([...highlights.errorIds, ...highlights.warningIds])];
  if (!ids.length) return "";
  const visible = ids.slice(0, 8).join(", ");
  return `A verifier - IDs : ${visible}${ids.length > 8 ? ` (+${ids.length - 8})` : ""}.`;
}

function isWallKeyboardActivation(event) {
  return event.key === "Enter" || event.key === " " || event.code === "Space";
}

function applyWallAtKeyboardCell() {
  const result = applyLayoutEditorWallStroke(
    currentHistory().present,
    selectedTool,
    [keyboardCell],
  );
  if (result.error) {
    setInteractionMessage(result.error, "error");
    render();
    return false;
  }
  setInteractionMessage(null);
  return commitEditorState(result.state);
}

elements.topDownCanvas.addEventListener("keydown", (event) => {
  const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };
  if (event.key === "Escape") {
    event.preventDefault();
    cancelPointerInteraction();
    selectedEntity = null;
    setInteractionMessage("Selection annulee.");
    render();
    return;
  }
  const wallToolSelected = selectedTool === "paint" || selectedTool === "erase";
  if (wallToolSelected && isWallKeyboardActivation(event)) {
    event.preventDefault();
    applyWallAtKeyboardCell();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    removeSelectedEntity();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    placeSelectedEntityAtKeyboardCell();
    return;
  }
  const delta = directions[event.key];
  if (!delta) return;
  event.preventDefault();
  if (wallToolSelected) {
    keyboardCell = clampKeyboardCell({
      x: keyboardCell.x + delta.x,
      y: keyboardCell.y + delta.y,
    });
    setInteractionMessage(null);
    render();
    return;
  }
  const state = currentHistory().present;
  const entity = selectedEntity ? findSelectedEntity(state, selectedEntity) : null;
  if (entity && selectedEntity.kind !== "wall" && isLayoutEditorEntityPlaced(entity)) {
    const destination = { x: entity.x + delta.x, y: entity.y + delta.y };
    const result = placeLayoutEditorEntity(state, selectedEntity, destination);
    if (result.error) {
      setInteractionMessage(result.error, "error");
      preview = { entity: { ...entity, ...destination }, valid: false };
      render();
      return;
    }
    keyboardCell = destination;
    commitEditorState(result.state);
    return;
  }
  keyboardCell = clampKeyboardCell({
    x: keyboardCell.x + delta.x,
    y: keyboardCell.y + delta.y,
  });
  setInteractionMessage(null);
  render();
});

elements.topDownCanvas.addEventListener("dragover", (event) => {
  if (!hasEntityDragType(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const cell = topDownCellAtCanvasPoint(event);
  const entity = selectedEntity ? findSelectedEntity(currentHistory().present, selectedEntity) : null;
  if (!cell || !isReserveDragEntity(entity)) {
    preview = null;
    renderTopDownOnly();
    return;
  }
  const result = placeLayoutEditorEntity(currentHistory().present, selectedEntity, cell);
  preview = { entity: { ...entity, ...cell }, valid: !result.error };
  renderTopDownOnly();
});

elements.topDownCanvas.addEventListener("dragleave", () => {
  preview = null;
  renderTopDownOnly();
});

elements.topDownCanvas.addEventListener("drop", (event) => {
  event.preventDefault();
  const selection = parseEntityDragPayload(event.dataTransfer);
  if (!selection) {
    if (reserveDrag) reserveDrag.rejectionReported = true;
    setInteractionMessage("Depot refuse : element glisse invalide.", "error");
    preview = null;
    render();
    return;
  }
  const entity = findSelectedEntity(currentHistory().present, selection);
  if (!isReserveDragEntity(entity)) {
    if (reserveDrag) reserveDrag.rejectionReported = true;
    setInteractionMessage(
      "Depot refuse : cet element n'est plus disponible dans la reserve.",
      "error",
    );
    preview = null;
    render();
    return;
  }
  const cell = topDownCellAtCanvasPoint(event);
  if (!cell) {
    if (reserveDrag) reserveDrag.rejectionReported = true;
    setInteractionMessage("Depot refuse : position hors de la grille.", "error");
    preview = null;
    render();
    return;
  }
  const result = placeLayoutEditorEntity(currentHistory().present, selection, cell);
  if (result.error) {
    if (reserveDrag) reserveDrag.rejectionReported = true;
    setInteractionMessage(`Depot refuse : ${result.error}.`, "error");
    preview = { entity: candidateEntity(selection, cell), valid: false };
    render();
    return;
  }
  selectedEntity = selection;
  selectedTool = "move";
  keyboardCell = cell;
  if (reserveDrag) reserveDrag.accepted = true;
  commitEditorState(result.state);
});

elements.topDownCanvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  elements.topDownCanvas.focus({ preventScroll: true });
  const cell = topDownCellAtCanvasPoint(event);
  if (!cell) return;
  keyboardCell = cell;
  if (selectedTool === "paint" || selectedTool === "erase") {
    event.preventDefault();
    beginWallStroke(event.pointerId, cell);
    return;
  }
  const hit = hitTestPlacedEntity(currentHistory().present, cell);
  if (!hit) {
    selectedEntity = null;
    preview = null;
    render();
    return;
  }
  event.preventDefault();
  selectedEntity = hit.selection;
  pointerInteraction = {
    pointerId: event.pointerId,
    selection: hit.selection,
    grabOffset: { x: cell.x - hit.entity.x, y: cell.y - hit.entity.y },
  };
  elements.topDownCanvas.setPointerCapture?.(event.pointerId);
  preview = { entity: { ...hit.entity }, valid: true };
  render();
});

elements.topDownCanvas.addEventListener("pointermove", (event) => {
  if (wallStroke?.pointerId === event.pointerId) {
    const cell = topDownCellAtCanvasPoint(event);
    if (cell) extendWallStroke(cell);
    return;
  }
  if (pointerInteraction?.pointerId !== event.pointerId) return;
  const cell = topDownCellAtCanvasPoint(event);
  if (!cell) {
    preview = null;
    setInteractionMessage("Relachez ici pour remettre l'element en reserve.");
    render();
    return;
  }
  updateEntityDragPreview(cell);
});

elements.topDownCanvas.addEventListener("pointerup", (event) => {
  if (wallStroke?.pointerId === event.pointerId) {
    finishWallStroke();
    return;
  }
  if (pointerInteraction?.pointerId !== event.pointerId) return;
  const interaction = pointerInteraction;
  pointerInteraction = null;
  elements.topDownCanvas.releasePointerCapture?.(event.pointerId);
  const cell = topDownCellAtCanvasPoint(event);
  if (!cell) {
    preview = null;
    removeSelectedEntity();
    return;
  }
  const destination = dragDestination(cell, interaction.grabOffset);
  const result = placeLayoutEditorEntity(
    currentHistory().present,
    interaction.selection,
    destination,
  );
  preview = null;
  if (result.error) {
    setInteractionMessage(`${result.error}. Position precedente conservee.`, "error");
    render();
    return;
  }
  keyboardCell = destination;
  commitEditorState(result.state);
});

elements.topDownCanvas.addEventListener("pointercancel", () => {
  cancelPointerInteraction();
  setInteractionMessage("Geste annule. Position precedente conservee.");
  render();
});

function reserveDragEndError(drag) {
  if (!drag || drag.accepted || drag.rejectionReported) return null;
  return "Depot refuse : element relache hors de la grille.";
}

function hasEntityDragType(dataTransfer) {
  return Boolean(dataTransfer) && Array.from(dataTransfer.types ?? []).includes(ENTITY_DRAG_TYPE);
}

function parseEntityDragPayload(dataTransfer) {
  if (!hasEntityDragType(dataTransfer)) return null;
  try {
    const selection = JSON.parse(dataTransfer.getData(ENTITY_DRAG_TYPE));
    if (!selection || !["building", "trap"].includes(selection.kind) ||
      typeof selection.id !== "string") return null;
    return selection;
  } catch {
    return null;
  }
}

function findSelectedEntity(state, selection) {
  if (selection.kind === "building") {
    return state.buildings.find(({ id }) => id === selection.id) ?? null;
  }
  if (selection.kind === "trap") {
    return state.traps.find(({ id }) => id === selection.id) ?? null;
  }
  return state.walls.find(({ id }) => id === selection.id) ?? null;
}

function isReserveDragEntity(entity) {
  return Boolean(entity) && !isLayoutEditorEntityPlaced(entity);
}

function candidateEntity(selection, cell) {
  const entity = findSelectedEntity(currentHistory().present, selection);
  return entity ? { ...entity, ...cell } : null;
}

function hitTestPlacedEntity(state, cell) {
  const entries = [
    ...state.traps.filter(isLayoutEditorEntityPlaced)
      .map((entity) => ({ selection: { kind: "trap", id: entity.id }, entity })),
    ...state.buildings.filter(isLayoutEditorEntityPlaced)
      .map((entity) => ({ selection: { kind: "building", id: entity.id }, entity })),
  ];
  return entries.find(({ entity }) => entityFootprintCells(entity)
    .some(({ x, y }) => x === cell.x && y === cell.y)) ?? null;
}

function dragDestination(cell, grabOffset) {
  return { x: cell.x - grabOffset.x, y: cell.y - grabOffset.y };
}

function updateEntityDragPreview(cell) {
  const destination = dragDestination(cell, pointerInteraction.grabOffset);
  const result = placeLayoutEditorEntity(
    currentHistory().present,
    pointerInteraction.selection,
    destination,
  );
  preview = {
    entity: candidateEntity(pointerInteraction.selection, destination),
    valid: !result.error,
  };
  keyboardCell = clampKeyboardCell(destination);
  setInteractionMessage(result.error, result.error ? "error" : null);
  render();
}

function removeSelectedEntity() {
  if (!selectedEntity || selectedEntity.kind === "wall") {
    setInteractionMessage(selectedEntity?.kind === "wall"
      ? "Utilisez l'outil Effacer un mur."
      : "Selectionnez d'abord un batiment ou une bombe.");
    render();
    return false;
  }
  const result = removeLayoutEditorEntity(currentHistory().present, selectedEntity);
  if (result.error) {
    setInteractionMessage(result.error, "error");
    render();
    return false;
  }
  if (result.state === currentHistory().present) {
    setInteractionMessage("Cet element est deja en reserve.");
    render();
    return false;
  }
  preview = null;
  setInteractionMessage(null);
  return commitEditorState(result.state);
}

function placeSelectedEntityAtKeyboardCell() {
  if (!selectedEntity || selectedEntity.kind === "wall") {
    setInteractionMessage("Selectionnez un batiment ou une bombe dans la reserve.");
    render();
    return false;
  }
  const result = placeLayoutEditorEntity(
    currentHistory().present,
    selectedEntity,
    keyboardCell,
  );
  if (result.error) {
    setInteractionMessage(result.error, "error");
    preview = { entity: candidateEntity(selectedEntity, keyboardCell), valid: false };
    render();
    return false;
  }
  return commitEditorState(result.state);
}

function clampKeyboardCell(cell) {
  return {
    x: Math.max(0, Math.min(LAYOUT_EDITOR_GRID.width - 1, Math.trunc(cell.x))),
    y: Math.max(0, Math.min(LAYOUT_EDITOR_GRID.height - 1, Math.trunc(cell.y))),
  };
}

function beginWallStroke(pointerId, cell) {
  wallStroke = {
    pointerId,
    initialState: currentHistory().present,
    cells: [cell],
    candidateState: currentHistory().present,
    error: null,
  };
  elements.topDownCanvas.setPointerCapture?.(pointerId);
  updateWallStrokeCandidate();
}

function extendWallStroke(cell) {
  const last = wallStroke.cells.at(-1);
  if (last.x === cell.x && last.y === cell.y) return;
  wallStroke.cells.push(...interpolateGridCells(last, cell).slice(1));
  updateWallStrokeCandidate();
}

function interpolateGridCells(start, end) {
  const cells = [];
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const stepX = start.x < end.x ? 1 : -1;
  const stepY = start.y < end.y ? 1 : -1;
  let error = dx - dy;
  while (true) {
    cells.push({ x, y });
    if (x === end.x && y === end.y) return cells;
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
}

function updateWallStrokeCandidate() {
  const occupiedWalls = new Set(wallStroke.initialState.walls.map(cellKey));
  const paintsExistingWall = selectedTool === "paint" &&
    wallStroke.cells.some((cell) => occupiedWalls.has(cellKey(cell)));
  const result = paintsExistingWall
    ? { state: wallStroke.initialState, error: "Un mur occupe deja une case du geste" }
    : applyLayoutEditorWallStroke(
      wallStroke.initialState,
      selectedTool,
      wallStroke.cells,
    );
  wallStroke.candidateState = result.error ? wallStroke.initialState : result.state;
  wallStroke.error = result.error;
  setInteractionMessage(result.error, result.error ? "error" : null);
  render();
}

function finishWallStroke() {
  if (!wallStroke) return false;
  const { pointerId, initialState, candidateState, error } = wallStroke;
  wallStroke = null;
  elements.topDownCanvas.releasePointerCapture?.(pointerId);
  if (error) {
    setInteractionMessage(`${error}. Aucun mur du geste n'a ete modifie.`, "error");
    render();
    return false;
  }
  if (candidateState === initialState) {
    setInteractionMessage("Aucun mur modifie.");
    render();
    return false;
  }
  return commitEditorState(candidateState);
}

function cancelPointerInteraction() {
  pointerInteraction = null;
  wallStroke = null;
  preview = null;
}

function topDownCellAtCanvasPoint(event) {
  const canvas = elements.topDownCanvas;
  const bounds = canvas.getBoundingClientRect();
  const point = {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height,
  };
  const geometry = createRaidTopDownGeometry(canvas.width, canvas.height, LAYOUT_EDITOR_GRID);
  const gridPoint = unprojectRaidTopDownPoint(geometry, point);
  if (!gridPoint) return null;
  return {
    x: Math.min(LAYOUT_EDITOR_GRID.width - 1, Math.floor(gridPoint.x)),
    y: Math.min(LAYOUT_EDITOR_GRID.height - 1, Math.floor(gridPoint.y)),
  };
}

elements.sourceImage.addEventListener("change", () => {
  const [file] = elements.sourceImage.files;
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  loadSourceImage(selectedBaseId, objectUrl, true);
});

function loadSourceImage(baseId, source, isObjectUrl = false, isBundled = false) {
  if (!isObjectUrl) {
    try {
      const url = new URL(source, location.href);
      const pageUrl = new URL(location.href);
      const isFileSourceForFilePage = url.protocol === "file:" && pageUrl.protocol === "file:";
      if (!isFileSourceForFilePage && url.origin !== location.origin) {
        sourceMessages.set(baseId, "Source refusee : l'URL doit utiliser la meme origine.");
        if (baseId === selectedBaseId) render();
        return;
      }
      source = url.href;
    } catch {
      sourceMessages.set(baseId, "Source refusee : URL invalide.");
      if (baseId === selectedBaseId) render();
      return;
    }
  }

  const attempts = isBundled ? bundledSourceAttempts : sourceAttempts;
  const previousAttempt = attempts.get(baseId);
  if (previousAttempt?.isObjectUrl) URL.revokeObjectURL(previousAttempt.url);
  attempts.delete(baseId);

  const image = new Image();
  const record = { image, url: source, isObjectUrl, isBundled };
  attempts.set(baseId, record);
  sourceMessages.set(
    baseId,
    isObjectUrl
      ? "Chargement de l'image locale temporaire..."
      : "Chargement de la photo de reference...",
  );
  image.addEventListener("load", () => {
    if (attempts.get(baseId) !== record) return;
    attempts.delete(baseId);
    if (isBundled && sourceImages.get(baseId)?.isBundled === false) return;
    revokeSourceImage(baseId);
    sourceImages.set(baseId, record);
    sourceMessages.set(
      baseId,
      isObjectUrl
        ? "Image locale temporaire chargee pour ce village."
        : "Photo de reference chargee pour ce village.",
    );
    if (baseId === selectedBaseId) render();
  }, { once: true });
  image.addEventListener("error", () => {
    if (attempts.get(baseId) !== record) return;
    attempts.delete(baseId);
    if (record.isObjectUrl) URL.revokeObjectURL(record.url);
    sourceMessages.set(
      baseId,
      "Image source illisible - la photo de reference est conservee.",
    );
    if (baseId === selectedBaseId) render();
  }, { once: true });
  image.src = source;
}

function revokeSourceImage(baseId) {
  const previous = sourceImages.get(baseId);
  if (previous?.isObjectUrl) URL.revokeObjectURL(previous.url);
  sourceImages.delete(baseId);
}

window.addEventListener("beforeunload", () => {
  for (const baseId of sourceImages.keys()) revokeSourceImage(baseId);
  for (const attempt of [...sourceAttempts.values(), ...bundledSourceAttempts.values()]) {
    if (attempt.isObjectUrl) URL.revokeObjectURL(attempt.url);
  }
  sourceAttempts.clear();
  bundledSourceAttempts.clear();
});

for (const [baseId, source] of Object.entries(BUNDLED_REFERENCE_SOURCES)) {
  loadSourceImage(baseId, source, false, true);
}
for (const [baseId, key] of Object.entries(SOURCE_KEYS)) {
  const source = params.get(key);
  if (source) loadSourceImage(baseId, source);
}
render();
