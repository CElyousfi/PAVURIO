import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupRunner, retryDelay, type BackupOutcome } from '../src/data/backupRunner';
import { migrate } from '../src/data/migrations';
import { createPet, setSetting } from '../src/data/repo';
import { addMedia, addMoment } from '../src/data/memoriesRepo';
import type { RemoteFiles } from '../src/data/mediaBackup';
import { runBackup } from '../src/data/backupRun';
import { openNodeDb } from './helpers/nodeDb';

/** a run we can finish by hand */
function controllable() {
  const calls: { resolve: (o: BackupOutcome) => void }[] = [];
  const runOnce = vi.fn(() => new Promise<BackupOutcome>((resolve) => calls.push({ resolve })));
  return { calls, runOnce };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('backup runner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never runs two backups at once; requests during a run share one follow-up run', async () => {
    const { calls, runOnce } = controllable();
    const r = new BackupRunner(runOnce);
    const first = r.request();
    const a = r.request(); // app went to background
    const b = r.request(); // the 15 s change timer
    const c = r.request(); // a retry timer
    expect(runOnce).toHaveBeenCalledTimes(1);
    calls[0].resolve('saved');
    expect(await first).toBe('saved');
    await flush();
    expect(runOnce).toHaveBeenCalledTimes(2); // exactly one follow-up, with the latest data
    calls[1].resolve('saved');
    expect(await Promise.all([a, b, c])).toEqual(['saved', 'saved', 'saved']);
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it('offline: a failed run is retried with a growing delay, and stops once saved', async () => {
    let online = false;
    const runOnce = vi.fn(async (): Promise<BackupOutcome> => (online ? 'saved' : 'failed'));
    const r = new BackupRunner(runOnce);
    expect(await r.request()).toBe('failed');
    expect(r.retryPending).toBe(true);
    await vi.advanceTimersByTimeAsync(retryDelay(0)); // 30 s
    expect(runOnce).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(retryDelay(1) - 1); // just under 1 min: not yet
    expect(runOnce).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(runOnce).toHaveBeenCalledTimes(3);
    online = true; // network back
    await vi.advanceTimersByTimeAsync(retryDelay(2));
    expect(runOnce).toHaveBeenCalledTimes(4);
    expect(r.retryPending).toBe(false);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(runOnce).toHaveBeenCalledTimes(4);
  });

  it('keeps retrying every 30 minutes for a long outage (never gives up while the app is open)', async () => {
    const runOnce = vi.fn(async (): Promise<BackupOutcome> => 'failed');
    const r = new BackupRunner(runOnce);
    await r.request();
    await vi.advanceTimersByTimeAsync(12 * 60 * 60_000); // 12 hours offline
    // 30s+1+2+4+8+16 min ≈ 31.5 min, then every 30 min
    expect(runOnce.mock.calls.length).toBeGreaterThan(20);
    expect(r.retryPending).toBe(true);
  });

  it('files still waiting are retried too; a thrown error counts as a failure, not success', async () => {
    const outcomes: (BackupOutcome | Error)[] = ['waiting', new Error('boom'), 'saved'];
    const runOnce = vi.fn(async () => {
      const o = outcomes.shift()!;
      if (o instanceof Error) throw o;
      return o;
    });
    const r = new BackupRunner(runOnce);
    expect(await r.request()).toBe('waiting');
    await vi.advanceTimersByTimeAsync(retryDelay(0));
    await vi.advanceTimersByTimeAsync(retryDelay(1));
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(r.retryPending).toBe(false);
  });

  it('coming back to the foreground restarts the short delay', async () => {
    const runOnce = vi.fn(async (): Promise<BackupOutcome> => 'failed');
    const r = new BackupRunner(runOnce);
    for (let i = 0; i < 4; i++) await r.request(); // delay has grown
    r.resetBackoff();
    await r.request();
    await vi.advanceTimersByTimeAsync(retryDelay(0));
    expect(runOnce).toHaveBeenCalledTimes(6);
  });

  it('nothing is scheduled after dispose, even when a run was still in progress', async () => {
    const { calls, runOnce } = controllable();
    const r = new BackupRunner(runOnce);
    const p = r.request();
    const queued = r.request();
    r.dispose();
    calls[0].resolve('failed');
    await p;
    expect(await queued).toBe('skipped');
    expect(r.retryPending).toBe(false);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(await r.request()).toBe('skipped');
  });

  it('signed out / paused runs schedule nothing', async () => {
    const r = new BackupRunner(async () => 'skipped');
    await r.request();
    expect(r.retryPending).toBe(false);
  });
});

describe('why one run at a time matters (real backup code, no runner)', () => {
  it('two overlapping runs upload the same photos twice', async () => {
    const db = openNodeDb(':memory:');
    await migrate(db);
    const pet = await createPet(db, { species: 'dog', name: 'Honey' });
    const files: Record<string, number> = {};
    for (let i = 0; i < 3; i++) {
      const m = await addMedia(db, { uri: `pv-doc:memories/p${i}.jpg`, thumbUri: null, width: 1, height: 1, mime: 'image/jpeg', capturedAt: null });
      await addMoment(db, { petIds: [pet.id], mediaId: m.id, date: '2026-11-01' });
      files[`memories/p${i}.jpg`] = 100 + i;
    }
    await setSetting(db, 'cloud.dirty', '1');
    const local = { size: (p: string) => (p in files ? files[p] : null), remove: () => {} };
    const puts: string[] = [];
    const remote: RemoteFiles = {
      async put(p) {
        puts.push(p);
        await new Promise((r) => setTimeout(r, 5));
        return { size: files[p] };
      },
      get: async () => ({ size: 0 }),
      remove: async () => {},
    };
    const upload = async (_c: string[], m: { updatedAt: number }) => ({ updatedAt: m.updatedAt });
    await Promise.all([runBackup(db, 'u1', { local, remote, upload }), runBackup(db, 'u1', { local, remote, upload })]);
    expect(puts).toHaveLength(6); // each photo twice: the guard in BackupRunner prevents this
  });
});
