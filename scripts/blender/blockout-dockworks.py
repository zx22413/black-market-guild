"""Design sheet of the V0.8 prototype's dock works: the fitting-out staging that stands around a docked ship in the
round its skill is opened, and comes down at the launch to show the changed ship (the prototype's 造船廠, which every
player has: not a fourth building on the lot). An experiment, not rules. For the user to approve before modelling
(docs/proposals/2026-11-v08-presentation-plan.md).

  Blender -b --factory-startup --python scripts/blender/blockout-dockworks.py -- <render dir> [ship]

The ship is its exported model with its skill part (public/models/ships/<ship>-up.glb and <ship>-skill.glb), so without
its code-drawn sails. Ship space: bow +z, y up, the island and its pier astern (-z), the water at y = DRAFT.

It must not be taken for the 修船廠 (a slipway on land, a hull on it, an A-frame hoist, a green roof): this is a long
low staging on piles in the water along one side of the ship, hung with canvas in the player's colour, a work float
on the other side and a line of bunting over the deck. No hoist, no roof, nothing on land.

The ship-pick camera looks across the ship from port, so everything tall stands to starboard (behind the ship in that
shot) and the port side keeps only what is lower than the rail. Writes dockworks-<view>-off.png and -on.png.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ARGS = sys.argv[sys.argv.index("--") + 1 :]
OUT = ARGS[0]
SHIP = ARGS[1] if len(ARGS) > 1 else "standard"
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402
import bmesh  # noqa: E402

kit.SWATCHES["player"] = ("#4a7fd4", "#345fa8")  # the seat's colour in the game; blue stands in on the sheet
kit.SWATCHES["sea"] = ("#2fa3a8", "#27898e")
WATER = kit.DRAFT

# Part names here carry coordinates; Blender reads what follows a dot as a duplicate's number and chokes on a long one.
_finish = kit.finish
kit.finish = lambda bm, name, mat, shade=1.0: _finish(bm, name.replace(".", "_"), mat, shade)

# ---------------------------------------------------------------- the ship, as exported


def load_ship():
    hull = "freighter.glb" if SHIP == "freighter" else f"{SHIP}-up.glb"
    # The ship as it is before the skill (its plain hull), and after (the changed hull and the skill's part).
    for name, when in ((f"{SHIP}.glb", "before"), (hull, "after"), (f"{SHIP}-skill.glb", "after")):
        if name == hull and SHIP == "freighter":
            continue
        seen = set(kit.SCENE.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(kit.REPO, "public/models/ships", name))
        for ob in set(kit.SCENE.objects) - seen:
            if ob.type == "MESH":
                ob["model"] = when if SHIP != "freighter" or name != f"{SHIP}.glb" else "both"


def context():
    """What is there anyway, to judge the works against: the sea and the island's pier astern."""
    mesh_from("x-sea", [(-9, WATER, -8), (9, WATER, -8), (9, WATER, 7), (-9, WATER, 7)], [[0, 1, 2, 3]], "sea")
    box("x-pier", (0, WATER + 0.1, -6.4), (1.6, 0.5, 3.0), "wood", shade=0.9)
    for z in (-7.4, -5.4):
        for x in (-0.8, 0.8):
            beam(f"x-pier-pile{x}{z}", (x, WATER - 0.04, z), (x, WATER + 0.75, z), 0.22, "woodDark", sides=8)


# ---------------------------------------------------------------- the works

def half_width():
    """The hull's half width at the rail amidships (the ships differ: the freighter is half again as wide as the gamble),
    leaving out what sticks out further (oars, davits, yards)."""
    xs = []
    for ob in kit.SCENE.objects:
        if not ob.get("model"):
            continue
        for v in ob.data.vertices:
            w = ob.matrix_world @ v.co  # Blender space: x across, -y toward the bow, z up
            if ob.get("model") != "before" and abs(w.y) < 2.2 and WATER + 0.2 < w.z < 1.9:
                xs.append(abs(w.x))
    xs.sort()
    return xs[int(len(xs) * 0.97)] if xs else 1.2


load_ship()
HALF = half_width()
print(f"HALF WIDTH {SHIP} {HALF:.2f}")
# The staging's two rows of piles beside the hull, and the float's inner edge on the other side: both stand off the
# hull by the same gap whatever the ship (the game places the two pieces by the ship type's half width).
GAP = 0.42
STAGE_X = (HALF + GAP, HALF + GAP + 0.8)
FLOAT_X = -(HALF + 0.62)
CURTAIN_X = -(HALF + 0.3)  # the curtain hangs between the hull and the float
BAYS = (-3.0, -1.0, 1.0, 3.0)
LOW, HIGH = 1.75, 3.15  # the two plank levels: at the rail, and at the castles' tops
TOPS = {-3.0: 5.0, -1.0: 3.9, 1.0: 3.9, 3.0: 5.0}  # the end piles carry the bunting


def lashing(name, at, width=0.2):
    """A rope lashing where a ledger crosses a pile: a short fat ring round the joint, so nothing just touches."""
    prism(name, (at[0], at[1] - 0.08, at[2]), width, 0.16, "rope", sides=8)


def staging():
    """Two rows of piles standing in the water, tied by ledgers at two levels, cross-braced, planked, with a rail on the
    upper level and a ladder between the two."""
    inner, outer = STAGE_X
    for z in BAYS:
        top = TOPS[z]
        # The inner pile runs the whole height; the outer one stops under the upper rail. Both taper, both are capped.
        beam(f"works-pile-in{z}", (inner, WATER - 0.04, z), (inner, top, z), 0.2, "woodDark", sides=8, taper=0.75)
        beam(f"works-pile-out{z}", (outer, WATER - 0.04, z), (outer, HIGH + 0.75, z), 0.2, "woodDark", sides=8, taper=0.8)
        prism(f"works-cap-out{z}", (outer, HIGH + 0.75, z), 0.13, 0.06, "brass", sides=8)
        # Putlogs: the short cross beams the planks lie on, lashed to both piles and run out a little past them.
        for level in (LOW, HIGH):
            beam(f"works-putlog{z}{level}", (inner - 0.22, level - 0.08, z), (outer + 0.18, level - 0.08, z), 0.13, "wood", sides=6)
            lashing(f"works-lash-in{z}{level}", (inner, level - 0.08, z))
            lashing(f"works-lash-out{z}{level}", (outer, level - 0.08, z))
    for level in (LOW, HIGH):
        # Ledgers along the outer piles under the putlogs, then the planks: three boards a level, butt-jointed over a putlog.
        beam(f"works-ledger{level}", (outer, level - 0.24, BAYS[0] - 0.3), (outer, level - 0.24, BAYS[-1] + 0.3), 0.12, "wood", sides=6)
        for i, x in enumerate((inner + 0.02, (inner + outer) / 2, outer - 0.02)):
            for a, b in ((BAYS[0] - 0.35, -0.02), (0.02, BAYS[-1] + 0.35)):
                box(f"works-plank{level}{i}{a}", (x, level, (a + b) / 2), (0.24, 0.05, b - a), "deck", bevel=0.012, shade=0.94 + 0.05 * i)
    # Cross braces between the outer piles, bay by bay, lashed where they meet the piles.
    for a, b in zip(BAYS, BAYS[1:]):
        beam(f"works-brace{a}", (outer + 0.07, WATER + 0.25, a), (outer + 0.07, LOW - 0.3, b), 0.09, "wood", sides=6)
        beam(f"works-brace-x{a}", (outer + 0.07, LOW - 0.3, a), (outer + 0.07, WATER + 0.25, b), 0.09, "wood", sides=6)
    # The upper level's rail on the outboard side: a top rail through the piles, one mid rail.
    for y, w in ((HIGH + 0.62, 0.09), (HIGH + 0.32, 0.07)):
        beam(f"works-rail{y}", (outer, y, BAYS[0]), (outer, y, BAYS[-1]), w, "wood", sides=6)
    # The ladder from the lower level to the upper, leaning inboard-to-outboard in the stern bay, its feet on a cleat.
    foot, head = (inner + 0.2, LOW + 0.03, -2.5), (outer - 0.16, HIGH + 0.5, -1.5)
    for side in (-0.14, 0.14):
        beam(f"works-ladder{side}", (foot[0] + side, foot[1], foot[2]), (head[0] + side, head[1], head[2]), 0.06, "woodDark", sides=6)
    for i in range(1, 6):
        t = i / 6
        p = [foot[k] + (head[k] - foot[k]) * t for k in range(3)]
        beam(f"works-rung{i}", (p[0] - 0.14, p[1], p[2]), (p[0] + 0.14, p[1], p[2]), 0.045, "wood", sides=6)
    box("works-ladder-cleat", (foot[0], LOW + 0.045, foot[2] - 0.08), (0.42, 0.05, 0.08), "woodDark", bevel=0.01)
    # A gangplank from the lower level over to the ship's rail amidships, on a batten at each end.
    reach = GAP + 0.3
    box("works-gang", (inner - reach / 2 + 0.06, LOW + 0.02, 0.5), (reach + 0.12, 0.05, 0.46), "deck", bevel=0.012, shade=0.9)
    for z in (0.34, 0.66):
        box(f"works-gang-batten{z}", (inner - reach / 2 + 0.06, LOW + 0.06, z), (reach, 0.035, 0.05), "woodDark", bevel=0.008)
    # Toe boards along both levels, inside the outer piles (the canvas hangs outside them), and a kerb inboard: the
    # walkways' dark edges against the pale planks.
    for level in (LOW, HIGH):
        box(f"works-toe-out{level}", (outer - 0.13, level + 0.05, 0), (0.05, 0.13, BAYS[-1] - BAYS[0] + 0.7), "woodDark", bevel=0.012)
        box(f"works-toe-in{level}", (inner - 0.13, level + 0.02, 0), (0.05, 0.07, BAYS[-1] - BAYS[0] + 0.7), "woodDark", bevel=0.012)
    # Every pile is tarred black from under the water to a hand above it.
    for z in BAYS:
        for x in (inner, outer):
            prism(f"works-tar{x}{z}", (x, WATER - 0.04, z), 0.115, 0.34, "dark", sides=8)


def canvas():
    """Canvas in the player's colour laced along the staging's outboard side, between the two levels: the works' flag,
    and the backdrop the ship stands against from the ship-pick camera. Three sheets, each sagging between its piles."""
    outer = STAGE_X[1] + 0.13
    for n, (a, b) in enumerate(zip(BAYS, BAYS[1:])):
        cols = 6
        verts, faces = [], []
        for i in range(cols + 1):
            t = i / cols
            z = a + 0.12 + (b - a - 0.24) * t
            sag = 0.16 * math.sin(math.pi * t)
            belly = 0.08 * math.sin(math.pi * t)
            verts += [(outer + belly, HIGH + 0.25 - sag * 0.4, z), (outer + belly * 1.6, LOW + 0.15 + sag, z)]
        for i in range(cols):
            k = i * 2
            faces.append([k, k + 2, k + 3, k + 1])
        back = len(verts)
        verts += [(x - 0.03, y, z) for x, y, z in verts]
        faces += [[back + k for k in reversed(f)] for f in list(faces)]
        mesh_from(f"x-works-canvas{n}", verts, faces, "player" if n != 1 else "canvas")
        # Each sheet is bent to a spar at its head and weighted by a batten at its foot (pale wood against the colour),
        # with a hem of the other cloth down both sides.
        beam(f"works-canvas-spar{n}", (outer + 0.02, HIGH + 0.27, a + 0.06), (outer + 0.02, HIGH + 0.27, b - 0.06), 0.07, "deck", sides=6)
        beam(f"works-canvas-foot{n}", (outer + 0.13, LOW + 0.3, a + 0.14), (outer + 0.13, LOW + 0.3, b - 0.14), 0.06, "deck", sides=6)
        for z in (a + 0.12, b - 0.12):
            hem = [(outer + 0.012, HIGH + 0.25, z - 0.035), (outer + 0.012, HIGH + 0.25, z + 0.035), (outer + 0.012, LOW + 0.15, z + 0.035), (outer + 0.012, LOW + 0.15, z - 0.035)]
            mesh_from(f"x-works-hem{n}{z}", hem + [(x - 0.05, y, zz) for x, y, zz in hem], [[0, 1, 2, 3], [7, 6, 5, 4]], "canvas" if n != 1 else "player")
        # Laced to the top ledger by rings, tied down at the corners.
        for z in (a + 0.12, b - 0.12):
            beam(f"works-tie{n}{z}", (outer, HIGH + 0.25, z), (outer - 0.1, HIGH + 0.55, z), 0.035, "rope", sides=5)
            beam(f"works-tie-lo{n}{z}", (outer + 0.1, LOW + 0.15, z), (outer - 0.06, LOW - 0.2, z), 0.035, "rope", sides=5)


def awning():
    """A lean-to of canvas strips over the upper level, from the inner piles down to the outer rail: the works' colour
    seen from above (the table camera looks almost straight down, where the hung canvas is edge-on). Strips with gaps,
    lashed at their corners, not a roof."""
    inner, outer = STAGE_X
    for n, (a, b) in enumerate(zip(BAYS, BAYS[1:])):
        z0, z1 = a + 0.16, b - 0.16
        hi, lo = 3.78, HIGH + 0.7
        verts = [(inner + 0.02, hi, z0), (inner + 0.02, hi, z1), (outer + 0.2, lo, z1), (outer + 0.2, lo, z0)]
        # A little belly between the four corners.
        mid = [((inner + outer) / 2 + 0.11, (hi + lo) / 2 - 0.09, z0), ((inner + outer) / 2 + 0.11, (hi + lo) / 2 - 0.09, z1)]
        top = [verts[0], verts[1], mid[1], mid[0]]
        low = [mid[0], mid[1], verts[2], verts[3]]
        pts = top + low
        under = [(x, y - 0.03, z) for x, y, z in pts]
        mesh_from(f"x-works-awning{n}", pts + under, [[0, 1, 2, 3], [4, 5, 6, 7], [11, 10, 9, 8], [15, 14, 13, 12]], "canvas" if n == 1 else "player")
        beam(f"works-awning-foot{n}", (outer + 0.2, lo, z0 - 0.04), (outer + 0.2, lo, z1 + 0.04), 0.06, "deck", sides=6)
        for z in (z0, z1):
            beam(f"works-awning-tie{n}{z}", (inner + 0.02, hi, z), (inner, hi + 0.08, z + (0.14 if z == z1 else -0.14)), 0.035, "rope", sides=5)
            beam(f"works-awning-tie-lo{n}{z}", (outer + 0.2, lo, z), (outer, lo - 0.08, z + (0.14 if z == z1 else -0.14)), 0.035, "rope", sides=5)
    # The middle piles carry the awning's head: a ridge pole through all four inner piles.
    beam("works-ridge", (inner, 3.82, BAYS[0] - 0.2), (inner, 3.82, BAYS[-1] + 0.2), 0.09, "wood", sides=6)
    for z in BAYS:
        lashing(f"works-ridge-lash{z}", (inner, 3.82, z), 0.16)


def bunting():
    """A line of pennants from the stern end pile to the bow end pile, in the player's colour and white, facing the
    ship-pick camera."""
    inner = STAGE_X[0]
    a, b = (inner, TOPS[-3.0] - 0.12, -3.0), (inner, TOPS[3.0] - 0.12, 3.0)
    n = 9
    pts = []
    for i in range(n + 1):
        t = i / n
        # The line sags along the staging's inner piles, clear of the mast and its shrouds.
        pts.append((a[0] - 0.12 * math.sin(math.pi * t), a[1] - 0.55 * math.sin(math.pi * t), a[2] + (b[2] - a[2]) * t))
    for i, (p, q) in enumerate(zip(pts, pts[1:])):
        beam(f"works-line{i}", p, q, 0.03, "rope", sides=5)
        m = [(p[k] + q[k]) / 2 for k in range(3)]
        w = 0.5 * (q[2] - p[2])
        verts = [(m[0], m[1], m[2] - w * 0.42), (m[0], m[1], m[2] + w * 0.42), (m[0], m[1] - 0.42, m[2])]
        verts += [(x + 0.02, y, z) for x, y, z in verts]
        mesh_from(f"x-works-pennant{i}", verts, [[0, 1, 2], [5, 4, 3]], "player" if i % 2 == 0 else "marble")
    # The end piles' heads: a ring bolt the line is made fast to, and a brass cap.
    for z in (-3.0, 3.0):
        prism(f"works-head{z}", (inner, TOPS[z], z), 0.11, 0.07, "brass", sides=8)
        lashing(f"works-head-lash{z}", (inner, TOPS[z] - 0.12, z), 0.15)


def sign():
    """A board hung from a bracket on the bow end pile, facing the table: the works' mark (a mallet and an adze crossed),
    so the staging is not taken for a pier."""
    inner, z = STAGE_X[0], 3.0
    y = 4.35
    beam("works-sign-arm", (inner, y + 0.42, z), (inner, y + 0.42, z + 0.95), 0.08, "woodDark", sides=6)
    beam("works-sign-strut", (inner, y - 0.1, z), (inner, y + 0.4, z + 0.62), 0.06, "woodDark", sides=6)
    for dz in (0.3, 0.8):
        beam(f"works-sign-chain{dz}", (inner, y + 0.4, z + dz), (inner, y + 0.2, z + dz), 0.03, "metal", sides=5)
    box("works-sign-board", (inner, y - 0.12, z + 0.55), (0.07, 0.62, 0.78), "wood", bevel=0.02)
    box("works-sign-frame", (inner, y - 0.12, z + 0.55), (0.05, 0.7, 0.86), "woodDark", bevel=0.02)
    # The mark on both faces: a mallet (head and handle) crossed with an adze, in brass.
    for face in (-1, 1):
        x = inner + face * 0.045
        beam(f"works-mark-handle{face}", (x, y - 0.34, z + 0.32), (x, y + 0.06, z + 0.74), 0.05, "brass", sides=6)
        box(f"works-mark-head{face}", (x, y + 0.06, z + 0.74), (0.035, 0.14, 0.26), "brass", bevel=0.01)
        beam(f"works-mark-adze{face}", (x, y - 0.34, z + 0.78), (x, y + 0.08, z + 0.36), 0.05, "brass", sides=6)
        box(f"works-mark-blade{face}", (x, y + 0.08, z + 0.36), (0.035, 0.2, 0.12), "brass", bevel=0.01)


def work_float():
    """A work float on the port quarter: logs lashed under a plank deck, low enough for the ship-pick camera to look
    over it, with what the yard brought: a tar barrel, a stack of planks, a paint tub, a short ladder up the hull."""
    x1 = FLOAT_X
    x0, z0, z1 = x1 - 1.3, -2.6, -0.2
    for i in range(5):
        x = x0 + 0.13 + i * (x1 - x0 - 0.26) / 4
        beam(f"works-log{i}", (x, WATER + 0.02, z0 - 0.15), (x, WATER + 0.02, z1 + 0.15), 0.26, "woodDark", sides=8)
    for z in (z0 + 0.25, z1 - 0.25):
        beam(f"works-float-tie{z}", (x0 - 0.05, WATER + 0.17, z), (x1 + 0.05, WATER + 0.17, z), 0.1, "wood", sides=6)
    for x in (x0 + 0.05, x1 - 0.05):
        box(f"works-float-rim{x}", (x, WATER + 0.25, (z0 + z1) / 2), (0.07, 0.09, z1 - z0 - 0.6), "woodDark", bevel=0.012)
    box("works-float-deck", ((x0 + x1) / 2, WATER + 0.21, (z0 + z1) / 2), (x1 - x0 - 0.1, 0.06, z1 - z0 - 0.7), "deck", bevel=0.015)
    # Moored to the hull by two lines on ring bolts.
    for z in (z0 + 0.3, z1 - 0.3):
        beam(f"works-moor{z}", (x1, WATER + 0.26, z), (-HALF + 0.05, 1.0, z), 0.035, "rope", sides=5)
    # The tar barrel on a pad, hooped; the tub beside it; the plank stack on bearers.
    box("works-barrel-pad", (x1 -0.90, WATER + 0.26, -2.0), (0.5, 0.04, 0.5), "woodDark", bevel=0.01)
    prism("works-barrel", (x1 -0.90, WATER + 0.28, -2.0), 0.2, 0.46, "wood", sides=10)
    for y in (0.36, 0.64):
        prism(f"works-hoop{y}", (x1 -0.90, WATER + y, -2.0), 0.21, 0.04, "metal", sides=10)
    prism("works-tub", (x1 -0.40, WATER + 0.24, -2.1), 0.15, 0.18, "woodDark", sides=8, top=1.15)
    prism("works-tub-paint", (x1 -0.40, WATER + 0.4, -2.1), 0.15, 0.02, "player", sides=8)
    for z in (x1 +0.10, -0.75):
        box(f"works-bearer{z}", (x1 -0.65, WATER + 0.27, z), (0.9, 0.05, 0.08), "woodDark", bevel=0.01)
    for i in range(3):
        box(f"works-stack{i}", (x1 -0.65, WATER + 0.325 + i * 0.06, -1.05), (0.8 - i * 0.12, 0.05, 1.1), "deck", bevel=0.012, shade=0.9 + i * 0.05)


def curtain():
    """The curtain on the side the ship-pick camera looks from: two tall poles on the float's side, a line between them,
    and one great sheet in the player's colour with the yard's mark, which hides the ship while the yard works and is
    let fall to show it. The poles are stepped in tubs lashed to stakes; the sheet runs on rings."""
    x, top = CURTAIN_X, 5.35
    for z in (-3.35, 3.35):
        beam(f"curtain-pole{z}", (x, WATER - 0.04, z), (x, top, z), 0.17, "woodDark", sides=8, taper=0.7)
        prism(f"curtain-tar{z}", (x, WATER - 0.04, z), 0.1, 0.34, "dark", sides=8)
        prism(f"curtain-cap{z}", (x, top, z), 0.09, 0.07, "brass", sides=8)
        # A stay from each pole's head down to a stake further out, so a pole with a sheet on it does not stand alone.
        beam(f"curtain-stay{z}", (x, top - 0.15, z), (x - 1.1, WATER + 0.3, z * 1.12), 0.035, "rope", sides=5)
        beam(f"curtain-stake{z}", (x - 1.1, WATER - 0.04, z * 1.12), (x - 1.1, WATER + 0.45, z * 1.12), 0.12, "woodDark", sides=8)
    n = 12
    line = []
    for i in range(n + 1):
        t = i / n
        line.append((x, top - 0.15 - 0.3 * math.sin(math.pi * t), -3.35 + 6.7 * t))
    for i, (p, q) in enumerate(zip(line, line[1:])):
        beam(f"curtain-line{i}", p, q, 0.04, "rope", sides=5)
    foot = WATER + 0.55
    verts, faces = [], []
    for i, (lx, ly, lz) in enumerate(line):
        fold = 0.07 * (1 if i % 2 == 0 else -1)
        verts += [(lx + fold * 0.3, ly - 0.06, lz), (lx + fold, (ly + foot) / 2, lz), (lx + fold * 1.3, foot, lz)]
    for i in range(n):
        k = i * 3
        faces += [[k, k + 3, k + 4, k + 1], [k + 1, k + 4, k + 5, k + 2]]
    back = len(verts)
    verts += [(vx + 0.03, vy, vz) for vx, vy, vz in verts]
    faces += [[back + k for k in reversed(f)] for f in list(faces)]
    mesh_from("x-curtain-sheet", verts, faces, "player")
    # A cream band along the head and the foot, and the rings the sheet runs on.
    for y0, y1, name in ((top - 0.52, top - 0.86, "head"), (foot + 0.34, foot, "foot")):
        band = [(x - 0.09, y0 - (0.3 * math.sin(math.pi * i / n) if name == "head" else 0), -3.35 + 6.7 * i / n) for i in range(n + 1)]
        bv = []
        for bx, by, bz in band:
            bv += [(bx, by, bz), (bx, by - abs(y0 - y1), bz)]
        mesh_from(f"x-curtain-band-{name}", bv + [(vx - 0.02, vy, vz) for vx, vy, vz in bv], [[i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2] for i in range(n)], "canvas")
    for i in range(1, n, 2):
        prism(f"curtain-ring{i}", (line[i][0], line[i][1] - 0.07, line[i][2]), 0.07, 0.06, "brass", sides=8)
    # The yard's mark on the sheet, large: the mallet and the adze of the sign, in cream.
    cx, cy = x - 0.11, (top + foot) / 2 - 0.1
    beam("curtain-mark-handle", (cx, cy - 0.85, -0.75), (cx, cy + 0.55, 0.65), 0.16, "canvas", sides=6)
    box("curtain-mark-head", (cx, cy + 0.6, 0.7), (0.06, 0.42, 0.8), "canvas", bevel=0.02)
    beam("curtain-mark-adze", (cx, cy - 0.85, 0.75), (cx, cy + 0.55, -0.65), 0.16, "canvas", sides=6)
    box("curtain-mark-blade", (cx, cy + 0.62, -0.7), (0.06, 0.6, 0.36), "canvas", bevel=0.02)


def splashes():
    """Where the piles break the water as they come up: a white ring round each."""
    rings = [(x, z) for z in BAYS for x in STAGE_X] + [(CURTAIN_X, -3.35), (CURTAIN_X, 3.35)]
    for x, z in rings:
        prism(f"x-splash{x}{z}", (x, WATER + 0.01, z), 0.34, 0.03, "marble", sides=10)


def puff(name, at, r, shade=1.0):
    """One ball of work dust: a low icosphere, flat shaded, cream."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    for v in bm.verts:
        v.co = V(at[0] + v.co.x, at[1] + v.co.z, at[2] - v.co.y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit.finish(bm, name, "marble", shade)


def smoke():
    """The yard at work behind its curtain: balls of dust boiling up over the sheet and out at both ends, bigger low
    down, smaller as they rise (in the game each grows, drifts up and fades)."""
    spots = [
        (0.2, 4.9, -2.4, 1.0), (-0.5, 5.5, -1.3, 0.8), (0.4, 5.2, -0.2, 1.1), (-0.3, 5.9, 0.9, 0.75), (0.3, 5.0, 2.1, 0.95),
        (-0.2, 6.4, -0.4, 0.55), (0.5, 6.1, 1.6, 0.5), (-0.6, 4.4, 3.5, 0.8), (0.4, 4.2, -3.7, 0.85), (CURTAIN_X - 0.3, 1.2, 3.9, 0.6),
        (CURTAIN_X - 0.3, 1.1, -3.9, 0.65), (STAGE_X[1] + 0.3, 4.6, 0.3, 0.7), (0.0, 6.9, 0.6, 0.35),
    ]
    for i, (x, y, z, r) in enumerate(spots):
        puff(f"x-smoke{i}", (x, y, z), r, shade=0.86 + 0.14 * ((i * 37) % 10) / 10)
    # Stars of the hammers' blows over the sheet, in gold.
    for i, (x, y, z) in enumerate(((-0.9, 5.9, -2.2), (0.9, 6.3, 0.4), (-0.4, 5.6, 2.6))):
        for k in range(4):
            a = math.pi * k / 4
            beam(f"x-spark{i}{k}", (x, y - 0.3 * math.sin(a), z - 0.3 * math.cos(a)), (x, y + 0.3 * math.sin(a), z + 0.3 * math.cos(a)), 0.07, "gold", sides=4)


def glow():
    """The work is done: gold light as the curtain falls. A ring of light on the water round the hull, rays fanning up
    from the ship, and stars over it (in the game the ring spreads and fades, the rays sweep once, the changed parts of
    the ship flash gold)."""
    n = 28
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        rx, rz = HALF + 1.5, 5.2
        p = (math.sin(a0) * rx, WATER + 0.03, math.cos(a0) * rz)
        q = (math.sin(a1) * rx, WATER + 0.03, math.cos(a1) * rz)
        beam(f"x-glow-ring{i}", p, q, 0.22, "gold", sides=4)
    # Rays from the middle of the ship, up and outward all round, longer straight up than low down.
    for i in range(14):
        a = 2 * math.pi * i / 14
        for tilt, reach in ((0.55, 4.2), (1.1, 5.0)):
            d = (math.sin(a) * math.cos(tilt), math.sin(tilt), math.cos(a) * math.cos(tilt))
            start = [c * 2.6 for c in d]
            end = [c * (2.6 + reach * (0.6 if (i + (tilt > 1)) % 2 else 1.0)) for c in d]
            beam(f"x-glow-ray{i}{tilt}", (start[0], 2.4 + start[1], start[2]), (end[0], 2.4 + end[1], end[2]), 0.16, "gold", sides=4, taper=0.15)
    for i, (x, y, z, r) in enumerate(((-1.6, 6.6, -2.0, 0.5), (1.4, 7.2, 0.6, 0.62), (-0.6, 6.0, 2.8, 0.42), (2.2, 5.4, -3.0, 0.38), (-2.4, 4.8, 1.2, 0.36))):
        for k in range(4):
            a = math.pi * k / 4
            long = r if k % 2 == 0 else r * 0.5
            beam(f"x-glow-star{i}{k}", (x, y - long * math.sin(a), z - long * math.cos(a)), (x, y + long * math.sin(a), z + long * math.cos(a)), 0.09, "gold", sides=4)
            beam(f"x-glow-star-x{i}{k}", (x - long * math.cos(a), y - long * math.sin(a), z), (x + long * math.cos(a), y + long * math.sin(a), z), 0.09, "gold", sides=4)


def fallen():
    """The curtain let go: the sheet lying in folds on the water under its line."""
    x = CURTAIN_X
    for i in range(7):
        z = -2.9 + i * 0.97
        box(f"x-fallen{i}", (x - 0.25 - 0.1 * (i % 2), WATER + 0.05, z), (0.9 + 0.2 * (i % 3), 0.07, 0.8), "player", bevel=0.03, yaw=0.25 * (i % 3 - 1))


# ---------------------------------------------------------------- render

context()
first = len(PARTS)


def built(fn):
    """The parts one builder adds."""
    start = len(PARTS)
    fn()
    return [ob for ob, _, _ in PARTS[start:]]


frame = built(staging)
piles = [ob for ob in frame if ob.name.startswith(("works-pile", "works-tar", "works-cap"))]
frame = [ob for ob in frame if ob not in piles]
cloth = built(canvas) + built(awning) + built(bunting) + built(sign)
raft = built(work_float)
drape = built(curtain)
poles = [ob for ob in drape if ob.name.startswith(("curtain-pole", "curtain-tar", "curtain-cap", "curtain-stake"))]
drape = [ob for ob in drape if ob not in poles]
rings = built(splashes)
dust = built(smoke)
heap = built(fallen)
shine = built(glow)
works = piles + frame + cloth + raft
extras = poles + drape + rings + dust + heap + shine
colour_parts()
check_normals(skip=("x-",))
setup_render()
kit.SCENE.render.line_thickness = 1.0
glb = bpy.data.materials.new("glb")
glb.use_nodes = True
vc = glb.node_tree.nodes.new("ShaderNodeVertexColor")
glb.node_tree.links.new(vc.outputs["Color"], glb.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
for ob in kit.SCENE.objects:
    if ob.get("model"):
        ob.data.materials.clear()
        ob.data.materials.append(glb)


def orbit(name, azimuth, elevation, target, scale, res):
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * 60
    return camera(name, V(*(t + d)), V(*t), scale, res)


top = max((ob.matrix_world @ v.co).z for ob in works for v in ob.data.vertices)
print(f"HEIGHT dock works reach {top:.2f} (ship-pick box {SHIP_BOX_TOP})")
VIEWS = {
    # The table camera on your own ship (from astern, about 54 degrees down), the ship-pick camera's side, the far side
    # the other players see across the table, and straight down.
    "own": orbit("cam-own", 180, 54, (0.3, 2.0, 0.0), 12.5, (1000, 900)),
    "side": orbit("cam-side", -68, 18, (0.3, 2.7, 0.0), 12.5, (1000, 900)),
    "far": orbit("cam-far", 55, 30, (0.3, 2.4, 0.0), 12.5, (1000, 900)),
    "top": orbit("cam-top", 180, 89, (0.3, 0, 0.0), 12.5, (1000, 900)),
    "near": orbit("cam-near", 120, 22, (2.0, 2.6, -1.6), 5.2, (1000, 900)),
}
os.makedirs(OUT, exist_ok=True)
models = [ob for ob in kit.SCENE.objects if ob.get("model")]


def show(parts, ship):
    """Only `parts` of the works on screen, and the ship as it is `before` or `after` the skill."""
    for ob in works + extras:
        ob.hide_render = ob not in parts
    for ob in models:
        ob.hide_render = ob["model"] not in (ship, "both")


def render(name, views):
    for view in views:
        cam, (w, h) = VIEWS[view]
        kit.SCENE.camera = cam
        kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
        kit.SCENE.render.filepath = os.path.join(OUT, f"dockworks-{view}-{name}.png")
        bpy.ops.render.render(write_still=True)


# The sheet's two states (the works as they stand open while you load the ship), then the six beats of the show.
show([], "after")
render("off", ("own", "side"))
show(works, "after")
render("on", ("own", "side", "far", "top", "near"))
BEATS = [
    ("1-piles", piles + poles + rings, "before"),
    ("2-frame", piles + poles + frame + raft, "before"),
    ("3-covered", works + poles + drape, "before"),
    ("4-working", works + poles + drape + dust, "before"),
    ("5-unveiled", works + poles + heap + shine, "after"),
    ("6-struck", rings, "after"),
]
for name, parts, ship in BEATS:
    show(parts, ship)
    render(name, ("side", "own"))
print("RENDERED dock works", len(works), "parts")
