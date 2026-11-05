/**
 * Pavurio Memories — moments, milestones and their photos. Extends the existing `memories` table
 * (adventure memories written by walkRepo keep working). Files are never stored in rows: `media`
 * holds where a photo lives, and a file is only removed when nothing references it any more.
 */
import { Db } from './db';
import { newId } from '../domain/ids';
import { ValidationError } from './repo';
import { t } from '../i18n/core';
import { resolveUri, rowPhotoUri } from './uris';
import { CAPTION_MAX, MILESTONE_LABEL, MilestoneKind, TITLE_MAX, isMilestone, onThisDayYears } from '../domain/memories';

export type MediaAsset = { id: string; uri: string; thumbUri: string | null; width: number | null; height: number | null; mime: string | null; capturedAt: number | null };

export type Moment = {
  id: string;
  petId: string;
  petIds: string[];
  kind: 'moment' | 'milestone' | 'adventure';
  title: string;
  caption: string | null;
  date: string;
  milestone: MilestoneKind | null;
  favorite: boolean;
  featured: boolean;
  walkId: string | null;
  mediaId: string | null;
  photoUri: string | null;
  thumbUri: string | null;
  width: number | null;
  height: number | null;
  capturedAt: number | null;
  createdAt: number;
};

type Row = {
  id: string;
  pet_id: string;
  photo_uri: string | null;
  title: string;
  caption: string | null;
  date: string;
  kind: Moment['kind'];
  created_at: number;
  media_id: string | null;
  favorite: number;
  featured: number;
  milestone: string | null;
  walk_id: string | null;
  captured_at: number | null;
  pets: string | null;
  m_uri: string | null;
  m_thumb: string | null;
  m_w: number | null;
  m_h: number | null;
  m_captured: number | null;
};

const SELECT = `SELECT m.*, md.uri AS m_uri, md.thumb_uri AS m_thumb, md.width AS m_w, md.height AS m_h, md.captured_at AS m_captured,
  (SELECT group_concat(pet_id) FROM memory_pets WHERE memory_id = m.id) AS pets
  FROM memories m LEFT JOIN media md ON md.id = m.media_id`;

const toMoment = (r: Row): Moment => {
  const pets = (r.pets ?? '').split(',').filter(Boolean);
  return {
    id: r.id,
    petId: r.pet_id,
    petIds: [r.pet_id, ...pets.filter((p) => p !== r.pet_id)],
    kind: r.kind,
    title: r.title ?? '',
    caption: r.caption,
    date: r.date,
    milestone: isMilestone(r.milestone) ? r.milestone : null,
    favorite: !!r.favorite,
    featured: !!r.featured,
    walkId: r.walk_id,
    mediaId: r.media_id,
    photoUri: resolveUri(r.m_uri ?? r.photo_uri),
    thumbUri: resolveUri(r.m_thumb ?? r.m_uri ?? r.photo_uri),
    width: r.m_w,
    height: r.m_h,
    capturedAt: r.captured_at ?? r.m_captured,
    createdAt: r.created_at,
  };
};

// ---------------------------------------------------------------- media

export async function addMedia(db: Db, m: Omit<MediaAsset, 'id'>, now = Date.now()): Promise<MediaAsset> {
  const id = newId();
  await db.runAsync('INSERT INTO media (id, uri, thumb_uri, width, height, mime, captured_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    m.uri,
    m.thumbUri,
    m.width,
    m.height,
    m.mime,
    m.capturedAt,
    now,
  ]);
  return { id, ...m };
}

export async function getMedia(db: Db, id: string): Promise<MediaAsset | null> {
  const r = await db.getFirstAsync<{ id: string; uri: string; thumb_uri: string | null; width: number | null; height: number | null; mime: string | null; captured_at: number | null }>(
    'SELECT * FROM media WHERE id = ?',
    [id],
  );
  return r ? { id: r.id, uri: r.uri, thumbUri: r.thumb_uri, width: r.width, height: r.height, mime: r.mime, capturedAt: r.captured_at } : null;
}

/**
 * Removes a media row if no memory uses it any more and returns the files that are now safe to
 * delete (a walk may still point at the same file, in which case the file is kept).
 */
export async function releaseMedia(db: Db, mediaId: string): Promise<string[]> {
  const used = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories WHERE media_id = ?', [mediaId]);
  if ((used?.n ?? 0) > 0) return [];
  const m = await getMedia(db, mediaId);
  if (!m) return [];
  await db.runAsync('DELETE FROM media WHERE id = ?', [mediaId]);
  const files: string[] = [];
  for (const uri of [m.uri, m.thumbUri]) {
    if (!uri || files.includes(uri)) continue;
    if (!(await fileStillReferenced(db, uri))) files.push(uri);
  }
  return files;
}

/** True when any row still points at this file (another media, a memory's legacy photo, a walk, a record attachment). */
export async function fileStillReferenced(db: Db, uri: string): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM media WHERE uri = ? OR thumb_uri = ?) + (SELECT COUNT(*) FROM memories WHERE photo_uri = ?) + (SELECT COUNT(*) FROM walks WHERE photo_uri = ?) + (SELECT COUNT(*) FROM attachments WHERE uri = ?) AS n`,
    [uri, uri, uri, uri, uri],
  );
  return (r?.n ?? 0) > 0;
}

// ---------------------------------------------------------------- moments

export type MomentInput = {
  petIds: string[]; // first = primary pet
  mediaId?: string | null;
  title?: string | null;
  caption?: string | null;
  date: string;
  milestone?: MilestoneKind | null;
  favorite?: boolean;
  featured?: boolean;
  walkId?: string | null;
  capturedAt?: number | null;
};

function validate(i: MomentInput, hasPhoto: boolean) {
  const title = (i.title ?? '').trim();
  if (title.length > TITLE_MAX) throw new ValidationError(t('Titles can be up to 60 characters.'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new ValidationError(t('Choose a date.'));
  if (!i.petIds.length) throw new ValidationError(t('Choose at least one pet.'));
  const milestone = i.milestone && isMilestone(i.milestone) ? i.milestone : null;
  if (milestone === 'custom' && !title) throw new ValidationError(t('Name your milestone.'));
  // a moment needs something to remember: a photo, a title or a milestone
  if (!hasPhoto && !title && !milestone) throw new ValidationError(t('Add a photo or a title.'));
  const caption = i.caption?.trim() ? i.caption.trim().slice(0, CAPTION_MAX) : null;
  return { title, caption, milestone };
}

/** The photo location written on the memory row (stored form; null for web data: URLs). */
async function photoUriOf(db: Db, mediaId: string | null | undefined): Promise<{ has: boolean; row: string | null }> {
  if (!mediaId) return { has: false, row: null };
  const uri = (await getMedia(db, mediaId))?.uri ?? null;
  return { has: !!uri, row: rowPhotoUri(uri) };
}

/**
 * Older rows (from before schema v5, or restored from an older backup) may have a photo but no media
 * row. Gives them one so editing never loses the photo. Safe to call repeatedly.
 */
export async function ensureLegacyMedia(db: Db, memoryId?: string): Promise<void> {
  const where = memoryId ? 'AND id = ?' : '';
  const params = memoryId ? [memoryId] : [];
  await db.runAsync(
    `INSERT OR IGNORE INTO media (id, uri, mime, created_at) SELECT 'legacy-' || id, photo_uri, 'image/jpeg', created_at FROM memories WHERE photo_uri IS NOT NULL AND media_id IS NULL AND kind != 'adventure' ${where}`,
    params,
  );
  await db.runAsync(`UPDATE memories SET media_id = 'legacy-' || id WHERE photo_uri IS NOT NULL AND media_id IS NULL AND kind != 'adventure' ${where}`, params);
}

async function setPets(db: Db, id: string, petIds: string[]) {
  const unique = [...new Set(petIds)];
  await db.runAsync('DELETE FROM memory_pets WHERE memory_id = ?', [id]);
  for (const p of unique) await db.runAsync('INSERT OR IGNORE INTO memory_pets (memory_id, pet_id) VALUES (?, ?)', [id, p]);
}

/** Saves a moment (photo moment, milestone or note). No confirmation step: the save is the action. */
export async function addMoment(db: Db, i: MomentInput, now = Date.now()): Promise<Moment> {
  const photo = await photoUriOf(db, i.mediaId);
  const v = validate(i, photo.has);
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at, media_id, favorite, featured, milestone, walk_id, captured_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [id, i.petIds[0], photo.row, v.title, v.caption, i.date, v.milestone ? 'milestone' : 'moment', now, i.mediaId ?? null, i.favorite ? 1 : 0, v.milestone, i.walkId ?? null, i.capturedAt ?? null, now],
    );
    await setPets(db, id, i.petIds);
  });
  if (i.featured) await setFeatured(db, id, true);
  return (await getMoment(db, id))!;
}

export async function getMoment(db: Db, id: string): Promise<Moment | null> {
  const r = await db.getFirstAsync<Row>(`${SELECT} WHERE m.id = ?`, [id]);
  return r ? toMoment(r) : null;
}

/** Edits a moment. Replacing the photo releases the old one; returns files that may now be deleted. */
export async function updateMoment(db: Db, id: string, i: MomentInput, now = Date.now()): Promise<{ moment: Moment; freedFiles: string[] }> {
  await ensureLegacyMedia(db, id);
  const before = await getMoment(db, id);
  if (!before) throw new ValidationError(t('This moment no longer exists.'));
  if (before.kind === 'adventure') throw new ValidationError(t('Edit this adventure from its walk.'));
  const photo = await photoUriOf(db, i.mediaId);
  const v = validate(i, photo.has);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE memories SET pet_id = ?, photo_uri = ?, title = ?, caption = ?, date = ?, kind = ?, media_id = ?, favorite = ?, milestone = ?, walk_id = ?, captured_at = ?, updated_at = ? WHERE id = ?`,
      [i.petIds[0], photo.row, v.title, v.caption, i.date, v.milestone ? 'milestone' : 'moment', i.mediaId ?? null, i.favorite ? 1 : 0, v.milestone, i.walkId ?? null, i.capturedAt ?? before.capturedAt, now, id],
    );
    await setPets(db, id, i.petIds);
  });
  if (i.featured !== undefined && i.featured !== before.featured) await setFeatured(db, id, i.featured);
  const freedFiles = before.mediaId && before.mediaId !== (i.mediaId ?? null) ? await releaseMedia(db, before.mediaId) : [];
  return { moment: (await getMoment(db, id))!, freedFiles };
}

/**
 * Takes a moment shared by several pets out of one pet's scrapbook only: it (and its photo) stays with
 * the others. Returns false when it isn't shared (the caller should delete it instead).
 */
export async function removeMomentFromPet(db: Db, id: string, petId: string, now = Date.now()): Promise<boolean> {
  const others = await db.getAllAsync<{ pet_id: string }>('SELECT pet_id FROM memory_pets WHERE memory_id = ? AND pet_id != ?', [id, petId]);
  if (!others.length) return false;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM memory_pets WHERE memory_id = ? AND pet_id = ?', [id, petId]);
    await db.runAsync('UPDATE memories SET pet_id = ?, updated_at = ? WHERE id = ? AND pet_id = ?', [others[0].pet_id, now, id, petId]);
  });
  return true;
}

/** Deletes a moment; returns the files no longer referenced by anything (caller removes them). */
export async function deleteMoment(db: Db, id: string): Promise<string[]> {
  const m = await db.getFirstAsync<{ media_id: string | null; photo_uri: string | null; kind: string }>('SELECT media_id, photo_uri, kind FROM memories WHERE id = ?', [id]);
  if (!m) return [];
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
  if (m.media_id) return releaseMedia(db, m.media_id);
  if (m.photo_uri && m.kind !== 'adventure' && !(await fileStillReferenced(db, m.photo_uri))) return [m.photo_uri];
  return [];
}

/**
 * Before a pet is deleted: moments it shares with other pets move to one of them (nothing is lost),
 * and its own moments are deleted with their files released. Returns files that may now be removed.
 * Adventure memories are left to the walk cascade (their photo belongs to the walk).
 */
export async function detachPetMemories(db: Db, petId: string): Promise<string[]> {
  await db.runAsync(
    `UPDATE memories SET pet_id = (SELECT mp.pet_id FROM memory_pets mp WHERE mp.memory_id = memories.id AND mp.pet_id != ? LIMIT 1)
     WHERE pet_id = ? AND EXISTS (SELECT 1 FROM memory_pets mp WHERE mp.memory_id = memories.id AND mp.pet_id != ?)`,
    [petId, petId, petId],
  );
  await db.runAsync('DELETE FROM memory_pets WHERE pet_id = ? AND memory_id IN (SELECT id FROM memories WHERE pet_id != ?)', [petId, petId]);
  const own = await db.getAllAsync<{ id: string }>("SELECT id FROM memories WHERE pet_id = ? AND kind != 'adventure'", [petId]);
  const files: string[] = [];
  for (const { id } of own) files.push(...(await deleteMoment(db, id)));
  return files;
}

export async function setFavorite(db: Db, id: string, favorite: boolean, now = Date.now()) {
  await db.runAsync('UPDATE memories SET favorite = ?, updated_at = ? WHERE id = ?', [favorite ? 1 : 0, now, id]);
}

/** One featured moment per pet per day: featuring one un-features the others that share a pet and day. */
export async function setFeatured(db: Db, id: string, featured: boolean, now = Date.now()) {
  const m = await getMoment(db, id);
  if (!m) return;
  await db.withTransactionAsync(async () => {
    if (featured) {
      await db.runAsync(
        `UPDATE memories SET featured = 0, updated_at = ? WHERE date = ? AND id != ? AND featured = 1 AND id IN (SELECT memory_id FROM memory_pets WHERE pet_id IN (${m.petIds.map(() => '?').join(',')}))`,
        [now, m.date, id, ...m.petIds],
      );
    }
    await db.runAsync('UPDATE memories SET featured = ?, updated_at = ? WHERE id = ?', [featured ? 1 : 0, now, id]);
  });
}

export type MomentFilter = { favoritesOnly?: boolean; milestonesOnly?: boolean; withPhoto?: boolean; from?: string; to?: string; limit?: number };

/** Everything that includes this pet (shared moments appear for each pet, stored once). Newest first. */
export async function listMoments(db: Db, petId: string, f: MomentFilter = {}): Promise<Moment[]> {
  const where = ['m.id IN (SELECT memory_id FROM memory_pets WHERE pet_id = ?)'];
  const params: (string | number)[] = [petId];
  if (f.favoritesOnly) where.push('m.favorite = 1');
  if (f.milestonesOnly) where.push('m.milestone IS NOT NULL');
  if (f.withPhoto) where.push('(md.uri IS NOT NULL OR m.photo_uri IS NOT NULL)');
  if (f.from) {
    where.push('m.date >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('m.date <= ?');
    params.push(f.to);
  }
  const lim = f.limit ? ` LIMIT ${Math.max(1, Math.floor(f.limit))}` : '';
  const rows = await db.getAllAsync<Row>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY m.date DESC, m.featured DESC, m.created_at DESC${lim}`, params);
  return rows.map(toMoment);
}

/** Today's moments for the pet, the featured one first. */
export async function momentsOn(db: Db, petId: string, day: string): Promise<Moment[]> {
  return listMoments(db, petId, { from: day, to: day });
}

/** Earlier years on this calendar day (photos only), most recent year first. */
export async function onThisDay(db: Db, petId: string, today: string): Promise<{ years: number; moment: Moment }[]> {
  const [, mm, dd] = today.split('-');
  const rows = await db.getAllAsync<Row>(
    `${SELECT} WHERE m.id IN (SELECT memory_id FROM memory_pets WHERE pet_id = ?) AND (substr(m.date, 6) = ? OR substr(m.date, 6) = '02-29') AND m.date < ? ORDER BY m.date DESC, m.featured DESC, m.created_at DESC`,
    [petId, `${mm}-${dd}`, today],
  );
  return rows
    .map(toMoment)
    .map((moment) => ({ years: onThisDayYears(moment.date, today), moment }))
    .filter((x) => x.years > 0 && x.moment.photoUri);
}

/** Milestone moments for the pet, oldest first (a timeline). */
export async function listMilestones(db: Db, petId: string): Promise<Moment[]> {
  const rows = await listMoments(db, petId, { milestonesOnly: true });
  return rows.reverse();
}

/** Photos linked to an adventure (not the adventure's own memory). */
export async function momentsForWalk(db: Db, walkId: string): Promise<Moment[]> {
  const rows = await db.getAllAsync<Row>(`${SELECT} WHERE m.walk_id = ? AND m.kind != 'adventure' ORDER BY m.created_at ASC`, [walkId]);
  return rows.map(toMoment);
}

/** Days in a range that have milestones (for the calendar). Includes shared moments. */
export async function milestoneDays(db: Db, petId: string, from: string, to: string): Promise<{ date: string; milestone: MilestoneKind }[]> {
  const rows = await db.getAllAsync<{ date: string; milestone: string }>(
    `SELECT m.date, m.milestone FROM memories m WHERE m.milestone IS NOT NULL AND m.date >= ? AND m.date <= ? AND m.id IN (SELECT memory_id FROM memory_pets WHERE pet_id = ?)`,
    [from, to, petId],
  );
  return rows.filter((r) => isMilestone(r.milestone)).map((r) => ({ date: r.date, milestone: r.milestone as MilestoneKind }));
}

export async function countMoments(db: Db, petId: string): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memory_pets WHERE pet_id = ?', [petId]);
  return r?.n ?? 0;
}

export const milestoneLabel = (k: MilestoneKind) => t(MILESTONE_LABEL[k]);
