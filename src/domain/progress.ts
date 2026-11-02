import { t } from '../i18n/core';
import { CARE, CareType } from './care';

export type Plan = Partial<Record<CareType, number>>;

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

/** A bigger meal or a longer walk makes a thicker band, like a bigger glass in Waterllama. */
export function bandWeight(type: CareType, amount: number | null | undefined): number {
  const spec = CARE[type]?.amount;
  if (!spec || amount == null || !(amount > 0)) return 1;
  return Math.max(0.5, Math.min(1.6, amount / spec.default));
}

/**
 * Progress is "share of the owner's own plan that was logged". Extra logs beyond the
 * plan are recorded and shown, but never push the ratio over 1, and unplanned types
 * do not count toward it. This is NOT a welfare score.
 */
export function computeProgress(plan: Plan, events: CareEventLite[]): Progress {
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
      weights.push(bandWeight(e.type, e.amount));
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
