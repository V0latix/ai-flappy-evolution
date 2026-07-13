import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../tools/village-raid-layout-editor.html", import.meta.url);
const cssUrl = new URL("../tools/village-raid-layout-editor.css", import.meta.url);
const scriptUrl = new URL("../tools/village-raid-layout-editor.js", import.meta.url);

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
