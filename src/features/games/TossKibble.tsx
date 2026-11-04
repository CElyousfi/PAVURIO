/**
 * Toss the kibble (Clucky's "Feed the flock", with your own pet): tap the floor and a scoop of kibble
 * rains down there; the pet trots over (its real walk clip, turned to face the way it goes) and crunches
 * it with a little heart. Six scoops, then it finishes its bowl. A score card under the stage counts the
 * scoops on rolling digits and its line of text changes with the moment. Purely for fun — no care is logged.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';
import { PetRig, PetClipName } from '../../animation/PetRig';
import { useApp } from '../../state/AppState';
import { Bar, motionReduced } from '../../ui/motion';
import { RollingNumber } from '../../ui/Rolling';
import { T } from '../../ui/primitives';
import { colors } from '../../ui/theme';
import { petFeedback, successFeedback, tapFeedback } from '../../native/haptics';
import { t } from '../../i18n';

export const SCOOPS = 6;
const SPEED = 170; // points per second
const ASPECT = 1.05; // the pet art's height / width

type Pile = { id: number; x: number; y: number; bits: { dx: number; dy: number; r: number }[]; eaten: boolean };

function Floor({ w, h }: { w: number; h: number }) {
  // an isometric slab: checkered top, a thick lighter edge underneath
  const cx = w / 2;
  const top = (x: number, y: number) => `${x},${y}`;
  const n = 6;
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if ((i + j) % 2) continue;
      const p = (u: number, v: number) => {
        // u, v in 0..1 across the diamond
        const x = cx + (u - v) * (w / 2);
        const y = (u + v) * (h / 2);
        return top(x, y);
      };
      tiles.push(<Polygon key={`${i}-${j}`} points={`${p(i / n, j / n)} ${p((i + 1) / n, j / n)} ${p((i + 1) / n, (j + 1) / n)} ${p(i / n, (j + 1) / n)}`} fill="#E6E8F0" />);
    }
  const edge = 16;
  return (
    <Svg width={w} height={h + edge} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M0 ${h / 2} L${cx} ${h} L${cx} ${h + edge} L0 ${h / 2 + edge} Z`} fill="#D5D8E2" />
      <Path d={`M${w} ${h / 2} L${cx} ${h} L${cx} ${h + edge} L${w} ${h / 2 + edge} Z`} fill="#C7CBD8" />
      <Polygon points={`${cx},0 ${w},${h / 2} ${cx},${h} 0,${h / 2}`} fill="#F7F8FB" />
      {tiles}
    </Svg>
  );
}

function Bit({ x, y, r, delay, eaten }: { x: number; y: number; r: number; delay: number; eaten: boolean }) {
  const fall = useSharedValue(motionReduced() ? 0 : -160);
  const s = useSharedValue(1);
  useEffect(() => {
    if (motionReduced()) return;
    fall.value = withDelay(delay, withSequence(withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }), withTiming(-10, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 300 })));
  }, [delay, fall]);
  useEffect(() => {
    if (eaten) s.value = motionReduced() ? 0 : withSequence(withTiming(1.4, { duration: 80 }), withTiming(0, { duration: 160 }));
  }, [eaten, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: fall.value }, { scale: s.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.bit, { left: x - r, top: y - r * 0.8, width: r * 2, height: r * 1.6, borderRadius: r }, a]} />;
}

function Heart({ x, y }: { x: number; y: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
  }, [v]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - v.value, transform: [{ translateY: -60 * v.value }, { scale: 0.6 + 0.8 * Math.min(1, v.value * 3) }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - 12, top: y - 12 }, a]}>
      <T style={{ fontSize: 22, color: '#FF5C8A' }}>♥</T>
    </Animated.View>
  );
}

export function TossKibble({ width, onDone }: { width: number; onDone: () => void }) {
  const { pet, reduceMotion } = useApp();
  const W = width - 32;
  const H = W * 0.56;
  const petW = Math.min(W * 0.34, 150);
  const petH = petW * ASPECT;
  const home = { x: W / 2, y: H * 0.62 };
  const px = useSharedValue(home.x);
  const py = useSharedValue(home.y);
  const [facing, setFacing] = useState<1 | -1>(1); // 1 = the art's own direction (left)
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const [active, setActive] = useState(true);
  const [piles, setPiles] = useState<Pile[]>([]);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [scoops, setScoops] = useState(0);
  const [eatenCount, setEatenCount] = useState(0);
  const [finale, setFinale] = useState<'none' | 'eating' | 'full'>('none');
  const busy = useRef(false);
  const pos = useRef({ ...home });
  const queue = useRef<Pile[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** stop whatever clip is playing (the stage drops its action when it goes inactive for a frame) */
  const stopClip = () => {
    setClip(null);
    setActive(false);
    later(() => setActive(true), 30);
  };

  const goNext = useCallback(() => {
    const target = queue.current.find((p) => !p.eaten);
    if (!target) {
      busy.current = false;
      return;
    }
    busy.current = true;
    const dx = target.x - pos.current.x;
    const dy = target.y - pos.current.y;
    const dist = Math.hypot(dx, dy);
    const ms = motionReduced() ? 0 : Math.max(350, (dist / SPEED) * 1000);
    if (Math.abs(dx) > 4) setFacing(dx > 0 ? -1 : 1);
    if (!motionReduced() && dist > 12) setClip({ name: 'walk', nonce: Date.now() });
    // stop a little short, so the muzzle (not the paws) lands on the kibble
    const stopX = target.x + (dx > 0 ? -petW * 0.18 : petW * 0.18);
    px.value = withTiming(stopX, { duration: ms, easing: Easing.inOut(Easing.quad) });
    py.value = withTiming(target.y + 6, { duration: ms, easing: Easing.inOut(Easing.quad) });
    later(() => {
      pos.current = { x: stopX, y: target.y + 6 };
      stopClip();
      // crunch
      target.eaten = true;
      setPiles((ps) => ps.map((p) => (p.id === target.id ? { ...p, eaten: true } : p)));
      setHearts((hs) => [...hs.slice(-5), { id: target.id, x: stopX, y: target.y - petH * 0.75 }]);
      petFeedback();
      setEatenCount((n) => n + 1);
      later(goNext, 380);
    }, ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petW, petH]);

  // all six scoops eaten: the pet finishes its bowl, then the card turns into "tummy full"
  useEffect(() => {
    if (eatenCount < SCOOPS || finale !== 'none') return;
    setFinale('eating');
    setFacing(1);
    // after the stop from the last crunch has gone through
    if (!reduceMotion) later(() => setClip({ name: 'eat', nonce: Date.now() }), 150);
    later(
      () => {
        setFinale('full');
        successFeedback();
        if (!reduceMotion) setClip({ name: 'celebrate', nonce: Date.now() });
        later(onDone, 1800);
      },
      reduceMotion ? 400 : 4200,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eatenCount]);

  const floorRef = useRef<React.ComponentRef<typeof View>>(null);
  const toss = (e: GestureResponderEvent) => {
    if (scoops >= SCOOPS) return;
    // page coordinates minus the floor's own position (locationX is relative to whatever child was hit)
    const { pageX, pageY } = e.nativeEvent;
    // screen readers activate without a position: toss somewhere on the floor
    if (!pageX && !pageY) return drop(W * (0.3 + Math.random() * 0.4), H * (0.35 + Math.random() * 0.3));
    const node = floorRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((fx: number, fy: number) => drop(pageX - fx, pageY - fy));
  };
  const drop = (x: number, y: number) => {
    if (scoops >= SCOOPS) return;
    // only on the diamond
    if (Math.abs(x - W / 2) / (W / 2) + Math.abs(y - H / 2) / (H / 2) > 0.92) return;
    tapFeedback();
    const pile: Pile = {
      id: nextId.current++,
      x,
      y,
      eaten: false,
      bits: Array.from({ length: 6 }, () => ({ dx: (Math.random() - 0.5) * 26, dy: (Math.random() - 0.5) * 12, r: 4 + Math.random() * 2 })),
    };
    queue.current.push(pile);
    setPiles((ps) => [...ps, pile]);
    setScoops((n) => n + 1);
    if (!busy.current) later(goNext, 300);
  };

  const petStyle = useAnimatedStyle(() => ({ transform: [{ translateX: px.value - petW / 2 }, { translateY: py.value - petH * 0.9 }] }));

  if (!pet) return null;
  const line =
    finale === 'full'
      ? t('{name}’s tummy is full.', { name: pet.name })
      : finale === 'eating'
        ? t('Let {name} finish eating', { name: pet.name })
        : scoops === 0
          ? t('Tap the floor to toss kibble')
          : scoops < SCOOPS
            ? t('Toss another scoop')
            : t('Wait for {name} to get it all', { name: pet.name });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={toss} accessibilityRole="button" accessibilityLabel={t('Toss a scoop of kibble')} style={{ width: W, height: H + 16 }} testID="kibble-floor">
          <View ref={floorRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
          <Floor w={W} h={H} />
          {piles.map((p) => (
            <View key={p.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {p.bits.map((b, i) => (
                <Bit key={i} x={p.x + b.dx} y={p.y + b.dy} r={b.r} delay={i * 35} eaten={p.eaten} />
              ))}
            </View>
          ))}
          <Animated.View pointerEvents="none" style={[styles.pet, { width: petW, height: petH }, petStyle]}>
            <View style={{ transform: [{ scaleX: facing }] }}>
              <PetRig species={pet.species} appearance={pet.appearance} size={petW} clip={clip} onClipEnd={() => setClip(null)} active={active} reduceMotion={reduceMotion} />
            </View>
          </Animated.View>
          {hearts.map((h) => (
            <Heart key={h.id} x={h.x} y={h.y} />
          ))}
        </Pressable>
      </View>

      <View style={styles.card} accessible accessibilityLabel={`${scoops} / ${SCOOPS}. ${line}`}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <RollingNumber value={scoops} size={54} lineHeight={60} />
          <T weight="black" style={{ fontSize: 17, color: colors.muted, marginBottom: 8 }}>
            {t('/ {n} scoops', { n: SCOOPS })}
          </T>
        </View>
        <View style={{ marginTop: 8 }}>
          <Bar value={scoops / SCOOPS} color="#FF8A1F" track={colors.line} height={10} />
        </View>
        <View style={{ height: 30, marginTop: 10, overflow: 'hidden' }}>
          <Animated.View key={line} entering={motionReduced() ? undefined : FadeInUp.duration(220)} exiting={motionReduced() ? undefined : FadeOutUp.duration(160)}>
            <T weight="black" style={{ fontSize: 20 }} numberOfLines={1} adjustsFontSizeToFit>
              {line}
            </T>
          </Animated.View>
        </View>
      </View>

      {finale === 'full' ? (
        <Animated.View entering={motionReduced() ? undefined : FadeIn.duration(200)} exiting={FadeOut} pointerEvents="none" style={styles.fullWrap}>
          <Animated.View entering={motionReduced() ? undefined : ZoomIn.springify().damping(11)} style={styles.fullBadge}>
            <T style={{ fontSize: 44 }}>🦴</T>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', backgroundColor: '#B06A2B', borderWidth: 1.5, borderColor: '#8A4F1C' },
  pet: { position: 'absolute', left: 0, top: 0 },
  card: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 18, borderWidth: 2, borderColor: colors.line },
  fullWrap: { position: 'absolute', top: '18%', alignSelf: 'center' },
  fullBadge: { width: 96, height: 96, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
