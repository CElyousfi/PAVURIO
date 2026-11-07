import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { getSetting, listPets, setSetting } from '../src/data/repo';
import { listMeasurements, listSchedules } from '../src/data/careRepo';
import { finishSetup, recoverSetups, startPetSetup } from '../src/data/setup';
import { planBasis, recommendedChoice, targetsFor } from '../src/domain/carePlan';
import { openNodeDb } from './helpers/nodeDb';

async function begin() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const profile = { size: 'medium' as const, food: 'dry' as const };
  const choices = targetsFor(planBasis('dog', 4, profile)).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
  const pet = await startPetSetup(db, { species: 'dog', name: 'Biscuit', birthDate: '2026-07-07' }, { profile, months: 4, weight: { value: 6.2, unit: 'kg', at: 1 }, weighedKg: 6.2, choices, birthApprox: true });
  return { db, pet };
}

describe('pet setup is never left half done', () => {
  it('finishes everything in one go', async () => {
    const { db, pet } = await begin();
    await finishSetup(db, pet.id);
    expect((await listSchedules(db, pet.id)).length).toBeGreaterThan(3);
    expect(await getSetting(db, `profile:${pet.id}`)).toContain('medium');
    expect(await listMeasurements(db, pet.id)).toHaveLength(1);
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });

  it('an interrupted setup (app killed after the pet was created) is completed on the next start', async () => {
    const { db, pet } = await begin();
    // killed here: pet exists, nothing else
    expect(await listSchedules(db, pet.id)).toHaveLength(0);
    expect(await recoverSetups(db)).toBe(1);
    expect((await listSchedules(db, pet.id)).length).toBeGreaterThan(3);
    expect(await recoverSetups(db)).toBe(0);
  });

  it('retrying never duplicates the pet, its routines or the weigh-in', async () => {
    const { db, pet } = await begin();
    await finishSetup(db, pet.id);
    const before = await listSchedules(db, pet.id);
    // a second tap / retry with the record put back
    await setSetting(db, `setupPending:${pet.id}`, JSON.stringify({ profile: { size: 'medium', food: 'dry' }, months: 4, weight: { value: 6.2, unit: 'kg', at: 1 }, weighedKg: 6.2, choices: [], birthApprox: true, done: { weight: true } }));
    await finishSetup(db, pet.id);
    expect(await listPets(db)).toHaveLength(1);
    expect(await listMeasurements(db, pet.id)).toHaveLength(1);
    expect((await listSchedules(db, pet.id)).length).toBe(before.length);
  });

  it('clears the onboarding draft once the pet is set up', async () => {
    const { db, pet } = await begin();
    await setSetting(db, 'onboardingDraft', '{"step":"look"}');
    await finishSetup(db, pet.id);
    expect(await getSetting(db, 'onboardingDraft')).toBe('');
  });
});
