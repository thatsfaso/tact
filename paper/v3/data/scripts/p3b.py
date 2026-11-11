import json, re, subprocess, sys
d = json.load(open(sys.argv[1]))
def norm(t):
    t = re.sub('[‘’‚‛]', "'", t); t = re.sub('[“”„‟]', '"', t)
    t = t.replace('…', '...'); t = re.sub('[–―]', '—', t); return re.sub('[   ]', ' ', t)
def native(texts, table):
    p = subprocess.run(['lou_translate', '--forward', 'unicode.dis,' + table], input='\n'.join(texts) + '\n', capture_output=True, text=True)
    return p.stdout.rstrip('\n').split('\n')
def run(items, key, table, prep=norm):
    nat = native([prep(x['text']) for x in items], table)
    bad = [(x['id'], x['text'][:70], x[key], n) for x, n in zip(items, nat) if x[key] != n]
    syncbad = [x['id'] for x in items if x.get('sync') is not None and x['sync'] != x[key]]
    st = [x for x in items if x['id'][0] == 's']; ct = [x for x in items if x['id'][0] == 'c']
    sb = sum(1 for x in bad if x[0][0] == 's'); cb = len(bad) - sb
    print(f"{table}: stories {len(st)-sb}/{len(st)} identical, controls {len(ct)-cb}/{len(ct)} identical, cells {sum(len(n) for n in nat)}, sync-vs-async mismatches {len(syncbad)}")
    for b in bad: print('  DIFF', b[0], repr(b[1])); print('    tact  ', b[2]); print('    louis ', b[3])
run(d['en'], 'g1', 'en-ueb-g1.ctb')
run(d['it'], 'g1', 'it-it-comp6.utb')
run(d['g2'], 'g2', 'en-ueb-g2.ctb', lambda t: re.sub(r'\s+', ' ', norm(t)))
