/**
 * Adventures storage. The `walks` row is the single source of truth; finishing a walk derives, idempotently,
 * the Daily Care walk event (mutation id `walk:<id>`), one Moments entry (`walk-<id>`) and the passport
 * badges. Every step can be re-run after a crash or a double tap without creating anything twice.
 */
import type { Db } from './db';
import { newId } from '../domain/ids';
import { dayKeyOf } from '../domain/time';
import {
  ADVENTURE_BADGES,
  AdventureBadgeId,
  BADGE_RULE_VERSION,
  MAX_WALK_MS,
  Walk,
  WalkStatus,
  durationText,
  earnedBadges,
  elapsedMs,
  pausedState,
  resumedState,
} from '../domain/walks';
import type { WeatherSnapshot } from '../domain/weather';
import { getEvent, getPet, logCare, updateEvent, voidEvent, ValidationError } from './repo';
import { t } from '../i18n/core';

type Row = {
  id: string;
  pet_id: string;
  status: WalkStatus;
  started_at: number;
  paused_at: number | null;
  paused_ms: number;
  finished_at: number | null;
  duration_ms: number | null;
  tz: string | null;
  weather_json: string | null;
  weather_at: number | null;
  photo_uri: string | null;
  note: string | null;
  event_id: string | null;
  memory_id: string | null;
  sync_status: string;
  created_at: number;
  updated_at: number;
};

function parseWeather(raw: string | null): WeatherSnapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WeatherSnapshot;
  } catch {
    return null;
  }
}

const toWalk = (r: Row): Walk => ({
  id: r.id,
  petId: r.pet_id,
  status: r.status,
  startedAt: r.started_at,
  pausedAt: r.paused_at,
  pausedMs: r.paused_ms,
  finishedAt: r.finished_at,
  durationMs: r.duration_ms,
  tz: r.tz,
  weather: parseWeather(r.weather_json),
  weatherAt: r.weather_at,
  photoUri: r.photo_uri,
  note: r.note,
  eventId: r.event_id,
  memoryId: r.memory_id,
  syncStatus: r.sync_status === 'synced' ? 'synced' : 'local',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function getWalk(db: Db, id: string): Promise<Walk | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM walks WHERE id = ?', [id]);
  return r ? toWalk(r) : null;
}

/** The walk in progress for this pet (active, paused, or interrupted while saving). */
export async function getLiveWalk(db: Db, petId: string): Promise<Walk | null> {
  const r = await db.getFirstAsync<Row>(
    "SELECT * FROM walks WHERE pet_id = ? AND status IN ('active', 'paused', 'completing') ORDER BY started_at DESC LIMIT 1",
    [petId],
  );
  return r ? toWalk(r) : null;
}

/** Any pet's walk in progress (one walk at a time across the app). */
export async function getAnyLiveWalk(db: Db): Promise<Walk | null> {
  const r = await db.getFirstAsync<Row>("SELECT * FROM walks WHERE status IN ('active', 'paused', 'completing') ORDER BY started_at DESC LIMIT 1", []);
  return r ? toWalk(r) : null;
}

export async function listWalks(db: Db, petId: string): Promise<Walk[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM walks WHERE pet_id = ? AND status = 'completed' ORDER BY started_at DESC", [petId]);
  return rows.map(toWalk);
}

/** Starts a walk, or returns the one already running for this pet (a second tap never starts two). */
export async function startWalk(db: Db, petId: string, weather: WeatherSnapshot | null, now = Date.now()): Promise<Walk> {
  const live = await getLiveWalk(db, petId);
  if (live) return live;
  const pet = await getPet(db, petId);
  if (!pet) throw new ValidationError(t('This pet no longer exists.'));
  const id = newId();
  const tz = safeTz();
  await db.runAsync(
    `INSERT INTO walks (id, pet_id, status, started_at, paused_ms, tz, weather_json, weather_at, created_at, updated_at)
     VALUES (?, ?, 'active', ?, 0, ?, ?, ?, ?, ?)`,
    [id, petId, now, tz, weather ? JSON.stringify(weather) : null, weather?.fetchedAt ?? null, now, now],
  );
  return (await getWalk(db, id))!;
}

function safeTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export async function pauseWalk(db: Db, id: string, now = Date.now()): Promise<Walk | null> {
  const w = await getWalk(db, id);
  if (!w || w.status !== 'active') return w;
  const s = pausedState(w, now);
  await db.runAsync("UPDATE walks SET status = ?, paused_at = ?, paused_ms = ?, updated_at = ? WHERE id = ? AND status = 'active'", [s.status, s.pausedAt, s.pausedMs, now, id]);
  return getWalk(db, id);
}

export async function resumeWalk(db: Db, id: string, now = Date.now()): Promise<Walk | null> {
  const w = await getWalk(db, id);
  if (!w || w.status !== 'paused') return w;
  const s = resumedState(w, now);
  await db.runAsync("UPDATE walks SET status = ?, paused_at = ?, paused_ms = ?, updated_at = ? WHERE id = ? AND status = 'paused'", [s.status, s.pausedAt, s.pausedMs, now, id]);
  return getWalk(db, id);
}

/** Attach the weather that arrived after the walk started (only if none was recorded yet). */
export async function setWalkWeather(db: Db, id: string, weather: WeatherSnapshot): Promise<void> {
  await db.runAsync('UPDATE walks SET weather_json = ?, weather_at = ?, updated_at = ? WHERE id = ? AND (weather_json IS NULL OR weather_json NOT LIKE \'%"available":true%\')', [
    JSON.stringify(weather),
    weather.fetchedAt,
    Date.now(),
    id,
  ]);
}

export async function discardWalk(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync("UPDATE walks SET status = 'discarded', updated_at = ? WHERE id = ? AND status IN ('active', 'paused')", [now, id]);
}

export type FinishResult = { walk: Walk; newBadges: AdventureBadgeId[] };

const memoryIdFor = (walkId: string) => `walk-${walkId}`;
const walkMinutes = (ms: number) => Math.max(1, Math.min(600, Math.round(ms / 60_000)));

function memoryTitle(name: string, ms: number) {
  return t('Adventure with {name} · {time}', { name, time: durationText(ms) }).slice(0, 60);
}

/**
 * Finishes the walk and records everything it touches. Idempotent: the status moves active/paused →
 * completing (only once, so a double tap can't finish twice), then each derived record is written with
 * a key derived from the walk id, then the walk becomes completed. Re-running a `completing` walk (after a
 * crash) finishes the job without duplicates. `endAt` lets a lock-screen Finish keep its real time.
 */
export async function finishWalk(db: Db, id: string, opts: { now?: number; endAt?: number; durationMs?: number } = {}): Promise<FinishResult> {
  const now = opts.now ?? Date.now();
  let w = await getWalk(db, id);
  if (!w) throw new ValidationError(t('This walk no longer exists.'));
  if (w.status === 'completed') return { walk: w, newBadges: [] };
  if (w.status === 'discarded') throw new ValidationError(t('This walk was discarded.'));
  if (w.status === 'active' || w.status === 'paused') {
    const end = Math.min(now, Math.max(w.startedAt, opts.endAt ?? now));
    const live = elapsedMs({ ...w, pausedAt: w.status === 'paused' ? w.pausedAt : null }, end);
    const duration = Math.max(0, Math.min(MAX_WALK_MS, opts.durationMs ?? live));
    const changed = await db.runAsync(
      "UPDATE walks SET status = 'completing', finished_at = ?, duration_ms = ?, paused_at = NULL, updated_at = ? WHERE id = ? AND status IN ('active', 'paused')",
      [end, duration, now, id],
    );
    w = (await getWalk(db, id))!;
    if (!changed.changes && w.status === 'completed') return { walk: w, newBadges: [] };
  }
  // status is 'completing' here: derive the linked records (each one idempotent)
  const pet = await getPet(db, w.petId);
  if (!pet) throw new ValidationError(t('This pet no longer exists.'));
  const ms = w.durationMs ?? 0;
  const event = await logCare(db, { petId: w.petId, type: 'walk', occurredAt: w.startedAt, amount: walkMinutes(ms), note: w.note, mutationId: `walk:${w.id}` }, now);
  const memId = memoryIdFor(w.id);
  await db.runAsync(
    `INSERT OR IGNORE INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, 'adventure', ?)`,
    [memId, w.petId, w.photoUri, memoryTitle(pet.name, ms), w.note, dayKeyOf(new Date(w.startedAt)), now],
  );
  await db.runAsync("UPDATE walks SET status = 'completed', event_id = ?, memory_id = ?, updated_at = ? WHERE id = ? AND status = 'completing'", [event.id, memId, now, w.id]);
  const newBadges = await syncBadges(db, w.petId, now);
  return { walk: (await getWalk(db, w.id))!, newBadges };
}

/** Finishes any walk left in `completing` (the app closed mid-save). Safe to call on every start. */
export async function recoverWalks(db: Db): Promise<void> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM walks WHERE status = 'completing'", []);
  for (const r of rows) await finishWalk(db, r.id).catch((e) => console.warn('[pavurio] walk recovery failed', e));
}

export type WalkBadge = { badge: AdventureBadgeId; walkId: string | null; unlockedAt: number; ruleVersion: number };

export async function listWalkBadges(db: Db, petId: string): Promise<WalkBadge[]> {
  const rows = await db.getAllAsync<{ badge: string; walk_id: string | null; unlocked_at: number; rule_version: number }>(
    'SELECT badge, walk_id, unlocked_at, rule_version FROM walk_badges WHERE pet_id = ? ORDER BY unlocked_at',
    [petId],
  );
  return rows
    .filter((r) => (ADVENTURE_BADGES as string[]).includes(r.badge))
    .map((r) => ({ badge: r.badge as AdventureBadgeId, walkId: r.walk_id, unlockedAt: r.unlocked_at, ruleVersion: r.rule_version }));
}

/**
 * Makes the stored badges match the walks: new ones are unlocked once (returned, for the celebration);
 * after an edit or a delete, a badge whose walk no longer qualifies moves to another qualifying walk,
 * or is removed when none is left.
 */
export async function syncBadges(db: Db, petId: string, now = Date.now()): Promise<AdventureBadgeId[]> {
  const walks = await listWalks(db, petId);
  const earned = earnedBadges(walks);
  const have = new Map((await listWalkBadges(db, petId)).map((b) => [b.badge, b]));
  const fresh: AdventureBadgeId[] = [];
  for (const id of ADVENTURE_BADGES) {
    const w = earned.get(id);
    const cur = have.get(id);
    if (w && !cur) {
      const r = await db.runAsync('INSERT OR IGNORE INTO walk_badges (pet_id, badge, walk_id, unlocked_at, rule_version) VALUES (?, ?, ?, ?, ?)', [
        petId,
        id,
        w.id,
        now,
        BADGE_RULE_VERSION,
      ]);
      if (r.changes) fresh.push(id);
    } else if (w && cur && cur.walkId !== w.id) {
      await db.runAsync('UPDATE walk_badges SET walk_id = ? WHERE pet_id = ? AND badge = ?', [w.id, petId, id]);
    } else if (!w && cur) {
      await db.runAsync('DELETE FROM walk_badges WHERE pet_id = ? AND badge = ?', [petId, id]);
    }
  }
  return fresh;
}

/** Owner corrections: duration (e.g. forgot to finish), note, photo. Keeps the care event and memory in step. */
export async function editWalk(db: Db, id: string, patch: { durationMs?: number; note?: string | null; photoUri?: string | null }, now = Date.now()): Promise<Walk> {
  const w = await getWalk(db, id);
  if (!w || w.status !== 'completed') throw new ValidationError(t('This walk no longer exists.'));
  const duration = patch.durationMs != null ? Math.max(60_000, Math.min(MAX_WALK_MS, Math.round(patch.durationMs))) : w.durationMs ?? 0;
  const note = patch.note !== undefined ? (patch.note?.trim() ? patch.note.trim().slice(0, 500) : null) : w.note;
  const photo = patch.photoUri !== undefined ? patch.photoUri : w.photoUri;
  await db.runAsync('UPDATE walks SET duration_ms = ?, finished_at = ?, note = ?, photo_uri = ?, updated_at = ? WHERE id = ?', [
    duration,
    w.startedAt + w.pausedMs + duration,
    note,
    photo,
    now,
    id,
  ]);
  if (w.eventId) {
    const ev = await getEvent(db, w.eventId);
    if (ev && !ev.voidedAt) await updateEvent(db, w.eventId, { amount: walkMinutes(duration), note }, now);
  }
  if (w.memoryId) {
    const pet = await getPet(db, w.petId);
    await db.runAsync('UPDATE memories SET title = ?, caption = ?, photo_uri = ? WHERE id = ?', [memoryTitle(pet?.name ?? '', duration), note, photo, w.memoryId]);
  }
  await syncBadges(db, w.petId, now);
  return (await getWalk(db, id))!;
}

/** Deletes the walk and what it created (care event voided, memory removed); badges follow. */
export async function deleteWalk(db: Db, id: string, now = Date.now()): Promise<void> {
  const w = await getWalk(db, id);
  if (!w) return;
  if (w.eventId) await voidEvent(db, w.eventId, now);
  if (w.memoryId) await db.runAsync('DELETE FROM memories WHERE id = ?', [w.memoryId]);
  await db.runAsync('DELETE FROM walks WHERE id = ?', [id]);
  await syncBadges(db, w.petId, now);
}

/** The walk behind an adventure memory (memory ids are `walk-<walkId>`). */
export function walkIdFromMemory(memoryId: string): string | null {
  return memoryId.startsWith('walk-') ? memoryId.slice(5) : null;
}

/**
 * Applies a Pause / Resume pressed on the lock screen, with the times the lock screen recorded.
 * Only moves forward from the walk's current state (a stale press can't undo a later in-app change).
 */
export async function applyLockScreenState(db: Db, id: string, s: { status: 'active' | 'paused'; pausedAt: number | null; pausedMs: number }, now = Date.now()): Promise<Walk | null> {
  const w = await getWalk(db, id);
  if (!w) return null;
  if (s.status === 'paused' && w.status === 'active' && s.pausedAt != null) {
    await db.runAsync("UPDATE walks SET status = 'paused', paused_at = ?, updated_at = ? WHERE id = ? AND status = 'active'", [Math.min(now, Math.max(w.startedAt, s.pausedAt)), now, id]);
  } else if (s.status === 'active' && w.status === 'paused' && s.pausedMs >= w.pausedMs) {
    await db.runAsync("UPDATE walks SET status = 'active', paused_at = NULL, paused_ms = ?, updated_at = ? WHERE id = ? AND status = 'paused'", [s.pausedMs, now, id]);
  }
  return getWalk(db, id);
}

/** The adventure behind a care event, when it came from a timed walk (mutation id `walk:<id>`). */
export function walkIdFromEvent(e: { mutationId: string }): string | null {
  return e.mutationId.startsWith('walk:') ? e.mutationId.slice(5) : null;
}

/** Deletes a care event; a walk event deletes its whole adventure so nothing is left half-linked. */
export async function removeCareEvent(db: Db, eventId: string, now = Date.now()): Promise<void> {
  const ev = await getEvent(db, eventId);
  const walkId = ev ? walkIdFromEvent(ev) : null;
  if (walkId && (await getWalk(db, walkId))) await deleteWalk(db, walkId, now);
  else await voidEvent(db, eventId, now);
}
