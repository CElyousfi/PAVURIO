/**
 * Keeps a walk and its lock-screen presence in step, app-wide:
 * - on start and whenever the app comes back: finishes a walk interrupted mid-save, applies Pause /
 *   Resume / Finish pressed on the lock screen (with their real times), and re-shows the lock-screen
 *   controls for a walk still in progress (they don't survive a phone restart);
 * - while the app runs: a lock-screen press is applied at once.
 * A walk finished from the lock screen opens its celebration the next time the app is in front.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/AppState';
import { getAnyLiveWalk, getWalk, pauseWalk, recoverWalks, resumeWalk } from '../data/walkRepo';
import { applyLive, mirrorWalk, reconcileLockScreen } from './walkSession';
import { onWalkLiveAction } from '../native/walkLive';

export function WalkLiveBridge() {
  const app = useApp();
  const ref = useRef(app);
  ref.current = app;

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const { db, pets, bump } = ref.current;
      try {
        await recoverWalks(db);
        const w = await getAnyLiveWalk(db);
        if (!w || !alive) return;
        const name = pets.find((p) => p.id === w.petId)?.name ?? '';
        const r = await reconcileLockScreen(db, w.id);
        if (r.finished) {
          bump();
          router.navigate({ pathname: '/walk', params: { done: r.finished.walk.id } });
          return;
        }
        await mirrorWalk(r.walk, name);
        if (r.walk && (r.walk.status !== w.status || r.walk.pausedMs !== w.pausedMs)) bump();
      } catch (e) {
        console.warn('[pavurio] walk sync failed', e);
      }
    };
    void sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void sync());
    const off = onWalkLiveAction(async (action, walkId, at) => {
      const { db, bump, pets } = ref.current;
      const w = await getWalk(db, walkId);
      if (!w) return;
      if (action === 'finish') {
        const r = await applyLive(db, walkId, { status: 'finished', finishAt: at, pausedAt: w.pausedAt, pausedMs: w.pausedMs });
        bump();
        if (r.finished) router.navigate({ pathname: '/walk', params: { done: walkId } });
        return;
      }
      const next = action === 'pause' ? await pauseWalk(db, walkId, at) : await resumeWalk(db, walkId, at);
      await mirrorWalk(next, pets.find((p) => p.id === w.petId)?.name ?? '');
      bump();
    });
    return () => {
      alive = false;
      sub.remove();
      off();
    };
  }, []);
  return null;
}
