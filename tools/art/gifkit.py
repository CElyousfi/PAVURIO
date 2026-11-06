"""Shared loader for the Honey & Tabby GIFs (docs/art/gifs, Nov 2026): every pet picture in the app comes
from these. A GIF has a palette and 1-bit transparency, so each frame is cleaned before use:
  - colours are bled outward under the transparent area (no dark/white fringe when scaled);
  - it is upscaled 2x and the edge gets a soft, anti-aliased alpha instead of GIF stair-steps.
`frames(name)` returns (list of RGBA uint8 arrays at 2x, list of durations in ms)."""
import os
import cv2
import numpy as np
from PIL import Image, ImageSequence

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'docs', 'art', 'gifs')
UP = 2


def _bleed(rgb, known, passes=4):
    rgb = rgb.astype(np.float32)
    m = known.astype(np.float32)
    out = rgb * m[:, :, None]
    for _ in range(passes):
        w = cv2.blur(m, (5, 5))
        c = cv2.blur(out, (5, 5))
        fill = (m == 0) & (w > 0)
        out[fill] = c[fill] / w[fill][:, None]
        m = np.where(fill, 1.0, m)
    return np.clip(out, 0, 255).astype(np.uint8)


def clean(rgba):
    a = rgba[:, :, 3] > 127
    # isolated transparent/opaque specks from GIF dithering
    a = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
    rgb = _bleed(rgba[:, :, :3], a)
    H, W = a.shape
    big = cv2.resize(rgb, (W * UP, H * UP), interpolation=cv2.INTER_CUBIC)
    # a whisper of smoothing removes GIF dither dots without blurring the drawing
    big = cv2.bilateralFilter(big, 5, 18, 3)
    A = cv2.resize(a.astype(np.float32), (W * UP, H * UP), interpolation=cv2.INTER_LINEAR)
    A = cv2.GaussianBlur(A, (0, 0), 1.1)
    A = np.clip((A - 0.32) / 0.36, 0, 1)
    return np.dstack([big, (A * 255).astype(np.uint8)])


_cache = {}


def frames(name):
    if name not in _cache:
        im = Image.open(os.path.join(SRC, f'{name}.gif'))
        fr, d = [], []
        for f in ImageSequence.Iterator(im):
            fr.append(clean(np.array(f.convert('RGBA'))))
            d.append(int(f.info.get('duration') or 120))
        _cache[name] = (fr, d)
    return _cache[name]


def main_mask(alpha):
    """The character itself: the biggest connected shape (props, sparkles and confetti are separate)."""
    m = (alpha > 40).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return m.astype(bool)
    i = 1 + int(np.argmax(st[1:, 4]))
    keep = lab == i
    return cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0


def to_webp(rgba, path, quality=82, alpha_quality=90):
    Image.fromarray(rgba).save(path, 'WEBP', quality=quality, alpha_quality=alpha_quality, method=6)
