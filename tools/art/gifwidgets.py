"""Widget illustrations from the Honey & Tabby GIFs (widgets can't animate: one frame each).
Usage (repo root): python3 tools/art/gifwidgets.py   — then bump VERSION in src/native/widgets/art.ts."""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gifkit import frames  # noqa: E402

OUT = 'assets/art/widgets'


def still(name, i=0):
    f = frames(name)[0][i]
    im = Image.fromarray(f)
    ys, xs = np.where(f[:, :, 3] > 10)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def square(name, i=0, size=440):
    im = still(name, i)
    im.thumbnail((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, size - im.height))
    out.save(f'{OUT}/{name_map[name]}.png', optimize=True)


def wide(names, out_name, w=900, h=360):
    ims = [still(n, i) for n, i in names]
    for im in ims:
        im.thumbnail((w // len(ims), h), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    x = (w - sum(im.width for im in ims) - 30 * (len(ims) - 1)) // 2
    for im in ims:
        out.alpha_composite(im, (x, h - im.height))
        x += im.width + 30
    out.save(f'{OUT}/{out_name}.png', optimize=True)


name_map = {'dog_cheer': 'care', 'dog_trot': 'walk', 'duo_camera': 'moment', 'cat_eat': 'pantry', 'duo_party': 'done', 'cat_bed': 'sleep'}
for n in name_map:
    square(n)
wide([('dog_trot', 2), ('cat_trot', 2)], 'walk_wide')
wide([('dog_eat', 0), ('cat_eat', 0)], 'restock_wide')
print('ok')
