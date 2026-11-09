/**
 * One backup run, separated from React so it can be tested: files first, then the database snapshot.
 *
 * Correctness rules:
 * - `saved`: the snapshot is uploaded AND every file this phone has is in the cloud. Only then is the
 *   `cloud.dirty` flag ("unsaved changes") cleared. If uploads failed or are still waiting (per-run
 *   limit, no network) the snapshot is still uploaded (the care data is worth saving now), but
 *   `saved` is false, the flag stays '1' and the caller retries. An upload error is never "saved".
 * - `complete`: saved AND no file is `lost` (referenced, but on neither this phone nor the cloud).
 *   Lost files can't be fixed by backing up again, so they don't keep "unsaved changes" set (that
 *   would re-upload on every app switch, block taking a newer backup from another phone and block
 *   sign-out forever). They stay reported to the owner until found again or resolved by them.
 */
import type { Db } from './db';
import { BackupState, LocalFiles, RemoteFiles, backupState, manifest, uploadPending } from './mediaBackup';
import { getSetting, setSetting } from './repo';
import { dumpSnapshot, petCount, toChunks } from './snapshot';

export type UploadSnapshot = (chunks: string[], meta: { updatedAt: number; pets: number; schema: number }) => Promise<{ updatedAt: number }>;

export type BackupRun =
  /** nothing worth saving yet (mid-onboarding) */
  | { status: 'empty' }
  | { status: 'failed'; error: unknown }
  /** snapshot uploaded; `saved` when nothing on this phone is waiting, `complete` when nothing is lost either */
  | { status: 'uploaded'; saved: boolean; complete: boolean; files: BackupState; updatedAt: number; fileError?: unknown };

/**
 * Something changed on this phone: it needs backing up. Each change also bumps a sequence number,
 * so a backup that was already running when the change came can tell it didn't include it.
 */
export async function markDirty(db: Db): Promise<void> {
  const seq = Number((await getSetting(db, 'cloud.dirtySeq')) ?? 0) || 0;
  await setSetting(db, 'cloud.dirtySeq', String(seq + 1));
  await setSetting(db, 'cloud.dirty', '1');
}

export async function runBackup(db: Db, uid: string, deps: { local: LocalFiles; remote: RemoteFiles; upload: UploadSnapshot }): Promise<BackupRun> {
  try {
    // changes made from here on may not be in this snapshot (see markDirty)
    const seqAtStart = await getSetting(db, 'cloud.dirtySeq');
    const snap = await dumpSnapshot(db);
    if (!petCount(snap)) return { status: 'empty' };
    // files first, so the snapshot only lists files that are really in the cloud
    let files: BackupState;
    let fileError: unknown;
    try {
      files = await uploadPending(db, uid, deps.local, deps.remote);
    } catch (e) {
      fileError = e;
      // the upload step itself broke: count what is still missing rather than assume it's fine
      files = await backupState(db, uid, deps.local).catch(() => ({ referenced: 0, backedUp: 0, pending: 1, failed: 1, lost: 0 }));
      if (files.pending === 0) files = { ...files, pending: 1, failed: 1 };
    }
    snap.files = await manifest(db, uid);
    const meta = await deps.upload(toChunks(snap), { updatedAt: snap.createdAt, pets: petCount(snap), schema: snap.schema });
    // a change made while this run was uploading isn't in this snapshot: not saved yet
    const changedMeanwhile = (await getSetting(db, 'cloud.dirtySeq')) !== seqAtStart;
    // saved = everything on this phone is in the cloud; complete = and no photo is missing everywhere
    const saved = files.pending === 0 && files.failed === 0 && fileError == null && !changedMeanwhile;
    const complete = saved && files.lost === 0;
    await setSetting(db, 'cloud.syncedAt', String(meta.updatedAt));
    // only a saved backup clears "unsaved changes"; otherwise it stays set so we try again
    await setSetting(db, 'cloud.dirty', saved ? '0' : '1');
    return { status: 'uploaded', saved, complete, files, updatedAt: meta.updatedAt, fileError };
  } catch (error) {
    return { status: 'failed', error };
  }
}

/** True while something on this phone isn't safely in the cloud yet. */
export async function hasUnsavedChanges(db: Db): Promise<boolean> {
  return (await getSetting(db, 'cloud.dirty')) === '1';
}
