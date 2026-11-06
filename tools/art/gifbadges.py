"""Medals that show the pets get the new Honey & Tabby (docs/art/gifs). The medal frame and ribbon of the
original art (docs/art/badge-src) are kept; the picture inside is repainted and the pet pasted in.
Usage (repo root): python3 tools/art/gifbadges.py   (after tools/art/gifstickers.py)"""
import cv2
import numpy as np
from PIL import Image

STILL = 'assets/art/pets/still'


def load(p):
    return np.array(Image.open(p).convert('RGBA')).astype(np.float32)


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def pet(name, width):
    im = Image.open(f'{STILL}/{name}.png').convert('RGBA')
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 10)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    h = int(im.height * width / im.width)
    return np.array(im.resize((width, h), Image.LANCZOS)).astype(np.float32)


def over(dst, src, x, y):
    """alpha-composite src (float RGBA) onto dst at x,y (bottom-left anchoring done by caller)."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    a = s[:, :, 3:4] / 255
    d[:, :, :3] = s[:, :, :3] * a + d[:, :, :3] * (1 - a)
    d[:, :, 3:4] = np.maximum(d[:, :, 3:4], s[:, :, 3:4])


def disc_fill(img, mask, top, bottom, feather=1.2, glow_amt=0.28):
    """paint the masked area with a soft vertical gradient (top → bottom colour) and a gentle glow."""
    H, W = img.shape[:2]
    t = np.linspace(0, 1, H)[:, None, None]
    g = hexc(top) * (1 - t) + hexc(bottom) * t
    g = np.broadcast_to(g, (H, W, 3)).copy()
    yy, xx = np.mgrid[0:H, 0:W]
    ys, xs = np.where(mask)
    cx, cy = xs.mean(), ys.min() + (ys.max() - ys.min()) * 0.38
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2
    glow = np.clip(1 - np.hypot(xx - cx, yy - cy) / r, 0, 1)[:, :, None] ** 1.6
    g = g + (255 - g) * glow * glow_amt
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), feather)[:, :, None]
    img[:, :, :3] = img[:, :, :3] * (1 - m) + g * m


def ellipse(shape, cx, cy, rx, ry):
    m = np.zeros(shape[:2], np.uint8)
    cv2.ellipse(m, (int(cx), int(cy)), (int(rx), int(ry)), 0, 0, 360, 1, -1)
    return m.astype(bool)


def keep_rows(dst, orig, y_from=None, y_to=None):
    sl = slice(y_from, y_to)
    a = orig[sl, :, 3:4] / 255
    dst[sl, :, :3] = orig[sl, :, :3] * a + dst[sl, :, :3] * (1 - a)
    dst[sl, :, 3:4] = np.maximum(dst[sl, :, 3:4], orig[sl, :, 3:4])


def save(img, path):
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path, 'WEBP', quality=86, alpha_quality=90, method=6)


# (badge, pet, disc ellipse cx, cy, rx, ry, gradient top/bottom, pet width, pet bottom y, keep original from y)
MEDALS = [
    # name, pet, ellipse cx, cy, rx, ry, top, bottom, feather, glow, pet width, pet bottom, keep original from y
    ('family', 'duo_hug', 246, 236, 214, 214, '#A45BD0', '#6E2F9B', 1.2, 0.28, 330, 392, 384),
    ('moment', 'duo_camera', 249, 242, 222, 222, '#9ED8F5', '#7CC24F', 1.2, 0.28, 330, 380, 372),
    ('streak3', 'cat_doze', 252, 222, 168, 140, '#EC6690', '#E95E8B', 9, 0.12, 240, 338, 312),
    ('streak7', 'duo_cuddle', 229, 236, 212, 208, '#22306A', '#1D2A5C', 1.2, 0.1, 320, 380, 338),
    ('walker', 'dog_trot', 232, 262, 158, 168, '#45C058', '#3AB853', 8, 0.08, 270, 415, 418),
]
for name, p, cx, cy, rx, ry, top, bottom, feather, glow, pw, pb, keep_from in MEDALS:
    orig = load(f'docs/art/badge-src/{name}.webp')
    img = orig.copy()
    m = ellipse(img.shape, cx, cy, rx, ry)
    m[keep_from:] = False
    disc_fill(img, m, top, bottom, feather, glow)
    if name == 'streak7':
        # the moon and stars come back (yellow shapes in the sky above the pets)
        hsv0 = cv2.cvtColor(orig[:, :, :3].astype(np.uint8), cv2.COLOR_RGB2HSV)
        sky = (hsv0[:, :, 0] >= 18) & (hsv0[:, :, 0] <= 34) & (hsv0[:, :, 1] > 90) & (hsv0[:, :, 2] > 150)
        sky[150:] = False
        sky = cv2.dilate(sky.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        img = np.where(sky[:, :, None], orig, img)
    pa = pet(p, pw)
    over(img, pa, int(cx - pw / 2), int(pb - pa.shape[0]))
    if name == 'streak7':
        # the pets sit inside the blanket: give back only the blanket (purple) below its top edge
        hsv = cv2.cvtColor(orig[:, :, :3].astype(np.uint8), cv2.COLOR_RGB2HSV)
        blanket = (hsv[:, :, 0] >= 125) & (hsv[:, :, 0] <= 160) & (hsv[:, :, 1] > 60)
        blanket[:keep_from] = False
        blanket[keep_from + 40:] = True
        img = np.where(blanket[:, :, None], orig, img)
    else:
        keep_rows(img, orig, keep_from)  # ribbon (and the cushion the cat sleeps on)
    save(img, f'assets/art/badges/{name}.webp')
    print(name)

# first walk: Honey peeks over the big paw, leaves on each side
orig = load('docs/art/badge-src/badge_first.webp')
img = np.zeros_like(orig)
pa = pet('dog_wave', 300)
over(img, pa, 256 - 150, 400 - pa.shape[0])
hsv = cv2.cvtColor(orig[:, :, :3].astype(np.uint8), cv2.COLOR_RGB2HSV)
leaf = (hsv[:, :, 0] >= 35) & (hsv[:, :, 0] <= 72) & (hsv[:, :, 1] > 80)
low = np.zeros(leaf.shape, bool)
low[318:] = True
sel = (leaf | low)[:, :, None] & (orig[:, :, 3:4] > 0)
img = np.where(sel, orig, img)
save(img, 'assets/art/adventures/badge_first.webp')
print('badge_first')
