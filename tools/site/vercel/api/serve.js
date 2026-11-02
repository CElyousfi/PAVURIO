// pavurio.com on Vercel: serves the built site (branch `site-dist` of the public PAVURIO repo,
// produced by tools/site/build.py) with the right content types; Vercel's CDN caches every file.
export const config = { runtime: 'edge' };

const ORIGIN = 'https://raw.githubusercontent.com/CElyousfi/PAVURIO/site-dist/';
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', xml: 'application/xml; charset=utf-8', txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon',
  woff2: 'font/woff2',
};

export default async function handler(req) {
  const url = new URL(req.url);
  let p = (url.searchParams.get('p') || '').replace(/^\/+/, '');
  try { p = decodeURIComponent(p); } catch { return notFound(); }
  if (p.includes('..') || p.includes('\\')) return notFound();
  if (p === '' || p.endsWith('/')) p += 'index.html';
  else if (!/\.[a-z0-9]+$/i.test(p)) p += '/index.html'; // /fr → fr/index.html
  const ext = (p.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (!ext || !TYPES[ext]) return notFound();

  const res = await fetch(ORIGIN + p, {});
  if (!res.ok) return notFound();
  const isPage = ext === 'html' || ext === 'xml' || ext === 'txt';
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': TYPES[ext],
      'Cache-Control': isPage ? 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' : 'public, max-age=604800, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function notFound() {
  return new Response('<!doctype html><meta charset="utf-8"><title>Not found · Pavurio</title><body style="font-family:system-ui;text-align:center;padding:60px"><h1>Page not found</h1><p><a href="/">Back to Pavurio</a></p>', {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
}
