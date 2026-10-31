/**
 * Care activity templates. Species-specific: dogs get Walk, cats get Litter.
 * Amounts are owner-entered facts; Pavurio never prescribes quantities.
 */
import { t } from '../i18n/core';

export type Species = 'dog' | 'cat';

export type CareType = 'meal' | 'walk' | 'water' | 'play' | 'grooming' | 'litter';

export type AmountSpec = {
  unit: string;
  /** default value proposed in the log card */
  default: number;
  step: number;
  min: number;
  max: number;
  /** quick presets shown as chips */
  presets: number[];
};

export type CareTemplate = {
  type: CareType;
  label: string;
  /** Uppercase CTA verb e.g. "+ MEAL" */
  cta: string;
  color: string;
  /** lighter tint for chips / backgrounds */
  tint: string;
  amount: AmountSpec | null;
  /** default times per day suggested in onboarding; owner can change */
  defaultTarget: number;
  /** short sentence shown on the log card */
  hint: string;
};

export const CARE: Record<CareType, CareTemplate> = {
  meal: {
    type: 'meal',
    get label() {
      return t('Meal');
    },
    get cta() {
      return t('+ MEAL');
    },
    color: '#F59E0B',
    tint: '#FEF3DC',
    amount: { unit: 'g', default: 100, step: 10, min: 5, max: 2000, presets: [50, 100, 150, 200] },
    defaultTarget: 2,
    get hint() {
      return t('How much did they eat?');
    },
  },
  walk: {
    type: 'walk',
    get label() {
      return t('Walk');
    },
    get cta() {
      return t('+ WALK');
    },
    color: '#58C322',
    tint: '#E6F7DA',
    amount: { unit: 'min', default: 20, step: 5, min: 1, max: 600, presets: [10, 20, 30, 45] },
    defaultTarget: 2,
    get hint() {
      return t('How long was the walk?');
    },
  },
  water: {
    type: 'water',
    get label() {
      return t('Water');
    },
    get cta() {
      return t('+ WATER');
    },
    color: '#1CB0F6',
    tint: '#DDF3FE',
    amount: { unit: 'ml', default: 250, step: 50, min: 10, max: 5000, presets: [150, 250, 500, 750] },
    defaultTarget: 1,
    get hint() {
      return t('Fresh water in the bowl');
    },
  },
  play: {
    type: 'play',
    get label() {
      return t('Play');
    },
    get cta() {
      return t('+ PLAY');
    },
    color: '#FF6B9A',
    tint: '#FFE4EE',
    amount: { unit: 'min', default: 10, step: 5, min: 1, max: 600, presets: [5, 10, 15, 30] },
    defaultTarget: 1,
    get hint() {
      return t('Playtime together');
    },
  },
  grooming: {
    type: 'grooming',
    get label() {
      return t('Grooming');
    },
    get cta() {
      return t('+ GROOM');
    },
    color: '#9B7BF7',
    tint: '#EEE8FE',
    amount: { unit: 'min', default: 10, step: 5, min: 1, max: 600, presets: [5, 10, 15, 30] },
    defaultTarget: 0,
    get hint() {
      return t('Brushing, bath or nails');
    },
  },
  litter: {
    type: 'litter',
    get label() {
      return t('Litter');
    },
    get cta() {
      return t('+ LITTER');
    },
    color: '#B07A4F',
    tint: '#F4E9DF',
    amount: null,
    defaultTarget: 1,
    get hint() {
      return t('Fresh and clean');
    },
  },
};

/** Order of care types in the Home quick-add row, per species. */
export const SPECIES_CARE: Record<Species, CareType[]> = {
  dog: ['meal', 'walk', 'water', 'play', 'grooming'],
  cat: ['meal', 'water', 'litter', 'play', 'grooming'],
};

/** Row on Home shows the first 4 (plus the pet avatar = 5 items, like the reference). */
export const HOME_ROW_SIZE = 4;

export function isCareType(v: string): v is CareType {
  return Object.prototype.hasOwnProperty.call(CARE, v);
}

export function careAllowedFor(species: Species, type: CareType): boolean {
  return SPECIES_CARE[species].includes(type);
}

export function formatAmount(type: CareType, amount: number | null | undefined): string {
  const spec = CARE[type].amount;
  if (!spec || amount == null) return CARE[type].type === 'litter' ? t('Cleaned') : t('Done');
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return `${rounded} ${spec.unit}`;
}

export function clampAmount(type: CareType, value: number): number {
  const spec = CARE[type].amount;
  if (!spec) return 0;
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}
