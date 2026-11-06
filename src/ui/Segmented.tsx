/**
 * The one segmented control used across the app (Summary ranges, Memories views, Passport tabs, the
 * New reminder mode): a soft gray track with a white thumb that slides under the chosen option on a
 * spring, with a selection tick. Optional per-option suffix (e.g. a lock).
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { T } from './primitives';
import { colors } from './theme';
import { motionReduced } from './motion';
import { selectFeedback } from '../native/haptics';

export type SegOption<K extends string> = { key: K; label: string; testID?: string };

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  style,
  height = 42,
  accent,
  thumbColor = '#FFFFFF',
}: {
  options: SegOption<K>[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  /** the chosen label's colour (default ink) */
  accent?: string;
  thumbColor?: string;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const seg = w > 0 ? (w - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    const to = idx * seg;
    x.value = motionReduced() || seg === 0 ? to : withSpring(to, { damping: 18, stiffness: 220, mass: 0.8 });
  }, [idx, seg, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[styles.track, { height: height + 8, borderRadius: (height + 8) / 2 }, style]} accessibilityRole="tablist">
      {seg > 0 ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: seg, height, borderRadius: height / 2, backgroundColor: thumbColor }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (!on) selectFeedback();
              onChange(o.key);
            }}
            style={[styles.btn, { height }]}
            testID={o.testID}
          >
            <T weight="black" style={{ fontSize: 15, color: on ? accent ?? colors.ink : colors.muted }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: '#E8EAEE', padding: 4 },
  thumb: { position: 'absolute', left: 4, top: 4, backgroundColor: '#FFFFFF' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
