# CLAUDE.md — TACT Project Context

This file is the authoritative context document for Claude Code. Read it fully before doing anything. All design decisions here were made through an extensive research and design conversation — do not second-guess them without good reason.

---

## What Is TACT?

**TACT** (Tactile Accessible Content Tool) is an open-source, zero-cost web application and Python CLI that converts stories and educational content into 3D-printable tactile Braille pages for blind and low-vision children.

**The core loop:**
1. A parent or teacher types a story (or uses AI to generate one via voice)
2. The app translates it to Braille, generates tactile illustration graphics
3. The app outputs a ready-to-print STL file
4. They print it on a cheap FDM 3D printer (€50-100)
5. The blind child receives a physical Braille + tactile illustration page they can read and keep

**Why this exists:** Braille literacy has collapsed from ~50% in the 1960s to under 10% today among blind children. The cause is not technology — it's content. Braille books are expensive, slow to produce, and limited to existing titles. TACT makes on-demand, personalized, affordable tactile content possible for anyone with a 3D printer.

---

## Project Status

**Current phase: Design-first. Web UI prototype complete.**

We have completed:
- Deep research on audience, standards, and existing tools
- Full pipeline architecture design
- Page layout options analysis
- Tech stack decisions
- UI style decisions
- Web UI prototype (see `index.html` — single self-contained file)
- JSON schema (see `docs/json-schema.md`)

We have NOT yet written:
- Shape library format spec (`docs/shape-library-format.md` — stub exists)
- Page format spec (`docs/page-format-spec.md`)
- STL geometry spec (`docs/stl-geometry-spec.md`)
- Python CLI implementation

---

## Target Audience

**Primary:** Blind and low-vision children learning Braille literacy (age 4-10). Key insight: the window for fluent Braille acquisition is early (4-7), same as print literacy for sighted children.

**Secondary:** Deafblind users (Braille is their only channel — no audio alternative). The leading Italian organization for deafblind is **Lega del Filo d'Oro** (Osimo, Marche).

**NOT primary:** Deaf users (they have full visual access — this project is not for them). Blind adults (they've settled into screen-reader/audio workflows).

**Operator model:** A sighted parent, teacher, or organization member operates the hardware (3D printer). The software UI must be fully accessible (screen-reader compatible, voice-first where possible), but the printer itself is a shared family/classroom appliance — not operated by the blind user alone.

**Key Italian contacts to reach out to (not yet contacted):**
- Biblioteca Italiana per i Ciechi "Regina Margherita" — in Monza (literally local to the developer)
- Istituto dei Ciechi di Milano — Via Vivaio, Milano
- UICI Lombardia (Unione Italiana dei Ciechi e degli Ipovedenti)
- Lega del Filo d'Oro — for deafblind dimension
- Online: r/Blind on Reddit, AppleVis forums

**Critical principle:** "Nothing about us without us." Real user contact must happen before v1.0 ships.

---

## What TACT Is NOT

- It is NOT a digital-only tool (ChatGPT already does that)
- It is NOT an audio story generator (screen readers already do that)
- The physical Braille + tactile graphics output is the non-negotiable differentiator
- It is NOT a BrailleRAP wrapper (we use FDM 3D printing, not embossing — see Hardware section)

---

## Hardware Target

**Primary: Budget FDM 3D printers (€50-100).** Examples: Creality Ender 3 clones, Kingroon KP3S, Elegoo Neptune series.

**Why FDM over BrailleRAP (open-source embosser):**
- 3D-printed pages in TPU/PETG are more durable than embossed paper (survives sticky fingers, bending, washing)
- True 3D tactile objects possible (not just 2.5D dots on flat surface)
- Cheaper to acquire (€50-100 vs €250-350 to build BrailleRAP)
- Multipurpose device families already own
- Recycled bottle filament (PET) is possible — near-zero material cost
- Print time (hours/page) is acceptable because output is a durable artifact, not a disposable bulletin

**Bed size assumption:** 220×220mm (standard for budget FDM). All page dimensions must fit this constraint with 10mm margins.

**Materials:**
- TPU: flexible, survives bending, best for "page" feel
- PETG: rigid, hygienic, washable, more durable
- Recycled PET (from bottles): near-zero cost, viable quality, aligns with circular economy angle

**Future/optional:** OctoPrint integration (Raspberry Pi print server) for fully automated "generate → send to printer" flow over WiFi. Not in MVP.

**Double-sided printing:** Technically hard with FDM (dots on one side interfere with other side). Traditional interpoint Braille offsets dots between sides — complex to implement in 3D. Defer to post-MVP.

---

## Braille Standards

### Physical Dimensions (ISO 17049:2013 / Marburg Medium)
```
Dot diameter:          1.3–1.6mm
Dot height (paper):    0.48–0.5mm
Dot height (3D print): 0.7–0.9mm (over-design by ~30% to compensate FDM shrinkage)
Dot profile:           ROUNDED/DOMED — never flat or pointed
Dot spacing (H+V):     2.5mm center-to-center within cell
Cell spacing:          6.0mm center-to-center
Line spacing:          10.0mm center-to-center
Min feature spacing:   2-3mm between distinct tactile elements (fingertip discrimination)
```

**FDM accuracy note:** FDM printers consistently under-produce dot height by ~30%. Designing for 0.5mm yields ~0.38mm measured. Always over-design.

**Tactile graphics heights:** 0.8–1.0mm (slightly higher than Braille dots so fingertips distinguish text from illustration).

**Base plate:** 0.4–0.6mm thick (1-2 print layers). This is the foundation everything sits on.

### Italian Braille
- Governed by: Biblioteca Italiana per i Ciechi "Regina Margherita", Monza
- Closely derived from French Braille
- **Grade 1 ONLY** (uncontracted) — no contractions in Italian Braille
- Liblouis table: `it-it-comp6.utb` and `it.tbl`
- Accented letters and numbers have specific cell assignments

### English Braille (UEB)
- Unified English Braille — adopted by US, UK, Australia, Canada, etc.
- Grade 1 (uncontracted) for beginners; Grade 2 (contracted, ~180 contractions) for advanced
- **Default for children: Grade 1**
- Liblouis table: `en-ueb-g1.ctb`

---

## Page Layout

### Braille text density (Grade 1, uncontracted)
- Characters per line: ~21-22 (on 150mm-wide page with 10mm margins)
- Words per line: ~4
- Words per 5 lines: ~20 words
- Words per 200-word story at Option A: ~10 pages

### Three layout options (all should be supported as config)

**Option A — Picture book style (DEFAULT)**
- ~5 lines text (~20 words) + illustration per page
- Feels like a real children's picture book
- 10 pages for a 200-word story
- Best for: young children, engagement, literacy immersion

**Option B — Text + separate illustration cards**
- ~10 lines text (~40-50 words) per text page
- Illustrations are standalone reusable cards
- Best for: efficiency, TVI teaching tool libraries

**Option C — Full bed (220×220mm)**
- ~7-8 lines text (~30-35 words) + illustration beside
- Uses full printer bed
- Best for: older children, more reading per page

Default: **Option A**.

---

## Full Technical Pipeline

```
Voice input
    ↓
Speech-to-text (Whisper / Web Speech API)
    ↓
LLM content generator → structured JSON output (see docs/json-schema.md)
    ↙                        ↘
Braille translation      Tactile graphics
(Liblouis)              (LLM art director + shape library)
    ↘                        ↙
       Page layout engine
            ↓
       STL generator
            ↓
       3D printer output
```

### Module 1: Speech-to-text
- Local: OpenAI Whisper open-source (`whisper` pip package), `base` model
- Web: Browser Web Speech API (free, native, no library)
- Runs entirely on CPU, no GPU needed

### Module 2: LLM content generator
- Input: natural language story request
- Output: structured JSON (see `docs/json-schema.md`)
- **Local (zero cost):** Ollama + Llama 3.2 3B
- **Web (zero cost):** WebLLM — runs small models directly in browser via WebGPU
- **Optional paid:** Claude API or OpenAI API — user pastes their own key in settings
- **No AI fallback:** User types/pastes story text manually. Full pipeline still works.

### Module 3a: Braille translation
- Library: Liblouis (`louis` pip package)
- Tables: `it-it-comp6.utb` (Italian), `en-ueb-g1.ctb` (English UEB Grade 1)
- Web: Liblouis compiled to WASM (~493KB for IT+EN)

### Module 3b: Tactile graphics — LLM art director + shape library
- Art director (LLM call) receives `IllustrationSpec`, returns `PlacementSpec`
- Renderer loads SVG files from `shapes/` directory and composes them
- Fallback: geometric primitives if shape not in library

### Module 4: Page layout engine
- Composes Braille dot positions and tactile SVGs onto page canvases
- Page size: 150×200mm default (fits 220×220mm bed with margins)
- Libraries: `svgwrite`, `shapely`

### Module 5: STL generator
- Braille dots → domed geometry (hemisphere profile)
- SVG paths → extruded relief (0.8-1.0mm)
- Libraries: `trimesh` or `numpy-stl`
- Output: `.stl` file per page, named `{story_slug}_page_{n:02d}.stl`

---

## Zero-Cost Stack

| Component | Library | License | Cost |
|---|---|---|---|
| Speech-to-text | `openai-whisper` | MIT | Free |
| LLM local | Ollama + Llama 3.2 3B | Apache 2.0 | Free |
| LLM web | WebLLM | Apache 2.0 | Free |
| LLM optional | Claude API / OpenAI | Pay-per-use | ~€0.001/story |
| Braille translation | `louis` (Liblouis) | LGPL 2.1 | Free |
| SVG manipulation | `svgwrite`, `svgpathtools` | MIT | Free |
| 3D mesh | `trimesh` / `numpy-stl` | MIT / BSD | Free |
| Geometry | `shapely` | BSD | Free |

No GPU required. Runs on any modern laptop.

---

## Web App

**Architecture:** Fully client-side static web app. No backend server. Hosted free on GitHub Pages.

**Entry point:** `index.html` at repo root — single self-contained file with all JS inlined. Works on `file://` locally (no local server needed) and deploys unchanged to GitHub Pages.

**LLM detection logic:**
1. Check if Ollama running at `localhost:11434` → use it (zero cost)
2. Check if WebLLM/WebGPU available → offer in-browser model (zero cost)
3. Fall back to API key input in settings (user's own key)
4. Fall back to manual text input (no AI — always works)

---

## Repository Structure

```
tact/
├── index.html             ← Single-file web app (self-contained, GitHub Pages root)
├── CLAUDE.md              ← This file
├── README.md
├── LICENSE                ← MIT
├── docs/
│   ├── research.md
│   ├── architecture.md
│   ├── decisions.md
│   ├── json-schema.md     ← LLM output contract (DONE)
│   ├── shape-library-format.md  ← Shape library spec (stub)
│   ├── page-format-spec.md      ← TO BE WRITTEN
│   └── stl-geometry-spec.md     ← TO BE WRITTEN
├── tact/                  ← Python package (TO BE WRITTEN)
│   ├── __init__.py
│   ├── stt.py
│   ├── generator.py
│   ├── braille.py
│   ├── graphics.py
│   ├── layout.py
│   ├── stl.py
│   └── backends/
│       ├── ollama.py
│       ├── webllm.py
│       ├── claude.py
│       └── openai.py
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

## Open Source Strategy

- License: **MIT**
- Community contribution points:
  - Shape library (SVG shapes) — lowest barrier, most natural
  - Braille table corrections/additions
  - Language support
  - Printer calibration profiles
- Target partners: schools for the blind, UICI, Lega del Filo d'Oro, makerspaces

---

## Key Constraints (Never Violate)

1. **No GPU required** — everything runs on CPU
2. **No mandatory payment** — every path through the system has a free option
3. **MIT license** — permissive, organizations can adopt freely
4. **Hardware-agnostic output** — STL is primary, but formats are pluggable
5. **Bilingual from day one** — Italian and English equally supported
6. **Standards-compliant Braille** — ISO 17049:2013 dimensions, always
7. **Tactile design rules enforced** — renderer must guarantee minimum feature sizes

---

## What To Do Next In Claude Code

1. Read this file fully ✓
2. Read all files in `docs/` ✓
3. `docs/json-schema.md` — DONE ✓
4. `docs/shape-library-format.md` — write in full (stub exists)
5. `docs/page-format-spec.md` — write from scratch
6. `docs/stl-geometry-spec.md` — write from scratch
7. `shapes/index.json` — create shape library index
8. Python CLI implementation following the pipeline above
9. Contact Italian organizations with working demo

**Always ask before making architectural decisions not covered here.**
