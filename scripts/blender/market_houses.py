"""The market town's houses (巴扎港, docs/art/island-base-research.md §25.12): five designed types instead of bare boxes,
each trimmed the way the guild islands are (docs/art/lowpoly-style.md §6.2: every edge has a contrasting trim).

Every house is built in its own frame (x along its front, z out of its front, y up from the square) and set down at
(x, z) turned by `yaw` the way three.js turns (+z toward +x), like `box(..., yaw=)`. Shared trims on every type:
- a plinth of darker stone at the foot, a little proud of the wall;
- light stone quoins up the front corners;
- a cornice band under the eaves, standing out;
- windows and doors as dark openings in light frames, some with coloured shutters;
- roofs with eaves overhanging the walls and a darker ridge cap.
Types: the Dutch merchant house (stepped gable to the street, a hoist beam), the Venetian house (hipped roof, deep eaves,
a funnel chimney), the flat-roofed Levantine house (parapet, a roof pergola, arched shop front), the warehouse (wide,
big loading door, gable to the street), the tower house (narrow, open loggia on top, pyramid roof). Some get a lean-to
annex at the side, so the plans are not all rectangles.
"""

import math
import random

import blockout_kit as kit
from blockout_kit import box, mesh_from, prism

kit.SWATCHES.update(
    {
        "trimStone": ("#f3ece0", "#ddd3c2"),
        "plinth": ("#8f8070", "#786a5c"),
        "ridge": ("#7a3b2e", "#5e2c22"),
        "roofTile": ("#d9714a", "#b85636"),
        "roofSlate": ("#7d8296", "#63687a"),
        "shutterGreen": ("#5f9e6e", "#4a7f57"),
        "shutterBlue": ("#5b86b8", "#476c97"),
        "opening": ("#3b3240", "#2c2530"),
        "ochre": ("#e3a85a", "#c98e44"),
        "rose": ("#e39a8c", "#c98073"),
        "sky": ("#9cc3d6", "#80a8bd"),
    }
)
WALLS = ["ochre", "rose", "sky", "plaster", "sandstone", "pastelBlue", "ochre", "rose"]
G = 3.65  # the square, set by the caller


class Frame:
    """A house's own frame: local (x, y, z) to table space."""

    def __init__(self, x, z, yaw, ground):
        self.x, self.z, self.yaw, self.g = x, z, yaw, ground
        self.c, self.s = math.cos(yaw), math.sin(yaw)

    def p(self, lx, ly, lz):
        return (self.x + lx * self.c + lz * self.s, self.g + ly, self.z - lx * self.s + lz * self.c)


def tag(ob):
    ob["after"] = True
    return ob


def lbox(f, name, cx, cy, cz, sx, sy, sz, mat, bevel=0.0):
    return tag(box(name, f.p(cx, cy, cz), (sx, sy, sz), mat, bevel=bevel, yaw=f.yaw))


def solid(f, name, corners, mat):
    """A convex hexahedron from 8 local corners: bottom four then top four, each counter-clockwise from above."""
    faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return tag(mesh_from(name, [f.p(*c) for c in corners], faces, mat, convex=True))


def wedge(f, name, x0, x1, z, y0, y1, depth, mat):
    """A triangular gable wall across x0..x1 at `z` (its outer face), from the eaves y0 to the apex y1, `depth` deep."""
    xm = (x0 + x1) / 2
    verts = [(x0, y0, z), (x1, y0, z), (xm, y1, z), (x0, y0, z - depth), (x1, y0, z - depth), (xm, y1, z - depth)]
    faces = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]
    return tag(mesh_from(name, [f.p(*c) for c in verts], faces, mat, convex=True))


def gable_roof(f, name, w, d, y, rise, mat, along_x=True, over=0.16, cz=0.0):
    """A pitched roof on a w × d wall top at y: two slabs with eaves overhanging by `over`, a ridge cap, and the gable
    triangles filled in the wall's colour. `along_x`: the ridge runs along the front (eaves to the street)."""
    t = 0.09
    if along_x:
        hw, hd = w / 2 + over, d / 2 + over
        for s in (-1, 1):  # the slab falling toward +z (s=1) or -z
            eave_z, ridge_z = s * hd, 0.0
            drop = over * rise / (d / 2)
            corners = [(-hw, y - drop, eave_z), (hw, y - drop, eave_z), (hw, y + rise, ridge_z), (-hw, y + rise, ridge_z)]
            if s < 0:
                corners = [corners[1], corners[0], corners[3], corners[2]]
            top = [(cx, cy + t, cz) for cx, cy, cz in corners]
            solid(f, f"{name}-slab{s}", corners + top, mat)
        tag(kit.beam(f"{name}-ridge", f.p(-hw - 0.02, y + rise + t, 0), f.p(hw + 0.02, y + rise + t, 0), 0.14, "ridge", sides=4))
    else:
        hw, hd = w / 2 + over, d / 2 + over
        for s in (-1, 1):
            drop = over * rise / (w / 2)
            corners = [(s * hw, y - drop, cz - hd), (s * hw, y - drop, cz + hd), (0, y + rise, cz + hd), (0, y + rise, cz - hd)]
            if s > 0:
                corners = [corners[1], corners[0], corners[3], corners[2]]
            top = [(cx, cy + t, cz) for cx, cy, cz in corners]
            solid(f, f"{name}-slab{s}", corners + top, mat)
        tag(kit.beam(f"{name}-ridge", f.p(0, y + rise + t, cz - hd - 0.02), f.p(0, y + rise + t, cz + hd + 0.02), 0.14, "ridge", sides=4))


def hip_roof(f, name, w, d, y, rise, mat, over=0.2):
    hw, hd = w / 2 + over, d / 2 + over
    ridge = max(0.05, (w - d) / 2) if w > d else 0.05
    corners = [(-hw, y - 0.05, -hd), (hw, y - 0.05, -hd), (hw, y - 0.05, hd), (-hw, y - 0.05, hd),
               (-ridge, y + rise, -0.04), (ridge, y + rise, -0.04), (ridge, y + rise, 0.04), (-ridge, y + rise, 0.04)]
    solid(f, f"{name}", corners, mat)
    tag(kit.beam(f"{name}-ridge", f.p(-ridge - 0.08, y + rise + 0.02, 0), f.p(ridge + 0.08, y + rise + 0.02, 0), 0.12, "ridge", sides=4))


def window(f, name, x, y, z, w=0.34, h=0.46, shutters=None):
    """A window on the front face at local z: a light frame standing proud, a dark opening, a sill, maybe shutters."""
    lbox(f, f"{name}-frame", x, y, z + 0.03, w + 0.12, h + 0.12, 0.06, "trimStone")
    lbox(f, f"{name}-glass", x, y, z + 0.065, w, h, 0.02, "opening")
    lbox(f, f"{name}-sill", x, y - h / 2 - 0.07, z + 0.07, w + 0.2, 0.05, 0.12, "trimStone")
    if shutters:
        for s in (-1, 1):
            lbox(f, f"{name}-shutter{s}", x + s * (w / 2 + 0.14), y, z + 0.04, 0.14, h, 0.04, shutters)


def door(f, name, x, z, w=0.42, h=0.78, arch=False):
    lbox(f, f"{name}-frame", x, h / 2 + 0.03, z + 0.03, w + 0.14, h + 0.1, 0.06, "trimStone")
    lbox(f, f"{name}-leaf", x, h / 2, z + 0.065, w, h, 0.02, "woodDark" if not arch else "opening")
    if arch:
        lbox(f, f"{name}-keystone", x, h + 0.1, z + 0.07, 0.14, 0.16, 0.06, "trimStone")


def walls(f, name, w, d, h, mat, rng):
    """The body with its trims: plinth, front quoins, cornice."""
    lbox(f, f"{name}", 0, h / 2, 0, w, h, d, mat)
    lbox(f, f"{name}-plinth", 0, 0.12, 0, w + 0.06, 0.24, d + 0.06, "plinth")
    for s in (-1, 1):
        lbox(f, f"{name}-quoin{s}", s * (w / 2 - 0.03), h / 2 + 0.06, d / 2 - 0.03, 0.14, h - 0.12, 0.14, "trimStone")
    lbox(f, f"{name}-cornice", 0, h - 0.04, 0, w + 0.12, 0.1, d + 0.12, "trimStone")


def facade(f, name, w, d, h, rng, shop=False):
    """Doors and windows on the front: a shop front or a door below, a row of windows on each floor above."""
    z = d / 2
    floors = max(1, int((h - 0.3) / 0.95))
    if shop:
        lbox(f, f"{name}-shopframe", 0, 0.52, z + 0.03, w * 0.74 + 0.12, 0.86, 0.06, "trimStone")
        lbox(f, f"{name}-shop", 0, 0.5, z + 0.065, w * 0.74, 0.74, 0.02, "opening")
    else:
        door(f, f"{name}-door", rng.uniform(-0.15, 0.15) * w, z, arch=rng.random() < 0.4)
    per = 1 if w < 1.5 else 2
    shutters = rng.choice([None, None, "shutterGreen", "shutterBlue"])
    for k in range(1, floors):
        y = 0.55 + k * 0.95
        if y + 0.35 > h - 0.1:
            break
        for j in range(per):
            x = 0 if per == 1 else (j - 0.5) * w * 0.5
            window(f, f"{name}-win{k}{j}", x, y, z, shutters=shutters)


def awning(f, name, w, d, mat):
    z = d / 2
    lbox(f, f"{name}-awning", 0, 1.02, z + 0.38, w * 0.82, 0.05, 0.7, mat)
    for s in (-1, 1):
        tag(kit.beam(f"{name}-awning-arm{s}", f.p(s * w * 0.38, 1.02, z + 0.72), f.p(s * w * 0.38, 1.3, z + 0.02), 0.05, "woodDark"))


def chimney(f, name, x, y, z, venetian=False):
    lbox(f, f"{name}", x, y + 0.35, z, 0.24, 0.7, 0.24, "sandstone")
    if venetian:
        tag(prism(f"{name}-funnel", f.p(x, y + 0.7, z), 0.14, 0.32, "trimStone", sides=6, top=1.9))
    else:
        lbox(f, f"{name}-cap", x, y + 0.74, z, 0.32, 0.08, 0.32, "trimStone")


def lean_to(f, name, w, d, side, rng, mat):
    """A low annex against one side wall, its roof sloping away."""
    aw, ad, ah = rng.uniform(0.7, 1.0), d * 0.7, 1.1
    x = side * (w / 2 + aw / 2)
    lbox(f, f"{name}", x, ah / 2, -d * 0.1, aw, ah, ad, mat)
    lbox(f, f"{name}-plinth", x, 0.1, -d * 0.1, aw + 0.05, 0.2, ad + 0.05, "plinth")
    x0, x1 = side * (w / 2), side * (w / 2 + aw + 0.12)
    corners = [(x0, ah + 0.35, -d * 0.1 - ad / 2 - 0.1), (x1, ah - 0.05, -d * 0.1 - ad / 2 - 0.1), (x1, ah - 0.05, -d * 0.1 + ad / 2 + 0.1), (x0, ah + 0.35, -d * 0.1 + ad / 2 + 0.1)]
    if side < 0:
        corners = [corners[1], corners[0], corners[3], corners[2]]
    solid(f, f"{name}-roof", corners + [(cx, cy + 0.07, cz) for cx, cy, cz in corners], "roofTile")


# ---------------------------------------------------------------- the five types

def dutch(f, name, w, d, h, rng, shop):
    """Tall and narrow, its stepped gable to the street trimmed in white, a hoist beam under the top step."""
    mat = rng.choice(WALLS)
    walls(f, name, w, d, h, mat, rng)
    facade(f, name, w, d, h, rng, shop)
    # The stepped gable: three steps narrowing up the front wall, each capped in white.
    y = h
    for k, frac in enumerate((0.92, 0.64, 0.36)):
        sw = w * frac
        lbox(f, f"{name}-step{k}", 0, y + 0.2, d / 2 - 0.09, sw, 0.4, 0.18, mat)
        lbox(f, f"{name}-stepcap{k}", 0, y + 0.42, d / 2 - 0.09, sw + 0.08, 0.05, 0.24, "trimStone")
        y += 0.4
    # The roof starts behind the stepped gable, so its edge never shows across the steps.
    gable_roof(f, f"{name}-roof", w * 0.9, d - 0.3, h, 1.1, rng.choice(["roofTile", "roofSlate"]), along_x=False, over=0.06, cz=-0.15)
    tag(kit.beam(f"{name}-hoist", f.p(0, y - 0.25, d / 2 - 0.1), f.p(0, y - 0.25, d / 2 + 0.4), 0.09, "woodDark"))


def venetian(f, name, w, d, h, rng, shop):
    """A hipped tile roof with deep eaves over a cornice, a funnel chimney, sometimes a balcony."""
    mat = rng.choice(WALLS)
    walls(f, name, w, d, h, mat, rng)
    facade(f, name, w, d, h, rng, shop)
    hip_roof(f, f"{name}-roof", w, d, h, 0.7, "roofTile", over=0.24)
    chimney(f, f"{name}-chimney", w * 0.25, h + 0.2, -d * 0.15, venetian=True)
    if h > 2.2 and rng.random() < 0.6:
        lbox(f, f"{name}-balcony", 0, 1.5, d / 2 + 0.2, w * 0.55, 0.07, 0.4, "trimStone")
        for k in range(4):
            x = (k / 3 - 0.5) * w * 0.5
            lbox(f, f"{name}-baluster{k}", x, 1.68, d / 2 + 0.38, 0.04, 0.3, 0.04, "woodDark")
        lbox(f, f"{name}-balrail", 0, 1.84, d / 2 + 0.38, w * 0.55, 0.04, 0.05, "woodDark")


def levantine(f, name, w, d, h, rng, shop):
    """Flat roof behind a parapet with a white coping, a roof pergola, an arched ground-floor shop."""
    mat = rng.choice(["plaster", "sandstone", "marble", "ochre"])
    walls(f, name, w, d, h, mat, rng)
    facade(f, name, w, d, h, rng, True)
    lbox(f, f"{name}-parapet-f", 0, h + 0.12, d / 2 - 0.05, w + 0.06, 0.3, 0.1, mat)
    lbox(f, f"{name}-parapet-b", 0, h + 0.12, -d / 2 + 0.05, w + 0.06, 0.3, 0.1, mat)
    for s in (-1, 1):
        lbox(f, f"{name}-parapet{s}", s * (w / 2 - 0.05), h + 0.12, 0, 0.1, 0.3, d, mat)
    lbox(f, f"{name}-coping", 0, h + 0.29, 0, w + 0.14, 0.05, d + 0.14, "trimStone")
    lbox(f, f"{name}-terrace", 0, h + 0.02, 0, w - 0.1, 0.04, d - 0.1, "plinth")
    # The pergola: four posts and a cloth.
    px, pz = w * 0.28, d * 0.25
    for sx in (-1, 1):
        for sz in (-1, 1):
            tag(kit.beam(f"{name}-perg{sx}{sz}", f.p(sx * px, h + 0.04, sz * pz), f.p(sx * px, h + 0.75, sz * pz), 0.06, "woodDark"))
    lbox(f, f"{name}-cloth", 0, h + 0.78, 0, px * 2 + 0.16, 0.04, pz * 2 + 0.16, rng.choice(["awningPink", "canvas", "awningPurple"]))


def warehouse(f, name, w, d, h, rng, shop):
    """Wide and plain, a gable to the street, a tall loading door framed in timber, a hoist beam over it."""
    mat = rng.choice(["sandstone", "ochre", "plaster"])
    walls(f, name, w, d, h, mat, rng)
    z = d / 2
    lbox(f, f"{name}-loadframe", 0, h * 0.42, z + 0.03, 0.9, h * 0.8, 0.06, "woodDark")
    lbox(f, f"{name}-load", 0, h * 0.42, z + 0.065, 0.7, h * 0.74, 0.02, "opening")
    gable_roof(f, f"{name}-roof", w, d, h, 0.85, "roofTile", along_x=False, over=0.14)
    wedge(f, f"{name}-gable", -w / 2, w / 2, z, h, h + 0.85, 0.1, mat)
    tag(kit.beam(f"{name}-hoist", f.p(0, h + 0.4, z - 0.1), f.p(0, h + 0.4, z + 0.5), 0.1, "woodDark"))
    if shop:  # a bale waiting at the door, only where the door opens on the paving
        lbox(f, f"{name}-bale", 0.6, 0.2, z + 0.35, 0.4, 0.4, 0.4, "canvas", bevel=0.04)


def tower(f, name, w, d, h, rng, shop):
    """A narrow tower house, an open loggia of arches on top under a pyramid roof."""
    mat = rng.choice(WALLS)
    walls(f, name, w, d, h, mat, rng)
    facade(f, name, w, d, h, rng, shop)
    # The loggia: four corner piers and a slab, open between them.
    for sx in (-1, 1):
        for sz in (-1, 1):
            lbox(f, f"{name}-pier{sx}{sz}", sx * (w / 2 - 0.1), h + 0.35, sz * (d / 2 - 0.1), 0.2, 0.7, 0.2, mat)
    lbox(f, f"{name}-loggia-cornice", 0, h + 0.74, 0, w + 0.12, 0.1, d + 0.12, "trimStone")
    hip_roof(f, f"{name}-roof", w, d, h + 0.79, 0.9, rng.choice(["roofTile", "roofSlate"]), over=0.14)


TYPES = {"dutch": dutch, "venetian": venetian, "levantine": levantine, "warehouse": warehouse, "tower": tower}


def house(name, x, z, yaw, w, d, h, kind, rng, ground=G, shop=False, annex=0):
    """One house of a type, set down at (x, z) on `ground`, turned by `yaw`; `annex` -1/1 adds a lean-to on that side."""
    f = Frame(x, z, yaw, ground)
    TYPES[kind](f, name, w, d, h, rng, shop)
    if annex:
        lean_to(f, f"{name}-annex", w, d, annex, rng, rng.choice(WALLS))
    if shop and kind in ("dutch", "venetian", "tower"):
        awning(f, f"{name}", w, d, rng.choice(["awningPink", "awningPurple", "canvas", "shutterGreen"]))
