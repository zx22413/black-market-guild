"""Blockout of 海嘯號 (the breaker, restyled as a 17th-century war galley) and the renders for its design sheet.

Design stage (lowpoly-model skill step 1, blender-model skill step 0), like blockout-standard.py: a long, low lofted hull
in ship space (three.js: y up, bow +z, keel at y = 0, DECK = 1.25), a big bronze ram at the waterline, two banks of oars
(the upper bank pivoting on an outrigger frame, the lower one through framed ports in the hull), a high curled stern
under a green-and-gold canopied command deck, and one small square sail with a teal wave roundel. The oars, the sail and
the pennant are drawn by code in the game (the oars row); here they are still stand-ins so the views read.
Shared helpers, colour and renders: blockout_kit.py.

Run headless (Blender 5.1+):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/blockout-breaker.py -- <out dir> [red]
The paint is green and gold (decided 2026-11-07, to keep clear of 孤注號's red); `red` renders the first sheet's red.
build-breaker.py imports this file for the hull, the ram, the stern, the oar mounts and the rig's details.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403

RED = sys.argv[sys.argv.index("--") + 2:] == ["red"]
# The main paint (hull sides, canopy stripes): green (decided 2026-11-07), or the first sheet's red for comparison.
PAINT = "roofRed" if RED else "leaf"

HALF_BEAM = 1.0
Z_AFT, Z_FWD = -3.0, 3.0  # hull ends at the rail
RAIL = 0.12
MAST_Z = 0.3
MAST_TOP = 4.95
YARD_Y = 4.5
YARD_HALF = 1.6
SAIL_TOP, SAIL_BOTTOM = 4.42, 2.85
SAIL_BELLY = 0.45

# Oars: berth rule (tests/ui-v07/shipDesigns.test.ts): lock x + 2.3 < BERTH_GAP - 1.75; blades dip at DRAFT.
OAR_LENGTH = 2.3
OUTRIGGER_X, OUTRIGGER_Y = 1.45, DECK + 0.2  # the upper bank's thole rail, outboard of the hull
UPPER_ZS = [-1.75, -0.95, -0.15, 0.65, 1.4]
LOWER_ZS = [-1.35, -0.55, 0.25, 1.02]
PORT_Y = 0.98  # the lower bank's oar ports


# ---------------------------------------------------------------- the hull: long, low and fine

def u_of(z):
    return (z - (Z_FWD + Z_AFT) / 2) / ((Z_FWD - Z_AFT) / 2)


def width_k(z):
    """A long parallel middle body, fining to a sharp cutwater at the bow and a narrower stern."""
    u = u_of(z)
    p = 2.2 if u > 0 else 3.2
    return max(0.04, (1 - min(1.0, abs(u)) ** p) ** 0.5)


def keel_y(z):
    """The bottom sweeps up gently at the bow to the ram, and higher at the stern into the curl."""
    u = u_of(z)
    if u > 0:
        return 0.42 * max(0.0, (u - 0.55) / 0.45) ** 1.5
    return 1.15 * max(0.0, (-u - 0.6) / 0.4) ** 1.6


def sheer(z):
    """Low and nearly flat: rising a little to the bow platform and to the command deck aft."""
    u = u_of(z)
    return DECK + 0.22 + (0.32 if u > 0 else 0.38) * abs(u) ** 3


PROFILE = [(0.0, 0.0), (0.45, 0.05), (0.78, 0.18), (0.95, 0.4), (1.0, 0.7), (1.0, 1.0)]
COLUMNS = [Z_AFT + (Z_FWD - Z_AFT) * i / 28 for i in range(29)]


BAND_YS = (DRAFT, 1.08)  # where the hull's colour bands meet: rows of the loft, so each band edge is one straight line


def outer(z):
    b, y0, r = HALF_BEAM * width_k(z), keel_y(z), sheer(z)
    pts = [(k * b, y0 + t * (r - y0)) for k, t in PROFILE]
    for i, yb in enumerate(BAND_YS):
        y = min(max(yb, y0 + 0.002 * (i + 1)), r - 0.002 * (len(BAND_YS) - i))
        for (x0, ya), (x1, yc) in zip(pts, pts[1:]):
            if ya <= y <= yc:
                x = x0 + (x1 - x0) * ((y - ya) / (yc - ya) if yc > ya else 0)
                break
        pts.append((x, y))
    return sorted(pts, key=lambda p: p[1])


def outer_x(z, y):
    pts = outer(z)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 > y0 else 0)
    return pts[-1][0]


def hull_rail_x(z):
    return outer(z)[-1][0]


def build_hull():
    loops = []
    for z in COLUMNS:
        o = outer(z)
        xt = max(o[-1][0] - RAIL, 0.02)
        xd = max(outer_x(z, DECK) - RAIL, 0.02) if keel_y(z) < DECK - 0.05 else 0.02
        star = [(x, y) for x, y in o[1:]] + [(xt, o[-1][1]), (xd, DECK)]
        loop = [(0.0, o[0][1])] + star + [(-x, y) for x, y in reversed(star)]
        loops.append([(x, y, z) for x, y in loop])
    n = len(loops[0])
    verts = [p for loop in loops for p in loop]
    faces = []
    for c in range(len(loops) - 1):
        for k in range(n):
            a, b = c * n + k, c * n + (k + 1) % n
            faces.append([a, b, b + n, a + n])
    faces.append(list(range(n)))
    last = (len(loops) - 1) * n
    faces.append(list(range(last, last + n)))
    ob = mesh_from("hull", verts, faces, PAINT)
    ob["banded"] = True


def hull_band(center_y, normal_up):
    """Grey bottom, painted sides in alternating planks, a dark bulwark, a light deck."""
    if normal_up > 0.85 and abs(center_y - DECK) < 0.05:
        return "deck", 1.0
    if center_y < DRAFT:
        return "slate", 1.0
    if center_y < BAND_YS[1]:
        return PAINT, 0.9 if int(center_y / 0.14) % 2 else 1.0
    return "woodDark", 1.0


def strip(name, y, h, proud, mat, z0, z1, shade=1.0):
    """A band following the skin at height y on both sides, standing `proud` of it (wale, stripe)."""
    zs = [z0] + [z for z in COLUMNS if z0 < z < z1] + [z1]
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            for dy, out in ((-h / 2, proud), (h / 2, proud), (h / 2, -0.03), (-h / 2, -0.03)):
                verts.append((side * (outer_x(z, y + dy) + out), y + dy, z))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"{name}-{side}", verts, faces, mat, shade)


def stem_z(y):
    """z of the bow's cutwater at height y (where the bottom sweep reaches that height)."""
    for z in reversed(COLUMNS):
        if keel_y(z) <= y:
            return z
    return COLUMNS[0]


def stern_z(y):
    for z in COLUMNS:
        if keel_y(z) <= y:
            return z
    return COLUMNS[-1]


def build_trim():
    # A dark boot-top line where the grey bottom meets the paint, a gold wale where the paint meets the dark bulwark.
    strip("boot-top", DRAFT + 0.02, 0.07, 0.05, "woodDark", stern_z(0.6) + 0.08, stem_z(0.55) - 0.12, shade=0.85)
    strip("wale", 1.08, 0.12, 0.09, "gold", stern_z(1.1) + 0.05, Z_FWD - 0.03)
    # Cap rail: gold on the dark bulwark, overhanging in and out, ending in the bow post and under the command deck.
    zs = [z for z in COLUMNS if -2.0 <= z <= Z_FWD - 0.1]
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            xo = hull_rail_x(z)
            s = sheer(z)
            xi = max(xo - RAIL - 0.08, 0.03)
            for x, y in ((xo + 0.09, s - 0.03), (xo + 0.09, s + 0.12), (xi, s + 0.12), (xi, s - 0.03)):
                verts.append((side * x, y, z))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"cap-rail-{side}", verts, faces, "gold")


# ---------------------------------------------------------------- the ram and the bow post

def build_bow():
    # Cutwater: a dark timber down the bow's leading edge from the post to the ram's bed.
    beam("cutwater", (0, 0.42, stem_z(0.45) + 0.06), (0, sheer(Z_FWD) + 0.02, Z_FWD + 0.06), 0.22, "woodDark", sides=4)
    # Ram bed: a dark wedge that carries the bronze forward of the cutwater, so the ram grows out of the hull.
    zb = stem_z(0.45)
    beam("ram-bed", (0, 0.5, zb - 0.6), (0, 0.5, zb + 0.35), 0.5, "woodDark", sides=4, taper=0.8, shade=0.85)
    # The ram: a long bronze beak at the waterline, a slim gold collar where it leaves the bed, three blades at the tip.
    beam("ram", (0, 0.5, zb + 0.25), (0, 0.48, 4.45), 0.6, "brass", sides=4, taper=0.6)
    # A slim gold band (it was 0.78 across and 0.24 long, and stole the show in close-ups).
    beam("ram-collar", (0, 0.5, zb + 0.24), (0, 0.5, zb + 0.36), 0.68, "gold", sides=8)
    beam("ram-band", (0, 0.49, 3.78), (0, 0.49, 3.92), 0.5, "gold", sides=8)
    for nm, tip in (("s", (0.5, 0.48, 4.42)), ("p", (-0.5, 0.48, 4.42)), ("u", (0, 0.98, 4.42))):
        beam(f"ram-blade-{nm}", (0, 0.49, 3.85), tip, 0.2, "brass", sides=4, taper=0.45)
    # Bow post: sweeping up and forward from the stem head, a gold scroll at its top.
    y0 = sheer(Z_FWD)
    post = [(Z_FWD + 0.04, y0 - 0.1), (Z_FWD + 0.3, y0 + 0.45), (Z_FWD + 0.45, y0 + 0.95), (Z_FWD + 0.3, y0 + 1.25)]
    for i, ((z0, ya), (z1, yb)) in enumerate(zip(post, post[1:])):
        beam(f"bow-post-{i}", (0, ya, z0), (0, yb, z1), 0.22 - 0.03 * i, "woodDark", sides=6)
        if i:
            beam(f"bow-post-band-{i}", (0, ya - 0.05, z0), (0, ya + 0.05, z0), 0.3 - 0.03 * i, "gold", sides=6)
    prism("bow-scroll", (0, post[-1][1] - 0.05, post[-1][0]), 0.13, 0.16, "gold", sides=8)
    # Bow platform: a raised fighting deck over the bow, gold-railed.
    plan = [(0.72, 1.85), (0.62, 2.55), (0.3, 2.95), (-0.3, 2.95), (-0.62, 2.55), (-0.72, 1.85)]
    plan_solid("bow-deck", plan, DECK + 0.18, DECK + 0.32, "deck")
    plan_ring("bow-deck-edge", offset(plan, 0.06), offset(plan, -0.06), DECK + 0.14, DECK + 0.34, "woodDark")
    for i, (x, z) in enumerate(plan):
        box(f"bow-rail-post-{i}", (x, DECK + 0.55, z), (0.1, 0.42, 0.1), "woodDark", bevel=0.02)
    for i in range(len(plan) - 1):
        (x0, z0), (x1, z1) = plan[i], plan[i + 1]
        beam(f"bow-rail-{i}", (x0, DECK + 0.78, z0), (x1, DECK + 0.78, z1), 0.09, "gold", sides=4)
    for i, (x, z) in enumerate(plan[:1] + plan[-1:]):
        beam(f"bow-deck-leg-{i}", (x * 0.9, DECK, z + 0.05), (x * 0.9, DECK + 0.18, z + 0.05), 0.12, "woodDark", sides=4)


# ---------------------------------------------------------------- the curled stern and the canopied command deck

def build_stern():
    # The stern post continues the bottom's sweep up and curls forward over the canopy: a scorpion's tail.
    y = keel_y(Z_AFT + 0.05)
    curl = [(stern_z(0.3) - 0.05, 0.3), (Z_AFT - 0.15, y + 0.2), (Z_AFT - 0.5, sheer(Z_AFT) + 0.3), (Z_AFT - 0.62, 2.55),
            (Z_AFT - 0.5, 3.15), (Z_AFT - 0.18, 3.45), (Z_AFT + 0.12, 3.4)]
    for i, ((z0, ya), (z1, yb)) in enumerate(zip(curl, curl[1:])):
        w = 0.3 - 0.025 * i
        beam(f"stern-curl-{i}", (0, ya, z0), (0, yb, z1), w, "woodDark", sides=6)
        if i >= 1:  # a gold knuckle at every joint of the curl
            prism(f"stern-curl-knuckle-{i}", (0, ya - 0.08, z0), w * 0.62, 0.16, "gold", sides=8)
    prism("stern-scroll", (0, curl[-1][1] - 0.08, curl[-1][0]), 0.13, 0.16, "gold", sides=8)
    # Command deck: a raised platform over the stern, dark-edged, a gold balustrade, and the canopy.
    plan = [(0.95, -1.85), (0.9, -2.6), (0.62, -3.05), (-0.62, -3.05), (-0.9, -2.6), (-0.95, -1.85)]
    top = DECK + 0.38
    plan_solid("poop-deck", plan, DECK - 0.05, top, "deck")
    plan_ring("poop-edge", offset(plan, 0.07), offset(plan, -0.05), top - 0.16, top + 0.04, "woodDark")
    framed_opening("poop-door", (0, DECK + 0.18, -1.81), (0.36, 0.26), False)
    # Canopy on four posts: a barrel roof in stripes of the paint and gold, gold eaves and ridge, gold post caps.
    x0, za, zb, ye, yr = 0.78, -1.98, -2.92, top + 1.0, top + 1.42
    for sx in (1, -1):
        for z in (za, zb):
            beam(f"canopy-post-{sx}-{z:.2f}", (sx * x0, top, z), (sx * x0, ye, z), 0.13, "woodDark", sides=4)
            prism(f"canopy-post-cap-{sx}-{z:.2f}", (sx * x0, top, z), 0.11, 0.08, "gold", sides=4)
    arc = [(math.cos(math.pi * i / 6) * (x0 + 0.08), ye + math.sin(math.pi * i / 6) * (yr - ye)) for i in range(7)]
    for i, ((xa, ya), (xb, yb)) in enumerate(zip(arc, arc[1:])):
        mat = PAINT if i % 2 == 0 else "gold"
        verts = [(xa, ya, za + 0.12), (xb, yb, za + 0.12), (xb, yb, zb - 0.12), (xa, ya, zb - 0.12)]
        verts += [(x * 0.92, y - 0.06, z) for x, y, z in verts]
        mesh_from(f"canopy-{i}", verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], mat)
    for z in (za + 0.12, zb - 0.12):
        for i, ((xa, ya), (xb, yb)) in enumerate(zip(arc, arc[1:])):
            beam(f"canopy-rib-{z:.2f}-{i}", (xa, ya, z), (xb, yb, z), 0.1, "woodDark", sides=4)
    for sx in (1, -1):
        beam(f"canopy-eave-{sx}", (sx * (x0 + 0.08), ye, za + 0.18), (sx * (x0 + 0.08), ye, zb - 0.18), 0.12, "gold", sides=4)
    beam("canopy-ridge", (0, yr + 0.02, za + 0.18), (0, yr + 0.02, zb - 0.18), 0.12, "gold", sides=4)
    # Balustrade round the open fore edge of the command deck.
    for x in (-0.95, -0.5, 0.5, 0.95):
        box(f"poop-baluster-{x}", (x, top + 0.2, -1.88), (0.1, 0.36, 0.1), "woodDark", bevel=0.02)
    beam("poop-rail", (-0.98, top + 0.42, -1.88), (0.98, top + 0.42, -1.88), 0.1, "gold", sides=4)
    # Steering oars on both quarters, hung in a bracket on the hull.
    for s in (1, -1):
        zq = -2.45
        xq = hull_rail_x(zq)
        box(f"rudder-bracket-{s}", (s * (xq + 0.08), DECK + 0.05, zq), (0.18, 0.22, 0.32), "woodDark", bevel=0.03)
        beam(f"rudder-loom-{s}", (s * (xq + 0.08), DECK + 0.3, zq), (s * (xq + 0.45), 0.45, -3.25), 0.11, "woodDark", sides=6)
        beam(f"rudder-collar-{s}", (s * (xq + 0.06), DECK + 0.12, zq + 0.02), (s * (xq + 0.12), DECK - 0.05, zq - 0.03), 0.18, "gold", sides=6)
        blade_box(f"rudder-blade-{s}", (s * (xq + 0.4), 0.55, -3.18), (s * (xq + 0.5), 0.15, -3.38), 0.34, 0.06, "woodDark")


LANTERN_ARM = ((0, 2.85, Z_AFT - 0.56), (0, 2.85, -3.05))  # from the curl aft over the command deck (designs.ts)


def build_lantern_standin():
    """Stern lantern, hung from the curl over the command deck's after edge (the GLB takes it from designs.ts)."""
    lx, lz = 0, -3.05
    beam("lantern-arm", (0, 2.85, Z_AFT - 0.56), (0, 2.85, lz), 0.06, "metal", sides=4)
    beam("lantern-hook", (0, 2.85, lz), (0, 2.68, lz), 0.035, "metal", sides=4)
    box("lantern", (lx, 2.5, lz), (0.22, 0.3, 0.22), "metal", bevel=0.02)
    box("lantern-glass", (lx, 2.5, lz), (0.17, 0.2, 0.24), "gold", bevel=0.0)


# ---------------------------------------------------------------- the oars: an outrigger bank and a ported bank

def blade_box(name, a, b, width, thick, mat, flat=False):
    """A flat blade from a to b (ship space): `width` across in the vertical plane through a and b and `thick` along z,
    or with `flat` the other way round (an oar blade faces fore and aft, so from above it reads as a paddle)."""
    av, bv = Vector(a), Vector(b)
    d = (bv - av).normalized()
    across = Vector((0, 0, 1)).cross(d).normalized()  # in the x-y plane, square to the oar
    along_z = Vector((0, 0, 1))
    if flat:
        across, along_z = along_z, across
        width, thick = width, thick
    verts = []
    for p in (av, bv):
        for sx, sz in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            q = p + across * (width / 2 * sx) + along_z * (thick / 2 * sz)
            verts.append(tuple(q))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return mesh_from(name, verts, faces, mat)


def oar(name, lock, droop, inboard=0.35):
    """One oar at rest, blade in the water: loom from inboard of the lock out and down at `droop`, a gold-tipped blade."""
    x, y, z = lock
    s = math.copysign(1, x)
    d = Vector((s * math.cos(droop), -math.sin(droop), 0))
    start = Vector(lock) - d * inboard
    tip = Vector(lock) + d * OAR_LENGTH
    blade0 = Vector(lock) + d * (OAR_LENGTH - 0.6)
    beam(f"{name}-loom", tuple(start), tuple(blade0 + d * 0.05), 0.08, "wood", sides=4)
    blade_box(f"{name}-blade", tuple(blade0), tuple(tip), 0.24, 0.06, "wood", flat=True)
    beam(f"{name}-blade-band", tuple(blade0 - d * 0.02), tuple(blade0 + d * 0.08), 0.13, "gold", sides=4)
    return tip


def oar_droops():
    """How far each bank's oars hang from level so their blades reach the water at DRAFT, 2.2 out."""
    return math.asin((OUTRIGGER_Y + 0.04 - DRAFT) / 2.2), math.asin((PORT_Y - DRAFT) / 2.2)


def upper_locks():
    """The upper bank's oar pivots (starboard): on the outrigger, by each thole pin."""
    return [(OUTRIGGER_X, OUTRIGGER_Y + 0.04, z) for z in UPPER_ZS]


def lower_locks():
    """The lower bank's oar pivots (starboard): in the framed ports of the hull."""
    return [(outer_x(z, PORT_Y) + 0.06, PORT_Y, z) for z in LOWER_ZS]


def build_oar_mounts():
    """What the oars work against, static: the outrigger frame on knees and struts with thole pins, and the framed
    oar ports of the lower bank."""
    for s in (1, -1):
        # Outrigger: a thick dark rail outboard of the hull on knees, gold caps at its ends, a thole pin per oar.
        z0, z1 = UPPER_ZS[0] - 0.4, UPPER_ZS[-1] + 0.4
        beam(f"outrigger-{s}", (s * OUTRIGGER_X, OUTRIGGER_Y - 0.06, z0), (s * OUTRIGGER_X, OUTRIGGER_Y - 0.06, z1), 0.16, "woodDark", sides=4)
        for z in (z0, z1):
            beam(f"outrigger-cap-{s}-{z:.2f}", (s * OUTRIGGER_X, OUTRIGGER_Y - 0.06, z - 0.06), (s * OUTRIGGER_X, OUTRIGGER_Y - 0.06, z + 0.06), 0.22, "gold", sides=4)
        for z in (z0 + 0.15, (z0 + z1) / 2, z1 - 0.15):
            xh = hull_rail_x(z)
            beam(f"outrigger-knee-{s}-{z:.2f}", (s * (xh - 0.05), sheer(z) - 0.02, z), (s * (OUTRIGGER_X - 0.04), OUTRIGGER_Y - 0.06, z), 0.13, "woodDark", sides=4)
            beam(f"outrigger-strut-{s}-{z:.2f}", (s * (xh + 0.02), 0.95, z), (s * (OUTRIGGER_X - 0.05), OUTRIGGER_Y - 0.12, z), 0.1, "woodDark", sides=4)
        for i, z in enumerate(UPPER_ZS):
            beam(f"thole-{s}-{i}", (s * OUTRIGGER_X, OUTRIGGER_Y, z + 0.09), (s * OUTRIGGER_X, OUTRIGGER_Y + 0.2, z + 0.09), 0.06, "metal", sides=4)
        for i, z in enumerate(LOWER_ZS):
            xp = outer_x(z, PORT_Y)
            box(f"port-frame-{s}-{i}", (s * (xp + 0.02), PORT_Y, z), (0.08, 0.26, 0.26), "gold", bevel=0.02)
            box(f"port-hole-{s}-{i}", (s * (xp + 0.05), PORT_Y, z), (0.04, 0.16, 0.16), "dark", bevel=0.0)


def build_oar_standins():
    """The oars at rest, blades in the water (the game draws and rows them: designs.ts BREAKER motion)."""
    droop_up, droop_lo = oar_droops()
    for s in (1, -1):
        for i, (x, y, z) in enumerate(upper_locks()):
            oar(f"oar-up-{s}-{i}", (s * x, y, z), droop_up)
        for i, (x, y, z) in enumerate(lower_locks()):
            oar(f"oar-lo-{s}-{i}", (s * x, y, z), droop_lo, inboard=0.12)


def build_oars():
    build_oar_mounts()
    build_oar_standins()


# ---------------------------------------------------------------- the rig: one mast, one small square sail

def sail_half(y):
    t = (SAIL_TOP - y) / (SAIL_TOP - SAIL_BOTTOM)
    return YARD_HALF - 0.08 + 0.1 * t


def sail_z(x, y):
    t = (SAIL_TOP - y) / (SAIL_TOP - SAIL_BOTTOM)
    across = max(0.0, 1 - (x / sail_half(y)) ** 2)
    return MAST_Z + 0.18 + SAIL_BELLY * across * math.sin(math.pi * min(1, max(0, t)) * 0.85)


def build_sail():
    rows, cols = 8, 10
    verts = []
    for dz in (-0.02, 0.02):
        for r in range(rows + 1):
            t = r / rows
            y = SAIL_TOP - t * (SAIL_TOP - SAIL_BOTTOM)
            for c in range(cols + 1):
                x = -sail_half(y) + 2 * sail_half(y) * c / cols
                yy = y - 0.22 * (1 - (x / sail_half(y)) ** 2) * t ** 4
                verts.append((x, yy, sail_z(x, yy) + dz))
    m = (rows + 1) * (cols + 1)
    idx = lambda L, r, c: L * m + r * (cols + 1) + c
    faces = []
    for r in range(rows):
        for c in range(cols):
            faces.append([idx(0, r, c), idx(0, r, c + 1), idx(0, r + 1, c + 1), idx(0, r + 1, c)])
            faces.append([idx(1, r, c), idx(1, r + 1, c), idx(1, r + 1, c + 1), idx(1, r, c + 1)])
    border = [(0, c) for c in range(cols)] + [(r, cols) for r in range(rows)] + [(rows, c) for c in range(cols, 0, -1)] + [(r, 0) for r in range(rows, 0, -1)]
    for i in range(len(border)):
        (r0, c0), (r1, c1) = border[i], border[(i + 1) % len(border)]
        faces.append([idx(0, r0, c0), idx(1, r0, c0), idx(1, r1, c1), idx(0, r1, c1)])
    mesh_from("sail", verts, faces, "canvas")
    # Bolt rope round the leeches and the foot (the head is lashed to the yard).
    pts = [(sail_half(SAIL_TOP - r / rows * (SAIL_TOP - SAIL_BOTTOM)), SAIL_TOP - r / rows * (SAIL_TOP - SAIL_BOTTOM)) for r in range(rows + 1)]
    foot = [(-sail_half(SAIL_BOTTOM) + 2 * sail_half(SAIL_BOTTOM) * c / cols, 0) for c in range(cols, -1, -1)]
    foot = [(x, SAIL_BOTTOM - 0.22 * (1 - (x / sail_half(SAIL_BOTTOM)) ** 2)) for x, _ in foot]
    left = [(-x, y) for x, y in reversed(pts)]
    path = pts + foot[1:] + left[1:]
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(path, path[1:])):
        beam(f"sail-hem-{i}", (x0, y0, sail_z(x0, y0)), (x1, y1, sail_z(x1, y1)), 0.07, "rope", sides=5)


def on_sail(name, outline, cy, mat, lift):
    n = len(outline)
    verts = [(x, cy + y, sail_z(x, cy + y) + lift) for x, y in outline] + [(x, cy + y, sail_z(x, cy + y) + lift - 0.03) for x, y in outline]
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in verts]
    front = bm.faces.new(vs[:n])
    back = bm.faces.new(list(reversed(vs[n:])))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vs[i], vs[n + i], vs[n + j], vs[j]])
    bmesh.ops.triangulate(bm, faces=[front, back])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat)


def build_emblem():
    """A teal roundel ringed in gold with a white curling wave."""
    cy, r = 3.62, 0.58
    disc = [(math.cos(2 * math.pi * i / 24) * r, math.sin(2 * math.pi * i / 24) * r) for i in range(24)]
    on_sail("emblem-ring", [(x * 1.14, y * 1.14) for x, y in disc], cy, "gold", 0.035)
    on_sail("emblem-disc", disc, cy, "canal", 0.05)
    # The wave: a crest rising from the left and curling over to the right, with a flat trough below.
    wave = [(-0.42, -0.2), (-0.3, -0.05), (-0.12, 0.14), (0.06, 0.26), (0.24, 0.27), (0.36, 0.18), (0.38, 0.06), (0.28, 0.0),
            (0.2, 0.07), (0.22, 0.15), (0.12, 0.16), (0.0, 0.06), (-0.08, -0.12), (0.0, -0.22), (0.42, -0.22), (0.42, -0.32), (-0.42, -0.32)]
    on_sail("emblem-wave", wave, cy, "marble", 0.065)


def build_rig():
    build_spars()
    build_rig_dressing()


def build_spars():
    """Mast, yard, stays and the pennant stand-in: the GLB takes these from designs.ts."""
    beam("mast", (0, DECK - 0.1, MAST_Z), (0, MAST_TOP, MAST_Z), 0.2, "woodDark", sides=8, taper=0.7)
    beam("yard", (-YARD_HALF, YARD_Y, MAST_Z + 0.15), (YARD_HALF, YARD_Y, MAST_Z + 0.15), 0.12, "woodDark", sides=8)
    # Stays to the bow post and the stern curl.
    beam("forestay", STAY_TOP, FORESTAY_FOOT, 0.04, "rope")
    beam("backstay", STAY_TOP, BACKSTAY_FOOT, 0.04, "rope")
    verts = [(0, 4.82, MAST_Z), (0, 5.08, MAST_Z), (0, 4.95, MAST_Z - 0.7), (0.02, 4.82, MAST_Z), (0.02, 5.08, MAST_Z), (0.02, 4.95, MAST_Z - 0.7)]
    mesh_from("pennant", verts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "pennant")
    beam("pennant-staff", (0, MAST_TOP, MAST_Z), (0, 5.1, MAST_Z), 0.04, "metal")


STAY_TOP = (0, 4.8, MAST_Z)
FORESTAY_FOOT = (0, sheer(Z_FWD) + 0.95, Z_FWD + 0.45)
BACKSTAY_FOOT = (0, 3.15, Z_AFT - 0.5)


def build_rig_dressing():
    """Blender-only details round the spars: mast partner and ring, iron hoops, a gold cap, the yard's gold end bands and
    its sling, and a gold band where each stay lands."""
    prism("mast-partner", (0, DECK - 0.02, MAST_Z), 0.25, 0.16, "woodDark", sides=8, top=0.8, shade=0.85)
    prism("mast-partner-ring", (0, DECK + 0.12, MAST_Z), 0.16, 0.07, "gold", sides=8)
    for y in (2.2, 3.1, 4.0):
        prism(f"mast-hoop-{y}", (0, y, MAST_Z), 0.125, 0.07, "metal", sides=8)
    prism("mast-cap", (0, MAST_TOP - 0.02, MAST_Z), 0.11, 0.12, "gold", sides=8)
    for s in (1, -1):
        beam(f"yard-band-{s}", (s * (YARD_HALF - 0.1), YARD_Y, MAST_Z + 0.15), (s * (YARD_HALF + 0.02), YARD_Y, MAST_Z + 0.15), 0.17, "gold", sides=8)
    box("yard-sling", (0, YARD_Y, MAST_Z + 0.07), (0.22, 0.2, 0.18), "metal", bevel=0.02)


ANCHORS = {
    "ram": (0, 0.5, 4.0),
    "ram_collar": (0.3, 0.5, stem_z(0.45) + 0.32),
    "ram_blade": (0.3, 0.48, 4.25),
    "bow_post": (0, sheer(Z_FWD) + 0.9, Z_FWD + 0.42),
    "bow_deck": (-0.6, DECK + 0.78, 2.3),
    "stern_curl": (0, 3.3, Z_AFT - 0.4),
    "canopy": (-0.6, DECK + 1.6, -2.45),
    "poop": (-0.9, DECK + 0.3, -2.3),
    "steer": (-1.5, 0.5, -3.25),
    "lantern": (0, 2.5, -3.05),
    "outrigger": (-OUTRIGGER_X, OUTRIGGER_Y - 0.06, -0.55),
    "oar_up": (-2.6, (OUTRIGGER_Y + 0.6) / 2, -0.15),
    "oar_lo": (-2.2, 0.75, 0.25),
    "port": (-1.0, PORT_Y, -0.55),
    "blade_up": (-(OUTRIGGER_X + 2.1), DRAFT + 0.05, 1.4),
    "sail": (1.2, 3.3, MAST_Z + 0.3),
    "sail_edge": (YARD_HALF, YARD_Y, MAST_Z + 0.15),
    "emblem": (0, 3.62, sail_z(0, 3.62) + 0.06),
    "pennant": (0, 4.95, MAST_Z - 0.55),
    "wale": (1.02, 1.08, 0.0),
    "cap": (1.05, sheer(0.0) + 0.06, 0.0),
    "paint": (1.0, 0.8, -0.95),
    "slate": (0.9, 0.3, -0.2),
    "boot": (1.0, DRAFT + 0.02, -0.2),
    "deck": (0, DECK, 0.0),
    "partner": (0, DECK + 0.05, MAST_Z),
    "water_bow": (0, DRAFT, 4.6),
    "water_stern": (0, DRAFT, -3.8),
    "box_top": (0, SHIP_BOX_TOP, 0),
    "beam_pos": (1.0, DECK, 0),
    "reach_pos": (OUTRIGGER_X + OAR_LENGTH * math.cos(math.asin((OUTRIGGER_Y - DRAFT) / 2.2)), DRAFT, 0),
    "reach_neg": (-(OUTRIGGER_X + OAR_LENGTH * math.cos(math.asin((OUTRIGGER_Y - DRAFT) / 2.2))), DRAFT, 0),
}



def build_ship_body():
    """Everything static that the GLB keeps: the hull and its trims, the ram and bow post, the curled stern and its
    command deck, and the oar mounts."""
    build_hull()
    build_trim()
    build_bow()
    build_stern()
    build_oar_mounts()


if __name__ == "__main__":
    build_ship_body()
    build_oar_standins()
    build_lantern_standin()
    build_sail()
    build_emblem()
    build_rig()
    finish_blockout(
        ANCHORS,
        band=hull_band,
        skip=("hull", "sail", "emblem", "boot-top", "wale", "cap-rail", "pennant", "canopy-", "poop-edge", "bow-deck-edge"),
        close_ups=lambda: {
            "near-ram": near((0, 1.0, 3.3), -50, 20, 3.4),
            "near-stern": near((0, 2.1, -2.6), -125, 22, 3.6),
            "near-waist": near((-1.4, 1.1, -0.2), -75, 26, 3.8),
        },
        centre_y=2.4,
        centre_z=0.35,
        scale=11.0,
        oblique_scale=10.6,
    )
