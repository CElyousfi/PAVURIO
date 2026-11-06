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


def _warp(img, flow, t):
    """sample img at p + t*flow (backward warp)"""
    h, w = flow.shape[:2]
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(img, gx + flow[:, :, 0] * t, gy + flow[:, :, 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


_dis = None


def _flow(a, b):
    """dense flow a→b on premultiplied gray, computed at half size for speed"""
    global _dis
    if _dis is None:
        _dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    def g(x):
        A = x[:, :, 3:4].astype(np.float32) / 255
        y = cv2.cvtColor((x[:, :, :3] * A).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        return cv2.resize(y, (x.shape[1] // 2, x.shape[0] // 2), interpolation=cv2.INTER_AREA)
    f = _dis.calc(g(a), g(b), None)
    f = cv2.resize(f, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_LINEAR) * 2
    return f


def inbetween(a, b, t):
    """a frame at t (0..1) between RGBA frames a and b: both are warped towards t along the motion and
    blended, so shapes move instead of cross-fading."""
    fab = _flow(a, b)  # a(p) ~ b(p + fab)
    fba = _flow(b, a)
    af = a.astype(np.float32)
    bf = b.astype(np.float32)
    # premultiply so transparent pixels never bleed colour
    def pm(x):
        y = x.copy(); y[:, :, :3] *= y[:, :, 3:4] / 255; return y
    wa = _warp(pm(af), fba, t)        # content of a moved forward by t
    wb = _warp(pm(bf), fab, 1 - t)    # content of b moved back by 1-t
    o = wa * (1 - t) + wb * t
    A = np.clip(o[:, :, 3:4], 1e-3, 255)
    rgb = np.where(o[:, :, 3:4] > 0.5, o[:, :, :3] * 255 / A, 0)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(o[:, :, 3], 0, 255)]).astype(np.uint8)


def smooth_frames(fr, factor, loop=True):
    """insert factor-1 in-betweens between consecutive frames (and from the last back to the first when looping)"""
    out = []
    n = len(fr)
    pairs = n if loop else n - 1
    for i in range(pairs):
        a, b = fr[i], fr[(i + 1) % n]
        out.append(a)
        for k in range(1, factor):
            out.append(inbetween(a, b, k / factor))
    if not loop:
        out.append(fr[-1])
    return out
