"""Care / section illustrations (ChatGPT, Nov 2026) → 512 px square webp in assets/art/care2.
Drops the faint halo pixels the generator leaves, trims to content and centres on a square.
Usage: python3 tools/art/careicons.py <src_dir_or_files…>  (see MAP for the names)"""
import sys
from PIL import Image

MAP = {
    '96fb2a64-image.png': 'meal', '7c4887be-image.png': 'water', 'd4adf5f2-image.png': 'walk',
    'f37ddd04-image.png': 'play', '2077921e-image.png': 'grooming', '9e7b11bb-image.png': 'sleep',
    '1e7ffacf-image.png': 'litter', '951278c6-image.png': 'medication', '33fa3c76-image.png': 'records',
    'ad1b1f73-image.png': 'calendar',
    # second batch (2 Nov): paw prints are the walk, the medicine scene is medication
    '41fa554f-image.png': 'walk', '96629b93-image.png': 'medication',
}
# the leash from the first batch stays available as walk_leash
RENAME = {('d4adf5f2-image.png', 'walk'): 'walk_leash'}
src, out = sys.argv[1], sys.argv[2]
for f, name in MAP.items():
    name = RENAME.get((f, name), name)
    im = Image.open(f'{src}/{f}').convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # halo: faint, near-white specks around the art
            if a < 70 and min(r, g, b) > 170:
                px[x, y] = (0, 0, 0, 0)
            elif a < 18:
                px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    im = im.crop(bbox)
    side = int(max(im.size) * 1.04)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
    sq = sq.resize((512, 512), Image.LANCZOS)
    sq.save(f'{out}/{name}.webp', 'WEBP', quality=92, method=6)
    print(name, bbox)
