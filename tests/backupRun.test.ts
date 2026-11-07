import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, getSetting, setSetting } from '../src/data/repo';
import { addMedia, addMoment } from '../src/data/memoriesRepo';
import { LocalFiles, RemoteFiles, adoptManifest, relinkFiles, restoreMissing } from '../src/data/mediaBackup';
import { fromChunks, restoreSnapshot } from '../src/data/snapshot';
import { runBackup } from '../src/data/backupRun';
import { openNodeDb } from './helpers/nodeDb';

type Phone = LocalFiles & { files: Record<string, number> };
const phoneFiles = (files: Record<string, number> = {}): Phone => ({ files, size: (p) => (p in files ? files[p] : null), remove: (p) => void delete files[p] });

/** the account's cloud: file storage + the latest database snapshot */
function cloudFor(phone: Phone, store: Record<string, number>, failPut = new Set<string>()): RemoteFiles {
  return {
    async put(p) {
      if (failPut.has(p)) throw new Error('network');
      store[p] = phone.files[p];
      return { size: store[p] };
    },
    async get(p) {
      if (!(p in store)) throw new Error('missing');
      phone.files[p] = store[p];
      return { size: store[p] };
    },
    async remove(p) {
      delete store[p];
    },
  };
}

async function phoneA() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const pet = await createPet(db, { species: 'dog', name: 'Honey' });
  const m = await addMedia(db, { uri: 'pv-doc:memories/a.jpg', thumbUri: 'pv-doc:memories/thumbs/a.jpg', width: 10, height: 10, mime: 'image/jpeg', capturedAt: null });
  await addMoment(db, { petIds: [pet.id], mediaId: m.id, date: '2026-11-01' });
  await setSetting(db, 'cloud.dirty', '1');
  return { db, local: phoneFiles({ 'memories/a.jpg': 3000, 'memories/thumbs/a.jpg': 60 }) };
}

describe('backup run', () => {
  it('never reports a complete backup while a photo failed to upload', async () => {
    const { db, local } = await phoneA();
    const store: Record<string, number> = {};
    let chunks: string[] = [];
    const upload = async (c: string[], meta: { updatedAt: number }) => ((chunks = c), { updatedAt: meta.updatedAt });
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store, new Set(['memories/a.jpg'])), upload });
    expect(r.status).toBe('uploaded');
    if (r.status !== 'uploaded') return;
    // the care data is saved, but the run is not complete and "unsaved changes" stays on
    expect(chunks.length).toBeGreaterThan(0);
    expect(r.complete).toBe(false);
    expect(r.files.pending).toBe(1);
    expect(await getSetting(db, 'cloud.dirty')).toBe('1');
    // the snapshot never lists the file that isn't in the cloud
    expect(fromChunks(chunks).files?.map((f) => f.path)).toEqual(['memories/thumbs/a.jpg']);

    // next try with the network back: complete, flag cleared
    const r2 = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(r2.status === 'uploaded' && r2.complete).toBe(true);
    expect(await getSetting(db, 'cloud.dirty')).toBe('0');
  });

  it('treats a broken upload step as incomplete, not as "nothing to upload"', async () => {
    const { db, local } = await phoneA();
    const broken: RemoteFiles = { put: () => Promise.reject(new Error('storage off')), get: () => Promise.reject(new Error('x')), remove: () => Promise.reject(new Error('x')) };
    const brokenLocal: Phone = { ...local, size: () => { throw new Error('fs'); } };
    const r = await runBackup(db, 'u1', { local: brokenLocal, remote: broken, upload: async (_c, m) => ({ updatedAt: m.updatedAt }) });
    expect(r.status === 'uploaded' && r.complete).toBe(false);
    expect(await getSetting(db, 'cloud.dirty')).toBe('1');
  });

  it('keeps the flag when the snapshot upload itself fails', async () => {
    const { db, local } = await phoneA();
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, {}), upload: () => Promise.reject(new Error('offline')) });
    expect(r.status).toBe('failed');
    expect(await getSetting(db, 'cloud.dirty')).toBe('1');
  });

  it('a second phone restores the data and every photo once the first phone finished', async () => {
    const { db, local } = await phoneA();
    const store: Record<string, number> = {};
    let chunks: string[] = [];
    const upload = async (c: string[], meta: { updatedAt: number }) => ((chunks = c), { updatedAt: meta.updatedAt });
    await runBackup(db, 'u1', { local, remote: cloudFor(local, store, new Set(['memories/a.jpg'])), upload });
    await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });

    const db2 = openNodeDb(':memory:');
    await migrate(db2);
    const phone2 = phoneFiles();
    const snap = fromChunks(chunks);
    await restoreSnapshot(db2, snap);
    await relinkFiles(db2, 'file:///new/Documents/');
    await adoptManifest(db2, 'u1', snap.files);
    const res = await restoreMissing(db2, 'u1', phone2, cloudFor(phone2, store));
    expect(res.missing).toEqual([]);
    expect(phone2.files['memories/a.jpg']).toBe(3000);
    const pets = await db2.getAllAsync<{ name: string }>('SELECT name FROM pets', []);
    expect(pets.map((p) => p.name)).toEqual(['Honey']);
  });
});
