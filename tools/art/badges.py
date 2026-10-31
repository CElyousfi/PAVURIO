"""Cut GPT's 14 badge medals out of docs/art/gpt-badges/sheet.png (already transparent) into
assets/art/badges/<key>.webp at 512 px (EDSR 4x, then downscaled). Order = reading order of the sheet.
Usage: EDSR_MODEL=/path/EDSR_x4.pb python3 tools/art/badges.py"""
import cv2, numpy as np, os
from PIL import Image

KEYS = [
    'family', 'hydration', 'first_log', 'walker', 'streak3',
    'groomer', 'routine', 'record', 'weight', 'meds',
    'birthday', 'moment', 'streak7', 'challenge1',
]
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(os.environ.get('EDSR_MODEL', 'EDSR_x4.pb'))
sr.setModel('edsr', 4)
src = np.array(Image.open('docs/art/gpt-badges/sheet.png').convert('RGBA'))
solid = (src[:, :, 3] > 100).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
boxes = [tuple(int(v) for v in st[i, :4]) for i in range(1, n) if st[i, 4] > 20000]
boxes.sort(key=lambda b: (round(b[1] / 300), b[0]))
assert len(boxes) == len(KEYS), len(boxes)
os.makedirs('assets/art/badges', exist_ok=True)
for key, (x, y, w, h) in zip(KEYS, boxes):
    p = 10
    x0, y0, x1, y1 = max(0, x - p), max(0, y - p), min(src.shape[1], x + w + p), min(src.shape[0], y + h + p)
    crop = src[y0:y1, x0:x1].copy()
    # keep only this badge (the soft glow of the neighbours can bleed into the box)
    sub = (lab[y0:y1, x0:x1] == lab[y + h // 2, x + w // 2]) | (crop[:, :, 3] < 100)
    a = crop[:, :, 3].astype(np.float32)
    own = cv2.dilate((lab[y0:y1, x0:x1] == lab[y + h // 2, x + w // 2]).astype(np.uint8), np.ones((9, 9), np.uint8))
    a = np.where(own > 0, a, 0)
    a = np.where(a > 100, a, 0)  # drop the faint glow: medals sit on our own cards
    rgb = crop[:, :, :3]
    big = cv2.cvtColor(sr.upsample(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)), cv2.COLOR_BGR2RGB)
    A = cv2.resize(a, (a.shape[1] * 4, a.shape[0] * 4), interpolation=cv2.INTER_LINEAR)
    A = cv2.GaussianBlur(A, (0, 0), 1.0).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([big, A]))
    im = im.crop(im.getbbox())
    im.thumbnail((512, 512), Image.LANCZOS)
    out = f'assets/art/badges/{key}.webp'
    im.save(out, 'WEBP', quality=90, method=6)
    print(key, im.size, os.path.getsize(out) // 1024, 'KB', flush=True)
