#!/usr/bin/env python3
"""Sample palette colours from the reference image.

Prints median / light (75th percentile luminance) / dark (25th percentile)
hex values for each named region. The region boxes are image pixel
coordinates in reference/hero.png (1536 x 1024). Used to build
docs/REFERENCE_SPEC.md and blender/kd/palette.py.

    python3 tools/sample_reference.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

REGIONS = {
    "sky": (1400, 0, 1536, 60),
    "distant mountain": (0, 60, 50, 130),
    "grass rim": (1150, 660, 1200, 700),
    "grass foreground": (560, 960, 620, 1010),
    "topsoil wall": (500, 390, 560, 440),
    "cobble stone band": (540, 473, 593, 500),
    "stone face upper": (820, 373, 887, 393),
    "coal band": (767, 393, 820, 420),
    "crystal cavern": (773, 480, 873, 527),
    "magma floor": (720, 693, 887, 733),
    "lava glow": (833, 653, 873, 673),
    "crystal purple": (778, 508, 795, 535),
    "crystal cyan": (722, 425, 738, 455),
    "board face": (1300, 300, 1480, 420),
    "logo gold": (620, 60, 700, 100),
    "logo white": (600, 150, 700, 190),
    "gate stone": (880, 60, 920, 120),
    "sand plaza": (1180, 900, 1240, 960),
    "portal": (1180, 760, 1220, 820),
    "relic ring": (1330, 540, 1420, 600),
    "pro obby sign": (1100, 140, 1200, 180),
    "beginner neon": (270, 220, 300, 300),
    "pond": (30, 590, 80, 620),
    "waterfall": (110, 500, 150, 560),
    "canopy": (560, 720, 640, 780),
    "pedestal": (90, 800, 170, 840),
}


def hexc(c):
    return "#%02X%02X%02X" % tuple(int(x) for x in c)


def main():
    img = np.asarray(Image.open(ROOT / "reference" / "hero.png").convert("RGB")).astype(int)
    for name, (x0, y0, x1, y1) in REGIONS.items():
        px = img[y0:y1, x0:x1].reshape(-1, 3)
        lum = px.sum(1)
        mid = np.median(px, axis=0)
        light = np.median(px[lum >= np.percentile(lum, 75)], axis=0)
        dark = np.median(px[lum <= np.percentile(lum, 25)], axis=0)
        print(f"{name:22s} light {hexc(light)}  mid {hexc(mid)}  dark {hexc(dark)}")


if __name__ == "__main__":
    main()
