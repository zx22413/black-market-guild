"""Blockout of an island's new base (docs/art/island-base-research.md): the current island and the new one rendered
from the same cameras, for the design sheet.

  npx tsx scripts/blender/dump-island.ts <island> > <scratch>/<island>.json
  Blender -b --factory-startup --python scripts/blender/blockout-island.py -- <island> <render dir> <scratch>/<island>.json

The new base comes from scripts/blender/island_<module>.py (`build_base`, and `build_headland_props` for stand-ins of
code parts the dump does not have yet). The current cliff, turf, dock, asset buildings and scenery come from the dump,
so every building stands exactly where the game puts it. The module may also set
- BLOCKOUT_HIDE: scenery designs the new base replaces (left out of the "after" renders);
- BLOCKOUT_MOVES: {design: (dx, dy, dz)} for scenery the new layout moves;
- CLOSE_UPS: {view: (azimuth, elevation, target, ortho scale)} close-up cameras besides top, dock side and back;
- OPEN_PARTS: name prefixes of concave parts the normal check skips.
Writes before-<view>.png and after-<view>.png.
"""

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402

import importlib  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :]
ISLAND = args[0]
DUMP = json.load(open(args[2]))
sys.argv = sys.argv[: sys.argv.index("--") + 1] + args[1:]  # out_dir() reads the first argument after `--`
isl = importlib.import_module("island_" + ISLAND.split("-")[0])
from island_kit import *  # noqa: E402,F403

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


isl.build_base()
if hasattr(isl, "build_headland_props"):
    isl.build_headland_props()
before_dock()
placeholders()
check_normals(skip=tuple(isl.OPEN_PARTS) + ("before-sea",))
colour_parts()
VC = bpy.data.materials["vc"]
for m in DUMP["before"]:
    soup(m, "before").data.materials.append(VC)
for m in DUMP["buildings"]:
    ob = soup(m, "before")
    ob["after"] = True
    ob.data.materials.append(VC)
MOVES = getattr(isl, "BLOCKOUT_MOVES", {})
HIDE = getattr(isl, "BLOCKOUT_HIDE", ())
for m in DUMP["scenery"]:
    ob = soup(m, "before")
    design = m["name"].split("-", 2)[2]  # scenery-<i>-<design>
    if design in HIDE:
        ob["after"] = False
    elif design in MOVES:
        ob["after"] = False
        moved = soup(m, "after")
        moved.name = f"after-{design}"
        moved.location = V(*MOVES[design])
        moved.data.materials.append(VC)
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
    **{name: orbit(f"cam-{name}", az, el, target, scale) for name, (az, el, target, scale) in getattr(isl, "CLOSE_UPS", {}).items()},
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
