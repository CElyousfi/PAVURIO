/**
 * Language state + `t()` with no native imports, so domain/data code (and the node tests) can use it.
 * English source strings are the keys; `t()` returns the translated text when the app is in another
 * language and the string is translated, otherwise the English. `{name}`-style placeholders are filled from `vars`.
 */
import { FR as FR1 } from './fr';
import { FR2 } from './fr2';
import { ES } from './es';
import { PT } from './pt';

const FR: Record<string, string> = { ...FR1, ...FR2 };

export type Lang = 'en' | 'fr' | 'es' | 'pt';
export const LANGS: Lang[] = ['en', 'fr', 'es', 'pt'];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', fr: 'Français', es: 'Español', pt: 'Português' };
export const isLang = (s: unknown): s is Lang => typeof s === 'string' && (LANGS as string[]).includes(s);

const TABLES: Record<Lang, Record<string, string> | null> = { en: null, fr: FR, es: ES, pt: PT };

let current: Lang = 'en';

export function setLang(l: Lang) {
  current = l;
}
export function lang(): Lang {
  return current;
}

export function t(en: string, vars?: Record<string, string | number>): string {
  const table = TABLES[current];
  let s = table ? table[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Pick the singular or plural key by count (French and Portuguese: 0 and 1 are singular; English and Spanish: only 1). */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const singular = current === 'fr' || current === 'pt' ? Math.abs(n) < 2 : n === 1;
  return t(singular ? one : other, { n, ...vars });
}

/** Localised text for `{ en, fr }` content objects: French from the object, other languages through `t()` on the English text. */
export function pickL(l: { en: string; fr: string }): string {
  if (current === 'en') return l.en;
  if (current === 'fr') return l.fr;
  return t(l.en);
}
