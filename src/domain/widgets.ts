/**
 * What the home-screen widget shows, and when. Pure: everything comes in as plain data, so the same
 * decision runs in tests, for "now", and for every future moment of the widget's timeline (WidgetKit
 * shows the right entry at the right time even while the app is closed).
 *
 * One scene at a time, the most useful one first:
 *  1. a walk in progress
 *  2. medicine that's due or late (never buried under anything else)
 *  3. another care that's due or late (meal, walk, water…)
 *  4. food or supplies that need buying (daytime only)
 *  5. everything done today → a small celebration (or, at night, the pet asleep)
 *  6. at night → the pet asleep, with the first care tomorrow
 *  7. around the owner's usual photo time, no photo yet today → "a little moment?"
 *  8. the next care coming up, with a live countdown
 *  9. around the owner's usual check-in hour with nothing logged yet → a gentle "how is {name}?"
 * The owner's habits (the hours they usually log care and take photos) are learned from their own
 * history, so the widget nudges when they're actually likely to act. It never guilt-trips: no streaks.
 */
import { t } from '../i18n/core';
import { CARE, isCareType, type CareType, type Species } from './care';

export type WidgetArt = 'care' | 'walk' | 'moment' | 'pantry' | 'done' | 'sleep';
export type SceneKind = 'walking' | 'medicine' | 'due' | 'pantry' | 'done' | 'sleep' | 'moment' | 'next' | 'checkin' | 'start';

export type WidgetOccurrence = { key: string; type: string; title: string; at: number; closed: boolean };
export type WidgetDay = { start: number; planned: number; done: number; photo: boolean; occurrences: WidgetOccurrence[] };
export type WidgetInput = {
  petName: string;
  species: Species;
  /** today, then tomorrow */
  days: WidgetDay[];
  pantry: { name: string; line: string; urgent: boolean } | null;
  liveWalk: boolean;
  /** hours (0–23, may be fractional) learned from the owner's history; null until there's enough */
  habits: { logHour: number | null; photoHour: number | null };
  /** the pet has never had a photo: the moment scene introduces the feature */
  hasPhotos: boolean;
};

export type Scene = {
  kind: SceneKind;
  art: WidgetArt;
  title: string;
  body: string;
  /** "3 of 6 today" */
  progressLabel: string;
  progress: number;
  /** a time to count down to (the next care), or 0 */
  countdownTo: number;
  /** what a tap opens (app route, without the scheme) */
  route: string;
  accent: string;
  tint: string;
};

const HOUR = 3_600_000;
const DUE_BEFORE = 30 * 60_000;
const LATE_FOR = 3 * HOUR;

const ACCENT: Record<SceneKind, [string, string]> = {
  walking: ['#14B8C4', '#E4F7F8'],
  medicine: ['#E5484D', '#FDECEC'],
  due: ['#E26A00', '#FFF1E0'],
  pantry: ['#E26A00', '#FFF1E0'],
  done: ['#3FA34D', '#E7F6E9'],
  sleep: ['#7C5CE6', '#EFEAFB'],
  moment: ['#FF6B9A', '#FFE9F1'],
  next: ['#14B8C4', '#E4F7F8'],
  checkin: ['#14B8C4', '#E4F7F8'],
  start: ['#14B8C4', '#E4F7F8'],
};

const artFor = (type: string): WidgetArt => (type === 'walk' ? 'walk' : type === 'meal' || type === 'water' ? 'pantry' : 'care');
const careLabel = (type: string, fallback: string) => (isCareType(type) ? CARE[type as CareType].label : fallback);
const hourOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
};
const near = (h: number, target: number, within: number) => Math.abs(h - target) <= within;
const clock = (ms: number, fmt: (ms: number) => string) => fmt(ms);

function scene(kind: SceneKind, art: WidgetArt, title: string, body: string, route: string, day: WidgetDay | undefined, countdownTo = 0): Scene {
  const [accent, tint] = ACCENT[kind];
  const planned = day?.planned ?? 0;
  const done = Math.min(day?.done ?? 0, planned || Infinity);
  return {
    kind,
    art,
    title,
    body,
    route,
    countdownTo,
    accent,
    tint,
    progress: planned > 0 ? Math.min(1, done / planned) : 0,
    progressLabel: planned > 0 ? t('{done} of {planned} today', { done, planned }) : '',
  };
}

/** The scene for moment `at`. `fmtTime` formats a clock time in the app's language. */
export function sceneAt(input: WidgetInput, at: number, fmtTime: (ms: number) => string, isNow = false): Scene {
  const name = input.petName;
  const day = input.days.find((d, i) => at >= d.start && (i === input.days.length - 1 || at < input.days[i + 1].start)) ?? input.days[0];
  const tomorrow = input.days[input.days.indexOf(day) + 1];
  const h = hourOf(at);
  const night = h >= 21.5 || h < 6;
  const open = day.occurrences.filter((o) => !o.closed).sort((a, b) => a.at - b.at);

  if (isNow && input.liveWalk) return scene('walking', 'walk', t('Walking with {name}', { name }), t('Tap to see the timer'), 'walk', day);

  const dueNow = (o: WidgetOccurrence) => at >= o.at - DUE_BEFORE && at <= o.at + LATE_FOR;
  const med = open.find((o) => o.type === 'medication' && dueNow(o));
  if (med) return scene('medicine', 'care', t('Medicine time for {name} 💊', { name }), `${med.title} · ${clock(med.at, fmtTime)}`, 'log/medication', day, med.at > at ? med.at : 0);

  const due = open.find(dueNow);
  if (due) {
    const late = at > due.at + 15 * 60_000;
    const title = due.type === 'walk' ? t('{name} is ready for a walk 🐾', { name }) : due.type === 'meal' ? t('{name} is getting hungry 🍽️', { name }) : late ? t('Still to do for {name}', { name }) : `${careLabel(due.type, due.title)} · ${name}`;
    return scene('due', artFor(due.type), title, `${due.title} · ${clock(due.at, fmtTime)}`, due.type === 'walk' && input.species === 'dog' ? 'walk' : isCareType(due.type) ? `log/${due.type}` : '', day, due.at > at ? due.at : 0);
  }

  if (input.pantry?.urgent && h >= 8 && h < 20.5) return scene('pantry', 'pantry', input.pantry.name, input.pantry.line, 'supplies?tab=list', day);

  const allDone = day.planned > 0 && day.done >= day.planned;
  if (night || (allDone && h >= 20)) {
    const first = tomorrow?.occurrences.slice().sort((a, b) => a.at - b.at)[0];
    const body = first ? t('First up: {care} at {time}', { care: careLabel(first.type, first.title).toLowerCase(), time: clock(first.at, fmtTime) }) : t('See you tomorrow');
    return scene('sleep', input.species === 'cat' ? 'sleep' : 'done', t('Sweet dreams, {name}', { name }), body, '', day);
  }
  if (allDone) return scene('done', 'done', t('All done for {name} today 🎉', { name }), t('Every care is logged. Thank you!'), '', day);

  const photoHour = input.habits.photoHour ?? 18.5;
  if (!day.photo && near(h, photoHour, 1.5) && h >= 9) {
    return scene('moment', 'moment', input.hasPhotos ? t('A little moment of {name} today?', { name }) : t('Keep a photo of {name} today', { name }), t('One photo a day becomes a whole story.'), 'moments', day);
  }

  const next = open.find((o) => o.at > at);
  const nothingYet = day.done === 0 && day.planned > 0;
  if (nothingYet && input.habits.logHour != null && near(h, input.habits.logHour, 1) && (!next || next.at - at > 2 * HOUR)) {
    return scene('checkin', 'care', t('How is {name} today?', { name }), t('Tap to log the first care.'), '', day);
  }
  if (next) return scene('next', artFor(next.type), t('Next: {care}', { care: careLabel(next.type, next.title) }), `${next.title} · ${clock(next.at, fmtTime)}`, isCareType(next.type) ? `log/${next.type}` : '', day, next.at);

  return scene('start', 'care', t('How is {name} today?', { name }), day.planned > 0 ? t('Tap to log care.') : t('Add a routine and Pavurio keeps track.'), '', day);
}

/**
 * The widget's timeline: a scene for now and for every moment it should change in the next day
 * (each care's due window, the evening, night, morning, the owner's usual hours, midnight).
 * Consecutive identical scenes are merged so WidgetKit keeps the countdown running.
 */
export function buildTimeline(input: WidgetInput, now: number, fmtTime: (ms: number) => string): { at: number; scene: Scene }[] {
  const end = now + 24 * HOUR;
  const points = new Set<number>([now]);
  const add = (ms: number) => {
    if (ms > now && ms < end) points.add(Math.round(ms / 60_000) * 60_000);
  };
  for (const d of input.days) {
    for (const o of d.occurrences) {
      add(o.at - DUE_BEFORE);
      add(o.at);
      add(o.at + 15 * 60_000 + 1000);
      add(o.at + LATE_FOR + 1000);
    }
    for (const hr of [6, 8, 9, 17, 18.5 - 1.5, 20, 20.5, 21.5]) add(d.start + hr * HOUR);
    for (const hr of [input.habits.photoHour, input.habits.logHour]) if (hr != null) for (const off of [-1.5, -1, 1, 1.5]) add(d.start + (hr + off) * HOUR);
    add(d.start);
  }
  const out: { at: number; scene: Scene }[] = [];
  for (const at of [...points].sort((a, b) => a - b)) {
    const s = sceneAt(input, at, fmtTime, at === now);
    const prev = out[out.length - 1]?.scene;
    if (prev && prev.kind === s.kind && prev.title === s.title && prev.body === s.body && prev.progressLabel === s.progressLabel && prev.countdownTo === s.countdownTo) continue;
    out.push({ at, scene: s });
  }
  return out;
}

/** The hour (fractional) the owner usually does something, from timestamps of the last weeks: the median, once there are enough days. */
export function usualHour(times: number[], minDays = 4): number | null {
  const byDay = new Map<string, number>();
  for (const ms of times) {
    const d = new Date(ms);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const h = hourOf(ms);
    // the first action of each day is the habit
    if (!byDay.has(key) || h < byDay.get(key)!) byDay.set(key, h);
  }
  if (byDay.size < minDays) return null;
  const hs = [...byDay.values()].sort((a, b) => a - b);
  return hs[Math.floor(hs.length / 2)];
}
