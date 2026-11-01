"""Pavurio website → site/dist (landing page in en/fr/es/pt + privacy, terms, support, account deletion).
Usage (repo root): python3 tools/site/build.py   (needs: pip install markdown pillow)
Hosted on Render (static site `pavurio-site`, auto-deploys from main) behind pavurio.com."""
import json, os, shutil, markdown
from PIL import Image

ROOT = 'site'; OUT = f'{ROOT}/dist'; BASE = 'https://pavurio.com'
PLAY = 'https://play.google.com/store/apps/details?id=com.pavurio.app'
LANGS = ['en', 'fr', 'es', 'pt']
LEGAL = ['privacy', 'terms', 'support', 'delete-account']

shutil.rmtree(OUT, ignore_errors=True)
for l in LANGS[1:]: os.makedirs(f'{OUT}/{l}')
shutil.copytree(f'{ROOT}/img', f'{OUT}/img')
Image.open('assets/icon.png').convert('RGBA').resize((64, 64), Image.LANCZOS).save(f'{OUT}/favicon.png')

S = {
 'en': dict(
  name='English', dir='', hl='en', home='Home', privacy='Privacy', terms='Terms', support='Support', delete='Delete account',
  seo_title='Pavurio: Pet Care Tracker – Dog & Cat Care App with Reminders',
  seo_desc='Pavurio is the pet care app where your dog or cat colours in as you log meals, water, walks and play. Smart reminders, streaks, challenges, vet visits, weight and health records. Free on Google Play.',
  h1='The pet care app where your pet colours in',
  sub='Log meals, water, walks and play in one tap, and watch your dog or cat fill with colour. Gentle reminders, streaks, challenges and a complete health file — in one cosy place.',
  play='Get it on Google Play', ios='Coming soon on iPhone', free='Free · Pro with a 7-day trial',
  sections=[
   ('Care in one tap', 'Meals, fresh water, walks, play, grooming and litter — logged in a second. Set a daily plan that fits your pet and watch today\'s progress fill up. Undo, edit and add notes any time.', 'shot-{l}-02', 'Logging water in Pavurio'),
   ('Smart reminders', 'A nudge at the times you choose, for every routine — meals, medication, walks. Mark it done right from the notification. An evening reminder only when today\'s plan isn\'t finished yet.', 'art-reminders', 'Smart pet care reminders'),
   ('Streaks, challenges & badges', 'Keep the streak going day after day. Take on 7-day and 30-day care challenges, earn badges as healthy habits form, and read short care tips written for dogs and cats.', 'shot-{l}-04', 'Streaks, challenges and badges'),
   ('Health & vet care, all in one place', 'Vet visits with a reminder the day before. Weight chart, vaccines, medication and allergies, photos of the paperwork — and a care summary to share with your vet or pet sitter.', 'art-health', 'Pet health records and vet visits'),
   ('Made for dogs and cats', 'Several pets, each with their own look, daily plan and history. Weekly stories and moments to look back on. Works offline, backs up to your account, exports any time. No ads, ever.', 'shot-{l}-07', 'A cat colouring in as it is cared for'),
  ],
  pro_h='Pavurio Pro', pro_p='Every challenge and tip, more pets, monthly stories and your full history.', pro_items=['Yearly €34.99 — 7-day free trial', 'Monthly €5.99', 'Lifetime €79.99, one payment'],
  faq_h='Questions', faq=[
   ('Is Pavurio free?', 'Yes. Logging care, reminders, streaks and the health file are free. Pavurio Pro unlocks every challenge and tip, more pets, monthly stories and the full history, with a 7-day free trial on the yearly plan.'),
   ('Does it work for cats and dogs?', 'Both. Each pet has its own look, daily plan, routines and history. Cats get litter tracking; dogs get a walk timer.'),
   ('Do I need an account?', 'No. Everything works offline on your phone. Sign in with Google, Apple or email only if you want a backup you can restore on a new phone.'),
   ('Is this veterinary advice?', 'No. Pavurio helps you keep track of the care you give and remember appointments. For anything health-related, talk to your vet.'),
   ('Which languages are supported?', 'English, French, Spanish and Portuguese.'),
  ],
  cta_h='Give your pet a colourful day', cta_p='Download Pavurio and log the first care in under a minute.',
  footer_tag='Pet care tracker for dogs and cats.', contact='Contact',
 ),
 'fr': dict(
  name='Français', dir='/fr', hl='fr', home='Accueil', privacy='Confidentialité', terms='Conditions', support='Aide', delete='Supprimer le compte',
  seo_title='Pavurio : application de soins pour chien et chat avec rappels',
  seo_desc='Pavurio est l’application de soins où votre chien ou votre chat se colore au fil des repas, de l’eau, des balades et des jeux notés. Rappels, séries, défis, rendez-vous véto, poids et carnet de santé. Gratuit sur Google Play.',
  h1='L’application de soins où votre animal se colore',
  sub='Notez repas, eau, promenades et jeux en un geste, et regardez votre chien ou votre chat se remplir de couleur. Rappels en douceur, séries, défis et un carnet de santé complet, au même endroit.',
  play='Disponible sur Google Play', ios='Bientôt sur iPhone', free='Gratuit · Pro avec 7 jours d’essai',
  sections=[
   ('Des soins en un geste', 'Repas, eau fraîche, promenades, jeux, toilettage et litière : notés en une seconde. Un programme quotidien adapté à votre animal, et la progression du jour qui se remplit. Annulez, modifiez ou ajoutez une note à tout moment.', 'shot-{l}-02', 'Noter l’eau dans Pavurio'),
   ('Des rappels intelligents', 'Un petit rappel aux heures que vous choisissez, pour chaque routine : repas, médicaments, balades. Marquez « Fait » depuis la notification. Un rappel le soir seulement si le programme du jour n’est pas terminé.', 'art-reminders', 'Rappels de soins pour animaux'),
   ('Séries, défis et badges', 'Faites durer votre série jour après jour. Relevez des défis de 7 et 30 jours, gagnez des badges en prenant de bonnes habitudes et lisez de courts conseils pour chiens et chats.', 'shot-{l}-04', 'Séries, défis et badges'),
   ('La santé et le véto au même endroit', 'Rendez-vous vétérinaires avec rappel la veille. Courbe de poids, vaccins, médicaments et allergies, photos des documents, et un résumé des soins à partager avec le vétérinaire ou le pet-sitter.', 'art-health', 'Carnet de santé et rendez-vous véto'),
   ('Pour les chiens et les chats', 'Plusieurs animaux, chacun avec son apparence, son programme et son historique. Des histoires de la semaine et des moments à revoir. Fonctionne hors connexion, sauvegardé sur votre compte, export à tout moment. Jamais de publicité.', 'shot-{l}-07', 'Un chat qui se colore au fil des soins'),
  ],
  pro_h='Pavurio Pro', pro_p='Tous les défis et conseils, plus d’animaux, les histoires du mois et tout l’historique.', pro_items=['Annuel 34,99 € — 7 jours d’essai gratuit', 'Mensuel 5,99 €', 'À vie 79,99 €, un seul paiement'],
  faq_h='Questions', faq=[
   ('Pavurio est-il gratuit ?', 'Oui. Noter les soins, les rappels, les séries et le carnet de santé sont gratuits. Pavurio Pro débloque tous les défis et conseils, plus d’animaux, les histoires du mois et tout l’historique, avec 7 jours d’essai gratuit sur l’offre annuelle.'),
   ('Pour les chats et les chiens ?', 'Les deux. Chaque animal a son apparence, son programme, ses routines et son historique. Les chats ont le suivi de la litière, les chiens le chrono de balade.'),
   ('Faut-il un compte ?', 'Non. Tout fonctionne hors connexion sur votre téléphone. Connectez-vous avec Google, Apple ou un e-mail seulement pour une sauvegarde à retrouver sur un nouveau téléphone.'),
   ('Est-ce un avis vétérinaire ?', 'Non. Pavurio vous aide à suivre les soins que vous donnez et à ne pas oublier les rendez-vous. Pour toute question de santé, parlez à votre vétérinaire.'),
   ('Quelles langues ?', 'Anglais, français, espagnol et portugais.'),
  ],
  cta_h='Offrez une journée colorée à votre animal', cta_p='Téléchargez Pavurio et notez le premier soin en moins d’une minute.',
  footer_tag='Suivi des soins pour chiens et chats.', contact='Contact',
 ),
 'es': dict(
  name='Español', dir='/es', hl='es', home='Inicio', privacy='Privacidad', terms='Términos', support='Ayuda', delete='Eliminar cuenta',
  seo_title='Pavurio: app de cuidado de mascotas para perros y gatos con recordatorios',
  seo_desc='Pavurio es la app de cuidado de mascotas en la que tu perro o gato se colorea al registrar comidas, agua, paseos y juegos. Recordatorios, rachas, retos, visitas al veterinario, peso e historial de salud. Gratis en Google Play.',
  h1='La app de cuidado de mascotas en la que tu mascota se colorea',
  sub='Registra comidas, agua, paseos y juegos con un toque y mira cómo tu perro o gato se llena de color. Recordatorios amables, rachas, retos y un historial de salud completo, todo en un mismo lugar.',
  play='Disponible en Google Play', ios='Pronto en iPhone', free='Gratis · Pro con 7 días de prueba',
  sections=[
   ('Cuidados con un toque', 'Comidas, agua fresca, paseos, juego, cepillado y arenero: registrados en un segundo. Crea un plan diario a la medida de tu mascota y mira cómo se llena el progreso de hoy. Deshaz, edita y añade notas cuando quieras.', 'shot-en-02', 'Registrar agua en Pavurio'),
   ('Recordatorios inteligentes', 'Un aviso a las horas que elijas, para cada rutina: comidas, medicación, paseos. Márcalo como hecho desde la notificación. Un recordatorio por la noche solo si el plan de hoy aún no está completo.', 'art-reminders', 'Recordatorios de cuidado de mascotas'),
   ('Rachas, retos e insignias', 'Mantén la racha día tras día. Acepta retos de 7 y 30 días, gana insignias mientras creas hábitos saludables y lee consejos breves escritos para perros y gatos.', 'shot-en-04', 'Rachas, retos e insignias'),
   ('Salud y veterinario en un solo lugar', 'Visitas al veterinario con recordatorio el día anterior. Gráfica de peso, vacunas, medicación y alergias, fotos de los documentos, y un resumen de cuidados para compartir con tu veterinario o cuidador.', 'art-health', 'Historial de salud y visitas al veterinario'),
   ('Hecha para perros y gatos', 'Varias mascotas, cada una con su aspecto, su plan diario y su historial. Historias semanales y momentos para recordar. Funciona sin conexión, se guarda en tu cuenta y se exporta cuando quieras. Sin anuncios, nunca.', 'shot-en-07', 'Un gato que se colorea al cuidarlo'),
  ],
  pro_h='Pavurio Pro', pro_p='Todos los retos y consejos, más mascotas, historias mensuales y todo tu historial.', pro_items=['Anual 34,99 € — 7 días de prueba gratis', 'Mensual 5,99 €', 'De por vida 79,99 €, un solo pago'],
  faq_h='Preguntas', faq=[
   ('¿Pavurio es gratis?', 'Sí. Registrar cuidados, los recordatorios, las rachas y el historial de salud son gratis. Pavurio Pro desbloquea todos los retos y consejos, más mascotas, historias mensuales y el historial completo, con 7 días de prueba gratis en el plan anual.'),
   ('¿Sirve para gatos y perros?', 'Para ambos. Cada mascota tiene su aspecto, su plan diario, sus rutinas y su historial. Los gatos tienen seguimiento del arenero; los perros, un cronómetro de paseo.'),
   ('¿Necesito una cuenta?', 'No. Todo funciona sin conexión en tu teléfono. Inicia sesión con Google, Apple o correo solo si quieres una copia de seguridad para restaurar en un teléfono nuevo.'),
   ('¿Es un consejo veterinario?', 'No. Pavurio te ayuda a llevar el registro de los cuidados que das y a recordar las citas. Para cualquier tema de salud, habla con tu veterinario.'),
   ('¿Qué idiomas hay?', 'Inglés, francés, español y portugués.'),
  ],
  cta_h='Regálale a tu mascota un día lleno de color', cta_p='Descarga Pavurio y registra el primer cuidado en menos de un minuto.',
  footer_tag='Registro de cuidados para perros y gatos.', contact='Contacto',
 ),
 'pt': dict(
  name='Português', dir='/pt', hl='pt', home='Início', privacy='Privacidade', terms='Termos', support='Ajuda', delete='Excluir conta',
  seo_title='Pavurio: app de cuidados para cães e gatos com lembretes',
  seo_desc='Pavurio é o app de cuidados com pets em que o seu cão ou gato se colore à medida que você registra refeições, água, passeios e brincadeiras. Lembretes, sequências, desafios, consultas no veterinário, peso e histórico de saúde. Grátis no Google Play.',
  h1='O app de cuidados em que o seu pet se colore',
  sub='Registre refeições, água, passeios e brincadeiras com um toque e veja o seu cão ou gato se encher de cor. Lembretes gentis, sequências, desafios e um histórico de saúde completo, tudo em um só lugar.',
  play='Disponível no Google Play', ios='Em breve no iPhone', free='Grátis · Pro com 7 dias de teste',
  sections=[
   ('Cuidados com um toque', 'Refeições, água fresca, passeios, brincadeiras, escovação e caixa de areia: registrados em um segundo. Crie um plano diário na medida do seu pet e veja o progresso de hoje se encher. Desfaça, edite e adicione notas quando quiser.', 'shot-en-02', 'Registrar água no Pavurio'),
   ('Lembretes inteligentes', 'Um aviso nos horários que você escolher, para cada rotina: refeições, medicação, passeios. Marque como feito direto da notificação. Um lembrete à noite só se o plano de hoje ainda não estiver completo.', 'art-reminders', 'Lembretes de cuidados com pets'),
   ('Sequências, desafios e conquistas', 'Mantenha a sequência dia após dia. Aceite desafios de 7 e 30 dias, ganhe conquistas enquanto cria hábitos saudáveis e leia dicas curtas escritas para cães e gatos.', 'shot-en-04', 'Sequências, desafios e conquistas'),
   ('Saúde e veterinário em um só lugar', 'Consultas no veterinário com lembrete no dia anterior. Gráfico de peso, vacinas, medicação e alergias, fotos dos documentos e um resumo dos cuidados para compartilhar com o veterinário ou o pet sitter.', 'art-health', 'Histórico de saúde e consultas no veterinário'),
   ('Feito para cães e gatos', 'Vários pets, cada um com a sua aparência, o seu plano diário e o seu histórico. Histórias da semana e momentos para rever. Funciona offline, salva na sua conta e exporta quando quiser. Sem anúncios, nunca.', 'shot-en-07', 'Um gato que se colore ao ser cuidado'),
  ],
  pro_h='Pavurio Pro', pro_p='Todos os desafios e dicas, mais pets, histórias mensais e todo o seu histórico.', pro_items=['Anual € 34,99 — 7 dias de teste grátis', 'Mensal € 5,99', 'Vitalício € 79,99, pagamento único'],
  faq_h='Perguntas', faq=[
   ('O Pavurio é grátis?', 'Sim. Registrar cuidados, os lembretes, as sequências e o histórico de saúde são grátis. O Pavurio Pro desbloqueia todos os desafios e dicas, mais pets, histórias mensais e o histórico completo, com 7 dias de teste grátis no plano anual.'),
   ('Serve para gatos e cães?', 'Para os dois. Cada pet tem a sua aparência, o seu plano diário, as suas rotinas e o seu histórico. Gatos têm o registro da caixa de areia; cães, um cronômetro de passeio.'),
   ('Preciso de uma conta?', 'Não. Tudo funciona offline no seu telefone. Entre com Google, Apple ou e-mail só se quiser um backup para restaurar em um telefone novo.'),
   ('É um conselho veterinário?', 'Não. O Pavurio ajuda você a acompanhar os cuidados que dá e a lembrar das consultas. Para qualquer questão de saúde, fale com o seu veterinário.'),
   ('Quais idiomas?', 'Inglês, francês, espanhol e português.'),
  ],
  cta_h='Dê ao seu pet um dia cheio de cor', cta_p='Baixe o Pavurio e registre o primeiro cuidado em menos de um minuto.',
  footer_tag='Registro de cuidados para cães e gatos.', contact='Contato',
 ),
}
TITLES = {'privacy': 'privacy', 'terms': 'terms', 'support': 'support', 'delete-account': 'delete'}

CSS = """
:root{--ink:#163A4A;--soft:#3D4A63;--muted:#7C8494;--brand:#14B8C4;--brandDark:#0E8F99;--brandSoft:#DDF6F7;--sun:#FFD233;--line:#EEF0F3;--warm:#FFF6E6;--grass:#E6F7DA}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:Nunito,ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:#fff;line-height:1.6;font-size:17px}
a{color:var(--brandDark);font-weight:800;text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
header{position:sticky;top:0;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);z-index:5}
.bar{max-width:1040px;margin:auto;display:flex;align-items:center;gap:18px;padding:12px 20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:900;font-size:21px}.brand img{width:36px;height:36px;border-radius:10px}
nav{display:flex;gap:16px;margin-left:auto;flex-wrap:wrap;font-size:15px;align-items:center}nav a{color:var(--soft)}nav a.on{color:var(--brandDark)}
.langs{display:flex;gap:6px}.langs a{padding:4px 9px;border-radius:999px;background:var(--line);font-size:13px;color:var(--soft)}.langs a.on{background:var(--brandSoft);color:var(--brandDark)}
main{max-width:1040px;margin:auto;padding:0 20px 60px}
.doc{max-width:760px;padding-top:24px}
h1{font-weight:900;font-size:46px;line-height:1.08;margin:0 0 16px;letter-spacing:-.01em}
h2{font-weight:900;font-size:32px;line-height:1.15;margin:0 0 12px}
.doc h1{font-size:34px}.doc h2{font-size:22px;margin:1.6em 0 .4em}
p,li{color:var(--soft)}strong{color:var(--ink)}em{color:var(--muted);font-style:normal;font-size:14px}
table{border-collapse:collapse;width:100%;font-size:15px;margin:10px 0}th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.05em}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center;padding:48px 0 30px}
.hero .sub{font-size:20px;margin:0 0 22px}
.hero img{width:100%;max-width:420px;justify-self:center;border-radius:28px;box-shadow:0 24px 60px rgba(22,58,74,.14)}
.btns{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn{display:inline-flex;align-items:center;gap:10px;background:var(--ink);color:#fff;border-radius:999px;padding:15px 24px;font-weight:900;font-size:17px;box-shadow:0 10px 24px rgba(22,58,74,.18)}.btn:hover{text-decoration:none;transform:translateY(-1px)}
.btn.soft{background:var(--brandSoft);color:var(--brandDark);box-shadow:none}
.free{font-size:14px;color:var(--muted);margin:12px 0 0;font-weight:800}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;padding:56px 0;border-top:1px solid var(--line)}
.feat:nth-child(even) .img{order:-1}
.feat .img img{max-width:360px;margin:auto;border-radius:26px;box-shadow:0 20px 50px rgba(22,58,74,.12)}
.feat p{font-size:18px}
.pro{background:var(--warm);border-radius:32px;padding:40px;margin:30px 0;display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}
.pro ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}.pro li{background:#fff;border-radius:16px;padding:14px 18px;font-weight:800;color:var(--ink)}
.faq{padding:40px 0}.faq details{border-bottom:1px solid var(--line);padding:14px 0}.faq summary{font-weight:900;font-size:18px;cursor:pointer;color:var(--ink)}.faq p{margin:8px 0 0}
.cta{text-align:center;padding:60px 20px;background:linear-gradient(180deg,var(--brandSoft),#fff);border-radius:32px;margin:20px 0}
.cta h2{font-size:36px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px;padding:10px 0}footer .bar{justify-content:space-between}footer nav{margin-left:0}
@media(max-width:760px){.hero{grid-template-columns:1fr;padding-top:28px}h1{font-size:34px}h2{font-size:26px}.feat{grid-template-columns:1fr;gap:20px;padding:40px 0}.feat:nth-child(even) .img{order:0}.pro{grid-template-columns:1fr;padding:26px}nav{margin-left:0}.cta h2{font-size:28px}}
"""

def pre(lang): return S[lang]['dir']
def rel(slug): return 'index.html' if slug == 'index' else f'{slug}.html'
def url(lang, slug): return f"{BASE}{pre(lang)}/" + ('' if slug == 'index' else rel(slug))

def page(lang, slug, title, desc, body, jsonld=None):
    t = S[lang]; up = '' if lang == 'en' else '../'
    alts = ''.join(f'<link rel="alternate" hreflang="{S[l]["hl"]}" href="{url(l, slug)}">' for l in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{url("en", slug)}">'
    links = [('index', t['home']), ('support', t['support']), ('privacy', t['privacy']), ('terms', t['terms']), ('delete-account', t['delete'])]
    nav = ''.join(f'<a href="{rel(s)}" class="{"on" if s == slug else ""}">{n}</a>' for s, n in links)
    langs = '<span class="langs">' + ''.join(f'<a href="{url(l, slug)}" hreflang="{l}" class="{"on" if l == lang else ""}">{l.upper()}</a>' for l in LANGS) + '</span>'
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ''
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{url(lang, slug)}">{alts}
<meta property="og:type" content="website"><meta property="og:site_name" content="Pavurio"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:url" content="{url(lang, slug)}"><meta property="og:image" content="{BASE}/img/og.jpg"><meta property="og:locale" content="{ {'en':'en_US','fr':'fr_FR','es':'es_ES','pt':'pt_BR'}[lang] }">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#14B8C4">
<link rel="icon" href="{up}favicon.png"><link rel="apple-touch-icon" href="{up}img/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
<style>{CSS}</style>{ld}</head><body>
<header><div class="bar"><a class="brand" href="{rel('index')}"><img src="{up}img/icon-192.png" alt="Pavurio" width="36" height="36">Pavurio</a><nav>{nav}{langs}</nav></div></header>
<main>{body}</main>
<footer><div class="bar"><span>© 2026 Pavurio · {t['footer_tag']}</span><nav>{nav}<a href="mailto:lesepavistespro@gmail.com">{t['contact']}</a></nav></div></footer>
</body></html>"""

def landing(lang):
    t = S[lang]; up = '' if lang == 'en' else '../'
    img = lambda n: f'{up}img/{n.replace("{l}", "fr" if lang == "fr" else "en")}.webp'
    feats = ''.join(f'<section class="feat"><div><h2>{h}</h2><p>{p}</p></div><div class="img"><img src="{img(n)}" alt="{alt}" loading="lazy" width="360" height="{640 if n.startswith("art") else 720}"></div></section>' for h, p, n, alt in t['sections'])
    pro = f'<section class="pro"><div><h2>{t["pro_h"]}</h2><p>{t["pro_p"]}</p></div><ul>' + ''.join(f'<li>{i}</li>' for i in t['pro_items']) + '</ul></section>'
    faq = f'<section class="faq"><h2>{t["faq_h"]}</h2>' + ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in t['faq']) + '</section>'
    body = f"""<section class="hero"><div><h1>{t['h1']}</h1><p class="sub">{t['sub']}</p>
<div class="btns"><a class="btn" href="{PLAY}" rel="noopener">▶ {t['play']}</a><span class="btn soft"> {t['ios']}</span></div><p class="free">{t['free']}</p></div>
<img src="{up}img/art-companion.webp" alt="Pavurio – {t['footer_tag']}" width="420" height="746" fetchpriority="high"></section>
{feats}{pro}{faq}
<section class="cta"><h2>{t['cta_h']}</h2><p>{t['cta_p']}</p><div class="btns" style="justify-content:center"><a class="btn" href="{PLAY}" rel="noopener">▶ {t['play']}</a></div></section>"""
    ld = [
      {'@context': 'https://schema.org', '@type': 'MobileApplication', 'name': 'Pavurio: Pet Care Tracker', 'operatingSystem': 'Android', 'applicationCategory': 'LifestyleApplication',
       'description': t['seo_desc'], 'url': url(lang, 'index'), 'image': f'{BASE}/img/og.jpg', 'installUrl': PLAY, 'inLanguage': LANGS,
       'offers': [{'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'}, {'@type': 'Offer', 'price': '34.99', 'priceCurrency': 'EUR', 'name': 'Pavurio Pro yearly'}],
       'author': {'@type': 'Organization', 'name': 'Pavurio', 'url': BASE, 'email': 'lesepavistespro@gmail.com'}},
      {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in t['faq']]},
    ]
    return page(lang, 'index', t['seo_title'], t['seo_desc'], body, ld)

for lang in LANGS:
    t = S[lang]; dest = OUT if lang == 'en' else f'{OUT}/{lang}'
    open(f'{dest}/index.html', 'w').write(landing(lang))
    for slug, key in TITLES.items():
        src = f'{ROOT}/content/{lang}/{slug}.md'
        if not os.path.exists(src): src = f'{ROOT}/content/en/{slug}.md'
        html = markdown.markdown(open(src).read(), extensions=['tables'])
        open(f'{dest}/{slug}.html', 'w').write(page(lang, slug, f'{t[key]} · Pavurio', t['seo_desc'], f'<div class="doc">{html}</div>'))

urls = [url(l, s) for l in LANGS for s in ['index'] + LEGAL]
open(f'{OUT}/sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + ''.join(
    f'<url><loc>{url(l, s)}</loc>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{S[a]["hl"]}" href="{url(a, s)}"/>' for a in LANGS) + '</url>' for l in LANGS for s in ['index'] + LEGAL) + '</urlset>')
open(f'{OUT}/robots.txt', 'w').write(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n')
open(f'{OUT}/.nojekyll', 'w').write('')
print('built', sum(len(f) for _, _, f in os.walk(OUT)), 'files →', OUT)
