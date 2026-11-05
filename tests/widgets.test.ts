import { describe, expect, it } from 'vitest';
import { buildTimeline, sceneAt, usualHour, type WidgetInput } from '../src/domain/widgets';

const day0 = new Date(2026, 10, 5).getTime();
const at = (h: number, m = 0, d = 0) => new Date(2026, 10, 5 + d, h, m).getTime();
const fmt = (ms: number) => `${new Date(ms).getHours()}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`;

function input(over: Partial<WidgetInput> = {}): WidgetInput {
  return {
    petName: 'Honey',
    species: 'dog',
    days: [
      {
        start: day0,
        planned: 4,
        done: 1,
        photo: false,
        occurrences: [
          { key: 'm1', type: 'meal', title: 'Breakfast', at: at(8), closed: true },
          { key: 'w1', type: 'walk', title: 'Morning walk', at: at(12), closed: false },
          { key: 'p1', type: 'medication', title: 'Heart pill', at: at(14), closed: false },
          { key: 'm2', type: 'meal', title: 'Dinner', at: at(19), closed: false },
        ],
      },
      { start: at(0, 0, 1), planned: 4, done: 0, photo: false, occurrences: [{ key: 'm3', type: 'meal', title: 'Breakfast', at: at(8, 0, 1), closed: false }] },
    ],
    pantry: null,
    liveWalk: false,
    habits: { logHour: null, photoHour: null },
    hasPhotos: true,
    ...over,
  };
}

describe('widget scenes', () => {
  it('counts down to the next care', () => {
    const s = sceneAt(input(), at(10), fmt);
    expect(s.kind).toBe('next');
    expect(s.art).toBe('walk');
    expect(s.countdownTo).toBe(at(12));
    expect(s.progressLabel).toBe('1 of 4 today');
    expect(s.route).toBe('log/walk');
  });

  it('a due walk opens the walk timer for a dog', () => {
    const s = sceneAt(input(), at(11, 45), fmt);
    expect(s.kind).toBe('due');
    expect(s.route).toBe('walk');
  });

  it('medicine always wins', () => {
    const i = input();
    i.days[0].occurrences[1].at = at(13, 50); // walk also due
    const s = sceneAt(i, at(14, 5), fmt);
    expect(s.kind).toBe('medicine');
    expect(s.route).toBe('log/medication');
  });

  it('a walk in progress is shown first', () => {
    expect(sceneAt(input({ liveWalk: true }), at(14), fmt, true).kind).toBe('walking');
  });

  it('pantry needs show in the daytime only', () => {
    const p = { name: 'Kibble', line: 'Order today', urgent: true };
    const i = input({ pantry: p });
    i.days[0].occurrences.forEach((o) => (o.closed = true));
    expect(sceneAt(i, at(10), fmt).kind).toBe('pantry');
    expect(sceneAt(i, at(23), fmt).kind).toBe('sleep');
  });

  it('celebrates a finished day, then sleeps with tomorrow’s first care', () => {
    const i = input({ species: 'cat' });
    i.days[0].done = 4;
    i.days[0].occurrences.forEach((o) => (o.closed = true));
    expect(sceneAt(i, at(15), fmt).kind).toBe('done');
    const night = sceneAt(i, at(22), fmt);
    expect(night.kind).toBe('sleep');
    expect(night.art).toBe('sleep');
    expect(night.body).toContain('8:00');
  });

  it('suggests a photo around the owner’s usual photo time', () => {
    const i = input({ habits: { logHour: null, photoHour: 16 } });
    i.days[0].occurrences = i.days[0].occurrences.filter((o) => o.type !== 'medication');
    expect(sceneAt(i, at(16, 30), fmt).kind).toBe('moment');
    i.days[0].photo = true;
    expect(sceneAt(i, at(16, 30), fmt).kind).not.toBe('moment');
  });

  it('nudges gently at the usual check-in hour when nothing is logged', () => {
    const i = input({ habits: { logHour: 7.5, photoHour: null } });
    i.days[0].done = 0;
    i.days[0].occurrences = [{ key: 'x', type: 'meal', title: 'Dinner', at: at(19), closed: false }];
    expect(sceneAt(i, at(7, 30), fmt).kind).toBe('checkin');
  });

  it('builds a deduplicated timeline that changes when it should', () => {
    const tl = buildTimeline(input(), at(9), fmt);
    expect(tl[0].at).toBe(at(9));
    const kinds = tl.map((e) => e.scene.kind);
    expect(kinds).toContain('due');
    expect(kinds).toContain('medicine');
    expect(kinds).toContain('sleep');
    for (let k = 1; k < tl.length; k++) expect(tl[k].at).toBeGreaterThan(tl[k - 1].at);
    expect(tl.every((e) => e.at < at(9) + 24 * 3_600_000)).toBe(true);
  });

  it('learns the usual hour from the first action of each day', () => {
    const times = [0, 1, 2, 3, 4].flatMap((d) => [new Date(2026, 9, 1 + d, 7, 30).getTime(), new Date(2026, 9, 1 + d, 19).getTime()]);
    expect(usualHour(times)).toBeCloseTo(7.5);
    expect(usualHour(times.slice(0, 4))).toBeNull();
  });
});
