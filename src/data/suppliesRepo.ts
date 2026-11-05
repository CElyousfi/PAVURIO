/** Supplies and their purchases (see domain/supplies.ts for how stock and forecasts work). */
import { Db } from './db';
import { newId } from '../domain/ids';
import type { CareType } from '../domain/care';
import { Defaults, Purchase, Supply, SupplyKind, SupplyUnit } from '../domain/supplies';
import { ValidationError } from './repo';
import { t } from '../i18n/core';

type Row = {
  id: string;
  pet_id: string;
  shared?: number | null;
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
  shared: !!r.shared,
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
  /** used by the whole household */
  shared?: boolean;
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

/** What this pet uses: its own items plus the household's. */
export async function listSupplies(db: Db, petId: string): Promise<Supply[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM supplies WHERE (pet_id = ? OR shared = 1) AND archived_at IS NULL ORDER BY created_at', [petId]);
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
    `INSERT INTO supplies (id, pet_id, shared, kind, name, unit, pack_size, stock, stock_at, link, per_day, lead_days, price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, i.petId, i.shared ? 1 : 0, i.kind, name, i.unit, i.packSize, i.stock, now, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, now],
  );
  // the first food (or medicine) a pet has is where its meal (medication) logs go
  if (i.link) await db.runAsync('INSERT OR IGNORE INTO supply_defaults (pet_id, link, supply_id) VALUES (?, ?, ?)', [i.petId, i.link, id]);
  return (await getSupply(db, id))!;
}

/** Edit the details; passing `stock` also resets what's on hand to that amount as of now. */
export async function updateSupply(db: Db, id: string, i: SupplyInput & { resetStock?: boolean }, now = Date.now()): Promise<void> {
  const name = validate(i);
  if (i.resetStock) {
    await db.runAsync(
      `UPDATE supplies SET shared = ?, kind = ?, name = ?, unit = ?, pack_size = ?, stock = ?, stock_at = ?, link = ?, per_day = ?, lead_days = ?, price = ?, updated_at = ? WHERE id = ?`,
      [i.shared ? 1 : 0, i.kind, name, i.unit, i.packSize, i.stock, now, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, id],
    );
  } else {
    await db.runAsync(
      `UPDATE supplies SET shared = ?, kind = ?, name = ?, unit = ?, pack_size = ?, link = ?, per_day = ?, lead_days = ?, price = ?, updated_at = ? WHERE id = ?`,
      [i.shared ? 1 : 0, i.kind, name, i.unit, i.packSize, i.link, i.perDay, i.leadDays ?? 2, i.price ?? null, now, id],
    );
  }
}

/** "This is what's left now" (a correction after checking the bag). */
export async function setStock(db: Db, id: string, left: number, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE supplies SET stock = ?, stock_at = ?, updated_at = ? WHERE id = ?', [Math.max(0, left), now, now, id]);
}

/**
 * Bought `packs` packs: what's on hand becomes what was left plus the new packs (the caller passes
 * `leftNow` from the forecast, so use since the last stock date isn't counted twice). The previous
 * stock is kept on the purchase so "Undo" puts everything back exactly. `at` is when it was bought
 * (today, yesterday…) — it's the purchase history, the stock is counted from now.
 */
export async function addPurchase(
  db: Db,
  supply: Supply,
  packs: number,
  leftNow: number,
  price: number | null,
  now = Date.now(),
  at = now,
): Promise<string> {
  if (!(packs > 0)) throw new ValidationError(t('How many did you buy?'));
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO supply_purchases (id, supply_id, at, packs, pack_size, price, prev_stock, prev_stock_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, supply.id, Math.min(at, now), packs, supply.packSize, price, supply.stock, supply.stockAt, now],
    );
    await db.runAsync('UPDATE supplies SET stock = ?, stock_at = ?, price = COALESCE(?, price), updated_at = ? WHERE id = ?', [Math.max(0, leftNow) + packs * supply.packSize, now, price, now, supply.id]);
  });
  return id;
}

/** Take back a purchase (tapped by mistake, tapped twice): stock goes back to what it was before. */
export async function undoPurchase(db: Db, purchaseId: string, now = Date.now()): Promise<boolean> {
  const p = await db.getFirstAsync<{ supply_id: string; prev_stock: number | null; prev_stock_at: number | null; packs: number; pack_size: number }>(
    'SELECT supply_id, prev_stock, prev_stock_at, packs, pack_size FROM supply_purchases WHERE id = ?',
    [purchaseId],
  );
  if (!p) return false;
  await db.withTransactionAsync(async () => {
    if (p.prev_stock != null && p.prev_stock_at != null) {
      await db.runAsync('UPDATE supplies SET stock = ?, stock_at = ?, updated_at = ? WHERE id = ?', [p.prev_stock, p.prev_stock_at, now, p.supply_id]);
    } else {
      // purchases from before undo existed: take the packs back off
      await db.runAsync('UPDATE supplies SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?', [p.packs * p.pack_size, now, p.supply_id]);
    }
    await db.runAsync('DELETE FROM supply_purchases WHERE id = ?', [purchaseId]);
  });
  return true;
}

export async function listPurchases(db: Db, supplyIds: string[]): Promise<Purchase[]> {
  if (!supplyIds.length) return [];
  const rows = await db.getAllAsync<{ id: string; supply_id: string; at: number; packs: number; pack_size: number; price: number | null; prev_stock: number | null; prev_stock_at: number | null }>(
    `SELECT * FROM supply_purchases WHERE supply_id IN (${supplyIds.map(() => '?').join(',')}) ORDER BY at DESC`,
    supplyIds,
  );
  return rows.map((r) => ({ id: r.id, supplyId: r.supply_id, at: r.at, packs: r.packs, packSize: r.pack_size, price: r.price, prevStock: r.prev_stock, prevStockAt: r.prev_stock_at }));
}

/** Which product each pet's meal / medication logs use when the log doesn't say. */
export async function getDefaults(db: Db): Promise<Defaults> {
  const rows = await db.getAllAsync<{ pet_id: string; link: string; supply_id: string }>(
    'SELECT d.pet_id, d.link, d.supply_id FROM supply_defaults d JOIN supplies s ON s.id = d.supply_id WHERE s.archived_at IS NULL',
    [],
  );
  const out: Defaults = {};
  for (const r of rows) (out[r.pet_id] ??= {})[r.link as CareType] = r.supply_id;
  return out;
}

export async function setDefault(db: Db, petId: string, link: CareType, supplyId: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO supply_defaults (pet_id, link, supply_id) VALUES (?, ?, ?)', [petId, link, supplyId]);
}

/** Linked products a pet can log against (its own + household), for the log card's picker. */
export async function productsFor(db: Db, petId: string, link: CareType): Promise<Supply[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM supplies WHERE (pet_id = ? OR shared = 1) AND link = ? AND archived_at IS NULL ORDER BY created_at', [petId, link]);
  return rows.map(toSupply);
}

/* Shopping list extras: things to pick up that aren't tracked (a new toy, poop bags for the trip). */
export type ShoppingItem = { id: string; petId: string | null; name: string; doneAt: number | null; createdAt: number };

export async function listShoppingItems(db: Db, now = Date.now()): Promise<ShoppingItem[]> {
  // ticked items stay visible for the rest of the day, then drop off
  const rows = await db.getAllAsync<{ id: string; pet_id: string | null; name: string; done_at: number | null; created_at: number }>(
    'SELECT * FROM shopping_items WHERE done_at IS NULL OR done_at > ? ORDER BY created_at',
    [now - 12 * 3_600_000],
  );
  return rows.map((r) => ({ id: r.id, petId: r.pet_id, name: r.name, doneAt: r.done_at, createdAt: r.created_at }));
}

export async function addShoppingItem(db: Db, name: string, petId: string | null, now = Date.now()): Promise<string> {
  const n = name.trim();
  if (!n) throw new ValidationError(t('Give it a name.'));
  const id = newId();
  await db.runAsync('INSERT INTO shopping_items (id, pet_id, name, done_at, created_at) VALUES (?, ?, ?, NULL, ?)', [id, petId, n, now]);
  return id;
}

export async function toggleShoppingItem(db: Db, id: string, done: boolean, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE shopping_items SET done_at = ? WHERE id = ?', [done ? now : null, id]);
}

export async function deleteShoppingItem(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [id]);
}

export async function archiveSupply(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE supplies SET archived_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    // pets whose logs went to it move on to their next product of the same kind of care (if any)
    const moved = await db.getAllAsync<{ pet_id: string; link: string }>('SELECT pet_id, link FROM supply_defaults WHERE supply_id = ?', [id]);
    await db.runAsync('DELETE FROM supply_defaults WHERE supply_id = ?', [id]);
    for (const m of moved) {
      const next = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM supplies WHERE (pet_id = ? OR shared = 1) AND link = ? AND archived_at IS NULL ORDER BY created_at LIMIT 1',
        [m.pet_id, m.link],
      );
      if (next) await db.runAsync('INSERT OR REPLACE INTO supply_defaults (pet_id, link, supply_id) VALUES (?, ?, ?)', [m.pet_id, m.link, next.id]);
    }
  });
}
