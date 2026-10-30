import { Species } from './care';

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
    { id: 'honey', name: 'Honey', coat: '#FBE3BF', patch: '#F28C38', light: '#FFF0D9', pink: '#FB8781', shade: '#E8892A' },
    { id: 'cocoa', name: 'Cocoa', coat: '#EBD3C5', patch: '#8B4A2B', light: '#FBEBDD', pink: '#FB8781', shade: '#6E4227' },
    { id: 'snow', name: 'Snow', coat: '#F3EDE3', patch: '#D3C4AB', light: '#FFFFFF', pink: '#FB8781', shade: '#B9AD9C' },
    { id: 'midnight', name: 'Midnight', coat: '#EEEFF3', patch: '#4A4F5C', light: '#F3F1EE', pink: '#FB8781', shade: '#1F2128' },
  ],
  cat: [
    { id: 'tabby', name: 'Tabby', coat: '#9A929E', patch: '#665A6D', light: '#FBF3E2', pink: '#F9A3AE', shade: '#7E7586' },
    { id: 'ginger', name: 'Ginger', coat: '#FFB765', patch: '#E8822D', light: '#FFF7EC', pink: '#FF9BB0', shade: '#F29C48' },
    { id: 'tuxedo', name: 'Tuxedo', coat: '#3B3E48', patch: '#24262D', light: '#FAFAFA', pink: '#FF9BB0', shade: '#30333B' },
    { id: 'cream', name: 'Cream', coat: '#F3DFC4', patch: '#D8B88F', light: '#FFFBF5', pink: '#FF9BB0', shade: '#E4CAA6' },
  ],
};

export const ACCESSORIES: Accessory[] = [
  { id: 'teal', name: 'Teal', color: '#22C1C3', dark: '#139CA0' },
  { id: 'coral', name: 'Coral', color: '#FF6B6B', dark: '#E04848' },
  { id: 'leaf', name: 'Leaf', color: '#7ACB3B', dark: '#58A222' },
  { id: 'sun', name: 'Sun', color: '#FFC83D', dark: '#E5A812' },
  { id: 'berry', name: 'Berry', color: '#B07CF7', dark: '#8E58DD' },
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
