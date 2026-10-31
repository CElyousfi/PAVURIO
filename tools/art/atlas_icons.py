"""Extract the object icons (no characters) from ChatGPT's reference atlases (PR #4).

The atlases are 1536x1024 palette images with labels and pastel glows, so every icon is cropped by a
hand-checked box, upscaled 4x with EDSR (set EDSR_MODEL), smoothed, cut out with GrabCut, trimmed and
saved as WebP. Scenes containing Honey/Tabby are NOT extracted: in the atlases they drift off-model
(see docs/art/ATLAS_AUDIT_PR4.md).
Usage: EDSR_MODEL=/path/EDSR_x4.pb python3 tools/art/atlas_icons.py
"""
import cv2, numpy as np, os
from PIL import Image

SRC = 'docs/art/references/remaining-coverage'
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(os.environ.get('EDSR_MODEL', 'EDSR_x4.pb'))
sr.setModel('edsr', 4)
A = np.array(Image.open(f'{SRC}/atlas_A.png').convert('RGB'))
B = np.array(Image.open(f'{SRC}/atlas_B.png').convert('RGB'))

ITEMS = {}
# 13 rosette badges, atlas B row "Achievement Badges"
# brush and dumbbell are extracted but rejected (washed out / broken ribbon) and deleted afterwards
ROSETTES = ['paw', 'star', 'calendar', 'flame', 'trophy', 'heart', 'dumbbell', 'moon', 'brush', 'plus', 'camera', 'leaf', 'crown']
REJECT = ['badges/rosette_brush', 'badges/rosette_dumbbell', 'icons/no_records']
for i, n in enumerate(ROSETTES):
    cx = 52 + i * 58
    ITEMS[f'badges/rosette_{n}'] = (B, (cx - 32, 498, cx + 32, 578), 256)
ITEMS.update({
    'icons/flame': (B, (1015, 45, 1110, 160), 384),
    'icons/gift': (A, (1150, 748, 1230, 830), 320),
    'icons/no_reminders': (B, (255, 770, 335, 845), 320),
    'icons/no_records': (B, (355, 775, 440, 845), 320),
    'icons/offline': (B, (452, 775, 522, 842), 320),
    'icons/error': (B, (710, 772, 795, 840), 320),
    'icons/infinity': (A, (1436, 765, 1526, 820), 256),
    'icons/gem': (A, (1250, 760, 1315, 826), 256),
    'icons/shield': (B, (1220, 340, 1288, 414), 256),
    'icons/ui_paw': (B, (1424, 940, 1466, 987), 192),
    'icons/ui_trophy': (B, (1334, 940, 1377, 987), 192),
    'icons/ui_chart': (B, (1289, 940, 1331, 987), 192),
    'icons/ui_heart': (B, (1379, 940, 1422, 987), 192),
    'icons/ui_calendar': (B, (1239, 940, 1284, 987), 192),
})

def extract(img, box, size):
    x0, y0, x1, y1 = box
    crop = img[y0:y1, x0:x1]
    big = cv2.cvtColor(sr.upsample(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)), cv2.COLOR_BGR2RGB)
    big = cv2.bilateralFilter(big, 9, 40, 7)
    h, w = big.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    m = 10
    cv2.grabCut(big, mask, (m, m, w - 2 * m, h - 2 * m), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    a = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    # keep the biggest blob (+ anything large attached), drop specks of glow
    n, lab, st, _ = cv2.connectedComponentsWithStats(a, 8)
    if n > 1:
        big_i = 1 + int(np.argmax(st[1:, 4]))
        keep = np.zeros_like(a)
        for i in range(1, n):
            if i == big_i or st[i, 4] > 0.08 * st[big_i, 4]:
                keep[lab == i] = 255
        a = keep
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    ys, xs = np.where(a > 20)
    pad = 6
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(h, ys.max() + pad), max(0, xs.min() - pad), min(w, xs.max() + pad)
    rgba = np.dstack([big, a])[y0:y1, x0:x1]
    im = Image.fromarray(rgba)
    im.thumbnail((size, size), Image.LANCZOS)
    return im

def recolor(im, hue_shift, sat=1.0):
    arr = np.array(im)
    hsv = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.int16)
    colourful = hsv[:, :, 1] > 60
    hsv[:, :, 0] = np.where(colourful, (hsv[:, :, 0] + hue_shift) % 180, hsv[:, :, 0])
    hsv[:, :, 1] = np.where(colourful, np.clip(hsv[:, :, 1] * sat, 0, 255), hsv[:, :, 1])
    rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return Image.fromarray(np.dstack([rgb, arr[:, :, 3]]))

if __name__ == '__main__':
    out = {}
    for name, (img, box, size) in ITEMS.items():
        im = extract(img, box, size)
        out[name] = im
    # a 14th badge: the paw rosette in Tabby-and-Honey brown for "Full house" (two pets)
    out['badges/rosette_paw_brown'] = recolor(out['badges/rosette_paw'], -12, 0.75)
    # "Full house" (two pets): the heart rosette in Pavurio teal
    out['badges/rosette_heart_teal'] = recolor(out['badges/rosette_heart'], 85, 0.9)
    # "Champion" (3 challenges): the trophy rosette in the Pro purple
    out['badges/rosette_trophy_purple'] = recolor(out['badges/rosette_trophy'], 115, 0.8)
    for name in REJECT:
        out.pop(name, None)
    for name, im in out.items():
        p = f'assets/art/{name}.webp'
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p, 'WEBP', quality=90, method=6)
        print(name, im.size, os.path.getsize(p) // 1024, 'KB', flush=True)
