// Store screenshots with captions: node tools/store/frames.js <rawDir> <outDir>
// raw shots come from the web build (440x956 @3x). Apple 6.9" = 1320x2868, Google Play phone = 1080x2160.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const RAW = process.argv[2], OUT = process.argv[3];
const F = (w) => `file://${path.resolve('node_modules/@expo-google-fonts/nunito')}/${w}`;
const SETS = {
  en: [
    ['en_dog/01_home', 'Your pet colours in', 'as you care for them', '#FFF3DC'],
    ['en_dog/02_log', 'Log any care', 'in one tap', '#DDF6F7'],
    ['en_dog/04_care', 'Gentle reminders', 'for every routine', '#EAF7DF'],
    ['en_dog/05_achievements', 'Streaks, challenges', '& badges to earn', '#FDEBF1'],
    ['en_dog/08_summary', 'See every week', 'at a glance', '#ECE8FD'],
    ['en_dog/09_records', 'Vet visits & records', 'all in one place', '#FFF3DC'],
    ['en_cat/01_home', 'Made for dogs', 'and cats', '#DDF6F7'],
  ],
  fr: [
    ['fr_dog/01_home', 'Votre animal se colore', 'au fil des soins', '#FFF3DC'],
    ['fr_dog/02_log', 'Notez un soin', 'en un geste', '#DDF6F7'],
    ['fr_dog/04_care', 'Des rappels en douceur', 'pour chaque routine', '#EAF7DF'],
    ['fr_dog/05_achievements', 'Séries, défis', 'et badges à gagner', '#FDEBF1'],
    ['fr_dog/08_summary', 'Chaque semaine', 'en un coup d’œil', '#ECE8FD'],
    ['fr_dog/09_records', 'Rendez-vous et dossiers', 'au même endroit', '#FFF3DC'],
    ['fr_cat/01_home', 'Pour les chiens', 'et les chats', '#DDF6F7'],
  ],
};
const html = (W, H, img, l1, l2, bg) => {
  const pad = Math.round(W * 0.085), shotW = W - pad * 2, top = Math.round(H * 0.2);
  return `<html><head><style>
@font-face{font-family:N;font-weight:900;src:url(${F('900Black/Nunito_900Black.ttf')})}
@font-face{font-family:N;font-weight:800;src:url(${F('800ExtraBold/Nunito_800ExtraBold.ttf')})}
body{margin:0;width:${W}px;height:${H}px;background:${bg};font-family:N;overflow:hidden;position:relative}
.t{position:absolute;left:0;right:0;top:${Math.round(H * 0.055)}px;text-align:center;color:#23304A}
.a{font-weight:900;font-size:${Math.round(W * 0.075)}px;line-height:1.08}
.b{font-weight:800;font-size:${Math.round(W * 0.058)}px;line-height:1.15;color:#3D4A63;margin-top:${Math.round(W * 0.01)}px}
.p{position:absolute;left:${pad}px;top:${top}px;width:${shotW}px;border-radius:${Math.round(W * 0.07)}px;overflow:hidden;
box-shadow:0 ${Math.round(W * 0.02)}px ${Math.round(W * 0.06)}px rgba(35,48,74,.18);border:${Math.round(W * 0.012)}px solid #fff;background:#fff}
.p img{display:block;width:100%}
</style></head><body><div class="t"><div class="a">${l1}</div><div class="b">${l2}</div></div><div class="p"><img src="file://${img}"></div></body></html>`;
};
(async () => {
  const b = await chromium.launch();
  for (const [lang, set] of Object.entries(SETS)) {
    for (const [store, W, H] of [['apple-6.9', 1320, 2868], ['google-play', 1080, 2160]]) {
      const dir = `${OUT}/${lang}/${store}`; fs.mkdirSync(dir, { recursive: true });
      const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      for (const [i, [src, l1, l2, bg]] of set.entries()) {
        const tmp = path.resolve(`${OUT}/.frame.html`);
        fs.writeFileSync(tmp, html(W, H, path.resolve(`${RAW}/${src}.png`), l1, l2, bg));
        await p.goto(`file://${tmp}`, { waitUntil: 'load' });
        await p.waitForTimeout(150);
        await p.screenshot({ path: `${dir}/${String(i + 1).padStart(2, '0')}.png` });
      }
      await p.close();
    }
  }
  fs.rmSync(`${OUT}/.frame.html`, { force: true });
  await b.close(); console.log('done');
})();
