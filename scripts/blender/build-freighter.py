"""Builds 巨鯨號 (the freighter, a stylized Dutch fluyt) in Blender and exports it as a GLB.

Design: docs/art/freighter-concept.svg. Run headless (Blender 5.1+):
  npx tsx scripts/blender/dump-ship.ts freighter > /tmp/freighter.json
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/build-freighter.py -- /tmp/freighter.json public/models/ships/freighter.glb

What the GLB holds: the pear-bellied hull (tumblehome up to a narrow deck, a rounded tuck under a tall narrow stern),
its bands (grey bottom, white stripe, warm planking, gold wale, green upper strakes), cargo ports, a pointed beakhead,
the stern house with its arched, painted transom board, the planked deck and its cargo, and the rig's masts, yards and
ropes, rebuilt from the code design (the dump) so the code-drawn sails, pennant and lantern flame hang where they did.
The cargo boom and the crate it swings are separate meshes (`boom`, `crate`) about their own origins, which ShipModel
moves; the sails, pennant, lantern flame and the boom's rope are NOT in the GLB: ShipModel draws them.

Every part is shaded top to bottom with its palette swatch (src/ui/scene/buildings/materials.ts); then ambient
occlusion is baked into the vertex colours, so parts read as fitted together. Coordinates are ship space as in
src/ui-v07/scene/ships/hull.ts (three.js: y up, bow +z); `V` turns them into Blender's z-up space.
"""

import json
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :]
DUMP_PATH, OUT_PATH = ARGS[0], ARGS[1]
DUMP = json.load(open(DUMP_PATH))
SWATCHES = DUMP["swatches"]
RNG = random.Random(7)

DECK = 1.25
BOW_Z, STERN_Z, HALF_BEAM = 3.35, -3.0, 1.75
RAIL = 0.09  # bulwark thickness
AO_STRENGTH = 0.4
# How much of the baked AO each part takes, by name prefix (AO is per vertex: a big face tucked in at every corner
# would otherwise go dark all over).
AO_WEIGHTS = {"crate": 0.15, "plank": 0.5, "barrel": 0.6, "house": 0.6, "transom": 0.5}


def V(x, y, z):
    """Ship space (three.js, y up, bow +z) to Blender (z up); the glTF exporter maps it back."""
    return Vector((x, -z, y))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return [srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)]


# ---------------------------------------------------------------- mesh helpers

bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
PARTS = []  # (object, swatch name, brightness factor)


def finish(bm, name, mat, shade=1.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    SCENE.collection.objects.link(ob)
    PARTS.append((ob, mat, shade))
    return ob


def mesh_from(name, verts, faces, mat, shade=1.0, facing=None):
    """A mesh from ship-space points; `facing(centre)` gives the side an open surface's faces look toward (closed solids
    get their normals from bmesh)."""
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    if facing is None:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        bm.normal_update()
        for face in bm.faces:
            c = face.calc_center_median()
            if face.normal.dot(V(*facing((c.x, c.z, -c.y)))) < 0:
                face.normal_flip()
    return finish(bm, name, mat, shade)


def box(name, center, size, mat, bevel=0.02, shade=1.0, yaw=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c, s = math.cos(yaw), math.sin(yaw)
    for v in bm.verts:
        # Cube (x, y, z) -> ship (x, z, -y): a rotation, not a mirror, so the cube's faces keep looking outward. (Swapping
        # y and z mirrors it; recalc_face_normals after the bevel then only half fixes it, and the inward faces vanish
        # in the game: crates looked hollow.)
        x, y, z = v.co.x * size[0], v.co.z * size[1], -v.co.y * size[2]
        x, z = x * c + z * s, -x * s + z * c
        v.co = V(center[0] + x, center[1] + y, center[2] + z)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
    return finish(bm, name, mat, shade)


def beam(name, a, b, width, mat, sides=6, taper=1.0, shade=1.0):
    """A prism from a to b (ship space), `width` across, narrowing to `taper` × at b."""
    a, b = V(*a), V(*b)
    axis = b - a
    if axis.length < 1e-6:
        return None
    d = axis.normalized()
    helper = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(helper).normalized()
    w = d.cross(u)
    r = width / 2
    bm = bmesh.new()

    def ring(c, k):
        return [bm.verts.new(c + (u * math.cos(2 * math.pi * i / sides) + w * math.sin(2 * math.pi * i / sides)) * r * k) for i in range(sides)]

    lo, hi = ring(a, 1.0), ring(b, taper)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat, shade)


def slab(name, outline, z0, z1, mat, shade=1.0):
    """A flat plate: an outline of (x, y) points extruded along ship z from z0 to z1 (a board on a face)."""
    n = len(outline)
    verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def barrel(name, base, radius, height):
    sides = 10
    rings = [(0.0, 0.86), (0.25, 1.0), (0.75, 1.0), (1.0, 0.86)]
    verts, faces = [], []
    for t, k in rings:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((base[0] + math.cos(a) * radius * k, base[1] + t * height, base[2] + math.sin(a) * radius * k))
    for r in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append([r * sides + i, r * sides + j, (r + 1) * sides + j, (r + 1) * sides + i])
    faces.append(list(range(sides))[::-1])
    faces.append([(len(rings) - 1) * sides + i for i in range(sides)])
    mesh_from(name, verts, faces, "wood")
    for t in (0.2, 0.8):
        beam(name + "-hoop", (base[0], base[1] + t * height - 0.025, base[2]), (base[0], base[1] + t * height + 0.025, base[2]), radius * 2.04, "metal", sides=sides)


def torus(name, center, major, minor, mat, seg=12, sides=5):
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(sides):
            b = 2 * math.pi * j / sides
            r = major + minor * math.cos(b)
            verts.append((center[0] + r * math.cos(a), center[1] + minor * math.sin(b), center[2] + r * math.sin(a)))
    for i in range(seg):
        for j in range(sides):
            i2, j2 = (i + 1) % seg, (j + 1) % sides
            faces.append([i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2])
    return mesh_from(name, verts, faces, mat)


# ---------------------------------------------------------------- the hull

def half_beam(z):
    """Widest half beam at z (at the turn of the bilge): a full, blunt body, the bow and the stern tuck rounded."""
    k = min(1.0, z / BOW_Z) if z >= 0 else min(1.0, -z / 3.25)
    return HALF_BEAM * max(0.0, 1 - k ** 2.4) ** (1 / 2.4)


def sheer(z):
    """Top of the bulwark: low amidships, rising a little to the bow and more to the quarterdeck."""
    if z >= 0:
        return DECK + 0.28 + 0.3 * (z / BOW_Z) ** 2
    return DECK + 0.28 + 0.75 * (-z / -STERN_Z) ** 2.2


# Outer half-profile from keel to rail as (fraction of half beam, height): pear-shaped, widest near the waterline and
# drawn in (tumblehome) to a narrow deck. The last height is replaced by sheer(z).
PROFILE = [(0.0, 0.0), (0.4, 0.05), (0.72, 0.18), (0.92, 0.4), (1.0, 0.7), (0.97, 0.95), (0.88, 1.2), (0.8, None)]
# The swatch of each outer segment, keel up: grey bottom, warm planks, green upper strakes.
PAINT = DUMP.get("paint") or "leaf"  # designs.ts FREIGHTER_PAINT: upper strakes, stern house, transom frame
SEG_MATS = ["slate", "slate", "slate", "wood", "wood", PAINT, PAINT]
SEG_SHADES = [1.0, 0.92, 1.0, 0.92, 1.0, 0.92, 1.0]
STATIONS = [STERN_Z, -2.7, -2.2, -1.5, -0.7, 0.2, 1.0, 1.7, 2.3, 2.8, 3.1, 3.28]


def deck_half(z):
    """Half width of the deck inside the bulwark at z."""
    return half_beam(z) * PROFILE[-1][0] * 0.99 - RAIL


def section(z):
    b = half_beam(z)
    s = sheer(z)
    outer = [(k * b, s if y is None else y) for k, y in PROFILE]
    top = PROFILE[-1][0] * b
    inner = [(max(top * 0.99 - RAIL, 0.02), s), (max(top * 0.97 - RAIL, 0.02), DECK - 0.04)]
    return outer + inner


def build_hull():
    n = len(section(0))
    for side in (1, -1):
        verts, faces, mats = [], [], []
        for z in STATIONS:
            verts += [(side * x, y, z) for x, y in section(z)]
        # Stem: every row meets a raked line at the bow.
        stem = len(verts)
        for _, y in PROFILE:
            yy = sheer(BOW_Z) if y is None else y
            verts.append((0.0, yy, BOW_Z + 0.06 + 0.1 * yy))
        verts.append((0.0, sheer(BOW_Z), BOW_Z + 0.06 + 0.1 * sheer(BOW_Z) - RAIL))
        verts.append((0.0, DECK - 0.04, BOW_Z - 0.3))
        for si in range(len(STATIONS) - 1):
            for k in range(n - 1):
                a, b = si * n + k, (si + 1) * n + k
                faces.append([a, a + 1, b + 1, b])
                mats.append(k)
        last = (len(STATIONS) - 1) * n
        for k in range(n - 1):
            faces.append([last + k, last + k + 1, stem + k + 1, stem + k])
            mats.append(k)
        # The stern tuck: the stern station closed toward the centre line.
        low, high = len(verts), len(verts) + 1
        verts += [(0.0, 0.0, STERN_Z), (0.0, DECK - 0.04, STERN_Z)]
        faces.append([low] + list(range(n)) + [high])
        mats.append(-1)
        outer = lambda c, s=side: (s * abs(c[0]) + 1e-3 * s, c[1] - 0.6, 0.0)
        kinds = {"transom": lambda c: (0.0, 0.0, -1.0), "cap": lambda c: (0.0, 1.0, 0.0), "inner": lambda c, s=side: (-s, 0.0, 0.0)}
        bands = {}
        for f, m in zip(faces, mats):
            if m == -1:
                key = ("woodDark", "transom", 1.0)
            elif m < len(SEG_MATS):
                key = (SEG_MATS[m], f"outer{m}", SEG_SHADES[m])
            elif m == len(SEG_MATS):
                key = ("woodDark", "cap", 1.0)
            else:
                key = ("wood", "inner", 0.9)
            bands.setdefault(key, []).append(f)
        for (mat, kind, shade), fs in bands.items():
            used = sorted({i for f in fs for i in f})
            remap = {i: j for j, i in enumerate(used)}
            mesh_from(f"hull-{kind}-{side}", [verts[i] for i in used], [[remap[i] for i in f] for f in fs], mat, shade=shade, facing=kinds.get(kind, outer))
    outline = [(deck_half(z), z) for z in STATIONS]
    pts = [(x, DECK - 0.05, z) for x, z in outline] + [(-x, DECK - 0.05, z) for x, z in reversed(outline)]
    mesh_from("deck-floor", pts, [list(range(len(pts)))], "woodDark", facing=lambda c: (0.0, 1.0, 0.0))


def hull_point(z, y, side):
    """A point on the outer skin at (z, y) on `side`, and its outward normal in the x-y plane."""
    b = half_beam(z)
    pts = [(k * b, yy if yy is not None else sheer(z)) for k, yy in PROFILE]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0) if y1 > y0 else 0
            x = x0 + (x1 - x0) * t
            nx, ny = (y1 - y0), -(x1 - x0)
            ln = math.hypot(nx, ny) or 1
            return (side * x, y, z), (side * nx / ln, ny / ln)
    return (side * b, y, z), (side, 0.0)


def build_strakes():
    """A gold wale between planks and green strakes, and a white stripe at the waterline, standing a little proud."""
    for side in (1, -1):
        for name, y, h, mat, proud in (("wale", 0.95, 0.1, "gold", 0.04), ("stripe", 0.46, 0.07, "marble", 0.016)):
            zs = [STERN_Z + 0.02] + STATIONS[1:-2]
            verts, faces = [], []
            for z in zs:
                for dy, out in ((-h / 2, proud), (h / 2, proud), (h / 2, 0.0), (-h / 2, 0.0)):
                    p, nrm = hull_point(z, y + dy, side)
                    verts.append((p[0] + nrm[0] * (out + 0.005), p[1], p[2]))
            for i in range(len(zs) - 1):
                for k in range(4):
                    a, b = i * 4 + k, i * 4 + (k + 1) % 4
                    faces.append([a, b, b + 4, a + 4])
            faces.append([3, 2, 1, 0])
            last = (len(zs) - 1) * 4
            faces.append([last, last + 1, last + 2, last + 3])
            mesh_from(f"{name}-{side}", verts, faces, mat)


def build_ports():
    """A merchant's row of square cargo ports with gold rims (no guns)."""
    for side in (1, -1):
        for z in (-1.4, -0.5, 0.4, 1.3):
            p, n = hull_point(z, 0.8, side)
            box(f"port-rim-{side}-{z}", (p[0] + n[0] * 0.012, 0.8, z), (0.05, 0.25, 0.27), "gold", bevel=0.01)
            box(f"port-{side}-{z}", (p[0] + n[0] * 0.03, 0.8, z), (0.05, 0.18, 0.2), "dark", bevel=0.008)


def build_beakhead():
    """A plain pointed knee under the bowsprit, gold-trimmed."""
    tip = (0.0, 1.48, BOW_Z + 0.72)
    top_back, low_back = 1.68, 0.95
    verts = [(0.12, top_back, BOW_Z + 0.12), (-0.12, top_back, BOW_Z + 0.12), (0.12, low_back, BOW_Z + 0.14), (-0.12, low_back, BOW_Z + 0.14), tip]
    mesh_from("beakhead", verts, [[0, 1, 3, 2], [0, 4, 1], [2, 3, 4], [0, 2, 4], [1, 4, 3]], "woodDark")
    for side in (1, -1):
        beam(f"beak-trim-{side}", (side * 0.125, top_back - 0.06, BOW_Z + 0.14), (side * 0.01, tip[1] + 0.02, tip[2] - 0.04), 0.045, "gold", sides=4)


# ---------------------------------------------------------------- the stern house and its painted transom board

HOUSE_FRONT, HOUSE_BACK = -2.15, -3.08
HOUSE_TOP = 3.3
HOUSE_BAND = 2.35
HOUSE_LO, HOUSE_HI = 0.66, 0.5


def house_half(y):
    """Half width of the stern house at height y: it narrows upward, the fluyt's narrow upper stern."""
    return HOUSE_LO - (HOUSE_LO - HOUSE_HI) * (y - DECK) / (HOUSE_TOP - DECK)


def house_block(name, y0, y1, mat):
    a, b = house_half(y0), house_half(y1)
    verts = [(a, y0, HOUSE_FRONT), (-a, y0, HOUSE_FRONT), (-a, y0, HOUSE_BACK), (a, y0, HOUSE_BACK),
             (b, y1, HOUSE_FRONT), (-b, y1, HOUSE_FRONT), (-b, y1, HOUSE_BACK), (b, y1, HOUSE_BACK)]
    mesh_from(name, verts, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], mat)


def build_stern_house():
    # Warm planks below the rail line, painted green above it (the transom board's colour), a gold band between.
    house_block("house-low", DECK, HOUSE_BAND, "wood")
    house_block("house-high", HOUSE_BAND, HOUSE_TOP, PAINT)
    mid_z = (HOUSE_FRONT + HOUSE_BACK) / 2
    depth = HOUSE_FRONT - HOUSE_BACK
    box("house-band", (0, HOUSE_BAND, mid_z), (house_half(HOUSE_BAND) * 2 + 0.06, 0.09, depth + 0.06), "gold", bevel=0.01)
    for x0, x1 in ((HOUSE_LO, HOUSE_HI), (-HOUSE_LO, -HOUSE_HI)):
        for z in (HOUSE_FRONT + 0.03, HOUSE_BACK - 0.03):
            beam("house-post", (x0 * 1.03, DECK, z), (x1 * 1.03, HOUSE_TOP, z), 0.09, "woodDark", sides=4)
    # Roof slab with an overhang and a little balustrade round it.
    roof_y = HOUSE_TOP + 0.04
    # Its underside sits a little inside the house, never flush with the house's top (flush faces flicker).
    box("house-roof", (0, roof_y + 0.005, mid_z - 0.02), (HOUSE_HI * 2 + 0.2, 0.1, depth + 0.14), "woodDark", bevel=0.02)
    rx, rz0, rz1 = HOUSE_HI + 0.05, HOUSE_FRONT + 0.02, HOUSE_BACK - 0.02
    rail_y = roof_y + 0.24
    for x in (rx, -rx):
        for z in (rz0, (rz0 + rz1) / 2, rz1):
            beam("house-baluster", (x, roof_y + 0.04, z), (x, rail_y, z), 0.05, "woodDark", sides=4)
        beam("house-rail", (x, rail_y, rz0), (x, rail_y, rz1), 0.06, "woodDark", sides=4)
    beam("house-rail", (rx, rail_y, rz0), (-rx, rail_y, rz0), 0.06, "woodDark", sides=4)
    # Gold-framed windows on both sides of the green upper storey, and a door toward the bow below.
    for side in (1, -1):
        for z in (-2.42, -2.82):
            x = side * (house_half(2.82) + 0.012)
            box("house-window-frame", (x, 2.82, z), (0.04, 0.32, 0.26), "gold", bevel=0.008)
            box("house-window", (x + side * 0.012, 2.82, z), (0.04, 0.24, 0.18), "dark", bevel=0.006)
    box("house-door", (0, DECK + 0.4, HOUSE_FRONT + 0.02), (0.36, 0.72, 0.05), "woodDark", bevel=0.01)
    box("house-lintel", (0, DECK + 0.8, HOUSE_FRONT + 0.03), (0.46, 0.06, 0.06), "gold", bevel=0.008)
    for x in (-0.3, 0.3):
        box("house-window-front", (x, 2.82, HOUSE_FRONT + 0.03), (0.2, 0.26, 0.04), "dark", bevel=0.006)


def arch(half, bottom, shoulder, top, steps=6):
    """An upright board's outline: straight sides up to `shoulder`, then a round arch peaking at `top`."""
    pts = [(-half, bottom), (half, bottom), (half, shoulder)]
    for i in range(1, steps):
        a = math.pi * i / steps
        pts.append((half * math.cos(a), shoulder + (top - shoulder) * math.sin(a)))
    pts.append((-half, shoulder))
    return pts


def build_transom():
    """The fluyt's tall, narrow, painted transom board: a green arched frame, a cream panel, a whale's tail on it."""
    z = HOUSE_BACK - 0.02
    slab("transom-frame", arch(0.58, 2.05, 3.3, 3.85), z, z - 0.06, PAINT)
    slab("transom-panel", arch(0.44, 2.2, 3.3, 3.7), z - 0.06, z - 0.1, "canvas")
    # The whale's flukes, painted (two thin convex plates on the panel).
    left = [(0.0, 2.55), (0.0, 3.02), (-0.12, 3.12), (-0.3, 3.18), (-0.33, 3.08), (-0.18, 3.0), (-0.06, 2.85)]
    right = [(-x, y) for x, y in reversed(left)]
    slab("transom-fluke-l", left, z - 0.1, z - 0.12, "slate")
    slab("transom-fluke-r", right, z - 0.1, z - 0.12, "slate")
    # Gold scrollwork: a band at the foot and a knob on the top.
    box("transom-band", (0, 2.05, z - 0.06), (1.22, 0.1, 0.1), "gold", bevel=0.015)
    beam("transom-knob", (0, 3.82, z - 0.03), (0, 3.98, z - 0.03), 0.14, "gold", sides=8, taper=0.4)
    # Rudder on the stern post below.
    box("rudder", (0, 0.75, STERN_Z - 0.12), (0.1, 1.2, 0.36), "woodDark", bevel=0.02)
    for y in (0.35, 0.75, 1.15):
        box("rudder-band", (0, y, STERN_Z - 0.12), (0.13, 0.05, 0.38), "metal", bevel=0.008)


# ---------------------------------------------------------------- the deck and its cargo

def build_planks():
    width, gap = 0.2, 0.012
    x = -1.5
    i = 0
    while x < 1.5:
        cx = x + width / 2
        reach = abs(cx) + width / 2
        zs = [z for z in [k * 0.05 for k in range(-62, 70)] if deck_half(z) > reach]
        if zs:
            zmin, zmax = max(min(zs), HOUSE_FRONT + 0.02), max(zs)
            if zmax - zmin > 0.3:
                joints = [zmin] + [j for j in (-1.2 + (i % 3) * 0.9, 1.1 + (i % 2) * 0.8) if zmin + 0.4 < j < zmax - 0.4] + [zmax]
                for a, b in zip(joints, joints[1:]):
                    box(f"plank-{i}-{a:.1f}", (cx, DECK - 0.02, (a + b) / 2), (width - gap, 0.04, b - a - gap), "deck", bevel=0.006, shade=RNG.uniform(0.9, 1.06))
        x += width
        i += 1


def crate(name, c, size=(0.46, 0.44, 0.5), yaw=0.0):
    """A crate: light boards in a slightly darker frame, a rope lashing round it."""
    box(name, c, size, "wood", bevel=0.02, shade=RNG.uniform(1.0, 1.08), yaw=yaw)
    sx, sy, sz = size
    t = 0.045
    cy, sn = math.cos(yaw), math.sin(yaw)
    rot = lambda dx, dz: (c[0] + dx * cy + dz * sn, c[2] - dx * sn + dz * cy)
    for dx in (-1, 1):
        for dz in (-1, 1):
            x, z = rot(dx * (sx / 2 - t / 2 + 0.008), dz * (sz / 2 - t / 2 + 0.008))
            box(name + "-post", (x, c[1], z), (t, sy + 0.012, t), "wood", bevel=0.01, shade=0.8, yaw=yaw)
    box(name + "-rope", (c[0], c[1] + 0.02, c[2]), (sx + 0.03, 0.04, sz + 0.03), "rope", bevel=0.01, yaw=yaw)


def build_cargo():
    # Aft of the mainmast, both sides; the centre line stays clear for the cargo the invest step loads, and the deck
    # spots either side of the cargo boom (x = ±0.83, z = 0.97) stay clear for the crate it swings.
    bottom = DECK + 0.22
    for z in (-0.45, -1.1):
        for x in (0.7, -0.7):
            crate(f"crate-{x}-{z}", (x, bottom, z), yaw=RNG.uniform(-0.06, 0.06))
    crate("crate-top", (0.7, bottom + 0.45, -0.78), size=(0.42, 0.4, 0.46), yaw=0.12)
    barrel("barrel-a", (0.45, DECK, 2.65), 0.17, 0.38)
    barrel("barrel-b", (-0.45, DECK, 2.65), 0.17, 0.38)
    torus("coil-a", (-0.6, DECK + 0.04, -1.75), 0.15, 0.04, "rope")
    torus("coil-b", (-0.6, DECK + 0.1, -1.75), 0.11, 0.036, "rope")
    box("sack", (0.55, DECK + 0.11, -1.8), (0.3, 0.22, 0.26), "canvas", bevel=0.07, yaw=0.3)
    # A capstan before the stern house.
    beam("capstan", (0, DECK, -1.95), (0, DECK + 0.4, -1.95), 0.3, "woodDark", sides=8, taper=0.85)
    beam("capstan-cap", (0, DECK + 0.4, -1.95), (0, DECK + 0.47, -1.95), 0.36, "woodDark", sides=8)


# ---------------------------------------------------------------- the cargo boom (moving parts, exported on their own)

def build_boom():
    """The boom and the crate it swings, built where they stand at rest (boom pointing aft, crate on the deck), so they
    take AO from the ship; `main` moves them so the boom's heel and the crate's centre are their origins."""
    m = DUMP["motion"]
    hx, hy, hz = m["heel"]
    tip = (hx, hy + m["rise"], hz - m["reach"])
    beam("boom-spar", (hx, hy, hz), tip, 0.12, "woodDark", sides=6, taper=0.75)
    beam("boom-heel", (hx, hy - 0.06, hz), (hx, hy + 0.1, hz), 0.26, "woodDark", sides=8)
    for t in (0.35, 0.7):
        a = (hx, hy + m["rise"] * t, hz - m["reach"] * t)
        beam("boom-band", (a[0], a[1] - 0.03, a[2] + 0.02), (a[0], a[1] + 0.03, a[2] - 0.02), 0.15, "metal", sides=6)
    box("boom-block", tip, (0.14, 0.16, 0.14), "metal", bevel=0.02)
    return (hx, hy, hz)


CRATE_SIZE = (0.46, 0.44, 0.48)


def build_swung_crate():
    """The crate the boom swings, at rest on the deck beside it; its centre becomes its origin."""
    m = DUMP["motion"]
    hx, hy, hz = m["heel"]
    a = m["swing"]
    at = (hx - m["reach"] * math.sin(a), DECK + CRATE_SIZE[1] / 2, hz - m["reach"] * math.cos(a))
    crate("crate-swung", at, size=CRATE_SIZE)
    return at


# ---------------------------------------------------------------- the rig from the code design

def build_rig():
    for i, p in enumerate(DUMP["parts"]):
        if p["kind"] == "beam":
            a, b = p["from"], p["to"]
            if p["mat"] == "woodDark" and max(a[1], b[1]) <= DECK + 0.3:
                continue  # the fallback hull's rail posts and rails: the solid bulwark replaces them
            vertical = abs(a[0] - b[0]) < 1e-6 and abs(a[2] - b[2]) < 1e-6
            if vertical and p["width"] >= 0.12 and a[1] <= DECK + 0.01:
                # A mast: octagonal, tapering, with iron bands and a step at its foot.
                beam(f"mast-{i}", a, b, p["width"] * 1.1, "woodDark", sides=8, taper=0.65)
                for t in (0.3, 0.55, 0.8):
                    y = a[1] + (b[1] - a[1]) * t
                    w = p["width"] * 1.1 * (1 - 0.35 * t) + 0.04
                    beam(f"mast-band-{i}", (a[0], y - 0.03, a[2]), (a[0], y + 0.03, a[2]), w, "metal", sides=8)
                beam(f"mast-step-{i}", (a[0], DECK, a[2]), (a[0], DECK + 0.1, a[2]), p["width"] * 2.0, "woodDark", sides=8)
                continue
            beam(f"rig-{i}", a, b, p["width"], p["mat"], sides=4 if p["mat"] == "rope" else p.get("sides", 6))
        elif p["kind"] in ("box", "prism") and p["mat"] == "metal":
            # The lantern's iron frame (base plate and cap).
            if p["kind"] == "box":
                box(f"lamp-{i}", p["center"], p["size"], p["mat"], bevel=p.get("bevel", 0.01))
            else:
                beam(f"lamp-cap-{i}", p["base"], (p["base"][0], p["base"][1] + p["height"], p["base"][2]), p["radius"] * 2, p["mat"], sides=4, taper=0.05)


# Parts the centre test does not apply to: open surfaces oriented by `facing`, and shapes that are not convex (a rope
# coil's inner faces rightly look toward its centre; the painted flukes' outline is concave).
OPEN_PARTS = ("hull-", "deck-floor", "wale-", "stripe-", "beakhead", "coil-", "transom-fluke")


def check_normals():
    """Every convex part's faces must look away from its centre; an inward face is culled in the game (a see-through crate)."""
    bad = []
    for ob, _, _ in PARTS:
        if ob.name.startswith(OPEN_PARTS):
            continue
        me = ob.data
        centre = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
        inward = sum(1 for p in me.polygons if p.normal.dot(p.center - centre) < -1e-6)
        if inward:
            bad.append(f"{ob.name}: {inward}/{len(me.polygons)}")
    if bad:
        # Fail the build: a model with inward faces shows holes in the game and must not be exported.
        print("INWARD FACES", len(bad), "parts:", "; ".join(bad[:12]))
        sys.exit(1)
    print("NORMALS OK")


# ---------------------------------------------------------------- colour, ambient occlusion, export

def colour_parts():
    for ob, mat, shade in PARTS:
        me = ob.data
        sw = SWATCHES[mat]
        top, bottom = hex_rgb(sw["top"]), hex_rgb(sw["bottom"])
        zs = [v.co.z for v in me.vertices]
        lo, hi = min(zs), max(zs)
        weight = next((w for prefix, w in AO_WEIGHTS.items() if ob.name.startswith(prefix)), 1.0)
        attr = me.color_attributes.new("base", "FLOAT_COLOR", "CORNER")
        for loop in me.loops:
            z = me.vertices[loop.vertex_index].co.z
            t = (z - lo) / (hi - lo) if hi > lo else 1.0
            c = [(b + (a - b) * t) * shade for a, b in zip(top, bottom)]
            attr.data[loop.index].color = (*c, weight)  # alpha carries the AO weight until the bake


def join_parts(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    obs = [ob for ob, _, _ in parts]
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


def bake_ao(ship):
    SCENE.render.engine = "CYCLES"
    SCENE.cycles.device = "CPU"
    SCENE.cycles.samples = 128
    SCENE.world = bpy.data.worlds.new("world")
    SCENE.world.light_settings.distance = 0.7
    me = ship.data
    me.color_attributes.active_color = me.color_attributes.new("ao", "FLOAT_COLOR", "CORNER")
    me.materials.clear()
    me.materials.append(bpy.data.materials.new("bake"))
    bpy.ops.object.select_all(action="DESELECT")
    ship.select_set(True)
    bpy.context.view_layer.objects.active = ship
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    base, ao = me.color_attributes["base"], me.color_attributes["ao"]
    out = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for i in range(len(me.loops)):
        c = base.data[i].color
        k = 1 - AO_STRENGTH * c[3] * (1 - ao.data[i].color[0])
        out.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    for name in ("base", "ao"):
        me.color_attributes.remove(me.color_attributes[name])
    me.color_attributes.active_color = me.color_attributes["Col"]
    me.color_attributes.render_color_index = 0


def export(obs):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        for poly in ob.data.polygons:
            poly.use_smooth = False
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)


build_hull()
build_strakes()
build_ports()
build_beakhead()
build_stern_house()
build_transom()
build_planks()
build_cargo()
build_rig()
ship_parts = len(PARTS)
heel = build_boom()
boom_parts = len(PARTS)
crate_at = build_swung_crate()
check_normals()
colour_parts()
ship = join_parts(PARTS[:ship_parts], "freighter")
boom = join_parts(PARTS[ship_parts:boom_parts], "boom")
swung = join_parts(PARTS[boom_parts:], "crate")
# The ship bakes without the boom and its crate (they move, so their shadow must not be painted on the deck); the
# moving parts bake with the ship around them.
for ob in (boom, swung):
    ob.hide_render = True
bake_ao(ship)
for ob in (boom, swung):
    ob.hide_render = False
bake_ao(boom)
bake_ao(swung)
for ob, origin in ((boom, heel), (swung, crate_at)):
    o = V(*origin)
    for v in ob.data.vertices:
        v.co -= o
export([ship, boom, swung])
for ob in (ship, boom, swung):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"EXPORTED {OUT_PATH} {ob.name}: {len(ob.data.polygons)} faces, ~{tris} triangles")
