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

kit.SWATCHES["player"] = ("#4a7fd4", "#345fa8")  # the seat's colour in the game; blue stands in on the sheet
kit.SWATCHES["sea"] = ("#2fa3a8", "#27898e")
WATER = kit.DRAFT

# Part names here carry coordinates; Blender reads what follows a dot as a duplicate's number and chokes on a long one.
_finish = kit.finish
kit.finish = lambda bm, name, mat, shade=1.0: _finish(bm, name.replace(".", "_"), mat, shade)

# ---------------------------------------------------------------- the ship, as exported


def load_ship():
    hull = "freighter.glb" if SHIP == "freighter" else f"{SHIP}-up.glb"
    for name in (hull, f"{SHIP}-skill.glb"):
        bpy.ops.import_scene.gltf(filepath=os.path.join(kit.REPO, "public/models/ships", name))
    for ob in kit.SCENE.objects:
        if ob.type == "MESH":
            ob["model"] = True


def context():
    """What is there anyway, to judge the works against: the sea and the island's pier astern."""
    mesh_from("x-sea", [(-9, WATER, -8), (9, WATER, -8), (9, WATER, 7), (-9, WATER, 7)], [[0, 1, 2, 3]], "sea")
    box("x-pier", (0, WATER + 0.1, -6.4), (1.6, 0.5, 3.0), "wood", shade=0.9)
    for z in (-7.4, -5.4):
        for x in (-0.8, 0.8):
            beam(f"x-pier-pile{x}{z}", (x, WATER - 0.04, z), (x, WATER + 0.75, z), 0.22, "woodDark", sides=8)


# ---------------------------------------------------------------- the works

STAGE_X = (1.62, 2.42)  # the staging's two rows of piles, starboard of the hull
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
    box("works-gang", (inner - 0.36, LOW + 0.02, 0.5), (0.72, 0.05, 0.46), "deck", bevel=0.012, shade=0.9)
    for z in (0.34, 0.66):
        box(f"works-gang-batten{z}", (inner - 0.36, LOW + 0.06, z), (0.6, 0.035, 0.05), "woodDark", bevel=0.008)


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
    x0, x1, z0, z1 = -2.75, -1.45, -2.6, -0.2
    for i in range(5):
        x = x0 + 0.13 + i * (x1 - x0 - 0.26) / 4
        beam(f"works-log{i}", (x, WATER + 0.02, z0 - 0.15), (x, WATER + 0.02, z1 + 0.15), 0.26, "woodDark", sides=8)
    for z in (z0 + 0.25, z1 - 0.25):
        beam(f"works-float-tie{z}", (x0 - 0.05, WATER + 0.17, z), (x1 + 0.05, WATER + 0.17, z), 0.1, "wood", sides=6)
    box("works-float-deck", ((x0 + x1) / 2, WATER + 0.21, (z0 + z1) / 2), (x1 - x0 - 0.1, 0.06, z1 - z0 - 0.7), "deck", bevel=0.015)
    # Moored to the hull by two lines on ring bolts.
    for z in (z0 + 0.3, z1 - 0.3):
        beam(f"works-moor{z}", (x1, WATER + 0.26, z), (-1.0, 1.0, z), 0.035, "rope", sides=5)
    # The tar barrel on a pad, hooped; the tub beside it; the plank stack on bearers.
    box("works-barrel-pad", (-2.35, WATER + 0.26, -2.0), (0.5, 0.04, 0.5), "woodDark", bevel=0.01)
    prism("works-barrel", (-2.35, WATER + 0.28, -2.0), 0.2, 0.46, "wood", sides=10)
    for y in (0.36, 0.64):
        prism(f"works-hoop{y}", (-2.35, WATER + y, -2.0), 0.21, 0.04, "metal", sides=10)
    prism("works-tub", (-1.85, WATER + 0.24, -2.1), 0.15, 0.18, "woodDark", sides=8, top=1.15)
    prism("works-tub-paint", (-1.85, WATER + 0.4, -2.1), 0.15, 0.02, "player", sides=8)
    for z in (-1.35, -0.75):
        box(f"works-bearer{z}", (-2.1, WATER + 0.27, z), (0.9, 0.05, 0.08), "woodDark", bevel=0.01)
    for i in range(3):
        box(f"works-stack{i}", (-2.1, WATER + 0.325 + i * 0.06, -1.05), (0.8 - i * 0.12, 0.05, 1.1), "deck", bevel=0.012, shade=0.9 + i * 0.05)
    # The ladder up the ship's side, hooked over the rail.
    for dz in (-0.13, 0.13):
        beam(f"works-side-ladder{dz}", (-1.5, WATER + 0.26, -0.55 + dz), (-1.02, 1.8, -0.55 + dz), 0.055, "woodDark", sides=6)
    for i in range(1, 5):
        t = i / 5
        beam(f"works-side-rung{i}", (-1.5 + 0.48 * t, WATER + 0.26 + 1.54 * t - 0.26 * t + 0.0, -0.68), (-1.5 + 0.48 * t, WATER + 0.26 + 1.28 * t, -0.42), 0.04, "wood", sides=6)


# ---------------------------------------------------------------- render

load_ship()
context()
first = len(PARTS)
staging()
canvas()
awning()
bunting()
sign()
work_float()
works = [ob for ob, _, _ in PARTS[first:]]
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
for state in ("off", "on"):
    for ob in works:
        ob.hide_render = state == "off"
    for name, (cam, (w, h)) in VIEWS.items():
        if state == "off" and name in ("near", "top", "far"):
            continue
        kit.SCENE.camera = cam
        kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
        kit.SCENE.render.filepath = os.path.join(OUT, f"dockworks-{name}-{state}.png")
        bpy.ops.render.render(write_still=True)
print("RENDERED dock works", len(works), "parts")
