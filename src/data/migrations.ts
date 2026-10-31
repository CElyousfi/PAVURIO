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
  // v2 — schedules & reminders, appointments, measurements, records, attachments, memories
  `
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    times_json TEXT NOT NULL,
    days_json TEXT NOT NULL DEFAULT '[]',
    start_date TEXT NOT NULL,
    end_date TEXT,
    remind INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_schedules_pet ON schedules (pet_id);

  CREATE TABLE IF NOT EXISTS schedule_marks (
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('done','skipped','snoozed')),
    event_id TEXT,
    snooze_until INTEGER,
    marked_at INTEGER NOT NULL,
    PRIMARY KEY (schedule_id, occurrence_key)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    at INTEGER NOT NULL,
    location TEXT,
    notes TEXT,
    remind_minutes INTEGER,
    done_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_appointments_pet_at ON appointments (pet_id, at);

  CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    at INTEGER NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_measurements_pet_kind_at ON measurements (pet_id, kind, at);

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT,
    source TEXT NOT NULL DEFAULT 'owner',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_pet_date ON records (pet_id, date);

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    mime TEXT,
    name TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments (owner_type, owner_id);

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    photo_uri TEXT,
    title TEXT NOT NULL,
    caption TEXT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'moment',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memories_pet_date ON memories (pet_id, date);
  `,
  // v3 — challenges the owner opted into
  `
  CREATE TABLE IF NOT EXISTS challenge_runs (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    start_day TEXT NOT NULL,
    completed_at INTEGER,
    abandoned_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_challenge_runs_pet ON challenge_runs (pet_id, created_at);
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
