/**
 * The pet inside a bounded box: whatever the clip does (jumps, waves, celebrations), it stays inside
 * its own space and never covers a title, an input or a button. A little headroom keeps ears and tails
 * from being clipped in the usual poses.
 */
import React from 'react';
import { View } from 'react-native';
import { PetRig, PetRigProps } from '../animation/PetRig';

export function PetPreview({ size, testID, ...rig }: PetRigProps & { testID?: string }) {
  if (!(size > 0)) return null;
  return (
    <View style={{ width: Math.round(size * 1.12), height: Math.round(size * 1.12), overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }} testID={testID}>
      <PetRig size={size} {...rig} />
    </View>
  );
}
