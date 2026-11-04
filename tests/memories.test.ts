import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, migrate } from '../src/data/migrations';
import { createPet } from '../src/data/repo';
import { listMemories } from '../src/data/recordsRepo';
import {
  addMedia,
  addMoment,
  deleteMoment,
  getMoment,
  listMilestones,
  listMoments,
  milestoneDays,
  momentsForWalk,
  momentsOn,
  onThisDay,
  setFavorite,
  setFeatured,
  updateMoment,
} from '../src/data/memoriesRepo';
import { deleteWalk, finishWalk, startWalk } from '../src/data/walkRepo';
import { dumpSnapshot, restoreSnapshot } from '../src/data/snapshot';
import {
  anniversaryPrompts,
  coverRect,
  exifCapturedAt,
  groupByMonth,
  momentDay,
  nextAnniversary,
  onThisDayYears,
  panBy,
} from '../src/domain/memories';
import { TEMPLATES, fillSlots, missingSlots, prefillPhotos, swapSlots, templateFor } from '../src/features/memoryCards';
import { TEMPLATE_LAYOUT } from '../src/features/memoryTemplates.generated';
import { openNodeDb } from './helpers/nodeDb';

async function setup() {
  const db = openNodeDb(':memory:');
  await migrate(db);
  const honey = await createPet(db, { species: 'dog', name: 'Honey' });
  const miso = await createPet(db, { species: 'cat', name: 'Miso' });
  return { db, honey, miso };
}
const photo = (db: Awaited<ReturnType<typeof setup>>['db'], uri = 'file:///doc/memories/a.jpg') =>
  addMedia(db, { uri, thumbUri: uri.replace('.jpg', '_t.jpg'), width: 3000, height: 4000, mime: 'image/jpeg', capturedAt: null });

describe('memories schema v5', () => {
  it('extends the existing memories table and backfills pets, media and adventure links', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(5);
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)', [])).map((c) => c.name);
    for (const c of ['media_id', 'favorite', 'featured', 'milestone', 'walk_id', 'captured_at', 'updated_at', 'title', 'photo_uri']) expect(cols).toContain(c);
  });

  it('upgrades a v4 database without losing memories', async () => {
    const db = openNodeDb(':memory:');
    const { migrateTo } = await import('./helpers/migrateTo');
    await migrateTo(db, 4);
    await db.runAsync("INSERT INTO pets (id, species, name, appearance_json, created_at, updated_at) VALUES ('p1', 'dog', 'Rex', '{}', 0, 0)", []);
    await db.runAsync("INSERT INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at) VALUES ('m1', 'p1', 'file:///x.jpg', 'Beach', NULL, '2025-06-01', 'moment', 1)", []);
    await db.runAsync("INSERT INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at) VALUES ('m2', 'p1', NULL, 'Gotcha', NULL, '2025-03-01', 'milestone', 2)", []);
    await db.runAsync("INSERT INTO memories (id, pet_id, photo_uri, title, caption, date, kind, created_at) VALUES ('walk-w1', 'p1', 'file:///w.jpg', '20 min walk', NULL, '2025-03-02', 'adventure', 3)", []);
    await migrate(db);
    const all = await listMoments(db, 'p1');
    expect(all.map((m) => m.id)).toEqual(['m1', 'walk-w1', 'm2']);
    const m1 = all.find((m) => m.id === 'm1')!;
    expect(m1.mediaId).toBe('legacy-m1');
    expect(m1.photoUri).toBe('file:///x.jpg');
    expect(all.find((m) => m.id === 'm2')!.milestone).toBe('custom');
    expect(all.find((m) => m.id === 'walk-w1')!.walkId).toBe('w1');
    expect(all.find((m) => m.id === 'walk-w1')!.mediaId).toBeNull();
  });
});

describe('moments', () => {
  it('saves a photo moment without a title and lists it under today', async () => {
    const { db, honey } = await setup();
    const media = await photo(db);
    const m = await addMoment(db, { petIds: [honey.id], mediaId: media.id, date: '2026-11-02' });
    expect(m.title).toBe('');
    expect(m.photoUri).toBe(media.uri);
    expect(m.thumbUri).toBe(media.thumbUri);
    expect((await momentsOn(db, honey.id, '2026-11-02')).map((x) => x.id)).toEqual([m.id]);
  });

  it('needs a photo, a title or a milestone; a custom milestone needs a name', async () => {
    const { db, honey } = await setup();
    await expect(addMoment(db, { petIds: [honey.id], date: '2026-11-02' })).rejects.toThrow();
    await expect(addMoment(db, { petIds: [honey.id], date: '2026-11-02', milestone: 'custom' })).rejects.toThrow();
    await expect(addMoment(db, { petIds: [], date: '2026-11-02', title: 'x' })).rejects.toThrow();
    await expect(addMoment(db, { petIds: [honey.id], date: '2026-11-02', title: 'x'.repeat(61) })).rejects.toThrow();
    const ms = await addMoment(db, { petIds: [honey.id], date: '2026-01-10', milestone: 'firsttrick' });
    expect(ms.kind).toBe('milestone');
  });

  it('shares one moment between pets without duplicating it', async () => {
    const { db, honey, miso } = await setup();
    const media = await photo(db);
    const m = await addMoment(db, { petIds: [honey.id, miso.id, miso.id], mediaId: media.id, date: '2026-11-02' });
    expect(m.petIds).toEqual([honey.id, miso.id]);
    expect((await listMoments(db, miso.id)).map((x) => x.id)).toEqual([m.id]);
    expect((await listMemories(db, miso.id)).map((x) => x.id)).toEqual([m.id]); // stories see it too
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories', []))!.n).toBe(1);
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM media', []))!.n).toBe(1);
    // removing Miso from it keeps it for Honey
    await updateMoment(db, m.id, { petIds: [honey.id], mediaId: media.id, date: m.date });
    expect(await listMoments(db, miso.id)).toHaveLength(0);
    expect(await listMoments(db, honey.id)).toHaveLength(1);
  });

  it('keeps one featured moment per pet and day; favorites toggle', async () => {
    const { db, honey } = await setup();
    const a = await addMoment(db, { petIds: [honey.id], mediaId: (await photo(db, 'file:///a.jpg')).id, date: '2026-11-02', featured: true });
    const b = await addMoment(db, { petIds: [honey.id], mediaId: (await photo(db, 'file:///b.jpg')).id, date: '2026-11-02' });
    await setFeatured(db, b.id, true);
    expect((await getMoment(db, a.id))!.featured).toBe(false);
    expect((await momentsOn(db, honey.id, '2026-11-02'))[0].id).toBe(b.id);
    await setFavorite(db, a.id, true);
    expect((await listMoments(db, honey.id, { favoritesOnly: true })).map((x) => x.id)).toEqual([a.id]);
  });

  it('deletes a file only when nothing else uses it', async () => {
    const { db, honey } = await setup();
    const media = await photo(db, 'file:///doc/memories/shared.jpg');
    const a = await addMoment(db, { petIds: [honey.id], mediaId: media.id, date: '2026-11-01' });
    const b = await addMoment(db, { petIds: [honey.id], mediaId: media.id, date: '2026-11-02', title: 'again' });
    expect(await deleteMoment(db, a.id)).toEqual([]); // b still uses it
    expect(await deleteMoment(db, b.id)).toEqual(['file:///doc/memories/shared.jpg', 'file:///doc/memories/shared_t.jpg']);
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM media', []))!.n).toBe(0);
  });

  it('keeps a file a walk still points at', async () => {
    const { db, honey } = await setup();
    const uri = 'file:///doc/walk.jpg';
    const w = await startWalk(db, honey.id, null, Date.now() - 20 * 60_000);
    await db.runAsync('UPDATE walks SET photo_uri = ? WHERE id = ?', [uri, w.id]);
    const media = await addMedia(db, { uri, thumbUri: null, width: 1, height: 1, mime: 'image/jpeg', capturedAt: null });
    const m = await addMoment(db, { petIds: [honey.id], mediaId: media.id, date: '2026-11-02' });
    expect(await deleteMoment(db, m.id)).toEqual([]);
  });

  it('replacing a photo releases the old one', async () => {
    const { db, honey } = await setup();
    const a = await photo(db, 'file:///a.jpg');
    const b = await photo(db, 'file:///b.jpg');
    const m = await addMoment(db, { petIds: [honey.id], mediaId: a.id, date: '2026-11-02' });
    const r = await updateMoment(db, m.id, { petIds: [honey.id], mediaId: b.id, date: '2026-11-02' });
    expect(r.freedFiles).toEqual(['file:///a.jpg', 'file:///a_t.jpg']);
    expect(r.moment.photoUri).toBe('file:///b.jpg');
  });

  it('links photos to an adventure and unlinks them when the walk goes', async () => {
    const { db, honey } = await setup();
    const start = Date.now() - 30 * 60_000;
    const w = await startWalk(db, honey.id, null, start);
    await finishWalk(db, w.id, { now: start + 25 * 60_000 });
    const m = await addMoment(db, { petIds: [honey.id], mediaId: (await photo(db)).id, date: '2026-11-02', walkId: w.id });
    expect((await momentsForWalk(db, w.id)).map((x) => x.id)).toEqual([m.id]);
    const adventure = (await listMoments(db, honey.id)).find((x) => x.kind === 'adventure')!;
    expect(adventure.petIds).toEqual([honey.id]); // the trigger linked walkRepo's insert
    await deleteWalk(db, w.id);
    expect((await getMoment(db, m.id))!.walkId).toBeNull();
  });

  it('finds On This Day memories from earlier years (Feb 29 on Feb 28)', async () => {
    const { db, honey } = await setup();
    const p = await photo(db);
    await addMoment(db, { petIds: [honey.id], mediaId: p.id, date: '2024-11-02' });
    await addMoment(db, { petIds: [honey.id], mediaId: p.id, date: '2025-11-02' });
    await addMoment(db, { petIds: [honey.id], mediaId: p.id, date: '2026-11-02' }); // today: not "on this day"
    await addMoment(db, { petIds: [honey.id], date: '2023-11-02', title: 'no photo' });
    await addMoment(db, { petIds: [honey.id], mediaId: p.id, date: '2024-02-29' });
    expect((await onThisDay(db, honey.id, '2026-11-02')).map((x) => x.years)).toEqual([1, 2]);
    expect((await onThisDay(db, honey.id, '2027-02-28')).map((x) => x.years)).toEqual([3]);
    expect(await onThisDay(db, honey.id, '2028-02-28')).toHaveLength(0); // 2028 has its own Feb 29
  });

  it('lists milestones as a timeline and marks their days', async () => {
    const { db, honey } = await setup();
    await addMoment(db, { petIds: [honey.id], date: '2026-03-01', milestone: 'firstday' });
    await addMoment(db, { petIds: [honey.id], date: '2026-05-01', milestone: 'firsttrick', title: 'Sit!' });
    expect((await listMilestones(db, honey.id)).map((m) => m.milestone)).toEqual(['firstday', 'firsttrick']);
    expect(await milestoneDays(db, honey.id, '2026-05-01', '2026-05-31')).toEqual([{ date: '2026-05-01', milestone: 'firsttrick' }]);
  });

  it('backs up and restores media and shared pets', async () => {
    const { db, honey, miso } = await setup();
    const m = await addMoment(db, { petIds: [honey.id, miso.id], mediaId: (await photo(db)).id, date: '2026-11-02', favorite: true });
    const snap = await dumpSnapshot(db);
    const db2 = openNodeDb(':memory:');
    await migrate(db2);
    await restoreSnapshot(db2, snap);
    const back = await getMoment(db2, m.id);
    expect(back!.petIds.sort()).toEqual([honey.id, miso.id].sort());
    expect(back!.favorite).toBe(true);
    expect(back!.photoUri).toBe('file:///doc/memories/a.jpg');
  });
});

describe('memories rules', () => {
  it('reads EXIF capture dates and rejects junk', () => {
    expect(exifCapturedAt({ DateTimeOriginal: '2024:05:03 14:22:10' })).toBe(new Date(2024, 4, 3, 14, 22, 10).getTime());
    expect(exifCapturedAt({ '{Exif}': { DateTimeOriginal: '2023:01:02 03:04:05' } })).toBe(new Date(2023, 0, 2, 3, 4, 5).getTime());
    expect(exifCapturedAt({ DateTimeOriginal: '0000:00:00 00:00:00' })).toBeNull();
    expect(exifCapturedAt({ DateTimeOriginal: '2023:02:30 10:00:00' })).toBeNull();
    expect(exifCapturedAt(null)).toBeNull();
  });

  it('puts a photo on its capture day, never in the future', () => {
    const now = new Date(2026, 10, 2, 9).getTime();
    expect(momentDay(new Date(2026, 9, 31, 22).getTime(), now)).toBe('2026-10-31');
    expect(momentDay(now + 86_400_000 * 3, now)).toBe('2026-11-02');
    expect(momentDay(null, now)).toBe('2026-11-02');
  });

  it('computes anniversaries from the real dates and prompts around them', () => {
    expect(nextAnniversary('birthday', '2020-11-05', '2026-11-02')).toEqual({ kind: 'birthday', day: '2026-11-05', years: 6, daysAway: 3 });
    expect(nextAnniversary('birthday', '2026-03-01', '2026-11-02')).toEqual({ kind: 'birthday', day: '2027-03-01', years: 1, daysAway: 119 });
    expect(nextAnniversary('birthday', '2026-11-02', '2026-11-02')).toBeNull(); // born today: nothing to celebrate yet
    expect(nextAnniversary('birthday', '2026-11-01', '2026-11-02')!.day).toBe('2027-11-01');
    expect(nextAnniversary('adoption', '2020-02-29', '2027-02-01')!.day).toBe('2027-02-28');
    expect(anniversaryPrompts({ birthDate: '2020-11-05', adoptionDate: '2021-10-31' }, '2026-11-02').map((a) => [a.kind, a.daysAway])).toEqual([
      ['adoption', -2],
      ['birthday', 3],
    ]);
    expect(anniversaryPrompts({ birthDate: '2020-12-25', adoptionDate: null }, '2026-11-02')).toEqual([]);
    expect(onThisDayYears('2025-11-02', '2026-11-02')).toBe(1);
  });

  it('cover-fits photos so the slot is always filled, with clamped pan and zoom', () => {
    const slot = { w: 854, h: 1124 };
    const r = coverRect(4000, 3000, slot);
    expect(r.h).toBeCloseTo(1124);
    expect(r.w).toBeGreaterThan(slot.w);
    expect(r.x).toBeCloseTo(-(r.w - slot.w) / 2);
    const left = coverRect(4000, 3000, slot, { zoom: 1, ox: -5, oy: 0 });
    expect(left.x).toBeCloseTo(-(left.w - slot.w)); // clamped: right edge meets the slot edge
    const right = coverRect(4000, 3000, slot, { zoom: 1, ox: 1, oy: 0 });
    expect(right.x).toBeCloseTo(0);
    const z = coverRect(4000, 3000, slot, { zoom: 99, ox: 0, oy: 0 });
    expect(z.h).toBeCloseTo(1124 * 4);
    // vertical pan on a landscape photo at zoom 1 has nothing to move
    expect(panBy(4000, 3000, slot, { zoom: 1, ox: 0, oy: 0 }, 0, 100).oy).toBe(0);
    expect(panBy(4000, 3000, slot, { zoom: 1, ox: 0, oy: 0 }, 10_000, 0).ox).toBe(1);
  });

  it('groups moments by month', () => {
    expect(groupByMonth([{ date: '2026-11-02' }, { date: '2026-11-01' }, { date: '2026-10-30' }]).map((g) => [g.month, g.items.length])).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ]);
  });
});

describe('memory card templates', () => {
  it('ships every template in both formats with the measured slots', () => {
    const counts: Record<string, number> = { daily: 1, home: 1, thennow: 2, birthday: 1, gotcha: 2, adventures: 3, littlethings: 4, month: 6, bestfriend: 1, year: 12 };
    expect(TEMPLATES.map((x) => x.id).sort()).toEqual(Object.keys(counts).sort());
    for (const tpl of TEMPLATES) {
      for (const f of ['story', 'post'] as const) {
        const L = TEMPLATE_LAYOUT[tpl.id][f];
        expect([L.w, L.h]).toEqual(f === 'story' ? [1080, 1920] : [1080, 1350]);
        expect(L.slots).toHaveLength(counts[tpl.id]);
        for (const s of L.slots) {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.x + s.w).toBeLessThanOrEqual(L.w);
          expect(s.y + s.h).toBeLessThanOrEqual(L.h);
        }
        expect(L.title.w).toBeGreaterThan(200);
        expect(L.footer.w).toBeGreaterThan(150);
      }
      expect(templateFor(tpl.id)).toBe(tpl);
    }
  });
});

describe('card photo suggestions', () => {
  const mk = (id: string, date: string, extra: Partial<{ favorite: boolean; featured: boolean; kind: string; walkId: string | null; photoUri: string | null }> = {}) => ({
    id,
    date,
    photoUri: `file:///${id}.jpg`,
    favorite: false,
    featured: false,
    kind: 'moment',
    walkId: null,
    ...extra,
  });
  const all = [mk('a', '2025-01-10'), mk('b', '2025-06-01', { favorite: true }), mk('c', '2026-11-02'), mk('d', '2026-11-01', { walkId: 'w' }), mk('e', '2026-10-05', { photoUri: null })];
  it('fills Then & Now with the oldest and newest photo', () => {
    expect(prefillPhotos('thennow', all, '2026-11-02').map((m) => m.id)).toEqual(['a', 'c']);
  });
  it('prefers today, then favorites; never photo-less moments; never more than the slots', () => {
    expect(prefillPhotos('daily', all, '2026-11-02').map((m) => m.id)).toEqual(['c']);
    expect(prefillPhotos('littlethings', all, '2026-11-02').map((m) => m.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(prefillPhotos('year', all, '2026-11-02').map((m) => m.id)).toEqual(['a', 'b', 'c']); // one per month, oldest first
  });
  it('puts adventure photos first for Our Adventures', () => {
    expect(prefillPhotos('adventures', all, '2026-11-02')[0].id).toBe('d');
  });
  it('requires every window filled before export and swaps slots', () => {
    expect(missingSlots('thennow', [{}, null])).toBe(1);
    expect(missingSlots('daily', [{}])).toBe(0);
    expect(fillSlots('gotcha', [1])).toEqual([1, null]);
    expect(swapSlots([1, 2, 3], 0, 2)).toEqual([3, 2, 1]);
  });
});

describe('memories safety (review fixes)', () => {
  it('keeps a shared moment for the other pet when its primary pet is deleted', async () => {
    const { db, honey, miso } = await setup();
    const { deletePet } = await import('../src/data/repo');
    const { detachPetMemories } = await import('../src/data/memoriesRepo');
    const shared = await addMoment(db, { petIds: [honey.id, miso.id], mediaId: (await photo(db, 'file:///s.jpg')).id, date: '2026-11-02' });
    await addMoment(db, { petIds: [honey.id], mediaId: (await photo(db, 'file:///own.jpg')).id, date: '2026-11-02' });
    const freed = await detachPetMemories(db, honey.id);
    await deletePet(db, honey.id);
    expect(freed).toEqual(['file:///own.jpg', 'file:///own_t.jpg']);
    const left = await listMoments(db, miso.id);
    expect(left.map((m) => m.id)).toEqual([shared.id]);
    expect(left[0].petIds).toEqual([miso.id]);
    expect(left[0].photoUri).toBe('file:///s.jpg');
  });

  it('never drops the photo of an older row without a media row when editing', async () => {
    const { db, honey } = await setup();
    const { createMemory } = await import('../src/data/recordsRepo');
    const id = await createMemory(db, { petId: honey.id, photoUri: 'file:///old.jpg', title: 'Old', date: '2025-01-01' });
    const before = await getMoment(db, id);
    expect(before!.mediaId).toBeNull();
    const r = await updateMoment(db, id, { petIds: [honey.id], mediaId: 'legacy-' + id, title: 'Old!', date: '2025-01-01' });
    expect(r.moment.photoUri).toBe('file:///old.jpg');
    expect(r.freedFiles).toEqual([]);
  });

  it('gives photos from an older backup a media row on restore', async () => {
    const { db, honey } = await setup();
    const snap = await dumpSnapshot(db);
    snap.tables.memories = [{ id: 'm9', pet_id: honey.id, photo_uri: 'file:///b.jpg', title: 'Beach', caption: null, date: '2024-07-01', kind: 'moment', created_at: 1 }];
    delete (snap.tables as Record<string, unknown>).media;
    delete (snap.tables as Record<string, unknown>).memory_pets;
    await restoreSnapshot(db, snap);
    const m = await getMoment(db, 'm9');
    expect(m!.mediaId).toBe('legacy-m9');
    expect(m!.petIds).toEqual([honey.id]);
  });

  it('resolves files stored relative to the documents folder', async () => {
    const { setDocRoot, storedUri, resolveUri } = await import('../src/data/uris');
    setDocRoot('file:///var/app/A/Documents');
    const s = storedUri('file:///var/app/A/Documents/memories/x.jpg');
    expect(s).toBe('pv-doc:memories/x.jpg');
    setDocRoot('file:///var/app/B/Documents/');
    expect(resolveUri(s)).toBe('file:///var/app/B/Documents/memories/x.jpg');
    expect(resolveUri('data:image/jpeg;base64,xx')).toBe('data:image/jpeg;base64,xx');
  });
});
