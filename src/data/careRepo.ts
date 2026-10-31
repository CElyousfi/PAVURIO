/** Schedules, marks, appointments and measurements. */
import { Db } from './db';
import { newId } from '../domain/ids';
import { Mark, MarkStatus, Schedule, normalizeTimes } from '../domain/schedule';
import { ValidationError } from './repo';
import { dayKeyOf } from '../domain/time';
import { t } from '../i18n/core';

// ---------------------------------------------------------------- schedules

type ScheduleRow = {
  id: string;
  pet_id: string;
  type: string;
  title: string;
  times_json: string;
  days_json: string;
  start_date: string;
  end_date: string | null;
  remind: number;
  enabled: number;
  created_at: number;
};

const toSchedule = (r: ScheduleRow): Schedule => ({
  id: r.id,
  petId: r.pet_id,
  type: r.type,
  title: r.title,
  times: safeJson<string[]>(r.times_json, []),
  days: safeJson<number[]>(r.days_json, []),
  startDate: r.start_date,
  endDate: r.end_date,
  remind: !!r.remind,
  enabled: !!r.enabled,
  createdAt: r.created_at,
});

function safeJson<T>(s: string | null, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export type ScheduleInput = {
  petId: string;
  type: string;
  title: string;
  times: string[];
  days?: number[];
  startDate?: string;
  endDate?: string | null;
  remind?: boolean;
  enabled?: boolean;
};

function validateSchedule(input: ScheduleInput) {
  const title = input.title.trim();
  if (!title) throw new ValidationError(t('Give the reminder a name.'));
  if (title.length > 60) throw new ValidationError(t('Names can be up to 60 characters.'));
  const times = normalizeTimes(input.times);
  if (times.length === 0) throw new ValidationError(t('Add at least one time.'));
  if (times.length > 12) throw new ValidationError(t('Up to 12 times a day.'));
  const days = [...new Set((input.days ?? []).filter((d) => d >= 0 && d <= 6))].sort();
  if (input.endDate && input.startDate && input.endDate < input.startDate) {
    throw new ValidationError(t('The end date is before the start date.'));
  }
  return { title, times, days: days.length === 7 ? [] : days };
}

export async function createSchedule(db: Db, input: ScheduleInput, now = Date.now()): Promise<Schedule> {
  const v = validateSchedule(input);
  const id = newId();
  const start = input.startDate ?? dayKeyOf(new Date(now));
  await db.runAsync(
    `INSERT INTO schedules (id, pet_id, type, title, times_json, days_json, start_date, end_date, remind, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.petId, input.type, v.title, JSON.stringify(v.times), JSON.stringify(v.days), start, input.endDate ?? null, input.remind === false ? 0 : 1, input.enabled === false ? 0 : 1, now, now],
  );
  return { id, petId: input.petId, type: input.type, title: v.title, times: v.times, days: v.days, startDate: start, endDate: input.endDate ?? null, remind: input.remind !== false, enabled: input.enabled !== false, createdAt: now };
}

export async function updateSchedule(db: Db, id: string, input: ScheduleInput, now = Date.now()): Promise<void> {
  const v = validateSchedule(input);
  await db.runAsync(
    `UPDATE schedules SET type = ?, title = ?, times_json = ?, days_json = ?, start_date = COALESCE(?, start_date), end_date = ?, remind = ?, enabled = ?, updated_at = ? WHERE id = ?`,
    [input.type, v.title, JSON.stringify(v.times), JSON.stringify(v.days), input.startDate ?? null, input.endDate ?? null, input.remind === false ? 0 : 1, input.enabled === false ? 0 : 1, now, id],
  );
}

export async function deleteSchedule(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM schedules WHERE id = ?', [id]);
}

export async function listSchedules(db: Db, petId: string): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>('SELECT * FROM schedules WHERE pet_id = ? ORDER BY created_at', [petId]);
  return rows.map(toSchedule);
}

export async function listAllSchedules(db: Db): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    'SELECT s.* FROM schedules s JOIN pets p ON p.id = s.pet_id WHERE p.archived_at IS NULL ORDER BY s.created_at',
    [],
  );
  return rows.map(toSchedule);
}

// ---------------------------------------------------------------- marks

type MarkRow = { schedule_id: string; occurrence_key: string; status: MarkStatus; event_id: string | null; snooze_until: number | null };

export async function marksBetween(db: Db, scheduleIds: string[], fromDay: string, toDay: string): Promise<Mark[]> {
  if (scheduleIds.length === 0) return [];
  const q = scheduleIds.map(() => '?').join(',');
  // occurrence keys are "<id>@YYYY-MM-DDTHH:MM", so a lexical range on the date part works per schedule
  const rows = await db.getAllAsync<MarkRow>(
    `SELECT * FROM schedule_marks WHERE schedule_id IN (${q}) AND substr(occurrence_key, instr(occurrence_key, '@') + 1, 10) BETWEEN ? AND ?`,
    [...scheduleIds, fromDay, toDay],
  );
  return rows.map((r) => ({ scheduleId: r.schedule_id, key: r.occurrence_key, status: r.status, eventId: r.event_id, snoozeUntil: r.snooze_until }));
}

export async function setMark(
  db: Db,
  scheduleId: string,
  key: string,
  status: MarkStatus,
  opts: { eventId?: string | null; snoozeUntil?: number | null } = {},
  now = Date.now(),
): Promise<void> {
  await db.runAsync(
    `INSERT INTO schedule_marks (schedule_id, occurrence_key, status, event_id, snooze_until, marked_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(schedule_id, occurrence_key) DO UPDATE SET status = excluded.status, event_id = excluded.event_id,
       snooze_until = excluded.snooze_until, marked_at = excluded.marked_at`,
    [scheduleId, key, status, opts.eventId ?? null, opts.snoozeUntil ?? null, now],
  );
}

export async function clearMark(db: Db, scheduleId: string, key: string): Promise<void> {
  await db.runAsync('DELETE FROM schedule_marks WHERE schedule_id = ? AND occurrence_key = ?', [scheduleId, key]);
}

/** When a care event is voided (undo/delete), reopen the occurrence it had confirmed. */
export async function clearMarksForEvent(db: Db, eventId: string): Promise<void> {
  await db.runAsync("DELETE FROM schedule_marks WHERE event_id = ? AND status = 'done'", [eventId]);
}

// ---------------------------------------------------------------- appointments

export type Appointment = {
  id: string;
  petId: string;
  title: string;
  at: number;
  location: string | null;
  notes: string | null;
  remindMinutes: number | null;
  doneAt: number | null;
};

type ApptRow = { id: string; pet_id: string; title: string; at: number; location: string | null; notes: string | null; remind_minutes: number | null; done_at: number | null };
const toAppt = (r: ApptRow): Appointment => ({ id: r.id, petId: r.pet_id, title: r.title, at: r.at, location: r.location, notes: r.notes, remindMinutes: r.remind_minutes, doneAt: r.done_at });

export type AppointmentInput = { petId: string; title: string; at: number; location?: string | null; notes?: string | null; remindMinutes?: number | null };

function validateAppt(i: AppointmentInput) {
  const title = i.title.trim();
  if (!title) throw new ValidationError(t('Give the appointment a name.'));
  if (!Number.isFinite(i.at)) throw new ValidationError(t('Choose a date and time.'));
  return { title, location: i.location?.trim() || null, notes: i.notes?.trim() || null };
}

export async function createAppointment(db: Db, i: AppointmentInput, now = Date.now()): Promise<Appointment> {
  const v = validateAppt(i);
  const id = newId();
  await db.runAsync(
    'INSERT INTO appointments (id, pet_id, title, at, location, notes, remind_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, i.petId, v.title, i.at, v.location, v.notes, i.remindMinutes ?? null, now],
  );
  return { id, petId: i.petId, title: v.title, at: i.at, location: v.location, notes: v.notes, remindMinutes: i.remindMinutes ?? null, doneAt: null };
}

export async function updateAppointment(db: Db, id: string, i: AppointmentInput): Promise<void> {
  const v = validateAppt(i);
  await db.runAsync('UPDATE appointments SET title = ?, at = ?, location = ?, notes = ?, remind_minutes = ? WHERE id = ?', [
    v.title,
    i.at,
    v.location,
    v.notes,
    i.remindMinutes ?? null,
    id,
  ]);
}

export async function getAppointment(db: Db, id: string): Promise<Appointment | null> {
  const r = await db.getFirstAsync<ApptRow>('SELECT * FROM appointments WHERE id = ?', [id]);
  return r ? toAppt(r) : null;
}

export async function setAppointmentDone(db: Db, id: string, done: boolean, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE appointments SET done_at = ? WHERE id = ?', [done ? now : null, id]);
}

export async function deleteAppointment(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM appointments WHERE id = ?', [id]);
}

export async function listAppointments(db: Db, petId: string, from: number, to: number): Promise<Appointment[]> {
  const rows = await db.getAllAsync<ApptRow>('SELECT * FROM appointments WHERE pet_id = ? AND at >= ? AND at < ? ORDER BY at', [petId, from, to]);
  return rows.map(toAppt);
}

export async function upcomingAppointments(db: Db, petId: string | null, from: number, limit = 20): Promise<Appointment[]> {
  const rows = petId
    ? await db.getAllAsync<ApptRow>('SELECT * FROM appointments WHERE pet_id = ? AND at >= ? AND done_at IS NULL ORDER BY at LIMIT ?', [petId, from, limit])
    : await db.getAllAsync<ApptRow>('SELECT * FROM appointments WHERE at >= ? AND done_at IS NULL ORDER BY at LIMIT ?', [from, limit]);
  return rows.map(toAppt);
}

// ---------------------------------------------------------------- measurements

export type Measurement = { id: string; petId: string; kind: string; value: number; unit: string; at: number; note: string | null };
type MeasRow = { id: string; pet_id: string; kind: string; value: number; unit: string; at: number; note: string | null };

export async function addMeasurement(
  db: Db,
  i: { petId: string; kind: 'weight'; value: number; unit: 'kg' | 'lb'; at: number; note?: string | null },
  now = Date.now(),
): Promise<Measurement> {
  if (!Number.isFinite(i.value) || i.value <= 0 || i.value > 200) throw new ValidationError(t('Enter a weight between 0 and 200.'));
  if (i.at > now + 5 * 60_000) throw new ValidationError(t("Weights can't be in the future."));
  const id = newId();
  await db.runAsync('INSERT INTO measurements (id, pet_id, kind, value, unit, at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    i.petId,
    i.kind,
    i.value,
    i.unit,
    i.at,
    i.note?.trim() || null,
    now,
  ]);
  return { id, petId: i.petId, kind: i.kind, value: i.value, unit: i.unit, at: i.at, note: i.note?.trim() || null };
}

export async function listMeasurements(db: Db, petId: string, kind = 'weight'): Promise<Measurement[]> {
  const rows = await db.getAllAsync<MeasRow>('SELECT * FROM measurements WHERE pet_id = ? AND kind = ? ORDER BY at', [petId, kind]);
  return rows.map((r) => ({ id: r.id, petId: r.pet_id, kind: r.kind, value: r.value, unit: r.unit, at: r.at, note: r.note }));
}

export async function deleteMeasurement(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM measurements WHERE id = ?', [id]);
}
