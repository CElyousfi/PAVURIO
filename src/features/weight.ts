import type { Measurement } from '../data/careRepo';

export const LB_PER_KG = 2.20462;

/** Value of a stored measurement in the display unit (stored values keep their own unit). */
export function toUnit(m: Pick<Measurement, 'value' | 'unit'>, unit: 'kg' | 'lb'): number {
  if (m.unit === unit) return m.value;
  return unit === 'lb' ? m.value * LB_PER_KG : m.value / LB_PER_KG;
}

export function formatWeight(m: Pick<Measurement, 'value' | 'unit'>, unit: 'kg' | 'lb'): string {
  const v = toUnit(m, unit);
  return `${(Math.round(v * 10) / 10).toFixed(1)} ${unit}`;
}
