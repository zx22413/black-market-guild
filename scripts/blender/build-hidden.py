"""Builds 幽靈號 (the ghost ship) in Blender and exports it as a GLB.

Design: docs/art/hidden-concept.svg (the blockout, scripts/blender/blockout-hidden.py). This script reuses that blockout's
geometry for the hull, its holes, ports, weed, trims, the rudder, the racked stern tower and the rig's Blender-only
details (partners, bands, slings, splintered breaks, rag lashings, chainwales, the lantern's bracket), and rebuilds the
masts, yards, bowsprit, the fallen foremast top and the ropes from the code design (the dump of designs.ts), so the
code-drawn rags, pennant and swinging lantern hang where they did. The rags, pennant, lantern and wisps are NOT in the GLB.

The GLB holds two meshes: `hidden` (the ship) and `glow` (the ports, the windows and the holes' light), which
BlenderHull draws dark teal by day and lit at night.

Run headless (Blender 5.1+):
  npx tsx scripts/blender/dump-ship.ts hidden > /tmp/hidden.json
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
      --python scripts/blender/build-hidden.py -- /tmp/hidden.json public/models/ships/hidden.glb

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

_spec = importlib.util.spec_from_file_location("blockout_hidden", os.path.join(HERE, "blockout-hidden.py"))
ship_design = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ship_design)
ship_design.SPARS = False  # spars and ropes come from designs.ts; rags and pennant are code-drawn cloth

AO_STRENGTH = 0.4
# How much of the baked AO each part takes, by name prefix (AO is per vertex: a big face tucked in at every corner
# would otherwise go dark all over).
AO_WEIGHTS = {"hull": 0.55, "tower-lower-wall": 0.5, "tower-upper-wall": 0.5, "tower-walk": 0.45, "roof-": 0.6, "gable-": 0.6}
SKIP_NORMALS = ("hull", "rudder", "wale", "cap-rail", "glow-hole-", "tower-", "roof-", "gable-")
# The glow parts' daylight colour: a dark teal (they light up at night in the game, BlenderHull).
GLOW_DAY = ("canal", 0.55)


def build_rig_from_dump():
    """The masts, yards, bowsprit, fallen top, lantern arm and ropes from the code design (only its beams: the fallback
    hull's rails, its tower boxes and ports are replaced by the Blender ones)."""
    for i, p in enumerate(DUMP["parts"]):
        if p["kind"] != "beam":
            continue
        a, b = p["from"], p["to"]
        if p["mat"] in ("woodDark", "dark") and max(a[1], b[1]) <= DECK + 0.3:
            continue  # the fallback hull's rails and posts: the Blender bulwark replaces them
        if p["mat"] == "rope":
            beam(f"rope-{i}", a, b, 0.04, "rope", sides=4)
        elif p["width"] >= 0.15 and min(a[1], b[1]) <= DECK + 0.01:
            # A mast (leaning, or snapped): octagonal and tapering, stepped a little below the deck.
            beam(f"mast-{i}", (a[0], a[1] - 0.1, a[2]), b, p["width"] * 1.1, p["mat"], sides=8, taper=0.7 if b[1] > 4 else 0.85)
        else:
            beam(f"rig-{i}", a, b, p["width"], p["mat"], sides=8 if p["width"] >= 0.12 else 4)


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
            elif ob.name.startswith("glow-"):
                sw, sh = GLOW_DAY
            else:
                sw, sh = mat, shade
            top, bot = hex_rgb(SWATCHES[sw][0]), hex_rgb(SWATCHES[sw][1])
            for li in poly.loop_indices:
                z = me.vertices[me.loops[li].vertex_index].co.z
                t = max(0.0, min(1.0, z / 2.0)) if ob.get("banded") else ((z - lo) / (hi - lo) if hi > lo else 1.0)
                attr.data[li].color = [(b + (a - b) * t) * sh for a, b in zip(top, bot)] + [weight]


def join_parts(name, obs):
    bpy.ops.object.select_all(action="DESELECT")
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


def bake_into_colour(ob):
    """No AO for the glow mesh (lit flat at night, recessed in its frames by day): its base colour becomes `Col`."""
    me = ob.data
    base = me.color_attributes["base"]
    out = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for i in range(len(me.loops)):
        c = base.data[i].color
        out.data[i].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.remove(base)
    me.color_attributes.active_color = me.color_attributes["Col"]
    me.color_attributes.render_color_index = 0


def export(obs):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        for poly in ob.data.polygons:
            poly.use_smooth = False
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT_PATH, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)


ship_design.build_ship_body()
ship_design.build_lantern_bracket()
ship_design.build_main()
ship_design.build_fore()
build_rig_from_dump()
check_normals(SKIP_NORMALS)
print("NORMALS OK")
colour_for_bake()
glow_parts = [ob for ob, _, _ in PARTS if ob.name.startswith("glow-")]
ship_parts = [ob for ob, _, _ in PARTS if not ob.name.startswith("glow-")]
glow = join_parts("glow", glow_parts)
ship = join_parts("hidden", ship_parts)
glow.hide_render = True  # flush in its frames: keep it out of the ship's AO bake
bake_ao(ship)
bake_into_colour(glow)
export([ship, glow])
for ob in (ship, glow):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"EXPORTED {OUT_PATH} {ob.name}: {len(ob.data.polygons)} faces, ~{tris} triangles")
