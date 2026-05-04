# Page Format Specification

**Status: v1.0 — locked for implementation.**

This document defines the physical page dimensions, coordinate system, layout zones, and pagination rules for all TACT output. The layout engine (Module 4) must implement these rules exactly. The STL generator (Module 5) consumes the output.

---

## Coordinate System

- **Origin:** bottom-left corner of the page (matching standard 3D printing bed coordinate space)
- **X-axis:** rightward (mm)
- **Y-axis:** upward (mm)
- **Z-axis:** out of the page surface (mm), with Z=0 at the top surface of the base plate
- **Units:** always millimetres

This matches the STL generator's coordinate system, eliminating any Y-flip conversion.

---

## Layout Options

Three layout options are supported, selectable via the `layout` field in `StoryJSON`. All share the same coordinate system and margin rules.

### Option A — Picture Book (default)

The primary layout. Mimics a children's picture book: short text block at top, full-width illustration below.

```
Page size:  150 mm wide × 200 mm tall
Margins:    10 mm on all sides
Print bed:  fits 220×220mm bed with 35mm clearance each side
```

```
┌──────────────────────────────────────────────┐  y=200
│                10mm margin                   │
│  ┌────────────────────────────────────────┐  │  y=190
│  │  TEXT ZONE                             │  │
│  │  width: 130mm  height: 54mm           │  │
│  │  origin: (10, 136)                    │  │
│  │  5 Braille lines × 10mm line-spacing  │  │
│  │  4mm top padding                      │  │
│  └────────────────────────────────────────┘  │  y=136
│                6mm gap                        │
│  ┌────────────────────────────────────────┐  │  y=130
│  │  ILLUSTRATION ZONE                     │  │
│  │  width: 130mm  height: 102mm          │  │
│  │  origin: (10, 28)                     │  │
│  └────────────────────────────────────────┘  │  y=28
│                8mm gap                        │
│  ┌────────────────────────────────────────┐  │  y=20
│  │  PAGE NUMBER ZONE                      │  │
│  │  width: 130mm  height: 8mm            │  │
│  │  origin: (10, 12)                     │  │
│  │  right-aligned Braille number cell    │  │
│  └────────────────────────────────────────┘  │  y=12
│                10mm margin                   │
└──────────────────────────────────────────────┘  y=0
   x=0                              x=150
```

**Zone summary (Option A):**

| Zone | X origin | Y origin | Width | Height |
|---|---|---|---|---|
| Margins (all sides) | — | — | — | 10mm |
| Text zone | 10 | 136 | 130 | 54 |
| Gap | — | 130 | — | 6 |
| Illustration zone | 10 | 28 | 130 | 102 |
| Gap | — | 20 | — | 8 |
| Page number zone | 10 | 12 | 130 | 8 |
| Margin | — | 0 | — | 12 |

---

### Option B — Text Card + Illustration Card

Two separate printable objects per story "spread": a text-dense card and a reusable illustration card. Both are smaller to fit multiple on one print bed.

**Text Card:**
```
Page size:  150 mm wide × 200 mm tall
Margins:    10mm all sides
Text zone:  origin (10, 30), width 130mm, height 160mm
            10 Braille lines × 10mm = 100mm text; remainder for overflow
Page number zone: same as Option A
No illustration zone.
```

**Illustration Card:**
```
Page size:  120 mm wide × 160 mm tall
Margins:    8mm all sides
Illustration zone:  origin (8, 8), width 104mm, height 136mm
            (fills the card — no text, no page number)
Label zone: optional 8mm strip at bottom for a single Braille word
```

Two illustration cards fit side-by-side on a 220×220mm bed (`2 × 120 = 240` — tight; print one at a time or orient diagonally).

---

### Option C — Full Bed

Maximises content per print. Text left column, illustration right column, on a square page that uses the full printer bed.

```
Page size:  200 mm wide × 200 mm tall  (fits 220×220mm bed with 10mm margins)
Margins:    10mm all sides
```

```
┌────────────────────────────────────────────────────────────────┐  y=200
│  10mm margin                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │  y=190
│  │  TEXT ZONE               │  │  ILLUSTRATION ZONE        │  │
│  │  width: 80mm             │  │  width: 90mm              │  │
│  │  height: 174mm           │  │  height: 174mm            │  │
│  │  origin: (10, 16)        │  │  origin: (100, 16)        │  │
│  │  ~8 Braille lines        │  │  (6mm gap from text zone) │  │
│  └──────────────────────────┘  └──────────────────────────┘  │  y=16
│  ┌────────────────────────────────────────────────────────┐   │  y=15
│  │  PAGE NUMBER ZONE — full width                         │   │
│  │  origin: (10, 10)  width: 180mm  height: 5mm          │   │
│  └────────────────────────────────────────────────────────┘   │  y=10
│  10mm margin                                                   │
└────────────────────────────────────────────────────────────────┘  y=0
   x=0                                                  x=200
```

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

### Line and character limits (Option A text zone, 130mm wide)

```
Usable width per line:        130mm
Characters per line:          floor(130 / 6.0) = 21 cells
Lines per text zone:          5 (hard limit for Option A)
Words per line (approx):      4 (average English/Italian word ≈ 5 chars + space = 6 cells)
Total words in text zone:     ~20 words
```

For Option B text card: `floor(130 / 6.0) = 21` cells per line, 10 lines = ~40-50 words.
For Option C text column: `floor(80 / 6.0) = 13` cells per line, 8 lines = ~25-30 words.

### Overflow

If translated Braille overflows the text zone line count:
1. Truncate at the last complete word that fits — never mid-word.
2. Log a warning. The story generator should have respected the word limit, so overflow indicates an LLM schema violation.
3. Do NOT spill text into the illustration zone.

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

**Minimum clearance from text zone:** 6mm (already enforced by zone layout — no shapes may protrude above `illustration_zone_top`).

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

The layout engine paginates `StoryJSON.pages[]` in order. Each `Page` object produces exactly one physical page (one STL file).

**File naming:** `{slug}_page_{n:02d}.stl`  
Example: `pirate-cat-moon_page_01.stl`, `pirate-cat-moon_page_02.stl`, …

**Cover page:** no special handling in MVP. Page 1 is the first story page. A blank cover (base plate + title in Braille) is a future feature.

**Spine / binding:** not addressed in MVP. Pages are loose (or hole-punched by the user). Future: a 3mm hole in the top-left corner, 8mm from each edge, for a ring binder.

---

## Base Plate

Every STL file includes a contiguous base plate under all raised elements.

```
Width:        page_width_mm         (150 for A/B, 200 for C)
Height:       page_height_mm        (200 for A/B, 200 for C)
Thickness:    0.5mm                 (1-2 print layers at 0.3mm layer height)
Material:     homogeneous solid block (no infill holes — this is a 0.5mm slab)
Z range:      0.0 to 0.5mm
```

The base plate is the foundation. All Braille dots and tactile graphics sit on top of it (Z=0.5 to Z=0.5+element_height).

Corner radius: 2mm on all four corners (prevents sharp corners from cracking TPU/PETG pages during handling). Implemented as a hull operation in trimesh.

---

## Separation Between Tactile Elements

**Braille dot to dot (different cells):** enforced by the 6.0mm cell spacing — adjacent cells have 4.4mm edge-to-edge gap (6.0mm center - 1.6mm diameter = 4.4mm). ISO compliant.

**Braille to tactile graphic:** minimum 3mm edge-to-edge clearance between the last Braille line and the top of any raised illustration element. This is guaranteed by the 6mm gap between text zone and illustration zone (with the tallest Braille dot at 0.85mm height, the gap is more than sufficient).

**Tactile graphic element to element:** minimum 3mm edge-to-edge, enforced by the PlacementSpec renderer (see `docs/shape-library-format.md`).

**Tactile graphic to page edge:** minimum 5mm (enforced by the 10mm margin — any shape rendered inside the illustration zone is already 10mm from the edge).

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-05-04 | Initial spec. Options A, B, C defined. Coordinate system, cell geometry, zone layout, pagination rules, base plate. |
