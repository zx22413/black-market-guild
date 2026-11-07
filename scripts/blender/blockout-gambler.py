"""Blockout of 孤注號 (the gambler, restyled as a Mediterranean xebec) and the orthographic renders for its design sheet.

Design stage (lowpoly-model skill step 1, blender-model skill step 0): a lofted slim hull, a long gilded beak, a stern
that kicks up and out over a small platform, a forward-raked mast under a thick curved lateen yard longer than the ship,
the red-and-white striped lateen and a small jib. The sails, pennant and die are drawn by code in the game; here they
are stand-ins so the views read. Ship space as in blockout_kit.py (bow +z, keel at y = 0, DECK = 1.25).

Run headless (Blender 5.1+):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/blockout-gambler.py -- <out dir>
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403

HALF_BEAM = 0.95
Z_AFT, Z_FWD = -2.85, 3.2  # hull ends at the rail (before the stern's kick and the beak)
RAIL = 0.12
MAST_FOOT = (0.0, DECK - 0.1, 0.55)
MAST_HEAD = (0.0, 5.45, 1.2)
# The lateen: tack low over the beak, peak high aft, clew over the quarter (code-drawn sail; corners as in designs.ts).
YARD_A = (0.3, 2.15, 4.4)
YARD_B = (0.3, 8.6, -2.6)
YARD_SAG = 0.38  # the yard bows up and forward
CLEW = (0.6, 2.35, -2.5)
SAIL_X = 0.38  # the sail hangs on the starboard side of the yard and fills out to starboard
SAIL_BELLY = 0.75
BEAK_TIP = (0.0, 1.62, 4.75)
DIE = (0.0, DECK + 0.25, -1.75)
DIE_SIZE = 0.5


# ---------------------------------------------------------------- the hull: long, slim, low

def u_of(z):
    return max(-1.0, min(1.0, (z - (Z_FWD + Z_AFT) / 2) / ((Z_FWD - Z_AFT) / 2)))


def width_k(z):
    """A fine, sharp entry forward, a narrow transom aft (the stern is not pointed: xebecs end in a small transom)."""
    u = u_of(z)
    if u >= 0:
        return max(0.04, (1 - u ** 1.7) ** 0.7)
    return max(0.42, (1 - (-u) ** 2.6) ** 0.5)


def sheer(z):
    """Low waist, rising gently to the bow and more to the stern, which kicks up."""
    u = u_of(z)
    return DECK + 0.26 + (0.3 * u ** 2 if u > 0 else 0.62 * (-u) ** 2.4)


def keel_y(z):
    """A curved cutwater at the bow; a straight raked sternpost up to the transom's foot at the stern."""
    u = u_of(z)
    if u > 0:
        return max(0.0, (u - 0.42) / 0.58) ** 1.6 * (sheer(Z_FWD) - 0.05)
    return max(0.0, (-u - 0.6) / 0.4) * TRANSOM_FOOT


TRANSOM_FOOT = 0.95


def stern_kick(z, y):
    """The stern rakes aft with height (the counter overhangs), so the transom leans out over the rudder."""
    u = u_of(z)
    k = max(0.0, (-u - 0.55) / 0.45)
    return -0.42 * k * max(0.0, y - 0.4)


PROFILE = [(0.0, 0.0), (0.45, 0.04), (0.78, 0.14), (0.95, 0.32), (1.0, 0.55), (1.0, 0.8), (0.97, 1.0)]
COLUMNS = [Z_AFT + (Z_FWD - Z_AFT) * i / 28 for i in range(29)]


def outer(z):
    b, y0, r = HALF_BEAM * width_k(z), keel_y(z), sheer(z)
    return [(k * b, y0 + t * (r - y0)) for k, t in PROFILE]


def outer_x(z, y):
    pts = outer(z)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 > y0 else 0)
    return pts[-1][0]


def build_hull():
    loops = []
    for z in COLUMNS:
        o = outer(z)
        xt = max(o[-1][0] - RAIL, 0.02)
        xd = max(outer_x(z, DECK) - RAIL, 0.02) if keel_y(z) < DECK - 0.05 else 0.02
        star = [(x, y) for x, y in o[1:]] + [(xt, o[-1][1]), (xd, DECK)]
        loop = [(0.0, o[0][1])] + star + [(-x, y) for x, y in reversed(star)]
        loops.append([(x, y, z + stern_kick(z, y)) for x, y in loop])
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
    ob = mesh_from("hull", verts, faces, "roofRed")
    ob["banded"] = True


BOOT_TOP, WALE_Y = 0.74, 1.04


def hull_band(center_y, normal_up):
    """Slate bottom, a white boot-top, red topsides; a light deck."""
    if normal_up > 0.85 and abs(center_y - DECK) < 0.05:
        return "deck", 1.0
    if center_y < 0.62:
        return "slate", 1.0  # the white boot-top is a strip laid over the slate/red line (crisp at the ends)
    return "roofRed", 0.94 if int(center_y / 0.15) % 2 else 1.0


def skin(z, y, out):
    """A point standing `out` proud of the starboard skin at (z, y), with the stern's kick applied."""
    return (outer_x(z, y) + out, y, z + stern_kick(z, y))


def strip(name, y, h, proud, mat, z0, z1, shade=1.0):
    """A moulding following the skin at height y on both sides (wale, boot-top line)."""
    # Stop short of the cutwater and the sternpost at this height, so the strip never sticks out past the hull's ends.
    z0 = max(z0, sternpost_z(min(y - h / 2, TRANSOM_FOOT)) + 0.12)
    z1 = min(z1, stem_z(max(y - h / 2, 0.02)) - 0.06)
    zs = [z0] + [z for z in COLUMNS if z0 < z < z1] + [z1]
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            for dy, out in ((-h / 2, proud), (h / 2, proud), (h / 2, -0.03), (-h / 2, -0.03)):
                x, yy, zz = skin(z, y + dy, out)
                verts.append((side * x, yy, zz))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"{name}-{side}", verts, faces, mat, shade)


def stem_z(y):
    """z of the cutwater's leading edge at height y (inverse of the bow's keel curve)."""
    lo, hi = 0.0, Z_FWD
    for _ in range(40):
        mid = (lo + hi) / 2
        if keel_y(mid) < y:
            lo = mid
        else:
            hi = mid
    return lo


def sternpost_z(y):
    lo, hi = Z_AFT, 0.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if keel_y(mid) < y:
            hi = mid
        else:
            lo = mid
    return hi + stern_kick(hi, y)


def build_trim():
    # Boot-top line (dark, between white and red) and a gold wale; both stop short of the ends, where the cutwater and
    # transom frame take over.
    strip("boot-top", 0.62, 0.26, 0.03, "marble", -3.0, 3.2)
    strip("boot", BOOT_TOP + 0.02, 0.08, 0.07, "woodDark", -3.0, 3.2, shade=0.85)
    strip("wale", WALE_Y, 0.11, 0.09, "gold", -3.0, 3.2)
    # Gold cap rail, chunky, overhanging the bulwark in and out.
    zs = COLUMNS[1:-1]
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            xo = outer(z)[-1][0]
            s = sheer(z)
            kick = stern_kick(z, s)
            for x, y in ((xo + 0.09, s - 0.03), (xo + 0.09, s + 0.12), (max(xo - RAIL - 0.08, 0.03), s + 0.12), (max(xo - RAIL - 0.08, 0.03), s - 0.03)):
                verts.append((side * x, y, z + kick))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"cap-rail-{side}", verts, faces, "gold")
    # Cutwater: a dark timber along the curved stem from the keel up to the beak's root.
    ys = [0.02, 0.3, 0.6, 0.9, 1.2, sheer(Z_FWD) + 0.08]
    for a, b in zip(ys, ys[1:]):
        beam(f"cutwater-{a}", (0, a, stem_z(a) + 0.05), (0, b, stem_z(min(b, sheer(Z_FWD) - 0.06)) + 0.05), 0.18, "woodDark", sides=4)
    # Keel: a dark strip under the whole bottom so the hull does not end raw at the centre line.
    beam("keel", (0, 0.0, sternpost_z(0.02)), (0, 0.0, stem_z(0.02)), 0.16, "woodDark", sides=4)
    # Transom: a gold frame round the narrow stern, and a sternpost from the keel to it.
    zt = COLUMNS[0]
    xt = outer(zt)[-1][0]
    st = sheer(zt)
    corners = [(-xt - 0.02, st + 0.02), (xt + 0.02, st + 0.02), (xt * 0.8, TRANSOM_FOOT + 0.04), (-xt * 0.8, TRANSOM_FOOT + 0.04)]
    for i, ((xa, ya), (xb, yb)) in enumerate(zip(corners, corners[1:] + corners[:1])):
        beam(f"transom-frame-{i}", (xa, ya, zt + stern_kick(zt, ya) - 0.03), (xb, yb, zt + stern_kick(zt, yb) - 0.03), 0.12, "gold", sides=4)
    beam("sternpost", (0, 0.0, sternpost_z(0.0) - 0.05), (0, TRANSOM_FOOT + 0.05, sternpost_z(TRANSOM_FOOT) - 0.05), 0.18, "woodDark", sides=4)


def build_rudder():
    def post(y):
        return sternpost_z(y) - 0.11

    blade = [(post(0.08), 0.08), (post(0.08) - 0.5, 0.12), (post(0.85) - 0.42, 0.85), (post(0.95), 0.95)]
    verts = [(-0.06, y, z) for z, y in blade] + [(0.06, y, z) for z, y in blade]
    faces = [[0, 1, 2, 3], [7, 6, 5, 4]] + [[i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i] for i in range(4)]
    mesh_from("rudder", verts, faces, "woodDark", shade=0.9)
    for y in (0.3, 0.6, 0.85):
        box(f"rudder-strap-{y}", (0, y, post(y) - 0.18), (0.16, 0.07, 0.46), "gold", bevel=0.01)


# ---------------------------------------------------------------- the beak (a long gilded spur)

def build_beak():
    """A long pointed beak from the stem: a diamond section tapering to a gold finial, gold rails along its top edge
    and two gilded head rails sweeping back from it to the bow's cap rail."""
    root_top = (0.0, sheer(Z_FWD) - 0.02, Z_FWD - 0.15)
    root_bot = (0.0, 0.9, stem_z(0.9) + 0.02)
    sections = 7
    verts = []
    for i in range(sections + 1):
        t = i / sections
        top = tuple(root_top[k] + (BEAK_TIP[k] + (0.06 if k == 1 else 0) - root_top[k]) * t for k in range(3))
        bot = tuple(root_bot[k] + (BEAK_TIP[k] - 0.04 * (k == 1) - root_bot[k]) * t ** 0.8 for k in range(3))
        mid_y, mid_z = (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2
        half = 0.2 * (1 - t) + 0.035
        verts += [top, (half, mid_y, mid_z), bot, (-half, mid_y, mid_z)]
    faces = []
    for i in range(sections):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append([a, b, b + 4, a + 4])
    faces.append([0, 1, 2, 3])
    faces.append([sections * 4 + 3, sections * 4 + 2, sections * 4 + 1, sections * 4])
    mesh_from("beak", verts, faces, "roofRed")
    # Gold edge along the beak's top and a gold finial (a ball on a collar) at its tip.
    beam("beak-rail", root_top, (BEAK_TIP[0], BEAK_TIP[1] + 0.06, BEAK_TIP[2]), 0.1, "gold", sides=4, taper=0.6)
    beam("beak-collar", (0, BEAK_TIP[1], BEAK_TIP[2] - 0.12), (0, BEAK_TIP[1] + 0.02, BEAK_TIP[2] + 0.02), 0.16, "gold", sides=8)
    prism("beak-finial", (0, BEAK_TIP[1] - 0.06, BEAK_TIP[2] + 0.1), 0.1, 0.22, "gold", sides=8, top=0.4)
    # Head rails: from the bow cap rail on each side, curving down and forward onto the beak.
    for s in (1, -1):
        zr = Z_FWD - 0.55
        pts = [(s * (outer(zr)[-1][0] + 0.02), sheer(zr) + 0.06, zr), (s * 0.18, sheer(Z_FWD) - 0.1, Z_FWD + 0.25), (s * 0.08, BEAK_TIP[1] + 0.02, Z_FWD + 0.95)]
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            beam(f"head-rail-{s}-{i}", a, b, 0.08, "gold", sides=6)


# ---------------------------------------------------------------- the stern platform (the counter's overhang)

def build_stern_platform():
    """A small grated platform out over the rudder on two outrigger beams, gold-railed, the lantern on its aft post."""
    zt = COLUMNS[0]
    y = sheer(zt) - 0.12
    z0 = zt + stern_kick(zt, y) + 0.1
    z1 = z0 - 0.62
    for s in (1, -1):
        beam(f"outrigger-{s}", (s * 0.42, y - 0.08, zt + 0.5), (s * 0.42, y - 0.08, z1 - 0.06), 0.14, "woodDark", sides=4, shade=0.85)
        # A knee under each outrigger, from the transom down.
        beam(f"outrigger-knee-{s}", (s * 0.42, TRANSOM_FOOT + 0.1, zt + stern_kick(zt, TRANSOM_FOOT + 0.1) - 0.02), (s * 0.42, y - 0.12, z1 + 0.15), 0.1, "woodDark", sides=4, shade=0.85)
    box("platform-grating", (0, y, (z0 + z1) / 2), (0.92, 0.07, z0 - z1), "woodDark", bevel=0.01)
    box("platform-edge", (0, y + 0.02, z1 + 0.04), (1.0, 0.1, 0.1), "gold", bevel=0.02)
    for s in (1, -1):
        for z in (z1 + 0.05, (z0 + z1) / 2):
            beam(f"platform-post-{s}-{z:.2f}", (s * 0.46, y, z), (s * 0.46, y + 0.38, z), 0.07, "gold", sides=4)
        beam(f"platform-rail-{s}", (s * 0.46, y + 0.38, z1 + 0.02), (s * 0.46, y + 0.38, z0 + 0.12), 0.07, "gold", sides=4)
    beam("platform-rail-aft", (-0.46, y + 0.38, z1 + 0.05), (0.46, y + 0.38, z1 + 0.05), 0.07, "gold", sides=4)
    # Lantern on a post at the platform's aft edge.
    beam("lantern-post", (0, y, z1 + 0.05), (0, y + 0.82, z1 + 0.05), 0.08, "woodDark", sides=4)
    box("lantern", (0, y + 0.98, z1 + 0.05), (0.22, 0.3, 0.22), "metal", bevel=0.02)
    box("lantern-glass", (0, y + 0.98, z1 + 0.05), (0.17, 0.2, 0.24), "gold", bevel=0.0)
    prism("lantern-cap", (0, y + 1.12, z1 + 0.05), 0.15, 0.1, "metal", sides=4, top=0.3)
    return y, z1


# ---------------------------------------------------------------- the rig: forward-raked mast, curved yard, lateen

def lerp(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def yard_at(t):
    """A point on the curved yard (t 0 at the tack end, 1 at the peak): a straight line bowed up and forward."""
    p = lerp(YARD_A, YARD_B, t)
    bow = 4 * t * (1 - t) * YARD_SAG
    # Perpendicular to the yard in the y-z plane, pointing up-forward.
    dy, dz = YARD_B[1] - YARD_A[1], YARD_B[2] - YARD_A[2]
    ln = math.hypot(dy, dz)
    ny, nz = -dz / ln, dy / ln
    if ny < 0:
        ny, nz = -ny, -nz
    return (p[0], p[1] + ny * bow, p[2] + nz * bow)


def mast_at(y):
    t = (y - MAST_FOOT[1]) / (MAST_HEAD[1] - MAST_FOOT[1])
    return lerp(MAST_FOOT, MAST_HEAD, t)


def build_mast():
    beam("mast", MAST_FOOT, MAST_HEAD, 0.2, "woodDark", sides=8, taper=0.72)
    prism("mast-partner", (0, DECK - 0.02, mast_at(DECK)[2]), 0.22, 0.15, "woodDark", sides=8, top=0.8, shade=0.85)
    prism("mast-partner-ring", (0, DECK + 0.11, mast_at(DECK + 0.11)[2]), 0.15, 0.07, "gold", sides=8)
    for y in (2.3, 3.4, 4.4):
        c = mast_at(y)
        beam(f"mast-hoop-{y}", lerp(MAST_FOOT, MAST_HEAD, (y - 0.04 - MAST_FOOT[1]) / (MAST_HEAD[1] - MAST_FOOT[1])),
             lerp(MAST_FOOT, MAST_HEAD, (y + 0.04 - MAST_FOOT[1]) / (MAST_HEAD[1] - MAST_FOOT[1])), 0.24 - 0.012 * (y - 2), "gold", sides=8)
    head_cap = lerp(MAST_FOOT, MAST_HEAD, 1.03)
    beam("mast-cap", MAST_HEAD, head_cap, 0.2, "gold", sides=8)


def build_yard():
    n = 10
    pts = [yard_at(i / n) for i in range(n + 1)]
    for i in range(n):
        t = (i + 0.5) / n
        w = 0.1 + 0.1 * math.sin(math.pi * t)  # thick in the middle, tapering to its ends
        beam(f"yard-{i}", pts[i], pts[i + 1], w, "woodDark", sides=8)
    # Gold bands at both arms and at the sling, and end caps, so no end is cut off raw.
    for nm, t0, t1, w in (("band-a", 0.04, 0.09, 0.16), ("band-b", 0.91, 0.96, 0.16), ("cap-a", -0.01, 0.015, 0.14), ("cap-b", 0.985, 1.01, 0.14)):
        beam(f"yard-{nm}", yard_at(t0), yard_at(t1), w, "gold", sides=8)
    # Sling: where the yard crosses the mast head, a block lashes it to the mast.
    ts = min(range(101), key=lambda k: abs(yard_at(k / 100)[2] - 1.15)) / 100
    sling = yard_at(ts)
    beam("yard-sling-band", yard_at(ts - 0.025), yard_at(ts + 0.025), 0.27, "gold", sides=8)
    box("yard-sling", ((sling[0]) / 2, sling[1] - 0.02, sling[2]), (0.3, 0.18, 0.18), "metal", bevel=0.02)
    beam("halyard", (0.0, MAST_HEAD[1] - 0.1, mast_at(MAST_HEAD[1] - 0.1)[2]), sling, 0.05, "rope")
    return ts


def sail_point(s, t):
    """Lateen surface: s along the luff (the yard) 0 tack .. 1 peak, t from the luff toward the clew."""
    luff = yard_at(s)
    luff = (SAIL_X, luff[1] - 0.06, luff[2])
    p = lerp(luff, CLEW, t)
    # Barycentric-ish fullness: zero on all three edges, most toward the middle.
    w = 6.75 * s * (1 - s) * t * (1 - t) ** 0.9 if 0 < s < 1 else 0
    w = max(0.0, min(1.0, w * 1.6))
    return (p[0] + SAIL_BELLY * w, p[1], p[2])


def build_lateen():
    """The striped lateen as fan-shaped stripes radiating from the clew, red and white."""
    stripes = 8
    rows = 6
    per = 2
    for k in range(stripes):
        s0, s1 = k / stripes, (k + 1) / stripes
        verts, faces = [], []
        cols = per + 1
        for layer, dx in ((0, -0.02), (1, 0.02)):
            for r in range(rows + 1):
                t = r / rows * 0.999
                for c in range(cols):
                    s = s0 + (s1 - s0) * c / per
                    x, y, z = sail_point(s, t)
                    verts.append((x + dx, y, z))
        m = (rows + 1) * cols
        idx = lambda L, r, c: L * m + r * cols + c
        for r in range(rows):
            for c in range(per):
                faces.append([idx(0, r, c), idx(0, r, c + 1), idx(0, r + 1, c + 1), idx(0, r + 1, c)])
                faces.append([idx(1, r, c), idx(1, r + 1, c), idx(1, r + 1, c + 1), idx(1, r, c + 1)])
        border = [(0, c) for c in range(per)] + [(r, per) for r in range(rows)] + [(rows, c) for c in range(per, 0, -1)] + [(r, 0) for r in range(rows, 0, -1)]
        for i in range(len(border)):
            (r0, c0), (r1, c1) = border[i], border[(i + 1) % len(border)]
            faces.append([idx(0, r0, c0), idx(1, r0, c0), idx(1, r1, c1), idx(0, r1, c1)])
        mesh_from(f"lateen-{k}", verts, faces, "roofRed" if k % 2 else "canvas")
    # Bolt rope along the foot (tack to clew) and the leech (peak to clew): the sail's thick edge.
    for nm, s in (("foot", 0.0), ("leech", 1.0)):
        pts = [sail_point(s, i / 8) for i in range(9)]
        for i in range(8):
            beam(f"lateen-hem-{nm}-{i}", pts[i], pts[i + 1], 0.08, "rope", sides=5)
    # Robands: short lashings from the luff to the yard every so often.
    for i in range(1, 9):
        s = i / 9
        beam(f"roband-{i}", yard_at(s), sail_point(s, 0.0), 0.05, "rope", sides=4)


def build_jib():
    head = (0.0, 4.9, 1.3)
    tack = (0.0, BEAK_TIP[1] + 0.28, BEAK_TIP[2] - 0.15)
    clew = (0.0, 2.0, 2.55)
    rows = 6
    verts, faces = [], []
    for layer, dx in ((0, 0.02), (1, -0.02)):
        for r in range(rows + 1):
            t = r / rows
            a = lerp(head, tack, t)
            for c in range(3):
                u = c / 2
                p = lerp(a, clew, u * (1 - 0.0))
                belly = 0.28 * math.sin(math.pi * t) * math.sin(math.pi * u * 0.5) * (1 - u * 0.5)
                verts.append((p[0] - belly + dx, p[1], p[2]))
    m = (rows + 1) * 3
    idx = lambda L, r, c: L * m + r * 3 + c
    for r in range(rows):
        for c in range(2):
            faces.append([idx(0, r, c), idx(0, r, c + 1), idx(0, r + 1, c + 1), idx(0, r + 1, c)])
            faces.append([idx(1, r, c), idx(1, r + 1, c), idx(1, r + 1, c + 1), idx(1, r, c + 1)])
    border = [(0, 0), (0, 1)] + [(r, 2) for r in range(rows)] + [(rows, 2), (rows, 1)] + [(r, 0) for r in range(rows, 0, -1)]
    for i in range(len(border)):
        (r0, c0), (r1, c1) = border[i], border[(i + 1) % len(border)]
        faces.append([idx(0, r0, c0), idx(1, r0, c0), idx(1, r1, c1), idx(0, r1, c1)])
    mesh_from("jib", verts, faces, "canvas")
    # Its foot and leech hems, and the forestay it hangs on.
    edge = [verts[idx(0, rows, c)] for c in range(3)] + [verts[idx(0, r, 2)] for r in range(rows, -1, -1)]
    for i, (a, b) in enumerate(zip(edge, edge[1:])):
        beam(f"jib-hem-{i}", a, b, 0.07, "rope", sides=5)
    return tack


def build_rigging(jib_tack, platform):
    # Forestay from the masthead to the beak, the jib's luff on it.
    beam("forestay", (0, MAST_HEAD[1] - 0.05, MAST_HEAD[2]), (0, BEAK_TIP[1] + 0.12, BEAK_TIP[2] - 0.05), 0.045, "rope")
    # Tack line: the yard's low end lashed down to the beak.
    beam("tack-line", yard_at(0.0), (0.12, BEAK_TIP[1] + 0.1, YARD_A[2] - 0.05), 0.05, "rope")
    # Sheet: clew down to a cleat on the starboard quarter rail.
    zq = -2.1
    beam("sheet", CLEW, (outer(zq)[-1][0], sheer(zq) + 0.12, zq), 0.045, "rope")
    box("sheet-cleat", (outer(zq)[-1][0], sheer(zq) + 0.16, zq), (0.12, 0.08, 0.26), "woodDark", bevel=0.02)
    # Shrouds only to port (the lateen fills to starboard): a chainwale with deadeyes on the port side.
    zc = 0.0
    cy = sheer(zc) - 0.16
    xw = outer(zc)[-1][0]
    box("chainwale", (-(xw + 0.1), cy, -0.3), (0.2, 0.1, 1.2), "woodDark", bevel=0.02, shade=0.85)
    for z in (0.15, -0.75):
        x = -(xw + 0.16)
        prism(f"deadeye-{z}", (x, cy + 0.05, z), 0.065, 0.13, "dark", sides=6)
        beam(f"chain-{z}", (x, cy - 0.05, z), (x + 0.02, cy - 0.38, z), 0.035, "metal", sides=4)
        beam(f"shroud-{z}", (0, 5.0, mast_at(5.0)[2]), (x, cy + 0.18, z), 0.045, "rope")


def build_die():
    """The gambler's die (code-drawn and animated in the game): a white die with dark pips on a gold-rimmed hatch."""
    x, y, z = DIE
    box("die-hatch", (x, DECK + 0.04, z), (0.9, 0.12, 0.9), "woodDark", bevel=0.02, shade=0.85)
    plan_ring("die-hatch-rim", [(-0.5, z - 0.5), (0.5, z - 0.5), (0.5, z + 0.5), (-0.5, z + 0.5)],
              [(-0.4, z - 0.4), (0.4, z - 0.4), (0.4, z + 0.4), (-0.4, z + 0.4)], DECK - 0.02, DECK + 0.13, "gold")
    h = DIE_SIZE / 2
    box("die", (x, y + 0.02, z), (DIE_SIZE, DIE_SIZE, DIE_SIZE), "marble", bevel=0.07)
    s = DIE_SIZE * 0.27
    for a, b in ((-s, -s), (s, -s), (0, 0), (-s, s), (s, s)):  # five on top
        box(f"pip-top-{a}-{b}", (x + a, y + 0.02 + h, z + b), (0.09, 0.03, 0.09), "dark", bevel=0.0)
    for a, b in ((-s, -s), (0, 0), (s, s)):  # three facing port
        box(f"pip-port-{a}-{b}", (x - h, y + 0.02 + a, z + b), (0.03, 0.09, 0.09), "dark", bevel=0.0)
    for a, b in ((-s, -s), (s, s)):  # two facing aft
        box(f"pip-aft-{a}-{b}", (x + a, y + 0.02 + b, z - h), (0.09, 0.09, 0.03), "dark", bevel=0.0)


def build_pennant():
    peak = yard_at(1.0)
    top = (peak[0], peak[1] + 0.3, peak[2] - 0.04)
    beam("pennant-staff", (peak[0], peak[1] - 0.02, peak[2]), top, 0.04, "metal")
    verts = [(top[0], top[1] - 0.25, top[2]), (top[0], top[1], top[2]), (top[0], top[1] - 0.12, top[2] - 0.75)]
    verts += [(p[0] + 0.02, p[1], p[2]) for p in verts]
    mesh_from("pennant", verts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "pennant")


build_hull()
build_trim()
build_rudder()
build_beak()
platform = build_stern_platform()
build_mast()
build_yard()
build_lateen()
jib_tack = build_jib()
build_rigging(jib_tack, platform)
build_die()
build_pennant()

PEAK = yard_at(1.0)
ANCHORS = {
    "beak": (0.0, 1.45, 4.2),
    "finial": (0.0, BEAK_TIP[1] + 0.05, BEAK_TIP[2] + 0.15),
    "head_rail": (-0.18, sheer(Z_FWD) - 0.1, Z_FWD + 0.25),
    "stern": (-0.4, sheer(Z_AFT) - 0.2, Z_AFT + stern_kick(Z_AFT, 1.6) + 0.05),
    "platform": (-0.46, platform[0] + 0.38, platform[1] + 0.3),
    "lantern": (0, platform[0] + 0.98, platform[1] + 0.05),
    "rudder": (0, 0.5, sternpost_z(0.5) - 0.4),
    "yard": yard_at(0.62),
    "yard_mid": yard_at(0.3),
    "peak": PEAK,
    "lateen": sail_point(0.45, 0.45),
    "stripes": sail_point(0.7, 0.3),
    "hem": sail_point(1.0, 0.5),
    "jib": (-0.15, 3.0, 2.4),
    "mast": mast_at(3.0),
    "mast_head": MAST_HEAD,
    "die": (0, DIE[1] + 0.2, DIE[2]),
    "chainwale": (-(outer(0.0)[-1][0] + 0.15), sheer(0.0) - 0.16, -0.3),
    "slate": (0.9, 0.3, 0.3),
    "boot": (0.97, 0.6, 0.3),
    "red": (0.98, 0.9, 0.3),
    "wale": (1.02, WALE_Y, 0.3),
    "cap": (0.98, sheer(0.3) + 0.08, 0.3),
    "transom": (0.0, 1.5, Z_AFT + stern_kick(Z_AFT, 1.5)),
    "deck": (0.0, DECK, 0.8),
    "water_bow": (0, DRAFT, 5.0),
    "water_stern": (0, DRAFT, -4.0),
    "box_top": (0, SHIP_BOX_TOP, 0),
    "beam_pos": (HALF_BEAM, DECK, 0),
    "beam_neg": (-HALF_BEAM, DECK, 0),
    "belly_x": (SAIL_X + SAIL_BELLY, 4.0, 0.6),
    "low_peak": (0.3, 7.0, -2.6),
}

finish_blockout(
    ANCHORS,
    band=hull_band,
    skip=("hull", "lateen", "jib", "rudder", "boot", "wale", "cap-rail", "pennant", "beak", "die-hatch-rim"),
    close_ups=lambda: {
        "near-bow": near((0, 1.7, 3.7), -60, 22, 3.6),
        "near-stern": near((0, 1.7, -2.9), -130, 22, 3.4),
        "near-waist": near((0, 1.8, -0.6), -75, 30, 4.4),
    },
    centre_y=4.6,
    centre_z=0.5,
    scale=10.4,
    oblique_scale=12.6,
)
