import { describe, expect, it } from 'vitest';
import { DAY, Supply, dailyRate, forecast, formatQty, monthlyCost, shoppingList, usedSince } from '../src/domain/supplies';

const now = Date.UTC(2026, 10, 4, 12);
const food: Supply = { id: 's1', petId: 'p', kind: 'food', name: 'Kibble', unit: 'g', packSize: 12000, stock: 12000, stockAt: now - 10 * DAY, link: 'meal', perDay: null, leadDays: 2, price: 54, createdAt: now - 10 * DAY };
const meals = (days: number, grams: number, perDay = 2) =>
  Array.from({ length: days * perDay }, (_, i) => ({ type: 'meal' as const, occurredAt: now - (Math.floor(i / perDay) + 0.5) * DAY, amount: grams }));

describe('supplies', () => {
  it('subtracts the meals actually logged since the stock was set', () => {
    expect(usedSince(food, meals(10, 100), now, 100)).toBe(2000);
    // logs before the purchase don't count
    expect(usedSince({ ...food, stockAt: now - 3 * DAY }, meals(10, 100), now, 100)).toBe(600);
  });

  it('learns the real daily use from the logs once there are enough days', () => {
    expect(dailyRate(food, meals(10, 110), now, { perDay: 200 }, 100)).toEqual({ perDay: 220, source: 'logs' });
    // too few days of logs: the plan
    expect(dailyRate(food, meals(2, 110), now, { perDay: 200 }, 100)).toEqual({ perDay: 200, source: 'plan' });
    // nothing at all
    expect(dailyRate({ ...food, link: null }, [], now, null, 100).source).toBe('none');
  });

  it('forecasts the run-out and buy-by dates and the status', () => {
    const f = forecast(food, { events: meals(10, 100), now, plan: { perDay: 200 }, portion: 100 });
    expect(f.left).toBe(10000);
    expect(f.perDay).toBe(200);
    expect(f.daysLeft).toBe(50);
    expect(f.status).toBe('ok');
    const low = forecast({ ...food, stock: 2500 }, { events: meals(10, 100), now, plan: null, portion: 100 });
    expect(low.daysLeft).toBeCloseTo(2.5);
    expect(low.status).toBe('buy');
    const out = forecast({ ...food, stock: 1500 }, { events: meals(10, 100), now, plan: null, portion: 100 });
    expect(out.status).toBe('out');
  });

  it('manual supplies use their daily rate', () => {
    const litter: Supply = { ...food, id: 's2', kind: 'litter', unit: 'L', packSize: 10, stock: 10, stockAt: now - 7 * DAY, link: null, perDay: 10 / 21 };
    const f = forecast(litter, { events: [], now, plan: null, portion: 0 });
    expect(f.left).toBeCloseTo(10 - 70 / 21);
    expect(f.daysLeft).toBeCloseTo(14);
    expect(f.status).toBe('ok');
  });

  it('builds a shopping list with packs for about a month', () => {
    const low = forecast({ ...food, stock: 3000 }, { events: meals(10, 100), now, plan: null, portion: 100 });
    const ok = forecast(food, { events: meals(10, 100), now, plan: null, portion: 100 });
    const list = shoppingList([ok, low], now);
    expect(list).toHaveLength(1);
    expect(list[0].f.supply.stock).toBe(3000);
    expect(list[0].packs).toBe(1);
  });

  it('estimates the monthly cost and formats amounts', () => {
    const f = forecast(food, { events: meals(10, 100), now, plan: null, portion: 100 });
    expect(monthlyCost(f)).toBeCloseTo(27);
    expect(formatQty(12000, 'g')).toEqual({ value: '12', unit: 'kg' });
    expect(formatQty(2500, 'g')).toEqual({ value: '2.5', unit: 'kg' });
    expect(formatQty(450, 'g')).toEqual({ value: '450', unit: 'g' });
    expect(formatQty(7.5, 'dose')).toEqual({ value: '7.5', unit: 'dose' });
  });
});

import { migrate } from '../src/data/migrations';
import { createPet } from '../src/data/repo';
import { addPurchase, createSupply, listPurchases, listSupplies, setStock } from '../src/data/suppliesRepo';
import { dumpSnapshot } from '../src/data/snapshot';
import { openNodeDb } from './helpers/nodeDb';

describe('supplies repo', () => {
  it('creates, restocks, corrects and backs up supplies', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const pet = await createPet(db, { species: 'dog', name: 'Honey' });
    const s = await createSupply(db, { petId: pet.id, kind: 'food', name: 'Kibble', unit: 'g', packSize: 12000, stock: 3000, link: 'meal', perDay: null, price: 54 }, now);
    expect((await listSupplies(db, pet.id)).map((x) => x.name)).toEqual(['Kibble']);
    await addPurchase(db, s, 1, 2000, 52, now + DAY);
    const [after] = await listSupplies(db, pet.id);
    expect(after.stock).toBe(14000);
    expect(after.stockAt).toBe(now + DAY);
    expect(after.price).toBe(52);
    expect((await listPurchases(db, [s.id]))[0].packs).toBe(1);
    await setStock(db, s.id, 9000, now + 2 * DAY);
    expect((await listSupplies(db, pet.id))[0].stock).toBe(9000);
    const snap = await dumpSnapshot(db);
    expect(snap.tables.supplies).toHaveLength(1);
    expect(snap.tables.supply_purchases).toHaveLength(1);
  });
});
