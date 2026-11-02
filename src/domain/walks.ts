/**
 * Pavurio Adventures — timed walks. Pure logic: the session state machine, elapsed time from stored
 * timestamps (never from a running interval), time-of-day, statistics and the eight passport badges.
 */
import { t } from '../i18n/core';
import type { WeatherSnapshot } from './weather';

export type WalkStatus = 'active' | 'paused' | 'completing' | 'completed' | 'discarded';

export type Walk = {
  id: string;
  petId: string;
  status: WalkStatus;
  startedAt: number;
  /** set while paused */
  pausedAt: number | null;
  /** total time spent paused before the current pause */
  pausedMs: number;
  finishedAt: number | null;
  /** final elapsed time, frozen when the walk finishes (or corrected by the owner) */
  durationMs: number | null;
  tz: string | null;
  weather: WeatherSnapshot | null;
  weatherAt: number | null;
  photoUri: string | null;
  note: string | null;
  eventId: string | null;
  memoryId: string | null;
  syncStatus: 'local' | 'synced';
  createdAt: number;
  updatedAt: number;
};

/** A walk shorter than this isn't counted toward badges (an accidental start/finish). */
export const MIN_VALID_MS = 2 * 60_000;
/** Longer than this and we ask the owner whether they forgot to finish. */
export const LONG_WALK_MS = 3 * 60 * 60_000;
/** The longest walk Pavurio records (the care log caps at 600 min). */
export const MAX_WALK_MS = 600 * 60_000;

export const isLive = (w: Walk | null | undefined): w is Walk => !!w && (w.status === 'active' || w.status === 'paused');

/** Elapsed walking time, computed from the stored timestamps — correct after backgrounding, locking or a crash. */
export function elapsedMs(w: Pick<Walk, 'status' | 'startedAt' | 'pausedAt' | 'pausedMs' | 'durationMs'>, now: number): number {
  if ((w.status === 'completed' || w.status === 'completing') && w.durationMs != null) return w.durationMs;
  const end = w.pausedAt ?? now;
  return Math.max(0, Math.min(MAX_WALK_MS, end - w.startedAt - w.pausedMs));
}

export function pausedState(w: Walk, now: number): Pick<Walk, 'status' | 'pausedAt' | 'pausedMs'> {
  if (w.status !== 'active') return { status: w.status, pausedAt: w.pausedAt, pausedMs: w.pausedMs };
  return { status: 'paused', pausedAt: now, pausedMs: w.pausedMs };
}

export function resumedState(w: Walk, now: number): Pick<Walk, 'status' | 'pausedAt' | 'pausedMs'> {
  if (w.status !== 'paused' || w.pausedAt == null) return { status: w.status, pausedAt: w.pausedAt, pausedMs: w.pausedMs };
  return { status: 'active', pausedAt: null, pausedMs: w.pausedMs + Math.max(0, now - w.pausedAt) };
}

/** "32:18" / "1:04:09" */
export function clockText(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
}

/** "32 min" / "1 h 04 min" */
export function durationText(ms: number): string {
  if (ms > 0 && ms < 30_000) return t('< 1 min');
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return t('{n} min', { n: min });
  const h = Math.floor(min / 60);
  return t('{h} h {m} min', { h, m: String(min % 60).padStart(2, '0') });
}

export type TimeOfDay = 'morning' | 'afternoon' | 'golden' | 'evening' | 'night';

/** Golden hour: from an hour before sunset to 15 minutes after, at the walk's place. */
export function inGoldenHour(startedAt: number, endedAt: number, sunset: number | null | undefined): boolean {
  if (sunset == null) return false;
  const from = sunset - 60 * 60_000;
  const to = sunset + 15 * 60_000;
  return startedAt <= to && endedAt >= from;
}

/** Time-of-day from the local clock; golden hour only when the provider gave a real sunset. */
export function timeOfDay(startedAt: number, endedAt: number, sunset?: number | null): TimeOfDay {
  if (inGoldenHour(startedAt, endedAt, sunset)) return 'golden';
  const h = new Date(startedAt).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function timeOfDayLabel(tod: TimeOfDay): string {
  switch (tod) {
    case 'morning':
      return t('Morning');
    case 'afternoon':
      return t('Afternoon');
    case 'golden':
      return t('Golden hour');
    case 'evening':
      return t('Evening');
    default:
      return t('Night');
  }
}

/** Meteorological spring by hemisphere (Mar–May north, Sep–Nov south); null when the place is unknown. */
export function isSpring(at: number, lat: number | null | undefined): boolean | null {
  if (lat == null || !Number.isFinite(lat)) return null;
  const m = new Date(at).getMonth(); // 0 = January
  return lat >= 0 ? m >= 2 && m <= 4 : m >= 8 && m <= 10;
}

export const isValidWalk = (w: Walk) => w.status === 'completed' && (w.durationMs ?? 0) >= MIN_VALID_MS;

// ------------------------------------------------------------------ badges

export const BADGE_RULE_VERSION = 1;
export type AdventureBadgeId = 'first' | 'early' | 'golden' | 'cloud' | 'spring' | 'five' | 'ten' | 'fifty';
export const ADVENTURE_BADGES: AdventureBadgeId[] = ['first', 'early', 'golden', 'cloud', 'spring', 'five', 'ten', 'fifty'];

export type AdventureBadgeDef = { id: AdventureBadgeId; title: string; how: string; goal: number | null };

export function adventureBadge(id: AdventureBadgeId): AdventureBadgeDef {
  switch (id) {
    case 'first':
      return { id, title: t('First Walk'), how: t('Your first recorded adventure together.'), goal: 1 };
    case 'early':
      return { id, title: t('Early Bird'), how: t('A walk that starts between 5 and 10 in the morning.'), goal: null };
    case 'golden':
      return { id, title: t('Golden Hour'), how: t('A walk in the hour before sunset, using the real sunset where you are.'), goal: null };
    case 'cloud':
      return { id, title: t('Cloud Explorer'), how: t('A walk under a cloudy sky, as recorded by the weather.'), goal: null };
    case 'spring':
      return { id, title: t('Spring Walk'), how: t('A walk in spring where you live (your hemisphere counts).'), goal: null };
    case 'five':
      return { id, title: t('5 Adventures'), how: t('Five walks together.'), goal: 5 };
    case 'ten':
      return { id, title: t('10 Adventures'), how: t('Ten walks together.'), goal: 10 };
    case 'fifty':
      return { id, title: t('50 Together'), how: t('Fifty walks together.'), goal: 50 };
  }
}

const endOf = (w: Walk) => w.finishedAt ?? w.startedAt + (w.durationMs ?? 0) + w.pausedMs;

/** Does this single walk earn a condition badge? Missing data never earns one. */
export function walkQualifies(id: AdventureBadgeId, w: Walk): boolean {
  if (!isValidWalk(w)) return false;
  switch (id) {
    case 'early': {
      const h = new Date(w.startedAt).getHours();
      return h >= 5 && h < 10;
    }
    case 'golden':
      return !!w.weather?.available && inGoldenHour(w.startedAt, endOf(w), w.weather.sunset);
    case 'cloud':
      return !!w.weather?.available && (w.weather.condition === 'cloudy' || w.weather.condition === 'partly');
    case 'spring':
      return isSpring(w.startedAt, w.weather?.lat) === true;
    default:
      return false;
  }
}

/**
 * Every badge this pet's walks earn, with the walk that earned it first (oldest qualifying walk).
 * Count badges are earned by the Nth valid walk.
 */
export function earnedBadges(walks: Walk[]): Map<AdventureBadgeId, Walk> {
  const valid = walks.filter(isValidWalk).sort((a, b) => a.startedAt - b.startedAt);
  const out = new Map<AdventureBadgeId, Walk>();
  const counts: [AdventureBadgeId, number][] = [
    ['first', 1],
    ['five', 5],
    ['ten', 10],
    ['fifty', 50],
  ];
  for (const [id, n] of counts) if (valid.length >= n) out.set(id, valid[n - 1]);
  for (const id of ['early', 'golden', 'cloud', 'spring'] as AdventureBadgeId[]) {
    const w = valid.find((x) => walkQualifies(id, x));
    if (w) out.set(id, w);
  }
  return out;
}

export function badgeProgress(id: AdventureBadgeId, validCount: number): { have: number; goal: number } | null {
  const g = adventureBadge(id).goal;
  return g == null ? null : { have: Math.min(validCount, g), goal: g };
}

// ------------------------------------------------------------------ statistics

export type WalkStats = { total: number; totalMs: number; thisMonth: number; latest: Walk | null; favourite: TimeOfDay | null };

export function walkStats(walks: Walk[], now: number): WalkStats {
  const done = walks.filter((w) => w.status === 'completed').sort((a, b) => b.startedAt - a.startedAt);
  const d = new Date(now);
  const thisMonth = done.filter((w) => {
    const x = new Date(w.startedAt);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
  }).length;
  const tally = new Map<TimeOfDay, number>();
  for (const w of done) {
    const tod = timeOfDay(w.startedAt, endOf(w), w.weather?.sunset);
    tally.set(tod, (tally.get(tod) ?? 0) + 1);
  }
  let favourite: TimeOfDay | null = null;
  for (const [k, v] of tally) if (!favourite || v > (tally.get(favourite) ?? 0)) favourite = k;
  return {
    total: done.length,
    totalMs: done.reduce((a, w) => a + (w.durationMs ?? 0), 0),
    thisMonth,
    latest: done[0] ?? null,
    favourite,
  };
}

export function walkEnd(w: Walk): number {
  return endOf(w);
}
