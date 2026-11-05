/**
 * Glue between a walk and its lock-screen presence (Live Activity / ongoing notification).
 */
import type { Db } from '../data/db';
import { applyLockScreenState, finishWalk, getWalk, type FinishResult } from '../data/walkRepo';
import { getEvent, getSetting, setSetting } from '../data/repo';
import { listSchedules } from '../data/careRepo';
import { bumpCounter } from '../data/engageRepo';
import { confirmOccurrence } from './careLink';
import type { Walk } from '../domain/walks';
import { formatClock } from '../domain/time';
import { endWalkLive, readWalkLive, showWalkLive, type WalkLiveProps } from '../native/walkLive';
import { t } from '../i18n';

export function liveProps(w: Walk, petName: string): WalkLiveProps {
  return {
    walkId: w.id,
    petName,
    startedAt: w.startedAt,
    pausedAt: w.pausedAt,
    pausedMs: w.pausedMs,
    status: w.status === 'paused' ? 'paused' : 'active',
    finishAt: null,
    title: t('Adventure saved'),
    since: t('Started {time}', { time: formatClock(w.startedAt) }),
    walking: t('Walking with {name}', { name: petName }),
    pausedText: t('Walk paused'),
    finishedText: t('Open Pavurio to see your adventure'),
    pause: t('Pause'),
    resume: t('Resume'),
    finish: t('Finish'),
  };
}

/** Keeps the lock screen in step with the walk (or clears it when there's no walk in progress). */
export async function mirrorWalk(w: Walk | null, petName: string): Promise<void> {
  if (w && (w.status === 'active' || w.status === 'paused')) {
    // the walk illustration on the Lock Screen (loaded lazily: native-only module)
    const art = await import('../native/widgets/art').then((m) => m.widgetArt()).catch(() => null);
    await showWalkLive({ ...liveProps(w, petName), art: art?.walk_wide ?? '' });
  }
  else await endWalkLive();
}

/**
 * Picks up what happened on the lock screen while the app was away. Returns the finish result when the
 * walk was finished there (so the app can show the celebration), or the walk's new state.
 */
export async function reconcileLockScreen(db: Db, walkId: string): Promise<{ walk: Walk | null; finished: FinishResult | null }> {
  const p = await readWalkLive(walkId);
  if (!p) return { walk: await getWalk(db, walkId), finished: null };
  return applyLive(db, walkId, p);
}

export async function applyLive(db: Db, walkId: string, p: Pick<WalkLiveProps, 'status' | 'pausedAt' | 'pausedMs' | 'finishAt'>): Promise<{ walk: Walk | null; finished: FinishResult | null }> {
  const w = await getWalk(db, walkId);
  if (!w || (w.status !== 'active' && w.status !== 'paused')) return { walk: w, finished: null };
  if (p.status === 'finished') {
    // the lock screen's own pause state at Finish: paused (finish at the pause) or walking, with all its paused time
    await applyLockScreenState(db, walkId, p.pausedAt != null ? { status: 'paused', pausedAt: p.pausedAt, pausedMs: p.pausedMs } : { status: 'active', pausedAt: null, pausedMs: p.pausedMs });
    const finished = await finishWalk(db, walkId, { endAt: p.finishAt ?? Date.now() });
    await afterWalkFinished(db, finished);
    await endWalkLive();
    return { walk: finished.walk, finished };
  }
  const walk = await applyLockScreenState(db, walkId, { status: p.status, pausedAt: p.pausedAt, pausedMs: p.pausedMs });
  return { walk, finished: null };
}

/**
 * What every finished walk does once, wherever it was finished (screen, lock screen, crash recovery):
 * ticks the scheduled walk it fulfils and counts it for achievements.
 *
 * Recoverable: each step has its own marker that is written only after the step succeeded (the count
 * and its marker in one transaction), and the "all done" marker comes last. An interruption at any
 * point leaves the walk to be finished by `finishPendingWalks` on the next start; nothing is counted
 * twice and a temporary failure never blocks the update for good.
 */
export async function afterWalkFinished(db: Db, r: FinishResult): Promise<void> {
  const w = r.walk;
  const key = `walkCounted:${w.id}`;
  if (await getSetting(db, key)) return;
  if (w.eventId && !(await getSetting(db, `${key}:care`))) {
    const ev = await getEvent(db, w.eventId);
    if (ev) {
      // already ticked by this walk (a re-run): don't tick a second occurrence
      const linked = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM schedule_marks WHERE event_id = ?', [ev.id]);
      if (!linked?.n) await confirmOccurrence(db, await listSchedules(db, w.petId), ev);
    }
    await setSetting(db, `${key}:care`, '1');
  }
  if (!(await getSetting(db, `${key}:count`))) {
    await db.withTransactionAsync(async () => {
      await bumpCounter(db, `walksTimed:${w.petId}`);
      await setSetting(db, `${key}:count`, '1');
    });
  }
  await setSetting(db, key, '1');
}

/** Completed walks whose follow-up didn't finish (the app was closed, a step failed): finish them now. */
export async function finishPendingWalks(db: Db): Promise<number> {
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM walks WHERE status = 'completed' AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'walkCounted:' || walks.id)",
    [],
  );
  let n = 0;
  for (const { id } of rows) {
    const walk = await getWalk(db, id);
    if (!walk) continue;
    try {
      await afterWalkFinished(db, { walk, newBadges: [] });
      n++;
    } catch (e) {
      console.warn('[pavurio] walk follow-up will retry', e);
    }
  }
  return n;
}
