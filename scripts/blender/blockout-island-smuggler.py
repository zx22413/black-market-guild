"""Blockout of the smuggling port's new island base (docs/art/island-base-research.md, directions A + C).

  npx tsx scripts/blender/dump-island.ts smuggler-port > <scratch>/smuggler.json
  Blender -b --factory-startup --python scripts/blender/blockout-island-smuggler.py -- <render dir> <scratch>/smuggler.json

Island space as in the game (three.js: y up, +z toward the dock, the plateau group at y = 2.6, turf top 2.85). The
current cliff, turf, dock, asset buildings and scenery come from the dump, so the "before" and "after" renders share
cameras and every building stands exactly where the game puts it.

The new base, in game-art terms (docs/art/lowpoly-style.md §6):
- one loud feature: the whole cliff is oversized hexagonal basalt columns, their tops stepping down at the rim and
  breaking into a causeway of stumps at the waterline;
- every edge trimmed against a contrasting neighbour: a light heather lip over a dark peat band over dark basalt;
  pale stone caps on the column tops; marble coping on the quay; dark timber frames on the pier and stairs;
- the ground follows use (direction C): a cove cut into the dock side with a stone quay, a pier and a flight of
  stairs up to the yard; a shingle beach in a bay on the right, where the rowboat is pulled up, reached by
  column-stump steps.
"""

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :]
DUMP = json.load(open(args[1]))

from island_smuggler import *  # noqa: E402,F403
import island_smuggler as isl  # noqa: E402

# ---------------------------------------------------------------- dumped meshes (before shape, buildings, scenery)

def soup(m, tag, skip_tris=None):
    """A triangle soup from dump-island.ts, coloured per vertex; tagged "before", "after" or both."""
    p, c = m["positions"], m["colors"]
    me = bpy.data.meshes.new(m["name"])
    verts = [V(p[i], p[i + 1], p[i + 2]) for i in range(0, len(p), 3)]
    faces = [(i, i + 1, i + 2) for i in range(0, len(verts), 3)]
    me.from_pydata(verts, [], faces)
    me.update()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            attr.data[li].color = [srgb_to_linear(c[vi * 3 + k]) for k in range(3)] + [1.0]
    ob = bpy.data.objects.new(m["name"], me)
    kit.SCENE.collection.objects.link(ob)
    ob[tag] = True
    return ob


def before_dock():
    d = DUMP["dockBefore"]
    ob = box("before-dock", d["center"], d["size"], "wood", bevel=0.04)
    ob["before"] = True
    s = slab("before-sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, -0.3, "sea")
    s["after"] = False
    s["before"] = True


def placeholders():
    """The warehouse's crate stacks and the guild pennant, in both shapes."""
    for i, (x, y, z) in enumerate(DUMP["warehouse"]):
        for k in range(2):
            ob = box(f"crate-{i}-{k}", (x, TURF + 0.35 + k * 0.7, z), (0.7, 0.7, 0.7), "wood", bevel=0.04)
            ob["before"] = ob["after"] = True
    bx, by, bz = DUMP["banner"]
    pole = beam("banner-pole", (bx, TURF, bz), (bx, TURF + 4.2, bz), 0.12, "woodDark")
    flag = box("banner-flag", (bx + 0.6, TURF + 3.7, bz), (1.1, 0.7, 0.05), "pennant", bevel=0.0)
    for ob in (pole, flag):
        ob["before"] = ob["after"] = True


build_base()
build_headland_props()
before_dock()
placeholders()
check_normals(skip=("base-", "path-", "head-peat", "head-lip", "head-heath", "patch-", "cottage-roof", "quay", "beach", "sea", "before-sea", "pier-deck"))
colour_parts()
VC = bpy.data.materials["vc"]
for m in DUMP["before"]:
    soup(m, "before").data.materials.append(VC)
for m in DUMP["buildings"]:
    ob = soup(m, "before")
    ob["after"] = True
    ob.data.materials.append(VC)
for m in DUMP["scenery"]:
    ob = soup(m, "before")
    # The rowboat moves down onto the beach in the new layout.
    if "rowboat" in m["name"]:
        ob["after"] = False
        moved = soup(m, "after")
        moved.name = "after-rowboat"
        moved.location = V(3.75, 0.25 - TURF, 3.85)
        moved.data.materials.append(VC)
    elif "smuggler-cave" in m["name"]:
        ob["after"] = False  # rebuilt from columns (build_headland)
    else:
        ob["after"] = True
    ob.data.materials.append(VC)
for ob, _, _ in PARTS:
    ob.data.materials.clear()
    ob.data.materials.append(VC)
for ob in kit.SCENE.objects:
    if ob.type == "MESH":
        for p in ob.data.polygons:
            p.use_smooth = False

tris = sum(len(p.vertices) - 2 for ob in kit.SCENE.objects if ob.type == "MESH" and ob.get("after") and not ob.name.startswith(("building-", "scenery-", "after-", "crate", "banner", "sea")) for p in ob.data.polygons)
print(f"NEW BASE ~{tris} triangles")

# ---------------------------------------------------------------- renders

setup_render()
kit.SCENE.render.line_thickness = 1.0


def orbit(name, azimuth, elevation, target, scale, res=(1200, 900), dist=60):
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * dist
    return camera(name, V(*(t + d)), V(*t), scale, res)


VIEWS = {
    "top": camera("cam-top", V(0, 60, 0.5), V(0, 0, 0.5), 37, (1100, 1100)),
    "dock-side": orbit("cam-dock", 0, 48, (0, 2, 0), 36),
    "back": orbit("cam-back", 180, 48, (0, 2, -1), 36),
    "cove-close": orbit("cam-cove", 28, 16, (1.5, 2.0, 10.5), 15),
    "beach-close": orbit("cam-beach", 60, 22, (8.5, 1.2, 6.5), 13),
}
VIEWS["top"][0].rotation_euler = (0, 0, 0)

OUT = out_dir()
for state in ("before", "after"):
    for ob in kit.SCENE.objects:
        if ob.type == "MESH":
            ob.hide_render = not ob.get(state, False)
    for name, (cam, (w, h)) in VIEWS.items():
        kit.SCENE.camera = cam
        kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
        kit.SCENE.render.filepath = os.path.join(OUT, f"{state}-{name}.png")
        bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
