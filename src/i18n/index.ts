/**
 * Tiny i18n: English source strings are the keys; `t()` returns the French text when the app is in
 * French and the string is translated, otherwise the English. `{name}`-style placeholders are filled
 * from `vars`. The language lives in ./core (module state) and AppState remounts the UI when it changes.
 */
import { getLocales } from 'expo-localization';

export { type Lang, setLang, lang, t, tn } from './core';

export function deviceLanguage(): 'en' | 'fr' {
  try {
    return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}
