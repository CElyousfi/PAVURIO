import { t } from '../i18n/core';
import { CARE, CareType } from './care';

export type Plan = Partial<Record<CareType, number>>;
/** The owner's usual amount for each care (g, ml, min, doses), set with the plan. */
export type Portions = Partial<Record<CareType, number>>;

/** One serving for this owner: their own portion, else the care's default amount (1 for care without amounts). */
export function portionOf(type: CareType, portions: Portions = {}): number {
  const p = portions[type];
  if (p != null && p > 0) return p;
  return CARE[type]?.amount?.default ?? 1;
}

/**
 * Today's goal for one care in its own unit: times a day × the owner's portion (e.g. 2 × 100 g = 200 g,
 * 2 × 20 min = 40 min). A care that isn't in the plan has one serving as its goal.
 */
export function dailyGoal(type: CareType, plan: Plan, portions: Portions = {}): number {
  const times = Math.max(0, plan[type] ?? 0);
  return Math.max(1, times) * portionOf(type, portions);
}

/** How much of one care was given today, in its unit (counts for care without amounts). */
export function givenToday(type: CareType, events: CareEventLite[], portions: Portions = {}): number {
  let sum = 0;
  for (const e of events) {
    if (e.type !== type) continue;
    sum += CARE[type]?.amount ? (e.amount != null && e.amount > 0 ? e.amount : portionOf(type, portions)) : 1;
  }
  return sum;
}

/** 0..1 — how full this care's picture is: what was given against the owner's own goal. */
export function careFill(type: CareType, plan: Plan, portions: Portions, events: CareEventLite[]): number {
  const goal = CARE[type]?.amount ? dailyGoal(type, plan, portions) : Math.max(1, plan[type] ?? 0);
  return Math.max(0, Math.min(1, givenToday(type, events, portions) / goal));
}

export type CareEventLite = { type: CareType; occurredAt: number; amount?: number | null };

export type Progress = {
  done: number;
  planned: number;
  /** 0..1, capped */
  ratio: number;
  /** per type counts (all logged, including beyond plan) */
  counts: Partial<Record<CareType, number>>;
  /** colored bands: one per counted event, chronological */
  bands: CareType[];
  /** how much each band weighs, from the amount logged vs the care's usual amount (0.5–1.6; 1 when no amount) */
  weights: number[];
  /** visual fill of the pet, 0..1: the bands stacked by quantity, full when the plan is done */
  level: number;
};

/**
 * A bigger meal or a longer walk makes a thicker band, like a bigger glass in Waterllama — measured
 * against the owner's own portion, so a full usual meal is exactly one band.
 */
export function bandWeight(type: CareType, amount: number | null | undefined, portions: Portions = {}): number {
  const spec = CARE[type]?.amount;
  if (!spec || amount == null || !(amount > 0)) return 1;
  return Math.max(0.25, Math.min(2, amount / portionOf(type, portions)));
}

/**
 * Progress is "share of the owner's own plan that was logged". Extra logs beyond the
 * plan are recorded and shown, but never push the ratio over 1, and unplanned types
 * do not count toward it. This is NOT a welfare score.
 */
export function computeProgress(plan: Plan, events: CareEventLite[], portions: Portions = {}): Progress {
  const counts: Partial<Record<CareType, number>> = {};
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const bands: CareType[] = [];
  const weights: number[] = [];
  const counted: Partial<Record<CareType, number>> = {};
  for (const e of sorted) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    const target = plan[e.type] ?? 0;
    if ((counted[e.type] ?? 0) < target) {
      counted[e.type] = (counted[e.type] ?? 0) + 1;
      bands.push(e.type);
      weights.push(bandWeight(e.type, e.amount, portions));
    }
  }
  const planned = Object.values(plan).reduce<number>((s, n) => s + Math.max(0, n ?? 0), 0);
  const done = bands.length;
  const ratio = planned === 0 ? (events.length > 0 ? 1 : 0) : Math.min(1, done / planned);
  const stacked = planned === 0 ? ratio : weights.reduce((a, w) => a + w, 0) / planned;
  // the plan done = full pet; otherwise the stacked quantities, never quite full until it is
  const level = ratio >= 1 ? 1 : Math.min(0.96, stacked);
  return { done, planned, ratio, counts, bands, weights, level };
}

export function progressSentence(p: Progress): string {
  if (p.planned === 0) return p.done > 0 ? t('Care logged today') : t('No daily plan yet');
  const pct = Math.round(p.ratio * 100);
  if (pct >= 100) return t("Today's plan is all colored in");
  return t("Care logged · {pct}% of today's plan", { pct });
}

/** One band of colour inside the pet, as fractions (0 = paws, 1 = top of the head) of its height. */
export type FillBand = { type: CareType; from: number; to: number };

/**
 * The pet's colour stack: each counted care is a band as thick as its quantity (weight / planned),
 * stacked in the order logged and scaled so the top lands exactly on `level`.
 */
export function fillStack(p: Progress): FillBand[] {
  if (!p.bands.length || p.level <= 0) return [];
  const raw = p.planned > 0 ? p.weights.map((w) => w / p.planned) : p.weights.map(() => 1 / p.bands.length);
  const sum = raw.reduce((a, b) => a + b, 0);
  const k = sum > 0 ? p.level / sum : 0;
  const out: FillBand[] = [];
  let at = 0;
  p.bands.forEach((type, i) => {
    const to = at + raw[i] * k;
    out.push({ type, from: at, to });
    at = to;
  });
  return out;
}
