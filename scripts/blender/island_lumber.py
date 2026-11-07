"""The shipyard island's base (船塢島), shared by its blockout (blockout-island.py) and its build (build-island.py), both
run with `-- lumber`. docs/art/island-base-research.md §11 has the design.

After the Baltic and Norwegian timber coasts: granite worn smooth by the ice, forest on it.
- outline: a cluster of rounded lobes, one per dome, with rounded skerries scattered off it; no straight edge;
- terrain: the yard lies flat in the saddle between granite domes that rise above it, tree-crowned; everything is
  rounded, convex shoulders rolling down into the sea, no cliff anywhere; moss on the gentle tops, bare pink granite
  on the steep flanks, dark wet rock at the waterline (the trim);
- access: no stairs: a log slide, a long timber trough on trestles, runs from the yard down into the water; people
  walk a path down the smooth rock beside it;
- dock: a log crib wharf filled with stones, the pier running on from its front; a boom of logs floats by the slide;
- backdrop base: a flat-topped granite knoll for the windmill, inside the island's lobes, built apart so it turns.
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "pinkGranite": ("#c9a8a0", "#a3847e"),
        "moss": ("#6f9a5c", "#557d48"),
        "forestFloor": ("#5d7a5f", "#506b52"),
        "wetRock": ("#5a4d4f", "#463b3d"),
        "pine": ("#2f7a55", "#215a3e"),
        "log": ("#a4714c", "#7e5236"),
    }
)
rng = random.Random(53)

YARD_R = 8.4
# Granite domes round the yard: (x, z, radius, crown height). They rise above the yard, trees on their crowns.
# Lopsided: one great dome at the back left, a middling one on the right, two small ones; the coast swells round
# them without turning into petals.
DOMES = [(-9.8, -4.2, 6.2, 4.6), (10.4, -2.8, 4.2, 3.7), (-10.2, 7.8, 2.8, 3.2), (7.6, 9.6, 2.4, 3.1)]
SKERRIES = [(15.4, -2.0, 1.4, 0.7), (-14.6, 7.6, 1.2, 0.5), (12.4, 11.6, 1.0, 0.35), (-3.2, -16.0, 1.3, 0.6)]
SLIDE = [(-3.6, TURF + 0.4, 6.8), (-5.8, 0.1, 14.0)]
PATH = [(1.6, TURF, 7.2), (1.8, 1.9, 8.8), (1.6, 1.0, 10.4), (1.2, 0.62, 11.4)]
CRIB = [(-1.2, 11.3), (3.2, 11.3), (3.2, 13.4), (-1.2, 13.4)]
PIER = [(-1.0, 13.3), (1.0, 13.3), (1.0, 15.8), (-1.0, 15.8)]
# The windmill's knoll (islandScenery.ts: paltrok at [0, RIM, -11.4] ×2.8, about x -4..5.5, z -14.7..-7).
KNOLL = (0.7, -11.2, 5.2, 2.45)

HEADLAND_PREFIXES = ("head-",)
SHORE_SKIP = ("skerry", "boom")
OPEN_PARTS = ("base-", "head-", "skerry", "slide", "path", "crib-top", "pier-deck", "sea")
AO_WEIGHTS = {"base-ground": 0.3, "head-ground": 0.3, "skerry": 0.3}
CLOSE_UPS = {"slide-close": (-20, 16, (-2.0, 1.4, 10.4), 15), "domes-close": (-70, 18, (-10.0, 2.0, 2.0), 16), "skerry-close": (70, 14, (12.0, 1.0, 2.0), 16)}


def coast_r(a):
    """One lumpy mass, not petals: a lopsided base swollen toward the great dome at the back left, with a soft swell
    toward each smaller dome."""
    r = 12.8 + 1.9 * math.cos(a - math.radians(200)) + 0.5 * math.sin(a * 3 + 1.0) + 0.25 * math.sin(a * 7)
    for x, z, rad, _ in DOMES:
        d = math.atan2(math.sin(a - math.atan2(z, x)), math.cos(a - math.atan2(z, x)))
        r += 0.35 * rad * math.exp(-(d / 0.45) ** 2)
    return r


OUTLINE = [(math.cos(a) * coast_r(a), math.sin(a) * coast_r(a)) for a in [i * 2 * math.pi / 88 for i in range(88)]]


def dome_height(x, z):
    """The highest of the domes over (x, z): each a rounded crown, its flanks rolling down past the yard's level."""
    best = -9.0
    for dx, dz, r, top in DOMES:
        d = math.hypot(x - dx, z - dz) / (r + 2.0)
        if d < 1:
            best = max(best, -0.55 + (top + 0.55) * (1 - d * d) ** 0.8)
    return best


def height(x, z, t):
    r = math.hypot(x, z)
    R = coast_r(math.atan2(z, x))
    if r <= YARD_R:
        shoulder = TURF
    else:
        u = min(1.0, (r - YARD_R) / max(R - YARD_R, 0.5))
        shoulder = TURF - (TURF + 0.55) * u * u  # convex: gentle off the yard, rolling steeper into the sea
    return max(shoulder, dome_height(x, z))


def colour(x, z, y, slope):
    if y < 0.05:
        return "wetRock"
    if math.hypot(x, z) <= YARD_R and abs(y - TURF) < 0.02:
        return "forestFloor"
    # Moss on the dome crowns and in a band round the yard's rim; bare granite on the flanks below.
    return "moss" if y > TURF + 0.5 or (TURF - 0.35 < y <= TURF + 0.5 and slope < 0.5) else "pinkGranite"


def build_trees():
    """Spruces on the dome crowns, in clumps, never on the yard."""
    for k, (dx, dz, r, top) in enumerate(DOMES):
        for j in range(rng.randint(3, 6)):
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0, r * 0.55)
            x, z = dx + math.cos(a) * d, dz + math.sin(a) * d
            if math.hypot(x, z) < YARD_R + 0.6:
                continue
            y = height(x, z, 0)
            h = rng.uniform(1.4, 2.4)
            beam(f"tree-trunk-{k}-{j}", (x, y - 0.1, z), (x, y + 0.5, z), 0.14, "woodDark")["after"] = True
            prism(f"tree-{k}-{j}-a", (x, y + 0.35, z), h * 0.33, h * 0.6, "pine", sides=6, top=0.35)["after"] = True
            prism(f"tree-{k}-{j}-b", (x, y + 0.35 + h * 0.45, z), h * 0.24, h * 0.5, "pine", sides=6, top=0.0)["after"] = True


def build_skerries():
    for k, (x, z, r, top) in enumerate(SKERRIES):
        plan = [(x + math.cos(a) * r * (1 + 0.15 * math.sin(a * 3 + k)), z + math.sin(a) * r * 0.8) for a in [i * 2 * math.pi / 14 for i in range(14)]]
        radial_terrain(f"skerry-{k}", plan, lambda px, pz, t, top=top: -0.55 + (top + 0.55) * (1 - t * t) ** 0.7,
                       lambda px, pz, y, s: "wetRock" if y < 0.05 else ("moss" if s < 0.3 else "pinkGranite"), center=(x, z), rings=4, around=14)


def build_slide():
    """The log slide: a timber trough on trestles from the yard's edge down into the water, logs on it and below."""
    (ax, ay, az), (bx, by, bz) = SLIDE
    n = 10
    ln = math.hypot(bx - ax, bz - az)
    nx, nz = -(bz - az) / ln, (bx - ax) / ln
    for side in (-1, 1):
        beam(f"slide-plank-{side}", (ax + nx * 0.45 * side, ay, az + nz * 0.45 * side), (bx + nx * 0.45 * side, by, bz + nz * 0.45 * side), 0.42, "log", sides=4)["after"] = True
        beam(f"slide-rail-{side}", (ax + nx * 0.7 * side, ay + 0.35, az + nz * 0.7 * side), (bx + nx * 0.7 * side, by + 0.35, bz + nz * 0.7 * side), 0.18, "woodDark", sides=4)["after"] = True
    for k in range(1, n):
        t = k / n
        x, y, z = ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t
        ground = height(x, z, 0) if inside(OUTLINE, x, z) else FOOT
        for side in (-1, 1):
            beam(f"slide-leg-{k}-{side}", (x + nx * 0.5 * side, ground - 0.2, z + nz * 0.5 * side), (x + nx * 0.5 * side, y, z + nz * 0.5 * side), 0.12, "woodDark")["after"] = True
    for k, t in enumerate((0.25, 0.6)):
        x, y, z = ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t
        beam(f"slide-log-{k}", (x - (bx - ax) / ln * 0.9, y + 0.25, z - (bz - az) / ln * 0.9), (x + (bx - ax) / ln * 0.9, y + 0.25, z + (bz - az) / ln * 0.9), 0.5, "log", sides=8)["after"] = True
    # A boom of floating logs off the slide's foot.
    for k in range(6):
        x, z = bx - 2.4 + k * 0.1, bz + 0.6 + k * 0.42
        beam(f"boom-{k}", (x - 1.0, SEA + 0.05, z), (x + 1.0, SEA + 0.05, z + 0.2), 0.34, "log", sides=8)["after"] = True


def build_path():
    ribbon("path", [(x, height(x, z, 0) + 0.04, z) for x, _, z in PATH], 1.0, "chalkPath" if "chalkPath" in kit.SWATCHES else "path", lift=0.0)


def build_crib():
    """A log crib wharf: a timber box of crossed logs filled with stones, a plank top; the pier runs on from its front."""
    slab("crib-fill", CRIB, FOOT, 0.42, "slate")
    xs, zs = [p[0] for p in CRIB], [p[1] for p in CRIB]
    for k, y in enumerate((-0.2, 0.15, 0.45)):
        for z in (min(zs), max(zs)):
            beam(f"crib-log-x-{k}-{z}", (min(xs) - 0.2, y + (0.12 if k % 2 else 0), z), (max(xs) + 0.2, y + (0.12 if k % 2 else 0), z), 0.3, "log", sides=8)["after"] = True
        for x in (min(xs), max(xs)):
            beam(f"crib-log-z-{k}-{x}", (x, y + (0 if k % 2 else 0.12), min(zs) - 0.2), (x, y + (0 if k % 2 else 0.12), max(zs) + 0.2), 0.3, "log", sides=8)["after"] = True
    slab("crib-top", grow(CRIB, -0.1), 0.48, 0.6, "wood")
    slab("pier-deck", PIER, 0.48, 0.62, "wood")
    for s in (-1, 1):
        box(f"pier-rail-{s}", (s * 1.02, 0.6, 14.55), (0.16, 0.18, 2.5), "woodDark", bevel=0.03)["after"] = True
        for z in (14.2, 15.6):
            beam(f"pier-pile-{s}-{z}", (s * 0.95, FOOT, z), (s * 0.95, 0.62, z), 0.22, "woodDark")["after"] = True


def build_headland():
    """The windmill's knoll: a rounded granite hump with a flat top at the windmill's foot."""
    kx, kz, kr, top = KNOLL
    plan = [(kx + math.cos(a) * kr * (1 + 0.08 * math.sin(a * 3)), kz + math.sin(a) * kr * 0.8) for a in [i * 2 * math.pi / 28 for i in range(28)]]

    def h(x, z, t):
        return top if t < 0.62 else top - (top + 0.55) * ((t - 0.62) / 0.38) ** 1.6

    radial_terrain("head", plan, h, lambda x, z, y, s: "wetRock" if y < 0.05 else ("moss" if s < 0.32 else "pinkGranite"), center=(kx, kz), rings=10, around=28)


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    radial_terrain("base", OUTLINE, height, colour, rings=26, around=None)
    slab("base-core", [(x * 0.9, z * 0.9) for x, z in OUTLINE], FOOT, -0.6, "wetRock")
    build_trees()
    build_skerries()
    build_slide()
    build_path()
    build_crib()
    build_headland()
