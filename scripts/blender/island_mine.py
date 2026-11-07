"""The mine island's base (礦山島), shared by its blockout (blockout-island.py) and its build (build-island.py), both
run with `-- mine`. docs/art/island-base-research.md §11 has the design.

A granite island worked as a quarry and mine:
- outline: the rock's own, fractured: long straight facets of weathered grey rock meeting at hard corners, broken by
  cracks, tilted blocks and fallen slabs along the shore and sharp stacks off it;
- terrain: the yard is a gravel floor on the natural rock's crown; the rock falls away round it in a faceted
  shoulder; at the front left a square quarry pit is cut into it, two benches deep and open to the sea, its faces
  sheer and fresh, timber cribbing on its edges and rust streaks of ore on its faces (the trim);
- access: no stairs: a long, straight incline railway runs on a stone ramp from the yard's front right corner down
  across the benches to the wharf, rails on sleepers;
- shore: a fan of dark spoil tipped over the right side, spilling into the sea;
- dock: a timber wharf at the incline's foot, the pier running out from its front edge;
- backdrop base: the mountain's foot, a natural talus of weathered rock spreading into the sea, built apart so it
  turns with it.
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "granite": ("#9aa0b6", "#7a7f95"),  # the quarried faces: fresh rock, a little lighter than the weathered slate
        "graniteTop": ("#8e93a8", "#80859a"),
        "gravel": ("#80859a", "#73788c"),
        "rust": ("#b9653d", "#94492b"),
        "slag": ("#4c4c53", "#38383d"),
        "wetSlate": ("#4f5160", "#3d3f4b"),
        "rockTop": ("#959aae", "#83889c"),
    }
)
rng = random.Random(41)

# The yard sits on the natural rock's crown (a circle round the lots, so its edge runs along the terrain grid's rings).
YARD_R = 8.6
# The quarry: one pit cut square into the rock at the front left, open to the sea, two benches deep:
# (top height, x0, x1, z0, z1, corner step). It keeps clear of the shipyard lot, the pine and the warehouse.
PIT = [
    (2.05, -10.8, -6.0, 4.6, 10.4, 0.9),
    (1.3, -10.4, -7.6, 6.6, 11.2, 0.8),
]
INCLINE = [(6.6, TURF, 6.4), (2.4, 0.62, 12.4)]
INCLINE_W = 1.7
WHARF = [(-1.8, 12.1), (3.6, 12.1), (3.6, 13.8), (-1.8, 13.8)]
PIER = [(-1.0, 13.7), (1.0, 13.7), (1.0, 15.8), (-1.0, 15.8)]

# The mountain's plinth (islandScenery.ts: mountain at [0, SEA_FOOT, -11.2] ×6, about x ±9.6, z -17.4..-7.6).
HEAD = [(-10.6, -7.4), (10.6, -7.4), (10.6, -9.0), (11.4, -9.0), (11.4, -16.0), (-11.4, -16.0), (-11.4, -9.0), (-10.6, -9.0)]

HEADLAND_PREFIXES = ("head-",)
OPEN_PARTS = ("base-", "head-", "incline", "wharf", "pier-deck", "sea", "spoil")
SHORE_SKIP = ("slag-boulder", "head-boulder", "shard")
AO_WEIGHTS = {"base-rock": 0.3, "base-pit": 0.3, "spoil": 0.3, "incline": 0.3}
CLOSE_UPS = {"incline-close": (30, 18, (4.0, 1.4, 10.0), 15), "spoil-close": (80, 18, (11.0, 1.0, -2.0), 14), "pit-close": (-40, 18, (-9.0, 1.2, 8.0), 14)}


def pit_plan(x0, x1, z0, z1, step):
    """A square pit level with stepped corners on its yard side."""
    return [(x0, z0 + step), (x1 - step, z0 + step), (x1 - step, z0), (x1, z0), (x1, z1), (x0, z1)]


def build_pit():
    """The quarry pit: each level a flat floor of fresh-cut rock, its faces sheer, timber cribbing on the edges, rust
    on the faces; where the rock round a level stands higher, a fresh-cut wall stands between."""
    for k, (top, x0, x1, z0, z1, step) in enumerate(PIT):
        plan = pit_plan(x0, x1, z0, z1, step)
        slab(f"base-pit-{k}", plan, FOOT, top - 0.12, "granite", 1.0 - 0.05 * k)
        slab(f"base-pit-{k}-top", grow(plan, -0.05), top - 0.13, top, "graniteTop")
        for i in range(len(plan)):
            (ax, az), (bx, bz) = plan[i], plan[(i + 1) % len(plan)]
            mx, mz = (ax + bx) / 2, (az + bz) / 2
            above = rock_height(mx + (bz - az) * 0.0, mz) if False else None
            ln = math.hypot(bx - ax, bz - az)
            nx, nz = (bz - az) / ln, -(bx - ax) / ln  # outward for a counter-clockwise plan; checked below
            if inside(plan, mx + nx * 0.3, mz + nz * 0.3):
                nx, nz = -nx, -nz
            outside_y = rock_height(mx + nx * 0.6, mz + nz * 0.6)
            if outside_y > top + 0.15:
                # The face cut back into the higher rock.
                h = outside_y - top + 0.1
                box(f"base-pit-face-{k}-{i}", (mx + nx * 0.12, top + h / 2 - 0.05, mz + nz * 0.12), (ln if abs(nz) > 0.5 else 0.24, h, 0.24 if abs(nz) > 0.5 else ln),
                    "granite", bevel=0.0, shade=0.95)["after"] = True
            for j in range(int(ln / 1.2)):
                if rng.random() < 0.5:
                    t = (j + 0.5) / max(1, int(ln / 1.2))
                    px, pz = ax + (bx - ax) * t, az + (bz - az) * t
                    beam(f"base-crib-{k}-{i}-{j}", (px - (bx - ax) / ln * 0.5, top + 0.08, pz - (bz - az) / ln * 0.5), (px + (bx - ax) / ln * 0.5, top + 0.08, pz + (bz - az) / ln * 0.5), 0.18, "woodDark", sides=4)["after"] = True
            if rng.random() < 0.6:
                hh = rng.uniform(0.4, 0.9)
                box(f"base-rust-{k}-{i}", (mx + nx * 0.0, top - 0.15 - hh / 2, mz + nz * 0.0), (0.22, hh, 0.22), "rust", bevel=0.0)["after"] = True


# The coast, set by hand: long straight facets meeting at hard corners, broken by cracks (sharp re-entrant notches),
# the way fractured rock splits; never a smooth curve.
ROCK = [
    (13.6, -1.0), (12.4, 2.2), (13.8, 3.4), (12.2, 6.8), (10.2, 9.6), (8.0, 10.2), (8.4, 12.6), (4.6, 12.9),
    (2.8, 12.4), (-1.4, 12.3), (-4.0, 13.4), (-7.6, 12.2), (-9.0, 13.0), (-10.8, 11.8), (-11.4, 9.0), (-13.8, 7.0),
    (-12.4, 5.2), (-12.6, 3.6), (-14.4, 0.8), (-13.0, -1.4), (-13.2, -3.2), (-14.0, -6.0), (-11.0, -8.6),
    (-11.6, -10.2), (-9.4, -11.8), (-5.2, -12.4), (-4.0, -13.6), (-2.0, -14.0), (1.8, -12.6), (5.6, -13.6),
    (8.8, -11.0), (10.2, -8.2), (12.8, -7.4), (11.4, -5.6), (12.0, -4.2),
]


def rock_outline():
    return list(ROCK)


def tilted_block(name, center, size, yaw, tilt_x, tilt_z, mat):
    """A block of broken rock: a wedge turned by `yaw` and tipped over by the two tilts about its own centre."""
    cx, cy, cz = center
    w, h, d = size
    # A wedge, not a box: the top face pinched in and shoved aside by its own amounts, so no two blocks look cast.
    pinch_x, pinch_z = rng.uniform(0.35, 0.8), rng.uniform(0.35, 0.8)
    shove_x, shove_z = rng.uniform(-0.25, 0.25) * w, rng.uniform(-0.25, 0.25) * d
    corners = [((sx * w / 2) * (pinch_x if sy > 0 else 1) + (shove_x if sy > 0 else 0), sy * h / 2,
                (sz * d / 2) * (pinch_z if sy > 0 else 1) + (shove_z if sy > 0 else 0))
               for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    out = []
    for x, y, z in corners:
        y, z = y * math.cos(tilt_x) - z * math.sin(tilt_x), y * math.sin(tilt_x) + z * math.cos(tilt_x)
        x, y = x * math.cos(tilt_z) - y * math.sin(tilt_z), x * math.sin(tilt_z) + y * math.cos(tilt_z)
        x, z = x * math.cos(yaw) + z * math.sin(yaw), -x * math.sin(yaw) + z * math.cos(yaw)
        out.append((cx + x, cy + y, cz + z))
    # corners indexed sx*4 + sy*2 + sz
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    ob = mesh_from(name, out, faces, mat, convex=True)
    ob["after"] = True
    return ob


def build_shards():
    """Fractured rock along the shore: tilted blocks and fallen slabs at the cliff foot, sharp stacks off it."""
    for k, (x, z, nx, nz) in enumerate(walk(ROCK, 1.6)):
        if inside([(-2.2, 11.6), (4.0, 11.6), (4.0, 17.0), (-2.2, 17.0)], x, z) or rng.random() < 0.3:
            continue  # keep the wharf and the pier clear
        for j in range(rng.randint(1, 2)):
            d = rng.uniform(0.2, 2.0)
            px, pz = x + nx * d + rng.uniform(-0.5, 0.5), z + nz * d + rng.uniform(-0.5, 0.5)
            w = rng.uniform(0.6, 1.5)
            h = rng.uniform(0.5, 1.6)
            tilted_block(f"shard-{k}-{j}", (px, SEA + h * 0.3, pz), (w, h, w * rng.uniform(0.5, 0.9)), rng.uniform(0, math.pi),
                         math.radians(rng.uniform(-24, 24)), math.radians(rng.uniform(-24, 24)), rng.choice(["slate", "slate", "wetSlate"]))
    for k, (x, z, h) in enumerate(((16.0, 1.6, 2.6), (-16.2, 3.0, 3.2), (-6.2, -15.6, 2.4), (11.8, -11.0, 2.0), (-15.4, -4.4, 1.8))):
        ob = prism(f"shard-stack-{k}", (x, FOOT, z), rng.uniform(0.7, 1.0), h - FOOT, "slate", sides=4, top=0.45)
        ob["after"] = True


def rock_height(x, z):
    """The natural rock: flat at the yard on its crown, sloping away in a faceted shoulder to the sea; cut down inside
    the quarry pit's levels."""
    r = math.hypot(x, z)
    R = coast_r(math.atan2(z, x))
    if r <= YARD_R:
        y = TURF
    else:
        u = min(1.0, (r - YARD_R) / max(R - YARD_R, 0.5))
        y = TURF - (TURF + 0.55) * u ** 1.5 + 0.35 * math.sin(x * 0.7 + 1.3) * math.cos(z * 0.6 - 0.4) * u * (1 - u) * 4
    for top, x0, x1, z0, z1, step in PIT:
        if inside(pit_plan(x0, x1, z0, z1, step), x, z):
            y = min(y, top - 0.16)
    # The incline's cutting: the rock is cut down along it, easing back on either side.
    (ax, ay, az), (bx, by, bz) = INCLINE
    d, iy = polyline_distance(INCLINE, x, z)
    if d < INCLINE_W / 2 + 1.2:
        bed = iy - 0.12
        k = max(0.0, (d - INCLINE_W / 2 - 0.1) / 1.1)
        y = min(y, bed + (y - bed) * k * k) if y > bed else y
    return y


def coast_r(a):
    """Along angle a, where the rock outline's faceted edge lies."""
    plan = rock_outline()
    best = 0.0
    dx, dz = math.cos(a), math.sin(a)
    for i in range(len(plan)):
        (ax, az), (bx, bz) = plan[i], plan[(i + 1) % len(plan)]
        ex, ez = bx - ax, bz - az
        den = dx * ez - dz * ex
        if abs(den) < 1e-9:
            continue
        t = (ax * ez - az * ex) / den
        u = (ax * dz - az * dx) / den
        if t > 0 and 0 <= u <= 1:
            best = max(best, t)
    return best


def build_rock():
    """Natural rock, weathered the same grey as the mountain: the yard's gravel on its crown, darker at the waterline."""

    def c(x, z, y, slope):
        if math.hypot(x, z) <= YARD_R + 0.01 and abs(y - TURF) < 0.02:
            return "gravel"
        return "wetSlate" if y < 0.0 else ("rockTop" if y > 1.6 else "slate")

    radial_terrain("base-rock", rock_outline(), lambda x, z, t: rock_height(x, z), c, rings=22, around=96)
    slab("base-core", [(x * 0.9, z * 0.9) for x, z in rock_outline()], FOOT, -0.6, "wetSlate")


def build_incline():
    """The incline railway: a stone ramp, rails on sleepers, a winding drum at the head."""
    (ax, ay, az), (bx, by, bz) = INCLINE
    pts = [(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t) for t in [k / 12 for k in range(13)]]
    ribbon("incline-bed", pts, INCLINE_W, "slate", lift=0.0)
    for side in (-1, 1):
        top, bottom = [], []
        for x, y, z in pts:
            dx, dz = bx - ax, bz - az
            ln = math.hypot(dx, dz)
            ex, ez = x - dz / ln * INCLINE_W / 2 * side, z + dx / ln * INCLINE_W / 2 * side
            top.append((ex, y, ez))
            bottom.append((ex, FOOT, ez))
        surface(f"incline-wall-{side}", [bottom, top], "granite", face_up=False, closed=False)
        beam(f"incline-rail-{side}", (ax - (bz - az) / ln * 0.38 * side, ay + 0.1, az + (bx - ax) / ln * 0.38 * side),
             (bx - (bz - az) / ln * 0.38 * side, by + 0.1, bz + (bx - ax) / ln * 0.38 * side), 0.08, "metal", sides=4)["after"] = True
    for k, (x, y, z) in enumerate(pts[::1]):
        dx, dz = bx - ax, bz - az
        ln = math.hypot(dx, dz)
        nx, nz = -dz / ln, dx / ln
        beam(f"incline-sleeper-{k}", (x - nx * 0.6, y + 0.04, z - nz * 0.6), (x + nx * 0.6, y + 0.04, z + nz * 0.6), 0.14, "woodDark", sides=4)["after"] = True
    # Winding drum on a frame at the head.
    for s in (-1, 1):
        beam(f"incline-drum-post-{s}", (ax + s * 0.7, TURF, az - 0.9), (ax + s * 0.7, TURF + 1.2, az - 0.9), 0.16, "woodDark")["after"] = True
    beam("incline-drum", (ax - 0.8, TURF + 1.0, az - 0.9), (ax + 0.8, TURF + 1.0, az - 0.9), 0.55, "wood", sides=10)["after"] = True


def build_wharf():
    slab("wharf-deck", WHARF, 0.48, 0.64, "wood")
    for x, z in ((-1.6, 12.3), (3.4, 12.3), (-1.6, 13.6), (3.4, 13.6), (0.9, 13.6)):
        beam(f"wharf-pile-{x}-{z}", (x, FOOT, z), (x, 0.64, z), 0.26, "woodDark")["after"] = True
    box("wharf-edge", (0.9, 0.62, 13.8), (5.4, 0.16, 0.18), "woodDark", bevel=0.02)["after"] = True
    slab("pier-deck", PIER, 0.48, 0.62, "wood")
    for s in (-1, 1):
        box(f"pier-rail-{s}", (s * 1.02, 0.6, 14.75), (0.16, 0.18, 2.1), "woodDark", bevel=0.03)["after"] = True
        for z in (14.4, 15.6):
            beam(f"pier-pile-{s}-{z}", (s * 0.95, FOOT, z), (s * 0.95, 0.62, z), 0.22, "woodDark")["after"] = True
    # Ore waiting on the wharf.
    for k, (x, z) in enumerate(((2.6, 12.7), (3.1, 13.2))):
        prism(f"wharf-ore-{k}", (x, 0.64, z), 0.4, 0.45, "slag", sides=6, top=0.3)["after"] = True


def build_spoil():
    """A fan of dark spoil tipped over the right side's tall cut: it slumps from the yard's edge down into the sea,
    spreading as it falls."""
    ax, az = 8.3, -2.4  # where it is tipped, at the cut's top
    plan = [(ax, az - 1.6), (ax + 1.4, az - 3.4), (ax + 4.2, az - 4.4), (ax + 6.0, az - 2.6), (ax + 6.4, az + 0.4),
            (ax + 5.0, az + 3.0), (ax + 2.2, az + 3.4), (ax, az + 1.6)]

    def h(x, z, d):
        dist = math.hypot(x - ax, z - az)
        return min(TURF - 0.25, max(-0.6, TURF - 0.3 - dist * 0.62)) + min(0.0, d - 0.6) * 0.8

    cdt_terrain("spoil", plan, h, lambda x, z, y, s: "slag", spacing=0.8, seed=9)
    for k in range(8):
        a = rng.uniform(-1.1, 1.1)
        r = rng.uniform(5.0, 6.8)
        prism(f"slag-boulder-{k}", (ax + math.cos(a) * r, FOOT, az + math.sin(a) * r), rng.uniform(0.3, 0.55), rng.uniform(2.6, 3.1), "slag", sides=5, top=0.5)["after"] = True
    # The tipping chute at the top, a timber trough over the edge.
    beam("spoil-chute", (ax - 1.2, TURF + 0.55, az), (ax + 1.4, TURF - 0.25, az), 0.5, "woodDark", sides=4)["after"] = True


def build_headland():
    """The mountain's foot: a natural talus of weathered rock spreading from under the peaks into the sea."""
    cx, cz = 0.0, -12.0
    plan = [(cx + math.cos(a) * rx, cz + math.sin(a) * rz) for a, rx, rz in
            [(2 * math.pi * k / 14, 10.6 + 0.8 * math.sin(k * 1.7), 5.6 + 0.6 * math.cos(k * 2.3)) for k in range(14)]]

    def h(x, z, t):
        return 2.2 - 2.75 * t ** 1.6 + 0.3 * math.sin(x * 0.9) * math.cos(z * 0.8)

    radial_terrain("head", plan, h, lambda x, z, y, s: "wetSlate" if y < 0.0 else ("stone" if y > 1.2 else "slate"), center=(cx, cz), rings=6, around=None)
    for k in range(9):
        a = rng.uniform(0, 2 * math.pi)
        x, z = cx + math.cos(a) * rng.uniform(8.0, 11.0), cz + math.sin(a) * rng.uniform(4.0, 6.0)
        prism(f"head-boulder-{k}", (x, FOOT, z), rng.uniform(0.4, 0.8), rng.uniform(2.8, 3.6), "slate", sides=5, top=0.5)["after"] = True


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    build_rock()
    build_shards()
    build_pit()
    build_incline()
    build_wharf()
    build_spoil()
    build_headland()
