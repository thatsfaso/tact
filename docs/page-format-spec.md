# Page Format Specification

**Status: v4.0 — matches the shipped browser implementation.**

This document defines the physical page dimensions, coordinate system, layout zones, and pagination rules for all TACT output.

**Implementation note (v4.0):** TACT is browser-first. The layout is defined once, in millimetres, in `index.html` as `window.TACT_LAYOUT` (the single source of truth). Both the on-screen preview (a true-to-scale SVG) and the STL generator read from it, so the preview is an exact mirror of the printed page. The numbers below document that object.

---

## Coordinate System

- **Origin:** bottom-left corner of the page (matching standard 3D printing bed coordinate space)
- **X-axis:** rightward (mm)
- **Y-axis:** upward (mm)
- **Z-axis:** out of the page surface (mm), with Z=0 at the top surface of the base plate
- **Units:** always millimetres

This matches the STL generator's coordinate system, eliminating any Y-flip conversion.

---

## Layout — Square page, picture in the top-right corner (shipped)

The implemented layout is a **square page** with the picture set into the **top-right corner**, the way a printed picture book places a small illustration in its text. Only the **first four lines are shortened**, to 15 of 21 cells (71%); every line below runs the full width. Text-only pages use all thirteen lines at full width. The left margin never moves, so the reading finger always returns to the same place.

How it got here:

1. **L-shape (v2.0).** Six 12-cell lines (57% width) beside a 54×54mm bottom-right picture. Chris Bischke, Ph.D., TVI, DT/V (University of Utah), reviewing the site, advised placing pictures at the beginning or end of a story to avoid short lines of braille.
2. **Bottom band (v3.0).** Every line full width, the picture in a 130×38mm band along the bottom. A blind reader who printed a page found a small picture in an "ocean" of blank plastic and, printing the page standing up, met no braille until a third of the print was done.
3. **Top-right corner (v4.0).** Four slightly shorter lines instead of six half lines, no blank band at the bottom, braille is the first thing printed when the page stands up. An illustrated page holds 249 cells (band: 189, L-shape: 219).

```
Page size:  150 mm × 150 mm (square)
Margins:    10 mm on all sides
Print bed:  fits 220×220mm bed with 35mm clearance each side
```

```
┌────────────────────────────────────────────────┐  y=150
│  10mm margin                                    │
│    █████████████████   ┌──────────────┐         │  line 1 baseline y=135 (opens in cell 3)
│  ███████████████████   │ ILLUSTRATION │         │
│  ███████████████████   │ 36.8 × 36 mm │         │
│  ███████████████████   │ origin       │         │  line 4: 15 cells, ends x=97.3
│                        │ (103.2, 104) │         │
│  ███████████████████████████  full row (21)     │  line 5 baseline y=95, dots top y=100.8
│  ███████████████████████████  full row (21)     │
│  ...                                            │
│  ███████████████████████████  full row (21)     │  line 13 baseline y=15
│  10mm margin                                    │
└────────────────────────────────────────────────┘  y=0
   x=0                                        x=150
```

Illustrated page shown. A text-only page has no picture and carries 13 full rows.

**Geometry (from `window.TACT_LAYOUT`):**

| Constant | Value | Meaning |
|---|---|---|
| `PAGE_W`, `PAGE_H` | 150, 150 | square page (mm) |
| `MARGIN` | 10 | all sides |
| `TZ_X` | 10 | left edge of every text row |
| `LINE_Y0` | 135 | baseline (bottom-left) of the first/top row |
| `LINE_H` | 10 | line spacing (baseline to baseline) |
| `CELL_W` | 6 | cell spacing |
| `LINE_WIDTHS` | `[15×4, 21×9]` | illustrated page: 4 short rows beside the picture, 9 full rows |
| `LINE_WIDTHS_FULL` | `[21×13]` | text-only page: 13 full rows |
| `PARA_INDENT` | 2 | blank cells opening page 1 (paragraph starts in cell 3) |
| `ILL_X, ILL_Y` | 103.2, 104 | illustration zone origin (bottom-left) |
| `ILL_W, ILL_H` | 36.8, 36 | illustration zone size |
| `ILL_ABOVE` | 1.0 | illustration relief height above the base plate (STL only) |
| `ILL_PIX` | 0.4 | relief resolution in mm per pixel |

Row `i` has its baseline at `y = LINE_Y0 - i*LINE_H` and holds up to `LINE_WIDTHS[i]` cells, left-aligned at `TZ_X`. The 15th cell of a short row ends at x=97.3, 5.9mm left of the picture. The picture's bottom (y=104) clears the dots of row 5 (top edge y=100.8) by 3.2mm.

Odd pages are illustrated and even pages are text-only. The last page also carries the picture when its text fits the illustrated profile.

**Paragraphs.** A story is one paragraph: page 1 opens it in cell 3, and every later page is a runover that starts in cell 1. The .brf export uses the same rule on 40-cell lines.

The **page number** is drawn as decorative overlay text in the preview only (top-left, since the top-right corner belongs to the picture); it is not part of the printed Braille in the current build.

### Not implemented (future)

Earlier drafts of this spec defined three layout options (A picture-book, B text/illustration cards, C full-bed). The shipped build uses the single square corner layout above. The alternatives remain possible future `layout` modes but are not in the current code.

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

### Line and character limits (square corner layout)

```
Short rows:         4 rows × 15 cells (x 10 → 97.3), beside the picture
Full rows:          21 cells (x 10 → 136)
Illustrated page:   4 × 15 + 9 × 21 = 249 cells
Text-only page:     13 × 21 = 273 cells
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

**Minimum clearance from text:** 3.2mm below the picture to the dots of row 5, and 5.9mm beside it to the end of a short row (enforced by the zone layout).

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

**Braille to tactile graphic:** minimum 3mm edge-to-edge clearance between the last Braille line and the top of any raised illustration element. This is guaranteed by the layout: 3.2mm below the picture to row 5, 5.9mm beside it to the end of a short row.

**Tactile graphic element to element:** minimum 3mm edge-to-edge, enforced by the PlacementSpec renderer (see `docs/shape-library-format.md`).

**Tactile graphic to page edge:** minimum 5mm (enforced by the 10mm margin — any shape rendered inside the illustration zone is already 10mm from the edge).

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-05-04 | Initial spec. Options A, B, C defined. Coordinate system, cell geometry, zone layout, pagination rules, base plate. |
| 2.0 | 2026-07-01 | Matches shipped browser build: **square 150×150 page**, single L-shaped corner layout (7 full rows + 6 narrow rows beside a bottom-right illustration), `window.TACT_LAYOUT` as single source of truth, true-to-scale SVG preview, **balanced** pagination (no orphan last page). Options B/C deferred. |
| 3.0 | 2026-09-11 | **Full-width lines, illustration band.** Every row runs 21 cells; the picture moves to a 130×38mm band at the bottom (origin 10, 12), drawn aspect-preserving. Illustrated pages hold 9 rows, text-only pages 13. Revised after expert field feedback on the short corner lines. Pagination is greedy again (balancing withdrawn). Illustration relief 1.0mm. |
| 4.0 | 2026-10-26 | **Picture in the top-right corner.** Four 15-cell rows beside a 36.8×36mm picture, nine full rows below (249 cells). Paragraph opens in cell 3 on page 1. Relief at 0.4mm per pixel, cropped to the drawing. Revised after a blind reader printed and read a page. |
