/** Achievements, derived from the owner's own records (nothing stored except which ones were seen). */
import { pickL } from '../i18n/core';
import { CareType, Species } from './care';

export type BadgeStats = {
  logs: number;
  bestStreak: number;
  routines: number;
  medRoutines: number;
  records: number;
  moments: number;
  weights: number;
  challengesDone: number;
  pets: number;
  walksTimed: number;
  waterLogs: number;
  groomLogs: number;
  hasBirthday: boolean;
};

type L = { en: string; fr: string };
export type BadgeDef = { key: string; species?: Species[]; icon: CareType | 'star' | 'heart' | 'trophy' | 'calendar' | 'file' | 'camera' | 'scale' | 'paw'; color: string; title: L; how: L; test: (s: BadgeStats) => boolean; goal: (s: BadgeStats) => [number, number] };

const B = (key: string, icon: BadgeDef['icon'], color: string, title: L, how: L, metric: (s: BadgeStats) => number, need: number, species?: Species[]): BadgeDef => ({
  key,
  species,
  icon,
  color,
  title,
  how,
  test: (s) => metric(s) >= need,
  goal: (s) => [Math.min(metric(s), need), need],
});

/** One medal per GPT badge illustration (docs/art/gpt-badges/sheet.png). Earned only from the owner's own records. */
export const BADGES: BadgeDef[] = [
  B('first_log', 'meal', '#F59E0B', { en: 'First care', fr: 'Premier soin' }, { en: 'Log your first care.', fr: 'Notez votre premier soin.' }, (s) => s.logs, 1),
  B('streak3', 'star', '#FF6B9A', { en: 'Cosy routine', fr: 'Routine douillette' }, { en: 'Colour in the plan 3 days in a row.', fr: 'Coloriez le programme 3 jours de suite.' }, (s) => s.bestStreak, 3),
  B('streak7', 'star', '#5B5BD6', { en: 'Week of care', fr: 'Semaine de soins' }, { en: 'A 7-day streak.', fr: 'Une série de 7 jours.' }, (s) => s.bestStreak, 7),
  B('hydration', 'water', '#1CB0F6', { en: 'Hydration hero', fr: 'Héros de l’hydratation' }, { en: 'Log fresh water 20 times.', fr: 'Notez l’eau fraîche 20 fois.' }, (s) => s.waterLogs, 20),
  B('walker', 'walk', '#3E8E17', { en: 'Trail buddy', fr: 'Compagnon de route' }, { en: 'Time 5 walks with the walk timer.', fr: 'Chronométrez 5 balades.' }, (s) => s.walksTimed, 5, ['dog']),
  B('groomer', 'grooming', '#0E9AA5', { en: 'Grooming star', fr: 'Star du toilettage' }, { en: 'Log grooming 10 times.', fr: 'Notez 10 toilettages.' }, (s) => s.groomLogs, 10),
  B('routine', 'calendar', '#E5484D', { en: 'Planner', fr: 'Organisé' }, { en: 'Create a routine with reminders.', fr: 'Créez une routine avec rappels.' }, (s) => s.routines, 1),
  B('meds', 'heart', '#9B7BF7', { en: 'On the dot', fr: 'Pile à l’heure' }, { en: 'Set up a medication routine.', fr: 'Créez une routine de médicament.' }, (s) => s.medRoutines, 1),
  B('record', 'file', '#1C7ED6', { en: 'Health file', fr: 'Carnet de santé' }, { en: 'Add a health record.', fr: 'Ajoutez un dossier de santé.' }, (s) => s.records, 1),
  B('weight', 'scale', '#E0A800', { en: 'Weigh-in', fr: 'Pesée' }, { en: 'Log a weight.', fr: 'Notez un poids.' }, (s) => s.weights, 1),
  B('birthday', 'star', '#E64980', { en: 'Party animal', fr: 'Fêtard' }, { en: 'Add a birthday or adoption day.', fr: 'Ajoutez un anniversaire ou un jour d’adoption.' }, (s) => (s.hasBirthday ? 1 : 0), 1),
  B('moment', 'camera', '#2F9E44', { en: 'Memory keeper', fr: 'Gardien des souvenirs' }, { en: 'Save a moment.', fr: 'Enregistrez un moment.' }, (s) => s.moments, 1),
  B('challenge1', 'trophy', '#7C5CE6', { en: 'Challenger', fr: 'Challenger' }, { en: 'Complete a challenge.', fr: 'Réussissez un défi.' }, (s) => s.challengesDone, 1),
  B('family', 'paw', '#9C36B5', { en: 'Best friends', fr: 'Meilleurs amis' }, { en: 'Care for 2 pets.', fr: 'Prenez soin de 2 animaux.' }, (s) => s.pets, 2),
];

export const badgeText = (l: L) => pickL(l);
export const earnedBadges = (s: BadgeStats) => BADGES.filter((b) => b.test(s)).map((b) => b.key);
/** Badges that make sense for this species (no walk badge for cats). */
export const badgesFor = (species: Species) => BADGES.filter((b) => !b.species || b.species.includes(species));
