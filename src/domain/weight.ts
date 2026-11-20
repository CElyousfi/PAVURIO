/** Weight rules shared by every place that saves or offers a weight, so they always agree. */

export type WeightUnit = 'kg' | 'lb';

/** Exact definition of the pound. */
export const KG_PER_LB = 0.45359237;

/** The heaviest weight the app offers or accepts (a very large dog). The setup stepper stops here. */
export const WEIGHT_MAX_KG = 120;
/** The lightest weight the setup stepper offers (a newborn kitten). Manual entries may go lower. */
export const WEIGHT_MIN_KG = 0.3;

/** Weights are saved with one decimal in the owner's unit: 120 kg becomes 264.6 lb, which is
 * 120.02 kg. This slack lets every value the app itself produced pass validation. */
const ROUNDING_SLACK_KG = 0.05;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

/** A weight as it is saved: one decimal, in the owner's unit. */
export function savedValue(kg: number, unit: WeightUnit): number {
  return Math.round(fromKg(kg, unit) * 10) / 10;
}

/** The highest value accepted in this unit, as shown to the owner (120 kg / 264.6 lb). */
export function maxInUnit(unit: WeightUnit): number {
  return savedValue(WEIGHT_MAX_KG, unit);
}

/** Validation always happens in kilograms, whatever unit the value was entered in. */
export function isValidWeight(value: number, unit: WeightUnit): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  return toKg(value, unit) <= WEIGHT_MAX_KG + ROUNDING_SLACK_KG;
}

/** Keeps a stepper value within the offered range. */
export function clampKg(kg: number): number {
  return Math.max(WEIGHT_MIN_KG, Math.min(WEIGHT_MAX_KG, kg));
}

/** One tap on the setup weight stepper: 0.1/0.5 kg, or 0.2/1 lb, always within the offered range. */
export function stepWeightKg(kg: number, unit: WeightUnit, direction: 1 | -1): number {
  const step = unit === 'lb' ? (kg / KG_PER_LB < 10 ? 0.2 : 1) * KG_PER_LB : kg < 5 ? 0.1 : 0.5;
  return clampKg(Math.round((kg + direction * step) * 100) / 100);
}
