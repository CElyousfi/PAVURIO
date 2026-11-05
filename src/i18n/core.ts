/**
 * Language state + `t()` with no native imports, so domain/data code (and the node tests) can use it.
 * English source strings are the keys; `t()` returns the translated text when the app is in another
 * language and the string is translated, otherwise the English. `{name}`-style placeholders are filled from `vars`.
 *
 * French, Spanish and Portuguese live in hand-written TS tables; every other language is a JSON file in
 * ./locales (English text → translation), built by tools/i18n/build.py and loaded on first use.
 */
import { FR as FR1 } from './fr';
import { FR2 } from './fr2';
import { ES as ES1 } from './es';
import { PT as PT1 } from './pt';
import { ES3, FR3, PT3 } from './adventures';
import { ES4, FR4, PT4 } from './memories';
import { ES5, FR5, PT5 } from './play';
import { ES6, FR6, PT6 } from './pantry';
import { LOCALES } from './locales';

const FR: Record<string, string> = { ...FR5, ...FR4, ...FR1, ...FR2, ...FR3, ...FR6 };
const ES: Record<string, string> = { ...ES5, ...ES4, ...ES1, ...ES3, ...ES6 };
const PT: Record<string, string> = { ...PT5, ...PT4, ...PT1, ...PT3, ...PT6 };

/** Every language the app speaks, with its own name (shown in the language picker). */
export const LANG_NAMES = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  uk: 'Українська',
  tr: 'Türkçe',
  ar: 'العربية',
  he: 'עברית',
  ja: '日本語',
  ko: '한국어',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  sv: 'Svenska',
  da: 'Dansk',
  nb: 'Norsk',
  fi: 'Suomi',
  cs: 'Čeština',
  ro: 'Română',
  el: 'Ελληνικά',
  hu: 'Magyar',
} as const;
export type Lang = keyof typeof LANG_NAMES;
/** Only languages whose translation file is present are offered (en, fr, es, pt always are). */
export const LANGS: Lang[] = (Object.keys(LANG_NAMES) as Lang[]).filter((l) => l === 'en' || l === 'fr' || l === 'es' || l === 'pt' || l in LOCALES);
export const isLang = (s: unknown): s is Lang => typeof s === 'string' && (LANGS as string[]).includes(s);
/** Languages written right to left. */
export const RTL_LANGS: Lang[] = ['ar', 'he'];
export const isRtl = (l: Lang) => RTL_LANGS.includes(l);

const cache: Partial<Record<Lang, Record<string, string> | null>> = { en: null, fr: FR, es: ES, pt: PT };
function table(l: Lang): Record<string, string> | null {
  if (!(l in cache)) cache[l] = LOCALES[l]?.() ?? null;
  return cache[l] ?? null;
}

let current: Lang = 'en';

export function setLang(l: Lang) {
  current = l;
}
export function lang(): Lang {
  return current;
}

export function t(en: string, vars?: Record<string, string | number>): string {
  const tb = table(current);
  let s = tb ? tb[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const plurals = new Map<string, Intl.PluralRules | null>();
function category(n: number): Intl.LDMLPluralRule {
  if (!plurals.has(current)) {
    try {
      plurals.set(current, new Intl.PluralRules(current));
    } catch {
      plurals.set(current, null);
    }
  }
  const pr = plurals.get(current);
  if (pr) return pr.select(n);
  return current === 'fr' || current === 'pt' ? (Math.abs(n) < 2 ? 'one' : 'other') : n === 1 ? 'one' : 'other';
}

/**
 * Pick the form for a count, by the language's CLDR plural rules. Languages with more forms than
 * one/other (Russian "few"/"many", Arabic "two"…) store them as `<other>#<category>`.
 */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const cat = category(n);
  if (cat === 'one') return t(one, { n, ...vars });
  if (cat !== 'other') {
    const tb = table(current);
    const variant = tb?.[`${other}#${cat}`];
    if (variant) {
      let s = variant;
      for (const [k, v] of Object.entries({ n, ...vars })) s = s.split(`{${k}}`).join(String(v));
      return s;
    }
  }
  return t(other, { n, ...vars });
}

/** Localised text for `{ en, fr }` content objects: French from the object, other languages through `t()` on the English text. */
export function pickL(l: { en: string; fr: string }): string {
  if (current === 'en') return l.en;
  if (current === 'fr') return l.fr;
  return t(l.en);
}

/** The phone's language → the closest one Pavurio speaks (falls back to English). */
export function matchLanguage(code: string | null | undefined, script?: string | null, region?: string | null): Lang {
  const c = (code ?? '').toLowerCase();
  if (c === 'zh') return script === 'Hant' || ['TW', 'HK', 'MO'].includes(region ?? '') ? pickOr('zh-Hant') : pickOr('zh-Hans');
  if (c === 'no' || c === 'nn' || c === 'nb') return pickOr('nb');
  if (c === 'iw') return pickOr('he');
  if (c === 'in') return pickOr('id');
  return pickOr(c);
}
const pickOr = (c: string): Lang => (isLang(c) ? c : 'en');
