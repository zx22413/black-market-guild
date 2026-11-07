"""Lays the blockout renders (scripts/blender/blockout-<type>.py) out as an annotated design sheet (SVG).

  python3 scripts/blender/compose-sheet.py <sheet.json> <render dir> <out.svg>

The sheet JSON names the views (where each render goes and at what scale), the callouts (a view, an anchor name from
the render's anchors.json, where the label sits on the sheet and its text), the palette, the notes and the open
questions. Leader lines start exactly at the projected anchor, so labels point at the real 3D part in every view.
The render PNGs are referenced relative to the SVG (copy them next to it).
"""

import html
import json
import os
import sys

SHEET, RENDERS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
spec = json.load(open(SHEET))
anchors = json.load(open(os.path.join(RENDERS, "anchors.json")))
rel = os.path.relpath(RENDERS, os.path.dirname(os.path.abspath(OUT)))

INK, SOFT, LINE, BG = "#3b2f2a", "#6b5a50", "#a08a7a", "#f5efe2"
W, H = spec["size"]
out = [
    f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" '
    'font-family="PingFang TC, Heiti TC, sans-serif">',
    f'<!-- {html.escape(spec["comment"])} -->',
    f'<rect width="{W}" height="{H}" fill="{BG}"/>',
    f'<text x="40" y="58" font-size="34" font-weight="700" fill="{INK}">{html.escape(spec["title"])}</text>',
]
for i, line in enumerate(spec["subtitle"]):
    out.append(f'<text x="40" y="{94 + i * 26}" font-size="18" fill="{SOFT}">{html.escape(line)}</text>')


def place(view, key):
    v = spec["views"][view]
    px, py = anchors[view]["points"][key]
    return v["x"] + px * v["scale"], v["y"] + py * v["scale"]


for name, v in spec["views"].items():
    w, h = anchors[name]["size"]
    sw, sh = w * v["scale"], h * v["scale"]
    out.append(f'<rect x="{v["x"]}" y="{v["y"]}" width="{sw:.0f}" height="{sh:.0f}" rx="10" fill="#fbf7ee" stroke="#e2d6c2"/>')
    out.append(f'<text x="{v["x"] + 14}" y="{v["y"] + 30}" font-size="20" font-weight="700" fill="{INK}">{html.escape(v["label"])}</text>')
    for guide in v.get("guides", []):
        (x0, y0), (x1, y1) = place(name, guide["from"]), place(name, guide["to"])
        if guide.get("horizontal"):
            y1 = y0
            x0, x1 = v["x"] + 8, v["x"] + sw - 8
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{guide.get("color", LINE)}" '
                   f'stroke-width="2" stroke-dasharray="8 6"/>')
    out.append(f'<image x="{v["x"]}" y="{v["y"]}" width="{sw:.0f}" height="{sh:.0f}" xlink:href="{rel}/{name}.png"/>')
    for guide in v.get("guides", []):
        (x0, y0), (x1, y1) = place(name, guide["from"]), place(name, guide["to"])
        if guide.get("horizontal"):
            y1 = y0
            x1 = v["x"] + sw - 8
        if guide.get("text"):
            out.append(f'<text x="{x1 - 6:.1f}" y="{y1 - 8:.1f}" font-size="15" text-anchor="end" stroke="#fbf7ee" stroke-width="4" paint-order="stroke" fill="{guide.get("color", SOFT)}">'
                       f'{html.escape(guide["text"])}</text>')

for c in spec["callouts"]:
    ax, ay = place(c["view"], c["anchor"])
    tx, ty = c["at"]
    end = "end" if c.get("align") == "end" else "start"
    lx = tx + (8 if end == "end" else -8)
    out.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="4.5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>')
    out.append(f'<polyline points="{ax:.1f},{ay:.1f} {lx:.1f},{ty - 6:.1f}" fill="none" stroke="{LINE}" stroke-width="1.5"/>')
    for i, line in enumerate(c["text"]):
        weight = ' font-weight="700"' if i == 0 else ""
        size = 17 if i == 0 else 15
        colour = INK if i == 0 else SOFT
        out.append(f'<text x="{tx}" y="{ty + i * 20}" font-size="{size}"{weight} text-anchor="{end}" fill="{colour}">{html.escape(line)}</text>')

for im in spec.get("images", []):
    x, y, w, h = im["box"]
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fbf7ee" stroke="#e2d6c2"/>')
    out.append(f'<text x="{x + 14}" y="{y + 30}" font-size="20" font-weight="700" fill="{INK}">{html.escape(im["title"])}</text>')
    if im.get("note"):
        out.append(f'<text x="{x + 14}" y="{y + 56}" font-size="15" fill="{SOFT}">{html.escape(im["note"])}</text>')
    ix, iy, iw, ih = im["image"]
    out.append(f'<image x="{ix}" y="{iy}" width="{iw}" height="{ih}" xlink:href="{rel}/{im["file"]}"/>')

px, py = spec["palette_at"]
out.append(f'<text x="{px}" y="{py}" font-size="22" font-weight="700" fill="{INK}">色票（SWATCHES）與分區</text>')
for i, (name, top, bottom, use) in enumerate(spec["palette"]):
    x = px + (i % 2) * 380
    y = py + 22 + (i // 2) * 52
    gid = f"sw{i}"
    out.append(f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/>'
               f'<stop offset="1" stop-color="{bottom}"/></linearGradient></defs>')
    out.append(f'<rect x="{x}" y="{y}" width="56" height="38" rx="6" fill="url(#{gid})" stroke="#4a2f25" stroke-width="1.5"/>')
    out.append(f'<text x="{x + 68}" y="{y + 16}" font-size="16" font-weight="700" fill="{INK}">{html.escape(name)}</text>')
    out.append(f'<text x="{x + 68}" y="{y + 35}" font-size="14" fill="{SOFT}">{html.escape(use)}</text>')

for block in spec["blocks"]:
    bx, by = block["at"]
    out.append(f'<text x="{bx}" y="{by}" font-size="22" font-weight="700" fill="{block.get("color", INK)}">{html.escape(block["title"])}</text>')
    y = by + 32
    for item in block["items"]:
        for j, line in enumerate(item):
            out.append(f'<text x="{bx + (0 if j == 0 else 22)}" y="{y}" font-size="16" fill="{INK if j == 0 else SOFT}">{html.escape(line)}</text>')
            y += 24
        y += 6

out.append("</svg>")
open(OUT, "w").write("\n".join(out))
print("WROTE", OUT)
