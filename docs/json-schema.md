# JSON Schema — LLM Output Contract

This is the authoritative data contract between the LLM content generator (Module 2) and every downstream module (3a Braille translation, 3b tactile graphics, 4 page layout, 5 STL generator).

**Status: v1.0 — locked for implementation.**

All modules must consume and produce these types. Never change a field without updating this document and all affected modules.

---

## Overview

The LLM receives a story prompt and outputs a `StoryJSON` object. This object is:

- Parsed by **Module 3a** to extract per-page `text` strings → Braille cells
- Parsed by **Module 3b** to extract per-page `illustration` specs → tactile SVG
- Passed to **Module 4** (layout engine) which composes pages from both
- Module 4 outputs `PageElement[]` lists consumed by **Module 5** (STL generator)

The LLM only produces `StoryJSON`. Everything downstream is deterministic engineering.

---

## Type Hierarchy

```
StoryJSON
├── version          string
├── language         "it" | "en"
├── braille_grade    1 | 2
├── title            string
├── slug             string
├── layout           "picture_book" | "text_card" | "full_bed"
└── pages            Page[]
      ├── page_number  integer
      ├── text         string
      └── illustration IllustrationSpec (optional)
            ├── scene        string
            ├── layout_hint  "center" | "left" | "right" | "distributed"
            └── elements     IllustrationElement[]
                  ├── shape     string
                  ├── label     string (optional)
                  ├── scale     number
                  ├── position  string
                  └── mirror    boolean
```

Internal pipeline types (not LLM output):

```
PlacementSpec        (Module 3b internal — art director output)
PageElement[]        (Module 4 output → Module 5 input)
```

---

## StoryJSON

The top-level object returned by the LLM.

```json
{
  "version": "1.0",
  "language": "en",
  "braille_grade": 1,
  "title": "The Pirate Cat and the Moon",
  "slug": "pirate-cat-moon",
  "layout": "picture_book",
  "pages": [ /* Page[] */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | `"1.0"` | yes | Always literal `"1.0"` for this schema version. |
| `language` | `"it"` \| `"en"` | yes | ISO 639-1 code. Drives Liblouis table selection. |
| `braille_grade` | `1` \| `2` | yes | Italian: always `1` (no Grade 2 exists). English: `1` for children (default), `2` for advanced. |
| `title` | string | yes | Human-readable. Used in UI and for STL file naming. Not rendered in Braille on pages. |
| `slug` | string | no | URL-safe, lowercase, hyphens only (`^[a-z0-9-]+$`). Derived from `title` if absent. Used for STL filenames: `{slug}_page_01.stl`. |
| `layout` | string | no | Default: `"picture_book"`. See Page Layout section. |
| `pages` | `Page[]` | yes | Minimum 1 page. Order is significant. |

---

## Page

One page of the physical book. In `picture_book` layout: ~20 words of text + one illustration.

```json
{
  "page_number": 1,
  "text": "Once upon a time, a brave cat named Whiskers wore a tiny eyepatch and dreamed of the moon.",
  "illustration": { /* IllustrationSpec */ }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `page_number` | integer ≥ 1 | yes | 1-indexed. Must be sequential with no gaps. |
| `text` | string | yes | Plain text only. No markdown, no HTML. Liblouis translates this directly. Max ~20 words for `picture_book`, ~45 words for `text_card` / `full_bed`. |
| `illustration` | `IllustrationSpec` | no | Omit for text-only pages (e.g. title page or final page with just a page number). |

**Text rules (enforced at validation):**
- No em-dashes (`—`); use a comma or period instead (Braille has no em-dash cell in Grade 1)
- No ellipsis character (`…`); use three periods `...`
- Accented Italian characters (`à è é ì ò ù`) are fine — Liblouis handles them
- Numbers must be written as digits (`3`), not words (`three`) — the number indicator is added automatically by Liblouis

---

## IllustrationSpec

What the LLM tells Module 3b to draw. The art director (a second, cheap LLM call) receives this and produces a `PlacementSpec`.

```json
{
  "scene": "A small cat in a pirate hat sailing a wooden boat across silvery clouds",
  "layout_hint": "distributed",
  "elements": [
    {
      "shape": "cat_standing",
      "label": "gatto",
      "scale": 1.0,
      "position": "left",
      "mirror": false
    },
    {
      "shape": "boat_small",
      "scale": 1.2,
      "position": "center",
      "mirror": false
    },
    {
      "shape": "moon",
      "scale": 0.8,
      "position": "right",
      "mirror": false
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `scene` | string | yes | 1–2 sentence natural-language description for the art director LLM. Should convey mood and spatial relationships, not just object list. |
| `layout_hint` | string | no | Default: `"center"`. Hint to the art director renderer about preferred composition. |
| `elements` | `IllustrationElement[]` | yes | 1–4 elements. More than 4 is visually crowded and tactilely unreadable. |

**`layout_hint` values:**

| Value | Meaning |
|---|---|
| `"center"` | Single focal element centered in illustration zone |
| `"left"` | Focal element left-aligned, supporting elements right |
| `"right"` | Focal element right-aligned |
| `"distributed"` | Elements spread across the full illustration zone width |

---

## IllustrationElement

A single tactile shape within the illustration.

```json
{
  "shape": "cat_standing",
  "label": "cat",
  "scale": 1.0,
  "position": "foreground",
  "mirror": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `shape` | string | yes | Must match a filename (without `.svg`) in the shape library: `shapes/{category}/{shape}.svg`. Use primitive fallbacks (`rectangle`, `triangle`, `oval`, `circle`, `line`) if a specific shape doesn't exist. |
| `label` | string | no | Short Braille label placed below the element. Max 2 words. Use the story's language. Omit for supporting/background elements. |
| `scale` | number | no | Default: `1.0`. Range: `0.5`–`2.0`. Relative to the element's natural size within the illustration zone. |
| `position` | string | no | Default: `"center"`. Positional hint for the renderer. |
| `mirror` | boolean | no | Default: `false`. Mirror the SVG horizontally. Useful for facing-direction of animals/vehicles. |

**`position` values:** `"foreground"`, `"background"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"center"`

**Primitive fallback shapes** (always available, no SVG file needed):

| Shape name | Renders as |
|---|---|
| `rectangle` | Tall rectangle (building, door, box) |
| `triangle` | Equilateral triangle (mountain, tent, tree) |
| `oval` | Oval (face, egg, balloon) |
| `circle` | Circle (sun, ball, planet) |
| `line` | Horizontal line (horizon, path, road) |
| `wave` | Sine wave (water, hills, snake) |

---

## Internal Pipeline Types (not LLM output)

These are produced inside the pipeline, not by the LLM. Documented here for completeness.

### PlacementSpec

Produced by Module 3b's art director call. Consumed by the SVG renderer.

```json
{
  "canvas_width_mm": 130,
  "canvas_height_mm": 110,
  "items": [
    {
      "svg_file": "shapes/animals/cat_standing.svg",
      "x_mm": 12,
      "y_mm": 8,
      "width_mm": 40,
      "height_mm": 55,
      "mirror": false,
      "label": "cat",
      "label_x_mm": 16,
      "label_y_mm": 66
    }
  ]
}
```

### PageElement

Produced by Module 4 (layout engine). Consumed by Module 5 (STL generator).

```python
@dataclass
class PageElement:
    type: Literal["braille_dot", "tactile_path", "base_plate"]
    x: float       # mm from page origin (bottom-left)
    y: float       # mm from page origin
    z: float       # mm (base plate top surface = 0)
    data: Any
    # For braille_dot: {"radius": 0.8, "height": 0.85}
    # For tactile_path: {"svg_path": "M...", "extrusion_height": 1.0}
    # For base_plate: {"width": 150, "height": 200, "thickness": 0.5}
```

---

## Formal JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/tact-project/tact/blob/main/docs/json-schema.md",
  "title": "StoryJSON",
  "description": "TACT LLM output contract v1.0",
  "type": "object",
  "required": ["version", "language", "braille_grade", "title", "pages"],
  "additionalProperties": false,
  "properties": {
    "version":       { "type": "string", "const": "1.0" },
    "language":      { "type": "string", "enum": ["it", "en"] },
    "braille_grade": { "type": "integer", "enum": [1, 2] },
    "title":         { "type": "string", "minLength": 1, "maxLength": 120 },
    "slug":          { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "layout":        { "type": "string", "enum": ["picture_book", "text_card", "full_bed"], "default": "picture_book" },
    "pages": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/Page" }
    }
  },
  "$defs": {
    "Page": {
      "type": "object",
      "required": ["page_number", "text"],
      "additionalProperties": false,
      "properties": {
        "page_number":  { "type": "integer", "minimum": 1 },
        "text":         { "type": "string", "minLength": 1, "maxLength": 600 },
        "illustration": { "$ref": "#/$defs/IllustrationSpec" }
      }
    },
    "IllustrationSpec": {
      "type": "object",
      "required": ["scene", "elements"],
      "additionalProperties": false,
      "properties": {
        "scene":       { "type": "string", "minLength": 5, "maxLength": 300 },
        "layout_hint": { "type": "string", "enum": ["center", "left", "right", "distributed"], "default": "center" },
        "elements": {
          "type": "array",
          "minItems": 1,
          "maxItems": 4,
          "items": { "$ref": "#/$defs/IllustrationElement" }
        }
      }
    },
    "IllustrationElement": {
      "type": "object",
      "required": ["shape"],
      "additionalProperties": false,
      "properties": {
        "shape":    { "type": "string", "minLength": 1 },
        "label":    { "type": "string", "maxLength": 30 },
        "scale":    { "type": "number", "minimum": 0.5, "maximum": 2.0, "default": 1.0 },
        "position": {
          "type": "string",
          "enum": ["foreground", "background", "left", "right", "top", "bottom", "center"],
          "default": "center"
        },
        "mirror":   { "type": "boolean", "default": false }
      }
    }
  }
}
```

---

## Example 1 — English story (3 pages, picture_book)

```json
{
  "version": "1.0",
  "language": "en",
  "braille_grade": 1,
  "title": "The Pirate Cat and the Moon",
  "slug": "pirate-cat-moon",
  "layout": "picture_book",
  "pages": [
    {
      "page_number": 1,
      "text": "Once upon a time, a brave cat named Whiskers wore a tiny eyepatch and dreamed of the moon.",
      "illustration": {
        "scene": "A cat with a pirate eyepatch sitting alone, looking upward toward the moon",
        "layout_hint": "center",
        "elements": [
          {
            "shape": "cat_sitting",
            "label": "cat",
            "scale": 1.2,
            "position": "center",
            "mirror": false
          }
        ]
      }
    },
    {
      "page_number": 2,
      "text": "He built a small wooden boat and sailed across a sea of silver clouds, all the way to the stars.",
      "illustration": {
        "scene": "A small boat with a sail moving across wavy clouds, with stars above",
        "layout_hint": "distributed",
        "elements": [
          {
            "shape": "boat_sailboat",
            "label": "boat",
            "scale": 1.1,
            "position": "center",
            "mirror": false
          },
          {
            "shape": "wave",
            "scale": 1.3,
            "position": "bottom",
            "mirror": false
          },
          {
            "shape": "star",
            "scale": 0.7,
            "position": "top",
            "mirror": false
          }
        ]
      }
    },
    {
      "page_number": 3,
      "text": "There he found a quiet garden where the moon kept her gentlest songs.",
      "illustration": {
        "scene": "A crescent moon surrounded by small flowers in a peaceful garden",
        "layout_hint": "center",
        "elements": [
          {
            "shape": "moon",
            "label": "moon",
            "scale": 1.3,
            "position": "center",
            "mirror": false
          },
          {
            "shape": "flower_simple",
            "scale": 0.7,
            "position": "left",
            "mirror": false
          },
          {
            "shape": "flower_simple",
            "scale": 0.7,
            "position": "right",
            "mirror": true
          }
        ]
      }
    }
  ]
}
```

---

## Example 2 — Italian story (3 pages, picture_book)

```json
{
  "version": "1.0",
  "language": "it",
  "braille_grade": 1,
  "title": "Il Gatto Pirata e la Luna",
  "slug": "gatto-pirata-luna",
  "layout": "picture_book",
  "pages": [
    {
      "page_number": 1,
      "text": "C'era una volta un gatto coraggioso di nome Baffi, con una piccola benda, che sognava la luna.",
      "illustration": {
        "scene": "Un gatto con una benda da pirata seduto da solo, che guarda verso la luna",
        "layout_hint": "center",
        "elements": [
          {
            "shape": "cat_sitting",
            "label": "gatto",
            "scale": 1.2,
            "position": "center",
            "mirror": false
          }
        ]
      }
    },
    {
      "page_number": 2,
      "text": "Costruì una piccola barca di legno e navigò un mare di nuvole d'argento, fino alle stelle.",
      "illustration": {
        "scene": "Una piccola barca a vela che naviga su nuvole ondulate, con stelle in alto",
        "layout_hint": "distributed",
        "elements": [
          {
            "shape": "boat_sailboat",
            "label": "barca",
            "scale": 1.1,
            "position": "center",
            "mirror": false
          },
          {
            "shape": "wave",
            "scale": 1.3,
            "position": "bottom",
            "mirror": false
          },
          {
            "shape": "star",
            "scale": 0.7,
            "position": "top",
            "mirror": false
          }
        ]
      }
    },
    {
      "page_number": 3,
      "text": "Là trovò un giardino silenzioso dove la luna custodiva le sue canzoni più dolci.",
      "illustration": {
        "scene": "Una luna crescente circondata da piccoli fiori in un giardino tranquillo",
        "layout_hint": "center",
        "elements": [
          {
            "shape": "moon",
            "label": "luna",
            "scale": 1.3,
            "position": "center",
            "mirror": false
          },
          {
            "shape": "flower_simple",
            "scale": 0.7,
            "position": "left",
            "mirror": false
          },
          {
            "shape": "flower_simple",
            "scale": 0.7,
            "position": "right",
            "mirror": true
          }
        ]
      }
    }
  ]
}
```

---

## LLM Prompt Template

Use this system prompt verbatim when calling any LLM backend (Ollama, Claude API, OpenAI). The user prompt is the story request.

### System prompt

```
You are a children's story writer for TACT, a tool that produces 3D-printable Braille books for blind children.

Your output is ONLY valid JSON — no preamble, no explanation, no markdown fences. Just the JSON object.

Follow this schema exactly:

{
  "version": "1.0",
  "language": "<it or en — match the user's request language>",
  "braille_grade": 1,
  "title": "<short story title>",
  "slug": "<url-safe slug from title>",
  "layout": "picture_book",
  "pages": [
    {
      "page_number": <integer starting at 1>,
      "text": "<20 words max of story text. Plain text only. No dashes, no ellipsis character.>",
      "illustration": {
        "scene": "<1-2 sentence description of what to draw>",
        "layout_hint": "<center|left|right|distributed>",
        "elements": [
          {
            "shape": "<shape name from library or primitive>",
            "label": "<optional 1-2 word label in story language>",
            "scale": <0.5 to 2.0>,
            "position": "<foreground|background|left|right|top|bottom|center>",
            "mirror": <true|false>
          }
        ]
      }
    }
  ]
}

Rules:
- Write 3 to 6 pages for a short story (200 words total max).
- Each page: maximum 20 words of text.
- Each illustration: 1 to 4 elements maximum.
- Text must be in the same language as the request.
- Italian braille_grade is always 1. English braille_grade is always 1 for children.
- Available shape names (use exact names or primitives):
  animals: cat_sitting, cat_standing, dog_sitting, dog_standing, bird_flying, bird_perched, fish, butterfly, rabbit, elephant, bear, lion, owl, horse, duck, frog, turtle
  vehicles: boat_small, boat_sailboat, car_simple, bicycle, airplane, train_simple, rocket
  nature: tree_simple, flower_simple, sun, moon, star, cloud, mountain, wave, leaf
  buildings: house_simple, castle_tower, lighthouse
  people: person_standing, person_child, person_waving
  objects: book, hat_pirate, crown, key, heart, apple, umbrella
  primitives: rectangle, triangle, oval, circle, line, wave
- If a shape isn't in the list, use the closest primitive.
- Output ONLY the JSON. No other text.
```

### User prompt format

```
Write a story in {language} about: {user_prompt}
```

---

## Validation Rules

Enforced by `tact/generator.py` before passing to downstream modules:

1. `version` must equal `"1.0"`
2. `language` must be `"it"` or `"en"`
3. `braille_grade` must be `1` if `language == "it"`
4. `pages` must be non-empty and sequential (page 1, 2, 3, ... with no gaps)
5. Each `page.text`: no em-dash (`—`), no ellipsis character (`…`), no HTML tags
6. Each `text` must be non-empty
7. Each `illustration.elements` array: 1–4 items
8. Each `shape` name: alphanumeric + underscores only (`^[a-z_]+$`)
9. `scale`: clamp to [0.5, 2.0] — do not reject, just clamp silently
10. On parse failure (LLM returned invalid JSON): retry once with explicit "output only JSON" reminder, then fall back to `manual` mode (user types text directly)

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-05-04 | Initial schema. Covers StoryJSON, Page, IllustrationSpec, IllustrationElement, PlacementSpec, PageElement. |
