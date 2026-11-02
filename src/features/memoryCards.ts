/**
 * Memory Card templates: the owner's photos placed into the illustrated frames (assets/memories).
 * Slot rects and text boxes come from the template art itself (tools/art/memories.py measures the
 * transparent windows and the white title/footer pills), in the export's pixel space.
 * Pure data — no React Native imports, so it is testable.
 */
import { TEMPLATE_LAYOUT } from './memoryTemplates.generated';

export type TemplateId = keyof typeof TEMPLATE_LAYOUT;
export type CardFormat = 'story' | 'post';
export const FORMAT_SIZE: Record<CardFormat, { w: number; h: number }> = { story: { w: 1080, h: 1920 }, post: { w: 1080, h: 1350 } };

export type TemplateDef = {
  id: TemplateId;
  /** gallery name (English = i18n key) */
  name: string;
  /** default title written in the top pill; {name} is the pet's name, {month} the month, {n} years */
  title: string;
  /** a short line explaining what the template is for */
  blurb: string;
  slots: number;
};

export const TEMPLATES: TemplateDef[] = [
  { id: 'daily', name: 'Little Moment', title: 'A little moment with {name}', blurb: 'One photo from today', slots: 1 },
  { id: 'home', name: 'Home Sweet Home', title: 'Home sweet home', blurb: 'First day home, cozy days', slots: 1 },
  { id: 'thennow', name: 'Then & Now', title: 'Then & now', blurb: 'How {name} has grown', slots: 2 },
  { id: 'birthday', name: 'Birthday Pawty', title: 'Happy birthday, {name}!', blurb: 'For the big day', slots: 1 },
  { id: 'gotcha', name: 'Gotcha Day', title: 'Happy Gotcha Day!', blurb: 'The day you found each other', slots: 2 },
  { id: 'adventures', name: 'Our Adventures', title: 'Our adventures', blurb: 'Walks and days out', slots: 3 },
  { id: 'littlethings', name: 'The Little Things', title: 'The little things', blurb: 'Four everyday favorites', slots: 4 },
  { id: 'month', name: 'Month in Moments', title: '{month} with {name}', blurb: 'Six photos from one month', slots: 6 },
  { id: 'bestfriend', name: 'Best Friend', title: 'My best friend', blurb: 'Just the two of you', slots: 1 },
  { id: 'year', name: 'A Year Together', title: 'A year with {name}', blurb: 'Twelve photos, one year', slots: 12 },
];

export const templateFor = (id: string): TemplateDef => TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
export const layoutFor = (id: TemplateId, f: CardFormat) => TEMPLATE_LAYOUT[id][f];

/** Templates suggested for an anniversary (birthday → Birthday Pawty first, adoption → Gotcha Day first). */
export function suggestedTemplates(kind: 'birthday' | 'adoption'): TemplateId[] {
  return kind === 'birthday' ? ['birthday', 'thennow', 'year'] : ['gotcha', 'thennow', 'year'];
}

/** Every slot must hold a photo before export: a card never leaves the app with an empty window. */
export function missingSlots(id: TemplateId, filled: (unknown | null | undefined)[]): number {
  const n = templateFor(id).slots;
  let missing = 0;
  for (let i = 0; i < n; i++) if (!filled[i]) missing++;
  return missing;
}

/** Fills slots in order from the chosen photos (extra photos are ignored, empty slots stay null). */
export function fillSlots<T>(id: TemplateId, photos: T[]): (T | null)[] {
  const n = templateFor(id).slots;
  return Array.from({ length: n }, (_, i) => photos[i] ?? null);
}

/** Moves a photo between slots (reorder): swaps the two positions. */
export function swapSlots<T>(slots: T[], a: number, b: number): T[] {
  if (a === b || a < 0 || b < 0 || a >= slots.length || b >= slots.length) return slots;
  const next = slots.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

type Pickable = { id: string; date: string; photoUri: string | null; favorite: boolean; featured: boolean; kind: string; walkId: string | null };

/**
 * Suggests which of the owner's own photos go in a new card, from dates and the owner's own flags
 * (featured, favorite, adventure) — never from image content. The owner can change every slot.
 */
export function prefillPhotos<T extends Pickable>(id: TemplateId, moments: T[], today: string): T[] {
  const withPhoto = moments.filter((m) => m.photoUri).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const n = templateFor(id).slots;
  const rank = (m: T) => (m.featured ? 2 : 0) + (m.favorite ? 1 : 0);
  const best = (list: T[]) => list.slice().sort((a, b) => rank(b) - rank(a) || (a.date < b.date ? 1 : -1));
  const out: T[] = [];
  const add = (list: T[]) => {
    for (const m of list) {
      if (out.length >= n) return;
      if (!out.includes(m)) out.push(m);
    }
  };
  if (!withPhoto.length) return [];
  switch (id) {
    case 'thennow':
    case 'gotcha':
      add([withPhoto[withPhoto.length - 1], withPhoto[0]]);
      break;
    case 'adventures':
      add(withPhoto.filter((m) => m.kind === 'adventure' || m.walkId));
      break;
    case 'month': {
      const month = (withPhoto.find((m) => m.date.slice(0, 7) === today.slice(0, 7)) ?? withPhoto[0]).date.slice(0, 7);
      add(best(withPhoto.filter((m) => m.date.startsWith(month))));
      break;
    }
    case 'year': {
      const seen = new Set<string>();
      for (const m of best(withPhoto)) {
        const k = m.date.slice(0, 7);
        if (seen.has(k)) continue;
        seen.add(k);
        add([m]);
      }
      // oldest month first, like a calendar
      out.sort((a, b) => (a.date < b.date ? -1 : 1));
      break;
    }
    default:
      add(best(withPhoto.filter((m) => m.date === today)));
      add(best(withPhoto));
  }
  if (id !== 'year') add(best(withPhoto));
  return out.slice(0, n);
}

/** Default title for a template, filled with the pet's name / month. */
export function defaultTitle(tpl: TemplateDef, tr: (s: string, v?: Record<string, string | number>) => string, vars: { name: string; month: string }): string {
  return tr(tpl.title, vars);
}
