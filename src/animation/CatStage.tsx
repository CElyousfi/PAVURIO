/**
 * CatStage — the cat drawn from GPT's cat sheet (docs/art/gpt-cat), upscaled with EDSR.
 * Until the cat videos exist the cat is a still, with no hand-made motion. It keeps the same contract
 * as the dog: color-in from a gray sketch by the day's progress, coat and collar colors, the care rug,
 * and a tap that never logs care. Built by tools/art/cat_assets.py.
 */
import React, { useEffect, useRef } from 'react';
import { GestureResponderEvent, Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import meta from '../../assets/pets/cat/cat.json';
import { BurstLayer } from './Burst';
import { CareRug } from './CareRug';
import type { PetRigProps } from './PetRig';

const IMG: Record<string, number> = {
  tabby: require('../../assets/pets/cat/tabby.webp'),
  ginger: require('../../assets/pets/cat/ginger.webp'),
  tuxedo: require('../../assets/pets/cat/tuxedo.webp'),
  cream: require('../../assets/pets/cat/cream.webp'),
};
const SKETCH: Record<string, number> = {
  tabby: require('../../assets/pets/cat/tabby_sketch.webp'),
  ginger: require('../../assets/pets/cat/ginger_sketch.webp'),
  tuxedo: require('../../assets/pets/cat/tuxedo_sketch.webp'),
  cream: require('../../assets/pets/cat/cream_sketch.webp'),
};
const COLLAR: Record<string, Record<string, number>> = {
  tabby: {
    teal: require('../../assets/pets/cat/tabby_collar_teal.webp'),
    leaf: require('../../assets/pets/cat/tabby_collar_leaf.webp'),
    sun: require('../../assets/pets/cat/tabby_collar_sun.webp'),
    berry: require('../../assets/pets/cat/tabby_collar_berry.webp'),
  },
  ginger: {
    teal: require('../../assets/pets/cat/ginger_collar_teal.webp'),
    leaf: require('../../assets/pets/cat/ginger_collar_leaf.webp'),
    sun: require('../../assets/pets/cat/ginger_collar_sun.webp'),
    berry: require('../../assets/pets/cat/ginger_collar_berry.webp'),
  },
  tuxedo: {
    teal: require('../../assets/pets/cat/tuxedo_collar_teal.webp'),
    leaf: require('../../assets/pets/cat/tuxedo_collar_leaf.webp'),
    sun: require('../../assets/pets/cat/tuxedo_collar_sun.webp'),
    berry: require('../../assets/pets/cat/tuxedo_collar_berry.webp'),
  },
  cream: {
    teal: require('../../assets/pets/cat/cream_collar_teal.webp'),
    leaf: require('../../assets/pets/cat/cream_collar_leaf.webp'),
    sun: require('../../assets/pets/cat/cream_collar_sun.webp'),
    berry: require('../../assets/pets/cat/cream_collar_berry.webp'),
  },
};

const CW = meta.canvas.w;
const CH = meta.canvas.h;
/** fraction of the stage height where the color-in starts (paws) and ends (just above the ears) */
const PAWS = meta.paws / CH;
const TOP = (meta.paws - meta.catH * 1.04) / CH;

export function CatStage({ appearance, size, progress = 1, interactive = false, onTap, rug, bursts, accessibilityLabel }: PetRigProps) {
  const w = size;
  const h = (size * CH) / CW;
  const coat = IMG[appearance.paletteId] ? appearance.paletteId : 'tabby';
  const collar = appearance.accessoryId !== 'coral' ? COLLAR[coat][appearance.accessoryId] : undefined;

  const fill = useSharedValue(progress);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      fill.value = progress;
      return;
    }
    fill.value = withTiming(progress, { duration: 1100, easing: Easing.inOut(Easing.cubic) });
  }, [progress, fill]);
  const clipStyle = useAnimatedStyle(() => {
    const f = Math.max(0, Math.min(1, fill.value));
    return { height: (1 - PAWS + (PAWS - TOP) * f) * h + (f >= 1 ? h : 0) };
  });

  const start = useRef({ x: 0, y: 0, t: 0 });
  const handlers = interactive
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          start.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, t: Date.now() };
        },
        onResponderRelease: (e: GestureResponderEvent) => {
          const moved = Math.hypot(e.nativeEvent.locationX - start.current.x, e.nativeEvent.locationY - start.current.y);
          if (moved < 14 && Date.now() - start.current.t < 450) onTap?.();
        },
      }
    : {};

  const full = { position: 'absolute' as const, left: 0, top: 0, width: w, height: h };
  return (
    <View
      style={{ width: w, height: h }}
      accessible
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={interactive ? 'Tap to say hello. This does not log any care.' : undefined}
      {...handlers}
    >
      {rug ? (
        <CareRug bands={rug.bands} planned={rug.planned} w={w} h={h} cy={PAWS * h - h * 0.004} rx={w * 0.44} ry={h * 0.055} />
      ) : (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse cx={w / 2} cy={PAWS * h} rx={w * 0.3} ry={h * 0.02} fill="#23304A" opacity={0.07} />
        </Svg>
      )}
      <Image source={SKETCH[coat]} style={full} fadeDuration={0} />
      <Animated.View pointerEvents="none" style={[styles.clip, clipStyle]}>
        <View style={{ position: 'absolute', left: 0, bottom: 0, width: w, height: h }}>
          <Image source={IMG[coat]} style={full} fadeDuration={0} />
          {collar ? <Image source={collar} style={full} fadeDuration={0} /> : null}
        </View>
      </Animated.View>
      {bursts && bursts.length > 0 ? <BurstLayer bursts={bursts} w={w} h={h} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
