"""Builds one contact sheet per game (3 columns of 500x281 thumbnails, numbered) from
<root>/<game>/*.jpg into <out>/<game>.jpg. Usage: python3 -I contact-sheet.py <root> <out>"""
import os
import sys

from PIL import Image, ImageDraw

W, H, COLS = 500, 281, 3


def main(root: str, out: str) -> None:
    os.makedirs(out, exist_ok=True)
    for game in sorted(os.listdir(root)):
        folder = os.path.join(root, game)
        if not os.path.isdir(folder):
            continue
        shots = []
        for name in sorted(f for f in os.listdir(folder) if f.endswith('.jpg')):
            try:
                shots.append((name, Image.open(os.path.join(folder, name)).convert('RGB').resize((W, H))))
            except OSError:
                pass  # a failed download is an empty or HTML file; skip it
        if not shots:
            continue
        rows = (len(shots) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * W, rows * H), 'black')
        draw = ImageDraw.Draw(sheet)
        for n, (name, shot) in enumerate(shots):
            x, y = (n % COLS) * W, (n // COLS) * H
            sheet.paste(shot, (x, y))
            draw.rectangle([x, y, x + 30, y + 16], fill='black')
            draw.text((x + 4, y + 2), name[:2], fill='yellow')
        sheet.save(os.path.join(out, game + '.jpg'), quality=85)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
