/**
 * One backup run, separated from React so it can be tested: files first, then the database snapshot.
 *
 * Correctness rule: the backup is only "complete" — and the `cloud.dirty` flag only cleared — when the
 * snapshot is uploaded AND every referenced photo/document is in the cloud. If file uploads failed or
 * some are still waiting (per-run limit, no network), the snapshot is still uploaded (the care data is
 * worth saving now) but the run reports `complete: false`, `cloud.dirty` stays '1', and the caller
 * retries. A file upload error can never turn into a falsely completed backup.
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
  /** snapshot uploaded; `complete` only when no file is pending */
  | { status: 'uploaded'; complete: boolean; files: BackupState; updatedAt: number; fileError?: unknown };

export async function runBackup(db: Db, uid: string, deps: { local: LocalFiles; remote: RemoteFiles; upload: UploadSnapshot }): Promise<BackupRun> {
  try {
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
    // complete = every referenced photo/document is safely in the cloud (none waiting, none lost)
    const complete = files.pending === 0 && files.lost === 0 && fileError == null;
    await setSetting(db, 'cloud.syncedAt', String(meta.updatedAt));
    // only a complete backup clears "unsaved changes"; otherwise it stays set so we try again
    await setSetting(db, 'cloud.dirty', complete ? '0' : '1');
    return { status: 'uploaded', complete, files, updatedAt: meta.updatedAt, fileError };
  } catch (error) {
    return { status: 'failed', error };
  }
}

/** True while something on this phone isn't safely in the cloud yet. */
export async function hasUnsavedChanges(db: Db): Promise<boolean> {
  return (await getSetting(db, 'cloud.dirty')) === '1';
}
