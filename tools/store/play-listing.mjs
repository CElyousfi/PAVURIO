/**
 * Push the Google Play store listing (text, icon, feature graphic, phone screenshots) for every locale
 * in docs/store/listings.json, then commit the edit.
 *
 *   PLAY_KEY=/path/to/service-account.json node tools/store/play-listing.mjs [--text-only]
 *
 * Needs `npm i googleapis` (not a project dependency). Screenshots come from docs/store/screenshots/<lang>/google-play
 * (falls back to en when a language has no set); art frames come first (docs/store/art), then real screens.
 */
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = 'com.pavurio.app';
const textOnly = process.argv.includes('--text-only');
const keyFile = process.env.PLAY_KEY;
if (!keyFile) throw new Error('PLAY_KEY=/path/to/service-account.json');

const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
const listings = JSON.parse(fs.readFileSync(`${ROOT}/docs/store/listings.json`, 'utf8'));

const edit = (await ap.edits.insert({ packageName: PKG })).data.id;
const o = { packageName: PKG, editId: edit };
await ap.edits.details.update({ ...o, requestBody: { defaultLanguage: 'en-US', contactEmail: 'lesepavistespro@gmail.com', contactWebsite: 'https://pavurio.com' } });

for (const [language, l] of Object.entries(listings)) {
  if (language.startsWith('_')) continue;
  if (l.title.length > 30 || l.short.length > 80 || l.full.length > 4000) throw new Error(`too long: ${language}`);
  await ap.edits.listings.update({ ...o, language, requestBody: { language, title: l.title, shortDescription: l.short, fullDescription: l.full } });
  if (!textOnly) {
    const lang = language.slice(0, 2);
    const shotsDir = fs.existsSync(`${ROOT}/docs/store/screenshots/${lang}/google-play`) ? `${ROOT}/docs/store/screenshots/${lang}/google-play` : `${ROOT}/docs/store/screenshots/en/google-play`;
    const up = (imageType, file) => ap.edits.images.upload({ ...o, language, imageType, media: { mimeType: 'image/png', body: fs.createReadStream(file) } });
    for (const t of ['icon', 'featureGraphic', 'phoneScreenshots']) await ap.edits.images.deleteall({ ...o, language, imageType: t }).catch(() => {});
    await up('icon', `${ROOT}/docs/store/graphics/play-icon-512.png`);
    const fg = `${ROOT}/docs/store/graphics/play-feature-graphic-${lang}.png`;
    await up('featureGraphic', fs.existsSync(fg) ? fg : `${ROOT}/docs/store/graphics/play-feature-graphic-en.png`);
    const frames = process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${lang}` : null;
    const files = frames && fs.existsSync(frames) ? fs.readdirSync(frames).sort().map((f) => `${frames}/${f}`) : fs.readdirSync(shotsDir).sort().slice(0, 8).map((f) => `${shotsDir}/${f}`);
    for (const f of files) await up('phoneScreenshots', f);
  }
  console.log('listing', language, textOnly ? '(text)' : '(text + images)');
}
await ap.edits.validate(o);
const c = await ap.edits.commit(o);
console.log('committed edit', c.data.id);
