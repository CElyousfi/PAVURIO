import { describe, expect, it } from 'vitest';
import { EMPTY_PRO_MOMENTS, markShown, parseProMoments, pickProMoment, recordAnswer } from '../src/domain/proMoments';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 4, 12);
const base = { pro: false, petCreatedAt: now - 10 * DAY, streak: 0, totalCares: 0, weekAvg: 0, weekDays: 7 };

describe('pro moments', () => {
  it('never offers to Pro users or on the first day', () => {
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, pro: true, streak: 7 }, now)).toBeNull();
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, petCreatedAt: now - 3_600_000, streak: 7 }, now)).toBeNull();
  });

  it('offers the best fresh moment', () => {
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, streak: 3 }, now)).toBe('streak3');
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, streak: 8, totalCares: 30 }, now)).toBe('streak7');
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, weekAvg: 0.9, weekDays: 6 }, now)).toBe('week');
    expect(pickProMoment(EMPTY_PRO_MOMENTS, { ...base, weekAvg: 0.9, weekDays: 3 }, now)).toBeNull();
  });

  it('shows each moment once and implies the smaller ones', () => {
    const s = markShown(EMPTY_PRO_MOMENTS, 'streak7', now - 30 * DAY);
    expect(s.shown).toEqual(expect.arrayContaining(['streak7', 'streak3']));
    expect(pickProMoment(s, { ...base, streak: 9 }, now)).toBeNull();
  });

  it('spaces offers out, more after each "not now"', () => {
    let s = markShown(EMPTY_PRO_MOMENTS, 'streak3', now - 1.5 * DAY);
    expect(pickProMoment(s, { ...base, streak: 7 }, now)).toBeNull();
    expect(pickProMoment(s, { ...base, streak: 7 }, now + DAY)).toBe('streak7');
    s = recordAnswer(recordAnswer(s, false), false); // two declines: 8-day gap
    expect(pickProMoment(s, { ...base, streak: 7 }, now + 5 * DAY)).toBeNull();
    expect(pickProMoment(s, { ...base, streak: 7 }, now + 7 * DAY)).toBe('streak7');
    expect(recordAnswer(s, true).declinesInARow).toBe(0);
  });

  it('after three offers, only big moments remain', () => {
    let s = EMPTY_PRO_MOMENTS;
    for (const k of ['streak3', 'cares25'] as const) s = markShown(s, k, now - 40 * DAY);
    s = { ...s, shown: [...s.shown, 'week'] };
    expect(pickProMoment(s, { ...base, streak: 7, totalCares: 30 }, now)).toBe('streak7');
  });

  it('parses stored state defensively', () => {
    expect(parseProMoments('nope')).toEqual(EMPTY_PRO_MOMENTS);
    expect(parseProMoments(JSON.stringify({ shown: ['week'], lastOfferAt: 5, declinesInARow: 2 })).declinesInARow).toBe(2);
  });
});
