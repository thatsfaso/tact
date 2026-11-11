import struct, sys, collections
TZ_X, CELL_W, LINE_H, LINE_Y0 = 10, 6.0, 10.0, 135
DOFF = {1:(0,5),2:(0,2.5),3:(0,0),4:(2.5,5),5:(2.5,2.5),6:(2.5,0)}
def decode(path):
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[80:84])[0]
    zs = collections.Counter(); pts = []
    for i in range(n):
        o = 84 + i * 50
        for k in range(3):
            x, y, z = struct.unpack('<3f', b[o+12+k*12:o+24+k*12]); pts.append((x, y, z)); zs[round(z, 3)] += 1
    levels = sorted(zs)
    # dot apex: the highest z level reached by many isolated vertices below the relief top
    top = max(levels); apex = sorted(levels)[-2] if True else top
    return pts, levels
def cells(path, base):
    pts, levels = decode(path)
    apex = round(base + 0.85, 3)
    tops = {(round(x, 2), round(y, 2)) for x, y, z in pts if abs(z - apex) < 1e-3}
    grid = collections.defaultdict(set)
    for x, y in tops:
        if x > 150 - 37 and y > 150 - 45: continue  # picture corner, if any
        for d, (dx, dy) in DOFF.items():
            li = round((LINE_Y0 - (y - dy)) / LINE_H); ci = round((x - dx - TZ_X) / CELL_W)
            if abs(TZ_X + ci * CELL_W + dx - x) < 0.05 and abs(LINE_Y0 - li * LINE_H + dy - y) < 0.05:
                grid[(li, ci)].add(d)
    lines = collections.defaultdict(dict)
    for (li, ci), ds in grid.items(): lines[li][ci] = ds
    out = []
    for li in sorted(lines):
        row = lines[li]; w = max(row) + 1
        out.append(''.join(chr(0x2800 + sum(1 << (d - 1) for d in row.get(c, ()))) for c in range(w)))
    return levels, out
for path, base in [(sys.argv[1], 2.0), (sys.argv[2], 1.0)]:
    levels, out = cells(path, base)
    print(path.split('/')[-1], 'z levels', levels)
    for l in out: print(' ', l)
