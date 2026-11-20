import { describe, expect, it } from 'vitest';
import { openPrepared, showSlowNotice, singleFlight, startupInitial, startupReducer, type StartupEvent, type StartupState } from '../src/features/startup';
import { migrate } from '../src/data/migrations';
import { listPets, createPet } from '../src/data/repo';
import { openNodeDb } from './helpers/nodeDb';

const run = (events: StartupEvent['type'][], from: StartupState = startupInitial) => events.reduce((s, type) => startupReducer(s, { type } as StartupEvent), from);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('slow start-up notice', () => {
  it('a slow start shows the notice, and it disappears by itself once the app is ready', () => {
    const slow = run(['stall']);
    expect(showSlowNotice(slow)).toBe(true);
    const ready = startupReducer(slow, { type: 'started' });
    expect(showSlowNotice(ready)).toBe(false);
    // and it never comes back
    expect(showSlowNotice(run(['stall'], ready))).toBe(false);
  });

  it('a fast start never shows it, even if the watchdog fires late', () => {
    expect(showSlowNotice(run(['started', 'stall']))).toBe(false);
  });

  it('retry hides the notice; the watchdog can show it again if the retry is slow too', () => {
    expect(showSlowNotice(run(['stall', 'retry']))).toBe(false);
    expect(showSlowNotice(run(['stall', 'retry', 'stall']))).toBe(true);
    expect(showSlowNotice(run(['stall', 'retry', 'stall', 'started']))).toBe(false);
  });

  it('repeated taps on retry are harmless', () => {
    expect(run(['stall', 'retry', 'retry', 'retry'])).toEqual({ started: false, stalled: false });
  });
});

/** a fake database that counts connections and overlapping migrations */
function fakeDriver(opts: { migrateMs: number; failFirst?: number }) {
  const stats = { opened: 0, closed: 0, migrating: 0, maxMigrating: 0, migrations: 0 };
  let failures = opts.failFirst ?? 0;
  const open = async () => {
    stats.opened++;
    return { closeAsync: async () => void stats.closed++ };
  };
  const prepare = async () => {
    stats.migrating++;
    stats.maxMigrating = Math.max(stats.maxMigrating, stats.migrating);
    await tick(opts.migrateMs);
    stats.migrating--;
    stats.migrations++;
    if (failures > 0) {
      failures--;
      throw new Error('disk busy');
    }
  };
  return { stats, start: singleFlight(() => openPrepared(open, prepare)) };
}

describe('opening the database', () => {
  it('pressing retry five times during a slow start opens and migrates exactly once', async () => {
    const { stats, start } = fakeDriver({ migrateMs: 30 });
    const attempts = [start()];
    for (let i = 0; i < 4; i++) {
      await tick(2);
      attempts.push(start()); // each retry remounts the app and asks again
    }
    const dbs = await Promise.all(attempts);
    expect(new Set(dbs).size).toBe(1);
    expect(stats).toMatchObject({ opened: 1, migrations: 1, maxMigrating: 1, closed: 0 });
    // later mounts reuse the open connection
    expect(await start()).toBe(dbs[0]);
    expect(stats.opened).toBe(1);
  });

  it('a failed start closes its connection and the next retry starts cleanly', async () => {
    const { stats, start } = fakeDriver({ migrateMs: 5, failFirst: 1 });
    await expect(start()).rejects.toThrow('disk busy');
    expect(stats).toMatchObject({ opened: 1, closed: 1 });
    await expect(start()).resolves.toBeTruthy();
    expect(stats).toMatchObject({ opened: 2, closed: 1, migrations: 2, maxMigrating: 1 });
  });

  it('retries during a failing attempt share it, then a fresh attempt succeeds', async () => {
    const { stats, start } = fakeDriver({ migrateMs: 20, failFirst: 1 });
    const a = start();
    const b = start();
    await expect(a).rejects.toThrow();
    await expect(b).rejects.toThrow();
    expect(stats.opened).toBe(1);
    await expect(start()).resolves.toBeTruthy();
    expect(stats.maxMigrating).toBe(1);
  });

  it('with the real migrations: a second start reuses the database and keeps the data', async () => {
    const raw = openNodeDb(':memory:');
    const start = singleFlight(() => openPrepared(async () => Object.assign(raw, { closeAsync: async () => {} }), (db) => migrate(db)));
    const db = await start();
    await createPet(db, { species: 'cat', name: 'Mochi' });
    const again = await Promise.all([start(), start()]);
    expect(again[0]).toBe(db);
    expect(await listPets(again[1])).toHaveLength(1);
  });
});
