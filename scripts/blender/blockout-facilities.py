"""Design sheet of the V0.8 prototype's three buildings (修船廠 repairyard, 軍械庫 armory, 商行 tradehouse): rendered
blockouts for the user to approve before modelling (docs/proposals/2026-11-v08-presentation-plan.md step 2). An
experiment, not rules.

  Blender -b --factory-startup --python scripts/blender/blockout-facilities.py -- <render dir>

Table units (the island's own space, y up, +z toward the dock). Each building stands on a plot of about 4.6 x 4.6, the
size the old asset buildings take at ASSET_BUILDING_SCALE, and stays under 5.6 high so the island's landmark stays the
tallest thing. Parts whose names start with "x-" are concave or thin (the centroid normal check skips them).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockout_kit import *  # noqa: E402,F403
import blockout_kit as kit  # noqa: E402

kit.SWATCHES.update({"turf": ("#9ccf7a", "#7fb964"), "iron": ("#5a5f66", "#3f4349")})
PLOT = 4.6


def lathe(name, base, profile, mat, sides=20, shade=1.0):
    """A solid of revolution round the vertical axis at `base` (x, z): `profile` is (radius, y) from bottom to top."""
    verts, faces = [], []
    for r, y in profile:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((base[0] + math.cos(a) * r, y, base[1] + math.sin(a) * r))
    n = len(profile)
    for k in range(n - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append([k * sides + i, (k + 1) * sides + i, (k + 1) * sides + j, k * sides + j])
    faces.append(list(range(sides)))
    faces.append(list(reversed(range((n - 1) * sides, n * sides))))
    return mesh_from(name, verts, faces, mat, shade)


def ball(name, centre, radius, mat, shade=1.0):
    steps = 6
    profile = [(max(0.02, radius * math.sin(math.pi * k / steps)), centre[1] - radius * math.cos(math.pi * k / steps)) for k in range(steps + 1)]
    return lathe(name, (centre[0], centre[2]), profile, mat, sides=10, shade=shade)


def barrel(name, at, mat="wood", r=0.3, h=0.62):
    x, y, z = at
    lathe(name, (x, z), [(r * 0.82, y), (r, y + h * 0.3), (r, y + h * 0.7), (r * 0.82, y + h)], mat, sides=10)
    for k, t in enumerate((0.2, 0.8)):
        lathe(f"{name}-hoop{k}", (x, z), [(r * 0.97, y + h * t - 0.04), (r * 0.97, y + h * t + 0.04)], "iron", sides=10)


def extrude_z(name, outline, z0, z1, mat, shade=1.0):
    """An (x, y) outline pulled from z0 to z1 (a gable wall, a roof section)."""
    n = len(outline)
    verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def extrude_x(name, outline, x0, x1, mat, shade=1.0):
    """A (z, y) outline pulled from x0 to x1 (a slipway, a ramp)."""
    n = len(outline)
    verts = [(x0, y, z) for z, y in outline] + [(x1, y, z) for z, y in outline]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def arc_block(name, centre, r0, r1, a0, a1, y0, y1, mat, steps=4, shade=1.0, r0_top=None, r1_top=None):
    """A block that follows a round wall: the solid between radii r0 and r1 (r*_top at y1, for a battered wall), from
    angle a0 to a1 (degrees, 90 = toward +z), y0 to y1. Built into the wall rather than set against it."""
    r0t, r1t = r0 if r0_top is None else r0_top, r1 if r1_top is None else r1_top
    full = abs(a1 - a0) >= 360
    count = steps if full else steps + 1
    verts, faces = [], []
    for k in range(count):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        c, sn = math.cos(a), math.sin(a)
        verts += [(centre[0] + c * r0, y0, centre[1] + sn * r0), (centre[0] + c * r1, y0, centre[1] + sn * r1), (centre[0] + c * r1t, y1, centre[1] + sn * r1t), (centre[0] + c * r0t, y1, centre[1] + sn * r0t)]
    for k in range(steps):
        i, j = 4 * k, 4 * ((k + 1) % count)
        for e in range(4):
            f = (e + 1) % 4
            faces.append([i + e, j + e, j + f, i + f])
    if not full:
        faces += [[0, 1, 2, 3], [4 * steps + 3, 4 * steps + 2, 4 * steps + 1, 4 * steps]]
    return mesh_from(name, verts, faces, mat, shade)


def arc(cx, cy, r, a0, a1, steps):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / steps)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * k / steps))) for k in range(steps + 1)]


def plot(name, cx):
    h = PLOT / 2
    plan_solid(f"{name}-plot", [(cx - h, -h), (cx + h, -h), (cx + h, h), (cx - h, h)], -0.25, 0.0, "turf")


# ---------------------------------------------------------------- 修船廠 repairyard: a hull on the slip
def repairyard(cx):
    n = "yard"
    plot(n, cx)
    # The slip stands open to the sky (the owner looks down on it from behind), the shed beside it.
    hx, sx = cx + 0.62, cx - 1.45
    # Stone slipway sloping down to the dock, with timber rails.
    slope = lambda z: 0.62 - (z + 2.1) * 0.125  # noqa: E731
    extrude_x(f"x-{n}-slip", [(-2.1, 0.0), (2.2, 0.0), (2.2, slope(2.2)), (-2.1, slope(-2.1))], hx - 1.25, hx + 1.25, "sandstone")
    for k, dx in enumerate((-0.75, 0.75)):
        beam(f"{n}-rail{k}", (hx + dx, slope(-2.0) + 0.07, -2.0), (hx + dx, slope(2.15) + 0.07, 2.15), 0.2, "woodDark", sides=4)
    # The hull under repair: planked aft half, bare ribs forward, on its cradle.
    # (z, half beam, depth): a narrow raised transom aft, full amidships, planked up to where the bare ribs begin.
    stations = [(-1.75, 0.34, 0.62), (-1.45, 0.52, 0.74), (-0.9, 0.72, 0.84), (-0.2, 0.8, 0.88), (0.45, 0.76, 0.86)]
    top = lambda z, depth: slope(z) + 0.42 + depth + (0.22 if z < -1.5 else 0.0)  # noqa: E731
    verts, faces = [], []
    seg = 8
    for z, half, depth in stations:
        for i in range(seg + 1):
            a = math.pi * i / seg
            verts.append((hx - math.cos(a) * half, top(z, depth) - math.sin(a) ** 0.8 * depth, z))
    row = seg + 1
    for k in range(len(stations) - 1):
        for i in range(seg):
            faces.append([k * row + i, k * row + i + 1, (k + 1) * row + i + 1, (k + 1) * row + i])
    faces.append(list(range(row)))
    faces.append(list(range((len(stations) - 1) * row, len(stations) * row)))
    for k in range(len(stations) - 1):
        faces.append([k * row, (k + 1) * row, (k + 1) * row + seg, k * row + seg])
    mesh_from(f"x-{n}-hull", verts, faces, "wood")
    # Deck planking set just inside the gunwales, a dark cap rail on each side, thwarts across.
    deck_v, deck_f = [], []
    for k, (z, half, depth) in enumerate(stations):
        deck_v += [(hx - half + 0.1, top(z, depth) + 0.02, z), (hx + half - 0.1, top(z, depth) + 0.02, z)]
        if k:
            deck_f.append([2 * k - 2, 2 * k - 1, 2 * k + 1, 2 * k])
    mesh_from(f"x-{n}-deck", deck_v, deck_f, "deck")
    for s in (-1, 1):
        for k in range(len(stations) - 1):
            (z0, h0, d0), (z1, h1, d1) = stations[k], stations[k + 1]
            beam(f"{n}-gunwale{s}{k}", (hx + s * h0, top(z0, d0) + 0.05, z0), (hx + s * h1, top(z1, d1) + 0.05, z1), 0.14, "woodDark", sides=4)
    for k, z in enumerate((-0.9, -0.2)):
        half, depth = next((h, d) for zz, h, d in stations if zz == z)
        beam(f"{n}-thwart{k}", (hx - half, top(z, depth) + 0.07, z), (hx + half, top(z, depth) + 0.07, z), 0.12, "plaster", sides=4)
    beam(f"{n}-sternpost", (hx, slope(-1.8) + 0.4, -1.8), (hx, top(-1.75, 0.62) + 0.3, -1.86), 0.18, "woodDark", sides=4)
    beam(f"{n}-keel", (hx, slope(-1.7) + 0.4, -1.7), (hx, slope(1.9) + 0.4, 1.9), 0.2, "woodDark", sides=4)
    beam(f"{n}-stem", (hx, slope(1.9) + 0.4, 1.9), (hx, slope(1.9) + 1.75, 2.25), 0.2, "woodDark", sides=4)
    for k, z in enumerate((0.75, 1.1, 1.45)):
        half, depth = 0.7 - k * 0.14, 0.84
        keel = slope(z) + 0.42
        pts = [(hx - math.cos(math.pi * i / 6) * half, keel + depth - math.sin(math.pi * i / 6) * depth, z) for i in range(7)]
        for i in range(6):
            beam(f"{n}-rib{k}-{i}", pts[i], pts[i + 1], 0.11, "plaster", sides=4)
    for k, z in enumerate((-1.2, 0.2)):
        box(f"{n}-cradle{k}", (hx, slope(z) + 0.3, z), (1.9, 0.26, 0.24), "woodDark", bevel=0.03)
        for s in (-1, 1):
            box(f"{n}-wedge{k}{s}", (hx + s * 1.08, slope(z) + 0.1, z), (0.26, 0.14, 0.22), "woodDark", bevel=0.02)
            beam(f"{n}-shore{k}{s}", (hx + s * 1.05, slope(z) + 0.1, z), (hx + s * 0.72, slope(z) + 1.05, z), 0.12, "wood", sides=4)
    # Trims: a pale stone curb down each edge of the slip, a dark wale along the hull, a ridge board on the shed.
    for s in (-1, 1):
        beam(f"{n}-curb{s}", (hx + s * 1.25, slope(-2.1) + 0.06, -2.1), (hx + s * 1.25, slope(2.2) + 0.06, 2.2), 0.22, "marble", sides=4)
        for k in range(len(stations) - 1):
            (z0, h0, d0), (z1, h1, d1) = stations[k], stations[k + 1]
            beam(f"{n}-wale{s}{k}", (hx + s * h0 * 0.93, top(z0, d0) - 0.45 * d0, z0), (hx + s * h1 * 0.93, top(z1, d1) - 0.45 * d1, z1), 0.12, "woodDark", sides=4)
    box(f"{n}-slip-foot", (hx, 0.06, 2.24), (2.72, 0.12, 0.2), "marble", bevel=0.03)
    # Sheerlegs: two raked spars lashed at the head, tackle and hook over the hull.
    head = (hx, 5.0, 0.55)
    for s in (-1, 1):
        beam(f"{n}-leg{s}", (hx + s * 1.55, 0.0, 1.5), head, 0.2, "wood", sides=6, taper=0.7)
        box(f"{n}-foot{s}", (hx + s * 1.55, 0.12, 1.5), (0.5, 0.24, 0.5), "stone", bevel=0.04)
    # The back stay runs to an iron ring on a stone anchor block; wedges hold the shores' feet.
    box(f"{n}-anchor", (hx, 0.1, -2.15), (0.4, 0.2, 0.3), "stone", bevel=0.03)
    lathe(f"{n}-anchor-ring", (hx, -2.15), [(0.1, 0.2), (0.1, 0.26)], "iron", sides=8)
    beam(f"{n}-stay", head, (hx, 0.0, -2.15), 0.06, "rope", sides=4)
    lathe(f"{n}-lash", (hx, 0.55), [(0.2, 4.72), (0.2, 4.98)], "rope", sides=8)
    beam(f"{n}-fall", (hx, 4.8, 0.6), (hx, 2.75, 0.6), 0.05, "rope", sides=4)
    box(f"{n}-block", (hx, 2.62, 0.6), (0.24, 0.32, 0.2), "brass", bevel=0.04)
    beam(f"{n}-hook", (hx, 2.46, 0.6), (hx, 2.18, 0.6), 0.09, "iron", sides=6, taper=0.4)
    # The shipwrights' shed beside the slip: timber posts, an arched roof with a dark rim, open at both ends.
    r = 0.78
    extrude_z(f"x-{n}-roof", arc(sx, 1.55, r, 0, 180, 8) + arc(sx, 1.55, r - 0.16, 180, 0, 8), -2.1, 0.5, "roofRed")
    for k, z in enumerate((-2.16, 0.46)):
        extrude_z(f"x-{n}-rim{k}", arc(sx, 1.55, r + 0.1, 0, 180, 8) + arc(sx, 1.55, r - 0.12, 180, 0, 8), z, z + 0.1, "woodDark")
    for s in (-1, 1):
        for k, z in enumerate((-2.0, -0.8, 0.4)):
            box(f"{n}-pad{s}{k}", (sx + s * (r - 0.08), 0.06, z), (0.3, 0.12, 0.3), "stone", bevel=0.03)
            beam(f"{n}-post{s}{k}", (sx + s * (r - 0.08), 0.0, z), (sx + s * (r - 0.08), 1.62, z), 0.16, "woodDark", sides=4)
        beam(f"{n}-plate{s}", (sx + s * (r - 0.08), 1.58, -2.1), (sx + s * (r - 0.08), 1.58, 0.5), 0.16, "wood", sides=4)
    beam(f"{n}-ridge", (sx, 1.55 + r + 0.03, -2.18), (sx, 1.55 + r + 0.03, 0.58), 0.14, "woodDark", sides=4)
    for s in (-1, 1):
        beam(f"{n}-eave{s}", (sx + s * (r + 0.02), 1.56, -2.18), (sx + s * (r + 0.02), 1.56, 0.58), 0.12, "plaster", sides=4)
    box(f"{n}-bench", (sx, 0.42, -1.3), (0.9, 0.12, 1.2), "wood", bevel=0.03)
    for k, z in enumerate((-1.8, -0.8)):
        beam(f"{n}-leg-b{k}", (sx, 0.0, z), (sx, 0.4, z), 0.1, "woodDark", sides=4)
    for k in range(3):
        beam(f"{n}-plank{k}", (sx - 0.25 + 0.25 * k, 0.1, 0.75), (sx - 0.25 + 0.25 * k, 0.1 + 0.05 * k, 2.1), 0.2, "wood" if k % 2 else "plaster", sides=4)
    barrel(f"{n}-tar", (sx, 0.0, -0.1), "woodDark")
    lathe(f"{n}-pitch", (sx, 0.2), [(0.24, 0.6), (0.24, 0.66)], "dark", sides=10)
    # A furled sailcloth and the spare anchor at the head of the slip, toward the owner.
    beam(f"{n}-spar", (hx - 1.0, 0.75, -2.15), (hx + 1.0, 0.75, -2.15), 0.14, "woodDark", sides=6)
    beam(f"{n}-canvas", (hx - 0.8, 0.62, -2.15), (hx + 0.8, 0.62, -2.15), 0.3, "canvas", sides=6)
    for s in (-1, 1):
        beam(f"{n}-trestle{s}", (hx + s * 0.9, 0.0, -2.15), (hx + s * 0.9, 0.78, -2.15), 0.12, "wood", sides=4)


# ---------------------------------------------------------------- 軍械庫 armory: a gun tower
def armory(cx):
    n = "arm"
    plot(n, cx)
    cz = -0.35
    wall = lambda y: 1.86 - (y - 0.4) * 0.148  # noqa: E731  the battered wall's radius at height y
    lathe(f"{n}-plinth", (cx, cz), [(2.02, 0.0), (2.02, 0.32), (1.9, 0.42)], "basalt", sides=32)
    lathe(f"x-{n}-tower", (cx, cz), [(1.86, 0.4), (1.52, 2.7), (1.7, 2.82), (1.7, 3.02), (1.6, 3.02)], "stone", sides=32)
    lathe(f"{n}-band", (cx, cz), [(1.74, 1.5), (1.74, 1.62)], "marble", sides=32)
    lathe(f"{n}-deck", (cx, cz), [(1.5, 3.0), (1.5, 3.08)], "slate", sides=32)
    # Trims: a pale cornice under the parapet and a pale rim round the gun deck.
    lathe(f"{n}-cornice", (cx, cz), [(1.74, 2.84), (1.74, 3.0)], "marble", sides=32)
    lathe(f"{n}-plinth-cap", (cx, cz), [(1.95, 0.38), (1.95, 0.46)], "marble", sides=32)
    # Parapet: one continuous wall standing on the cornice; the merlons are the same wall carried higher (same face,
    # same thickness), each with a pale cap; the embrasure at 110 degrees is where the gun looks out.
    arc_block(f"x-{n}-parapet", (cx, cz), 1.44, 1.7, 0, 360, 3.0, 3.3, "stone", steps=32)
    for k in range(8):
        mid = 110 + 22.5 + 45 * k
        arc_block(f"x-{n}-merlon{k}", (cx, cz), 1.44, 1.7, mid - 12, mid + 12, 3.3, 3.64, "stone", steps=3)
        arc_block(f"x-{n}-cap{k}", (cx, cz), 1.4, 1.74, mid - 13.5, mid + 13.5, 3.64, 3.74, "marble", steps=3)
        arc_block(f"x-{n}-sill{k}", (cx, cz), 1.42, 1.72, mid + 12, mid + 33, 3.3, 3.35, "marble", steps=3)
    # The gun: a long bronze barrel on a timber carriage, aimed out over the dock.
    aim = math.radians(200)  # toward the dock once the tower is turned round (flip_z below)
    dx, dz = math.sin(aim), math.cos(aim)
    breech = (cx - dx * 0.75, 3.62, cz - dz * 0.75)
    muzzle = (cx + dx * 1.75, 4.02, cz + dz * 1.75)
    beam(f"{n}-gun", breech, muzzle, 0.5, "brass", sides=10, taper=0.62)
    at = lambda t: tuple(breech[i] + (muzzle[i] - breech[i]) * t for i in range(3))  # noqa: E731
    beam(f"{n}-gun-lip", at(0.94), at(1.0), 0.44, "gold", sides=10)
    beam(f"{n}-gun-ring", at(0.3), at(0.36), 0.56, "gold", sides=10)
    ball(f"{n}-gun-knob", at(-0.08), 0.17, "gold")
    arc_block(f"x-{n}-traverse", (cx, cz), 0.95, 1.12, 0, 360, 3.08, 3.14, "woodDark", steps=20)
    box(f"{n}-carriage", (cx + dx * 0.1, 3.36, cz + dz * 0.1), (0.7, 0.34, 1.5), "woodDark", bevel=0.05, yaw=aim)
    for s in (-1, 1):
        for k, t in enumerate((-0.45, 0.55)):
            wx, wz = cx + dx * t + dz * s * 0.44, cz + dz * t - dx * s * 0.44
            beam(f"{n}-wheel{s}{k}", (wx - dz * 0.06, 3.3, wz + dx * 0.06), (wx + dz * 0.06, 3.3, wz - dx * 0.06), 0.46, "wood", sides=10)
    # Gatehouse: a porch with an arched iron-bound door, lamps either side.
    gz = cz + 1.75
    box(f"{n}-porch", (cx, 0.95, gz + 0.3), (1.5, 1.5, 0.9), "stone", bevel=0.05)
    extrude_z(f"{n}-pediment", [(cx - 0.95, 1.7), (cx + 0.95, 1.7), (cx, 2.35)], gz - 0.2, gz + 0.86, "roofRed")
    extrude_z(f"x-{n}-arch", [(cx - 0.52, 0.2), (cx + 0.52, 0.2)] + arc(cx, 1.0, 0.52, 0, 180, 6), gz + 0.72, gz + 0.8, "marble")
    extrude_z(f"x-{n}-door", [(cx - 0.4, 0.2), (cx + 0.4, 0.2)] + arc(cx, 1.0, 0.4, 0, 180, 6), gz + 0.76, gz + 0.84, "woodDark")
    for k, y in enumerate((0.55, 1.0)):
        box(f"{n}-strap{k}", (cx, y, gz + 0.85), (0.8, 0.09, 0.04), "iron", bevel=0.0)
    arc_block(f"x-{n}-neck", (cx, cz), 1.5, 2.0, 62, 118, 0.3, 1.72, "stone", steps=4)
    for s in (-1, 1):
        box(f"{n}-lamp-arm{s}", (cx + s * 0.66, 1.46, gz + 0.8), (0.08, 0.08, 0.2), "iron", bevel=0.0)
        box(f"{n}-lamp{s}", (cx + s * 0.66, 1.3, gz + 0.82), (0.16, 0.24, 0.14), "flame", bevel=0.03)
    # Gatehouse trims: a dark footing, pale corner stones, pale verges along the pediment.
    box(f"{n}-porch-foot", (cx, 0.13, gz + 0.32), (1.66, 0.26, 1.02), "basalt", bevel=0.04)
    for s in (-1, 1):
        for k in range(3):
            box(f"{n}-porch-quoin{s}{k}", (cx + s * 0.75, 0.5 + k * 0.45, gz + 0.74), (0.2, 0.24, 0.16), "marble", bevel=0.03)
        beam(f"{n}-verge{s}", (cx + s * 1.0, 1.68, gz + 0.88), (cx, 2.4, gz + 0.88), 0.13, "marble", sides=4)
    beam(f"{n}-porch-ridge", (cx, 2.38, gz - 0.2), (cx, 2.38, gz + 0.9), 0.12, "marble", sides=4)
    # A lookout turret corbelled off the wall, with a pointed cap and the owner's pennant.
    tx, tz = cx - 1.5, cz - 0.55
    lathe(f"{n}-corbel", (tx, tz), [(0.2, 2.0), (0.52, 2.6)], "stone", sides=10)
    lathe(f"{n}-turret", (tx, tz), [(0.52, 2.6), (0.52, 3.9)], "stone", sides=10)
    lathe(f"{n}-turret-rim", (tx, tz), [(0.6, 3.86), (0.6, 3.98)], "marble", sides=10)
    lathe(f"{n}-turret-cap", (tx, tz), [(0.68, 3.96), (0.04, 5.0)], "roofRed", sides=10)
    lathe(f"{n}-turret-foot", (tx, tz), [(0.57, 2.56), (0.57, 2.68)], "marble", sides=10)
    beam(f"{n}-pole", (tx, 4.9, tz), (tx, 5.55, tz), 0.06, "woodDark", sides=4)
    extrude_z(f"{n}-pennant", [(tx, 5.5), (tx + 0.75, 5.33), (tx, 5.16)], tz - 0.02, tz + 0.02, "pennant")
    arc_block(f"x-{n}-slit-frame", (tx, tz), 0.46, 0.57, 168, 192, 2.95, 3.6, "marble", steps=2)
    arc_block(f"x-{n}-slit", (tx, tz), 0.46, 0.59, 175, 185, 3.02, 3.53, "dark", steps=1)
    for k, a in enumerate((20, 160, 235, 305)):
        arc_block(f"x-{n}-loop-frame{k}", (cx, cz), wall(1.75) - 0.1, wall(1.75) + 0.05, a - 4.5, a + 4.5, 1.75, 2.4, "marble", steps=1, r0_top=wall(2.4) - 0.1, r1_top=wall(2.4) + 0.05)
        arc_block(f"x-{n}-loop{k}", (cx, cz), wall(1.82) - 0.1, wall(1.82) + 0.07, a - 1.8, a + 1.8, 1.82, 2.33, "dark", steps=1, r0_top=wall(2.33) - 0.1, r1_top=wall(2.33) + 0.07)
    # Shot and powder by the gate.
    sx, sz = cx + 1.55, cz + 2.0
    for row, (count, y) in enumerate(((3, 0.17), (2, 0.44), (1, 0.71))):
        for i in range(count):
            for j in range(count):
                ball(f"{n}-shot{row}{i}{j}", (sx + (i - (count - 1) / 2) * 0.34, y, sz + (j - (count - 1) / 2) * 0.34), 0.17, "iron")
    barrel(f"{n}-powder0", (cx - 1.45, 0.0, cz + 2.2), "wood")
    barrel(f"{n}-powder1", (cx - 1.95, 0.0, cz + 1.75), "wood")
    barrel(f"{n}-powder2", (cx - 1.6, 0.62, cz + 1.95), "wood", r=0.26, h=0.5)


# ---------------------------------------------------------------- 商行 tradehouse: a bell-gabled merchant's house
def tradehouse(cx):
    n = "trade"
    plot(n, cx)
    w, d, wall = 1.5, 1.45, 2.7
    box(f"{n}-plinth", (cx, 0.16, -0.4), (2 * w + 0.24, 0.32, 2 * d + 0.24), "stone", bevel=0.05)
    box(f"{n}-body", (cx, 0.3 + wall / 2, -0.4), (2 * w, wall, 2 * d), "plaster", bevel=0.05)
    for s in (-1, 1):
        for k in range(4):
            box(f"{n}-quoin{s}{k}", (cx + s * w, 0.6 + k * 0.62, -0.4 + d), (0.26, 0.3, 0.2), "marble", bevel=0.03)
    box(f"{n}-string", (cx, 0.3 + wall, -0.4), (2 * w + 0.16, 0.14, 2 * d + 0.16), "marble", bevel=0.03)
    # Bell gables front and back (the curve is the house's silhouette), each with a light coping standing proud.
    base = 0.3 + wall + 0.07
    half = [(w, base), (w, base + 0.35), (w - 0.28, base + 0.5), (w - 0.42, base + 0.95), (w - 0.72, base + 1.3), (w - 1.0, base + 1.42), (w - 1.12, base + 1.85), (w - 1.3, base + 2.05)]
    outline = [(cx + x, y) for x, y in half] + [(cx - x, y) for x, y in reversed(half)]
    grown = [(cx + (x - cx) * 1.07, base + (y - base) * 1.05) for x, y in outline]
    for k, z in enumerate((-0.4 + d - 0.22, -0.4 - d)):
        extrude_z(f"x-{n}-gable{k}", outline, z, z + 0.22, "plaster")
        extrude_z(f"x-{n}-coping{k}", grown + list(reversed(outline)), z - 0.04, z + 0.26, "marble")
    extrude_z(f"{n}-roof", [(cx - w - 0.12, base), (cx + w + 0.12, base), (cx, base + 1.72)], -0.4 - d + 0.2, -0.4 + d - 0.2, "roofBlue")
    for s in (-1, 1):
        lathe(f"x-{n}-chimney{s}", (cx + s * 0.75, -0.9), [(0.2, base + 0.5), (0.2, base + 1.55), (0.27, base + 1.6), (0.27, base + 1.72)], "stone", sides=6)
        # Each chimney stands in a pale collar where it comes through the roof.
        lathe(f"{n}-chimney-collar{s}", (cx + s * 0.75, -0.9), [(0.3, base + 0.62), (0.26, base + 0.86)], "marble", sides=6)
    # The gables stand on kneeler stones at their feet, and the finial on a small pedestal on the peak.
    for z in (-0.4 + d - 0.11, -0.4 - d + 0.11):
        for s in (-1, 1):
            box(f"{n}-kneeler{s}{z:.2f}", (cx + s * (w + 0.06), base + 0.1, z), (0.34, 0.3, 0.34), "marble", bevel=0.04)
    box(f"{n}-finial-seat", (cx, base + 2.08, -0.4 + d - 0.11), (0.3, 0.14, 0.3), "marble", bevel=0.03)
    ball(f"{n}-finial", (cx, base + 2.28, -0.4 + d - 0.11), 0.16, "gold")
    # Trims: corner stones at the back corners too, a pale ridge, dark eaves boards, framed windows on both flanks.
    for s in (-1, 1):
        for k in range(4):
            box(f"{n}-quoin-b{s}{k}", (cx + s * w, 0.6 + k * 0.62, -0.4 - d), (0.26, 0.3, 0.2), "marble", bevel=0.03)
        beam(f"{n}-eaves{s}", (cx + s * (w + 0.14), base + 0.03, -0.4 - d + 0.2), (cx + s * (w + 0.14), base + 0.03, -0.4 + d - 0.2), 0.14, "woodDark", sides=4)
        for k, z in enumerate((-1.0, 0.2)):
            box(f"{n}-flank-frame{s}{k}", (cx + s * w, 2.3, z), (0.08, 0.66, 0.56), "marble", bevel=0.02)
            box(f"{n}-flank-win{s}{k}", (cx + s * (w + 0.03), 2.3, z), (0.06, 0.5, 0.4), "dark", bevel=0.0)
            box(f"{n}-flank-sill{s}{k}", (cx + s * (w + 0.06), 1.95, z), (0.16, 0.08, 0.66), "marble", bevel=0.02)
        box(f"{n}-flank-shutter{s}", (cx + s * (w + 0.02), 1.1, -0.4), (0.08, 0.9, 0.7), "roofBlue", bevel=0.02)
        box(f"{n}-flank-shutter-frame{s}", (cx + s * w, 1.1, -0.4), (0.08, 1.06, 0.86), "marble", bevel=0.02)
    beam(f"{n}-ridge", (cx, base + 1.74, -0.4 - d + 0.2), (cx, base + 1.74, -0.4 + d - 0.2), 0.16, "marble", sides=4)
    # Hoist beam at the gable's head with a crate on the hook: what a merchant's house is for.
    fz = -0.4 + d
    # The hoist beam comes out through a pale stone seat in the gable, with a brass sheave at its end.
    box(f"{n}-hoist-seat", (cx, base + 1.5, fz + 0.02), (0.34, 0.34, 0.14), "marble", bevel=0.03)
    box(f"{n}-hoist-sheave", (cx, base + 1.42, fz + 0.8), (0.14, 0.2, 0.2), "brass", bevel=0.03)
    beam(f"{n}-hoist", (cx, base + 1.5, fz - 0.3), (cx, base + 1.5, fz + 0.95), 0.16, "woodDark", sides=4)
    beam(f"{n}-hoist-brace", (cx, base + 0.95, fz + 0.02), (cx, base + 1.45, fz + 0.7), 0.1, "woodDark", sides=4)
    beam(f"{n}-hoist-rope", (cx, base + 1.45, fz + 0.8), (cx, 2.5, fz + 0.8), 0.05, "rope", sides=4)
    box(f"{n}-hoist-crate", (cx, 2.22, fz + 0.8), (0.52, 0.52, 0.52), "wood", bevel=0.04, yaw=0.5)
    box(f"{n}-hoist-strap", (cx, 2.22, fz + 0.8), (0.56, 0.12, 0.56), "woodDark", bevel=0.0, yaw=0.5)
    box(f"{n}-loft-door", (cx, base + 0.62, fz + 0.01), (0.56, 0.8, 0.08), "woodDark", bevel=0.02)
    box(f"{n}-loft-frame", (cx, base + 0.62, fz - 0.01), (0.74, 0.98, 0.08), "marble", bevel=0.02)
    # Shop front: an arched door, two windows, a striped awning over the counter.
    extrude_z(f"x-{n}-door-arch", [(cx - 0.5, 0.32), (cx + 0.5, 0.32)] + arc(cx, 1.3, 0.5, 0, 180, 6), fz, fz + 0.07, "marble")
    extrude_z(f"x-{n}-door", [(cx - 0.38, 0.32), (cx + 0.38, 0.32)] + arc(cx, 1.3, 0.38, 0, 180, 6), fz + 0.03, fz + 0.1, "roofBlue")
    for s in (-1, 1):
        box(f"{n}-win-frame{s}", (cx + s * 1.0, 2.35, fz + 0.02), (0.56, 0.66, 0.08), "marble", bevel=0.02)
        box(f"{n}-win{s}", (cx + s * 1.0, 2.35, fz + 0.05), (0.4, 0.5, 0.06), "dark", bevel=0.0)
        box(f"{n}-sill{s}", (cx + s * 1.0, 2.0, fz + 0.08), (0.66, 0.08, 0.16), "marble", bevel=0.02)
    for k in range(6):
        x0 = cx - w - 0.1 + k * (2 * w + 0.2) / 6
        x1 = x0 + (2 * w + 0.2) / 6
        mesh_from(f"x-{n}-awning{k}", [(x0, 1.95, fz + 0.02), (x1, 1.95, fz + 0.02), (x1, 1.5, fz + 1.05), (x0, 1.5, fz + 1.05), (x0, 1.89, fz + 0.02), (x1, 1.89, fz + 0.02), (x1, 1.44, fz + 1.05), (x0, 1.44, fz + 1.05)], [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], "roofGold" if k % 2 == 0 else "canvas")
    # The awning hangs from a ledger fixed to the wall; its poles stand on stone pads.
    beam(f"{n}-awning-ledger", (cx - w - 0.1, 1.98, fz + 0.06), (cx + w + 0.1, 1.98, fz + 0.06), 0.12, "woodDark", sides=4)
    for s in (-1, 1):
        box(f"{n}-awning-pad{s}", (cx + s * (w + 0.02), 0.07, fz + 1.0), (0.26, 0.14, 0.26), "stone", bevel=0.03)
        beam(f"{n}-awning-pole{s}", (cx + s * (w + 0.02), 0.0, fz + 1.0), (cx + s * (w + 0.02), 1.48, fz + 1.0), 0.09, "woodDark", sides=4)
    beam(f"{n}-valance", (cx - w - 0.12, 1.45, fz + 1.06), (cx + w + 0.12, 1.45, fz + 1.06), 0.1, "woodDark", sides=4)
    # Goods out front: crates, spice sacks, cloth, and the scales on the counter.
    box(f"{n}-counter", (cx + 0.95, 0.38, fz + 0.75), (0.95, 0.76, 0.5), "wood", bevel=0.04)
    box(f"{n}-counter-top", (cx + 0.95, 0.79, fz + 0.75), (1.07, 0.08, 0.62), "woodDark", bevel=0.02)
    beam(f"{n}-scale-post", (cx + 0.95, 0.83, fz + 0.75), (cx + 0.95, 1.3, fz + 0.75), 0.06, "brass", sides=6)
    beam(f"{n}-scale-arm", (cx + 0.62, 1.27, fz + 0.75), (cx + 1.28, 1.27, fz + 0.75), 0.05, "brass", sides=4)
    for s in (-1, 1):
        lathe(f"{n}-scale-pan{s}", (cx + 0.95 + s * 0.3, fz + 0.75), [(0.05, 1.0), (0.17, 1.06)], "gold", sides=10)
    for k, (dx, mat) in enumerate(((-1.15, "spiceOrange"), (-0.72, "spiceYellow"), (-0.95, "mace"))):
        z = fz + (0.8 if k < 2 else 1.2)
        lathe(f"{n}-sack{k}", (cx + dx, z), [(0.2, 0.0), (0.27, 0.2), (0.22, 0.42), (0.1, 0.5)], "canvas", sides=8)
        lathe(f"{n}-spice{k}", (cx + dx, z), [(0.2, 0.44), (0.03, 0.6)], mat, sides=8)
    box(f"{n}-crate0", (cx + 1.95, 0.3, -0.2), (0.6, 0.6, 0.6), "wood", bevel=0.04)
    box(f"{n}-crate1", (cx + 1.95, 0.3, 0.5), (0.6, 0.6, 0.6), "wood", bevel=0.04, yaw=0.3)
    box(f"{n}-crate2", (cx + 1.95, 0.85, 0.15), (0.5, 0.5, 0.5), "plaster", bevel=0.04, yaw=-0.2)
    barrel(f"{n}-cask0", (cx - 1.95, 0.0, -0.1), "wood")
    barrel(f"{n}-cask1", (cx - 1.95, 0.0, 0.6), "wood")
    # Hanging sign: a gold coin on an iron bracket at the corner.
    box(f"{n}-bracket-plate", (cx - w - 0.03, 2.62, fz + 0.05), (0.06, 0.5, 0.2), "iron", bevel=0.0)
    beam(f"{n}-bracket-stay", (cx - w, 2.42, fz + 0.05), (cx - w - 0.55, 2.74, fz + 0.05), 0.05, "iron", sides=4)
    for dx in (-0.36, -0.64):
        beam(f"{n}-sign-chain{dx}", (cx - w + dx, 2.74, fz + 0.05), (cx - w + dx, 2.56, fz + 0.05), 0.04, "iron", sides=4)
    beam(f"{n}-bracket", (cx - w, 2.75, fz + 0.05), (cx - w - 0.75, 2.75, fz + 0.05), 0.07, "iron", sides=4)
    beam(f"{n}-sign", (cx - w - 0.5, 2.3, fz), (cx - w - 0.5, 2.3, fz + 0.1), 0.6, "gold", sides=12)
    beam(f"{n}-sign-rim", (cx - w - 0.5, 2.3, fz - 0.02), (cx - w - 0.5, 2.3, fz + 0.01), 0.7, "woodDark", sides=12)


def flip_z(prefix, cx):
    """Turn a finished building round on its plot (front to back): the owner sees a building from behind (the dock
    faces the middle of the table), so what tells the building apart has to face that way."""
    for ob, _, _ in PARTS:
        if not ob.name.replace("x-", "").startswith(prefix):
            continue
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for v in bm.verts:
            v.co.y = -v.co.y
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()


def dock_side(cx):
    """What the dock side shows once the tower and the house are turned round: the armory's sally port and the
    tradehouse's cargo doors with a second hoist."""
    c = (cx, 0.35)
    wall = lambda y: 1.86 - (y - 0.4) * 0.148  # noqa: E731
    # Sally port: a stone surround standing proud of the wall from the plinth up, an arched head, the door set back in it.
    arc_block("x-arm-port-frame", c, 1.6, 2.0, 76, 104, 0.3, 1.5, "marble", steps=3)
    arc_block("x-arm-port-head", c, 1.6, 2.04, 74, 106, 1.5, 1.64, "marble", steps=3)
    arc_block("x-arm-port", c, 1.95, 2.05, 81, 99, 0.3, 1.4, "woodDark", steps=3)
    for k, y in enumerate((0.62, 1.1)):
        arc_block(f"x-arm-port-strap{k}", c, 2.03, 2.08, 81, 99, y - 0.04, y + 0.04, "iron", steps=3)
    arc_block("x-arm-port-step", c, 1.9, 2.25, 78, 102, 0.0, 0.3, "basalt", steps=3)
    # Gun ports: a casemate bay that follows the wall, with a hood above and a sill below; the gun looks out along the
    # tower's radius through the dark opening.
    for k, a in enumerate((52, 128)):
        r = wall(2.05)
        arc_block(f"x-arm-bay{k}", c, r - 0.2, r + 0.16, a - 11, a + 11, 1.78, 2.36, "stone", steps=3)
        arc_block(f"x-arm-bay-hood{k}", c, r - 0.2, r + 0.24, a - 13, a + 13, 2.36, 2.46, "marble", steps=3)
        arc_block(f"x-arm-bay-sill{k}", c, r - 0.2, r + 0.24, a - 13, a + 13, 1.68, 1.78, "marble", steps=3)
        arc_block(f"x-arm-bay-hole{k}", c, r - 0.2, r + 0.18, a - 6, a + 6, 1.88, 2.26, "dark", steps=2)
        ra = math.radians(a)
        at = lambda d: (cx + math.cos(ra) * d, 2.06, 0.35 + math.sin(ra) * d)  # noqa: E731
        beam(f"arm-wallgun{k}", at(r - 0.1), at(r + 0.62), 0.22, "brass", sides=8, taper=0.8)
        beam(f"arm-wallgun-lip{k}", at(r + 0.56), at(r + 0.64), 0.24, "gold", sides=8)
    # The banner hangs plumb from a rod on two iron brackets under the cornice, clear of the leaning wall.
    for sx in (-0.36, 0.36):
        beam(f"arm-banner-arm{sx}", (cx + sx, 2.74, 0.35 + 1.5), (cx + sx, 2.74, 0.35 + 1.86), 0.06, "iron", sides=4)
    beam("arm-banner-rod", (cx - 0.42, 2.74, 0.35 + 1.84), (cx + 0.42, 2.74, 0.35 + 1.84), 0.07, "woodDark", sides=6)
    extrude_z("arm-banner", [(cx - 0.3, 2.72), (cx + 0.3, 2.72), (cx + 0.3, 1.95), (cx, 1.8), (cx - 0.3, 1.95)], 0.35 + 1.82, 0.35 + 1.86, "pennant")
    tx, fz, base = cx + GAP, 1.85, 3.07
    box("trade-cargo-frame", (tx, 1.15, fz + 0.02), (1.6, 1.7, 0.08), "marble", bevel=0.02)
    box("trade-cargo-step", (tx, 0.1, fz + 0.3), (1.8, 0.2, 0.5), "stone", bevel=0.04)
    for s in (-1, 1):
        for k, y in enumerate((0.75, 1.5)):
            box(f"trade-cargo-hinge{s}{k}", (tx + s * 0.58, y, fz + 0.1), (0.3, 0.07, 0.03), "iron", bevel=0.0)
    for s in (-1, 1):
        box(f"trade-cargo-door{s}", (tx + s * 0.36, 1.12, fz + 0.06), (0.68, 1.5, 0.06), "woodDark", bevel=0.02)
    beam("trade-hoist2", (tx, base + 1.5, fz - 0.3), (tx, base + 1.5, fz + 0.95), 0.16, "woodDark", sides=4)
    box("trade-hoist2-seat", (tx, base + 1.5, fz + 0.02), (0.34, 0.34, 0.14), "marble", bevel=0.03)
    beam("trade-hoist2-brace", (tx, base + 0.95, fz + 0.02), (tx, base + 1.45, fz + 0.7), 0.1, "woodDark", sides=4)
    box("trade-hoist2-sheave", (tx, base + 1.42, fz + 0.8), (0.14, 0.2, 0.2), "brass", bevel=0.03)
    beam("trade-hoist2-rope", (tx, base + 1.45, fz + 0.8), (tx, 3.4, fz + 0.8), 0.05, "rope", sides=4)
    box("trade-hoist2-hook", (tx, 3.3, fz + 0.8), (0.14, 0.24, 0.14), "iron", bevel=0.03)
    box("trade-loft2-frame", (tx, base + 0.62, fz - 0.01), (0.74, 0.98, 0.08), "marble", bevel=0.02)
    box("trade-loft2-door", (tx, base + 0.62, fz + 0.01), (0.56, 0.8, 0.08), "woodDark", bevel=0.02)
    box("trade-dock-crate0", (tx - 1.0, 0.3, fz + 0.5), (0.6, 0.6, 0.6), "wood", bevel=0.04, yaw=0.2)
    box("trade-dock-crate1", (tx + 1.05, 0.3, fz + 0.45), (0.6, 0.6, 0.6), "plaster", bevel=0.04, yaw=-0.3)


GAP = 6.2


def build_all():
    repairyard(-GAP)
    armory(0.0)
    tradehouse(GAP)
    flip_z("arm", 0.0)
    flip_z("trade", GAP)
    dock_side(0.0)


def render_sheet():
    build_all()
    check_normals(skip=("x-",))
    colour_parts()
    tris = sum(len(p.vertices) - 2 for ob in kit.SCENE.objects if ob.type == "MESH" for p in ob.data.polygons)
    print(f"FACILITIES ~{tris} triangles for three buildings")
    setup_render()
    kit.SCENE.render.line_thickness = 1.0


    def orbit(name, azimuth, elevation, target, scale, res=(1600, 900), dist=60):
        a, e = math.radians(azimuth), math.radians(elevation)
        t = Vector(target)
        d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * dist
        return camera(name, V(*(t + d)), V(*t), scale, res)


    VIEWS = {
        # The game's table camera looks down at about 54 degrees.
        "table": orbit("cam-table", 0, 54, (0, 1.6, 0), 19.5, res=(1800, 760)),
        # Your own island sits at the bottom of the table with its dock toward the middle: the camera sees its buildings from behind.
        "own": orbit("cam-own", 180, 54, (0, 1.6, 0), 19.5, res=(1800, 760)),
        # The islands to your left and right show their buildings side on.
        "side-yard": orbit("cam-side-yard", 90, 54, (-GAP, 1.6, 0), 8.2, res=(600, 760)),
        "side-arm": orbit("cam-side-arm", 90, 54, (0, 1.6, 0), 8.2, res=(600, 760)),
        "side-trade": orbit("cam-side-trade", 90, 54, (GAP, 1.6, 0), 8.2, res=(600, 760)),
        "front": orbit("cam-front", 22, 16, (0, 2.5, 0), 19.5, res=(1800, 760)),
        "back": orbit("cam-back", 200, 20, (0, 2.5, 0), 19.5, res=(1800, 760)),
        "yard": orbit("cam-yard", 35, 24, (-GAP, 2.3, 0), 8.2, res=(1100, 1000)),
        "armory": orbit("cam-armory", 35, 24, (0, 2.6, 0), 8.2, res=(1100, 1000)),
        "trade": orbit("cam-trade", 35, 24, (GAP, 2.6, 0), 8.2, res=(1100, 1000)),
    }
    OUT = out_dir()
    for name, (cam, (w, h)) in VIEWS.items():
        kit.SCENE.camera = cam
        # A side view shows its building alone (the other two stand in the line of sight).
        only = name.split("-")[1] if name.startswith("side-") else None
        for ob in kit.SCENE.objects:
            if ob.type == "MESH":
                ob.hide_render = only is not None and not ob.name.replace("x-", "").startswith(only)
        kit.SCENE.render.resolution_x, kit.SCENE.render.resolution_y = w, h
        kit.SCENE.render.filepath = os.path.join(OUT, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDERED", OUT)


if __name__ == "__main__":
    render_sheet()
