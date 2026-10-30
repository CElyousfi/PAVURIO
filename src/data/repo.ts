import { CARE, CareType, Species, careAllowedFor, clampAmount, isCareType } from '../domain/care';
import { Appearance, defaultAppearance, parseAppearance } from '../domain/appearance';
import { Plan } from '../domain/progress';
import { newId } from '../domain/ids';
import { Db } from './db';

export type Pet = {
  id: string;
  species: Species;
  name: string;
  appearance: Appearance;
  createdAt: number;
};

export type CareEvent = {
  id: string;
  petId: string;
  type: CareType;
  occurredAt: number;
  recordedAt: number;
  updatedAt: number;
  amount: number | null;
  unit: string | null;
  note: string | null;
  mutationId: string;
  voidedAt: number | null;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type PetRow = { id: string; species: Species; name: string; appearance_json: string; created_at: number };
type EventRow = {
  id: string;
  pet_id: string;
  type: string;
  occurred_at: number;
  recorded_at: number;
  updated_at: number;
  amount: number | null;
  unit: string | null;
  note: string | null;
  mutation_id: string;
  voided_at: number | null;
};

const toPet = (r: PetRow): Pet => ({
  id: r.id,
  species: r.species,
  name: r.name,
  appearance: parseAppearance(r.species, r.appearance_json),
  createdAt: r.created_at,
});

const toEvent = (r: EventRow): CareEvent => ({
  id: r.id,
  petId: r.pet_id,
  type: r.type as CareType,
  occurredAt: r.occurred_at,
  recordedAt: r.recorded_at,
  updatedAt: r.updated_at,
  amount: r.amount,
  unit: r.unit,
  note: r.note,
  mutationId: r.mutation_id,
  voidedAt: r.voided_at,
});

/** Allow small clock skew, but never accept care that "happens" in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_NAME = 40;
const MAX_NOTE = 500;

// ---------------------------------------------------------------- settings

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

// ---------------------------------------------------------------- pets

export type NewPetInput = {
  species: Species;
  name: string;
  appearance?: Appearance;
  plan?: Plan;
};

export function validatePetName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new ValidationError('Please give your pet a name.');
  if (trimmed.length > MAX_NAME) throw new ValidationError(`Names can be up to ${MAX_NAME} characters.`);
  return trimmed;
}

export async function createPet(db: Db, input: NewPetInput, now = Date.now()): Promise<Pet> {
  const name = validatePetName(input.name);
  const id = newId();
  const appearance = input.appearance ?? defaultAppearance(input.species);
  const plan = input.plan ?? defaultPlan(input.species);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO pets (id, species, name, appearance_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, input.species, name, JSON.stringify(appearance), now, now],
    );
    await writePlan(db, id, input.species, plan);
    await setSetting(db, 'activePetId', id);
  });
  return { id, species: input.species, name, appearance, createdAt: now };
}

export async function listPets(db: Db): Promise<Pet[]> {
  const rows = await db.getAllAsync<PetRow>(
    'SELECT id, species, name, appearance_json, created_at FROM pets WHERE archived_at IS NULL ORDER BY created_at',
    [],
  );
  return rows.map(toPet);
}

export async function getPet(db: Db, id: string): Promise<Pet | null> {
  const r = await db.getFirstAsync<PetRow>(
    'SELECT id, species, name, appearance_json, created_at FROM pets WHERE id = ? AND archived_at IS NULL',
    [id],
  );
  return r ? toPet(r) : null;
}

export async function getActivePet(db: Db): Promise<Pet | null> {
  const id = await getSetting(db, 'activePetId');
  if (id) {
    const p = await getPet(db, id);
    if (p) return p;
  }
  const all = await listPets(db);
  return all[0] ?? null;
}

export async function updatePet(
  db: Db,
  id: string,
  patch: { name?: string; appearance?: Appearance },
  now = Date.now(),
): Promise<void> {
  if (patch.name !== undefined) {
    const name = validatePetName(patch.name);
    await db.runAsync('UPDATE pets SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
  }
  if (patch.appearance) {
    await db.runAsync('UPDATE pets SET appearance_json = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(patch.appearance),
      now,
      id,
    ]);
  }
}

// ---------------------------------------------------------------- plans

export function defaultPlan(species: Species): Plan {
  const plan: Plan = {};
  for (const t of Object.values(CARE)) {
    if (careAllowedFor(species, t.type)) plan[t.type] = t.defaultTarget;
  }
  return plan;
}

async function writePlan(db: Db, petId: string, species: Species, plan: Plan): Promise<void> {
  await db.runAsync('DELETE FROM care_plans WHERE pet_id = ?', [petId]);
  for (const [type, target] of Object.entries(plan)) {
    if (!isCareType(type) || !careAllowedFor(species, type)) continue;
    const n = Math.max(0, Math.min(20, Math.round(target ?? 0)));
    await db.runAsync('INSERT INTO care_plans (pet_id, type, target_per_day) VALUES (?, ?, ?)', [petId, type, n]);
  }
}

export async function setPlan(db: Db, pet: Pet, plan: Plan): Promise<void> {
  await db.withTransactionAsync(() => writePlan(db, pet.id, pet.species, plan));
}

export async function getPlan(db: Db, petId: string): Promise<Plan> {
  const rows = await db.getAllAsync<{ type: string; target_per_day: number }>(
    'SELECT type, target_per_day FROM care_plans WHERE pet_id = ?',
    [petId],
  );
  const plan: Plan = {};
  for (const r of rows) if (isCareType(r.type)) plan[r.type] = r.target_per_day;
  return plan;
}

// ---------------------------------------------------------------- care events

export type LogCareInput = {
  petId: string;
  type: CareType;
  occurredAt: number;
  amount?: number | null;
  note?: string | null;
  /** Idempotency key: a retried / double-tapped save with the same key writes once. */
  mutationId: string;
};

export async function logCare(db: Db, input: LogCareInput, now = Date.now()): Promise<CareEvent> {
  const pet = await getPet(db, input.petId);
  if (!pet) throw new ValidationError('This pet no longer exists.');
  if (!isCareType(input.type) || !careAllowedFor(pet.species, input.type)) {
    throw new ValidationError(`${input.type} is not available for a ${pet.species}.`);
  }
  if (!Number.isFinite(input.occurredAt)) throw new ValidationError('Please choose a valid time.');
  if (input.occurredAt > now + FUTURE_TOLERANCE_MS) {
    throw new ValidationError("Care can't be logged in the future.");
  }
  const spec = CARE[input.type].amount;
  let amount: number | null = null;
  if (spec) {
    const raw = input.amount ?? spec.default;
    if (!Number.isFinite(raw) || raw < spec.min || raw > spec.max) {
      throw new ValidationError(`Amount must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
    }
    amount = clampAmount(input.type, raw);
  }
  const note = input.note?.trim() ? input.note.trim().slice(0, MAX_NOTE) : null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO care_events
         (id, pet_id, type, occurred_at, recorded_at, updated_at, amount, unit, note, source, mutation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)
       ON CONFLICT(mutation_id) DO NOTHING`,
      [newId(), pet.id, input.type, input.occurredAt, now, now, amount, spec?.unit ?? null, note, input.mutationId],
    );
  });
  const saved = await db.getFirstAsync<EventRow>('SELECT * FROM care_events WHERE mutation_id = ?', [input.mutationId]);
  if (!saved) throw new Error('The care record could not be saved.');
  return toEvent(saved);
}

export async function getEvent(db: Db, id: string): Promise<CareEvent | null> {
  const r = await db.getFirstAsync<EventRow>('SELECT * FROM care_events WHERE id = ?', [id]);
  return r ? toEvent(r) : null;
}

export async function listEventsBetween(db: Db, petId: string, start: number, end: number): Promise<CareEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM care_events
     WHERE pet_id = ? AND voided_at IS NULL AND occurred_at >= ? AND occurred_at < ?
     ORDER BY occurred_at DESC`,
    [petId, start, end],
  );
  return rows.map(toEvent);
}

export async function lastEvent(db: Db, petId: string): Promise<CareEvent | null> {
  const r = await db.getFirstAsync<EventRow>(
    'SELECT * FROM care_events WHERE pet_id = ? AND voided_at IS NULL ORDER BY occurred_at DESC LIMIT 1',
    [petId],
  );
  return r ? toEvent(r) : null;
}

export async function countAllEvents(db: Db, petId: string): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM care_events WHERE pet_id = ? AND voided_at IS NULL',
    [petId],
  );
  return r?.n ?? 0;
}

/** Soft-delete (used by Undo and Delete). Reversible with restoreEvent. */
export async function voidEvent(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE care_events SET voided_at = ?, updated_at = ? WHERE id = ? AND voided_at IS NULL', [
    now,
    now,
    id,
  ]);
}

export async function restoreEvent(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE care_events SET voided_at = NULL, updated_at = ? WHERE id = ?', [now, id]);
}

export async function updateEvent(
  db: Db,
  id: string,
  patch: { amount?: number | null; occurredAt?: number; note?: string | null },
  now = Date.now(),
): Promise<CareEvent> {
  const current = await getEvent(db, id);
  if (!current || current.voidedAt) throw new ValidationError('This record no longer exists.');
  const spec = CARE[current.type].amount;
  let amount = current.amount;
  if (patch.amount !== undefined && spec) {
    if (patch.amount == null || !Number.isFinite(patch.amount) || patch.amount < spec.min || patch.amount > spec.max) {
      throw new ValidationError(`Amount must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
    }
    amount = clampAmount(current.type, patch.amount);
  }
  let occurredAt = current.occurredAt;
  if (patch.occurredAt !== undefined) {
    if (!Number.isFinite(patch.occurredAt) || patch.occurredAt > now + FUTURE_TOLERANCE_MS) {
      throw new ValidationError("Care can't be logged in the future.");
    }
    occurredAt = patch.occurredAt;
  }
  const note = patch.note !== undefined ? (patch.note?.trim() ? patch.note.trim().slice(0, MAX_NOTE) : null) : current.note;
  await db.runAsync('UPDATE care_events SET amount = ?, occurred_at = ?, note = ?, updated_at = ? WHERE id = ?', [
    amount,
    occurredAt,
    note,
    now,
    id,
  ]);
  return { ...current, amount, occurredAt, note, updatedAt: now };
}

// ---------------------------------------------------------------- export / reset

export async function exportAll(db: Db): Promise<string> {
  const pets = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM pets', []);
  const plans = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM care_plans', []);
  const events = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM care_events WHERE voided_at IS NULL ORDER BY occurred_at',
    [],
  );
  return JSON.stringify({ app: 'pavurio', exportedAt: new Date().toISOString(), pets, plans, events }, null, 2);
}

export async function resetAll(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM care_events', []);
    await db.runAsync('DELETE FROM care_plans', []);
    await db.runAsync('DELETE FROM pets', []);
    await db.runAsync('DELETE FROM settings', []);
  });
}
