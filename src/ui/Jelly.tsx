/**
 * The jelly pill (Clucky's red "+"): a soft capsule drawn as a blob whose outline breathes while idle,
 * squishes under the finger and wobbles back when let go. `poke` (any changing value) gives it a
 * bigger jiggle, e.g. when something lands in it. Everything is computed on the UI thread.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { motionReduced } from './motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const N = 28; // outline points
const PAD = 14; // room around the shape for squish and wobble

function blobPath(w: number, h: number, t: number, amp: number, sq: number) {
  'worklet';
  const a = w / 2;
  const b = h / 2;
  const cx = a + PAD;
  const cy = b + PAD;
  const n = 2.6; // superellipse exponent: a capsule with soft shoulders
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    let y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    const wob = amp * (0.6 * Math.sin(t + i * 0.9) + 0.4 * Math.sin(2 * t - i * 1.7));
    x += c * wob;
    y += s * wob;
    x *= 1 + 0.08 * sq;
    y *= 1 - 0.07 * sq;
    xs.push(cx + x);
    ys.push(cy + y);
  }
  // closed Catmull-Rom → cubic Béziers
  let d = `M${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  for (let i = 0; i < N; i++) {
    const i0 = (i - 1 + N) % N;
    const i2 = (i + 1) % N;
    const i3 = (i + 2) % N;
    const c1x = xs[i] + (xs[i2] - xs[i0]) / 6;
    const c1y = ys[i] + (ys[i2] - ys[i0]) / 6;
    const c2x = xs[i2] - (xs[i3] - xs[i]) / 6;
    const c2y = ys[i2] - (ys[i3] - ys[i]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${xs[i2].toFixed(2)} ${ys[i2].toFixed(2)}`;
  }
  return `${d} Z`;
}

export function JellyPill({
  width,
  height,
  color,
  children,
  onPress,
  onLongPress,
  poke,
  idle = 1.6,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
  disabled,
}: {
  width: number;
  height: number;
  color: string;
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** change it to jiggle */
  poke?: unknown;
  /** idle wobble in points (0 = still) */
  idle?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  disabled?: boolean;
}) {
  const t = useSharedValue(0);
  const amp = useSharedValue(motionReduced() ? 0 : idle);
  const sq = useSharedValue(0);

  useEffect(() => {
    if (motionReduced()) return;
    t.value = 0;
    t.value = withRepeat(withTiming(Math.PI * 2, { duration: 3400, easing: Easing.linear }), -1);
    return () => cancelAnimation(t);
  }, [t]);

  useEffect(() => {
    if (poke === undefined || motionReduced()) return;
    amp.value = withSequence(withTiming(idle + 9, { duration: 90 }), withSpring(idle, { damping: 4, stiffness: 90, mass: 0.7 }));
    sq.value = withSequence(withTiming(-0.6, { duration: 90 }), withSpring(0, { damping: 5, stiffness: 160 }));
  }, [poke, idle, amp, sq]);

  const props = useAnimatedProps(() => ({ d: blobPath(width, height, t.value, amp.value, sq.value) }));

  return (
    <Pressable
      disabled={disabled || (!onPress && !onLongPress)}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        if (motionReduced()) return;
        sq.value = withSpring(1, { damping: 14, stiffness: 320 });
        amp.value = withTiming(idle + 3, { duration: 120 });
      }}
      onPressOut={() => {
        if (motionReduced()) return;
        sq.value = withSpring(0, { damping: 4.5, stiffness: 180, mass: 0.8 });
        amp.value = withSpring(idle, { damping: 5, stiffness: 120 });
      }}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[{ width, height }, style]}
    >
      <Svg width={width + PAD * 2} height={height + PAD * 2} style={{ position: 'absolute', left: -PAD, top: -PAD }} pointerEvents="none">
        <AnimatedPath animatedProps={props} fill={color} />
      </Svg>
      <View pointerEvents="none" style={styles.center}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } });
