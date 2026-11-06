/**
 * Honey & Tabby, animated (the GIFs in docs/art/gifs → tools/art/gifstickers.py): every small picture of
 * "the pet" in the app (avatars, covers, cards, empty and error states). Each one is a single image with
 * its frames side by side; the frame is stepped on the UI thread, so a busy JS thread never stalls it.
 * The big animated pet on Home / walk / studio is the PetRig (same GIFs, with coats and the colour-in).
 */
import React, { useEffect } from 'react';
import { ImageStyle, StyleProp, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { CareType, Species } from '../domain/care';
import type { WeatherArt } from '../domain/weather';
import { PET_ART, type PetArtName } from './petArt.generated';
import { motionReduced } from './motion';

export type StickerName = PetArtName;

export type Mood = 'hello' | 'happy' | 'sleep' | 'party' | 'please' | 'love' | 'trophy' | 'curious';

const BY_MOOD: Record<Species, Record<Mood, StickerName>> = {
  dog: { hello: 'dog_wave', happy: 'dog_cheer', sleep: 'dog_sleep', party: 'dog_cheer', please: 'dog_eat', love: 'duo_hug', trophy: 'dog_cheer', curious: 'dog_drink' },
  cat: { hello: 'cat_wave', happy: 'cat_happy', sleep: 'cat_doze', party: 'cat_yarn', please: 'cat_eat', love: 'duo_cuddle', trophy: 'cat_wave', curious: 'cat_walk' },
};

export function moodSticker(species: Species, mood: Mood): StickerName {
  return BY_MOOD[species][mood];
}

/** The pet doing this care (the other mascot steps in when this one has no picture for it). */
export function careSticker(type: CareType | string | null | undefined, species: Species): StickerName {
  const dog = species === 'dog';
  switch (type) {
    case 'meal':
      return dog ? 'dog_eat' : 'cat_eat';
    case 'water':
      return dog ? 'dog_drink' : 'cat_drink';
    case 'walk':
      return dog ? 'dog_trot' : 'cat_trot';
    case 'play':
      return dog ? 'dog_play' : 'cat_play';
    case 'medication':
      return 'dog_meds';
    case 'litter':
      return 'cat_happy';
    case 'grooming':
      return dog ? 'dog_wave' : 'cat_happy';
    default:
      return moodSticker(species, 'happy');
  }
}

/** The pet for the weather on a walk. */
export function weatherSticker(w: WeatherArt | null): StickerName | null {
  switch (w) {
    case 'sunny':
      return 'dog_trot';
    case 'partly':
    case 'cloudy':
      return 'cat_walk';
    case 'rain':
    case 'storm':
      return 'dog_sleep';
    case 'hot':
      return 'cat_drink';
    case 'cold':
    case 'snow':
      return 'cat_bed';
    case 'night':
      return 'cat_doze';
    default:
      return null;
  }
}

/** One Honey & Tabby animation, `size` points square. `still` (or Reduce Motion) holds the first frame. */
export function Sticker({ name, size, style, still = false }: { name: StickerName; size: number; style?: StyleProp<ImageStyle>; still?: boolean }) {
  const art = PET_ART[name];
  const n = art.frames;
  const t = useSharedValue(0);
  const animate = !still && !motionReduced() && n > 1;
  useEffect(() => {
    if (!animate) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(n, { duration: n * art.ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [animate, n, art.ms, t]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(n - 1, Math.floor(t.value)) * size }] }));
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style as StyleProp<ImageStyle>]} pointerEvents="none">
      <Animated.Image source={art.sheet} style={[{ width: size * n, height: size }, strip]} fadeDuration={0} accessibilityIgnoresInvertColors />
    </View>
  );
}
