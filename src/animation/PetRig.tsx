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
  /** 0..1, how much of the pet is colored in today */
  progress?: number;
  interactive?: boolean;
  /** visual only, never logs care */
  onTap?: () => void;
  /** care rug under the pet (banded base, one stripe per planned care) */
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
