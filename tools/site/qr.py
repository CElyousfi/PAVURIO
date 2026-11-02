"""QR codes for desktop visitors (scan → Google Play, tagged so installs are attributed to the website).
Usage (repo root): pip install segno && python3 tools/site/qr.py  → site/img/l/qr_<lang>.svg"""
import io, urllib.parse, segno

PLAY = 'https://play.google.com/store/apps/details?id=com.pavurio.app'
for lang in ('en', 'fr', 'es', 'pt'):
    ref = urllib.parse.quote(f'utm_source=pavurio.com&utm_medium=qr&utm_campaign=landing_{lang}&utm_content=desktop_qr', safe='')
    q = segno.make(f'{PLAY}&referrer={ref}', error='m')
    b = io.BytesIO()
    q.save(b, kind='svg', scale=4, border=2, xmldecl=False, dark='#163A4A', light='#FFFFFF')
    open(f'site/img/l/qr_{lang}.svg', 'wb').write(b.getvalue())
print('ok')
