"""Memory Card templates: swap the little pet in each card's corner for the new Honey & Tabby.
The old pet is painted out (inpainted from the card's flat colours around it) and a frame of the GIFs is
placed where it stood. Sources: docs/art/memories-src (the original templates). Writes assets/memories.
Usage (repo root): python3 tools/art/gifmemories.py"""
import os, sys
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gifkit import frames  # noqa: E402

SRC, OUT = 'docs/art/memories-src', 'assets/memories'
# template: (pet box in the 1080x1350 post as x0, y0, x1, y1, new pet, frame)
PETS = {
    'adventures': ((790, 1108, 990, 1312), 'dog_trot', 2),
    'bestfriend': ((100, 1118, 284, 1312), 'cat_wave', 3),
    'birthday': ((755, 1132, 945, 1335), 'dog_cheer', 3),
    'daily': ((786, 1148, 1012, 1332), 'dog_wave', 0),
    'gotcha': ((84, 1112, 284, 1312), 'cat_happy', 0),
    'home': ((96, 1116, 284, 1312), 'cat_happy', 4),
    'littlethings': ((780, 1146, 994, 1314), 'cat_doze', 0),
    'month': ((776, 1146, 1012, 1334), 'dog_wave', 3),
    'thennow': ((806, 1146, 1012, 1334), 'dog_cheer', 0),
    'year': ((776, 1152, 1012, 1336), 'dog_cheer', 0),
}


def pet_mask(rgb, box, opaque, pad=40, tol=10):
    """Around the box, the old pet is everything that isn't one of the card's own flat colours
    (the colours that cover large areas of the template; the pet's colours never do)."""
    H, W = rgb.shape[:2]
    x0, y0, x1, y1 = max(0, box[0] - pad), max(0, box[1] - pad), min(W, box[2] + pad), min(H, box[3] + pad)
    outside = opaque.copy()
    outside[y0:y1, x0:x1] = False
    q, cnt = np.unique((rgb[outside] // 6), axis=0, return_counts=True)
    pal = (q[cnt > 2500] * 6 + 3).astype(np.int32)
    inside = rgb[y0:y1, x0:x1].astype(np.int32)
    d = np.full(inside.shape[:2], 1e9)
    for c in pal:
        d = np.minimum(d, np.linalg.norm(inside - c[None, None, :], axis=2))
    m = (d > tol).astype(np.uint8)
    # the old pet's dark outline can match a dark card colour: inside the pet's own box it is pet
    bx0, by0, bx1, by1 = box[0] - x0, box[1] - y0, box[2] - x0, box[3] - y0
    dark = inside[by0:by1, bx0:bx1].max(axis=2) < 120
    m[by0:by1, bx0:bx1] |= dark.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    # the pet is one solid shape: fill its holes (white muzzle, belly…)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] > 120:
            keep[lab == i] = 1
    filled = keep.copy()
    h, w = filled.shape
    flood = np.zeros((h + 2, w + 2), np.uint8)
    inv = (1 - filled).copy()
    cv2.floodFill(inv, flood, (0, 0), 0)
    filled = filled | inv
    # the old pet's outline is roughly convex: take its hull so pale bits (muzzle, paws) go too
    pts = cv2.findNonZero(filled)
    if pts is not None:
        hull = cv2.convexHull(pts)
        cv2.fillConvexPoly(filled, hull, 1)
    full = np.zeros((H, W), np.uint8)
    full[y0:y1, x0:x1] = filled
    return cv2.dilate(full, np.ones((5, 5), np.uint8)), pal


def fill_flat(rgb, mask, pal, opaque, tol=7):
    """Repaint the masked area with the card's flat colours: every pixel takes the colour of the nearest
    clean pixel (one that is exactly a card colour), so region edges stay crisp instead of smeared."""
    d = np.full(rgb.shape[:2], 1e9)
    near = np.zeros(rgb.shape[:2], np.int32)
    for k, c in enumerate(pal):
        dk = np.linalg.norm(rgb.astype(np.int32) - c[None, None, :], axis=2)
        better = dk < d
        near[better] = k
        d = np.minimum(d, dk)
    clean = (d <= tol) & (mask == 0) & opaque & (rgb.max(axis=2) > 120)
    # sources come from inside flat areas only: thin outlines (photo-frame edges) never spread
    clean = cv2.erode(clean.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    _, lab = cv2.distanceTransformWithLabels((~clean).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.where(clean)
    # label i (1-based) corresponds to the i-th zero pixel in row-major order
    order = np.zeros(lab.max() + 1, np.int32)
    flat_idx = np.flatnonzero(clean.ravel())
    order[1:len(flat_idx) + 1] = flat_idx
    src = order[lab]
    fill = pal[near.ravel()[src.ravel()]].reshape(rgb.shape).astype(np.float32)
    soft = cv2.GaussianBlur(fill, (0, 0), 1.0)
    m = cv2.GaussianBlur((mask > 0).astype(np.float32), (0, 0), 1.0)[:, :, None]
    return np.clip(rgb * (1 - m) + soft * m, 0, 255).astype(np.uint8)


def new_pet(name, i, height):
    f = frames(name)[0][i]
    ys, xs = np.where(f[:, :, 3] > 10)
    im = Image.fromarray(f).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return im.resize((max(1, int(im.width * height / im.height)), height), Image.LANCZOS)


def locate(story, post_rgb, box):
    """The story template places the same pet lower: find it by matching the post's corner."""
    x0, y0, x1, y1 = box
    tpl = post_rgb[y0:y1, x0:x1]
    H = story.shape[0]
    region = story[int(H * 0.6):, :, :3]
    r = cv2.matchTemplate(region, tpl, cv2.TM_CCOEFF_NORMED)
    _, score, _, (x, y) = cv2.minMaxLoc(r)
    y += int(H * 0.6)
    return (x, y, x + (x1 - x0), y + (y1 - y0)), score


for tid, (box, pet, fi) in PETS.items():
    post = np.array(Image.open(f'{SRC}/{tid}_post.png').convert('RGBA'))
    story = np.array(Image.open(f'{SRC}/{tid}_story.png').convert('RGBA'))
    sbox, score = locate(story, post[:, :, :3], box)
    for kind, img, b in (('post', post, box), ('story', story, sbox)):
        rgb = img[:, :, :3].copy()
        opaque = img[:, :, 3] > 250
        m, pal = pet_mask(rgb, b, opaque)
        m[~opaque] = 0
        out = Image.fromarray(np.dstack([fill_flat(rgb, m, pal, opaque), img[:, :, 3]]))
        # the new pet covers where the old one stood: as tall as its shape, centred on it
        ys, xs = np.where(m > 0)
        y1 = min(b[3], int(ys.max()) - 4)
        h = int((y1 - ys.min()) * 1.02)
        p = new_pet(pet, fi, h)
        cx = (b[0] + b[2]) / 2
        out.alpha_composite(p, (int(cx - p.width / 2), y1 - p.height))
        out.save(f'{OUT}/{tid}_{kind}.png', optimize=True)
    print(tid, 'story match %.2f' % score, sbox, flush=True)
