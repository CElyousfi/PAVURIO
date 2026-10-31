/**
 * Tiny i18n: English source strings are the keys; `t()` returns the French text when the app is in
 * French and the string is translated, otherwise the English. `{name}`-style placeholders are filled
 * from `vars`. The language lives here (module state) and AppState remounts the UI when it changes.
 */
import { getLocales } from 'expo-localization';
import { FR } from './fr';

export type Lang = 'en' | 'fr';
let current: Lang = 'en';

export function deviceLanguage(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}
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
