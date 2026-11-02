/**
 * Weather provider for Pavurio Adventures: Open-Meteo (forecast + geocoding). No GPS — the owner picks
 * their town once and we remember it. Results are cached for 20 minutes per place. Every call can fail
 * (offline, provider down): callers get `null` and the walk goes on without weather.
 *
 * Commercial use of Open-Meteo needs their API plan: set `extra.weatherApiKey` in app.json and requests
 * go to the customer endpoints with the key. Without a key the free endpoints are used.
 */
import Constants from 'expo-constants';
import type { Db } from '../data/db';
import { getSetting, setSetting } from '../data/repo';
import { OpenMeteoForecast, Place, WeatherSnapshot, snapshotFromOpenMeteo } from '../domain/weather';
import { lang } from '../i18n';

const KEY = (Constants.expoConfig?.extra as { weatherApiKey?: string } | undefined)?.weatherApiKey;
const FORECAST = KEY ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = KEY ? 'https://customer-geocoding-api.open-meteo.com/v1/search' : 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_MS = 20 * 60_000;
const TIMEOUT_MS = 8000;

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url + (KEY ? `&apikey=${encodeURIComponent(KEY)}` : ''), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPlace(db: Db): Promise<Place | null> {
  const raw = await getSetting(db, 'weatherPlace');
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Place;
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
  } catch {
    return null;
  }
}

export async function savePlace(db: Db, place: Place): Promise<void> {
  await setSetting(db, 'weatherPlace', JSON.stringify(place));
  await setSetting(db, 'weatherCache', '');
}

type GeoResult = { results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string }[] };

/** Town search for the one-time place picker. */
export async function searchPlaces(query: string): Promise<(Place & { region: string | null })[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const r = await getJson<GeoResult>(`${GEOCODE}?name=${encodeURIComponent(q)}&count=8&language=${lang()}&format=json`);
  return (r.results ?? []).map((x) => ({ name: x.name, country: x.country ?? null, region: x.admin1 ?? null, lat: x.latitude, lon: x.longitude, tz: x.timezone ?? null }));
}

type Cache = { key: string; at: number; snap: WeatherSnapshot };

/** Current weather at the saved place, from the cache when it's fresh. Null when there's no place or no answer. */
export async function currentWeather(db: Db, opts: { force?: boolean; now?: number } = {}): Promise<WeatherSnapshot | null> {
  const now = opts.now ?? Date.now();
  const place = await getPlace(db);
  if (!place) return null;
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  if (!opts.force) {
    try {
      const c = JSON.parse((await getSetting(db, 'weatherCache')) || 'null') as Cache | null;
      if (c && c.key === key && now - c.at < CACHE_MS) return c.snap;
    } catch {
      /* stale or corrupt cache: fetch */
    }
  }
  try {
    const url =
      `${FORECAST}?latitude=${place.lat}&longitude=${place.lon}` +
      '&current=temperature_2m,weather_code,is_day,wind_speed_10m&hourly=precipitation_probability&daily=sunrise,sunset' +
      '&timezone=auto&timeformat=unixtime&forecast_days=1';
    const r = await getJson<OpenMeteoForecast>(url);
    const snap = snapshotFromOpenMeteo(r, place, now);
    if (!snap.available) return null;
    await setSetting(db, 'weatherCache', JSON.stringify({ key, at: now, snap } satisfies Cache));
    return snap;
  } catch (e) {
    console.warn('[pavurio] weather unavailable', e);
    return null;
  }
}
