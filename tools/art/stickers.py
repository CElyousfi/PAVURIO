"""Honey & Tabby sticker sheets (ChatGPT, 2 Nov 2026) → assets/art/stickers/<name>.webp (512 px, transparent).
Each sheet is a transparent PNG laid out on a regular grid; cells are cut, cleaned of halo specks, trimmed
and centred on a square. Usage: python3 tools/art/stickers.py <uploads_dir> <out_dir>"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SHEETS = {
    '7474b705': (4, 2, ['dog_wave', 'dog_sleep', 'dog_jump', 'dog_please', 'cat_happy', 'cat_sleep', 'cat_cheer', 'cat_curious']),
    '246d73ba': (3, 2, ['dog_trot', 'cat_drink', 'dog_eat', 'cat_medicine', 'dog_bath', 'cat_bed']),
    'fca49f41': (3, 2, ['dog_sunny', 'cat_cloudy', 'dog_rain', 'cat_hot', 'dog_cold', 'cat_night']),
    '6ef43a89': (3, 2, ['dog_party', 'cat_passport', 'dog_love', 'cat_wave', 'duo_hug', 'dog_trophy']),
}

def clean(a):
    rgb, al = a[:, :, :3], a[:, :, 3]
    a[((al < 70) & (rgb.min(axis=2) > 170)) | (al < 18), 3] = 0
    return a

def square(im, size=512, pad=0.04):
    bb = im.getbbox()
    im = im.crop(bb)
    side = int(max(im.size) * (1 + 2 * pad))
    sq = Image.new('RGBA', (side, side), (255, 255, 255, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return sq.resize((size, size), Image.LANCZOS)

src, out = sys.argv[1], sys.argv[2]
for key, (cols, rows, names) in SHEETS.items():
    a = clean(np.array(Image.open(f'{src}/{key}-image.png').convert('RGBA')))
    h, w = a.shape[:2]
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        ca = a[r * h // rows:(r + 1) * h // rows, c * w // cols:(c + 1) * w // cols].copy()
        # drop bits of the neighbouring stickers: pieces that touch the cell's edge
        lab, n = ndimage.label(ca[:, :, 3] > 0)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        sizes = ndimage.sum(np.ones_like(lab), lab, range(n + 1))
        big = sizes[1:].max() if n else 0
        for k in edge:
            if sizes[k] < 0.15 * big:
                ca[lab == k, 3] = 0
        cell = Image.fromarray(ca)
        square(cell).save(f'{out}/{name}.webp', 'WEBP', quality=92, method=4)
print('ok')
