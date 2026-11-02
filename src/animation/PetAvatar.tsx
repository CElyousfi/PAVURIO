import React from 'react';
import { Species } from '../domain/care';
import { Appearance } from '../domain/appearance';
import { Mood, Sticker, moodSticker } from '../ui/Sticker';

/**
 * The pet as a small picture (quick-add row, pet lists, covers): a Honey / Tabby sticker in a mood.
 * `appearance` is kept for callers; the coat shows on the animated pet (PetRig), not on stickers.
 */
export function PetAvatar({ species, size, mood = 'hello' }: { species: Species; appearance?: Appearance; size: number; mood?: Mood }) {
  return <Sticker name={moodSticker(species, mood)} size={size} />;
}
