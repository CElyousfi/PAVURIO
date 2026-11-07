import { describe, expect, it } from 'vitest';
import { dailyFoodGrams, estimateWeightKg, planBasis, portionFor, recommendedChoice, targetsFor, timesFor, withCount, daysFor, inRange } from '../src/domain/carePlan';

import { migrate } from '../src/data/migrations';
import { createPet, getPlan, getPortions } from '../src/data/repo';
import { listSchedules, updateSchedule } from '../src/data/careRepo';
import { applyChoices, basisFor, dismissPlanNews, followGrowth, getPlanNews, setProfile } from '../src/data/autoPlan';
import { openNodeDb } from './helpers/nodeDb';

const find = (ts: ReturnType<typeof targetsFor>, care: string) => ts.find((t) => t.care === care)!;

describe('care plan', () => {
  it('estimates growing weights sensibly', () => {
    expect(estimateWeightKg('dog', 'medium', 36)).toBe(18);
    const pup = estimateWeightKg('dog', 'medium', 3);
    expect(pup).toBeGreaterThan(4);
    expect(pup).toBeLessThan(7);
    expect(estimateWeightKg('dog', 'giant', 6)).toBeLessThan(estimateWeightKg('dog', 'giant', 12));
    expect(estimateWeightKg('cat', 'average', 48)).toBe(4.5);
  });

  it('feeds an adult medium dog about 250–290 g of dry food a day', () => {
    const g = dailyFoodGrams('dog', 36, 18, 'dry').total;
    expect(g).toBeGreaterThan(240);
    expect(g).toBeLessThan(300);
  });

  it('feeds an adult 4.5 kg cat about 60–75 g of dry food, or 3 pouches of wet', () => {
    expect(dailyFoodGrams('cat', 48, 4.5, 'dry').total).toBeGreaterThan(58);
    expect(dailyFoodGrams('cat', 48, 4.5, 'dry').total).toBeLessThan(75);
    const wet = dailyFoodGrams('cat', 48, 4.5, 'wet').total;
    expect(wet).toBeGreaterThan(240);
    expect(wet).toBeLessThan(320);
  });

  it('splits the daily food across meals, with a range', () => {
    const ts = targetsFor(planBasis('dog', 36, { size: 'medium', food: 'dry' }));
    const meal = find(ts, 'meal');
    expect(meal.count.rec).toBe(2);
    const p = portionFor(meal, 2)!;
    expect(p.rec).toBeGreaterThan(120);
    expect(p.min).toBeLessThan(p.rec);
    expect(p.max).toBeGreaterThan(p.rec);
    // one meal a day = the whole amount in one go
    expect(portionFor(meal, 1)!.rec).toBeGreaterThan(p.rec * 1.8);
  });

  it('changes the plan when a puppy turns 6 months', () => {
    const at5 = targetsFor(planBasis('dog', 5, { size: 'large', food: 'dry' }));
    const at6 = targetsFor(planBasis('dog', 6, { size: 'large', food: 'dry' }));
    expect(find(at5, 'meal').count.rec).toBe(3);
    expect(find(at6, 'meal').count.rec).toBe(2);
    // portions get bigger: fewer meals and a bigger dog
    expect(portionFor(find(at6, 'meal'), 2)!.rec).toBeGreaterThan(portionFor(find(at5, 'meal'), 3)!.rec);
  });

  it('walks puppies about 5 minutes per month of age', () => {
    expect(portionFor(find(targetsFor(planBasis('dog', 4, { size: 'medium', food: 'dry' })), 'walk'), 2)!.rec).toBe(20);
    expect(portionFor(find(targetsFor(planBasis('dog', 2, { size: 'medium', food: 'dry' })), 'walk'), 3)!.rec).toBe(10);
    const adult = find(targetsFor(planBasis('dog', 36, { size: 'large', food: 'dry' })), 'walk');
    expect(adult.daily!.rec).toBe(90);
    expect(portionFor(adult, 2)!.rec).toBe(45);
  });

  it('only reminds for what is easy to forget', () => {
    const ts = targetsFor(planBasis('cat', 48, { size: 'average', food: 'wet' }));
    expect(find(ts, 'meal').remind).toBe(true);
    expect(find(ts, 'litter').remind).toBe(true);
    expect(find(ts, 'water').remind).toBe(false);
    expect(find(ts, 'play').remind).toBe(false);
    // flea, tick and worm prevention keeps a monthly rhythm, with a reminder
    const med = recommendedChoice(find(ts, 'medication'))!;
    expect(med.kind).toBe('interval');
    expect(med.count).toBe(4);
    expect(med.remind).toBe(true);
  });

  it('keeps the owner’s adjustment when the count changes', () => {
    const meal = find(targetsFor(planBasis('dog', 36, { size: 'medium', food: 'dry' })), 'meal');
    const c = recommendedChoice(meal)!;
    const bigger = { ...c, portion: Math.round(c.portion! * 1.2) };
    const three = withCount(meal, bigger, 3);
    expect(three.times).toHaveLength(3);
    expect(three.portion!).toBeGreaterThan(portionFor(meal, 3)!.rec);
    expect(inRange(portionFor(meal, 3)!, portionFor(meal, 3)!.rec)).toBe(true);
  });

  it('spreads times and days', () => {
    expect(timesFor('meal', 3)).toEqual(['07:30', '13:30', '19:00']);
    expect(timesFor('meal', 2, ['08:00', '18:00'])).toEqual(['08:00', '18:00']);
    expect(daysFor(2)).toEqual([1, 4]);
  });
});

describe('automatic plan follows the pet', () => {
  async function setup() {
    const db = openNodeDb();
    await migrate(db);
    // 5 months old on 7 Nov 2026
    const pet = await createPet(db, { species: 'dog', name: 'Biscuit', birthDate: '2026-06-07' });
    await setProfile(db, pet.id, { size: 'medium', food: 'dry' });
    const now = new Date(2026, 10, 7);
    const basis = (await basisFor(db, pet, now))!;
    const choices = targetsFor(basis).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c);
    await applyChoices(db, pet, basis, choices);
    return { db, pet, now };
  }

  it('sets everything up in one go', async () => {
    const { db, pet } = await setup();
    const s = await listSchedules(db, pet.id);
    expect(s.map((x) => x.type).sort()).toEqual(['grooming', 'meal', 'medication', 'play', 'walk', 'water']);
    expect(s.find((x) => x.type === 'medication')!.everyDays).toBe(28);
    expect(s.find((x) => x.type === 'meal')!.times).toHaveLength(3);
    expect(s.find((x) => x.type === 'water')!.remind).toBe(false);
    expect((await getPlan(db, pet.id)).meal).toBe(3);
    expect((await getPortions(db, pet.id)).meal).toBeGreaterThan(40);
  });

  it('moves to 2 bigger meals at 6 months', async () => {
    const { db, pet } = await setup();
    const before = (await getPortions(db, pet.id)).meal!;
    const changed = await followGrowth(db, pet, new Date(2026, 11, 8));
    expect(changed).toContain('meal');
    const meal = (await listSchedules(db, pet.id)).find((x) => x.type === 'meal')!;
    expect(meal.times).toHaveLength(2);
    expect((await getPortions(db, pet.id)).meal!).toBeGreaterThan(before);
    // grooming becomes a few days a week
    const groom = (await listSchedules(db, pet.id)).find((x) => x.type === 'grooming')!;
    expect(groom.days.length).toBeGreaterThan(0);
    // nothing more to do the same day
    expect(await followGrowth(db, pet, new Date(2026, 11, 8))).toEqual([]);
    // Home tells the owner, once
    const news = await getPlanNews(db, pet.id);
    expect(news?.choices.find((c) => c.care === 'meal')?.count).toBe(2);
    await dismissPlanNews(db, pet.id, Date.now() + 1000);
    expect(await getPlanNews(db, pet.id)).toBeNull();
  });

  it('never takes over a prescribed daily medicine', async () => {
    const db = openNodeDb();
    await migrate(db);
    const pet = await createPet(db, { species: 'cat', name: 'Mochi', birthDate: '2022-01-01' });
    const { createSchedule } = await import('../src/data/careRepo');
    await createSchedule(db, { petId: pet.id, type: 'medication', title: 'Thyroid pill', times: ['08:00', '20:00'] });
    const basis = (await basisFor(db, pet, new Date(2026, 10, 7)))!;
    await applyChoices(db, pet, basis, targetsFor(basis).map(recommendedChoice).filter((c): c is NonNullable<typeof c> => !!c));
    const meds = (await listSchedules(db, pet.id)).filter((x) => x.type === 'medication');
    expect(meds).toHaveLength(2);
    expect(meds.find((x) => x.title === 'Thyroid pill')!.times).toEqual(['08:00', '20:00']);
  });

  it('repeats every few weeks from the start day', async () => {
    const { appliesOn } = await import('../src/domain/schedule');
    const s = { id: 'x', petId: 'p', type: 'medication', title: 'P', times: ['19:00'], days: [], startDate: '2026-11-07', endDate: null, remind: true, enabled: true, everyDays: 28 };
    expect(appliesOn(s, '2026-11-07')).toBe(true);
    expect(appliesOn(s, '2026-11-08')).toBe(false);
    expect(appliesOn(s, '2026-12-05')).toBe(true);
  });

  it('keeps a count the owner changed', async () => {
    const { db, pet } = await setup();
    const meal = (await listSchedules(db, pet.id)).find((x) => x.type === 'meal')!;
    await updateSchedule(db, meal.id, { petId: pet.id, type: 'meal', title: meal.title, times: ['07:00', '11:00', '15:00', '19:00'] });
    await followGrowth(db, pet, new Date(2026, 11, 8));
    expect((await listSchedules(db, pet.id)).find((x) => x.type === 'meal')!.times).toHaveLength(4);
  });
});
