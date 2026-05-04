# Design Decisions Log

This file records every significant design decision made, why it was made, and what alternatives were rejected. Update this file whenever a new decision is made.

---

## Decided

### D001 — Primary output medium: FDM 3D printing (not BrailleRAP embossing)
**Decision:** Use FDM 3D printers as primary hardware target.
**Rationale:** Lower acquisition cost (€50-100 vs €250-350 to build BrailleRAP), more durable output (TPU/PETG survives years of use vs paper), true 3D tactile objects possible, recycled PET filament brings material cost near zero, massive existing community. Print time tradeoff (hours/page) is acceptable because output is a durable re-read artifact, not a disposable bulletin.
**Rejected alternative:** BrailleRAP (open-source embosser) — better for high-volume page production, but paper output degrades and acquisition requires self-assembly.

### D002 — Tactile graphics approach: LLM art director + shape library
**Decision:** Use LLM to generate a *placement spec* from a library of pre-built tactile SVG shapes, then render deterministically.
**Rationale:** No GPU required, deterministic/standards-compliant output, clean separation of AI and engineering, community-extensible shape library, degrades gracefully (geometric primitives as fallback).
**Rejected alternatives:**
- Direct LLM SVG generation: hit-or-miss quality, non-deterministic dimensions
- Text→image→edge detection: too many steps, noisy output, requires image generation API
- tactile-svgdreamer: requires CUDA GPU — not viable

### D003 — Braille translation library: Liblouis
**Decision:** Use Liblouis (`louis` Python package) for all Braille translation.
**Rationale:** Battle-tested, ~150 languages including Italian and English UEB, LGPL 2.1 license, compiled to WASM for browser use, used by NVDA/JAWS/BRLTTY. Do not reinvent.
**Rejected alternative:** Custom translation — no justification for this, Liblouis is authoritative.

### D004 — Italian Braille: Grade 1 only
**Decision:** Italian Braille output is always Grade 1 (uncontracted).
**Rationale:** Italian Braille does not use contractions. There is no Grade 2 Italian Braille. This simplifies translation logic significantly.

### D005 — English Braille: UEB Grade 1 as default
**Decision:** English defaults to UEB Grade 1 (uncontracted). Grade 2 is a future option.
**Rationale:** Target audience is children learning Braille — Grade 1 first. Grade 2 can be a settings toggle for advanced users later.

### D006 — LLM cost model: zero mandatory cost
**Decision:** No step in the pipeline should ever require payment. Every module has a free path.
**Implementation:**
- STT: Whisper (free) or Web Speech API (free)
- LLM: Ollama local (free) → WebLLM in-browser (free) → user's own API key (their cost) → manual text input (always free)
- Braille: Liblouis (free)
- Graphics: shape library (free) + LLM art director (Ollama/WebLLM)
- STL: trimesh/numpy-stl (free)
**Rejected:** Any architecture where a paid API is required by default.

### D007 — Open source license: MIT
**Decision:** MIT license.
**Rationale:** Permissive — organizations (schools, associations, NGOs) can adopt, fork, and integrate without copyleft concerns. Maximizes adoption in the accessibility space where trust and legal simplicity matter.
**Rejected:** GPL — copyleft can deter institutional partners. AGPL — too restrictive for a tool meant to be embedded in other systems.

### D008 — Web deployment: GitHub Pages (static, client-side only)
**Decision:** Web app is fully client-side, no backend server, hosted on GitHub Pages.
**Rationale:** Zero hosting cost, zero maintenance of servers, forkable by anyone, works forever without infrastructure.
**Implementation detail:** `index.html` at repo root, single self-contained file with all JS inlined. Works on `file://` locally (no local server needed) and deploys unchanged to GitHub Pages.

### D009 — Default page layout: Option A (picture book style)
**Decision:** Default to Option A — ~5 lines Braille text (~20 words) + one illustration per page.
**Rationale:** Most engaging for young children, most similar to sighted children's picture books, page count is not a problem (10 pages for 200-word story = 10 evenings of printing = a beautiful ritual). All three layout options (A, B, C) supported as configurable parameters.

### D010 — Primary language of Braille output: both IT and EN equally
**Decision:** Italian and English are both first-class from day one. No UI language is "default."
**Rationale:** Developer is Italian (Monza), primary partnership targets are Italian, but project aims to be international from the start. Language selection is a prominent first-screen choice, not a settings afterthought.

### D011 — FDM dot height over-design: +30%
**Decision:** All Braille dot geometry specs are designed 30% taller than ISO standard to compensate for FDM shrinkage.
**Rationale:** FDM prints consistently under-produce height by ~30% (0.5mm design → 0.38mm measured). Blind reader surveys show optimal tactile range is 0.6-0.9mm. Over-designing to 0.85mm produces ~0.6mm actual — within optimal range for beginning readers.

### D012 — Operator model: sighted helper + blind reader
**Decision:** The system assumes a sighted parent, teacher, or org member operates the 3D printer. The software UI is fully accessible (screen-reader compatible, voice-first), but the printer is a shared appliance.
**Rationale:** This is honest design, not a compromise. The blind user is the reader; the sighted helper is the printer operator.

### D013 — Double-sided printing: deferred to post-MVP
**Decision:** Double-sided (interpoint) Braille printing is NOT in MVP.
**Rationale:** Technically complex with FDM (dots on one side interfere with other side). Solvable, but not a first-version problem.

### D014 — Web app structure: single self-contained index.html
**Decision:** The web app is one file — `index.html` at the repo root — with all JavaScript inlined. No build step, no bundler, no separate source files to fetch.
**Rationale:** Works on `file://` locally without a local server. Deploys to GitHub Pages without configuration. Instantly shareable. The JSX is processed by Babel Standalone in-browser, so no pre-compilation needed.
**Implementation:** Sound system + WebGL shader as plain `<script>` tags; React components in one `<script type="text/babel">` tag.

### D015 — Project name: TACT
**Decision:** Project name is TACT — Tactile Accessible Content Tool.
**Rationale:** Previous working name was "Tocca" (Italian for "touch"). TACT works equally well in Italian and English, is an acronym that describes the tool, and has appropriate thematic resonance (touch/tact).

---

## Pending (Must Decide Before Full Implementation)

### P001 — Shape library format
**Status:** Stub exists in `docs/shape-library-format.md`. Must be finalized before implementing Module 3b.

### P002 — Page format specification
**Status:** Partially defined in CLAUDE.md and architecture.md. Full spec with all measurements, zones, pagination rules not yet written.

### P003 — STL geometry specification
**Status:** Partially defined in architecture.md. Full spec with calibration tables not yet written.

---

## Implementation Order

1. Write `docs/shape-library-format.md` (P001)
2. Write `docs/page-format-spec.md` (P002)
3. Write `docs/stl-geometry-spec.md` (P003)
4. Create `shapes/index.json` and initial shape library
5. Implement Python package structure
6. Implement Module 3a (Braille translation) — simplest, most critical
7. Implement Module 5 (STL generator) — core output
8. Implement Module 4 (layout engine)
9. Implement Module 3b (tactile graphics)
10. Implement Module 2 (LLM generator)
11. Implement Module 1 (STT)
12. Wire CLI
13. Contact Italian organizations with working demo
