"""Blockout of 信天翁號 (the standard ship, restyled as a medieval cog) and the orthographic renders for its design sheet.

This is the design stage (lowpoly-model skill step 1, blender-model skill step 0): simple boxes, prisms and one lofted
hull, placed in ship space (three.js: y up, bow +z, keel at y = 0, DECK = 1.25), so every part sits in one 3D space.
Once the sheet is approved this script grows into build-standard.py (colour, AO, GLB export) the way build-freighter.py
did. The sail, pennant and the albatross are drawn by code in the game; here they are stand-ins so the views read.
Shared helpers, colour and renders: blockout_kit.py.

Run headless (Blender 5.1+):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/blockout-standard.py -- <out dir>
Writes side.png, front.png, top.png, oblique.png, the near-*.png close-ups and anchors.json.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403

HALF_BEAM = 1.5
Z_AFT, Z_FWD = -2.75, 3.0  # hull ends at the rail
RAIL = 0.14
MAST_Z = 0.15
YARD_Y = 4.7
YARD_HALF = 2.6  # the "wing": the yard is wider than the ship (half beam 1.5)
SAIL_TOP, SAIL_BOTTOM = 4.62, 2.55
SAIL_BELLY = 0.55
MAST_TOP = 5.5

# ---------------------------------------------------------------- the hull: a short, tubby cog

def u_of(z):
    return (z - (Z_FWD + Z_AFT) / 2) / ((Z_FWD - Z_AFT) / 2)


def width_k(z):
    """Plan fullness: blunt, near full beam over most of the length, closing fast to a raked stem and sternpost."""
    return max(0.04, (1 - min(1.0, abs(u_of(z))) ** 3.0) ** 0.45)


RAKE_START = {1: 0.5, -1: 0.72}  # |u| where the bottom leaves the keel and runs straight up the stem / sternpost


def keel_y(z):
    """The bottom runs straight up from the keel to the rail at each end: a cog's raked, straight stem and sternpost."""
    u = u_of(z)
    u0 = RAKE_START[1 if u > 0 else -1]
    end = Z_FWD if u > 0 else Z_AFT
    return max(0.0, (abs(u) - u0) / (1 - u0)) * (sheer(end) - 0.02)


def sheer(z):
    """Rail height: low amidships, climbing to both ends where the castles sit."""
    return DECK + 0.32 + 0.55 * abs(u_of(z)) ** 2.2


# Outer half-profile as (fraction of the half beam, fraction of the height from keel to rail): flat floor, hard bilge,
# near-vertical clinker sides flaring a touch at the rail.
PROFILE = [(0.0, 0.0), (0.5, 0.03), (0.82, 0.12), (0.96, 0.3), (1.0, 0.55), (1.02, 0.8), (1.03, 1.0)]
COLUMNS = [Z_AFT + (Z_FWD - Z_AFT) * i / 24 for i in range(25)]


def outer(z):
    b, y0, r = HALF_BEAM * width_k(z), keel_y(z), sheer(z)
    return [(k * b, y0 + t * (r - y0)) for k, t in PROFILE]


def outer_x(z, y):
    pts = outer(z)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 > y0 else 0)
    return pts[-1][0]


AFT_FRONT, FORE_BACK = -1.25, 1.45  # where the waist ends at each castle


def hull_rail_x(z):
    return outer(z)[-1][0]


def build_hull():
    """One closed solid: keel, starboard skin, bulwark, deck, port bulwark, port skin; coloured per face by band."""
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
    ob = mesh_from("hull", verts, faces, "wood")
    ob["banded"] = True
    return ob


def hull_band(center_y, normal_up):
    """Swatch and shade of a hull face: grey bottom, warm clinker planks, dark upper strakes, a light deck."""
    if normal_up > 0.85 and abs(center_y - DECK) < 0.05:
        return "deck", 1.0
    if center_y < DRAFT:
        return "slate", 1.0
    if center_y < 1.02:
        return "wood", 0.92 if int(center_y / 0.16) % 2 else 1.0  # clinker strakes read as alternating bands
    return "woodDark", 1.0


def run_along_hull(name, y, h, proud, mat, z0, z1, shade=1.0):
    """A strip (wale, rubbing strake) following the skin at height y on both sides, standing `proud` of it."""
    zs = [z for z in COLUMNS if z0 <= z <= z1]
    for side in (1, -1):
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
        mesh_from(f"{name}-{side}", verts, faces, mat, shade)


def build_trim():
    # The wale: a dark band where the planks meet the upper strakes (contrast: dark on warm wood).
    run_along_hull("wale", 1.02, 0.12, 0.09, "woodDark", post_z(-1, 1.1) + 0.12, post_z(1, 1.1) - 0.12, shade=0.85)
    # Cap rail: a light board on the dark bulwark, overhanging it in and out.
    zs = [AFT_FRONT - 0.08] + [z for z in COLUMNS if AFT_FRONT < z < FORE_BACK] + [FORE_BACK + 0.08]
    for side in (1, -1):
        verts, faces = [], []
        for z in zs:
            xo = outer(z)[-1][0]
            s = sheer(z)
            for x, y in ((xo + 0.1, s - 0.03), (xo + 0.1, s + 0.13), (max(xo - RAIL - 0.08, 0.03), s + 0.13), (max(xo - RAIL - 0.08, 0.03), s - 0.03)):
                verts.append((side * x, y, z))
        for i in range(len(zs) - 1):
            for k in range(4):
                a, b = i * 4 + k, i * 4 + (k + 1) % 4
                faces.append([a, b, b + 4, a + 4])
        faces.append([0, 1, 2, 3])
        last = (len(zs) - 1) * 4
        faces.append([last, last + 1, last + 2, last + 3])
        mesh_from(f"cap-rail-{side}", verts, faces, "plaster")
    # Stem and sternpost: straight, raked timbers proud of the planking (a cog's signature straight ends).
    top_f, top_a = sheer(Z_FWD) + 0.15, sheer(Z_AFT) + 0.1
    beam("stem", (0, 0.0, post_z(1, 0.0) + 0.05), (0, top_f, post_z(1, top_f) + 0.05), 0.2, "woodDark", sides=4)
    beam("sternpost", (0, 0.0, post_z(-1, 0.0) - 0.05), (0, top_a, post_z(-1, top_a) - 0.05), 0.2, "woodDark", sides=4)


def post_z(sign, y):
    """z of the stem (sign 1) or sternpost (sign -1) at height y: the straight line where the bottom meets the end."""
    mid, half = (Z_FWD + Z_AFT) / 2, (Z_FWD - Z_AFT) / 2
    end = Z_FWD if sign > 0 else Z_AFT
    u = RAKE_START[sign] + (1 - RAKE_START[sign]) * min(1.0, max(0.0, y / (sheer(end) - 0.02)))
    return mid + sign * u * half


def build_rudder():
    """A cog's sternpost rudder: a broad blade hung right on the raked sternpost, iron straps across it."""

    def post(y):  # z of the sternpost's aft face
        return post_z(-1, y) - 0.1

    blade = [(post(0.1), 0.1), (post(0.1) - 0.55, 0.15), (post(0.85) - 0.5, 0.85), (post(0.95), 0.95)]
    verts = [(-0.07, y, z) for z, y in blade] + [(0.07, y, z) for z, y in blade]
    faces = [[0, 1, 2, 3], [7, 6, 5, 4]] + [[i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i] for i in range(4)]
    mesh_from("rudder", verts, faces, "woodDark", shade=0.9)
    for y in (0.3, 0.6, 0.85):
        box(f"rudder-strap-{y}", (0, y, post(y) - 0.2), (0.18, 0.07, 0.5), "metal", bevel=0.01)
    beam("rudder-stock", (0, 0.9, post(0.9) - 0.06), (0, 1.25, post(1.25) - 0.06), 0.14, "woodDark", sides=4)


# ---------------------------------------------------------------- the castles (fore and aft), crenellated

def crenellate(name, plan, y, size=0.26, step=0.4):
    """Merlons along every edge of a closed plan at height y, alternating red and white, a corner merlon at each vertex."""
    n = len(plan)
    k = 0
    for i in range(n):
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % n]
        ln = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(x1 - x0, z1 - z0)
        box(f"{name}-corner-{i}", (x0, y + size / 2 + 0.02, z0), (0.26, size + 0.04, 0.26), "roofRed", bevel=0.03, yaw=yaw)
        count = max(1, round(ln / step) - 1)
        for j in range(count):
            t = (j + 1) / (count + 1)
            x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            box(f"{name}-merlon-{k}", (x, y + size / 2, z), (0.2, size, 0.22), "marble" if j % 2 == 0 else "roofRed", bevel=0.03, yaw=yaw)
            k += 1



def castle(name, plan, base, top):
    """Sandstone panels in a dark timber frame: a deep corbel band at the foot, a corner post at every vertex, a thick
    dark coping that overhangs the walls, a planked floor sunk below it, and red-and-white merlons on the coping."""
    plan_solid(f"{name}-corbel", offset(plan, 0.08), base - 0.16, base + 0.1, "woodDark", shade=0.85)
    plan_solid(f"{name}-wall", plan, base, top, "sandstone")
    plan_ring(f"{name}-coping", offset(plan, 0.1), offset(plan, -0.3), top - 0.04, top + 0.14, "woodDark")
    plan_solid(f"{name}-floor", offset(plan, -0.18), top - 0.1, top + 0.06, "deck")
    for i, (x, z) in enumerate(plan):
        box(f"{name}-post-{i}", (x, (base + top) / 2, z), (0.2, top - base + 0.06, 0.2), "woodDark", bevel=0.03, shade=0.92)
    crenellate(name, offset(plan, -0.02), top + 0.12)



def hug(points):
    """Castle plan points (x, z) pushed out to stand just proud of the hull's rail where the hull is wider."""
    return [(math.copysign(max(abs(x), hull_rail_x(z) + 0.06), x) if abs(x) > 0.5 else x, z) for x, z in points]


def build_castles():
    base = DECK - 0.12  # the walls come down outside the bulwark, so castle and hull read as one build
    aft = hug([(1.45, AFT_FRONT), (1.3, -2.4), (0.92, -3.0), (-0.92, -3.0), (-1.3, -2.4), (-1.45, AFT_FRONT)])
    castle("aftcastle", aft, base, DECK + 1.05)
    framed_opening("aftcastle-door", (0, DECK + 0.38, AFT_FRONT + 0.03), (0.46, 0.68), False)
    for side in (1, -1):
        framed_opening(f"aftcastle-slit-{side}", (side * (aft[0][0] - 0.07 * 1.0) , DECK + 0.62, -1.85), (0.1, 0.34), True)
    # The forecastle overhangs the bow, pointed like the cog's raked stem.
    fore = hug([(1.4, FORE_BACK), (1.28, 2.45), (0.62, 3.3), (-0.62, 3.3), (-1.28, 2.45), (-1.4, FORE_BACK)])
    castle("forecastle", fore, base + 0.12, DECK + 1.0)
    framed_opening("forecastle-door", (0, DECK + 0.4, FORE_BACK - 0.03), (0.42, 0.6), False)
    for side in (1, -1):
        framed_opening(f"forecastle-slit-{side}", (side * (fore[0][0] - 0.05), DECK + 0.62, 1.95), (0.1, 0.3), True)
    # Knees under each overhang: dark brackets from the stem / sternpost and the hull's sides up to the castle's floor.
    for z_hull, y_hull, (x_top, z_top), y_top, nm in (
        (post_z(1, 0.95) - 0.05, 0.95, (0.0, 3.25), base + 0.04, "bow-c"),
        (post_z(1, 1.0) - 0.25, 1.0, (0.55, 3.22), base + 0.04, "bow-s"),
        (post_z(1, 1.0) - 0.25, 1.0, (-0.55, 3.22), base + 0.04, "bow-p"),
        (post_z(-1, 0.75) + 0.05, 0.75, (0.0, -2.95), base - 0.12, "stern-c"),
        (post_z(-1, 0.85) + 0.3, 0.85, (0.82, -2.92), base - 0.12, "stern-s"),
        (post_z(-1, 0.85) + 0.3, 0.85, (-0.82, -2.92), base - 0.12, "stern-p"),
    ):
        xh = math.copysign(max(0.0, outer_x(z_hull, y_hull) - 0.05), x_top) if x_top else 0.0
        beam(f"knee-{nm}", (xh, y_hull, z_hull), (x_top, y_top, z_top), 0.16, "woodDark", sides=4, shade=0.85)
    # Ladders up from the waist: chunky stiles that land on the deck and meet the coping.
    for name, z, d in (("aft", AFT_FRONT + 0.32, 1), ("fore", FORE_BACK - 0.32, -1)):
        for i in range(4):
            box(f"ladder-{name}-{i}", (0.85, DECK + 0.2 + i * 0.22, z - d * (0.06 + i * 0.06)), (0.44, 0.07, 0.14), "woodDark", bevel=0.01)
        for x in (0.64, 1.06):
            beam(f"ladder-{name}-rail-{x}", (x, DECK - 0.02, z), (x, DECK + 1.08, z - d * 0.3), 0.08, "woodDark", sides=4)


# ---------------------------------------------------------------- the rig: one mast, one wide square sail

def sail_z(x, y):
    """The sail's surface: hung 0.18 ahead of the mast, bellying forward (most in the middle, low down)."""
    t = (SAIL_TOP - y) / (SAIL_TOP - SAIL_BOTTOM)
    half = YARD_HALF - 0.08 + 0.15 * t  # the foot spreads a little wider, like a spread wing
    across = max(0.0, 1 - (x / half) ** 2)
    return MAST_Z + 0.18 + SAIL_BELLY * across * math.sin(math.pi * min(1, max(0, t)) * 0.85)


def sail_half(y):
    t = (SAIL_TOP - y) / (SAIL_TOP - SAIL_BOTTOM)
    return YARD_HALF - 0.08 + 0.15 * t


def build_sail():
    rows, cols = 10, 14
    verts = []
    for layer, dz in ((0, -0.02), (1, 0.02)):
        for r in range(rows + 1):
            t = r / rows
            y = SAIL_TOP - t * (SAIL_TOP - SAIL_BOTTOM)
            for c in range(cols + 1):
                x = -sail_half(y) + 2 * sail_half(y) * c / cols
                yy = y - 0.28 * (1 - (x / sail_half(y)) ** 2) * t ** 4  # the foot bows downward
                verts.append((x, yy, sail_z(x, yy) + dz))
    m = (rows + 1) * (cols + 1)
    faces = []
    idx = lambda L, r, c: L * m + r * (cols + 1) + c
    for r in range(rows):
        for c in range(cols):
            faces.append([idx(0, r, c), idx(0, r, c + 1), idx(0, r + 1, c + 1), idx(0, r + 1, c)])
            faces.append([idx(1, r, c), idx(1, r + 1, c), idx(1, r + 1, c + 1), idx(1, r, c + 1)])
    border = [(0, c) for c in range(cols)] + [(r, cols) for r in range(rows)] + [(rows, c) for c in range(cols, 0, -1)] + [(r, 0) for r in range(rows, 0, -1)]
    for i in range(len(border)):
        (r0, c0), (r1, c1) = border[i], border[(i + 1) % len(border)]
        faces.append([idx(0, r0, c0), idx(1, r0, c0), idx(1, r1, c1), idx(0, r1, c1)])
    mesh_from("sail", verts, faces, "canvas")


def build_sail_hem():
    rows, cols = 10, 14
    pts = []
    for c in range(cols + 1):
        x = -sail_half(SAIL_TOP) + 2 * sail_half(SAIL_TOP) * c / cols
        pts.append((x, SAIL_TOP))
    for r in range(1, rows + 1):
        y = SAIL_TOP - r / rows * (SAIL_TOP - SAIL_BOTTOM)
        pts.append((sail_half(y), y))
    for c in range(cols - 1, -1, -1):
        x = -sail_half(SAIL_BOTTOM) + 2 * sail_half(SAIL_BOTTOM) * c / cols
        pts.append((x, SAIL_BOTTOM - 0.28 * (1 - (x / sail_half(SAIL_BOTTOM)) ** 2)))
    for r in range(rows - 1, 0, -1):
        y = SAIL_TOP - r / rows * (SAIL_TOP - SAIL_BOTTOM)
        pts.append((-sail_half(y), y))
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        if i < cols:
            continue  # the head is lashed along the yard
        beam(f"sail-hem-{i}", (x0, y0, sail_z(x0, y0)), (x1, y1, sail_z(x1, y1)), 0.075, "rope", sides=5)


def on_sail(name, outline, cy, mat, lift):
    """A flat emblem piece laid onto the sail's front face: an outline of (x, y) around the sail, `lift` proud."""
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
    """A grey-blue roundel with a white albatross, wings spread wide like the sail itself."""
    cy = 3.62
    disc = [(math.cos(2 * math.pi * i / 28) * 0.78, math.sin(2 * math.pi * i / 28) * 0.78) for i in range(28)]
    on_sail("emblem-ring", [(x * 1.1, y * 1.1) for x, y in disc], cy, "marble", 0.035)
    on_sail("emblem-disc", disc, cy, "stone", 0.05)
    # The bird: long straight wings with a slight gull bend, a small body and tail.
    bird = [(-0.66, 0.1), (-0.3, 0.12), (-0.1, 0.06), (-0.06, 0.18), (0.06, 0.18), (0.1, 0.06), (0.3, 0.12), (0.66, 0.1),
            (0.62, 0.03), (0.3, -0.02), (0.1, -0.05), (0.07, -0.28), (0.0, -0.22), (-0.07, -0.28), (-0.1, -0.05), (-0.3, -0.02), (-0.62, 0.03)]
    on_sail("emblem-bird", bird, cy, "marble", 0.065)
    for s in (1, -1):
        on_sail(f"emblem-wingtip-{s}", [(s * 0.66, 0.1), (s * 0.5, 0.11), (s * 0.48, 0.0), (s * 0.62, 0.03)][:: s], cy, "dark", 0.075)


def build_rig():
    beam("mast", (0, DECK - 0.1, MAST_Z), (0, MAST_TOP, MAST_Z), 0.22, "woodDark", sides=8, taper=0.7)
    prism("mast-partner", (0, DECK - 0.02, MAST_Z), 0.26, 0.16, "woodDark", sides=8, top=0.8, shade=0.85)
    prism("mast-partner-ring", (0, DECK + 0.12, MAST_Z), 0.17, 0.07, "metal", sides=8)
    for y in (2.2, 3.2, 4.1):
        prism(f"mast-hoop-{y}", (0, y, MAST_Z), 0.135, 0.07, "metal", sides=8)
    prism("mast-cap", (0, MAST_TOP - 0.02, MAST_Z), 0.12, 0.12, "gold", sides=8)
    # Yard: a thick spar wider than the ship, with iron bands at its arms.
    beam("yard", (-YARD_HALF, YARD_Y, MAST_Z + 0.16), (YARD_HALF, YARD_Y, MAST_Z + 0.16), 0.14, "woodDark", sides=8)
    for s in (1, -1):
        beam(f"yard-band-{s}", (s * (YARD_HALF - 0.12), YARD_Y, MAST_Z + 0.16), (s * (YARD_HALF + 0.02), YARD_Y, MAST_Z + 0.16), 0.19, "plaster", sides=8)
    # Crow's nest (top castle): a round tub above the yard, crenellated rim to echo the castles.
    box("yard-sling", (0, YARD_Y, MAST_Z + 0.08), (0.24, 0.22, 0.2), "metal", bevel=0.02)
    # Cheeks under the top: a dark cone that carries the tub on the mast.
    prism("top-cheeks", (0, 4.6, MAST_Z), 0.13, 0.3, "woodDark", sides=10, top=2.6, shade=0.85)
    prism("top-tub", (0, 4.88, MAST_Z), 0.34, 0.36, "sandstone", sides=10, top=1.08)
    prism("top-band", (0, 4.86, MAST_Z), 0.38, 0.1, "woodDark", sides=10)
    prism("top-rim", (0, 5.2, MAST_Z), 0.42, 0.12, "woodDark", sides=10)
    for i in range(6):
        a = 2 * math.pi * i / 6
        box(f"top-merlon-{i}", (math.cos(a) * 0.36, 5.38, MAST_Z + math.sin(a) * 0.36), (0.16, 0.2, 0.16), "roofRed" if i % 2 == 0 else "marble", bevel=0.0, yaw=-a)
    # Bowsprit (a cog's bowline spar) and the stays.
    beam("bowsprit", (0, DECK + 0.45, 2.7), (0, 2.25, 4.05), 0.16, "woodDark", sides=8, taper=0.75)
    bs = lambda z: (0, DECK + 0.45 + (2.25 - DECK - 0.45) * (z - 2.7) / (4.05 - 2.7), z)
    beam("bowsprit-gammon", bs(3.3), bs(3.42), 0.25, "metal", sides=8)
    beam("bowsprit-cap", bs(3.88), bs(4.08), 0.17, "plaster", sides=8)
    beam("forestay", (0, 5.3, MAST_Z), bs(3.98), 0.04, "rope")
    beam("backstay", (0, 5.3, MAST_Z), (0, DECK + 1.15, -2.6), 0.035, "rope")
    for s in (1, -1):
        # Chainwale: a thick board standing out from the hull below the cap rail, where the shrouds land on deadeyes.
        cy = sheer(-0.7) - 0.18
        box(f"chainwale-{s}", (s * (hull_rail_x(-0.7) + 0.12), cy, -0.7), (0.24, 0.1, 1.0), "woodDark", bevel=0.02, shade=0.85)
        for z in (-0.45, -0.95):
            x = s * (hull_rail_x(-0.7) + 0.2)
            prism(f"deadeye-{s}-{z}", (x, cy + 0.05, z), 0.07, 0.14, "dark", sides=6)
            beam(f"chain-{s}-{z}", (x, cy - 0.05, z), (x - s * 0.02, cy - 0.4, z), 0.035, "metal", sides=4)
            beam(f"shroud-{s}-{z}", (0, 4.95, MAST_Z), (x, cy + 0.19, z), 0.04, "rope")
    # Pennant: drawn by code in the owner's colour; a stand-in triangle here.
    verts = [(0, 5.62, MAST_Z), (0, 5.9, MAST_Z), (0, 5.76, MAST_Z - 0.75), (0.02, 5.62, MAST_Z), (0.02, 5.9, MAST_Z), (0.02, 5.76, MAST_Z - 0.75)]
    mesh_from("pennant", verts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "pennant")
    beam("pennant-staff", (0, MAST_TOP, MAST_Z), (0, 5.92, MAST_Z), 0.04, "metal")


def build_stern_lantern():
    box("lantern-plate", (0, DECK + 0.75, -3.03), (0.2, 0.3, 0.06), "metal", bevel=0.01)
    beam("lantern-arm", (0, DECK + 0.82, -3.02), (0, DECK + 0.82, -3.38), 0.06, "metal", sides=4)
    beam("lantern-hook", (0, DECK + 0.82, -3.36), (0, DECK + 0.68, -3.36), 0.035, "metal", sides=4)
    box("lantern", (0, DECK + 0.52, -3.36), (0.22, 0.3, 0.22), "metal", bevel=0.02)
    box("lantern-glass", (0, DECK + 0.52, -3.36), (0.17, 0.2, 0.24), "gold", bevel=0.0)


def build_albatross_path():
    """The albatross's circle (code-drawn motion): a thin dotted guide ring and one bird stand-in on it."""
    cy, r = 6.6, 1.9
    for i in range(24):
        if i % 2:
            continue
        a0, a1 = 2 * math.pi * i / 24, 2 * math.pi * (i + 1) / 24
        beam(f"orbit-{i}", (math.cos(a0) * r, cy, 0.2 + math.sin(a0) * r), (math.cos(a1) * r, cy, 0.2 + math.sin(a1) * r), 0.025, "stone")
    bx, bz = r, 0.2
    verts = [(bx, cy, bz + 0.0), (bx - 0.05, cy, bz - 0.55), (bx + 0.05, cy, bz - 0.55), (bx - 0.05, cy, bz + 0.55), (bx + 0.05, cy, bz + 0.55)]
    box("albatross-body", (bx, cy, bz), (0.3, 0.1, 0.12), "marble", bevel=0.02, yaw=math.pi / 2)
    beam("albatross-wings", (bx, cy + 0.02, bz - 0.6), (bx, cy + 0.02, bz + 0.6), 0.07, "marble", sides=4)



ANCHORS = {
    "forecastle": (0, DECK + 0.6, 2.6),
    "aftcastle": (0, DECK + 0.6, -2.2),
    "merlons": (1.0, DECK + 1.2, -2.6),
    "fore_merlons": (0.9, DECK + 1.15, 2.8),
    "sail": (2.2, 3.4, MAST_Z + 0.3),
    "sail_edge": (YARD_HALF, YARD_Y, MAST_Z + 0.16),
    "sail_edge_neg": (-YARD_HALF, YARD_Y, MAST_Z + 0.16),
    "emblem": (0.0, 3.62, sail_z(0, 3.62) + 0.06),
    "crows_nest": (0.38, 5.1, MAST_Z),
    "pennant": (0, 5.76, MAST_Z - 0.6),
    "orbit": (-1.9, 6.6, 0.2),
    "orbit_pos": (1.9, 6.6, 0.2),
    "bowsprit": (0, 2.4, 4.0),
    "rudder": (0, 0.9, post_z(-1, 0.9) - 0.4),
    "slate": (1.5, 0.3, 0.2),
    "wood": (1.5, 0.75, 0.2),
    "wale": (1.6, 1.02, 0.2),
    "bulwark": (1.53, 1.35, 0.2),
    "cap": (1.6, sheer(0.2) + 0.05, 0.2),
    "deck": (0.0, DECK, -0.1),
    "deck_side": (-0.9, DECK, -0.1),
    "lantern": (0, DECK + 0.52, -3.36),
    "shroud": (0.9, 3.0, -0.3),
    "stem": (0, 0.9, post_z(1, 0.9) + 0.05),
    "water_bow": (0, DRAFT, 3.6),
    "water_stern": (0, DRAFT, -3.6),
    "keel": (0, 0, 0),
    "corner_post": (-1.45 - 0.06, DECK + 0.5, -1.25),
    "coping": (-1.0, DECK + 1.1, -3.0),
    "knee": (-0.4, 0.9, -2.85),
    "chainwale": (-(1.55 + 0.12), sheer(-0.7) - 0.18, -0.7),
    "gammon": (0, 2.05, 3.36),
    "hem": (-2.65, 3.6, MAST_Z + 0.2),
    "partner": (0, DECK + 0.05, MAST_Z),
    "top": (0, 6.6, 0),
    "box_top": (0, 5.6, 0),
    "beam_pos": (1.5, DECK, 0),
    "beam_neg": (-1.5, DECK, 0),
}


build_hull()
build_trim()
build_rudder()
build_castles()
build_sail()
build_sail_hem()
build_emblem()
build_rig()
build_stern_lantern()
build_albatross_path()
finish_blockout(
    ANCHORS,
    band=hull_band,
    skip=("hull", "sail", "emblem", "rudder", "wale", "cap-rail", "pennant", "aftcastle-", "forecastle-", "top-"),
    close_ups=lambda: {
        "near-bow": near((0, 1.9, 2.3), -55, 22, 3.6),
        "near-stern": near((0, 1.8, -2.3), -125, 22, 3.6),
        "near-waist": near((0, 1.7, 0.0), -80, 28, 4.2),
    },
)
