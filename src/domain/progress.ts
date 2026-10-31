import { t } from '../i18n/core';
import { CareType } from './care';

export type Plan = Partial<Record<CareType, number>>;

export type CareEventLite = { type: CareType; occurredAt: number };

export type Progress = {
  done: number;
  planned: number;
  /** 0..1, capped */
  ratio: number;
  /** per type counts (all logged, including beyond plan) */
  counts: Partial<Record<CareType, number>>;
  /** colored bands for the "care rug": one per counted event, chronological */
  bands: CareType[];
};

/**
 * Progress is "share of the owner's own plan that was logged". Extra logs beyond the
 * plan are recorded and shown, but never push the ratio over 1, and unplanned types
 * do not count toward it. This is NOT a welfare score.
 */
export function computeProgress(plan: Plan, events: CareEventLite[]): Progress {
  const counts: Partial<Record<CareType, number>> = {};
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const bands: CareType[] = [];
  const counted: Partial<Record<CareType, number>> = {};
  for (const e of sorted) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    const target = plan[e.type] ?? 0;
    if ((counted[e.type] ?? 0) < target) {
      counted[e.type] = (counted[e.type] ?? 0) + 1;
      bands.push(e.type);
    }
  }
  const planned = Object.values(plan).reduce<number>((s, n) => s + Math.max(0, n ?? 0), 0);
  const done = bands.length;
  const ratio = planned === 0 ? (events.length > 0 ? 1 : 0) : Math.min(1, done / planned);
  return { done, planned, ratio, counts, bands };
}

export function progressSentence(p: Progress): string {
  if (p.planned === 0) return p.done > 0 ? t('Care logged today') : t('No daily plan yet');
  const pct = Math.round(p.ratio * 100);
  if (pct >= 100) return t("Today's plan is all colored in");
  return t("Care logged · {pct}% of today's plan", { pct });
}
