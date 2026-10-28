// Braille regression test: Tact's own translator, as it ships in index.html,
// against what liblouis makes of the same texts (expected.json, written by
// make-expected.py). Every cell of every text must match.
//
//   node tests/braille/check.mjs
//
// Grade 1 (Italian and English) is Tact's code. Grade 2 is liblouis itself,
// compiled for the browser; checking it here covers the build in
// vendor/liblouis and the code around it (folding punctuation, reading cells).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// The translator is the window.TACT block of index.html, a plain script.
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('window.TACT = (function () {');
const end = html.indexOf('\n})();', start);
if (start < 0 || end < 0) throw new Error('window.TACT block not found in index.html');
const source = html.slice(start, end + '\n})();'.length);

// Just enough of a browser for that block and for liblouis to load. The
// context is its own `window`, as in a page, so the globals liblouis.js
// declares (createLiblouis) are where the page looks for them.
const context = vm.createContext({
  console, setTimeout, clearTimeout, URL, TextDecoder, TextEncoder, WebAssembly, Response,
  navigator: {}, location: { search: '' }, performance,
  localStorage: { getItem: () => null, setItem() {} },
  fetch: async (url) => {
    const file = path.join(ROOT, String(url).replace(/^\.?\//, ''));
    return new Response(readFileSync(file), { headers: { 'Content-Type': 'application/wasm' } });
  },
  document: {
    head: {
      appendChild(el) {   // a <script> tag: run the file it points to
        try {
          vm.runInContext(readFileSync(path.join(ROOT, el.src), 'utf8'), context);
          el.onload && el.onload();
        } catch (e) {
          console.error(e);
          el.onerror && el.onerror(e);
        }
      },
    },
    createElement: () => ({}),
  },
});
context.window = context.self = context;
vm.runInContext(source, context);
const TACT = context.TACT;

const cases = JSON.parse(readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(path.join(HERE, 'expected.json'), 'utf8'));

const unicode = (cells) => cells
  .map((c) => (c === 'BR' ? '\n' : String.fromCharCode(0x2800 + c.reduce((b, d) => b | (1 << (d - 1)), 0))))
  .join('');

let failures = 0;
function compare(label, texts, want, translate) {
  let same = 0, cells = 0;
  texts.forEach((text, i) => {
    const got = unicode(translate(text));
    cells += want[i].length;
    if (got === want[i]) { same++; return; }
    failures++;
    let at = 0;
    while (at < got.length && got[at] === want[i][at]) at++;
    console.log(`FAIL ${label} #${i}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);
    console.log(`  first difference at cell ${at}`);
    console.log(`  tact     ${got.slice(Math.max(0, at - 8), at + 12)}`);
    console.log(`  liblouis ${want[i].slice(Math.max(0, at - 8), at + 12)}`);
  });
  console.log(`${same === texts.length ? 'ok  ' : 'FAIL'} ${label}: ${same}/${texts.length} texts identical, ${cells} cells`);
}

compare('Grade 1 English', cases.en, expected.en_g1, (t) => TACT.grade1Cells(t, 'en'));
compare('Grade 1 Italian', cases.it, expected.it_g1, (t) => TACT.grade1Cells(t, 'it'));

// The braille the page measures and prints must be the same translation.
TACT.setBrailleMode('it', 1);
const asyncIt = await Promise.all(cases.it.map((t) => TACT.translateBraille(t, 'it')));
if (asyncIt.some((cells, i) => unicode(cells) !== expected.it_g1[i])) {
  failures++;
  console.log('FAIL translateBraille (Italian, the path the page prints with) does not match liblouis');
}

await TACT.loadGrade2();
TACT.setBrailleMode('en', 2);
compare('Grade 2 English', cases.en, expected.en_g2, (t) => TACT.grade2Cells(t));

console.log(failures ? `\n${failures} failure(s) against liblouis ${expected.liblouis}` : `\nAll braille matches liblouis ${expected.liblouis}.`);
process.exit(failures ? 1 : 0);
