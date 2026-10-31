/**
 * Local-calendar helpers. We store instants as UTC epoch milliseconds and compute
 * "days" in the device's local timezone using calendar arithmetic (never +24h),
 * so DST transitions produce 23h / 25h days correctly.
 */
import { t } from '../i18n/core';
import { capitalize, formatHM, monthNamesShort, weekdayNames } from '../i18n/dates';

export type DayRange = { start: number; end: number; key: string };

export function dayKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayRange(date: Date | number): DayRange {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return { start: start.getTime(), end: end.getTime(), key: dayKeyOf(start) };
}

export function addDays(key: string, delta: number): string {
  const d = parseDayKey(key);
  return dayKeyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
}

export function isToday(key: string, now: Date = new Date()): boolean {
  return key === dayKeyOf(now);
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return formatHM(d.getHours(), d.getMinutes());
}

export function formatDayTitle(key: string, now: Date = new Date()): string {
  if (isToday(key, now)) return t('Today');
  if (addDays(key, 1) === dayKeyOf(now)) return t('Yesterday');
  const d = parseDayKey(key);
  return t('{weekday}, {month} {day}', {
    weekday: capitalize(weekdayNames()[d.getDay()]),
    month: monthNamesShort()[d.getMonth()],
    day: d.getDate(),
  });
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return t('Good night');
  if (h < 12) return t('Good morning');
  if (h < 18) return t('Good afternoon');
  return t('Good evening');
}

/**
 * Default "occurred at" for a log made while viewing `dayKey`:
 * today → now; past day → noon of that day (owner can change it).
 */
export function defaultOccurredAt(dayKey: string, now: Date = new Date()): number {
  if (isToday(dayKey, now)) return now.getTime();
  const d = parseDayKey(dayKey);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0).getTime();
}
