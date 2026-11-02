import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from './theme';
import { motionReduced } from './motion';

/**
 * An illustration that fills up like Waterllama's cups and the pet: a gray picture of itself
 * (flat silhouette + its own shading) with the real colours poured in from the bottom up to `level`.
 * The same look as the pet on Home, so every fillable thing in the app reads the same way.
 * Level changes rise in 200 ms ease-out (Waterllama's level rise).
 */
export function FillArt({ source, size, level }: { source: number; size: number; level: number }) {
  const l = Math.max(0, Math.min(1, level));
  const v = useSharedValue(l);
  useEffect(() => {
    v.value = motionReduced() ? l : withTiming(l, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [l, v]);
  // the window slides down by the empty part; its content slides back up, so the colours stay put
  const win = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - v.value) * size }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateY: -(1 - v.value) * size }] }));
  const img = { width: size, height: size };
  return (
    <View style={img} pointerEvents="none">
      <Image source={source} style={[img, styles.abs, { tintColor: colors.silhouette }]} fadeDuration={0} />
      <Image source={source} style={[img, styles.abs, styles.shade]} fadeDuration={0} />
      <Animated.View style={[img, styles.abs, styles.clip, win]}>
        <Animated.View style={[img, inner]}>
          <Image source={source} style={img} fadeDuration={0} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  clip: { overflow: 'hidden' },
  // the art's own lines and shading over the gray (luminosity blend), like the unfilled pet
  shade: { mixBlendMode: 'luminosity', opacity: 0.42 },
});
