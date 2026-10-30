import { describe, expect, it } from 'vitest';
import { computeProgress, progressSentence } from '../src/domain/progress';
import { addDays, dayRange, defaultOccurredAt, formatClock, formatDayTitle } from '../src/domain/time';
import { formatAmount, clampAmount } from '../src/domain/care';

describe('progress', () => {
  it('counts only planned care toward the ratio, capped at 1', () => {
    const plan = { meal: 2, walk: 1 };
    const p = computeProgress(plan, [
      { type: 'meal', occurredAt: 1 },
      { type: 'meal', occurredAt: 2 },
      { type: 'meal', occurredAt: 3 },
      { type: 'play', occurredAt: 4 },
    ]);
    expect(p.planned).toBe(3);
    expect(p.done).toBe(2);
    expect(p.ratio).toBeCloseTo(2 / 3);
    expect(p.counts.meal).toBe(3);
    expect(p.bands).toEqual(['meal', 'meal']);
  });

  it('orders bands chronologically', () => {
    const p = computeProgress({ meal: 1, walk: 1 }, [
      { type: 'walk', occurredAt: 10 },
      { type: 'meal', occurredAt: 5 },
    ]);
    expect(p.bands).toEqual(['meal', 'walk']);
    expect(p.ratio).toBe(1);
    expect(progressSentence(p)).toMatch(/colored in/);
  });

  it('handles an empty plan without dividing by zero', () => {
    expect(computeProgress({}, []).ratio).toBe(0);
    expect(progressSentence(computeProgress({}, []))).toBe('No daily plan yet');
  });
});

describe('time', () => {
  it('builds local day ranges with calendar math', () => {
    const r = dayRange(new Date(2026, 9, 30, 15, 0));
    expect(new Date(r.start).getHours()).toBe(0);
    expect(new Date(r.end).getDate()).toBe(31);
    expect(r.key).toBe('2026-10-30');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('defaults past-day logs to noon', () => {
    const now = new Date(2026, 9, 30, 9, 0);
    expect(new Date(defaultOccurredAt('2026-10-28', now)).getHours()).toBe(12);
    expect(defaultOccurredAt('2026-10-30', now)).toBe(now.getTime());
  });

  it('formats titles and clocks', () => {
    const now = new Date(2026, 9, 30, 9, 0);
    expect(formatDayTitle('2026-10-30', now)).toBe('Today');
    expect(formatDayTitle('2026-10-29', now)).toBe('Yesterday');
    expect(formatDayTitle('2026-10-27', now)).toBe('Tuesday, Oct 27');
    expect(formatClock(new Date(2026, 0, 1, 13, 5).getTime())).toBe('1:05 PM');
    expect(formatClock(new Date(2026, 0, 1, 0, 30).getTime())).toBe('12:30 AM');
  });
});

describe('care templates', () => {
  it('formats and clamps amounts', () => {
    expect(formatAmount('meal', 120)).toBe('120 g');
    expect(formatAmount('litter', null)).toBe('Cleaned');
    expect(clampAmount('walk', 99999)).toBe(600);
  });
});
