/** The dog, played from its Gemini videos (tools/art/clips.py → assets/pets/dog/clips). */
import React from 'react';
import { ClipKit, ClipMeta, ClipStage } from './ClipStage';
import { DOG_ANCHOR, DOG_CLIPS, DOG_CLIP_IMG } from './dogClips';
import type { PetRigProps } from './PetRig';

const DOG_KIT: ClipKit = {
  clips: DOG_CLIPS as unknown as Record<string, ClipMeta>,
  img: DOG_CLIP_IMG,
  anchor: DOG_ANCHOR,
  palettes: ['honey', 'cocoa', 'snow', 'midnight'],
  nativeAccessory: 'teal',
  accessories: ['teal', 'coral', 'leaf', 'sun', 'berry'],
  overlayPrefix: 'band_',
  petH: 0.66,
  resolve: (name) => name,
  base: (rest) => (rest ? 'sleep' : 'idle'),
};

export function DogStage(props: PetRigProps) {
  return <ClipStage kit={DOG_KIT} {...props} />;
}
