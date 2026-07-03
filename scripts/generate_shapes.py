#!/usr/bin/env python3
"""
TACT — Parametric Shape Generator

Generates tactile-optimized SVG files for every shape in shapes/index.json.
All shapes use viewBox="0 0 200 200", stroke-width=6, fill=none,
stroke-linecap=round, stroke-linejoin=round — matching the shape library spec.

Run from the repo root:
    python scripts/generate_shapes.py

Each SVG is written to shapes/{category}/{name}.svg and overwrites any
existing file. Safe to re-run.
"""

import json
import math
import os
from pathlib import Path

# ── Repo root ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
SHAPES_DIR = ROOT / "shapes"
INDEX_PATH = SHAPES_DIR / "index.json"

# ── SVG helpers ───────────────────────────────────────────────────────────────
SW = 6          # stroke-width (6 units in 200×200 viewBox)
SW_THIN = 4     # for secondary/detail strokes

def svg_wrap(content: str, name: str, category: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n'
        f'<!-- TACT shape: {name} | category: {category} | license: CC0 | source: parametric -->\n'
        f'<g fill="none" stroke="#000000" stroke-width="{SW}" '
        f'stroke-linecap="round" stroke-linejoin="round">\n'
        f'{content}\n'
        f'</g>\n'
        f'</svg>\n'
    )

def circle(cx, cy, r, sw=None) -> str:
    s = f' stroke-width="{sw}"' if sw else ""
    return f'  <circle cx="{cx}" cy="{cy}" r="{r}"{s}/>'

def ellipse(cx, cy, rx, ry) -> str:
    return f'  <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/>'

def rect(x, y, w, h, rx=0) -> str:
    r = f' rx="{rx}"' if rx else ""
    return f'  <rect x="{x}" y="{y}" width="{w}" height="{h}"{r}/>'

def line(x1, y1, x2, y2, sw=None) -> str:
    s = f' stroke-width="{sw}"' if sw else ""
    return f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{s}/>'

def polyline(pts) -> str:
    p = " ".join(f"{x},{y}" for x, y in pts)
    return f'  <polyline points="{p}"/>'

def polygon(pts) -> str:
    p = " ".join(f"{x},{y}" for x, y in pts)
    return f'  <polygon points="{p}"/>'

def path(d) -> str:
    return f'  <path d="{d}"/>'

def arc_path(cx, cy, r, start_deg, end_deg) -> str:
    """SVG arc from start_deg to end_deg (clockwise)."""
    s = math.radians(start_deg)
    e = math.radians(end_deg)
    x1 = cx + r * math.cos(s)
    y1 = cy + r * math.sin(s)
    x2 = cx + r * math.cos(e)
    y2 = cy + r * math.sin(e)
    large = 1 if (end_deg - start_deg) > 180 else 0
    return f"M {x1:.1f},{y1:.1f} A {r},{r} 0 {large},1 {x2:.1f},{y2:.1f}"

def star_path(cx, cy, r_outer, r_inner, n=5) -> str:
    pts = []
    for i in range(n * 2):
        r = r_outer if i % 2 == 0 else r_inner
        a = math.radians(-90 + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
    return path(d)

def wave_path(x0, y0, x1, amp, n_cycles=2) -> str:
    """Horizontal sine wave from x0 to x1 at y0, amplitude amp."""
    pts = []
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = x0 + t * (x1 - x0)
        y = y0 + amp * math.sin(t * n_cycles * 2 * math.pi)
        pts.append((x, y))
    d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return path(d)

def cat_body(x, y, w, h) -> str:
    """Rounded body oval."""
    return ellipse(x, y, w, h)

def bezier_tail(x0, y0, cx1, cy1, cx2, cy2, x1, y1) -> str:
    return path(f"M {x0},{y0} C {cx1},{cy1} {cx2},{cy2} {x1},{y1}")

# ── Shape definitions ─────────────────────────────────────────────────────────

SHAPES: dict[str, str] = {}

# ── Animals ───────────────────────────────────────────────────────────────────

SHAPES["animals/cat_sitting"] = "\n".join([
    # Head
    circle(100, 75, 38),
    # Ears (triangles)
    path("M 70,50 L 58,22 L 90,42 Z"),
    path("M 130,50 L 142,22 L 110,42 Z"),
    # Body oval
    ellipse(100, 148, 45, 38),
    # Tail curl
    path("M 145,170 Q 175,155 168,130 Q 160,108 145,118"),
    # Eyes (small circles)
    circle(85, 72, 6, sw=SW_THIN),
    circle(115, 72, 6, sw=SW_THIN),
    # Nose
    path("M 97,88 L 100,92 L 103,88 Z"),
    # Whiskers
    line(62, 85, 88, 88, sw=SW_THIN),
    line(60, 92, 87, 92, sw=SW_THIN),
    line(112, 88, 138, 85, sw=SW_THIN),
    line(113, 92, 140, 92, sw=SW_THIN),
])

SHAPES["animals/cat_standing"] = "\n".join([
    # Body
    ellipse(105, 118, 52, 30),
    # Head
    circle(62, 75, 32),
    # Ears
    path("M 44,55 L 36,28 L 62,48 Z"),
    path("M 80,55 L 88,28 L 62,48 Z"),
    # Legs (4)
    path("M 68,145 L 65,178"),
    path("M 88,147 L 86,178"),
    path("M 118,147 L 116,178"),
    path("M 140,145 L 143,178"),
    # Tail
    path("M 157,118 Q 182,100 178,75 Q 174,55 162,60"),
    # Eye
    circle(55, 72, 5, sw=SW_THIN),
    # Whiskers
    line(30, 78, 52, 80, sw=SW_THIN),
    line(28, 85, 51, 85, sw=SW_THIN),
])

SHAPES["animals/dog_sitting"] = "\n".join([
    # Head (wider than cat)
    ellipse(100, 72, 42, 36),
    # Ears (droopy)
    path("M 60,58 Q 42,52 40,82 Q 42,100 60,96"),
    path("M 140,58 Q 158,52 160,82 Q 158,100 140,96"),
    # Body
    ellipse(100, 150, 48, 38),
    # Front paws
    ellipse(78, 183, 14, 8),
    ellipse(122, 183, 14, 8),
    # Snout
    ellipse(100, 88, 20, 14),
    # Nose
    ellipse(100, 82, 8, 5),
    # Eyes
    circle(82, 62, 6, sw=SW_THIN),
    circle(118, 62, 6, sw=SW_THIN),
])

SHAPES["animals/dog_standing"] = "\n".join([
    # Body
    ellipse(108, 112, 55, 28),
    # Head
    circle(60, 72, 32),
    # Snout
    ellipse(44, 84, 18, 12),
    # Ears (floppy)
    path("M 42,55 Q 26,50 24,76 Q 26,96 42,90"),
    path("M 78,55 Q 88,46 84,68"),
    # Legs
    path("M 72,136 L 68,178"),
    path("M 90,138 L 88,178"),
    path("M 122,138 L 120,178"),
    path("M 145,136 L 148,178"),
    # Tail up
    path("M 163,106 Q 182,88 175,68"),
    # Nose
    ellipse(32, 84, 7, 5),
    # Eye
    circle(55, 66, 5, sw=SW_THIN),
])

SHAPES["animals/bird_flying"] = "\n".join([
    # Body
    ellipse(100, 110, 22, 12),
    # Left wing
    path("M 78,108 Q 50,80 18,90 Q 44,104 78,114"),
    # Right wing
    path("M 122,108 Q 150,80 182,90 Q 156,104 122,114"),
    # Head
    circle(100, 88, 16),
    # Beak
    path("M 84,88 L 70,92 L 84,96"),
    # Tail
    path("M 118,114 Q 140,120 148,132"),
    path("M 118,110 Q 142,110 152,118"),
])

SHAPES["animals/bird_perched"] = "\n".join([
    # Branch
    line(30, 168, 175, 168),
    # Body
    ellipse(100, 128, 28, 32),
    # Head
    circle(100, 88, 22),
    # Beak
    path("M 80,90 L 64,96 L 80,102"),
    # Wing outline
    path("M 76,120 Q 68,140 80,158 Q 98,148 118,158 Q 130,140 124,120"),
    # Tail feathers
    path("M 118,150 Q 135,162 142,172"),
    path("M 122,155 Q 138,168 140,178"),
    # Feet
    path("M 88,168 L 82,182 M 88,168 L 88,182 M 88,168 L 96,182"),
    path("M 112,168 L 106,182 M 112,168 L 112,182 M 112,168 L 120,182"),
    # Eye
    circle(92, 84, 7, sw=SW_THIN),
])

SHAPES["animals/fish"] = "\n".join([
    # Body
    ellipse(95, 100, 58, 32),
    # Tail fin
    path("M 153,100 L 178,72 L 182,100 L 178,128 Z"),
    # Dorsal fin
    path("M 80,68 Q 100,48 120,68"),
    # Ventral fin
    path("M 90,132 Q 100,150 112,132"),
    # Eye
    circle(60, 96, 9),
    circle(60, 96, 4, sw=SW_THIN),
    # Mouth
    path("M 37,104 Q 32,100 37,96"),
    # Gill line
    path(f"M 72,76 Q 68,100 72,124"),
])

SHAPES["animals/butterfly"] = "\n".join([
    # Body (thin vertical oval)
    ellipse(100, 100, 7, 38),
    # Top-left wing
    path("M 96,88 Q 52,42 28,60 Q 18,90 52,104 Q 76,112 96,104"),
    # Top-right wing
    path("M 104,88 Q 148,42 172,60 Q 182,90 148,104 Q 124,112 104,104"),
    # Bottom-left wing
    path("M 96,108 Q 55,118 42,140 Q 48,162 76,152 Q 94,142 96,122"),
    # Bottom-right wing
    path("M 104,108 Q 145,118 158,140 Q 152,162 124,152 Q 106,142 104,122"),
    # Antennae
    path("M 96,64 Q 80,42 72,28"),
    path("M 104,64 Q 120,42 128,28"),
    circle(72, 28, 5),
    circle(128, 28, 5),
])

SHAPES["animals/rabbit"] = "\n".join([
    # Left ear (tall)
    path("M 76,110 Q 68,60 76,22 Q 84,10 92,22 Q 100,60 92,110"),
    # Right ear
    path("M 108,110 Q 108,60 116,22 Q 124,10 132,22 Q 140,60 132,110"),
    # Head
    circle(100, 120, 36),
    # Body
    ellipse(100, 166, 38, 26),
    # Front paws
    ellipse(82, 188, 12, 6),
    ellipse(118, 188, 12, 6),
    # Tail (small circle back)
    circle(135, 162, 8),
    # Nose
    ellipse(100, 128, 6, 4),
    # Eyes
    circle(86, 112, 6, sw=SW_THIN),
    circle(114, 112, 6, sw=SW_THIN),
])

SHAPES["animals/elephant"] = "\n".join([
    # Body (large)
    ellipse(112, 128, 60, 46),
    # Head
    circle(62, 88, 40),
    # Ear (large oval)
    path("M 26,64 Q 8,68 6,100 Q 8,132 28,134 Q 44,128 44,100 Q 44,70 26,64"),
    # Trunk
    path("M 38,108 Q 18,120 16,144 Q 14,162 28,164 Q 42,164 40,150 Q 38,136 48,128"),
    # Legs (4 pillars)
    path("M 68,168 L 64,196"),
    path("M 90,172 L 88,196"),
    path("M 130,172 L 128,196"),
    path("M 154,168 L 158,196"),
    # Tail
    path("M 170,138 Q 184,130 182,118"),
    # Eye
    circle(54, 80, 8),
    circle(54, 80, 3, sw=SW_THIN),
])

SHAPES["animals/bear"] = "\n".join([
    # Body
    ellipse(106, 128, 58, 44),
    # Head
    circle(62, 80, 36),
    # Ears
    circle(44, 50, 14),
    circle(80, 46, 14),
    # Snout
    ellipse(56, 94, 20, 14),
    # Nose
    ellipse(56, 86, 8, 6),
    # Legs
    path("M 68,166 L 64,194"),
    path("M 92,170 L 90,194"),
    path("M 120,170 L 118,194"),
    path("M 150,166 L 154,194"),
    # Front paw suggestion
    ellipse(64, 194, 12, 5),
    ellipse(90, 194, 12, 5),
    # Eye
    circle(52, 74, 6, sw=SW_THIN),
    # Tail
    circle(162, 148, 8),
])

SHAPES["animals/lion"] = "\n".join([
    # Mane (large circle behind head)
    circle(100, 100, 70),
    # Face
    circle(100, 100, 48),
    # Ears (peeking above mane — barely visible but tactile landmark)
    circle(74, 44, 10),
    circle(126, 44, 10),
    # Eyes
    circle(82, 88, 9),
    circle(118, 88, 9),
    circle(82, 88, 4, sw=SW_THIN),
    circle(118, 88, 4, sw=SW_THIN),
    # Nose (triangle)
    path("M 95,108 L 100,116 L 105,108 Z"),
    # Mouth
    path("M 100,116 Q 88,126 82,122"),
    path("M 100,116 Q 112,126 118,122"),
    # Whisker pads
    ellipse(78,112,12,8),
    ellipse(122,112,12,8),
])

SHAPES["animals/owl"] = "\n".join([
    # Body
    ellipse(100, 135, 46, 50),
    # Head
    ellipse(100, 72, 44, 40),
    # Ear tufts
    path("M 68,40 L 60,18 L 80,36"),
    path("M 132,40 L 140,18 L 120,36"),
    # Eye rings
    circle(82, 72, 18),
    circle(118, 72, 18),
    # Pupils
    circle(82, 72, 8),
    circle(118, 72, 8),
    # Beak
    path("M 93,88 L 100,100 L 107,88 Z"),
    # Wing outlines on body
    path("M 56,120 Q 50,148 58,175"),
    path("M 144,120 Q 150,148 142,175"),
    # Feet
    path("M 84,180 L 74,194 M 84,180 L 84,194 M 84,180 L 94,194"),
    path("M 116,180 L 106,194 M 116,180 L 116,194 M 116,180 L 126,194"),
])

SHAPES["animals/horse"] = "\n".join([
    # Body
    ellipse(112, 126, 58, 34),
    # Neck
    path("M 68,108 Q 60,80 72,60"),
    path("M 88,100 Q 82,76 90,56"),
    # Head
    ellipse(84, 50, 24, 18),
    # Snout extension
    ellipse(70, 62, 14, 10),
    # Mane
    path("M 72,36 Q 68,28 76,24 Q 82,30 80,38"),
    path("M 84,32 Q 82,22 90,20 Q 96,26 92,34"),
    # Legs
    path("M 72,156 L 68,194"),
    path("M 92,160 L 90,194"),
    path("M 126,160 L 124,194"),
    path("M 152,156 L 156,194"),
    # Tail
    path("M 168,120 Q 185,106 188,88 Q 186,76 178,80"),
    path("M 168,124 Q 186,114 190,100"),
    # Nostril
    ellipse(64, 64, 4, 3),
    # Eye
    circle(88, 44, 5, sw=SW_THIN),
])

SHAPES["animals/duck"] = "\n".join([
    # Water line
    path("M 20,152 Q 40,144 60,152 Q 80,160 100,152 Q 120,144 140,152 Q 160,160 180,152"),
    # Body
    ellipse(100, 128, 55, 32),
    # Head
    circle(62, 90, 26),
    # Bill (flat, horizontal)
    path("M 36,92 L 16,96 L 36,100 Q 42,100 48,96 Q 42,92 36,92 Z"),
    # Wing line
    path("M 66,124 Q 90,114 130,120 Q 148,124 152,134"),
    # Tail bump
    path("M 152,130 Q 162,118 158,108"),
    # Eye
    circle(58, 84, 6),
    circle(58, 84, 2, sw=SW_THIN),
])

SHAPES["animals/frog"] = "\n".join([
    # Body (top-down, wide)
    ellipse(100, 118, 56, 44),
    # Head merges into body — bumps for eyes
    circle(74, 80, 18),
    circle(126, 80, 18),
    # Pupils
    circle(74, 80, 9),
    circle(126, 80, 9),
    # Front left leg
    path("M 50,104 Q 30,96 18,108 Q 14,120 24,124 Q 34,128 42,118"),
    # Front right leg
    path("M 150,104 Q 170,96 182,108 Q 186,120 176,124 Q 166,128 158,118"),
    # Back left leg
    path("M 56,148 Q 28,158 18,176 Q 24,188 40,180 Q 52,172 56,158"),
    # Back right leg
    path("M 144,148 Q 172,158 182,176 Q 176,188 160,180 Q 148,172 144,158"),
    # Mouth line
    path("M 74,100 Q 100,108 126,100"),
    # Nostril dots
    circle(92, 88, 4),
    circle(108, 88, 4),
])

SHAPES["animals/turtle"] = "\n".join([
    # Shell dome (wide ellipse)
    ellipse(100, 106, 60, 46),
    # Shell pattern (simplified hexagon grid — 7 cells)
    ellipse(100, 98, 22, 18),
    ellipse(70, 90, 14, 12, ),
    ellipse(130, 90, 14, 12),
    ellipse(68, 114, 14, 12),
    ellipse(132, 114, 14, 12),
    ellipse(84, 124, 14, 10),
    ellipse(116, 124, 14, 10),
    # Head
    ellipse(50, 90, 22, 16),
    # Eye
    circle(42, 84, 5),
    # Mouth
    path("M 32,92 Q 28,88 32,84"),
    # Front legs
    path("M 48,108 Q 22,110 14,126 Q 18,138 30,132"),
    path("M 76,144 Q 68,162 54,168 Q 42,164 46,152"),
    # Back legs
    path("M 152,108 Q 178,110 186,126 Q 182,138 170,132"),
    path("M 124,144 Q 132,162 146,168 Q 158,164 154,152"),
    # Tail
    path("M 158,118 Q 170,112 172,100"),
])

# ── Vehicles ──────────────────────────────────────────────────────────────────

SHAPES["vehicles/boat_small"] = "\n".join([
    # Hull
    path("M 22,110 Q 100,148 178,110 L 168,132 Q 100,164 32,132 Z"),
    # Deck line
    path("M 30,110 L 170,110"),
    # Bow detail
    path("M 22,110 Q 16,120 18,132"),
    # Stern post
    path("M 178,110 Q 182,120 180,132"),
])

SHAPES["vehicles/boat_sailboat"] = "\n".join([
    # Hull
    path("M 28,138 Q 100,168 172,138 L 158,158 Q 100,182 42,158 Z"),
    # Mast
    line(100, 28, 100, 140),
    # Main sail (triangle)
    path("M 100,34 L 152,132 L 100,132 Z"),
    # Small jib
    path("M 100,50 L 56,128 L 100,128 Z"),
    # Boom
    line(100, 132, 152, 132),
    # Wave
    path("M 18,172 Q 36,162 54,172 Q 72,182 90,172 Q 108,162 126,172 Q 144,182 164,172"),
])

SHAPES["vehicles/car_simple"] = "\n".join([
    # Wheels
    circle(60, 160, 26),
    circle(60, 160, 12, sw=SW_THIN),
    circle(148, 160, 26),
    circle(148, 160, 12, sw=SW_THIN),
    # Body lower
    path("M 20,134 L 180,134 Q 186,134 186,140 L 186,152 Q 186,158 180,158 L 20,158 Q 14,158 14,152 L 14,140 Q 14,134 20,134 Z"),
    # Cabin
    path("M 48,134 Q 60,100 80,96 L 132,96 Q 148,100 158,134"),
    # Windscreen lines
    path("M 84,98 L 80,132", ),
    path("M 128,98 L 132,132"),
])

SHAPES["vehicles/bicycle"] = "\n".join([
    # Wheels
    circle(52, 130, 48),
    circle(52, 130, 10, sw=SW_THIN),
    circle(152, 130, 48),
    circle(152, 130, 10, sw=SW_THIN),
    # Frame
    path("M 52,130 L 100,78 L 152,130"),  # main triangle
    path("M 100,78 L 116,130"),            # seat tube
    path("M 100,78 L 92,60"),             # seat post
    path("M 92,60 L 80,60 M 92,60 L 104,60"),  # seat
    # Handlebar
    path("M 152,130 L 148,86"),
    path("M 148,86 L 138,82 M 148,86 L 158,78"),
    # Pedal crank
    circle(116, 130, 10),
    line(108, 136, 124, 124, sw=SW_THIN),
])

SHAPES["vehicles/airplane"] = "\n".join([
    # Fuselage
    path("M 22,100 Q 22,88 38,84 L 168,88 Q 186,90 186,100 Q 186,110 168,112 L 38,116 Q 22,112 22,100 Z"),
    # Main wing
    path("M 90,88 L 68,42 L 56,42 L 80,88"),
    path("M 110,88 L 132,42 L 144,42 L 120,88"),
    # Tail fin (vertical)
    path("M 162,88 L 158,58 L 172,72 L 172,88"),
    # Tail stabilizer (horizontal)
    path("M 162,102 L 148,122 L 152,122 L 165,110"),
    path("M 162,98 L 148,78 L 152,78 L 165,90"),
    # Engine
    ellipse(88, 90, 14, 6),
    ellipse(112, 90, 14, 6),
    # Nose cone
    path("M 22,100 L 8,100"),
])

SHAPES["vehicles/train_simple"] = "\n".join([
    # Wheels
    circle(44, 162, 20),
    circle(90, 162, 20),
    circle(140, 162, 20),
    # Running plate / footboard
    path("M 18,142 L 180,142"),
    # Boiler (large cylinder side-on)
    path("M 30,90 L 150,90 Q 158,90 158,100 L 158,142 Q 158,142 30,142 Q 22,142 22,132 L 22,100 Q 22,90 30,90 Z"),
    # Dome
    path("M 80,90 Q 80,72 100,70 Q 120,72 120,90"),
    # Smokebox / front
    path("M 150,94 L 178,94 L 178,142 L 150,142"),
    # Chimney
    path("M 50,90 L 50,60 Q 50,52 58,52 Q 66,52 66,60 L 66,90"),
    # Cab
    path("M 18,90 L 30,90 L 30,68 L 18,68 Z"),
    # Cab window
    rect(20, 72, 8, 10, rx=2),
    # Coupling
    line(8, 130, 22, 130),
])

SHAPES["vehicles/rocket"] = "\n".join([
    # Nose cone
    path("M 100,18 Q 118,42 118,70 L 82,70 Q 82,42 100,18 Z"),
    # Body cylinder
    rect(82, 70, 36, 88, rx=2),
    # Fins (3)
    path("M 82,130 L 58,168 L 82,158 Z"),
    path("M 118,130 L 142,168 L 118,158 Z"),
    path("M 118,148 L 126,166 L 118,158"),  # back fin hint
    # Window porthole
    circle(100, 100, 14),
    circle(100, 100, 7, sw=SW_THIN),
    # Flame
    path("M 82,158 Q 90,176 84,192 Q 100,180 100,192 Q 100,180 116,192 Q 110,176 118,158"),
])

# ── Nature ────────────────────────────────────────────────────────────────────

SHAPES["nature/tree_simple"] = "\n".join([
    # Trunk
    rect(88, 148, 24, 38, rx=3),
    # Canopy (stacked ovals for layered look)
    ellipse(100, 120, 52, 36),
    ellipse(100, 90, 44, 32),
    ellipse(100, 62, 34, 28),
    # Root bumps
    path("M 88,184 Q 76,188 72,196"),
    path("M 112,184 Q 124,188 128,196"),
])

SHAPES["nature/flower_simple"] = "\n".join([
    # Stem
    line(100, 148, 100, 186),
    # Leaves
    path("M 100,166 Q 80,156 72,142 Q 88,148 100,158"),
    path("M 100,166 Q 120,156 128,142 Q 112,148 100,158"),
    # Petals (6 ellipses rotated around centre)
    *[
        f'  <ellipse cx="{100 + 38*math.cos(math.radians(a)):.1f}" cy="{100 + 38*math.sin(math.radians(a)):.1f}" '
        f'rx="14" ry="24" transform="rotate({a},{100 + 38*math.cos(math.radians(a)):.1f},{100 + 38*math.sin(math.radians(a)):.1f})"/>'
        for a in range(0, 360, 60)
    ],
    # Centre
    circle(100, 100, 18),
])

SHAPES["nature/sun"] = "\n".join([
    # Centre circle
    circle(100, 100, 36),
    # 8 rays
    *[
        line(
            100 + 44 * math.cos(math.radians(a)),
            100 + 44 * math.sin(math.radians(a)),
            100 + 68 * math.cos(math.radians(a)),
            100 + 68 * math.sin(math.radians(a)),
        )
        for a in range(0, 360, 45)
    ],
])

SHAPES["nature/moon"] = "\n".join([
    # Outer circle
    circle(108, 100, 70),
    # Inner circle (subtracted visually by being filled paper-white — use the crescent path instead)
    # Crescent via two-arc path
    path("M 108,30 A 70,70 0 1,1 108,170 A 54,54 0 1,0 108,30 Z"),
])

SHAPES["nature/star"] = "\n".join([
    star_path(100, 100, 80, 34, 5),
])

SHAPES["nature/cloud"] = "\n".join([
    # Cloud outline: three bumps on top, flat bottom
    path("M 30,130 Q 30,110 46,108 Q 46,86 66,82 Q 68,60 92,60 Q 100,44 116,50 Q 128,38 146,48 Q 162,44 168,60 Q 182,62 184,80 Q 194,84 192,100 Q 196,116 182,120 Q 180,130 30,130 Z"),
])

SHAPES["nature/mountain"] = "\n".join([
    # Background peak
    path("M 60,180 L 130,48 L 200,180 Z"),
    # Foreground peak (overlapping)
    path("M 0,180 L 90,32 L 180,180 Z"),
    # Snow caps
    path("M 90,32 L 78,72 L 102,72 Z"),
    path("M 130,48 L 120,80 L 140,80 Z"),
    # Ground line
    line(0, 180, 200, 180),
])

SHAPES["nature/wave"] = "\n".join([
    # Main wave (S-curve with crest)
    path("M 14,120 Q 40,90 70,108 Q 100,126 130,96 Q 160,66 186,80"),
    # Crest curl
    path("M 186,80 Q 192,74 188,68 Q 180,60 174,66"),
    # Secondary smaller wave below
    path("M 14,148 Q 44,136 74,148 Q 104,160 134,148 Q 164,136 186,144"),
    # Foam dots
    circle(96, 118, 5),
    circle(108, 112, 4),
    circle(84, 122, 4),
])

SHAPES["nature/leaf"] = "\n".join([
    # Leaf outline (oval with pointed tip)
    path("M 100,28 Q 136,48 138,100 Q 136,148 100,172 Q 64,148 62,100 Q 64,48 100,28 Z"),
    # Central vein
    line(100, 30, 100, 170),
    # Side veins (4 pairs)
    *[
        f'  <line x1="100" y1="{y}" x2="{100-dx}" y2="{y+dy}"/>\n  <line x1="100" y1="{y}" x2="{100+dx}" y2="{y+dy}"/>'
        for y, dx, dy in [(70,28,16),(90,32,14),(110,30,12),(130,26,10)]
    ],
    # Stem
    line(100, 172, 100, 192),
])

# ── Buildings ─────────────────────────────────────────────────────────────────

SHAPES["buildings/house_simple"] = "\n".join([
    # Walls
    rect(36, 108, 128, 80, rx=2),
    # Roof
    path("M 24,108 L 100,34 L 176,108 Z"),
    # Door
    path("M 82,188 L 82,148 Q 82,138 100,138 Q 118,138 118,148 L 118,188"),
    # Chimney
    rect(130, 42, 18, 38, rx=2),
    # Smoke (optional decorative)
    path("M 138,40 Q 134,28 140,20 Q 146,12 142,4"),
])

SHAPES["buildings/castle_tower"] = "\n".join([
    # Tower body
    rect(56, 88, 88, 100, rx=2),
    # Battlements (merlons — 5 alternating)
    rect(56, 66, 14, 24),
    rect(86, 66, 14, 24),
    rect(116, 66, 14, 24),
    rect(146, 66, 14, 24, ),
    # Battlement gaps fill
    rect(70, 76, 16, 14),
    rect(100, 76, 16, 14),
    rect(130, 76, 16, 14),
    # Arched doorway
    path("M 76,188 L 76,152 Q 76,132 100,132 Q 124,132 124,152 L 124,188"),
    # Arrow slit windows
    rect(92, 104, 16, 28, rx=2),
    # Base ground line
    line(40, 188, 160, 188),
])

SHAPES["buildings/lighthouse"] = "\n".join([
    # Tower (tapered)
    path("M 72,180 L 64,90 L 136,90 L 128,180 Z"),
    # Stripe
    path("M 66,130 L 67,118 L 133,118 L 134,130 Z"),
    path("M 69,152 L 70,140 L 130,140 L 131,152 Z"),
    # Lantern room
    rect(60, 68, 80, 24, rx=4),
    # Lantern top / roof
    path("M 56,68 L 100,34 L 144,68 Z"),
    # Light beacon
    circle(100, 80, 12),
    # Railing
    line(56, 90, 144, 90),
    # Base
    path("M 52,180 L 52,192 Q 52,196 60,196 L 140,196 Q 148,196 148,192 L 148,180 Z"),
    # Door
    path("M 88,196 L 88,178 Q 88,170 100,170 Q 112,170 112,178 L 112,196"),
])

# ── People ────────────────────────────────────────────────────────────────────

SHAPES["people/person_standing"] = "\n".join([
    # Head
    circle(100, 46, 28),
    # Torso
    line(100, 74, 100, 138),
    # Shoulders / arms
    path("M 50,100 L 100,84 L 150,100"),
    # Forearms down
    line(50, 100, 52, 138),
    line(150, 100, 148, 138),
    # Hips / legs
    path("M 76,172 L 100,138 L 124,172"),
    # Lower legs
    line(76, 172, 74, 196),
    line(124, 172, 126, 196),
    # Feet
    line(66, 196, 82, 196),
    line(118, 196, 134, 196),
])

SHAPES["people/person_child"] = "\n".join([
    # Head (proportionally larger)
    circle(100, 54, 34),
    # Torso (shorter)
    line(100, 88, 100, 140),
    # Arms
    path("M 58,106 L 100,94 L 142,106"),
    line(58, 106, 60, 138),
    line(142, 106, 140, 138),
    # Legs
    path("M 82,168 L 100,140 L 118,168"),
    line(82, 168, 80, 194),
    line(118, 168, 120, 194),
    # Feet
    line(72, 194, 88, 194),
    line(112, 194, 128, 194),
])

SHAPES["people/person_waving"] = "\n".join([
    # Head
    circle(100, 46, 28),
    # Torso
    line(100, 74, 100, 138),
    # Left arm (down normal)
    path("M 100,84 L 54,106 L 52,136"),
    # Right arm (raised waving)
    path("M 100,84 L 148,60 L 162,36"),
    # Hand suggestion
    circle(162, 34, 8),
    # Legs
    path("M 76,172 L 100,138 L 124,172"),
    line(76, 172, 74, 196),
    line(124, 172, 126, 196),
    # Feet
    line(66, 196, 82, 196),
    line(118, 196, 134, 196),
])

# ── Objects ───────────────────────────────────────────────────────────────────

SHAPES["objects/book"] = "\n".join([
    # Left page
    path("M 20,56 Q 20,44 32,44 L 96,44 L 96,164 L 32,164 Q 20,164 20,152 Z"),
    # Right page
    path("M 180,56 Q 180,44 168,44 L 104,44 L 104,164 L 168,164 Q 180,164 180,152 Z"),
    # Spine
    path("M 96,44 Q 100,36 104,44"),
    path("M 96,164 Q 100,172 104,164"),
    line(96, 44, 96, 164),
    line(104, 44, 104, 164),
    # Lines on left page (text lines)
    *[line(32, y, 88, y, sw=SW_THIN) for y in range(68, 152, 20)],
    # Lines on right page
    *[line(112, y, 168, y, sw=SW_THIN) for y in range(68, 152, 20)],
])

SHAPES["objects/hat_pirate"] = "\n".join([
    # Brim
    path("M 14,128 Q 14,116 28,112 L 172,112 Q 186,116 186,128 Q 186,140 172,140 L 28,140 Q 14,140 14,128 Z"),
    # Crown
    path("M 38,112 Q 34,88 44,68 Q 54,46 100,40 Q 146,46 156,68 Q 166,88 162,112"),
    # Skull (circle)
    circle(100, 80, 18),
    # Crossbones (simplified — two lines through skull area)
    line(74, 100, 126, 60),
    line(74, 60, 126, 100),
    # Bone ends (small circles)
    circle(74, 100, 5), circle(126, 60, 5),
    circle(74, 60, 5),  circle(126, 100, 5),
])

SHAPES["objects/crown"] = "\n".join([
    # Base band
    path("M 18,148 L 18,124 L 182,124 L 182,148 Q 182,156 174,156 L 26,156 Q 18,156 18,148 Z"),
    # 5 points
    path("M 18,124 L 42,64 L 58,124"),
    path("M 58,124 L 78,84 L 100,64 L 122,84 L 142,124"),
    path("M 142,124 L 158,64 L 182,124"),
    # Jewel circles (optional)
    circle(100, 140, 8),
    circle(58, 140, 6),
    circle(142, 140, 6),
])

SHAPES["objects/key"] = "\n".join([
    # Bow (loop at top)
    circle(100, 58, 36),
    circle(100, 58, 20, sw=SW_THIN),
    # Shank (vertical bar)
    rect(92, 90, 16, 88, rx=3),
    # Teeth
    path("M 108,140 L 122,140 L 122,152 L 108,152"),
    path("M 108,158 L 120,158 L 120,170 L 108,170"),
])

SHAPES["objects/heart"] = "\n".join([
    path("M 100,162 Q 44,128 28,92 Q 18,62 40,46 Q 62,30 84,48 Q 92,56 100,68 Q 108,56 116,48 Q 138,30 160,46 Q 182,62 172,92 Q 156,128 100,162 Z"),
])

SHAPES["objects/apple"] = "\n".join([
    # Apple body
    path("M 100,52 Q 150,44 166,86 Q 180,124 160,154 Q 140,178 100,180 Q 60,178 40,154 Q 20,124 34,86 Q 50,44 100,52 Z"),
    # Indent at top
    path("M 84,52 Q 100,44 116,52"),
    # Stem
    path("M 100,44 Q 102,28 112,20"),
    # Leaf
    path("M 112,20 Q 134,22 128,38 Q 120,48 110,36"),
    # Highlight (slight indent line)
    path("M 58,80 Q 52,100 56,126", ),
])

SHAPES["objects/umbrella"] = "\n".join([
    # Canopy (dome)
    path("M 16,112 Q 18,50 100,38 Q 182,50 184,112"),
    # Scalloped edge (7 scallops)
    *[
        f'  <path d="M {14+i*24},112 Q {26+i*24},128 {38+i*24},112"/>'
        for i in range(7)
    ],
    # Handle pole
    line(100, 110, 100, 178),
    # Hook
    path("M 100,178 Q 100,196 84,196 Q 68,196 68,180"),
])


# ── Writer ────────────────────────────────────────────────────────────────────

def write_shapes():
    created, skipped = 0, 0

    with open(INDEX_PATH) as f:
        index = json.load(f)

    for entry in index["shapes"]:
        name = entry["name"]
        category = entry["category"]
        key = f"{category}/{name}"

        if key not in SHAPES:
            print(f"  SKIP  {key}  (no parametric definition — add to SHAPES dict)")
            skipped += 1
            continue

        target_dir = SHAPES_DIR / category
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{name}.svg"

        svg = svg_wrap(SHAPES[key], name, category)
        target.write_text(svg)
        print(f"  WRITE {key}")
        created += 1

    print(f"\n{created} shapes written, {skipped} skipped.")


if __name__ == "__main__":
    write_shapes()
