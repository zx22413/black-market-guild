"""The upgraded livery of the V0.8 prototype's ships (an experiment, not rules): with its skill open a ship's own
parts are repainted, on top of what the skill builds onto it (blockout-skills.py; design sheet
docs/art/skills-concept.svg). Shared by the design sheet and by the ships' build scripts, which export the repainted
hull as public/models/ships/<type>-up.glb when run with a third argument `skill`:

  npx tsx scripts/blender/dump-ship.ts standard > /tmp/standard.json
  Blender -b --factory-startup --python scripts/blender/build-standard.py -- /tmp/standard.json public/models/ships/standard-up.glb skill

Each entry repaints the parts whose name starts with the prefix (and whose swatch is the one named, when given) in a
new swatch of the game's palette. Cloth, oars and the die are drawn in code: src/ui-v07/scene/ships/skillRig.ts
repaints those. The freighter is one mesh; its livery is the belts laid over it in its skill model.
"""

LIVERY = {
    # Gilded battlements and rails, a gold hem and emblem on the sail.
    "standard": [("aftcastle-merlon", "marble", "gold"), ("forecastle-merlon", "marble", "gold"), ("cap-rail", None, "gold"), ("sail-hem", None, "gold"), ("emblem-ring", None, "gold"), ("emblem-bird", None, "gold"), ("bowsprit-cap", None, "gold")],
    # The sail's white stripes turn gold: red and gold, the colours of a high stake.
    "gambler": [("lateen", "canvas", "roofGold"), ("jib", "canvas", "roofGold"), ("boot-top", None, "gold"), ("die", "marble", "gold")],
    # Purple rails and yard bands, and the rags take the shroud's purple.
    "hidden": [("cap-rail", None, "heather"), ("main-yard-band", None, "ghostGlow"), ("fore-yard-band", None, "ghostGlow"), ("rag-main", None, "heather"), ("rag-fore", None, "heather"), ("bowsprit-cap", None, "ghostGlow")],
    # Sea-green canopy and oar blades, a sea-green emblem, a white hem.
    "breaker": [("canopy", "leaf", "canal"), ("oar-", "wood", "canal"), ("emblem-disc", None, "canal"), ("sail-hem", None, "marble")],
}


def repainted(ship, name, mat):
    """The swatch a part wears with the skill open (its own when the livery leaves it alone)."""
    for prefix, was, to in LIVERY.get(ship, []):
        if name.startswith(prefix) and (was is None or mat == was):
            return to
    return mat


def apply(ship, parts):
    """Repaint a build script's part list in place, before it colours the parts: (object, swatch, shade) tuples."""
    changed = 0
    for i, (ob, mat, shade) in enumerate(parts):
        to = repainted(ship, ob.name, mat)
        if to != mat and not ob.get("banded"):
            parts[i] = (ob, to, shade)
            changed += 1
    print(f"LIVERY {ship}: {changed} parts repainted")
    return changed
