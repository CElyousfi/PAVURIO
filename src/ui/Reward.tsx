/** Reward-moment pieces: a slowly turning sunburst and chunky "lip" stat chips (Clucky's result cards). */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { T } from './primitives';
import { motionReduced } from './motion';

/** Soft rays behind a hero, turning once every ~40 s. */
export function Sunburst({ size, color = '#14B8C4', rays = 14 }: { size: number; color?: string; rays?: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (motionReduced()) return;
    r.value = withRepeat(withTiming(360, { duration: 40_000, easing: Easing.linear }), -1);
    return () => cancelAnimation(r);
  }, [r]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  const c = size / 2;
  const paths = Array.from({ length: rays }, (_, i) => {
    const a0 = ((i * 2) / (rays * 2)) * Math.PI * 2;
    const a1 = (((i * 2 + 1) / (rays * 2)) * Math.PI * 2);
    return `M${c} ${c} L${c + c * Math.cos(a0)} ${c + c * Math.sin(a0)} L${c + c * Math.cos(a1)} ${c + c * Math.sin(a1)} Z`;
  });
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, spin]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        {paths.map((d, i) => (
          <Path key={i} d={d} fill={color} opacity={0.13} />
        ))}
        <Rect x={0} y={0} width={size} height={size} fill="url(#fade)" />
      </Svg>
    </Animated.View>
  );
}

/** A white value block sitting in a coloured tray with its caption below (a "3D" chip). */
export function LipChip({ icon, value, caption, color, delay = 0 }: { icon?: React.ReactNode; value: string; caption: string; color: string; delay?: number }) {
  return (
    <Animated.View entering={motionReduced() ? undefined : ZoomIn.delay(delay).springify().damping(13)} style={[styles.tray, { backgroundColor: color }]} accessible accessibilityLabel={`${caption}: ${value}`}>
      <View style={[styles.face, { borderColor: color }]}>
        {icon}
        <T weight="black" style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </T>
      </View>
      <T weight="black" style={styles.caption} numberOfLines={1}>
        {caption}
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: { flex: 1, borderRadius: 22, padding: 4, paddingBottom: 6 },
  face: { height: 64, borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  value: { fontSize: 22, flexShrink: 1 },
  caption: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginTop: 5 },
});
