# Village Raid Bundled Reference Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Bundle the three approved Village Raid screenshots so the manual editor automatically shows the matching reference whenever #111, #26, or #104 is selected.

**Architecture:** Store the three JPEG files in a versioned editor-only asset folder and add one immutable base-id-to-relative-path mapping in the browser controller. Load the bundled image first for every base; query-string and local-file images remain temporary overrides, but only replace the current reference after they have loaded successfully.

**Tech Stack:** Dependency-free ES modules, browser Image, Canvas 2D, Node node:test, static relative assets.

## Global Constraints

- Bundle exactly the user-approved references for \`farm-111\`, \`war-26\`, and \`defence-104\`.
- Store them under \`assets/village-raid-references/\` as \`farm-111.jpg\`, \`war-26.jpg\`, and \`defence-104.jpg\`.
- Keep the editor usable when opened directly with \`file://\`; use relative paths and no network request.
- The source canvas remains passive and does not affect the top-down grid.
- Query parameters and the file picker remain explicit temporary overrides.
- A failed override keeps the successfully loaded bundled image visible and emits a French warning.
- Do not put screenshots in drafts, exports, gameplay, training, or production layout data.
- Add no dependency or build step.
- Run \`npm run check\` before the commit and do not stage \`.superpowers/brainstorm/\`.

---

### Task 1: Bundle and Load the Three Reference Screenshots

**Files:**

- Create: \`assets/village-raid-references/farm-111.jpg\`
- Create: \`assets/village-raid-references/war-26.jpg\`
- Create: \`assets/village-raid-references/defence-104.jpg\`
- Modify: \`tools/village-raid-layout-editor.js\`
- Modify: \`test/village-raid-layout-editor-ui.test.mjs\`
- Modify: \`README.md\`

**Interfaces:**

- Consumes: the approved originals from \`.superpowers/sdd/assets/originals/\`.
- Produces: \`BUNDLED_REFERENCE_SOURCES\`, mapping each base id to \`../assets/village-raid-references/<base-id>.jpg\`.
- Guarantees: \`sourceImages.get(baseId)\` keeps the last successful image while a newer source is pending or fails.

- [ ] **Step 1: Write the failing asset and startup-contract tests**

In \`test/village-raid-layout-editor-ui.test.mjs\`, add:

~~~js
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
    /for \(const \[baseId, source\] of Object\.entries\(BUNDLED_REFERENCE_SOURCES\)\) \{[\s\S]*?loadSourceImage\(baseId, source\);[\s\S]*?for \(const \[baseId, key\] of Object\.entries\(SOURCE_KEYS\)\)/,
  );
});
~~~

- [ ] **Step 2: Run the focused suite to verify RED**

Run:

~~~bash
node --test test/village-raid-layout-editor-ui.test.mjs
~~~

Expected: FAIL because the asset files and \`BUNDLED_REFERENCE_SOURCES\` do not exist.

- [ ] **Step 3: Copy the approved screenshots into durable assets**

Run:

~~~bash
mkdir -p assets/village-raid-references
cp .superpowers/sdd/assets/originals/th3_farm_111.jpg assets/village-raid-references/farm-111.jpg
cp .superpowers/sdd/assets/originals/th3_war_26.jpg assets/village-raid-references/war-26.jpg
cp .superpowers/sdd/assets/originals/th3_defence_104.jpg assets/village-raid-references/defence-104.jpg
~~~

- [ ] **Step 4: Add success-preserving reference loading**

At the top of \`tools/village-raid-layout-editor.js\`, add:

~~~js
const BUNDLED_REFERENCE_SOURCES = Object.freeze({
  "farm-111": "../assets/village-raid-references/farm-111.jpg",
  "war-26": "../assets/village-raid-references/war-26.jpg",
  "defence-104": "../assets/village-raid-references/defence-104.jpg",
});
~~~

Add \`const sourceAttempts = new Map();\` beside \`sourceImages\`. Refactor \`loadSourceImage\` so the pending record stays in \`sourceAttempts\` until its \`load\` event fires. Only then replace the displayed \`sourceImages\` record and revoke a prior object URL. On an error, remove the pending attempt, revoke a failed object URL, retain the current source image, and show:

~~~js
"Image source illisible - la photo de reference est conservee."
~~~

Load bundled images before optional launch overrides:

~~~js
for (const [baseId, source] of Object.entries(BUNDLED_REFERENCE_SOURCES)) {
  loadSourceImage(baseId, source);
}
for (const [baseId, key] of Object.entries(SOURCE_KEYS)) {
  const source = params.get(key);
  if (source) loadSourceImage(baseId, source);
}
render();
~~~

Update \`beforeunload\` to revoke object URLs from both displayed records and pending attempts, never relative bundled URLs.

- [ ] **Step 5: Add fallback regression coverage**

Extend the extracted \`loadSourceImage\` test so a successful bundled record is present, a newer temporary record fires \`error\`, and the assertions prove the bundled record remains displayed while the French warning contains \`reference est conservee\`.

- [ ] **Step 6: Update the editor instructions in README**

Replace the manual-editor workflow paragraph with text explaining that #111, #26, and #104 each display their bundled screenshot automatically; the file picker is a temporary replacement for the selected village and never changes an export.

- [ ] **Step 7: Verify and commit**

Run:

~~~bash
node --test test/village-raid-layout-editor-ui.test.mjs
node --check tools/village-raid-layout-editor.js
npm run check
git diff --check
git add assets/village-raid-references/farm-111.jpg assets/village-raid-references/war-26.jpg assets/village-raid-references/defence-104.jpg tools/village-raid-layout-editor.js test/village-raid-layout-editor-ui.test.mjs README.md
git commit -m "feat: bundle Village Raid reference images"
~~~

Expected: focused UI tests and the full suite pass, the three assets are staged, and no whitespace errors are reported.

- [ ] **Step 8: Browser verification**

Open the editor directly from its local file path without query parameters. Select #111, #26, and #104; each must show its matching reference in the left passive canvas while the right grid remains editable. Choose a temporary local image, verify it replaces only the active reference, then reload and verify the bundled reference returns.

---

## Completion Boundary

The direct local editor automatically shows the matching committed screenshot for all three villages. Temporary sources remain optional overrides, and no gameplay, export, draft-schema, or production-layout data changes.
