/**
 * When to offer Pro — only right after something good happened with the pet, never as an interruption,
 * never twice for the same moment, and less often for people who've said "not now" before.
 * Pure: the caller passes what it knows, gets back at most one moment to show.
 */

export type ProMomentKind = 'streak3' | 'streak7' | 'streak14' | 'week' | 'cares25' | 'cares100';

export type ProMomentState = {
  /** moments already offered (each is offered once) */
  shown: ProMomentKind[];
  /** when Pro was last offered by any route (moment, onboarding paywall, a lock) */
  lastOfferAt: number;
  /** "not now" answers in a row since the last time they opened the paywall from a moment */
  declinesInARow: number;
};

export type ProMomentInput = {
  pro: boolean;
  /** when the pet was added (no offers on the first day) */
  petCreatedAt: number;
  streak: number;
  totalCares: number;
  /** last 7 days' average share of the plan coloured in, and how many of those days count */
  weekAvg: number;
  weekDays: number;
};

export const EMPTY_PRO_MOMENTS: ProMomentState = { shown: [], lastOfferAt: 0, declinesInARow: 0 };

const DAY = 86_400_000;
/** after this many offers, only the biggest moments still show */
const MAX_SMALL_OFFERS = 3;

/** candidate moments, best first */
function candidates(i: ProMomentInput): ProMomentKind[] {
  const out: ProMomentKind[] = [];
  if (i.streak >= 14) out.push('streak14');
  if (i.streak >= 7) out.push('streak7');
  if (i.weekDays >= 5 && i.weekAvg >= 0.85) out.push('week');
  if (i.totalCares >= 100) out.push('cares100');
  if (i.totalCares >= 25) out.push('cares25');
  if (i.streak >= 3) out.push('streak3');
  return out;
}

const BIG: ProMomentKind[] = ['streak14', 'streak7', 'week', 'cares100'];

export function pickProMoment(state: ProMomentState, input: ProMomentInput, now = Date.now()): ProMomentKind | null {
  if (input.pro) return null;
  if (now - input.petCreatedAt < DAY) return null;
  // spacing grows with every "not now": 2 days, 4, 8… (capped at 3 weeks)
  const gap = Math.min(21, 2 * Math.pow(2, Math.max(0, state.declinesInARow))) * DAY;
  if (now - state.lastOfferAt < gap) return null;
  const fresh = candidates(input).filter((k) => !state.shown.includes(k));
  const allowed = state.shown.length >= MAX_SMALL_OFFERS ? fresh.filter((k) => BIG.includes(k)) : fresh;
  return allowed[0] ?? null;
}

export function markShown(state: ProMomentState, kind: ProMomentKind, now = Date.now()): ProMomentState {
  // offering a bigger moment also retires the smaller ones it includes
  const implied: Record<ProMomentKind, ProMomentKind[]> = {
    streak14: ['streak7', 'streak3'],
    streak7: ['streak3'],
    week: [],
    cares100: ['cares25'],
    cares25: [],
    streak3: [],
  };
  const shown = Array.from(new Set([...state.shown, kind, ...implied[kind]]));
  return { ...state, shown, lastOfferAt: now };
}

export function recordAnswer(state: ProMomentState, opened: boolean): ProMomentState {
  return { ...state, declinesInARow: opened ? 0 : state.declinesInARow + 1 };
}

export function parseProMoments(json: string | null): ProMomentState {
  try {
    const v = json ? JSON.parse(json) : null;
    if (v && Array.isArray(v.shown) && typeof v.lastOfferAt === 'number') return { shown: v.shown, lastOfferAt: v.lastOfferAt, declinesInARow: Number(v.declinesInARow) || 0 };
  } catch {
    // fall through
  }
  return EMPTY_PRO_MOMENTS;
}
