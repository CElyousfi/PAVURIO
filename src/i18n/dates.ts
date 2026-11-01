/** Language-aware month / weekday names and clock formatting (no native imports). */
import { Lang, lang } from './core';

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
/** Sunday-first, like Date#getDay(). */
const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  pt: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
};
const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
};
const WEEKDAYS_INITIAL: Record<Lang, string[]> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  pt: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
};

export const monthNames = () => MONTHS[lang()];
export const monthNamesShort = () => MONTHS_SHORT[lang()];
export const weekdayNames = () => WEEKDAYS[lang()];
export const weekdayNamesShort = () => WEEKDAYS_SHORT[lang()];
export const weekdayInitials = () => WEEKDAYS_INITIAL[lang()];

/** True when the clock should be 24-hour (everything but English). */
export const uses24h = () => lang() !== 'en';

/** "8:05 AM" in English, "8h05" in French, "8:05" in Spanish and Portuguese. */
export function formatHM(h: number, m: number): string {
  const mm = String(m).padStart(2, '0');
  const l = lang();
  if (l === 'fr') return `${h}h${mm}`;
  if (l !== 'en') return `${h}:${mm}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${mm} ${ampm}`;
}

/** Capitalize the first letter (French month/weekday names are lowercase mid-sentence). */
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const REL: Record<Lang, { now: string; ago: (n: number) => string; today: (hm: string) => string; on: (d: string) => string }> = {
  en: { now: 'just now', ago: (n) => `${n} min ago`, today: (hm) => `today at ${hm}`, on: (d) => `on ${d}` },
  fr: { now: "à l'instant", ago: (n) => `il y a ${n} min`, today: (hm) => `aujourd'hui à ${hm}`, on: (d) => `le ${d}` },
  es: { now: 'ahora mismo', ago: (n) => `hace ${n} min`, today: (hm) => `hoy a las ${hm}`, on: (d) => `el ${d}` },
  pt: { now: 'agora mesmo', ago: (n) => `há ${n} min`, today: (hm) => `hoje às ${hm}`, on: (d) => `em ${d}` },
};

/** "just now", "5 min ago", "today at 8:05 AM", "on 3 Nov" — for “backed up …” labels. */
export function formatRelative(ms: number, now = Date.now()): string {
  const r = REL[lang()];
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return r.now;
  if (diff < 3_600_000) return r.ago(Math.round(diff / 60_000));
  const d = new Date(ms);
  const today = new Date(now);
  const hm = formatHM(d.getHours(), d.getMinutes());
  if (d.toDateString() === today.toDateString()) return r.today(hm);
  return r.on(`${d.getDate()} ${monthNamesShort()[d.getMonth()]}`);
}
