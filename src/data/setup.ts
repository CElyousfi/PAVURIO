/**
 * Creating a pet at the end of setup, recoverably.
 *
 * The pet row (with its plan) is created in one transaction by createPet. Everything that follows —
 * profile, first weigh-in, routines, guide stage — is written down FIRST as a "setup in progress" record
 * (setting `setupPending:<petId>`), then applied step by step, and the record is removed only when all
 * of it is done. Every step is idempotent. If the app is killed or a step fails, `recoverSetups` (run
 * on every start) finishes the job, so a pet can never stay half configured, and onboarding never
 * creates a second pet for the same setup.
 *
 * (Nested transactions aren't possible with expo-sqlite, and createPet / setPlan already use one, so a
 * single all-or-nothing transaction around the whole setup isn't available; this is the safe equivalent.)
 */
import { addMeasurement } from './careRepo';
import { setupLock } from './lock';
import { applyChoices, setProfile } from './autoPlan';
import type { Db } from './db';
import { NewPetInput, Pet, ValidationError, createPet, getPet, getSetting, listSettingsLike, setSetting } from './repo';
import { Choice, PetProfile, planBasis } from '../domain/carePlan';
import { ageInMonths, stageOf } from '../domain/lifeStage';

export type SetupWork = {
  profile: PetProfile;
  /** months the plan was built for (an estimate when the age was unknown) */
  months: number;
  /** the owner's own weigh-in, if they set one */
  weight: { value: number; unit: 'kg' | 'lb'; at: number } | null;
  /** weighed kg the plan used (null = estimated from size and age) */
  weighedKg: number | null;
  choices: Choice[];
  /** the birthday is an estimate from an age range */
  birthApprox: boolean;
};

const PENDING = (id: string) => `setupPending:${id}`;
export const DRAFT_KEY = 'onboardingDraft';

/** Creates the pet and records the rest of its setup as pending. Call finishSetup next. */
export async function startPetSetup(db: Db, input: NewPetInput, work: SetupWork): Promise<Pet> {
  // the pending record is written in the pet's own transaction: there is no moment where the pet
  // exists without it
  return createPet(db, input, Date.now(), { settings: (id) => ({ [PENDING(id)]: JSON.stringify(work) }) });
}

/** Applies a pending setup (idempotent). Throws if a step fails; the record stays for the next try.
 * One at a time (setupLock): onboarding and the reload that recovers setups can both ask for the
 * same pet; the second one then finds the setup done and does nothing. */
export function finishSetup(db: Db, petId: string): Promise<void> {
  return setupLock(() => finishSetupLocked(db, petId));
}

async function finishSetupLocked(db: Db, petId: string): Promise<void> {
  const raw = await getSetting(db, PENDING(petId));
  if (!raw) return;
  const work = JSON.parse(raw) as SetupWork;
  const pet = await getPet(db, petId);
  if (!pet) {
    await setSetting(db, PENDING(petId), '');
    return;
  }
  if (work.birthApprox && pet.birthDate) await setSetting(db, `birthApprox:${pet.id}`, '1');
  await setProfile(db, pet.id, work.profile);
  // a stable id: if the app stops right after saving it, the retry finds it and adds nothing
  // The weigh-in is optional: a value the rules reject (e.g. saved by an older version) must never
  // keep the rest of the setup from finishing. Nothing else is skipped; the owner can weigh later.
  if (work.weight) {
    try {
      await addMeasurement(db, { id: `setup-weight-${pet.id}`, petId: pet.id, kind: 'weight', value: work.weight.value, unit: work.weight.unit, at: work.weight.at });
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
    }
  }
  // routines + plan + portions: updates the same schedules on a retry, never duplicates them
  await applyChoices(db, pet, planBasis(pet.species, work.months, work.profile, work.weighedKg), work.choices);
  // the plan was just built for this age: no "new for this age" card on day one
  if (pet.birthDate) await setSetting(db, `guideStage:${pet.id}`, stageOf(pet.species, ageInMonths(pet.birthDate)));
  await setSetting(db, DRAFT_KEY, '');
  await setSetting(db, PENDING(petId), '');
}

/** Finishes any setup that was interrupted (app killed, error). Runs on every data load (cheap when
 * there is nothing pending), so a failed attempt is simply tried again. Returns how many finished. */
export async function recoverSetups(db: Db): Promise<number> {
  const rows = await listSettingsLike(db, 'setupPending:%');
  let n = 0;
  for (const r of rows) {
    if (!r.value) continue;
    try {
      await finishSetup(db, r.key.slice('setupPending:'.length));
      n++;
    } catch {
      // stays pending; tried again next start
    }
  }
  return n;
}

export async function hasPendingSetup(db: Db, petId: string): Promise<boolean> {
  return !!(await getSetting(db, PENDING(petId)));
}
