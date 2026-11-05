/**
 * Tiny i18n: English source strings are the keys; `t()` returns the French text when the app is in
 * French and the string is translated, otherwise the English. `{name}`-style placeholders are filled
 * from `vars`. The language lives in ./core (module state) and AppState remounts the UI when it changes.
 */
import { getLocales } from 'expo-localization';
import { type Lang, matchLanguage } from './core';

export { type Lang, LANGS, LANG_NAMES, RTL_LANGS, isLang, isRtl, matchLanguage, setLang, lang, t, tn, pickL } from './core';

export function deviceLanguage(): Lang {
  try {
    // the first of the phone's preferred languages that Pavurio speaks
    for (const l of getLocales()) {
      const m = matchLanguage(l.languageCode, l.languageScriptCode, l.regionCode);
      if (m !== 'en' || l.languageCode === 'en') return m;
    }
    return 'en';
  } catch {
    return 'en';
  }
}
