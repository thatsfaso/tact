// Picture choice test: the shape picker, as it ships in index.html, on the
// reader's idea alone and on whole stories, plus two checks on the word
// tables: no word belongs to two shapes, and every shape named has a drawing.
//
//   node tests/pictures/check.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Cut a top-level declaration out of the page, from its first line to the
// closing line that ends it.
function cut(startText, endText) {
  const a = html.indexOf(startText);
  const b = html.indexOf(endText, a);
  if (a < 0 || b < 0) throw new Error('not found in index.html: ' + startText);
  return html.slice(a, b + endText.length);
}
const source = [
  cut('const SHAPE_PATHS = {', '\n};'),
  cut('const SHAPE_KEYWORDS = {', '\n};'),
  cut('const WEAK_SHAPES = ', ';'),
  cut('const SHAPE_REFINES = ', ';'),
  cut('const wordsOf = ', ';'),
  cut('function pickShapeFromText(', '\n}'),
  'this.out = { SHAPE_PATHS, SHAPE_KEYWORDS, pickShapeFromText };',
].join('\n');
const context = vm.createContext({});
vm.runInContext(source, context);
const { SHAPE_PATHS, SHAPE_KEYWORDS, pickShapeFromText } = context.out;

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };

// Every word points to one shape, and every shape has a drawing on disk.
for (const lang of ['it', 'en']) {
  const owner = {};
  for (const [shape, words] of Object.entries(SHAPE_KEYWORDS[lang])) {
    if (!SHAPE_PATHS[shape]) fail(`${lang}: ${shape} has no entry in SHAPE_PATHS`);
    else if (!existsSync(path.join(ROOT, 'shapes', SHAPE_PATHS[shape] + '.svg'))) fail(`${lang}: shapes/${SHAPE_PATHS[shape]}.svg is missing`);
    for (const w of words) {
      if (owner[w]) fail(`${lang}: "${w}" belongs to both ${owner[w]} and ${shape}`);
      owner[w] = shape;
    }
  }
  console.log(`ok   ${lang}: ${Object.keys(owner).length} words, ${Object.keys(SHAPE_KEYWORDS[lang]).length} shapes`);
}

const cases = JSON.parse(readFileSync(path.join(HERE, 'cases.json'), 'utf8'));
const matches = (shape, want) => shape === want || shape.startsWith(want + '_');

function run(label, list, pick) {
  let ok = 0;
  for (const c of list) {
    const got = pick(c);
    if (matches(got, c.expected)) ok++;
    else fail(`${label}: "${c.idea}" (${c.lang}) gave ${got}, expected ${c.expected}`);
  }
  console.log(`${ok === list.length ? 'ok  ' : 'FAIL'} ${label}: ${ok}/${list.length}`);
}

run('ideas', cases.ideas.map(([lang, idea, expected]) => ({ lang, idea, expected })),
  (c) => pickShapeFromText(c.idea, c.lang, c.idea, c.idea));

// Stories: every illustrated page, chosen as buildPages does: from the page's
// own text, falling back to the story's main subject when the page names none.
const stories = cases.stories.map(([lang, idea, expected, story, pages]) => ({ lang, idea, expected, story, pages }));
let pageOk = 0, pageTotal = 0;
run('stories, page 1', stories, (c) => {
  const main = pickShapeFromText(c.story, c.lang, c.idea, c.story);
  const shapes = c.pages.filter(([, illustrated]) => illustrated).map(([text]) => {
    const s = pickShapeFromText(text, c.lang, c.idea, c.story);
    return s === 'star' ? main : s;
  });
  pageTotal += shapes.length;
  pageOk += shapes.filter((s) => matches(s, c.expected)).length;
  return shapes[0];
});
if (pageOk !== pageTotal) fail(`stories: ${pageTotal - pageOk} illustrated page(s) with the wrong picture`);
console.log(`${pageOk === pageTotal ? 'ok  ' : 'FAIL'} stories, every illustrated page: ${pageOk}/${pageTotal}`);

console.log(failures ? `\n${failures} failure(s)` : '\nAll picture checks pass.');
process.exit(failures ? 1 : 0);
