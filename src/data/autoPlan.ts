/**
 * The automatic plan, stored: the pet's profile (size, food), and a snapshot of what the plan was built
 * from (age, weight, profile) and what was applied. When the pet grows, gets weighed, or its profile
 * changes, `followGrowth` moves the routines along:
 * - a count the owner left at the recommendation follows the new one (3 meals → 2 at 6 months);
 *   a count they changed stays theirs;
 * - portions keep the owner's own adjustment (10% more than recommended stays 10% more);
 * - routines they deleted stay deleted.
 */
import { planLock } from './lock';
import { CARE, CareType } from '../domain/care';
import { Choice, PetProfile, PlanBasis, Target, daysFor, defaultProfile, planBasis, portionFor, scalePortion, targetsFor, timesFor } from '../domain/carePlan';
import { ageInMonths } from '../domain/lifeStage';
import type { Schedule } from '../domain/schedule';
import { createSchedule, deleteSchedule, listMeasurements, listSchedules, updateSchedule } from './careRepo';
import type { Db } from './db';
import { t } from '../i18n/core';
import { getPlan, getPortions, getSetting, listPets, setPlan, setSetting, type Pet } from './repo';

const PROFILE = (id: string) => `profile:${id}`;
const SNAP = (id: string) => `autoPlan:${id}`;
const NEWS = (id: string) => `planNews:${id}`;
const NEWS_SEEN = (id: string) => `planNewsSeen:${id}`;

/** The last automatic change to the plan, shown once on Home. */
export type PlanNews = { at: number; months: number; choices: Choice[] };

export async function getPlanNews(db: Db, petId: string): Promise<PlanNews | null> {
  const n = parse<PlanNews>(await getSetting(db, NEWS(petId)));
  if (!n) return null;
  const seen = Number((await getSetting(db, NEWS_SEEN(petId))) ?? 0);
  return n.at > seen ? n : null;
}

export async function dismissPlanNews(db: Db, petId: string, now = Date.now()): Promise<void> {
  const n = parse<PlanNews>(await getSetting(db, NEWS(petId)));
  await setSetting(db, NEWS_SEEN(petId), String(Math.max(now, n?.at ?? 0)));
}
const LB = 0.45359237;

type Applied = { kind: 'daily' | 'weekly' | 'interval'; scheduleId: string };
type Snapshot = { basis: { months: number; kg: number | null; profile: PetProfile }; cares: Partial<Record<CareType, Applied>> };

function parse<T>(s: string | null): T | null {
  try {
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export async function getProfile(db: Db, pet: Pet): Promise<PetProfile> {
  const p = parse<PetProfile>(await getSetting(db, PROFILE(pet.id)));
  return p ? { ...defaultProfile(pet.species), ...p } : defaultProfile(pet.species);
}

export async function hasProfile(db: Db, petId: string): Promise<boolean> {
  return (await getSetting(db, PROFILE(petId))) != null;
}

export async function setProfile(db: Db, petId: string, p: PetProfile): Promise<void> {
  await setSetting(db, PROFILE(petId), JSON.stringify(p));
}

/** The latest weigh-in in kg; for a growing pet only if it's recent (they change every few weeks). */
export async function weighedKg(db: Db, pet: Pet, months: number, now = Date.now()): Promise<number | null> {
  const list = await listMeasurements(db, pet.id);
  const last = list[list.length - 1];
  if (!last) return null;
  if (months < 12 && now - last.at > 45 * 86_400_000) return null;
  return last.unit === 'lb' ? last.value * LB : last.value;
}

/** What the plan is built from today, or null while the age is unknown. */
export async function basisFor(db: Db, pet: Pet, now = new Date()): Promise<PlanBasis | null> {
  if (!pet.birthDate) return null;
  const months = ageInMonths(pet.birthDate, now);
  return planBasis(pet.species, months, await getProfile(db, pet), await weighedKg(db, pet, months, now.getTime()));
}

/** The routine a choice writes to: the one it made before, else the owner's own of the same kind
 * (a prescribed daily medicine is never taken over by the prevention rhythm, and the other way round). */
export function scheduleFor(list: Schedule[], care: CareType, id?: string, kind?: Choice['kind']): Schedule | undefined {
  const byId = id ? list.find((s) => s.id === id) : undefined;
  if (byId) return byId;
  return list.find((s) => s.type === care && (kind === 'interval' ? !!s.everyDays : !s.everyDays));
}

/** Writes the owner's choices: one routine per care (created, updated or removed), the plan and portions.
 * One writer at a time (planLock): two at once could create the same routine twice. */
export function applyChoices(db: Db, pet: Pet, basis: PlanBasis, choices: Choice[]): Promise<void> {
  return planLock(() => writeChoices(db, pet, basis, choices));
}

async function writeChoices(db: Db, pet: Pet, basis: PlanBasis, choices: Choice[]): Promise<void> {
  const list = await listSchedules(db, pet.id);
  const snap = parse<Snapshot>(await getSetting(db, SNAP(pet.id))) ?? { basis: { months: 0, kg: null, profile: basis.profile }, cares: {} };
  const plan = await getPlan(db, pet.id);
  const portions = await getPortions(db, pet.id);
  for (const c of choices) {
    const ex = scheduleFor(list, c.care, snap.cares[c.care]?.scheduleId, c.kind);
    if (!c.on) {
      if (ex) await deleteSchedule(db, ex.id);
      plan[c.care] = 0;
      delete snap.cares[c.care];
      continue;
    }
    const weekly = c.kind === 'weekly';
    const interval = c.kind === 'interval';
    const input = {
      petId: pet.id,
      type: c.care,
      title: ex?.title || (interval && c.care === 'medication' ? t('Parasite prevention') : CARE[c.care].label),
      times: weekly || interval ? [c.times[0] ?? '19:00'] : c.times,
      days: weekly ? c.days : [],
      remind: c.remind,
      everyDays: interval ? c.count * 7 : null,
    };
    let id: string;
    if (ex) {
      await updateSchedule(db, ex.id, { ...input, startDate: ex.startDate, endDate: ex.endDate, enabled: true });
      id = ex.id;
    } else id = (await createSchedule(db, input)).id;
    plan[c.care] = c.kind === 'daily' ? c.count : 0;
    if (c.portion != null && c.portion > 0) portions[c.care] = c.portion;
    snap.cares[c.care] = { kind: c.kind, scheduleId: id };
  }
  snap.basis = { months: basis.months, kg: basis.weighed ? basis.kg : null, profile: basis.profile };
  await setPlan(db, pet, plan, portions);
  await setSetting(db, SNAP(pet.id), JSON.stringify(snap));
}

export async function hasAutoPlan(db: Db, petId: string): Promise<boolean> {
  const s = parse<Snapshot>(await getSetting(db, SNAP(petId)));
  return !!s && Object.keys(s.cares).length > 0;
}

/** Moves the routines along with the pet (see the file comment). Returns the cares that changed.
 * Reads and writes under planLock, so it never works from a plan another writer is changing. */
export function followGrowth(db: Db, pet: Pet, now = new Date()): Promise<CareType[]> {
  return planLock(() => followGrowthLocked(db, pet, now));
}

async function followGrowthLocked(db: Db, pet: Pet, now: Date): Promise<CareType[]> {
  // a pet whose setup hasn't finished yet is left to the setup (src/data/setup.ts)
  if (await getSetting(db, `setupPending:${pet.id}`)) return [];
  const snap = parse<Snapshot>(await getSetting(db, SNAP(pet.id)));
  if (!snap || Object.keys(snap.cares).length === 0) return [];
  const basis = await basisFor(db, pet, now);
  if (!basis) return [];
  const oldTargets = targetsFor(planBasis(pet.species, snap.basis.months, snap.basis.profile, snap.basis.kg));
  const newTargets = targetsFor(basis);
  const list = await listSchedules(db, pet.id);
  const portions = await getPortions(db, pet.id);
  const choices: Choice[] = [];
  for (const [care, applied] of Object.entries(snap.cares) as [CareType, Applied][]) {
    const ot = oldTargets.find((t) => t.care === care);
    const nt = newTargets.find((t) => t.care === care);
    const s = list.find((x) => x.id === applied.scheduleId);
    if (!ot || !nt || nt.kind === 'visit' || !s) continue;
    const curCount = applied.kind === 'interval' ? Math.max(1, Math.round((s.everyDays ?? 7) / 7)) : applied.kind === 'weekly' ? s.days.length || 7 : s.times.length;
    if (!changed(ot, nt, curCount)) continue;
    const follow = curCount === ot.count.rec && applied.kind === ot.kind;
    const kind = follow ? nt.kind : applied.kind;
    const count = follow ? nt.count.rec : curCount;
    const regen = follow && (count !== curCount || kind !== applied.kind);
    const times = regen ? (kind === 'weekly' || kind === 'interval' ? [nt.times[0] ?? s.times[0] ?? '19:00'] : timesFor(care, count, nt.times)) : s.times;
    const days = kind === 'weekly' ? (regen ? daysFor(count, nt.days) : s.days) : [];
    const cur = portions[care];
    const oldRec = portionFor(ot, curCount)?.rec;
    const newRec = portionFor(nt, count)?.rec ?? null;
    const portion = cur != null && oldRec && newRec ? scalePortion(care, cur, oldRec, newRec) : newRec;
    choices.push({ care, kind: kind as Choice['kind'], on: true, count, portion, times, days, remind: s.remind });
  }
  if (choices.length) {
    await writeChoices(db, pet, basis, choices);
    // tell the owner on Home what changed (the card stays until they've seen it)
    await setSetting(db, NEWS(pet.id), JSON.stringify({ at: now.getTime(), months: basis.months, choices } satisfies PlanNews));
  }
  return choices.map((c) => c.care);
}

function changed(ot: Target, nt: Target, count: number): boolean {
  if (ot.kind !== nt.kind || ot.count.rec !== nt.count.rec) return true;
  return portionFor(ot, count)?.rec !== portionFor(nt, count)?.rec;
}

/** followGrowth for every pet (on start and after changes); true when anything moved. */
export async function followAll(db: Db, now = new Date()): Promise<boolean> {
  let any = false;
  for (const p of await listPets(db)) if ((await followGrowth(db, p, now)).length) any = true;
  return any;
}
