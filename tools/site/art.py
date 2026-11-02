"""Prepares the landing-page art in site/img/l/ from the app's own illustrations (run when the art changes).
Usage (repo root): python3 tools/site/art.py [screens_dir]
- stickers / care / icon art → resized webp
- Memory Cards (Post 1080×1350) composed from the real templates + scene art, title per language
- app screenshots (from the web build, shots/site/*.png) → phone-sized webp
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = 'site/img/l'
os.makedirs(OUT, exist_ok=True)
FONT = 'node_modules/@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf'
FONT2 = 'node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'


def save(im, name, max_side, q=88):
    im = im.copy()
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=4)


ART = {
    'stickers': (['duo_hug', 'dog_love', 'cat_happy', 'dog_trophy', 'dog_wave', 'cat_wave', 'dog_party', 'cat_cheer', 'dog_trot', 'cat_sleep', 'dog_sunny', 'cat_passport'], 640),
    'care2': (['meal', 'walk', 'walk_leash', 'grooming', 'medication', 'litter', 'records', 'water', 'sleep', 'play', 'calendar'], 320),
    'icons': (['ui_heart', 'flame', 'ui_calendar', 'shield', 'ui_paw', 'ui_trophy', 'gem'], 220),
    'badges': (['moment', 'streak7', 'walker', 'hydration'], 260),
}
for folder, (names, size) in ART.items():
    for n in names:
        save(Image.open(f'assets/art/{folder}/{n}.webp').convert('RGBA'), n, size)
save(Image.open('assets/icon.png').convert('RGBA'), 'app_icon', 360)

# ---- Memory Cards from the real templates (Post format), photos = the app's scene art
layout = json.load(open('assets/memories/layout_manifest.json'))
TITLES = {
    'gotcha': {'en': "Honey's Gotcha Day", 'fr': 'Le jour où Honey est arrivé', 'es': 'El Día de adopción de Honey', 'pt': 'O dia de adoção da Honey'},
    'daily': {'en': 'First walk!', 'fr': 'Première balade !', 'es': '¡Primer paseo!', 'pt': 'Primeiro passeio!'},
}
FOOT = {'en': 'Honey · Nov 2, 2026', 'fr': 'Honey · 2 nov. 2026', 'es': 'Honey · 2 nov 2026', 'pt': 'Honey · 2 nov 2026'}
PHOTOS = {'gotcha': ['bed', 'bath'], 'daily': ['walk']}


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def fit_text(d, text, box, font_path, max_ratio):
    size = int(box['h'] * max_ratio)
    while size > 12:
        f = ImageFont.truetype(font_path, size)
        if d.textlength(text, font=f) <= box['w'] * 0.94:
            return f
        size -= 2
    return ImageFont.truetype(font_path, 12)


for tid in ('gotcha', 'daily'):
    L = layout[tid]['post']
    tpl = Image.open(f'assets/memories/{tid}_post.png').convert('RGBA')
    for lang in ('en', 'fr', 'es', 'pt'):
        card = Image.new('RGBA', (L['w'], L['h']), 'white')
        for slot, ph in zip(L['slots'], PHOTOS[tid]):
            src = Image.open(f'assets/art/scenes/{ph}.webp').convert('RGB')
            # the scene art has soft white corners: crop them away before cover-fitting
            m = int(min(src.size) * 0.06)
            src = src.crop((m, m, src.width - m, src.height - m))
            card.paste(cover(src, slot['w'], slot['h']), (slot['x'], slot['y']))
        card.alpha_composite(tpl)
        d = ImageDraw.Draw(card)
        for key, text, fp, ratio, color in (('title', TITLES[tid][lang], FONT, 0.42, (35, 48, 74)), ('footer', FOOT[lang], FONT2, 0.36, (61, 74, 99))):
            box = L[key]
            f = fit_text(d, text, box, fp, ratio)
            d.text((box['x'] + box['w'] / 2, box['y'] + box['h'] / 2), text, font=f, fill=color, anchor='mm')
        save(card.convert('RGB'), f'card_{tid}_{lang}', 720, 86)

# ---- app screenshots (390×844 @3x from the current web build)
screens = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots/site'
if os.path.isdir(screens):
    for n in ('home', 'memories', 'log_meal', 'card', 'care', 'menu', 'achievements', 'viewer'):
        p = f'{screens}/{n}.png'
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            im = im.resize((585, round(im.height * 585 / im.width)), Image.LANCZOS)
            im.save(f'{OUT}/app_{n}.webp', 'WEBP', quality=84, method=4)
print(len(os.listdir(OUT)), 'files in', OUT)
