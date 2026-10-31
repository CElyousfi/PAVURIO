/**
 * The cat, played from its Gemini videos (SPECIES=cat tools/art/clips.py → assets/pets/cat/clips).
 * Coats are recolored from the gray tabby video; the red collar is drawn in, other colors are overlays.
 * Cares without their own video yet (drink, play, groom, litter…) play the happy clip.
 */
import React from 'react';
import { ClipKit, ClipMeta, ClipStage } from './ClipStage';
import { CAT_CLIPS, CAT_CLIP_IMG } from './catClips';
import type { PetClipName, PetRigProps } from './PetRig';

const HAS = new Set(Object.keys(CAT_CLIP_IMG));

/** clip the cat really plays for a request, or null when it has nothing fitting (hello, idle variety) */
export function catClip(name: PetClipName): string | null {
  if (HAS.has(name)) return name;
  if (name === 'hello' || name === 'idle2') return null;
  return 'celebrate';
}

const CAT_KIT: ClipKit = {
  clips: CAT_CLIPS as unknown as Record<string, ClipMeta>,
  img: CAT_CLIP_IMG,
  anchor: CAT_CLIPS._anchor,
  palettes: ['tabby', 'ginger', 'tuxedo', 'cream'],
  nativeAccessory: 'coral',
  accessories: ['coral', 'teal', 'leaf', 'sun', 'berry'],
  overlayPrefix: 'collar_',
  petH: 0.68,
  resolve: catClip,
  base: (rest) => (rest && HAS.has('sleep') ? 'sleep' : 'idle'),
};

export function CatStage(props: PetRigProps) {
  return <ClipStage kit={CAT_KIT} {...props} />;
}
