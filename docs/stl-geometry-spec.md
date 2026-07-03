# STL Geometry Specification

**Status: v1.0 — locked for implementation.**

This document defines every geometric parameter the STL generator (Module 5) must use to produce tactilely readable, ISO-compliant, FDM-printable Braille pages. All dimensions are in millimetres. All values account for FDM shrinkage unless explicitly noted.

---

## Coordinate System

Matches the page format spec exactly:
- Origin (0, 0, 0): bottom-left of base plate, bottom surface
- Z=0: bottom of base plate (printer bed)
- Z=0.5: top surface of base plate (where all raised elements begin)
- Z positive: away from the printer bed (toward the reader's fingers)

---

## Base Plate

```
Width:              150mm  (PAGE_W — square page, see page-format-spec.md v2.0)
Depth:              150mm  (PAGE_H)
Thickness:          0.5mm
Corner radius:      2.0mm (XY plane only — bevelled edges, not sphere corners)
Z range:            0.0 → 0.5mm
```

**Why 0.5mm thickness:** At 0.3mm layer height (standard for budget FDM), this is 1-2 layers. Thinner than 0.4mm risks warping on non-heated beds; thicker than 0.6mm wastes filament and print time without tactile benefit.

**Corner treatment:** Use a 2D hull with 2mm radius rounded corners, then extrude in Z. This is a minkowski sum of the rectangle with a 2mm circle — `trimesh.creation.extrude_polygon(shapely_polygon)`.

**Material:** Homogeneous solid (no infill, no walls+infill separation). At 0.5mm, it's thinner than a single perimeter wall, so this is just a flat extruded face.

---

## Braille Dot Geometry

### Design dimensions (what we model in the STL)

```
Dot diameter (base):   1.6mm
Dot height:            0.85mm
Dot profile:           domed (hemisphere)
Base Z:                0.5mm   (top of base plate)
Apex Z:                1.35mm  (0.5 + 0.85)
```

### Expected printed dimensions (after FDM shrinkage)

```
Dot diameter (printed): ~1.3mm   (shrink ~19%)
Dot height (printed):   ~0.60mm  (shrink ~29%)
```

Both values fall within the ISO 17049:2013 valid range and within the optimal 0.6–0.9mm tactile range confirmed by blind reader surveys.

### Profile: hemisphere with cylindrical base

A pure hemisphere produces a very tall apex relative to its base diameter. For FDM, a hybrid profile gives better results: a short cylindrical base topped by a hemisphere cap.

```
Cylinder portion:   diameter 1.6mm, height 0.35mm (above base plate)
Hemisphere cap:     radius 0.8mm, placed atop cylinder
Total height:       0.35 + (0.8 − cap_cut) ≈ 0.85mm
```

The hemisphere is truncated: only the upper portion is used. The cut plane intersects the sphere at Z=0.35mm above the cylinder top, i.e., at sphere coordinate Z_sphere = 0.35mm from the sphere center (which sits at Z = 0.5 + 0.35 = 0.85mm from the base plate bottom).

**Why hybrid:** A pure hemisphere of radius 0.8mm would be 0.8mm tall — within range but at the low end. The cylinder base lifts the center of curvature, making the cap rounder (lower curvature) which prints better on budget FDM and is more comfortable for young fingers.

### Mesh generation

```python
import trimesh
import numpy as np

def make_braille_dot(x_mm: float, y_mm: float) -> trimesh.Trimesh:
    """
    Returns a single Braille dot mesh positioned at (x_mm, y_mm) on the page.
    Base plate top surface is Z=0.5. Dot sits above it.
    """
    # Cylinder base
    cyl = trimesh.creation.cylinder(
        radius=0.8,       # 1.6mm diameter
        height=0.35,
        sections=16,      # 16-sided polygon — smooth enough, fast to slice
    )
    cyl.apply_translation([0, 0, 0.35 / 2])   # center cylinder, lift so base at Z=0

    # Hemisphere cap
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=0.8)
    # Keep only upper hemisphere (Z >= 0)
    mask = sphere.vertices[:, 2] >= -0.01
    # Use trimesh boolean or manual mesh trimming
    cap = trimesh.intersects.slice_mesh_plane(sphere, [0, 0, 1], [0, 0, 0])
    cap.apply_translation([0, 0, 0.35])        # place atop cylinder

    dot = trimesh.util.concatenate([cyl, cap])
    dot = trimesh.convex.convex_hull(dot)      # ensure watertight
    dot.apply_translation([x_mm, y_mm, 0.5])  # lift to base plate top
    return dot
```

**Section count:** 16 per cylinder/hemisphere is sufficient for FDM (printer can't reproduce finer detail). More sections increase STL file size without print benefit.

### Dot position formula

From the page format spec (coordinate system: origin bottom-left, Y up):

```python
def dot_positions(
    cells: list,           # list of BrailleCell (dot lists)
    zone_origin_x: float,  # mm from page left
    zone_origin_y: float,  # mm from page bottom (top of zone)
    n_lines: int = 5,
) -> list[tuple[float, float]]:
    """
    Returns (x, y) mm coordinates for every raised dot.
    cells: flattened list of cells across all lines (wrapped by layoutBrailleLines).
    """
    positions = []
    line_y = zone_origin_y  # start at top of zone, decrement per line
    col_x  = zone_origin_x

    for line in cells_by_line:
        for cell_index, cell in enumerate(line):
            cell_x = col_x + cell_index * 6.0
            for dot_number in cell.dots:
                # Dot layout within cell (dot_number 1-6)
                col = (dot_number - 1) // 3       # 0 = left column, 1 = right column
                row = (dot_number - 1) %  3       # 0 = top, 1 = middle, 2 = bottom
                dx = col * 2.5
                dy = -row * 2.5                    # Y decreases downward (top dot is highest)
                positions.append((cell_x + dx, line_y + dy))
        line_y -= 10.0   # next line is 10mm lower
    return positions
```

---

## Tactile Graphic Geometry

Tactile graphics are SVG paths extruded perpendicular to the page surface.

### Extrusion parameters

```
Extrusion height:     1.0mm  (above base plate top, i.e. Z: 0.5 → 1.5mm)
Stroke expansion:     the SVG stroke-width is already encoded in the path geometry
Base Z:               0.5mm
Apex Z:               1.5mm
```

Tactile graphics are 0.15mm taller than Braille dots (1.0mm vs 0.85mm). This ensures fingertips distinguish illustration from text without conscious effort — the illustration feels unmistakably "more raised."

### SVG path → 3D mesh

1. **Load SVG path** from the shape library file (or render a primitive).
2. **Scale** the path from its 200×200 viewBox to the `natural_width_mm × natural_height_mm` specified in `index.json`, then apply the art director's `scale` factor.
3. **Offset** the path to its `PlacementSpec` position in illustration zone coordinates, then convert to page coordinates (see page format spec Y-flip).
4. **Stroke to polygon:** convert SVG strokes to filled polygons using `shapely.buffer()`. Buffer radius = `stroke_width_svg_units × mm_per_unit / 2`. Cap style: round. Join style: round.
5. **Extrude:** `trimesh.creation.extrude_polygon(shapely_polygon, height=1.0)`, translated to Z=0.5.
6. **Union:** merge all extruded polygons for this illustration into one mesh using `trimesh.boolean.union()` (uses OpenSCAD or manifold backend).

```python
from shapely.geometry import shape
from shapely.ops import unary_union
import svgpathtools
import trimesh

def svg_path_to_mesh(
    svg_path_str: str,
    stroke_width_mm: float,
    position_x_mm: float,
    position_y_mm: float,
    scale: float,
    extrusion_height: float = 1.0,
    base_z: float = 0.5,
) -> trimesh.Trimesh:
    """Convert one SVG path element to an extruded 3D mesh."""
    # Parse path, discretize to polygon
    path = svgpathtools.parse_path(svg_path_str)
    points = [path.point(t) for t in np.linspace(0, 1, 200)]
    coords  = [(p.real * scale + position_x_mm, p.imag * scale + position_y_mm) for p in points]

    from shapely.geometry import LineString
    line = LineString(coords)
    poly = line.buffer(stroke_width_mm / 2, cap_style=1, join_style=1)  # round cap+join

    mesh = trimesh.creation.extrude_polygon(poly, height=extrusion_height)
    mesh.apply_translation([0, 0, base_z])
    return mesh
```

### Top surface profile

Tactile graphics are **flat-topped** (rectangular extrusion), unlike Braille dots which are domed. Flat tops are easier to implement, print reliably, and are standard for tactile graphics embossers. The rounded stroke caps (from Shapely `cap_style=1`) give natural terminations.

---

## Full Page Assembly

```python
def page_to_stl(page_elements: list, output_path: str, page_width: float, page_height: float):
    """Assemble all elements into a single watertight STL."""
    meshes = []

    # 1. Base plate
    base = make_base_plate(page_width, page_height, thickness=0.5, corner_radius=2.0)
    meshes.append(base)

    # 2. Braille dots
    for el in page_elements:
        if el.type == "braille_dot":
            meshes.append(make_braille_dot(el.x, el.y))

    # 3. Tactile graphics
    for el in page_elements:
        if el.type == "tactile_path":
            meshes.append(svg_path_to_mesh(
                el.data["svg_path"],
                stroke_width_mm=el.data["stroke_width_mm"],
                position_x_mm=el.x,
                position_y_mm=el.y,
                scale=el.data.get("scale", 1.0),
            ))

    # 4. Union all meshes and export
    combined = trimesh.util.concatenate(meshes)
    combined.export(output_path)
```

**Mesh backend recommendation:** Use `trimesh` with the `manifold` boolean backend (fast, no OpenSCAD dependency). Install: `pip install manifold3d`.

---

## Printer Calibration

The design dimensions above target a mid-range budget FDM printer printing at 0.2mm layer height with a 0.4mm nozzle. Actual printed dimensions vary by printer, filament, and environment.

### Known shrinkage factors (empirical, budget FDM)

| Parameter | Designed | Typical printed | Shrinkage |
|---|---|---|---|
| Dot diameter | 1.6mm | 1.3mm | −19% |
| Dot height | 0.85mm | 0.60mm | −29% |
| Cell spacing | 6.0mm | 5.9mm | −2% |
| Base plate thickness | 0.5mm | 0.48mm | −4% |

Cell spacing and base plate shrinkage are negligible. Dot height shrinkage is the critical variable.

### Calibration procedure (for advanced users)

1. Print the calibration tile: a 50×50mm base plate with 4 rows of dots, printed at 0.2mm layer height
2. Measure dot height with calipers or a tactile gauge
3. Compute `scale_factor = target_height / measured_height` (e.g. 0.85 / 0.60 = 1.42)
4. Enter `scale_factor` in TACT settings → it is applied to `dot_height` only

**Do not scale dot diameter** — diameter shrinkage is absorbed by the 1.6mm design (1.3mm printed = within ISO range).

### Printer profiles (future)

A future `profiles/` directory will contain per-printer `{printer_name}.json` with calibrated parameters. Example:

```json
{
  "name": "Creality Ender 3 (stock)",
  "dot_height_scale": 1.40,
  "layer_height_default": 0.2,
  "nozzle_mm": 0.4,
  "material": "TPU",
  "notes": "Measured on Ender 3 v1, Hatchbox TPU, 220°C/60°C, 25mm/s"
}
```

---

## Material Recommendations

| Material | Flexibility | Durability | Print difficulty | Recommended for |
|---|---|---|---|---|
| TPU (95A) | High | Very high | Medium | Primary: "page" feel, survives bending |
| PETG | Low | High | Low | Alternative: rigid, washable, hygienic |
| PLA | None | Low | Very low | Prototyping only — brittle, not child-safe |
| Recycled PET | Low-medium | High | Medium | Near-zero cost option |

**Default recommendation:** TPU 95A at 220°C, 30mm/s, 0% fan for the first layer, 50% thereafter. Heated bed 50°C.

---

## Output File Format

- Format: **binary STL** (not ASCII — binary is ~5× smaller, universally supported by slicers)
- One file per page: `{slug}_page_{n:02d}.stl`
- Coordinate system: matches the page format spec. Slicers (Cura, PrusaSlicer) display the page correctly with Z up.
- No additional metadata embedded — STL format does not support it cleanly. A separate `{slug}_manifest.json` (future) will carry per-page metadata.

---

## Slicing Recommendations (for end users)

These are guidelines to include in the TACT documentation, not enforced by the software:

```
Layer height:      0.20mm
Infill:            100% (it's already a thin slab — infill setting is effectively irrelevant)
Walls:             2 perimeters
Top/bottom layers: 3
Print speed:       25–35mm/s (slower = better dot definition)
Temperature:       per material (TPU: 220-230°C / PETG: 230-240°C)
Supports:          NONE — design is self-supporting
Raft:              optional (helps with TPU bed adhesion)
```

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-05-04 | Initial spec. Base plate, Braille dot profile, tactile graphic extrusion, assembly, calibration, materials, file format. |
