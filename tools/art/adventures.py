"""Pavurio Adventures art, cut from the concept sheet (docs/art/adventures/reference-sheet.png, 1536×1024).
The sheet is a low-resolution concept: every piece here is a stand-in to replace with a high-resolution
export (see docs/art/adventures/README.md). Badges keep only the emblem (their English banner text is
dropped so titles can be translated in the UI); each cut is placed on a soft round cream stamp.
Usage: python3 tools/art/adventures.py <sheet.png> <out_dir>"""
import sys
from PIL import Image, ImageDraw, ImageFilter

CUTS = {
    # badges (emblem only)
    'badge_first': (17, 706, 137, 772),
    'badge_golden': (445, 708, 542, 776),
    'badge_cloud': (553, 711, 652, 774),
    'badge_spring': (15, 830, 147, 899),
    'badge_five': (160, 833, 289, 894),
    'badge_ten': (308, 833, 417, 899),
    'badge_together': (440, 833, 542, 897),
    'badge_early': (1065, 943, 1154, 989),
    # weather
    'w_sunny': (988, 848, 1047, 902),
    'w_partly': (1053, 848, 1130, 902),
    'w_cloudy': (1138, 850, 1205, 897),
    'w_rainy': (1208, 848, 1267, 900),
    'w_storm': (1275, 848, 1335, 902),
    'w_snow': (1338, 850, 1395, 898),
    'w_hot': (1403, 845, 1457, 902),
    'w_cold': (1465, 845, 1522, 902),
    # time of day
    't_morning': (1065, 943, 1154, 989),
    't_afternoon': (1175, 945, 1262, 989),
    't_golden': (1283, 945, 1377, 992),
    't_night': (1392, 945, 1484, 992),
}
CREAM = (255, 246, 230, 255)

def stamp(cut, size=256, pad=0.13):
    """the cut, upscaled, centred on a round cream stamp with a soft edge"""
    w, h = cut.size
    inner = int(size * (1 - 2 * pad))
    k = inner / max(w, h)
    art = cut.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
    out = Image.new('RGBA', (size, size), CREAM[:3] + (0,))  # transparent cream, so scaled edges stay cream
    disc = Image.new('RGBA', (size, size), CREAM)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, size - 3, size - 3), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    out.paste(disc, (0, 0), mask)
    # feather the cut's rectangle into the cream so the sheet's haze disappears at its edges
    fm = Image.new('L', art.size, 0)
    m = int(min(art.size) * 0.12)
    ImageDraw.Draw(fm).rounded_rectangle((m, m, art.size[0] - m, art.size[1] - m), radius=m * 2, fill=255)
    fm = fm.filter(ImageFilter.GaussianBlur(m * 0.7))
    out.paste(art, ((size - art.size[0]) // 2, (size - art.size[1]) // 2), fm)
    return out

sheet = Image.open(sys.argv[1]).convert('RGBA')
for name, box in CUTS.items():
    stamp(sheet.crop(box)).save(f'{sys.argv[2]}/{name}.webp', 'WEBP', quality=92)
print(len(CUTS), 'pieces')
