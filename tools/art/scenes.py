"""Cut approved scene tiles out of ChatGPT's illustration sheets and make production assets.

Sheets (docs/art/gpt-scenes/source): sheet_a/sheet_b = 10 portrait scenes each, sheet_c = 30 small scenes,
duo_hero.png = 1254 px transparent hero. Tiles are found automatically (rounded cards on white), the
white outside each card becomes transparent, then EDSR 4x (same model as the cat, set EDSR_MODEL) and a
resize so the longest side is 1024 px. Output: assets/art/scenes/<name>.webp
Usage: EDSR_MODEL=/path/EDSR_x4.pb python3 tools/art/scenes.py
"""
import cv2, numpy as np, os
from PIL import Image

SRC = 'docs/art/gpt-scenes/source'
OUT = 'assets/art/scenes'
os.makedirs(OUT, exist_ok=True)
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(os.environ.get('EDSR_MODEL', 'EDSR_x4.pb'))
sr.setModel('edsr', 4)

# name -> (sheet, tile index in reading order). Choices and rejections: docs/art/ILLUSTRATION_AUDIT_01_02.md
PICK = {
    'premium': ('b', 9),
    'records': ('b', 7),
    'moments': ('b', 8),
    'walk': ('a', 4),
    'play': ('b', 5),
    'bath': ('b', 6),
    'meals': ('b', 3),
    'night': ('b', 2),
    'appointments': ('c', 5),
    'vet': ('c', 6),
    'medication': ('c', 7),
    'vaccine': ('c', 8),
    'weigh': ('c', 9),
    'trophy': ('c', 11),
    'brushing': ('c', 16),
    'bed': ('c', 17),
    'water': ('c', 3),
}

def tiles(sheet):
    img = np.array(Image.open(f'{SRC}/sheet_{sheet}.png').convert('RGB'))
    im = img.astype(int)
    nonwhite = ((im.min(2) < 238) | ((im.max(2) - im.min(2)) > 14)).astype(np.uint8)
    nonwhite = cv2.morphologyEx(nonwhite, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(nonwhite, 8)
    boxes = [tuple(int(v) for v in st[i, :4]) for i in range(1, n) if st[i, 4] > 20000]
    boxes = [b for b in boxes if not any(o != b and o[0] <= b[0] and o[1] <= b[1] and o[0] + o[2] >= b[0] + b[2] and o[1] + o[3] >= b[1] + b[3] for o in boxes)]
    boxes.sort(key=lambda b: (round(b[1] / 100), b[0]))
    return img, nonwhite, boxes

def cut(sheet, idx):
    img, nonwhite, boxes = tiles(sheet)
    x, y, w, h = boxes[idx]
    rgb = img[y:y + h, x:x + w].copy()
    # card silhouette: a rounded rectangle (flood-filling the white would eat white clouds that touch the edge)
    r = round(0.085 * min(w, h))
    alpha = np.zeros((h, w), np.uint8)
    cv2.rectangle(alpha, (r, 0), (w - 1 - r, h - 1), 255, -1)
    cv2.rectangle(alpha, (0, r), (w - 1, h - 1 - r), 255, -1)
    for cx, cy in [(r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)]:
        cv2.circle(alpha, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
    return rgb, alpha

def up(rgb, alpha):
    big = cv2.cvtColor(sr.upsample(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)), cv2.COLOR_BGR2RGB)
    A = cv2.resize(alpha, (alpha.shape[1] * 4, alpha.shape[0] * 4), interpolation=cv2.INTER_LINEAR)
    A = cv2.GaussianBlur(A, (0, 0), 1.2)
    return np.dstack([big, A])

def save(rgba, name, longest=1024):
    im = Image.fromarray(rgba)
    s = longest / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    im.save(p, 'WEBP', quality=88, method=6)
    print(name, im.size, os.path.getsize(p) // 1024, 'KB', flush=True)

if __name__ == '__main__':
    import sys
    only = set(sys.argv[1:])
    for name, (sheet, idx) in PICK.items():
        if only and name not in only:
            continue
        save(up(*cut(sheet, idx)), name)
    if not only or 'duo' in only:
        duo = np.array(Image.open(f'{SRC}/duo_hero.png').convert('RGBA'))
        save(duo, 'duo', 1024)
