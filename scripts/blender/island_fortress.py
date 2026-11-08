"""The fortress island's base (要塞島), shared by its blockout (blockout-island.py) and its build (build-island.py), both
run with `-- fortress`. docs/art/island-base-research.md §11 and §24 have the design.

After the bastioned sea forts of the 17th century (Bourtange's trace, Valletta's battered ramparts, Mont-Saint-Michel's
tide-cut causeway):
- outline: a reef of grey limestone, fractured and angular, with a bastioned rampart standing on it (two pointed
  bastions flank the front curtain, each with a stone sentry box on its tip); off the right side a sand bar (a tombolo)
  runs out to a small outer rock with a watch post;
- the rampart: a battered (sloping) masonry face with a rolled cordon half way up and a coping on top, lighter and
  warmer than the dark wet rock it stands on (the trim);
- terrain: the parade ground in the middle, kerbed; round it a long grass glacis sloping out and down to the rampart's
  top;
- access: a tunnel gate: an arched water gate in the front curtain on the stone landing; the tunnel runs inside the
  rampart and comes out of a second arch at the low end of an open cutting that climbs along the front of the glacis
  to the parade ground;
- dock: the water gate's stone landing with a crane jib, a stone jetty out from its front;
- backdrop base: a flat-topped limestone ledge under the star fort, built apart so it turns with it.
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "ashlar": ("#b3a993", "#968c78"),
        "cordon": ("#f0eadb", "#dbd4c2"),
        "barSand": ("#ead8aa", "#d6c190"),
        "rockTop": ("#8f94a8", "#7f8498"),
        "wetSlate": ("#4f5160", "#3d3f4b"),
        "parade": ("#d9c9a2", "#c8b78f"),
        "wetSand": ("#b99868", "#a2825a"),
    }
)
rng = random.Random(53)

WALL_TOP = 1.4
WALL_FOOT = 0.1
BATTER = 0.75  # how far the rampart's foot stands out from its top
CORDON_Y = 0.8
# The rampart's top outline: a bastion each side of the front curtain, straight faces round the sides and the back.
CURTAIN_Z = 11.4
WALL = [
    (-5.2, CURTAIN_Z), (6.4, CURTAIN_Z), (6.8, 12.2), (10.6, 13.6), (11.8, 8.6), (10.8, 8.0), (10.4, -4.8),
    (11.4, -5.2), (12.8, -10.6), (8.2, -11.2), (7.6, -10.2), (-7.6, -10.2), (-8.2, -11.2), (-12.8, -10.8),
    (-11.4, -5.2), (-10.4, -4.8), (-10.8, 8.0), (-11.8, 8.6), (-10.4, 13.8), (-5.6, 12.2),
]
BASTION_TIPS = [(10.6, 13.6), (-10.4, 13.8)]
# The parade ground, kerbed; a tongue at its front right takes the cutting's top.
YARD = [(-7.6, -4.6), (-5.2, -7.4), (5.2, -7.4), (7.6, -4.6), (7.6, 7.0), (2.2, 7.0), (2.2, 8.8), (0.6, 8.8), (0.6, 7.0), (-5.4, 7.0), (-7.6, 4.8)]
# The open cutting: from the inner arch at its low west end up along the glacis' front to the parade ground.
CUT = [(-5.8, 1.75, 8.1), (1.4, TURF, 8.1)]
CUT_W = 1.4
# The water gate's landing in front of the curtain, the jetty out from it, the water gate's arch on the curtain.
LANDING = [(-5.0, 11.2), (6.2, 11.2), (6.2, 13.2), (-5.0, 13.2)]
LANDING_TOP = 0.7
JETTY = [(-1.0, 13.1), (1.0, 13.1), (1.0, 15.8), (-1.0, 15.8)]
GATE_X = -3.6
# The tombolo and the outer rock off the right side.
ISLET = (18.2, 3.2)
ISLET_R = 2.4
BAR = [(11.0, -2.2), (13.4, -1.0), (15.0, 0.4), (17.0, 0.8), (17.4, 5.0), (15.4, 4.6), (13.6, 4.0), (11.0, 3.8)]

HEADLAND_PREFIXES = ("head-",)
OPEN_PARTS = ("base-", "head-", "wall", "cut", "sea", "bar", "islet", "landing", "jetty")
SHORE_SKIP = ("islet", "bar", "shard")
AO_WEIGHTS = {"wall": 0.3, "cut": 0.3, "landing": 0.3, "bar": 0.25, "islet": 0.3}
CLOSE_UPS = {
    "gate-close": (-20, 20, (-2.0, 1.4, 11.0), 15),
    "cutting-close": (-55, 30, (-2.5, 2.2, 8.0), 12),
    "tombolo-close": (70, 22, (14.0, 0.6, 2.0), 14),
}


def wall_at(h):
    """The rampart's outline at height h, between its foot and its top (the batter)."""
    return grow(WALL, BATTER * (WALL_TOP - h) / (WALL_TOP - WALL_FOOT))


def rock_outline():
    """The limestone reef: the rampart's foot pushed out by a fractured, uneven margin, its corners sharp."""
    out = []
    for x, z, nx, nz in walk(grow(WALL, BATTER), 1.7):
        d = rng.uniform(1.0, 2.6)
        if rng.random() < 0.18:
            d = 0.3  # a crack cut back into the reef
        out.append((x + nx * d, z + nz * d))
    return out


ROCK = rock_outline()


def build_rock():
    def h(x, z, d):
        return min(0.45, SEA - 0.5 + d * 1.0) + 0.12 * math.sin(x * 1.3) * math.cos(z * 1.1)

    def c(x, z, y, slope):
        return "wetSlate" if y < 0.0 else ("rockTop" if slope < 0.35 else "slate")

    cdt_terrain("base-rock", ROCK, h, c, spacing=1.2, seed=5, by_lowest=True)
    slab("base-core", grow(WALL, BATTER * 0.5), FOOT, 0.2, "wetSlate")
    # Fallen blocks at the reef's edge.
    for k, (x, z, nx, nz) in enumerate(walk(ROCK, 2.3)):
        if rng.random() < 0.45 or inside([(-6.0, 11.0), (7.0, 11.0), (7.0, 17.0), (-6.0, 17.0)], x, z):
            continue
        s = rng.uniform(0.5, 1.1)
        px, pz = x + nx * rng.uniform(0.2, 1.0), z + nz * rng.uniform(0.2, 1.0)
        prism(f"shard-{k}", (px, FOOT, pz), s, SEA + s * 0.7 - FOOT, rng.choice(["slate", "wetSlate"]), sides=rng.choice([4, 5]), top=0.55)["after"] = True


def build_wall():
    """The battered rampart, its cordon and its coping, and a sentry box on each front bastion's tip."""
    surface("wall-face", [[(x, WALL_FOOT, z) for x, z in wall_at(WALL_FOOT)], [(x, WALL_TOP, z) for x, z in WALL]], "ashlar", face_up=False)
    off = BATTER * (WALL_TOP - CORDON_Y) / (WALL_TOP - WALL_FOOT)
    ob = plan_ring("wall-cordon", grow(WALL, off + 0.16), grow(WALL, off - 0.2), CORDON_Y - 0.09, CORDON_Y + 0.09, "cordon")
    ob["after"] = True
    ob = plan_ring("wall-coping", grow(WALL, 0.16), grow(WALL, -0.4), WALL_TOP - 0.06, WALL_TOP + 0.14, "cordon")
    ob["after"] = True
    for k, (x, z) in enumerate(BASTION_TIPS):
        # Set back a little from the tip, on the coping.
        cx, cz = x * 0.93, z * 0.93
        prism(f"wall-sentry-{k}-corbel", (cx, WALL_TOP - 0.5, cz), 0.32, 0.62, "cordon", sides=8, top=1.5)["after"] = True
        prism(f"wall-sentry-{k}", (cx, WALL_TOP + 0.12, cz), 0.5, 1.0, "ashlar", sides=8)["after"] = True
        prism(f"wall-sentry-{k}-roof", (cx, WALL_TOP + 1.12, cz), 0.62, 0.7, "slate", sides=8, top=0.08)["after"] = True
        box(f"wall-sentry-{k}-slit", (cx + x / math.hypot(x, z) * 0.46, WALL_TOP + 0.7, cz + z / math.hypot(x, z) * 0.46), (0.14, 0.34, 0.14), "dark", bevel=0.0)["after"] = True


def glacis_height(x, z):
    """The glacis: from the rampart's top it rises inward, long and gentle, to just under the parade ground's kerb;
    cut down along the cutting."""
    d = coast_distance(WALL, x, z) if inside(WALL, x, z) else 0.0
    # Under the coping (its slab spans WALL_TOP - 0.06 .. + 0.14) the turf stays well clear of the slab's top (0.1 would
    # flicker on a phone's shallow depth buffer); under the parade ground (slab TURF - 0.4 .. TURF) it sinks into the slab
    # (0.3 clear of its top) instead of lying 0.08 below it, where the grass and the sand fought for the same pixels.
    y = min(TURF - 0.08, WALL_TOP - 0.02 + max(0.0, d - 0.5) * 0.45)
    if inside(YARD, x, z):
        y = min(y, TURF - 0.38)
    dist, bed = polyline_distance(CUT, x, z)
    if dist < CUT_W / 2 + 0.25:
        y = min(y, bed - 0.08)
    return y


def build_glacis():
    def h(x, z, d):
        return glacis_height(x, z)

    cdt_terrain("base-glacis", grow(WALL, -0.3), h, lambda x, z, y, s: "slate" if polyline_distance(CUT, x, z)[0] < CUT_W / 2 + 0.3 else "sageTurf", spacing=0.9, seed=7)
    slab("base-yard", YARD, TURF - 0.4, TURF, "parade")
    ob = plan_ring("base-yard-kerb", grow(YARD, 0.18), grow(YARD, -0.05), TURF - 0.45, TURF + 0.05, "cordon")
    ob["after"] = True


def build_cutting():
    """The open cutting: a stone-paved ramp between two retaining walls up to the grass, an arch at its low end where
    the tunnel comes out of the rampart."""
    (ax, ay, az), (bx, by, bz) = CUT
    pts = [(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t) for t in [k / 10 for k in range(11)]]
    ribbon("cut-bed", pts, CUT_W, "stone", lift=0.0)
    for side in (-1, 1):
        z = az + side * CUT_W / 2
        top, bottom = [], []
        for x, y, _ in pts:
            g = max(glacis_height(x, z + side * 0.5), y + 0.12)
            top.append((x, g + 0.08, z))
            bottom.append((x, y - 0.1, z))
        surface(f"cut-wall-{side}", [bottom, top], "ashlar", face_up=False, closed=False)
        beam(f"cut-wall-cope-{side}", (ax, top[0][1], z + side * 0.06), (bx, top[-1][1], z + side * 0.06), 0.2, "cordon", sides=4)["after"] = True
    # The inner arch: a masonry face across the cutting's low end, its arch framed in light stone.
    box("cut-head", (ax - 0.3, ay + 0.75, az), (0.6, 1.5, CUT_W + 0.4), "ashlar", bevel=0.02)["after"] = True
    box("cut-arch-frame", (ax + 0.02, ay + 0.55, az), (0.12, 1.15, 1.05), "cordon", bevel=0.02)["after"] = True
    box("cut-arch", (ax + 0.06, ay + 0.48, az), (0.08, 0.95, 0.8), "dark", bevel=0.0)["after"] = True


def build_landing():
    """The water gate: its arch in the curtain over the stone landing, the landing's crane jib, the jetty."""
    slab("landing-body", LANDING, FOOT, LANDING_TOP - 0.1, "ashlar")
    ob = plan_ring("landing-coping", grow(LANDING, 0.1), grow(LANDING, -0.3), LANDING_TOP - 0.12, LANDING_TOP + 0.02, "cordon")
    ob["after"] = True
    slab("landing-deck", grow(LANDING, -0.3), LANDING_TOP - 0.2, LANDING_TOP, "stone")
    slab("landing-tide", grow(LANDING, 0.05), FOOT, SEA + 0.35, "wetSlate")
    slab("jetty-body", JETTY, FOOT, 0.5, "ashlar")
    ob = plan_ring("jetty-coping", grow(JETTY, 0.1), grow(JETTY, -0.25), 0.48, 0.62, "cordon")
    ob["after"] = True
    slab("jetty-deck", grow(JETTY, -0.25), 0.4, 0.6, "stone")
    slab("jetty-tide", grow(JETTY, 0.05), FOOT, SEA + 0.35, "wetSlate")
    # The water gate in the curtain: the face leans back, so the frame stands at the face's height over the landing.
    zf = CURTAIN_Z + BATTER * (WALL_TOP - 1.25) / (WALL_TOP - WALL_FOOT)
    box("landing-gate-frame", (GATE_X, LANDING_TOP + 0.62, zf + 0.12), (1.5, 1.28, 0.4), "cordon", bevel=0.03)["after"] = True
    box("landing-gate", (GATE_X, LANDING_TOP + 0.5, zf + 0.34), (1.0, 1.0, 0.06), "dark", bevel=0.0)["after"] = True
    for k in range(4):
        x = GATE_X - 0.36 + k * 0.24
        beam(f"landing-portcullis-{k}", (x, LANDING_TOP + 0.05, zf + 0.39), (x, LANDING_TOP + 1.0, zf + 0.39), 0.05, "metal", sides=4)["after"] = True
    # The crane jib at the landing's right end, swung out over the water.
    cx, cz = 5.4, 12.8
    beam("landing-crane-post", (cx, LANDING_TOP, cz), (cx, LANDING_TOP + 2.8, cz), 0.32, "woodDark", sides=4)["after"] = True
    beam("landing-crane-jib", (cx, LANDING_TOP + 2.3, cz), (cx + 1.4, LANDING_TOP + 3.0, cz + 2.0), 0.2, "woodDark", sides=4)["after"] = True
    beam("landing-crane-rope", (cx + 1.35, LANDING_TOP + 2.95, cz + 1.95), (cx + 1.35, LANDING_TOP + 1.4, cz + 1.95), 0.05, "rope", sides=4)["after"] = True
    box("landing-crane-load", (cx + 1.35, LANDING_TOP + 1.2, cz + 1.95), (0.5, 0.4, 0.5), "wood", bevel=0.04)["after"] = True
    for k, (x, z) in enumerate(((-4.4, 13.1), (2.2, 13.1), (0.7, 15.5), (-0.7, 15.5))):
        prism(f"landing-bollard-{k}", (x, LANDING_TOP if z < 13.3 else 0.6, z), 0.15, 0.32, "dark", sides=8)["after"] = True


def build_tombolo():
    """The sand bar running out to the outer rock, wet at its edges, and the rock with its watch post."""

    def h(x, z, d):
        return min(0.3, SEA - 0.2 + d * 0.5)

    cdt_terrain("bar", BAR, h, lambda x, z, y, s: "wetSand" if y < 0.05 else "barSand", spacing=0.6, seed=3, by_lowest=True)
    ix, iz = ISLET
    plan = [(ix + math.cos(a) * ISLET_R * r, iz + math.sin(a) * ISLET_R * r) for a, r in
            [(2 * math.pi * k / 9 + 0.2, (1.0, 0.78, 1.08, 0.86, 1.12, 0.7, 1.0, 0.9, 1.05)[k]) for k in range(9)]]

    def ih(x, z, d):
        return min(1.5, SEA - 0.4 + d * 2.2)

    cdt_terrain("islet", plan, ih, lambda x, z, y, s: "wetSlate" if y < 0.05 else ("rockTop" if y > 1.45 else "slate"), spacing=0.6, seed=4, by_lowest=True)
    prism("islet-post", (ix, 1.4, iz), 0.55, 1.2, "ashlar", sides=6)["after"] = True
    prism("islet-post-cope", (ix, 2.55, iz), 0.66, 0.14, "cordon", sides=6)["after"] = True
    beam("islet-post-pole", (ix, 2.69, iz), (ix, 3.9, iz), 0.08, "woodDark", sides=4)["after"] = True


def sea_rocks():
    return [(ISLET[0], ISLET[1], ISLET_R + 0.2)]


def build_headland():
    """The star fort's bed: a flat ledge of the same limestone, its edges broken, falling steeply into the sea."""
    plan = [(-6.6, -7.2), (-2.0, -6.6), (2.6, -7.0), (6.8, -6.8), (7.6, -10.6), (8.6, -12.4), (7.2, -14.4),
            (7.8, -17.6), (5.0, -20.8), (1.2, -20.2), (-2.4, -21.4), (-6.2, -19.6), (-7.0, -17.0), (-8.6, -14.6),
            (-7.4, -12.2), (-8.0, -9.6)]

    def h(x, z, d):
        return min(TURF - 0.45, SEA - 0.6 + d * 1.8)

    cdt_terrain("head", plan, h, lambda x, z, y, s: "wetSlate" if y < 0.05 else ("rockTop" if s < 0.3 else "slate"), spacing=1.0, seed=8, by_lowest=True)
    for k in range(7):
        a = rng.uniform(0, 2 * math.pi)
        x, z = math.cos(a) * rng.uniform(8.6, 9.6), -14.0 + math.sin(a) * rng.uniform(7.0, 7.8)
        if z > -8:
            continue
        prism(f"head-boulder-{k}", (x, FOOT, z), rng.uniform(0.4, 0.8), rng.uniform(2.8, 3.4), "slate", sides=4, top=0.5)["after"] = True


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    build_rock()
    build_wall()
    build_glacis()
    build_cutting()
    build_landing()
    build_tombolo()
    build_headland()
