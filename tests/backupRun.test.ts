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

describe('backup durability', () => {
  async function phoneWith(n: number) {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const pet = await createPet(db, { species: 'cat', name: 'Mochi' });
    const files: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const m = await addMedia(db, { uri: `pv-doc:memories/p${i}.jpg`, thumbUri: `pv-doc:memories/thumbs/p${i}.jpg`, width: 10, height: 10, mime: 'image/jpeg', capturedAt: null });
      await addMoment(db, { petIds: [pet.id], mediaId: m.id, date: '2026-11-01' });
      files[`memories/p${i}.jpg`] = 1000 + i;
      files[`memories/thumbs/p${i}.jpg`] = 50;
    }
    await setSetting(db, 'cloud.dirty', '1');
    return { db, local: phoneFiles(files) };
  }
  const upload = async (_c: string[], meta: { updatedAt: number }) => ({ updatedAt: meta.updatedAt });

  it('300 photos, a long time offline, interrupted runs, then reconnection: stays pending until every file is up', async () => {
    const { db, local } = await phoneWith(300); // 600 files with thumbnails
    const store: Record<string, number> = {};
    // a long offline period: every upload fails, many runs in a row
    const offline = new Set(Object.keys(local.files));
    for (let i = 0; i < 12; i++) {
      const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store, offline), upload });
      expect(r.status === 'uploaded' && !r.complete && r.files.pending > 0).toBe(true);
      expect(await getSetting(db, 'cloud.dirty')).toBe('1');
    }
    // back online, but the app keeps being backgrounded: each run only gets a few files through
    // (the per-run limit is 40); progress is recorded file by file, so nothing is redone
    let runs = 0;
    let r;
    do {
      r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
      runs++;
      if (r.status === 'uploaded' && !r.complete) expect(await getSetting(db, 'cloud.dirty')).toBe('1');
    } while (r.status === 'uploaded' && !r.complete && runs < 40);
    expect(r.status === 'uploaded' && r.complete).toBe(true);
    expect(runs).toBe(Math.ceil(600 / 40));
    expect(Object.keys(store)).toHaveLength(600);
    expect(await getSetting(db, 'cloud.dirty')).toBe('0');
  });

  it('a flaky connection (every third upload fails) still converges, never reporting complete early', async () => {
    const { db, local } = await phoneWith(50);
    const store: Record<string, number> = {};
    let calls = 0;
    const flaky: RemoteFiles = {
      ...cloudFor(local, store),
      async put(p) {
        if (++calls % 3 === 0) throw new Error('reset');
        store[p] = local.files[p];
        return { size: store[p] };
      },
    };
    let r;
    for (let i = 0; i < 20; i++) {
      r = await runBackup(db, 'u1', { local, remote: flaky, upload });
      const allUp = Object.keys(local.files).every((p) => p in store);
      if (r.status === 'uploaded') expect(r.complete).toBe(allUp);
      if (r.status === 'uploaded' && r.complete) break;
    }
    expect(r?.status === 'uploaded' && r.complete).toBe(true);
  });

  it('a photo missing from the phone AND from the cloud is never counted as backed up', async () => {
    const { db, local } = await phoneWith(3);
    const store: Record<string, number> = {};
    // lost before it was ever uploaded (deleted from storage, failed copy…)
    delete local.files['memories/p1.jpg'];
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(r.status).toBe('uploaded');
    if (r.status !== 'uploaded') return;
    expect(r.files.lost).toBe(1);
    expect(r.complete).toBe(false);
    // backing up again can't bring it back, so it doesn't pin "unsaved changes" (see lostFiles.test.ts)
    expect(r.saved).toBe(true);
    expect(await getSetting(db, 'cloud.dirty')).toBe('0');
    // everything else did go up
    expect(Object.keys(store)).toHaveLength(5);
  });

  it('a photo that is only in the cloud (new phone, not downloaded yet) counts as safe', async () => {
    const { db, local } = await phoneWith(2);
    const store: Record<string, number> = {};
    await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    delete local.files['memories/p0.jpg'];
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(r.status === 'uploaded' && r.complete && r.files.lost === 0).toBe(true);
  });
});
