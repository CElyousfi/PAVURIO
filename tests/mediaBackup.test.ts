import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet } from '../src/data/repo';
import { addMedia, addMoment } from '../src/data/memoriesRepo';
import { LocalFiles, RemoteFiles, adoptManifest, backupState, manifest, referencedFiles, relPath, relinkFiles, restoreMissing, uploadPending } from '../src/data/mediaBackup';
import { dumpSnapshot, restoreSnapshot } from '../src/data/snapshot';
import { openNodeDb } from './helpers/nodeDb';

/** a phone's documents folder */
function fakeLocal(files: Record<string, number> = {}): LocalFiles & { files: Record<string, number> } {
  return {
    files,
    size: (p) => (p in files ? files[p] : null),
    remove: (p) => void delete files[p],
    rebuildThumb: async (thumb, orig) => {
      if (!(orig in files)) return false;
      files[thumb] = 50;
      return true;
    },
  };
}
/** cloud storage shared by both phones; `failPut` / `failGet` simulate a bad connection */
function fakeCloud(phone: { files: Record<string, number> }, store: Record<string, number>, opts: { failPut?: Set<string>; failGet?: Set<string>; corrupt?: Set<string> } = {}): RemoteFiles & { puts: string[] } {
  const puts: string[] = [];
  return {
    puts,
    async put(p) {
      if (opts.failPut?.has(p)) throw new Error('network');
      puts.push(p);
      store[p] = phone.files[p];
      return { size: store[p] };
    },
    async get(p) {
      if (opts.failGet?.has(p) || !(p in store)) throw new Error('network');
      const size = opts.corrupt?.has(p) ? store[p] - 10 : store[p];
      phone.files[p] = size;
      return { size };
    },
    async remove(p) {
      delete store[p];
    },
  };
}

async function phoneWithPhotos() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const honey = await createPet(db, { species: 'dog', name: 'Honey' });
  const tabby = await createPet(db, { species: 'cat', name: 'Tabby' });
  const a = await addMedia(db, { uri: 'pv-doc:memories/a.jpg', thumbUri: 'pv-doc:memories/thumbs/a.jpg', width: 10, height: 10, mime: 'image/jpeg', capturedAt: null });
  const b = await addMedia(db, { uri: 'pv-doc:memories/b.heic', thumbUri: 'pv-doc:memories/thumbs/b.jpg', width: 10, height: 10, mime: 'image/heic', capturedAt: null });
  await addMoment(db, { petIds: [honey.id, tabby.id], mediaId: a.id, date: '2026-11-01' });
  await addMoment(db, { petIds: [honey.id], mediaId: b.id, date: '2026-11-02' });
  await db.runAsync("INSERT INTO records (id, pet_id, kind, title, date, created_at, updated_at) VALUES ('r1', ?, 'vaccine', 'Rabies', '2026-10-01', 0, 0)", [honey.id]).catch(() => null);
  await db.runAsync("INSERT INTO attachments (id, owner_type, owner_id, uri, mime, name, created_at) VALUES ('at1', 'record', 'r1', 'file:///var/mobile/Containers/Data/Application/OLD/Documents/attachments/x.pdf', 'application/pdf', 'x.pdf', 0)", []);
  const local = fakeLocal({ 'memories/a.jpg': 3000, 'memories/thumbs/a.jpg': 60, 'memories/b.heic': 5000, 'memories/thumbs/b.jpg': 70, 'attachments/x.pdf': 900 });
  return { db, honey, tabby, local };
}

describe('media backup', () => {
  it('finds every file the data points at, shared photos once', async () => {
    const { db } = await phoneWithPhotos();
    expect(await referencedFiles(db)).toEqual(['attachments/x.pdf', 'memories/a.jpg', 'memories/b.heic', 'memories/thumbs/a.jpg', 'memories/thumbs/b.jpg']);
    expect(relPath('data:image/jpeg;base64,xx')).toBeNull();
    expect(relPath('file:///data/user/0/app/files/moments/w%20a.jpg')).toBe('moments/w a.jpg');
  });

  it('uploads each file once, survives an interrupted upload and retries it', async () => {
    const { db, local } = await phoneWithPhotos();
    const store: Record<string, number> = {};
    const flaky = fakeCloud(local, store, { failPut: new Set(['memories/b.heic']) });
    const first = await uploadPending(db, 'u1', local, flaky);
    expect(first).toMatchObject({ referenced: 5, backedUp: 4, pending: 1, failed: 1 });
    expect((await backupState(db, 'u1', local)).pending).toBe(1);
    const good = fakeCloud(local, store);
    const second = await uploadPending(db, 'u1', local, good);
    expect(second.pending).toBe(0);
    // only the one that failed went up again
    expect(good.puts).toEqual(['memories/b.heic']);
    // a different account starts from scratch (nothing of u1 counts for u2)
    expect((await backupState(db, 'u2', local)).pending).toBe(5);
  });

  it('removes cloud copies of deleted photos, keeps a shared one', async () => {
    const { db, local } = await phoneWithPhotos();
    const store: Record<string, number> = {};
    await uploadPending(db, 'u1', local, fakeCloud(local, store));
    await db.runAsync("DELETE FROM memories WHERE media_id = (SELECT id FROM media WHERE uri = 'pv-doc:memories/b.heic')", []);
    await db.runAsync("DELETE FROM media WHERE uri = 'pv-doc:memories/b.heic'", []);
    delete local.files['memories/b.heic'];
    await uploadPending(db, 'u1', local, fakeCloud(local, store));
    expect(Object.keys(store).sort()).toEqual(['attachments/x.pdf', 'memories/a.jpg', 'memories/thumbs/a.jpg']);
  });

  it('restores everything on a clean phone: rows, files, checked sizes, rebuilt thumbnails', async () => {
    const old = await phoneWithPhotos();
    const store: Record<string, number> = {};
    await uploadPending(old.db, 'u1', old.local, fakeCloud(old.local, store));
    const snap = await dumpSnapshot(old.db);
    snap.files = await manifest(old.db, 'u1');
    // a thumbnail never made it to the cloud
    delete store['memories/thumbs/b.jpg'];

    const db = openNodeDb(':memory:');
    await migrate(db);
    const phone = fakeLocal();
    await restoreSnapshot(db, JSON.parse(JSON.stringify(snap)));
    expect(await relinkFiles(db, 'file:///new/Documents/')).toBe(1);
    expect((await db.getFirstAsync<{ uri: string }>("SELECT uri FROM attachments WHERE id = 'at1'", []))?.uri).toBe('file:///new/Documents/attachments/x.pdf');
    await adoptManifest(db, 'u1', snap.files);
    // first try: one download is corrupted, one fails
    const r1 = await restoreMissing(db, 'u1', phone, fakeCloud(phone, store, { corrupt: new Set(['memories/a.jpg']), failGet: new Set(['attachments/x.pdf']) }));
    expect(r1.missing.sort()).toEqual(['attachments/x.pdf', 'memories/a.jpg']);
    // the corrupted file was not kept
    expect(phone.files['memories/a.jpg']).toBeUndefined();
    expect(r1.rebuilt).toBe(1); // thumbs/b.jpg from b.heic
    // next launch: everything comes back with the right sizes
    const r2 = await restoreMissing(db, 'u1', phone, fakeCloud(phone, store));
    expect(r2.missing).toEqual([]);
    expect(phone.files).toMatchObject({ 'memories/a.jpg': 3000, 'memories/b.heic': 5000, 'attachments/x.pdf': 900, 'memories/thumbs/a.jpg': 60, 'memories/thumbs/b.jpg': 50 });
    // nothing needs uploading again, except the rebuilt thumbnail
    const again = fakeCloud(phone, store);
    await uploadPending(db, 'u1', phone, again);
    expect(again.puts).toEqual(['memories/thumbs/b.jpg']);
    // the shared moment is still shared
    expect((await db.getAllAsync('SELECT * FROM memory_pets', [])).length).toBe(3);
  });
});

describe('shared memories', () => {
  it('removing a shared moment from one pet keeps it and its photo for the other', async () => {
    const { removeMomentFromPet, listMoments } = await import('../src/data/memoriesRepo');
    const { db, honey, tabby } = await phoneWithPhotos();
    const [shared] = (await listMoments(db, tabby.id)).filter((m) => m.petIds.length > 1);
    expect(await removeMomentFromPet(db, shared.id, honey.id)).toBe(true);
    expect((await listMoments(db, honey.id)).some((m) => m.id === shared.id)).toBe(false);
    const kept = (await listMoments(db, tabby.id)).find((m) => m.id === shared.id)!;
    expect(kept.petIds).toEqual([tabby.id]);
    expect(await referencedFiles(db)).toContain('memories/a.jpg');
    // not shared any more: the caller deletes instead
    expect(await removeMomentFromPet(db, shared.id, tabby.id)).toBe(false);
  });
});
