"""Builds one of the V0.8 prototype's three buildings (修船廠 repairyard, 軍械庫 armory, 商行 tradehouse) in Blender and
exports it as a GLB. An experiment, not rules.

Design: docs/art/facilities-concept.svg; the geometry is the approved blockout (scripts/blender/blockout-facilities.py).

  for k in repairyard armory tradehouse; do
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        --python scripts/blender/build-facilities.py -- $k public/models/facilities/$k.glb
  done

The GLB holds two meshes: `body` (palette gradient x baked ambient occlusion in its vertex colours) and, when the
building flies one, `flag` (the pennant and banner, which the game paints in the owner's colour). The turf plot of the
design sheet is left out. Table units, y up, +z toward the dock, standing on y = 0 at the plot's centre.
"""

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1 :]
KIND, OUT_PATH = ARGS[0], ARGS[1]

_spec = importlib.util.spec_from_file_location("blockout_facilities", os.path.join(HERE, "blockout-facilities.py"))
design = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(design)

AO_STRENGTH = 0.45
# Big faces tucked in at every corner would go dark all over (AO is per vertex): they take less of it.
AO_WEIGHTS = {"x-arm-tower": 0.5, "trade-body": 0.5, "x-yard-slip": 0.5, "trade-roof": 0.6}
FLAG = ("arm-pennant", "arm-banner")


def is_flag(name):
    return name.startswith(FLAG) and "rod" not in name and "arm-banner-arm" not in name


def colour_for_bake():
    for ob, mat, shade in PARTS:
        me = ob.data
        weight = next((w for prefix, w in AO_WEIGHTS.items() if ob.name.startswith(prefix)), 1.0)
        attr = me.color_attributes.new("base", "FLOAT_COLOR", "CORNER")
        zs = [v.co.z for v in me.vertices]
        lo, hi = min(zs), max(zs)
        top, bot = hex_rgb(SWATCHES[mat][0]), hex_rgb(SWATCHES[mat][1])
        for li, loop in enumerate(me.loops):
            z = me.vertices[loop.vertex_index].co.z
            t = (z - lo) / (hi - lo) if hi > lo else 1.0
            attr.data[li].color = [(b + (a - b) * t) * shade for a, b in zip(top, bot)] + [weight]


def join(obs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


def bake_ao(ob):
    SCENE.render.engine = "CYCLES"
    SCENE.cycles.device = "CPU"
    SCENE.cycles.samples = 128
    SCENE.world = bpy.data.worlds.new("world")
    SCENE.world.light_settings.distance = 0.7
    me = ob.data
    me.color_attributes.active_color = me.color_attributes.new("ao", "FLOAT_COLOR", "CORNER")
    me.materials.clear()
    me.materials.append(bpy.data.materials.new("bake"))
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
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


design.build_one(KIND)
# The design sheet's turf plot stays out of the game.
plots = [p for p in PARTS if p[0].name.endswith("-plot")]
PARTS[:] = [p for p in PARTS if not p[0].name.endswith("-plot")]
for ob, _, _ in plots:
    bpy.data.objects.remove(ob)
check_normals(skip=("x-",))
colour_for_bake()
flags = [ob for ob, _, _ in PARTS if is_flag(ob.name)]
body = join([ob for ob, _, _ in PARTS if not is_flag(ob.name)], "body")
bake_ao(body)
out = [body]
if flags:
    flag = join(flags, "flag")
    flag.data.color_attributes.remove(flag.data.color_attributes["base"])
    flag.data.materials.clear()
    out.append(flag)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for ob in out:
    for poly in ob.data.polygons:
        poly.use_smooth = False
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                          export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f"EXPORTED {OUT_PATH} {KIND}: ~{tris} triangles, flag: {bool(flags)}")
