/**
 * Glue between a walk and its lock-screen presence (Live Activity / ongoing notification).
 */
import type { Db } from '../data/db';
import { applyLockScreenState, finishWalk, getWalk, type FinishResult } from '../data/walkRepo';
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
  if (w && (w.status === 'active' || w.status === 'paused')) await showWalkLive(liveProps(w, petName));
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
    // a pause pressed before Finish still counts: finish from the paused state when there was one
    if (p.pausedAt != null && w.status === 'active') await applyLockScreenState(db, walkId, { status: 'paused', pausedAt: p.pausedAt, pausedMs: p.pausedMs });
    const finished = await finishWalk(db, walkId, { endAt: p.finishAt ?? Date.now() });
    await endWalkLive();
    return { walk: finished.walk, finished };
  }
  const walk = await applyLockScreenState(db, walkId, { status: p.status, pausedAt: p.pausedAt, pausedMs: p.pausedMs });
  return { walk, finished: null };
}
