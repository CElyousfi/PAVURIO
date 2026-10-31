/** Language-aware month / weekday names and clock formatting (no native imports). */
import { lang } from './core';

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Sunday-first, like Date#getDay(). */
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_WEEKDAYS_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FR_WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const FR_WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const FR_WEEKDAYS_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const fr = () => lang() === 'fr';

export const monthNames = () => (fr() ? FR_MONTHS : EN_MONTHS);
export const monthNamesShort = () => (fr() ? FR_MONTHS_SHORT : EN_MONTHS_SHORT);
export const weekdayNames = () => (fr() ? FR_WEEKDAYS : EN_WEEKDAYS);
export const weekdayNamesShort = () => (fr() ? FR_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT);
export const weekdayInitials = () => (fr() ? FR_WEEKDAYS_INITIAL : EN_WEEKDAYS_INITIAL);

/** True when the clock should be 24-hour (French). */
export const uses24h = () => fr();

/** "8:05 AM" in English, "8h05" in French. */
export function formatHM(h: number, m: number): string {
  const mm = String(m).padStart(2, '0');
  if (fr()) return `${h}h${mm}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${mm} ${ampm}`;
}

/** Capitalize the first letter (French month/weekday names are lowercase mid-sentence). */
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
