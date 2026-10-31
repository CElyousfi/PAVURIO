/**
 * Challenges: a goal the owner opts into ("walk every day for 7 days"). Progress is counted only
 * from what was logged after the challenge started. Missing days doesn't fail a challenge until the
 * window (target + grace days) runs out; then it can simply be restarted.
 */
import { CareType, Species } from './care';
import { Plan } from './progress';
import { DayLogs, dayComplete } from './streak';
import { addDays } from './time';
import { lang } from '../i18n/core';

type L = { en: string; fr: string };
export type ChallengeDef = {
  key: string;
  species: Species[];
  /** what counts for a day: a care type logged, or the whole plan coloured in */
  rule: { kind: 'care'; type: CareType } | { kind: 'plan' };
  days: number;
  /** extra days allowed in the window */
  grace: number;
  pro: boolean;
  color: string;
  tint: string;
  title: L;
  blurb: L;
};

export const CHALLENGES: ChallengeDef[] = [
  { key: 'walk7', species: ['dog'], rule: { kind: 'care', type: 'walk' }, days: 7, grace: 0, pro: false, color: '#3E8E17', tint: '#E6F7DA', title: { en: '7-Day Walk Streak', fr: '7 jours de balade' }, blurb: { en: 'At least one walk every day for a week.', fr: 'Au moins une balade chaque jour pendant une semaine.' } },
  { key: 'water7', species: ['dog', 'cat'], rule: { kind: 'care', type: 'water' }, days: 7, grace: 0, pro: false, color: '#0C8FD1', tint: '#DDF3FE', title: { en: 'Fresh Water Week', fr: 'Semaine eau fraîche' }, blurb: { en: 'Refresh the bowl every day for 7 days.', fr: 'Changez la gamelle chaque jour pendant 7 jours.' } },
  { key: 'litter7', species: ['cat'], rule: { kind: 'care', type: 'litter' }, days: 7, grace: 0, pro: false, color: '#8A5A34', tint: '#F4E9DF', title: { en: 'Clean Box Week', fr: 'Semaine litière nette' }, blurb: { en: 'Scoop the litter every day for a week.', fr: 'Nettoyez la litière chaque jour pendant une semaine.' } },
  { key: 'perfect5', species: ['dog', 'cat'], rule: { kind: 'plan' }, days: 5, grace: 0, pro: true, color: '#0E9AA5', tint: '#DDF6F7', title: { en: 'Perfect Five', fr: 'Cinq jours parfaits' }, blurb: { en: 'Colour in the whole daily plan 5 days in a row.', fr: 'Coloriez tout le programme 5 jours de suite.' } },
  { key: 'brush10', species: ['dog', 'cat'], rule: { kind: 'care', type: 'grooming' }, days: 10, grace: 4, pro: true, color: '#7C5CE6', tint: '#EEE8FE', title: { en: 'Brushing Habit', fr: 'L’habitude du brossage' }, blurb: { en: 'Groom on 10 days within two weeks.', fr: 'Toilettez 10 jours sur deux semaines.' } },
  { key: 'play14', species: ['dog', 'cat'], rule: { kind: 'care', type: 'play' }, days: 14, grace: 0, pro: true, color: '#E2477C', tint: '#FFE6EF', title: { en: 'Playtime Fortnight', fr: 'Quinzaine du jeu' }, blurb: { en: 'Play together every day for two weeks.', fr: 'Jouez ensemble chaque jour pendant deux semaines.' } },
  { key: 'walk30', species: ['dog'], rule: { kind: 'care', type: 'walk' }, days: 30, grace: 5, pro: true, color: '#3E8E17', tint: '#E6F7DA', title: { en: 'Month of Walks', fr: 'Un mois de balades' }, blurb: { en: 'Walk on 30 days within five weeks.', fr: 'Baladez-vous 30 jours sur cinq semaines.' } },
];

export const pick = (l: L) => (lang() === 'fr' ? l.fr : l.en);
export const challengeDef = (key: string) => CHALLENGES.find((c) => c.key === key) ?? null;

export type ChallengeRun = { id: string; key: string; startDay: string; completedAt: number | null; abandonedAt: number | null };
export type ChallengeProgress = {
  done: number;
  target: number;
  /** per day of the window: true = counted, false = missed (past), null = future */
  days: (boolean | null)[];
  state: 'active' | 'completed' | 'expired';
  lastDay: string;
};

function dayCounts(def: ChallengeDef, plan: Plan, byDay: DayLogs, day: string) {
  const logs = byDay.get(day);
  if (def.rule.kind === 'plan') return dayComplete(plan, logs);
  const type = def.rule.type;
  return !!logs?.some((e) => e.type === type);
}

export function challengeProgress(def: ChallengeDef, run: ChallengeRun, plan: Plan, byDay: DayLogs, today: string): ChallengeProgress {
  const span = def.days + def.grace;
  const lastDay = addDays(run.startDay, span - 1);
  const days: (boolean | null)[] = [];
  let done = 0;
  let consecutiveBroken = false;
  for (let i = 0; i < span; i++) {
    const k = addDays(run.startDay, i);
    if (k > today) {
      days.push(null);
      continue;
    }
    const ok = dayCounts(def, plan, byDay, k);
    // a "streak" challenge (no grace) is broken by a missed past day (today may still be logged)
    if (!ok && def.grace === 0 && k < today) consecutiveBroken = true;
    if (ok) done++;
    days.push(k === today && !ok ? null : ok);
  }
  done = Math.min(done, def.days);
  const state: ChallengeProgress['state'] =
    done >= def.days || run.completedAt ? 'completed' : consecutiveBroken || today > lastDay ? 'expired' : 'active';
  return { done, target: def.days, days, state, lastDay };
}

/** Whether a challenge applies to this species (litter is for cats, walks for dogs). */
export const careOk = (c: ChallengeDef, species: Species) => c.species.includes(species);
