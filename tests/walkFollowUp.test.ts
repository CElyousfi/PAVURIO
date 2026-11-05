import { describe, expect, it, vi } from 'vitest';

import { migrate } from '../src/data/migrations';
import { createPet, getSetting } from '../src/data/repo';
import { createSchedule } from '../src/data/careRepo';
import { finishWalk, startWalk } from '../src/data/walkRepo';
import { afterWalkFinished, finishPendingWalks } from '../src/features/walkSession';
import { openNodeDb } from './helpers/nodeDb';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
vi.mock('../src/native/walkLive', () => ({ endWalkLive: async () => {}, readWalkLive: async () => null, showWalkLive: async () => {} }));

const at = (h: number, m = 0) => new Date(2026, 10, 5, h, m).getTime();

async function setup() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const pet = await createPet(db, { species: 'dog', name: 'Honey' });
  await createSchedule(db, { petId: pet.id, type: 'walk', title: 'Morning walk', times: ['08:00', '18:00'] });
  return { db, pet };
}
const marks = (db: Awaited<ReturnType<typeof setup>>['db']) => db.getAllAsync<{ occurrence_key: string }>("SELECT occurrence_key FROM schedule_marks WHERE status = 'done'", []);

describe('walk follow-up is recoverable', () => {
  it('runs once: re-running never ticks a second walk or counts twice', async () => {
    const { db, pet } = await setup();
    const w = await startWalk(db, pet.id, null, at(8, 5));
    const r = await finishWalk(db, w.id, { now: at(8, 35) });
    await afterWalkFinished(db, r);
    await afterWalkFinished(db, r);
    expect(await marks(db)).toHaveLength(1);
    expect(await getSetting(db, `walksTimed:${pet.id}`)).toBe('1');
  });

  it('a failure part-way leaves the walk pending, and the next start finishes it without duplicates', async () => {
    const { db, pet } = await setup();
    const w = await startWalk(db, pet.id, null, at(8, 5));
    const r = await finishWalk(db, w.id, { now: at(8, 35) });
    // the schedule tick succeeds, then the app is killed before the count
    const real = db.withTransactionAsync.bind(db);
    db.withTransactionAsync = async () => {
      throw new Error('killed');
    };
    await expect(afterWalkFinished(db, r)).rejects.toThrow('killed');
    db.withTransactionAsync = real;
    expect(await getSetting(db, `walkCounted:${w.id}`)).toBeNull();
    expect(await marks(db)).toHaveLength(1);
    // next launch
    expect(await finishPendingWalks(db)).toBe(1);
    expect(await marks(db)).toHaveLength(1);
    expect(await getSetting(db, `walksTimed:${pet.id}`)).toBe('1');
    expect(await getSetting(db, `walkCounted:${w.id}`)).toBe('1');
    // and nothing left to do after that
    expect(await finishPendingWalks(db)).toBe(0);
  });
});
