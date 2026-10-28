# Picture choice test

Checks how Tact picks the tactile picture for a story, using the picker as it ships in `index.html`. It runs on GitHub at every push, in the same job as the braille test, and locally with:

```bash
node tests/pictures/check.mjs
```

It checks four things:
- **No shared words.** No word belongs to two shapes, so the choice never depends on the order of the table.
- **Every drawing exists.** Every shape named in the word tables has a drawing in `shapes/`.
- **Ideas.** On 50 reader ideas, in Italian and English, the subject wins. Many are written with diminutives and plurals, and many name a second thing after the subject: "un volpacchiotto che cerca la luna" must show the fox, not the moon.
- **Stories.** On the 60 stories of the paper's evaluation, every illustrated page shows the expected subject. The pages are stored as the app split them, so the test chooses each picture exactly as the page does.

To add a case, append it to `cases.json` as `[lang, idea, expected shape]`. An expected shape also matches its variants: `boat` matches `boat_sailboat`.
