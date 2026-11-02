import React from 'react';
import type { CareType, Species } from '../domain/care';
import type { Appearance } from '../domain/appearance';
import type { Burst } from './Burst';
import { DogStage } from './DogStage';
import { CatStage } from './CatStage';

export type PetClipName = 'celebrate' | 'eat' | 'drink' | 'walk' | 'play' | 'groom' | 'litter' | 'hello' | 'idle2';

export type PetRigProps = {
  species: Species;
  appearance: Appearance;
  /** width in points; height follows the art's aspect ratio */
  size: number;
  /** 0..1, how far the colour stack has risen (the top of the last band) */
  progress?: number;
  interactive?: boolean;
  /** visual only, never logs care */
  onTap?: () => void;
  /**
   * Waterllama-style colour stack: when given, the pet is drawn as a flat silhouette filled from the
   * paws with one flat band per care (fractions of its height, 0 = paws, 1 = top). Without it the pet
   * is drawn in its real colours (character views: species picker, studio, walk).
   */
  stack?: { color: string; from: number; to: number }[];
  /** @deprecated the rug under the pet was replaced by the colour stack */
  rug?: { bands: CareType[]; planned: number };
  bursts?: Burst[];
  accessibilityLabel?: string;
  /** play a generated clip once; nonce restarts it */
  clip?: { name: PetClipName; nonce: number } | null;
  onClipEnd?: () => void;
  /** pause looping animation, e.g. when the screen isn't focused */
  active?: boolean;
  reduceMotion?: boolean;
  /** night: the pet dozes (sleep loop) instead of sitting idle; a tap wakes it with a wave */
  rest?: boolean;
  /** occasionally play idle variations (look around, tail wag) while nothing else happens */
  ambient?: boolean;
};

/**
 * Pets are drawn only from the approved generated art: both are played from their Gemini videos
 * (DogStage, CatStage). The cat has fewer clips so far; missing ones fall back to its happy clip.
 */
export function PetRig(props: PetRigProps) {
  return props.species === 'dog' ? <DogStage {...props} /> : <CatStage {...props} />;
}
