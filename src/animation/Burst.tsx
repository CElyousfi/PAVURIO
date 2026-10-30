import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export type BurstKind = 'hearts' | 'confetti';
type Particle = { id: number; x: number; y: number; dx: number; dy: number; rot: number; color: string; size: number; delay: number };
export type Burst = { id: number; kind: BurstKind; particles: Particle[] };

let nextId = 1;

/** Owns short-lived particle bursts. Particles remove themselves after they finish. */
export function useBursts(enabled: boolean) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const fire = useCallback(
    (kind: BurstKind, colors: string[]) => {
      if (!enabled) return;
      const count = kind === 'hearts' ? 4 : 18;
      const particles: Particle[] = Array.from({ length: count }).map((_, i) => {
        if (kind === 'hearts') {
          return {
            id: i,
            x: 0.5 + (Math.random() - 0.5) * 0.35,
            y: 0.22 + Math.random() * 0.1,
            dx: (Math.random() - 0.5) * 50,
            dy: -70 - Math.random() * 50,
            rot: (Math.random() - 0.5) * 30,
            color: colors[i % colors.length],
            size: 16 + Math.random() * 10,
            delay: i * 70,
          };
        }
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
        const dist = 90 + Math.random() * 90;
        return {
          id: i,
          x: 0.5,
          y: 0.45,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          rot: (Math.random() - 0.5) * 540,
          color: colors[i % colors.length],
          size: 7 + Math.random() * 6,
          delay: Math.random() * 80,
        };
      });
      const id = nextId++;
      setBursts((b) => [...b.slice(-2), { id, kind, particles }]);
      timers.current.push(setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1600));
    },
    [enabled],
  );
  return { bursts, fire };
}

export function BurstLayer({ bursts, w, h }: { bursts: Burst[]; w: number; h: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => b.particles.map((p) => <ParticleView key={`${b.id}-${p.id}`} p={p} kind={b.kind} w={w} h={h} />))}
    </View>
  );
}

function ParticleView({ p, kind, w, h }: { p: Particle; kind: BurstKind; w: number; h: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: kind === 'hearts' ? 1100 : 1000, easing: Easing.out(Easing.cubic) }));
  }, [t, p.delay, kind]);
  const style = useAnimatedStyle(() => {
    const gravity = kind === 'confetti' ? t.value * t.value * 80 : 0;
    return {
      opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
      transform: [
        { translateX: p.dx * t.value },
        { translateY: p.dy * t.value + gravity },
        { rotate: `${p.rot * t.value}deg` },
        { scale: kind === 'hearts' ? 0.5 + t.value * 0.6 : 1 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: p.x * w - p.size / 2, top: p.y * h - p.size / 2, width: p.size, height: p.size },
        style,
      ]}
    >
      {kind === 'hearts' ? (
        <Svg width={p.size} height={p.size} viewBox="0 0 24 24">
          <Path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill={p.color} />
        </Svg>
      ) : (
        <View style={{ width: p.size, height: p.size * 0.55, borderRadius: 2, backgroundColor: p.color }} />
      )}
    </Animated.View>
  );
}
