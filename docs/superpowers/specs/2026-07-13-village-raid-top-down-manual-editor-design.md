# Village Raid Top-Down Manual Editor Design

## Goal

Replace the manual editor's isometric construction view with an orthogonal
top-down editor. The user must be able to rebuild each of the three reference
villages manually from an empty grid while keeping the original screenshot
visible beside it.

The editor remains a local development tool. It produces reviewed coordinates;
it does not update production layouts during this work.

## Approved Decisions

- Keep the original reference screenshot fixed on the left.
- Put a recognizable illustrated top-down grid on the right.
- Make only the top-down grid interactive for placement and movement.
- Start every village with an empty grid.
- Put all 22 buildings, all 50 walls, and both bombs in reserve.
- Place buildings and bombs by drag and drop.
- Place walls with a brush and return them with the eraser.
- Preserve exact building footprints. In particular, the Cannon remains a
  square 3-by-3 building.
- Reset returns every gameplay element to reserve.
- Keep production layout coordinates unchanged until the user approves all
  three exports.

## Scope

The editor covers only the three locked TH3 references:

- `farm-111` / screenshot #111;
- `war-26` / screenshot #26;
- `defence-104` / screenshot #104.

The locked inventory for each village is:

- 22 buildings;
- 50 walls;
- 2 bombs.

No troop placement, attack simulation, training, textures from the source
website, automatic screenshot recognition, or production coordinate import is
part of this design.

## Interface

### Reference pane

The left pane displays the selected village's local or same-origin reference
image. It is a stable visual reference: it has no placement grid, calibration
handles, or entity drag behavior.

The existing local-file safety rules remain in force. Images are temporary,
never persisted in drafts, and never included in JSON exports.

### Top-down pane

The right pane displays the complete 48-by-32 grid through an orthogonal
projection. The grid is centered in the existing 960-by-560 canvas with equal
square cells and visible outer bounds.

Each placed building fills its real rectangular footprint. Buildings use the
project's original geometric visual language and its recognizable details:

- the Cannon has a square masonry base, wheels, and a barrel;
- the Mortar has a circular turntable and open tube;
- gold and elixir buildings retain distinct bins, vats, pipes, and colors;
- the Town Hall, camps, Barracks, Laboratory, huts, Castle, and Archer Tower
  retain their existing distinct cues.

Permanent labels do not cover the plan. The selected or hovered entity exposes
its French name and stable ID outside the footprint.

### Reserve

The current entity list becomes the reserve and placement status panel.
Unplaced buildings and bombs appear as draggable items grouped by type. Placed
entities remain discoverable in a separate placed group so keyboard users can
select them.

Counts remain visible at all times:

- buildings placed and remaining;
- walls placed and remaining;
- bombs placed and remaining.

Wall painting is available only while walls remain in reserve. Erasing a wall
returns one wall to reserve.

## Interaction Model

### Buildings and bombs

Dragging an unplaced building or bomb from the reserve over the top-down grid
shows a snapped candidate footprint. A valid candidate is cyan; an off-grid or
overlapping candidate is red. Dropping a valid candidate places it. Dropping an
invalid candidate leaves the entity in reserve.

A placed entity can be dragged to another valid grid cell. Dragging it outside
the top-down grid returns it to reserve. Pressing `Delete` or `Backspace` on a
selected placed entity performs the same removal.

Keyboard placement remains supported: selecting a reserve entity focuses the
top-down grid, `Enter` places it at the current keyboard cursor when valid,
arrow keys move the cursor or the selected placed entity by one cell, and
`Delete` returns a placed entity to reserve.

### Walls

The wall brush collects one snapped, interpolated stroke and commits it as one
history entry. It cannot paint onto buildings, bombs, existing walls, or cells
outside the grid. The eraser removes walls and restores the same amount to the
reserve. A stroke remains one undo step.

### History and reset

Placement, movement, removal, wall strokes, and wall erasing use the existing
atomic history model. Undo and redo therefore cover reserve-to-grid and
grid-to-reserve transitions as well as ordinary movement.

Reset asks for confirmation and restores the approved empty initial state for
the selected village.

## State Model

Buildings and bombs remain canonical entities even while unplaced. Their
coordinates become nullable:

```js
{ id, type, level, width, height, x: null, y: null }
```

Integer `x` and `y` values mean placed; `null` and `null` mean reserve. Mixed or
non-integer coordinate pairs are invalid.

Walls continue to use a variable array. An empty array means all 50 walls are
in reserve; each placed wall consumes one unit of capacity.

The editor creates a dedicated empty state from each locked production-shaped
layout. The production layout itself remains read-only and supplies only the
canonical roster and metadata.

The draft and export schema moves to version 2. Version-1 editor drafts are
incompatible and are ignored with a French recovery warning. Version-2 draft
parsing continues treating local storage as untrusted: entity metadata is
rebuilt from the locked roster and only nullable or integer coordinates are
accepted.

## Geometry

A pure top-down geometry helper owns:

- fitting a 48-by-32 grid into a 960-by-560 canvas with margins;
- projecting a grid point to a canvas point;
- projecting a complete entity footprint;
- converting a canvas point back to a snapped grid cell;
- rejecting points outside the fitted grid rectangle.

The editor renderer and pointer handling use this same geometry object. This
prevents differences between what the user sees and where a drop is recorded.

The isometric helpers remain available to the production renderer but are no
longer imported by the manual editor.

## Validation and Export

Validation blocks export while any required building or bomb is unplaced, the
wall count is below 50, an entity is off-grid, or footprints overlap.

Wall connectivity remains an advisory warning rather than a blocking error.
When the state is valid, the editor produces the same deterministic coordinate
shape used by the current export:

- sorted building IDs mapped to `[x, y]`;
- sorted wall coordinate pairs;
- sorted bomb coordinate pairs.

Any edit hides a previously visible export until the user validates again.

Each of the three villages has independent history and a separate version-2
local draft. Switching villages and reloading restores the correct reserve and
placement state.

## Error Handling

- Invalid drops revert atomically and announce the reason in French.
- Dropping outside the grid returns a placed entity to reserve only when the
  drag began from that placed entity.
- A corrupt or incompatible draft falls back to the empty state.
- A malformed or cross-origin reference URL cannot prevent editor startup.
- An unreadable image clears only that village's reference image; the top-down
  editor remains usable.
- Export never contains image URLs, image data, or reserve UI state.

## Accessibility and Responsive Behavior

Every action has a keyboard path. Focus restoration continues using stable
base, tool, and entity identities after rerenders. Live status reports placement
errors, counts, draft recovery, and validation results.

At wide desktop sizes the photo, top-down grid, and reserve appear together.
At narrow widths they stack in this order:

1. photo;
2. top-down grid;
3. reserve.

Canvas buffers remain 960-by-560 and scale responsively through CSS.

## Testing

Pure tests cover:

- top-down fit, projection, unprojection, snapping, and outside rejection;
- empty initial state and exact reserve counts;
- building and bomb placement from reserve;
- movement and removal back to reserve;
- footprint collisions and off-grid rejection;
- wall reserve, brush, eraser, and stroke history;
- undo, redo, and empty reset;
- version-2 draft recovery and version-1 rejection;
- blocking validation and deterministic export.

UI regression tests cover the top-down labels, removal of editor isometric
imports, reserve rendering, drag/drop wiring, keyboard removal, and responsive
layout.

Manual verification in the Codex in-app browser covers all three local
screenshots at normal and narrow widths, reserve-to-grid dragging, placed-entity
movement and removal, wall brush/erase, independent drafts, reset confirmation,
validation/export, and an empty browser console.

## Completion Boundary

This work is complete when the top-down manual editor is tested, open on #111,
and ready for the user to rebuild the three villages. It does not consume the
new exports or change production gameplay layouts. A later explicitly approved
change will import the three user-validated JSON exports.
