/** Challenges, achievement stats and "seen" markers. */
import { Db } from './db';
import { newId } from '../domain/ids';
import { ChallengeRun } from '../domain/challenges';
import { BadgeStats } from '../domain/badges';
import { getSetting, setSetting } from './repo';

type RunRow = { id: string; key: string; start_day: string; completed_at: number | null; abandoned_at: number | null };
const toRun = (r: RunRow): ChallengeRun => ({ id: r.id, key: r.key, startDay: r.start_day, completedAt: r.completed_at, abandonedAt: r.abandoned_at });

export async function startChallenge(db: Db, petId: string, key: string, startDay: string, now = Date.now()): Promise<string> {
  // only one live run per challenge
  await db.runAsync('UPDATE challenge_runs SET abandoned_at = ? WHERE pet_id = ? AND key = ? AND completed_at IS NULL AND abandoned_at IS NULL', [now, petId, key]);
  const id = newId();
  await db.runAsync('INSERT INTO challenge_runs (id, pet_id, key, start_day, created_at) VALUES (?, ?, ?, ?, ?)', [id, petId, key, startDay, now]);
  return id;
}
export async function completeChallenge(db: Db, id: string, now = Date.now()) {
  await db.runAsync('UPDATE challenge_runs SET completed_at = ? WHERE id = ? AND completed_at IS NULL', [now, id]);
}
export async function abandonChallenge(db: Db, id: string, now = Date.now()) {
  await db.runAsync('UPDATE challenge_runs SET abandoned_at = ? WHERE id = ? AND completed_at IS NULL', [now, id]);
}
/** Live runs (not abandoned, not completed) plus completed ones, newest first. */
export async function listChallengeRuns(db: Db, petId: string): Promise<ChallengeRun[]> {
  const rows = await db.getAllAsync<RunRow>('SELECT * FROM challenge_runs WHERE pet_id = ? AND abandoned_at IS NULL ORDER BY created_at DESC', [petId]);
  return rows.map(toRun);
}

const count = async (db: Db, sql: string, params: (string | number)[]) => (await db.getFirstAsync<{ n: number }>(sql, params))?.n ?? 0;

export async function badgeStats(db: Db, petId: string, bestStreak: number): Promise<BadgeStats> {
  return {
    logs: await count(db, 'SELECT COUNT(*) AS n FROM care_events WHERE pet_id = ? AND voided_at IS NULL', [petId]),
    bestStreak,
    routines: await count(db, 'SELECT COUNT(*) AS n FROM schedules WHERE pet_id = ?', [petId]),
    medRoutines: await count(db, "SELECT COUNT(*) AS n FROM schedules WHERE pet_id = ? AND type = 'medication'", [petId]),
    waterLogs: await count(db, "SELECT COUNT(*) AS n FROM care_events WHERE pet_id = ? AND type = 'water' AND voided_at IS NULL", [petId]),
    groomLogs: await count(db, "SELECT COUNT(*) AS n FROM care_events WHERE pet_id = ? AND type = 'grooming' AND voided_at IS NULL", [petId]),
    hasBirthday: (await count(db, 'SELECT COUNT(*) AS n FROM pets WHERE id = ? AND (birth_date IS NOT NULL OR adoption_date IS NOT NULL)', [petId])) > 0,
    records: await count(db, 'SELECT COUNT(*) AS n FROM records WHERE pet_id = ?', [petId]),
    moments: await count(db, 'SELECT COUNT(*) AS n FROM memories WHERE pet_id = ?', [petId]),
    weights: await count(db, 'SELECT COUNT(*) AS n FROM measurements WHERE pet_id = ?', [petId]),
    challengesDone: await count(db, 'SELECT COUNT(*) AS n FROM challenge_runs WHERE pet_id = ? AND completed_at IS NOT NULL', [petId]),
    pets: await count(db, 'SELECT COUNT(*) AS n FROM pets WHERE archived_at IS NULL', []),
    walksTimed: Number((await getSetting(db, `walksTimed:${petId}`)) ?? 0),
  };
}

export async function bumpCounter(db: Db, key: string) {
  const v = Number((await getSetting(db, key)) ?? 0);
  await setSetting(db, key, String(v + 1));
}

export async function seenSet(db: Db, key: string): Promise<Set<string>> {
  const raw = await getSetting(db, key);
  try {
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
export async function markSeen(db: Db, key: string, ids: string[]) {
  const s = await seenSet(db, key);
  ids.forEach((i) => s.add(i));
  await setSetting(db, key, JSON.stringify([...s]));
}
