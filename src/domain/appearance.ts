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
  /**
   * Coats beyond the four drawn ones are dyed at runtime from the base art (tools/art/dye.py):
   * the main coat and the patches/stripes take these colours, the art's own shading stays.
   */
  dye?: { body: string; patch: string };
  /** part of Pro */
  pro?: boolean;
};

export type Accessory = { id: string; name: string; color: string; dark: string };

export type Appearance = { paletteId: string; accessoryId: string };

export const PALETTES: Record<Species, Palette[]> = {
  dog: [
    { id: 'honey', get name() { return t('Honey'); }, coat: '#FBE3BF', patch: '#F28C38', light: '#FFF0D9', pink: '#FB8781', shade: '#E8892A' },
    { id: 'cocoa', get name() { return t('Cocoa'); }, coat: '#EBD3C5', patch: '#8B4A2B', light: '#FBEBDD', pink: '#FB8781', shade: '#6E4227' },
    { id: 'snow', get name() { return t('Snow'); }, coat: '#F3EDE3', patch: '#D3C4AB', light: '#FFFFFF', pink: '#FB8781', shade: '#B9AD9C' },
    { id: 'midnight', get name() { return t('Midnight'); }, coat: '#EEEFF3', patch: '#4A4F5C', light: '#F3F1EE', pink: '#FB8781', shade: '#1F2128' },
    // realistic coats (dyed at runtime)
    { id: 'golden', get name() { return t('Golden'); }, coat: '#F2C27A', patch: '#D98A2B', light: '#FBE6C4', pink: '#FB8781', shade: '#B8701F', dye: { body: '#F0BF74', patch: '#D3862A' }, pro: true },
    { id: 'red', get name() { return t('Red'); }, coat: '#E8A877', patch: '#A9461F', light: '#F6D9C2', pink: '#FB8781', shade: '#7E3315', dye: { body: '#E6A574', patch: '#A3441E' }, pro: true },
    { id: 'chocolate', get name() { return t('Chocolate'); }, coat: '#7A4A33', patch: '#4E2C1C', light: '#9C6A50', pink: '#FB8781', shade: '#3A2015', dye: { body: '#7D4C35', patch: '#4E2C1C' }, pro: true },
    { id: 'black', get name() { return t('Black'); }, coat: '#3A3A40', patch: '#1E1E22', light: '#55555C', pink: '#FB8781', shade: '#111114', dye: { body: '#3D3D43', patch: '#1F1F23' }, pro: true },
    { id: 'yellow', get name() { return t('Yellow Lab'); }, coat: '#F3E1C2', patch: '#E3C08E', light: '#FBF2E2', pink: '#FB8781', shade: '#C9A26A', dye: { body: '#F4E2C3', patch: '#E2BE8B' }, pro: true },
    { id: 'blue', get name() { return t('Blue'); }, coat: '#C9CED6', patch: '#5F6B7A', light: '#E7EAEE', pink: '#FB8781', shade: '#434C58', dye: { body: '#C7CCD5', patch: '#5D6978' }, pro: true },
    { id: 'piebald', get name() { return t('Piebald'); }, coat: '#F7F0E6', patch: '#2E2A28', light: '#FFFFFF', pink: '#FB8781', shade: '#1C1A19', dye: { body: '#F6EFE5', patch: '#2F2B29' }, pro: true },
  ],
  cat: [
    { id: 'tabby', get name() { return t('Tabby'); }, coat: '#A7A2AD', patch: '#6E6A78', light: '#FBF3E2', pink: '#F9A3AE', shade: '#7E7586' },
    { id: 'ginger', get name() { return t('Ginger'); }, coat: '#F6A55E', patch: '#DD7A2C', light: '#FFF4E6', pink: '#F9A3AE', shade: '#C9661F' },
    { id: 'tuxedo', get name() { return t('Tuxedo'); }, coat: '#46464E', patch: '#2A2A30', light: '#FBF3E2', pink: '#F9A3AE', shade: '#1E1E22' },
    { id: 'cream', get name() { return t('Cream'); }, coat: '#E6D0B6', patch: '#C7A888', light: '#FFF8EE', pink: '#F9A3AE', shade: '#B39272' },
    // realistic coats (dyed at runtime)
    { id: 'black', get name() { return t('Black'); }, coat: '#2E2E33', patch: '#1A1A1D', light: '#FBF3E2', pink: '#F9A3AE', shade: '#111113', dye: { body: '#303035', patch: '#1B1B1E' }, pro: true },
    { id: 'blue', get name() { return t('Russian Blue'); }, coat: '#8F98A8', patch: '#6F7889', light: '#FBF3E2', pink: '#F9A3AE', shade: '#555D6C', dye: { body: '#8F98A8', patch: '#6F7889' }, pro: true },
    { id: 'brown', get name() { return t('Brown Tabby'); }, coat: '#B48A60', patch: '#5E4128', light: '#FBF3E2', pink: '#F9A3AE', shade: '#4A321F', dye: { body: '#B48A60', patch: '#5E4128' }, pro: true },
    { id: 'silver', get name() { return t('Silver'); }, coat: '#D3D6DB', patch: '#6E737C', light: '#FBF3E2', pink: '#F9A3AE', shade: '#575C64', dye: { body: '#D3D6DB', patch: '#6E737C' }, pro: true },
    { id: 'chocolate', get name() { return t('Chocolate'); }, coat: '#7A5241', patch: '#4A2F23', light: '#FBF3E2', pink: '#F9A3AE', shade: '#38231A', dye: { body: '#7A5241', patch: '#4A2F23' }, pro: true },
    { id: 'lilac', get name() { return t('Lilac'); }, coat: '#C8B9C2', patch: '#9A8792', light: '#FBF3E2', pink: '#F9A3AE', shade: '#7A6873', dye: { body: '#C8B9C2', patch: '#968390' }, pro: true },
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

/** the colours a dyed coat paints the base art with, by species and coat id (null = a drawn coat) */
export function dyeOf(species: Species, paletteId: string): { body: string; patch: string } | null {
  return PALETTES[species].find((p) => p.id === paletteId)?.dye ?? null;
}

export function isProCoat(species: Species, paletteId: string): boolean {
  return !!PALETTES[species].find((p) => p.id === paletteId)?.pro;
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
