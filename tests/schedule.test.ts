import { buildStory, storyWindow } from '../src/domain/stories';
import { describe, expect, it } from 'vitest';
import {
  Schedule,
  appliesOn,
  describeDays,
  localInstant,
  matchOccurrence,
  nextUp,
  normalizeTimes,
  occurrencesForDay,
  planReminders,
} from '../src/domain/schedule';
import { migrate } from '../src/data/migrations';
import { createPet, logCare, voidEvent, exportAll, resetAll, archivePet, deletePet, listPets, getActivePet } from '../src/data/repo';
import {
  clearMarksForEvent,
  createAppointment,
  createSchedule,
  listSchedules,
  marksBetween,
  setMark,
  upcomingAppointments,
  addMeasurement,
  listMeasurements,
} from '../src/data/careRepo';
import { addAttachment, createMemory, createRecord, listMemories, listRecords, deleteRecord } from '../src/data/recordsRepo';
import { openNodeDb } from './helpers/nodeDb';

const base: Schedule = {
  id: 's1',
  petId: 'p',
  type: 'meal',
  title: 'Breakfast',
  times: ['08:00'],
  days: [],
  startDate: '2026-01-01',
  endDate: null,
  remind: true,
  enabled: true,
};

describe('schedule engine', () => {
  it('normalizes and sorts times, drops invalid ones', () => {
    expect(normalizeTimes(['18:00', '8:00', '25:00', 'x', '08:00'])).toEqual(['08:00', '18:00']);
  });

  it('respects weekdays, start and end dates and the enabled flag', () => {
    const weekdays = { ...base, days: [1, 2, 3, 4, 5] };
    expect(appliesOn(weekdays, '2026-11-02')).toBe(true); // Monday
    expect(appliesOn(weekdays, '2026-11-01')).toBe(false); // Sunday
    expect(appliesOn({ ...base, startDate: '2026-11-05' }, '2026-11-04')).toBe(false);
    expect(appliesOn({ ...base, endDate: '2026-11-05' }, '2026-11-06')).toBe(false);
    expect(appliesOn({ ...base, enabled: false }, '2026-11-04')).toBe(false);
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([])).toBe('Every day');
  });

  it('computes local wall-clock instants on DST change days (never +24h)', () => {
    // 29 March 2026 is the EU spring-forward day; 8:00 must still be 8:00 local
    const at = new Date(localInstant('2026-03-29', '08:00'));
    expect(at.getHours()).toBe(8);
    expect(at.getDate()).toBe(29);
  });

  it('derives statuses from time and marks', () => {
    const s = { ...base, times: ['08:00', '12:00', '18:00'] };
    const now = localInstant('2026-11-04', '12:10');
    const occ = occurrencesForDay([s], [{ scheduleId: 's1', key: 's1@2026-11-04T08:00', status: 'done', eventId: 'e', snoozeUntil: null }], '2026-11-04', now);
    expect(occ.map((o) => o.status)).toEqual(['done', 'due', 'upcoming']);
    const later = localInstant('2026-11-04', '13:30');
    expect(occurrencesForDay([s], [], '2026-11-04', later)[1].status).toBe('overdue');
    expect(nextUp(occurrencesForDay([s], [], '2026-11-04', later), later)?.time).toBe('08:00');
  });

  it('snoozing hides an occurrence until the snooze ends', () => {
    const now = localInstant('2026-11-04', '08:05');
    const snooze = now + 15 * 60_000;
    const occ = occurrencesForDay([base], [{ scheduleId: 's1', key: 's1@2026-11-04T08:00', status: 'snoozed', eventId: null, snoozeUntil: snooze }], '2026-11-04', now);
    expect(occ[0].status).toBe('snoozed');
    const after = occurrencesForDay([base], [{ scheduleId: 's1', key: 's1@2026-11-04T08:00', status: 'snoozed', eventId: null, snoozeUntil: snooze }], '2026-11-04', snooze + 1000);
    expect(after[0].status).toBe('due');
  });

  it('matches a manual log to the nearest open occurrence of the same type within 3 h', () => {
    const s = { ...base, times: ['08:00', '18:00'] };
    const occ = occurrencesForDay([s], [], '2026-11-04', localInstant('2026-11-04', '09:00'));
    expect(matchOccurrence(occ, 'meal', localInstant('2026-11-04', '08:40'))?.time).toBe('08:00');
    expect(matchOccurrence(occ, 'meal', localInstant('2026-11-04', '13:00'))).toBeNull();
    expect(matchOccurrence(occ, 'walk', localInstant('2026-11-04', '08:00'))).toBeNull();
  });

  it('plans reminders only for future, unmarked occurrences with reminders on', () => {
    const now = localInstant('2026-11-04', '09:00');
    const plans = planReminders([{ ...base, times: ['08:00', '18:00'] }, { ...base, id: 's2', remind: false, times: ['10:00'] }], [], 'Biscuit', now, 2);
    expect(plans.map((p) => new Date(p.at).getHours())).toEqual([18, 8, 18]);
    expect(plans[0].title).toBe('Breakfast for Biscuit');
  });
});

describe('care & records repositories (v2 schema)', () => {
  async function fresh() {
    const db = openNodeDb();
    await migrate(db);
    const pet = await createPet(db, { species: 'dog', name: 'Biscuit', birthDate: '2024-05-02', adoptionDate: '2024-07-10' });
    return { db, pet };
  }

  it('stores pet dates', async () => {
    const { pet } = await fresh();
    expect(pet.birthDate).toBe('2024-05-02');
  });

  it('creates schedules, marks occurrences and reopens them when the confirming event is undone', async () => {
    const { db, pet } = await fresh();
    const s = await createSchedule(db, { petId: pet.id, type: 'meal', title: 'Dinner', times: ['18:00', '8:00'] });
    expect(s.times).toEqual(['08:00', '18:00']);
    expect(await listSchedules(db, pet.id)).toHaveLength(1);
    const e = await logCare(db, { petId: pet.id, type: 'meal', occurredAt: Date.now(), mutationId: 'm' });
    await setMark(db, s.id, `${s.id}@2026-11-04T08:00`, 'done', { eventId: e.id });
    expect(await marksBetween(db, [s.id], '2026-11-04', '2026-11-04')).toHaveLength(1);
    await voidEvent(db, e.id);
    await clearMarksForEvent(db, e.id);
    expect(await marksBetween(db, [s.id], '2026-11-04', '2026-11-04')).toHaveLength(0);
  });

  it('rejects empty schedules', async () => {
    const { db, pet } = await fresh();
    await expect(createSchedule(db, { petId: pet.id, type: 'meal', title: ' ', times: ['08:00'] })).rejects.toThrow();
    await expect(createSchedule(db, { petId: pet.id, type: 'meal', title: 'x', times: ['99:00'] })).rejects.toThrow();
  });

  it('stores appointments, weights, records with attachments and memories; export includes them', async () => {
    const { db, pet } = await fresh();
    const now = Date.now();
    await createAppointment(db, { petId: pet.id, title: 'Vaccination', at: now + 86_400_000, remindMinutes: 60 });
    expect(await upcomingAppointments(db, pet.id, now)).toHaveLength(1);
    await addMeasurement(db, { petId: pet.id, kind: 'weight', value: 8.4, unit: 'kg', at: now });
    await expect(addMeasurement(db, { petId: pet.id, kind: 'weight', value: -1, unit: 'kg', at: now })).rejects.toThrow();
    expect((await listMeasurements(db, pet.id))[0].value).toBe(8.4);
    const rid = await createRecord(db, { petId: pet.id, kind: 'vaccine', title: 'Rabies', date: '2026-10-01', dueDate: '2027-10-01', source: 'vet_document' });
    await addAttachment(db, 'record', rid, { uri: 'file:///cert.pdf', mime: 'application/pdf', name: 'cert.pdf' });
    const recs = await listRecords(db, pet.id);
    expect(recs[0].attachments).toHaveLength(1);
    await createMemory(db, { petId: pet.id, title: 'First beach day', date: '2026-08-12', kind: 'milestone' });
    expect(await listMemories(db, pet.id)).toHaveLength(1);
    const json = JSON.parse(await exportAll(db));
    expect(json.schema).toBe(3);
    expect(json.records).toHaveLength(1);
    expect(json.memories).toHaveLength(1);
    await deleteRecord(db, rid);
    expect(await listRecords(db, pet.id)).toHaveLength(0);
    await resetAll(db);
    expect(await listPets(db)).toHaveLength(0);
  });

  it('archives and deletes pets and moves the active pet', async () => {
    const { db, pet } = await fresh();
    const second = await createPet(db, { species: 'cat', name: 'Mochi' });
    expect((await getActivePet(db))?.id).toBe(second.id);
    await archivePet(db, second.id);
    expect((await getActivePet(db))?.id).toBe(pet.id);
    await createRecord(db, { petId: pet.id, kind: 'allergy', title: 'Chicken', date: '2026-01-01' });
    await deletePet(db, pet.id);
    expect(await listPets(db)).toHaveLength(0);
    const leftover = await db.getAllAsync('SELECT * FROM records', []);
    expect(leftover).toHaveLength(0);
  });
});


describe('stories', () => {
  const at = (day: string, h = 9) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d, h).getTime();
  };
  const base = { petName: 'Milo', range: 'week' as const, endDay: '2026-10-30', plan: { meal: 2 }, photos: [], weights: [], weightUnit: 'kg', visits: [] };

  it('is not offered without enough real logs', () => {
    expect(buildStory({ ...base, events: [{ type: 'meal', occurredAt: at('2026-10-30'), amount: 1 }] })).toBeNull();
  });

  it('counts only the window and fully-colored days', () => {
    const events = [
      { type: 'meal' as const, occurredAt: at('2026-10-30', 8), amount: 1 },
      { type: 'meal' as const, occurredAt: at('2026-10-30', 18), amount: 1 },
      { type: 'meal' as const, occurredAt: at('2026-10-29', 8), amount: 1 },
      { type: 'walk' as const, occurredAt: at('2026-10-28', 8), amount: 25 },
      { type: 'walk' as const, occurredAt: at('2026-10-01', 8), amount: 25 }, // outside the week
    ];
    const s = buildStory({ ...base, events })!;
    expect(s[0]).toMatchObject({ kind: 'cover', title: "Milo's week" });
    const totals = s.find((x) => x.kind === 'totals') as Extract<(typeof s)[number], { kind: 'totals' }>;
    expect(totals.items).toEqual([
      { type: 'meal', count: 3, minutes: null },
      { type: 'walk', count: 1, minutes: 25 },
    ]);
    expect(s.find((x) => x.kind === 'streak')).toMatchObject({ fullDays: 1, activeDays: 3, totalDays: 7 });
    expect(s[s.length - 1].kind).toBe('outro');
  });

  it('windows are inclusive', () => {
    expect(storyWindow('week', '2026-10-30')).toEqual({ from: '2026-10-24', to: '2026-10-30', days: 7 });
  });
});

describe('new routines', () => {
  it("don't report times that had already passed when the routine was created as missed", () => {
    const day = '2026-10-31';
    const [y, m, d] = day.split('-').map(Number);
    const createdAt = new Date(y, m - 1, d, 12, 0).getTime();
    const s: Schedule = { id: 's1', petId: 'p', type: 'meal', title: 'Meals', times: ['08:00', '11:45', '18:00'], days: [], startDate: day, endDate: null, remind: true, enabled: true, createdAt };
    const occ = occurrencesForDay([s], [], day, createdAt + 60_000);
    expect(occ.map((o) => o.time)).toEqual(['11:45', '18:00']);
    // the next day everything shows
    expect(occurrencesForDay([s], [], '2026-11-01', createdAt).length).toBe(3);
  });
});
