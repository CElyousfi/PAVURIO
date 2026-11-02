"""Pavurio Adventures art, final set (ChatGPT, 2 Nov 2026) → assets/art/adventures/*.webp.
Single pieces arrive as transparent 1254 px PNGs; time-of-day tiles and the screen pieces arrive as two
labelled sheets and are cut here (labels dropped, tile corners re-rounded).
Usage: python3 tools/art/adventures2.py <uploads_dir> <out_dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
SINGLE = {
    'be81599e': ('badge_first', 512), '01cf3719': ('badge_early', 512), 'f9ab5304': ('badge_golden', 512),
    '6c9fb717': ('badge_cloud', 512), 'ba9ee362': ('badge_spring', 512), 'f00b4127': ('badge_five', 512),
    'f7e56aaf': ('badge_ten', 512), 'fe14ee6a': ('badge_together', 512),
    'c96e76d2': ('w_sunny', 384), 'ba7646cb': ('w_partly', 384), 'b82bce33': ('w_cloudy', 384), '674360ba': ('w_rainy', 384),
    '45be99a7': ('w_storm', 384), '852fa32b': ('w_snow', 384), '0f6452c7': ('w_hot', 384), '17cee982': ('w_cold', 384),
    'afefd0bf': ('w_night', 384),
}

def clean(im):
    """drop the faint halo specks the generator leaves around the art"""
    a = np.array(im.convert('RGBA'))
    rgb, al = a[:, :, :3], a[:, :, 3]
    halo = (al < 70) & (rgb.min(axis=2) > 170)
    a[halo | (al < 18), 3] = 0
    return Image.fromarray(a)

def square(im, size, pad=0.03):
    im = im.crop(im.getbbox())
    side = int(max(im.size) * (1 + 2 * pad))
    sq = Image.new('RGBA', (side, side), (255, 255, 255, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return sq.resize((size, size), Image.LANCZOS)

for key, (name, size) in SINGLE.items():
    square(clean(Image.open(f'{src}/{key}-image.png')), size).save(f'{out}/{name}.webp', 'WEBP', quality=92, method=6)

def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=r, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(1))
    o = im.convert('RGBA')
    o.putalpha(m)
    return o

# time of day: five rounded tiles on a cream sheet (inset a few px so no cream shows at the edges)
sheet = Image.open(f'{src}/4918ccea-image.png').convert('RGB')
TOD = {'t_morning': (44, 44, 379, 296), 't_afternoon': (490, 44, 823, 296), 't_golden': (935, 44, 1269, 296), 't_evening': (44, 519, 380, 771), 't_night': (489, 519, 825, 771)}
for name, box in TOD.items():
    tile = rounded(sheet.crop(box), 46).resize((512, 384), Image.LANCZOS)
    tile.save(f'{out}/{name}.webp', 'WEBP', quality=92, method=6)

# screen pieces from the second sheet (transparent), labels are below each piece
s2 = clean(Image.open(f'{src}/63a973f5-image.png'))
PIECES = {'passport_cover': ((29, 10, 438, 416), 512), 'walk_ready': ((36, 490, 495, 936), 512), 'stopwatch': ((571, 490, 882, 936), 384), 'adventure_saved': ((958, 490, 1495, 936), 512)}
for name, (box, size) in PIECES.items():
    square(s2.crop(box), size).save(f'{out}/{name}.webp', 'WEBP', quality=92, method=6)
scene = s2.crop((489, 10, 1518, 416))
scene = scene.crop(scene.getbbox())
scene.resize((1536, int(1536 * scene.height / scene.width)), Image.LANCZOS).save(f'{out}/walk_scene.webp', 'WEBP', quality=90, method=6)
print('ok')
