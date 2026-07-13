# Village Raid Manual Layout Editor Design

**Date:** 2026-07-13

## Goal

Provide a local manual editor that lets the user reproduce Village Raid bases
`#111`, `#26`, and `#104` from their screenshots without trusting automatic
coordinate extraction. The editor keeps the screenshot overlay and the clean
isometric preview synchronized so every manual adjustment can be checked in the
same interaction.

The editor is a calibration tool. It does not change production layouts until
the user validates a base and the exported coordinates are deliberately copied
into the game.

## Scope

The editor supports exactly the gameplay inventory already required by each
reference base:

- 22 stable building instances;
- 50 wall cells;
- 2 bomb cells;
- the existing 48x32 Village Raid grid;
- the three base IDs and order `farm-111`, `war-26`, `defence-104`.

The inventory is locked. Users can move existing entities, but cannot add,
duplicate, or delete buildings, bombs, or total wall capacity. Training,
combat, pathfinding, fitness, the 180-second timer, and production layout data
remain outside this editor.

## User Experience

### Screen Structure

The editor has one toolbar and two synchronized canvases.

The toolbar contains:

- base selectors `#111`, `#26`, and `#104`;
- tools `Aligner`, `Batiments`, `Murs`, and `Bombes`;
- `Annuler`, `Retablir`, `Reinitialiser`, and `Valider ce village` actions;
- live counters for buildings, placed walls, wall reserve, and bombs;
- validation and draft status.

The left canvas shows the original screenshot with a translucent calibrated
grid and editable entity footprints. The right canvas shows the same state on
the clean fixed 2:1 isometric board. A change made in either canvas updates the
shared state and redraws both canvases immediately.

### Grid Alignment

Each base begins with an alignment step. Three draggable handles define:

1. the Town Hall ground-footprint center;
2. the positive column-axis endpoint;
3. the positive row-axis endpoint.

The handles define one translation and two basis vectors for the screenshot.
The editor displays several grid lines while aligning so the user can match
visible wall seams and footprint edges. Alignment is saved in the base draft,
participates in undo/redo, and never alters the fixed application-grid
projection shown on the right.

### Buildings and Bombs

Buildings and bombs are selected by clicking their visible footprint or their
stable-ID entry. Dragging converts the pointer into a candidate integer grid
cell and snaps the entity to that cell. The entity retains its canonical
footprint; in particular, Cannon and Mortar remain square 3x3 world
footprints.

The candidate footprint is blue when valid and red when it would leave the
48x32 grid or overlap another gameplay entity. Releasing an invalid candidate
restores the previous position. The selected entity may also be moved by one
cell with the arrow keys for precise correction.

### Wall Brush

Walls use an erase-and-paint reserve instead of individual drag handles.

- Erasing a wall cell removes it from the board and adds one unit to the wall
  reserve.
- Painting an empty valid cell consumes one unit from the reserve.
- Painting is disabled when the reserve is empty.
- Duplicate, occupied, and off-grid cells are rejected.
- A continuous pointer drag paints or erases a continuous snapped path without
  counting the same cell twice.

The toolbar always shows both placed capacity and reserve, for example
`49 places - 1 disponible`. The combined total always remains 50.

### History, Drafts, and Reset

Each completed drag or brush stroke creates one history entry. Undo and redo
cover entity moves, complete wall strokes, grid alignment, and reset. History
is scoped to the selected base.

Every accepted edit saves a versioned local draft for that base. Switching
bases cannot discard the current draft. Reset requires confirmation and
restores that base's initial proposal while remaining undoable during the
current session.

## Validation and Export

`Valider ce village` runs deterministic checks:

- every required stable building ID exists exactly once;
- there are exactly 22 buildings, 50 placed walls, and 2 bombs;
- every complete footprint stays inside the 48x32 grid;
- building footprints do not overlap;
- walls and bombs do not occupy blocked footprint cells;
- wall cells and bomb cells are unique.

Disconnected wall groups produce a visible warning but do not block approval,
because the screenshot remains the authority. Blocking failures identify the
affected stable IDs or cells and highlight them in both views.

Successful validation reveals a read-only, selectable JSON export containing:

- a schema version;
- the base ID;
- the three screenshot-alignment handles;
- explicit building coordinates keyed by stable ID;
- all 50 wall coordinates sorted by row then column;
- both bomb coordinates sorted by row then column.

The exported JSON stays visible in the page so the user can tell Codex that the
base is ready and Codex can deliberately import that visible result. Draft data
alone is never treated as production approval.

## Architecture

The editor is a dependency-free static developer tool and is not linked from
the game UI.

- `tools/village-raid-layout-editor.html` owns the toolbar, two canvases,
  accessible status text, source-image selection, and pointer/keyboard wiring.
- `src/village-raid-layout-editor.js` owns pure editor state transitions,
  inverse screenshot projection, snapping, collision checks, wall reserve,
  history, validation, persistence serialization, and export serialization.
- `src/village-raid-isometric.js` remains the single source for the clean
  application-grid projection and projected footprint geometry.
- `test/village-raid-layout-editor.test.mjs` covers the pure state and
  serialization behavior.

The two canvases never maintain independent coordinate copies. UI events create
commands against one editor state, and both renderers consume the resulting
state. This prevents screenshot and isometric views from drifting apart.

## Source Images and Static Hosting

Official/reference screenshots are not committed. The editor accepts a local
image chosen by the user or a same-origin development URL supplied at launch.
Object URLs and temporary local server paths are display inputs only and are
excluded from exported layout data.

The tool adds no runtime dependency, build step, font download, or production
asset request. It works through the same static server used for local project
testing.

## Error Handling and Accessibility

- Invalid drops revert atomically and announce the reason in a visible status
  region.
- Missing or unreadable source images leave the grid editor usable and explain
  how to choose another image.
- Corrupt or incompatible drafts are ignored with a visible recovery message;
  the initial proposal remains available.
- Reset uses an explicit confirmation.
- Toolbar controls are native buttons with pressed/disabled states.
- Stable IDs and French building names remain visible outside the canvases.
- A selected building or bomb can be moved with the arrow keys, so precision
  does not depend entirely on pointer control.

## Verification

Pure tests cover:

- locked inventories and stable IDs;
- screenshot-basis inversion and integer snapping;
- complete-footprint boundary and overlap checks;
- valid and invalid building/bomb moves;
- wall erase, reserve, paint, duplicate prevention, and stroke grouping;
- per-base undo/redo and reset;
- versioned draft recovery;
- deterministic, sorted JSON export;
- blocking errors versus disconnected-wall warnings.

Browser verification covers both normal and narrow desktop layouts, all three
base selectors, drag/drop in each view, wall brushing, keyboard nudging,
undo/redo, draft restoration after reload, validation feedback, and visible
JSON export. Production Village Raid regression tests must remain unchanged
until the user approves the exported coordinates.

## Delivery Sequence

1. Build and verify the isolated editor with the current proposals as editable
   starting points.
2. Let the user align and edit `#111`, then validate its JSON.
3. Repeat separately for `#26` and `#104`.
4. Only after all three exports are explicitly approved, replace production
   layout coordinates, increment the layout compatibility version, finish the
   isometric renderer integration, and run the complete game regression suite.

