import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, getSetting, setSetting } from '../src/data/repo';
import { addMeasurement, listMeasurements, listSchedules } from '../src/data/careRepo';
import { finishSetup, recoverSetups, startPetSetup } from '../src/data/setup';
import { planBasis, recommendedChoice, targetsFor } from '../src/domain/carePlan';
import { KG_PER_LB, WEIGHT_MAX_KG, WEIGHT_MIN_KG, isValidWeight, maxInUnit, savedValue, stepWeightKg, toKg } from '../src/domain/weight';
import { openNodeDb } from './helpers/nodeDb';

describe('weight rules use one unit (kg) everywhere', () => {
  it('the full stepper range is valid in both units', () => {
    for (const unit of ['kg', 'lb'] as const) {
      // walk the stepper from its lowest to its highest value, as an owner tapping "+" would
      let kg = WEIGHT_MIN_KG;
      let taps = 0;
      while (kg < WEIGHT_MAX_KG && taps < 5000) {
        expect(isValidWeight(savedValue(kg, unit), unit), `${kg} kg in ${unit}`).toBe(true);
        kg = stepWeightKg(kg, unit, 1);
        taps++;
      }
      expect(kg).toBe(WEIGHT_MAX_KG);
      expect(isValidWeight(savedValue(kg, unit), unit)).toBe(true);
      // and "+" at the top stays at the top
      expect(stepWeightKg(kg, unit, 1)).toBe(WEIGHT_MAX_KG);
      expect(stepWeightKg(WEIGHT_MIN_KG, unit, -1)).toBe(WEIGHT_MIN_KG);
    }
  });

  it('large dogs: 200, 210 and 264.6 lb are accepted; the limit is the same weight in both units', () => {
    expect(isValidWeight(200, 'lb')).toBe(true);
    expect(isValidWeight(210, 'lb')).toBe(true);
    expect(isValidWeight(264.6, 'lb')).toBe(true); // = 120 kg saved with one decimal
    expect(isValidWeight(120, 'kg')).toBe(true);
    expect(isValidWeight(265, 'lb')).toBe(false);
    expect(isValidWeight(121, 'kg')).toBe(false);
    expect(maxInUnit('kg')).toBe(120);
    expect(maxInUnit('lb')).toBe(264.6);
  });

  it('rejects nonsense in any unit', () => {
    for (const unit of ['kg', 'lb'] as const) {
      for (const v of [0, -1, NaN, Infinity]) expect(isValidWeight(v, unit)).toBe(false);
      expect(isValidWeight(0.1, unit)).toBe(true); // a newborn kitten, typed by hand
    }
  });

  it('conversions round-trip within the saved precision', () => {
    for (const kg of [0.3, 4.2, 30, 99.9, 120]) {
      expect(Math.abs(toKg(savedValue(kg, 'lb'), 'lb') - kg)).toBeLessThan(0.05);
      expect(savedValue(kg, 'kg')).toBe(Math.round(kg * 10) / 10);
    }
    expect(KG_PER_LB).toBe(0.45359237);
  });

  it('manual entry: a 250 lb dog saves; out-of-range values name the limit in the owner\'s unit', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const p = (await createPet(db, { species: 'dog', name: 'Tank' })).id;
    await addMeasurement(db, { petId: p, kind: 'weight', value: 250, unit: 'lb', at: 1 });
    expect(await listMeasurements(db, p)).toHaveLength(1);
    await expect(addMeasurement(db, { petId: p, kind: 'weight', value: 300, unit: 'lb', at: 1 })).rejects.toThrow('264.6 lb');
    await expect(addMeasurement(db, { petId: p, kind: 'weight', value: 130, unit: 'kg', at: 1 })).rejects.toThrow('120 kg');
  });
});

async function setupBigDog(weight: { value: number; unit: 'kg' | 'lb'; at: number }) {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const profile = { size: 'giant' as const, food: 'dry' as const };
  const choices = targetsFor(planBasis('dog', 36, profile, toKg(weight.value, weight.unit))).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
  const pet = await startPetSetup(db, { species: 'dog', name: 'Tank', birthDate: '2023-07-07' }, { profile, months: 36, weight, weighedKg: toKg(weight.value, weight.unit), choices, birthApprox: true });
  return { db, pet };
}

describe('saving a large dog through onboarding', () => {
  it('the heaviest weight the stepper offers, in lb, completes setup with the weigh-in', async () => {
    // exactly what onboarding builds for a 120 kg dog when the owner uses pounds
    const { db, pet } = await setupBigDog({ value: savedValue(WEIGHT_MAX_KG, 'lb'), unit: 'lb', at: 1 });
    await finishSetup(db, pet.id);
    const m = await listMeasurements(db, pet.id);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ value: 264.6, unit: 'lb' });
    expect((await listSchedules(db, pet.id)).length).toBeGreaterThan(3);
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });

  it('a 210 lb mastiff (the reported case) completes setup', async () => {
    const { db, pet } = await setupBigDog({ value: 210, unit: 'lb', at: 1 });
    await finishSetup(db, pet.id);
    expect(await listMeasurements(db, pet.id)).toHaveLength(1);
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });

  it('a stuck setup from an older version with an impossible weight still finishes; only the weigh-in is left out', async () => {
    const { db, pet } = await setupBigDog({ value: 30, unit: 'kg', at: 1 });
    // simulate a pending record written by an older build with a value the rules reject
    const raw = JSON.parse((await getSetting(db, `setupPending:${pet.id}`))!);
    raw.weight = { value: 900, unit: 'lb', at: 1 };
    await setSetting(db, `setupPending:${pet.id}`, JSON.stringify(raw));
    expect(await recoverSetups(db)).toBe(1);
    expect(await listMeasurements(db, pet.id)).toHaveLength(0);
    expect((await listSchedules(db, pet.id)).length).toBeGreaterThan(3);
    expect(await getSetting(db, `profile:${pet.id}`)).toContain('giant');
    expect(await getSetting(db, `setupPending:${pet.id}`)).toBe('');
  });
});
