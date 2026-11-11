import json, hashlib, subprocess, re, sys, collections
S = sys.argv[1]; D = sys.argv[2]
rows = json.load(open(D))['rows']
H = json.load(open(S + '/hashes.json'))
controls = json.load(open(S + '/controls.json'))
M = {'a':[1],'b':[1,2],'c':[1,4],'d':[1,4,5],'e':[1,5],'f':[1,2,4],'g':[1,2,4,5],'h':[1,2,5],'i':[2,4],'j':[2,4,5],'k':[1,3],'l':[1,2,3],'m':[1,3,4],'n':[1,3,4,5],'o':[1,3,5],'p':[1,2,3,4],'q':[1,2,3,4,5],'r':[1,2,3,5],'s':[2,3,4],'t':[2,3,4,5],'u':[1,3,6],'v':[1,2,3,6],'w':[2,4,5,6],'x':[1,3,4,6],'y':[1,3,4,5,6],'z':[1,3,5,6],
'à':[1,2,3,5,6],'è':[2,3,4,6],'é':[1,2,3,4,5,6],'ì':[3,4],'ò':[3,4,6],'ù':[2,3,4,5,6],'â':[1,6],'ê':[1,2,6],'î':[1,4,6],'ô':[1,4,5,6],'û':[1,5,6],'ç':[1,2,3,4,6],'ñ':[1,2,4,5,6],'ü':[1,2,5,6],
'.':[2,5,6],',':[2],';':[2,3],':':[2,5],'?':[2,6],'!':[2,3,5],"'":[3],'-':[3,6],'"':[2,3,6],'(':[1,2,6],')':[3,4,5],'/':[3,4],
'1':[1],'2':[1,2],'3':[1,4],'4':[1,4,5],'5':[1,5],'6':[1,2,4],'7':[1,2,4,5],'8':[1,2,5],'9':[2,4],'0':[2,4,5]}
def norm(t):
    t = re.sub('[‘’‚‛]', "'", t); t = re.sub('[“”„‟]', '"', t)
    t = t.replace('…', '...'); t = re.sub('[–—―]', '-', t); return re.sub('[   ]', ' ', t)
def cell(d): return chr(0x2800 + sum(1 << (x - 1) for x in d))
def tact_g1(t):
    out = []; num = False
    for ch in norm(t):
        if ch == ' ': out.append(cell([])); num = False; continue
        if ch.isdigit() and ch in '0123456789':
            if not num: out.append(cell([3,4,5,6])); num = True
            out.append(cell(M.get(ch, []))); continue
        num = False; lo = ch.lower()
        if ch != lo and lo in M: out += [cell([6]), cell(M[lo])]
        else: out.append(cell(M.get(lo, [])))
    return ''.join(out)
def h(s): return hashlib.sha256(s.encode()).hexdigest()[:16]
def native(texts, table):
    p = subprocess.run(['lou_translate', '--forward', 'unicode.dis,' + table], input='\n'.join(texts) + '\n', capture_output=True, text=True)
    return p.stdout.rstrip('\n').split('\n')
res = {}
# replica check
rep = sum(h(tact_g1(r[10])) == H['g1'][str(r[0])] for r in rows) + sum(h(tact_g1(c)) == H['g1c'][i] for i, c in enumerate(controls))
res['replica_matches_live'] = f'{rep}/{len(rows) + len(controls)}'
# Grade 2: wasm vs native
en = [r for r in rows if r[1] != 'it1']
g2in = [re.sub(r'\s+', ' ', norm(r[10])) for r in en] + [re.sub(r'\s+', ' ', norm(c)) for c in controls]
nat = native(g2in, 'en-ueb-g2.ctb')
want = [H['g2'][str(r[0])] for r in en] + H['g2c']
ok = [h(n) == w for n, w in zip(nat, want)]
res['g2_wasm_vs_native'] = f'{sum(ok)}/{len(ok)} texts identical, {sum(len(n) for n in nat)} cells'
res['g2_mismatch'] = [i for i, o in enumerate(ok) if not o]
# Grade 1 vs native
def cmp(texts, table, label):
    nat = native([norm(t) for t in texts], table); diff = collections.Counter(); same = 0; cells = 0; ex = {}
    for t, n in zip(texts, nat):
        mine = tact_g1(t); cells += len(n)
        if mine == n: same += 1; continue
        # character-level diff by aligning on words
        mw, nw = mine.split(cell([])), n.split(cell([])); tw = norm(t).split(' ')
        if len(mw) == len(nw) == len(tw):
            for a, b, w in zip(mw, nw, tw):
                if a != b: diff[w] += 1; ex.setdefault(w, (a, b))
        else: diff['<word count differs>'] += 1; ex.setdefault('<wc> ' + t[:50], (mine[:60], n[:60]))
    res[label] = {'identical': f'{same}/{len(texts)}', 'cells': cells, 'words_differing': dict(diff.most_common(40)), 'examples': {k: list(v) for k, v in list(ex.items())[:25]}}
cmp([r[10] for r in rows if r[1] != 'it1'] + controls, 'en-ueb-g1.ctb', 'g1_en_vs_native')
cmp([r[10] for r in rows if r[1] == 'it1'], 'it-it-comp6.utb', 'g1_it_vs_native')
print(json.dumps(res, ensure_ascii=False, indent=1))
