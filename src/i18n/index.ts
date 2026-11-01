/**
 * Tiny i18n: English source strings are the keys; `t()` returns the French text when the app is in
 * French and the string is translated, otherwise the English. `{name}`-style placeholders are filled
 * from `vars`. The language lives in ./core (module state) and AppState remounts the UI when it changes.
 */
import { getLocales } from 'expo-localization';
import { type Lang, isLang } from './core';

export { type Lang, LANGS, LANG_NAMES, isLang, setLang, lang, t, tn, pickL } from './core';

export function deviceLanguage(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    return isLang(code) ? code : 'en';
  } catch {
    return 'en';
  }
}
