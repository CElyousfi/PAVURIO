/** A scene card: Honey or Tabby (or both), animated, on a soft tinted card. */
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { softShadow } from './theme';
import { Sticker, type StickerName } from './Sticker';

export type SceneArt = { pet: StickerName; tint: string };

export function Scene({
  art,
  width,
  height,
  radius = Math.round(Math.min(width, height) * 0.16),
  border = 0,
  tilt = 0,
  style,
}: {
  art: SceneArt;
  width: number;
  height: number;
  radius?: number;
  border?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = Math.min(width, height) - border * 2;
  const size = Math.round(inner * 0.92);
  return (
    <View
      style={[
        { width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: art.tint, borderWidth: border, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'flex-end' },
        border ? softShadow : null,
        tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null,
        style,
      ]}
      accessibilityIgnoresInvertColors
    >
      {/* a soft light behind the pet */}
      <View style={{ position: 'absolute', width: inner * 0.9, height: inner * 0.9, borderRadius: inner, backgroundColor: '#FFFFFF', opacity: 0.45, top: (height - border * 2 - inner * 0.9) / 2 }} />
      <Sticker name={art.pet} size={size} style={{ marginBottom: Math.round((height - border * 2 - size) * 0.35) }} />
    </View>
  );
}
