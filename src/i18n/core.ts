/**
 * Language state + `t()` with no native imports, so domain/data code (and the node tests) can use it.
 * English source strings are the keys; `t()` returns the French text when the app is in French and
 * the string is translated, otherwise the English. `{name}`-style placeholders are filled from `vars`.
 */
import { FR } from './fr';

export type Lang = 'en' | 'fr';
let current: Lang = 'en';

export function setLang(l: Lang) {
  current = l;
}
export function lang(): Lang {
  return current;
}

export function t(en: string, vars?: Record<string, string | number>): string {
  let s = current === 'fr' ? FR[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Pick the singular or plural key by count (French: 0 and 1 are singular; English: only 1). */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const singular = current === 'fr' ? Math.abs(n) < 2 : n === 1;
  return t(singular ? one : other, { n, ...vars });
}
