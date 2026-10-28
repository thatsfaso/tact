# Shape Library Format

**Status: v2.0 — tactile silhouettes (filled, flat view), see "Tactile rules".**

The shape library is TACT's most community-extensible component. This document defines every constraint a shape file must satisfy, the `index.json` contract, how the art director consumes it, and how contributors add new shapes.

---

## Directory Structure

```
shapes/
├── index.json          ← Machine-readable catalogue (all shapes, all metadata)
├── animals/
│   ├── cat_sitting.svg
│   ├── cat_standing.svg
│   ├── dog_sitting.svg
│   └── ...
├── vehicles/
│   ├── boat_small.svg
│   ├── boat_sailboat.svg
│   └── ...
├── nature/
│   ├── tree_simple.svg
│   ├── flower_simple.svg
│   └── ...
├── buildings/
│   ├── house_simple.svg
│   └── ...
├── people/
│   ├── person_standing.svg
│   └── ...
└── objects/
    ├── book.svg
    └── ...
```

The path of every shape file is `shapes/{category}/{name}.svg`. The `name` must exactly match the `name` field in `index.json`.

---

## SVG File Requirements

Every shape file must satisfy all of the following. Files that fail are rejected from the library.

### Coordinate system

- **viewBox:** always `"0 0 200 200"` — no exceptions. This gives a 200×200 unit canvas. 1 unit = 1mm when rendered at 200mm × 200mm (the illustration zone max size). Scaling down to 40mm×40mm means 1 unit = 0.2mm.
- **Width/height attributes:** omit entirely — let the consumer control size via CSS/SVG transforms.

### Tactile rules (v2, all shapes)

Every shape is printed cropped to its own drawing, with its longest side at about 37 mm in the top-right corner of the page, so **1 unit is roughly 0.2 mm**. The rules below are written for that size. They come from the first print read by a blind reader, who could not tell what the old outline drawing showed, and from Theurel et al. (2013), where early blind children identified raised-line drawings least well (27% against 36% for textured pictures), and the authors trace this to outlines giving few cues and being confused with the background.

- **Filled surfaces, not outlines.** The body of the thing is a solid black region (`fill="#000000"`). The silhouette carries the identity: ears, tail, legs, wheels, crown points.
- **Flat view.** Animals and vehicles from the side, people, buildings and objects from the front. No perspective, no three-quarter views, no foreshortening.
- **Strokes at least 12 units** (about 2.5 mm). Use strokes only for parts that are naturally thin: legs of a bird, a string, a staff, rays.
- **Gaps and holes at least 14 units** (about 3 mm), and white grooves 16 units. Anything closer merges under a fingertip and under the nozzle.
- **Holes and grooves are drawn in white** (`fill="#ffffff"` or a white stroke) on top of the black body: an eye, a window, a door, spots, a seam. White is read as "no relief".
- **Few details.** No faces on small heads, no fingers, no text. If a detail is under the size limits, leave it out rather than shrink it.
- **No dashes, gradients, opacity or text.**

The relief is built at 0.4 mm per pixel (the width of a standard nozzle), so curves print smooth. The on-screen preview shows that same bitmap, not the vector drawing, so what a parent sees is what the fingers will meet.

### Complexity limit

- Keep it to about 16 distinct elements per file (a snowflake with its branches is the upper bound). More pieces than that stop reading as one thing under a fingertip.
- Maximum total path node count: 400. Excessive nodes cause large STL files and slow slicing.

### File metadata

Every SVG must include this comment block as the second line (after `<svg ...>`):

```xml
<!-- TACT shape: {name} | category: {category} | license: CC0 | source: {url} -->
```

---

## `index.json` Schema

`shapes/index.json` is the machine-readable catalogue consumed by the art director LLM and the renderer.

### Top-level structure

```json
{
  "version": "1.0",
  "updated": "2026-05-04",
  "shapes": [ /* ShapeEntry[] */ ]
}
```

### ShapeEntry

```json
{
  "name": "cat_sitting",
  "file": "animals/cat_sitting.svg",
  "category": "animals",
  "tags": ["cat", "animal", "pet", "sitting", "domestic", "furry"],
  "description": "Cat in a sitting position, facing slightly left, outline only. Clear ear silhouette, tail curled beside body.",
  "natural_width_mm": 45,
  "natural_height_mm": 55,
  "has_fill": false,
  "source_url": "https://openclipart.org/detail/00000/cat-silhouette",
  "license": "CC0"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Snake_case. Matches the SVG filename (without `.svg`). |
| `file` | string | yes | Relative path from `shapes/`: `{category}/{name}.svg`. |
| `category` | string | yes | One of: `animals`, `vehicles`, `nature`, `buildings`, `people`, `objects`. |
| `tags` | string[] | yes | 3–10 lowercase single-word tags. Include synonyms. Used by art director for fuzzy matching. |
| `description` | string | yes | 1–2 sentences. Describe the visual appearance precisely — what is visible, what orientation, what detail is present or absent. The art director reads this. |
| `natural_width_mm` | number | yes | The intended print width at scale 1.0, in mm. Used by the renderer to compute scale factors. |
| `natural_height_mm` | number | yes | The intended print height at scale 1.0, in mm. |
| `has_fill` | boolean | yes | `true` for every shape since v2 (filled silhouettes). `false` only marked the old outline drawings. |
| `source_url` | string | yes | URL to the original CC0 source file. |
| `license` | string | yes | Always `"CC0"`. |

### Categories

| Category | What belongs here |
|---|---|
| `animals` | Any animal or creature, real or fictional (incl. dragon, unicorn) |
| `vehicles` | Boats, cars, planes, trains, rockets, bikes |
| `nature` | Trees, flowers, sun, moon, stars, clouds, mountains, water, rainbow, snowflake |
| `buildings` | Houses, castles, lighthouses, towers, bridges |
| `people` | Human & fairy-tale figures — princess, king, queen, witch, wizard, fairy, mermaid, knight, ghost |
| `objects` | Hats, books, crowns, food, tools, toys, magic wand, sword, lantern, gift… |

### Current catalogue (~89 shapes)

The library shipped with TACT is **hand-crafted tactile line art** (quality bar: the cat). It was expanded from a study of the most-cited subjects in children's fairy/bedtime stories. `shapes/index.json` is authoritative; `shapes/{category}/{name}.svg` are the files.

**Shape selection (browser):** the illustration for a page is chosen from the story text by `pickShapeFromText` in `index.html`, using **whole-word** keyword matching (a keyword must equal a full word — so "mare"/sea never matches "re"/king) with comprehensive Italian + English lists (singular, plural, common diminutives) for every shape. Unmatched text falls back to `star`.

**Note:** every shape in the library is hand-crafted. The early parametric generator has been removed from the repository — edit the SVGs directly.

---

## Geometric Primitive Generator

Primitives are generated at runtime from the renderer — no SVG file needed. They are always available as shape fallbacks.

```python
PRIMITIVES = {
    "rectangle": lambda w, h: f'<rect x="10" y="10" width="{w-20}" height="{h-20}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    "triangle":  lambda w, h: f'<polygon points="{w/2},10 10,{h-10} {w-10},{h-10}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    "oval":      lambda w, h: f'<ellipse cx="{w/2}" cy="{h/2}" rx="{w/2-10}" ry="{h/2-10}" fill="none" stroke="currentColor" stroke-width="6"/>',
    "circle":    lambda w, h: f'<circle cx="{w/2}" cy="{h/2}" r="{min(w,h)/2-10}" fill="none" stroke="currentColor" stroke-width="6"/>',
    "line":      lambda w, h: f'<line x1="10" y1="{h/2}" x2="{w-10}" y2="{h/2}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    "wave":      lambda w, h: f'<path d="M10,{h/2} Q{w/4},{h/2-30} {w/2},{h/2} T{w-10},{h/2}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
}
```

The renderer calls these when the art director selects a primitive shape name. All primitives fit in the `0 0 200 200` viewBox.

---

## Art Director LLM Prompt Template

The art director is a second (lightweight) LLM call that receives an `IllustrationSpec` from the story JSON and returns a `PlacementSpec`. Use the cheapest available backend (Ollama Llama 3.2 3B is sufficient).

### System prompt

```
You are the art director for TACT, a tactile Braille book tool for blind children.

Your job: given an illustration description and a list of shapes, choose which shapes to use and where to place them on a tactile page.

CANVAS SIZE: {canvas_width_mm}mm wide × {canvas_height_mm}mm tall.
MARGIN: 5mm on all sides. All placements must be within the margin-safe area.

AVAILABLE SHAPES:
{index_json_summary}

OUTPUT: a JSON object with this exact structure — no preamble, no explanation:
{
  "items": [
    {
      "name": "<shape name or primitive>",
      "x_mm": <left edge of shape bounding box, mm from canvas left>,
      "y_mm": <top edge of shape bounding box, mm from canvas top>,
      "width_mm": <rendered width>,
      "height_mm": <rendered height>,
      "mirror": <true|false>,
      "label": "<braille label or null>"
    }
  ]
}

RULES:
- Place 1–4 shapes total.
- No two shapes may overlap. Minimum 5mm gap between bounding boxes.
- Keep shapes within the margin-safe area ({canvas_width_mm-10}mm × {canvas_height_mm-10}mm).
- Scale shapes so the focal element fills 40–60% of the canvas area.
- Supporting elements should be 50–70% of the focal element's size.
- If a shape isn't in the available list, use the closest primitive: rectangle, triangle, oval, circle, line, or wave.
- Output ONLY the JSON. No other text.
```

### How to build `{index_json_summary}`

The art director prompt includes only the fields the LLM needs — not the full index.json:

```python
def build_index_summary(index: dict) -> str:
    lines = []
    for s in index["shapes"]:
        lines.append(
            f'- {s["name"]} ({s["category"]}): {s["description"]} Tags: {", ".join(s["tags"])}. Natural size: {s["natural_width_mm"]}×{s["natural_height_mm"]}mm.'
        )
    return "\n".join(lines)
```

---

## Initial Shape List

Minimum required for MVP. All must be present in `shapes/` and `index.json` before Module 3b is enabled.

| Name | Category | Natural size (mm) |
|---|---|---|
| `cat_sitting` | animals | 45×55 |
| `cat_standing` | animals | 60×45 |
| `dog_sitting` | animals | 45×55 |
| `dog_standing` | animals | 65×45 |
| `bird_flying` | animals | 65×40 |
| `bird_perched` | animals | 35×45 |
| `fish` | animals | 60×35 |
| `butterfly` | animals | 60×50 |
| `rabbit` | animals | 40×55 |
| `elephant` | animals | 65×55 |
| `bear` | animals | 50×60 |
| `lion` | animals | 60×50 |
| `owl` | animals | 40×55 |
| `horse` | animals | 65×50 |
| `duck` | animals | 50×45 |
| `frog` | animals | 55×40 |
| `turtle` | animals | 60×40 |
| `boat_small` | vehicles | 65×45 |
| `boat_sailboat` | vehicles | 55×70 |
| `car_simple` | vehicles | 70×40 |
| `bicycle` | vehicles | 70×50 |
| `airplane` | vehicles | 75×40 |
| `train_simple` | vehicles | 80×40 |
| `rocket` | vehicles | 35×70 |
| `tree_simple` | nature | 45×70 |
| `flower_simple` | nature | 40×60 |
| `sun` | nature | 65×65 |
| `moon` | nature | 55×60 |
| `star` | nature | 55×55 |
| `cloud` | nature | 70×40 |
| `mountain` | nature | 70×55 |
| `wave` | nature | 80×35 |
| `leaf` | nature | 40×55 |
| `house_simple` | buildings | 65×65 |
| `castle_tower` | buildings | 45×75 |
| `lighthouse` | buildings | 35×75 |
| `person_standing` | people | 35×70 |
| `person_child` | people | 30×60 |
| `person_waving` | people | 40×65 |
| `book` | objects | 55×45 |
| `hat_pirate` | objects | 60×40 |
| `crown` | objects | 60×35 |
| `key` | objects | 30×65 |
| `heart` | objects | 55×50 |
| `apple` | objects | 50×55 |
| `umbrella` | objects | 60×60 |

---

## CC0 Source Cleanup Script Spec

SVGs from OpenClipart and SVG Silh are not tactile-ready. The cleanup script (`tools/tactile_clean.py`) does the following:

1. **Load** the source SVG with `svgpathtools` or `lxml`
2. **Normalize viewBox** to `0 0 200 200` (scale all path coordinates proportionally)
3. **Fill the body:** the main silhouette gets `fill="#000000"`; inner details either go or become white holes ≥ 14 units
4. **Thicken strokes:** any remaining stroke is ≥ 12 units, round caps and joins
5. **Set linecap + linejoin:** `round` on all elements
6. **Remove:** gradients, filters, masks, clip-paths, `<text>`, `<image>`, `<use>` elements, CSS classes, inline `style` attributes (except stroke/fill)
7. **Remove tiny paths:** delete any path whose bounding box is smaller than 5×5 units
8. **Check gap constraint:** warn (do not auto-fix) if any two element bounding boxes are closer than 15 units
9. **Validate node count:** warn if total node count > 400
10. **Write** the cleaned SVG to `shapes/{category}/{name}.svg`
11. **Add** the comment metadata line

Usage:
```bash
python tools/tactile_clean.py source.svg animals cat_sitting https://openclipart.org/detail/xxx
```

---

## Contributor Quality Checklist

Before opening a GitHub PR to add a shape, verify all of the following:

- [ ] File is in the correct `shapes/{category}/` directory
- [ ] Filename is `{name}.svg` matching exactly the `index.json` `name` field
- [ ] viewBox is exactly `"0 0 200 200"`
- [ ] No `width` or `height` attributes on the `<svg>` element
- [ ] The body is a filled silhouette in a flat view (side or front), not an outline
- [ ] All strokes ≥ 12 units wide, round caps and joins
- [ ] Gaps and holes ≥ 14 units, white grooves ≥ 16 units
- [ ] No text, image, use, gradient, filter, mask, or clip-path elements
- [ ] All paths are closed where possible
- [ ] Checked in the result preview, which shows the printed relief bitmap: nothing thin, nothing merged
- [ ] Total path node count ≤ 400
- [ ] Comment metadata line present as second line of SVG
- [ ] `index.json` entry added with all required fields
- [ ] Source is CC0, URL provided
- [ ] Printed a test STL at 100mm size on a budget FDM (or verified with a tactile graphics expert)

---

## Contribution Process

1. Fork the TACT repository
2. Run the cleanup script on your source SVG
3. Verify the quality checklist above
4. Add the `index.json` entry (in alphabetical order within the category)
5. Open a PR with title: `shape: add {name} ({category})`
6. The PR description must include: a photo or screenshot of the cleaned SVG, the CC0 source URL, and any notes about the shape's tactile properties
