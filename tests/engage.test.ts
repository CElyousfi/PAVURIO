import { describe, expect, it } from 'vitest';
import { computeStreak, groupByDay } from '../src/domain/streak';
import { BADGES, badgesFor, earnedBadges } from '../src/domain/badges';
import { TIPS } from '../src/content/tips';

const at = (day: string, h = 9) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, h).getTime();
};
const plan = { meal: 2 };
const meals = (day: string, n = 2) => Array.from({ length: n }, (_, i) => ({ type: 'meal' as const, occurredAt: at(day, 8 + i * 8) }));

describe('streaks', () => {
  it('counts consecutive complete days and keeps yesterday’s streak alive until today is over', () => {
    const ev = [...meals('2026-10-27'), ...meals('2026-10-28'), ...meals('2026-10-29'), ...meals('2026-10-30'), ...meals('2026-10-31', 1)];
    const s = computeStreak(plan, groupByDay(ev), '2026-10-31');
    expect(s).toMatchObject({ current: 4, todayDone: false, atRisk: true });
    const s2 = computeStreak(plan, groupByDay([...ev, ...meals('2026-10-31', 1)]), '2026-10-31');
    expect(s2).toMatchObject({ current: 5, todayDone: true, atRisk: false });
  });
  it('a gap resets the current streak but best remembers', () => {
    const ev = [...meals('2026-10-20'), ...meals('2026-10-21'), ...meals('2026-10-22'), ...meals('2026-10-30')];
    const s = computeStreak(plan, groupByDay(ev), '2026-10-31');
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
  it('a partial day does not count', () => {
    expect(computeStreak(plan, groupByDay(meals('2026-10-30', 1)), '2026-10-31').current).toBe(0);
  });
});

describe('badges and tips', () => {
  it('earns from real stats only', () => {
    const none = { logs: 0, bestStreak: 0, routines: 0, medRoutines: 0, records: 0, moments: 0, weights: 0, challengesDone: 0, pets: 1, walksTimed: 0, waterLogs: 0, groomLogs: 0, hasBirthday: false };
    expect(earnedBadges(none)).toEqual([]);
    expect(earnedBadges({ ...none, logs: 60, bestStreak: 7, waterLogs: 20, hasBirthday: true })).toEqual(['first_log', 'streak3', 'streak7', 'hydration', 'birthday']);
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(13);
    expect(badgesFor('cat').some((b) => b.key === 'walker')).toBe(false);
    expect(badgesFor('dog').length).toBe(13);
  });
  it('every tip has 3 slides in both languages', () => {
    for (const tip of TIPS) {
      expect(tip.slides.length).toBe(3);
      for (const s of tip.slides) expect(s.title.fr && s.body.fr && s.title.en && s.body.en).toBeTruthy();
    }
  });
});
