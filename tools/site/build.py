"""Pavurio website (privacy, terms, support, account deletion) → site/dist, published on GitHub Pages.
Usage (repo root): python3 tools/site/build.py   (needs: pip install markdown)"""
import os, shutil, markdown
from PIL import Image

ROOT = 'site'; OUT = f'{ROOT}/dist'; BASE = 'https://celyousfi.github.io/PAVURIO'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f'{OUT}/fr'); os.makedirs(f'{OUT}/img')
Image.open('assets/icon.png').convert('RGBA').resize((256, 256), Image.LANCZOS).save(f'{OUT}/img/icon.png')
Image.open('assets/icon.png').convert('RGBA').resize((64, 64), Image.LANCZOS).save(f'{OUT}/favicon.png')
Image.open('assets/art/scenes/duo.webp').convert('RGBA').save(f'{OUT}/img/duo.webp', 'WEBP', quality=85)

L = {
    'en': dict(home='Home', privacy='Privacy', terms='Terms', support='Support', delete='Delete account', other='Français', soon='Coming soon to the App Store and Google Play',
               tag='Your pet colours in as you care for them.',
               lead='Pavurio turns daily pet care into a little game: log meals, water, walks and play, and watch your dog or cat fill with colour. Gentle reminders, streaks, challenges, vet visits, weights and health records — all in one cosy place.',
               feats=['Care log & smart reminders', 'Streaks, challenges & badges', 'Vet visits, weights & records', 'Backed up to your account']),
    'fr': dict(home='Accueil', privacy='Confidentialité', terms='Conditions', support='Aide', delete='Supprimer le compte', other='English', soon='Bientôt sur l’App Store et Google Play',
               tag='Votre animal se colore au fil des soins.',
               lead='Pavurio transforme les soins quotidiens en petit jeu : notez repas, eau, promenades et jeux, et regardez votre chien ou votre chat se remplir de couleur. Rappels en douceur, séries, défis, rendez-vous véto, poids et dossiers de santé — tout au même endroit.',
               feats=['Suivi des soins & rappels', 'Séries, défis & badges', 'Rendez-vous, poids & dossiers', 'Sauvegardé sur votre compte']),
}
TITLES = {'privacy': 'privacy', 'terms': 'terms', 'support': 'support', 'delete-account': 'delete'}

CSS = """
:root{--ink:#23304A;--soft:#3D4A63;--muted:#7C8494;--brand:#14B8C4;--brandSoft:#DDF6F7;--line:#EEF0F3;--warm:#FFF6E6}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Nunito,ui-rounded,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#fff;line-height:1.6;font-size:17px}
a{color:var(--brand);font-weight:800;text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);z-index:2}
.bar{max-width:880px;margin:auto;display:flex;align-items:center;gap:18px;padding:12px 20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:900;font-size:20px}.brand img{width:34px;height:34px;border-radius:9px}
nav{display:flex;gap:16px;margin-left:auto;flex-wrap:wrap;font-size:15px}nav a{color:var(--soft)}nav a.on{color:var(--brand)}
main{max-width:760px;margin:auto;padding:28px 20px 60px}
h1{font-weight:900;font-size:34px;line-height:1.15;margin:.4em 0 .3em}h2{font-weight:900;font-size:22px;margin:1.6em 0 .4em}
p,li{color:var(--soft)}strong{color:var(--ink)}em{color:var(--muted);font-style:normal;font-size:14px}
table{border-collapse:collapse;width:100%;font-size:15px;margin:10px 0}th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.05em}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center;padding-top:20px}
.hero img{width:100%;max-width:340px;justify-self:center}
.tag{font-size:40px;font-weight:900;line-height:1.1;margin:0 0 14px}
.pill{display:inline-block;background:var(--ink);color:#fff;border-radius:999px;padding:14px 22px;font-weight:900;margin-top:10px}
.feats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px}
.feat{background:var(--warm);border-radius:20px;padding:16px 18px;font-weight:800;color:var(--ink)}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px}footer .bar{justify-content:center}
@media(max-width:680px){.hero{grid-template-columns:1fr}.tag{font-size:32px}.feats{grid-template-columns:1fr}nav{margin-left:0}}
"""

def page(lang, slug, title, body):
    t = L[lang]; pre = '' if lang == 'en' else '/fr'
    rel = lambda s: ('index.html' if s == 'index' else f'{s}.html')
    other_lang = 'fr' if lang == 'en' else 'en'
    other = (f'{BASE}/fr/' if other_lang == 'fr' else f'{BASE}/') + ('' if slug == 'index' else rel(slug))
    up = '' if lang == 'en' else '../'
    links = [('index', t['home']), ('support', t['support']), ('privacy', t['privacy']), ('terms', t['terms']), ('delete-account', t['delete'])]
    nav = ''.join(f'<a href="{rel(s)}" class="{"on" if s == slug else ""}">{n}</a>' for s, n in links)
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Pavurio</title><meta name="description" content="{t['tag']}"><link rel="icon" href="{up}favicon.png">
<link rel="alternate" hreflang="{other_lang}" href="{other}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<header><div class="bar"><a class="brand" href="{rel('index')}"><img src="{up}img/icon.png" alt="">Pavurio</a><nav>{nav}<a href="{other}">{t['other']}</a></nav></div></header>
<main>{body}</main>
<footer><div class="bar">© 2026 Pavurio · <a href="mailto:lesepavistespro@gmail.com">lesepavistespro@gmail.com</a></div></footer>
</body></html>"""

for lang in ('en', 'fr'):
    t = L[lang]; dest = OUT if lang == 'en' else f'{OUT}/fr'; up = '' if lang == 'en' else '../'
    feats = ''.join(f'<div class="feat">{f}</div>' for f in t['feats'])
    home = f"""<section class="hero"><div><p class="tag">{t['tag']}</p><p>{t['lead']}</p><span class="pill">{t['soon']}</span></div>
<img src="{up}img/duo.webp" alt="Pavurio"></section><section class="feats">{feats}</section>"""
    open(f'{dest}/index.html', 'w').write(page(lang, 'index', 'Pavurio', home))
    for slug, key in TITLES.items():
        md = open(f'{ROOT}/content/{lang}/{slug}.md').read()
        html = markdown.markdown(md, extensions=['tables'])
        open(f'{dest}/{slug}.html', 'w').write(page(lang, slug, t[key], html))
open(f'{OUT}/.nojekyll', 'w').write('')
print('built', sum(len(f) for _, _, f in os.walk(OUT)), 'files →', OUT)
