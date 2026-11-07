import { describe, expect, it } from 'vitest';
import { AGE_PICKS, ageInMonths, approxBirthDate, nextStageDate, stageOf } from '../src/domain/lifeStage';
import { allGuideStrings, guideFor } from '../src/content/routineGuide';
import { SPECIES_CARE } from '../src/domain/care';

describe('life stage', () => {
  const now = new Date(2026, 10, 7);

  it('counts whole months from the birthday', () => {
    expect(ageInMonths('2026-07-07', now)).toBe(4);
    expect(ageInMonths('2026-07-08', now)).toBe(3);
    expect(ageInMonths('2025-11-07', now)).toBe(12);
    expect(ageInMonths('2027-01-01', now)).toBe(0);
  });

  it('moves to two meals at 6 months', () => {
    expect(stageOf('dog', 5)).toBe('young');
    expect(stageOf('dog', 6)).toBe('junior');
    expect(guideFor('dog', 'young').find((r) => r.care === 'meal')!.times).toHaveLength(3);
    expect(guideFor('dog', 'junior').find((r) => r.care === 'meal')!.times).toHaveLength(2);
    expect(guideFor('cat', 'baby').find((r) => r.care === 'meal')!.times).toHaveLength(4);
  });

  it('dogs are senior at 7, cats at 11', () => {
    expect(stageOf('dog', 84)).toBe('senior');
    expect(stageOf('cat', 84)).toBe('adult');
    expect(stageOf('cat', 132)).toBe('senior');
  });

  it('knows when the next stage starts', () => {
    expect(nextStageDate('cat', '2026-07-07', now)).toEqual({ stage: 'junior', date: '2027-01-07' });
    expect(nextStageDate('dog', '2010-01-01', now)).toBeNull();
  });

  it('an age picked from a range lands in that stage', () => {
    for (const sp of ['dog', 'cat'] as const)
      for (const a of AGE_PICKS[sp]) expect(stageOf(sp, ageInMonths(approxBirthDate(a.months, now), now))).toBe(a.stage);
  });

  it('the guide covers every care the species has, with sensible routines', () => {
    for (const sp of ['dog', 'cat'] as const)
      for (const st of ['baby', 'young', 'junior', 'adult', 'senior'] as const) {
        const g = guideFor(sp, st);
        expect(g.map((r) => r.care).sort()).toEqual([...SPECIES_CARE[sp]].sort());
        for (const r of g) {
          if (r.kind !== 'visit') expect(r.times.length).toBeGreaterThan(0);
          for (const tm of r.times) expect(tm).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
          if (r.kind === 'weekly') expect(r.days?.length).toBeGreaterThan(0);
          expect(r.points.length).toBeGreaterThan(0);
        }
      }
    expect(allGuideStrings().length).toBeGreaterThan(80);
  });
});
