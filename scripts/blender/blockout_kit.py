"""Shared parts, colour and renders for the ship blockouts (scripts/blender/blockout-<type>.py).

A blockout script puts its folder on sys.path and does `from blockout_kit import *`, builds its parts in ship space
(three.js: y up, bow +z, keel at y = 0, DECK = 1.25) with the helpers here, then calls `finish_blockout(...)`, which
checks normals, colours every part from its swatch, renders the sheet's orthographic views (side, front, top, oblique)
plus any close-ups, and writes anchors.json for scripts/blender/compose-sheet.py.

Colours come from src/ui/scene/buildings/materials.ts (SWATCHES), read at run time so the sheet never drifts from the
game's palette; EXTRA_SWATCHES holds stand-ins for things the game draws in code (the owner's pennant, glows).
"""

import json
import math
import os
import re
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def out_dir():
    """The render folder: the first argument after `--` (a blockout run)."""
    path = sys.argv[sys.argv.index("--") + 1]
    os.makedirs(path, exist_ok=True)
    return path


def read_swatches():
    text = open(os.path.join(REPO, "src/ui/scene/buildings/materials.ts")).read()
    return {m[0]: (m[1], m[2]) for m in re.findall(r"(\w+): \{ top: '(#[0-9a-f]{6})', bottom: '(#[0-9a-f]{6})' \}", text)}


# Stand-ins for code-drawn things (not in the game's palette): the owner's pennant, the ghost ship's teal glow.
EXTRA_SWATCHES = {"pennant": ("#e04f6a", "#c03a55"), "ghostGlow": ("#7dffd8", "#2fd6a8")}
SWATCHES = {**read_swatches(), **EXTRA_SWATCHES}

DECK = 1.25
DRAFT = 0.5
SHIP_BOX_TOP = 5.6  # src/ui-v07/scene/ShipSideCamera.tsx SHIP_BOX.height
BERTH_GAP = 6.0


def V(x, y, z):
    """Ship space (three.js, y up, bow +z) to Blender (z up)."""
    return Vector((x, -z, y))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return [srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)]


bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
PARTS = []  # (object, swatch, shade)


def finish(bm, name, mat, shade=1.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    SCENE.collection.objects.link(ob)
    PARTS.append((ob, mat, shade))
    return ob


def outward(bm):
    """Turn every face of a convex solid outward, one by one. `recalc_face_normals` got turned boxes wrong (a box turned
    more than a quarter turn came out inside out, a bevelled one partly), and the game culls inward faces."""
    centre = sum((v.co for v in bm.verts), Vector()) / max(len(bm.verts), 1)
    for f in bm.faces:
        f.normal_update()
    inward = [f for f in bm.faces if f.normal.dot(f.calc_center_median() - centre) < 0]
    if inward:
        bmesh.ops.reverse_faces(bm, faces=inward)


def mesh_from(name, verts, faces, mat, shade=1.0, convex=False):
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if convex:
        outward(bm)
    return finish(bm, name, mat, shade)


def box(name, center, size, mat, bevel=0.02, shade=1.0, yaw=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c, s = math.cos(yaw), math.sin(yaw)
    for v in bm.verts:
        x, y, z = v.co.x * size[0], v.co.z * size[1], -v.co.y * size[2]
        x, z = x * c + z * s, -x * s + z * c
        v.co = V(center[0] + x, center[1] + y, center[2] + z)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    outward(bm)
    return finish(bm, name, mat, shade)


def beam(name, a, b, width, mat, sides=6, taper=1.0, shade=1.0):
    a, b = V(*a), V(*b)
    axis = b - a
    d = axis.normalized()
    helper = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(helper).normalized()
    w = d.cross(u)
    r = width / 2
    bm = bmesh.new()

    def ring(c, k):
        return [bm.verts.new(c + (u * math.cos(2 * math.pi * i / sides) + w * math.sin(2 * math.pi * i / sides)) * r * k) for i in range(sides)]

    lo, hi = ring(a, 1.0), ring(b, taper)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    outward(bm)
    return finish(bm, name, mat, shade)


def prism(name, base, radius, height, mat, sides=8, top=1.0, shade=1.0):
    """An upright prism (a tub, a cap) standing on `base`."""
    verts = []
    for k, y in ((1.0, base[1]), (top, base[1] + height)):
        for i in range(sides):
            a = 2 * math.pi * (i + 0.5) / sides
            verts.append((base[0] + math.cos(a) * radius * k, y, base[2] + math.sin(a) * radius * k))
    faces = [list(range(sides)), list(range(sides, 2 * sides))]
    faces += [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    return mesh_from(name, verts, faces, mat, shade, convex=True)


def plan_ring(name, outer_plan, inner_plan, y0, y1, mat, shade=1.0):
    """A band round a plan (a coping, a rim): the solid between two outlines of the same vertex count."""
    n = len(outer_plan)
    verts = [(x, y0, z) for x, z in outer_plan] + [(x, y1, z) for x, z in outer_plan]
    verts += [(x, y0, z) for x, z in inner_plan] + [(x, y1, z) for x, z in inner_plan]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])  # outer wall
        faces.append([2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j])  # inner wall
        faces.append([n + i, n + j, 3 * n + j, 3 * n + i])  # top
        faces.append([j, i, 2 * n + i, 2 * n + j])  # bottom
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in verts]
    for f in faces:
        bm.faces.new([vs[k] for k in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, mat, shade)


def plan_solid(name, plan, y0, y1, mat, shade=1.0):
    """A wall block: a plan outline of (x, z) points extruded from y0 up to y1."""
    n = len(plan)
    verts = [(x, y0, z) for x, z in plan] + [(x, y1, z) for x, z in plan]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_from(name, verts, faces, mat, shade)


def offset(plan, d):
    """A convex plan pushed out by d (negative pulls it in), each vertex moved along its corner bisector so that every
    edge moves by d."""
    n = len(plan)
    cx, cz = sum(p[0] for p in plan) / n, sum(p[1] for p in plan) / n
    out = []
    for i in range(n):
        (xa, za), (x, z), (xb, zb) = plan[i - 1], plan[i], plan[(i + 1) % n]
        normals = []
        for (x0, z0), (x1, z1) in (((xa, za), (x, z)), ((x, z), (xb, zb))):
            nx, nz = z1 - z0, -(x1 - x0)
            ln = math.hypot(nx, nz) or 1
            nx, nz = nx / ln, nz / ln
            if nx * ((x0 + x1) / 2 - cx) + nz * ((z0 + z1) / 2 - cz) < 0:
                nx, nz = -nx, -nz
            normals.append((nx, nz))
        bx, bz = normals[0][0] + normals[1][0], normals[0][1] + normals[1][1]
        ln = math.hypot(bx, bz) or 1
        bx, bz = bx / ln, bz / ln
        k = d / max(bx * normals[0][0] + bz * normals[0][1], 0.35)
        out.append((x + bx * k, z + bz * k))
    return out


def framed_opening(name, center, size, facing_x, frame=0.09):
    """A dark opening (door, arrow slit) with a thick light frame standing proud of the wall; `facing_x` turns it to
    face along x (a side wall) instead of z (an end wall)."""
    w, h = size
    cx, cy, cz = center
    if facing_x:
        box(f"{name}-frame", (cx, cy, cz), (0.08, h + 2 * frame, w + 2 * frame), "marble", bevel=0.02)
        box(f"{name}-hole", (cx + math.copysign(0.03, cx), cy, cz), (0.06, h, w), "dark", bevel=0.0)
    else:
        box(f"{name}-frame", (cx, cy, cz), (w + 2 * frame, h + 2 * frame, 0.08), "marble", bevel=0.02)
        box(f"{name}-hole", (cx, cy, cz + math.copysign(0.03, cz)), (w, h, 0.06), "dark", bevel=0.0)


# ---------------------------------------------------------------- colour, checks, renders

def colour_parts(band=None):
    """Shade every part top to bottom with its swatch. A part flagged `banded` (a lofted hull) is coloured per face by
    `band(center_y, normal_up) -> (swatch, shade)` instead."""
    for ob, mat, shade in PARTS:
        me = ob.data
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        ys = [v.co.z for v in me.vertices]
        lo, hi = min(ys), max(ys)
        if ob.get("banded"):
            for poly in me.polygons:
                c = sum((me.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
                sw, sh = band(c.z, poly.normal.z)
                top, bot = hex_rgb(SWATCHES[sw][0]), hex_rgb(SWATCHES[sw][1])
                for li in poly.loop_indices:
                    vy = me.vertices[me.loops[li].vertex_index].co.z
                    t = max(0.0, min(1.0, vy / 2.0))
                    attr.data[li].color = [(b + (a - b) * t) * sh for a, b in zip(top, bot)] + [1.0]
            continue
        top, bot = hex_rgb(SWATCHES[mat][0]), hex_rgb(SWATCHES[mat][1])
        for li, loop in enumerate(me.loops):
            t = (me.vertices[loop.vertex_index].co.z - lo) / (hi - lo) if hi > lo else 1.0
            attr.data[li].color = [(b + (a - b) * t) * shade for a, b in zip(top, bot)] + [1.0]
    m = bpy.data.materials.new("vc")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])
    for ob, _, _ in PARTS:
        ob.data.materials.append(m)
        for p in ob.data.polygons:
            p.use_smooth = False


def check_normals(skip=()):
    """Closed convex parts must face outward; `skip` lists name prefixes of concave or thin parts (the centroid test
    does not apply to them)."""
    bad = []
    for ob, _, _ in PARTS:
        me = ob.data
        if ob.name.startswith(tuple(skip)) or not me.vertices:
            continue
        centre = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
        inward = sum(1 for p in me.polygons if p.normal.dot(p.center - centre) < -1e-4)
        if inward > len(me.polygons) * 0.25:
            bad.append((ob.name, inward))
    if bad:
        print("INWARD FACES", bad)
        sys.exit(1)


def setup_render():
    SCENE.render.engine = "BLENDER_EEVEE"
    SCENE.render.film_transparent = True
    SCENE.view_settings.view_transform = "Standard"
    SCENE.render.use_freestyle = True
    SCENE.render.line_thickness = 1.3
    fs = SCENE.view_layers[0].freestyle_settings
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("lines")
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new("lines")
    ls.linestyle.color = (0.18, 0.12, 0.1)
    ls.select_by_visibility = True
    ls.select_crease = True
    ls.select_border = True
    ls.select_silhouette = True
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.9, 0.87, 0.82, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75
    SCENE.world = world
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.2
    sun.angle = math.radians(8)
    so = bpy.data.objects.new("sun", sun)
    SCENE.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-35))


def camera(name, pos, target, scale, res):
    cam = bpy.data.cameras.new(name)
    cam.type = "ORTHO"
    cam.ortho_scale = scale
    cam.clip_start, cam.clip_end = 0.1, 200
    ob = bpy.data.objects.new(name, cam)
    SCENE.collection.objects.link(ob)
    ob.location = pos
    d = Vector(target) - Vector(pos)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob, res


def near(target, azimuth, elevation, scale, res=(1000, 800)):
    """A close-up camera aimed at `target` (ship space) from `azimuth` degrees (0 = from ahead, -90 = from port) and
    `elevation` degrees up."""
    a, e = math.radians(azimuth), math.radians(elevation)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))) * 30
    return camera(f"cam-near-{azimuth}-{target[2]}", V(*(t + d)), V(*t), scale, res)


def render_views(anchors, close_ups=None, centre_y=3.3, centre_z=0.35, scale=8.6, oblique_scale=9.4):
    """The sheet's four orthographic views (side from port with the bow right, front, top with the bow right, oblique
    45° from the port bow and 30° up) and any close-ups ({name: near(...)}); writes <name>.png and anchors.json."""
    setup_render()
    OUT_DIR = out_dir()
    el, az = math.radians(30), math.radians(45)
    views = {
        "side": camera("cam-side", V(-30, centre_y, centre_z), V(0, centre_y, centre_z), scale, (1100, 1100)),
        "front": camera("cam-front", V(0, centre_y, 30), V(0, centre_y, 0), scale, (900, 1100)),
        "top": camera("cam-top", V(0, 30, centre_z), V(0, 0, centre_z), scale, (1100, 760)),
        "oblique": camera("cam-oblique", V(-30 * math.cos(el) * math.sin(az), centre_y - 0.3 + 30 * math.sin(el), 30 * math.cos(el) * math.cos(az)),
                          V(0, centre_y - 0.3, 0.2), oblique_scale, (1100, 1000)),
    }
    views.update(close_ups or {})
    views["top"][0].rotation_euler = (0, 0, math.radians(-90))  # bow to the right
    out = {}
    for name, (cam, (w, h)) in views.items():
        SCENE.camera = cam
        SCENE.render.resolution_x, SCENE.render.resolution_y = w, h
        SCENE.render.resolution_percentage = 100
        bpy.context.view_layer.update()
        SCENE.render.filepath = os.path.join(OUT_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        pts = {}
        for key, p in anchors.items():
            c = world_to_camera_view(SCENE, cam, V(*p))
            pts[key] = [round(c.x * w, 1), round((1 - c.y) * h, 1)]
        out[name] = {"size": [w, h], "points": pts}
    json.dump(out, open(os.path.join(OUT_DIR, "anchors.json"), "w"), indent=1)


def finish_blockout(anchors, band=None, skip=(), close_ups=None, **frame):
    """Check, colour, report the triangle count and render. `close_ups` is a function returning {name: near(...)}
    (cameras are made after the parts, so it is called late)."""
    check_normals(skip)
    colour_parts(band)
    tris = sum(len(p.vertices) - 2 for ob, _, _ in PARTS for p in ob.data.polygons)
    print(f"BLOCKOUT {len(PARTS)} parts, ~{tris} triangles")
    render_views(anchors, close_ups() if close_ups else None, **frame)
    print("RENDERED", out_dir())
