import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, SCHEMA_VERSION } from '../src/data/migrations';
import {
  ValidationError,
  createPet,
  exportAll,
  getActivePet,
  getPlan,
  listEventsBetween,
  logCare,
  restoreEvent,
  setPlan,
  updateEvent,
  voidEvent,
} from '../src/data/repo';
import { dayRange } from '../src/domain/time';
import { computeProgress } from '../src/domain/progress';
import { openNodeDb } from './helpers/nodeDb';

async function fresh(file = ':memory:') {
  const db = openNodeDb(file);
  await migrate(db);
  return db;
}

describe('migrations', () => {
  it('is idempotent and records the schema version', async () => {
    const db = await fresh();
    await migrate(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(v?.user_version).toBe(SCHEMA_VERSION);
  });
});

describe('pets', () => {
  it('creates a dog with a default plan and makes it active', async () => {
    const db = await fresh();
    const pet = await createPet(db, { species: 'dog', name: '  Biscuit  ' });
    expect(pet.name).toBe('Biscuit');
    expect((await getActivePet(db))?.id).toBe(pet.id);
    const plan = await getPlan(db, pet.id);
    expect(plan.meal).toBe(2);
    expect(plan.walk).toBe(2);
    expect(plan.litter).toBeUndefined();
  });

  it('rejects empty names', async () => {
    const db = await fresh();
    await expect(createPet(db, { species: 'cat', name: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('ignores plan entries that do not belong to the species', async () => {
    const db = await fresh();
    const pet = await createPet(db, { species: 'cat', name: 'Mochi' });
    await setPlan(db, pet, { meal: 3, walk: 2, litter: 1 });
    const plan = await getPlan(db, pet.id);
    expect(plan).toEqual({ meal: 3, litter: 1 });
  });
});

describe('care events', () => {
  it('logs a meal, is idempotent on mutation id (double tap), and lists it for the day', async () => {
    const db = await fresh();
    const pet = await createPet(db, { species: 'dog', name: 'Biscuit' });
    const now = Date.now();
    const a = await logCare(db, { petId: pet.id, type: 'meal', occurredAt: now, amount: 120, mutationId: 'm-1' });
    const b = await logCare(db, { petId: pet.id, type: 'meal', occurredAt: now, amount: 120, mutationId: 'm-1' });
    expect(b.id).toBe(a.id);
    const { start, end } = dayRange(now);
    const events = await listEventsBetween(db, pet.id, start, end);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'meal', amount: 120, unit: 'g' });
  });

  it('rejects future events, species-invalid types and out-of-range amounts', async () => {
    const db = await fresh();
    const dog = await createPet(db, { species: 'dog', name: 'Biscuit' });
    const now = Date.now();
    await expect(
      logCare(db, { petId: dog.id, type: 'meal', occurredAt: now + 3600_000, mutationId: 'f' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logCare(db, { petId: dog.id, type: 'litter', occurredAt: now, mutationId: 'l' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logCare(db, { petId: dog.id, type: 'meal', occurredAt: now, amount: -4, mutationId: 'n' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('undo voids the event and progress goes back; restore brings it back', async () => {
    const db = await fresh();
    const pet = await createPet(db, { species: 'dog', name: 'Biscuit' });
    const plan = await getPlan(db, pet.id);
    const now = Date.now();
    const { start, end } = dayRange(now);
    const e = await logCare(db, { petId: pet.id, type: 'meal', occurredAt: now, mutationId: 'u-1' });
    expect(computeProgress(plan, await listEventsBetween(db, pet.id, start, end)).done).toBe(1);
    await voidEvent(db, e.id);
    expect(computeProgress(plan, await listEventsBetween(db, pet.id, start, end)).done).toBe(0);
    await restoreEvent(db, e.id);
    expect(await listEventsBetween(db, pet.id, start, end)).toHaveLength(1);
  });

  it('edits amount and time', async () => {
    const db = await fresh();
    const pet = await createPet(db, { species: 'dog', name: 'Biscuit' });
    const now = Date.now();
    const e = await logCare(db, { petId: pet.id, type: 'walk', occurredAt: now, amount: 20, mutationId: 'w' });
    const edited = await updateEvent(db, e.id, { amount: 45, occurredAt: now - 3600_000, note: 'Park' });
    expect(edited).toMatchObject({ amount: 45, note: 'Park', occurredAt: now - 3600_000 });
    await expect(updateEvent(db, e.id, { amount: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('survives a full app restart (close and reopen the database file)', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pavurio-')), 'pavurio.db');
    const db1 = await fresh(file);
    const pet = await createPet(db1, { species: 'cat', name: 'Mochi' });
    const now = Date.now();
    await logCare(db1, { petId: pet.id, type: 'litter', occurredAt: now, mutationId: 'r-1' });
    db1.close();

    const db2 = await fresh(file);
    const again = await getActivePet(db2);
    expect(again?.name).toBe('Mochi');
    const { start, end } = dayRange(now);
    const events = await listEventsBetween(db2, pet.id, start, end);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'litter', amount: null });
    const json = JSON.parse(await exportAll(db2));
    expect(json.events).toHaveLength(1);
    db2.close();
  });

  it('rolls back the whole pet creation if any write fails', async () => {
    const db = await fresh();
    await db.execAsync('DROP TABLE care_plans');
    await expect(createPet(db, { species: 'dog', name: 'Ghost' })).rejects.toBeTruthy();
    const pets = await db.getAllAsync('SELECT * FROM pets', []);
    expect(pets).toHaveLength(0);
  });
});
