"""The lighthouse island's base (燈塔島), shared by its blockout (blockout-island.py) and its build (build-island.py),
both run with `-- lighthouse`. docs/art/island-base-research.md §9 has the design.

After the chalk coast of the English Channel (the Seven Sisters, Beachy Head, Old Harry Rocks):
- one loud feature: sheer white chalk cliffs banded with dark flint seams, the cliff top rising and dipping in a
  slow wave round the coast (the Seven Sisters' dry valleys), the turf rolling down into each dip;
- every edge trimmed against a contrasting neighbour: dark flint seams on the white chalk, a pale turf lip over the
  cliff edge, a weed-dark rim on the pale wave-cut platform, timber stringers on the stairs, a dark frame on the
  jetty;
- the ground follows use: a chine (a cleft in the cliff) cut into the dock side, with a shingle beach at its foot, a
  timber stair up to the yard and a jetty out to sea; a chalk path from the stair to the warehouse and the pennant;
  a wave-cut platform round the island at the waterline; chalk stacks with turf caps standing off the shore;
- the headland (the backdrop): a chalk promontory behind the lots for the coal beacon, built apart so it turns to
  the back, left or right with the backdrop (`HEADLAND_PREFIXES`).
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "chalk": ("#f4f1e8", "#d6d0bd"),
        "flint": ("#575a6c", "#3f414d"),
        "turf": ("#46b383", "#33916a"),
        "turfLip": ("#86d8a9", "#62bd8b"),
        "turfDark": ("#348f66", "#2a7553"),
        "shelf": ("#b8bea9", "#9aa18c"),
        "weed": ("#4f7d57", "#3b5f43"),
        "chalkPath": ("#f1ede0", "#ddd6c2"),
    }
)
rng = random.Random(11)

# The cliff edge as (x, z, cliff top), counter-clockwise from the chine. Not a disc: a shield of long straight chalk
# faces meeting at sharp prows, the front cut by the chine (the dock's cleft, back to z 7.4) and each flank by a deep
# V of a dry valley whose floor the cliff top dips into (the Seven Sisters' valleys), a little apart from symmetric.
COAST = [
    (1.1, 7.4, 2.3), (2.6, 10.6, 2.5), (6.2, 10.4, 2.7), (9.6, 9.6, 2.74), (11.6, 5.0, 2.7), (12.0, 2.0, 2.4),
    (10.6, 0.6, 1.6), (8.8, -0.8, 1.3), (10.8, -2.2, 1.7), (11.4, -4.6, 2.5), (10.2, -7.6, 2.74), (6.6, -10.4, 2.6),
    (2.0, -11.0, 2.7), (-2.6, -11.0, 2.7), (-6.8, -10.2, 2.6), (-10.0, -7.8, 2.74), (-11.6, -4.6, 2.5),
    (-11.6, -2.6, 1.9), (-8.8, -0.4, 1.25), (-11.8, 1.2, 1.7), (-12.4, 4.4, 2.5), (-11.8, 8.0, 2.74),
    (-8.6, 10.2, 2.7), (-5.0, 10.8, 2.6), (-2.6, 10.6, 2.5), (-1.1, 7.4, 2.3),
]
OUTLINE = [(x, z) for x, z, _ in COAST]
CHINE_BEACH = [(-2.1, 9.0), (2.1, 9.0), (2.9, 12.0), (-2.9, 12.0)]
# A chalk islet off the right prow, its own little cliff and turf, with stacks round it.
ISLET_AT = (14.0, 9.4)
ISLET = [(ISLET_AT[0] + math.cos(a) * r, ISLET_AT[1] + math.sin(a) * r) for a, r in zip([i * 2 * math.pi / 7 for i in range(7)], (2.3, 1.8, 2.1, 2.5, 1.9, 2.2, 1.7))]
# The headland for the coal beacon, authored at the back like the backdrop (islandScenery.ts: [0, RIM, -10.4] ×3).
HEAD = [(-4.8, -8.6), (4.8, -8.6), (5.2, -11.2), (3.8, -13.9), (1.3, -15.2), (-1.4, -15.1), (-3.9, -13.8), (-5.4, -11.2)]
HEAD_AT = (0.0, -11.6)
STACKS = [(16.6, 7.0, 0.8, 1.6), (12.6, 12.4, 0.6, 1.1), (-13.8, -0.9, 0.85, 1.7)]
SEAMS = (0.25, 0.7, 1.12)  # flint seams' heights, below the lowest dip of the cliff top

HEADLAND_PREFIXES = ("head-",)
SHORE_SKIP = ("stack", "islet")
OPEN_PARTS = ("base-", "head-", "turf-", "shelf", "weed", "chine-", "path-", "patch-", "stack-turf", "sea", "head-rib", "base-rib", "islet-")
AO_WEIGHTS = {"turf-": 0.2, "head-turf": 0.2, "shelf": 0.2, "weed": 0.3, "chine-beach": 0.3, "head-shelf": 0.2}
BLOCKOUT_MOVES = {"coal-beacon": (0.0, TURF - 2.4, 0.0)}  # its footing up from the old cliff top onto the headland's turf
CLOSE_UPS = {"chine-close": (24, 14, (0.0, 1.6, 10.0), 14), "valley-close": (70, 18, (10.0, 1.4, 1.0), 16), "islet-close": (30, 16, (12.0, 1.2, 8.5), 14)}


def chalk_cliff(prefix, plan, tops, center=(0.0, 0.0), roll=0.7, yard=99.0, skip=None):
    """A white cliff round `plan` (tops: the cliff top at each point): a battered wall from the sea floor, flint seams
    standing proud, ribs of chalk standing out of the face, and the turf rolling over the edge with a pale lip, down
    from the yard (TURF, at most `yard` from `center`) to the cliff top over at least `roll`."""
    walls = [[(x, FOOT, z) for x, z in radial(plan, center, 0.35)], [(x, t, z) for (x, z), t in zip(plan, tops)]]
    surface(f"{prefix}-chalk", walls, "chalk", face_up=False)
    slab(f"{prefix}-core", radial(plan, center, -0.25), FOOT, min(tops) - 0.05, "chalk", 0.9)
    for k, h in enumerate(SEAMS):
        out = 0.35 * (2.4 - h) / (2.4 - FOOT)
        plan_ring(f"{prefix}-seam-{k}", radial(plan, center, out + 0.08), radial(plan, center, out - 0.25), h, h + 0.12, "flint")["after"] = True
    # The turf: a pale lip over the edge, a little down the face; then rolling in to the flat yard.
    inner_xz = []
    for x, z in plan:
        dx, dz = x - center[0], z - center[1]
        ln = math.hypot(dx, dz) or 1
        r = max(0.3, min(ln - roll, yard))
        inner_xz.append((center[0] + dx / ln * r, center[1] + dz / ln * r))
    lip_out = [(x, t - 0.24, z) for (x, z), t in zip(radial(plan, center, 0.16), tops)]
    lip_top = [(x, t + 0.12, z) for (x, z), t in zip(radial(plan, center, 0.06), tops)]
    edge = [(x + (ix - x) * 0.3, t + 0.18, z + (iz - z) * 0.3) for (x, z), (ix, iz), t in zip(plan, inner_xz, tops)]
    inner = [(x, TURF, z) for x, z in inner_xz]
    surface(f"{prefix}-turf-lip", [lip_out, lip_top], "turfLip", face_up=False)
    surface(f"{prefix}-turf-lip-top", [lip_top, edge], "turfLip")
    surface(f"{prefix}-turf-roll", [edge, inner], "turf")
    slab(f"{prefix}-turf-yard", radial(inner_xz, center, 0.05), TURF - 0.2, TURF - 0.01, "turf")
    # Ribs: buttresses of chalk standing out of the face, their tops under the cliff top, so the white wall reads as a
    # sheer fluted cliff rather than a stack of rings.
    for i, (x, z, nx, nz) in enumerate(walk(plan, 1.25)):
        if (skip and skip(x, z)) or math.sin(i * 0.8) + rng.uniform(-0.4, 0.4) < -0.45:
            continue  # gaps between runs of ribs, so the face reads as fluted cliff, not a fence
        k = min(range(len(plan)), key=lambda j: math.hypot(plan[j][0] - x, plan[j][1] - z))
        r = rng.uniform(0.4, 1.0)
        out = rng.uniform(0.15, 0.75)
        top = tops[k] - rng.choice([0.05, 0.1, 0.3, 0.6, 0.9, 1.3])
        ob = prism(f"{prefix}-rib-{i}", (x + nx * out, FOOT, z + nz * out), r, top - FOOT, "chalk", sides=5, top=0.78, shade=rng.uniform(0.88, 1.04))
        ob["after"] = True


def shelf(prefix, plan, out, center=(0.0, 0.0)):
    """The wave-cut platform round a cliff's foot at the waterline: grey-green chalk with a dark weed rim."""
    ring_out = [(x + rng.uniform(-0.4, 0.4), z + rng.uniform(-0.4, 0.4)) for x, z in radial(plan, center, 0)]
    ring_out = [radial([(x, z)], center, out * rng.uniform(0.4, 1.0))[0] for x, z in ring_out]
    slab(f"{prefix}-shelf", ring_out, FOOT, -0.14, "shelf")
    plan_ring(f"{prefix}-weed", radial(ring_out, center, 0.35), radial(ring_out, center, -0.15), -0.32, -0.2, "weed")["after"] = True


def build_chine():
    """The cleft on the dock side: a shingle beach at its foot, a timber stair up to the yard, a jetty out to sea."""
    slab("chine-beach", CHINE_BEACH, FOOT, 0.3, "slate", 1.05)
    plan_ring("chine-beach-edge", grow(CHINE_BEACH, 0.15), grow(CHINE_BEACH, -0.2), 0.2, 0.36, "shelf")["after"] = True
    # Stair: treads on two dark stringers, from the beach (z 11, y 0.36) up the chine's back to the yard (z 7.4).
    steps = 9
    for k in range(steps):
        z = 10.6 - k * (3.2 / steps)
        y = 0.36 + (k + 1) * (TURF - 0.36) / steps
        box(f"chine-tread-{k}", (0, y - 0.06, z), (1.5, 0.12, 0.42), "wood", bevel=0.02)["after"] = True
        box(f"chine-riser-{k}", (0, (y + 0.36) / 2 - 0.1, z + 0.05), (1.3, y - 0.36, 0.3), "chalk", bevel=0.0, shade=0.92)["after"] = True
    for s in (-1, 1):
        beam(f"chine-stringer-{s}", (s * 0.82, 0.3, 10.9), (s * 0.82, TURF + 0.05, 7.3), 0.2, "woodDark")["after"] = True
        for k in range(4):
            z = 10.6 - k * 1.05
            y = 0.36 + (10.6 - z) / 3.2 * (TURF - 0.36)
            beam(f"chine-rail-post-{s}-{k}", (s * 0.85, y, z), (s * 0.85, y + 0.75, z), 0.1, "woodDark")["after"] = True
        beam(f"chine-rail-{s}", (s * 0.85, 1.1, 10.6), (s * 0.85, TURF + 0.7, 7.45), 0.08, "woodDark")["after"] = True
    # Jetty: planks on a dark frame, posts and bollards.
    slab("chine-jetty", [(-1.0, 11.6), (1.0, 11.6), (1.0, 15.8), (-1.0, 15.8)], 0.42, 0.58, "wood")
    for s in (-1, 1):
        box(f"chine-jetty-rail-{s}", (s * 1.02, 0.56, 13.7), (0.18, 0.2, 4.2), "woodDark", bevel=0.03)["after"] = True
        for z in (12.2, 14.0, 15.7):
            beam(f"chine-post-{s}-{z}", (s * 0.95, -1.2, z), (s * 0.95, 0.8, z), 0.24, "woodDark")["after"] = True
            prism(f"chine-bollard-{s}-{z}", (s * 0.95, 0.8, z), 0.14, 0.1, "metal")["after"] = True


def build_stacks():
    """Chalk stacks off the shore, each with a flint seam and a turf cap."""
    for k, (x, z, r, h) in enumerate(STACKS):
        ob = prism(f"stack-{k}", (x, FOOT, z), r * 1.15, h - FOOT, "chalk", sides=7, top=0.82)
        ob["after"] = True
        plan_ring(f"stack-seam-{k}", [(x + math.cos(a) * r * 1.12, z + math.sin(a) * r * 1.12) for a in [i * 2 * math.pi / 7 + math.pi / 7 for i in range(7)]],
                  [(x + math.cos(a) * r * 0.7, z + math.sin(a) * r * 0.7) for a in [i * 2 * math.pi / 7 + math.pi / 7 for i in range(7)]], 0.5, 0.62, "flint")["after"] = True
        cap = prism(f"stack-turf-{k}", (x, h - 0.08, z), r * 1.0, 0.26, "turfLip", sides=7, top=0.75)
        cap["after"] = True
        slab(f"stack-shelf-{k}", [(x + math.cos(a) * (r + 1.0), z + math.sin(a) * (r + 1.0)) for a in [i * 2 * math.pi / 8 for i in range(8)]], FOOT, -0.16, "shelf")


def build_plateau_detail():
    """A chalk path from the stair to the warehouse and the pennant, darker turf hummocks."""
    for k, ((x0, z0), (x1, z1), w) in enumerate((((0, 7.5), (0, 4.6), 1.1), ((0, 4.6), (0, 1.4), 0.9))):
        slab(f"path-{k}", [(x0 - w / 2, z0), (x0 + w / 2, z0), (x1 + w / 2, z1), (x1 - w / 2, z1)], TURF - 0.05, TURF + 0.03, "chalkPath")
    for k, (x, z, r) in enumerate(((-8.0, -2.2, 1.3), (8.4, -2.6, 1.1), (-7.4, 5.0, 1.0), (7.2, 5.6, 0.9), (3.8, -8.0, 0.8))):
        pts = [(x + math.cos(a) * r * (0.85 + 0.25 * math.sin(a * 3 + k)), z + math.sin(a) * r * (0.85 + 0.25 * math.cos(a * 2 + k))) for a in [i * math.pi / 5 for i in range(10)]]
        slab(f"patch-{k}", pts, TURF - 0.05, TURF + 0.14, "turfDark")
        slab(f"patch-{k}-top", grow(pts, -0.25), TURF + 0.08, TURF + 0.22, "turf")


def build_headland():
    """The beacon's promontory: a flat-topped chalk tongue flush with the yard, its own platform at its foot."""
    chalk_cliff("head", HEAD, [2.62] * len(HEAD), center=HEAD_AT, roll=1.6, skip=lambda x, z: z > -9.2)
    shelf("head", HEAD, 1.2, center=HEAD_AT)


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    in_chine = lambda x, z: inside(grow(CHINE_BEACH, 0.8), x, z) or (abs(x) < 3.0 and z > 7.0)
    chalk_cliff("base", OUTLINE, [t for _, _, t in COAST], roll=0.7, yard=8.4, skip=in_chine)
    shelf("base", OUTLINE, 1.6)
    chalk_cliff("islet", ISLET, [1.9] * len(ISLET), center=ISLET_AT, roll=1.0)
    shelf("islet", ISLET, 1.0, center=ISLET_AT)
    build_chine()
    build_stacks()
    build_plateau_detail()
    build_headland()
