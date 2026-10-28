#!/usr/bin/env python3
"""Writes expected.json: what liblouis, the reference braille translator, makes
of every text in cases.json. check.mjs then holds Tact's own translator to it.

Run this only when cases.json changes, with liblouis 3.39.0 installed
(`lou_translate`). Other releases can differ in small details, which would
quietly move the reference.

Tables: en-ueb-g1.ctb (English, uncontracted), it-it-comp6.utb (Italian),
en-ueb-g2.ctb (English, contracted).

Before translating, typographic characters are folded the way Tact folds them
(curly quotes to straight, the ellipsis to three periods, every long dash to
U+2014); that folding is Tact's choice, not a braille rule.
"""
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
VERSION = '3.39.0'


def fold(text):
    text = re.sub('[‘’‚‛]', "'", text)
    text = re.sub('[“”„‟]', '"', text)
    text = text.replace('…', '...')
    text = re.sub('[–―]', '—', text)
    return re.sub('[   ]', ' ', text)


def louis(texts, table):
    run = subprocess.run(['lou_translate', '--forward', 'unicode.dis,' + table],
                         input='\n'.join(texts) + '\n', capture_output=True, text=True, check=True)
    out = run.stdout.rstrip('\n').split('\n')
    assert len(out) == len(texts), (table, len(out), len(texts))
    return out


def main():
    version = subprocess.run(['lou_translate', '--version'], capture_output=True, text=True).stdout
    if VERSION not in version:
        sys.exit('liblouis ' + VERSION + ' is required, found: ' + version.split('\n')[0])
    cases = json.loads((HERE / 'cases.json').read_text())
    en = [fold(t) for t in cases['en']]
    it = [fold(t) for t in cases['it']]
    expected = {
        'liblouis': VERSION,
        'en_g1': louis(en, 'en-ueb-g1.ctb'),
        'it_g1': louis(it, 'it-it-comp6.utb'),
        # Grade 2 also collapses runs of white space, as the page does.
        'en_g2': louis([re.sub(r'\s+', ' ', t) for t in en], 'en-ueb-g2.ctb'),
    }
    (HERE / 'expected.json').write_text(json.dumps(expected, ensure_ascii=False, indent=1) + '\n')
    print('expected.json:', {k: len(v) for k, v in expected.items() if k != 'liblouis'})


if __name__ == '__main__':
    main()
