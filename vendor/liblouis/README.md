# liblouis for the browser

Tact uses [liblouis](https://liblouis.io) to print English in contracted braille (Unified English Braille, Grade 2). Grade 1 does not need it and never loads it: these files are fetched only when someone picks "Contracted".

- `liblouis.js`, `liblouis.wasm`: liblouis 3.39.0 compiled to WebAssembly with Emscripten 6.0.13.
- The nine UEB tables are embedded in the build: `en-ueb-g2.ctb` and the files it includes (`en-ueb-g1.ctb`, `en-ueb-chardefs.uti`, `en-ueb-math.ctb`, `braille-patterns.cti`, `latinLetterDef6Dots.uti`, `latinUppercaseComp6.uti`, `spaces.uti`, `text_nabcc.dis`).

liblouis and its tables are free software under the GNU Lesser General Public License, version 2.1 or later (see `COPYING.LESSER`). The unmodified source is the official release:
https://github.com/liblouis/liblouis/releases/download/v3.39.0/liblouis-3.39.0.tar.gz
(sha256 `629fa8cb0dfd9ad457c5bf47a42f0953b673e62c8ad6b1d03ddc4e2bd20008f1`).

## How it was built

```bash
tar xzf liblouis-3.39.0.tar.gz && cd liblouis-3.39.0
emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared --enable-static --without-yaml
emmake make -C gnulib && emmake make -C liblouis
mkdir tables-ueb && cp tables/{braille-patterns.cti,en-ueb-chardefs.uti,en-ueb-g1.ctb,en-ueb-g2.ctb,en-ueb-math.ctb,latinLetterDef6Dots.uti,latinUppercaseComp6.uti,spaces.uti,text_nabcc.dis} tables-ueb/
emcc liblouis/.libs/liblouis.a -O2 -s STACK_SIZE=4MB \
  -s MODULARIZE=1 -s EXPORT_NAME=createLiblouis -s ALLOW_MEMORY_GROWTH=1 -s ENVIRONMENT=web \
  -s EXPORTED_FUNCTIONS='["_lou_translateString","_lou_charSize","_lou_version","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","UTF8ToString","HEAP32","HEAPU16","HEAPU32"]' \
  --embed-file tables-ueb@/tables -o liblouis.js
```

`STACK_SIZE=4MB` matters: with Emscripten's default stack, compiling the UEB tables overflows it and every translation fails.

The output was checked against the native liblouis 3.39.0 (`lou_translate --forward en-ueb-g2.ctb`) on sample sentences, and the two match cell for cell.
