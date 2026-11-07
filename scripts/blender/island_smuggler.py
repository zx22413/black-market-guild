"""The smuggling port's island base (走私港), shared by its blockout (blockout-island-smuggler.py) and its build
(build-island-smuggler.py). docs/art/island-base-research.md §6–7 has the design.

Island space as in the game (three.js: y up, +z toward the dock); the plateau group stands at y = 2.6 and the
heather's top is TURF = 2.85, where the asset buildings and scenery stand.

- one loud feature: the whole cliff is oversized hexagonal basalt columns in clumps, their tops stepping up and
  down along the coast, collapsed in places into scree, breaking into causeway stumps at the waterline;
- every edge trimmed against a contrasting neighbour: a light heather lip over a dark peat band over dark basalt;
  pale caps on the column tops; a stone coping on the quay; stone treads on the stairs; a dark frame on the pier;
- the ground follows use: a cove cut into the dock side with a quay, a pier and stairs up to the yard; a shingle
  beach in a bay on the right, reached by column-stump steps; paths from the stairs to the warehouse, the pennant
  and the beach; heather hummocks and outcrops on the plateau;
- the headland (the backdrop): a second tier of columns behind the lots with the cave store opening onto the yard
  under a lintel of one fallen column, and the sea arch off its right end, its span columns lying on their sides.
  It turns to the back, left or right with the backdrop (src/ui-v07/scene/islandScenery.ts `backdropTurn`), so it
  is built apart (`HEADLAND_PREFIXES`). The cottage, gibbet, shoring and kegs on it are code parts
  (src/ui/scene/buildings/islands/smugglerPort.ts); `build_headland_props` draws stand-ins for the blockout.

Every part is tagged `after` (the blockout's "new shape" layer).
"""

import math
import random

from blockout_kit import *  # noqa: F401,F403
import blockout_kit as kit

TURF = 2.85
PLATEAU = 2.6
SEA = -0.3

kit.SWATCHES.update(
    {
        "heath": ("#6f5ea8", "#54468a"),
        "heathLip": ("#9a88d4", "#7563b4"),
        "peat": ("#4f3632", "#3a2826"),
        "colCap": ("#9ea3bd", "#7c8099"),
        "sea": ("#5fb3ad", "#4a9e99"),
        "foam": ("#f6f6ef", "#e4e6df"),
        "path": ("#a99ab0", "#8f8098"),
        "heathDark": ("#56487f", "#463a6c"),
    }
)
rng = random.Random(7)

# ---------------------------------------------------------------- plan

# The heather's edge (x, z), counter-clockwise seen from above (+y). The dock side (+z) has the cove (x -2.2..2.6,
# back to z 9.0) and, on the right, the beach bay.
OUTLINE = [
    (1.2, 9.0), (2.6, 9.4), (2.9, 11.4), (4.8, 11.0), (6.6, 9.6),
    (6.0, 7.6), (7.4, 6.0), (9.6, 5.4), (10.8, 3.4),
    (11.4, 1.0), (11.6, -1.6), (11.0, -4.2), (10.0, -6.6), (8.2, -8.6), (5.6, -10.0), (2.4, -10.8),
    (-1.0, -10.9), (-4.2, -10.2), (-7.0, -8.6), (-9.2, -6.4), (-10.8, -3.6), (-11.5, -0.6), (-11.1, 2.6),
    (-10.0, 5.4), (-8.4, 7.8), (-6.2, 9.8), (-4.0, 11.1), (-2.6, 11.6), (-2.2, 9.4), (-1.0, 9.0),
]
QUAY = [(-2.0, 9.75), (2.4, 9.75), (2.7, 12.6), (-2.3, 12.6)]
BEACH = [(6.0, 7.6), (7.4, 6.0), (9.6, 5.4), (10.8, 3.4), (12.6, 4.4), (12.4, 7.6), (10.2, 10.2), (7.6, 10.8), (6.6, 9.6)]


def signed_area(plan):
    return sum(plan[i][0] * plan[(i + 1) % len(plan)][1] - plan[(i + 1) % len(plan)][0] * plan[i][1] for i in range(len(plan))) / 2


def grow(plan, d):
    """Any simple polygon pushed out by d (negative pulls it in): each vertex along its corner bisector."""
    ccw = -1 if signed_area(plan) < 0 else 1  # flip so normals point outward whichever way the plan winds
    n = len(plan)
    out = []
    for i in range(n):
        (xa, za), (x, z), (xb, zb) = plan[i - 1], plan[i], plan[(i + 1) % n]
        ns = []
        for (x0, z0), (x1, z1) in (((xa, za), (x, z)), ((x, z), (xb, zb))):
            ln = math.hypot(x1 - x0, z1 - z0) or 1
            ns.append((ccw * (z1 - z0) / ln, -ccw * (x1 - x0) / ln))
        bx, bz = ns[0][0] + ns[1][0], ns[0][1] + ns[1][1]
        ln = math.hypot(bx, bz) or 1
        bx, bz = bx / ln, bz / ln
        k = d / max(bx * ns[0][0] + bz * ns[0][1], 0.4)
        out.append((x + bx * k, z + bz * k))
    return out


def inside(plan, x, z):
    hit = False
    for i in range(len(plan)):
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % len(plan)]
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0):
            hit = not hit
    return hit


def walk(plan, step):
    """Points every `step` along a closed outline, with the edge's outward normal."""
    ccw = -1 if signed_area(plan) < 0 else 1
    pts = []
    for i in range(len(plan)):
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % len(plan)]
        ln = math.hypot(x1 - x0, z1 - z0)
        nx, nz = ccw * (z1 - z0) / ln, -ccw * (x1 - x0) / ln
        for k in range(max(1, round(ln / step))):
            t = (k + 0.5) / max(1, round(ln / step))
            pts.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz))
    return pts


def slab(name, plan, y0, y1, mat, shade=1.0):
    ob = plan_solid(name, plan, y0, y1, mat, shade)
    ob["after"] = True
    return ob


def hexcol(name, x, z, r, y0, y1, mat="basalt", cap=True, shade=1.0):
    ob = prism(name, (x, y0, z), r, y1 - y0, mat, sides=6, shade=shade)
    ob["after"] = True
    if cap:
        c = prism(f"{name}-cap", (x, y1 - 0.02, z), r * 0.86, 0.12, "colCap", sides=6)
        c["after"] = True


# The headland (the old smuggler-cave backdrop, rebuilt into the base): a second tier of columns behind the lots,
# the cave store opening onto the yard under a lintel of one fallen column, the lookout's cottage and signal gibbet
# on top, and the sea arch off its right end, its legs column clusters and its span columns lying on their sides.
# Authored at the back (-z) like the backdrop; on the table it turns to the back, left or right with it.
HEAD = [(-8.6, -8.2), (-4.6, -7.9), (-0.4, -8.0), (2.2, -8.9), (3.0, -11.4), (2.4, -14.4), (-0.6, -15.6), (-5.4, -15.4), (-8.8, -13.6), (-10.0, -10.6)]
HEAD_TOP = 5.4
MOUTH = (-3.0, 2.6)  # centre x and width of the cave mouth on the headland's yard face
# The sea arch: its legs stand wide of the skiff's loop under it (smugglerPort.ts, centre x 7.4, z -17.4).
ARCH = {"legs": (3.2, 11.6), "z": -17.4, "span": 6.3}
# Each leg's columns: (dx toward the opening, dz, height below the span); kept mostly outboard of the opening.
ARCH_LEG = ((0, 0, 0), (-0.9, 0.7, -0.9), (-0.6, -0.9, -1.6), (0.3, 0.8, -1.2))
ARCH_LEG_R = 0.85
# Names of the parts that turn with the backdrop (the headland and the arch), built into their own model.
HEADLAND_PREFIXES = ("head-", "cave-back", "cave-lintel", "arch-")


def arch_rocks():
    """Every arch-leg column as (x, z, r), island space at turn 0."""
    x0, x1 = ARCH["legs"]
    return [(lx + dx * (1 if leg == 0 else -1), ARCH["z"] + dz, ARCH_LEG_R) for leg, lx in enumerate((x0, x1)) for dx, dz, _ in ARCH_LEG]


def hex_fill(plan, r):
    """Hexagonally packed centres inside a plan."""
    xs, zs = [p[0] for p in plan], [p[1] for p in plan]
    pts, row = [], 0
    z = min(zs)
    while z <= max(zs):
        x = min(xs) + (r * 0.87 if row % 2 else 0)
        while x <= max(xs):
            if inside(plan, x, z):
                pts.append((x, z))
            x += r * 1.74
        z += r * 1.5
        row += 1
    return pts


def edge_distance(plan, x, z):
    best = 1e9
    for i in range(len(plan)):
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % len(plan)]
        dx, dz = x1 - x0, z1 - z0
        t = max(0.0, min(1.0, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)))
        best = min(best, math.hypot(x - x0 - dx * t, z - z0 - dz * t))
    return best


def lying(name, a, b, r, mat="basalt"):
    """A column lying on its side from a to b, a hexagonal beam with a stone cap at each end."""
    ob = beam(name, a, b, r * 2, mat, sides=6)
    ob["after"] = True
    for k, (p, q) in enumerate(((a, b), (b, a))):
        d = [q[i] - p[i] for i in range(3)]
        ln = math.sqrt(sum(c * c for c in d))
        e = [p[i] - d[i] / ln * 0.06 for i in range(3)]
        c = beam(f"{name}-cap{k}", e, p, r * 1.7, "colCap", sides=6)
        c["after"] = True


def build_headland():
    mx, mw = MOUTH
    # Columns: tallest in the middle, stepping down toward the sea and the ends; the yard face stays a sheer wall.
    for i, (x, z) in enumerate(hex_fill(HEAD, 1.0)):
        if abs(x - mx) < mw / 2 + 0.3 and z > -10.0:
            continue  # the cave mouth
        d = edge_distance(HEAD, x, z)
        seaward = z < -12.5 or x < -8.0 or x > 2.0
        top = HEAD_TOP - (0 if d > 1.6 else (1.4 if seaward else 0.25)) + rng.uniform(-0.2, 0.2)
        if seaward and d < 0.8:
            top -= rng.uniform(0.6, 1.6)
        hexcol(f"head-{i}", x, z, rng.uniform(0.92, 1.05), -3.0, top, shade=rng.uniform(0.82, 1.05))
    # Heather on top, back from the edge, with its lip and peat band like the plateau.
    top_plan = grow(HEAD, -2.6)
    slab("head-peat", grow(top_plan, 0.25), HEAD_TOP - 0.3, HEAD_TOP + 0.05, "peat")
    slab("head-lip", grow(top_plan, 0.12), HEAD_TOP, HEAD_TOP + 0.22, "heathLip")
    slab("head-heath", top_plan, HEAD_TOP + 0.18, HEAD_TOP + 0.32, "heath")
    # Cave mouth: a dark back under a lintel of one column lying across.
    b = box("cave-back", (mx, TURF + 1.1, -10.1), (mw, 2.3, 0.3), "dark", bevel=0.0)
    b["after"] = True
    lying("cave-lintel", (mx - mw / 2 - 0.9, TURF + 2.45, -8.6), (mx + mw / 2 + 0.9, TURF + 2.45, -8.6), 0.55)
    # Sea arch: two leg clusters in the sea, a span of columns lying across.
    x0, x1 = ARCH["legs"]
    az = ARCH["z"]
    for leg, lx in enumerate((x0, x1)):
        for j, (dx, dz, h) in enumerate(ARCH_LEG):
            hexcol(f"arch-leg-{leg}-{j}", lx + dx * (1 if leg == 0 else -1), az + dz, ARCH_LEG_R, -3.0, ARCH["span"] - 0.4 + h, shade=rng.uniform(0.85, 1.0))
    for k, (dy, dz) in enumerate(((0.0, -0.45), (0.0, 0.45), (0.85, 0.0))):
        lying(f"arch-span-{k}", (x0 - 1.0, ARCH["span"] + dy, az + dz), (x1 + 1.0, ARCH["span"] + dy, az + dz), 0.5)


def build_headland_props():
    """Stand-ins for the code parts on the headland (smugglerPort.ts `smugglerCave`): the cave's shoring and kegs,
    the lookout's cottage and the signal gibbet. Blockout only; the game draws them from code."""
    mx, mw = MOUTH
    for sx in (mx - mw / 2 + 0.25, mx + mw / 2 - 0.25):
        p = beam(f"cave-post-{sx}", (sx, TURF, -8.9), (sx, TURF + 2.0, -8.9), 0.22, "woodDark")
        p["after"] = True
    p = beam("cave-header", (mx - mw / 2 + 0.1, TURF + 2.0, -8.9), (mx + mw / 2 - 0.1, TURF + 2.0, -8.9), 0.22, "woodDark")
    p["after"] = True
    for k, kx in enumerate((-0.6, 0.0, 0.6)):
        bb = beam(f"cave-keg-{k}", (mx + kx, TURF + 0.3, -9.6), (mx + kx, TURF + 0.3, -9.0), 0.55, "wood", sides=10)
        bb["after"] = True
    # Lookout's cottage and the signal gibbet at the yard edge.
    t = HEAD_TOP + 0.32
    c = box("cottage", (-5.6, t + 0.7, -12.0), (2.6, 1.4, 1.8), "plaster", bevel=0.05)
    c["after"] = True
    for s_ in (-1, 1):
        r_ = box(f"cottage-roof-{s_}", (-5.6, t + 1.75, -12.0 + s_ * 0.5), (2.9, 0.12, 1.3), "slate", bevel=0.02)
        r_.rotation_euler = (math.radians(-38 * s_), 0, 0)
        r_["after"] = True
    ch = box("cottage-chimney", (-6.6, t + 2.2, -12.0), (0.4, 1.0, 0.45), "stone", bevel=0.03)
    ch["after"] = True
    g = beam("gibbet-post", (-1.4, t, -9.6), (-1.4, t + 3.6, -9.6), 0.24, "woodDark")
    g["after"] = True
    g = beam("gibbet-arm", (-1.4, t + 3.5, -9.6), (-1.4, t + 3.5, -8.2), 0.18, "woodDark")
    g["after"] = True
    g = box("gibbet-lantern", (-1.4, t + 2.95, -8.3), (0.45, 0.6, 0.45), "gold", bevel=0.05)
    g["after"] = True


def boulder(name, x, y, z, r):
    """A rounded shingle boulder: a squat seven-sided lump, wider than tall."""
    ob = prism(name, (x, y, z), r, r * 0.55, "basalt", sides=7, top=0.7)
    ob["after"] = True
    c = prism(f"{name}-top", (x, y + r * 0.55, z), r * 0.7, r * 0.18, "colCap", sides=7, top=0.6)
    c["after"] = True


def build_plateau_detail():
    """Breaks up the heather: darker patches, columns pushing up through it, a dry-stone wall along the back lots."""
    for k, (x, z, r) in enumerate(((-8.4, -2.6, 1.4), (8.8, -1.8, 1.2), (-7.6, 4.6, 1.1), (7.6, 3.6, 0.9), (3.6, -7.6, 1.0), (-1.6, 3.0, 0.8))):
        pts = [(x + math.cos(a) * r * (0.8 + 0.3 * math.sin(a * 3 + k)), z + math.sin(a) * r * (0.8 + 0.3 * math.cos(a * 2 + k))) for a in [i * math.pi / 5 for i in range(10)]]
        slab(f"patch-{k}", pts, TURF - 0.05, TURF + 0.16, "heathDark")
        slab(f"patch-{k}-top", grow(pts, -0.22), TURF + 0.1, TURF + 0.24, "heathLip")
    for k, (x, z, h) in enumerate(((-9.2, 0.8, 0.6), (-8.8, 1.7, 0.35), (9.6, 1.0, 0.5), (9.0, 1.9, 0.3), (-6.6, 7.4, 0.4), (4.6, -8.4, 0.45))):
        hexcol(f"outcrop-{k}", x, z, 0.55, TURF - 0.3, TURF + h)



# ---------------------------------------------------------------- the new base

def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, -0.3, "sea")
    # Core, peat band, heather lip and top: dark basalt, darker peat, light lip, mid heather. The heather sits back
    # from the outline so the ring of column tops shows round it from the table camera.
    slab("base-core", grow(OUTLINE, -0.3), -3.0, 2.2, "basalt", 0.8)
    slab("base-peat", grow(OUTLINE, -0.35), 2.1, 2.58, "peat")
    slab("base-lip", grow(OUTLINE, -0.45), 2.5, 2.74, "heathLip")
    slab("base-heath", grow(OUTLINE, -0.75), 2.7, TURF, "heath")

    # The rim: columns in clumps. A slow wave round the coast picks each clump's height tier, so neighbours share a
    # height and the rim steps up and down in runs; where the wave is lowest the rim has collapsed into a scree of
    # short stumps instead of a wall.
    near_cove = lambda x, z: inside(grow(QUAY, 0.6), x, z) or inside(grow(BEACH, 0.3), x, z)
    TIERS = [0.5, 1.2, 1.9, 2.35, 2.6]
    for i, (x, z, nx, nz) in enumerate(walk(OUTLINE, 1.45)):
        wave = math.sin(i * 0.37) * 0.6 + math.sin(i * 0.91 + 1.3) * 0.4
        tier = min(len(TIERS) - 1, max(0, int((wave + 1) / 2 * len(TIERS))))
        big = rng.random() < 0.22
        r = rng.uniform(1.25, 1.45) if big else rng.uniform(0.75, 1.05)
        cx, cz = x + nx * 0.45 + rng.uniform(-0.2, 0.2), z + nz * 0.45 + rng.uniform(-0.2, 0.2)
        if near_cove(cx, cz):
            continue
        if tier == 0:
            # Collapsed: a few short stumps tumbled out toward the sea.
            for j in range(3):
                d = rng.uniform(0.3, 1.8)
                hexcol(f"scree-{i}-{j}", cx + nx * d + rng.uniform(-0.5, 0.5), cz + nz * d + rng.uniform(-0.5, 0.5), rng.uniform(0.5, 0.8), -3.0, rng.uniform(-0.1, 1.1), shade=rng.uniform(0.8, 0.95))
            continue
        top = TIERS[tier] + rng.uniform(-0.12, 0.12)
        hexcol(f"rim-{i}", cx, cz, r, -3.0, top, shade=rng.uniform(0.8, 1.05))
        # A shorter column in front of a tall one, so the wall reads as steps rather than a fence.
        if tier >= 3 and rng.random() < 0.5:
            hexcol(f"rim-step-{i}", cx + nx * (r + 0.4), cz + nz * (r + 0.4), r * 0.7, -3.0, top - rng.uniform(0.8, 1.5), shade=0.9)
        # Causeway stumps at the waterline, in clumps (kept inside the sea loops' clearance, about radius 14.5).
        if math.sin(i * 1.3) > 0.3:
            sx, sz = x + nx * 2.3 + rng.uniform(-0.3, 0.3), z + nz * 2.3 + rng.uniform(-0.3, 0.3)
            if not near_cove(sx, sz) and math.hypot(sx, sz) < 13.6:
                hexcol(f"stump-{i}", sx, sz, rng.uniform(0.6, 0.85), -3.0, rng.uniform(-0.1, 0.8), shade=rng.uniform(0.85, 1.0))

    build_headland()
    build_plateau_detail()

    # Cove: stone quay with a marble coping round its edge, its front stepping into the sea.
    slab("quay", QUAY, -3.0, 0.5, "slate")
    ring = plan_ring("quay-coping", grow(QUAY, 0.12), grow(QUAY, -0.3), 0.45, 0.64, "stone")
    ring["after"] = True
    # Pier: planks on a dark frame, posts and bollards.
    slab("pier-deck", [(-1.1, 12.5), (1.1, 12.5), (1.1, 15.8), (-1.1, 15.8)], 0.42, 0.58, "wood")
    for s in (-1, 1):
        b = box(f"pier-rail-{s}", (s * 1.12, 0.56, 14.15), (0.18, 0.2, 3.4), "woodDark", bevel=0.03)
        b["after"] = True
        for zz in (13.0, 14.4, 15.7):
            p = beam(f"pier-post-{s}-{zz}", (s * 1.05, -1.2, zz), (s * 1.05, 0.8, zz), 0.26, "woodDark")
            p["after"] = True
            c = prism(f"pier-bollard-{s}-{zz}", (s * 1.05, 0.8, zz), 0.15, 0.1, "metal")
            c["after"] = True
    # Stairs up the cove's back wall, rising to the left onto the yard; a basalt parapet with a stone coping.
    steps = 8
    for k in range(steps):
        x0 = 2.3 - k * 0.52
        top = 0.62 + (k + 1) * (TURF - 0.62) / steps
        b = box(f"stair-{k}", (x0 - 0.26, (top - 0.3) / 2 + 0.15, 9.37), (0.52, top - 0.15, 0.74), "slate", bevel=0.03)
        b["after"] = True
        n = box(f"stair-nose-{k}", (x0 - 0.26, top - 0.02, 9.37), (0.54, 0.07, 0.78), "stone", bevel=0.015)
        n["after"] = True

    # Worn paths (direction C): stairs → warehouse → pennant between the lots, and a branch to the beach steps.
    def path(name, pts, w):
        for k in range(len(pts) - 1):
            (x0, z0), (x1, z1) = pts[k], pts[k + 1]
            ln = math.hypot(x1 - x0, z1 - z0)
            nx, nz = -(z1 - z0) / ln * w / 2, (x1 - x0) / ln * w / 2
            slab(f"{name}-{k}", [(x0 + nx, z0 + nz), (x1 + nx, z1 + nz), (x1 - nx, z1 - nz), (x0 - nx, z0 - nz)], TURF - 0.05, TURF + 0.03, "path")
            prism(f"{name}-joint-{k}", (x1, TURF - 0.05, z1), w / 2, 0.08, "path", sides=8)["after"] = True
    path("path-main", [(-2.0, 8.9), (-0.8, 7.6), (0.0, 4.6), (0.0, 1.6)], 1.3)
    path("path-beach", [(0.0, 7.4), (3.2, 7.6), (5.6, 7.1)], 1.0)

    # Beach: dark shingle shelving into the sea, a foam line along its edge.
    slab("beach-shelf", BEACH, -3.0, 0.22, "slate", 1.05)
    slab("beach-low", grow(BEACH, 0.7), -3.0, -0.08, "slate", 0.85)
    slab("beach-foam", grow(BEACH, 0.85), -0.31, -0.2, "foam")
    # Column-stump steps from the yard's edge down to the shingle.
    for k, (x, z, top) in enumerate(((6.5, 7.4, 2.25), (7.4, 8.1, 1.65), (8.2, 8.8, 1.05), (8.8, 9.6, 0.55))):
        hexcol(f"beach-step-{k}", x, z, 0.62, -1.0, top)
    # Boulders on the shingle.
    for k, (x, z, r) in enumerate(((11.2, 6.2, 0.45), (10.6, 8.6, 0.35), (12.0, 5.0, 0.3))):
        boulder(f"boulder-{k}", x, 0.05, z, r)


