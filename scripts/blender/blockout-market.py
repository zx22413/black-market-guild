"""Blockouts of the market island's (巴扎港) new ground, three directions (docs/art/island-base-research.md §25): the
current island and the new one rendered from the same cameras, for four players (and a top view for three).

  npx tsx scripts/blender/dump-market.ts > <scratch>/market.json
  Blender -b --factory-startup --python scripts/blender/blockout-market.py -- <A|B|C> <render dir> <scratch>/market.json

A: a paved city disc, a continuous low quay round it ("riva"), ships moored bow-on to it, water stairs up to the square.
B: inner docks (Damrak): the city reaches out in warehouse wings either side of each berth, the ship lies in a slot.
C: a walled harbour town: a city wall with a warehouse arcade inside, towers, a harbour gate and a quay terrace at each
   berth, rock between.
Everything is table space (three.js: y up, +z toward the camera), the square at the market's ground (3.65).
Writes before-<view>.png and after-<view>.png for views top4, top3, dock, close.
"""

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402
from island_kit import grow, inside, slab, walk, SEA, FOOT  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :]
DIRECTION = args[0]
STAIRS = len(args) > 3 and args[3] == "stairs"  # compare the bazaar's flights: the town in both columns
DUMP = json.load(open(args[2]))
sys.argv = sys.argv[: sys.argv.index("--") + 1] + args[1:]
G = DUMP["ground"]  # the square's paving, where the bazaar stands
LOW = 1.0  # the low quay by the water
COPE = 0.18
rng = random.Random(7)
CUTTERS = []  # wells cut out of the square's blocks (water stairs), applied after a direction is built

kit.SWATCHES.update(
    {
        "sea": ("#5fb3ad", "#4a9e99"),
        "limestone": ("#d8b479", "#b8945c"),
        "istrian": ("#f7f3ea", "#e2dccd"),
        "tide": ("#4f4a48", "#3b3736"),
        "plaza": ("#e8d8b8", "#d6c4a0"),
        "street": ("#b79a72", "#a2865f"),
        "streetEdge": ("#8c7154", "#77604a"),
        "quayPave": ("#c4ae88", "#ad9772"),
        "rockGold": ("#b59a72", "#977d58"),
        "wetRock": ("#5c5650", "#47423d"),
        "ochre": ("#e3a85a", "#c98e44"),
        "rose": ("#e39a8c", "#c98073"),
        "sky": ("#9cc3d6", "#80a8bd"),
    }
)


def after(ob):
    ob["after"] = True
    return ob


def ring_plan(radii, phase=0.0):
    n = len(radii)
    return [(math.cos(phase + 2 * math.pi * k / n) * r, math.sin(phase + 2 * math.pi * k / n) * r) for k, r in enumerate(radii)]


def walled(prefix, plan, top, wall="limestone", pave="plaza"):
    """A block of the city: a stone body from the sea floor, a dark tide line, a white coping overhanging the face, the
    paving inside it."""
    slab(f"{prefix}-body", plan, FOOT, top - COPE + 0.01, wall)
    slab(f"{prefix}-tide", grow(plan, 0.05), FOOT, SEA + 0.4, "tide")
    after(plan_ring(f"{prefix}-cope", grow(plan, 0.14), grow(plan, -0.4), top - COPE, top + 0.03, "istrian"))
    slab(f"{prefix}-pave", grow(plan, -0.38), top - COPE - 0.02, top, pave)


def flat(name, plan, y, mat):
    slab(name, plan, y - 0.02, y, mat)


def strip(name, a, b, width, y, mat):
    """A flat band from a to b (plan points), `width` wide."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dz) or 1
    nx, nz = -dz / ln * width / 2, dx / ln * width / 2
    flat(name, [(a[0] + nx, a[1] + nz), (b[0] + nx, b[1] + nz), (b[0] - nx, b[1] - nz), (a[0] - nx, a[1] - nz)], y, mat)


def polar(a, r):
    return (math.cos(a) * r, math.sin(a) * r)


def bollard(name, x, y, z):
    after(prism(name, (x, y, z), 0.17, 0.36, "dark", sides=8))
    after(prism(f"{name}-cap", (x, y + 0.36, z), 0.22, 0.08, "dark", sides=8))


def market_ring():
    """The paving band round the bazaar's foot, in the street's tone."""
    outer = ring_plan([8.9] * 24)
    inner = ring_plan([7.7] * 24)
    after(plan_ring("pave-ring", outer, inner, G - 0.01, G + 0.015, "street"))


def street(name, a, r0, r1, width=2.2):
    strip(f"{name}", polar(a, r0), polar(a, r1), width, G + 0.015, "street")
    for s in (-1, 1):
        off = (math.cos(a + math.pi / 2) * s * width / 2, math.sin(a + math.pi / 2) * s * width / 2)
        p0, p1 = polar(a, r0), polar(a, r1)
        strip(f"{name}-edge{s}", (p0[0] + off[0], p0[1] + off[1]), (p1[0] + off[0], p1[1] + off[1]), 0.2, G + 0.025, "streetEdge")


def water_stair(name, a, r_wall, top, bottom, width=1.8):
    """Broad water stairs cut into the square's wall at bearing a, from the square down to the quay: the stairwell is
    open to the sky, its side walls coped; steps descend outward to the wall's face."""
    steps = 8
    rise = (top - bottom) / steps
    run = 0.36
    r_head = r_wall - steps * run
    ux, uz = math.cos(a), math.sin(a)
    vx, vz = -uz, ux
    yaw = math.atan2(ux, uz)
    # The well, cut out of the square's block, then the steps in it.
    rm = (r_head + r_wall) / 2 + 0.3
    c = box(f"cut-{name}", (ux * rm, (bottom + top) / 2 + 0.3, uz * rm), (width, top - bottom + 0.6, r_wall - r_head + 0.62), "dark", bevel=0.0, yaw=yaw)
    kit.PARTS[:] = [q for q in kit.PARTS if q[0] is not c]
    CUTTERS.append(c)
    for k in range(steps):
        r = r_head + (k + 0.5) * run
        y = top - rise * (k + 1)
        after(box(f"{name}-step{k}", (ux * r, (y + bottom) / 2 - 0.05, uz * r), (width, y - bottom + 0.1, run + 0.02), "quayPave", bevel=0.0, yaw=yaw))
    for s in (-1, 1):
        cx, cz = ux * (r_head + r_wall) / 2 + vx * s * (width / 2 + 0.18), uz * (r_head + r_wall) / 2 + vz * s * (width / 2 + 0.18)
        after(box(f"{name}-cheek{s}", (cx, top + 0.12, cz), (0.36, 0.3, r_wall - r_head + 0.1), "istrian", bevel=0.02, yaw=yaw))
    return r_head


def ship(name, berth):
    (x, _, z), (ix, _, iz) = berth["at"], berth["inward"]
    yaw = math.atan2(ix, iz)
    for tag in ("before", "after"):
        h = box(f"{tag}-{name}-hull", (x, 0.3, z), (1.9, 1.5, 5.8), "wood", bevel=0.2, yaw=yaw)
        d = box(f"{tag}-{name}-deck", (x, 1.08, z), (1.6, 0.1, 5.2), "deck", bevel=0.0, yaw=yaw)
        m = beam(f"{tag}-{name}-mast", (x, 1.1, z), (x, 5.4, z), 0.16, "woodDark")
        s = box(f"{tag}-{name}-sail", (x - ix * 0.1, 3.6, z - iz * 0.1), (2.4, 2.2, 0.08), "canvas", bevel=0.0, yaw=yaw)
        for ob in (h, d, m, s):
            ob[tag] = True


def pile(name, a, r, y):
    """A stand-in for the smugglers' pile at its new place: three big crates and a long one."""
    ux, uz = math.cos(a), math.sin(a)
    vx, vz = -uz, ux
    yaw = math.atan2(ux, uz)
    for k, (dv, dy, du, size, mat) in enumerate(((-0.46, 0.4, 0, 0.8, "wood"), (0.44, 0.4, -0.1, 0.8, "woodDark"), (-0.05, 1.2, 0, 0.8, "wood"))):
        after(box(f"{name}-{k}", (ux * (r + du) + vx * dv, y + dy, uz * (r + du) + vz * dv), (size, size, size), mat, bevel=0.05, yaw=yaw))
    after(box(f"{name}-long", (ux * r + vx * 1.3, y + 0.25, uz * r + vz * 1.3), (1.0, 0.5, 0.5), "woodDark", bevel=0.04, yaw=yaw))


def shed(name, a, r, y, side=1.0):
    """A small open cargo shed on the quay beside a berth, crates under it."""
    ux, uz = math.cos(a), math.sin(a)
    vx, vz = -uz, ux
    yaw = math.atan2(ux, uz)
    cx, cz = ux * r + vx * side * 2.6, uz * r + vz * side * 2.6
    for dx, dz in ((-0.7, -0.5), (0.7, -0.5), (-0.7, 0.5), (0.7, 0.5)):
        px, pz = cx + vx * dx + ux * dz, cz + vz * dx + uz * dz
        after(beam(f"{name}-post{dx}{dz}", (px, y, pz), (px, y + 1.3, pz), 0.12, "woodDark"))
    after(box(f"{name}-roof", (cx, y + 1.4, cz), (1.8, 0.1, 1.4), "roofRed", bevel=0.02, yaw=yaw))
    after(box(f"{name}-crate", (cx, y + 0.25, cz), (0.5, 0.5, 0.5), "wood", bevel=0.04, yaw=yaw))


# ---------------------------------------------------------------- direction A: the riva

def direction_a(n):
    seats = DUMP["seats"][str(n)]
    square = ring_plan([12.2, 11.8, 12.4, 12.0, 12.3, 11.9, 12.4, 11.8, 12.2, 12.0, 12.4, 11.9, 12.1, 12.3], phase=0.1)
    riva = ring_plan([14.2, 14.0, 14.3, 13.9, 14.2, 14.1, 14.3, 13.9, 14.2, 14.0, 14.3, 14.0, 14.1, 14.2], phase=0.1)
    walled("base-riva", riva, LOW, pave="quayPave")
    walled("base-square", square, G)
    market_ring()
    for k, a in enumerate(seats["angles"]):
        head = water_stair(f"base-stair-{k}", a, 12.0, G, LOW)
        street(f"pave-street-{k}", a, 8.9, head)
        shed(f"base-shed-{k}", a, 13.1, LOW, side=1.0)
        for j, dv in enumerate((-1.6, 1.6, -4.0, 4.0)):
            x, z = polar(a, 13.75)
            bollard(f"base-bollard-{k}-{j}", x + math.cos(a + math.pi / 2) * dv, LOW + 0.03, z + math.sin(a + math.pi / 2) * dv)
    for k, a in enumerate(a for a in [i * math.pi / 2 for i in range(4)] if all(abs(math.atan2(math.sin(a - s), math.cos(a - s))) > 0.2 for s in seats["angles"])):
        street(f"pave-street-axis-{k}", a, 8.9, 11.4)
    q = seats["quiet"]
    pile("after-pile", q, 13.1, LOW)
    # The dark alley behind the pile: a narrow arched passage into the square's wall.
    x, z = polar(q, 12.05)
    after(box("base-alley", (x, LOW + 0.9, z), (1.0, 1.8, 0.3), "dark", bevel=0.0, yaw=math.atan2(math.cos(q), math.sin(q))))
    after(box("base-alley-frame", (polar(q, 12.0)[0], LOW + 1.0, polar(q, 12.0)[1]), (1.4, 2.1, 0.24), "istrian", bevel=0.02, yaw=math.atan2(math.cos(q), math.sin(q))))


# ---------------------------------------------------------------- direction B: inner docks

SLOT = {"water": 3.8, "quay": 1.3}


def slot_frame(berth):
    (x, _, z), (ix, _, iz) = berth["at"], berth["inward"]
    ln = math.hypot(ix, iz)
    ux, uz = -ix / ln, -iz / ln  # out along the keel, toward the stern
    bow = (x - ux * 2.9, z - uz * 2.9)
    return bow, (ux, uz), (-uz, ux)


def city_outline_b(seats, radius):
    """The city's coast: a round of straight walls `radius` out, with a slot cut along every berth's keel line from just
    short of the bow out to the sea."""
    pts = []
    n = 40
    base = [(math.cos(2 * math.pi * k / n) * radius * (1 + 0.025 * math.sin(k * 2.3)), math.sin(2 * math.pi * k / n) * radius * (1 + 0.025 * math.sin(k * 2.3))) for k in range(n)]
    half = SLOT["water"] / 2 + SLOT["quay"]
    frames = [slot_frame(b) for b in seats["berths"]]
    # Drop the coast's points inside a slot, then splice each slot's mouth and head in where it opens.
    keep = []
    for p in base:
        cut = None
        for i, ((bx, bz), (ux, uz), (vx, vz)) in enumerate(frames):
            u = (p[0] - bx) * ux + (p[1] - bz) * uz
            v = (p[0] - bx) * vx + (p[1] - bz) * vz
            if u > -1.6 and abs(v) < half + 0.4:
                cut = i
        keep.append((p, cut))
    out = []
    for k, (p, cut) in enumerate(keep):
        prev_cut = keep[k - 1][1]
        if cut is not None:
            if prev_cut != cut:
                (bx, bz), (ux, uz), (vx, vz) = frames[cut]
                u_mouth = radius - math.hypot(bx, bz) + 0.8
                # Mouth, head, mouth, in the coast's own winding (counter-clockwise: -v side first).
                for v, u in ((-half, u_mouth), (-half, -1.6), (half, -1.6), (half, u_mouth)):
                    s = 1 if (ux * vz - uz * vx) > 0 else -1
                    out.append((bx + ux * u + vx * v * s, bz + uz * u + vz * v * s))
            continue
        out.append(p)
    return out, frames


def warehouse_row(name, a0, a1, base_u, frame, side):
    """A row of gabled warehouses (pakhuizen) along a slot's quay, fronts on the water."""
    (bx, bz), (ux, uz), (vx, vz) = frame
    colours = ["ochre", "rose", "sky", "plaster", "ochre", "sky"]
    yaw = math.atan2(ux, uz)
    v = side * (SLOT["water"] / 2 + SLOT["quay"] + 1.1)
    u = a0
    k = 0
    while u + 1.4 <= a1:
        cx, cz = bx + ux * (u + 0.7) + vx * v, bz + uz * (u + 0.7) + vz * v
        h = 1.7 + 0.3 * (k % 3)
        after(box(f"{name}-{k}", (cx, G + h / 2, cz), (1.8, h, 1.3), colours[k % len(colours)], bevel=0.02, yaw=yaw))
        after(prism(f"{name}-{k}-roof", (cx, G + h, cz), 0.95, 0.8, "roofRed", sides=4, top=0.1))
        after(box(f"{name}-{k}-door", (cx - vx * side * 0.66, G + 0.5, cz - vz * side * 0.66), (0.55, 0.9, 0.06), "dark", bevel=0.0, yaw=yaw + math.pi / 2))
        u += 1.4
        k += 1


def direction_b(n):
    seats = DUMP["seats"][str(n)]
    radius = 19.6
    outline, frames = city_outline_b(seats, radius)
    walled("base-city", outline, G)
    market_ring()
    for k, (frame, a) in enumerate(zip(frames, seats["angles"])):
        (bx, bz), (ux, uz), (vx, vz) = frame
        q = SLOT["quay"]
        w = SLOT["water"]
        for s in (-1, 1):
            v0, v1 = s * w / 2, s * (w / 2 + q)
            mouth = radius - math.hypot(bx, bz) + 0.8
            plan = [(bx + ux * u + vx * v, bz + uz * u + vz * v) for u, v in ((-1.6, v0), (mouth, v0), (mouth, v1), (-1.6, v1))]
            walled(f"base-slotquay-{k}{s}", plan, LOW, pave="quayPave")
            for j, u in enumerate((0.6, 3.2, 5.8)):
                bollard(f"base-bollard-{k}-{s}-{j}", bx + ux * u + vx * (v0 + s * 0.3), LOW + 0.03, bz + uz * u + vz * (v0 + s * 0.3))
            warehouse_row(f"base-pakhuis-{k}{s}", -0.6, mouth - 0.6, 0.0, frame, s)
        head = [(bx + ux * u + vx * v, bz + uz * u + vz * v) for u, v in ((-1.6 - 0.0, -w / 2), (-0.7, -w / 2), (-0.7, w / 2), (-1.6, w / 2))]
        walled(f"base-slothead-{k}", head, LOW, pave="quayPave")
        a_head = math.atan2(bz - uz * 1.6, bx - ux * 1.6)
        r_head = math.hypot(bx - ux * 1.6, bz - uz * 1.6)
        top = water_stair(f"base-stair-{k}", a_head, r_head, G, LOW)
        street(f"pave-street-{k}", a_head, 8.9, top)
    for k, a in enumerate(a for a in [i * math.pi / 2 for i in range(4)] if all(abs(math.atan2(math.sin(a - s), math.cos(a - s))) > 0.2 for s in seats["angles"])):
        street(f"pave-street-axis-{k}", a, 8.9, 14.0)
    q = seats["quiet"]
    pile("after-pile", q, radius - 1.6, G)


# ---------------------------------------------------------------- direction C: walled harbour town

def direction_c(n):
    seats = DUMP["seats"][str(n)]
    square = ring_plan([11.6, 11.2, 11.7, 11.3, 11.6, 11.2, 11.7, 11.3, 11.6, 11.2, 11.7, 11.3], phase=0.26)
    # Rock round the town's foot, gold limestone, broken.
    rock = []
    for x, z, nx, nz in walk(grow(square, 0.2), 1.6):
        d = rng.uniform(0.6, 1.8)
        rock.append((x + nx * d, z + nz * d))

    from island_kit import cdt_terrain

    cdt_terrain("base-rock", rock, lambda x, z, d: min(0.5, SEA - 0.4 + d * 1.1), lambda x, z, y, s: "wetRock" if y < 0.05 else "rockGold", spacing=1.2, seed=3, by_lowest=True)
    walled("base-square", square, G)
    market_ring()
    # The city wall on the square's edge: a parapet with a coping, and inside it a ring of vaulted warehouses (an
    # arcade of dark arches in bands of plaster colour) under a flat roof walk.
    wall_out, wall_in = grow(square, -0.1), grow(square, -0.7)
    after(plan_ring("base-wall", wall_out, wall_in, G - 0.1, G + 1.1, "limestone"))
    after(plan_ring("base-wall-cope", grow(square, 0.02), grow(square, -0.82), G + 1.1, G + 1.26, "istrian"))
    arcade_out, arcade_in = grow(square, -0.7), grow(square, -2.1)
    after(plan_ring("base-arcade", arcade_out, arcade_in, G - 0.05, G + 0.9, "ochre"))
    after(plan_ring("base-arcade-roof", grow(square, -0.68), grow(square, -2.2), G + 0.9, G + 1.02, "istrian"))
    colours = ["ochre", "rose", "sky", "plaster"]
    for k, (x, z, nx, nz) in enumerate(walk(arcade_in, 1.4)):
        yaw = math.atan2(-nx, -nz)
        after(box(f"base-arch-{k}", (x + nx * 0.02, G + 0.42, z + nz * 0.02), (0.7, 0.75, 0.08), "dark", bevel=0.0, yaw=yaw))
        after(box(f"base-arch-band-{k}", (x + nx * 0.05, G + 0.84, z + nz * 0.05), (1.3, 0.12, 0.06), colours[k % 4], bevel=0.0, yaw=yaw))
    gates = list(seats["angles"])
    for k, a in enumerate(gates):
        ux, uz = math.cos(a), math.sin(a)
        yaw = math.atan2(ux, uz)
        # The quay terrace outside the gate, a sector of the low quay.
        terrace = [polar(a + da, r) for da, r in ((-0.36, 11.0), (-0.36, 14.0), (-0.12, 14.4), (0.12, 14.4), (0.36, 14.0), (0.36, 11.0))]
        walled(f"base-terrace-{k}", terrace, LOW, pave="quayPave")
        # The gatehouse astride the wall, an arch through it at quay level, a red roof.
        gx, gz = polar(a, 11.2)
        after(box(f"base-gate-{k}", (gx, (LOW + G + 2.2) / 2, gz), (3.0, G + 2.2 - LOW, 1.8), "limestone", bevel=0.03, yaw=yaw))
        after(prism(f"base-gate-roof-{k}", (gx, G + 2.2, gz), 2.2, 1.1, "roofRed", sides=4, top=0.15))
        ox, oz = polar(a, 12.14)
        after(box(f"base-gate-arch-{k}", (ox, LOW + 0.9, oz), (1.3, 1.8, 0.08), "dark", bevel=0.0, yaw=yaw))
        after(box(f"base-gate-frame-{k}", (polar(a, 12.12)[0], LOW + 1.0, polar(a, 12.12)[1]), (1.8, 2.1, 0.06), "istrian", bevel=0.01, yaw=yaw))
        street(f"pave-street-{k}", a, 8.9, 10.2)
        shed(f"base-shed-{k}", a, 13.0, LOW, side=-1.0)
        for j, dv in enumerate((-2.0, 2.0)):
            x, z = polar(a, 13.8)
            bollard(f"base-bollard-{k}-{j}", x + math.cos(a + math.pi / 2) * dv, LOW + 0.03, z + math.sin(a + math.pi / 2) * dv)
    # Round towers on the wall between the gates.
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        if any(abs(math.atan2(math.sin(a - s), math.cos(a - s))) < 0.45 for s in gates):
            continue
        if k % 2:
            continue
        x, z = polar(a, 11.4)
        after(prism(f"base-tower-{k}", (x, 0.0, z), 1.0, G + 1.7, "limestone", sides=10))
        after(prism(f"base-tower-cope-{k}", (x, G + 1.7, z), 1.1, 0.16, "istrian", sides=10))
        after(prism(f"base-tower-roof-{k}", (x, G + 1.86, z), 1.05, 1.1, "roofRed", sides=10, top=0.05))
    q = seats["quiet"]
    pile("after-pile", q, 12.6, 0.5)
    x, z = polar(q, 11.66)
    after(box("base-postern", (x, 1.2, z), (0.8, 1.3, 0.1), "dark", bevel=0.0, yaw=math.atan2(math.cos(q), math.sin(q))))


# ---------------------------------------------------------------- direction AB: the riva and inner docks, a town

TOWN_R = 15.2  # the town's wall, the square's level
RIVA_R = 17.4  # the low quay's outer edge
HEAD_U = -0.6  # the slot's water ends this far behind the bow
LANDING = 1.2  # the landing quay at the slot's head
STAIR_RUN = 2.9  # the grand stairs from the landing up to the square
HALF = SLOT["water"] / 2 + SLOT["quay"]
HOUSE_COLOURS = ["ochre", "rose", "sky", "plaster", "ochre", "rose", "plaster", "leaf"]


def cut_outline(radius, frames, head_u, wobble=0.02, n=48):
    """A round of straight walls `radius` out with a slot cut along every berth's keel line from `head_u` (behind the
    bow) out to the sea, `HALF` either side."""
    base = [(math.cos(2 * math.pi * k / n) * radius * (1 + wobble * math.sin(k * 2.3)), math.sin(2 * math.pi * k / n) * radius * (1 + wobble * math.sin(k * 2.3))) for k in range(n)]
    keep = []
    for p in base:
        cut = None
        for i, ((bx, bz), (ux, uz), (vx, vz)) in enumerate(frames):
            u = (p[0] - bx) * ux + (p[1] - bz) * uz
            v = (p[0] - bx) * vx + (p[1] - bz) * vz
            if u > head_u - 0.4 and abs(v) < HALF + 0.5:
                cut = i
        keep.append((p, cut))
    out = []
    for k, (p, cut) in enumerate(keep):
        if cut is not None:
            if keep[k - 1][1] != cut:
                (bx, bz), (ux, uz), (vx, vz) = frames[cut]
                s = 1 if (ux * vz - uz * vx) > 0 else -1
                mouth = radius - math.hypot(bx, bz) + 1.2
                for v, u in ((-HALF, mouth), (-HALF, head_u), (HALF, head_u), (HALF, mouth)):
                    out.append((bx + ux * u + vx * v * s, bz + uz * u + vz * v * s))
            continue
        out.append(p)
    return out


def at_frame(frame, u, v):
    (bx, bz), (ux, uz), (vx, vz) = frame
    return (bx + ux * u + vx * v, bz + uz * u + vz * v)


def person(name, x, y, z, mat):
    after(prism(f"{name}", (x, y, z), 0.17, 0.5, mat, sides=6, top=0.75))
    after(prism(f"{name}-head", (x, y + 0.5, z), 0.13, 0.22, "plaster", sides=6, top=0.6))


def house(name, x, z, yaw, w, d, h, mat, awning=None):
    after(box(f"{name}", (x, G + h / 2, z), (w, h, d), mat, bevel=0.02, yaw=yaw))
    # A gabled roof along its front, red or slate.
    ux, uz = math.sin(yaw), math.cos(yaw)
    after(beam(f"{name}-ridge", (x - uz * (w / 2), G + h + 0.02, z + ux * (w / 2)), (x + uz * (w / 2), G + h + 0.02, z - ux * (w / 2)), d * 1.02, "roofRed" if (hash(name) % 3) else "slate", sides=3))
    # Its door (or shop front) on the street side, a little proud of the wall.
    after(box(f"{name}-door", (x + ux * (d / 2 + 0.02), G + 0.42, z + uz * (d / 2 + 0.02)), (0.5 if not awning else w * 0.7, 0.8, 0.05), "dark", bevel=0.0, yaw=yaw))
    if awning:
        after(box(f"{name}-awning", (x + ux * (d / 2 + 0.35), G + 1.0, z + uz * (d / 2 + 0.35)), (w * 0.85, 0.06, 0.7), awning, bevel=0.0, yaw=yaw))


FOOTPRINTS = []  # every standing thing's plan as a rectangle's corners, so no two houses overlap


def rect(x, z, yaw, w, d, margin=0.0):
    ux, uz = math.sin(yaw), math.cos(yaw)
    vx, vz = uz, -ux
    hw, hd = w / 2 + margin, d / 2 + margin
    return [(x + vx * sv * hw + ux * su * hd, z + vz * sv * hw + uz * su * hd) for sv, su in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


def overlaps(a, b):
    """Two convex plans overlap (separating-axis test)."""
    for poly in (a, b):
        for i in range(len(poly)):
            (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
            nx, nz = z1 - z0, x0 - x1
            pa = [nx * x + nz * z for x, z in a]
            pb = [nx * x + nz * z for x, z in b]
            if max(pa) <= min(pb) or max(pb) <= min(pa):
                return False
    return True


def claim(plan):
    """Reserve a plan if it is free; False if it would overlap something already standing."""
    if any(overlaps(plan, other) for other in FOOTPRINTS):
        return False
    FOOTPRINTS.append(plan)
    return True


HOUSE_PALETTE = ["ochre", "rose", "sky", "plaster", "sandstone", "marble", "leaf", "pastelBlue", "ochre", "rose", "plaster"]
ROOF_PALETTE = ["roofRed", "roofRed", "roofRed", "slate", "roofGold", "roofGreen", "roofBlue"]


def roofed(name, x, z, yaw, w, d, y, kind, mat):
    """A roof on a w × d box top at y: a gable along the front, a gable end-on (the Dutch street front), a hipped
    pyramid, or a flat terrace behind a parapet."""
    ux, uz = math.sin(yaw), math.cos(yaw)  # out of the front
    vx, vz = uz, -ux  # along the front
    if kind == "gable":
        after(beam(f"{name}-roof", (x - vx * w / 2, y + 0.02, z - vz * w / 2), (x + vx * w / 2, y + 0.02, z + vz * w / 2), d * 1.05, mat, sides=3))
    elif kind == "end":
        after(beam(f"{name}-roof", (x - ux * d / 2, y + 0.02, z - uz * d / 2), (x + ux * d / 2, y + 0.02, z + uz * d / 2), w * 1.05, mat, sides=3))
    elif kind == "hip":
        after(prism(f"{name}-roof", (x, y, z), max(w, d) * 0.72, min(w, d) * 0.55, mat, sides=4, top=0.12))
    else:
        after(plan_ring(f"{name}-parapet", [(x + vx * sx * w / 2 + ux * sz * d / 2, z + vz * sx * w / 2 + uz * sz * d / 2) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
                        [(x + vx * sx * (w / 2 - 0.14) + ux * sz * (d / 2 - 0.14), z + vz * sx * (w / 2 - 0.14) + uz * sz * (d / 2 - 0.14)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
                        y - 0.02, y + 0.22, "istrian"))


def town_house(name, x, z, yaw, w, d, h, near, shop):
    """One house, each its own: a body (sometimes jettied: an upper storey a little wider than the shop below), a roof
    of one of four kinds, a chimney now and then, a door or an awninged shop front on the street side."""
    ux, uz = math.sin(yaw), math.cos(yaw)
    mat = rng.choice(HOUSE_PALETTE)
    jetty = rng.random() < 0.3 and h > 1.8
    if jetty:
        low = h * 0.45
        after(box(f"{name}", (x, G + low / 2, z), (w, low, d), rng.choice(["plaster", "sandstone", "marble"]), bevel=0.02, yaw=yaw))
        after(box(f"{name}-upper", (x + ux * 0.12, G + low + (h - low) / 2, z + uz * 0.12), (w + 0.12, h - low, d + 0.24), mat, bevel=0.02, yaw=yaw))
    else:
        after(box(f"{name}", (x, G + h / 2, z), (w, h, d), mat, bevel=0.02, yaw=yaw))
    kind = rng.choices(["gable", "end", "hip", "flat"], [4, 3, 2, 1.5])[0]
    roofed(name, x, z, yaw, w + (0.12 if jetty else 0), d + (0.24 if jetty else 0), G + h, kind, rng.choice(ROOF_PALETTE))
    if rng.random() < 0.35 and kind != "flat":
        cx, cz = x - ux * d * 0.2 + uz * w * 0.25, z - uz * d * 0.2 - ux * w * 0.25
        after(box(f"{name}-chimney", (cx, G + h + 0.45, cz), (0.24, 0.9, 0.24), "sandstone", bevel=0.0, yaw=yaw))
    fw = w * 0.7 if shop else 0.45
    after(box(f"{name}-door", (x + ux * (d / 2 + 0.02), G + 0.42, z + uz * (d / 2 + 0.02)), (fw, 0.8, 0.05), "dark", bevel=0.0, yaw=yaw))
    if shop:
        after(box(f"{name}-awning", (x + ux * (d / 2 + 0.35), G + 1.0, z + uz * (d / 2 + 0.35)), (w * 0.85, 0.06, 0.7), rng.choice(["awningPink", "awningPurple", "canvas", "roofGreen"]), bevel=0.0, yaw=yaw))
        if rng.random() < 0.6:
            after(box(f"{name}-goods", (x + ux * (d / 2 + 0.35), G + 0.2, z + uz * (d / 2 + 0.35)), (w * 0.6, 0.4, 0.4), rng.choice(["wood", "spiceOrange", "spiceYellow", "cardamom"]), bevel=0.03, yaw=yaw))


def little_square(name, x, z):
    """A gap in a row left as a little square: a tree or a well, a bench of crates."""
    if rng.random() < 0.6:
        after(prism(f"{name}-trunk", (x, G, z), 0.14, 1.0, "woodDark", sides=6))
        after(prism(f"{name}-crown", (x, G + 0.9, z), 0.85, 1.4, "leaf", sides=7, top=0.25))
    else:
        after(prism(f"{name}-well", (x, G, z), 0.5, 0.5, "stone", sides=8))
        after(prism(f"{name}-water", (x, G + 0.45, z), 0.36, 0.06, "canal", sides=8))
        for s in (-1, 1):
            after(beam(f"{name}-post{s}", (x + s * 0.45, G + 0.5, z), (x + s * 0.45, G + 1.3, z), 0.08, "woodDark"))
        after(beam(f"{name}-bar", (x - 0.5, G + 1.3, z), (x + 0.5, G + 1.3, z), 0.08, "woodDark"))


def town_ring(ring_r, faces_in, frames, streets, k):
    """Houses along a ring round the square, each a different width, depth and height, set back or forward a little
    and turned a touch off true; now and then a tall merchant's tower at the back, now and then a gap kept as a little
    square. Low toward the camera so the bazaar's foot still shows. Every house claims its plan (with its shop front)
    first; where it would touch one already standing it is tried narrower, then the row moves on a little, so no two
    overlap (overlapping walls flicker and break the model)."""
    a = rng.uniform(0, 0.3)
    while a < 2 * math.pi:
        near = math.sin(a)  # +z, toward the camera
        r = ring_r + rng.uniform(-0.25, 0.25)
        if rng.random() < 0.08:
            x, z = math.cos(a + 0.9 / r) * r, math.sin(a + 0.9 / r) * r
            if clear_of(x, z, frames, streets) and claim(rect(x, z, 0.0, 1.8, 1.8)):
                little_square(f"base-square-{k}", x, z)
                k += 1
                a += 1.9 / r
                continue
        tower = near < -0.3 and rng.random() < 0.12
        shop = not tower and rng.random() < 0.45
        d = 1.3 if tower else rng.uniform(1.5, 2.3)
        h = rng.uniform(4.2, 5.2) if tower else (rng.uniform(1.4, 2.2) if near > 0.4 else rng.uniform(1.8, 3.6))
        placed = False
        for w in ((1.3,) if tower else (rng.uniform(1.4, 2.8), 1.6, 1.15)):
            mid = a + (w / 2 + 0.06) / r
            x, z = math.cos(mid) * r, math.sin(mid) * r
            if not clear_of(x, z, frames, streets):
                break
            yaw = (math.atan2(-math.cos(mid), -math.sin(mid)) if faces_in else math.atan2(math.cos(mid), math.sin(mid))) + rng.uniform(-0.07, 0.07)
            ux, uz = math.sin(yaw), math.cos(yaw)
            front = 0.75 if shop else 0.1  # the awning and goods out front
            plan = rect(x + ux * front / 2, z + uz * front / 2, yaw, w + 0.14, d + 0.24 + front, 0.03)
            if claim(plan):
                town_house(f"base-house-{k}", x, z, yaw, w, d, h, near, shop)
                k += 1
                a += (w + rng.uniform(0.1, 0.25)) / r
                placed = True
                break
        if not placed:
            a += 0.35 / r
    return k


def clear_of(x, z, frames, streets):
    """True where a house may stand: off the slots and their stairs, off the streets and the lane, round the square."""
    r = math.hypot(x, z)
    if r < 9.9 or r > TOWN_R - 0.9:
        return False
    if abs(r - 12.6) < 0.75:
        return False  # the ring lane
    for f in frames:
        (bx, bz), (ux, uz), (vx, vz) = f
        u = (x - bx) * ux + (z - bz) * uz
        v = (x - bx) * vx + (z - bz) * vz
        if u > HEAD_U - LANDING - STAIR_RUN - 2.2 and abs(v) < HALF + 1.4:
            return False
    for a, w in streets:
        d = abs(-math.sin(a) * x + math.cos(a) * z)
        if d < w and (math.cos(a) * x + math.sin(a) * z) > 0:
            return False
    return True


def direction_ab(n):
    FOOTPRINTS.clear()
    seats = DUMP["seats"]["4"]
    frames = [slot_frame(b) for b in seats["berths"]]
    q = seats["quiet"]
    # The town at the square's level, cut by the slots and their stairs; the riva a step down round it, cut by the slots.
    town = cut_outline(TOWN_R, frames, HEAD_U - LANDING - STAIR_RUN)
    riva = cut_outline(RIVA_R, frames, HEAD_U, wobble=0.015)
    walled("base-riva", riva, LOW, pave="quayPave")
    walled("base-city", town, G)
    market_ring()
    for k, frame in enumerate(frames):
        # The slot's side quays and its landing, a step up from the water, bollards along them.
        for side in (-1, 1):
            v0, v1 = side * SLOT["water"] / 2, side * HALF
            mouth = RIVA_R - math.hypot(*frame[0]) + 1.2
            walled(f"base-slotquay-{k}{side}", [at_frame(frame, u, v) for u, v in ((HEAD_U - LANDING, v0), (mouth, v0), (mouth, v1), (HEAD_U - LANDING, v1))], LOW, pave="quayPave")
            for j, u in enumerate((1.0, 3.6)):
                x, z = at_frame(frame, u, v0 + side * 0.3)
                bollard(f"base-bollard-{k}{side}{j}", x, LOW + 0.03, z)
        walled(f"base-landing-{k}", [at_frame(frame, u, v) for u, v in ((HEAD_U - LANDING, -SLOT["water"] / 2), (HEAD_U, -SLOT["water"] / 2), (HEAD_U, SLOT["water"] / 2), (HEAD_U - LANDING, SLOT["water"] / 2))], LOW, pave="quayPave")
        # The grand stairs, the whole slot wide, from the landing up to the square: where arrivals are met.
        (bx, bz), (ux, uz), (vx, vz) = frame
        yaw = math.atan2(ux, uz)
        steps = 8
        u_top = HEAD_U - LANDING - STAIR_RUN
        for j in range(steps):
            u = HEAD_U - LANDING - (j + 0.5) * STAIR_RUN / steps
            y = LOW + (G - LOW) * (j + 1) / steps
            x, z = at_frame(frame, u, 0)
            after(box(f"base-stair-{k}-{j}", (x, (FOOT + y) / 2, z), (HALF * 2, y - FOOT, STAIR_RUN / steps + 0.02), "quayPave", bevel=0.0, yaw=yaw))
        # Twin columns at the stairs' head, a gilded figure on each (the Piazzetta's columns), and an arcaded loggia
        # either side for the harbour master and the customs.
        for side in (-1, 1):
            x, z = at_frame(frame, u_top - 0.5, side * (HALF - 0.6))
            after(prism(f"base-column-{k}{side}-plinth", (x, G, z), 0.55, 0.5, "istrian", sides=8))
            after(prism(f"base-column-{k}{side}", (x, G + 0.5, z), 0.3, 4.2, "istrian", sides=10))
            after(prism(f"base-column-{k}{side}-cap", (x, G + 4.7, z), 0.42, 0.28, "istrian", sides=8))
            after(prism(f"base-column-{k}{side}-figure", (x, G + 4.98, z), 0.3, 0.7, "gold", sides=6, top=0.4))
            lx, lz = at_frame(frame, u_top - 2.2, side * (HALF + 0.4))
            FOOTPRINTS.append(rect(lx, lz, yaw, 2.3, 2.9, 0.1))
            FOOTPRINTS.append(rect(x, z, yaw, 1.2, 1.2, 0.05))
            after(box(f"base-loggia-{k}{side}", (lx, G + 1.0, lz), (2.0, 2.0, 2.6), "rose" if side < 0 else "ochre", bevel=0.02, yaw=yaw))
            after(box(f"base-loggia-{k}{side}-roof", (lx, G + 2.08, lz), (2.3, 0.16, 2.9), "roofRed", bevel=0.02, yaw=yaw))
            for a in (-0.7, 0.0, 0.7):
                ax, az = lx + ux * a - vx * side * 1.02, lz + uz * a - vz * side * 1.02
                after(box(f"base-loggia-{k}{side}-arch{a}", (ax, G + 0.65, az), (0.06, 1.1, 0.5), "dark", bevel=0.0, yaw=yaw))
        # The street from the stairs to the market's foot.
        a = math.atan2(*reversed(at_frame(frame, u_top, 0)))
        street(f"pave-street-{k}", a, 8.9, math.hypot(*at_frame(frame, u_top, 0)) - 0.2, width=2.6)
        # Arrivals and greeters on the stairs' head and the landing.
        for j in range(5):
            x, z = at_frame(frame, u_top - 0.8 - rng.uniform(0, 1.6), rng.uniform(-2.0, 2.0))
            person(f"after-folk-{k}-{j}", x, G, z, rng.choice(["roofBlue", "roofGreen", "awningPurple", "ruby"]))
    # The town: houses in rings round the square, a lane between, their fronts on the square and on the riva; low near
    # the camera so the bazaar's foot still shows, taller behind. A gap at the quiet bearing is the smugglers' alley.
    streets = [(q, 1.0)]
    k = 0
    for ring_r, faces_in in ((11.0, True), (14.0, False)):
        k = town_ring(ring_r, faces_in, frames, streets, k)
    # Folk on the square's ring, the lane and the riva, and stalls on the riva.
    for j in range(26):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.choice([9.3, 12.6, 16.3])
        x, z = math.cos(a) * r, math.sin(a) * r
        if r > 15 and any(abs((x - f[0][0]) * f[2][0] + (z - f[0][1]) * f[2][1]) < HALF + 0.3 and ((x - f[0][0]) * f[1][0] + (z - f[0][1]) * f[1][1]) > HEAD_U - 1 for f in frames):
            continue
        person(f"after-folk-{j}", x, (LOW if r > 15 else G), z, rng.choice(["roofBlue", "roofGreen", "awningPurple", "ruby", "wood"]))
    for j, a in enumerate((0.42, 1.2, 1.95, 2.75, 3.55, 4.35, 5.1, 5.9)):
        if abs(math.atan2(math.sin(a - q), math.cos(a - q))) < 0.25:
            continue
        x, z = polar(a, 16.2)
        yaw = math.atan2(math.cos(a), math.sin(a))
        for dx, dz in ((-0.6, -0.4), (0.6, -0.4), (-0.6, 0.4), (0.6, 0.4)):
            after(beam(f"base-stall-{j}-{dx}{dz}", (x + math.cos(yaw) * dx + math.sin(yaw) * dz, LOW, z - math.sin(yaw) * dx + math.cos(yaw) * dz),
                       (x + math.cos(yaw) * dx + math.sin(yaw) * dz, LOW + 1.1, z - math.sin(yaw) * dx + math.cos(yaw) * dz), 0.08, "woodDark"))
        after(box(f"base-stall-{j}-top", (x, LOW + 1.15, z), (1.5, 0.08, 1.1), rng.choice(["awningPink", "awningPurple", "canvas"]), bevel=0.0, yaw=yaw))
        after(box(f"base-stall-{j}-goods", (x, LOW + 0.35, z), (1.1, 0.5, 0.6), "wood", bevel=0.03, yaw=yaw))
    # The smugglers' pile on the riva at the quiet bearing, at the alley's mouth.
    pile("after-pile", q, 16.4, LOW)
    x, z = polar(q, TOWN_R + 0.02)
    after(box("base-alley", (x, LOW + 1.0, z), (1.1, 2.0, 0.1), "dark", bevel=0.0, yaw=math.atan2(math.cos(q), math.sin(q))))


# ---------------------------------------------------------------- the bazaar's grand stairs (§25.7)

# The bazaar's own design units (src/ui/scene/buildings/islands/market.ts): drawn ×2 on the square.
MS = 2.0
M_TIERS = (3.1, 2.2, 1.3)
M_STEP_UP = 0.76
M_RISE = M_STEP_UP / 4
M_RUN = 0.17


def m_edge(i):
    return M_TIERS[i] * 0.97 + 0.04


def mt(p, spin):
    """A point of the bazaar's design on its +z face, turned to face `spin`, onto the table."""
    x, y, z = p
    c, sn = math.cos(spin), math.sin(spin)
    return (MS * (x * c + z * sn), G + MS * y, MS * (-x * sn + z * c))


def mbox(name, center, size, mat, spin, bevel=0.01):
    return after(box(name, mt(center, spin), (size[0] * MS, size[1] * MS, size[2] * MS), mat, bevel=bevel * MS, yaw=spin))


def mslope(name, x0, x1, z0, z1, y_lo, top0, top1, mat, spin, along="z"):
    """A wall block whose top slopes from top0 (at the start of its run) to top1 (at its end): a cheek wall or a
    balustrade beside a flight. `along` is the axis it runs along."""
    if along == "z":
        corners = [(x0, z0, top0), (x1, z0, top0), (x1, z1, top1), (x0, z1, top1)]
    else:
        corners = [(x0, z0, top0), (x1, z0, top1), (x1, z1, top1), (x0, z1, top0)]
    verts = [mt((x, y_lo, z), spin) for x, z, _ in corners] + [mt((x, t, z), spin) for x, z, t in corners]
    faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return after(mesh_from(name, verts, faces, mat))


def m_gate(name, xa, xb, z, floor, spin, tall=0.95):
    """A gate where a flight comes onto a terrace: two stone piers with caps, a lintel, a little red gable on it."""
    for k, x in enumerate((xa, xb)):
        mbox(f"{name}-pier{k}", (x, floor + tall / 2, z), (0.16, tall, 0.16), "sandstone", spin)
        mbox(f"{name}-cap{k}", (x, floor + tall + 0.03, z), (0.2, 0.06, 0.2), "stone", spin)
    mid = (xa + xb) / 2
    mbox(f"{name}-lintel", (mid, floor + tall - 0.06, z), (abs(xb - xa) + 0.2, 0.12, 0.18), "stone", spin)
    a, b = mt((xa - 0.12, floor + tall + 0.02, z), spin), mt((xb + 0.12, floor + tall + 0.02, z), spin)
    after(beam(f"{name}-gable", a, b, 0.26 * MS, "roofRed", sides=3))


def m_newel(name, x, z, y, spin):
    mbox(name, (x, y + 0.21, z), (0.16, 0.42, 0.16), "sandstone", spin)
    c = mt((x, y + 0.42, z), spin)
    after(prism(f"{name}-ball", c, 0.08 * MS, 0.12 * MS, "stone", sides=8, top=0.4))


def grand_flight(spin):
    """The first terrace's flight on a straight face: a broad stair split by a landing half way, cheek walls with a
    coping either side ending in newel posts, a gate at its head on the terrace's edge."""
    wall, w = M_TIERS[0], 1.0
    # From the wall out: two steps, the landing (as deep as two steps), one step to the square.
    runs = [(0.76, M_RUN), (0.57, M_RUN), (0.38, 0.34), (0.19, M_RUN)]
    z = wall - 0.06
    for k, (top, run) in enumerate(runs):
        mbox(f"stairs-g{spin:.2f}-{k}", (0, top / 2, z + run / 2 + 0.03), (w, top, run + 0.06), "stone", spin)
        z += run
    foot = z
    mbox(f"stairs-g{spin:.2f}-landing", (0, 0.38 + 0.012, wall - 0.06 + 2 * M_RUN + 0.17), (w - 0.01, 0.025, 0.33), "sandstone", spin, bevel=0.0)
    for side in (-1, 1):
        x = side * (w / 2 + 0.08)
        mslope(f"stairs-g{spin:.2f}-cheek{side}", x - 0.07, x + 0.07, wall - 0.1, foot, 0.0, 0.76 + 0.12, 0.19 + 0.12, "sandstone", spin)
        after(beam(f"stairs-g{spin:.2f}-cope{side}", mt((x, 0.76 + 0.15, wall - 0.12), spin), mt((x, 0.19 + 0.15, foot + 0.02), spin), 0.17 * MS, "stone", sides=4))
        m_newel(f"stairs-g{spin:.2f}-newel{side}", x, foot + 0.04, 0.0, spin)
    m_gate(f"stairs-g{spin:.2f}-gate", -(w / 2 + 0.08), w / 2 + 0.08, m_edge(0) - 0.08, M_STEP_UP, spin)


def side_flight(tier, spin):
    """A flight along the wall of terrace `tier`: two steps, a half landing, two steps, a top landing level with the
    terrace, a balustrade on its open side ending in a newel, a gate onto the terrace."""
    wall, floor, depth = M_TIERS[tier], tier * M_STEP_UP, 0.38
    runs = [(0.19, M_RUN), (0.38, 0.3), (0.57, M_RUN), (0.76, M_RUN), (0.76, 0.3)]
    x = -0.46
    for k, (rise, run) in enumerate(runs):
        mbox(f"stairs-s{tier}{spin:.2f}-{k}", (x + run / 2, floor + rise / 2, wall + depth / 2 - 0.03), (run + 0.005, rise, depth + 0.06), "stone", spin)
        x += run
    head = x
    zb = wall + depth + 0.04
    # An open balustrade on the drop side, so the steps still show. The handrail runs parallel to the steps' nosings
    # and lies level over each landing, a stair's rail; every baluster stands on its step and stops under the rail. It
    # turns round the top landing's far end, so nobody walks off the edge up there.
    H = 0.26
    starts, acc = [], -0.46
    for rise, run in runs:
        starts.append((acc, acc + run, floor + rise))
        acc += run
    rail = [(-0.46, starts[0][2] + H)]
    for x0, x1, top in starts:
        if x1 - x0 > M_RUN + 0.01:  # a landing: the rail lies level across it
            rail += [(x0 + 0.02, top + H), (x1 - 0.02, top + H)]
        else:
            rail.append(((x0 + x1) / 2, top + H))
    rail.append((head, floor + 0.76 + H))

    def step_top(x):
        for x0, x1, top in starts:
            if x < x1:
                return top
        return floor + 0.76

    def rail_y(x):
        for (xa, ya), (xb, yb) in zip(rail, rail[1:]):
            if x <= xb:
                return ya + (yb - ya) * (x - xa) / max(xb - xa, 1e-6)
        return rail[-1][1]

    zr = zb - 0.03
    for j, ((xa, ya), (xb, yb)) in enumerate(zip(rail, rail[1:])):
        after(beam(f"stairs-s{tier}{spin:.2f}-rail{j}", mt((xa, ya, zr), spin), mt((xb, yb, zr), spin), 0.07 * MS, "stone", sides=4))
    bx = -0.38
    while bx < head - 0.04:
        y0, y1 = step_top(bx), rail_y(bx) - 0.03
        mbox(f"stairs-s{tier}{spin:.2f}-bal{bx:.2f}", (bx, (y0 + y1) / 2, zr), (0.035, y1 - y0, 0.035), "sandstone", spin, bevel=0.0)
        bx += 0.11
    # Round the top landing's far end, back to the terrace's wall.
    top_y = floor + 0.76 + H
    after(beam(f"stairs-s{tier}{spin:.2f}-rail-end", mt((head, top_y, zr), spin), mt((head, top_y, wall - 0.04), spin), 0.07 * MS, "stone", sides=4))
    for j, zz in enumerate((zr - 0.12, zr - 0.24)):
        mbox(f"stairs-s{tier}{spin:.2f}-bal-end{j}", (head - 0.02, floor + 0.76 + (H - 0.03) / 2, zz), (0.035, H - 0.03, 0.035), "sandstone", spin, bevel=0.0)
    mbox(f"stairs-s{tier}{spin:.2f}-post-end", (head - 0.02, floor + 0.76 + (H + 0.04) / 2, zr), (0.07, H + 0.04, 0.07), "sandstone", spin, bevel=0.0)
    # The landings' floors in sandstone, so they read as places to stop, not one more step.
    for k, (x0, x1, top) in enumerate(starts):
        if x1 - x0 > M_RUN + 0.01:
            mbox(f"stairs-s{tier}{spin:.2f}-landing{k}", ((x0 + x1) / 2, top + 0.012, wall + depth / 2), (x1 - x0 - 0.01, 0.025, depth - 0.02), "sandstone", spin, bevel=0.0)
    m_newel(f"stairs-s{tier}{spin:.2f}-newel", -0.5, zr, floor, spin)
    m_gate(f"stairs-s{tier}{spin:.2f}-gate", head - 0.38, head + 0.02, m_edge(tier) - 0.06, floor + M_STEP_UP, spin, tall=0.75)


def grand_stairs():
    axis = [k * math.pi / 2 for k in range(4)]
    for t in axis:
        grand_flight(t)
        side_flight(2, t)
    for t in axis:
        side_flight(1, t + math.pi / 4)


# ---------------------------------------------------------------- scene

def soup(m, tags):
    p, c = m["positions"], m["colors"]
    me = bpy.data.meshes.new(m["name"])
    verts = [V(p[i], p[i + 1], p[i + 2]) for i in range(0, len(p), 3)]
    me.from_pydata(verts, [], [(i, i + 1, i + 2) for i in range(0, len(verts), 3)])
    me.update()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            attr.data[li].color = [srgb_to_linear(c[vi * 3 + k]) for k in range(3)] + [1.0]
    ob = bpy.data.objects.new(m["name"], me)
    kit.SCENE.collection.objects.link(ob)
    for t in tags:
        ob[t] = True
    return ob


def build(n):
    """Everything for n players; returns the objects made."""
    start = set(kit.SCENE.objects)
    sea = slab("sea", [(-60, -60), (60, -60), (60, 60), (-60, 60)], -3.2, SEA, "sea")
    sea["before"] = True
    CUTTERS.clear()
    {"A": direction_a, "B": direction_b, "C": direction_c, "AB": direction_ab}[DIRECTION](n)
    blocks = [ob for ob, _, _ in kit.PARTS if ob.name.startswith(("base-square", "base-city", "base-riva", "base-slothead", "base-wall", "base-arcade"))]
    blocks = [] if DIRECTION == "AB" else blocks
    for ob in blocks:
        for c in CUTTERS:
            mod = ob.modifiers.new("cut", "BOOLEAN")
            mod.object = c
            mod.operation = "DIFFERENCE"
            mod.solver = "EXACT"
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in CUTTERS:
        bpy.data.objects.remove(c)
    for k, b in enumerate(DUMP["seats"][str(n)]["berths"]):
        ship(f"ship-{k}", b)
    if STAIRS:
        # The town stands in both columns; only the bazaar's flights differ.
        for ob in kit.SCENE.objects:
            if ob.type == "MESH" and not ob.name.startswith("before-"):
                ob["before"] = True
        grand_stairs()
    return start


setup_render()
kit.SCENE.render.line_thickness = 1.0


def orbit(name, azimuth, elevation, target, scale, res=(1200, 900), dist=80):
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * dist
    return camera(name, V(*(t + d)), V(*t), scale, res)


OUT = out_dir()
VC = None
RUNS = ((4, ("mkt-top", "mkt-front", "mkt-diag", "mkt-side", "dock")),) if STAIRS else ((4, ("top4", "dock", "close", "town")),) if DIRECTION == "AB" else ((4, ("top4", "dock", "close")), (3, ("top3",)))
for n, views in RUNS:
    # Start clean for each count.
    for ob in list(kit.SCENE.objects):
        if ob.type == "MESH":
            bpy.data.objects.remove(ob)
    kit.PARTS.clear()
    build(n)
    colour_parts()
    VC = bpy.data.materials["vc"] if VC is None else VC
    # The booleans leave an empty material slot first: give every part the one vertex-colour material.
    for ob, _, _ in kit.PARTS:
        ob.data.materials.clear()
        ob.data.materials.append(VC)
    for m in DUMP["before"]:
        soup(m, ["before"]).data.materials.append(VC)
    if STAIRS:
        soup(DUMP["market"], ["before"]).data.materials.append(VC)
        soup(DUMP["marketBare"], ["after"]).data.materials.append(VC)
    else:
        soup(DUMP["market"], ["before", "after"]).data.materials.append(VC)
    soup(DUMP["seats"][str(n)]["piers"], ["before"]).data.materials.append(VC)
    soup(DUMP["seats"][str(n)]["pile"], ["before"]).data.materials.append(VC)
    for ob in kit.SCENE.objects:
        if ob.type == "MESH":
            if ob.name.startswith("after-"):
                ob["after"] = True
                if STAIRS:
                    ob["before"] = True
            for p in ob.data.polygons:
                p.use_smooth = False
    tris = sum(len(p.vertices) - 2 for ob in kit.SCENE.objects if ob.type == "MESH" and ob.name.startswith(("base-", "pave-")) for p in ob.data.polygons)
    print(f"DIRECTION {DIRECTION} n={n}: ~{tris} triangles")
    cams = {
        "top4": camera("cam-top4", V(0, 80, 0.5), V(0, 0, 0.5), 50, (1100, 1100)),
        "top3": camera("cam-top3", V(0, 80, 0.5), V(0, 0, 0.5), 50, (1100, 1100)),
        "dock": orbit("cam-dock", 0, 42, (0, 2, 2), 44),
        "close": orbit("cam-close", 18, 24, (0, 2.0, 13.0), 17),
        "town": orbit("cam-town", 50, 30, (7.0, 3.0, 7.0), 18),
        "mkt-top": camera("cam-mkt-top", V(0, 80, 0.0), V(0, 0, 0.0), 19, (1100, 1100)),
        "mkt-front": orbit("cam-mkt-front", 8, 22, (0, 5.2, 5.0), 10),
        "mkt-diag": orbit("cam-mkt-diag", 40, 30, (3.0, 5.4, 3.0), 10),
        "mkt-side": orbit("cam-mkt-side", 62, 26, (3.4, 6.2, 3.0), 4.5),
    }
    for cam, _ in cams.values():
        if cam.name.startswith(("cam-top", "cam-mkt-top")):
            cam.rotation_euler = (0, 0, 0)
    for state in ("before", "after"):
        for ob in kit.SCENE.objects:
            if ob.type == "MESH":
                ob.hide_render = not ob.get(state, False) and not ob.name == "sea"
        for v in views:
            cam, (w, h) = cams[v]
            kit.SCENE.camera = cam
            kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
            kit.SCENE.render.filepath = os.path.join(OUT, f"{state}-{v}.png")
            bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
