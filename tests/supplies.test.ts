import { describe, expect, it } from 'vitest';
import { DAY, Defaults, Supply, UseEvent, consumes, dailyRate, forecast, forecastAll, formatQty, monthlyCost, restockReminders, shoppingList } from '../src/domain/supplies';

import { migrate } from '../src/data/migrations';
import { createPet, logCare } from '../src/data/repo';
import {
  addPurchase,
  addShoppingItem,
  createSupply,
  getDefaults,
  listPurchases,
  listShoppingItems,
  listSupplies,
  setDefault,
  setStock,
  toggleShoppingItem,
  undoPurchase,
} from '../src/data/suppliesRepo';
import { dumpSnapshot } from '../src/data/snapshot';
import { openNodeDb } from './helpers/nodeDb';

const now = new Date(2026, 10, 4, 12).getTime();
const food: Supply = { id: 's1', petId: 'p', shared: false, kind: 'food', name: 'Kibble', unit: 'g', packSize: 12000, stock: 12000, stockAt: now - 10 * DAY, link: 'meal', perDay: null, leadDays: 2, price: 54, createdAt: now - 10 * DAY };
const meals = (days: number, grams: number, opts: { perDay?: number; petId?: string; supplyId?: string | null } = {}): UseEvent[] => {
  const perDay = opts.perDay ?? 2;
  return Array.from({ length: days * perDay }, (_, i) => ({ petId: opts.petId ?? 'p', type: 'meal' as const, occurredAt: now - (Math.floor(i / perDay) + 0.5) * DAY, amount: grams, supplyId: opts.supplyId ?? null }));
};
const defaults: Defaults = { p: { meal: 's1' } };
const ctx = (events: UseEvent[], over: Partial<Parameters<typeof forecast>[1]> = {}) => ({ events, now, defaults, planPerDay: 0, portionFor: () => 100, ...over });

describe('supplies: what is left', () => {
  it('subtracts the meals actually logged since the stock was set', () => {
    expect(forecast(food, ctx(meals(10, 100))).left).toBe(10000);
    // logs before the purchase don't count
    expect(forecast({ ...food, stockAt: now - 3 * DAY }, ctx(meals(10, 100))).left).toBe(11400);
  });

  it('one logged meal does not reduce every food product', () => {
    const second: Supply = { ...food, id: 's2', name: 'Puppy kibble', createdAt: food.createdAt + 1 };
    const wet: Supply = { ...food, id: 's3', kind: 'wet', name: 'Wet tins', unit: 'g', packSize: 2400, stock: 2400 };
    const events = meals(10, 100);
    const [a, b, c] = [food, second, wet].map((s) => forecast(s, ctx(events)));
    expect(a.left).toBe(10000);
    // not the default and no log named them: untouched
    expect(b.left).toBe(12000);
    expect(c.left).toBe(2400);
    // a log that names a product goes to that product only
    const named: UseEvent = { petId: 'p', type: 'meal', occurredAt: now - 1000, amount: 80, supplyId: 's3' };
    expect(forecast(wet, ctx([...events, named])).left).toBe(2320);
    expect(forecast(food, ctx([...events, named])).left).toBe(10000);
  });

  it('only counts logs of the linked care type and the right pet', () => {
    const other: UseEvent = { petId: 'q', type: 'meal', occurredAt: now - 1000, amount: 500, supplyId: null };
    const walk: UseEvent = { petId: 'p', type: 'walk', occurredAt: now - 1000, amount: 30, supplyId: null };
    expect(consumes(food, other, defaults)).toBe(false);
    expect(consumes(food, walk, defaults)).toBe(false);
  });

  it('a shared food is used by every pet whose default it is', () => {
    const shared: Supply = { ...food, shared: true };
    const d: Defaults = { p: { meal: 's1' }, q: { meal: 's1' } };
    const both = [...meals(10, 100), ...meals(10, 50, { petId: 'q' })];
    const f = forecast(shared, { ...ctx(both), defaults: d });
    expect(f.left).toBe(12000 - 2000 - 1000);
    expect(f.perDay).toBe(300);
    expect(f.petIds.sort()).toEqual(['p', 'q']);
    // a pet that isn't using it doesn't count
    expect(forecast(shared, { ...ctx(both), defaults: { p: { meal: 's1' } } }).left).toBe(10000);
  });

  it('learns the real daily use from the logs once there are enough days', () => {
    expect(dailyRate(food, ctx(meals(10, 110), { planPerDay: 200 }))).toEqual({ perDay: 220, source: 'logs' });
    expect(dailyRate(food, ctx(meals(2, 110), { planPerDay: 200 }))).toEqual({ perDay: 200, source: 'plan' });
    expect(dailyRate({ ...food, link: null }, ctx([])).source).toBe('none');
  });

  it('fills days without logs with an estimate instead of a full bag', () => {
    // meals logged until 6 days ago, then nothing
    const events = meals(10, 100).filter((e) => e.occurredAt < now - 6 * DAY);
    const f = forecast(food, ctx(events, { planPerDay: 200 }));
    expect(f.confidence).toBe('estimated');
    expect(f.gapDays).toBeGreaterThan(4);
    expect(f.left).toBeLessThan(12000 - 800);
    // logged up to today: tracked
    expect(forecast(food, ctx(meals(10, 100))).confidence).toBe('tracked');
  });
});

describe('supplies: forecasts', () => {
  it('forecasts the run-out and buy-by dates and the status', () => {
    const f = forecast(food, ctx(meals(10, 100)));
    expect(f.perDay).toBe(200);
    expect(f.daysLeft).toBe(50);
    expect(f.status).toBe('ok');
    const low = forecast({ ...food, stock: 2500 }, ctx(meals(10, 100)));
    expect(low.daysLeft).toBeCloseTo(2.5);
    expect(low.status).toBe('buy');
    expect(forecast({ ...food, stock: 1500 }, ctx(meals(10, 100))).status).toBe('out');
  });

  it('manual supplies use their daily rate', () => {
    const litter: Supply = { ...food, id: 's2', kind: 'litter', unit: 'L', packSize: 10, stock: 10, stockAt: now - 7 * DAY, link: null, perDay: 10 / 21 };
    const f = forecast(litter, ctx([]));
    expect(f.left).toBeCloseTo(10 - 70 / 21);
    expect(f.daysLeft).toBeCloseTo(14);
    expect(f.confidence).toBe('manual');
  });

  it('forecastAll sums the plan of every pet using a shared product', () => {
    const shared: Supply = { ...food, shared: true, stockAt: now };
    const pets = { p: { plan: { meal: 2 }, portions: {} }, q: { plan: { meal: 3 }, portions: {} } };
    const [f] = forecastAll([shared], [], pets, { p: { meal: 's1' }, q: { meal: 's1' } }, [], now, () => 100);
    expect(f.perDay).toBe(500);
    expect(f.source).toBe('plan');
  });

  it('shopping list buys enough to keep the chosen buffer', () => {
    const low = forecast({ ...food, stock: 3000, packSize: 2000 }, ctx(meals(10, 100)));
    const ok = forecast(food, ctx(meals(10, 100)));
    // 200 g/day; 2 weeks + 2 days lead = 3200 g, 1000 g left → 2200 g → 2 packs of 2 kg
    const list = shoppingList([ok, low], now, 14);
    expect(list).toHaveLength(1);
    expect(list[0].packs).toBe(2);
    // a month's buffer
    expect(shoppingList([low], now, 30)[0].packs).toBe(3);
  });

  it('estimates the monthly cost and formats amounts', () => {
    expect(monthlyCost(forecast(food, ctx(meals(10, 100))))).toBeCloseTo(27);
    expect(formatQty(12000, 'g')).toEqual({ value: '12', unit: 'kg' });
    expect(formatQty(2500, 'g')).toEqual({ value: '2.5', unit: 'kg' });
    expect(formatQty(450, 'g')).toEqual({ value: '450', unit: 'g' });
    expect(formatQty(7.5, 'dose')).toEqual({ value: '7.5', unit: 'dose' });
  });
});

describe('supplies: reminders', () => {
  it('reminds on the buy-by day and on the run-out day', () => {
    const f = forecast({ ...food, stock: 4000 }, ctx(meals(10, 100)));
    const r = restockReminders(f, now);
    expect(r.map((x) => x.kind)).toEqual(['buy', 'last']);
    expect(new Date(r[0].at).getHours()).toBe(10);
    expect(new Date(r[1].at).getHours()).toBe(9);
  });

  it('keeps reminding every three days while it is overdue, with stable ids', () => {
    const f = forecast({ ...food, stock: 1000 }, ctx(meals(10, 100)));
    expect(f.status).toBe('out');
    const r = restockReminders(f, now);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('overdue');
    expect(r[0].at).toBeGreaterThan(now);
    expect(r[0].at - now).toBeLessThanOrEqual(3 * DAY + 3_600_000);
    expect(restockReminders(f, now + 60_000)[0].id).toBe(r[0].id);
  });

  it('nothing to remind when nothing uses it', () => {
    expect(restockReminders(forecast({ ...food, link: null }, ctx([])), now)).toEqual([]);
  });
});

describe('supplies repo', () => {
  it('creates, restocks, undoes, corrects and backs up supplies', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const pet = await createPet(db, { species: 'dog', name: 'Honey' });
    const s = await createSupply(db, { petId: pet.id, kind: 'food', name: 'Kibble', unit: 'g', packSize: 12000, stock: 3000, link: 'meal', perDay: null, price: 54 }, now);
    expect((await listSupplies(db, pet.id)).map((x) => x.name)).toEqual(['Kibble']);
    // the first food becomes where meal logs go
    expect((await getDefaults(db))[pet.id]?.meal).toBe(s.id);
    const pid = await addPurchase(db, s, 1, 2000, 52, now + DAY);
    const [after] = await listSupplies(db, pet.id);
    expect(after.stock).toBe(14000);
    expect(after.stockAt).toBe(now + DAY);
    expect(after.price).toBe(52);
    expect((await listPurchases(db, [s.id]))[0].packs).toBe(1);
    // undo puts it back exactly
    expect(await undoPurchase(db, pid, now + DAY + 5000)).toBe(true);
    const [back] = await listSupplies(db, pet.id);
    expect(back.stock).toBe(3000);
    expect(back.stockAt).toBe(now);
    expect(await listPurchases(db, [s.id])).toHaveLength(0);
    await setStock(db, s.id, 9000, now + 2 * DAY);
    expect((await listSupplies(db, pet.id))[0].stock).toBe(9000);
    const snap = await dumpSnapshot(db);
    expect(snap.tables.supplies).toHaveLength(1);
    expect(snap.tables.supply_defaults).toHaveLength(1);
  });

  it('household items show for every pet; logs remember their product', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const honey = await createPet(db, { species: 'dog', name: 'Honey' });
    const tabby = await createPet(db, { species: 'cat', name: 'Tabby' });
    const bags = await createSupply(db, { petId: honey.id, shared: true, kind: 'bags', name: 'Bags', unit: 'pcs', packSize: 120, stock: 120, link: null, perDay: 2 }, now);
    const kib = await createSupply(db, { petId: honey.id, kind: 'food', name: 'Kibble', unit: 'g', packSize: 12000, stock: 12000, link: 'meal', perDay: null }, now);
    const wet = await createSupply(db, { petId: honey.id, kind: 'wet', name: 'Wet', unit: 'g', packSize: 2400, stock: 2400, link: 'meal', perDay: null }, now);
    expect((await listSupplies(db, tabby.id)).map((x) => x.id)).toEqual([bags.id]);
    expect((await getDefaults(db))[honey.id]?.meal).toBe(kib.id);
    await setDefault(db, honey.id, 'meal', wet.id);
    expect((await getDefaults(db))[honey.id]?.meal).toBe(wet.id);
    const e = await logCare(db, { petId: honey.id, type: "meal", amount: 90, supplyId: kib.id, occurredAt: Date.now() - 1000, mutationId: "m1" });
    expect(e.supplyId).toBe(kib.id);
  });

  it('keeps a hand-written shopping list', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const id = await addShoppingItem(db, '  New ball ', null, now);
    expect((await listShoppingItems(db, now)).map((x) => x.name)).toEqual(['New ball']);
    await toggleShoppingItem(db, id, true, now);
    expect((await listShoppingItems(db, now + 1000))[0].doneAt).toBe(now);
    // ticked items drop off later
    expect(await listShoppingItems(db, now + DAY)).toHaveLength(0);
  });
});

describe('supplies repo: removing a product', () => {
  it('moves the pet to its next food so meals keep counting', async () => {
    const { archiveSupply } = await import('../src/data/suppliesRepo');
    const db = openNodeDb(':memory:');
    await migrate(db);
    const pet = await createPet(db, { species: 'dog', name: 'Honey' });
    const a = await createSupply(db, { petId: pet.id, kind: 'food', name: 'A', unit: 'g', packSize: 1000, stock: 1000, link: 'meal', perDay: null }, now);
    const b = await createSupply(db, { petId: pet.id, kind: 'food', name: 'B', unit: 'g', packSize: 1000, stock: 1000, link: 'meal', perDay: null }, now + 1);
    await archiveSupply(db, a.id, now + 2);
    expect((await getDefaults(db))[pet.id]?.meal).toBe(b.id);
  });
});
