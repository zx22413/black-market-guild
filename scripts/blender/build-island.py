"""Builds an island base (scripts/blender/island_<module>.py) for the game:

  Blender -b --factory-startup --python scripts/blender/build-island.py -- smuggler-port

writes
- public/models/islands/<island>-body.glb: the island that stays put, island space, drawn in place of IslandBase;
- public/models/islands/<island>-headland.glb: the parts named by the module's HEADLAND_PREFIXES, island space at
  turn 0, which turn with the backdrop;
- src/ui/scene/islandBases/<island>.ts: their waterlines for the sea foam, and the rocks the module's `sea_rocks()`
  stands in the sea apart from the headland (for the scenery boats' loop test).

Colours are the palette gradient times baked ambient occlusion, in one vertex colour, flat shaded, like the ships.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402

import bpy  # noqa: E402

import blockout_kit as kit  # noqa: E402

ISLAND = sys.argv[sys.argv.index("--") + 1]
isl = importlib.import_module("island_" + ISLAND.split("-")[0])
HEADLAND_PREFIXES = isl.HEADLAND_PREFIXES
CONST = ISLAND.upper().replace("-", "_") + "_BASE"

REPO = kit.REPO
OUT_MODELS = os.path.join(REPO, "public/models/islands")
OUT_SHAPES = os.path.join(REPO, f"src/ui/scene/islandBases/{ISLAND}.ts")
AO_STRENGTH = 0.45
# Big flat faces have vertices only at their corners, so vertex AO would darken them whole: weaken it there.
AO_WEIGHTS = {"base-": 0.2, "patch-": 0.3, "path-": 0.2, "quay": 0.3, "beach": 0.25, "pier-deck": 0.4, **getattr(isl, "AO_WEIGHTS", {})}
SHORE_POINTS = 11  # src/ui/scene/islandShape.ts

isl.build_base()
kit.check_normals(skip=isl.OPEN_PARTS)
sea = [p for p in kit.PARTS if p[0].name == "sea"]
kit.PARTS[:] = [p for p in kit.PARTS if p[0].name != "sea"]
for ob, _, _ in sea:
    bpy.data.objects.remove(ob)


def colour():
    for ob, mat, shade in kit.PARTS:
        me = ob.data
        top, bottom = kit.hex_rgb(kit.SWATCHES[mat][0]), kit.hex_rgb(kit.SWATCHES[mat][1])
        zs = [v.co.z for v in me.vertices]
        lo, hi = min(zs), max(zs)
        weight = next((w for prefix, w in AO_WEIGHTS.items() if ob.name.startswith(prefix)), 1.0)
        attr = me.color_attributes.new("base", "FLOAT_COLOR", "CORNER")
        for loop in me.loops:
            t = (me.vertices[loop.vertex_index].co.z - lo) / (hi - lo) if hi > lo else 1.0
            c = [(b + (a - b) * t) * shade for a, b in zip(top, bottom)]
            attr.data[loop.index].color = (*c, weight)


def join(obs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = joined.data.name = name
    return joined


def bake(ob):
    kit.SCENE.render.engine = "CYCLES"
    kit.SCENE.cycles.device = "CPU"
    kit.SCENE.cycles.samples = 64
    kit.SCENE.world = bpy.data.worlds.new("world")
    kit.SCENE.world.light_settings.distance = 1.6
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
    for n in ("base", "ao"):
        me.color_attributes.remove(me.color_attributes[n])
    me.color_attributes.active_color = me.color_attributes["Col"]
    me.color_attributes.render_color_index = 0


def export(ob, path):
    bpy.ops.object.select_all(action="DESELECT")
    for poly in ob.data.polygons:
        poly.use_smooth = False
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)


def island_points(obs, awash_only=True):
    """(x, z) in island space of the vertices of every part that stands in the sea (spans the waterline)."""
    pts = []
    for ob in obs:
        zs = [v.co.z for v in ob.data.vertices]
        if awash_only and not (min(zs) <= isl.SEA <= max(zs)):
            continue
        pts += [(v.co.x, -v.co.y) for v in ob.data.vertices]
    return pts


def ring(pts, angles, margin=1.05):
    """For each angle, the farthest point within half a step either side: a star-shaped outline round the centre."""
    step = (angles[1] - angles[0]) if len(angles) > 1 else math.pi
    out = []
    for a in angles:
        best = 0.0
        for x, z in pts:
            d = math.atan2(math.sin(math.atan2(z, x) - a), math.cos(math.atan2(z, x) - a))
            if abs(d) <= step * 0.75:
                best = max(best, math.hypot(x, z))
        out.append((round(math.cos(a) * best * margin, 2), round(math.sin(a) * best * margin, 2)))
    return out


colour()
head_parts = [ob for ob, _, _ in kit.PARTS if ob.name.startswith(HEADLAND_PREFIXES)]
body_parts = [ob for ob, _, _ in kit.PARTS if not ob.name.startswith(HEADLAND_PREFIXES)]
SEA_ROCK_PREFIXES = getattr(isl, "SEA_ROCK_PREFIXES", ())
cliff_parts = [ob for ob in head_parts if not ob.name.startswith(SEA_ROCK_PREFIXES or ("\0",))]

# Small outlying rocks (the module's SHORE_SKIP) are left out: 11 points round the coast cannot follow them, and the
# foam would run out across open sea to reach them.
shore_parts = [ob for ob in body_parts if not ob.name.startswith(getattr(isl, "SHORE_SKIP", ()) or ("\0",))]
body_ring = ring(island_points(shore_parts), [-math.pi + (i + 0.5) * 2 * math.pi / SHORE_POINTS for i in range(SHORE_POINTS)])
head_pts = island_points(cliff_parts)
if head_pts:
    head_angles = sorted(math.atan2(z, x) for x, z in head_pts)
    a0, a1 = head_angles[0], head_angles[-1]
    head_fan = [(0.0, 0.0)] + ring(head_pts, [a0 + (a1 - a0) * i / (SHORE_POINTS - 2) for i in range(SHORE_POINTS - 1)], margin=1.0)
else:
    head_fan = [(0.0, 0.0)] * SHORE_POINTS  # nothing of the headland stands in the sea: an empty fan draws no foam
rocks = [(round(x, 2), round(z, 2), r) for x, z, r in getattr(isl, "sea_rocks", lambda: [])()]

os.makedirs(OUT_MODELS, exist_ok=True)
for parts, name in ((body_parts, "body"), (head_parts, "headland")):
    ob = join(parts, name)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bake(ob)
    export(ob, os.path.join(OUT_MODELS, f"{ISLAND}-{name}.glb"))
    print(f"EXPORTED {name}: ~{tris} triangles")
    bpy.data.objects.remove(ob)


def ts_points(points):
    return "[" + ", ".join(f"[{x}, {z}]" for x, z in points) + "]"


os.makedirs(os.path.dirname(OUT_SHAPES), exist_ok=True)
rock_list = ", ".join(f"[{x}, {z}, {r}]" for x, z, r in rocks)
open(OUT_SHAPES, "w").write(f"""// Generated by scripts/blender/build-island.py -- {ISLAND}; do not edit: change scripts/blender/{isl.__name__}.py and rebuild.
import type {{ IslandBaseShape }} from '../islandBaseShapes';

export const {CONST}: IslandBaseShape = {{
  shore: {ts_points(body_ring)},
  headlandShore: {ts_points(head_fan)},
  seaRocks: [{rock_list}],
}};
""")
print("WROTE", OUT_SHAPES)
