import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, getPlan, getPortions, listEventsBetween, setPlan } from '../src/data/repo';
import { listMemories } from '../src/data/recordsRepo';
import {
  applyLockScreenState,
  deleteWalk,
  discardWalk,
  editWalk,
  finishWalk,
  getLiveWalk,
  getWalk,
  listWalkBadges,
  listWalks,
  pauseWalk,
  recoverWalks,
  removeCareEvent,
  resumeWalk,
  startWalk,
} from '../src/data/walkRepo';
import { MIN_VALID_MS, earnedBadges, elapsedMs, isSpring, timeOfDay, walkStats, type Walk } from '../src/domain/walks';
import { conditionFromWmo, placeOnlySnapshot, snapshotFromOpenMeteo, walkAdvice, type WeatherSnapshot } from '../src/domain/weather';
import { careFill, dailyGoal, computeProgress } from '../src/domain/progress';
import { openNodeDb } from './helpers/nodeDb';

async function setup() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const pet = await createPet(db, { species: 'dog', name: 'Honey' });
  return { db, pet };
}

const MIN = 60_000;
const at = (y: number, mo: number, d: number, h: number, m = 0) => new Date(y, mo - 1, d, h, m).getTime();

function weather(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return { ...placeOnlySnapshot({ name: 'Lyon', country: 'France', lat: 45.76, lon: 4.84, tz: 'Europe/Paris' }, 0)!, available: true, tempC: 18, code: 3, condition: 'cloudy', isDay: true, ...over };
}

describe('walk timer', () => {
  it('measures from stored timestamps across pauses (no running clock needed)', async () => {
    const { db, pet } = await setup();
    const t0 = at(2026, 4, 10, 8);
    const w = await startWalk(db, pet.id, null, t0);
    await pauseWalk(db, w.id, t0 + 10 * MIN);
    // the phone was locked for a long time while paused: none of it counts
    await resumeWalk(db, w.id, t0 + 40 * MIN);
    const live = (await getWalk(db, w.id))!;
    expect(elapsedMs(live, t0 + 50 * MIN)).toBe(20 * MIN);
    const r = await finishWalk(db, w.id, { now: t0 + 55 * MIN });
    expect(r.walk.status).toBe('completed');
    expect(r.walk.durationMs).toBe(25 * MIN);
  });

  it('never starts two walks for one pet, and recovers the one in progress', async () => {
    const { db, pet } = await setup();
    const a = await startWalk(db, pet.id, null, 1_000);
    const b = await startWalk(db, pet.id, null, 2_000);
    expect(b.id).toBe(a.id);
    expect((await getLiveWalk(db, pet.id))?.id).toBe(a.id);
  });

  it('a double Finish saves once: one care event, one memory', async () => {
    const { db, pet } = await setup();
    const t0 = at(2026, 4, 10, 9);
    const w = await startWalk(db, pet.id, null, t0);
    const [r1, r2] = await Promise.all([finishWalk(db, w.id, { now: t0 + 30 * MIN }), finishWalk(db, w.id, { now: t0 + 31 * MIN })]);
    expect(r1.walk.id).toBe(r2.walk.id);
    const events = await listEventsBetween(db, pet.id, 0, t0 + 3600 * MIN);
    expect(events.filter((e) => e.type === 'walk')).toHaveLength(1);
    expect((await listMemories(db, pet.id)).filter((m) => m.kind === 'adventure')).toHaveLength(1);
    // finishing again later changes nothing
    await finishWalk(db, w.id, { now: t0 + 90 * MIN });
    expect((await getWalk(db, w.id))!.durationMs).toBe(30 * MIN);
  });

  it('finishes a walk interrupted mid-save without duplicates', async () => {
    const { db, pet } = await setup();
    const t0 = at(2026, 4, 10, 9);
    const w = await startWalk(db, pet.id, null, t0);
    // simulate a crash right after the status moved to completing
    await db.runAsync("UPDATE walks SET status = 'completing', finished_at = ?, duration_ms = ? WHERE id = ?", [t0 + 20 * MIN, 20 * MIN, w.id]);
    await recoverWalks(db);
    await recoverWalks(db);
    expect((await getWalk(db, w.id))!.status).toBe('completed');
    expect((await listEventsBetween(db, pet.id, 0, t0 + 3600 * MIN)).filter((e) => e.type === 'walk')).toHaveLength(1);
  });

  it('applies lock-screen presses with their own times, finishing with the real end', async () => {
    const { db, pet } = await setup();
    const t0 = at(2026, 4, 10, 17);
    const w = await startWalk(db, pet.id, null, t0);
    await applyLockScreenState(db, w.id, { status: 'paused', pausedAt: t0 + 15 * MIN, pausedMs: 0 }, t0 + 40 * MIN);
    const r = await finishWalk(db, w.id, { now: t0 + 60 * MIN, endAt: t0 + 50 * MIN });
    // paused at 15 min and never resumed: 15 minutes of walking
    expect(r.walk.durationMs).toBe(15 * MIN);
  });

  it('a discarded walk saves nothing', async () => {
    const { db, pet } = await setup();
    const w = await startWalk(db, pet.id, null, 1000);
    await discardWalk(db, w.id);
    expect(await getLiveWalk(db, pet.id)).toBeNull();
    await expect(finishWalk(db, w.id)).rejects.toThrow();
    expect(await listWalks(db, pet.id)).toHaveLength(0);
  });
});

describe('passport badges', () => {
  it('awards each badge once, and only with real data', async () => {
    const { db, pet } = await setup();
    // an early, cloudy spring walk (northern hemisphere, April)
    const t0 = at(2026, 4, 10, 7);
    const w = await startWalk(db, pet.id, weather(), t0);
    const r = await finishWalk(db, w.id, { now: t0 + 20 * MIN });
    expect(new Set(r.newBadges)).toEqual(new Set(['first', 'early', 'cloud', 'spring']));
    // no weather at all: no weather badges, no golden hour, no spring
    const t1 = at(2026, 4, 11, 19);
    const w2 = await startWalk(db, pet.id, null, t1);
    const r2 = await finishWalk(db, w2.id, { now: t1 + 20 * MIN });
    expect(r2.newBadges).toEqual([]);
    expect((await listWalkBadges(db, pet.id)).map((b) => b.badge).sort()).toEqual(['cloud', 'early', 'first', 'spring']);
  });

  it('golden hour needs a real sunset; spring follows the hemisphere', () => {
    const base = { id: 'x', petId: 'p', status: 'completed', pausedAt: null, pausedMs: 0, tz: null, weatherAt: null, photoUri: null, note: null, eventId: null, memoryId: null, syncStatus: 'local', createdAt: 0, updatedAt: 0 } as const;
    const start = at(2026, 10, 1, 18, 30);
    const golden: Walk = { ...base, startedAt: start, finishedAt: start + 30 * MIN, durationMs: 30 * MIN, weather: weather({ sunset: start + 40 * MIN, lat: -33.9 }) };
    const noSunset: Walk = { ...golden, id: 'y', weather: weather({ sunset: null }) };
    expect(earnedBadges([golden]).has('golden')).toBe(true);
    expect(earnedBadges([noSunset]).has('golden')).toBe(false);
    // October is spring in Sydney, autumn in Lyon
    expect(isSpring(start, -33.9)).toBe(true);
    expect(isSpring(start, 45.7)).toBe(false);
    expect(isSpring(start, null)).toBeNull();
    expect(timeOfDay(start, start + 30 * MIN, start + 40 * MIN)).toBe('golden');
  });

  it('count badges come with the 5th / 10th walk, short walks don’t count, delete takes them back', async () => {
    const { db, pet } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = at(2026, 7, 1 + i, 14);
      const w = await startWalk(db, pet.id, null, t0);
      await finishWalk(db, w.id, { now: t0 + 20 * MIN });
      ids.push(w.id);
    }
    // a 1-minute accidental walk isn't the 6th adventure for badges
    const t9 = at(2026, 7, 9, 14);
    const tiny = await startWalk(db, pet.id, null, t9);
    await finishWalk(db, tiny.id, { now: t9 + MIN });
    expect((await getWalk(db, tiny.id))!.durationMs! < MIN_VALID_MS).toBe(true);
    expect((await listWalkBadges(db, pet.id)).map((b) => b.badge).sort()).toEqual(['first', 'five']);
    await deleteWalk(db, ids[2]);
    expect((await listWalkBadges(db, pet.id)).map((b) => b.badge)).toEqual(['first']);
    // and its care event and memory are gone too
    expect((await listMemories(db, pet.id)).filter((m) => m.kind === 'adventure')).toHaveLength(5);
  });

  it('editing the duration keeps the care log in step; deleting the care event deletes the walk', async () => {
    const { db, pet } = await setup();
    const t0 = at(2026, 7, 1, 14);
    const w = await startWalk(db, pet.id, null, t0);
    const { walk } = await finishWalk(db, w.id, { now: t0 + 300 * MIN });
    await editWalk(db, walk.id, { durationMs: 35 * MIN, note: 'Forgot to stop it' });
    const ev = (await listEventsBetween(db, pet.id, 0, t0 + 3600 * MIN)).find((e) => e.type === 'walk')!;
    expect(ev.amount).toBe(35);
    expect(ev.note).toBe('Forgot to stop it');
    await removeCareEvent(db, ev.id);
    expect(await getWalk(db, w.id)).toBeNull();
    expect(walkStats(await listWalks(db, pet.id), t0).total).toBe(0);
  });

  it('keeps pets apart', async () => {
    const { db, pet } = await setup();
    const other = await createPet(db, { species: 'dog', name: 'Max' });
    const t0 = at(2026, 7, 1, 14);
    const w = await startWalk(db, pet.id, null, t0);
    await finishWalk(db, w.id, { now: t0 + 20 * MIN });
    expect(await listWalks(db, other.id)).toHaveLength(0);
    expect(await listWalkBadges(db, other.id)).toHaveLength(0);
  });
});

describe('weather', () => {
  it('maps WMO codes and never cheers in danger', () => {
    expect(conditionFromWmo(0)).toBe('sunny');
    expect(conditionFromWmo(3)).toBe('cloudy');
    expect(conditionFromWmo(63)).toBe('rain');
    expect(conditionFromWmo(95)).toBe('storm');
    expect(walkAdvice(weather({ tempC: 33, condition: 'sunny' })).level).toBe('danger');
    expect(walkAdvice(weather({ condition: 'storm' })).level).toBe('danger');
    expect(walkAdvice(null).level).toBe('ok');
  });

  it('reads the provider response', () => {
    const now = at(2026, 4, 10, 12);
    const s = snapshotFromOpenMeteo(
      {
        timezone: 'Europe/Paris',
        current: { time: now / 1000, temperature_2m: 14.2, weather_code: 2, is_day: 1, wind_speed_10m: 9 },
        hourly: { time: [now / 1000 - 3600, now / 1000], precipitation_probability: [5, 10] },
        daily: { time: [now / 1000], sunrise: [now / 1000 - 5 * 3600], sunset: [now / 1000 + 8 * 3600] },
      },
      { name: 'Lyon', country: 'France', lat: 45.76, lon: 4.84, tz: null },
      now,
    );
    expect(s.available).toBe(true);
    expect(s.condition).toBe('partly');
    expect(s.rainChance).toBe(10);
    expect(s.sunset).toBe(now + 8 * 3600_000);
  });
});

describe('goals from the owner’s plan', () => {
  it('fills toward times × portion, so each pet fills its own way', async () => {
    const { db, pet } = await setup();
    await setPlan(db, pet, { ...(await getPlan(db, pet.id)), meal: 2 }, { meal: 150 });
    expect(await getPortions(db, pet.id)).toEqual({ meal: 150 });
    const plan = await getPlan(db, pet.id);
    const portions = await getPortions(db, pet.id);
    expect(dailyGoal('meal', plan, portions)).toBe(300);
    const ev = [{ type: 'meal' as const, occurredAt: 1, amount: 150 }];
    expect(careFill('meal', plan, portions, ev)).toBe(0.5);
    // a usual meal is exactly one band
    expect(computeProgress(plan, ev, portions).weights).toEqual([1]);
    // changing the plan keeps the portions
    await setPlan(db, pet, { ...plan, meal: 3 });
    expect(await getPortions(db, pet.id)).toEqual({ meal: 150 });
  });
});
