/** Pure sizing rules for pet previews (tested in tests/layout.test.ts; used through ./layout). */
export type PreviewKind = 'hero' | 'studio' | 'form' | 'card';

/**
 * The pet's size (its stage is size × 1.05 tall) for the space left on screen.
 * - hero: welcome / welcome home: the pet is the star
 * - studio: appearance editing: big enough to see the colours, never pushing the swatches off screen
 * - form: next to an input: small, and smaller still with the keyboard open
 * - card: species cards and the like
 */
export function previewSize(kind: PreviewKind, width: number, available: number, keyboard = 0): number {
  const room = Math.max(0, available - keyboard);
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)));
  switch (kind) {
    case 'hero':
      return clamp(Math.min(width * 0.66, room * 0.38), 130, 300);
    case 'studio':
      // 160–210 dp tall on ordinary phones (stage height = size × 1.05), smaller on compact ones
      return clamp(Math.min(width * 0.5, room * 0.25), 110, 200);
    case 'form':
      // with the keyboard open the input wins: the pet becomes a small companion, or goes away
      return keyboard > 0 ? (room < 260 ? 0 : clamp(room * 0.25, 64, 120)) : clamp(Math.min(width * 0.46, room * 0.26), 110, 190);
    case 'card':
      return clamp(Math.min(width * 0.34, room * 0.2), 90, 150);
  }
}


/** Height of the welcome notification card plus its gap (used to leave room above the cat). */
export const WELCOME_NOTIF_H = 96;

/**
 * Fits a welcome-slide pet into the space its slide really has left (measured on screen), so a
 * short or narrow phone never pushes the pet under the page dots, and a big screen doesn't stretch
 * it past the budget. `budget` is the screen-wide hero size; returns 0 when there is no sensible
 * room (the slide then shows its text only).
 * - 'pet': the pet's preview box is size × 1.12 square.
 * - 'notif': a notification card sits above the cat, which is drawn at 0.85 × size (stage 1.05 tall).
 */
export function fitHeroPet(kind: 'pet' | 'notif', budget: number, box: { w: number; h: number }): number {
  const MIN = 64;
  if (!(budget > 0) || !(box.w > 0) || !(box.h > 0)) return 0;
  const byWidth = (box.w * 0.8) / 1.12;
  const byHeight = kind === 'pet' ? box.h / 1.12 : (box.h - WELCOME_NOTIF_H) / (0.85 * 1.05);
  const size = Math.floor(Math.min(budget, byWidth, byHeight));
  return size >= MIN ? size : 0;
}

/**
 * Home's pet: as large as the screen allows, but small enough that the counter above it, the care
 * row and the "next care" card below it still end above the floating + button on a short phone
 * (iPhone SE, small Androids). Measured on Home: everything except the pet takes 331 pt; the +
 * button and its margin take 82 pt above the bottom inset; 14 pt gap; plus room for larger text.
 */
export const HOME_FIXED = 331 + 82 + 14 + 10;
export function homePetSize(width: number, height: number, insetTop = 0, insetBottom = 0): number {
  const fits = (height - insetTop - insetBottom - HOME_FIXED) / 1.05;
  return Math.round(Math.max(96, Math.min(width * 0.8, height * 0.42, 380, fits)));
}
