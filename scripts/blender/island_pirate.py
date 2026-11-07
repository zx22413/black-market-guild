"""The pirate cove's base (海盜灣), shared by its blockout (blockout-island.py) and its build (build-island.py), both
run with `-- pirate-cove`. docs/art/island-base-research.md §11–12 has the design.

After the Caribbean cays the buccaneers careened on: a low sand island with no cliff at all.
- outline: one irregular sand oval laid on the slant, its edge wandering like a beach, with a lopsided gap bitten
  out of the front for the harbour (a short blunt point on the left, a long arm on the right running past the dock);
- terrain: the yard sits on the crown; off it a low dune bank runs out into a long, nearly flat beach (it reads low
  and wide, not a mound); the arms keep a low sand crest of their own; beach grass on the bank and the arms, wet dark
  sand at the waterline (the trim);
- access: no stairs: a plank boardwalk on posts runs down the slope from the yard to the bay;
- shore: pink coral ledges breaking the sand here and there, coral heads off the beach;
- dock: a floating jetty of planks on barrels;
- beach: broad and flat round the back and the sides, narrowing to the front, so the careened ship (which turns to the
  back, left or right) always lies on sand;
- backdrop base: the careenage on that beach: log ways under the hull, anchor posts and a capstan, built apart so it
  turns with the ship.
"""

import math
import random

from island_kit import *  # noqa: F401,F403
import blockout_kit as kit

kit.SWATCHES.update(
    {
        "duneSand": ("#efd29a", "#dcb87c"),
        "slopeSand": ("#e6c487", "#d2aa6e"),
        "wetSand": ("#b99868", "#a2825a"),
        "beachGrass": ("#9fbf5a", "#7c9e42"),
        "coral": ("#e88f86", "#c96e6a"),
        "lagoon": ("#4fd1c0", "#36b5a6"),
        "barrelWood": ("#b8794a", "#8f5a36"),
    }
)
rng = random.Random(31)

# One landmass: an irregular sand oval laid on the slant (its long axis from the back left to the front right), its
# edge wandering as a beach does, with one gap bitten out of the front for the harbour. The gap is lopsided: the left
# side is a short blunt point, the right a long arm running on past the dock and curling in a little at its tip.
OVAL = (14.2, 11.4, math.radians(-32))  # semi-axes (long, short) and the long axis' angle from +x


def oval_r(a):
    ra, rb, tilt = OVAL
    c, s_ = math.cos(a - tilt), math.sin(a - tilt)
    r = 1 / math.sqrt((c / ra) ** 2 + (s_ / rb) ** 2)
    r *= 1 + 0.045 * math.sin(a * 3 + 0.6) + 0.03 * math.sin(a * 7 + 2.1) + 0.02 * math.sin(a * 13)
    # The beach runs well out round the back and the sides, where the careened ship may lie (the backdrop turns to the
    # back, left or right), so the hull rests on sand rather than hanging over the sea; it narrows to the front.
    sn = math.sin(a)
    ext = 2.6 + 2.8 * (-sn) if sn < 0 else 2.6 * (1 - sn) ** 1.5
    return r + ext


def coast_outline():
    """The oval sampled round from the gap's right side to its left, then the harbour's shore back across."""
    a_right, a_left = math.radians(46), math.radians(112)  # where the oval's edge meets the gap, and the arm
    pts = []
    for i in range(72):
        a = a_left + (2 * math.pi - (a_left - a_right)) * i / 71
        pts.append((math.cos(a) * oval_r(a), math.sin(a) * oval_r(a)))
    # pts now runs from the gap's left edge round the back to the right arm's tip region; close through the harbour.
    pts.reverse()  # start at the right arm, run round the back to the left point
    right_tip = pts[0]
    harbour = [
        # down the left point's inner side to the harbour's head behind the dock, out along the right arm's inner side
        (-3.4, 12.6), (-2.6, 11.0), (-1.2, 10.3), (1.4, 10.2), (3.4, 10.7), (4.8, 11.8), (5.4, 13.4), (5.0, 15.0),
        (4.0, 16.0),  # the arm's tip, curling in
        (5.4, 16.6), (7.4, 15.8), (8.8, 14.0), (9.8, 12.4),  # its outer side, back to the oval
    ]
    return [right_tip] + pts[1:] + harbour


OUTLINE = coast_outline()
HARBOUR_SHORE = 10.4  # the harbour's shore in front of the dock


def yard_q(x, z):
    """< 1 inside the flat yard: a superellipse round the lots, the warehouse and the scenery."""
    return (abs(x) / 8.3) ** 4 + (abs(z) / (6.9 if z > 0 else 7.6)) ** 4


def height(x, z, d):
    """The sand by its distance d from the coast: the yard flat on the crown, a low dune bank off it running out in a
    long, nearly flat beach; the arms, far from the yard, keep a low sand crest of their own."""
    q = yard_q(x, z)
    if q <= 1:
        return TURF
    e = (q ** 0.25 - 1) * 7.6  # about how far outside the yard
    u = e / (e + max(d, 1e-3))
    body = TURF - (TURF + 0.55) * (1 - (1 - u) ** 2.6) + 0.25 * dunes(x, z) * u * (1 - u) * 4
    bar = -0.55 + 1.75 * (1 - math.exp(-d / 0.75))
    # The broad beach: wherever the coast lies far out it levels off at BEACH_TOP, flat enough to haul a ship onto.
    beach = -0.55 + (BEACH_TOP + 0.55) * (1 - math.exp(-d / 1.3))
    return max(body, bar, beach)


def colour(x, z, y, slope):
    return "wetSand" if y < -0.3 else "slopeSand"  # y: the face's lowest corner (by_lowest)


BOARDWALK = [(0.0, TURF, 6.8), (0.0, 0.0, HARBOUR_SHORE)]
# The back beach for the careened ship (islandScenery.ts: careened-ship at y RIM - 1.85, on the beach), authored at
# the back like the backdrop; its plain sinks into the body's slope where they meet, so the two are one shore.
HEAD_AT = (1.0, -11.6)  # the log ways under the hull (the ship pulled 0.65 toward the island: careened-ship at z -13.1, as close as the salvage lot allows)
BEACH_TOP = 0.55

HEADLAND_PREFIXES = ("head-",)
SHORE_SKIP = ("coral",)
OPEN_PARTS = ("base-", "head-", "walk", "pontoon", "sea")
AO_WEIGHTS = {"base-ground": 0.25, "head-ground": 0.25}
BLOCKOUT_MOVES = {"careened-ship": (0.0, BEACH_TOP - 2.4, 0.65)}
CLOSE_UPS = {"harbour-close": (18, 16, (0.0, 1.2, 11.0), 16), "arm-close": (60, 18, (6.0, 0.6, 13.0), 14), "beach-close": (160, 18, (0.0, 0.8, -11.0), 18)}


def dunes(x, z):
    """Rolling dunes on the slope: a few long swells."""
    return 0.32 * math.sin(x * 0.55 + 1.1) * math.sin(z * 0.47 - 0.4) + 0.18 * math.sin(x * 1.3 + z * 0.9)


def grass_tuft(name, x, y, z):
    for j in range(3):
        a = j * 2.1
        ob = prism(f"{name}-{j}", (x + math.cos(a) * 0.25, y - 0.05, z + math.sin(a) * 0.25), 0.16, rng.uniform(0.4, 0.6), "beachGrass", sides=4, top=0.1)
        ob["after"] = True


def build_grass():
    """Beach grass on the dune bank and the arms' crests."""
    for k in range(90):
        x, z = rng.uniform(-13, 13), rng.uniform(-12, 16)
        if not inside(OUTLINE, x, z) or yard_q(x, z) <= 1.15 or abs(x) < 1.6:
            continue
        y = height(x, z, coast_distance(OUTLINE, x, z))
        if y > 0.35:
            grass_tuft(f"grass-{k}", x, y, z)


def build_coral():
    """Pink coral ledges breaking out of the sand here and there, and coral heads off the beach (none in the harbour)."""
    for k, (x, z, r) in enumerate(((-12.2, -1.4, 1.2), (11.8, -3.4, 1.1), (-9.6, -8.2, 0.9))):
        y = height(x, z, coast_distance(OUTLINE, x, z))
        ob = prism(f"coral-ledge-{k}", (x, FOOT, z), r, y + 0.35 - FOOT, "coral", sides=6, top=0.75)
        ob["after"] = True
    for k in range(18):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(14.0, 16.0)
        x, z = math.cos(a) * r, math.sin(a) * r
        if z > 8.0 and abs(x) < 9.0:
            continue  # keep the harbour and its mouth clear
        ob = prism(f"coral-head-{k}", (x, FOOT, z), rng.uniform(0.3, 0.55), rng.uniform(2.5, 3.0), "coral", sides=5, top=0.55)
        ob["after"] = True


def build_boardwalk():
    """A plank boardwalk on posts down the slope to the harbour, then a jetty floating on barrels."""
    pts = []
    for k in range(11):
        z = 6.8 + (HARBOUR_SHORE + 0.2 - 6.8) * k / 10
        pts.append((0.0, max(height(0.0, z, coast_distance(OUTLINE, 0.0, z) if inside(OUTLINE, 0.0, z) else 0.0), -0.1) + 0.3, z))
    ribbon("walk-deck", pts, 1.3, "wood", lift=0.0)
    for side in (-1, 1):
        for k in range(0, len(pts), 2):
            x, y, z = pts[k]
            beam(f"walk-post-{side}-{k}", (side * 0.6, y - 1.2, z), (side * 0.6, y + 0.05, z), 0.14, "woodDark")["after"] = True
        beam(f"walk-edge-{side}", (side * 0.66, pts[0][1] + 0.05, pts[0][2]), (side * 0.66, pts[-1][1] + 0.05, pts[-1][2]), 0.1, "woodDark", sides=4)["after"] = True
    slab("pontoon-deck", [(-1.1, HARBOUR_SHORE + 0.1), (1.1, HARBOUR_SHORE + 0.1), (1.1, 15.8), (-1.1, 15.8)], 0.2, 0.34, "wood")
    for z in (11.2, 12.4, 13.6, 14.8, 15.6):
        beam(f"pontoon-barrel-{z}", (-1.0, 0.02, z), (1.0, 0.02, z), 0.6, "barrelWood", sides=10)["after"] = True
    for side in (-1, 1):
        box(f"pontoon-rail-{side}", (side * 1.12, 0.36, (HARBOUR_SHORE + 15.8) / 2), (0.14, 0.14, 15.8 - HARBOUR_SHORE), "woodDark", bevel=0.02)["after"] = True


def build_headland():
    """The careenage on the broad back beach: log ways laid across the sand under the hull, anchor posts, a capstan.
    (The beach itself is the body's: it runs out round the back and sides, so it is there whichever way this turns.)"""
    hx, hz = HEAD_AT
    for k in range(5):
        z = hz - 2.6 + k * 1.3
        beam(f"head-way-{k}", (hx - 1.0, BEACH_TOP + 0.06, z), (hx + 5.0, BEACH_TOP - 0.06, z), 0.3, "woodDark", sides=8)["after"] = True
    for k, (x, z) in enumerate(((hx - 2.4, hz - 3.6), (hx - 2.8, hz + 2.6), (hx + 6.4, hz - 3.0))):
        beam(f"head-bollard-{k}", (x, BEACH_TOP - 0.3, z), (x, BEACH_TOP + 0.7, z), 0.3, "woodDark", sides=8)["after"] = True
    prism("head-capstan", (hx - 3.6, BEACH_TOP - 0.05, hz - 0.4), 0.45, 0.7, "woodDark", sides=8)["after"] = True
    for k in range(4):
        a = k * math.pi / 2
        beam(f"head-capstan-bar-{k}", (hx - 3.6, BEACH_TOP + 0.55, hz - 0.4), (hx - 3.6 + math.cos(a) * 1.1, BEACH_TOP + 0.55, hz - 0.4 + math.sin(a) * 1.1), 0.08, "wood")["after"] = True


def build_base():
    slab("sea", [(-40, -40), (40, -40), (40, 40), (-40, 40)], -3.2, SEA, "sea")
    cdt_terrain("base", OUTLINE, height, colour, spacing=0.9, seed=3, by_lowest=True)
    build_grass()
    build_coral()
    build_boardwalk()
    build_headland()
