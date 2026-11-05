/**
 * Language-aware month / weekday names, date order and clock formatting (no native imports).
 * English, French, Spanish and Portuguese keep their hand-tuned tables; every other language uses
 * CLDR data generated into ./calendar.ts.
 */
import { lang } from './core';
import { CALENDAR, Calendar } from './calendar';

type Base = 'en' | 'fr' | 'es' | 'pt';
const isBase = (l: string): l is Base => l === 'en' || l === 'fr' || l === 'es' || l === 'pt';
const cal = (): Calendar => CALENDAR[lang()] ?? CALENDAR.en;

const MONTHS: Record<Base, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
const MONTHS_SHORT: Record<Base, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
/** Sunday-first, like Date#getDay(). */
const WEEKDAYS: Record<Base, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  pt: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
};
const WEEKDAYS_SHORT: Record<Base, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
};
const WEEKDAYS_INITIAL: Record<Base, string[]> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  pt: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
};

const L = () => lang() as string;
export const monthNames = () => (isBase(L()) ? MONTHS[L() as Base] : cal().months);
export const monthNamesShort = () => (isBase(L()) ? MONTHS_SHORT[L() as Base] : cal().monthsShort);
export const weekdayNames = () => (isBase(L()) ? WEEKDAYS[L() as Base] : cal().weekdays);
export const weekdayNamesShort = () => (isBase(L()) ? WEEKDAYS_SHORT[L() as Base] : cal().weekdaysShort);
export const weekdayInitials = () => (isBase(L()) ? WEEKDAYS_INITIAL[L() as Base] : cal().initials);

/** True when the clock should be 24-hour (the language's usual clock; English is 12-hour). */
export const uses24h = () => (isBase(L()) ? L() !== 'en' : !cal().h12);

/** "8:05 AM" in English, "8h05" in French, "8:05" in Spanish and Portuguese, "오후 8:05" in Korean… */
export function formatHM(h: number, m: number): string {
  const mm = String(m).padStart(2, '0');
  const l = L();
  if (l === 'fr') return `${h}h${mm}`;
  if (l === 'es' || l === 'pt') return `${h}:${mm}`;
  if (l === 'en') return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  const c = cal();
  const h1 = c.h12 ? h % 12 || 12 : h;
  const hh = c.pad ? String(h1).padStart(2, '0') : String(h1);
  return c.time.replace('{h}', hh).replace('{mm}', mm).replace('{p}', h >= 12 ? c.pm : c.am);
}

/** "Nov 5" / "5 nov." / "5. Nov." / "11月5日": a day and a short month in the language's order. */
export function formatDayMonth(d: Date): string {
  const l = L();
  if (isBase(l)) {
    const mon = MONTHS_SHORT[l][d.getMonth()].replace('.', '');
    return l === 'en' ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
  }
  const c = cal();
  return c.dm.replace('{d}', String(d.getDate())).replace('{m}', c.monthsShortInDate[d.getMonth()]);
}

/** "Oct 31, 2026" / "31 oct. 2026" / "2026年10月31日". */
export function formatDayMonthYear(d: Date): string {
  const l = L();
  if (isBase(l)) {
    const mon = MONTHS_SHORT[l][d.getMonth()];
    return l === 'en' ? `${mon} ${d.getDate()}, ${d.getFullYear()}` : `${d.getDate()} ${mon} ${d.getFullYear()}`;
  }
  const c = cal();
  return c.dmy.replace('{d}', String(d.getDate())).replace('{m}', c.monthsShortInDate[d.getMonth()]).replace('{y}', String(d.getFullYear()));
}

/** "10/24" (English), "24/10" (most), "24.10" (German, Russian)… */
export function formatDayMonthNumeric(month: number, day: number): string {
  const l = L();
  if (isBase(l)) return l === 'en' ? `${month}/${day}` : `${day}/${month}`;
  return cal().dmNum.replace('{d}', String(day)).replace('{m}', String(month));
}

/** Capitalize the first letter (French month/weekday names are lowercase mid-sentence). */
export const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

const REL: Record<Base, { now: string; ago: (n: number) => string; today: (hm: string) => string; on: (d: string) => string }> = {
  en: { now: 'just now', ago: (n) => `${n} min ago`, today: (hm) => `today at ${hm}`, on: (d) => `on ${d}` },
  fr: { now: "à l'instant", ago: (n) => `il y a ${n} min`, today: (hm) => `aujourd'hui à ${hm}`, on: (d) => `le ${d}` },
  es: { now: 'ahora mismo', ago: (n) => `hace ${n} min`, today: (hm) => `hoy a las ${hm}`, on: (d) => `el ${d}` },
  pt: { now: 'agora mesmo', ago: (n) => `há ${n} min`, today: (hm) => `hoje às ${hm}`, on: (d) => `em ${d}` },
};

/** "just now", "5 min ago", "today at 8:05 AM", "on 3 Nov" — for “backed up …” labels. */
export function formatRelative(ms: number, now = Date.now()): string {
  const l = L();
  const c = cal().rel;
  const r = isBase(l) ? REL[l] : { now: c.now, ago: (n: number) => c.ago.replace('{n}', String(n)), today: (hm: string) => `${c.today} ${hm}`, on: (d: string) => d };
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return r.now;
  if (diff < 3_600_000) return r.ago(Math.round(diff / 60_000));
  const d = new Date(ms);
  const today = new Date(now);
  const hm = formatHM(d.getHours(), d.getMinutes());
  if (d.toDateString() === today.toDateString()) return r.today(hm);
  return r.on(isBase(l) ? `${d.getDate()} ${monthNamesShort()[d.getMonth()]}` : formatDayMonth(d));
}
