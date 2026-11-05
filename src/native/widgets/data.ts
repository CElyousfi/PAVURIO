/**
 * Builds what the widgets and the care Live Activity need from the database, for the active pet:
 * today's and tomorrow's routine (with what's already done), progress, the pantry, photos and the
 * owner's habits. Platform-neutral; the iOS/Android modules turn it into layouts.
 */
import type { Db } from '../../data/db';
import { getActivePet, getPlan, getPortions, listEventsBetween } from '../../data/repo';
import { listSchedules, marksBetween } from '../../data/careRepo';
import { countMoments, momentsOn } from '../../data/memoriesRepo';
import { getAnyLiveWalk } from '../../data/walkRepo';
import { forPet, loadPantry } from '../../data/pantry';
import { occurrencesForDay } from '../../domain/schedule';
import { computeProgress } from '../../domain/progress';
import { addDays, dayKeyOf, formatClock, parseDayKey } from '../../domain/time';
import { usualHour, type WidgetDay, type WidgetInput } from '../../domain/widgets';
import type { Forecast } from '../../domain/supplies';
import { daysLeftLabel, headline } from '../../features/supplies';
import { t } from '../../i18n';

const DAY = 86_400_000;

export type PantryItem = { name: string; label: string; level: number; color: string; urgent: boolean; kind: string };
export type WidgetData = { input: WidgetInput; pantry: PantryItem[]; petId: string; next: { key: string; type: string; title: string; at: number } | null };

const STATUS_COLOR: Record<Forecast['status'], string> = { out: '#E5484D', buy: '#E26A00', soon: '#C79A00', ok: '#3FA34D', unknown: '#9AA3AE' };

export async function loadWidgetData(db: Db, now = Date.now()): Promise<WidgetData | null> {
  const pet = await getActivePet(db);
  if (!pet) return null;
  const today = dayKeyOf(new Date(now));
  const tomorrow = addDays(today, 1);
  const [schedules, plan, portions] = await Promise.all([listSchedules(db, pet.id), getPlan(db, pet.id), getPortions(db, pet.id)]);
  const marks = await marksBetween(db, schedules.map((s) => s.id), today, tomorrow);
  const recent = await listEventsBetween(db, pet.id, now - 21 * DAY, now + 60_000);
  const todayStart = parseDayKey(today).getTime();
  const todays = recent.filter((e) => e.occurredAt >= todayStart);
  const progress = computeProgress(plan, todays, portions);
  const days: WidgetDay[] = [];
  for (const key of [today, tomorrow]) {
    const occ = occurrencesForDay(schedules, key === today ? marks : marks.filter((m) => m.key.includes(`@${key}`)), key, now).filter((o) => o.type !== 'custom' || o.title);
    days.push({
      start: parseDayKey(key).getTime(),
      planned: progress.planned,
      done: key === today ? progress.done : 0,
      photo: key === today ? (await momentsOn(db, pet.id, key)).some((m) => m.photoUri && m.kind !== 'adventure') : false,
      occurrences: occ.map((o) => ({ key: o.key, type: o.type, title: o.title, at: o.status === 'snoozed' && o.snoozeUntil ? o.snoozeUntil : o.at, closed: o.status === 'done' || o.status === 'skipped' })),
    });
  }
  // habits: when the owner usually logs their first care, and when they take photos
  const photos = await db.getAllAsync<{ created_at: number }>(
    "SELECT m.created_at FROM memories m JOIN memory_pets mp ON mp.memory_id = m.id WHERE mp.pet_id = ? AND m.kind != 'adventure' AND m.created_at > ?",
    [pet.id, now - 45 * DAY],
  );
  const { forecasts } = await loadPantry(db, now);
  const mine = forPet(forecasts, pet.id);
  const urgent = mine.find((f) => f.status === 'out' || f.status === 'buy');
  const live = await getAnyLiveWalk(db).catch(() => null);
  const input: WidgetInput = {
    petName: pet.name,
    species: pet.species,
    days,
    pantry: urgent ? { name: urgent.supply.name, line: headline(urgent, now), urgent: true } : null,
    liveWalk: !!live && live.petId === pet.id && (live.status === 'active' || live.status === 'paused'),
    habits: { logHour: usualHour(recent.map((e) => e.recordedAt)), photoHour: usualHour(photos.map((p) => p.created_at), 3) },
    hasPhotos: (await countMoments(db, pet.id)) > 0,
  };
  const pantry: PantryItem[] = mine.slice(0, 3).map((f) => ({
    name: f.supply.name,
    label: f.status === 'ok' || f.status === 'unknown' ? daysLeftLabel(f) : headline(f, now),
    level: Math.max(0.04, f.level),
    color: STATUS_COLOR[f.status],
    urgent: f.status === 'out' || f.status === 'buy',
    kind: f.supply.kind,
  }));
  const open = days[0].occurrences.filter((o) => !o.closed && o.at > now - 2 * 3_600_000).sort((a, b) => a.at - b.at)[0] ?? null;
  return { input, pantry, petId: pet.id, next: open };
}

export const widgetTime = (ms: number) => formatClock(ms);
export const pantryTitle = () => t('Pantry');
export const emptyPantryLine = () => t('Add your pet’s food to see how long it lasts.');
