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

test("manual layout editor styling exposes responsive focus and disabled states", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:disabled/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /button\[aria-pressed="true"\]/);
  assert.doesNotMatch(css, /@import|url\s*\(/i);
});
