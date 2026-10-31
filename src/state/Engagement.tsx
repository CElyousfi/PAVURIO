/**
 * Streak, challenges and achievements for the active pet, recomputed after every data change.
 * Also detects newly finished challenges / newly earned badges so the UI can celebrate them once.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listEventsBetween } from '../data/repo';
import { badgeStats, completeChallenge, listChallengeRuns, markSeen, seenSet } from '../data/engageRepo';
import { BadgeStats, earnedBadges } from '../domain/badges';
import { CHALLENGES, ChallengeDef, ChallengeProgress, ChallengeRun, challengeProgress } from '../domain/challenges';
import { DayLogs, Streak, computeStreak, groupByDay } from '../domain/streak';
import { addDays, dayKeyOf, parseDayKey } from '../domain/time';
import { useApp } from './AppState';

export type LiveChallenge = { def: ChallengeDef; run: ChallengeRun; progress: ChallengeProgress };
export type Celebration = { kind: 'badge'; key: string } | { kind: 'challenge'; key: string };

type Ctx = {
  loaded: boolean;
  byDay: DayLogs;
  streak: Streak;
  challenges: LiveChallenge[];
  completedChallengeKeys: string[];
  stats: BadgeStats | null;
  earned: string[];
  queue: Celebration[];
  shift: () => void;
};

const EMPTY_STREAK: Streak = { current: 0, best: 0, todayDone: false, atRisk: false };
const C = createContext<Ctx | null>(null);
const HISTORY_DAYS = 400;

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const { db, pet, plan, version, bump } = useApp();
  const [state, setState] = useState<Omit<Ctx, 'queue' | 'shift'>>({ loaded: false, byDay: new Map(), streak: EMPTY_STREAK, challenges: [], completedChallengeKeys: [], stats: null, earned: [] });
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [tick, setTick] = useState(0);

  // the day rolls over at midnight: recompute every few minutes
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 5 * 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!pet) return;
    let alive = true;
    (async () => {
      const today = dayKeyOf(new Date());
      const from = parseDayKey(addDays(today, -HISTORY_DAYS)).getTime();
      const events = await listEventsBetween(db, pet.id, from, Date.now() + 60_000);
      const byDay = groupByDay(events);
      const streak = computeStreak(plan, byDay, today);
      const runs = await listChallengeRuns(db, pet.id);
      const challenges: LiveChallenge[] = [];
      const fresh: Celebration[] = [];
      let changed = false;
      for (const run of runs) {
        const def = CHALLENGES.find((c) => c.key === run.key);
        if (!def) continue;
        const progress = challengeProgress(def, run, plan, byDay, today);
        if (progress.state === 'completed' && !run.completedAt) {
          await completeChallenge(db, run.id);
          run.completedAt = Date.now();
          fresh.push({ kind: 'challenge', key: def.key });
          changed = true;
        }
        challenges.push({ def, run, progress });
      }
      const stats = await badgeStats(db, pet.id, streak.best);
      const earned = earnedBadges(stats);
      const seenKey = `seenBadges:${pet.id}`;
      const seen = await seenSet(db, seenKey);
      const newBadges = earned.filter((k) => !seen.has(k));
      if (newBadges.length) {
        await markSeen(db, seenKey, newBadges);
        // the very first load after an update shouldn't flood: only celebrate when something was seen before
        // never flood (first launch after an update can unlock several at once): celebrate at most two
        if (seen.size > 0 || newBadges.length <= 2) newBadges.slice(0, 2).forEach((k) => fresh.push({ kind: 'badge', key: k }));
      }
      // celebrations were already marked as seen: queue them even if this load was superseded
      if (fresh.length) setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.kind === f.kind && x.key === f.key))]);
      if (!alive) return;
      const completedChallengeKeys = challenges.filter((c) => c.run.completedAt).map((c) => c.def.key);
      setState({ loaded: true, byDay, streak, challenges, completedChallengeKeys, stats, earned });
      if (changed) bump();
    })().catch((e) => console.warn('[pavurio] engagement load failed', e));
    return () => {
      alive = false;
    };
  }, [db, pet, plan, version, tick, bump]);

  const shift = useCallback(() => setQueue((q) => q.slice(1)), []);
  const value = useMemo<Ctx>(() => ({ ...state, queue, shift }), [state, queue, shift]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useEngagement(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('useEngagement must be used inside EngagementProvider');
  return c;
}
