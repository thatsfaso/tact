# Braille regression test

Checks that the braille Tact prints matches liblouis, the reference open source braille translator, cell for cell. It runs on GitHub at every push (`.github/workflows/braille.yml`) and locally with:

```bash
node tests/braille/check.mjs
```

It needs only Node 22 or later. Nothing to install.

- `cases.json` holds the texts:
  - the 60 stories of the paper's evaluation (40 English, 20 Italian);
  - hand-written sentences that exercise capitals, numbers, quotes, brackets, accents and dashes.
- `expected.json` is what liblouis 3.39.0 makes of each text, with these tables:
  - `en-ueb-g1.ctb` for English uncontracted;
  - `it-it-comp6.utb` for Italian;
  - `en-ueb-g2.ctb` for English contracted.
- `check.mjs` loads the translator straight out of `index.html` and compares:
  - Grade 1, which is Tact's own code;
  - Grade 2, which is the liblouis build in `vendor/liblouis`.

## Adding a case

Add the text to `cases.json`, then rebuild the expected output with liblouis 3.39.0 installed (`brew install liblouis` on a Mac, or build the release from source):

```bash
python3 tests/braille/make-expected.py
```

The script refuses to run with another liblouis release, because small differences between releases would quietly move the reference.
