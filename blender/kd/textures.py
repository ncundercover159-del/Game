"""Hand-painted pixel-noise texture atlas (numpy, no Blender needed).

Each material key gets one tile: a 34x34 pixel-art face upscaled x3 with
nearest filtering, built from the palette's light/mid/dark values with
per-pixel noise, a darker rim (fake AO), a lighter top-left edge and a
material-specific motif (grass blades, planks, cobbles, cracks, facets...).
The atlas is 1024x1024 (10x10 tiles of 102 px): texel density ~25 px/stud.
"""
from pathlib import Path

import numpy as np
from PIL import Image

from palette import MATERIALS

GRID = 10
TILE = 102
ART = 34
ATLAS = GRID * TILE


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def tile_for(key, rng):
    light, mid, dark = (hexrgb(c) for c in MATERIALS[key][1])
    n = ART
    noise = rng.random((n, n))
    img = np.where(noise[..., None] < 0.22, dark, np.where(noise[..., None] > 0.8, light, mid)).astype(np.float32)
    img *= (0.94 + 0.12 * rng.random((n, n)))[..., None]
    yy, xx = np.mgrid[0:n, 0:n]
    k = key
    if k.startswith("grass") or k in ("moss", "fern"):
        for _ in range(40):
            x, y = rng.integers(0, n), rng.integers(0, n - 3)
            img[y:y + 3, x] = light * 1.08
    elif k in ("wood", "wood_dark", "trunk"):
        for row in range(0, n, 8):
            img[row, :] = dark * 0.85
        img[:, ::3] *= 0.96
    elif k in ("cobble", "stone_block", "gate_stone", "portal_stone", "pedestal", "pedestal_dark"):
        for _ in range(9):
            cx, cy, r = rng.integers(0, n), rng.integers(0, n), rng.integers(4, 9)
            mask = (xx - cx) ** 2 + (yy - cy) ** 2 < r * r
            img[mask] = img[mask] * 0.6 + light * 0.4
            ring = ((xx - cx) ** 2 + (yy - cy) ** 2 >= r * r) & ((xx - cx) ** 2 + (yy - cy) ** 2 < (r + 1) ** 2)
            img[ring] = dark * 0.8
    elif k in ("lava", "magma_floor", "magma_rock"):
        for _ in range(6):
            x, y = rng.integers(0, n), rng.integers(0, n)
            for _ in range(14):
                img[y % n, x % n] = np.array([255, 170, 60]) if k != "magma_rock" else light
                x += rng.integers(-1, 2)
                y += rng.integers(0, 2)
    elif k.startswith("crystal") or k in ("cavern",):
        img[(xx + yy) % 11 == 0] = light * 1.1
    elif k in ("coal",):
        sparkle = rng.random((n, n)) > 0.97
        img[sparkle] = np.array([255, 160, 70])
    elif k in ("sand", "sand_dark"):
        img[rng.random((n, n)) > 0.95] = dark * 0.9
    # rim AO and top-left highlight
    rim = np.minimum.reduce([xx, yy, n - 1 - xx, n - 1 - yy])
    img[rim == 0] *= 0.7
    img[rim == 1] *= 0.85
    img[(xx == 1) & (rim > 0)] = img[(xx == 1) & (rim > 0)] * 0.7 + light * 0.3
    img[(yy == 1) & (rim > 0)] = img[(yy == 1) & (rim > 0)] * 0.7 + light * 0.3
    img = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(img, "RGB").resize((TILE, TILE), Image.NEAREST)


def build_atlas(out_path: Path, seed=11):
    rng = np.random.default_rng(seed)
    atlas = Image.new("RGB", (ATLAS, ATLAS), (255, 0, 255))
    index = {}
    for i, key in enumerate(sorted(MATERIALS)):
        if i >= GRID * GRID:
            raise RuntimeError("atlas full")
        gx, gy = i % GRID, i // GRID
        atlas.paste(tile_for(key, rng), (gx * TILE, gy * TILE))
        index[key] = (gx, gy)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out_path)
    return index


def tile_uv(index, key):
    """UV rect (u0, v0, u1, v1) of a key's tile, with a half-texel inset."""
    gx, gy = index[key]
    inset = 1.5 / ATLAS
    u0 = gx / GRID + inset
    u1 = (gx + 1) / GRID - inset
    v1 = 1 - gy / GRID - inset
    v0 = 1 - (gy + 1) / GRID + inset
    return u0, v0, u1, v1
