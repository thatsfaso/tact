---
name: TACT project context
description: Core facts about the TACT project — what it is, status, key decisions, and what's next
type: project
---

TACT (Tactile Accessible Content Tool) — open-source web app + Python CLI that converts stories into 3D-printable Braille pages with tactile illustrations for blind/low-vision children. Italian developer (Monza), MIT license.

**Why:** Braille literacy collapsed from ~50% (1960) to <10% today. Cause is content scarcity, not technology. TACT makes on-demand personalized Braille content possible for anyone with a budget FDM 3D printer (€50-100).

**Stack:** GitHub Pages static web app (no server), Liblouis WASM for Braille, WebLLM/Ollama for local LLM, trimesh for STL. Zero mandatory cost.

**Repo root:** `/Users/ilianofasolino/Desktop/TACT/`

**Current status (as of 2026-05-04):**
- `index.html` — complete, single self-contained file, works on file:// and GitHub Pages, TACT branding
- `docs/json-schema.md` — complete v1.0 LLM output contract (StoryJSON schema)
- `docs/architecture.md`, `decisions.md`, `research.md`, `shape-library-format.md` — complete
- `CLAUDE.md`, `README.md` — complete
- Python CLI — not started
- Shape library SVG files — not started
- `docs/page-format-spec.md`, `docs/stl-geometry-spec.md` — not written

**Next steps:** shape-library-format.md full spec → page-format-spec.md → stl-geometry-spec.md → shapes/index.json → Python implementation.

**Why:** Building toward first contact with Italian blindness organizations (Biblioteca Italiana per i Ciechi, Istituto dei Ciechi di Milano) with a working demo.
