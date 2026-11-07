"""Builds 孤注號 (the gambler, a stylized Mediterranean xebec) in Blender and exports it as a GLB.

Design: docs/art/gambler-concept.svg (the blockout, scripts/blender/blockout-gambler.py). This script reuses that
blockout's geometry for the hull, its trims, the rudder, the gilded beak, the stern platform and the rig's Blender-only
details (the curved yard with its bands and sling, mast partner and hoops, robands, the port chainwale and its deadeyes,
the sheet's cleat, the die's hatch), and rebuilds the mast, the ropes, the pennant staff and the lantern's post and iron
from the code design (the dump of src/ui-v07/scene/ships/designs.ts), so the code-drawn sails, pennant, die and lantern
flame hang where they should. The sails, the pennant, the die and the lantern's flame are NOT in the GLB.

Run headless (Blender 5.1+):
  npx tsx scripts/blender/dump-ship.ts gambler > /tmp/gambler.json
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/build-gambler.py -- /tmp/gambler.json public/models/ships/gambler.glb

Every part is shaded top to bottom with its palette swatch, then ambient occlusion is baked into the vertex colours.
"""

import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blockout_kit import *  # noqa: E402,F403

ARGS = sys.argv[sys.argv.index("--") + 1 :]
DUMP_PATH, OUT_PATH = ARGS[0], ARGS[1]
DUMP = json.load(open(DUMP_PATH))

_spec = importlib.util.spec_from_file_location("blockout_gambler", os.path.join(HERE, "blockout-gambler.py"))
ship_design = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ship_design)

AO_STRENGTH = 0.4
# How much of the baked AO each part takes, by name prefix (AO is per vertex: a big face tucked in at every corner
# would otherwise go dark all over).
AO_WEIGHTS = {"hull": 0.55, "beak": 0.7, "platform-grating": 0.6, "die-hatch": 0.6}
SKIP_NORMALS = ("hull", "rudder", "boot", "wale", "cap-rail", "beak", "die-hatch-rim")
# The lateen's luff in designs.ts (GAMBLER sails[0].edge): the robands lash it to the curved yard.
LUFF = ((0.34, 2.277, 3.435), (0.34, 6.875, -1.635))


def build_rig_from_dump():
    """The mast, ropes, pennant staff and the lantern's post and iron from the code design. Skipped: the fallback hull's
    rails, its straight yard and its beak spar (the Blender hull has a curved yard and a gilded beak)."""
    for i, p in enumerate(DUMP["parts"]):
        if p["kind"] == "beam":
            a, b = p["from"], p["to"]
            length = sum((b[k] - a[k]) ** 2 for k in range(3)) ** 0.5
            if p["mat"] == "woodDark" and max(a[1], b[1]) <= DECK + 0.3:
                continue  # the fallback hull's rails and posts: the Blender bulwark replaces them
            if p["mat"] == "woodDark" and (length > 5 or min(a[2], b[2]) > 3.0):
                continue  # the straight yard and the beak spar
            if p["mat"] == "woodDark" and abs(a[1] - DECK) < 1e-6 and p["width"] >= 0.12:
                # The mast: raked forward, octagonal, tapering, its foot down in the partner.
                foot = [a[k] + (a[k] - b[k]) * 0.1 / (b[1] - a[1]) for k in range(3)]
                beam(f"mast-{i}", foot, b, p["width"] * 1.1, "woodDark", sides=8, taper=0.72)
                continue
            if p["mat"] == "rope":
                beam(f"rope-{i}", a, b, 0.045, "rope", sides=4)
            else:
                beam(f"rig-{i}", a, b, p["width"], p["mat"], sides=4 if p["width"] <= 0.08 else 6)
        elif p["kind"] == "box" and p["mat"] == "metal":
            box(f"rig-box-{i}", p["center"], p["size"], p["mat"], bevel=p.get("bevel", 0.01))
        elif p["kind"] == "prism" and p["mat"] == "metal":
            # The lantern's pyramid cap.
            beam(f"lamp-cap-{i}", p["base"], (p["base"][0], p["base"][1] + p["height"], p["base"][2]), p["radius"] * 2, p["mat"], sides=4, taper=0.05)


def colour_for_bake():
    """Like blockout_kit.colour_parts, into a `base` attribute whose alpha carries the part's AO weight until the bake."""
    for ob, mat, shade in PARTS:
        me = ob.data
        weight = next((w for prefix, w in AO_WEIGHTS.items() if ob.name.startswith(prefix)), 1.0)
        attr = me.color_attributes.new("base", "FLOAT_COLOR", "CORNER")
        zs = [v.co.z for v in me.vertices]
        lo, hi = min(zs), max(zs)
        for poly in me.polygons:
            if ob.get("banded"):
                c = sum((me.vertices[k].co for k in poly.vertices), Vector()) / len(poly.vertices)
                sw, sh = ship_design.hull_band(c.z, poly.normal.z)
            else:
                sw, sh = mat, shade
            top, bot = hex_rgb(SWATCHES[sw][0]), hex_rgb(SWATCHES[sw][1])
            for li in poly.loop_indices:
                z = me.vertices[me.loops[li].vertex_index].co.z
                t = max(0.0, min(1.0, z / 2.0)) if ob.get("banded") else ((z - lo) / (hi - lo) if hi > lo else 1.0)
                attr.data[li].color = [(b + (a - b) * t) * sh for a, b in zip(top, bot)] + [weight]


def join_parts(name):
    bpy.ops.object.select_all(action="DESELECT")
    obs = [ob for ob, _, _ in PARTS]
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


def bake_ao(ship):
    SCENE.render.engine = "CYCLES"
    SCENE.cycles.device = "CPU"
    SCENE.cycles.samples = 128
    SCENE.world = bpy.data.worlds.new("world")
    SCENE.world.light_settings.distance = 0.7
    me = ship.data
    me.color_attributes.active_color = me.color_attributes.new("ao", "FLOAT_COLOR", "CORNER")
    me.materials.clear()
    me.materials.append(bpy.data.materials.new("bake"))
    bpy.ops.object.select_all(action="DESELECT")
    ship.select_set(True)
    bpy.context.view_layer.objects.active = ship
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


def export(ob):
    bpy.ops.object.select_all(action="DESELECT")
    for poly in ob.data.polygons:
        poly.use_smooth = False
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)


ship_design.build_ship_body()
ship_design.build_mast_dressing()
ship_design.build_yard()
ship_design.build_robands(lambda s: tuple(LUFF[0][k] + (LUFF[1][k] - LUFF[0][k]) * s for k in range(3)))
ship_design.build_rigging_dressing()
ship_design.build_die_hatch()
build_rig_from_dump()
check_normals(SKIP_NORMALS)
print("NORMALS OK")
colour_for_bake()
ship = join_parts("gambler")
bake_ao(ship)
export(ship)
tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
print(f"EXPORTED {OUT_PATH} gambler: {len(ship.data.polygons)} faces, ~{tris} triangles")
