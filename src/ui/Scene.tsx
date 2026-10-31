/** A ChatGPT scene card (rounded illustration with its own background), shown as a framed card. */
import React from 'react';
import { Image, ImageSourcePropType, StyleProp, View, ViewStyle } from 'react-native';
import { softShadow } from './theme';

export function Scene({
  source,
  width,
  height,
  radius = Math.round(Math.min(width, height) * 0.16),
  border = 0,
  tilt = 0,
  style,
}: {
  source: ImageSourcePropType;
  width: number;
  height: number;
  radius?: number;
  border?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: border, borderColor: '#FFFFFF' },
        border ? softShadow : null,
        tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null,
        style,
      ]}
      accessibilityIgnoresInvertColors
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}
