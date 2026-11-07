import { describe, expect, it } from 'vitest';
import { previewSize } from '../src/ui/sizing';

// available = window height − status/navigation bars − the screen's fixed parts (title, button…)
describe('pet preview sizing', () => {
  it('keeps the studio pet around 160–210 dp tall on ordinary phones', () => {
    const s = previewSize('studio', 412, 915 - 32 - 48 - 250);
    expect(s * 1.05).toBeGreaterThanOrEqual(150);
    expect(s * 1.05).toBeLessThanOrEqual(212);
  });

  it('shrinks the studio pet on a compact phone instead of pushing the controls away', () => {
    const s = previewSize('studio', 360, 640 - 24 - 48 - 250);
    expect(s).toBeLessThanOrEqual(115);
  });

  it('gives the name field priority when the keyboard is open', () => {
    const closed = previewSize('form', 412, 600);
    const open = previewSize('form', 412, 600, 300);
    expect(open).toBeLessThan(closed);
    expect(open).toBeLessThanOrEqual(120);
    // tiny space left: the pet steps aside completely
    expect(previewSize('form', 360, 400, 300)).toBe(0);
  });

  it('never lets the hero pet take more than about a third of the space', () => {
    expect(previewSize('hero', 412, 500) * 1.05).toBeLessThanOrEqual(500 * 0.4 + 1);
    expect(previewSize('hero', 1024, 2000)).toBeLessThanOrEqual(300);
  });
});
