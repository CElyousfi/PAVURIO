/**
 * Recurring care schedules. A schedule says "on these weekdays, at these local times".
 * Occurrences are computed with local calendar math (new Date(y, m, d, h, min)), never by adding
 * 24 h, so DST days are correct. A mark (done / skipped / snoozed) is stored only when the owner acts;
 * an occurrence is never completed automatically.
 */
import { t } from '../i18n/core';
import { formatHM, weekdayInitials, weekdayNamesShort } from '../i18n/dates';
import { addDays, dayKeyOf, parseDayKey } from './time';

export type ScheduleKind = string; // a CareType or 'custom'

export type Schedule = {
  id: string;
  petId: string;
  type: ScheduleKind;
  title: string;
  /** 'HH:MM' local times, sorted */
  times: string[];
  /** weekdays 0 (Sun)…6 (Sat); empty = every day */
  days: number[];
  startDate: string;
  endDate: string | null;
  remind: boolean;
  enabled: boolean;
  /** when the routine was created: times that had already passed then are not shown as missed */
  createdAt?: number;
};

export type MarkStatus = 'done' | 'skipped' | 'snoozed';
export type Mark = { scheduleId: string; key: string; status: MarkStatus; eventId: string | null; snoozeUntil: number | null };

export type OccurrenceStatus = 'upcoming' | 'due' | 'overdue' | 'done' | 'skipped' | 'snoozed';

export type Occurrence = {
  key: string;
  scheduleId: string;
  type: ScheduleKind;
  title: string;
  at: number;
  time: string;
  status: OccurrenceStatus;
  eventId: string | null;
  snoozeUntil: number | null;
};

/** within this window around `at`, an open occurrence is "due" rather than upcoming/overdue */
export const DUE_WINDOW_MS = 30 * 60 * 1000;

export function parseTime(t: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

export function normalizeTimes(times: string[]): string[] {
  const out = new Set<string>();
  for (const t of times) {
    const p = parseTime(t);
    if (p) out.add(`${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`);
  }
  return [...out].sort();
}

export function occurrenceKey(scheduleId: string, dayKey: string, time: string) {
  return `${scheduleId}@${dayKey}T${time}`;
}

export function appliesOn(s: Schedule, dayKey: string): boolean {
  if (!s.enabled) return false;
  if (dayKey < s.startDate) return false;
  if (s.endDate && dayKey > s.endDate) return false;
  if (s.days.length === 0) return true;
  return s.days.includes(parseDayKey(dayKey).getDay());
}

export function localInstant(dayKey: string, time: string): number {
  const d = parseDayKey(dayKey);
  const t = parseTime(time) ?? { h: 0, m: 0 };
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.h, t.m).getTime();
}

function statusOf(at: number, mark: Mark | undefined, now: number): OccurrenceStatus {
  if (mark?.status === 'done') return 'done';
  if (mark?.status === 'skipped') return 'skipped';
  if (mark?.status === 'snoozed' && mark.snoozeUntil && mark.snoozeUntil > now) return 'snoozed';
  const effective = mark?.status === 'snoozed' && mark.snoozeUntil ? mark.snoozeUntil : at;
  if (now < effective - DUE_WINDOW_MS) return 'upcoming';
  if (now <= effective + DUE_WINDOW_MS) return 'due';
  return 'overdue';
}

export function occurrencesForDay(schedules: Schedule[], marks: Mark[], dayKey: string, now = Date.now()): Occurrence[] {
  const byKey = new Map(marks.map((m) => [m.key, m]));
  const out: Occurrence[] = [];
  for (const s of schedules) {
    if (!appliesOn(s, dayKey)) continue;
    for (const time of s.times) {
      const key = occurrenceKey(s.id, dayKey, time);
      const at = localInstant(dayKey, time);
      if (s.createdAt != null && at + DUE_WINDOW_MS < s.createdAt) continue;
      const mark = byKey.get(key);
      out.push({
        key,
        scheduleId: s.id,
        type: s.type,
        title: s.title,
        at,
        time,
        status: statusOf(at, mark, now),
        eventId: mark?.eventId ?? null,
        snoozeUntil: mark?.snoozeUntil ?? null,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
}

export const isOpen = (o: Occurrence) => o.status === 'upcoming' || o.status === 'due' || o.status === 'overdue' || o.status === 'snoozed';

/** The occurrence Home should surface: the first open one that is due/overdue, else the next upcoming. */
export function nextUp(occ: Occurrence[], now = Date.now()): Occurrence | null {
  const open = occ.filter(isOpen);
  const urgent = open.find((o) => o.status === 'due' || o.status === 'overdue');
  if (urgent) return urgent;
  return open.find((o) => (o.snoozeUntil ?? o.at) >= now) ?? null;
}

/**
 * A manual log of care type T confirms the nearest open occurrence of T on that day
 * within ±3 h (so logging breakfast at 8:20 ticks the 8:00 breakfast). Returns its key or null.
 */
export function matchOccurrence(occ: Occurrence[], type: string, at: number): Occurrence | null {
  const WINDOW = 3 * 60 * 60 * 1000;
  let best: Occurrence | null = null;
  for (const o of occ) {
    if (o.type !== type || !isOpen(o)) continue;
    const d = Math.abs(o.at - at);
    if (d <= WINDOW && (!best || d < Math.abs(best.at - at))) best = o;
  }
  return best;
}

export type PlannedReminder = { id: string; at: number; title: string; body: string; scheduleId: string; key: string };

/**
 * Local notifications to schedule for the next `days` days (iOS keeps at most 64 pending, so we plan
 * a rolling window and re-plan on every app start / change). Skips occurrences that are already
 * marked, in the past, or belong to schedules with reminders off.
 */
export function planReminders(
  schedules: Schedule[],
  marks: Mark[],
  petName: string,
  now = Date.now(),
  days = 4,
  limit = 48,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const today = dayKeyOf(new Date(now));
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    for (const o of occurrencesForDay(
      schedules.filter((s) => s.remind),
      marks,
      day,
      now,
    )) {
      if (o.status === 'done' || o.status === 'skipped') continue;
      const at = o.status === 'snoozed' && o.snoozeUntil ? o.snoozeUntil : o.at;
      if (at <= now) continue;
      out.push({
        id: `pv:${o.key}`,
        at,
        title: t('{title} for {name}', { title: o.title, name: petName }),
        body: t('Tap to log it when it’s done.'),
        scheduleId: o.scheduleId,
        key: o.key,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, limit);
}

/** English weekday initials, Sunday first. UI should use `weekdayInitials()` (language-aware). */
export const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export { weekdayInitials };

export function describeDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return t('Every day');
  const names = weekdayNamesShort();
  const set = [...days].sort();
  if (set.join() === '1,2,3,4,5') return t('Weekdays');
  if (set.join() === '0,6') return t('Weekends');
  return set.map((d) => names[d]).join(', ');
}

/** 'HH:MM' → "8:00 AM" (English) or "8h00" (French). */
export function formatTime24to12(time: string): string {
  const p = parseTime(time);
  if (!p) return time;
  return formatHM(p.h, p.m);
}
