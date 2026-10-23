"""Draws the cinnabar chop (P1, src/ui-v07/skin/titleMark.tsx) as public/favicon.png and public/apple-touch-icon.png:
a red block with 暗潮商戰 cut out, in macOS's Songti TC Bold. Usage: python3 -I scripts/draw-favicon.py public"""
import sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
N = 800
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc', 340, index=2)  # Songti TC Bold
mask = Image.new('L', (N, N), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle((32, 32, N - 32, N - 32), radius=48, fill=255)
for ch, x, y in (('暗', 232, 240), ('潮', 568, 240), ('商', 232, 568), ('戰', 568, 568)):
    left, top, right, bottom = font.getbbox(ch)
    d.text((x - (left + right) / 2, y - (top + bottom) / 2), ch, font=font, fill=0)
img = Image.new('RGBA', (N, N), (181, 48, 42, 0))
img.putalpha(mask)
for size, name in ((64, 'favicon.png'), (180, 'apple-touch-icon.png')):
    img.resize((size, size), Image.LANCZOS).save(f'{out}/{name}', optimize=True)
