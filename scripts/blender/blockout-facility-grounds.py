"""One of the V0.8 prototype's buildings on the ground colours of four islands, from the owner's side at the table
camera's angle: does it stand out from the ground it is built on? (An experiment, not rules.)

  Blender -b --factory-startup --python scripts/blender/blockout-facility-grounds.py -- <kind> <out.png>
"""

import importlib.util
import math
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

# The yard earth of the spice isles, the pirate cove's sand, the mine's rock, the lumber island's grass.
GROUNDS = {"spiceEarth": ("#b8664a", "#a65a40"), "coveSand": ("#e6d3a0", "#d4bd86"), "mineRock": ("#8b8e98", "#73767f"), "lumberGrass": ("#8fc56f", "#74ad58")}
kit.SWATCHES.update(GROUNDS)
GAP = 5.6
for k, ground in enumerate(GROUNDS):
    before = len(PARTS)
    design.build_one(KIND, (k - 1.5) * GAP)
    for i in range(before, len(PARTS)):
        ob, mat, shade = PARTS[i]
        if "-plot" in ob.name:  # Blender numbers the repeated names (yard-plot.001)
            PARTS[i] = (ob, ground, shade)
colour_parts()
setup_render()
kit.SCENE.render.line_thickness = 1.0
a, e = math.radians(180), math.radians(54)
t = Vector((0, 1.6, 0))
d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * 60
cam, (w, h) = camera("cam", V(*(t + d)), V(*t), 23.5, (2000, 700))
kit.SCENE.camera = cam
kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
kit.SCENE.render.filepath = OUT_PATH
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT_PATH)
