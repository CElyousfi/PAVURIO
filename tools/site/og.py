"""Social share cards (1200×630) for every page and language → site/img/og/<page>-<lang>.jpg.
Run from the repo root after changing copy or art: python3 tools/site/og.py   (needs node_modules for the Nunito font)."""
import json, os
from PIL import Image, ImageDraw, ImageFont

FONT = 'node_modules/@expo-google-fonts/nunito/{w}/Nunito_{w}.ttf'
F900 = FONT.format(w='900Black'); F800 = FONT.format(w='800ExtraBold')
OUT = 'site/img/og'; os.makedirs(OUT, exist_ok=True)
A = 'assets/art'
P = 'assets/art/pets/still'
ART = {'index': f'{P}/duo_hug.png', 'pet-medication-reminder': f'{P}/dog_meds.png', 'pet-food-tracker': f'{P}/dog_eat.png',
       'dog-walk-tracker': f'{P}/dog_trot.png', 'pet-health-records': f'{P}/cat_happy.png', 'pet-care-widgets': f'{A}/widgets/done.png',
       'dog-care-app': f'{P}/dog_wave.png', 'cat-care-app': f'{P}/cat_wave.png'}
BG = {'index': '#16B8C6', 'pet-medication-reminder': '#8E6CEB', 'pet-food-tracker': '#FF9F43', 'dog-walk-tracker': '#38B6E8',
      'pet-health-records': '#2B62C6', 'pet-care-widgets': '#1C2F5A', 'dog-care-app': '#16B8C6', 'cat-care-app': '#E46FA6'}

def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def card(page, title, sub, lang):
    im = Image.new('RGB', (1200, 630), BG[page]); d = ImageDraw.Draw(im)
    for x in range(0, 1200, 60): d.line([(x, 0), (x, 630)], fill=tuple(min(255, c + 12) for c in im.getpixel((0, 0))), width=2)
    for y in range(0, 630, 60): d.line([(0, y), (1200, y)], fill=tuple(min(255, c + 12) for c in im.getpixel((0, 0))), width=2)
    art = Image.open(ART[page]).convert('RGBA'); art.thumbnail((520, 520))
    if art.getpixel((2, 2))[3] == 255:  # opaque scene → rounded card
        m = Image.new('L', art.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, *art.size], 40, fill=255); art.putalpha(m)
    im.paste(art, (1200 - art.width - 50, (630 - art.height) // 2), art)
    icon = Image.open('assets/icon.png').convert('RGBA').resize((76, 76)); m = Image.new('L', (76, 76), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 76, 76], 20, fill=255)
    im.paste(icon, (64, 56), m)
    d.text((156, 94), 'Pavurio', font=ImageFont.truetype(F900, 44), fill='white', anchor='lm')
    maxw = 1200 - art.width - 170
    for size in (76, 68, 60, 54, 48):
        f = ImageFont.truetype(F900, size); lines = wrap(d, title, f, maxw)
        if len(lines) <= 3: break
    y = 190
    for ln in lines: d.text((64, y), ln, font=f, fill='white'); y += int(size * 1.08)
    fs = ImageFont.truetype(F800, 28)
    for ln in wrap(d, sub, fs, maxw)[:2]: d.text((64, y + 22), ln, font=fs, fill=(255, 255, 255)); y += 38
    im.save(f'{OUT}/{page}-{lang}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)

for lang in ('en', 'fr', 'es', 'pt'):
    c = json.load(open(f'site/copy/{lang}.json'))
    card('index', c['home']['h1'], c['home']['cta_note'], lang)
    for slug, p in c['pages'].items(): card(slug, p['h1'], c['home']['cta_note'], lang)
print(len(os.listdir(OUT)), 'cards in', OUT)
