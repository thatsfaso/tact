# Architecture & Pipeline

TACT is designed as two deliverables sharing a common core:

1. **Python CLI/library** — for developers, power users, local automation
2. **Static web app (GitHub Pages)** — for parents, teachers, anyone with a browser

Both share the same logic: Liblouis translation, page layout math, STL geometry, shape library. The difference is runtime (Python vs. JavaScript/WASM) and I/O layer.

---

## Full Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                          │
│                                                             │
│  Voice (mic) ──► STT (Whisper / Web Speech API)            │
│  Text (typed) ─────────────────────────────┐               │
│                                            ▼               │
│                              LLM Content Generator         │
│                         (Ollama / WebLLM / API / manual)   │
│                                            │               │
│                              Structured JSON output        │
└────────────────────────────────────────────┼───────────────┘
                                             │
              ┌──────────────────────────────┤
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   BRAILLE TRANSLATION   │    │     TACTILE GRAPHICS        │
│                         │    │                             │
│  Liblouis               │    │  LLM art director           │
│  (IT: it-it-comp6.utb)  │    │  + Shape library (SVG)     │
│  (EN: en-ueb-g1.ctb)    │    │  → Placement spec          │
│                         │    │  → Tactile SVG output      │
│  Output: dot coordinates│    │                             │
│  [(x, y, height), ...]  │    │                             │
└──────────────┬──────────┘    └─────────────────┬───────────┘
               │                                 │
               └──────────────┬──────────────────┘
                              ▼
               ┌──────────────────────────────────┐
               │        PAGE LAYOUT ENGINE        │
               │                                  │
               │  Composes text zones +           │
               │  illustration zones per page     │
               │  Handles pagination, margins,    │
               │  page numbers in Braille         │
               │                                  │
               │  Libraries: svgwrite, shapely    │
               └──────────────────┬───────────────┘
                                  ▼
               ┌──────────────────────────────────┐
               │         STL GENERATOR            │
               │                                  │
               │  Braille dots → domed geometry   │
               │  SVG paths → extruded relief     │
               │  Base plate: 0.4-0.6mm           │
               │                                  │
               │  Libraries: trimesh / numpy-stl  │
               └──────────────────┬───────────────┘
                                  ▼
               ┌──────────────────────────────────┐
               │            OUTPUT                │
               │                                  │
               │  MVP: downloadable .stl file     │
               │  Future: OctoPrint WiFi push     │
               │  Future: PEF/BRF (embossers)     │
               └──────────────────────────────────┘
```

---

## Module Specifications

### Module 1: Speech-to-Text

**Python (local):** OpenAI Whisper open-source
```bash
pip install openai-whisper
```
- Model: `base` (good accuracy, fast on CPU, ~140MB)
- Languages: Italian + English both well-supported
- No API key, no internet after download

**Web (browser):** Web Speech API
```javascript
const recognition = new webkitSpeechRecognition();
recognition.lang = 'it-IT'; // or 'en-US'
recognition.onresult = (e) => { /* text */ };
recognition.start();
```

**Interface:**
```python
def transcribe(audio_path: str, language: str = "it") -> str:
    """Returns transcribed text from audio file."""
```

---

### Module 2: LLM Content Generator

**Output contract:** Always returns a `StoryJSON` object (see `docs/json-schema.md`).

**Backend priority (web app):**
1. Detect Ollama at `http://localhost:11434` → use Ollama (zero cost)
2. Detect WebGPU support → offer WebLLM in-browser model (zero cost)
3. API key present in settings → use a commercial LLM API such as OpenAI (user's own key)
4. No AI → user types/pastes text manually, still gets full Braille+STL pipeline

**Interface:**
```python
def generate_story(prompt: str, language: str, backend: str) -> StoryJSON:
    """
    Args:
        prompt: natural language story request
        language: "it" or "en"
        backend: "ollama" | "webllm" | "openai" | "manual"
    Returns:
        StoryJSON conforming to docs/json-schema.md
    """
```

---

### Module 3a: Braille Translation

**Library:** Liblouis via `louis` Python package
```bash
pip install louis
```

**Core translation:**
```python
import louis

TABLES = {
    "it": ["it-it-comp6.utb"],
    "en": ["en-ueb-g1.ctb"],
}

def translate_to_braille(text: str, language: str) -> str:
    """Returns Braille Unicode string."""
    return louis.translateString(TABLES[language], text)
```

**Geometry conversion:**
```python
def braille_to_dot_coordinates(
    braille_unicode: str,
    start_x: float,
    start_y: float,
    dot_height: float = 0.8  # compensated for FDM
) -> list[tuple[float, float, float]]:
    """
    Converts Braille Unicode to list of (x, y, height) dot positions.
    Uses standard cell geometry:
      - Dot spacing within cell: 2.5mm H+V
      - Cell spacing: 6.0mm
      - Line spacing: 10.0mm
    """
```

**Web (WASM):** Liblouis compiles to WASM (~493KB for IT+EN). Use `liblouis-wasm` npm package.

---

### Module 3b: Tactile Graphics

**Architecture: LLM Art Director + Shape Library**

No GPU. No ML training. Deterministic output. Community-extensible.

**Step 1 — Art director LLM call:**
```python
def resolve_illustration(
    illustration_spec: IllustrationSpec,
    shape_library_index: dict
) -> PlacementSpec:
    """
    Given an illustration spec (scene description + element list),
    returns a placement spec (which SVG files, positions, scales).
    Falls back to geometric primitives if shapes not in library.
    """
```

**Step 2 — Parametric renderer:**
```python
def render_tactile_svg(placement_spec: PlacementSpec) -> str:
    """
    Takes placement spec, loads SVG files from shape library,
    composes them on a canvas, applies tactile design rules,
    returns final SVG string.
    """
```

**Shape library location:** `shapes/` directory in repo root. See `docs/shape-library-format.md`.

**Tactile SVG rules (enforced by renderer):**
- Stroke width: minimum 2.0mm
- Fill: none (outline only)
- No perspective, no shading, no gradients
- Minimum 2-3mm between distinct elements
- All paths closed where possible

---

### Module 4: Page Layout Engine

**Page coordinate system:** Origin (0,0) at bottom-left. X = right, Y = up. Units: mm.

**Page sizes:**
```python
PAGE_SIZES = {
    "picture_book":     (150, 200),
    "text_card":        (150, 200),
    "illustration_card":(120, 160),
    "full_bed":         (220, 220),
}

MARGINS = { "top": 10, "bottom": 10, "left": 10, "right": 10 }
```

**Layout zones per page (Option A):**
```
┌──────────────────────────────┐
│ 10mm margin                  │
│  ┌────────────────────────┐  │
│  │ Text zone              │  │
│  │ (Braille lines)        │  │
│  │ ~5 lines × 10mm = 50mm │  │
│  ├────────────────────────┤  │
│  │ Illustration zone      │  │
│  │ (tactile SVG)          │  │
│  │ Remaining height       │  │
│  └────────────────────────┘  │
│                              │
│  Page number (Braille)       │
│ 10mm margin                  │
└──────────────────────────────┘
```

**Output:** List of `PageElement` objects with positions, ready for STL generator.

```python
@dataclass
class PageElement:
    type: Literal["braille_dot", "tactile_path", "base_plate"]
    x: float
    y: float
    z: float
    data: Any
```

---

### Module 5: STL Generator

**Braille dot geometry:**
```python
DOT_PARAMS = {
    "diameter": 1.6,    # over-designed from 1.3mm (FDM shrinks ~20%)
    "height": 0.85,     # over-designed from 0.5mm (FDM shrinks ~30%)
    "profile": "dome",  # rounded top — ISO requirement
    "base_plate": 0.5,  # mm
}
```

**Tactile graphic geometry:**
```python
GRAPHIC_PARAMS = {
    "extrusion_height": 1.0,   # slightly above Braille dots
    "stroke_expansion": 1.3,   # expand SVG strokes for tactile width
}
```

**Output:** One STL file per page. Named `{story_slug}_page_{n:02d}.stl`.

---

## Data Flow Summary

```
StoryRequest (text or voice)
    → StoryJSON (LLM output, see json-schema.md)
    → per page: BrailleText + IllustrationSpec
        BrailleText → DotCoordinates (Liblouis)
        IllustrationSpec → PlacementSpec (LLM art director)
                        → TactileSVG (renderer + shape library)
    → PageElements (layout engine)
    → STL file (geometry generator)
```

---

## Repository Structure

```
tact/
├── index.html             ← Single-file web app (GitHub Pages root)
├── README.md
├── LICENSE
├── docs/
│   ├── research.md
│   ├── architecture.md    ← This file
│   ├── decisions.md
│   ├── json-schema.md     ← DONE
│   ├── shape-library-format.md
│   ├── page-format-spec.md
│   └── stl-geometry-spec.md
├── tact/                  ← Python package
│   ├── __init__.py
│   ├── stt.py
│   ├── generator.py
│   ├── braille.py
│   ├── graphics.py
│   ├── layout.py
│   ├── stl.py
│   └── backends/
├── shapes/                ← Shape library (SVG files)
│   ├── index.json
│   ├── animals/
│   ├── vehicles/
│   ├── nature/
│   ├── buildings/
│   ├── people/
│   └── objects/
├── cli.py
├── requirements.txt
└── examples/
```

---

## Key Constraints (Never Violate)

1. **No GPU required** — everything runs on CPU
2. **No mandatory payment** — every path through the system has a free option
3. **MIT license** — permissive, organizations can adopt freely
4. **Hardware-agnostic output** — STL is primary, but formats are pluggable
5. **Bilingual from day one** — Italian and English equally supported
6. **Standards-compliant Braille** — ISO 17049:2013 dimensions, always
7. **Tactile design rules enforced** — renderer must guarantee minimum feature sizes
