/** Supplies and their purchases (see domain/supplies.ts for how stock and forecasts work). */
import { Db } from './db';
import { newId } from '../domain/ids';
import type { CareType } from '../domain/care';
import { Purchase, Supply, SupplyKind, SupplyUnit } from '../domain/supplies';
import { ValidationError } from './repo';
import { t } from '../i18n/core';

type Row = {
  id: string;
  pet_id: string;
  kind: string;
  name: string;
  unit: string;
  pack_size: number;
  stock: number;
  stock_at: number;
  link: string | null;
  per_day: number | null;
  lead_days: number;
  price: number | null;
  created_at: number;
};

const toSupply = (r: Row): Supply => ({
  id: r.id,
  petId: r.pet_id,
  kind: r.kind as SupplyKind,
  name: r.name,
  unit: r.unit as SupplyUnit,
  packSize: r.pack_size,
  stock: r.stock,
  stockAt: r.stock_at,
  link: (r.link as CareType | null) ?? null,
  perDay: r.per_day,
  leadDays: r.lead_days,
  price: r.price,
  createdAt: r.created_at,
});

export type SupplyInput = {
  petId: string;
  kind: SupplyKind;
  name: string;
  unit: SupplyUnit;
  packSize: number;
  /** on hand right now */
  stock: number;
  link: CareType | null;
  perDay: number | null;
  leadDays?: number;
  price?: number | null;
};

function validate(i: SupplyInput) {
  const name = i.name.trim();
  if (!name) throw new ValidationError(t('Give it a name.'));
  if (!(i.packSize > 0)) throw new ValidationError(t('How much is in one pack?'));
  if (!(i.stock >= 0)) throw new ValidationError(t('How much is left can’t be negative.'));
  return name;
}

export async function listSupplies(db: Db, petId: string): Promise<Supply[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM supplies WHERE pet_id = ? AND archived_at IS NULL ORDER BY created_at', [petId]);
  return rows.map(toSupply);
}

export async function listAllSupplies(db: Db): Promise<Supply[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM supplies WHERE archived_at IS NULL ORDER BY created_at', []);
  return rows.map(toSupply);
}

export async function getSupply(db: Db, id: string): Promise<Supply | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM supplies WHERE id = ?', [id]);
  return r ? toSupply(r) : null;
}

export async function createSupply(db: Db, i: SupplyInput, now = Date.now()): Promise<Supply> {
  const name = validate(i);
  const id = newId();
  await db.runAsync(
    `INSERT INTO supplies (id, pet_id, kind, name, unit, pack_size, stock, stock_at, link, per_day, lead_days, price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, i.petId, i.kind, name, i.unit, i.packSize, i.stock, now, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, now],
  );
  return (await getSupply(db, id))!;
}

/** Edit the details; passing `stock` also resets what's on hand to that amount as of now. */
export async function updateSupply(db: Db, id: string, i: SupplyInput & { resetStock?: boolean }, now = Date.now()): Promise<void> {
  const name = validate(i);
  if (i.resetStock) {
    await db.runAsync(
      `UPDATE supplies SET kind = ?, name = ?, unit = ?, pack_size = ?, stock = ?, stock_at = ?, link = ?, per_day = ?, lead_days = ?, price = ?, updated_at = ? WHERE id = ?`,
      [i.kind, name, i.unit, i.packSize, i.stock, now, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, id],
    );
  } else {
    await db.runAsync(
      `UPDATE supplies SET kind = ?, name = ?, unit = ?, pack_size = ?, link = ?, per_day = ?, lead_days = ?, price = ?, updated_at = ? WHERE id = ?`,
      [i.kind, name, i.unit, i.packSize, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, id],
    );
  }
}

/** "This is what's left now" (a correction after checking the bag). */
export async function setStock(db: Db, id: string, left: number, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE supplies SET stock = ?, stock_at = ?, updated_at = ? WHERE id = ?', [Math.max(0, left), now, now, id]);
}

/**
 * Bought `packs` packs: what's on hand becomes what was left plus the new packs (the caller passes
 * `leftNow` from the forecast, so use since the last stock date isn't counted twice).
 */
export async function addPurchase(db: Db, supply: Supply, packs: number, leftNow: number, price: number | null, now = Date.now()): Promise<void> {
  if (!(packs > 0)) throw new ValidationError(t('How many did you buy?'));
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO supply_purchases (id, supply_id, at, packs, pack_size, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), supply.id, now, packs, supply.packSize, price, now]);
    await db.runAsync('UPDATE supplies SET stock = ?, stock_at = ?, price = COALESCE(?, price), updated_at = ? WHERE id = ?', [Math.max(0, leftNow) + packs * supply.packSize, now, price, now, supply.id]);
  });
}

export async function listPurchases(db: Db, supplyIds: string[]): Promise<Purchase[]> {
  if (!supplyIds.length) return [];
  const rows = await db.getAllAsync<{ id: string; supply_id: string; at: number; packs: number; pack_size: number; price: number | null }>(
    `SELECT * FROM supply_purchases WHERE supply_id IN (${supplyIds.map(() => '?').join(',')}) ORDER BY at DESC`,
    supplyIds,
  );
  return rows.map((r) => ({ id: r.id, supplyId: r.supply_id, at: r.at, packs: r.packs, packSize: r.pack_size, price: r.price }));
}

export async function archiveSupply(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE supplies SET archived_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}
