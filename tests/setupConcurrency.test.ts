import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, getSetting, listPets } from '../src/data/repo';
import { type Db, serialTransactions } from '../src/data/db';
import { listMeasurements, listSchedules } from '../src/data/careRepo';
import { finishSetup, recoverSetups, startPetSetup } from '../src/data/setup';
import { followAll } from '../src/data/autoPlan';
import { planBasis, recommendedChoice, targetsFor } from '../src/domain/carePlan';
import { createLock, dropWhileBusy } from '../src/data/lock';
import { openNodeDb } from './helpers/nodeDb';

async function begin() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const profile = { size: 'medium' as const, food: 'dry' as const };
  const choices = targetsFor(planBasis('dog', 4, profile)).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
  const pet = await startPetSetup(db, { species: 'dog', name: 'Biscuit', birthDate: '2026-07-07' }, { profile, months: 4, weight: { value: 6.2, unit: 'kg', at: 1 }, weighedKg: 6.2, choices, birthApprox: true });
  return { db, pet, expected: choices.filter((c) => c.on).length };
}

/** one schedule per care type and kind: anything more is a duplicate routine */
async function duplicates(db: Db, petId: string) {
  const s = await listSchedules(db, petId);
  const keys = s.map((x) => `${x.type}`);
  return { total: s.length, unique: new Set(keys).size };
}

describe('setup steps that overlap (onboarding + the reload that recovers setups + plan updates)', () => {
  it('onboarding finishing while a reload recovers the same setup: one set of routines, no error', async () => {
    const { db, pet } = await begin();
    const results = await Promise.allSettled([finishSetup(db, pet.id), recoverSetups(db)]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const d = await duplicates(db, pet.id);
    expect(d.total).toBe(d.unique);
    expect(d.total).toBeGreaterThan(3);
    expect(await listMeasurements(db, pet.id)).toHaveLength(1);
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });

  it('three overlapping attempts (double tap + reload) still give one pet and one set of routines', async () => {
    const { db, pet } = await begin();
    const results = await Promise.allSettled([finishSetup(db, pet.id), finishSetup(db, pet.id), recoverSetups(db)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const d = await duplicates(db, pet.id);
    expect(d.total).toBe(d.unique);
    expect(await listPets(db)).toHaveLength(1);
  });

  it('a plan update (followAll) running during setup does not break or duplicate it', async () => {
    const { db, pet } = await begin();
    const results = await Promise.allSettled([finishSetup(db, pet.id), followAll(db), followAll(db)]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    const d = await duplicates(db, pet.id);
    expect(d.total).toBe(d.unique);
    expect(d.total).toBeGreaterThan(3);
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });
});

describe('fast double tap on "Start with this plan"', () => {
  async function fresh() {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const profile = { size: 'medium' as const, food: 'dry' as const };
    const choices = targetsFor(planBasis('dog', 4, profile)).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
    const work = { profile, months: 4, weight: null, weighedKg: null, choices, birthApprox: true };
    const save = async () => {
      const pet = await startPetSetup(db, { species: 'dog', name: 'Biscuit' }, work);
      await finishSetup(db, pet.id);
      return 'saved';
    };
    return { db, save };
  }

  it('model of the old guard: two taps from the same render both pass a React-state check, and the second save collides', async () => {
    const { db, save } = await fresh();
    // what onboarding did: `if (saving) return; setSaving(true)` — but both taps read the same
    // render's `saving` (false), because the state only changes on the next render
    const saving = false;
    const tap = async () => {
      if (saving) return;
      await save();
    };
    const r = await Promise.allSettled([tap(), tap()]);
    const failed = r.filter((x) => x.status === 'rejected').map((x) => String((x as PromiseRejectedResult).reason));
    const pets = (await listPets(db)).length;
    // on a phone's single connection: an error at the last step, or two pets — never one clean pet
    expect(failed.length > 0 || pets === 2).toBe(true);
    // seen: "FOREIGN KEY constraint failed" — the colliding BEGIN rolled back the other tap's pet
    if (failed.length) expect(failed[0]).toMatch(/FOREIGN KEY|transaction within a transaction|UNIQUE/);
  });

  it('the synchronous guard starts the save once, and allows a retry after it finished', async () => {
    const { db, save } = await fresh();
    const once = dropWhileBusy();
    const results = await Promise.all([once(save), once(save), once(save)]);
    expect(await listPets(db)).toHaveLength(1);
    expect(results.filter((r) => r === undefined)).toHaveLength(2); // two taps ignored
    expect(results.filter((r) => r === 'saved')).toHaveLength(1);
    // after a failure or a finished save, the next tap works again
    let ran = false;
    await once(async () => void (ran = true));
    expect(ran).toBe(true);
  });

  it('the guard is released even when the save throws', async () => {
    const once = dropWhileBusy();
    await expect(once(() => Promise.reject(new Error('disk full')))).rejects.toThrow('disk full');
    expect(await once(async () => 'again')).toBe('again');
  });
});

describe('the locks themselves', () => {
  it('run tasks in order, one at a time, and keep going after a failure', async () => {
    const lock = createLock();
    const log: string[] = [];
    const task = (name: string, ms: number, fail = false) => () =>
      new Promise<string>((res, rej) =>
        setTimeout(() => {
          log.push(name);
          if (fail) rej(new Error(name));
          else res(name);
        }, ms),
      );
    const all = await Promise.allSettled([lock(task('a', 20)), lock(task('b', 1, true)), lock(task('c', 1))]);
    expect(log).toEqual(['a', 'b', 'c']);
    expect(all.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});

describe('queued transactions on the shared connection (serialTransactions)', () => {
  const twoPets = (db: Parameters<typeof createPet>[0]) => Promise.allSettled([createPet(db, { species: 'dog', name: 'A' }), createPet(db, { species: 'cat', name: 'B' })]);

  it('without the queue: two writers at once collide, as on a phone', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const r = await twoPets(db);
    expect(r.some((x) => x.status === 'rejected')).toBe(true);
  });

  it('with the queue: both succeed, nothing is lost', async () => {
    const db = serialTransactions(openNodeDb(':memory:'));
    await migrate(db);
    const r = await twoPets(db);
    expect(r.map((x) => x.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await listPets(db)).toHaveLength(2);
  });

  it('a failed transaction rolls back only itself and lets the next one run', async () => {
    const db = serialTransactions(openNodeDb(':memory:'));
    await migrate(db);
    const bad = db.withTransactionAsync(async () => {
      await createPetRaw(db, 'ghost');
      throw new Error('boom');
    });
    const good = createPet(db, { species: 'cat', name: 'Mochi' });
    await expect(bad).rejects.toThrow('boom');
    await good;
    expect((await listPets(db)).map((p) => p.name)).toEqual(['Mochi']);
  });

  it('a long transaction (a big restore) is never cut short by one waiting behind it', async () => {
    const raw = openNodeDb(':memory:');
    await raw.execAsync('CREATE TABLE t (v INTEGER)');
    const db = serialTransactions(raw);
    const slow = db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO t VALUES (1)', []);
      await new Promise((r) => setTimeout(r, 120)); // longer than anything else here
      await db.runAsync('INSERT INTO t VALUES (2)', []);
    });
    const waiting = db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO t VALUES (99)', []);
    });
    expect((await Promise.allSettled([slow, waiting])).map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await raw.getAllAsync<{ v: number }>('SELECT v FROM t ORDER BY rowid', [])).map((r) => r.v)).toEqual([1, 2, 99]);
  });

  it('setup with all its parts runs cleanly alongside other writers', async () => {
    const db = serialTransactions(openNodeDb(':memory:'));
    await migrate(db);
    const profile = { size: 'medium' as const, food: 'dry' as const };
    const choices = targetsFor(planBasis('dog', 4, profile)).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
    const work = { profile, months: 4, weight: { value: 6.2, unit: 'kg' as const, at: 1 }, weighedKg: 6.2, choices, birthApprox: true };
    const pet = await startPetSetup(db, { species: 'dog', name: 'Biscuit' }, work);
    const r = await Promise.allSettled([finishSetup(db, pet.id), recoverSetups(db), followAll(db), createPet(db, { species: 'cat', name: 'Other' })]);
    expect(r.every((x) => x.status === 'fulfilled')).toBe(true);
    const d = await duplicates(db, pet.id);
    expect(d.total).toBe(d.unique);
    expect(await listPets(db)).toHaveLength(2);
  });
});

async function createPetRaw(db: Db, name: string) {
  await db.runAsync("INSERT INTO pets (id, species, name, appearance_json, created_at, updated_at) VALUES (?, 'dog', ?, '{}', 1, 1)", [name, name]);
}
