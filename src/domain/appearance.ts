import { Species } from './care';
import { t } from '../i18n/core';

/** Colors for one pet appearance. Shared roles across species so the rig can stay generic. */
export type Palette = {
  id: string;
  name: string;
  /** main coat */
  coat: string;
  /** secondary patches (dog ears / cat stripes & head) */
  patch: string;
  /** muzzle, chest, paws */
  light: string;
  /** inner ear / nose tint */
  pink: string;
  /** outline-ish shade used for subtle separations */
  shade: string;
};

export type Accessory = { id: string; name: string; color: string; dark: string };

export type Appearance = { paletteId: string; accessoryId: string };

export const PALETTES: Record<Species, Palette[]> = {
  dog: [
    { id: 'honey', get name() { return t('Honey'); }, coat: '#FBE3BF', patch: '#F28C38', light: '#FFF0D9', pink: '#FB8781', shade: '#E8892A' },
    { id: 'cocoa', get name() { return t('Cocoa'); }, coat: '#EBD3C5', patch: '#8B4A2B', light: '#FBEBDD', pink: '#FB8781', shade: '#6E4227' },
    { id: 'snow', get name() { return t('Snow'); }, coat: '#F3EDE3', patch: '#D3C4AB', light: '#FFFFFF', pink: '#FB8781', shade: '#B9AD9C' },
    { id: 'midnight', get name() { return t('Midnight'); }, coat: '#EEEFF3', patch: '#4A4F5C', light: '#F3F1EE', pink: '#FB8781', shade: '#1F2128' },
  ],
  cat: [
    { id: 'tabby', get name() { return t('Tabby'); }, coat: '#A7A2AD', patch: '#6E6A78', light: '#FBF3E2', pink: '#F9A3AE', shade: '#7E7586' },
    { id: 'ginger', get name() { return t('Ginger'); }, coat: '#F6A55E', patch: '#DD7A2C', light: '#FFF4E6', pink: '#F9A3AE', shade: '#C9661F' },
    { id: 'tuxedo', get name() { return t('Tuxedo'); }, coat: '#46464E', patch: '#2A2A30', light: '#FBF3E2', pink: '#F9A3AE', shade: '#1E1E22' },
    { id: 'cream', get name() { return t('Cream'); }, coat: '#E6D0B6', patch: '#C7A888', light: '#FFF8EE', pink: '#F9A3AE', shade: '#B39272' },
  ],
};

export const ACCESSORIES: Accessory[] = [
  { id: 'teal', get name() { return t('Teal'); }, color: '#22C1C3', dark: '#139CA0' },
  { id: 'coral', get name() { return t('Coral'); }, color: '#FF6B6B', dark: '#E04848' },
  { id: 'leaf', get name() { return t('Leaf'); }, color: '#7ACB3B', dark: '#58A222' },
  { id: 'sun', get name() { return t('Sun'); }, color: '#FFC83D', dark: '#E5A812' },
  { id: 'berry', get name() { return t('Berry'); }, color: '#B07CF7', dark: '#8E58DD' },
];

export function defaultAppearance(species: Species): Appearance {
  return { paletteId: PALETTES[species][0].id, accessoryId: species === 'dog' ? 'teal' : 'coral' };
}

export function resolvePalette(species: Species, paletteId: string): Palette {
  return PALETTES[species].find((p) => p.id === paletteId) ?? PALETTES[species][0];
}

export function resolveAccessory(accessoryId: string): Accessory {
  return ACCESSORIES.find((a) => a.id === accessoryId) ?? ACCESSORIES[0];
}

export function parseAppearance(species: Species, json: string | null | undefined): Appearance {
  try {
    const v = JSON.parse(json ?? '');
    if (v && typeof v.paletteId === 'string' && typeof v.accessoryId === 'string') return v;
  } catch {
    // fall through
  }
  return defaultAppearance(species);
}
