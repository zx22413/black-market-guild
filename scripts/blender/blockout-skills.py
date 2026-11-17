"""Design sheet of the V0.8 prototype's five ship skills: one part added to each ship, rendered with and without it,
for the user to approve before modelling (docs/proposals/2026-11-v08-presentation-plan.md step 3). An experiment, not
rules. An opened skill must change the ship itself at a glance: one distinct attached part per skill, not a badge.

  Blender -b --factory-startup --python scripts/blender/blockout-skills.py -- <ship> <render dir>

Four ships are their approved blockouts (scripts/blender/blockout-<ship>.py, built by the same calls as their own
sheets); the freighter is its exported model (public/models/ships/freighter.glb, so without its code-drawn sails).
Writes <ship>-<view>-off.png and <ship>-<view>-on.png: `own` is the table camera on your own ship (seen from astern,
about 54 degrees down), `side` the ship-pick camera's side.
"""

import importlib.util
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ARGS = sys.argv[sys.argv.index("--") + 1 :]
SHIP, OUT = ARGS[0], ARGS[1]
# The ship blockouts read their own options after `--`; they must not see ours.
sys.argv = sys.argv[: sys.argv.index("--") + 1] + [OUT]
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402

kit.SWATCHES.update({"iron": ("#5a5f66", "#3f4349"), "foam": ("#f4fbff", "#cfe6f2"), "wave": ("#3fb6c2", "#1f7f96"), "shroud": ("#3b3350", "#262036")})
band = None
if SHIP == "freighter":
    bpy.ops.import_scene.gltf(filepath=os.path.join(kit.REPO, "public/models/ships/freighter.glb"))
    for ob in list(kit.SCENE.objects):
        if ob.type != "MESH":
            continue
        ob.rotation_euler = (math.radians(90), 0, 0) if False else ob.rotation_euler
        ob["model"] = True
    design = None
else:
    path = os.path.join(HERE, f"blockout-{SHIP}.py")
    spec = importlib.util.spec_from_file_location(f"blockout_{SHIP}", path)
    design = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(design)
    # The builders its own sheet runs, in order (the lines between `if __name__` and `finish_blockout(`).
    body = open(path).read().split('if __name__ == "__main__":')[1].split("finish_blockout(")[0]
    scope = dict(vars(design))
    exec("\n".join(line[4:] for line in body.splitlines() if line.strip()), scope)  # noqa: S102
    band = design.hull_band


def lathe(name, base, profile, mat, sides=12, shade=1.0):
    verts, faces = [], []
    for r, y in profile:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((base[0] + math.cos(a) * r, y, base[1] + math.sin(a) * r))
    n = len(profile)
    for k in range(n - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append([k * sides + i, (k + 1) * sides + i, (k + 1) * sides + j, k * sides + j])
    faces.append(list(range(sides)))
    faces.append(list(reversed(range((n - 1) * sides, n * sides))))
    return mesh_from(name, verts, faces, mat, shade)


def slab_x(name, outline, x0, x1, mat, shade=1.0):
    """A (z, y) outline pulled across the ship from x0 to x1."""
    n = len(outline)
    verts = [(x0, y, z) for z, y in outline] + [(x1, y, z) for z, y in outline]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def ball(name, centre, radius, mat):
    profile = [(max(0.02, radius * math.sin(math.pi * k / 6)), centre[1] - radius * math.cos(math.pi * k / 6)) for k in range(7)]
    return lathe(name, (centre[0], centre[2]), profile, mat, sides=10)


def standard_skill():
    """好兆頭: a gilded albatross with its wings spread, perched on the peak of the lookout tower (the ship is named for
    it; the owner looks at the stern)."""
    y0 = DECK + 1.6  # so that y0 + 0.9 is the peak of the lookout tower's roof (standard_build)
    z = -2.3
    lathe("skill-perch-stem", (0, z), [(0.12, y0 + 0.86), (0.07, y0 + 1.06)], "gold", sides=8)
    lathe("skill-perch", (0, z), [(0.2, y0 + 1.04), (0.2, y0 + 1.1)], "gold", sides=8)
    yb = y0 + 1.26
    beam("skill-body", (0, yb, z - 0.42), (0, yb + 0.1, z + 0.4), 0.42, "gold", sides=8, taper=0.6)
    ball("skill-head", (0, yb + 0.22, z + 0.52), 0.2, "gold")
    beam("skill-beak", (0, yb + 0.2, z + 0.66), (0, yb + 0.12, z + 0.98), 0.12, "brass", sides=4, taper=0.3)
    beam("skill-tail", (0, yb - 0.02, z - 0.4), (0, yb - 0.08, z - 0.8), 0.3, "gold", sides=4, taper=0.3)
    for s in (-1, 1):
        # Each wing in two reaches: a broad arm from the shoulder and a long swept hand.
        mesh_from(f"skill-wing-a{s}", [(s * 0.12, yb + 0.1, z + 0.28), (s * 0.12, yb + 0.04, z - 0.3), (s * 0.95, yb + 0.42, z - 0.36), (s * 0.9, yb + 0.5, z + 0.12),
                                      (s * 0.12, yb + 0.02, z + 0.28), (s * 0.12, yb - 0.04, z - 0.3), (s * 0.95, yb + 0.34, z - 0.36), (s * 0.9, yb + 0.42, z + 0.12)],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "gold", convex=True)
        mesh_from(f"skill-wing-b{s}", [(s * 0.9, yb + 0.5, z + 0.12), (s * 0.95, yb + 0.42, z - 0.36), (s * 1.7, yb + 0.36, z - 0.72), (s * 1.55, yb + 0.44, z - 0.3),
                                      (s * 0.9, yb + 0.43, z + 0.12), (s * 0.95, yb + 0.35, z - 0.36), (s * 1.7, yb + 0.31, z - 0.72), (s * 1.55, yb + 0.39, z - 0.3)],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "roofGold", convex=True)


def gambler_skill():
    """加注: the stake itself on deck: an iron-bound chest standing open, heaped with coin, lashed down to ring bolts."""
    z, y = -0.72, DECK + 0.42  # on a stake table, clear of the rail
    box("skill-table", (0, DECK + 0.36, z), (1.15, 0.1, 0.86), "woodDark", bevel=0.02)
    for sx in (-0.48, 0.48):
        for sz in (-0.32, 0.32):
            beam(f"skill-table-leg{sx}{sz}", (sx, DECK, z + sz), (sx, DECK + 0.34, z + sz), 0.12, "wood", sides=4)
    box("skill-table-cloth", (0, DECK + 0.4, z), (1.0, 0.04, 0.72), "roofRed", bevel=0.0)
    box("skill-chest-skid", (0, y + 0.05, z), (1.0, 0.1, 0.7), "woodDark", bevel=0.02)
    box("skill-chest", (0, y + 0.36, z), (0.9, 0.52, 0.6), "wood", bevel=0.04)
    for dx in (-0.3, 0.3):
        box(f"skill-chest-band{dx}", (dx, y + 0.36, z), (0.1, 0.56, 0.64), "iron", bevel=0.01)
    box("skill-chest-lock", (0, y + 0.4, z - 0.32), (0.16, 0.2, 0.06), "gold", bevel=0.02)
    # The lid thrown back on its hinges (toward the bow), its underside to the sky.
    slab_x("skill-chest-lid", [(z + 0.3, y + 0.62), (z + 0.36, y + 0.68), (z + 0.86, y + 1.0), (z + 0.92, y + 0.92), (z + 0.42, y + 0.6)], -0.45, 0.45, "woodDark")
    for dx in (-0.3, 0.3):
        slab_x(f"skill-lid-band{dx}", [(z + 0.28, y + 0.62), (z + 0.36, y + 0.71), (z + 0.88, y + 1.04), (z + 0.95, y + 0.93), (z + 0.42, y + 0.57)], dx - 0.05, dx + 0.05, "iron")
    lathe("skill-coins", (0, z - 0.02), [(0.4, y + 0.6), (0.34, y + 0.76), (0.18, y + 0.9), (0.04, y + 0.96)], "gold", sides=10)
    for k, (dx, dz, dy) in enumerate(((0.3, -0.1, 0.72), (-0.26, 0.1, 0.74), (0.05, -0.2, 0.86), (-0.1, 0.16, 0.9))):
        lathe(f"skill-coin{k}", (dx, z + dz), [(0.11, y + dy), (0.11, y + dy + 0.04)], "roofGold", sides=8)
    # Coin shields hung along both rails, each on an iron boss: the wager shows from the side and from above.
    d = design
    for s in (-1, 1):
        for k, zc in enumerate((-1.9, -1.2, -0.5, 0.2, 0.9, 1.6)):
            x = d.outer_x(zc, d.sheer(zc) - 0.3)
            y = d.sheer(zc) - 0.3
            beam(f"skill-coin-shield{s}{k}", (s * (x + 0.02), y, zc), (s * (x + 0.1), y, zc), 0.5, "gold", sides=10)
            beam(f"skill-coin-boss{s}{k}", (s * (x + 0.1), y, zc), (s * (x + 0.15), y, zc), 0.2, "roofRed", sides=8)
            beam(f"skill-coin-strap{s}{k}", (s * (x + 0.03), y + 0.24, zc), (s * (x + 0.03), d.sheer(zc) + 0.03, zc), 0.06, "iron", sides=4)
    for s in (-1, 1):
        lathe(f"skill-ring{s}", (s * 0.62, z), [(0.07, y + 0.0), (0.07, y + 0.08)], "iron", sides=6)
        beam(f"skill-lash{s}", (s * 0.62, y + 0.06, z), (s * 0.46, y + 0.64, z), 0.05, "rope", sides=4)


def freighter_skill():
    """拾荒: the salvage boat slung outboard on two iron davits amidships, a net and a grapnel in it."""
    side = -1  # the ship-pick camera's side
    x_rail, y_rail = side * 1.36, DECK + 0.3
    zs = (0.15, 1.45)
    bx, by = side * 2.2, DECK + 0.55
    for k, z in enumerate(zs):
        box(f"skill-chock{k}", (x_rail, y_rail - 0.1, z), (0.3, 0.4, 0.3), "woodDark", bevel=0.03)
        box(f"skill-chock-band{k}", (x_rail, y_rail + 0.02, z), (0.34, 0.08, 0.34), "iron", bevel=0.0)
        pts = [(x_rail, y_rail + 0.05), (x_rail + side * 0.05, y_rail + 0.9), (x_rail + side * 0.3, y_rail + 1.35), (bx - side * 0.1, y_rail + 1.5), (bx + side * 0.05, y_rail + 1.38)]
        for i in range(len(pts) - 1):
            beam(f"skill-davit{k}-{i}", (pts[i][0], pts[i][1], z), (pts[i + 1][0], pts[i + 1][1], z), 0.13, "iron", sides=6)
        box(f"skill-sheave{k}", (bx + side * 0.05, y_rail + 1.28, z), (0.16, 0.2, 0.12), "brass", bevel=0.03)
        beam(f"skill-fall{k}", (bx + side * 0.05, y_rail + 1.2, z), (bx + side * 0.05, by + 0.28, z), 0.05, "rope", sides=4)
        beam(f"skill-gripe{k}", (x_rail + side * 0.1, y_rail + 0.1, z), (bx - side * 0.36, by + 0.1, z), 0.05, "rope", sides=4)
    # The boat: a small double-ended hull, pale gunwale, thwarts, a net heaped amidships and a grapnel on it.
    stations = [(-0.25, 0.05, 0.1), (0.1, 0.3, 0.3), (0.55, 0.4, 0.36), (1.05, 0.4, 0.36), (1.5, 0.3, 0.3), (1.85, 0.05, 0.1)]
    seg, verts, faces = 6, [], []
    for z, half, depth in stations:
        for i in range(seg + 1):
            a = math.pi * i / seg
            verts.append((bx - math.cos(a) * half, by + 0.3 - math.sin(a) * depth, z))
    row = seg + 1
    for k in range(len(stations) - 1):
        for i in range(seg):
            faces.append([k * row + i, k * row + i + 1, (k + 1) * row + i + 1, (k + 1) * row + i])
        faces.append([k * row, (k + 1) * row, (k + 1) * row + seg, k * row + seg])
    faces += [list(range(row)), list(range((len(stations) - 1) * row, len(stations) * row))]
    mesh_from("skill-boat", verts, faces, "wood")
    for s in (-1, 1):
        for k in range(len(stations) - 1):
            (z0, h0, _), (z1, h1, _) = stations[k], stations[k + 1]
            beam(f"skill-boat-rail{s}{k}", (bx + s * h0, by + 0.32, z0), (bx + s * h1, by + 0.32, z1), 0.1, "plaster", sides=4)
    for k, z in enumerate((0.3, 1.3)):
        beam(f"skill-thwart{k}", (bx - 0.36, by + 0.3, z), (bx + 0.36, by + 0.3, z), 0.1, "woodDark", sides=4)
    lathe("skill-net", (bx, 0.8), [(0.34, by + 0.26), (0.3, by + 0.44), (0.12, by + 0.56)], "rope", sides=8)
    beam("skill-grapnel", (bx, by + 0.5, 0.8), (bx, by + 0.86, 0.8), 0.07, "iron", sides=6)
    for k in range(4):
        a = math.pi / 2 * k
        beam(f"skill-fluke{k}", (bx, by + 0.56, 0.8), (bx + math.cos(a) * 0.24, by + 0.74, 0.8 + math.sin(a) * 0.24), 0.06, "iron", sides=4, taper=0.5)


def hidden_skill():
    """自帶掩護: a smuggler's shroud rigged over the waist: a dark awning on a ridge pole and crutches, laced to the
    rails, a shuttered lantern at its head (the cargo travels out of sight)."""
    d = design
    z0, z1 = -1.1, 1.0
    ridge, eave, half = d.DECK + 1.25, d.DECK + 0.62, 1.02
    for k, z in enumerate((z0, z1)):
        for s in (-1, 1):
            beam(f"skill-crutch{k}{s}", (s * 0.8, d.DECK, z), (0, ridge + 0.12, z), 0.11, "woodDark", sides=4)
            box(f"skill-crutch-foot{k}{s}", (s * 0.8, d.DECK + 0.05, z), (0.24, 0.1, 0.24), "woodDark", bevel=0.02)
        lathe(f"skill-crutch-lash{k}", (0, z), [(0.12, ridge - 0.02), (0.12, ridge + 0.12)], "rope", sides=6)
    beam("skill-ridge", (0, ridge, z0 - 0.25), (0, ridge, z1 + 0.25), 0.13, "woodDark", sides=6)
    for s in (-1, 1):
        mesh_from(f"skill-shroud{s}", [(0, ridge + 0.06, z0), (0, ridge + 0.06, z1), (s * half, eave, z1 + 0.12), (s * half, eave, z0 - 0.12),
                                      (0, ridge, z0), (0, ridge, z1), (s * half, eave - 0.06, z1 + 0.12), (s * half, eave - 0.06, z0 - 0.12)],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "heather", convex=True)
        beam(f"skill-hem{s}", (s * (half + 0.02), eave - 0.02, z0 - 0.14), (s * (half + 0.02), eave - 0.02, z1 + 0.14), 0.14, "ghostGlow", sides=4)
        for k in range(4):
            z = z0 + (z1 - z0) * k / 3
            beam(f"skill-lace{s}{k}", (s * half, eave - 0.04, z), (s * d.hull_rail_x(z), d.sheer(z) + 0.02, z), 0.045, "rope", sides=4)
            box(f"skill-cleat{s}{k}", (s * d.hull_rail_x(z), d.sheer(z) + 0.04, z), (0.16, 0.08, 0.1), "iron", bevel=0.0)
        # A patch, off-centre on each side.
        mesh_from(f"skill-patch{s}", [(s * 0.3, ridge - 0.1, 0.1 + s * 0.3), (s * 0.3, ridge - 0.1, 0.55 + s * 0.3), (s * 0.7, ridge - 0.36, 0.55 + s * 0.3), (s * 0.7, ridge - 0.36, 0.1 + s * 0.3),
                                     (s * 0.3, ridge - 0.16, 0.1 + s * 0.3), (s * 0.3, ridge - 0.16, 0.55 + s * 0.3), (s * 0.7, ridge - 0.42, 0.55 + s * 0.3), (s * 0.7, ridge - 0.42, 0.1 + s * 0.3)],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "ghostCloth", convex=True)
    # The lantern hangs from the ridge's forward end on an iron hook: shuttered, one slit of light.
    zl = z1 + 0.25
    beam("skill-hook", (0, ridge, zl), (0, ridge - 0.16, zl), 0.05, "iron", sides=4)
    box("skill-lamp", (0, ridge - 0.34, zl), (0.22, 0.3, 0.22), "iron", bevel=0.03)
    box("skill-lamp-slit", (0, ridge - 0.34, zl + 0.115), (0.06, 0.2, 0.02), "ghostGlow", bevel=0.0)
    lathe("skill-lamp-cap", (0, zl), [(0.17, ridge - 0.2), (0.04, ridge - 0.1)], "iron", sides=6)


def breaker_skill():
    """巨浪: a breaking wave carved over the bow: a tall curl of sea-green timber with a white crest, rising from a
    bronze collar on the bow post (the ship rides its own wave)."""
    d = design
    y0 = d.sheer(d.Z_FWD)
    zf = d.Z_FWD
    curl = [(zf + 0.0, y0 + 0.05), (zf + 0.42, y0 + 0.5), (zf + 0.78, y0 + 1.2), (zf + 0.82, y0 + 1.85), (zf + 0.55, y0 + 2.35), (zf + 0.1, y0 + 2.5),
            (zf - 0.3, y0 + 2.3), (zf - 0.45, y0 + 1.95), (zf - 0.25, y0 + 1.8), (zf + 0.05, y0 + 1.95), (zf + 0.3, y0 + 1.8), (zf + 0.36, y0 + 1.35), (zf + 0.2, y0 + 0.8), (zf - 0.12, y0 + 0.3)]
    slab_x("skill-wave", curl, -0.26, 0.26, "wave")
    crest = [(zf + 0.8, y0 + 1.7), (zf + 0.86, y0 + 1.9), (zf + 0.58, y0 + 2.44), (zf + 0.1, y0 + 2.6), (zf - 0.34, y0 + 2.38), (zf - 0.52, y0 + 1.95), (zf - 0.4, y0 + 1.9), (zf - 0.26, y0 + 2.22), (zf + 0.1, y0 + 2.42), (zf + 0.5, y0 + 2.28), (zf + 0.72, y0 + 1.85)]
    slab_x("skill-crest", crest, -0.24, 0.24, "foam")
    for k, x in enumerate((-0.26, 0.0, 0.26)):
        ball(f"skill-bead{k}", (x, y0 + 2.5 - abs(x) * 0.3, zf + 0.1), 0.2, "foam")
        ball(f"skill-bead-tip{k}", (x * 0.8, y0 + 2.02, zf - 0.46), 0.15, "foam")
    for s in (-1, 1):
        small = [(zf - 0.75 + (z - zf) * 0.55, y0 + 0.05 + (y - y0) * 0.5) for z, y in curl]
        slab_x(f"skill-wave-side{s}", small, s * 0.62 - 0.1, s * 0.62 + 0.1, "wave")
        ball(f"skill-side-foam{s}", (s * 0.62, y0 + 1.3, zf - 0.72), 0.16, "foam")
    for k, (dz, dy, r) in enumerate(((-0.56, 1.72, 0.13), (-0.42, 1.52, 0.1), (-0.6, 1.4, 0.08), (0.92, 2.2, 0.1), (0.7, 2.62, 0.09))):
        ball(f"skill-spray{k}", (0.12 * (-1) ** k, y0 + dy, zf + dz), r, "foam")
    # Ribs of a darker green down the wave's back, and the bronze collar it grows from.
    for k, t in enumerate((0.3, 0.75, 1.25)):
        slab_x(f"skill-rib{k}", [(zf + 0.25 + t * 0.4, y0 + 0.3 + t), (zf + 0.33 + t * 0.4, y0 + 0.27 + t), (zf + 0.45 + t * 0.32, y0 + 0.55 + t), (zf + 0.37 + t * 0.32, y0 + 0.58 + t)], -0.33, 0.33, "roofGreen")
    slab_x("skill-collar", [(zf - 0.2, y0 - 0.05), (zf + 0.2, y0 - 0.05), (zf + 0.32, y0 + 0.3), (zf - 0.16, y0 + 0.36)], -0.36, 0.36, "brass")
    for s in (-1, 1):
        beam(f"skill-brace{s}", (s * 0.5, y0 - 0.1, zf - 0.7), (s * 0.28, y0 + 0.9, zf + 0.25), 0.1, "woodDark", sides=4)


if os.environ.get("LIST_PARTS"):
    import collections
    seen = collections.Counter((re.sub(r"[-.]?[-\d.]+$", "", ob.name), mat) for ob, mat, _ in PARTS)
    print("PARTS", SHIP, sorted(seen.items()))
def quad_slab(name, pts, thick, mat, axis=(0, 1, 0)):
    """A thin convex slab on four corner points, thickened along `axis` (a sail, a shield plate, a roof face)."""
    ax = Vector(axis) * thick
    verts = [tuple(Vector(p) + ax) for p in pts] + [tuple(Vector(p)) for p in pts]
    return mesh_from(name, verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], mat, convex=True)


def standard_build():
    """The cog is rebuilt as a bigger ship: a roofed lookout tower raised on the aftcastle (the gilded albatross now
    perches on its peak) and a spritsail set under the bowsprit."""
    y0, z = DECK + 1.05, -2.3
    plan = [(0.62, z + 0.55), (0.62, z - 0.55), (-0.62, z - 0.55), (-0.62, z + 0.55)]
    plan_solid("skill-tower", plan, y0, y0 + 0.82, "sandstone")
    plan_ring("skill-tower-sill", offset(plan, 0.14), offset(plan, -0.02), y0 - 0.02, y0 + 0.08, "marble")
    plan_ring("skill-tower-foot", offset(plan, 0.08), offset(plan, -0.02), y0 + 0.08, y0 + 0.2, "woodDark")
    framed_opening("skill-tower-door", (0, y0 + 0.36, z + 0.55), (0.3, 0.5), False)
    for k, (x, zc) in enumerate(plan):
        beam(f"skill-tower-knee{k}", (x * 1.02, y0 + 0.5, zc * 1.0 + (zc - z) * 0.02), (x * 1.3, y0 + 0.8, z + (zc - z) * 1.3), 0.09, "woodDark", sides=4)
    lathe("skill-roof-collar", (0, z), [(0.16, y0 + 1.44), (0.16, y0 + 1.54)], "gold", sides=8)
    plan_ring("skill-tower-eave", offset(plan, 0.16), offset(plan, -0.02), y0 + 0.78, y0 + 0.92, "woodDark")
    for k, (x, zc) in enumerate(plan):
        beam(f"skill-tower-post{k}", (x, y0, zc), (x, y0 + 0.82, zc), 0.14, "woodDark", sides=4)
    for sx in (-1, 1):
        framed_opening(f"skill-tower-win{sx}", (sx * 0.62, y0 + 0.44, z), (0.3, 0.36), True)
    framed_opening("skill-tower-win-aft", (0, y0 + 0.44, z - 0.55), (0.34, 0.36), False)
    # Pyramid roof in the castle's red, with gold hips.
    apex = (0, y0 + 1.5, z)
    eaves = offset(plan, 0.18)
    for k in range(4):
        (xa, za), (xb, zb) = eaves[k], eaves[(k + 1) % 4]
        mesh_from(f"skill-roof{k}", [(xa, y0 + 0.9, za), (xb, y0 + 0.9, zb), apex, (xa * 0.9, y0 + 0.84, za * 0.9 + z * 0.1), (xb * 0.9, y0 + 0.84, zb * 0.9 + z * 0.1)],
                  [[0, 1, 2], [0, 3, 4, 1], [1, 4, 2], [3, 0, 2], [4, 3, 2]], "roofRed", convex=True)
        beam(f"skill-hip{k}", (xa, y0 + 0.92, za), apex, 0.1, "gold", sides=4, taper=0.5)
    # Spritsail: a small square sail on its own yard under the bowsprit, gold-hemmed.
    by, bz = DECK + 0.95, 3.45
    beam("skill-sprit-yard", (-1.0, by, bz), (1.0, by, bz), 0.1, "woodDark", sides=6)
    lathe("skill-sprit-sling", (0, bz), [(0.1, by - 0.08), (0.1, by + 0.3)], "rope", sides=6)
    quad_slab("skill-spritsail", [(-0.9, by - 0.05, bz), (0.9, by - 0.05, bz), (0.78, by - 0.95, bz + 0.22), (-0.78, by - 0.95, bz + 0.22)], 0.05, "canvas", axis=(0, 0, 1))
    beam("skill-sprit-hem", (-0.8, by - 0.97, bz + 0.25), (0.8, by - 0.97, bz + 0.25), 0.08, "gold", sides=4)


def gambler_build():
    """A second mast: a small lateen mizzen stepped aft, its sail in the same red and gold (a two-masted xebec)."""
    foot, head = (0.0, DECK - 0.05, -1.25), (0.0, 3.55, -1.0)
    beam("skill-mizzen", foot, head, 0.16, "woodDark", sides=8, taper=0.7)
    box("skill-mizzen-bed", (0, DECK + 0.04, -1.25), (0.52, 0.1, 0.52), "woodDark", bevel=0.03)
    lathe("skill-mizzen-partner", (0, -1.25), [(0.2, DECK + 0.08), (0.2, DECK + 0.2)], "gold", sides=8)
    lathe("skill-mizzen-parrel", (0.06, -1.1), [(0.17, 2.72), (0.17, 2.86)], "rope", sides=8)
    lathe("skill-mizzen-cap", (0, -1.0), [(0.11, 3.5), (0.11, 3.62)], "gold", sides=8)
    ya, yb = (0.22, 1.95, 0.25), (0.22, 4.55, -2.75)
    beam("skill-mizzen-yard", ya, yb, 0.11, "woodDark", sides=6, taper=0.7)
    clew = (0.42, 1.75, -2.55)
    for k in range(4):
        t0, t1 = k / 4, (k + 1) / 4
        p0 = tuple(ya[i] + (yb[i] - ya[i]) * t0 for i in range(3))
        p1 = tuple(ya[i] + (yb[i] - ya[i]) * t1 for i in range(3))
        mesh_from(f"skill-mizzen-sail{k}", [p0, p1, clew, (p0[0] + 0.05, p0[1], p0[2]), (p1[0] + 0.05, p1[1], p1[2]), (clew[0] + 0.05, clew[1], clew[2])],
                  [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "roofRed" if k % 2 else "roofGold", convex=True)
    beam("skill-mizzen-sheet", clew, (0.4, DECK + 0.3, -2.7), 0.04, "rope", sides=4)
    for s in (-1, 1):
        xr = design.outer_x(-1.6, design.sheer(-1.6))
        box(f"skill-mizzen-chainwale{s}", (s * (xr + 0.04), design.sheer(-1.6) - 0.06, -1.6), (0.18, 0.08, 0.4), "woodDark", bevel=0.02)
        box(f"skill-mizzen-deadeye{s}", (s * (xr + 0.06), design.sheer(-1.6) + 0.08, -1.6), (0.1, 0.16, 0.12), "dark", bevel=0.02)
        beam(f"skill-mizzen-shroud{s}", (0, 3.3, -1.02), (s * (xr + 0.06), design.sheer(-1.6) + 0.14, -1.6), 0.04, "rope", sides=4)


def freighter_build():
    """A salvage derrick stepped in the bows: two heavy legs to a head block, a jib with a net of salvage on its hook."""
    feet, head = [(-1.0, DECK + 0.3, 2.15), (1.0, DECK + 0.3, 2.15)], (0.0, 4.35, 2.55)
    for k, f in enumerate(feet):
        box(f"skill-derrick-shoe{k}", (f[0], f[1] - 0.06, f[2]), (0.34, 0.3, 0.34), "woodDark", bevel=0.03)
        box(f"skill-derrick-band{k}", (f[0], f[1] + 0.06, f[2]), (0.38, 0.08, 0.38), "iron", bevel=0.0)
        beam(f"skill-derrick-leg{k}", f, head, 0.22, "woodDark", sides=6, taper=0.7)
    lathe("skill-derrick-lash", (0, 2.55), [(0.2, 4.1), (0.2, 4.4)], "rope", sides=8)
    lathe("skill-derrick-cap", (0, 2.55), [(0.22, 4.4), (0.14, 4.52)], "gold", sides=8)
    jib = (0.0, 3.6, 4.15)
    beam("skill-derrick-jib", (0, DECK + 0.6, 2.75), jib, 0.18, "wood", sides=6, taper=0.7)
    beam("skill-derrick-topping", head, jib, 0.05, "rope", sides=4)
    beam("skill-derrick-stay", head, (0, DECK + 0.4, 0.9), 0.05, "rope", sides=4)
    # A lookout cabin on the stern house's roof: blue like the house, gold-banded, a little hipped roof, a lit window aft.
    cz_, y0 = -2.62, 3.4
    box("skill-cabin-sill", (0, y0 + 0.04, cz_), (0.86, 0.08, 0.74), "woodDark", bevel=0.02)
    box("skill-cabin", (0, y0 + 0.38, cz_), (0.74, 0.6, 0.62), "roofBlue", bevel=0.03)
    box("skill-cabin-band", (0, y0 + 0.68, cz_), (0.8, 0.07, 0.68), "gold", bevel=0.01)
    box("skill-cabin-roof", (0, y0 + 0.76, cz_), (0.96, 0.1, 0.84), "wood", bevel=0.03)
    lathe("skill-cabin-cap", (0, cz_), [(0.36, y0 + 0.8), (0.08, y0 + 1.02)], "wood", sides=4)
    lathe("skill-cabin-finial", (0, cz_), [(0.07, y0 + 1.0), (0.07, y0 + 1.14)], "gold", sides=6)
    box("skill-cabin-win-frame", (0, y0 + 0.4, cz_ - 0.31), (0.4, 0.36, 0.05), "gold", bevel=0.01)
    box("skill-cabin-win", (0, y0 + 0.4, cz_ - 0.335), (0.28, 0.24, 0.03), "flame", bevel=0.0)
    for sx in (-1, 1):
        box(f"skill-cabin-side-frame{sx}", (sx * 0.37, y0 + 0.4, cz_), (0.05, 0.32, 0.34), "gold", bevel=0.01)
        box(f"skill-cabin-side-win{sx}", (sx * 0.395, y0 + 0.4, cz_), (0.03, 0.2, 0.22), "dark", bevel=0.0)
    box("skill-derrick-block", (0, 3.42, 4.15), (0.2, 0.26, 0.16), "brass", bevel=0.03)
    beam("skill-derrick-fall", (0, 3.3, 4.15), (0, 2.55, 4.15), 0.05, "rope", sides=4)
    lathe("skill-derrick-net", (0, 4.15), [(0.06, 2.6), (0.42, 2.25), (0.46, 1.95), (0.3, 1.7), (0.08, 1.62)], "rope", sides=8)
    box("skill-derrick-crate", (0.05, 2.0, 4.15), (0.42, 0.4, 0.42), "wood", bevel=0.03, yaw=0.5)
    beam("skill-derrick-hook", (0, 2.62, 4.15), (0, 2.5, 4.15), 0.12, "iron", sides=6)


def hidden_build():
    """The crooked tower grows a leaning spire with a lit belfry: taller and stranger than a plain ghost ship."""
    d = design
    eave = d.TOWER_TOP + 1.0  # the gable roof's ridge
    cx, cz = 0.32, -2.02
    # A saddle astride the ridge: a dark block bedded into both slopes, pale flashing boards where it meets them.
    box("skill-belfry-saddle", (cx, eave - 0.16, cz), (0.92, 0.5, 0.9), "basalt", bevel=0.04)
    for sz in (-1, 1):
        beam(f"skill-belfry-flash{sz}", (cx - 0.5, eave - 0.3, cz + sz * 0.47), (cx + 0.5, eave - 0.3, cz + sz * 0.47), 0.11, "ghostCloth", sides=4)
    lathe("skill-belfry-foot", (cx, cz), [(0.5, eave + 0.02), (0.44, eave + 0.12)], "ghostCloth", sides=6)
    lathe("skill-belfry", (cx + 0.04, cz), [(0.4, eave + 0.0), (0.36, eave + 0.62)], "slate", sides=6)
    lathe("skill-belfry-rim", (cx + 0.06, cz), [(0.46, eave + 0.6), (0.46, eave + 0.7)], "ghostCloth", sides=6)
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 6
        box(f"skill-belfry-glow{k}", (cx + 0.05 + math.cos(a) * 0.35, eave + 0.32, cz + math.sin(a) * 0.35), (0.16, 0.34, 0.06), "ghostGlow", bevel=0.0, yaw=-a + math.pi / 2)
    # The spire leans the tower's way, bent again near its tip.
    beam("skill-spire-a", (cx + 0.07, eave + 0.68, cz), (cx + 0.24, eave + 1.1, cz - 0.05), 0.8, "basalt", sides=6, taper=0.4)
    beam("skill-spire-b", (cx + 0.24, eave + 1.08, cz - 0.05), (cx + 0.44, eave + 1.4, cz - 0.02), 0.32, "basalt", sides=6, taper=0.15)
    lathe("skill-spire-band", (cx + 0.24, cz - 0.05), [(0.2, eave + 1.04), (0.2, eave + 1.14)], "ghostGlow", sides=6)


def breaker_build():
    """A heavier prow: bronze cheek plates armour both bows, and the ram carries a second, upper beak above the first."""
    d = design
    zb = d.stem_z(0.45)
    beam("skill-upper-ram", (0, 1.05, zb - 0.1), (0, 0.98, 4.05), 0.4, "brass", sides=4, taper=0.5)
    beam("skill-upper-ram-collar", (0, 1.05, zb - 0.02), (0, 1.05, zb + 0.1), 0.48, "gold", sides=8)
    beam("skill-ram-strut", (0, 0.55, 3.55), (0, 1.0, 3.55), 0.14, "gold", sides=6)
    for s in (-1, 1):
        zs = [1.7 + 1.3 * k / 8 for k in range(9)]
        foot = lambda z: 0.72 + 0.16 * math.sin((z - 1.7) / 1.3 * math.pi * 3)  # noqa: E731  a wave-cut lower edge
        for k in range(len(zs) - 1):
            z0, z1 = zs[k], zs[k + 1]
            x0, x1 = d.outer_x(z0, 1.0) + 0.04, d.outer_x(z1, 1.0) + 0.04
            quad_slab(f"skill-cheek{s}{k}", [(s * x0, d.sheer(z0) - 0.03, z0), (s * x1, d.sheer(z1) - 0.03, z1), (s * (d.outer_x(z1, foot(z1)) + 0.04), foot(z1), z1), (s * (d.outer_x(z0, foot(z0)) + 0.04), foot(z0), z0)], 0.05, "brass", axis=(s, 0, 0))
            beam(f"skill-cheek-foot{s}{k}", (s * (d.outer_x(z0, foot(z0)) + 0.08), foot(z0), z0), (s * (d.outer_x(z1, foot(z1)) + 0.08), foot(z1), z1), 0.07, "gold", sides=4)
            if k % 2 == 0:
                zm = (z0 + z1) / 2
                beam(f"skill-cheek-rivet{s}{k}", (s * (d.outer_x(zm, 1.1) + 0.07), 1.1, zm), (s * (d.outer_x(zm, 1.1) + 0.12), 1.1, zm), 0.09, "gold", sides=6)
        for z_end in (zs[0], zs[-1]):
            beam(f"skill-cheek-end{s}{z_end:.2f}", (s * (d.outer_x(z_end, 1.0) + 0.08), d.sheer(z_end), z_end), (s * (d.outer_x(z_end, foot(z_end)) + 0.08), foot(z_end), z_end), 0.07, "gold", sides=4)
        beam(f"skill-cheek-rail{s}", (s * (d.outer_x(zs[0], 1.0) + 0.08), d.sheer(zs[0]) + 0.02, zs[0]), (s * (d.outer_x(zs[-1], 1.0) + 0.08), d.sheer(zs[-1]) + 0.02, zs[-1]), 0.09, "gold", sides=4)


BUILDS = {"standard": standard_build, "gambler": gambler_build, "freighter": freighter_build, "hidden": hidden_build, "breaker": breaker_build}


# The upgraded livery: with the skill open the ship itself looks richer, not only one part more. Each entry repaints
# the parts whose name starts with the prefix (and whose swatch is the one named, when given) in a new swatch.
LIVERY = {
    # Gilded battlements and rails, a gold hem and emblem on the sail.
    "standard": [("aftcastle-merlon", "marble", "gold"), ("forecastle-merlon", "marble", "gold"), ("cap-rail", None, "gold"), ("sail-hem", None, "gold"), ("emblem-ring", None, "gold"), ("emblem-bird", None, "gold"), ("bowsprit-cap", None, "gold")],
    # The sail's white stripes turn gold: red and gold, the colours of a high stake.
    "gambler": [("lateen", "canvas", "roofGold"), ("jib", "canvas", "roofGold"), ("boot-top", None, "gold"), ("die", "marble", "gold")],
    # Purple rails and yard bands, and the rags take the shroud's purple at their feet.
    "hidden": [("cap-rail", None, "heather"), ("main-yard-band", None, "ghostGlow"), ("fore-yard-band", None, "ghostGlow"), ("rag-main", None, "heather"), ("rag-fore", None, "heather"), ("bowsprit-cap", None, "ghostGlow")],
    # Sea-green canopy and oar blades with white tips, a white-crested emblem.
    "breaker": [("canopy", "leaf", "wave"), ("oar-", "wood", "wave"), ("emblem-disc", None, "wave"), ("sail-hem", None, "foam")],
}


def livery_trims():
    """Trims added with the livery (built as skill parts, so they show only with the skill open)."""
    if SHIP == "freighter":
        # The model is one mesh: its livery is laid over it. A second gold belt along the bulge and gilded mastheads.
        def half(z):
            k = min(1.0, z / 3.35) if z >= 0 else min(1.0, -z / 3.25)
            return 1.75 * max(0.0, 1 - k ** 2.4) ** (1 / 2.4)

        zs = [-2.7 + 5.6 * i / 14 for i in range(15)]
        for side in (-1, 1):
            for i in range(len(zs) - 1):
                beam(f"skill-belt{side}{i}", (side * (half(zs[i]) * 0.985 + 0.03), 0.98, zs[i]), (side * (half(zs[i + 1]) * 0.985 + 0.03), 0.98, zs[i + 1]), 0.13, "gold", sides=4)
                beam(f"skill-belt-b{side}{i}", (side * (half(zs[i]) * 0.93 + 0.03), 1.24, zs[i]), (side * (half(zs[i + 1]) * 0.93 + 0.03), 1.24, zs[i + 1]), 0.09, "plaster", sides=4)
    if SHIP == "standard":
        # A long gold-edged streamer at the masthead in place of the short pennant.
        y = design.MAST_TOP - 0.1  # at the masthead, inside the ship-pick box
        mesh_from("skill-streamer", [(0, y + 0.16, design.MAST_Z), (0, y - 0.16, design.MAST_Z), (0, y - 0.05, design.MAST_Z - 2.0), (0, y + 0.02, design.MAST_Z - 2.2), (0.03, y + 0.16, design.MAST_Z), (0.03, y - 0.16, design.MAST_Z), (0.03, y - 0.05, design.MAST_Z - 2.0), (0.03, y + 0.02, design.MAST_Z - 2.2)],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "roofGold", convex=True)
    if SHIP == "breaker":
        # A white wave band along each side above the oars.
        for side in (-1, 1):
            for i in range(8):
                z0 = -2.4 + i * 0.62
                x0, x1 = design.hull_rail_x(z0), design.hull_rail_x(z0 + 0.62)
                beam(f"skill-band{side}{i}", (side * (x0 + 0.03), design.sheer(z0) - 0.16 - 0.06 * (i % 2), z0), (side * (x1 + 0.03), design.sheer(z0 + 0.62) - 0.16 - 0.06 * ((i + 1) % 2), z0 + 0.62), 0.1, "foam", sides=4)


SKILLS = {"standard": standard_skill, "gambler": gambler_skill, "freighter": freighter_skill, "hidden": hidden_skill, "breaker": breaker_skill}
first_skill = len(PARTS)
if SHIP in SKILLS:
    SKILLS[SHIP]()
    BUILDS[SHIP]()
    livery_trims()
skill_obs = [ob for ob, _, _ in PARTS[first_skill:]]
colour_parts(band=band)
setup_render()
kit.SCENE.render.line_thickness = 1.0
if SHIP == "freighter":
    # The imported model keeps its own vertex colours.
    m = bpy.data.materials.new("glb")
    m.use_nodes = True
    ca = m.node_tree.nodes.new("ShaderNodeVertexColor")
    m.node_tree.links.new(ca.outputs["Color"], m.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    for ob in kit.SCENE.objects:
        if ob.get("model"):
            ob.data.materials.clear()
            ob.data.materials.append(m)


def paint(ob, swatch):
    """Repaint a plain (not banded) part top to bottom with a swatch, as colour_parts does."""
    me = ob.data
    attr = me.color_attributes["Col"]
    ys = [v.co.z for v in me.vertices]
    lo, hi = min(ys), max(ys)
    top, bot = hex_rgb(kit.SWATCHES[swatch][0]), hex_rgb(kit.SWATCHES[swatch][1])
    for li, loop in enumerate(me.loops):
        t = (me.vertices[loop.vertex_index].co.z - lo) / (hi - lo) if hi > lo else 1.0
        attr.data[li].color = [b + (a - b) * t for a, b in zip(top, bot)] + [1.0]


def apply_livery(on):
    for ob, mat, _ in PARTS[:first_skill]:
        for prefix, was, to in LIVERY.get(SHIP, []):
            if ob.name.startswith(prefix) and (was is None or mat == was) and not ob.get("banded"):
                paint(ob, to if on else mat)


def orbit(name, azimuth, elevation, target, scale, res):
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * 60
    return camera(name, V(*(t + d)), V(*t), scale, res)


# A close look at what the skill builds, for checking joints and trims: (target, azimuth, elevation, scale).
NEAR = {
    "standard": ((0, 3.4, -2.2), -135, 20, 4.6),
    "gambler": ((0, 2.2, -0.9), -70, 22, 5.6),
    "freighter": ((0, 3.2, -2.6), -160, 26, 4.4),
    "hidden": ((0.2, 3.9, -1.6), -120, 16, 4.6),
    "breaker": ((0, 1.9, 3.1), -55, 18, 4.6),
}
top = max((ob.matrix_world @ v.co).z for ob in skill_obs for v in ob.data.vertices) if skill_obs else 0
print(f"HEIGHT {SHIP} skill parts reach {top:.2f} (ship-pick box {SHIP_BOX_TOP})")
VIEWS = {"own": orbit("cam-own", 180, 54, (0, 2.2, 0.2), 10.5, (900, 900)), "side": orbit("cam-side", -68, 18, (0, 2.9, 0.2), 10.5, (900, 900)), "near": orbit("cam-near", NEAR[SHIP][1], NEAR[SHIP][2], NEAR[SHIP][0], NEAR[SHIP][3], (900, 900))}
os.makedirs(OUT, exist_ok=True)
for state in ("off", "on"):
    for ob in skill_obs:
        ob.hide_render = state == "off"
    apply_livery(state == "on")
    for name, (cam, (w, h)) in VIEWS.items():
        kit.SCENE.camera = cam
        kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
        kit.SCENE.render.filepath = os.path.join(OUT, f"{SHIP}-{name}-{state}.png")
        bpy.ops.render.render(write_still=True)
print("RENDERED", SHIP, len(skill_obs), "skill parts")
