/**
 * The automatic care plan: from a pet's species, age, size, weight and food, how many times a day each
 * care should happen, how much each time, and a reasonable range around it. The owner starts from this
 * plan and can move any value; the range tells them what's usual for a pet like theirs.
 *
 * Numbers follow standard veterinary rules of thumb (no doses, no diagnoses):
 * - food: resting energy 70 × kg^0.75, times a life-stage factor (puppies 3× under 4 months, then 2×;
 *   adult dogs 1.6×, senior dogs 1.4×; kittens 2.5× then 2×; adult cats 1.2×), divided by a typical
 *   calorie density for dry or wet food;
 * - walks: puppies about 5 minutes per month of age per walk; adults a daily total by size;
 * - water: about 55 ml/kg a day for dogs and 45 ml/kg for cats, less on wet food.
 * Pure and tested (tests/carePlan.test.ts).
 */
import { guideFor, Rec } from '../content/routineGuide';
import type { CareType, Species } from './care';
import { stageOf, StageId } from './lifeStage';

export type DogSize = 'toy' | 'small' | 'medium' | 'large' | 'giant';
export type CatSize = 'petite' | 'average' | 'big';
export type SizeId = DogSize | CatSize;
export type FoodKind = 'dry' | 'wet' | 'mixed';
export type PetProfile = { size: SizeId; food: FoodKind };

/** `kg` = the usual adult weight range [from, to] (null = open-ended) */
export type SizeInfo = { id: SizeId; adultKg: number; label: string; kg: [number | null, number | null] };
export const SIZES: Record<Species, SizeInfo[]> = {
  dog: [
    { id: 'toy', adultKg: 3.5, label: 'Toy', kg: [null, 5] },
    { id: 'small', adultKg: 8, label: 'Small', kg: [5, 10] },
    { id: 'medium', adultKg: 18, label: 'Medium', kg: [10, 25] },
    { id: 'large', adultKg: 32, label: 'Large', kg: [25, 45] },
    { id: 'giant', adultKg: 55, label: 'Giant', kg: [45, null] },
  ],
  cat: [
    { id: 'petite', adultKg: 3.3, label: 'Petite', kg: [null, 4] },
    { id: 'average', adultKg: 4.5, label: 'Average', kg: [4, 5.5] },
    { id: 'big', adultKg: 6.5, label: 'Large', kg: [5.5, null] },
  ],
};

export function defaultProfile(species: Species): PetProfile {
  return { size: species === 'dog' ? 'medium' : 'average', food: 'dry' };
}

export function sizeInfo(species: Species, size: SizeId): SizeInfo {
  return SIZES[species].find((s) => s.id === size) ?? SIZES[species].find((s) => s.id === defaultProfile(species).size)!;
}

/** Share of adult weight by age in months: small dogs grow up fast, giants keep growing until 2. */
const GROWTH_MONTHS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24];
const GROWTH: Record<SizeId, number[]> = {
  toy: [0.25, 0.4, 0.55, 0.68, 0.78, 0.9, 0.97, 1, 1, 1, 1],
  small: [0.22, 0.35, 0.5, 0.62, 0.72, 0.86, 0.95, 1, 1, 1, 1],
  medium: [0.17, 0.28, 0.4, 0.5, 0.6, 0.75, 0.87, 0.95, 1, 1, 1],
  large: [0.14, 0.23, 0.33, 0.43, 0.52, 0.67, 0.8, 0.9, 0.96, 1, 1],
  giant: [0.11, 0.18, 0.26, 0.34, 0.42, 0.56, 0.69, 0.8, 0.89, 0.95, 1],
  petite: [0.25, 0.35, 0.45, 0.55, 0.65, 0.8, 0.9, 0.97, 1, 1, 1],
  average: [0.25, 0.35, 0.45, 0.55, 0.65, 0.8, 0.9, 0.97, 1, 1, 1],
  // big cats (Maine Coons…) keep filling out for longer
  big: [0.2, 0.3, 0.4, 0.5, 0.58, 0.7, 0.8, 0.88, 0.94, 0.97, 1],
};

/** Typical weight in kg today for a pet of this size and age. */
export function estimateWeightKg(species: Species, size: SizeId, months: number): number {
  const adult = sizeInfo(species, size).adultKg;
  const curve = GROWTH[sizeInfo(species, size).id];
  let share: number;
  if (months <= GROWTH_MONTHS[0]) share = curve[0] * Math.max(0.5, months / GROWTH_MONTHS[0]);
  else if (months >= GROWTH_MONTHS[GROWTH_MONTHS.length - 1]) share = 1;
  else {
    const i = GROWTH_MONTHS.findIndex((m) => m > months) - 1;
    const f = (months - GROWTH_MONTHS[i]) / (GROWTH_MONTHS[i + 1] - GROWTH_MONTHS[i]);
    share = curve[i] + (curve[i + 1] - curve[i]) * f;
  }
  return Math.round(adult * share * 10) / 10;
}

/** Daily energy in kcal: resting energy × life-stage factor. */
export function dailyKcal(species: Species, months: number, kg: number): number {
  const rer = 70 * Math.pow(Math.max(0.3, kg), 0.75);
  const stage = stageOf(species, months);
  let factor: number;
  if (species === 'dog') factor = months < 4 ? 3 : months < 12 ? 2 : stage === 'senior' ? 1.4 : 1.6;
  else factor = months < 4 ? 2.5 : months < 12 ? 2 : stage === 'senior' ? 1.1 : 1.2;
  return rer * factor;
}

/** kcal per gram of a typical complete food. */
export function kcalPerGram(species: Species, months: number, food: 'dry' | 'wet'): number {
  const young = months < 12;
  if (food === 'wet') return species === 'dog' ? 1 : 0.95;
  if (species === 'dog') return young ? 3.9 : 3.6;
  return young ? 4.1 : 3.9;
}

/** Grams of food a day; for mixed feeding, half the energy from each (the two parts are returned too). */
export function dailyFoodGrams(species: Species, months: number, kg: number, food: FoodKind): { total: number; dry: number; wet: number } {
  const kcal = dailyKcal(species, months, kg);
  if (food === 'dry') {
    const g = kcal / kcalPerGram(species, months, 'dry');
    return { total: g, dry: g, wet: 0 };
  }
  if (food === 'wet') {
    const g = kcal / kcalPerGram(species, months, 'wet');
    return { total: g, dry: 0, wet: g };
  }
  const dry = kcal / 2 / kcalPerGram(species, months, 'dry');
  const wet = kcal / 2 / kcalPerGram(species, months, 'wet');
  return { total: dry + wet, dry, wet };
}

/** Water from the bowl in ml a day (wet food already carries a lot of water). */
export function dailyWaterMl(species: Species, kg: number, food: FoodKind): number {
  const perKg = species === 'dog' ? 55 : 45;
  const share = food === 'dry' ? 1 : food === 'mixed' ? (species === 'dog' ? 0.75 : 0.6) : species === 'dog' ? 0.55 : 0.35;
  return kg * perKg * share;
}

/** Adult walking per day in minutes by size: [usual, low, high]. */
const ADULT_WALK: Record<DogSize, [number, number, number]> = {
  toy: [40, 30, 60],
  small: [50, 30, 75],
  medium: [75, 60, 100],
  large: [90, 60, 120],
  giant: [60, 45, 90],
};

export type Range = { rec: number; min: number; max: number };

export type Target = {
  care: CareType;
  kind: 'daily' | 'weekly' | 'visit';
  /** times a day (daily) or days a week (weekly) */
  count: Range;
  /**
   * The total per day (meal grams, water ml, adult walk minutes): the portion is this split by the count,
   * so fewer meals means bigger meals. Null when the portion is per time (play, puppy walks).
   */
  daily: Range | null;
  /** amount each time when it doesn't depend on the count */
  each: Range | null;
  /** suggested times (24 h) for the recommended count */
  times: string[];
  /** weekdays for weekly cares */
  days: number[];
  /** whether a notification is worth it (meals, walks, litter, grooming days); water and play aren't */
  remind: boolean;
  /** the written guide for this care (headline, why, tips) */
  guide: Rec;
};

export type PlanBasis = { species: Species; months: number; stage: StageId; kg: number; weighed: boolean; profile: PetProfile; food: { total: number; dry: number; wet: number } };

const round = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);
const r5 = (v: number) => round(v, 5);
/** gram portions: to the nearest 5 g, or to the gram for small ones (kittens, toy breeds) */
export const roundGrams = (v: number) => (v >= 40 ? round(v, 5) : Math.max(1, Math.round(v)));
const around = (rec: number, spread: number, rnd: (v: number) => number): Range => ({ rec: rnd(rec), min: rnd(rec * (1 - spread)), max: rnd(rec * (1 + spread)) });

/** Usual range of times a day / days a week around the guide's count. */
function countRange(species: Species, stage: StageId, care: CareType, rec: number, weekly: boolean): Range {
  if (care === 'meal') {
    const t: Record<Species, Record<StageId, [number, number]>> = {
      dog: { baby: [3, 4], young: [3, 4], junior: [2, 3], adult: [1, 3], senior: [2, 3] },
      cat: { baby: [4, 5], young: [3, 4], junior: [2, 3], adult: [2, 4], senior: [2, 4] },
    };
    const [min, max] = t[species][stage];
    return { rec, min, max };
  }
  if (weekly) return { rec, min: Math.max(1, rec - 1), max: Math.min(7, rec + 1) };
  if (care === 'litter') return { rec, min: 1, max: 3 };
  return { rec, min: Math.max(1, rec - 1), max: rec + 1 };
}

/** Times spread over the day for n occurrences of a care; the guide's own times when the count matches. */
export function timesFor(care: CareType, n: number, base: string[] = []): string[] {
  if (n <= 0) return [];
  if (base.length === n) return [...base];
  const window: Partial<Record<CareType, [number, number]>> = {
    meal: [7.5, 19],
    walk: [7.5, 19],
    play: [10, 20],
    water: [8, 19],
    litter: [8, 20],
    grooming: [19, 19],
    medication: [8, 20],
  };
  const [from, to] = window[care] ?? [8, 20];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = n === 1 ? (care === 'meal' || care === 'walk' ? 18 : from) : from + ((to - from) * i) / (n - 1);
    const mins = Math.round((h * 60) / 30) * 30;
    out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

/** n weekdays spread over the week (Monday first), the guide's days when the count matches. */
export function daysFor(n: number, base: number[] = []): number[] {
  if (base.length === n) return [...base];
  const sets: Record<number, number[]> = { 1: [0], 2: [1, 4], 3: [1, 3, 5], 4: [1, 3, 5, 0], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  return [...(sets[Math.max(1, Math.min(7, n))] ?? [])].sort();
}

/** The weight the plan is built on: the latest weigh-in if given, else the typical weight for size and age. */
export function planBasis(species: Species, months: number, profile: PetProfile, weighedKg?: number | null): PlanBasis {
  const kg = weighedKg && weighedKg > 0 ? weighedKg : estimateWeightKg(species, profile.size, months);
  return { species, months, stage: stageOf(species, months), kg, weighed: !!(weighedKg && weighedKg > 0), profile, food: dailyFoodGrams(species, months, kg, profile.food) };
}

/** The full recommended plan, in the guide's care order. */
export function targetsFor(b: PlanBasis): Target[] {
  const { species, months, stage, kg, profile } = b;
  const growing = months < 12;
  return guideFor(species, stage).map((g): Target => {
    const weekly = g.kind === 'weekly';
    const recCount = weekly ? (g.days?.length ?? 1) : g.times.length;
    const base = {
      care: g.care,
      kind: g.kind,
      count: countRange(species, stage, g.care, recCount, weekly),
      daily: null as Range | null,
      each: null as Range | null,
      times: g.times,
      days: g.days ?? [],
      // a daily handling minute with a puppy doesn't need a notification; brushing days do
      remind: g.care === 'meal' || g.care === 'walk' || g.care === 'litter' || (g.care === 'grooming' && g.kind === 'weekly'),
      guide: g,
    };
    switch (g.care) {
      case 'meal':
        return { ...base, daily: around(b.food.total, growing ? 0.1 : 0.12, roundGrams) };
      case 'water': {
        // a bit more than they drink, so the bowl never runs dry between refills
        const ml = dailyWaterMl(species, kg, profile.food) * 1.25;
        return { ...base, daily: around(Math.max(100, ml), 0.3, (v) => round(v, 25)) };
      }
      case 'walk': {
        if (months < 12) {
          // about 5 minutes per month of age, per walk, until fully grown (shorter before 3 months)
          const adultEach = ADULT_WALK[profile.size as DogSize]?.[0] ?? 75;
          const rec = Math.min(r5(5 * Math.max(1, months)), r5(adultEach / 2), months < 3 ? 10 : 60);
          return { ...base, each: { rec, min: Math.max(5, r5(rec / 2)), max: rec } };
        }
        const [usual, lo, hi] = ADULT_WALK[profile.size as DogSize] ?? ADULT_WALK.medium;
        const k = stage === 'senior' ? 0.6 : 1;
        return { ...base, daily: { rec: r5(usual * k), min: r5(lo * k), max: r5(hi * k) } };
      }
      case 'play': {
        const rec = g.portion ?? 10;
        return { ...base, each: { rec, min: Math.max(5, rec - 5), max: rec + 10 } };
      }
      case 'grooming': {
        const rec = g.kind === 'daily' ? 5 : 10;
        return { ...base, each: { rec, min: 5, max: rec + 10 } };
      }
      default:
        return base;
    }
  });
}

/** Amount each time for a count: the daily total split (fewer meals = bigger meals), or the per-time amount. */
export function portionFor(t: Target, count: number): Range | null {
  if (t.each) return t.each;
  if (!t.daily) return null;
  const n = Math.max(1, t.kind === 'daily' ? count : 1);
  const rnd = t.care === 'meal' ? roundGrams : t.care === 'water' ? (v: number) => round(v, 25) : r5;
  return { rec: rnd(t.daily.rec / n), min: rnd(t.daily.min / n), max: rnd(t.daily.max / n) };
}

/** What the owner chose for one care: starts as the recommendation, every value can be moved. */
export type Choice = { care: CareType; kind: 'daily' | 'weekly'; on: boolean; count: number; portion: number | null; times: string[]; days: number[]; remind: boolean };

export function recommendedChoice(t: Target): Choice | null {
  if (t.kind === 'visit') return null;
  return { care: t.care, kind: t.kind, on: true, count: t.count.rec, portion: portionFor(t, t.count.rec)?.rec ?? null, times: t.times, days: t.days, remind: t.remind };
}

/** A new count: times re-spread, and for split portions the daily total re-divided. */
export function withCount(t: Target, c: Choice, count: number): Choice {
  const n = Math.max(1, Math.min(t.kind === 'weekly' ? 7 : 8, count));
  const before = portionFor(t, c.count);
  const after = portionFor(t, n);
  // keep the owner's own adjustment (e.g. 10% more than recommended) when the split changes
  const portion = c.portion != null && before && after ? scalePortion(t.care, c.portion, before.rec, after.rec) : (after?.rec ?? null);
  return t.kind === 'weekly' ? { ...c, count: n, days: daysFor(n, t.days), times: c.times.length ? [c.times[0]] : t.times } : { ...c, count: n, times: timesFor(t.care, n, t.times), portion };
}

export function scalePortion(care: CareType, current: number, oldRec: number, newRec: number): number {
  if (!(oldRec > 0)) return newRec;
  const v = (current / oldRec) * newRec;
  return care === 'meal' ? roundGrams(v) : care === 'water' ? round(v, 25) : r5(v);
}

export const inRange = (r: Range, v: number) => v >= r.min && v <= r.max;
