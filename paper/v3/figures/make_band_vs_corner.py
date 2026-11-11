"""Old (bottom band) vs updated (top-right corner) illustrated page, same style
as assets/tact_layout_old_vs_new.png. Geometry in mm from window.TACT_LAYOUT."""
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
SS = 2                                   # supersample, downscaled at the end
W, H = 2600 * SS, 1430 * SS
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 64 * SS, index=1)

PAGE = 150.0
CARD = 878 * SS
s = CARD / PAGE                          # px per mm
TOP = 328 * SS
LEFTS = [224 * SS, 1498 * SS]
INK, PAPER, EDGE = (12, 12, 14), (248, 247, 242), (221, 220, 211)
ZONE_FILL, ZONE_EDGE, SHAPE = (236, 235, 228), (184, 183, 174), (168, 167, 156)

def P(x0, xmm, ymm):                     # page mm (y up) -> image px
    return x0 + xmm * s, TOP + (PAGE - ymm) * s

def card(x0):
    d.rounded_rectangle([x0, TOP, x0 + CARD, TOP + CARD], radius=40 * SS, fill=PAPER, outline=EDGE, width=3 * SS)

def rows(x0, widths, indent=0):
    r = 0.72 * s
    for i, n in enumerate(widths):
        y = 135 - 10 * i + 5                # top row of each cell (dots 1 and 4)
        for c in range(indent if i == 0 else 0, n):
            for dx in (0, 1.75):           # stylised: one cell reads as a pair
                cx, cy = P(x0, 10 + 6 * c + dx, y)
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)

def dashed_zone(x0, zx, zy, zw, zh):
    a = P(x0, zx, zy + zh); b = P(x0, zx + zw, zy)
    d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=12 * SS, fill=ZONE_FILL)
    dash, gap, w = 14 * SS, 9 * SS, 3 * SS
    def seg(p, q):
        import math
        L = math.dist(p, q); n = int(L // (dash + gap)) + 1
        for k in range(n):
            t0 = k * (dash + gap) / L; t1 = min(1, (k * (dash + gap) + dash) / L)
            if t0 >= 1: break
            d.line([p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0,
                    p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1], fill=ZONE_EDGE, width=w)
    rr = 12 * SS
    x1, y1, x2, y2 = a[0], a[1], b[0], b[1]
    seg((x1 + rr, y1), (x2 - rr, y1)); seg((x1 + rr, y2), (x2 - rr, y2))
    seg((x1, y1 + rr), (x1, y2 - rr)); seg((x2, y1 + rr), (x2, y2 - rr))
    for box, st in (([x1, y1, x1 + 2 * rr, y1 + 2 * rr], 180), ([x2 - 2 * rr, y1, x2, y1 + 2 * rr], 270),
                    ([x2 - 2 * rr, y2 - 2 * rr, x2, y2], 0), ([x1, y2 - 2 * rr, x1 + 2 * rr, y2], 90)):
        d.arc(box, st, st + 90, fill=ZONE_EDGE, width=w)
    return a, b

def shape_circle(cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=SHAPE, width=5 * SS)

def label(x0, text):
    tw = d.textlength(text, font=font)
    d.text((x0 + CARD / 2 - tw / 2, 205 * SS), text, font=font, fill=INK)

# Old: nine full rows, picture centred in a 130 x 38 mm band at the bottom.
x0 = LEFTS[0]; card(x0); label(x0, "Old version")
rows(x0, [21] * 9)
a, b = dashed_zone(x0, 10, 12, 130, 38)
shape_circle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 15 * s)

# Updated: picture in the top-right corner, four 15-cell rows beside it, nine
# full rows below; the paragraph opens in cell 3.
x0 = LEFTS[1]; card(x0); label(x0, "Updated version")
rows(x0, [15] * 4 + [21] * 9, indent=2)
a, b = dashed_zone(x0, 103.2, 104, 36.8, 36)
shape_circle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 15 * s)

img.resize((W // SS, H // SS), Image.LANCZOS).save(OUT, optimize=True)
print("saved", OUT)
