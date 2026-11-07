"""Design sheet of the market town's five house types (scripts/blender/market_houses.py), each twice, on a strip of the
square, from the table's angle and from the street.

  Blender -b --factory-startup --python scripts/blender/blockout-houses.py -- <render dir>

Writes after-<view>.png (and a plain before-<view>.png of the old boxes for the sheet's left column).
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402
import market_houses as mh  # noqa: E402

G = 0.0
mh.G = G
rng = random.Random(5)
kit.SWATCHES.update({"sea": ("#5fb3ad", "#4a9e99"), "plaza": ("#e8d8b8", "#d6c4a0")})

ground = plan_solid("ground", [(-9, -4), (9, -4), (9, 4.5), (-9, 4.5)], -0.3, 0.0, "plaza")
ground["before"] = ground["after"] = True
# Five types in columns, two of each: a front row and a back row.
SPECS = [
    ("dutch", 1.5, 1.9, 3.0, True, 0), ("dutch", 1.3, 1.8, 2.5, False, 1),
    ("venetian", 2.2, 2.0, 2.6, True, 0), ("venetian", 1.9, 1.8, 2.0, False, -1),
    ("levantine", 2.0, 1.9, 1.9, True, 0), ("levantine", 1.7, 1.7, 2.6, False, 1),
    ("warehouse", 2.6, 2.2, 2.3, False, 0), ("warehouse", 2.3, 2.0, 1.9, False, -1),
    ("tower", 1.3, 1.3, 3.6, False, 0), ("tower", 1.2, 1.2, 4.2, True, 0),
]
for k, (kind, w, d, h, shop, annex) in enumerate(SPECS):
    cx = -7.0 + (k // 2) * 3.5
    cz = 2.2 if k % 2 == 0 else -1.8
    mh.house(f"house-{k}", cx, cz, 0.0, w, d, h, kind, rng, ground=G, shop=shop, annex=annex)
    # The old box for the same plot (left column of the sheet).
    old = box(f"old-{k}", (cx, h / 2, cz), (w, h, d), rng.choice(mh.WALLS), bevel=0.02)
    old["before"] = True
    old["after"] = False
    roof = beam(f"old-roof-{k}", (cx - w / 2, h + 0.02, cz), (cx + w / 2, h + 0.02, cz), d * 1.05, "roofRed", sides=3)
    roof["before"] = True
    roof["after"] = False
for ob, _, _ in PARTS:
    if ob.name.startswith("house-"):
        ob["after"] = True
check_normals(skip=("ground",))
colour_parts()
tris = sum(len(p.vertices) - 2 for ob in kit.SCENE.objects if ob.type == "MESH" and ob.name.startswith("house-") for p in ob.data.polygons)
print(f"HOUSES ~{tris} triangles for {len(SPECS)} houses")
setup_render()
kit.SCENE.render.line_thickness = 1.0


def orbit(name, azimuth, elevation, target, scale, res=(1600, 700), dist=60):
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * dist
    return camera(name, V(*(t + d)), V(*t), scale, res)


VIEWS = {"table": orbit("cam-table", 15, 42, (0, 1.6, 0.3), 20, res=(1600, 1000)), "street": orbit("cam-street", 20, 14, (0, 1.8, 0.3), 20, res=(1600, 900)), "close": orbit("cam-close", 30, 22, (-5.2, 1.6, 2.2), 8.5, res=(1600, 900))}
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
