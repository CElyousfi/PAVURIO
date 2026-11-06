/**
 * Tabby, played from the cat GIFs (tools/art/gifclips.py cat → assets/pets/cat/clips).
 * Coats are recolored from the gray tabby; the red collar is drawn in, other colors are overlays.
 * Cares without their own GIF (groom, litter, medicine) play the happy clip.
 */
import React from 'react';
import { ClipKit, ClipMeta, ClipStage } from './ClipStage';
import { CAT_CLIPS, CAT_CLIP_IMG } from './catClips';
import type { PetClipName, PetRigProps } from './PetRig';
import { CAT_DYE } from './catDye';
import { dyeOf } from '../domain/appearance';

const HAS = new Set(Object.keys(CAT_CLIP_IMG));

/** clip the cat really plays for a request: cares without their own GIF play the happy clip */
export function catClip(name: PetClipName): string {
  return HAS.has(name) ? name : 'celebrate';
}

const CAT_KIT: ClipKit = {
  dye: CAT_DYE,
  dyeOf: (id) => dyeOf('cat', id),
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
