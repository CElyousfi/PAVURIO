import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, listPets, logCare, setSetting, getSetting } from '../src/data/repo';
import { dumpSnapshot, fromChunks, petCount, restoreSnapshot, toChunks, CHUNK_CHARS } from '../src/data/snapshot';
import { openNodeDb } from './helpers/nodeDb';

async function fresh() {
  const db = openNodeDb();
  await migrate(db);
  return db;
}

describe('cloud snapshot', () => {
  it('round-trips the owner’s data onto another phone and keeps device settings local', async () => {
    const a = await fresh();
    const pet = await createPet(a, { species: 'cat', name: 'Mochi' });
    await logCare(a, { petId: pet.id, type: 'meal', occurredAt: 1_000, mutationId: 'm1' });
    await logCare(a, { petId: pet.id, type: 'litter', occurredAt: 2_000, mutationId: 'm2' });
    await setSetting(a, 'lang', 'fr');
    await setSetting(a, 'proCache', '1');
    const snap = await dumpSnapshot(a, 42);
    expect(petCount(snap)).toBe(1);
    expect(snap.settings.find((s) => s.key === 'proCache')).toBeUndefined();

    const b = await fresh();
    await setSetting(b, 'proCache', '0');
    await createPet(b, { species: 'dog', name: 'Old' });
    await restoreSnapshot(b, fromChunks(toChunks(snap)));
    const pets = await listPets(b);
    expect(pets.map((p) => p.name)).toEqual(['Mochi']);
    expect((await b.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM care_events', []))[0].n).toBe(2);
    expect(await getSetting(b, 'lang')).toBe('fr');
    expect(await getSetting(b, 'proCache')).toBe('0'); // device setting untouched
  });

  it('splits large backups under the Firestore document limit and rejects foreign files', async () => {
    const a = await fresh();
    const pet = await createPet(a, { species: 'dog', name: 'Biscuit' });
    for (let i = 0; i < 3000; i++) await logCare(a, { petId: pet.id, type: 'walk', occurredAt: i * 60_000, mutationId: `w${i}`, note: 'a walk around the park with friends' });
    const chunks = toChunks(await dumpSnapshot(a));
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(CHUNK_CHARS);
    const b = await fresh();
    await restoreSnapshot(b, fromChunks(chunks));
    expect((await b.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM care_events', []))[0].n).toBe(3000);
    await expect(restoreSnapshot(b, { app: 'other' } as never)).rejects.toThrow();
    expect((await listPets(b)).length).toBe(1); // a failed restore changes nothing
  });
});
