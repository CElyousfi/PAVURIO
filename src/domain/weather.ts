/**
 * Weather for Pavurio Adventures. Pure: mapping the provider's data (Open-Meteo, WMO weather codes) to
 * what the Walk screen shows. Weather is context, never a promise: the advice never says a walk is safe.
 */
import { t } from '../i18n/core';

export type Condition = 'sunny' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

/** What a walk remembers about the weather (all of it optional: a walk saves fine without weather). */
export type WeatherSnapshot = {
  /** false when the provider couldn't be reached: only the place is known */
  available: boolean;
  tempC: number | null;
  /** WMO weather code */
  code: number | null;
  condition: Condition | null;
  isDay: boolean | null;
  /** chance of rain in the coming hour, 0–100 */
  rainChance: number | null;
  windKmh: number | null;
  /** today's sunrise / sunset at the place (ms), when the provider gave them */
  sunrise: number | null;
  sunset: number | null;
  place: string | null;
  lat: number | null;
  lon: number | null;
  tz: string | null;
  /** when the provider produced the data */
  fetchedAt: number;
  source: 'open-meteo' | 'none';
};

export type Place = { name: string; country: string | null; lat: number; lon: number; tz: string | null };

/** WMO code → our handful of conditions (https://open-meteo.com/en/docs, "WMO Weather interpretation codes"). */
export function conditionFromWmo(code: number): Condition {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export type WeatherArt = 'sunny' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'hot' | 'cold' | 'night';

/** Which illustration fits: heat and cold win over the sky, so the warning reads at a glance. */
export function weatherArt(w: WeatherSnapshot | null): WeatherArt | null {
  if (!w || !w.available || w.condition == null) return null;
  if (w.tempC != null && w.tempC >= 28) return 'hot';
  if (w.tempC != null && w.tempC <= 2) return 'cold';
  if (w.condition === 'storm') return 'storm';
  if (w.condition === 'snow') return 'snow';
  if (w.condition === 'rain') return 'rain';
  if (w.condition === 'fog' || w.condition === 'cloudy') return 'cloudy';
  if (w.condition === 'partly') return 'partly';
  return w.isDay === false ? 'night' : 'sunny';
}

export function conditionLabel(c: Condition | null): string {
  switch (c) {
    case 'sunny':
      return t('Sunny');
    case 'partly':
      return t('Partly cloudy');
    case 'cloudy':
      return t('Cloudy');
    case 'fog':
      return t('Foggy');
    case 'rain':
      return t('Rainy');
    case 'storm':
      return t('Stormy');
    case 'snow':
      return t('Snowy');
    default:
      return '';
  }
}

export type TempUnit = 'C' | 'F';
export function formatTemp(c: number | null, unit: TempUnit): string {
  if (c == null) return '–';
  return unit === 'F' ? `${Math.round(c * 1.8 + 32)}°F` : `${Math.round(c)}°C`;
}

export type Advice = { level: 'ok' | 'caution' | 'danger'; text: string };

/**
 * One short, honest suggestion. Dangerous conditions get a caution instead of encouragement, and nothing
 * here claims a walk is safe for a particular dog: the owner knows their dog.
 */
export function walkAdvice(w: WeatherSnapshot | null): Advice {
  if (!w || !w.available) return { level: 'ok', text: t('Weather isn’t available right now. Check the sky before you go.') };
  const temp = w.tempC;
  if (w.condition === 'storm') return { level: 'danger', text: t('Thunderstorms around. Waiting it out may be wiser today.') };
  if (temp != null && temp >= 30) return { level: 'danger', text: t('Very hot out. Keep it short, stay in the shade and test the pavement with your hand.') };
  if (temp != null && temp <= -10) return { level: 'danger', text: t('Very cold out. Keep it short and check paws for ice and salt.') };
  if (temp != null && temp >= 25) return { level: 'caution', text: t('Warm out. Bring water and avoid hot pavement.') };
  if (temp != null && temp <= 2) return { level: 'caution', text: t('Chilly out. A shorter walk and a dry towel after.') };
  if (w.condition === 'snow') return { level: 'caution', text: t('Snow about. Watch for ice and wipe paws after.') };
  if (w.condition === 'rain' || (w.rainChance != null && w.rainChance >= 60)) return { level: 'caution', text: t('Rain is likely. A towel by the door helps.') };
  if (w.windKmh != null && w.windKmh >= 50) return { level: 'caution', text: t('Very windy. Hold the lead a little tighter.') };
  if (w.isDay === false) return { level: 'ok', text: t('It’s dark out. Something bright or reflective helps you both be seen.') };
  return { level: 'ok', text: t('Don’t forget some water.') };
}

/** The greeting above the weather card: cheerful only when nothing calls for care. */
export function walkGreeting(w: WeatherSnapshot | null, name: string): string {
  const a = walkAdvice(w);
  if (a.level === 'danger') return t('Take care out there, {name}', { name });
  if (a.level === 'caution') return t('Ready when you are, {name}', { name });
  if (!w || !w.available) return t('Ready for an adventure, {name}?', { name });
  return t('A lovely day for an adventure, {name}!', { name });
}

/** Open-Meteo forecast response (only the fields we ask for). */
export type OpenMeteoForecast = {
  timezone?: string;
  current?: { time: number; temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number; precipitation_probability?: number };
  hourly?: { time: number[]; precipitation_probability: (number | null)[] };
  daily?: { time: number[]; sunrise: number[]; sunset: number[] };
};

/** Provider response → snapshot (times arrive as unix seconds because we ask for `timeformat=unixtime`). */
export function snapshotFromOpenMeteo(r: OpenMeteoForecast, place: Place, now: number): WeatherSnapshot {
  const c = r.current;
  const code = c?.weather_code ?? null;
  let rainChance: number | null = c?.precipitation_probability ?? null;
  if (rainChance == null && r.hourly?.time?.length) {
    // the hour we're in
    const nowS = now / 1000;
    let best = -1;
    for (let i = 0; i < r.hourly.time.length; i++) if (r.hourly.time[i] <= nowS) best = i;
    if (best >= 0) rainChance = r.hourly.precipitation_probability[best] ?? null;
  }
  let sunrise: number | null = null;
  let sunset: number | null = null;
  if (r.daily?.time?.length) {
    // today's (the provider's first day is today at the place)
    sunrise = r.daily.sunrise?.[0] != null ? r.daily.sunrise[0] * 1000 : null;
    sunset = r.daily.sunset?.[0] != null ? r.daily.sunset[0] * 1000 : null;
  }
  return {
    available: !!c,
    tempC: c?.temperature_2m ?? null,
    code,
    condition: code != null ? conditionFromWmo(code) : null,
    isDay: c ? c.is_day === 1 : null,
    rainChance,
    windKmh: c?.wind_speed_10m ?? null,
    sunrise,
    sunset,
    place: place.name,
    lat: place.lat,
    lon: place.lon,
    tz: r.timezone ?? place.tz,
    fetchedAt: c?.time ? c.time * 1000 : now,
    source: c ? 'open-meteo' : 'none',
  };
}

/** A snapshot that knows only the place (provider unreachable) — enough for the hemisphere. */
export function placeOnlySnapshot(place: Place | null, now: number): WeatherSnapshot | null {
  if (!place) return null;
  return {
    available: false,
    tempC: null,
    code: null,
    condition: null,
    isDay: null,
    rainChance: null,
    windKmh: null,
    sunrise: null,
    sunset: null,
    place: place.name,
    lat: place.lat,
    lon: place.lon,
    tz: place.tz,
    fetchedAt: now,
    source: 'none',
  };
}
