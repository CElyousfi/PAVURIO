/**
 * Odometer numbers (Clucky's steppers and coin counter): every digit is a little reel that spins to
 * its new value. Digits are keyed from the right, so 9 → 10 rolls the ones and grows a tens reel.
 * Non-digit characters (":", "/", "%", spaces) sit still.
 */
import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';
import { T } from './primitives';
import { motionReduced } from './motion';

function Reel({ digit, size, lineHeight, style, weight }: { digit: number; size: number; lineHeight: number; style?: StyleProp<TextStyle>; weight: 'bold' | 'xbold' | 'black' }) {
  const y = useSharedValue(-digit * lineHeight);
  useEffect(() => {
    const to = -digit * lineHeight;
    y.value = motionReduced() ? to : withSpring(to, { damping: 15, stiffness: 140, mass: 0.9 });
  }, [digit, lineHeight, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={a}>
        {Array.from({ length: 10 }, (_, d) => (
          <T key={d} weight={weight} allowFontScaling={false} style={[style, { fontSize: size, lineHeight, height: lineHeight, textAlign: 'center' }]}>
            {d}
          </T>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingNumber({
  value,
  size = 40,
  lineHeight,
  style,
  weight = 'black',
  accessibilityLabel,
}: {
  value: string | number;
  size?: number;
  lineHeight?: number;
  style?: StyleProp<TextStyle>;
  weight?: 'bold' | 'xbold' | 'black';
  accessibilityLabel?: string;
}) {
  const text = String(value);
  const lh = lineHeight ?? Math.round(size * 1.18);
  const chars = text.split('');
  // only digits that appear after the first render pop in (e.g. 99 → 100), not the initial ones
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel ?? text}>
      {chars.map((c, i) => {
        const key = `p${chars.length - i}`; // position from the right
        if (c >= '0' && c <= '9')
          return (
            <Animated.View key={key} entering={motionReduced() || !mounted.current ? undefined : ZoomIn.springify().damping(14)}>
              <Reel digit={Number(c)} size={size} lineHeight={lh} style={style} weight={weight} />
            </Animated.View>
          );
        return (
          <T key={key + c} weight={weight} allowFontScaling={false} style={[style, { fontSize: size, lineHeight: lh }]}>
            {c}
          </T>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'flex-end' } });
