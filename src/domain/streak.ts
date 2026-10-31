/**
 * Streaks: consecutive local days where the owner's plan was fully logged (or, with no plan,
 * days with at least one log). Today counts once it qualifies; an unfinished today does not
 * break a streak that ran until yesterday.
 */
import { CareType } from './care';
import { Plan, computeProgress } from './progress';
import { addDays, dayKeyOf } from './time';

export type DayLogs = Map<string, { type: CareType; occurredAt: number }[]>;

export function groupByDay(events: { type: CareType; occurredAt: number }[]): DayLogs {
  const m: DayLogs = new Map();
  for (const e of events) {
    const k = dayKeyOf(new Date(e.occurredAt));
    const list = m.get(k);
    if (list) list.push(e);
    else m.set(k, [e]);
  }
  return m;
}

export function dayComplete(plan: Plan, logs: { type: CareType; occurredAt: number }[] | undefined): boolean {
  if (!logs || logs.length === 0) return false;
  const planned = Object.values(plan).reduce<number>((s, n) => s + (n ?? 0), 0);
  if (planned === 0) return true;
  return computeProgress(plan, logs).ratio >= 1;
}

export type Streak = { current: number; best: number; todayDone: boolean; atRisk: boolean };

export function computeStreak(plan: Plan, byDay: DayLogs, today: string): Streak {
  const todayDone = dayComplete(plan, byDay.get(today));
  let current = 0;
  let d = todayDone ? today : addDays(today, -1);
  while (dayComplete(plan, byDay.get(d))) {
    current++;
    d = addDays(d, -1);
  }
  // best streak over the recorded history
  const days = [...byDay.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of days) {
    if (!dayComplete(plan, byDay.get(k))) {
      run = 0;
      prev = k;
      continue;
    }
    run = prev && addDays(prev, 1) === k && run > 0 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  best = Math.max(best, current);
  return { current, best, todayDone, atRisk: !todayDone && current > 0 };
}
