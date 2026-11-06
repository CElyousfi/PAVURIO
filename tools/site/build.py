"""Pavurio website → site/dist.

Pages (each in en at the root and in fr/es/pt under /fr/, /es/, /pt/):
  /                        landing page
  /features/<slug>.html    one page per search intent (medication reminders, food tracker, …)
  /privacy.html …          legal pages from site/content/<lang>/*.md (URLs kept stable: the store listings link them)
Copy lives in site/copy/<lang>.json (en is the source; missing keys fall back to en).
Art is taken from assets/art at build time; app screenshots live in site/img/s; social cards in site/img/og
(regenerate with tools/site/og.py).

Usage (repo root): python3 tools/site/build.py      needs: pip install markdown pillow
Hosting: .github/workflows/site.yml publishes site/dist to the `site-dist` branch; the Vercel project `pavurio`
(tools/site/vercel) serves it at pavurio.com."""
import datetime, html, json, os, shutil, sys, urllib.parse
import markdown
from PIL import Image
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art'))
from gifkit import frames as gif_frames  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = 'site'; OUT = f'{ROOT}/dist'; BASE = 'https://pavurio.com'
PLAY = 'https://play.google.com/store/apps/details?id=com.pavurio.app'
EMAIL = 'lesepavistespro@gmail.com'
LANGS = ['en', 'fr', 'es', 'pt']
LEGAL = ['privacy', 'terms', 'support', 'delete-account']
LEGAL_KEY = {'privacy': 'privacy', 'terms': 'terms', 'support': 'support', 'delete-account': 'delete'}
TODAY = datetime.date.today().isoformat()
E = lambda s: html.escape(str(s), quote=True)

# ---------------------------------------------------------------- copy
def merge(base, over):
    if isinstance(base, dict):
        return {k: merge(v, over.get(k, v) if isinstance(over, dict) else v) for k, v in base.items()} | {k: v for k, v in (over or {}).items() if k not in base}
    return over if over is not None else base

EN = json.load(open(f'{ROOT}/copy/en.json'))
C = {l: merge(EN, json.load(open(f'{ROOT}/copy/{l}.json'))) if os.path.exists(f'{ROOT}/copy/{l}.json') else EN | {'lang': l} for l in LANGS}
for l in LANGS:
    if not os.path.exists(f'{ROOT}/copy/{l}.json'): print(f'warning: no site/copy/{l}.json, {l} uses English copy')
SLUGS = list(EN['pages'].keys())

# ---------------------------------------------------------------- output folders, fonts, art
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(f'{OUT}/img/a')
for d in ('fonts',):
    shutil.copytree(f'{ROOT}/{d}', f'{OUT}/{d}')
for d in ('s', 'og', 'l'):
    if os.path.isdir(f'{ROOT}/img/{d}'): shutil.copytree(f'{ROOT}/img/{d}', f'{OUT}/img/{d}')
for f in ('icon-192.png', 'icon-512.png', 'og.jpg'):
    shutil.copy(f'{ROOT}/img/{f}', f'{OUT}/img/{f}')
Image.open('assets/icon.png').convert('RGBA').resize((64, 64), Image.LANCZOS).save(f'{OUT}/favicon.png')
Image.open('assets/icon.png').convert('RGB').resize((180, 180), Image.LANCZOS).save(f'{OUT}/img/apple-touch-icon.png')

A = 'assets/art'
G = 'gif:'  # an animated Honey & Tabby (docs/art/gifs), written as an animated WebP
ART = {  # name: (source, max width)
    'meal': (f'{A}/care2/meal.webp', 160), 'water': (f'{A}/care2/water.webp', 160), 'walk': (f'{A}/care2/walk.webp', 160),
    'medication': (f'{A}/pantry/icon_supplements.webp', 200), 'play': (f'{A}/care2/play.webp', 160), 'records': (f'{A}/care2/records.webp', 160),
    'litter': (f'{A}/pantry/icon_litter.webp', 160), 'grooming': (f'{A}/pantry/icon_tools.webp', 160), 'calendar': (f'{A}/icons/ui_calendar.webp', 160),
    'dog_wave': (G + 'dog_wave', 480), 'cat_wave': (G + 'cat_wave', 480), 'duo_hug': (G + 'duo_hug', 560),
    'dog_love': (G + 'duo_cuddle', 400), 'cat_happy': (G + 'cat_happy', 480), 'dog_party': (G + 'dog_cheer', 360),
    'cat_cheer': (G + 'cat_yarn', 360), 'dog_trot': (G + 'dog_trot', 480), 'cat_sleep': (G + 'cat_doze', 360),
    'dog_sunny': (G + 'dog_play', 360), 'cat_bed': (G + 'cat_bed', 360),
    'heart': (f'{A}/icons/ui_heart.webp', 140), 'shield': (f'{A}/icons/shield.webp', 240),
    'food': (f'{A}/pantry/icon_food.webp', 240), 'treats': (f'{A}/pantry/icon_treats.webp', 120),
    'pantry_list': (G + 'cat_eat', 600), 'reminders': (G + 'dog_meds', 600),
    'restock': (G + 'duo_party', 600), 'pantry_welcome': (G + 'dog_eat', 600),
    'widget_care': (f'{A}/widgets/care.png', 360), 'widget_done': (f'{A}/widgets/done.png', 560), 'widget_sleep': (f'{A}/widgets/sleep.png', 480),
    'widget_pantry': (f'{A}/widgets/pantry.png', 300), 'widget_moment': (f'{A}/widgets/moment.png', 300),
    'walk_wide': (f'{A}/widgets/walk_wide.png', 900), 'restock_wide': (f'{A}/widgets/restock_wide.png', 900),
    's_medication': (G + 'dog_meds', 600), 's_vet': (G + 'duo_laugh', 600), 's_weigh': (G + 'dog_cheer', 560),
    's_records': (G + 'cat_happy', 560), 's_walk': (G + 'dog_trot', 600), 's_litter': (G + 'cat_walk', 560),
    's_duo': (G + 'duo_hug', 600), 's_moments': (G + 'duo_camera', 600),
}


def animated(name, w, out):
    """One Honey & Tabby GIF as an animated WebP, cropped to where the pet moves."""
    fr, durs = gif_frames(name)
    U = np.zeros(fr[0].shape[:2], bool)
    for f in fr:
        U |= f[:, :, 3] > 10
    ys, xs = np.where(U)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    ims = [Image.fromarray(f).crop(box) for f in fr]
    if ims[0].width > w:
        ims = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
    ims[0].save(out, 'WEBP', save_all=True, append_images=ims[1:], duration=durs, loop=0, quality=84, method=4)


for name, (src, w) in ART.items():
    if src.startswith(G):
        animated(src[len(G):], w, f'{OUT}/img/a/{name}.webp')
        continue
    im = Image.open(src)
    im = im.convert('RGBA') if im.mode in ('P', 'RGBA', 'LA') else im.convert('RGB')
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f'{OUT}/img/a/{name}.webp', 'WEBP', quality=86, method=4)
SIZE = {n: Image.open(f'{OUT}/img/a/{n}.webp').size for n in ART}

def art(name, alt='', cls='', lazy=True, extra=''):
    w, h = SIZE[name]
    return f'<img class="{cls}" src="/img/a/{name}.webp" alt="{E(alt)}" width="{w}" height="{h}"{" loading=\"lazy\" decoding=\"async\"" if lazy else ""}{extra}>'

SHOTS = sorted(f[:-5] for f in os.listdir(f'{ROOT}/img/s') if f.endswith('.webp')) if os.path.isdir(f'{ROOT}/img/s') else []
def shot(name, lang):
    f = f'{name}_{lang}' if f'{name}_{lang}' in SHOTS else name
    return f'/img/s/{f}.webp' if f in SHOTS else None

FONTS = ''.join(f"@font-face{{font-family:Nunito;font-style:normal;font-weight:{w};font-display:swap;src:url(/fonts/nunito-{w}.woff2) format('woff2')}}" for w in (700, 800, 900))
CSS = FONTS + open(f'{HERE}/web.css').read()
JS = open(f'{HERE}/web.js').read()

# ---------------------------------------------------------------- urls
def pre(l): return '' if l == 'en' else f'/{l}'
def path(l, page):
    if page == 'index': return f'{pre(l)}/'
    if page in LEGAL: return f'{pre(l)}/{page}.html'
    return f'{pre(l)}/features/{page}.html'
def url(l, page): return BASE + path(l, page)
def play(l, placement):
    ref = urllib.parse.quote(f'utm_source=pavurio.com&utm_medium=website&utm_campaign={l}&utm_content={placement}', safe='')
    return f'{PLAY}&hl={l}&referrer={ref}'
def og_img(l, page):
    f = f'{page}-{l}.jpg'
    return f'{BASE}/img/og/{f}' if os.path.exists(f'{ROOT}/img/og/{f}') else f'{BASE}/img/og.jpg'

# ---------------------------------------------------------------- svg bits
LEAF = '<svg viewBox="0 0 22 48" aria-hidden="true"><g fill="currentColor" opacity=".9"><path d="M17 46C6 40 2 28 6 12" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="5" cy="14" rx="2.6" ry="5" transform="rotate(-20 5 14)"/><ellipse cx="4" cy="24" rx="2.6" ry="5" transform="rotate(-35 4 24)"/><ellipse cx="7" cy="33" rx="2.6" ry="5" transform="rotate(-50 7 33)"/><ellipse cx="12" cy="40" rx="2.6" ry="5" transform="rotate(-65 12 40)"/></g></svg>'
LEAF_R = LEAF.replace('<svg ', '<svg style="transform:scaleX(-1)" ')
GPLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 2.3 13.4 12l-9.8 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z"/><path fill="#FBBC04" d="m16.9 15.5-3.5-3.5 3.5-3.5 4 2.3c1.1.6 1.1 1.8 0 2.4z"/><path fill="#EA4335" d="M16.9 15.5 13.4 12l-9.8 9.7c.4.2.9.2 1.4-.1z"/><path fill="#4285F4" d="M16.9 8.5 5 1.4c-.5-.3-1-.3-1.4-.1l9.8 9.7z"/></svg>'
APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>'

PAGE_ICON = {'pet-medication-reminder': 'medication', 'pet-food-tracker': 'food', 'dog-walk-tracker': 'walk', 'pet-health-records': 'records',
             'pet-care-widgets': 'widget_care', 'dog-care-app': 'dog_wave', 'cat-care-app': 'cat_wave'}
PAGE_HERO = {'medication': 's_medication', 'pantry': 'pantry_welcome', 'walk': 's_walk', 'records': 's_records', 'widgets': 'widget_done', 'dog': 'dog_trot', 'cat': 'cat_happy'}
BLOCK_ART = {'reminders': 'reminders', 'medication': 's_medication', 'pantry_list': 'pantry_list', 'walk_wide': 'walk_wide', 'weigh': 's_weigh', 'vet': 's_vet',
             'records_scene': 's_duo', 'widget_care': 'widget_care', 'restock_wide': 'restock_wide', 'widget_sleep': 'widget_sleep', 'cat_home': 'cat_bed', 'litter': 's_litter'}

def stores(l, placement, badge=False):
    u = C[l]['ui']
    fb = f'<span class="free">{E(u["free_badge"])}</span>' if badge else ''
    return (f'<div class="stores"><a class="store" href="{E(play(l, placement))}" rel="noopener" data-cta="{placement}">{GPLAY}<span><small>{E(u["play_small"])}</small><b>{E(u["play"])}</b></span>{fb}</a>'
            f'<span class="store soon" aria-disabled="true">{APPLE}<span><small>{E(u["ios_small"])}</small><b>{E(u["ios"])}</b></span></span></div>')

def laurels(items):
    return '<div class="laurels">' + ''.join(f'<div class="laurel">{LEAF}<span><b>{E(a)}</b><small>{E(b)}</small></span>{LEAF_R}</div>' for a, b in items) + '</div>'

def phone(src, alt, cls=''):
    return f'<div class="phone {cls}"><div class="scr"><img class="on" src="{src}" alt="{E(alt)}" loading="lazy" decoding="async" width="390" height="844"></div></div>'

def faq_html(items):
    return '<div class="faq">' + ''.join(f'<details><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q, a in items) + '</div>'

def faq_ld(items):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in items]}

APP_LD = lambda l: {'@type': 'MobileApplication', '@id': f'{BASE}/#app', 'name': 'Pavurio', 'alternateName': 'Pavurio: Pet Care Tracker',
                    'operatingSystem': 'Android', 'applicationCategory': 'LifestyleApplication', 'description': C[l]['home']['desc'],
                    'url': url(l, 'index'), 'image': f'{BASE}/img/icon-512.png', 'screenshot': [f'{BASE}{s}' for s in [shot(n, l) for n in ('home', 'pantry', 'care', 'records')] if s],
                    'installUrl': PLAY, 'downloadUrl': PLAY, 'inLanguage': LANGS, 'isAccessibleForFree': True,
                    'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
                    'publisher': {'@id': f'{BASE}/#org'}}
ORG_LD = {'@type': 'Organization', '@id': f'{BASE}/#org', 'name': 'Pavurio', 'url': BASE + '/', 'logo': f'{BASE}/img/icon-512.png', 'email': EMAIL}

# ---------------------------------------------------------------- page shell
def head(l, page, title, desc, ld):
    alts = ''.join(f'<link rel="alternate" hreflang="{a}" href="{url(a, page)}">' for a in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{url("en", page)}">'
    ogl = ''.join(f'<meta property="og:locale:alternate" content="{C[a]["locale"]}">' for a in LANGS if a != l)
    graph = json.dumps({'@context': 'https://schema.org', '@graph': ld}, ensure_ascii=False).replace('</', '<\\/')
    return f"""<!doctype html><html lang="{l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><link rel="canonical" href="{url(l, page)}">{alts}
<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#14B8C4">
<meta property="og:type" content="website"><meta property="og:site_name" content="Pavurio"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url(l, page)}"><meta property="og:image" content="{og_img(l, page)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="{C[l]['locale']}">{ogl}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{E(title)}"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{og_img(l, page)}">
<meta name="google-play-app" content="app-id=com.pavurio.app">
<link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preload" as="font" type="font/woff2" href="/fonts/nunito-900.woff2" crossorigin>
<style>{CSS}</style><script type="application/ld+json">{graph}</script></head>"""

def header(l, page):
    u = C[l]['ui']
    feats = ''.join(f'<a href="{path(l, s)}">{art(PAGE_ICON[s], "", lazy=False)}{E(C[l]["pages"][s]["nav"])}</a>' for s in SLUGS)
    opts = ''.join(f'<option value="{path(a, page)}"{" selected" if a == l else ""}>{E(C[a]["name"])}</option>' for a in LANGS)
    home = path(l, 'index')
    return f"""<body><a class="skip" href="#main">{E(u['skip'])}</a><div class="progress" aria-hidden="true"></div>
<header class="top"><div class="wrap"><a class="logo" href="{home}"><img src="/img/icon-192.png" alt="" width="38" height="38">Pavurio</a>
<nav class="nav" aria-label="Main"><div class="dd"><button aria-expanded="false" aria-haspopup="true">{E(u['features'])}</button><div class="menu">{feats}</div></div>
<a href="{home}#faq">{E(u['faq'])}</a><label class="lang"><span class="sr">{E(u['language'])}</span><select aria-label="{E(u['language'])}">{opts}</select></label>
<a class="pill" href="{E(play(l, 'header'))}" rel="noopener" data-cta="header">{E(u['download'])}</a></nav>
<button class="burger" aria-label="{E(u['menu'])}" aria-expanded="false"><i></i></button></div></header><main id="main">"""

def footer(l, page, strings):
    u = C[l]['ui']
    feats = ''.join(f'<li><a href="{path(l, s)}">{E(C[l]["pages"][s]["nav"])}</a></li>' for s in SLUGS)
    legal = ''.join(f'<li><a href="{path(l, s)}">{E(u[LEGAL_KEY[s]])}</a></li>' for s in LEGAL)
    langs = ''.join(f'<li><a href="{path(a, page)}" hreflang="{a}" lang="{a}">{E(C[a]["name"])}</a></li>' for a in LANGS)
    return f"""</main><footer><div class="wrap"><div class="cols">
<div><a class="logo" href="{path(l, 'index')}"><img src="/img/icon-192.png" alt="" width="38" height="38" loading="lazy">Pavurio</a><p class="tag">{E(u['footer_tag'])}</p>{stores(l, 'footer')}</div>
<div><h4>{E(u['features'])}</h4><ul>{feats}</ul></div>
<div><h4>Pavurio</h4><ul>{legal}<li><a href="mailto:{EMAIL}" data-copy="{EMAIL}">{E(u['contact'])}</a></li><li><a href="mailto:{EMAIL}?subject=Pavurio%20press">{E(u['press'])}</a></li></ul></div>
<div><h4>{E(u['language'])}</h4><ul>{langs}</ul></div></div>
<div class="legal"><span>{E(u['rights'])}</span><span>{EMAIL}</span></div></div></footer>
<div class="toast" role="status" aria-live="polite"></div><div class="fx" aria-hidden="true"></div>
<script type="application/json" id="pv">{json.dumps(strings, ensure_ascii=False).replace('</', '<\\/')}</script><script>{JS}</script></body></html>"""

# ---------------------------------------------------------------- landing
def landing(l):
    c = C[l]; h = c['home']; u = c['ui']
    shots_ok = [n for n in ('home', 'care', 'pantry', 'summary') if shot(n, l)]

    cares = list(zip(['meal', 'water', 'walk', 'medication', 'play'], h['cares']))
    care_btns = ''.join(f'<button class="care press" aria-pressed="false">{art(n, lazy=False)}<span>{E(lbl)}</span></button>' for n, lbl in cares)
    hero = f"""<section class="panel hero"><div class="wrap split">
<div class="reveal"><span class="eyebrow">{E(h['eyebrow'])}</span><h1>{E(h['h1'])}</h1><p class="lead">{E(h['sub'])}</p>{laurels(h['laurels'])}{stores(l, 'hero', True)}</div>
<div class="demo reveal d1"><div class="hey" aria-hidden="true">{E(h['try_hint'])} 👉</div>
<div class="phone"><div class="scr"><div class="app" id="demo" aria-live="polite"><div class="cnt"><b data-n>0</b><small>/5</small></div><div class="sub" data-sub></div>
<div class="pet"><span class="mat"></span>{art('dog_wave', '', 'gray', False)}{art('dog_wave', 'Honey', 'col', False)}</div>
<div class="cares">{care_btns}</div><button class="again" hidden>↺ {E(h['try_again'])}</button></div></div></div>
{art('duo_hug', h['img_alt'], 'duo', False, ' role="button" tabindex="0"')}{art('heart', '', 'heart', False)}</div></div></section>"""

    tour = ''
    if shots_ok:
        tabs = [(n, t) for n, t in zip(('home', 'care', 'pantry', 'summary'), h['tabs']) if n in shots_ok]
        btns = ''.join(f'<button role="tab" aria-selected="{"true" if k == 0 else "false"}">{E(t[0])}</button>' for k, (n, t) in enumerate(tabs))
        imgs = ''.join(f'<img class="{"on" if k == 0 else ""}" src="{shot(n, l)}" alt="{E(t[0])}: {E(t[1])}" width="390" height="844" loading="lazy" decoding="async">' for k, (n, t) in enumerate(tabs))
        tour = f"""<section class="sec" id="tour"><div class="wrap center"><h2 class="reveal">{E(h['tour_h'])}</h2><p class="lead reveal d1">{E(h['tour_p'])}</p>
<div class="seg reveal d1" role="tablist"><span class="thumb" aria-hidden="true"></span>{btns}</div>
<div class="tour reveal d2"><div class="side l">{art('dog_love')}</div><div><div class="phone"><div class="scr">{imgs}</div></div></div><div class="side r"><p class="cap">{E(tabs[0][1][1])}</p>{art('cat_cheer')}</div></div></div></section>"""
        h = dict(h, tabs=[t for _, t in tabs])

    points = lambda xs: '<ul class="points">' + ''.join(f'<li>{E(x)}</li>' for x in xs) + '</ul>'
    rem = f"""<section class="sec" id="reminders"><div class="wrap split">
<div class="reveal"><span class="kicker">{E(h['rem_k'])}</span><h2>{E(h['rem_h'])}</h2><p class="lead">{E(h['rem_p'])}</p>{points(h['rem_points'])}
<p style="margin-top:22px"><a class="pill soft" href="{path(l, 'pet-medication-reminder')}">{E(u['learn_more'])} →</a></p></div>
<div class="reveal d1"><div class="card ink dose" id="dose" style="padding:34px"><div class="head">{art('medication', '', lazy=True)}<div><div class="t">{E(h['rem_card_t'])}</div><div class="s">{E(h['rem_card_s'])}</div></div></div>
<div class="slide"><span class="fill"></span><span class="lbl">{E(h['rem_slide'])}</span><span class="knob" role="button" tabindex="0" aria-label="{E(h['rem_slide'])}">›</span></div>
<div class="given" role="status"><span></span><button>{E(h['rem_reset'])}</button></div>
<div class="follow"><i aria-hidden="true"></i>{E(h['rem_points'][1])}</div></div></div></div></section>"""

    pan = f"""<section class="panel" style="background:var(--card)"><div class="sec"><div class="wrap split flip">
<div class="reveal d1"><span class="kicker">{E(h['pan_k'])}</span><h2>{E(h['pan_h'])}</h2><p class="lead">{E(h['pan_p'])}</p>{points(h['pan_points'])}
<p style="margin-top:22px"><a class="pill soft" href="{path(l, 'pet-food-tracker')}">{E(u['learn_more'])} →</a></p></div>
<div class="reveal"><div class="bag" id="bag"><div class="row"><div class="fillart">{art('food', '', 'g')}{art('food', '', 'c')}</div>
<div><div class="nm">{E(h['pan_item'])}</div><span class="status"></span></div></div><div class="bar"><i></i></div>
<div class="stat"><div><small>{E(h['pan_left'].replace('{kg}', '').strip())}</small><b><span data-left>4.5</span> kg</b></div><div><small>{E(h['pan_days'].replace('{n}', '').strip())}</small><b data-days>9</b></div></div>
<div class="stat" style="grid-template-columns:1fr;margin-top:-6px"><div><small>{E(h['pan_order'].replace('{day}', '').strip())}</small><b data-order>—</b></div></div>
<div class="acts"><button class="press" data-log>− {E(h['pan_log'])}</button><button class="press alt" data-restock>↻ {E(h['pan_restock'])}</button></div>
<p class="note">{E(h['pan_note'])}</p></div></div></div></div></section>"""

    rows = ''.join(f'<div class="r"><span>{E(n)}</span><span class="b"><i style="width:{p}%;background:{"var(--meal)" if p < 30 else "var(--green)"}"></i></span><em>{E(s)}</em></div>' for n, s, p in h['wid_rows'])
    wid = f"""<section class="panel wid"><div class="sec"><div class="wrap center"><span class="kicker reveal">{E(h['wid_k'])}</span><h2 class="reveal">{E(h['wid_h'])}</h2><p class="lead reveal d1">{E(h['wid_p'])}</p>
<div class="home-scr reveal d2" style="margin-top:46px"><div class="w s"><b>{E(h['wid_today'])}</b><em>{E(h['wid_today_s'])}</em>{art('widget_care')}</div>
<div class="w m"><h4>{E(h['wid_pantry'])}</h4>{rows}</div><div class="w s" style="background:#FFF6E6"><b>{E(h['try_done'].split('.')[0])}</b>{art('widget_done')}</div>
<div class="la" id="la">{art('medication')}<div class="tx"><b>{E(h['wid_la_t'])}</b><small>{E(h['wid_la_s'])}</small></div><span class="clk">12:00</span><button class="press">{E(h['wid_la_btn'])}</button></div></div>
<p class="wnote">{E(h['wid_note'])}</p><p><a class="pill soft" href="{path(l, 'pet-care-widgets')}">{E(u['learn_more'])} →</a></p></div></div></section>"""

    walk = f"""<section class="sec"><div class="wrap split">
<div class="reveal"><span class="kicker">{E(h['walk_k'])}</span><h2>{E(h['walk_h'])}</h2><p class="lead">{E(h['walk_p'])}</p><p><a class="pill soft" href="{path(l, 'dog-walk-tracker')}">{E(u['learn_more'])} →</a></p></div>
<div class="walkart reveal d1">{art('s_walk', '', '')}<div class="live" id="walk"><div class="hd"><img src="/img/icon-192.png" alt="" width="40" height="40" loading="lazy"><div><div class="t">{E(h['walk_title'])}</div><div class="s">{E(h['walk_sub'])}</div></div></div>
<div class="clock" aria-live="off">18:42</div><div class="saved">{E(h['walk_saved'])}</div><div class="b"><button class="p press">{E(h['walk_pause'])}</button><button class="f press">{E(h['walk_finish'])}</button><button class="n press">{E(h['walk_new'])}</button></div></div></div></div></section>"""

    rec = shot('records', l)
    health_vis = phone(rec, h['health_h']) if rec else art('s_records', '', 'artimg')
    health = f"""<section class="panel" style="background:#EEF4FF"><div class="sec"><div class="wrap split flip">
<div class="reveal d1"><span class="kicker" style="color:#2B62C6">{E(h['health_k'])}</span><h2>{E(h['health_h'])}</h2><p class="lead">{E(h['health_p'])}</p>
<div class="chips">{''.join(f'<span class="chip">{E(x)}</span>' for x in h['health_chips'])}</div><p style="margin-top:26px"><a class="pill soft" href="{path(l, 'pet-health-records')}">{E(u['learn_more'])} →</a></p></div>
<div class="reveal" style="position:relative">{health_vis}</div></div></div></section>"""

    cards = [f for f in (f'card_gotcha_{l}', f'card_daily_{l}') if os.path.exists(f'{ROOT}/img/l/{f}.webp')] or ['card_gotcha_en', 'card_daily_en']
    mem = f"""<section class="sec"><div class="wrap split">
<div class="reveal"><span class="kicker" style="color:#C2185B">{E(h['mem_k'])}</span><h2>{E(h['mem_h'])}</h2><p class="lead">{E(h['mem_p'])}</p><p class="note" style="text-align:left">👆 {E(h['mem_hint'])}</p></div>
<div class="mcards reveal d1"><img class="mcard a front" src="/img/l/{cards[0]}.webp" alt="Memory Card" loading="lazy" tabindex="0" role="button"><img class="mcard b" src="/img/l/{cards[-1]}.webp" alt="Memory Card" loading="lazy" tabindex="0" role="button"></div></div></section>"""

    calm = f"""<section class="panel calm"><div class="sec"><div class="wrap center"><h2 class="reveal">{E(h['calm_h'])}</h2><p class="lead reveal d1">{E(h['calm_p'])}</p>
<div class="trio reveal d2">{''.join(f'<div class="card"><span class="e" aria-hidden="true">{e}</span><h3>{E(t)}</h3><p>{E(p)}</p></div>' for e, t, p in h['calm_points'])}</div></div></div></section>"""

    LN = json.load(open(f'{HERE}/languages.json'))
    half = len(LN) // 2
    row = lambda xs: ''.join(f'<span lang="{k}">{f} {E(n)}</span>' for k, f, n in xs)
    langs_s = f"""<section class="sec"><div class="wrap center"><h2 class="reveal">{E(h['lang_h'])}</h2><p class="lead reveal d1">{E(h['lang_p'])}</p></div>
<div class="marq" aria-label="{E(h['lang_h'])}"><div class="tr">{row(LN[:half]) * 2}</div></div><div class="marq r" aria-hidden="true"><div class="tr">{row(LN[half:]) * 2}</div></div></section>"""

    priv = f"""<section class="wrap"><div class="card ink priv reveal">{art('shield')}<div><h2>{E(h['priv_h'])}</h2><p>{E(h['priv_p'])}</p></div><a class="pill" style="background:#fff;color:var(--ink)" href="{path(l, 'privacy')}">{E(h['priv_link'])} →</a></div></section>"""

    pro = f"""<section class="sec"><div class="wrap center"><h2 class="reveal">{E(h['pro_h'])}</h2>
<div class="plans reveal d1"><div class="card"><h3>{E(h['pro_free_h'])}</h3>{points(h['pro_free'])}</div><div class="card pro"><h3>{E(h['pro_pro_h'])}</h3>{points(h['pro_pro'])}</div></div>
<p class="note">{E(h['pro_note'])}</p></div></section>"""

    faq = f"""<section class="sec" id="faq" style="padding-top:20px"><div class="wrap center"><h2 class="reveal">{E(h['faq_h'])}</h2><div class="reveal d1">{faq_html(h['faq'])}</div></div></section>"""

    cyc = [shot(n, l) for n in ('home', 'pantry', 'care', 'records') if shot(n, l)]
    cphone = f'<div class="phone sm"><div class="scr"><img class="on" src="{cyc[0]}" alt="" loading="lazy" width="390" height="844"></div></div>' if cyc else art('duo_hug')
    cta = f"""<section class="panel cta"><div class="wrap split">
<div class="reveal"><img class="appicon" src="/img/icon-192.png" alt="Pavurio" width="96" height="96" loading="lazy"><h2>{E(h['cta_h'])}</h2><p class="lead">{E(h['cta_p'])}</p>{stores(l, 'final', True)}
<p class="note" style="text-align:left">{E(h['cta_note'])}</p><div class="qr"><img src="/img/l/qr_{l}.svg" alt="QR code: Pavurio on Google Play" width="104" height="104" loading="lazy"><div><b>{E(u['scan'])}</b><small>{E(u['scan_sub'])}</small></div></div></div>
<div class="reveal d1" style="position:relative">{cphone}{art('duo_hug', '', 'duo')}</div></div></section>"""

    ld = [ORG_LD, APP_LD(l), {'@type': 'WebSite', '@id': f'{BASE}/#site', 'url': BASE + '/', 'name': 'Pavurio', 'inLanguage': l, 'publisher': {'@id': f'{BASE}/#org'}},
          dict(faq_ld(h['faq']), url=url(l, 'index'))]
    strings = {k: h[k] for k in ('try_done', 'try_logged', 'rem_given', 'pan_out', 'pan_ok', 'pan_order', 'pan_today', 'walk_pause', 'walk_resume', 'walk_paused', 'walk_saved')} | {'tabs': h['tabs'], 'copied': u['copied']}
    body = hero + tour + rem + pan + wid + walk + health + mem + calm + langs_s + priv + pro + faq + cta
    return head(l, 'index', h['title'], h['desc'], ld) + header(l, 'index') + body + footer(l, 'index', strings)

# ---------------------------------------------------------------- feature pages
def feature(l, slug):
    c = C[l]; p = c['pages'][slug]; u = c['ui']
    hero = f"""<section class="panel fhero"><div class="wrap split">
<div class="reveal"><nav class="crumbs" aria-label="Breadcrumb"><a href="{path(l, 'index')}">Pavurio</a> › {E(p['nav'])}</nav><h1>{E(p['h1'])}</h1><p class="lead">{E(p['lead'])}</p>{stores(l, slug, True)}</div>
<div class="reveal d1">{art(PAGE_HERO[p['art']], p['h1'], 'art', False)}</div></div></section>"""
    blocks = ''
    for k, (t, d, vis) in enumerate(p['blocks']):
        kind, name = vis.split(':')
        if kind == 'shot' and shot(name, l): v = phone(shot(name, l), t, 'sm')
        else:
            n = BLOCK_ART.get(name, 'duo_hug') if kind == 'art' else {'care': 'reminders', 'supply': 'restock', 'pantry': 'pantry_list', 'shopping': 'pantry_list', 'records': 's_records', 'walk': 's_walk', 'home': 'duo_hug'}.get(name, 'duo_hug')
            v = art(n, t, 'wide' if n.endswith('_wide') or n.startswith('s_') else 'artimg')
        blocks += f"""<section class="block"><div class="wrap split{' flip' if k % 2 else ''}"><div class="reveal"><h2>{E(t)}</h2><p class="lead">{E(d)}</p></div><div class="vis reveal d1">{v}</div></div></section>"""
    steps = f"""<section class="panel" style="background:var(--card)"><div class="sec"><div class="wrap center"><h2 class="reveal">{E(u['how'])}</h2>
<div class="steps reveal d1">{''.join(f'<div class="card" style="background:#fff"><h3>{E(a)}</h3><p>{E(b)}</p></div>' for a, b in p['steps'])}</div></div></div></section>"""
    faq = f"""<section class="sec"><div class="wrap center"><h2 class="reveal">{E(u['questions'])}</h2><div class="reveal d1">{faq_html(p['faq'])}</div></div></section>"""
    rel = f"""<section class="sec" style="padding-top:0"><div class="wrap center"><h2 class="reveal" style="font-size:clamp(28px,3vw,38px)">{E(u['related'])}</h2>
<div class="rel reveal d1">{''.join(f'<a href="{path(l, r)}">{art(PAGE_ICON[r])}{E(c["pages"][r]["nav"])}</a>' for r in p['related'])}</div></div></section>"""
    h = c['home']
    cta = f"""<section class="panel cta"><div class="wrap center"><img class="appicon" src="/img/icon-192.png" alt="Pavurio" width="96" height="96" loading="lazy" style="margin:0 auto 22px"><h2>{E(h['cta_h'])}</h2><p class="lead">{E(h['cta_p'])}</p>
<div style="display:flex;justify-content:center">{stores(l, slug + '_end', True)}</div><p class="note">{E(h['cta_note'])}</p></div></section>"""
    ld = [ORG_LD, APP_LD(l),
          {'@type': 'WebPage', '@id': url(l, slug), 'url': url(l, slug), 'name': p['title'], 'description': p['desc'], 'inLanguage': l, 'about': {'@id': f'{BASE}/#app'},
           'primaryImageOfPage': f'{BASE}/img/a/{PAGE_HERO[p["art"]]}.webp'},
          {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Pavurio', 'item': url(l, 'index')}, {'@type': 'ListItem', 'position': 2, 'name': p['nav'], 'item': url(l, slug)}]},
          dict(faq_ld(p['faq']), url=url(l, slug))]
    return head(l, slug, p['title'], p['desc'], ld) + header(l, slug) + hero + blocks + steps + faq + rel + cta + footer(l, slug, {'copied': u['copied']})

# ---------------------------------------------------------------- legal pages
def legal(l, slug):
    u = C[l]['ui']
    src = f'{ROOT}/content/{l}/{slug}.md'
    if not os.path.exists(src): src = f'{ROOT}/content/en/{slug}.md'
    md = open(src).read()
    body = markdown.markdown(md, extensions=['tables'])
    first = next((ln for ln in md.splitlines() if ln.strip() and not ln.startswith('#') and not ln.startswith('*')), '')
    desc = (first.replace('**', '').strip()[:155]) or C[l]['home']['desc']
    title = f"{u[LEGAL_KEY[slug]]} · Pavurio"
    ld = [ORG_LD, {'@type': 'WebPage', 'url': url(l, slug), 'name': title, 'inLanguage': l}]
    return head(l, slug, title, desc, ld) + header(l, slug) + f'<article class="doc">{body}</article>' + footer(l, slug, {'copied': u['copied']})

# ---------------------------------------------------------------- write
def write(rel, text):
    p = OUT + rel + ('index.html' if rel.endswith('/') else '')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(text)

for l in LANGS:
    write(path(l, 'index'), landing(l))
    for s in SLUGS: write(path(l, s), feature(l, s))
    for s in LEGAL: write(path(l, s), legal(l, s))

pages = ['index'] + SLUGS + LEGAL
prio = lambda pg: '1.0' if pg == 'index' else '0.8' if pg in SLUGS else '0.3'
open(f'{OUT}/sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join(
    f'<url><loc>{url(l, pg)}</loc><lastmod>{TODAY}</lastmod><priority>{prio(pg)}</priority>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{a}" href="{url(a, pg)}"/>' for a in LANGS)
    + f'<xhtml:link rel="alternate" hreflang="x-default" href="{url("en", pg)}"/></url>\n' for pg in pages for l in LANGS) + '</urlset>\n')
open(f'{OUT}/robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n')
open(f'{OUT}/site.webmanifest', 'w').write(json.dumps({'name': 'Pavurio', 'short_name': 'Pavurio', 'icons': [{'src': '/img/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/img/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}],
                                                        'theme_color': '#14B8C4', 'background_color': '#ffffff', 'display': 'browser', 'related_applications': [{'platform': 'play', 'id': 'com.pavurio.app', 'url': PLAY}]}))
h = EN['home']
open(f'{OUT}/llms.txt', 'w').write(f"# Pavurio\n\n> {h['desc']}\n\nPavurio is a pet care app for dogs and cats (Android on Google Play; iPhone coming soon). Website: {BASE}/ in English, French, Spanish and Portuguese. The app speaks 30 languages.\n\n## Features\n"
    + ''.join(f"- [{EN['pages'][s]['nav']}]({url('en', s)}): {EN['pages'][s]['desc']}\n" for s in SLUGS)
    + "\n## FAQ\n" + ''.join(f"- {q} {a}\n" for q, a in h['faq'])
    + f"\n## Legal\n" + ''.join(f"- [{EN['ui'][LEGAL_KEY[s]]}]({url('en', s)})\n" for s in LEGAL)
    + f"\n## Get the app\n- Google Play: {PLAY}\n- Contact: {EMAIL}\n")
open(f'{OUT}/.nojekyll', 'w').write('')
print('built', sum(len(f) for _, _, f in os.walk(OUT)), 'files →', OUT)
