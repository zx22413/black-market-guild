"""Builds 海嘯號 (the breaker, a stylized green-and-gold war galley) in Blender and exports it as a GLB.

Design: docs/art/breaker-concept.svg (the blockout, scripts/blender/blockout-breaker.py). This script reuses that
blockout's geometry for the hull and its trims, the bronze ram and bow post, the curled stern with its canopied command
deck, the steering oars, the outriggers and oar ports, and the rig's Blender-only details (mast partner, hoops, gold
bands), and rebuilds the mast, yard, stays and the lantern's iron from the code design (the dump of
src/ui-v07/scene/ships/designs.ts). The oars (two banks that row), the sail, the pennant and the lantern's flame are
NOT in the GLB: ShipModel draws them.

Run headless (Blender 5.1+):
  npx tsx scripts/blender/dump-ship.ts breaker > /tmp/breaker.json
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/build-breaker.py -- /tmp/breaker.json public/models/ships/breaker.glb

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

_spec = importlib.util.spec_from_file_location("blockout_breaker", os.path.join(HERE, "blockout-breaker.py"))
ship_design = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ship_design)

AO_STRENGTH = 0.4
# How much of the baked AO each part takes, by name prefix (AO is per vertex: a big face tucked in at every corner
# would otherwise go dark all over).
AO_WEIGHTS = {"hull": 0.55, "poop-deck": 0.45, "bow-deck": 0.45, "canopy-": 0.6}
SKIP_NORMALS = ("hull", "boot-top", "wale", "cap-rail", "canopy-", "poop-edge", "bow-deck-edge")


def build_rig_from_dump():
    """From the code design: the mast, the yard, the stays and the lantern's iron. Everything else in the dump (the
    fallback hull, its ram, posts and steering oars) is replaced by the blockout's geometry."""
    for i, p in enumerate(DUMP["parts"]):
        if p["kind"] == "beam":
            a, b = p["from"], p["to"]
            vertical = abs(a[0] - b[0]) < 1e-6 and abs(a[2] - b[2]) < 1e-6
            if vertical and p["width"] >= 0.12 and abs(a[1] - DECK) < 0.01:
                beam(f"mast-{i}", (a[0], a[1] - 0.1, a[2]), b, p["width"] * 1.1, "woodDark", sides=8, taper=0.7)
            elif p["mat"] == "woodDark" and min(a[1], b[1]) > 4.0:
                beam(f"yard-{i}", a, b, p["width"], "woodDark", sides=8)
            elif p["mat"] == "rope":
                beam(f"rope-{i}", a, b, 0.04, "rope", sides=4)
            elif p["mat"] == "metal":
                beam(f"iron-{i}", a, b, p["width"], "metal", sides=p.get("sides", 4))
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
ship_design.build_rig_dressing()
build_rig_from_dump()
check_normals(SKIP_NORMALS)
print("NORMALS OK")
colour_for_bake()
ship = join_parts("breaker")
bake_ao(ship)
export(ship)
tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
print(f"EXPORTED {OUT_PATH} breaker: {len(ship.data.polygons)} faces, ~{tris} triangles")
