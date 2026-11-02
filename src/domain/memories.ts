/**
 * Pavurio Memories — pure rules (no I/O). Everything here works from what the owner entered or
 * what the camera recorded (EXIF capture date). Nothing is generated, guessed or inferred.
 */
import { addDays, dayKeyOf, parseDayKey } from './time';

export const MILESTONES = ['firstday', 'birthday', 'adoption', 'firstadventure', 'firsttrick', 'holiday', 'special', 'custom'] as const;
export type MilestoneKind = (typeof MILESTONES)[number];
export const isMilestone = (v: unknown): v is MilestoneKind => typeof v === 'string' && (MILESTONES as readonly string[]).includes(v);

/** English labels (they are also the i18n keys). */
export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  firstday: 'First Day Home',
  birthday: 'Birthday',
  adoption: 'Adoption Anniversary',
  firstadventure: 'First Adventure',
  firsttrick: 'First Trick',
  holiday: 'Holiday Memories',
  special: 'Special Day',
  custom: 'Custom milestone',
};
export const MILESTONE_EMOJI: Record<MilestoneKind, string> = {
  firstday: '🏡',
  birthday: '🎂',
  adoption: '💛',
  firstadventure: '🐾',
  firsttrick: '🎓',
  holiday: '🎄',
  special: '⭐',
  custom: '🏅',
};

export const TITLE_MAX = 60;
export const CAPTION_MAX = 500;

/**
 * EXIF date strings look like "2024:05:03 14:22:10" (local camera time, no zone). Returns the local
 * epoch ms, or null when absent or unreadable. Accepts the common keys pickers hand back.
 */
export function exifCapturedAt(exif: Record<string, unknown> | null | undefined): number | null {
  if (!exif) return null;
  const raw = (exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime ?? (exif as { '{Exif}'?: Record<string, unknown> })['{Exif}']?.DateTimeOriginal) as unknown;
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0));
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const at = new Date(y, mo - 1, d, h, mi, s || 0);
  if (at.getMonth() !== mo - 1 || at.getDate() !== d) return null; // rejects 2023:02:30
  return at.getTime();
}

/** The day a photo belongs to: its capture day when known and not in the future, otherwise today. */
export function momentDay(capturedAt: number | null, now = Date.now()): string {
  if (capturedAt != null && capturedAt <= now + 60_000) return dayKeyOf(new Date(capturedAt));
  return dayKeyOf(new Date(now));
}

/**
 * On This Day: earlier years, same month and day. Feb 29 memories show on Feb 28 when the current
 * year has no Feb 29. Returns how many years ago, or 0 when the date doesn't match.
 */
export function onThisDayYears(memoryDay: string, today: string): number {
  const [my, mm, md] = memoryDay.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (my >= ty) return 0;
  if (mm === tm && md === td) return ty - my;
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (mm === 2 && md === 29 && !leap(ty) && tm === 2 && td === 28) return ty - my;
  return 0;
}

export type Anniversary = { kind: 'birthday' | 'adoption'; day: string; years: number; daysAway: number };

/** The next birthday/adoption anniversary on or after today (years ≥ 1), from the real dates. */
export function nextAnniversary(kind: 'birthday' | 'adoption', date: string | null | undefined, today: string): Anniversary | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = parseDayKey(date);
  const td = parseDayKey(today);
  const on = (y: number) => {
    // Feb 29 celebrated on Feb 28 in non-leap years
    const c = new Date(y, d.getMonth(), d.getDate());
    return c.getMonth() !== d.getMonth() ? new Date(y, d.getMonth() + 1, 0) : c;
  };
  let y = td.getFullYear();
  let next = on(y);
  if (dayKeyOf(next) < today) next = on(++y);
  const years = y - d.getFullYear();
  if (years <= 0) return null;
  const daysAway = Math.round((next.getTime() - td.getTime()) / 86_400_000);
  return { kind, day: dayKeyOf(next), years, daysAway };
}

/** Anniversaries close enough to suggest a Memory Card (from 7 days before through 2 days after). */
export function anniversaryPrompts(pet: { birthDate: string | null; adoptionDate: string | null }, today: string): Anniversary[] {
  const out: Anniversary[] = [];
  for (const [kind, date] of [
    ['birthday', pet.birthDate],
    ['adoption', pet.adoptionDate],
  ] as const) {
    // just passed (up to 2 days ago) still counts
    const recent = nextAnniversary(kind, date, addDays(today, -2));
    if (recent && recent.day <= addDays(today, 7)) {
      out.push({ ...recent, daysAway: Math.round((parseDayKey(recent.day).getTime() - parseDayKey(today).getTime()) / 86_400_000) });
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}
/** Dismissal is remembered per pet, kind and year — next year asks again, this year never twice. */
export const anniversaryDismissKey = (petId: string, a: Anniversary) => `memories.anniv.${petId}.${a.kind}.${a.day.slice(0, 4)}`;

// ---------------------------------------------------------------- photo fitting (cards)

export type Rect = { x: number; y: number; w: number; h: number };
/** Owner framing inside a slot: zoom ≥ 1 and an offset in -1…1 of the free overflow on each axis. */
export type Framing = { zoom: number; ox: number; oy: number };
export const DEFAULT_FRAMING: Framing = { zoom: 1, ox: 0, oy: 0 };
export const MAX_ZOOM = 4;

/**
 * Cover-fits an image (iw×ih) into a slot, then applies zoom and pan. The image always covers the
 * whole slot (never shows the template's transparent hole). Returns the drawn rect relative to the slot.
 */
export function coverRect(iw: number, ih: number, slot: { w: number; h: number }, f: Framing = DEFAULT_FRAMING): Rect {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, f.zoom || 1));
  const s = Math.max(slot.w / Math.max(1, iw), slot.h / Math.max(1, ih)) * zoom;
  const w = iw * s;
  const h = ih * s;
  const fx = (w - slot.w) / 2;
  const fy = (h - slot.h) / 2;
  const ox = Math.min(1, Math.max(-1, f.ox || 0));
  const oy = Math.min(1, Math.max(-1, f.oy || 0));
  return { x: -fx + ox * fx, y: -fy + oy * fy, w, h };
}

/** Converts a finger drag (slot px) into a new normalized offset. */
export function panBy(iw: number, ih: number, slot: { w: number; h: number }, f: Framing, dx: number, dy: number): Framing {
  const r = coverRect(iw, ih, slot, { ...f, ox: 0, oy: 0 });
  const fx = (r.w - slot.w) / 2;
  const fy = (r.h - slot.h) / 2;
  const ox = fx > 0.5 ? Math.min(1, Math.max(-1, f.ox + dx / fx)) : 0;
  const oy = fy > 0.5 ? Math.min(1, Math.max(-1, f.oy + dy / fy)) : 0;
  return { ...f, ox, oy };
}

/** A moment's display title: owner title, else milestone label, else nothing (the date is shown). */
export function momentLabel(m: { title: string; milestone: MilestoneKind | null }, tr: (s: string) => string): string {
  if (m.title.trim()) return m.title.trim();
  if (m.milestone && m.milestone !== 'custom') return tr(MILESTONE_LABEL[m.milestone]);
  return '';
}

/** Groups day-sorted items (newest first) into month sections keyed YYYY-MM. */
export function groupByMonth<T extends { date: string }>(items: T[]): { month: string; items: T[] }[] {
  const out: { month: string; items: T[] }[] = [];
  for (const it of items) {
    const k = it.date.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === k) last.items.push(it);
    else out.push({ month: k, items: [it] });
  }
  return out;
}
