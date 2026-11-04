/**
 * Loads the whole household pantry and forecasts it — the one place both the screens and the
 * reminders get their numbers from, so a notification never disagrees with what the app shows.
 */
import { Db } from './db';
import { getPlan, getPortions, listEventsBetween, listPets } from './repo';
import { getDefaults, listAllSupplies, listPurchases } from './suppliesRepo';
import { portionOf } from '../domain/progress';
import { DAY, Defaults, Forecast, Purchase, UseEvent, forecastAll } from '../domain/supplies';

export type Pantry = { forecasts: Forecast[]; purchases: Purchase[]; defaults: Defaults; now: number };

export async function loadPantry(db: Db, now = Date.now()): Promise<Pantry> {
  const supplies = await listAllSupplies(db);
  if (!supplies.length) return { forecasts: [], purchases: [], defaults: await getDefaults(db), now };
  const [pets, defaults, purchases] = await Promise.all([listPets(db), getDefaults(db), listPurchases(db, supplies.map((s) => s.id))]);
  const from = Math.min(now - 31 * DAY, ...supplies.map((s) => s.stockAt));
  const events: UseEvent[] = [];
  const info: Parameters<typeof forecastAll>[2] = {};
  for (const p of pets) {
    const [ev, plan, portions] = await Promise.all([listEventsBetween(db, p.id, from, now + 60_000), getPlan(db, p.id), getPortions(db, p.id)]);
    info[p.id] = { plan, portions };
    for (const e of ev) if (e.type === 'meal' || e.type === 'medication') events.push({ petId: p.id, type: e.type, occurredAt: e.occurredAt, amount: e.amount, supplyId: e.supplyId });
  }
  return { forecasts: forecastAll(supplies, events, info, defaults, purchases, now, portionOf), purchases, defaults, now };
}

/** What one pet sees: its own products and the household's. */
export const forPet = (list: Forecast[], petId: string) => list.filter((f) => f.supply.petId === petId || f.supply.shared || f.petIds.includes(petId));
