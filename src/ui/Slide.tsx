/**
 * Slide to confirm (Clucky's "slide to stop"): drag the round thumb along the track. The label fades
 * and the track fills behind the thumb, haptics get firmer at each quarter, and letting go before the end
 * springs it back with a little rubber band. Reaching the end locks it and calls `onComplete` once.
 * A screen reader gets a plain button ("activate" completes it).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Icon, T } from './primitives';
import { colors } from './theme';
import { motionReduced } from './motion';
import { petFeedback, successFeedback, tapFeedback } from '../native/haptics';

const H = 72;
const PAD = 6;
const THUMB = H - PAD * 2;

export function SlideToConfirm({
  label,
  doneLabel,
  color = colors.brand,
  tint = colors.brandSoft,
  onComplete,
  disabled,
  icon,
  testID,
}: {
  label: string;
  doneLabel?: string;
  color?: string;
  tint?: string;
  onComplete: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}) {
  const [w, setW] = useState(0);
  const [done, setDone] = useState(false);
  const x = useSharedValue(0);
  const nudge = useSharedValue(0);
  const max = Math.max(1, w - THUMB - PAD * 2);
  const doneRef = useRef(false);
  const quarter = useRef(0);
  const cb = useRef(onComplete);
  cb.current = onComplete;

  // an idle "try me" nudge every few seconds, like a sleepy alarm handle
  useEffect(() => {
    if (motionReduced() || done || disabled) return;
    nudge.value = withRepeat(withSequence(withTiming(0, { duration: 2200 }), withTiming(14, { duration: 260, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 6, stiffness: 220 })), -1);
    return () => {
      nudge.value = 0;
    };
  }, [done, disabled, nudge]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    successFeedback();
    x.value = motionReduced() ? max : withSpring(max, { damping: 18, stiffness: 260 });
    setTimeout(() => cb.current(), motionReduced() ? 0 : 280);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !doneRef.current && !disabled,
        onMoveShouldSetPanResponder: (_e, g) => !doneRef.current && !disabled && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          quarter.current = 0;
          nudge.value = 0;
          tapFeedback();
        },
        onPanResponderMove: (_e, g) => {
          // past the end it stretches a little instead of stopping dead
          const raw = Math.max(0, g.dx);
          const v = raw > max ? max + (raw - max) * 0.15 : raw;
          x.value = v;
          const q = Math.min(3, Math.floor((v / max) * 4));
          if (q > quarter.current) {
            quarter.current = q;
            petFeedback();
          }
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx >= max * 0.88 || (g.dx > max * 0.55 && g.vx > 0.9)) finish();
          else x.value = withSpring(0, { damping: 11, stiffness: 240, mass: 0.7 });
        },
        onPanResponderTerminate: () => {
          x.value = withSpring(0, { damping: 14, stiffness: 220 });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [max, disabled],
  );

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + nudge.value }, { scale: interpolate(x.value, [0, max * 0.2, max], [1, 1.06, 1], 'clamp') }] }));
  const fill = useAnimatedStyle(() => ({ width: Math.min(w - PAD * 2, x.value + THUMB) }));
  const text = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.55], [1, 0], 'clamp'), transform: [{ translateX: interpolate(x.value, [0, max], [0, 24], 'clamp') }] }));

  return (
    <View
      testID={testID}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={done ? doneLabel ?? label : label}
      accessibilityState={{ disabled: !!disabled || done }}
      onAccessibilityTap={() => !disabled && finish()}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !disabled && finish()}
      style={[styles.track, { backgroundColor: tint, opacity: disabled ? 0.5 : 1 }, Platform.OS === 'web' && ({ userSelect: 'none', touchAction: 'pan-y' } as object)]}
      {...responder.panHandlers}
    >
      <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: color }, fill]} />
      <Animated.View pointerEvents="none" style={[styles.labelWrap, text]}>
        <T weight="black" style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </T>
        <View style={{ flexDirection: 'row', marginLeft: 6, opacity: 0.6 }}>
          <Icon name="chevR" size={16} color={color} />
          <View style={{ marginLeft: -9 }}>
            <Icon name="chevR" size={16} color={color} />
          </View>
        </View>
      </Animated.View>
      {done && doneLabel ? (
        <View pointerEvents="none" style={styles.labelWrap}>
          <T weight="black" style={[styles.label, { color: '#FFFFFF' }]} numberOfLines={1}>
            {doneLabel}
          </T>
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.thumb, thumb]}>
        {done ? <Icon name="check" size={28} color={color} /> : icon ?? <Icon name="chevR" size={28} color={color} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: H, borderRadius: H / 2, padding: PAD, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: PAD, top: PAD, bottom: PAD, borderRadius: THUMB / 2 },
  labelWrap: { position: 'absolute', left: THUMB + 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17, letterSpacing: 0.3 },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
