"""The spice islands' base (香料群島), shared by its blockout (blockout-island.py) and its build (build-island.py), both
run with `-- spice-isles`. docs/art/island-base-research.md §11–12 has the design.

After the Banda nutmeg islands: a volcanic island of red earth worked into terraces.
- outline: a fan; the terraces spread out to the front right like the seats of a theatre, the left and back a red
  cliff one terrace ledge out from the yard;
- terrain: the yard is beaten flat red earth; outside it the ground steps down to the front right in terraces, each
  with a dark earth bank and a row of green crops along its edge (the trim), to a black volcanic sand beach;
- access: no stairs: a road zigzags up across the terraces from the beach, cutting through their banks;
- shore: black sand and dark lava boulders; the cliff wears a green fringe of creepers at its top (the trim);
- dock: a stilted timber pier from the beach;
- backdrop base: a whitewashed walled garden podium for the spice house, built apart so it turns with the backdrop.
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "laterite": ("#c46c4c", "#a3533b"),
        "yardEarth": ("#b8664a", "#a65a40"),
        "earthBank": ("#7a3b2a", "#5e2c20"),
        "crop": ("#68b44c", "#43893a"),
        "creeper": ("#4f9a45", "#3a7a36"),
        "volcanicSand": ("#45434a", "#2f2e33"),
        "road": ("#ecd2a8", "#d9b98a"),
        "lava": ("#3d3437", "#2a2326"),
        "rubble": ("#b49a80", "#8a735f"),
    }
)
rng = random.Random(23)

STEP = 1.35  # terrace width
DROP = 0.62  # terrace height
FAN = (math.radians(-75), math.radians(128))  # the terraced sector (atan2(z, x)); the rest is cliff
BLEND = math.radians(38)  # wide, so the terraces fade into the cliff top instead of ending in a cut


def yard_r(a):
    """The flat yard's edge: a circle round the lots, the warehouse and the scenery (their farthest corner is about 8.0
    out). Round, so the terrace banks run along the terrain grid's rings and draw as clean bands."""
    return 8.4


def fan_weight(a):
    """1 inside the terraced sector, 0 in the cliff sector, easing between over BLEND."""
    def inside_angle(x):
        return (x - FAN[0]) % (2 * math.pi) <= (FAN[1] - FAN[0])
    if inside_angle(a):
        d = min((a - FAN[0]) % (2 * math.pi), (FAN[1] - a) % (2 * math.pi))
        return min(1.0, d / BLEND)
    return 0.0


LEVELS = 5  # four terraces and the beach below them
STAGGER = math.radians(9)  # each lower terrace ends this much short of the one above, at both ends of the fan


def terraces_at(a):
    """How many terraces reach angle a: all of them in the middle of the fan, fewer toward its ends, none beyond."""
    n = 0
    for k in range(1, LEVELS + 1):
        lo, hi = FAN[0] + (k - 1) * STAGGER, FAN[1] - (k - 1) * STAGGER
        if (a - lo) % (2 * math.pi) <= (hi - lo):
            n = k
    return n


def coast_r_n(n):
    # Cut each terrace before its bank, so it ends in a cliff face; the beach runs out to the sea.
    return 14.4 if n >= LEVELS else yard_r(0) + STEP * (n + 0.55)


def coast_r(a):
    return coast_r_n(terraces_at(a))


def coast_outline(step=math.radians(3.0)):
    """The coast: round the cliff side one ledge out, stepping out terrace by terrace into the fan along radial lines
    (two points at each step's angle), so the terraces' ends line up with the terrain grid's rays."""
    pts, a, last = [], 0.0, None
    while a < 2 * math.pi - 1e-6:
        n = terraces_at(a)
        if last is not None and n != last:
            pts.append((math.cos(a) * coast_r_n(last), math.sin(a) * coast_r_n(last)))
        pts.append((math.cos(a) * coast_r_n(n), math.sin(a) * coast_r_n(n)))
        last, a = n, a + step
    return pts


OUTLINE = coast_outline()

# One long hairpin: along the beach, up across the terraces to the right, and back into the yard: (x, z, height).
ROAD_KEYS = [(0.0, 12.0, 0.45), (5.0, 11.9, 0.6), (8.6, 10.9, 1.15), (11.0, 7.6, 1.75), (9.6, 6.0, 2.25), (6.6, 6.4, TURF), (5.4, 6.4, TURF)]
ROAD_W = 1.4


def road_pts(step=0.45):
    """The road's centre line, a point every `step`, each at its height."""
    out = []
    for (x0, z0, y0), (x1, z1, y1) in zip(ROAD_KEYS, ROAD_KEYS[1:]):
        n = max(1, int(math.hypot(x1 - x0, z1 - z0) / step))
        for k in range(n):
            t = k / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t))
    x, z, y = ROAD_KEYS[-1]
    out.append((x, y, z))
    return out


ROAD = road_pts()
# The pier runs out from the road's start, its landward end at the road's edge (a T on the beach), never over it.
PIER = [(-1.0, 12.75), (1.0, 12.75), (1.0, 15.8), (-1.0, 15.8)]
# The walled garden podium for the spice house (islandScenery.ts: windtower-house at [0, RIM, -9.05] ×2.3).
HEAD = [(-3.8, -7.0), (3.8, -7.0), (4.2, -7.6), (4.2, -10.8), (3.6, -11.4), (-3.6, -11.4), (-4.2, -10.8), (-4.2, -7.6)]

HEADLAND_PREFIXES = ("head-",)
SHORE_SKIP = ("lava",)
OPEN_PARTS = ("base-", "head-", "road", "pier-deck", "sea", "cliff", "creeper", "beach")
AO_WEIGHTS = {"base-ground": 0.25, "head-top": 0.2, "road": 0.2}
BLOCKOUT_MOVES = {"windtower-house": (0.0, TURF - 2.4, 0.0)}  # onto the podium's top
CLOSE_UPS = {"terraces-close": (40, 20, (7.0, 1.4, 8.0), 15), "cliff-close": (-80, 16, (-10.0, 1.4, 0.0), 14)}


def terrace_level(x, z):
    """How many terraces down from the yard (0 in the yard), and the ground's height there."""
    a = math.atan2(z, x)
    r = math.hypot(x, z)
    d = r - yard_r(a)
    if d <= 0:
        return 0, TURF
    level = int(d / STEP) + 1
    frac = d / STEP - (level - 1)
    # Each terrace flat, its bank a short steep slope at its outer edge (smooth, so the grid draws a clean band).
    ease = max(0.0, min(1.0, (frac - 0.6) / 0.4))  # a bank wider than a grid cell, so it draws as a slope, not teeth
    ease = ease * ease * (3 - 2 * ease)
    y = TURF - DROP * level - DROP * ease
    if y < 0.5:  # below the last terrace: the beach shelving into the sea
        beach_d = (TURF - 0.5) / DROP * STEP
        y = max(-0.6, 0.42 - max(0.0, d - beach_d) * 0.42)
        level = 99
    # The terraces run all round the yard; outside the fan the coast comes in close, so the cliff cuts them after a
    # ledge or two. (Blending their heights toward the cliff drew saw teeth on the terrain grid.)
    return level, y


def height(x, z, t):
    level, y = terrace_level(x, z)
    dist, road_y = polyline_distance(ROAD, x, z)
    # The road is built on its own (`build_road`); the ground under it sinks a little below it, and its banks ease back
    # to the terraces over a metre, so they show as earth slopes rather than ragged cuts.
    bed = road_y - 0.3
    if dist < ROAD_W / 2 + 0.2:
        return min(y, bed) if y > bed else y
    if dist < ROAD_W / 2 + 1.2:
        k = (dist - ROAD_W / 2 - 0.2) / 1.0
        k = k * k * (3 - 2 * k)
        return y if y < bed else bed + (y - bed) * k
    return y


def colour(x, z, y, slope):
    if y < 0.5:
        return "volcanicSand"
    if polyline_distance(ROAD, x, z)[0] < ROAD_W / 2 + 1.3:
        return "laterite"  # the road's banks: plain earth, not the dark terrace banks
    if slope > 0.55:
        return "earthBank"
    level, _ = terrace_level(x, z)
    return "yardEarth" if level == 0 else "laterite"


def build_road():
    """The road: a packed-earth surface on a stone causeway, its walls dropping to the ground below, kerbs on top."""
    ribbon("road", ROAD, ROAD_W, "road", lift=0.0)
    for side in (-1, 1):
        top, bottom = [], []
        for k, (x, y, z) in enumerate(ROAD):
            a = ROAD[max(k - 1, 0)]
            b = ROAD[min(k + 1, len(ROAD) - 1)]
            dx, dz = b[0] - a[0], b[2] - a[2]
            ln = math.hypot(dx, dz) or 1
            ex, ez = x - dz / ln * ROAD_W / 2 * side, z + dx / ln * ROAD_W / 2 * side
            top.append((ex, y, ez))
            bottom.append((ex - dz / ln * 0.12 * side, y - 1.1, ez + dx / ln * 0.12 * side))
        surface(f"road-wall-{side}", [bottom, top], "rubble", face_up=False, closed=False)
        for k in range(0, len(top) - 1, 2):
            j = min(k + 2, len(top) - 1)
            beam(f"road-kerb-{side}-{k}", (top[k][0], top[k][1] + 0.08, top[k][2]), (top[j][0], top[j][1] + 0.08, top[j][2]), 0.2, "marble", sides=4)["after"] = True


def build_gardens():
    """Spice beds in the yard between the lots: raised earth beds of different sizes and turns, rows planted unevenly."""
    for k, (x, z, w, d, yaw, rows) in enumerate(((-8.3, -5.0, 1.9, 2.8, 0.25, 3), (7.7, -5.6, 2.4, 1.8, -0.4, 2), (-7.8, 4.9, 1.2, 1.9, 0.1, 2), (0.6, -8.7, 2.6, 0.9, 0.05, 1))):
        box(f"bed-{k}", (x, TURF + 0.08, z), (w, 0.16, d), "earthBank", bevel=0.04, yaw=yaw)["after"] = True
        c, s_ = math.cos(yaw), math.sin(yaw)
        for r in range(rows):
            lz = -d / 2 + d * (r + 0.5) / rows
            n = int(w / 0.42)
            for j in range(n):
                if rng.random() < 0.2:
                    continue
                lx = -w / 2 + 0.25 + (w - 0.5) * j / max(n - 1, 1) + rng.uniform(-0.08, 0.08)
                px, pz = x + lx * c + lz * s_, z - lx * s_ + lz * c
                prism(f"bed-{k}-{r}-{j}", (px, TURF + 0.15, pz), rng.uniform(0.12, 0.2), rng.uniform(0.18, 0.4), "crop", sides=5, top=0.5)["after"] = True


def build_crops():
    """Crops along each terrace's outer edge, planted by hand rather than by rule: runs of bushes of uneven size and
    spacing, gaps, a taller clove or nutmeg sapling here and there, rows a little in and out of line."""
    for level in range(1, 4):
        a = FAN[0] + rng.uniform(0, 0.05)
        while a < FAN[1]:
            r = yard_r(a) + STEP * level - 0.3 + rng.uniform(-0.18, 0.12)
            x, z = math.cos(a) * r, math.sin(a) * r
            gap = rng.random() < 0.16
            if not gap and polyline_distance(ROAD, x, z)[0] > ROAD_W / 2 + 0.5 and terraces_at(a) > level:
                y = terrace_level(x, z)[1]
                kind = rng.random()
                if kind < 0.12:  # a sapling: trunk and a round dark crown
                    beam(f"crop-trunk-{level}-{round(a, 3)}", (x, y, z), (x, y + 0.5, z), 0.08, "woodDark")["after"] = True
                    prism(f"crop-crown-{level}-{round(a, 3)}", (x, y + 0.45, z), rng.uniform(0.32, 0.42), rng.uniform(0.5, 0.7), "creeper", sides=6, top=0.4)["after"] = True
                else:
                    prism(f"crop-{level}-{round(a, 3)}", (x, y - 0.05, z), rng.uniform(0.16, 0.34), rng.uniform(0.25, 0.6), "crop", sides=5, top=rng.uniform(0.4, 0.7))["after"] = True
            a += (rng.uniform(0.35, 0.95) + (1.2 if gap else 0.0)) / r


def build_cliff(edge):
    """The red cliff from the ground's edge down to the sea floor, battered back, a fringe of creepers at its top."""
    foot = [(x * 1.02, FOOT, z * 1.02) for x, _, z in edge]  # a slight batter: the foot stays inside the dhow's sea loop
    surface("cliff", [foot, list(edge)], "laterite", face_up=False)
    slab("base-core", [(x * 0.96, z * 0.96) for x, _, z in edge], FOOT, -0.4, "laterite", 0.85)
    # Creepers only where the cliff stands tall (not along the beach), in runs between the low points.
    run = []
    for k, (x, y, z) in enumerate(list(edge) + [edge[0]]):
        if y > 1.2:
            run.append((x, y, z))
            continue
        if len(run) > 1:
            surface(f"creeper-{k}", [[(px * 1.012, py - 0.55, pz * 1.012) for px, py, pz in run], [(px * 1.006, py + 0.05, pz * 1.006) for px, py, pz in run]], "creeper", face_up=False, closed=False)
        run = []
    if len(run) > 1:
        surface("creeper-end", [[(px * 1.012, py - 0.55, pz * 1.012) for px, py, pz in run], [(px * 1.006, py + 0.05, pz * 1.006) for px, py, pz in run]], "creeper", face_up=False, closed=False)


def build_shore():
    """Black sand round the terraced side, lava boulders at the cliff foot and on the beach."""
    for k in range(16):
        a = rng.uniform(math.radians(110), math.radians(320))
        r = coast_r(a) + rng.uniform(0.4, 1.6)
        ob = prism(f"lava-{k}", (math.cos(a) * r, FOOT, math.sin(a) * r), rng.uniform(0.4, 0.8), rng.uniform(2.6, 3.4), "lava", sides=6, top=0.5)
        ob["after"] = True
    for k, (x, z, r) in enumerate(((11.6, 3.0, 0.55), (12.8, 6.4, 0.4), (3.6, 13.4, 0.45), (-2.2, 13.2, 0.35))):
        ob = prism(f"lava-beach-{k}", (x, -0.4, z), r, r * 1.1, "lava", sides=6, top=0.55)
        ob["after"] = True


def build_pier():
    slab("pier-deck", PIER, 0.48, 0.62, "wood")
    for s in (-1, 1):
        box(f"pier-rail-{s}", (s * 1.02, 0.6, 14.3), (0.16, 0.18, 3.0), "woodDark", bevel=0.03)["after"] = True
        for z in (12.9, 13.9, 14.9, 15.7):
            beam(f"pier-stilt-{s}-{z}", (s * 0.95, FOOT, z), (s * 0.95, 0.62, z), 0.18, "woodDark")["after"] = True
    for z in (13.4, 14.4, 15.3):
        beam(f"pier-brace-{z}", (-0.95, -0.4, z), (0.95, 0.4, z + 0.5), 0.1, "woodDark")["after"] = True


def build_headland():
    """A whitewashed walled garden podium, a stone coping on its wall, red earth inside."""
    slab("head-wall", HEAD, FOOT, TURF + 0.35, "plaster")
    plan_ring("head-coping", grow(HEAD, 0.12), grow(HEAD, -0.3), TURF + 0.3, TURF + 0.45, "stone")["after"] = True
    slab("head-top", grow(HEAD, -0.3), TURF, TURF + 0.01, "yardEarth")
    plan_ring("head-plinth", grow(HEAD, 0.25), grow(HEAD, -0.1), FOOT, 0.2, "stone")["after"] = True


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    edge = radial_terrain("base", OUTLINE, height, colour, rings=24, around=None)
    build_cliff(edge)
    build_crops()
    build_road()
    build_gardens()
    build_shore()
    build_pier()
    build_headland()
