"""App screenshots for the website: PNGs captured from the web build at 390×844 → site/img/s/<name>.webp.
Usage (repo root): python3 tools/site/shots.py <folder of PNGs>   (name a file home_fr.png to give French its own version)."""
import os, sys
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots/site'
os.makedirs('site/img/s', exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    im = Image.open(f'{src}/{f}').convert('RGB')
    w = 640; h = round(w * 844 / 390)
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).crop((0, 0, w, h))
    im.save(f'site/img/s/{f[:-4]}.webp', 'WEBP', quality=82, method=6)
    print(f[:-4])
