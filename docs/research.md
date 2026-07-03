# Research Findings

Compiled from the initial design research conversation. These findings inform every architectural and design decision in TACT.

---

## The Problem: Braille Literacy Crisis

- In 1960, approximately 50% of legally blind school-age children in the US could read Braille
- A major turning point was the Rehabilitation Act of 1973, which moved blind children into mainstream schools where qualified Braille teachers were scarce
- Today, only ~8.5% of blind children aged 4–21 enrolled in US public schools are fully Braille readers; over 53% are identified as nonreaders or pre-readers
- 74% of working-age blind people are unemployed; the majority of the 26% who are employed are Braille readers
- Studies show Braille readers have higher employment rates, better education outcomes, and greater financial independence
- Italy follows the same pattern: mainstreaming into public schools (insegnante di sostegno model) reduces dedicated Braille instruction time
- Braille remains irreplaceable for true literacy and autonomy — audio tools are consumption, not literacy

**TACT's thesis:** The Braille literacy crisis is not a technology problem — it is a content availability and production cost problem. The technology to teach Braille exists. Personalized, on-demand, affordable content does not. TACT addresses this.

---

## Braille Standards

### International Standards
- **ISO 17049:2013** — Physical Braille dimensions (confirmed current as of 2024)
- **Marburg Medium** — European standard used across EU countries
- Both define the same core measurements (see `docs/stl-geometry-spec.md` for the full table)

### Italian Braille
- Governed by: **Biblioteca Italiana per i Ciechi "Regina Margherita"**, Monza
- Based on French Braille with minor differences
- **Grade 1 only** — Italian Braille does not use contractions
- Liblouis tables: `it-it-comp6.utb`, `it.tbl`
- Accented characters: à, è, é, ì, ò, ù all have distinct cell assignments

### English Braille (UEB)
- Unified English Braille — adopted by US, UK, Australia, Canada, Ireland, New Zealand, South Africa
- Grade 1 (uncontracted): one cell per character — for beginners and children
- Grade 2 (contracted): ~180 contractions for common letter combinations — for advanced readers
- TACT defaults to Grade 1 for children's content
- Liblouis table: `en-ueb-g1.ctb`

### 3D Printing Dimension Corrections
- FDM printers consistently under-produce dot height by ~30%
- Designing for 0.5mm yields ~0.38mm measured (±0.03mm)
- Designing for 1.3mm diameter yields ~1.0mm measured (±0.07mm)
- All geometry specs must over-design by ~30% to compensate
- Optimal range from blind student survey: 0.6–0.9mm dot height

---

## Existing Tools and Ecosystem

### Do Not Reinvent
| Tool | What it does | TACT's relationship |
|---|---|---|
| **Liblouis** | Open-source Braille translation, ~150 languages, LGPL 2.1 | Module 3a — use directly |
| **Liblouisutdml** | Document-to-Braille formatting pipeline | Reference for layout engine |
| **BrailleBlaster** | Open-source Braille book production GUI | Not used directly, reference |

### Hardware We Chose Not To Use
**BrailleRAP** — open-source DIY Braille embosser (~€350 to build, vs €2500+ commercial). It uses paper embossing, not 3D printing. We chose FDM 3D printing over BrailleRAP for the reasons in `docs/decisions.md` (D001). BrailleRAP's DesktopBrailleRAP software (mixes SVG + Braille in tactile documents) is a useful reference for our page layout engine design.

**Tactipix** — a BrailleRAP side project: a collection of children's illustrated books with audio where illustrations can be embossed. Closest existing project to TACT, but requires BrailleRAP hardware and is not automated.

### Closest Research Prototype
**TaleVision (April 2025)** — Published in International Journal of Human-Computer Studies. Combines AI and multimodal tech to aid blind children's graphic cognition, with real-time tactile and auditory feedback and voice-input generated tactile images. Conducted user studies with blind children. **This is an academic research prototype only — not open source, not deployable.** It directly validates TACT's concept. Our gap: there is no open-source, deployable implementation that parents and schools can use.

---

## Tactile Graphics Research (2024-2025)

### The Problem with Automation
Producing tactile graphics traditionally requires a specialist (TVI or tactile graphics producer) who:
- Decides what information is necessary to convey
- Removes perspective, shading, unnecessary detail
- Thickens outlines, adds textures for differentiation
- Either collages physical materials or draws with swell-form machine

### Key Research Projects

**tactile-svgdreamer** (GitHub, active)
- End-to-end pipeline for tactile-optimized SVGs from text prompts
- **Requires CUDA GPU** — not viable for TACT's zero-GPU constraint
- Useful as reference for what "tactile-optimized SVG" means visually

**TactileNet (April 2025)**
- First comprehensive dataset for training AI models to generate tactile images
- A dataset, not a deployable tool

**AltCanvas (CHI 2024/2025)**
- Tile-based interface for constructing visual scenes for tactile graphics
- Reference for our LLM art director prompt design

**Chart4Blind**
- End-to-end accessible SVG generation for data charts
- Reference for our SVG output pipeline

### TACT's Approach: LLM Art Director + Shape Library
Chosen because: no GPU required, deterministic output, standards-compliant, community-extensible, separates AI from engineering concerns cleanly.

---

## Italian Organizations and Contacts

**Not yet contacted. Developer plans to reach out.**

| Organization | Location | Relevance |
|---|---|---|
| Biblioteca Italiana per i Ciechi "Regina Margherita" | Monza (local!) | Governs Italian Braille standards; natural partner |
| Istituto dei Ciechi di Milano | Via Vivaio, Milano | Leading institute for the blind; runs educational programs |
| UICI Lombardia | Milano | Regional chapter; partners with universities on accessibility tech |
| Federazione Nazionale Istituzioni Pro Ciechi | Roma | Italian-language Braille resources and publishing |
| Lega del Filo d'Oro | Osimo, Marche | Primary Italian organization for deafblind |

**Online communities (English):**
- r/Blind — willing to engage with student researchers
- AppleVis forums — blind tech users, international

**The "nothing about us without us" principle** — real user contact must happen before v1.0. A 30-minute conversation with one TVI at the Istituto dei Ciechi will reshape the design more than weeks of solo research.

---

## Why 3D Printing vs. Embossing

| Factor | FDM 3D Printing | BrailleRAP Embossing |
|---|---|---|
| Cost to acquire | €50-100 (buy ready) | €250-350 (build yourself) |
| Output durability | High (TPU/PETG lasts years) | Low (paper degrades) |
| Print time | Hours per page | Seconds per page |
| 3D objects | Yes (true 3D, elevation) | No (2.5D only) |
| Material cost | Low; recycled PET possible | Paper only |
| Operator skill | Low (load filament, press print) | Medium (calibrate embosser) |
| Community size | Huge (millions of FDM users) | Small (accessibility niche) |
| Child-friendliness | Pages survive daily use | Pages wear and tear |

**Decision:** FDM 3D printing. Print time tradeoff is acceptable because the output is a durable artifact re-read dozens of times, not a disposable bulletin.
