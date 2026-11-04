/**
 * The pet pantry: what's on the shelf (food, treats, litter, medicine…), how long it lasts, and when
 * to buy more. Pure — everything is passed in, so it's tested in node.
 *
 * Stock is "what was on hand at `stockAt`" (set by a purchase or a level check). What's on hand now is
 * that minus what was used since:
 *  - Linked products (food ↔ meals, medicine ↔ medication) lose exactly the amounts logged *for that
 *    product*: a log names its product (`supplyId`), and a log that doesn't is counted against the
 *    pet's default product for that care — never against every bag at once.
 *  - When meals stop being logged, the days without logs are estimated at the learned/planned rate,
 *    and the forecast says so ("estimated") instead of pretending the bag is still full.
 *  - Other products follow a daily rate ("a pack lasts about 3 weeks").
 * Household items (`shared`) can be used by several pets: a shared food is reduced by every pet whose
 * default it is.
 */
import type { CareType } from './care';

export type SupplyKind =
  | 'food'
  | 'wet'
  | 'treats'
  | 'supplements'
  | 'medicine'
  | 'grooming'
  | 'litter'
  | 'bags'
  | 'toys'
  | 'walk'
  | 'comfort'
  | 'tools'
  | 'other';
export type SupplyUnit = 'g' | 'dose' | 'pcs' | 'L';

export type Supply = {
  id: string;
  /** the pet it was added for (household items still keep the pet that added them) */
  petId: string;
  /** used by the whole household */
  shared: boolean;
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
  /** use per day (base units) for products that aren't linked to logs */
  perDay: number | null;
  /** remind this many days before it runs out */
  leadDays: number;
  /** price of one pack (owner's currency), if entered */
  price: number | null;
  createdAt: number;
};

export type Purchase = { id: string; supplyId: string; at: number; packs: number; packSize: number; price: number | null; prevStock?: number | null; prevStockAt?: number | null };

export type UseEvent = { petId: string; type: CareType; occurredAt: number; amount?: number | null; supplyId?: string | null };

/** pet → care type → the product used when a log doesn't name one */
export type Defaults = Record<string, Partial<Record<CareType, string>>>;

export type RateSource = 'logs' | 'plan' | 'manual' | 'none';
/** how much to trust "what's left": logged use, a gap filled with an estimate, a manual rate */
export type Confidence = 'tracked' | 'estimated' | 'manual' | 'unknown';
export type SupplyStatus = 'out' | 'buy' | 'soon' | 'ok' | 'unknown';

export type Forecast = {
  supply: Supply;
  /** base units on hand now */
  left: number;
  /** base units per day used for the forecast */
  perDay: number;
  source: RateSource;
  confidence: Confidence;
  /** days with no logs for a linked product, filled with an estimate */
  gapDays: number;
  /** last log that used this product */
  lastUseAt: number | null;
  /** days of supply left (Infinity when nothing uses it) */
  daysLeft: number;
  runOutAt: number | null;
  /** last good day to buy so it never runs out (run-out minus lead time) */
  buyBy: number | null;
  status: SupplyStatus;
  /** 0..1 of the last refill (or one pack) still there, for the bar */
  level: number;
  /** pets that use it (for "Honey & Tabby") */
  petIds: string[];
};

export const DAY = 86_400_000;
const LEARN_DAYS = 14;
const MIN_LOG_DAYS = 4;
/** a day and a half without a log before the gap is estimated (meals are logged daily or not at all) */
const GAP_GRACE = 1.5 * DAY;

/** Does this log use up this product? */
export function consumes(s: Supply, e: UseEvent, defaults: Defaults): boolean {
  if (!s.link || e.type !== s.link) return false;
  if (e.supplyId) return e.supplyId === s.id;
  if (!s.shared && e.petId !== s.petId) return false;
  return defaults[e.petId]?.[s.link] === s.id;
}

/** pets whose unnamed logs go to this product (or the owner pet for unlinked items) */
export function usersOf(s: Supply, defaults: Defaults): string[] {
  if (!s.link) return [s.petId];
  const ids = Object.entries(defaults)
    .filter(([, d]) => d[s.link!] === s.id)
    .map(([pid]) => pid);
  return ids.length ? ids : [s.petId];
}

type Ctx = {
  events: UseEvent[];
  now: number;
  defaults: Defaults;
  /** planned use per day (times × portion, summed over the pets using it), for linked products */
  planPerDay: number;
  /** grams/doses for a log without an amount */
  portionFor: (e: UseEvent) => number;
  lastRefill?: number | null;
};

const amountOf = (e: UseEvent, ctx: Ctx) => (e.amount != null && e.amount > 0 ? e.amount : ctx.portionFor(e));

/** How fast it goes: real use from the last two weeks of logs, else the plan, else the manual rate. */
export function dailyRate(s: Supply, ctx: Ctx): { perDay: number; source: RateSource } {
  const { now } = ctx;
  if (s.link) {
    const from = now - LEARN_DAYS * DAY;
    const used = ctx.events.filter((e) => e.occurredAt > from && e.occurredAt <= now && consumes(s, e, ctx.defaults));
    const days = new Set(used.map((e) => Math.floor((e.occurredAt - from) / DAY))).size;
    if (days >= MIN_LOG_DAYS) {
      // averaged over the days that had logs: a missed day of logging isn't a day of not eating
      return { perDay: used.reduce((a, e) => a + amountOf(e, ctx), 0) / days, source: 'logs' };
    }
    if (ctx.planPerDay > 0) return { perDay: ctx.planPerDay, source: 'plan' };
  }
  if (s.perDay && s.perDay > 0) return { perDay: s.perDay, source: 'manual' };
  return { perDay: 0, source: 'none' };
}

export function forecast(s: Supply, ctx: Ctx): Forecast {
  const { now } = ctx;
  const { perDay, source } = dailyRate(s, ctx);
  let used = 0;
  let gapDays = 0;
  let lastUseAt: number | null = null;
  let confidence: Confidence;
  if (s.link) {
    const since = ctx.events.filter((e) => e.occurredAt > s.stockAt && e.occurredAt <= now && consumes(s, e, ctx.defaults));
    used = since.reduce((a, e) => a + amountOf(e, ctx), 0);
    const all = ctx.events.filter((e) => e.occurredAt <= now && consumes(s, e, ctx.defaults));
    lastUseAt = all.length ? Math.max(...all.map((e) => e.occurredAt)) : null;
    // nothing logged for a while: count those days at the usual rate rather than assume a full bag
    const quietSince = Math.max(lastUseAt ?? 0, s.stockAt);
    const quiet = now - quietSince - GAP_GRACE;
    if (quiet > 0 && perDay > 0) {
      gapDays = quiet / DAY;
      used += gapDays * perDay;
    }
    confidence = source === 'none' ? 'unknown' : gapDays > 0 ? 'estimated' : 'tracked';
  } else {
    used = s.perDay ? (s.perDay * Math.max(0, now - s.stockAt)) / DAY : 0;
    confidence = source === 'none' ? 'unknown' : 'manual';
  }
  const left = Math.max(0, s.stock - used);
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
  return { supply: s, left, perDay, source, confidence, gapDays, lastUseAt, daysLeft, runOutAt, buyBy, status, level: full > 0 ? Math.min(1, left / full) : 0, petIds: usersOf(s, ctx.defaults) };
}

const ORDER: Record<SupplyStatus, number> = { out: 0, buy: 1, soon: 2, unknown: 3, ok: 4 };
export function sortForecasts(list: Forecast[]): Forecast[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.daysLeft - b.daysLeft || a.supply.createdAt - b.supply.createdAt);
}

/**
 * What to buy: anything that runs out within the lead time + `horizonDays`, with enough packs to keep
 * `bufferDays` of stock after the order arrives.
 */
export function shoppingList(list: Forecast[], now: number, bufferDays = 14, horizonDays = 7): { f: Forecast; packs: number }[] {
  return sortForecasts(list)
    .filter((f) => f.status === 'out' || f.status === 'buy' || (f.buyBy != null && f.buyBy <= now + horizonDays * DAY))
    .map((f) => {
      const need = f.perDay * (bufferDays + f.supply.leadDays) - f.left;
      return { f, packs: Math.max(1, Math.ceil(need / Math.max(1e-9, f.supply.packSize))) };
    });
}

/** Rough cost per month from the pack price and the use rate (null without a price). */
export function monthlyCost(f: Forecast): number | null {
  if (f.supply.price == null || f.supply.packSize <= 0 || f.perDay <= 0) return null;
  return (f.supply.price / f.supply.packSize) * f.perDay * 30;
}

/** "Same as last time": the most recent purchase. */
export function lastPurchase(purchases: Purchase[], supplyId: string): Purchase | null {
  return purchases.filter((p) => p.supplyId === supplyId).sort((a, b) => b.at - a.at)[0] ?? null;
}

/** A pack lasts about `days`: the manual daily rate. */
export const perDayFromLasting = (packSize: number, days: number) => (days > 0 ? packSize / days : null);

/** Display an amount in its unit: grams become kg from 1000. */
export function formatQty(n: number, unit: SupplyUnit): { value: string; unit: string } {
  if (unit === 'g') return n >= 1000 ? { value: trim(n / 1000, n >= 100_000 ? 0 : 1), unit: 'kg' } : { value: String(Math.round(n)), unit: 'g' };
  if (unit === 'L') return { value: trim(n, 1), unit: 'L' };
  return { value: trim(n, n < 10 && n % 1 ? 1 : 0), unit };
}
function trim(n: number, d: number) {
  const s = n.toFixed(d);
  return d > 0 ? s.replace(/\.0+$/, '') : s;
}

/**
 * Forecast every product a pet (or the household) uses.
 * `pets` gives each pet's plan and portions (for planned rates and logs without an amount).
 */
export function forecastAll(
  supplies: Supply[],
  events: UseEvent[],
  pets: Record<string, { plan: Partial<Record<CareType, number>>; portions: Partial<Record<CareType, number>> }>,
  defaults: Defaults,
  purchases: Purchase[],
  now: number,
  portionOf: (type: CareType, portions: Partial<Record<CareType, number>>) => number,
): Forecast[] {
  return sortForecasts(
    supplies.map((s) => {
      const users = usersOf(s, defaults);
      const planPerDay = s.link ? users.reduce((a, pid) => a + (pets[pid]?.plan[s.link!] ?? 0) * portionOf(s.link!, pets[pid]?.portions ?? {}), 0) : 0;
      const last = lastPurchase(purchases, s.id);
      return forecast(s, {
        events,
        now,
        defaults,
        planPerDay,
        portionFor: (e) => portionOf(e.type, pets[e.petId]?.portions ?? {}),
        lastRefill: last ? last.packs * last.packSize : null,
      });
    }),
  );
}

/**
 * When to remind about a product. One reminder on the buy-by day (10:00) and a last call on the
 * run-out day (9:00); once both have passed and it still isn't restocked, a gentle reminder every
 * three days at 10:00. Same ids every time, so re-planning never duplicates them.
 */
export function restockReminders(f: Forecast, now: number): { id: string; at: number; kind: 'buy' | 'last' | 'overdue' }[] {
  if (f.buyBy == null || f.runOutAt == null) return [];
  const at = (ms: number, h: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).getTime();
  };
  const out: { id: string; at: number; kind: 'buy' | 'last' | 'overdue' }[] = [];
  const buyAt = at(f.buyBy, 10);
  const lastAt = at(f.runOutAt, 9);
  if (buyAt > now && buyAt - now < 21 * DAY) out.push({ id: `pv:sup:${f.supply.id}`, at: buyAt, kind: 'buy' });
  if (lastAt > now && lastAt > buyAt + DAY && lastAt - now < 21 * DAY) out.push({ id: `pv:supx:${f.supply.id}`, at: lastAt, kind: 'last' });
  if (!out.length && (f.status === 'buy' || f.status === 'out')) {
    // overdue: the next 10:00 that falls on a 3-day step from the buy-by day
    const start = at(f.buyBy, 10);
    let k = Math.max(1, Math.ceil((now - start) / (3 * DAY)));
    let next = start + k * 3 * DAY;
    // DST shifts the hour by one at most; snap back to 10:00
    next = at(next, 10);
    while (next <= now) next = at(start + ++k * 3 * DAY, 10);
    out.push({ id: `pv:supo:${f.supply.id}`, at: next, kind: 'overdue' });
  }
  return out;
}
