/**
 * Arc time wheels (Clucky-style): two big curved wheels, hours on the left and minutes on the right,
 * that you drag or fling like a dial. Every step past the centre ticks a haptic, the wheel snaps to the
 * nearest value, and tapping above or below the centre steps by one. Works with a screen reader as two
 * "adjustable" controls. Built on PanResponder + Reanimated so it behaves the same on web.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { T } from './primitives';
import { colors, font } from './theme';
import { motionReduced } from './motion';
import { tickFeedback } from '../native/haptics';
import { t } from '../i18n';

const STEP = 0.3; // radians between two numbers on the arc
const VISIBLE = 3.4; // how many steps either side of the centre are drawn

/** shortest signed distance from `pos` to item `i` on a wheel of `n` items */
function wrapped(i: number, pos: number, n: number) {
  'worklet';
  let d = (((i - pos) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

function ArcItem({ i, n, pos, label, side, cx, cy, r }: { i: number; n: number; pos: SharedValue<number>; label: string; side: 1 | -1; cx: number; cy: number; r: number }) {
  const style = useAnimatedStyle(() => {
    const d = wrapped(i, pos.value, n);
    const a = Math.abs(d);
    const th = d * STEP;
    const x = cx + side * r * Math.cos(th);
    const y = cy - r * Math.sin(th);
    return {
      opacity: a > VISIBLE ? 0 : interpolate(a, [0, 1, 2.2, VISIBLE], [1, 0.75, 0.35, 0]),
      color: interpolateColor(Math.min(a, 1), [0, 1], [colors.ink, '#A9B0BC']),
      transform: [{ translateX: x - 50 }, { translateY: y - 34 }, { rotate: `${-side * th}rad` }, { scale: interpolate(Math.min(a, 2), [0, 1, 2], [1, 0.62, 0.55]) }],
    };
  });
  return (
    <Animated.Text allowFontScaling={false} selectable={false} style={[styles.num, style]}>
      {label}
    </Animated.Text>
  );
}

export function ArcWheel({
  n,
  value,
  onChange,
  label,
  format,
  side,
  width,
  height,
  a11yValue,
}: {
  n: number;
  value: number;
  onChange: (i: number) => void;
  label: string;
  format: (i: number) => string;
  side: 1 | -1;
  width: number;
  height: number;
  a11yValue: string;
}) {
  const pos = useSharedValue(value);
  const live = useRef(value); // JS mirror of the position while a finger is down
  const last = useRef(Math.round(value));
  const dragging = useRef(false);
  const r = height * 0.78;
  // the circle's centre sits off-screen, so only its inner edge (the numbers) shows
  const cx = side === 1 ? width - 58 - r : 58 + r;
  const cy = height / 2;

  // follow outside changes (AM/PM chip, presets) when the finger isn't on the wheel
  useEffect(() => {
    if (dragging.current) return;
    const d = wrapped(value, live.current, n);
    if (Math.abs(d) < 0.01) return;
    const target = live.current + d;
    live.current = target;
    last.current = Math.round(target);
    pos.value = motionReduced() ? target : withSpring(target, { damping: 18, stiffness: 180 });
  }, [value, n, pos]);

  const commit = (target: number) => {
    const idx = ((Math.round(target) % n) + n) % n;
    onChange(idx);
  };

  const responder = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.current = true;
        start = live.current;
      },
      onPanResponderMove: (_e, g) => {
        const p = start - g.dy / (r * STEP);
        live.current = p;
        pos.value = p;
        const k = Math.round(p);
        if (k !== last.current) {
          last.current = k;
          tickFeedback();
        }
      },
      onPanResponderRelease: (e, g) => {
        dragging.current = false;
        let target: number;
        if (Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6) {
          // a tap: above the centre steps up, below steps down
          const above = e.nativeEvent.locationY < height / 2;
          target = Math.round(start) + (above ? 1 : -1);
          tickFeedback();
        } else {
          // fling: carry on in the direction of travel, then snap
          const carry = Math.abs(g.vy) < 0.4 ? 0 : Math.max(-5, Math.min(5, -g.vy * 2.2));
          target = Math.round(live.current + carry);
          if (target !== last.current) tickFeedback();
        }
        live.current = target;
        last.current = target;
        pos.value = motionReduced() ? target : withSpring(target, { damping: 16, stiffness: 150, mass: 0.8, velocity: -g.vy / (r * STEP) * 1000 });
        commit(target);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        const target = Math.round(live.current);
        live.current = target;
        pos.value = withTiming(target, { duration: 160, easing: Easing.out(Easing.quad) });
        commit(target);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, r, height]);

  const step = (dir: 1 | -1) => {
    const target = Math.round(live.current) + dir;
    live.current = target;
    last.current = target;
    pos.value = motionReduced() ? target : withSpring(target, { damping: 16, stiffness: 160 });
    tickFeedback();
    commit(target);
  };

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: a11yValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[{ width, height, overflow: 'hidden' }, Platform.OS === 'web' && ({ userSelect: 'none', touchAction: 'none', cursor: 'grab' } as object)]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={r} stroke={colors.line} strokeWidth={74} fill="none" />
      </Svg>
      {Array.from({ length: n }, (_, i) => (
        <ArcItem key={i} i={i} n={n} pos={pos} label={format(i)} side={side} cx={cx} cy={cy} r={r} />
      ))}
    </View>
  );
}

/** A duration on the same two wheels: 0–12 hours on the left, minutes in 5s on the right. */
export function ArcDurationPicker({ minutes, onChange, height = 300, hourUnit, minUnit }: { minutes: number; onChange: (m: number) => void; height?: number; hourUnit: string; minUnit: string }) {
  const [w, setW] = useState(0);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const half = w / 2;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, flexDirection: 'row' }}>
      {w > 0 ? (
        <>
          <ArcWheel n={13} value={h} side={1} width={half} height={height} label={hourUnit} a11yValue={String(h)} format={(i) => String(i).padStart(2, '0')} onChange={(i) => onChange(i * 60 + m)} />
          <ArcWheel n={12} value={Math.round(m / 5) % 12} side={-1} width={half} height={height} label={minUnit} a11yValue={String(m)} format={(i) => String(i * 5).padStart(2, '0')} onChange={(i) => onChange(h * 60 + i * 5)} />
          <View pointerEvents="none" style={[styles.knobWrap, { left: half - 26, top: height / 2 - 26 }]}>
            <View style={styles.knob} />
            <T weight="black" style={styles.colon}>
              :
            </T>
          </View>
          <T weight="black" style={[styles.unit, { left: half - 108, top: height / 2 + 30, width: 100 }]}>
            {hourUnit}
          </T>
          <T weight="black" style={[styles.unit, { left: half + 8, top: height / 2 + 30, width: 100 }]}>
            {minUnit}
          </T>
        </>
      ) : null}
    </View>
  );
}

/** value / onChange use "HH:MM" (24 h). Minutes move in 5-minute steps. */
export function ArcTimePicker({ value, onChange, h24, height = 300 }: { value: string; onChange: (v: string) => void; h24: boolean; height?: number }) {
  const [w, setW] = useState(0);
  const [h, m] = value.split(':').map(Number);
  const pm = h >= 12;
  const set = (hh: number, mm: number) => onChange(`${String(((hh % 24) + 24) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  const half = w / 2;
  const hourN = h24 ? 24 : 12;
  const hourIdx = h24 ? h : h % 12;
  const hourLabel = (i: number) => (h24 ? String(i).padStart(2, '0') : String(i === 0 ? 12 : i));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, flexDirection: 'row' }}>
      {w > 0 ? (
        <>
          <ArcWheel
            n={hourN}
            value={hourIdx}
            side={1}
            width={half}
            height={height}
            label={t('Hour')}
            a11yValue={hourLabel(hourIdx)}
            format={hourLabel}
            onChange={(i) => set(h24 ? i : i + (pm ? 12 : 0), m)}
          />
          <ArcWheel
            n={12}
            value={Math.round(m / 5) % 12}
            side={-1}
            width={half}
            height={height}
            label={t('Minutes')}
            a11yValue={String(m).padStart(2, '0')}
            format={(i) => String(i * 5).padStart(2, '0')}
            onChange={(i) => set(h, i * 5)}
          />
          <View pointerEvents="none" style={[styles.knobWrap, { left: half - 26, top: height / 2 - 26 }]}>
            <View style={styles.knob} />
            <T weight="black" style={styles.colon}>
              :
            </T>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  num: { position: 'absolute', left: 0, top: 0, width: 100, height: 68, textAlign: 'center', fontFamily: font.black, fontSize: 56, lineHeight: 68, letterSpacing: -1 },
  knobWrap: { position: 'absolute', width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  knob: { position: 'absolute', width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brand, transform: [{ rotate: '45deg' }] },
  unit: { position: 'absolute', textAlign: 'center', fontSize: 13, letterSpacing: 1, color: '#A9B0BC' },
  colon: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, marginTop: -4 },
});
