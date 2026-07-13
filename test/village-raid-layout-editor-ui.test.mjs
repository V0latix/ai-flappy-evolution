import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../tools/village-raid-layout-editor.html", import.meta.url);
const cssUrl = new URL("../tools/village-raid-layout-editor.css", import.meta.url);
const scriptUrl = new URL("../tools/village-raid-layout-editor.js", import.meta.url);

test("manual layout editor exposes every required control and local module", async () => {
  const html = await readFile(htmlUrl, "utf8");
  for (const id of [
    "baseTabs", "toolButtons", "sourceImage", "sourceCanvas", "isoCanvas", "entityList",
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
  assert.match(html, /id="isoCanvas"[^>]*width="960"[^>]*height="560"[^>]*aria-label=/);
  assert.match(html, /id="entityList"[^>]*aria-label="Elements du village"/);
  assert.match(html, /id="sourceImage"[^>]*type="file"[^>]*accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /<section id="exportPanel" hidden>/);
  assert.match(html, /<textarea id="exportJson"[^>]*readonly/);
});

test("manual layout editor instructions describe the available direct editing tools", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /deplacez les batiments et les pieges/i);
  assert.match(html, /peignez ou effacez les murs/i);
  assert.doesNotMatch(html, /etape suivante/i);
});

test("manual layout editor script wires startup, history and safe temporary images", async () => {
  const script = await readFile(scriptUrl, "utf8");
  for (const id of ["farm-111", "war-26", "defence-104"]) assert.match(script, new RegExp(id));
  for (const label of ["Ferme 111", "Guerre 26", "Defense 104"]) {
    assert.match(script, new RegExp(label));
  }
  for (const tool of ["align", "move", "paint", "erase"]) {
    assert.match(script, new RegExp(`["']${tool}["']`));
  }
  for (const label of [
    "Aligner la grille", "Deplacer un element", "Peindre un mur", "Effacer un mur",
  ]) {
    assert.match(script, new RegExp(label));
  }
  assert.match(script, /new URL\(source, location\.href\)/);
  assert.match(script, /url\.origin !== location\.origin/);
  assert.match(script, /URL\.createObjectURL/);
  assert.match(script, /URL\.revokeObjectURL/);
  assert.match(script, /pointercancel/);
  assert.match(script, /lostpointercapture/);
  assert.match(script, /setPointerCapture/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(script, /undoLayoutEditorHistory/);
  assert.match(script, /redoLayoutEditorHistory/);
  assert.match(script, /resetLayoutEditorHistory/);
  assert.match(script, /confirm\(/);
  assert.match(script, /exportPanel\.hidden = true/);
  assert.match(script, /serializeLayoutEditorDraft/);
  assert.match(script, /draftWarnings/);
});

test("malformed launch source URLs recover in French and allow final rendering", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const loadSourceImageSource = script.match(
    /function loadSourceImage\([\s\S]*?(?=\nfunction revokeSourceImage\()/,
  )?.[0];
  assert.ok(loadSourceImageSource, "loadSourceImage must remain extractable for regression coverage");

  const sourceImages = new Map([["farm-111", { isObjectUrl: false }]]);
  const sourceMessages = new Map();
  let renderCount = 0;
  const loadSourceImage = Function(
    "sourceImages",
    "sourceMessages",
    "location",
    "Image",
    "revokeSourceImage",
    "render",
    "selectedBaseId",
    `"use strict"; ${loadSourceImageSource}; return loadSourceImage;`,
  )(
    sourceImages,
    sourceMessages,
    { href: "http://127.0.0.1/editor", origin: "http://127.0.0.1" },
    class UnexpectedImage {
      constructor() {
        throw new Error("an invalid URL must not create an image");
      }
    },
    (baseId) => sourceImages.delete(baseId),
    () => { renderCount += 1; },
    "farm-111",
  );

  assert.doesNotThrow(() => loadSourceImage("farm-111", "http://["));
  assert.equal(sourceImages.has("farm-111"), false);
  assert.match(sourceMessages.get("farm-111"), /source refusee.*URL invalide/i);
  assert.equal(renderCount, 1);
  assert.match(
    script,
    /for \(const \[baseId, key\] of Object\.entries\(SOURCE_KEYS\)\)[\s\S]*?loadSourceImage\(baseId, source\);[\s\S]*?\n}\nrender\(\);/,
  );
});

test("manual layout editor styling exposes responsive focus and disabled states", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:disabled/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /button\[aria-pressed="true"\]/);
  assert.doesNotMatch(css, /@import|url\s*\(/i);
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

test("validation derives actionable entity and cell highlights for both canvases", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function createValidationHighlights\(state, result\)/);
  assert.match(script, /missingBuildingIds/);
  assert.match(script, /missingTrapIds/);
  assert.match(script, /overlap/);
  assert.match(script, /offGrid/);
  assert.match(script, /disconnectedWallCells/);
  assert.match(script, /drawSourceValidationHighlights\(context, state, drawRect/);
  assert.match(script, /drawIsoValidationHighlights\(context, geometry/);
  assert.match(script, /validationFeedback\.highlights/);
});

test("pointer cancellation releases capture on its owner before clearing state", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /let activePointerOwner = null/);
  assert.match(script, /function cancelPointerInteraction\(\)/);
  assert.match(script, /activePointerOwner\.hasPointerCapture\(activePointerId\)/);
  assert.match(script, /activePointerOwner\.releasePointerCapture\(activePointerId\)/);
  const cancelFunction = script.match(
    /function cancelPointerInteraction\(\) \{(?<body>[\s\S]*?)\n\}/,
  )?.groups?.body ?? "";
  assert.ok(
    cancelFunction.indexOf("releasePointerCapture") < cancelFunction.indexOf("activePointerId = null"),
    "capture must be released before pointer state is cleared",
  );
});

test("editor script wires pointer keyboard draft and validation flows", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /pointerdown/);
  assert.match(script, /pointermove/);
  assert.match(script, /pointerup/);
  assert.match(script, /keydown/);
  assert.match(script, /layoutEditorDraftKey/);
  assert.match(script, /serializeLayoutEditorExport/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /exportJson/);
  assert.match(script, /moveLayoutEditorEntity/);
  assert.match(script, /applyLayoutEditorWallStroke/);
  assert.match(script, /commitLayoutEditorHistory/);
  assert.match(script, /setLayoutEditorCalibration/);
  assert.match(script, /snapEditorGridPoint/);
});

test("pointer mapping preserves contain letterboxing and entity grab offsets", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function pointerGridPoint\(/);
  assert.match(script, /function sourceImagePoint\(/);
  assert.match(script, /record\.drawRect/);
  assert.match(script, /record\.image\.naturalWidth/);
  assert.match(script, /record\.image\.naturalHeight/);
  assert.match(script, /function pointInsideRect\(/);
  assert.match(script, /grabOffset/);
  assert.match(script, /candidateOrigin/);
});

test("editor transactions cover three alignment handles and continuous wall strokes", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function calibrationHandles\(/);
  assert.match(script, /anchor/);
  assert.match(script, /column/);
  assert.match(script, /row/);
  assert.match(script, /createScreenshotCalibration/);
  assert.match(script, /function interpolateWallCells\(/);
  assert.match(script, /function startWallStroke\(/);
  assert.match(script, /function extendWallStroke\(/);
  assert.match(script, /function finishWallStroke\(/);
  assert.match(script, /wallStroke\.cells/);
});

test("completed edits share one commit path and invalidate visible exports", async () => {
  const script = await readFile(scriptUrl, "utf8");
  assert.match(script, /function commitEditorState\(/);
  assert.match(script, /commitLayoutEditorHistory\(history, nextState\)/);
  assert.match(script, /persistCurrentDraft\(\)/);
  assert.match(script, /invalidateExport\(\)/);
  assert.match(script, /event\.key === "ArrowUp"/);
  assert.match(script, /event\.key === "ArrowDown"/);
  assert.match(script, /event\.key === "ArrowLeft"/);
  assert.match(script, /event\.key === "ArrowRight"/);
});

test("leaving the contained source image rejects an entity drop instead of reusing stale preview", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const updateFunction = script.match(
    /function updateEntityPreview\(cell\) \{(?<body>[\s\S]*?)\n\}/,
  )?.groups?.body ?? "";
  assert.match(updateFunction, /if \(!cell\)/);
  assert.match(updateFunction, /valid: false/);
  assert.match(updateFunction, /cell: null/);
  assert.match(script, /cancelPointerInteraction\(\);\n  render\(\);/);
});
