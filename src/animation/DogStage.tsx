/** Honey, played from the dog GIFs (tools/art/gifclips.py dog → assets/pets/dog/clips). */
import React from 'react';
import { ClipKit, ClipMeta, ClipStage } from './ClipStage';
import { DOG_ANCHOR, DOG_CLIPS, DOG_CLIP_IMG } from './dogClips';
import type { PetClipName, PetRigProps } from './PetRig';
import { DOG_DYE } from './dogDye';
import { dyeOf } from '../domain/appearance';

const HAS = new Set(Object.keys(DOG_CLIP_IMG));

/** clip the dog really plays for a request: cares without their own GIF play the happy clip */
export function dogClip(name: PetClipName): string {
  return HAS.has(name) ? name : 'celebrate';
}

const DOG_KIT: ClipKit = {
  dye: DOG_DYE,
  dyeOf: (id) => dyeOf('dog', id),
  clips: DOG_CLIPS as unknown as Record<string, ClipMeta>,
  img: DOG_CLIP_IMG,
  anchor: DOG_ANCHOR,
  palettes: ['honey', 'cocoa', 'snow', 'midnight'],
  nativeAccessory: 'teal',
  accessories: ['teal', 'coral', 'leaf', 'sun', 'berry'],
  overlayPrefix: 'band_',
  petH: 0.66,
  resolve: dogClip,
  base: (rest) => (rest ? 'sleep' : 'idle'),
};

export function DogStage(props: PetRigProps) {
  return <ClipStage kit={DOG_KIT} {...props} />;
}
