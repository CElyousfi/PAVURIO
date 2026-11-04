/**
 * Supplies: what's on the shelf for the pet (food, treats, litter, medicine…) and when it runs out.
 *
 * Stock is kept as "what was on hand at `stockAt`" (set by a purchase or a correction). What's on hand
 * now is that minus what was used since:
 *  - linked supplies (dry food ↔ meals, medicine ↔ medication) subtract the amounts actually logged;
 *  - the others subtract a daily rate (from "a pack lasts about…").
 * The daily rate for forecasts is learned from the last 14 days of logs when there are enough of them,
 * otherwise taken from the owner's plan (times a day × portion), otherwise the manual rate.
 * Pure: everything is passed in, so it is tested in node.
 */
import type { CareType } from './care';

export type SupplyKind = 'food' | 'wet' | 'treats' | 'litter' | 'medicine' | 'bags' | 'other';
export type SupplyUnit = 'g' | 'dose' | 'pcs' | 'L';

export type Supply = {
  id: string;
  petId: string;
  kind: SupplyKind;
  name: string;
  unit: SupplyUnit;
  /** base units in one pack (grams, doses, pieces, litres) */
  packSize: number;
  /** base units on hand at `stockAt` */
  stock: number;
  stockAt: number;
  /** a care type whose logged amounts use this up (meal → food, medication → medicine) */
  link: CareType | null;
  /** manual use per day (base units) when not linked, or to override */
  perDay: number | null;
  /** remind this many days before it runs out */
  leadDays: number;
  /** price of one pack (owner's currency), if they entered one */
  price: number | null;
  createdAt: number;
};

export type Purchase = { id: string; supplyId: string; at: number; packs: number; packSize: number; price: number | null };

export type UseEvent = { type: CareType; occurredAt: number; amount?: number | null };

export type RateSource = 'logs' | 'plan' | 'manual' | 'none';
export type SupplyStatus = 'out' | 'buy' | 'soon' | 'ok' | 'unknown';

export type Forecast = {
  supply: Supply;
  /** base units on hand now */
  left: number;
  /** base units per day used for the forecast */
  perDay: number;
  source: RateSource;
  /** days of supply left (Infinity when nothing uses it) */
  daysLeft: number;
  runOutAt: number | null;
  /** last good day to buy so it never runs out (run-out minus lead time) */
  buyBy: number | null;
  status: SupplyStatus;
  /** 0..1 of the last refill (or one pack) still there, for the fill picture */
  level: number;
};

export const DAY = 86_400_000;
const LEARN_DAYS = 14;
const MIN_LOG_DAYS = 4;

/** what one linked log uses when it has no amount (a medication logged without a dose = 1 dose) */
function amountOf(e: UseEvent, fallback: number) {
  return e.amount != null && e.amount > 0 ? e.amount : fallback;
}

export function usedSince(s: Supply, events: UseEvent[], now: number, portion: number): number {
  if (s.link) return events.filter((e) => e.type === s.link && e.occurredAt > s.stockAt && e.occurredAt <= now).reduce((a, e) => a + amountOf(e, portion), 0);
  return s.perDay ? (s.perDay * Math.max(0, now - s.stockAt)) / DAY : 0;
}

/** How fast it goes: real use from the last two weeks of logs, else the plan, else the manual rate. */
export function dailyRate(s: Supply, events: UseEvent[], now: number, plan: { perDay: number } | null, portion: number): { perDay: number; source: RateSource } {
  if (s.link) {
    const from = now - LEARN_DAYS * DAY;
    const linked = events.filter((e) => e.type === s.link && e.occurredAt > from && e.occurredAt <= now);
    const days = new Set(linked.map((e) => Math.floor((e.occurredAt - from) / DAY))).size;
    if (days >= MIN_LOG_DAYS) {
      // spread over the days since the first of those logs (a new owner isn't averaged over empty weeks)
      const first = Math.min(...linked.map((e) => e.occurredAt));
      const span = Math.max(MIN_LOG_DAYS, Math.ceil((now - first) / DAY));
      return { perDay: linked.reduce((a, e) => a + amountOf(e, portion), 0) / Math.min(span, LEARN_DAYS), source: 'logs' };
    }
    if (plan && plan.perDay > 0) return { perDay: plan.perDay, source: 'plan' };
  }
  if (s.perDay && s.perDay > 0) return { perDay: s.perDay, source: 'manual' };
  return { perDay: 0, source: 'none' };
}

export function forecast(
  s: Supply,
  ctx: { events: UseEvent[]; now: number; plan: { perDay: number } | null; portion: number; lastRefill?: number | null },
): Forecast {
  const { events, now, plan, portion } = ctx;
  const left = Math.max(0, s.stock - usedSince(s, events, now, portion));
  const { perDay, source } = dailyRate(s, events, now, plan, portion);
  const daysLeft = perDay > 0 ? left / perDay : Infinity;
  const runOutAt = Number.isFinite(daysLeft) ? now + daysLeft * DAY : null;
  const buyBy = runOutAt != null ? runOutAt - s.leadDays * DAY : null;
  let status: SupplyStatus;
  if (left <= 0) status = 'out';
  else if (source === 'none') status = 'unknown';
  else if (buyBy != null && buyBy <= now + DAY) status = 'buy';
  else if (daysLeft <= s.leadDays + 7) status = 'soon';
  else status = 'ok';
  const full = Math.max(s.packSize, ctx.lastRefill ?? 0, s.stock);
  return { supply: s, left, perDay, source, daysLeft, runOutAt, buyBy, status, level: full > 0 ? Math.min(1, left / full) : 0 };
}

const ORDER: Record<SupplyStatus, number> = { out: 0, buy: 1, soon: 2, unknown: 3, ok: 4 };
export function sortForecasts(list: Forecast[]): Forecast[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.daysLeft - b.daysLeft);
}

/** What to buy in the next `horizon` days, with how many packs to cover about a month after that. */
export function shoppingList(list: Forecast[], now: number, horizonDays = 7): { f: Forecast; packs: number }[] {
  return sortForecasts(list)
    .filter((f) => f.status === 'out' || f.status === 'buy' || (f.buyBy != null && f.buyBy <= now + horizonDays * DAY))
    .map((f) => {
      const need = f.perDay * 30 - f.left;
      return { f, packs: Math.max(1, Math.ceil(need / Math.max(1, f.supply.packSize))) };
    });
}

/** Rough cost per month from the pack price and the use rate (null without a price). */
export function monthlyCost(f: Forecast): number | null {
  if (f.supply.price == null || f.supply.packSize <= 0 || f.perDay <= 0) return null;
  return (f.supply.price / f.supply.packSize) * f.perDay * 30;
}

/** "Same as last time": the most recent purchase's pack count, size and price. */
export function lastPurchase(purchases: Purchase[], supplyId: string): Purchase | null {
  return purchases.filter((p) => p.supplyId === supplyId).sort((a, b) => b.at - a.at)[0] ?? null;
}

/** A pack lasts about `days`: the manual daily rate. */
export const perDayFromLasting = (packSize: number, days: number) => (days > 0 ? packSize / days : null);

/** Display an amount in its unit: grams become kg from 1000, litres keep one decimal. */
export function formatQty(n: number, unit: SupplyUnit): { value: string; unit: string } {
  if (unit === 'g') return n >= 1000 ? { value: trim(n / 1000, n >= 10_000 ? 0 : 1), unit: 'kg' } : { value: String(Math.round(n)), unit: 'g' };
  if (unit === 'L') return { value: trim(n, 1), unit: 'L' };
  return { value: trim(n, n < 10 && n % 1 ? 1 : 0), unit };
}
function trim(n: number, d: number) {
  const s = n.toFixed(d);
  return d > 0 ? s.replace(/\.0+$/, '') : s;
}

/** Forecast every supply of a pet from its logs, plan and portions (shared by screens and reminders). */
export function forecastAll(
  supplies: Supply[],
  events: UseEvent[],
  plan: Partial<Record<CareType, number>>,
  portions: Partial<Record<CareType, number>>,
  purchases: Purchase[],
  now: number,
  portionOf: (type: CareType, portions: Partial<Record<CareType, number>>) => number,
): Forecast[] {
  return sortForecasts(
    supplies.map((s) => {
      const portion = s.link ? portionOf(s.link, portions) : 0;
      const times = s.link ? plan[s.link] ?? 0 : 0;
      const last = lastPurchase(purchases, s.id);
      return forecast(s, { events, now, plan: s.link && times > 0 ? { perDay: times * portion } : null, portion, lastRefill: last ? last.packs * last.packSize : null });
    }),
  );
}
