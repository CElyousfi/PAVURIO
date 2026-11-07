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

