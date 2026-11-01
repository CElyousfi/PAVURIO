/**
 * UI motion kit (interface only — pets are animated exclusively from the provided art).
 * Everything here respects reduce-motion: values jump to their end state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  FadeInDown,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { T } from './primitives';
import { springs } from './springs';
import { colors } from './theme';
import { tapFeedback } from '../native/haptics';

export { springs, usePress } from './springs';

let reduceMotionCache = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => (reduceMotionCache = v))
  .catch(() => {});
export const setMotionReduced = (v: boolean) => (reduceMotionCache = v);
export const motionReduced = () => reduceMotionCache;

/** Bumps its children (scale up and settle) every time `trigger` changes. For numbers and counts that just changed. */
export function Pop({ trigger, children, style, amount = 0.18 }: { trigger: unknown; children: React.ReactNode; style?: StyleProp<ViewStyle>; amount?: number }) {
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (motionReduced()) return;
    s.value = withSequence(withTiming(1 + amount, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, springs.pop));
  }, [trigger, amount, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Scale+fade in from a point (used for the log card's object growing out of the tapped icon). */
export function FlyIn({ from, children, style, delay = 0 }: { from: { dx: number; dy: number; scale: number } | null; children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const v = useSharedValue(from && !motionReduced() ? 0 : 1);
  useEffect(() => {
    if (!from || motionReduced()) {
      v.value = 1;
      return;
    }
    v.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 150, mass: 0.9 }));
  }, [from, delay, v]);
  const a = useAnimatedStyle(() => {
    const p = v.value;
    const f = from ?? { dx: 0, dy: 0, scale: 1 };
    return {
      opacity: Math.min(1, p * 2.5),
      transform: [{ translateX: f.dx * (1 - p) }, { translateY: f.dy * (1 - p) }, { scale: f.scale + (1 - f.scale) * p }],
    };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Number that counts from its previous value to the new one. */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 700, style, weight = 'black' }: { value: number; format?: (n: number) => string; duration?: number; style?: StyleProp<any>; weight?: 'bold' | 'xbold' | 'black' }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (motionReduced() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return (
    <T weight={weight} style={style}>
      {format(shown)}
    </T>
  );
}

const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom', 'zIndex'] as const;

/** Press feedback: springy scale + light haptic. Layout props (flex, margins, width…) go on the touch target. */
export function Bouncy({ children, onPress, style, scaleTo = 0.95, haptic = true, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) ((OUTER_KEYS as readonly string[]).includes(k) ? outer : inner)[k] = v;
  if (outer.flex != null || outer.flexGrow != null) inner.flex = 1;
  return (
    <Pressable
      {...rest}
      style={outer as ViewStyle}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, springs.pressIn);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, springs.pressOut);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tapFeedback();
        onPress?.(e);
      }}
    >
      <Animated.View style={[inner as ViewStyle, a]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Staggered entrance for list/feed items. */
export function Enter({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  if (motionReduced()) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).springify().damping(16).mass(0.8)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Gentle repeating pulse (CTA, "due now" dots). */
export function Pulse({ children, style, amount = 0.04, period = 1400, active = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; amount?: number; period?: number; active?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active || motionReduced()) {
      cancelAnimation(v);
      v.value = 0;
      return;
    }
    v.value = withRepeat(withSequence(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.quad) })), -1);
    return () => cancelAnimation(v);
  }, [active, period, v]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * amount }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** A light sweep across a button, every few seconds. Put inside an overflow:hidden container. */
export function Shimmer({ width, height, every = 3200 }: { width: number; height: number; every?: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (motionReduced()) return;
    x.value = withRepeat(withSequence(withTiming(0, { duration: 0 }), withDelay(every - 900, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }))), -1);
    return () => cancelAnimation(x);
  }, [every, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(x.value, [0, 1], [-width * 0.6, width * 1.2]) }, { skewX: '-20deg' }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: width * 0.28, height, backgroundColor: 'rgba(255,255,255,0.22)' }, a]} />;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring that animates to its value. */
export function Ring({ size, stroke, value, color = colors.brand, track = colors.line, children, delay = 0 }: { size: number; stroke: number; value: number; color?: string; track?: string; children?: React.ReactNode; delay?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, value));
    p.value = motionReduced() ? target : withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [value, delay, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Animated horizontal bar fill. */
export function Bar({ value, color, track = colors.line, height = 10, delay = 0 }: { value: number; color: string; track?: string; height?: number; delay?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, value));
    p.value = motionReduced() ? target : withDelay(delay, withSpring(target, { damping: 18, stiffness: 120 }));
  }, [value, delay, p]);
  const a = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, a]} />
    </View>
  );
}

// ------------------------------------------------------------- full-screen confetti

type Piece = { id: number; x: number; y0: number; delay: number; dur: number; color: string; w: number; h: number; spin: number; drift: number };
const RAIN_MS = 3200;

function ConfettiPiece({ p, height, clock }: { p: Piece; height: number; clock: SharedValue<number> }) {
  const a = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (clock.value * RAIN_MS - p.delay) / p.dur));
    return {
      opacity: local < 0.8 ? 1 : (1 - local) / 0.2,
      transform: [{ translateY: p.y0 + local * (height + 60 - p.y0) }, { translateX: Math.sin(local * 7 + p.id) * p.drift }, { rotate: `${local * p.spin}deg` }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', top: 0, left: p.x, width: p.w, height: p.h, borderRadius: 2, backgroundColor: p.color }, a]} />;
}

/** Confetti rain over the whole screen; re-fire by changing `fireKey`. One shared clock drives every piece. */
export function ConfettiRain({ fireKey, colorsList = ['#14B8C4', '#FFC83D', '#FF6B9A', '#58C322', '#9B7BF7', '#1CB0F6'], count = 60 }: { fireKey: number | null; colorsList?: string[]; count?: number }) {
  const { width, height } = useWindowDimensions();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!fireKey || motionReduced()) return;
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id: fireKey * 1000 + i,
        x: Math.random() * width,
        y0: -20 - Math.random() * height * 0.35,
        delay: Math.random() * 400,
        dur: 1700 + Math.random() * 1000,
        color: colorsList[i % colorsList.length],
        w: 7 + Math.random() * 6,
        h: 10 + Math.random() * 8,
        spin: (Math.random() - 0.5) * 900,
        drift: 10 + Math.random() * 30,
      })),
    );
    clock.value = 0;
    clock.value = withTiming(1, { duration: RAIN_MS, easing: Easing.linear });
    const timer = setTimeout(() => setPieces([]), RAIN_MS + 100);
    return () => clearTimeout(timer);
  }, [fireKey, count, width, height, colorsList, clock]);
  if (!pieces.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} p={p} height={height} clock={clock} />
      ))}
    </View>
  );
}

// ------------------------------------------------------------- splash (droplets above an icon after a save)

type Drop = { id: number; dx: number; dy: number; size: number; delay: number; color: string };

function SplashDrop({ d, clock }: { d: Drop; clock: SharedValue<number> }) {
  const a = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (clock.value * 700 - d.delay) / 520));
    const up = Math.sin(p * Math.PI); // rises then falls back
    return {
      opacity: p <= 0 ? 0 : 1 - p * p,
      transform: [{ translateX: d.dx * p }, { translateY: -d.dy * up + p * p * 14 }, { scale: 0.6 + 0.4 * up }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: d.size, height: d.size, borderRadius: d.size / 2, backgroundColor: d.color }, a]} />;
}

/** A little fountain of droplets centred in its parent; re-fire by changing `fireKey`. The parent should be `overflow: visible`. */
export function Splash({ fireKey, color, count = 7 }: { fireKey: number | null; color: string; count?: number }) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!fireKey || motionReduced()) return;
    setDrops(
      Array.from({ length: count }, (_, i) => ({
        id: fireKey * 100 + i,
        dx: (i - (count - 1) / 2) * 9 + (Math.random() - 0.5) * 8,
        dy: 26 + Math.random() * 22,
        size: 5 + Math.random() * 4,
        delay: Math.random() * 90,
        color,
      })),
    );
    clock.value = 0;
    clock.value = withTiming(1, { duration: 700, easing: Easing.linear });
    const timer = setTimeout(() => setDrops([]), 760);
    return () => clearTimeout(timer);
  }, [fireKey, count, color, clock]);
  if (!drops.length) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-start', top: -4 }]}>
      {drops.map((d) => (
        <SplashDrop key={d.id} d={d} clock={clock} />
      ))}
    </View>
  );
}

/** Pop-in for badges / medals. */
export function PopIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(motionReduced() ? 1 : 0);
  useEffect(() => {
    if (motionReduced()) return;
    v.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 160 }));
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 1.5), transform: [{ scale: 0.3 + v.value * 0.7 }, { rotate: `${(1 - v.value) * -25}deg` }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Slow float, for hero art. */
export function Float({ children, style, amount = 6, period = 3000 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; amount?: number; period?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (motionReduced()) return;
    v.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(v);
  }, [period, v]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -amount * v.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
