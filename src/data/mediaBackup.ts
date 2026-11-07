/**
 * Photo and document backup. The database snapshot only holds *references* to files (memories photos
 * and thumbnails, adventure photos, record attachments); the files themselves live in the app's
 * documents folder. This module puts those files in the owner's cloud storage and brings them back.
 *
 * - Files are addressed by their path inside the documents folder (`memories/<id>.jpg`), which is
 *   stable across devices and app reinstalls. Files are never modified after they're saved (a new
 *   photo is a new file), so path + size identifies a file: unchanged files are never uploaded twice.
 * - `backup_files` records, per account, which paths are safely in the cloud. A row is written only
 *   after the upload finished, so a cut-off upload is simply retried next time.
 * - The snapshot carries a manifest of uploaded files (path + size). A restore downloads every
 *   referenced file that's missing on this device and checks its size; a file that doesn't match is
 *   discarded and retried, never shown half-written. Missing thumbnails are rebuilt from the original.
 * - Files that nothing references any more are removed from the cloud.
 *
 * Everything that touches the network or the file system is injected, so the logic is tested in node.
 */
import type { Db } from './db';
import { DOC_PREFIX } from './uris';

/** Folders inside the documents folder that hold the owner's files. */
const FOLDERS = ['memories', 'attachments', 'moments'];
const FOLDER_RE = new RegExp(`(?:^|/)((?:${FOLDERS.join('|')})/[^?#]+)$`);

/** A stored URI → its path inside the documents folder (null for data: URLs, remote or foreign files). */
export function relPath(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith(DOC_PREFIX)) return uri.slice(DOC_PREFIX.length);
  if (uri.startsWith('file:')) {
    const m = decodeURI(uri).match(FOLDER_RE);
    return m ? m[1] : null;
  }
  return null;
}

export const isThumb = (path: string) => path.startsWith('memories/thumbs/');

/** Every column that points at a file. */
const FILE_COLUMNS: { table: string; column: string }[] = [
  { table: 'media', column: 'uri' },
  { table: 'media', column: 'thumb_uri' },
  { table: 'memories', column: 'photo_uri' },
  { table: 'walks', column: 'photo_uri' },
  { table: 'attachments', column: 'uri' },
];

/** Paths of every file the owner's data refers to (deduplicated: a shared photo is one file). */
export async function referencedFiles(db: Db): Promise<string[]> {
  const out = new Set<string>();
  for (const { table, column } of FILE_COLUMNS) {
    const rows = await db.getAllAsync<{ u: string | null }>(`SELECT ${column} AS u FROM ${table} WHERE ${column} IS NOT NULL`, []);
    for (const r of rows) {
      const p = relPath(r.u);
      if (p) out.add(p);
    }
  }
  return [...out].sort();
}

/**
 * After a restore on another device (or an iOS container move), absolute `file://` URIs point at the
 * old phone's folder. Rewrite them to this device's documents folder; the path inside stays the same.
 */
export async function relinkFiles(db: Db, docRoot: string): Promise<number> {
  const root = docRoot.endsWith('/') ? docRoot : `${docRoot}/`;
  let n = 0;
  for (const { table, column } of FILE_COLUMNS) {
    const rows = await db.getAllAsync<{ rid: number; u: string }>(`SELECT rowid AS rid, ${column} AS u FROM ${table} WHERE ${column} LIKE 'file:%'`, []);
    for (const r of rows) {
      const p = relPath(r.u);
      if (!p) continue;
      const next = root + p;
      if (next !== r.u) {
        await db.runAsync(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`, [next, r.rid]);
        n++;
      }
    }
  }
  return n;
}

export type LocalFiles = {
  /** size in bytes, or null when the file isn't there */
  size(path: string): number | null;
  remove(path: string): void;
  /** rebuild a memories thumbnail from its original (returns false when it can't) */
  rebuildThumb?(thumbPath: string, originalPath: string): Promise<boolean>;
};
export type RemoteFiles = {
  put(path: string): Promise<{ size: number }>;
  /** downloads into the local path; resolves with the downloaded size */
  get(path: string): Promise<{ size: number }>;
  remove(path: string): Promise<void>;
};

/**
 * `pending`: on this phone, not (yet) in the cloud — uploads are retried.
 * `lost`: referenced by a memory/record but neither on this phone nor in the cloud: it can't be backed
 * up, so a backup is never "complete" while any exist; the owner sees them in Account.
 */
export type BackupState = { referenced: number; backedUp: number; pending: number; failed: number; lost: number };

type Uploaded = { path: string; size: number };
async function uploadedRows(db: Db, uid: string): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<Uploaded>('SELECT path, size FROM backup_files WHERE uid = ?', [uid]);
  return new Map(rows.map((r) => [r.path, r.size]));
}

/** How many of the owner's files are safely in the cloud for this account. */
export async function backupState(db: Db, uid: string, local: LocalFiles): Promise<BackupState> {
  const refs = await referencedFiles(db);
  const up = await uploadedRows(db, uid);
  let backedUp = 0;
  let pending = 0;
  let lost = 0;
  for (const p of refs) {
    const size = local.size(p);
    if (size == null) {
      // a file this phone doesn't have (yet): protected if the cloud has it, otherwise missing everywhere
      if (up.has(p)) backedUp++;
      else lost++;
      continue;
    }
    if (up.get(p) === size) backedUp++;
    else pending++;
  }
  return { referenced: refs.length, backedUp, pending, failed: 0, lost };
}

/**
 * Uploads every referenced file that isn't in the cloud yet (or changed size), at most `limit` per run,
 * and removes cloud copies nothing refers to any more. Each success is recorded straight away, so an
 * interruption loses at most the file in flight.
 */
export async function uploadPending(
  db: Db,
  uid: string,
  local: LocalFiles,
  remote: RemoteFiles,
  opts: { limit?: number; now?: number } = {},
): Promise<BackupState> {
  const refs = await referencedFiles(db);
  const up = await uploadedRows(db, uid);
  const now = opts.now ?? Date.now();
  let uploaded = 0;
  let failed = 0;
  let pending = 0;
  let backedUp = 0;
  let lost = 0;
  for (const p of refs) {
    const size = local.size(p);
    if (size == null) {
      // already safe in the cloud, or missing everywhere (never silently counted as fine)
      if (up.has(p)) backedUp++;
      else lost++;
      continue;
    }
    if (up.get(p) === size) {
      backedUp++;
      continue;
    }
    if (uploaded + failed >= (opts.limit ?? 40)) {
      pending++;
      continue;
    }
    try {
      const r = await remote.put(p);
      if (r.size !== size) throw new Error(`size mismatch for ${p}`);
      await db.runAsync('INSERT OR REPLACE INTO backup_files (uid, path, size, uploaded_at) VALUES (?, ?, ?, ?)', [uid, p, size, now]);
      uploaded++;
      backedUp++;
    } catch {
      failed++;
      pending++;
    }
  }
  // cloud copies of deleted photos and documents
  const live = new Set(refs);
  for (const p of up.keys()) {
    if (live.has(p)) continue;
    try {
      await remote.remove(p);
      await db.runAsync('DELETE FROM backup_files WHERE uid = ? AND path = ?', [uid, p]);
    } catch {
      // tried again next time
    }
  }
  return { referenced: refs.length, backedUp, pending, failed, lost };
}

/** The manifest that travels in the snapshot: what this account has in the cloud. */
export async function manifest(db: Db, uid: string): Promise<Uploaded[]> {
  return db.getAllAsync<Uploaded>('SELECT path, size FROM backup_files WHERE uid = ? ORDER BY path', [uid]);
}

/** After a restore: remember the cloud's files for this account (they don't need uploading again). */
export async function adoptManifest(db: Db, uid: string, files: Uploaded[] | undefined, now = Date.now()): Promise<void> {
  if (!files?.length) return;
  await db.withTransactionAsync(async () => {
    for (const f of files) {
      if (typeof f?.path !== 'string' || typeof f.size !== 'number') continue;
      await db.runAsync('INSERT OR REPLACE INTO backup_files (uid, path, size, uploaded_at) VALUES (?, ?, ?, ?)', [uid, f.path, f.size, now]);
    }
  });
}

export type RestoreResult = { restored: number; missing: string[]; rebuilt: number };

/**
 * Brings back every referenced file this device doesn't have. A download is accepted only when its
 * size matches the manifest; otherwise it's deleted and reported missing (tried again next launch).
 * Thumbnails that can't be downloaded are rebuilt from their original.
 */
export async function restoreMissing(db: Db, uid: string, local: LocalFiles, remote: RemoteFiles): Promise<RestoreResult> {
  const refs = await referencedFiles(db);
  const up = await uploadedRows(db, uid);
  const res: RestoreResult = { restored: 0, missing: [], rebuilt: 0 };
  const todo = refs.filter((p) => local.size(p) == null);
  // originals first, so thumbnails can be rebuilt from them
  todo.sort((a, b) => Number(isThumb(a)) - Number(isThumb(b)));
  for (const p of todo) {
    const want = up.get(p);
    let ok = false;
    if (want != null) {
      try {
        const r = await remote.get(p);
        ok = r.size === want && local.size(p) === want;
        if (!ok) local.remove(p);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      res.restored++;
      continue;
    }
    if (isThumb(p) && local.rebuildThumb) {
      const orig = await originalFor(db, p);
      if (orig && local.size(orig) != null && (await local.rebuildThumb(p, orig).catch(() => false))) {
        res.rebuilt++;
        continue;
      }
    }
    res.missing.push(p);
  }
  return res;
}

async function originalFor(db: Db, thumbPath: string): Promise<string | null> {
  const rows = await db.getAllAsync<{ uri: string; thumb_uri: string | null }>('SELECT uri, thumb_uri FROM media WHERE thumb_uri IS NOT NULL', []);
  const hit = rows.find((r) => relPath(r.thumb_uri) === thumbPath);
  return hit ? relPath(hit.uri) : null;
}
