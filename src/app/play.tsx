/**
 * Play time (Clucky's wake-up missions, pet edition): two quick mini-games back to back —
 * Paw pattern (watch the paws light up, repeat them) and Treat jar (shake the phone, or tap the jar,
 * 20 times) — then a result screen. Purely for fun: nothing here logs care.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInRight, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Accelerometer } from 'expo-sensors';
import { PetRig, PetClipName } from '../animation/PetRig';
import { CARE } from '../domain/care';
import { useApp } from '../state/AppState';
import { CircleButton, Icon, Pill, T } from '../ui/primitives';
import { LipChip, Sunburst } from '../ui/Reward';
import { Bouncy, ConfettiRain, Pop, Ring, motionReduced } from '../ui/motion';
import { colors } from '../ui/theme';
import { errorFeedback, petFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { t } from '../i18n';

type Stage = 'intro' | 'pattern' | 'shake' | 'result';
const SHAKES = 20;
const SEQ_LEN = 4;
const TILES = [CARE.meal.color, CARE.water.color, CARE.walk.color, CARE.play.color];

export default function Play() {
  const { pet, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const [stage, setStage] = useState<Stage>('intro');
  const [tries, setTries] = useState(1);
  if (!pet) return null;
  const stepIndex = stage === 'pattern' ? 0 : stage === 'shake' ? 1 : stage === 'result' ? 2 : -1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.col, { width: W }]}>
        <View style={styles.topRow}>
          {stepIndex >= 0 ? (
            <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t('Step {n} of {total}', { n: stepIndex + 1, total: 3 })}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: i === stepIndex ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= stepIndex ? colors.ink : colors.line }} />
              ))}
            </View>
          ) : (
            <View />
          )}
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={46} />
        </View>

        {stage === 'intro' ? (
          <Animated.View key="intro" entering={FadeIn} style={styles.page}>
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <T weight="black" style={styles.h1} accessibilityRole="header">
                {t('Play time!')}
              </T>
              <T style={styles.sub}>{t('Two quick games with {name}. One minute, tops.', { name: pet.name })}</T>
            </View>
            <View style={styles.hero}>
              <PetRig species={pet.species} appearance={pet.appearance} size={Math.min(W * 0.7, 320)} interactive reduceMotion={reduceMotion} ambient />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
              <GamePill emoji="🐾" label={t('Paw pattern')} />
              <GamePill emoji="🦴" label={t('Treat jar')} />
            </View>
            <Pill label={t('LET’S PLAY')} onPress={() => setStage('pattern')} style={{ marginHorizontal: 24 }} testID="play-start" />
          </Animated.View>
        ) : null}

        {stage === 'pattern' ? <PawPattern key="pattern" width={W} onDone={(n) => (setTries(n), setStage('shake'))} /> : null}
        {stage === 'shake' ? <TreatJar key="shake" width={W} onDone={() => setStage('result')} /> : null}
        {stage === 'result' ? <Result key="result" width={W} tries={tries} onAgain={() => setStage('pattern')} /> : null}
      </View>
    </View>
  );
}

function GamePill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.gamePill}>
      <T style={{ fontSize: 18 }}>{emoji}</T>
      <T weight="black" style={{ fontSize: 15 }}>
        {label}
      </T>
    </View>
  );
}

// ------------------------------------------------------------- paw pattern

function PawGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Ellipse cx={24} cy={31} rx={10} ry={8.5} fill={color} />
      <Circle cx={12} cy={20} r={4.6} fill={color} />
      <Circle cx={19.5} cy={12.5} r={4.6} fill={color} />
      <Circle cx={28.5} cy={12.5} r={4.6} fill={color} />
      <Circle cx={36} cy={20} r={4.6} fill={color} />
    </Svg>
  );
}

function Tile({ color, lit, size, onPress, disabled, index }: { color: string; lit: boolean; size: number; onPress: () => void; disabled: boolean; index: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (motionReduced()) return;
    s.value = lit ? withSequence(withTiming(1.07, { duration: 90 }), withSpring(1.03, { damping: 10, stiffness: 260 })) : withSpring(1, { damping: 14, stiffness: 240 });
  }, [lit, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (!motionReduced()) s.value = withSpring(0.92, { damping: 20, stiffness: 420 });
      }}
      onPressOut={() => {
        if (!motionReduced()) s.value = withSpring(1, { damping: 11, stiffness: 320 });
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Paw {n}', { n: index + 1 })}
      testID={`paw-${index}`}
    >
      <Animated.View style={[styles.tile, { width: size, height: size, backgroundColor: lit ? color : `${color}38` }, a]}>
        <PawGlyph size={size * 0.46} color={lit ? '#FFFFFF' : `${color}AA`} />
      </Animated.View>
    </Pressable>
  );
}

function PawPattern({ width, onDone }: { width: number; onDone: (tries: number) => void }) {
  const [seq] = useState(() => {
    const out: number[] = [];
    while (out.length < SEQ_LEN) {
      const n = Math.floor(Math.random() * 4);
      if (out[out.length - 1] !== n) out.push(n); // never the same paw twice in a row
    }
    return out;
  });
  const [phase, setPhase] = useState<'ready' | 'watch' | 'yours' | 'oops' | 'won'>('ready');
  const [lit, setLit] = useState<number | null>(null);
  const [got, setGot] = useState(0);
  const [tries, setTries] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const play = useCallback(() => {
    setPhase('watch');
    setGot(0);
    const on = 520;
    const off = 200;
    seq.forEach((n, i) => {
      later(() => {
        setLit(n);
        tapFeedback();
      }, 450 + i * (on + off));
      later(() => setLit(null), 450 + i * (on + off) + on);
    });
    later(() => setPhase('yours'), 450 + seq.length * (on + off));
  }, [seq]);

  const tap = (n: number) => {
    if (phase !== 'yours') return;
    setLit(n);
    later(() => setLit((x) => (x === n ? null : x)), 220);
    if (n === seq[got]) {
      petFeedback();
      const next = got + 1;
      setGot(next);
      if (next === seq.length) {
        setPhase('won');
        successFeedback();
        later(() => onDone(tries), 900);
      }
    } else {
      errorFeedback();
      setPhase('oops');
      if (!motionReduced()) shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 70 }), withTiming(-8, { duration: 60 }), withSpring(0, { damping: 8, stiffness: 300 }));
      setTries((x) => x + 1);
      later(play, 1100);
    }
  };

  const size = Math.min((width - 24 * 2 - 14) / 2, 160);
  const heading = phase === 'ready' ? t('Remember the paws') : phase === 'watch' ? t('Watch…') : phase === 'won' ? t('Pawfect!') : phase === 'oops' ? t('Oops! Watch again') : t('Your turn');

  return (
    <Animated.View entering={motionReduced() ? undefined : FadeInRight.springify().damping(18)} style={styles.page}>
      <Animated.View key={heading} entering={motionReduced() ? undefined : ZoomIn.springify().damping(14)} style={{ paddingHorizontal: 24, alignItems: 'center' }}>
        <T weight="black" style={styles.h1} accessibilityLiveRegion="polite">
          {heading}
        </T>
        <T style={styles.sub}>{t('They light up in order. Tap them back the same way.')}</T>
      </Animated.View>
      <View style={styles.hero}>
        <Animated.View style={[styles.grid, { width: size * 2 + 14 }, shakeStyle]}>
          {TILES.map((c, i) => (
            <Tile key={i} index={i} color={c} lit={lit === i || phase === 'won'} size={size} disabled={phase !== 'yours'} onPress={() => tap(i)} />
          ))}
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
          {seq.map((_, i) => (
            <Pop key={i} trigger={i < got} amount={0.4}>
              <View style={[styles.seqDot, i < got && { backgroundColor: colors.ink }]} />
            </Pop>
          ))}
        </View>
      </View>
      {phase === 'ready' ? <Pill label={t('START')} onPress={play} style={{ marginHorizontal: 24 }} testID="pattern-start" /> : <View style={{ height: 62 }} />}
    </Animated.View>
  );
}

// ------------------------------------------------------------- treat jar

function Jar({ size, fill }: { size: number; fill: number }) {
  // treats piled to `fill` (0..1) of the jar's body
  const bodyTop = 34;
  const bodyBottom = 112;
  const level = bodyBottom - (bodyBottom - bodyTop - 8) * Math.max(0.15, fill);
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 100 120">
      <Rect x={22} y={12} width={56} height={14} rx={6} fill="#FF8A1F" />
      <Rect x={18} y={24} width={64} height={8} rx={4} fill="#E06F08" />
      <Path d="M20 34 h60 a8 8 0 0 1 8 8 v62 a12 12 0 0 1 -12 12 h-52 a12 12 0 0 1 -12 -12 v-62 a8 8 0 0 1 8 -8 z" fill="#E8F7FA" stroke="#BFE8EC" strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 28 + (i % 3) * 18 + (Math.floor(i / 3) % 2) * 6;
        const y = 104 - Math.floor(i / 3) * 14;
        if (y < level) return null;
        return <Path key={i} d={`M${x - 7} ${y} a3 3 0 1 1 3 -3 h8 a3 3 0 1 1 3 3 a3 3 0 1 1 -3 3 h-8 a3 3 0 1 1 -3 -3 z`} fill="#F2B45C" />;
      })}
      <Rect x={26} y={44} width={8} height={40} rx={4} fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}

function TreatJar({ width, onDone }: { width: number; onDone: () => void }) {
  const { pet, reduceMotion } = useApp();
  const [count, setCount] = useState(0);
  const [sensor, setSensor] = useState(false);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const last = useRef(0);
  const doneRef = useRef(false);
  const wobble = useSharedValue(0);
  const wobbleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }] }));

  const countRef = useRef(0);
  const bump = useCallback(() => {
    if (doneRef.current) return;
    countRef.current = Math.min(SHAKES, countRef.current + 1);
    setCount(countRef.current);
    if (countRef.current === SHAKES) {
      doneRef.current = true;
      successFeedback();
      setClip({ name: 'eat', nonce: Date.now() });
      setTimeout(onDone, 2200);
      return;
    }
    petFeedback();
    if (!motionReduced()) wobble.value = withSequence(withTiming(-14, { duration: 60 }), withTiming(12, { duration: 80 }), withSpring(0, { damping: 6, stiffness: 260 }));
  }, [onDone, wobble]);

  // real shakes from the accelerometer (not on web): a jolt over ~1.8 g, at most one every 200 ms
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || !alive) return;
        setSensor(true);
        Accelerometer.setUpdateInterval(50);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (g > 1.8 && now - last.current > 200) {
            last.current = now;
            bump();
          }
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [bump]);

  if (!pet) return null;
  const ring = Math.min(width * 0.62, 260);
  return (
    <Animated.View entering={motionReduced() ? undefined : FadeInRight.springify().damping(18)} style={styles.page}>
      <View style={{ paddingHorizontal: 24, alignItems: 'center' }}>
        <T weight="black" style={styles.h1}>
          {count >= SHAKES ? t('Treat time!') : sensor ? t('Shake the treat jar') : t('Tap the treat jar')}
        </T>
        <T style={styles.sub}>
          {sensor ? t('Shake your phone {n} times — or tap the jar.', { n: SHAKES }) : t('Tap it {n} times so {name} hears the treats.', { n: SHAKES, name: pet.name })}
        </T>
      </View>
      <View style={styles.hero}>
        <Pressable onPress={bump} accessibilityRole="button" accessibilityLabel={t('Shake the treat jar')} accessibilityValue={{ min: 0, max: SHAKES, now: count }} testID="jar">
          <Ring size={ring} stroke={16} value={count / SHAKES} color="#FF8A1F" track="#FFF0E0">
            <Animated.View style={wobbleStyle}>
              <Jar size={ring * 0.42} fill={1 - count / SHAKES} />
            </Animated.View>
            <Pop trigger={count} amount={0.25} style={styles.counter}>
              <T weight="black" style={{ fontSize: 22, color: '#FF8A1F' }}>
                {count}
                <T weight="black" style={{ fontSize: 15, color: colors.muted }}>
                  /{SHAKES}
                </T>
              </T>
            </Pop>
          </Ring>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', marginBottom: -10 }}>
        <PetRig species={pet.species} appearance={pet.appearance} size={Math.min(width * 0.42, 180)} clip={clip} onClipEnd={() => setClip(null)} reduceMotion={reduceMotion} active />
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------- result

function Result({ width, tries, onAgain }: { width: number; tries: number; onAgain: () => void }) {
  const { pet, reduceMotion } = useApp();
  const [fire, setFire] = useState<number | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  useEffect(() => {
    successFeedback();
    const a = setTimeout(() => setFire(Date.now()), 200);
    const b = setTimeout(() => setClip({ name: 'celebrate', nonce: Date.now() }), 300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  if (!pet) return null;
  const hero = Math.min(width * 0.66, 300);
  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Sunburst size={hero * 1.9} color="#FF8A1F" />
        </View>
        <PetRig species={pet.species} appearance={pet.appearance} size={hero} clip={clip} onClipEnd={() => setClip(null)} reduceMotion={reduceMotion} interactive active />
      </View>
      <Animated.View entering={motionReduced() ? undefined : FadeInUp.delay(150).springify().damping(16)} style={{ alignItems: 'center', paddingHorizontal: 24 }}>
        <T weight="black" style={styles.h1}>
          {t('Best play date ever.')}
        </T>
        <T style={styles.sub}>{t('{name} says: again, again!', { name: pet.name })}</T>
      </Animated.View>
      <View style={styles.chips}>
        <LipChip icon={<T style={{ fontSize: 22 }}>🐾</T>} value={tries <= 1 ? t('Perfect') : t('{n} tries', { n: tries })} caption={t('Paw pattern')} color={colors.brand} delay={300} />
        <LipChip icon={<T style={{ fontSize: 22 }}>🦴</T>} value={`${SHAKES}/${SHAKES}`} caption={t('Treat jar')} color="#FF8A1F" delay={420} />
      </View>
      <Bouncy onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('Back to {name}', { name: pet.name })} style={styles.cta} testID="play-done">
        <T weight="black" style={{ color: '#FFFFFF', fontSize: 20 }}>
          {t('Back to {name}', { name: pet.name })}
        </T>
        <Icon name="chevR" size={24} color="#FFFFFF" />
      </Bouncy>
      <Pressable onPress={onAgain} accessibilityRole="button" style={{ alignSelf: 'center', paddingTop: 14 }} hitSlop={8} testID="play-again">
        <T weight="black" style={{ color: colors.muted, fontSize: 15 }}>
          {t('Play again')}
        </T>
      </Pressable>
      <ConfettiRain fireKey={fire} colorsList={['#FF8A1F', '#FFC83D', colors.brand, '#FF6B9A']} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 54 },
  page: { flex: 1 },
  h1: { fontSize: 30, lineHeight: 36, textAlign: 'center', letterSpacing: -0.3 },
  sub: { fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 8 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gamePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  seqDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.line },
  counter: { position: 'absolute', bottom: 34, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 2 },
  chips: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, marginTop: 22, marginBottom: 22 },
  cta: { marginHorizontal: 22, height: 66, borderRadius: 24, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
});
