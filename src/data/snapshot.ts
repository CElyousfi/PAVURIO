import type { BindValue, Db } from './db';
import { SCHEMA_VERSION } from './migrations';

/**
 * Whole-database snapshot used for the cloud backup (and restore on a new phone).
 * Parents come before children so a restore can insert in order with foreign keys on.
 */
export const SNAPSHOT_TABLES = [
  'pets',
  'care_plans',
  'care_events',
  'schedules',
  'schedule_marks',
  'appointments',
  'measurements',
  'records',
  'attachments',
  'memories',
  'challenge_runs',
] as const;

/** Settings that describe this device, not the owner's data: never backed up or restored. */
const DEVICE_SETTINGS = new Set(['proCache', 'reviewAskedAt', 'firstOpenAt']);
export const isDeviceSetting = (key: string) => DEVICE_SETTINGS.has(key) || key.startsWith('cloud.');

type Row = Record<string, BindValue>;
export type Snapshot = {
  app: 'pavurio';
  schema: number;
  createdAt: number;
  tables: Record<string, Row[]>;
  settings: { key: string; value: string }[];
};

export async function dumpSnapshot(db: Db, now = Date.now()): Promise<Snapshot> {
  const tables: Record<string, Row[]> = {};
  for (const t of SNAPSHOT_TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`, []);
  const settings = (await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings', [])).filter((s) => !isDeviceSetting(s.key));
  return { app: 'pavurio', schema: SCHEMA_VERSION, createdAt: now, tables, settings };
}

export function petCount(s: Snapshot): number {
  return (s.tables.pets ?? []).filter((p) => p.archived_at == null).length;
}

/**
 * Replaces the owner's data with the snapshot, in one transaction (all or nothing).
 * Columns are checked against the live schema, so a snapshot from a newer app version restores what it can.
 */
export async function restoreSnapshot(db: Db, snap: Snapshot): Promise<void> {
  if (snap?.app !== 'pavurio' || typeof snap.tables !== 'object') throw new Error('Not a Pavurio backup');
  const columns: Record<string, Set<string>> = {};
  for (const t of SNAPSHOT_TABLES) {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`, []);
    columns[t] = new Set(cols.map((c) => c.name));
  }
  await db.withTransactionAsync(async () => {
    for (const t of [...SNAPSHOT_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
    const keep = await db.getAllAsync<{ key: string }>('SELECT key FROM settings', []);
    for (const { key } of keep) if (!isDeviceSetting(key)) await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
    for (const t of SNAPSHOT_TABLES) {
      for (const row of snap.tables[t] ?? []) {
        const keys = Object.keys(row).filter((k) => columns[t].has(k));
        if (!keys.length) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k] ?? null),
        );
      }
    }
    for (const s of snap.settings ?? []) {
      if (typeof s.key === 'string' && typeof s.value === 'string' && !isDeviceSetting(s.key)) {
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
      }
    }
  });
}

/** Firestore documents are capped at 1 MiB: the snapshot travels as JSON text in chunks. */
export const CHUNK_CHARS = 400_000;
export function toChunks(snap: Snapshot): string[] {
  const json = JSON.stringify(snap);
  const out: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_CHARS) out.push(json.slice(i, i + CHUNK_CHARS));
  return out.length ? out : ['{}'];
}
export function fromChunks(chunks: string[]): Snapshot {
  return JSON.parse(chunks.join('')) as Snapshot;
}
