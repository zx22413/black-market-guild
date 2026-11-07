"""Shared terrain parts for the island bases built in Blender (scripts/blender/island_<id>.py, one module per island),
used by scripts/blender/blockout-island.py (design sheets) and scripts/blender/build-island.py (the game's models).

Island space as in the game (three.js: y up, +z toward the dock). The plateau group of `PlayerIsland` stands at
PLATEAU = 2.6 and the turf's top is TURF = 2.85, where the asset buildings and scenery stand; the sea rests at
SEA = -0.3 and a base reaches down to -3 so the troughs of the tallest waves never uncover it.

Every part is tagged `after` (the blockout's "new shape" layer). Plans are lists of (x, z).
"""

import math

from blockout_kit import *  # noqa: F401,F403
import blockout_kit as kit

TURF = 2.85
PLATEAU = 2.6
SEA = -0.3
FOOT = -3.0

# Colours the game draws only on the bases (not in src/ui/scene/buildings/materials.ts).
kit.SWATCHES.update(
    {
        "colCap": ("#9ea3bd", "#7c8099"),
        "sea": ("#5fb3ad", "#4a9e99"),
        "foam": ("#f6f6ef", "#e4e6df"),
        "path": ("#a99ab0", "#8f8098"),
    }
)


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


def boulder(name, x, y, z, r):
    """A rounded shingle boulder: a squat seven-sided lump, wider than tall."""
    ob = prism(name, (x, y, z), r, r * 0.55, "basalt", sides=7, top=0.7)
    ob["after"] = True
    c = prism(f"{name}-top", (x, y + r * 0.55, z), r * 0.7, r * 0.18, "colCap", sides=7, top=0.6)
    c["after"] = True




def surface(name, rings, mat, shade=1.0, face_up=True, closed=True):
    """An open surface lofted through rings of (x, y, z) points (equal counts), each face turned to face up (or out);
    `closed=False` for strips that do not wrap round."""
    verts = [p for ring in rings for p in ring]
    n = len(rings[0])
    faces = []
    for r in range(len(rings) - 1):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            faces.append([r * n + i, r * n + j, (r + 1) * n + j, (r + 1) * n + i])
    bm = kit.bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in verts]
    for f in faces:
        face = bm.faces.new([vs[k] for k in f])
        face.normal_update()
        c = face.calc_center_median()
        if (face.normal.z < 0) if face_up else (face.normal.x * c.x + face.normal.y * c.y < 0):
            face.normal_flip()
    ob = kit.finish(bm, name, mat, shade)
    ob["after"] = True
    return ob


def radial(plan, center, d):
    """Each point of a plan moved d away from `center` (negative: toward it); the plans here are star-shaped about it."""
    out = []
    for x, z in plan:
        dx, dz = x - center[0], z - center[1]
        ln = math.hypot(dx, dz) or 1
        out.append((x + dx / ln * d, z + dz / ln * d))
    return out



def resample(plan, n):
    """`n` points evenly spaced round a closed plan."""
    lens = [math.hypot(plan[(i + 1) % len(plan)][0] - x, plan[(i + 1) % len(plan)][1] - z) for i, (x, z) in enumerate(plan)]
    total = sum(lens)
    out, i, acc = [], 0, 0.0
    for k in range(n):
        target = total * k / n
        while acc + lens[i] < target:
            acc += lens[i]
            i += 1
        t = (target - acc) / lens[i]
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % len(plan)]
        out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    return out


def radial_terrain(prefix, plan, height, colour, center=(0.0, 0.0), rings=24, around=96):
    """Designed ground over a star-shaped plan: a grid of rings from `center` out to the plan (resampled to `around`
    points), each vertex at `height(x, z, t)` (t: 0 at the centre, 1 on the plan), each face flat-shaded in the swatch
    `colour(x, z, y, slope)` picks. One object per swatch; returns the outer ring's points (x, y, z) for the cliff."""
    edge = resample(plan, around) if around else list(plan)
    around = len(edge)
    grid = []
    for r in range(rings + 1):
        t = r / rings
        ring = []
        for x, z in edge:
            px, pz = center[0] + (x - center[0]) * t, center[1] + (z - center[1]) * t
            ring.append((px, height(px, pz, t), pz))
        grid.append(ring)
    by_mat = {}
    for r in range(rings):
        for i in range(around):
            j = (i + 1) % around
            quad = [grid[r][i], grid[r][j], grid[r + 1][j], grid[r + 1][i]]
            ys = [p[1] for p in quad]
            span = max(math.hypot(quad[0][0] - quad[2][0], quad[0][2] - quad[2][2]), 1e-3)
            cx, cz = sum(p[0] for p in quad) / 4, sum(p[2] for p in quad) / 4
            mat = colour(cx, cz, sum(ys) / 4, (max(ys) - min(ys)) / span)
            by_mat.setdefault(mat, []).append(quad)
    for mat, quads in by_mat.items():
        bm = kit.bmesh.new()
        for quad in quads:
            vs = [bm.verts.new(V(*p)) for p in quad]
            f = bm.faces.new(vs)
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
        kit.bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        ob = kit.finish(bm, f"{prefix}-ground-{mat}", mat)
        ob["after"] = True
    return grid[-1]


def ribbon(name, pts, width, mat, lift=0.03):
    """A strip `width` wide along a polyline of (x, y, z) points, `lift` above them (a road, a boardwalk)."""
    left, right = [], []
    for k, (x, y, z) in enumerate(pts):
        a = pts[max(k - 1, 0)]
        b = pts[min(k + 1, len(pts) - 1)]
        dx, dz = b[0] - a[0], b[2] - a[2]
        ln = math.hypot(dx, dz) or 1
        nx, nz = -dz / ln * width / 2, dx / ln * width / 2
        left.append((x + nx, y + lift, z + nz))
        right.append((x - nx, y + lift, z - nz))
    bm = kit.bmesh.new()
    for k in range(len(pts) - 1):
        vs = [bm.verts.new(V(*p)) for p in (left[k], right[k], right[k + 1], left[k + 1])]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    ob = kit.finish(bm, name, mat)
    ob["after"] = True
    return ob


def polyline_distance(pts, x, z):
    """Distance in plan from (x, z) to a polyline of (x, y, z) points, and the height of the nearest point on it."""
    best, best_y = 1e9, 0.0
    for (ax, ay, az), (bx, by, bz) in zip(pts, pts[1:]):
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1)))
        d = math.hypot(x - ax - dx * t, z - az - dz * t)
        if d < best:
            best, best_y = d, ay + (by - ay) * t
    return best, best_y


def coast_distance(plan, x, z):
    """Distance in plan from (x, z) to a closed outline."""
    best = 1e9
    for i in range(len(plan)):
        (x0, z0), (x1, z1) = plan[i], plan[(i + 1) % len(plan)]
        dx, dz = x1 - x0, z1 - z0
        t = max(0.0, min(1.0, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz or 1)))
        best = min(best, math.hypot(x - x0 - dx * t, z - z0 - dz * t))
    return best


def cdt_terrain(prefix, plan, height, colour, spacing=1.1, seed=0, by_lowest=False):
    """Designed ground over any outline (arms, bays, hooks: not only star-shaped ones): the outline resampled every
    `spacing` plus a jittered grid inside it, triangulated within the outline (constrained Delaunay), each vertex at
    `height(x, z, d)` with d its distance from the coast, each face flat-shaded in the swatch `colour(x, z, y, slope)`
    picks (`by_lowest`: y is the face's lowest corner, so a band of faces touching the coast takes one swatch). One
    object per swatch; returns the coast's points (x, y, z)."""
    import random as _random
    from mathutils import Vector as _V
    from mathutils.geometry import delaunay_2d_cdt

    jit = _random.Random(seed)
    n_edge = max(12, int(sum(math.hypot(plan[(i + 1) % len(plan)][0] - x, plan[(i + 1) % len(plan)][1] - z) for i, (x, z) in enumerate(plan)) / spacing))
    edge = resample(plan, n_edge)
    xs, zs = [p[0] for p in plan], [p[1] for p in plan]
    inner = []
    z = min(zs) + spacing / 2
    row = 0
    while z < max(zs):
        x = min(xs) + spacing / 2 + (spacing / 2 if row % 2 else 0)
        while x < max(xs):
            px, pz = x + jit.uniform(-0.2, 0.2) * spacing, z + jit.uniform(-0.2, 0.2) * spacing
            if inside(plan, px, pz) and coast_distance(plan, px, pz) > spacing * 0.95:
                inner.append((px, pz))
            x += spacing
        z += spacing * 0.87
        row += 1
    # A ring of points a fixed way in from the coast, so the first row of faces is an even band (the waterline's trim)
    # rather than a ragged edge.
    for x, z, nx, nz in walk(plan, spacing):
        px, pz = x - nx * spacing * 0.55, z - nz * spacing * 0.55
        if inside(plan, px, pz) and coast_distance(plan, px, pz) > spacing * 0.4:
            inner.append((px, pz))
    pts = edge + inner
    out = delaunay_2d_cdt([_V(p) for p in pts], [], [list(range(len(edge)))], 1, 1e-5)
    verts2, faces = out[0], out[2]
    ys = []
    for v in verts2:
        ys.append(height(v.x, v.y, coast_distance(plan, v.x, v.y)))
    by_mat = {}
    for f in faces:
        tri = [(verts2[i].x, ys[i], verts2[i].y) for i in f]
        span = max(max(math.hypot(a[0] - b[0], a[2] - b[2]) for a in tri for b in tri), 1e-3)
        cy = min(p[1] for p in tri) if by_lowest else sum(p[1] for p in tri) / len(tri)
        cx, cz = sum(p[0] for p in tri) / len(tri), sum(p[2] for p in tri) / len(tri)
        mat = colour(cx, cz, cy, (max(p[1] for p in tri) - min(p[1] for p in tri)) / span)
        by_mat.setdefault(mat, []).append(tri)
    for mat, tris in by_mat.items():
        bm = kit.bmesh.new()
        for tri in tris:
            f = bm.faces.new([bm.verts.new(V(*p)) for p in tri])
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
        kit.bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        kit.finish(bm, f"{prefix}-ground-{mat}", mat)["after"] = True
    return [(x, height(x, z, 0.0), z) for x, z in edge]
