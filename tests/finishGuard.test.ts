import { afterEach, describe, expect, it, vi } from 'vitest';
import { withinTime } from '../src/data/lock';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const created: string[] = [];
const removed: string[] = [];
vi.mock('expo-audio', () => ({
  setAudioModeAsync: () => Promise.resolve(),
  createAudioPlayer: (src: unknown) => {
    const id = String(src);
    created.push(id);
    return { volume: 1, seekTo: () => Promise.resolve(), play: () => {}, remove: () => removed.push(id) };
  },
}));
vi.mock('../src/native/soundSources', () => ({
  SOURCES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

afterEach(() => vi.useRealTimers());

describe('withinTime (the last setup buttons never spin forever)', () => {
  it('passes a quick result through', async () => {
    expect(await withinTime(Promise.resolve(7), 1000)).toEqual({ ok: true, value: 7 });
  });
  it('moves on when the work never answers', async () => {
    vi.useFakeTimers();
    const r = withinTime(new Promise(() => {}), 8000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await r).toEqual({ ok: false });
  });
  it('still reports a real failure (the owner sees the error and can retry)', async () => {
    await expect(withinTime(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});

describe('sound players (Android: each one is an ExoPlayer and its calls block the JS thread)', () => {
  it('never keeps more than MAX_PLAYERS alive, releasing the least recently used', async () => {
    vi.useFakeTimers();
    const s = await import('../src/native/sound');
    const names = ['tap', 'select', 'tick', 'log', 'pop', 'slide_1', 'slide_2', 'slide_3', 'slide_done', 'save', 'complete', 'badge', 'open', 'pet'] as const;
    for (const n of names) {
      s.playSound(n === 'tap' ? 'select' : n);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(s.livePlayers().length).toBeLessThanOrEqual(s.MAX_PLAYERS);
    expect(created.length - removed.length).toBe(s.livePlayers().length);
    expect(s.livePlayers()).toContain('pet');
  });
  it('plays after the handler has returned, not inside it', async () => {
    vi.useFakeTimers();
    const s = await import('../src/native/sound');
    const before = created.length;
    s.playSound('delete');
    expect(created.length).toBe(before); // nothing native touched during the tap handler
    await vi.advanceTimersByTimeAsync(1);
    expect(created.length).toBe(before + 1);
  });
});
