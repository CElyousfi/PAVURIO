import React, { useMemo } from 'react';
import { Image } from 'react-native';
import Svg, { G } from 'react-native-svg';
import { DOG_AVATAR } from './dogAssets';
import { ART as STATIC_ART } from '../ui/art';
import { ART, colorPaint } from './art';
import { Species } from '../domain/care';
import { Appearance, resolveAccessory, resolvePalette } from '../domain/appearance';

/** Static head-only portrait used in small places (quick-add row, pet switcher, widgets later). */
export function PetAvatar({ species, appearance, size }: { species: Species; appearance: Appearance; size: number }) {
  const art = ART[species];
  const p = useMemo(
    () => colorPaint(resolvePalette(species, appearance.paletteId), resolveAccessory(appearance.accessoryId)),
    [species, appearance.paletteId, appearance.accessoryId],
  );
  if (species === 'dog') {
    return <Image source={DOG_AVATAR[appearance.paletteId] ?? DOG_AVATAR.honey} style={{ width: size, height: size }} fadeDuration={0} />;
  }
  if (species === 'cat' && STATIC_ART.cat.avatar != null) {
    return <Image source={STATIC_ART.cat.avatar} style={{ width: size, height: size }} fadeDuration={0} />;
  }
  return (
    <Svg width={size} height={size} viewBox="30 22 240 240">
      <G>
        {art.earsBehindHead ? (
          <>
            {art.earL(p)}
            {art.earR(p)}
          </>
        ) : null}
        {art.body(p)}
        {art.accessory(p)}
        {art.head(p)}
        {art.earsBehindHead ? null : (
          <>
            {art.earL(p)}
            {art.earR(p)}
          </>
        )}
        {art.face(p)}
        {art.happyEyes(p)}
      </G>
    </Svg>
  );
}
