/**
 * The log card's vessel, Waterllama style: a flat container that fills with flat colour.
 * - water / meal: a deep bowl; the contents rise with the amount (water has bubbles, food has kibble)
 * - walk / play / grooming: a round timer that fills with the minutes
 * - litter: a litter box, always full (no amount)
 * The surface is a gentle wave that drifts on the UI thread; the level eases to a new amount in 200 ms
 * (Waterllama's pour, measured at 60 fps). A round chevron control sits in the middle: tap its top or
 * bottom half, or drag anywhere on the vessel, to change the amount.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { CareType } from '../domain/care';
import { colors } from './theme';
import { motionReduced } from './motion';
import { tapFeedback } from '../native/haptics';
import { t } from '../i18n';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Shape = { outline: string; top: number; bottom: number; control: { x: number; y: number } };

/** All shapes live in a 100×100 box. `top`/`bottom` = the liquid's full and empty heights. */
const BOWL: Shape = {
  outline: 'M8 30 Q8 24 14 24 L86 24 Q92 24 92 30 L84 82 Q82 92 71 92 L29 92 Q18 92 16 82 Z',
  top: 27,
  bottom: 92,
  control: { x: 50, y: 58 },
};
const TIMER: Shape = {
  outline: 'M50 16 A40 40 0 1 1 49.99 16 Z',
  top: 16,
  bottom: 96,
  control: { x: 50, y: 56 },
};
const BOX: Shape = {
  outline: 'M10 40 Q10 34 16 34 L84 34 Q90 34 90 40 L86 84 Q85 90 79 90 L21 90 Q15 90 14 84 Z',
  top: 44,
  bottom: 90,
  control: { x: 50, y: 64 },
};

export function shapeFor(type: CareType): Shape {
  if (type === 'water' || type === 'meal') return BOWL;
  if (type === 'litter') return BOX;
  return TIMER;
}

/** mix a colour with white (0 = colour, 1 = white) */
function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function darken(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function Vessel({
  type,
  color,
  level,
  size,
  onStep,
  testIDPrefix = 'amount',
}: {
  type: CareType;
  color: string;
  /** 0..1 of the vessel */
  level: number;
  size: number;
  /** +1 / −1 one step; omitted for care without an amount */
  onStep?: (dir: 1 | -1) => void;
  testIDPrefix?: string;
}) {
  const shape = shapeFor(type);
  const lv = useSharedValue(level);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || motionReduced()) {
      first.current = false;
      lv.value = level;
      return;
    }
    lv.value = withTiming(level, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [level, lv]);
  // a slow drifting wave on the surface
  const phase = useSharedValue(0);
  useEffect(() => {
    if (motionReduced()) return;
    phase.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [phase]);
  const top = shape.top;
  const bottom = shape.bottom;
  const amp = type === 'meal' ? 0 : 1.6;
  const lumpy = type === 'meal';
  const surface = useAnimatedProps(() => {
    const y = bottom - (bottom - top) * Math.max(0, Math.min(1, lv.value));
    const p = phase.value * Math.PI * 2;
    let d = `M-2 ${y.toFixed(2)}`;
    if (lumpy) {
      // a mound of kibble: little bumps across the top
      for (let x = 0; x <= 104; x += 8) d += ` Q${(x - 4).toFixed(1)} ${(y - 4.5).toFixed(2)} ${x.toFixed(1)} ${y.toFixed(2)}`;
    } else {
      for (let x = 0; x <= 104; x += 4) d += ` L${x} ${(y + Math.sin(x / 16 + p) * amp).toFixed(2)}`;
    }
    d += ' L104 104 L-2 104 Z';
    return { d };
  });

  // drag up / down on the vessel to change the amount, one step every ~16 pt
  const acc = useRef(0);
  // the responder is created once (a new one mid-drag would restart dy at 0); it reads the latest callback
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !!stepRef.current && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          acc.current = 0;
        },
        onPanResponderMove: (_e, g) => {
          const steps = Math.trunc(-g.dy / 16);
          while (acc.current < steps) {
            acc.current += 1;
            stepRef.current?.(1);
          }
          while (acc.current > steps) {
            acc.current -= 1;
            stepRef.current?.(-1);
          }
        },
      }),
    [],
  );

  const deep = darken(color, 0.12);
  const soft = lighten(color, 0.35);
  const id = `v-${type}`;
  const c = shape.control;
  const R = 13;
  const k = size / 100;
  return (
    <View style={{ width: size, height: size }} {...responder.panHandlers}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={id}>
            <Path d={shape.outline} />
          </ClipPath>
        </Defs>
        {type === 'litter' ? <Rect x={22} y={26} width={10} height={12} rx={3} fill={colors.silhouette} /> : null}
        <Path d={shape.outline} fill={colors.silhouette} />
        <G clipPath={`url(#${id})`}>
          <AnimatedPath animatedProps={surface} fill={color} />
          {type === 'water' ? (
            <>
              <Circle cx={30} cy={78} r={1.8} fill="#FFFFFF" opacity={0.35} />
              <Circle cx={68} cy={70} r={2.4} fill="#FFFFFF" opacity={0.3} />
              <Circle cx={42} cy={86} r={1.2} fill="#FFFFFF" opacity={0.35} />
              <Circle cx={60} cy={84} r={1} fill="#FFFFFF" opacity={0.3} />
            </>
          ) : null}
          {type === 'meal' ? (
            <>
              {[
                [24, 80], [36, 72], [48, 84], [62, 76], [74, 82], [30, 88], [56, 90], [70, 68], [42, 64], [20, 68], [80, 72],
              ].map(([x, y], i) => (
                <Ellipse key={i} cx={x} cy={y} rx={3.2} ry={2.4} fill={deep} opacity={0.45} />
              ))}
            </>
          ) : null}
          {type === 'litter' ? (
            <>
              {[[26, 70], [40, 80], [58, 74], [72, 82], [50, 62], [34, 58], [66, 60]].map(([x, y], i) => (
                <Circle key={i} cx={x} cy={y} r={1.6} fill={deep} opacity={0.35} />
              ))}
            </>
          ) : null}
        </G>
        {/* the timer's crown */}
        {shape === TIMER ? <Rect x={45} y={6} width={10} height={8} rx={3} fill={colors.silhouette} /> : null}
        {onStep ? (
          <G>
            <Circle cx={c.x} cy={c.y} r={R} fill={soft} />
            <Path d={`M${c.x - 4} ${c.y - 3.2} L${c.x} ${c.y - 7} L${c.x + 4} ${c.y - 3.2}`} stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={`M${c.x - 4} ${c.y + 3.2} L${c.x} ${c.y + 7} L${c.x + 4} ${c.y + 3.2}`} stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </G>
        ) : null}
      </Svg>
      {onStep ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('More')}
            hitSlop={6}
            onPress={() => {
              tapFeedback();
              onStep(1);
            }}
            style={{ position: 'absolute', left: (c.x - R) * k, top: (c.y - R) * k, width: 2 * R * k, height: R * k }}
            testID={`${testIDPrefix}-up`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Less')}
            hitSlop={6}
            onPress={() => {
              tapFeedback();
              onStep(-1);
            }}
            style={{ position: 'absolute', left: (c.x - R) * k, top: c.y * k, width: 2 * R * k, height: R * k }}
            testID={`${testIDPrefix}-down`}
          />
        </View>
      ) : null}
    </View>
  );
}
