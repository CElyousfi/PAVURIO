/** Health records, attachments and memories. Everything is owner-entered; nothing is inferred. */
import { Db } from './db';
import { newId } from '../domain/ids';
import { ValidationError } from './repo';

export type RecordKind = 'vaccine' | 'vet_visit' | 'medication' | 'allergy' | 'other';
export const RECORD_KINDS: { kind: RecordKind; label: string; color: string; tint: string }[] = [
  { kind: 'vaccine', label: 'Vaccine', color: '#14B8C4', tint: '#DDF6F7' },
  { kind: 'vet_visit', label: 'Vet visit', color: '#1CB0F6', tint: '#DDF3FE' },
  { kind: 'medication', label: 'Medication', color: '#9B7BF7', tint: '#EEE8FE' },
  { kind: 'allergy', label: 'Allergy', color: '#FF6B6B', tint: '#FFE5E5' },
  { kind: 'other', label: 'Other', color: '#7C8495', tint: '#EEF0F3' },
];
export const recordKind = (k: string) => RECORD_KINDS.find((r) => r.kind === k) ?? RECORD_KINDS[4];

export type RecordSource = 'owner' | 'vet_document' | 'clinic';
export const SOURCES: { id: RecordSource; label: string }[] = [
  { id: 'owner', label: 'Entered by me' },
  { id: 'vet_document', label: 'From a vet document' },
  { id: 'clinic', label: 'Told by the clinic' },
];

export type PetRecord = {
  id: string;
  petId: string;
  kind: RecordKind;
  title: string;
  date: string;
  dueDate: string | null;
  source: RecordSource;
  notes: string | null;
  attachments: Attachment[];
};

export type Attachment = { id: string; ownerType: string; ownerId: string; uri: string; mime: string | null; name: string | null };

type RecRow = { id: string; pet_id: string; kind: RecordKind; title: string; date: string; due_date: string | null; source: RecordSource; notes: string | null };
type AttRow = { id: string; owner_type: string; owner_id: string; uri: string; mime: string | null; name: string | null };
const toAtt = (r: AttRow): Attachment => ({ id: r.id, ownerType: r.owner_type, ownerId: r.owner_id, uri: r.uri, mime: r.mime, name: r.name });

export type RecordInput = {
  petId: string;
  kind: RecordKind;
  title: string;
  date: string;
  dueDate?: string | null;
  source?: RecordSource;
  notes?: string | null;
};

function validate(i: RecordInput) {
  const title = i.title.trim();
  if (!title) throw new ValidationError('Give the record a name.');
  if (title.length > 80) throw new ValidationError('Names can be up to 80 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new ValidationError('Choose a date.');
  if (i.dueDate && i.dueDate < i.date) throw new ValidationError('The next due date is before the record date.');
  return { title, notes: i.notes?.trim() ? i.notes.trim().slice(0, 2000) : null };
}

export async function createRecord(db: Db, i: RecordInput, now = Date.now()): Promise<string> {
  const v = validate(i);
  const id = newId();
  await db.runAsync(
    'INSERT INTO records (id, pet_id, kind, title, date, due_date, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, i.petId, i.kind, v.title, i.date, i.dueDate ?? null, i.source ?? 'owner', v.notes, now, now],
  );
  return id;
}

export async function updateRecord(db: Db, id: string, i: RecordInput, now = Date.now()): Promise<void> {
  const v = validate(i);
  await db.runAsync('UPDATE records SET kind = ?, title = ?, date = ?, due_date = ?, source = ?, notes = ?, updated_at = ? WHERE id = ?', [
    i.kind,
    v.title,
    i.date,
    i.dueDate ?? null,
    i.source ?? 'owner',
    v.notes,
    now,
    id,
  ]);
}

export async function deleteRecord(db: Db, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM attachments WHERE owner_type = 'record' AND owner_id = ?", [id]);
    await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
  });
}

export async function listRecords(db: Db, petId: string): Promise<PetRecord[]> {
  const rows = await db.getAllAsync<RecRow>('SELECT * FROM records WHERE pet_id = ? ORDER BY date DESC, created_at DESC', [petId]);
  const atts = await db.getAllAsync<AttRow>(
    "SELECT a.* FROM attachments a JOIN records r ON r.id = a.owner_id WHERE a.owner_type = 'record' AND r.pet_id = ? ORDER BY a.created_at",
    [petId],
  );
  const by = new Map<string, Attachment[]>();
  for (const a of atts) by.set(a.owner_id, [...(by.get(a.owner_id) ?? []), toAtt(a)]);
  return rows.map((r) => ({
    id: r.id,
    petId: r.pet_id,
    kind: r.kind,
    title: r.title,
    date: r.date,
    dueDate: r.due_date,
    source: r.source,
    notes: r.notes,
    attachments: by.get(r.id) ?? [],
  }));
}

export async function getRecord(db: Db, id: string): Promise<PetRecord | null> {
  const r = await db.getFirstAsync<RecRow>('SELECT * FROM records WHERE id = ?', [id]);
  if (!r) return null;
  const atts = await db.getAllAsync<AttRow>("SELECT * FROM attachments WHERE owner_type = 'record' AND owner_id = ? ORDER BY created_at", [id]);
  return { id: r.id, petId: r.pet_id, kind: r.kind, title: r.title, date: r.date, dueDate: r.due_date, source: r.source, notes: r.notes, attachments: atts.map(toAtt) };
}

export async function addAttachment(db: Db, ownerType: 'record', ownerId: string, file: { uri: string; mime?: string | null; name?: string | null }, now = Date.now()) {
  const id = newId();
  await db.runAsync('INSERT INTO attachments (id, owner_type, owner_id, uri, mime, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    id,
    ownerType,
    ownerId,
    file.uri,
    file.mime ?? null,
    file.name ?? null,
    now,
  ]);
  return id;
}

export async function deleteAttachment(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);
}

/** Records with a next-due date in the window, for the "coming up" list. */
export async function dueRecords(db: Db, petId: string, fromDay: string, toDay: string): Promise<PetRecord[]> {
  const all = await listRecords(db, petId);
  return all.filter((r) => r.dueDate && r.dueDate >= fromDay && r.dueDate <= toDay).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
}

// ---------------------------------------------------------------- memories

export type Memory = { id: string; petId: string; photoUri: string | null; title: string; caption: string | null; date: string; kind: 'moment' | 'milestone' };
type MemRow = { id: string; pet_id: string; photo_uri: string | null; title: string; caption: string | null; date: string; kind: 'moment' | 'milestone' };
const toMem = (r: MemRow): Memory => ({ id: r.id, petId: r.pet_id, photoUri: r.photo_uri, title: r.title, caption: r.caption, date: r.date, kind: r.kind });

export type MemoryInput = { petId: string; photoUri?: string | null; title: string; caption?: string | null; date: string; kind?: 'moment' | 'milestone' };

function validateMem(i: MemoryInput) {
  const title = i.title.trim();
  if (!title) throw new ValidationError('Give the moment a title.');
  if (title.length > 60) throw new ValidationError('Titles can be up to 60 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new ValidationError('Choose a date.');
  return { title, caption: i.caption?.trim() ? i.caption.trim().slice(0, 500) : null };
}

export async function createMemory(db: Db, i: MemoryInput, now = Date.now()): Promise<string> {
  const v = validateMem(i);
  const id = newId();
  await db.runAsync('INSERT INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    i.petId,
    i.photoUri ?? null,
    v.title,
    v.caption,
    i.date,
    i.kind ?? 'moment',
    now,
  ]);
  return id;
}

export async function updateMemory(db: Db, id: string, i: MemoryInput): Promise<void> {
  const v = validateMem(i);
  await db.runAsync('UPDATE memories SET photo_uri = ?, title = ?, caption = ?, date = ?, kind = ? WHERE id = ?', [
    i.photoUri ?? null,
    v.title,
    v.caption,
    i.date,
    i.kind ?? 'moment',
    id,
  ]);
}

export async function deleteMemory(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
}

export async function listMemories(db: Db, petId: string): Promise<Memory[]> {
  const rows = await db.getAllAsync<MemRow>('SELECT * FROM memories WHERE pet_id = ? ORDER BY date DESC, created_at DESC', [petId]);
  return rows.map(toMem);
}

export async function getMemory(db: Db, id: string): Promise<Memory | null> {
  const r = await db.getFirstAsync<MemRow>('SELECT * FROM memories WHERE id = ?', [id]);
  return r ? toMem(r) : null;
}
