"""Blockout of 幽靈號 (the ghost ship) and the orthographic renders for its design sheet.

Design stage (lowpoly-model skill step 1, blender-model skill step 0), like blockout-standard.py: a lofted hull and
simple parts in ship space (three.js: y up, bow +z, keel at y = 0, DECK = 1.25). A stylized ghost ship: a low, dark old
hull with holes that show its ribs, a row of portholes glowing teal, weed hanging from the wale, a tall stern tower that
has racked over to starboard, a leaning mainmast with a crooked yard and torn rags, and the foremast snapped and folded
forward. The rags, pennant, swinging lantern and will-o'-the-wisps are drawn by code in the game (stand-ins here).
"Broken" is still finished: every hole has splintered plank ends and ribs, every break a splintered stub and an iron band.
Shared helpers, colour and renders: blockout_kit.py.

Run headless (Blender 5.1+):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/blockout-hidden.py -- <out dir>
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403

HALF_BEAM = 1.22
Z_AFT, Z_FWD = -2.7, 3.1
RAIL = 0.14
TOWER_FRONT = -1.35
TOWER_TOP = DECK + 1.9  # the upper storey's eaves
LEAN = 0.3  # the tower has racked over to starboard by this much at its eaves
LEAN_AFT = 0.28  # ... and aft by this much (so the side view shows it too)
MAIN_Z, FORE_Z = -0.15, 1.65
MAIN_HEAD = (0.3, 5.35, -0.3)  # the mainmast leans to starboard and aft
MAIN_YARD = ((-1.7, 4.75, 0.02), (1.75, 5.2, -0.22))  # crooked: low to port, high to starboard
BREAK = (0.06, 3.35, FORE_Z + 0.03)  # where the foremast snapped
FALLEN_TIP = (0.62, 2.55, 2.55)  # the snapped top, folded forward over the bow, lashed to the rail
FORE_YARD = ((-1.1, 3.1, FORE_Z + 0.22), (1.05, 2.88, FORE_Z + 0.12))
HOLE_PORT = (-1.2, -0.2, 0.5, 0.98)  # z0, z1, y0, y1 of the big hole on the port side
HOLE_STAR = (1.3, 2.0, 0.52, 0.98)  # a smaller one on the starboard bow
WALE_Y = 0.84
# The blockout draws the spars, ropes, rags and pennant itself; build-hidden.py sets this False and takes the spars and
# ropes from designs.ts instead (the rags and pennant are code-drawn cloth in the game).
SPARS = True
GLOW = "ghostGlow"  # parts named `glow-...` light up at night in the game (build-hidden.py exports them as the `glow` mesh)


# ---------------------------------------------------------------- the hull: low, long, a fine bow and a blunt stern

def u_of(z):
    return (z - (Z_FWD + Z_AFT) / 2) / ((Z_FWD - Z_AFT) / 2)


def width_k(z):
    u = u_of(z)
    p = 1.9 if u > 0 else 3.2  # fine entry at the bow, full at the stern under the tower
    return max(0.04, (1 - min(1.0, abs(u)) ** p) ** 0.5)


RAKE_START = {1: 0.42, -1: 0.82}


def sheer(z):
    """Low waist, a gentle rise to the bow, more to the stern under the tower."""
    u = u_of(z)
    return DECK + 0.24 + (0.5 * u ** 2 if u > 0 else 0.62 * abs(u) ** 2.2)


def keel_y(z):
    u = u_of(z)
    u0 = RAKE_START[1 if u > 0 else -1]
    end = Z_FWD if u > 0 else Z_AFT
    t = max(0.0, (abs(u) - u0) / (1 - u0))
    curve = t ** 1.6 if u > 0 else t  # the bow sweeps up in a curve, the sternpost is straight
    return curve * (sheer(end) - 0.02)


PROFILE = [(0.0, 0.0), (0.45, 0.04), (0.8, 0.15), (0.96, 0.35), (1.0, 0.6), (0.99, 0.82), (0.96, 1.0)]
COLUMNS = [Z_AFT + (Z_FWD - Z_AFT) * i / 26 for i in range(27)]


def outer(z):
    b, y0, r = HALF_BEAM * width_k(z), keel_y(z), sheer(z)
    return [(k * b, y0 + t * (r - y0)) for k, t in PROFILE]


def outer_x(z, y):
    pts = outer(z)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 > y0 else 0)
    return pts[-1][0]


def hull_rail_x(z):
    return outer(z)[-1][0]


def post_z(sign, y):
    """z of the bow (sign 1) or sternpost (sign -1) at height y, by bisection on the keel curve."""
    lo, hi = (0.0, Z_FWD) if sign > 0 else (Z_AFT, 0.0)
    for _ in range(40):
        mid = (lo + hi) / 2
        rising = keel_y(mid) < y
        if sign > 0:
            lo, hi = (mid, hi) if rising else (lo, mid)
        else:
            lo, hi = (lo, mid) if rising else (mid, hi)
    return (lo + hi) / 2


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
    ob = mesh_from("hull", verts, faces, "basalt")
    ob["banded"] = True


def hull_band(center_y, normal_up):
    """Near-black bottom, basalt planks (alternating), a pale slate wale, near-black upper strakes, a basalt deck."""
    if normal_up > 0.85 and abs(center_y - DECK) < 0.05:
        return "basalt", 1.15
    if center_y < DRAFT:
        return "dark", 0.7
    if center_y < WALE_Y:
        return "slate", 0.84 if int(center_y / 0.14) % 2 else 0.96  # grey planks, alternating
    return "dark", 0.9  # near-black upper strakes, so the teal ports glow out of them


def surface_strip(name, y, h, proud, mat, zs, side, shade=1.0):
    """A strip along the skin at height y on one side over the given z stations, `proud` of it."""
    verts, faces = [], []
    for z in zs:
        for dy, out in ((-h / 2, proud), (h / 2, proud), (h / 2, -0.02), (-h / 2, -0.02)):
            verts.append((side * (outer_x(z, y + dy) + out), y + dy, z))
    for i in range(len(zs) - 1):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append([a, b, b + 4, a + 4])
    faces.append([0, 1, 2, 3])
    last = (len(zs) - 1) * 4
    faces.append([last, last + 1, last + 2, last + 3])
    return mesh_from(name, verts, faces, mat, shade)


def stations(z0, z1):
    return [z0] + [z for z in COLUMNS if z0 < z < z1] + [z1]


def build_trim():
    # The wale: a pale band between the grey planks and the near-black upper strakes, broken where the port hole tore it.
    z0, z1 = post_z(-1, WALE_Y + 0.1) + 0.1, post_z(1, WALE_Y + 0.1) - 0.1
    hz0, hz1, hy0, hy1 = HOLE_PORT
    surface_strip("wale-port-aft", WALE_Y, 0.13, 0.09, "ghostCloth", stations(z0, hz0 + 0.08), -1)
    surface_strip("wale-port-fwd", WALE_Y, 0.13, 0.09, "ghostCloth", stations(hz1 - 0.12, z1), -1)
    sz0, sz1 = HOLE_STAR[0], HOLE_STAR[1]
    surface_strip("wale-star-aft", WALE_Y, 0.13, 0.09, "ghostCloth", stations(z0, sz0 + 0.08), 1)
    surface_strip("wale-star-fwd", WALE_Y, 0.13, 0.09, "ghostCloth", stations(sz1 - 0.1, z1), 1)
    # Cap rail: a pale board (ghostCloth) on the slate bulwark, from the tower to the bow.
    zs = stations(TOWER_FRONT - 0.1, Z_FWD - 0.12)
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            xo, s = hull_rail_x(z), sheer(z)
            xi = max(xo - RAIL - 0.08, 0.03)
            for x, y in ((xo + 0.1, s - 0.03), (xo + 0.1, s + 0.13), (xi, s + 0.13), (xi, s - 0.03)):
                verts.append((side * x, y, z))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"cap-rail-{side}", verts, faces, "ghostCloth")
    # Stem (a curved timber up the fine bow, in segments) and the straight sternpost.
    ys = [0.0, 0.35, 0.7, 1.05, 1.4, sheer(Z_FWD) + 0.18]
    for a, b in zip(ys, ys[1:]):
        beam(f"stem-{a}", (0, a, post_z(1, a) + 0.06), (0, b, post_z(1, b) + 0.06), 0.2, "dark", sides=4)
    top = sheer(Z_AFT) + 0.05
    beam("sternpost", (0, 0.0, post_z(-1, 0.0) - 0.05), (0, top, post_z(-1, top) - 0.05), 0.2, "dark", sides=4)


def build_rudder():
    """The rudder hangs on the sternpost, knocked a little askew (yawed) by the sea."""
    post = lambda y: post_z(-1, y) - 0.1
    yaw = 0.18
    blade = [(post(0.1), 0.1), (post(0.1) - 0.5, 0.15), (post(0.95) - 0.42, 0.95), (post(1.05), 1.05)]
    verts = []
    for side in (-0.07, 0.07):
        for z, y in blade:
            dz = z - post(y)
            verts.append((side + math.sin(yaw) * -dz, y, post(y) + math.cos(yaw) * dz))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4]] + [[i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i] for i in range(4)]
    mesh_from("rudder", verts, faces, "basalt")
    for y in (0.35, 0.8):  # the middle strap has rusted away
        box(f"rudder-strap-{y}", (0.03, y, post(y) - 0.18), (0.18, 0.07, 0.46), "stone", bevel=0.01, yaw=yaw)
    beam("rudder-stock", (0, 1.0, post(1.0) - 0.05), (0, 1.3, post(1.3) - 0.05), 0.14, "dark", sides=4)


# ---------------------------------------------------------------- holes in the hull: dark gaps, ribs, splintered planks

def on_hull(name, outline, side, lift, depth, mat, shade=1.0):
    """A plate laid on the skin: an outline of (z, y) points on `side`, `lift` proud, `depth` thick (into the hull)."""
    n = len(outline)
    front = [(side * (outer_x(z, y) + lift), y, z) for z, y in outline]
    back = [(side * (outer_x(z, y) + lift - depth), y, z) for z, y in outline]
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in front + back]
    f = bm.faces.new(vs[:n])
    b = bm.faces.new(list(reversed(vs[n:])))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vs[i], vs[n + i], vs[n + j], vs[j]])
    bmesh.ops.triangulate(bm, faces=[f, b])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat, shade)


def jagged(z0, z1, y0, y1, seed):
    """A ragged hole outline (z, y), clockwise-ish, with teeth where the planks broke."""
    pts = []
    cz, cy = (z0 + z1) / 2, (y0 + y1) / 2
    rz, ry = (z1 - z0) / 2, (y1 - y0) / 2
    for i in range(16):
        a = 2 * math.pi * i / 16
        k = 1.0 if i % 2 == 0 else 0.72 + 0.12 * ((i * 7 + seed) % 3)
        pts.append((cz + math.cos(a) * rz * k, cy + math.sin(a) * ry * k))
    return pts


def build_hole(name, spec, side, seed):
    z0, z1, y0, y1 = spec
    outline = jagged(z0, z1, y0, y1, seed)
    # The gap shows the hold lit teal from inside (the same ghost light as the ports), so it reads on the dark hull.
    on_hull(f"glow-hole-{name}", outline, side, 0.04, 0.08, GLOW, shade=0.62)
    # Ribs: pale old frames standing across the glow, running past its edges so they read as the ship's skeleton.
    count = 2
    for i in range(count):
        z = z0 + (z1 - z0) * (i + 1) / (count + 1)
        ya, yb = y0 - 0.06, y1 + 0.06
        beam(f"rib-{name}-{i}", (side * (outer_x(z, ya) + 0.05), ya, z), (side * (outer_x(z, yb) + 0.05), yb, z), 0.12, "marble", sides=4, shade=0.85)
    # Splintered plank ends round the edge: short, lighter boards sticking into the gap at different lengths.
    cz, cy = (z0 + z1) / 2, (y0 + y1) / 2
    # (only the ends at the hole's fore and aft sides: the planks run fore and aft, so that is where they break)
    for i, (z, y) in enumerate(outline):
        if abs(z - cz) < (z1 - z0) * 0.3 or i % 2:
            continue
        length = 0.16 + 0.08 * ((i * 5 + seed) % 3)
        zz = z + math.copysign(length * 0.45, cz - z)
        box(f"splinter-{name}-{i}", (side * (outer_x(zz, y) + 0.055), y, zz), (0.07, 0.09, length), "basalt", bevel=0.015, shade=1.45)


def build_portholes():
    """A row of square ports in the upper strakes, glowing teal from inside, each in a pale proud frame."""
    y = 1.1
    for side in (1, -1):
        for z in (2.15, 1.45, 0.75, 0.15):
            if side == 1 and HOLE_STAR[0] - 0.2 < z < HOLE_STAR[1] + 0.2:
                continue
            x = outer_x(z, y)
            slope = (outer_x(z + 0.05, y) - outer_x(z - 0.05, y)) / 0.1
            yaw = math.atan(slope) * side
            box(f"port-frame-{side}-{z}", (side * (x + 0.02), y, z), (0.1, 0.3, 0.3), "stone", bevel=0.02, yaw=yaw)
            box(f"glow-port-{side}-{z}", (side * (x + 0.05), y, z), (0.08, 0.18, 0.18), GLOW, bevel=0.0, yaw=yaw)


def build_weed():
    """Weed hanging from the wale and the cap rail down the hull into the water, in two-segment kinks."""
    for side, z, top, drop in ((-1, 2.0, WALE_Y - 0.04, 0.55), (-1, 1.15, WALE_Y - 0.04, 0.4), (-1, -1.4, WALE_Y - 0.04, 0.6),
                               (-1, 0.6, sheer(0.6) - 0.02, 0.5), (1, 0.4, WALE_Y - 0.04, 0.5), (1, -0.8, WALE_Y - 0.04, 0.6),
                               (1, 2.45, sheer(2.45) - 0.02, 0.45), (-1, -1.9, sheer(-1.9) - 0.02, 0.4)):
        mid = top - drop * 0.55
        bot = top - drop
        a = (side * (outer_x(z, top) + 0.05), top, z)
        b = (side * (outer_x(z + 0.08, mid) + 0.06), mid, z + 0.08)
        c = (side * (outer_x(z - 0.02, bot) + 0.05), bot, z - 0.02)
        beam(f"weed-{side}-{z}-a", a, b, 0.13, "leaf", sides=4, taper=0.85, shade=0.75)
        beam(f"weed-{side}-{z}-b", b, c, 0.11, "leaf", sides=4, taper=0.4, shade=0.75)


# ---------------------------------------------------------------- the racked stern tower

def lean(y):
    return LEAN * max(0.0, y - DECK) / (TOWER_TOP - DECK)


def lean_z(y):
    return -LEAN_AFT * max(0.0, y - DECK) / (TOWER_TOP - DECK)


def tw(x, y, z):
    """A point of the tower: racked to starboard and aft by its height."""
    return (x + lean(y), y, z + lean_z(y))


def tower_solid(name, plan, y0, y1, mat, shade=1.0):
    """A storey whose walls have racked: every point moves to starboard by lean(y)."""
    n = len(plan)
    verts = [tw(x, y0, z) for x, z in plan] + [tw(x, y1, z) for x, z in plan]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def tower_ring(name, plan, out, inn, y0, y1, mat):
    s, t = lean((y0 + y1) / 2), lean_z((y0 + y1) / 2)
    plan_ring(name, [(x + s, z + t) for x, z in offset(plan, out)], [(x + s, z + t) for x, z in offset(plan, inn)], y0, y1, mat)


def storey(name, plan, y0, y1):
    """Slate walls framed in near-black: corbel at the foot, racked corner posts, a dark coping round the top."""
    tower_solid(f"{name}-wall", plan, y0, y1, "slate", shade=0.85)
    tower_ring(f"{name}-corbel", plan, 0.08, -0.12, y0 - 0.14, y0 + 0.1, "dark")
    tower_ring(f"{name}-coping", plan, 0.1, -0.22, y1 - 0.04, y1 + 0.14, "dark")
    for i, (x, z) in enumerate(plan):
        beam(f"{name}-post-{i}", tw(x, y0 - 0.02, z), tw(x, y1 + 0.02, z), 0.2, "dark", sides=4, shade=0.95)


def glow_window(name, x, y, z, w, h, facing_x):
    """A window lit teal from inside, in a thick pale frame."""
    if facing_x:
        box(f"{name}-frame", (x, y, z), (0.08, h + 0.16, w + 0.16), "stone", bevel=0.02)
        box(f"glow-{name}", (x + math.copysign(0.03, x), y, z), (0.06, h, w), GLOW, bevel=0.0)
    else:
        box(f"{name}-frame", (x, y, z), (w + 0.16, h + 0.16, 0.08), "stone", bevel=0.02)
        box(f"glow-{name}", (x, y, z - 0.03), (w, h, 0.06), GLOW, bevel=0.0)
    beam(f"{name}-bar", (x, y - h / 2, z), (x, y + h / 2, z), 0.05, "dark", sides=4)


def build_tower():
    base = DECK - 0.12
    mid = DECK + 0.95
    hug = lambda x, z: math.copysign(max(abs(x), hull_rail_x(z) + 0.06), x)
    lower = [(hug(1.18, TOWER_FRONT), TOWER_FRONT), (hug(1.1, -2.35), -2.35), (0.8, -2.85), (-0.8, -2.85), (hug(-1.1, -2.35), -2.35), (hug(-1.18, TOWER_FRONT), TOWER_FRONT)]
    storey("tower-lower", lower, base, mid)
    upper = [(0.88, -1.85), (0.88, -2.7), (0.62, -3.0), (-0.62, -3.0), (-0.88, -2.7), (-0.88, -1.85)]
    storey("tower-upper", upper, mid + 0.12, TOWER_TOP)
    # The lower storey's roof walk in front of the upper storey: a dark old floor sunk inside the coping.
    s, t = lean(mid), lean_z(mid)
    plan_solid("tower-walk", [(x + s, z + t) for x, z in offset(lower, -0.2)], mid - 0.1, mid + 0.06, "woodDark", shade=0.72)
    # Knees under the lower storey's overhang past the sternpost.
    for x, nm in ((0.0, "c"), (0.55, "s"), (-0.55, "p")):
        zh = post_z(-1, 0.75) + (0.05 if x == 0 else 0.3)
        xh = math.copysign(max(0.0, outer_x(zh, 0.75) - 0.05), x) if x else 0.0
        beam(f"stern-knee-{nm}", (xh, 0.75, zh), (x, base - 0.12, -2.8), 0.16, "dark", sides=4)
    # Knees under the upper storey's overhang aft.
    for x in (-0.55, 0.55):
        beam(f"tower-knee-{x}", tw(x, mid - 0.35, -2.8), tw(x, mid + 0.1, -2.98), 0.14, "dark", sides=4)
    # A crooked gable roof whose ridge runs athwartships, so from the side (the ship-select camera) it reads as a steep
    # gable: dark slabs with pale barge boards along both gable ends, a pale ridge that sags to port, a dark eave board.
    eave, ridge = TOWER_TOP + 0.12, TOWER_TOP + 1.0
    zf, za = -1.72 + lean_z(TOWER_TOP), -3.15 + lean_z(TOWER_TOP)
    zr = (zf + za) / 2
    sx = lean(TOWER_TOP) + 0.06
    xs, xp = 1.02 + sx, -1.02 + sx
    sag = 0.1  # the ridge droops to port
    for nm, ze in (("fwd", zf), ("aft", za)):
        verts = [(xs, eave, ze), (xs, ridge, zr), (xp, ridge - sag, zr), (xp, eave - sag * 0.5, ze)]
        verts += [(x, y - 0.1, z) for x, y, z in verts]
        faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
        mesh_from(f"roof-{nm}", verts, faces, "basalt", shade=0.85)
        beam(f"roof-eave-{nm}", (xs + 0.02, eave - 0.06, ze), (xp - 0.02, eave - sag * 0.5 - 0.06, ze), 0.11, "dark", sides=4)
    for nm, x, dy in (("star", xs, 0.0), ("port", xp, sag)):
        beam(f"roof-barge-fwd-{nm}", (x, eave - dy * 0.5 - 0.03, zf - 0.02), (x, ridge - dy + 0.02, zr), 0.12, "ghostCloth", sides=4)
        beam(f"roof-barge-aft-{nm}", (x, eave - dy * 0.5 - 0.03, za + 0.02), (x, ridge - dy + 0.02, zr), 0.12, "ghostCloth", sides=4)
    beam("roof-ridge", (xs + 0.04, ridge + 0.03, zr), (xp - 0.04, ridge - sag + 0.03, zr), 0.13, "ghostCloth", sides=4)
    # Gable ends: slate triangles under the roof on both sides (the tower's upper walls stop at the eaves).
    for nm, x, dy in (("star", 0.86 + sx, 0.0), ("port", -0.86 + sx, sag * 0.8)):
        yb = TOWER_TOP + 0.1
        verts = [(x - 0.04, yb, zf + 0.12), (x - 0.04, yb, za - 0.12), (x - 0.04, ridge - 0.14 - dy, zr)]
        verts += [(x + 0.04, y, z) for _, y, z in verts]
        mesh_from(f"gable-{nm}", verts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "slate", shade=0.9)
    # Openings: a door onto the waist, a lit stern gallery, lit side windows.
    framed_opening("tower-door", tw(0, DECK + 0.38, TOWER_FRONT + 0.03), (0.44, 0.66), False)
    for x in (-0.36, 0.36):
        y = mid + 0.55
        glow_window(f"stern-win-{x}", *tw(x, y, -3.04), 0.26, 0.34, False)
    for side in (1, -1):
        y = DECK + 0.5
        glow_window(f"side-win-{side}", *tw(side * 1.13, y, -1.95), 0.24, 0.3, True)
        y = mid + 0.55
        glow_window(f"upper-win-{side}", *tw(side * 0.9, y, -2.3), 0.24, 0.3, True)
    # Ladder up to the roof walk.
    for i in range(4):
        box(f"ladder-{i}", (0.78, DECK + 0.2 + i * 0.22, TOWER_FRONT + 0.36 - i * 0.06), (0.44, 0.07, 0.14), "dark", bevel=0.01)
    for x in (0.57, 0.99):
        beam(f"ladder-rail-{x}", (x, DECK - 0.02, TOWER_FRONT + 0.4), tw(x, mid + 0.1, TOWER_FRONT + 0.1), 0.08, "dark", sides=4)


# ---------------------------------------------------------------- the lantern arm (the lantern swings in the game)

HOOK = tw(0, DECK + 1.47, -3.45)


LANTERN_WALL = -3.0


def build_lantern_bracket():
    """The plate and brace under the lantern's arm (the arm itself is in designs.ts: GHOST_ARM)."""
    y = DECK + 1.45
    box("lantern-plate", tw(0, y - 0.05, LANTERN_WALL - 0.03), (0.22, 0.32, 0.06), "stone", bevel=0.01)
    beam("lantern-brace", tw(0, y - 0.35, LANTERN_WALL - 0.04), (HOOK[0], y, HOOK[2] + 0.2), 0.05, "dark", sides=4)


def build_lantern():
    y = DECK + 1.45
    build_lantern_bracket()
    beam("lantern-arm", tw(0, y, LANTERN_WALL - 0.04), (HOOK[0], y, HOOK[2]), 0.07, "dark", sides=4)
    lx, ly, lz = HOOK[0], HOOK[1] - 0.35, HOOK[2]
    beam("lantern-rope", HOOK, (lx, ly + 0.17, lz), 0.03, "rope", sides=4)
    box("lantern", (lx, ly, lz), (0.22, 0.3, 0.22), "dark", bevel=0.02)
    box("lantern-glass", (lx, ly, lz), (0.17, 0.2, 0.24), "ghostGlow", bevel=0.0)


# ---------------------------------------------------------------- the rig: a leaning mainmast, rags, a snapped foremast

def lerp(a, b, t):
    return tuple(p + (q - p) * t for p, q in zip(a, b))


def build_main():
    foot = (0, DECK - 0.1, MAIN_Z)
    if SPARS:
        beam("main-mast", foot, MAIN_HEAD, 0.22, "dark", sides=8, taper=0.7)
    prism("main-partner", (0, DECK - 0.02, MAIN_Z), 0.26, 0.16, "dark", sides=8, top=0.8)
    for t in (0.25, 0.5):
        p = lerp(foot, MAIN_HEAD, t)
        beam(f"main-hoop-{t}", lerp(foot, MAIN_HEAD, t - 0.012), lerp(foot, MAIN_HEAD, t + 0.012), 0.26, "stone", sides=8)
    beam("main-cap", lerp(foot, MAIN_HEAD, 0.985), lerp(foot, MAIN_HEAD, 1.02), 0.2, "stone", sides=8)
    # Crooked yard, a sling where it crosses the mast, pale bands at its arms.
    a, b = MAIN_YARD
    if SPARS:
        beam("main-yard", a, b, 0.13, "dark", sides=8)
    sling = lerp(a, b, 0.48)
    box("main-sling", (sling[0], sling[1], sling[2] - 0.08), (0.24, 0.22, 0.2), "stone", bevel=0.02)
    for t0, t1 in ((0.0, 0.05), (0.95, 1.0)):
        beam(f"main-yard-band-{t0}", lerp(a, b, t0), lerp(a, b, t1), 0.18, "ghostCloth", sides=8)
    # Rags: torn strips hanging from the yard, ragged at the foot (code-drawn cloth in the game; stand-ins here).
    for i, (s0, s1, drop) in enumerate(((0.03, 0.18, 2.4), (0.24, 0.38, 1.6), (0.45, 0.6, 2.6), (0.66, 0.8, 1.9), (0.86, 0.98, 2.2))):
        p0, p1 = lerp(a, b, s0), lerp(a, b, s1)
        z = (p0[2] + p1[2]) / 2 + 0.12
        for k, s in enumerate((s0 + 0.02, s1 - 0.02)):  # lashings where each rag is tied to the yard
            p = lerp(a, b, s)
            beam(f"rag-tie-{i}-{k}", (p[0] - 0.03, p[1], p[2]), (p[0] + 0.03, p[1], p[2]), 0.16, "rope", sides=6)
        if not SPARS:
            continue
        foot_pts = []
        for k in range(5):
            t = k / 4
            x = p0[0] + (p1[0] - p0[0]) * t
            y_top = p0[1] + (p1[1] - p0[1]) * t
            d = drop * (0.62 + 0.38 * ((k + i) % 2)) * (0.85 if k in (0, 4) else 1.0)
            foot_pts.append((x, y_top - d))
        outline = [(p0[0], p0[1] - 0.04), (p1[0], p1[1] - 0.04)] + list(reversed(foot_pts))
        verts = [(x, y, z - 0.02) for x, y in outline] + [(x, y, z + 0.02) for x, y in outline]
        n = len(outline)
        bm = bmesh.new()
        vs = [bm.verts.new(V(*p)) for p in verts]
        f0 = bm.faces.new(vs[:n])
        f1 = bm.faces.new(list(reversed(vs[n:])))
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new([vs[k], vs[j], vs[n + j], vs[n + k]])
        bmesh.ops.triangulate(bm, faces=[f0, f1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        finish(bm, f"rag-main-{i}", "ghostCloth")
    # The one shroud left standing, on a chainwale with deadeyes; a backstay to the tower.
    for side, z in ((-1, -0.75), (1, -0.55)):
        cy = sheer(z) - 0.2
        box(f"chainwale-{side}", (side * (hull_rail_x(z) + 0.12), cy, z), (0.24, 0.1, 0.6), "dark", bevel=0.02)
        x = side * (hull_rail_x(z) + 0.2)
        prism(f"deadeye-{side}", (x, cy + 0.05, z), 0.07, 0.14, "stone", sides=6)
        beam(f"chain-{side}", (x, cy - 0.05, z), (x - side * 0.02, cy - 0.4, z), 0.035, "metal", sides=4)
        if SPARS:
            beam(f"shroud-{side}", lerp(foot, MAIN_HEAD, 0.9), (x, cy + 0.19, z), 0.04, "rope", sides=4)
    if not SPARS:
        return
    beam("backstay", lerp(foot, MAIN_HEAD, 0.95), tw(0, TOWER_TOP + 0.6, -2.4), 0.035, "rope", sides=4)
    # Pennant stand-in (code-drawn in the owner's colour).
    hx, hy, hz = MAIN_HEAD
    beam("pennant-staff", (hx, hy - 0.02, hz), (hx + 0.01, hy + 0.32, hz), 0.04, "metal")
    verts = [(hx, hy + 0.04, hz), (hx, hy + 0.3, hz), (hx, hy + 0.17, hz - 0.7), (hx + 0.02, hy + 0.04, hz), (hx + 0.02, hy + 0.3, hz), (hx + 0.02, hy + 0.17, hz - 0.7)]
    mesh_from("pennant", verts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "pennant")


def splintered_end(name, at, direction, width):
    """A broken spar's end: a pale cone of splinters (fresh wood) pointing along `direction`, with an iron band behind."""
    d = Vector(direction).normalized()
    tip = (at[0] + d.x * 0.22, at[1] + d.y * 0.22, at[2] + d.z * 0.22)
    beam(f"{name}-splinter", at, tip, width * 1.05, "rope", sides=5, taper=0.25)
    back = (at[0] - d.x * 0.1, at[1] - d.y * 0.1, at[2] - d.z * 0.1)
    back2 = (at[0] - d.x * 0.18, at[1] - d.y * 0.18, at[2] - d.z * 0.18)
    beam(f"{name}-band", back2, back, width * 1.25, "stone", sides=8)


def build_fore():
    foot = (0, DECK - 0.1, FORE_Z)
    if SPARS:
        beam("fore-mast", foot, BREAK, 0.2, "dark", sides=8, taper=0.85)
    prism("fore-partner", (0, DECK - 0.02, FORE_Z), 0.24, 0.16, "dark", sides=8, top=0.8)
    up = (BREAK[0] - foot[0], BREAK[1] - foot[1], BREAK[2] - foot[2])
    splintered_end("fore-stub", BREAK, up, 0.17)
    # The snapped top: still hanging by its splinters at the break, folded forward and down over the bow.
    hinge = (BREAK[0] + 0.05, BREAK[1] - 0.02, BREAK[2] + 0.1)
    if SPARS:
        beam("fore-top", hinge, FALLEN_TIP, 0.16, "dark", sides=8, taper=0.75)
    back = (hinge[0] - FALLEN_TIP[0], hinge[1] - FALLEN_TIP[1], hinge[2] - FALLEN_TIP[2])
    splintered_end("fore-top-end", hinge, back, 0.16)
    beam("fore-top-cap", lerp(hinge, FALLEN_TIP, 0.96), lerp(hinge, FALLEN_TIP, 1.04), 0.17, "stone", sides=8)
    # Lashed down to the starboard rail so it does not swing (and does not float).
    rail = (hull_rail_x(2.6) - 0.02, sheer(2.6) + 0.13, 2.6)
    if SPARS:
        beam("fore-lashing", lerp(hinge, FALLEN_TIP, 0.92), rail, 0.045, "rope", sides=4)
    box("fore-cleat", (rail[0], rail[1] + 0.03, rail[2]), (0.16, 0.08, 0.26), "dark", bevel=0.02)
    # The fore yard still hangs from the stub, crooked, with two rags.
    a, b = FORE_YARD
    if SPARS:
        beam("fore-yard", a, b, 0.11, "dark", sides=8)
    box("fore-sling", (0.0, (a[1] + b[1]) / 2, FORE_Z + 0.05), (0.22, 0.2, 0.2), "stone", bevel=0.02)
    for t0, t1 in ((0.0, 0.06), (0.94, 1.0)):
        beam(f"fore-yard-band-{t0}", lerp(a, b, t0), lerp(a, b, t1), 0.15, "ghostCloth", sides=8)
    for i, (s0, s1, drop) in enumerate(((0.04, 0.32, 0.95), (0.66, 0.95, 1.05))):
        p0, p1 = lerp(a, b, s0), lerp(a, b, s1)
        z = (p0[2] + p1[2]) / 2 + 0.12
        for k, s in enumerate((s0 + 0.03, s1 - 0.03)):
            p = lerp(a, b, s)
            beam(f"rag-fore-tie-{i}-{k}", (p[0] - 0.03, p[1], p[2]), (p[0] + 0.03, p[1], p[2]), 0.14, "rope", sides=6)
        if not SPARS:
            continue
        outline = [(p0[0], p0[1] - 0.04), (p1[0], p1[1] - 0.04), (p1[0], p1[1] - drop * 0.8), ((p0[0] + p1[0]) / 2 + 0.05, p0[1] - drop), (p0[0], p0[1] - drop * 0.72)]
        n = len(outline)
        verts = [(x, y, z - 0.02) for x, y in outline] + [(x, y, z + 0.02) for x, y in outline]
        faces = [list(range(n)), list(range(n, 2 * n))[::-1]] + [[k, (k + 1) % n, n + (k + 1) % n, n + k] for k in range(n)]
        mesh_from(f"rag-fore-{i}", verts, faces, "ghostCloth")
    # A short bowsprit with a pale cap and an iron band where it leaves the stem.
    s0, s1 = (0, sheer(2.75) - 0.05, 2.75), (0, 2.15, 3.85)
    if SPARS:
        beam("bowsprit", s0, s1, 0.14, "dark", sides=8, taper=0.75)
    beam("bowsprit-band", lerp(s0, s1, 0.33), lerp(s0, s1, 0.4), 0.22, "stone", sides=8)
    beam("bowsprit-cap", lerp(s0, s1, 0.93), lerp(s0, s1, 1.02), 0.15, "ghostCloth", sides=8)
    if SPARS:
        beam("forestay", lerp((0, DECK - 0.1, MAIN_Z), MAIN_HEAD, 0.93), lerp(s0, s1, 0.95), 0.04, "rope", sides=4)


def build_wisps():
    """Will-o'-the-wisps (code-drawn, glowing at night): stand-ins floating beside the hull."""
    for i, (x, y, z) in enumerate(((-1.85, 1.6, 0.9), (1.9, 2.1, -0.6), (-1.6, 2.4, -1.9))):
        prism(f"wisp-{i}", (x, y - 0.14, z), 0.12, 0.28, "ghostGlow", sides=6, top=0.4)


ANCHORS = {
    "rags": (1.15, 3.6, -0.05),
    "rag_foot": (0.0, 2.55, 0.0),
    "main_mast": lerp((0, DECK, MAIN_Z), MAIN_HEAD, 0.75),
    "main_yard": lerp(*MAIN_YARD, 0.1),
    "break": BREAK,
    "fallen_tip": FALLEN_TIP,
    "fore_yard": lerp(*FORE_YARD, 0.9),
    "lashing": (hull_rail_x(2.6), sheer(2.6) + 0.1, 2.6),
    "tower": (-1.2, DECK + 0.5, -1.7),
    "tower_upper": tw(-0.9, DECK + 1.4, -2.4),
    "roof": (0.4, TOWER_TOP + 0.45, -2.4),
    "stern_win": tw(0.36, DECK + 1.5, -3.06),
    "lantern": (HOOK[0], HOOK[1] - 0.35, HOOK[2]),
    "hook": HOOK,
    "portholes": (-outer_x(1.45, 1.1) - 0.05, 1.1, 1.45),
    "port_star": (outer_x(0.75, 1.1) + 0.05, 1.1, 0.75),
    "hole": (-outer_x(-0.5, 0.75) - 0.02, 0.75, -0.5),
    "hole_star": (outer_x(1.72, 0.75) + 0.02, 0.75, 1.72),
    "rib": (-outer_x(-0.5, 0.95), 0.95, -0.57),
    "weed": (-outer_x(1.15, 0.6) - 0.05, 0.6, 1.15),
    "weed_star": (outer_x(0.4, 0.6) + 0.05, 0.6, 0.4),
    "wisp": (-1.85, 1.6, 0.9),
    "wale": (outer_x(-1.2, WALE_Y) + 0.09, WALE_Y, -1.2),
    "cap": (outer_x(0.3, sheer(0.3)) + 0.1, sheer(0.3) + 0.08, 0.3),
    "slate": (outer_x(0.3, 1.25), 1.25, 0.3),
    "basalt": (outer_x(0.3, 0.65), 0.65, 0.3),
    "dark_band": (outer_x(0.3, 0.3), 0.3, 0.3),
    "rudder": (0.03, 0.6, post_z(-1, 0.6) - 0.4),
    "stem": (0, 0.7, post_z(1, 0.7) + 0.06),
    "bowsprit": (0, 2.1, 3.8),
    "pennant": (MAIN_HEAD[0], MAIN_HEAD[1] + 0.17, MAIN_HEAD[2] - 0.5),
    "chainwale": (-(hull_rail_x(-0.75) + 0.2), sheer(-0.75) - 0.2, -0.75),
    "deck": (0, DECK, 0.7),
    "water_bow": (0, DRAFT, 3.6),
    "water_stern": (0, DRAFT, -3.6),
    "box_top": (0, SHIP_BOX_TOP, 0),
    "beam_pos": (HALF_BEAM, DECK, 0),
    "beam_neg": (-HALF_BEAM, DECK, 0),
    "yard_pos": (MAIN_YARD[1][0], MAIN_YARD[1][1], 0),
    "yard_neg": (MAIN_YARD[0][0], MAIN_YARD[0][1], 0),
}




def build_ship_body():
    """The hull, its trims, holes, ports, weed, rudder and the racked tower: everything that is not rig or stand-in."""
    build_hull()
    build_trim()
    build_rudder()
    build_hole("port", HOLE_PORT, -1, 1)
    build_hole("star", HOLE_STAR, 1, 2)
    build_portholes()
    build_weed()
    build_tower()


if __name__ == "__main__":
    build_ship_body()
    build_lantern()
    build_main()
    build_fore()
    build_wisps()
    finish_blockout(
        ANCHORS,
        band=hull_band,
        skip=("hull", "rag-", "rudder", "wale", "cap-rail", "pennant", "glow-hole-", "tower-", "roof-", "gable-", "wisp"),
        close_ups=lambda: {
            "near-bow": near((0, 2.2, 2.2), -55, 22, 3.8),
            "near-stern": near((0, 2.2, -2.4), -125, 20, 4.0),
            "near-waist": near((0, 1.4, -0.4), -80, 18, 4.0),
            "near-starboard": near((0, 1.6, 1.4), 60, 18, 4.0),
        },
    )
