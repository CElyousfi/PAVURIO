import React, { useMemo } from 'react';
import Svg, { G } from 'react-native-svg';
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
