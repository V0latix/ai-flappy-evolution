# Village Raid Bundled Reference Images Design

## Goal

Make the original screenshot for each of the three manual Village Raid bases
available automatically when its village tab is selected. The editor must keep
working when opened directly from the local filesystem, without launch-query
parameters.

## Assets

Commit the three user-approved reference screenshots under
`assets/village-raid-references/`:

- `farm-111.jpg`
- `war-26.jpg`
- `defence-104.jpg`

They are editor-only reference material. They are not part of gameplay data,
training inputs, exports, local drafts, or the production village layouts.

## Loading Behaviour

The editor owns a fixed mapping from each base id to its bundled image path.
At startup it loads the bundled image for every base. Changing the selected
base immediately renders that base's bundled image in the fixed left-hand
reference canvas.

Existing query-string image parameters and the local file picker remain
supported as explicit temporary overrides. An override affects only the
selected base for the current editor session and is never exported. If an
override is invalid or fails to load, the matching bundled image remains the
fallback and the editor shows a French warning.

## Interaction and Error Handling

The reference canvas stays passive: it neither accepts placement nor changes
the top-down editor state. Missing or unreadable bundled images show the same
French empty-state message used today, while preserving all editing controls.

## Verification

Tests will assert that all three durable asset paths are mapped to the correct
base ids, that direct local opening does not require source query parameters,
and that temporary overrides still take precedence without changing exports.
Browser QA will confirm that selecting #111, #26, and #104 displays its
corresponding screenshot and that the grid remains the only editable surface.

## Boundaries

Do not modify `src/village-raid-data.js`, production layout coordinates,
gameplay, training, attack timing, editor exports, or draft schema.
