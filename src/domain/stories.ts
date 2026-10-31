/**
 * Story recaps built only from what the owner logged: care counts, fully-colored days, photos,
 * weights and visits. A story is offered only when there is enough real data to fill it.
 */
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
  meal: (n, p) => `${n} meals served. ${p} ate well.`,
  walk: (n, p) => `${n} walks out with ${p}.`,
  water: (n, p) => `${n} fresh bowls of water for ${p}.`,
  play: (n, p) => `${n} play sessions with ${p}.`,
  grooming: (n, p) => `${n} grooming sessions. Looking sharp, ${p}.`,
  litter: (n) => `${n} litter cleanups. Thank you!`,
};

/** Returns null when there isn't enough logged to make an honest story (fewer than 3 logs). */
export function buildStory(i: StoryInput): StorySlide[] | null {
  const { from, to, days } = storyWindow(i.range, i.endDay);
  const inRange = (k: string) => k >= from && k <= to;
  const events = i.events.filter((e) => inRange(dayKeyOf(new Date(e.occurredAt))));
  if (events.length < 3) return null;

  const slides: StorySlide[] = [];
  slides.push({
    kind: 'cover',
    title: i.range === 'week' ? `${i.petName}'s week` : `${i.petName}'s month`,
    subtitle: `${from.slice(5).replace('-', '/')} – ${to.slice(5).replace('-', '/')}`,
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

  slides.push({ kind: 'outro', line: `Thanks for taking such good care of ${i.petName}.` });
  return slides;
}
