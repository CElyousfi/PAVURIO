/**
 * A pet's life stage from its birthday: the routine guide changes its advice at each stage (more, smaller
 * meals for babies; two meals from 6 months; gentler walks for seniors…). Pure, tested in tests/lifeStage.test.ts.
 */
import type { Species } from './care';

export type StageId = 'baby' | 'young' | 'junior' | 'adult' | 'senior';

/** Stage boundaries in months: [from, to). Cats are senior later than dogs. */
export const STAGES: Record<Species, { id: StageId; from: number; to: number }[]> = {
  dog: [
    { id: 'baby', from: 0, to: 3 },
    { id: 'young', from: 3, to: 6 },
    { id: 'junior', from: 6, to: 12 },
    { id: 'adult', from: 12, to: 84 },
    { id: 'senior', from: 84, to: Infinity },
  ],
  cat: [
    { id: 'baby', from: 0, to: 3 },
    { id: 'young', from: 3, to: 6 },
    { id: 'junior', from: 6, to: 12 },
    { id: 'adult', from: 12, to: 132 },
    { id: 'senior', from: 132, to: Infinity },
  ],
};

/** Whole months between a 'YYYY-MM-DD' birthday and `now` (never negative). */
export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
}

export function stageOf(species: Species, months: number): StageId {
  return STAGES[species].find((s) => months >= s.from && months < s.to)?.id ?? 'adult';
}

/** The date ('YYYY-MM-DD') the pet enters its next stage, or null for seniors. */
export function nextStageDate(species: Species, birthDate: string, now: Date = new Date()): { stage: StageId; date: string } | null {
  const months = ageInMonths(birthDate, now);
  const i = STAGES[species].findIndex((s) => months >= s.from && months < s.to);
  const next = STAGES[species][i + 1];
  if (!next) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const at = new Date(y, m - 1 + next.from, d);
  const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return { stage: next.id, date: key };
}

/** A birthday for an age picked from a range (owners often don't know the exact date). */
export function approxBirthDate(monthsAgo: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(now.getDate(), 28));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Age ranges offered when the birthday isn't known: the middle of each stage. */
export const AGE_PICKS: Record<Species, { stage: StageId; months: number }[]> = {
  dog: [
    { stage: 'baby', months: 2 },
    { stage: 'young', months: 4 },
    { stage: 'junior', months: 9 },
    { stage: 'adult', months: 36 },
    { stage: 'senior', months: 108 },
  ],
  cat: [
    { stage: 'baby', months: 2 },
    { stage: 'young', months: 4 },
    { stage: 'junior', months: 9 },
    { stage: 'adult', months: 48 },
    { stage: 'senior', months: 156 },
  ],
};
