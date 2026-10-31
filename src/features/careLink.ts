/**
 * Links a manual care log to the schedule occurrence it fulfils. Logging "Breakfast" at 8:20 ticks the
 * 8:00 breakfast reminder; opening the log card from a reminder passes that occurrence's key directly.
 */
import type { Db } from '../data/db';
import { marksBetween, setMark } from '../data/careRepo';
import { Schedule, matchOccurrence, occurrencesForDay } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';

export async function confirmOccurrence(
  db: Db,
  schedules: Schedule[],
  ev: { id: string; type: string; occurredAt: number },
  explicit?: { scheduleId: string; key: string } | null,
): Promise<string | null> {
  if (explicit?.scheduleId && explicit.key) {
    await setMark(db, explicit.scheduleId, explicit.key, 'done', { eventId: ev.id });
    return explicit.key;
  }
  const relevant = schedules.filter((s) => s.type === ev.type);
  if (relevant.length === 0) return null;
  const day = dayKeyOf(new Date(ev.occurredAt));
  const marks = await marksBetween(
    db,
    relevant.map((s) => s.id),
    day,
    day,
  );
  const hit = matchOccurrence(occurrencesForDay(relevant, marks, day), ev.type, ev.occurredAt);
  if (!hit) return null;
  await setMark(db, hit.scheduleId, hit.key, 'done', { eventId: ev.id });
  return hit.key;
}
