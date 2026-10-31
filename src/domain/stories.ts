/**
 * Story recaps built only from what the owner logged: care counts, fully-colored days, photos,
 * weights and visits. A story is offered only when there is enough real data to fill it.
 */
import { lang, t, tn } from '../i18n/core';
import { CARE, CareType } from './care';
import { Plan, computeProgress } from './progress';
import { addDays, dayKeyOf } from './time';

export type StoryRange = 'week' | 'month';

export type StorySlide =
  | { kind: 'cover'; title: string; subtitle: string }
  | { kind: 'totals'; items: { type: CareType; count: number; minutes: number | null }[] }
  | { kind: 'streak'; fullDays: number; activeDays: number; totalDays: number }
  | { kind: 'top'; type: CareType; count: number; line: string }
  | { kind: 'photo'; uri: string; title: string; caption: string | null; date: string }
  | { kind: 'weight'; from: number; to: number; unit: string }
  | { kind: 'visits'; titles: string[] }
  | { kind: 'outro'; line: string };

export type StoryInput = {
  petName: string;
  range: StoryRange;
  endDay: string;
  plan: Plan;
  events: { type: CareType; occurredAt: number; amount: number | null }[];
  photos: { uri: string; title: string; caption: string | null; date: string }[];
  weights: { at: number; value: number }[];
  weightUnit: string;
  visits: { title: string; at: number }[];
};

export function storyWindow(range: StoryRange, endDay: string): { from: string; to: string; days: number } {
  const days = range === 'week' ? 7 : 30;
  return { from: addDays(endDay, -(days - 1)), to: endDay, days };
}

const TOP_LINE: Record<CareType, (n: number, name: string) => string> = {
  meal: (n, p) => tn(n, '{n} meal served. {name} ate well.', '{n} meals served. {name} ate well.', { name: p }),
  walk: (n, p) => tn(n, '{n} walk out with {name}.', '{n} walks out with {name}.', { name: p }),
  water: (n, p) => tn(n, '{n} fresh bowl of water for {name}.', '{n} fresh bowls of water for {name}.', { name: p }),
  play: (n, p) => tn(n, '{n} play session with {name}.', '{n} play sessions with {name}.', { name: p }),
  grooming: (n, p) => tn(n, '{n} grooming session. Looking sharp, {name}.', '{n} grooming sessions. Looking sharp, {name}.', { name: p }),
  litter: (n) => tn(n, '{n} litter cleanup. Thank you!', '{n} litter cleanups. Thank you!'),
};

/** 'YYYY-MM-DD' → "10/24" (English) or "24/10" (French). */
function shortDate(key: string): string {
  const [, m, d] = key.split('-');
  return lang() === 'fr' ? `${d}/${m}` : `${m}/${d}`;
}

/** Returns null when there isn't enough logged to make an honest story (fewer than 3 logs). */
export function buildStory(i: StoryInput): StorySlide[] | null {
  const { from, to, days } = storyWindow(i.range, i.endDay);
  const inRange = (k: string) => k >= from && k <= to;
  const events = i.events.filter((e) => inRange(dayKeyOf(new Date(e.occurredAt))));
  if (events.length < 3) return null;

  const slides: StorySlide[] = [];
  slides.push({
    kind: 'cover',
    title: i.range === 'week' ? t("{name}'s week", { name: i.petName }) : t("{name}'s month", { name: i.petName }),
    subtitle: `${shortDate(from)} – ${shortDate(to)}`,
  });

  const byType = new Map<CareType, { count: number; minutes: number }>();
  for (const e of events) {
    const cur = byType.get(e.type) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    if (CARE[e.type].amount?.unit === 'min' && e.amount) cur.minutes += e.amount;
    byType.set(e.type, cur);
  }
  const items = [...byType.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, v]) => ({ type, count: v.count, minutes: CARE[type].amount?.unit === 'min' ? v.minutes : null }));
  slides.push({ kind: 'totals', items });

  // days per local day key
  const perDay = new Map<string, { type: CareType; occurredAt: number }[]>();
  for (const e of events) {
    const k = dayKeyOf(new Date(e.occurredAt));
    perDay.set(k, [...(perDay.get(k) ?? []), e]);
  }
  const planned = Object.values(i.plan).reduce<number>((s, n) => s + (n ?? 0), 0);
  let fullDays = 0;
  for (const [, ev] of perDay) if (planned > 0 && computeProgress(i.plan, ev).ratio >= 1) fullDays++;
  slides.push({ kind: 'streak', fullDays, activeDays: perDay.size, totalDays: days });

  const top = items[0];
  slides.push({ kind: 'top', type: top.type, count: top.count, line: TOP_LINE[top.type](top.count, i.petName) });

  for (const p of i.photos.filter((x) => inRange(x.date)).slice(0, 3)) slides.push({ kind: 'photo', ...p });

  const ws = i.weights.filter((w) => inRange(dayKeyOf(new Date(w.at)))).sort((a, b) => a.at - b.at);
  if (ws.length >= 2) slides.push({ kind: 'weight', from: ws[0].value, to: ws[ws.length - 1].value, unit: i.weightUnit });

  const visits = i.visits.filter((v) => inRange(dayKeyOf(new Date(v.at))) && v.at <= Date.now());
  if (visits.length) slides.push({ kind: 'visits', titles: visits.map((v) => v.title).slice(0, 4) });

  slides.push({ kind: 'outro', line: t('Thanks for taking such good care of {name}.', { name: i.petName }) });
  return slides;
}
