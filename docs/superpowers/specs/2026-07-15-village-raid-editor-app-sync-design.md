# Village Raid editor-to-app synchronization design

## Goal

Make the manual Village Raid editor discoverable from the Clash of Clans game
panel and let a fully validated editor layout become the locally persisted
layout used by Village Raid training in the main app.

## User flow

1. A link-button at the bottom of the `Village Raid HDV 3` explanation opens
   `tools/village-raid-layout-editor.html` in a new tab.
2. The user selects one of the three bases and completes its locked roster on
   the top-down grid.
3. `Valider ce village` keeps its existing validation and JSON preview.
4. Once valid, `Appliquer ce village au jeu` saves that base's validated
   layout locally and confirms that the main app will use it after reload.
5. When the main app next starts, it uses the saved layout for each base that
   has a valid saved override. Bases without an override continue to use their
   bundled reference layout.
6. `Restaurer les villages d'origine` removes every saved Village Raid layout
   override after confirmation. The next main-app load uses all bundled plans.

## Data boundary

- A new shared layout-storage module owns the local-storage key, serialization,
  parsing, validation, and merge with the immutable bundled `LAYOUTS` data.
- The saved payload contains only the existing validated editor export shape:
  schema, base id, buildings, walls, and traps. It never stores source images,
  drafts, exports from incomplete layouts, game state, champions, or training
  results.
- The storage schema is versioned independently from editor drafts. Invalid,
  malformed, unknown-base, or roster-incompatible entries are ignored, leaving
  the bundled layout in effect.
- The main app receives a derived layout array at startup. It never mutates
  the imported bundled layouts.

## Components

### Main game UI

- Add one accessible anchor styled as a button at the bottom of
  `#explanationRaid`.
- Its relative target is `./tools/village-raid-layout-editor.html`; it opens
  with `target="_blank"` and `rel="noopener"`.
- Main initialization resolves saved layouts before the Village Raid profile
  creates worlds, plans, or training sessions.

### Editor UI

- Add an apply button adjacent to the existing validation action. It is
  disabled unless the currently selected state validates successfully.
- Applying serializes only the current valid layout through the shared module,
  persists it, and displays a French success message.
- Add one reset-all button. Its confirmation describes that it deletes only
  locally applied Village Raid plans, not editor drafts, champions, or bundled
  assets.
- Applying one base does not change the saved overrides for the other two
  bases.

### Shared storage module

- Expose a single saved-layout key and pure helpers to validate and parse
  saved records against the canonical three-base roster.
- Expose a browser-safe read function that returns the canonical layouts with
  valid local overrides substituted by base id.
- Expose save and clear helpers that handle unavailable local storage without
  crashing either app.

## Error handling

- A layout cannot be applied while it has missing reserve entities, invalid
  coordinates, overlap, off-grid placement, wrong IDs, or incorrect counts.
- Parsing failures or unavailable storage must not stop the game from opening;
  the canonical layout remains active.
- The editor reports storage failures in French and leaves the in-memory edit
  untouched.

## Testing

- Assert that the main app exposes the bottom editor link with the correct
  relative URL, new-tab safety attributes, and Raid-only placement.
- Unit-test persistence, validation, invalid-payload fallback, one-base merge,
  and reset-all behavior using a storage stub.
- Assert that the editor only enables/apply-saves a validated current base and
  that reset clears only the applied-layout storage key.
- Keep existing editor, data, training, and app-flow regression coverage green.

## Non-goals

- No cross-tab live synchronization: the main app picks up saved plans at its
  next load.
- No server, account, cloud sync, network request, dependency, or build step.
- No change to the three bundled reference screenshots, editor drafts,
  gameplay rules, champion compatibility, or production fallback layouts.
