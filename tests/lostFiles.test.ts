import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/migrations';
import { createPet, getSetting, setSetting } from '../src/data/repo';
import { addMedia, addMoment } from '../src/data/memoriesRepo';
import { findLost, lostItems, lostPaths, type LocalFiles, type RemoteFiles } from '../src/data/mediaBackup';
import { addAttachment, createRecord } from '../src/data/recordsRepo';
import { hasUnsavedChanges, markDirty, runBackup } from '../src/data/backupRun';
import { openNodeDb } from './helpers/nodeDb';

type Phone = LocalFiles & { files: Record<string, number> };
const phoneFiles = (files: Record<string, number> = {}): Phone => ({ files, size: (p) => (p in files ? files[p] : null), remove: (p) => void delete files[p] });
function cloudFor(phone: Phone, store: Record<string, number>, offline = { on: false }): RemoteFiles {
  return {
    async put(p) {
      if (offline.on) throw new Error('offline');
      store[p] = phone.files[p];
      return { size: store[p] };
    },
    async get(p) {
      if (offline.on) throw new Error('offline');
      if (!(p in store)) throw new Error('not found');
      phone.files[p] = store[p];
      return { size: store[p] };
    },
    async remove(p) {
      delete store[p];
    },
  };
}
const upload = async (_c: string[], meta: { updatedAt: number }) => ({ updatedAt: meta.updatedAt });

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
  return { db, pet, local: phoneFiles(files) };
}

describe('a photo missing everywhere does not trap the account', () => {
  it('once everything that exists is uploaded, "unsaved changes" clears; the lost photo stays reported', async () => {
    const { db, local } = await phoneWith(3);
    const store: Record<string, number> = {};
    delete local.files['memories/p1.jpg']; // gone from the phone before it was ever uploaded
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(r.status).toBe('uploaded');
    if (r.status !== 'uploaded') return;
    expect(r.files.lost).toBe(1);
    expect(r.saved).toBe(true); // everything this phone has is in the cloud
    expect(r.complete).toBe(false); // but not every photo is protected
    expect(await hasUnsavedChanges(db)).toBe(false);
    // the next run finds nothing new to do and still reports the lost photo
    const r2 = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(r2.status === 'uploaded' && r2.files.lost === 1 && r2.saved).toBe(true);
    expect(await getSetting(db, 'cloud.dirty')).toBe('0');
  });

  it('a lost photo never hides a photo that is still waiting: offline, "unsaved" stays set', async () => {
    const { db, local } = await phoneWith(3);
    const store: Record<string, number> = {};
    delete local.files['memories/p1.jpg'];
    const offline = { on: true };
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, store, offline), upload });
    expect(r.status === 'uploaded' && !r.saved && r.files.pending > 0).toBe(true);
    expect(await hasUnsavedChanges(db)).toBe(true);
    offline.on = false;
    const r2 = await runBackup(db, 'u1', { local, remote: cloudFor(local, store, offline), upload });
    expect(r2.status === 'uploaded' && r2.saved && r2.files.lost === 1).toBe(true);
    expect(await hasUnsavedChanges(db)).toBe(false);
  });
});

describe('looking again for lost photos (owner-initiated, never destructive)', () => {
  it('a photo another phone uploaded is found, recorded, and the backup becomes complete', async () => {
    const { db, local } = await phoneWith(2);
    const store: Record<string, number> = { 'memories/p1.jpg': 1001 }; // in the cloud, but this phone has no record of it
    delete local.files['memories/p1.jpg'];
    const before = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(before.status === 'uploaded' && before.files.lost === 1).toBe(true);
    const r = await findLost(db, 'u1', local, cloudFor(local, store));
    expect(r).toEqual({ found: 1, still: [] });
    expect(local.files['memories/p1.jpg']).toBe(1001);
    const after = await runBackup(db, 'u1', { local, remote: cloudFor(local, store), upload });
    expect(after.status === 'uploaded' && after.complete && after.files.lost === 0).toBe(true);
  });

  it('a photo that is nowhere stays listed; no memory, photo or row is removed', async () => {
    const { db, local } = await phoneWith(2);
    delete local.files['memories/p0.jpg'];
    const rowsBefore = await db.getAllAsync('SELECT * FROM memories ORDER BY id', []);
    const filesBefore = { ...local.files };
    const r = await findLost(db, 'u1', local, cloudFor(local, {}));
    expect(r.found).toBe(0);
    expect(r.still).toEqual(['memories/p0.jpg']);
    expect(await db.getAllAsync('SELECT * FROM memories ORDER BY id', [])).toEqual(rowsBefore);
    expect(local.files).toEqual(filesBefore);
  });

  it('offline: looking again changes nothing', async () => {
    const { db, local } = await phoneWith(1);
    delete local.files['memories/p0.jpg'];
    const r = await findLost(db, 'u1', local, cloudFor(local, { 'memories/p0.jpg': 1000 }, { on: true }));
    expect(r).toEqual({ found: 0, still: ['memories/p0.jpg'] });
    expect(await lostPaths(db, 'u1', local)).toEqual(['memories/p0.jpg']);
  });

  it('a cut-off download is never kept as the photo', async () => {
    const { db, local } = await phoneWith(1);
    delete local.files['memories/p0.jpg'];
    const partial: RemoteFiles = {
      ...cloudFor(local, {}),
      async get(p) {
        local.files[p] = 12; // half a file landed on disk
        return { size: 1000 };
      },
    };
    const r = await findLost(db, 'u1', local, partial);
    expect(r.still).toEqual(['memories/p0.jpg']);
    expect('memories/p0.jpg' in local.files).toBe(false);
  });

  it('a lost thumbnail is rebuilt from its original', async () => {
    const { db, local } = await phoneWith(1);
    delete local.files['memories/thumbs/p0.jpg'];
    const withRebuild: Phone = { ...local, rebuildThumb: async (thumb) => ((local.files[thumb] = 40), true) };
    const r = await findLost(db, 'u1', withRebuild, cloudFor(local, {}));
    expect(r).toEqual({ found: 1, still: [] });
  });

  it('names the memory a lost photo belongs to, so the owner can find it', async () => {
    const { db, local } = await phoneWith(3);
    delete local.files['memories/p2.jpg'];
    delete local.files['memories/thumbs/p2.jpg'];
    const items = await lostItems(db, await lostPaths(db, 'u1', local));
    expect(items).toHaveLength(1); // the photo and its thumbnail are one memory
    expect(items[0]).toMatchObject({ kind: 'memory', date: '2026-11-01' });
  });

  it('names a record whose document is lost', async () => {
    const { db, pet, local } = await phoneWith(0);
    const rec = await createRecord(db, { petId: pet.id, kind: 'vaccine', title: 'Rabies booster', date: '2026-10-02' });
    await addAttachment(db, 'record', rec, { uri: 'pv-doc:attachments/card.pdf', mime: 'application/pdf', name: 'card.pdf' });
    const items = await lostItems(db, await lostPaths(db, 'u1', local));
    expect(items).toEqual([{ kind: 'record', id: rec, title: 'Rabies booster', date: '2026-10-02' }]);
  });
});

describe('a photo the phone cannot read right now is waiting, never lost', () => {
  it('keeps "unsaved changes" on (so sign-out stays blocked) and is not listed as lost', async () => {
    const { db, local } = await phoneWith(2);
    const flaky: Phone = {
      ...local,
      size: (p) => {
        if (p === 'memories/p0.jpg') throw new Error('EACCES');
        return local.size(p);
      },
    };
    const r = await runBackup(db, 'u1', { local: flaky, remote: cloudFor(local, {}), upload });
    expect(r.status).toBe('uploaded');
    if (r.status !== 'uploaded') return;
    expect(r.files.lost).toBe(0);
    expect(r.files.pending).toBe(1);
    expect(r.saved).toBe(false);
    expect(await hasUnsavedChanges(db)).toBe(true);
    expect(await lostPaths(db, 'u1', flaky)).toEqual([]);
  });
});

describe('an edit made while a backup is uploading', () => {
  it('keeps "unsaved changes" on, so a newer backup from another phone can never replace it', async () => {
    const { db, local } = await phoneWith(1);
    await markDirty(db);
    const slowUpload = async (_c: string[], meta: { updatedAt: number }) => {
      await markDirty(db); // the owner logged a meal while the snapshot was on its way
      return { updatedAt: meta.updatedAt };
    };
    const r = await runBackup(db, 'u1', { local, remote: cloudFor(local, {}), upload: slowUpload });
    expect(r.status === 'uploaded' && r.saved).toBe(false);
    expect(await hasUnsavedChanges(db)).toBe(true);
    // the next run includes the edit and clears it
    const r2 = await runBackup(db, 'u1', { local, remote: cloudFor(local, {}), upload });
    expect(r2.status === 'uploaded' && r2.saved).toBe(true);
    expect(await hasUnsavedChanges(db)).toBe(false);
  });
});
