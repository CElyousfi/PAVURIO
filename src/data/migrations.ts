import { Db } from './db';

/**
 * Forward-only migrations keyed by PRAGMA user_version.
 * Instants are UTC epoch milliseconds (INTEGER). Days are computed in local time by the domain.
 */
export const MIGRATIONS: string[] = [
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
  // v4 — the owner's usual portion per care (the daily goal = times × portion), and Adventures:
  // timed walks as their own records (the source of truth for the care event, memory and passport)
  `
  ALTER TABLE care_plans ADD COLUMN portion REAL;

  CREATE TABLE IF NOT EXISTS walks (
    id TEXT PRIMARY KEY NOT NULL,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completing', 'completed', 'discarded')),
    started_at INTEGER NOT NULL,
    paused_at INTEGER,
    paused_ms INTEGER NOT NULL DEFAULT 0,
    finished_at INTEGER,
    duration_ms INTEGER,
    tz TEXT,
    weather_json TEXT,
    weather_at INTEGER,
    photo_uri TEXT,
    note TEXT,
    event_id TEXT,
    memory_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'local',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_walks_pet_time ON walks (pet_id, started_at);

  CREATE TABLE IF NOT EXISTS walk_badges (
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    badge TEXT NOT NULL,
    walk_id TEXT,
    unlocked_at INTEGER NOT NULL,
    rule_version INTEGER NOT NULL,
    PRIMARY KEY (pet_id, badge)
  );
  `,
  // v5 — Pavurio Memories: the existing memories table is extended (never replaced). Photos live as
  // files; \`media\` holds their durable location, thumbnail and capture date. A memory can include
  // several pets through \`memory_pets\` (one file, one memory — no duplicates per pet).
  `
  ALTER TABLE memories ADD COLUMN media_id TEXT;
  ALTER TABLE memories ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE memories ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE memories ADD COLUMN milestone TEXT;
  ALTER TABLE memories ADD COLUMN walk_id TEXT;
  ALTER TABLE memories ADD COLUMN captured_at INTEGER;
  ALTER TABLE memories ADD COLUMN updated_at INTEGER;

  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY NOT NULL,
    uri TEXT NOT NULL,
    thumb_uri TEXT,
    width INTEGER,
    height INTEGER,
    mime TEXT,
    captured_at INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'local',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memory_pets (
    memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, pet_id)
  );
  CREATE INDEX IF NOT EXISTS idx_memory_pets_pet ON memory_pets (pet_id, memory_id);
  CREATE INDEX IF NOT EXISTS idx_memories_media ON memories (media_id);
  CREATE INDEX IF NOT EXISTS idx_memories_walk ON memories (walk_id);

  -- every memory belongs to at least its primary pet, whoever inserts it (walks, restore, editor)
  CREATE TRIGGER IF NOT EXISTS trg_memories_primary_pet AFTER INSERT ON memories
  BEGIN
    INSERT OR IGNORE INTO memory_pets (memory_id, pet_id) VALUES (NEW.id, NEW.pet_id);
  END;

  INSERT OR IGNORE INTO memory_pets (memory_id, pet_id) SELECT id, pet_id FROM memories;
  INSERT OR IGNORE INTO media (id, uri, mime, created_at)
    SELECT 'legacy-' || id, photo_uri, 'image/jpeg', created_at FROM memories WHERE photo_uri IS NOT NULL AND kind != 'adventure';
  UPDATE memories SET media_id = 'legacy-' || id WHERE photo_uri IS NOT NULL AND kind != 'adventure';
  UPDATE memories SET milestone = 'custom' WHERE kind = 'milestone';
  UPDATE memories SET walk_id = substr(id, 6) WHERE kind = 'adventure' AND id LIKE 'walk-%';
  UPDATE memories SET updated_at = created_at;
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
