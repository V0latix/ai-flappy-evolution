# Task 4 report - Accessible dual-view editor shell

## Status

Completed. The static editor route is available at
`/tools/village-raid-layout-editor.html` and boots directly without a build step or
runtime dependency.

## Delivered scope

- Added the accessible French editor shell with the required stable DOM IDs,
  native controls, live status, keyboard-operable entity list, 960x560 canvases,
  responsive layout, visible focus, and disabled states.
- Added the three production villages and four explicit tools. Wall painting is
  disabled at zero reserve while wall erasing remains available.
- Initialized a separate history per village. Restored drafts become only the
  current state; each history retains a separate production initial state so
  reset returns to the production proposal.
- Added per-base draft warning preservation, persistence on history operations,
  confirmation before reset, and export invalidation on undo, redo, reset, tool
  change, or base change.
- Added one canonical render path. Both canvases receive the same current state,
  with a retained source-image contain rectangle and matching grid/entity
  projection.
- Added temporary local image loading with object URL replacement/revocation and
  optional development sources restricted to the current origin. No remote font
  or runtime asset was added.
- Added pointer ownership and cancellation scaffolding (`pointercancel`,
  `lostpointercapture`, and Escape) without implementing the Task 5 drag/stroke
  behavior.
- Added validation feedback and export visibility tied to the currently rendered
  state.

## TDD evidence

1. Added `test/village-raid-layout-editor-ui.test.mjs` before production files.
2. Confirmed RED: 4 tests failed with the expected `ENOENT` errors for the
   missing HTML, CSS, and JavaScript files.
3. Added the minimal shell implementation and confirmed GREEN: 4/4 focused tests
   passed.

The focused tests cover required controls/assets, French accessible groups and
labels, live status, canvas labels and buffers, local file input, readonly hidden
export, local-only assets, history/reset confirmation, pointer cancellation,
temporary URL revocation, draft warnings, export invalidation, responsive focus,
and disabled styling.

## Verification

- `node --test test/village-raid-layout-editor-ui.test.mjs`: 4 passed, 0 failed.
- `node --check tools/village-raid-layout-editor.js`: passed.
- `npm run check`: 134 passed, 0 failed.
- `git diff --check`: passed.

## Browser QA

Checked with a local static server in Chromium:

- Shell booted with 3 village controls, 4 tool controls, both named canvases,
  counts/status outside canvas, and 74 keyboard-operable stable-ID entity buttons.
- Switching from Ferme 111 to Guerre 26 updated `aria-pressed` and retained valid
  counts for the selected base.
- Validation revealed the JSON export for the selected base and announced the
  successful state through the live region.
- A cross-origin `source111` query value was rejected before image loading and
  announced through the live region.

The only console entry was the static server's unrelated missing `favicon.ico`.

## Concerns / deferred work

- Full entity dragging, grab-offset preservation, interpolated wall strokes,
  keyboard coordinate movement, invalid drag previews, and completed-stroke
  history commits remain intentionally deferred to Task 5.
- Browser QA for those editing interactions is likewise deferred to Task 5.
