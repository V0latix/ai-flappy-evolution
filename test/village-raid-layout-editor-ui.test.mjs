import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../tools/village-raid-layout-editor.html", import.meta.url);
const cssUrl = new URL("../tools/village-raid-layout-editor.css", import.meta.url);
const scriptUrl = new URL("../tools/village-raid-layout-editor.js", import.meta.url);
const bundledReferenceUrls = Object.freeze([
  new URL("../assets/village-raid-references/farm-111.jpg", import.meta.url),
  new URL("../assets/village-raid-references/war-26.jpg", import.meta.url),
  new URL("../assets/village-raid-references/defence-104.jpg", import.meta.url),
]);

test("manual editor bundles one durable reference image for each base", async () => {
  for (const url of bundledReferenceUrls) {
    assert.ok((await readFile(url)).length > 0, url.pathname);
  }
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /const BUNDLED_REFERENCE_SOURCES = Object\.freeze\(/);
  assert.match(script, /"farm-111": "\.\.\/assets\/village-raid-references\/farm-111\.jpg"/);
  assert.match(script, /"war-26": "\.\.\/assets\/village-raid-references\/war-26\.jpg"/);
  assert.match(script, /"defence-104": "\.\.\/assets\/village-raid-references\/defence-104\.jpg"/);
});

test("manual editor loads bundled references before temporary launch overrides", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(
    script,
    /for \(const \[baseId, source\] of Object\.entries\(BUNDLED_REFERENCE_SOURCES\)\) \{[\s\S]*?loadSourceImage\(baseId, source, false, true\);[\s\S]*?for \(const \[baseId, key\] of Object\.entries\(SOURCE_KEYS\)\)/,
  );
});

test("manual layout editor exposes every required control and local module", async () => {
  const html = await readFile(htmlUrl, "utf8");
  for (const id of [
    "baseTabs", "toolButtons", "sourceImage", "sourceCanvas", "topDownCanvas", "entityList",
    "counts", "status", "undoEditor", "redoEditor", "resetEditor", "validateEditor",
    "exportPanel", "exportJson",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), id);
  }
  assert.match(html, /href=["']\.\/village-raid-layout-editor\.css["']/);
  assert.match(html, /src=["']\.\/village-raid-layout-editor\.js["']/);
  assert.match(html, /Choisir une image/);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
});

test("manual layout editor references the existing local favicon", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(
    html,
    /<link[^>]+rel=["']icon["'][^>]+href=["']\.\.\/assets\/favicon\.svg["'][^>]*>/,
  );
});

test("manual layout editor shell is accessible without a canvas pointer", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /id="baseTabs"[^>]*role="group"[^>]*aria-label="Village"/);
  assert.match(html, /id="toolButtons"[^>]*role="group"[^>]*aria-label="Outil"/);
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="sourceCanvas"[^>]*width="960"[^>]*height="560"[^>]*aria-label=/);
  assert.match(html, /id="topDownCanvas"[^>]*width="960"[^>]*height="560"[^>]*tabindex="0"/);
  assert.match(html, /id="entityList"[^>]*aria-label="Reserve et elements du village"/);
  assert.match(html, /id="sourceImage"[^>]*type="file"[^>]*accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /<section id="exportPanel" hidden>/);
  assert.match(html, /<textarea id="exportJson"[^>]*readonly/);
});

test("manual layout editor instructions describe the available direct editing tools", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /Glissez les batiments et bombes de la reserve vers la grille top-down/i);
  assert.match(html, /Utilisez le pinceau pour les murs/i);
  assert.doesNotMatch(html, /etape suivante/i);
});

test("manual editor exposes a fixed photo and focusable top-down construction grid", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /<figcaption>Photo originale<\/figcaption>/);
  assert.match(html, /id="topDownCanvas"[^>]*width="960"[^>]*height="560"[^>]*tabindex="0"/);
  assert.match(html, /aria-label="Grille top-down interactive du village"/);
  assert.doesNotMatch(html, /Vue isometrique|id="isoCanvas"/i);
});

test("manual layout editor script wires startup, history and safe temporary images", async () => {
  const script = await readFile(scriptUrl, "utf8");
  for (const id of ["farm-111", "war-26", "defence-104"]) assert.match(script, new RegExp(id));
  for (const label of ["Ferme 111", "Guerre 26", "Defense 104"]) {
    assert.match(script, new RegExp(label));
  }
  for (const tool of ["move", "paint", "erase"]) {
    assert.match(script, new RegExp(`["']${tool}["']`));
  }
  for (const label of [
    "Deplacer un element", "Peindre un mur", "Effacer un mur",
  ]) {
    assert.match(script, new RegExp(label));
  }
  assert.match(script, /new URL\(source, location\.href\)/);
  assert.match(script, /url\.origin !== location\.origin/);
  assert.match(script, /URL\.createObjectURL/);
  assert.match(script, /URL\.revokeObjectURL/);
  assert.match(script, /undoLayoutEditorHistory/);
  assert.match(script, /redoLayoutEditorHistory/);
  assert.match(script, /resetLayoutEditorHistory/);
  assert.match(script, /confirm\(/);
  assert.match(script, /exportPanel\.hidden = true/);
  assert.match(script, /serializeLayoutEditorDraft/);
  assert.match(script, /draftWarnings/);
});

test("source loading preserves the last successful image when a replacement fails", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const loadSourceImageSource = script.match(
    /function loadSourceImage\([\s\S]*?(?=\nfunction revokeSourceImage\()/,
  )?.[0];
  assert.ok(loadSourceImageSource, "loadSourceImage must remain extractable for regression coverage");

  const bundledRecord = { isObjectUrl: false, url: "file:///farm-111.jpg" };
  const sourceImages = new Map([["farm-111", bundledRecord]]);
  const sourceAttempts = new Map();
  const bundledSourceAttempts = new Map();
  const sourceMessages = new Map();
  let renderCount = 0;
  let nextImage = null;
  const loadSourceImage = Function(
    "sourceImages",
    "sourceAttempts",
    "bundledSourceAttempts",
    "sourceMessages",
    "location",
    "Image",
    "revokeSourceImage",
    "render",
    "selectedBaseId",
    `"use strict"; ${loadSourceImageSource}; return loadSourceImage;`,
  )(
    sourceImages,
    sourceAttempts,
    bundledSourceAttempts,
    sourceMessages,
    { href: "http://127.0.0.1/editor", origin: "http://127.0.0.1" },
    class ControlledImage {
      constructor() {
        this.listeners = new Map();
        nextImage = this;
      }

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }

      emit(type) {
        this.listeners.get(type)?.();
      }
    },
    (baseId) => sourceImages.delete(baseId),
    () => { renderCount += 1; },
    "farm-111",
  );

  assert.doesNotThrow(() => loadSourceImage("farm-111", "http://["));
  assert.equal(sourceImages.get("farm-111"), bundledRecord);
  assert.match(sourceMessages.get("farm-111"), /source refusee.*URL invalide/i);
  assert.equal(renderCount, 1);

  loadSourceImage("farm-111", "./temporary-replacement.jpg");
  assert.equal(sourceImages.get("farm-111"), bundledRecord);
  assert.ok(sourceAttempts.has("farm-111"));
  nextImage.emit("error");
  assert.equal(sourceImages.get("farm-111"), bundledRecord);
  assert.equal(sourceAttempts.has("farm-111"), false);
  assert.match(sourceMessages.get("farm-111"), /reference est conservee/i);
  assert.match(
    script,
    /for \(const \[baseId, source\] of Object\.entries\(BUNDLED_REFERENCE_SOURCES\)\) \{[\s\S]*?loadSourceImage\(baseId, source, false, true\);[\s\S]*?for \(const \[baseId, key\] of Object\.entries\(SOURCE_KEYS\)\)/,
  );
});

test("a failed launch override leaves its pending bundled reference eligible to load", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const loadSourceImageSource = script.match(
    /function loadSourceImage\([\s\S]*?(?=\nfunction revokeSourceImage\()/,
  )?.[0];
  assert.ok(loadSourceImageSource, "loadSourceImage must remain extractable for regression coverage");

  const sourceImages = new Map();
  const sourceAttempts = new Map();
  const bundledSourceAttempts = new Map();
  const sourceMessages = new Map();
  const images = [];
  const loadSourceImage = Function(
    "sourceImages",
    "sourceAttempts",
    "bundledSourceAttempts",
    "sourceMessages",
    "location",
    "Image",
    "revokeSourceImage",
    "render",
    "selectedBaseId",
    `"use strict"; ${loadSourceImageSource}; return loadSourceImage;`,
  )(
    sourceImages,
    sourceAttempts,
    bundledSourceAttempts,
    sourceMessages,
    { href: "http://127.0.0.1/editor", origin: "http://127.0.0.1" },
    class ControlledImage {
      constructor() {
        this.listeners = new Map();
        images.push(this);
      }

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }

      emit(type) {
        this.listeners.get(type)?.();
      }
    },
    (baseId) => sourceImages.delete(baseId),
    () => {},
    "farm-111",
  );

  loadSourceImage("farm-111", "./farm-111.jpg", false, true);
  loadSourceImage("farm-111", "./invalid-override.jpg");
  assert.equal(images.length, 2);
  images[1].emit("error");
  assert.equal(sourceImages.has("farm-111"), false);
  images[0].emit("load");
  assert.equal(sourceImages.get("farm-111")?.image, images[0]);
  assert.equal(sourceAttempts.has("farm-111"), false);
  assert.equal(bundledSourceAttempts.has("farm-111"), false);
});

test("a file editor accepts its relative bundled reference when location.origin is file", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const loadSourceImageSource = script.match(
    /function loadSourceImage\([\s\S]*?(?=\nfunction revokeSourceImage\()/,
  )?.[0];
  assert.ok(loadSourceImageSource, "loadSourceImage must remain extractable for regression coverage");

  const sourceImages = new Map();
  const sourceAttempts = new Map();
  const bundledSourceAttempts = new Map();
  const sourceMessages = new Map();
  const images = [];
  const loadSourceImage = Function(
    "sourceImages",
    "sourceAttempts",
    "bundledSourceAttempts",
    "sourceMessages",
    "location",
    "Image",
    "revokeSourceImage",
    "render",
    "selectedBaseId",
    `"use strict"; ${loadSourceImageSource}; return loadSourceImage;`,
  )(
    sourceImages,
    sourceAttempts,
    bundledSourceAttempts,
    sourceMessages,
    {
      href: "file:///Users/romain/dev/neuro-evolution-arcade/tools/village-raid-layout-editor.html",
      origin: "file://",
    },
    class ControlledImage {
      constructor() {
        this.listeners = new Map();
        images.push(this);
      }

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }
    },
    () => {},
    () => {},
    "farm-111",
  );

  loadSourceImage("farm-111", "../assets/village-raid-references/farm-111.jpg", false, true);
  assert.equal(images.length, 1);
  assert.equal(bundledSourceAttempts.get("farm-111")?.image, images[0]);
  assert.equal(
    images[0].src,
    "file:///Users/romain/dev/neuro-evolution-arcade/assets/village-raid-references/farm-111.jpg",
  );
});

test("manual layout editor styling exposes responsive focus and disabled states", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:disabled/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /#topDownCanvas\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /#sourceCanvas\s*\{[^}]*touch-action:\s*auto/s);
  assert.doesNotMatch(css, /(?:^|\n)canvas\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /button\[aria-pressed="true"\]/);
  assert.doesNotMatch(css, /@import|url\s*\(/i);
});

test("editor imports top-down geometry and no isometric editor projection", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /from "\.\.\/src\/village-raid-top-down\.js"/);
  assert.match(script, /createRaidTopDownGeometry/);
  assert.match(script, /projectRaidTopDownFootprint/);
  assert.match(script, /unprojectRaidTopDownPoint/);
  assert.doesNotMatch(script, /createRaidIsoGeometry|projectRaidFootprint|unprojectRaidPoint/);
});

test("editor renders reserve and placed groups with top-down counts", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function renderReserveList\(/);
  assert.match(script, /En reserve/);
  assert.match(script, /Places/);
  assert.match(script, /batiments places/);
  assert.match(script, /bombes en reserve/);
  assert.match(script, /function renderTopDownCanvas\(/);
  assert.match(script, /drawRaidBuildingArtwork/);
});

test("editor rerenders restore focus to the replaced base tool or entity button", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function captureEditorFocus\(/);
  assert.match(script, /function restoreEditorFocus\(/);
  assert.match(script, /const focusTarget = captureEditorFocus\(\)/);
  assert.match(script, /restoreEditorFocus\(focusTarget\)/);
  assert.match(script, /dataset\.entityKind/);
  assert.match(script, /dataset\.entityId/);
});

test("validation derives actionable entity and cell highlights for the top-down canvas", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function createValidationHighlights\(state, result\)/);
  assert.match(script, /missingBuildingIds/);
  assert.match(script, /missingTrapIds/);
  assert.match(script, /overlap/);
  assert.match(script, /offGrid/);
  assert.match(script, /disconnectedWallCells/);
  assert.match(script, /drawTopDownValidationHighlights\(context, geometry/);
  assert.match(script, /validationFeedback\.highlights/);
});

test("editor script wires draft and validation flows", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /layoutEditorDraftKey/);
  assert.match(script, /serializeLayoutEditorExport/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /exportJson/);
  assert.match(script, /applyLayoutEditorWallStroke/);
  assert.match(script, /commitLayoutEditorHistory/);
});

test("completed edits share one commit path and invalidate visible exports", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function commitEditorState\(/);
  assert.match(script, /commitLayoutEditorHistory\(history, nextState\)/);
  assert.match(script, /persistCurrentDraft\(\)/);
  assert.match(script, /invalidateExport\(\)/);
});

test("reserve drag and drop places only on the top-down grid", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /dragstart/);
  assert.match(script, /dragover/);
  assert.match(script, /drop/);
  assert.match(script, /dataTransfer/);
  assert.match(script, /placeLayoutEditorEntity/);
  assert.match(script, /removeLayoutEditorEntity/);
  assert.match(script, /elements\.topDownCanvas\.addEventListener\("drop"/);
  assert.doesNotMatch(script, /elements\.sourceCanvas\.addEventListener\("pointerdown"/);
});

test("placed entities drag, remove, and edit by keyboard", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /pointerdown/);
  assert.match(script, /pointermove/);
  assert.match(script, /pointerup/);
  assert.match(script, /event\.key === "Enter"/);
  assert.match(script, /event\.key === "Delete"/);
  assert.match(script, /event\.key === "Backspace"/);
  assert.match(script, /keyboardCell/);
  assert.match(script, /removeSelectedEntity/);
});

test("top-down edits keep one history path and invalidate stale exports", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function commitEditorState\(/);
  assert.match(script, /persistCurrentDraft\(\)/);
  assert.match(script, /invalidateExport\(\)/);
  assert.match(script, /finishWallStroke/);
  assert.match(script, /resetLayoutEditorHistory/);
});

test("drag payload parsing rejects malformed or unsupported reserve entities", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const helpers = script.match(
    /function hasEntityDragType\([\s\S]*?(?=\nfunction findSelectedEntity\()/,
  )?.[0];
  assert.ok(helpers, "drag payload helpers must remain extractable");
  const parseEntityDragPayload = Function(
    "ENTITY_DRAG_TYPE",
    `"use strict"; ${helpers}; return parseEntityDragPayload;`,
  )("application/x-village-raid-entity");
  const transfer = (value, types = ["application/x-village-raid-entity"]) => ({
    types,
    getData: () => value,
  });

  assert.equal(parseEntityDragPayload(transfer("{")), null);
  assert.equal(parseEntityDragPayload(transfer('{"kind":"wall","id":"wall-1"}')), null);
  assert.equal(parseEntityDragPayload(transfer('{"kind":"building","id":4}')), null);
  assert.equal(parseEntityDragPayload(transfer("{}", [])), null);
  assert.deepEqual(
    parseEntityDragPayload(transfer('{"kind":"trap","id":"trap-1"}')),
    { kind: "trap", id: "trap-1" },
  );
});

test("wall brush interpolates a stroke and commits it through finishWallStroke", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function interpolateGridCells\([\s\S]*?(?=\nfunction updateWallStrokeCandidate\()/,
  )?.[0];
  assert.ok(source, "wall interpolation helper must remain extractable");
  const interpolateGridCells = Function(
    `"use strict"; ${source}; return interpolateGridCells;`,
  )();
  assert.deepEqual(interpolateGridCells({ x: 2, y: 3 }, { x: 5, y: 3 }), [
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
    { x: 5, y: 3 },
  ]);
  assert.match(script, /wallStroke\.cells\.push\(\.\.\.interpolateGridCells/);
  assert.match(script, /return commitEditorState\(candidateState\)/);
});

test("invalid drop severity always renders red instead of warning yellow", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function classifyEditorStatus\([\s\S]*?(?=\nfunction renderStatus\()/,
  )?.[0];
  assert.ok(source, "status severity helper must remain extractable");
  const classifyEditorStatus = Function(
    `"use strict"; ${source}; return classifyEditorStatus;`,
  )();

  assert.equal(classifyEditorStatus(null, false, "error"), "error");
  assert.equal(classifyEditorStatus("warning", true, "error"), "error");
  assert.equal(classifyEditorStatus(null, true, null), "warning");
  assert.equal(classifyEditorStatus(null, false, null), null);
  assert.match(script, /status\.classList\.toggle\("is-invalid", severity === "error"\)/);
  assert.match(script, /status\.classList\.toggle\("is-warning", severity === "warning"\)/);
});

test("HTML drag accepts only a canonical entity that remains in reserve", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function isReserveDragEntity\([\s\S]*?(?=\nfunction candidateEntity\()/,
  )?.[0];
  assert.ok(source, "reserve-only helper must remain extractable");
  const isReserveDragEntity = Function(
    "isLayoutEditorEntityPlaced",
    `"use strict"; ${source}; return isReserveDragEntity;`,
  )((entity) => Number.isInteger(entity.x) && Number.isInteger(entity.y));

  assert.equal(isReserveDragEntity(null), false);
  assert.equal(isReserveDragEntity({ id: "cannon-1", x: null, y: null }), true);
  assert.equal(isReserveDragEntity({ id: "cannon-1", x: 3, y: 4 }), false);
  assert.match(script, /if \(!isReserveDragEntity\(entity\)\)[\s\S]*?Depot refuse/);
});

test("wall keyboard activation supports Enter and Space without moving an old entity", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function isWallKeyboardActivation\([\s\S]*?(?=\nfunction applyWallAtKeyboardCell\()/,
  )?.[0];
  assert.ok(source, "wall keyboard activation helper must remain extractable");
  const isWallKeyboardActivation = Function(
    `"use strict"; ${source}; return isWallKeyboardActivation;`,
  )();

  assert.equal(isWallKeyboardActivation({ key: "Enter", code: "Enter" }), true);
  assert.equal(isWallKeyboardActivation({ key: " ", code: "Space" }), true);
  assert.equal(isWallKeyboardActivation({ key: "ArrowRight", code: "ArrowRight" }), false);
  assert.match(script, /selectedTool === "paint" \|\| selectedTool === "erase"/);
  assert.match(script, /applyLayoutEditorWallStroke\([\s\S]*?\[keyboardCell\]/);
  assert.match(script, /selectedEntity = null;[\s\S]*?selectedTool = tool\.id/);
});

test("v2 draft wins while a legacy v1 draft is only detected and warned", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function resolveStoredDraft\([\s\S]*?(?=\nfunction readDraft\()/,
  )?.[0];
  assert.ok(source, "stored draft resolver must remain extractable");
  const resolveStoredDraft = Function(
    `"use strict"; ${source}; return resolveStoredDraft;`,
  )();
  const calls = [];
  const storage = (entries) => ({
    getItem(key) {
      calls.push(key);
      return entries.has(key) ? entries.get(key) : null;
    },
  });

  const v2 = resolveStoredDraft(storage(new Map([
    ["v2-key", "current"],
    ["v1-key", "legacy"],
  ])), "v2-key", "v1-key");
  assert.deepEqual(v2, { serialized: "current", warning: null });
  assert.deepEqual(calls, ["v2-key"]);

  calls.length = 0;
  const legacy = resolveStoredDraft(
    storage(new Map([["v1-key", "do-not-import"]])),
    "v2-key",
    "v1-key",
  );
  assert.equal(legacy.serialized, null);
  assert.match(legacy.warning, /v1.*incompatible.*ignore/i);
  assert.deepEqual(calls, ["v2-key", "v1-key"]);
  assert.doesNotMatch(source, /removeItem|setItem|JSON\.parse/);
});

test("reserve drag ending without an accepted drop reports a red outside-grid error", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const source = script.match(
    /function reserveDragEndError\([\s\S]*?(?=\nfunction hasEntityDragType\()/,
  )?.[0];
  assert.ok(source, "reserve drag end helper must remain extractable");
  const reserveDragEndError = Function(
    `"use strict"; ${source}; return reserveDragEndError;`,
  )();

  assert.match(reserveDragEndError({ accepted: false, rejectionReported: false }), /hors.*grille/i);
  assert.equal(reserveDragEndError({ accepted: true, rejectionReported: false }), null);
  assert.equal(reserveDragEndError({ accepted: false, rejectionReported: true }), null);
  assert.match(script, /setInteractionMessage\(dragEndError, "error"\)/);
});

test("history replacement clears every transient top-down preview", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const replaceSource = script.match(
    /function replaceCurrentHistory\([\s\S]*?(?=\nfunction commitEditorState\()/,
  )?.[0];
  assert.ok(replaceSource);
  assert.match(replaceSource, /preview = null/);
  assert.match(replaceSource, /pointerInteraction = null/);
  assert.match(replaceSource, /wallStroke = null/);
  assert.match(replaceSource, /reserveDrag = null/);
});
