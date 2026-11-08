"""Builds the market island's (巴扎港) ground for the game: the A+B town of docs/art/island-base-research.md §25.5–25.8
(riva, four inner docks with their grand stairs and twin columns, the town round the square), four seats only.

  npx tsx scripts/blender/dump-market.ts > <scratch>/market.json
  Blender -b --factory-startup --python scripts/blender/build-market.py -- <scratch>/market.json

writes
- public/models/islands/market-body.glb: the ground in table space, drawn by MarketIsland in place of IslandBase;
- src/ui/scene/islandBases/market.ts: its waterline for the sea foam and the town's measures for marketDocks.ts.

The parts come from scripts/blender/blockout-market.py (`direction_ab`), so the blockout and the game never drift; the
stand-in townsfolk, ships and the smugglers' pile stay out (the game draws its own). Colours are the palette gradient
times baked ambient occlusion in one vertex colour, flat shaded, like the guild islands (build-island.py).
"""

import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
JSON = sys.argv[sys.argv.index("--") + 1]
# The blockout module reads `-- <direction> <render dir> <dump>`; it renders only when run itself.
sys.argv = sys.argv[: sys.argv.index("--") + 1] + ["AB", os.path.join(os.path.dirname(JSON), "market-build"), JSON]
spec = importlib.util.spec_from_file_location("blockout_market", os.path.join(HERE, "blockout-market.py"))
bm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bm)

import bpy  # noqa: E402

import blockout_kit as kit  # noqa: E402

REPO = kit.REPO
OUT_MODEL = os.path.join(REPO, "public/models/islands/market-body.glb")
OUT_SHAPE = os.path.join(REPO, "src/ui/scene/islandBases/market.ts")
AO_STRENGTH = 0.45
AO_WEIGHTS = {"base-city-pave": 0.2, "base-riva-pave": 0.2, "pave-": 0.2}
SHORE_POINTS = 11
SKIP = ("after-",)  # townsfolk and the pile: the game draws them

bm.FOOTPRINTS.clear()
bm.CUTTERS.clear()
bm.direction_ab(4)
bm.apply_cuts()
drop = [p for p in kit.PARTS if p[0].name.startswith(SKIP)]
kit.PARTS[:] = [p for p in kit.PARTS if not p[0].name.startswith(SKIP)]
for ob, _, _ in drop:
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
            attr.data[loop.index].color = (*[(b + (a - b) * t) * shade for a, b in zip(top, bottom)], weight)


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


def shore_ring(obs):
    """For each of SHORE_POINTS angles, the farthest vertex of anything standing in the sea within half a step either
    side: a star-shaped outline round the centre, for the foam."""
    pts = []
    for ob in obs:
        zs = [v.co.z for v in ob.data.vertices]
        if min(zs) <= bm.SEA <= max(zs):
            pts += [(v.co.x, -v.co.y) for v in ob.data.vertices]
    angles = [-math.pi + (i + 0.5) * 2 * math.pi / SHORE_POINTS for i in range(SHORE_POINTS)]
    step = angles[1] - angles[0]
    out = []
    for a in angles:
        best = 0.0
        for x, z in pts:
            d = math.atan2(math.sin(math.atan2(z, x) - a), math.cos(math.atan2(z, x) - a))
            if abs(d) <= step * 0.75:
                best = max(best, math.hypot(x, z))
        out.append((round(math.cos(a) * best * 1.03, 2), round(math.sin(a) * best * 1.03, 2)))
    return out


colour()
obs = [ob for ob, _, _ in kit.PARTS]
shore = shore_ring(obs)
from island_kit import foam_segments  # noqa: E402

foam = foam_segments(obs, budget=220)
print(f"FOAM {len(foam)} segments")
ob = join(obs, "market")
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
bake(ob)
bpy.ops.object.select_all(action="DESELECT")
for poly in ob.data.polygons:
    poly.use_smooth = False
ob.select_set(True)
os.makedirs(os.path.dirname(OUT_MODEL), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT_MODEL, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                          export_materials="PLACEHOLDER", export_normals=True, export_apply=True, export_yup=True)
print(f"EXPORTED market: ~{tris} triangles")

pts = ", ".join(f"[{x}, {z}]" for x, z in shore)
open(OUT_SHAPE, "w").write(f"""// Generated by scripts/blender/build-market.py; do not edit: change scripts/blender/blockout-market.py and rebuild.
import type {{ SeaPoint }} from '../islandShape';

/** The market island's waterline in table space, {SHORE_POINTS} points round it (for the sea foam). */
export const MARKET_SHORE: readonly SeaPoint[] = [{pts}];

/** The real waterline cut at sea level, for the sea foam: [x0, z0, x1, z1] segments in table space. */
export const MARKET_FOAM: readonly (readonly [number, number, number, number])[] = [{", ".join(f"[{a}, {b}, {c}, {d}]" for a, b, c, d in foam)}];

/**
 * The town's measures (blockout-market.py): the low quay round it and in the docks, how far it reaches, where each
 * dock's water ends behind a ship's bow, the landing and the grand stairs up to the square, half a dock's width.
 */
export const MARKET_TOWN = {{
  low: {bm.LOW},
  town: {bm.TOWN_R},
  riva: {bm.RIVA_R},
  headU: {bm.HEAD_U},
  landing: {bm.LANDING},
  stairRun: {bm.STAIR_RUN},
  water: {bm.SLOT["water"]},
  half: {bm.HALF},
  ring: 8.9,
}} as const;
""")
print("WROTE", OUT_SHAPE)
