"""Re-encode the paper-grained UI parts as WebP (second step of `npm run art:ui:png`).

`scripts/raster-ui-art.ts` renders every part in public/art/ui/ to 2x and 3x PNGs. The parchment
parts carry fine paper grain, which PNG cannot compress (paper.png was 760 KB), and cutting them
to a 256-colour palette bands the soft burnt edges. Lossy WebP at quality 85 keeps the grain and
the edges, at under a tenth of the size. Parts with crisp outlines (wood, buttons, rope) stay PNG:
lossy compression would put ringing along their dark edges.

Needs Pillow (`pip install pillow`). Keep WEBP_PARTS in step with `UI_ART_WEBP` in src/ui/art.ts.
"""

from pathlib import Path

from PIL import Image

WEBP_PARTS = ("paper", "paper-small", "plaque")
SUFFIXES = ("", "@3x")
QUALITY = 85
UI_DIR = Path(__file__).resolve().parent.parent / "public" / "art" / "ui"


def main() -> None:
    for part in WEBP_PARTS:
        for suffix in SUFFIXES:
            png = UI_DIR / f"{part}{suffix}.png"
            if not png.exists():
                raise SystemExit(f"{png} is missing: run scripts/raster-ui-art.ts first")
            webp = png.with_suffix(".webp")
            # exact: keep the colour under fully transparent pixels, so edges do not darken when scaled.
            Image.open(png).save(webp, "WEBP", quality=QUALITY, method=6, exact=True)
            print(f"{webp.name}: {png.stat().st_size // 1024} KB PNG -> {webp.stat().st_size // 1024} KB WebP")
            png.unlink()


if __name__ == "__main__":
    main()
