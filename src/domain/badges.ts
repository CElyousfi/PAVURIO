/** Achievements, derived from the owner's own records (nothing stored except which ones were seen). */
import { lang } from '../i18n/core';
import { CareType } from './care';

export type BadgeStats = {
  logs: number;
  bestStreak: number;
  routines: number;
  records: number;
  moments: number;
  weights: number;
  challengesDone: number;
  pets: number;
  walksTimed: number;
};

type L = { en: string; fr: string };
export type BadgeDef = { key: string; icon: CareType | 'star' | 'heart' | 'trophy' | 'calendar' | 'file' | 'camera' | 'scale' | 'paw'; color: string; title: L; how: L; test: (s: BadgeStats) => boolean; goal: (s: BadgeStats) => [number, number] };

const B = (key: string, icon: BadgeDef['icon'], color: string, title: L, how: L, metric: (s: BadgeStats) => number, need: number): BadgeDef => ({
  key,
  icon,
  color,
  title,
  how,
  test: (s) => metric(s) >= need,
  goal: (s) => [Math.min(metric(s), need), need],
});

export const BADGES: BadgeDef[] = [
  B('first_log', 'meal', '#F59E0B', { en: 'First care', fr: 'Premier soin' }, { en: 'Log your first care.', fr: 'Notez votre premier soin.' }, (s) => s.logs, 1),
  B('streak3', 'star', '#14B8C4', { en: 'On a roll', fr: 'Bien lancé' }, { en: 'Colour in the plan 3 days in a row.', fr: 'Coloriez le programme 3 jours de suite.' }, (s) => s.bestStreak, 3),
  B('streak7', 'star', '#0E9AA5', { en: 'Week of care', fr: 'Semaine de soins' }, { en: 'A 7-day streak.', fr: 'Une série de 7 jours.' }, (s) => s.bestStreak, 7),
  B('streak30', 'trophy', '#E58A00', { en: 'Devoted', fr: 'Dévoué' }, { en: 'A 30-day streak.', fr: 'Une série de 30 jours.' }, (s) => s.bestStreak, 30),
  B('logs50', 'heart', '#FF6B9A', { en: '50 cares', fr: '50 soins' }, { en: 'Log 50 cares.', fr: 'Notez 50 soins.' }, (s) => s.logs, 50),
  B('logs250', 'heart', '#E2477C', { en: '250 cares', fr: '250 soins' }, { en: 'Log 250 cares.', fr: 'Notez 250 soins.' }, (s) => s.logs, 250),
  B('routine', 'calendar', '#1CB0F6', { en: 'Planner', fr: 'Organisé' }, { en: 'Create a routine with reminders.', fr: 'Créez une routine avec rappels.' }, (s) => s.routines, 1),
  B('record', 'file', '#9B7BF7', { en: 'Health file', fr: 'Carnet de santé' }, { en: 'Add a health record.', fr: 'Ajoutez un dossier de santé.' }, (s) => s.records, 1),
  B('moment', 'camera', '#FF8A3D', { en: 'Memory keeper', fr: 'Gardien des souvenirs' }, { en: 'Save a moment.', fr: 'Enregistrez un moment.' }, (s) => s.moments, 1),
  B('weight', 'scale', '#58C322', { en: 'Weigh-in', fr: 'Pesée' }, { en: 'Log a weight.', fr: 'Notez un poids.' }, (s) => s.weights, 1),
  B('walker', 'walk', '#3E8E17', { en: 'Trail buddy', fr: 'Compagnon de route' }, { en: 'Time 5 walks with the walk timer.', fr: 'Chronométrez 5 balades.' }, (s) => s.walksTimed, 5),
  B('challenge1', 'trophy', '#7C5CE6', { en: 'Challenger', fr: 'Challenger' }, { en: 'Complete a challenge.', fr: 'Réussissez un défi.' }, (s) => s.challengesDone, 1),
  B('challenge3', 'trophy', '#5B3FD0', { en: 'Champion', fr: 'Champion' }, { en: 'Complete 3 challenges.', fr: 'Réussissez 3 défis.' }, (s) => s.challengesDone, 3),
  B('family', 'paw', '#B07A4F', { en: 'Full house', fr: 'Maison pleine' }, { en: 'Care for 2 pets.', fr: 'Prenez soin de 2 animaux.' }, (s) => s.pets, 2),
];

export const badgeText = (l: L) => (lang() === 'fr' ? l.fr : l.en);
export const earnedBadges = (s: BadgeStats) => BADGES.filter((b) => b.test(s)).map((b) => b.key);
