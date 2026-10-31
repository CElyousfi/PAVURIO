import React from 'react';
import { Image } from 'react-native';
import { Species } from '../domain/care';
import { Appearance } from '../domain/appearance';
import { DOG_AVATAR } from './dogAssets';

const CAT_AVATAR: Record<string, number> = {
  tabby: require('../../assets/pets/cat/avatar_tabby.webp'),
  ginger: require('../../assets/pets/cat/avatar_ginger.webp'),
  tuxedo: require('../../assets/pets/cat/avatar_tuxedo.webp'),
  cream: require('../../assets/pets/cat/avatar_cream.webp'),
};

/** Static head portrait for small places (quick-add row, pet switcher, widgets later). */
export function PetAvatar({ species, appearance, size }: { species: Species; appearance: Appearance; size: number }) {
  const map = species === 'dog' ? DOG_AVATAR : CAT_AVATAR;
  const src = map[appearance.paletteId] ?? Object.values(map)[0];
  return <Image source={src} style={{ width: size, height: size }} fadeDuration={0} />;
}
