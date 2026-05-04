# TACT

**Tactile Accessible Content Tool — stories you can read with your fingers.**

TACT converts text into 3D-printable Braille pages with tactile illustrations — on demand, in Italian and English, at near-zero cost, using any budget FDM 3D printer.

> Pre-release. Active design and prototyping phase. See `CLAUDE.md` and `docs/` for full context.

---

## The Idea

A blind child says: *"Tell me a story about a pirate cat who sails to the moon."*

A parent opens TACT, speaks or types the request, and a few minutes later a 3D printer produces a flexible TPU page — Braille text on top, a raised cat-and-boat silhouette below. The child reads it with their fingers, keeps it, re-reads it. Over a week, a whole book accumulates.

No subscription. No special hardware beyond a €50-100 3D printer. No internet required after setup. Open source forever.

---

## Why

Braille literacy among blind children has collapsed from ~50% in 1960 to under 10% today. The cause is not technology — it is content. Braille books are expensive, slow to produce, and limited to existing titles. There is no Braille equivalent of "I want a story about *my* interests." TACT addresses this directly.

---

## Try It

Open `index.html` in any modern browser — no server, no install, no account.

---

## Status

- [x] Research completed
- [x] Architecture designed
- [x] Hardware target selected (FDM 3D printing)
- [x] Tech stack selected (Python + Liblouis + trimesh)
- [x] Zero-cost LLM strategy designed (Ollama / WebLLM / user API key / manual)
- [x] Web UI prototype (`index.html`)
- [x] JSON schema (`docs/json-schema.md`)
- [ ] Shape library format spec
- [ ] Page format spec
- [ ] STL geometry spec
- [ ] Python CLI implementation

---

## License

MIT — free for anyone to use, fork, and adapt, including schools and organizations.

---

## Contacts (planned)

- Biblioteca Italiana per i Ciechi "Regina Margherita", Monza
- Istituto dei Ciechi di Milano
- UICI Lombardia
- Lega del Filo d'Oro (for deafblind dimension)
