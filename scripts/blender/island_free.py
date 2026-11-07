"""The free port's base (自由港), shared by its blockout (blockout-island.py) and its build (build-island.py), both run
with `-- free-port`. docs/art/island-base-research.md §11 and §24 have the design.

After the Dutch harbour towns (Willemstad's Handelskade, Amsterdam's grachten): a man-made island, nothing natural left.
- outline: one cross-shaped town of straight ochre brick quay walls meeting at cut corners (an arm to the back, the
  left and the right, for the Willemstad row to stand on whichever way it turns), never a curve, except one curved
  stone mole that hooks round the front left and holds a harbour basin; the staircase of canal locks pokes out of the
  front wall into the sea;
- every wall is trimmed: a white stone coping on top, brick pilasters along the face, a dark tide line at the foot;
- terrain: all paved and level (the town square at the yard, checkered in two creams), the quay by the water a step
  lower than the yard; the canal runs across the square and down the locks (the `canal` scenery, laid in);
- access: the canal's locks (scenery) for the boats, and a long stone-slab ramp along the front wall, from the mole's
  root on the low quay up to the square;
- dock: the curved mole, its head the berth, with bollards and a little harbour light;
- backdrop base: none apart: the Willemstad row stands on the square's paving, on the arm it is turned to.
"""

import math

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "brick": ("#c97c52", "#a95f3c"),
        "brickLight": ("#dc956a", "#c07a52"),
        "tide": ("#4f4a48", "#3b3736"),
        "coping": ("#f4efe4", "#dcd5c6"),
        "paving": ("#f2dcbc", "#e2c9a6"),
        "pavingDark": ("#e3c69e", "#d2b48c"),
        "quayStone": ("#c9b79c", "#b09d82"),
        "cobble": ("#bf9f78", "#a98a64"),
        "cobbleEdge": ("#8f7258", "#7a5f48"),
    }
)

LOW = 1.2  # the low quay by the water, a step under the square
COPE = 0.16  # the coping's depth; it stands 0.03 proud of the paving
LIP = 0.14  # how far the coping overhangs the wall face
TIDE = SEA + 0.4  # the tide line's top

# The square (the yard): straight walls, cut corners. Its front steps back on the left, where the low quay and the ramp
# run along it, and juts forward to the lock head on the right.
SQUARE = [
    (1.86, 9.9), (7.6, 9.9), (10.6, 6.6), (14.2, 6.6), (15.2, 5.6), (15.2, -5.6), (14.2, -6.6), (9.0, -6.6),
    (6.6, -9.0), (6.6, -14.2), (5.6, -15.2), (-5.6, -15.2), (-6.6, -14.2), (-6.6, -9.0), (-9.0, -6.6), (-14.2, -6.6),
    (-15.2, -5.6), (-15.2, 5.6), (-14.2, 6.6), (-10.6, 6.6), (-8.6, 8.2), (-0.6, 8.2), (-0.6, 9.6), (1.86, 9.6),
]
# The low quays: left of the locks (along the left arm's front and the square's front, where the mole and the ramp
# start) and right of them, round the cut corner.
QUAY_LEFT = [
    (-14.2, 6.6), (-10.6, 6.6), (-8.6, 8.2), (-0.6, 8.2), (-0.6, 9.6), (1.86, 9.6), (1.86, 11.4), (-9.0, 11.4),
    (-12.4, 9.4), (-14.2, 7.8),
]
QUAY_RIGHT = [(3.34, 9.9), (7.6, 9.9), (10.6, 6.6), (14.2, 6.6), (13.0, 8.4), (9.0, 12.0), (3.34, 12.0)]
# The ramp along the front wall: from the low quay at the mole's root, up to the square at the lock head.
RAMP = (-8.6, -0.6, 8.2, 9.6)  # x0 (foot), x1 (top), z0 (against the wall), z1
# The mole's centreline, from its root on the low quay round the basin to its head off the front.
MOLE = [(-9.0, 11.2), (-9.4, 13.2), (-8.2, 14.6), (-5.6, 15.3), (-2.8, 15.4), (-0.6, 14.9)]
MOLE_W = 1.5
MOLE_TOP = 1.05
HEAD_AT = (-0.3, 14.9)
HEAD_R = 1.15
# The Willemstad row (islandScenery.ts: at [0, RIM, -11] ×3, about x ±5.2, z -14..-7.8) stands on the square itself,
# raised to its paving; it turns to the back, the left or the right, so the square reaches out in an arm each way and
# reads as a cross-shaped town from above.
BLOCKOUT_MOVES = {"willemstad-row": (0, TURF - 2.4, 0)}

HEADLAND_PREFIXES = ("head-",)  # nothing turns: the row stands on the square
OPEN_PARTS = ("base-", "head-", "mole", "ramp", "sea", "pave")
SHORE_SKIP = ()
AO_WEIGHTS = {"pave": 0.2, "ramp": 0.3, "mole": 0.3}
CLOSE_UPS = {
    "harbour-close": (-25, 22, (-4.0, 1.2, 12.0), 15),
    "locks-close": (25, 20, (3.0, 1.5, 11.0), 13),
    "arm-close": (80, 22, (12.0, 2.0, 0.0), 15),
}


def quay_block(prefix, plan, top, mat="brick"):
    """A walled block of the town: a brick body from the sea floor, a dark tide line at its foot, a white coping round
    its top edge overhanging the face, and pilasters along every face."""
    slab(f"{prefix}-body", plan, FOOT, top - COPE + 0.01, mat)
    slab(f"{prefix}-tide", grow(plan, 0.05), FOOT, TIDE, "tide")
    ob = plan_ring(f"{prefix}-coping", grow(plan, LIP), grow(plan, -0.4), top - COPE, top + 0.03, "coping")
    ob["after"] = True
    for k, (x, z, nx, nz) in enumerate(walk(plan, 2.4)):
        w = 0.5
        h = top - COPE - TIDE
        box(f"{prefix}-pilaster-{k}", (x + nx * 0.06, TIDE + h / 2, z + nz * 0.06), (w if abs(nz) > 0.5 else 0.14, h, 0.14 if abs(nz) > 0.5 else w),
            "brickLight", bevel=0.0)["after"] = True


def paving(prefix, plan, top, mat="paving"):
    """The paving inside a block's coping, flush with the square's level."""
    slab(f"{prefix}", grow(plan, -0.38), top - COPE - 0.02, top, mat)


def build_square():
    quay_block("base-square", SQUARE, TURF)
    paving("pave-square", SQUARE, TURF)
    # A border of darker slabs inside the coping, framing the square the way a Dutch plein is framed by its kerb.
    ob = plan_ring("pave-border", grow(SQUARE, -0.38), grow(SQUARE, -1.15), TURF - 0.02, TURF + 0.012, "pavingDark")
    ob["after"] = True


# Each arm's street, in its own frame (u out along the arm, v across it): from the lots out to the square's border, and
# the round little plein it runs through half way.
STREET = {"from": 7.8, "to": 14.06, "width": 2.4}
PLEIN = {"at": 11.2, "radius": 2.0}
ARMS = {"back": lambda u, v: (v, -u), "left": lambda u, v: (-u, v), "right": lambda u, v: (u, -v)}


def flat(name, plan, top, mat):
    """A flat patch laid on the paving (a hair proud of it)."""
    slab(name, plan, top - 0.02, top, mat)


def build_streets():
    """The arms' paving: a cobbled street down the middle of each, kerbed, from the lots out to the square's border, and
    a round plein ringed in the border's darker cream half way along, so an arm left empty by the row of houses still
    reads as a street. All flat: the houses stand on it when they turn there."""
    u0, u1, w = STREET["from"], STREET["to"], STREET["width"]
    for arm, to in ARMS.items():
        quad = lambda a, b, c, d: [to(a, c), to(b, c), to(b, d), to(a, d)]
        flat(f"pave-street-{arm}", quad(u0, u1, -w / 2, w / 2), TURF + 0.012, "cobble")
        for side in (-1, 1):
            flat(f"pave-kerb-{arm}-{side}", quad(u0, u1, side * w / 2 - 0.1, side * w / 2 + 0.1), TURF + 0.02, "cobbleEdge")
        cx, cz = to(PLEIN["at"], 0)
        r = PLEIN["radius"]
        ring = lambda rr: [(cx + math.cos(2 * math.pi * (k + 0.5) / 16) * rr, cz + math.sin(2 * math.pi * (k + 0.5) / 16) * rr) for k in range(16)]
        ob = plan_ring(f"pave-plein-ring-{arm}", ring(r), ring(r - 0.3), TURF + 0.004, TURF + 0.03, "cobbleEdge")
        ob["after"] = True
        flat(f"pave-plein-{arm}", ring(r - 0.29), TURF + 0.018, "cobble")
        flat(f"pave-plein-heart-{arm}", ring(0.45), TURF + 0.03, "cobbleEdge")


def build_quays():
    for name, plan in (("left", QUAY_LEFT), ("right", QUAY_RIGHT)):
        quay_block(f"base-quay-{name}", plan, LOW)
        paving(f"pave-quay-{name}", plan, LOW, "quayStone")
    # Bollards along the low quays' water edges.
    spots = [(-7.6, 11.0), (-4.6, 11.0), (-1.6, 11.0), (-12.2, 8.8), (4.6, 11.6), (7.4, 11.6)]
    for k, (x, z) in enumerate(spots):
        bollard(f"base-bollard-{k}", x, LOW + 0.03, z)
    # A loading crane on the right quay, its jib out over the water, bales waiting beside it.
    beam("base-crane-post", (11.6, LOW, 7.6), (11.6, LOW + 2.6, 7.6), 0.34, "woodDark", sides=4)["after"] = True
    beam("base-crane-jib", (11.4, LOW + 2.2, 7.4), (13.2, LOW + 3.0, 9.6), 0.2, "woodDark", sides=4)["after"] = True
    beam("base-crane-stay", (11.6, LOW + 2.6, 7.6), (13.0, LOW + 3.0, 9.4), 0.06, "rope", sides=4)["after"] = True
    for k, (x, z) in enumerate(((9.6, 9.4), (10.4, 8.6))):
        box(f"base-quay-bale-{k}", (x, LOW + 0.33, z), (0.7, 0.6, 0.7), "canvas", bevel=0.05)["after"] = True


def bollard(name, x, y, z):
    prism(name, (x, y, z), 0.16, 0.34, "dark", sides=8)["after"] = True
    prism(f"{name}-cap", (x, y + 0.34, z), 0.21, 0.08, "dark", sides=8)["after"] = True


def build_ramp():
    """The long stone-slab ramp along the front wall: a wedge from the low quay up to the square, its outer side a brick
    parapet with a white coping, cross ribs of slab every so often for footing."""
    x0, x1, z0, z1 = RAMP
    h0, h1 = LOW, TURF

    def y(x):
        return h0 + (h1 - h0) * (x - x0) / (x1 - x0)

    verts = [(x0, LOW - 0.1, z0), (x1, LOW - 0.1, z0), (x1, LOW - 0.1, z1), (x0, LOW - 0.1, z1),
             (x0, h0, z0), (x1, h1, z0), (x1, h1, z1), (x0, h0, z1)]
    faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [0, 3, 7, 4], [1, 5, 6, 2]]
    mesh_from("ramp-bed", verts, faces, "quayStone")["after"] = True
    n = 9
    for k in range(1, n):
        x = x0 + (x1 - x0) * k / n
        beam(f"ramp-rib-{k}", (x, y(x) + 0.02, z0 + 0.05), (x, y(x) + 0.02, z1 - 0.3), 0.1, "stone", sides=4)["after"] = True
    # The parapet on the open side, rising with the ramp.
    pz = z1 - 0.14
    verts = [(x0, LOW - 0.1, pz - 0.14), (x1, h1 - 0.1, pz - 0.14), (x1, h1 - 0.1, pz + 0.14), (x0, LOW - 0.1, pz + 0.14),
             (x0, h0 + 0.42, pz - 0.14), (x1, h1 + 0.42, pz - 0.14), (x1, h1 + 0.42, pz + 0.14), (x0, h0 + 0.42, pz + 0.14)]
    mesh_from("ramp-parapet", verts, faces, "brick")["after"] = True
    beam("ramp-parapet-cope", (x0 - 0.05, h0 + 0.46, pz), (x1 + 0.05, h1 + 0.46, pz), 0.38, "coping", sides=4)["after"] = True


def mole_plan():
    """The mole's two sides offset from its centreline, joined round its root and its head."""
    left, right = [], []
    for k, (x, z) in enumerate(MOLE):
        a = MOLE[max(k - 1, 0)]
        b = MOLE[min(k + 1, len(MOLE) - 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dz) or 1
        nx, nz = -dz / ln * MOLE_W / 2, dx / ln * MOLE_W / 2
        left.append((x + nx, z + nz))
        right.append((x - nx, z - nz))
    return left + right[::-1]


def build_mole():
    """The curved stone mole round the basin, the dock: brick on a dark tide line, a white coping, its head a round
    berth with bollards and a small harbour light; the basin's still water inside it is a lighter sea."""
    plan = mole_plan()
    slab("mole-body", plan, FOOT, MOLE_TOP - COPE + 0.01, "quayStone")
    slab("mole-tide", grow(plan, 0.05), FOOT, TIDE, "tide")
    ob = plan_ring("mole-coping", grow(plan, 0.1), grow(plan, -0.3), MOLE_TOP - COPE, MOLE_TOP + 0.03, "coping")
    ob["after"] = True
    slab("mole-deck", grow(plan, -0.3), MOLE_TOP - COPE - 0.02, MOLE_TOP, "quayStone")
    hx, hz = HEAD_AT
    prism("mole-head", (hx, FOOT, hz), HEAD_R, MOLE_TOP + 0.01 - FOOT, "quayStone", sides=12)["after"] = True
    prism("mole-head-tide", (hx, FOOT, hz), HEAD_R + 0.05, TIDE - FOOT, "tide", sides=12)["after"] = True
    prism("mole-head-cope", (hx, MOLE_TOP - COPE, hz), HEAD_R + 0.1, COPE + 0.03, "coping", sides=12)["after"] = True
    # The harbour light: a white stone stump with a red lantern cap, at the head's back so the berth stays clear.
    prism("mole-light", (hx - 0.4, MOLE_TOP + 0.03, hz - 0.35), 0.32, 1.3, "plaster", sides=8, top=0.8)["after"] = True
    prism("mole-light-cap", (hx - 0.4, MOLE_TOP + 1.33, hz - 0.35), 0.34, 0.36, "roofRed", sides=8, top=0.3)["after"] = True
    for k, (x, z) in enumerate(((hx + 0.6, hz + 0.6), (hx - 0.6, hz + 0.75), (-4.2, 15.75), (-7.6, 15.0))):
        bollard(f"mole-bollard-{k}", x, MOLE_TOP + 0.03, z)


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    build_square()
    build_streets()
    build_quays()
    build_ramp()
    build_mole()
