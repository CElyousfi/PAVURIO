import { Db } from './db';

/**
 * Forward-only migrations keyed by PRAGMA user_version.
 * Instants are UTC epoch milliseconds (INTEGER). Days are computed in local time by the domain.
 */
const MIGRATIONS: string[] = [
  // v1 — first vertical slice
  `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('dog','cat')),
    name TEXT NOT NULL,
    appearance_json TEXT NOT NULL,
    birth_date TEXT,
    adoption_date TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    archived_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS care_plans (
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    target_per_day INTEGER NOT NULL CHECK (target_per_day >= 0 AND target_per_day <= 20),
    PRIMARY KEY (pet_id, type)
  );

  CREATE TABLE IF NOT EXISTS care_events (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    amount REAL,
    unit TEXT,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    mutation_id TEXT NOT NULL UNIQUE,
    voided_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_care_events_pet_time ON care_events (pet_id, occurred_at);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
