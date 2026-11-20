import { describe, expect, it } from 'vitest';
import { WELCOME_NOTIF_H, fitHeroPet, homePetSize, previewSize } from '../src/ui/sizing';

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

describe('welcome pets fit the space their slide has left', () => {
  const sizes = [
    { name: 'small phone 320×568', box: { w: 320, h: 130 } },
    { name: 'Samsung A 360×800', box: { w: 360, h: 330 } },
    { name: 'tablet landscape', box: { w: 1280, h: 260 } },
    { name: 'tablet portrait', box: { w: 800, h: 760 } },
  ];
  it('the pet preview (size × 1.12) never exceeds the measured box, nor the budget', () => {
    for (const { box } of sizes) {
      const s = fitHeroPet('pet', 300, box);
      if (s > 0) {
        expect(s * 1.12).toBeLessThanOrEqual(box.h + 0.5);
        expect(s * 1.12).toBeLessThanOrEqual(box.w);
      }
      expect(s).toBeLessThanOrEqual(300);
    }
  });
  it('the cat under the notification card fits too, or is left out', () => {
    for (const { box } of sizes) {
      const s = fitHeroPet('notif', 300, box);
      if (s > 0) expect(WELCOME_NOTIF_H + s * 0.85 * 1.05).toBeLessThanOrEqual(box.h + 0.5);
    }
    expect(fitHeroPet('notif', 300, { w: 320, h: 130 })).toBe(0); // no room under the card: text only
  });
  it('too little room means no pet rather than a clipped one; no room measured yet means none', () => {
    expect(fitHeroPet('pet', 300, { w: 320, h: 60 })).toBe(0);
    expect(fitHeroPet('pet', 300, { w: 0, h: 0 })).toBe(0);
    expect(fitHeroPet('pet', 0, { w: 400, h: 400 })).toBe(0);
  });
  it('on an ordinary phone the pet keeps the size the screen budget gave it', () => {
    expect(fitHeroPet('pet', 160, { w: 360, h: 330 })).toBe(160);
  });
});

describe("Home's pet leaves room for the + button on every phone", () => {
  // real screens with their real system bars (top: status bar / notch / Dynamic Island; bottom:
  // home indicator, Android gesture bar or 3-button navigation bar)
  const devices: [string, number, number, number, number][] = [
    ['iPhone SE (2nd/3rd gen)', 375, 667, 20, 0],
    ['iPhone 13 mini', 375, 812, 50, 34],
    ['iPhone 15', 393, 852, 59, 34],
    ['iPhone 15 Pro Max', 430, 932, 59, 34],
    ['small Android, 3-button nav', 360, 640, 24, 48],
    ['Samsung Galaxy A, 3-button nav', 360, 800, 30, 48],
    ['Pixel 8, gesture nav', 412, 915, 40, 24],
    ['Android tablet landscape', 1280, 800, 24, 48],
  ];
  it.each(devices)('%s', (_name, w, h, top, bottom) => {
    const size = homePetSize(w, h, top, bottom);
    const peekBottom = top + 331 + size * 1.05; // where the next-care card ends
    const fabTop = h - bottom - 82; // where the + button starts
    expect(peekBottom + 14).toBeLessThanOrEqual(fabTop);
    expect(size).toBeGreaterThanOrEqual(96);
  });
  it('tall phones keep (almost) the big pet they had', () => {
    const before = Math.min(393 * 0.8, 852 * 0.42); // 314 on an iPhone 15
    expect(homePetSize(393, 852, 59, 34)).toBeGreaterThanOrEqual(Math.floor(before * 0.95));
    expect(homePetSize(430, 932, 59, 34)).toBeGreaterThanOrEqual(330);
  });
});
