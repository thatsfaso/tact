# Page Format Specification

**Status: v3.0 — matches the shipped browser implementation.**

This document defines the physical page dimensions, coordinate system, layout zones, and pagination rules for all TACT output.

**Implementation note (v3.0):** TACT is browser-first. The layout is defined once, in millimetres, in `index.html` as `window.TACT_LAYOUT` (the single source of truth). Both the on-screen preview (a true-to-scale SVG) and the STL generator read from it, so the preview is an exact mirror of the printed page. The numbers below document that object.

---

## Coordinate System

- **Origin:** bottom-left corner of the page (matching standard 3D printing bed coordinate space)
- **X-axis:** rightward (mm)
- **Y-axis:** upward (mm)
- **Z-axis:** out of the page surface (mm), with Z=0 at the top surface of the base plate
- **Units:** always millimetres

This matches the STL generator's coordinate system, eliminating any Y-flip conversion.

---

## Layout — Square page, full-width lines, illustration band (shipped)

The implemented layout is a **square page** where **every Braille line runs the full 21-cell width**. Illustrated pages put the picture in a **full-width band across the bottom**; text-only pages drop the picture and use all thirteen lines. Short lines are never produced.

This replaced the earlier L-shaped corner layout (7 full rows + 6 narrow 12-cell rows beside a 54×54mm bottom-right picture) after field feedback from Chris Bischke, Ph.D., TVI, DT/V (University of Utah), who reported that the half-width lines are uncomfortable to read: braille lines should run the full width. The revision costs about 14% of the cells on an illustrated page, accepted on purpose (see the paper, Section "A Third Revision from Expert Field Feedback", and `docs/decisions.md` D022).

```
Page size:  150 mm × 150 mm (square)
Margins:    10 mm on all sides
Print bed:  fits 220×220mm bed with 35mm clearance each side
```

```
┌────────────────────────────────────────────────┐  y=150
│  10mm margin                                    │
│  ███████████████████████████  full row (21)     │  line 1 baseline y=135
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │
│  ███████████████████████████  full row (21)     │  line 9 baseline y=55
│ ┌────────────────────────────────────────────┐ │  band top y=50
│ │         ILLUSTRATION BAND  130mm × 38mm    │ │
│ │         origin (10, 12), shape centred,    │ │
│ │         aspect preserved, never stretched  │ │
│ └────────────────────────────────────────────┘ │  y=12
│  10mm margin                                    │
└────────────────────────────────────────────────┘  y=0
   x=0                                        x=150
```

Illustrated page shown. A text-only page has no band and carries 13 full rows (last baseline y=15).

**Geometry (from `window.TACT_LAYOUT`):**

| Constant | Value | Meaning |
|---|---|---|
| `PAGE_W`, `PAGE_H` | 150, 150 | square page (mm) |
| `MARGIN` | 10 | all sides |
| `TZ_X` | 10 | left edge of every text row |
| `LINE_Y0` | 135 | baseline (bottom-left) of the first/top row |
| `LINE_H` | 10 | line spacing (baseline to baseline) |
| `CELL_W` | 6 | cell spacing |
| `LINE_WIDTHS` | `[21×9]` | illustrated page: 9 full rows above the band |
| `LINE_WIDTHS_FULL` | `[21×13]` | text-only page: 13 full rows |
| `ILL_X, ILL_Y` | 10, 12 | illustration band origin (bottom-left) |
| `ILL_W, ILL_H` | 130, 38 | illustration band size |
| `ILL_ABOVE` | 1.0 | illustration relief height above the base plate (STL only) |

Row `i` has its baseline at `y = LINE_Y0 - i*LINE_H` and holds up to `LINE_WIDTHS[i]` cells, left-aligned at `TZ_X`. The lowest illustrated row (baseline y=55, lowest dot edge y=54.2) clears the top of the band (y=50) by 4.2mm.

Odd pages are illustrated and even pages are text-only. The last page also carries the picture when its text fits the 9-row profile, so a story never ends on a half-empty card without one.

The **page number** is drawn as decorative overlay text in the preview only (top-right); it is not part of the printed Braille in the current build.

### Not implemented (future)

Earlier drafts of this spec defined three layout options (A picture-book, B text/illustration cards, C full-bed). The shipped build uses the single square band layout above. The alternatives remain possible future `layout` modes but are not in the current code.

---

## Braille Text Layout Rules

These apply identically across all layout options.

### Cell geometry

```
Dot diameter:        1.6mm  (designed; FDM produces ~1.3mm after shrinkage)
Dot height:          0.85mm (designed; FDM produces ~0.6mm after shrinkage)
Dot H spacing:       2.5mm  center-to-center (within cell, col 1 → col 2)
Dot V spacing:       2.5mm  center-to-center (within cell, row 1 → 2 → 3)
Cell width:          6.0mm  center-to-center (cell n to cell n+1)
Line height:        10.0mm  center-to-center (line n to line n+1)
```

Cell internal layout (dot numbering per Braille standard):

```
dot 1 (x+0.0, y+5.0)   dot 4 (x+2.5, y+5.0)
dot 2 (x+0.0, y+2.5)   dot 5 (x+2.5, y+2.5)
dot 3 (x+0.0, y+0.0)   dot 6 (x+2.5, y+0.0)
```

Where `(x, y)` is the bottom-left corner of the cell. Dot 3 is at the origin.

### Line and character limits (square band layout)

```
Row width:          21 cells (x 10 → 136), on every row of every page
Illustrated page:    9 rows = 189 cells (about 14% fewer than the old corner layout's 219)
Text-only page:     13 rows = 273 cells
```

### Overflow & word wrapping

Text never overflows or clips. Cells wrap into rows at each row's `LINE_WIDTHS[i]`
capacity, breaking at spaces. When a story needs more than one page, pagination
(below) distributes words so no page overflows and no page is left near-empty.

### Text origin

Text zone origin is the bottom-left corner of the zone. The first Braille line is placed at:
```
x = text_zone_origin_x  (left-aligned, no additional indent)
y = text_zone_origin_y + text_zone_height - line_height  (top line = top of zone)
```

Each subsequent line: `y -= 10.0`

### Punctuation and special cells

Liblouis inserts indicator cells automatically (capital indicator, number indicator). The layout engine treats all cells identically — width 6.0mm regardless of content.

---

## Illustration Zone Layout Rules

The illustration zone receives a `PlacementSpec` from Module 3b. The layout engine maps `PlacementSpec` mm coordinates into page space.

**Coordinate mapping:**

The art director produces placement coordinates in a `(0, 0) → (canvas_width_mm, canvas_height_mm)` space where `(0,0)` is top-left. The layout engine converts:

```
page_x = illustration_zone_origin_x + placement_x
page_y = illustration_zone_origin_y + (canvas_height_mm - placement_y - element_height_mm)
```

(Y is flipped because the page coordinate system has Y increasing upward, but SVG/art-director has Y increasing downward.)

**Minimum clearance from text zone:** 4.2mm between the lowest dot edge and the band top (already enforced by zone layout — no shapes may protrude above `illustration_zone_top`).

**Element clearance:** each placed element must maintain 3mm clearance from every other element and from zone edges. The renderer must clamp positions that violate this.

---

## Page Number Zone

Every page has a Braille page number in the bottom-right corner of the page number zone.

```
Position: right-aligned within page number zone
Content: Braille number indicator + digit(s) for the page number
Font size: standard Braille cell geometry (identical to text zone)
```

For page numbers 1–9: 2 cells (number indicator + digit).
For page numbers 10–99: 3 cells.

The number indicator cell and digit cells are placed right-aligned:
```
rightmost_cell_x = text_zone_origin_x + text_zone_width - 6.0
number_cells_origin_x = rightmost_cell_x - (n_cells - 1) * 6.0
```

---

## Multi-Page Pagination

The story text is paginated **greedily** (`paginateStory` in `index.html`): each
page is filled to its profile's capacity (9 rows illustrated, 13 rows text-only)
before the next begins. Each resulting page produces exactly one physical page
(one STL file).

An earlier version balanced words evenly across pages to avoid a sparse last
page. It was withdrawn: balancing moved the empty rows backwards into middle
pages, which have no picture to fill them, turning one unfinished card into two.
Now the leftover collects on the final card, which carries the illustration.
The story generator is also sized to this story's own braille density so a story
lands on two full cards (`measureFit` / `idealWordCount`).

**File naming:** `{slug}_page_{n:02d}.stl`  
Example: `pirate-cat-moon_page_01.stl`, `pirate-cat-moon_page_02.stl`, …

**Cover page:** no special handling in MVP. Page 1 is the first story page. A blank cover (base plate + title in Braille) is a future feature.

**Spine / binding:** not addressed in MVP. Pages are loose (or hole-punched by the user). Future: a 3mm hole in the top-left corner, 8mm from each edge, for a ring binder.

---

## Base Plate

Every STL file includes a contiguous base plate under all raised elements.

```
Width:        150mm   (PAGE_W)
Height:       150mm   (PAGE_H)
Thickness:    0.5mm                 (1-2 print layers at 0.3mm layer height)
Material:     homogeneous solid block (no infill holes — this is a 0.5mm slab)
Z range:      0.0 to 0.5mm
```

The base plate is the foundation. All Braille dots and tactile graphics sit on top of it (Z=0.5 to Z=0.5+element_height).

Corner radius: 2mm on all four corners (prevents sharp corners from cracking TPU/PETG pages during handling). Implemented as a hull operation in trimesh.

---

## Separation Between Tactile Elements

**Braille dot to dot (different cells):** enforced by the 6.0mm cell spacing — adjacent cells have 4.4mm edge-to-edge gap (6.0mm center - 1.6mm diameter = 4.4mm). ISO compliant.

**Braille to tactile graphic:** minimum 3mm edge-to-edge clearance between the last Braille line and the top of any raised illustration element. This is guaranteed by the layout: the lowest dot edge sits at y=54.2 and the band starts at y=50, a 4.2mm gap.

**Tactile graphic element to element:** minimum 3mm edge-to-edge, enforced by the PlacementSpec renderer (see `docs/shape-library-format.md`).

**Tactile graphic to page edge:** minimum 5mm (enforced by the 10mm margin — any shape rendered inside the illustration zone is already 10mm from the edge).

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-05-04 | Initial spec. Options A, B, C defined. Coordinate system, cell geometry, zone layout, pagination rules, base plate. |
| 2.0 | 2026-07-01 | Matches shipped browser build: **square 150×150 page**, single L-shaped corner layout (7 full rows + 6 narrow rows beside a bottom-right illustration), `window.TACT_LAYOUT` as single source of truth, true-to-scale SVG preview, **balanced** pagination (no orphan last page). Options B/C deferred. |
| 3.0 | 2026-09-11 | **Full-width lines, illustration band.** Every row runs 21 cells; the picture moves to a 130×38mm band at the bottom (origin 10, 12), drawn aspect-preserving. Illustrated pages hold 9 rows, text-only pages 13. Revised after expert field feedback on the short corner lines. Pagination is greedy again (balancing withdrawn). Illustration relief 1.0mm. |
