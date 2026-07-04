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
**Rationale:** Developer is Italian (Milan), primary partnership targets are Italian, but project aims to be international from the start. Language selection is a prominent first-screen choice, not a settings afterthought.

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

### D016 — Primary LLM backend: WebLLM (in-browser), Ollama as future option
**Decision:** WebLLM is the primary LLM backend in the web app. Ollama is a planned future option, presented with a terminal tutorial (paste-to-run commands), not required for MVP.
**Rationale:** WebLLM runs small models (Llama 3.2 1B, Phi-3 mini) entirely in-browser via WebGPU — zero cost, no API key, no server, works on any modern laptop (2020+). This preserves the zero-mandatory-cost constraint and zero-backend-infrastructure constraint simultaneously. Ollama is the right next tier for users who want larger models or have older hardware, but requires terminal access — justified with a clear tutorial.
**Implementation:**
- Detect WebGPU at runtime; if available, download and cache model on first use (browser IndexedDB)
- System prompt from `docs/json-schema.md` LLM section; parse JSON response; retry once on parse failure
- Fallback chain: WebLLM → (future) Ollama at `localhost:11434` → user API key → manual text input
- Ollama tutorial: one-liner `curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2:3b` shown in a copyable terminal block in the settings panel
**Rejected alternatives:**
- Ollama-first: requires terminal access, harder barrier for non-technical parents/teachers
- A paid API-first approach (e.g. OpenAI): violates zero-cost constraint, requires account creation

### D017 — Adaptive in-browser model selection (cap auto at 3B; 8B opt-in)
**Decision:** The app picks the best WebLLM model the device can run, automatically, from a tier list (largest → smallest): Llama-3.1-8B → Qwen2.5-3B → Llama-3.2-3B → Gemma-2-2B → Llama-3.2-1B. Automatic selection is **capped at Llama-3.2-3B**; the 8B tier is available only by explicit manual choice. If the chosen model fails to initialise (out of memory), the engine falls back down the list. If no model loads, the app uses the user's own words (keyword path).
**Why:** Llama-3.2-1B (the previous fixed model) is the smallest LLM that exists and writes flat, "simple and loose" prose. A 3B-class model is a large quality jump and still runs on most WebGPU devices. WebGPU does NOT expose true VRAM — the common `deviceMemory=8 / maxBufferSize=4096MB` reading appears on countless ordinary laptops that could not run an 8B model — so auto-selecting 8B would send many users to download ~3.5GB and then OOM-fall back. Capping auto at 3B avoids that; demotion-on-weak-signals + runtime fallback handle the low end.
**Also:** the model is asked for PLAIN STORY TEXT, not JSON (small models are unreliable at strict schemas); pages and illustration shapes are derived deterministically client-side. The system prompt is a craft brief tuned for blind children — favour touch/sound/warmth/movement over colour/sight, a clear arc, gentle rhythm, with one few-shot style example.
**Implementation:** `window.TACT` exposes `models`, `getActiveModel()`, `setPreferredModel(id)`. Loading UI shows the active model label (e.g. "Downloading AI model · Llama 3.2 3B").
**Future ideas (not yet built):**
- **Manual model picker UI** — let the user choose their model explicitly (e.g. a settings dropdown driven by `window.TACT.models` + `setPreferredModel`), including opting into 8B on capable hardware or forcing 1B for speed. Surfaces the freedom and avoids lock-in to one model.
- **Remember the choice** in localStorage so returning users skip re-selection.
- **Per-model "download size / quality" hints** in that UI so users make an informed download tradeoff.
- **Two-pass "write then improve"** refine step for higher quality at the cost of ~2× generation time (left out for now to keep generation fast).
**Rejected alternatives:**
- Fixed single model: either too weak (1B) or excludes too many devices (8B).
- Auto-selecting 8B from `deviceMemory`/`maxBufferSize`: those signals can't reliably identify 8B-capable hardware.

### D018 — Braille translation: pure-JS Grade 1, not Liblouis WASM (supersedes D003 in the web app)
**Decision:** The browser app translates Braille with a small pure-JS Grade-1 map, not Liblouis.
**Rationale:** The Liblouis WASM build (`liblouis-build@3.2.0-rc`) is unusable in-browser: the English UEB tables fail to compile (`numericnocontchar`), several tables abort the WASM heap, and a null result crashed the worker so the app hung forever on "Translating to Braille…". This project is **Grade 1 only** (D004/D005) — a deterministic character→cell mapping — so a JS translator is exact, instant, dependency-free, works offline/`file://`, and drops a 1.6MB download. Liblouis (D003) remains the reference for the future Python CLI or if a known-good WASM build appears.

### D019 — Page layout: square 150×150 with corner illustration (supersedes D009 layout options)
**Decision:** One shipped layout: a **square 150×150mm page** with an **L-shaped Braille region** (7 full rows + 6 narrow rows) wrapping a **bottom-right corner illustration**. Geometry is defined once in `window.TACT_LAYOUT` and shared by a true-to-scale SVG preview and the STL generator.
**Rationale:** Square matches the design intent and the 220×220 bed; the corner layout packs ~37 words/page while keeping a clear tactile illustration. A single mm source of truth makes the preview an exact mirror of the print (no drift). The earlier three-option A/B/C model and a brief portrait/picture-book detour were dropped as over-complex; alternatives stay as possible future `layout` modes.
**Rejected:** Portrait 150×200 (never a requirement — was a leftover print size that leaked into the preview and broke the composition); fixed-pixel preview (didn't scale responsively with the window).

### D020 — Balanced pagination + story length targeting
**Decision:** Split a story into the fewest pages whose *even* word split fits every page (`paginateByLines`), and target ~65–75 words in the AI prompt.
**Rationale:** Greedy fill left ugly orphan pages (50 words → `[37,13]`). Even distribution (`[25,25]`) reads as intentional and never near-empty; a fuller word target keeps multi-page stories filling their pages. Guarantees no clipping.

### D021 — Shape library: hand-crafted tactile SVGs, expanded to ~89, whole-word keyword selection
**Decision:** Ship ~89 hand-crafted line-art SVGs covering the most-cited fairy/bedtime subjects (creatures, animals, people, objects, nature). Illustration is chosen from story text by **whole-word** IT+EN keyword matching (not substring).
**Rationale:** Hand-crafted shapes read far better under the fingers than parametric primitives (the cat is the quality bar). Whole-word matching fixes false positives (e.g. "mare"/sea no longer matches "re"/king) and covers plurals/diminutives, so most stories get a fitting illustration instead of the default star. **Note:** the entire library is now hand-crafted and the early parametric generator has been removed from the repository.

---

## Resolved (were pending)

- **P001 — Shape library format:** DONE. `docs/shape-library-format.md` + `shapes/index.json` (~89 shapes).
- **P002 — Page format specification:** DONE. `docs/page-format-spec.md` v2.0 (square corner layout, see D019).
- **P003 — STL geometry specification:** DONE. `docs/stl-geometry-spec.md`; implemented in `index.html`.

---

## Status vs. original implementation order

The whole pipeline (STT → generate → Braille → layout → STL) is implemented **in the browser** (`index.html`), not as Python modules. The original Python-CLI order below is now optional/secondary future scope.

1. ✅ `docs/shape-library-format.md`, `docs/page-format-spec.md`, `docs/stl-geometry-spec.md`
2. ✅ `shapes/index.json` + shape library (~89 SVGs)
3. ✅ Braille translation (pure-JS Grade 1, D018)
4. ✅ STL generator (browser JS, binary)
5. ✅ Layout engine (browser JS, `window.TACT_LAYOUT`, D019)
6. ✅ Tactile graphics (rasterized SVG pillars + keyword picker, D021)
7. ✅ LLM generator (WebLLM adaptive, D017) + fallback
8. ✅ STT (Web Speech API)
9. ⏳ Python CLI — optional, not started
10. ⏳ Contact Italian organizations with the working demo
