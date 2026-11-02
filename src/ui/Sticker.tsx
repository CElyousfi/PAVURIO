/**
 * Honey & Tabby stickers (ChatGPT sheets, tools/art/stickers.py): the mascots in moods and moments, used
 * wherever the app shows "the pet" as a small picture (avatars, covers, cards, empty and error states).
 * The animated pet on Home / walk / studio stays the PetRig.
 */
import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import type { CareType, Species } from '../domain/care';
import type { WeatherArt } from '../domain/weather';

export const STICKERS = {
  cat_bed: require('../../assets/art/stickers/cat_bed.webp'),
  cat_cheer: require('../../assets/art/stickers/cat_cheer.webp'),
  cat_cloudy: require('../../assets/art/stickers/cat_cloudy.webp'),
  cat_curious: require('../../assets/art/stickers/cat_curious.webp'),
  cat_drink: require('../../assets/art/stickers/cat_drink.webp'),
  cat_happy: require('../../assets/art/stickers/cat_happy.webp'),
  cat_hot: require('../../assets/art/stickers/cat_hot.webp'),
  cat_medicine: require('../../assets/art/stickers/cat_medicine.webp'),
  cat_night: require('../../assets/art/stickers/cat_night.webp'),
  cat_passport: require('../../assets/art/stickers/cat_passport.webp'),
  cat_sleep: require('../../assets/art/stickers/cat_sleep.webp'),
  cat_wave: require('../../assets/art/stickers/cat_wave.webp'),
  dog_bath: require('../../assets/art/stickers/dog_bath.webp'),
  dog_cold: require('../../assets/art/stickers/dog_cold.webp'),
  dog_eat: require('../../assets/art/stickers/dog_eat.webp'),
  dog_jump: require('../../assets/art/stickers/dog_jump.webp'),
  dog_love: require('../../assets/art/stickers/dog_love.webp'),
  dog_party: require('../../assets/art/stickers/dog_party.webp'),
  dog_please: require('../../assets/art/stickers/dog_please.webp'),
  dog_rain: require('../../assets/art/stickers/dog_rain.webp'),
  dog_sleep: require('../../assets/art/stickers/dog_sleep.webp'),
  dog_sunny: require('../../assets/art/stickers/dog_sunny.webp'),
  dog_trophy: require('../../assets/art/stickers/dog_trophy.webp'),
  dog_trot: require('../../assets/art/stickers/dog_trot.webp'),
  dog_wave: require('../../assets/art/stickers/dog_wave.webp'),
  duo_hug: require('../../assets/art/stickers/duo_hug.webp'),
} as const;
export type StickerName = keyof typeof STICKERS;

export type Mood = 'hello' | 'happy' | 'sleep' | 'party' | 'please' | 'love' | 'trophy' | 'curious';

const BY_MOOD: Record<Species, Record<Mood, StickerName>> = {
  dog: { hello: 'dog_wave', happy: 'dog_jump', sleep: 'dog_sleep', party: 'dog_party', please: 'dog_please', love: 'dog_love', trophy: 'dog_trophy', curious: 'dog_wave' },
  cat: { hello: 'cat_wave', happy: 'cat_happy', sleep: 'cat_sleep', party: 'cat_cheer', please: 'cat_curious', love: 'cat_cheer', trophy: 'cat_passport', curious: 'cat_curious' },
};

export function moodSticker(species: Species, mood: Mood): StickerName {
  return BY_MOOD[species][mood];
}

/** The mascot doing this care (whichever of the two has that moment). */
export function careSticker(type: CareType | string | null | undefined, species: Species): StickerName {
  switch (type) {
    case 'meal':
      return 'dog_eat';
    case 'water':
      return 'cat_drink';
    case 'walk':
      return 'dog_trot';
    case 'grooming':
      return 'dog_bath';
    case 'medication':
      return 'cat_medicine';
    case 'litter':
      return 'cat_happy';
    default:
      return moodSticker(species, 'happy');
  }
}

/** The mascot dressed for the weather. */
export function weatherSticker(w: WeatherArt | null): StickerName | null {
  switch (w) {
    case 'sunny':
      return 'dog_sunny';
    case 'partly':
    case 'cloudy':
      return 'cat_cloudy';
    case 'rain':
    case 'storm':
      return 'dog_rain';
    case 'hot':
      return 'cat_hot';
    case 'cold':
    case 'snow':
      return 'dog_cold';
    case 'night':
      return 'cat_night';
    default:
      return null;
  }
}

export function Sticker({ name, size, style }: { name: StickerName; size: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={STICKERS[name]} style={[{ width: size, height: size }, style]} fadeDuration={0} accessibilityIgnoresInvertColors />;
}
