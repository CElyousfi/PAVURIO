import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { homePetSize } from '../ui/sizing';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutDown, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { JellyPill } from '../ui/Jelly';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RollingNumber } from '../ui/Rolling';
import { PetRig, PetClipName } from '../animation/PetRig';
import { catClip } from '../animation/CatStage';
import { dogClip } from '../animation/DogStage';
import { useBursts } from '../animation/Burst';
import { PetAvatar } from '../animation/PetAvatar';
import { Sticker, careSticker, moodSticker } from '../ui/Sticker';
import { CARE, CareType, SPECIES_CARE, formatAmount, isCareType } from '../domain/care';
import { careFill, fillStack, progressSentence } from '../domain/progress';
import { dayKeyOf, formatClock } from '../domain/time';
import { getLiveWalk, removeCareEvent } from '../data/walkRepo';
import type { Walk } from '../domain/walks';
import { useApp, useDay, useOccurrences } from '../state/AppState';
import { formatTime24to12, nextUp } from '../domain/schedule';
import { useEngagement } from '../state/Engagement';
import { capitalize, weekdayNames } from '../i18n/dates';
import { CircleButton, Icon, T } from '../ui/primitives';
import { FillArt } from '../ui/FillArt';
import { ART } from '../ui/art';
import { colors, font, softShadow } from '../ui/theme';
import { completeFeedback, petFeedback, popFeedback, tapFeedback, undoFeedback } from '../native/haptics';
import { t } from '../i18n';
import { Bouncy, ConfettiRain, Pop, Ring, Splash, motionReduced, usePress } from '../ui/motion';
import { HomeFeed } from '../features/HomeFeed';
import { ProMomentHost } from '../features/ProMoment';

const APressable = Animated.createAnimatedComponent(Pressable);

export default function Home() {
  const { pet, ready } = useApp();
  if (ready && !pet) return <Redirect href="/onboarding" />;
  if (!pet) return null;
  return <HomeScreen />;
}

let helloPlayed = false;
const isNight = (d = new Date()) => d.getHours() >= 22 || d.getHours() < 6;

function useNight() {
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const timer = setInterval(() => setNight(isNight()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return night;
}

function useTodayKey() {
  const [key, setKey] = useState(() => dayKeyOf(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const k = dayKeyOf(new Date());
      setKey((prev) => (prev === k ? prev : k));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  return key;
}

function HomeScreen() {
  const { pet, db, bump, reduceMotion, logged, clearLogged, plan, portions, version } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const focused = useIsFocused();
  const todayKey = useTodayKey();
  const { events, progress, loading } = useDay(todayKey);
  // a walk running in the background shows as a banner (tap to get back to it)
  const [liveWalk, setLiveWalk] = useState<Walk | null>(null);
  useEffect(() => {
    if (!pet || !focused) return;
    let alive = true;
    getLiveWalk(db, pet.id).then((w) => alive && setLiveWalk(w && (w.status === 'active' || w.status === 'paused') ? w : null));
    return () => {
      alive = false;
    };
  }, [db, pet, focused, version]);
  const occ = useOccurrences(todayKey);
  const next = nextUp(occ);
  const { bursts, fire } = useBursts(!reduceMotion);
  const [snack, setSnack] = useState<{ eventId: string; type: CareType } | null>(null);
  // droplets over the care icon that was just logged (the Waterllama "sip")
  const [splash, setSplash] = useState<{ type: CareType; key: number } | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const night = useNight();
  const { streak } = useEngagement();
  // confetti the moment the plan is completed (never on opening an already-complete day)
  const [cheer, setCheer] = useState<number | null>(null);
  const wasComplete = useRef<boolean | null>(null);
  const isComplete = progress.planned > 0 && progress.ratio >= 1;
  // read by the celebration below, after the log has reloaded the day: a log that completes the day sounds bigger
  const completeRef = useRef(isComplete);
  completeRef.current = isComplete;
  useEffect(() => {
    if (loading) return;
    if (wasComplete.current === false && isComplete && focused && !reduceMotion) setCheer(Date.now());
    wasComplete.current = isComplete;
  }, [isComplete, loading, focused, reduceMotion]);
  // a wave the first time Home is opened in this session (not at night, not over a celebration)
  useEffect(() => {
    if (helloPlayed || !focused || reduceMotion || night || pet?.species !== 'dog') return;
    helloPlayed = true;
    const timer = setTimeout(() => setClip((c) => c ?? { name: 'hello', nonce: Date.now() }), 700);
    return () => clearTimeout(timer);
  }, [focused, reduceMotion, night, pet?.species]);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vh, setVh] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Celebrate ONLY after the log card confirmed the record was persisted.
  // The timer lives in a ref: clearing `logged` re-runs this effect and must not cancel it.
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!logged || !focused) return;
    const { eventId, type } = logged;
    clearLogged();
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => {
      const confetti = () => fire('confetti', [CARE[type].color, '#FFC83D', colors.brand, '#FF6B9A']);
      if (pet && !reduceMotion) {
        // each care plays its own GIF clip; anything without one gets the happy jump
        const CLIP_FOR: Partial<Record<CareType, PetClipName>> = {
          meal: 'eat',
          water: 'drink',
          walk: 'walk',
          play: 'play',
          grooming: 'groom',
          litter: 'litter',
          medication: 'meds',
        };
        const name = CLIP_FOR[type] ?? 'celebrate';
        setClip({ name, nonce: Date.now() });
        const played = pet.species === 'cat' ? catClip(name) : dogClip(name);
        if (played === 'celebrate') setTimeout(confetti, 600);
        else setTimeout(() => fire('hearts', ['#FF6B9A', '#FF8FA3', '#FFB3C4']), 400);
      } else {
        confetti();
      }
      // the log card already played the log sound; a log that completes the day adds the fanfare
      if (completeRef.current) completeFeedback();
    }, 380);
    setSnack({ eventId, type });
    setSplash({ type, key: Date.now() });
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 6000);
  }, [logged, focused, clearLogged, fire, pet, reduceMotion]);

  useEffect(
    () => () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    },
    [],
  );
  useEffect(() => () => void (snackTimer.current && clearTimeout(snackTimer.current)), []);

  const undo = useCallback(async () => {
    if (!snack) return;
    const id = snack.eventId;
    setSnack(null);
    await removeCareEvent(db, id);
    bump();
    undoFeedback();
  }, [snack, db, bump]);

  if (!pet) return null;
  const row = SPECIES_CARE[pet.species];
  // never pushes the next-care card under the + button on short phones
  const petSize = homePetSize(W, height, insets.top, insets.bottom);
  const isEmptyDay = !loading && events.length === 0;
  const big = progress.planned > 0 ? `${progress.done}/${progress.planned}` : String(events.length);
  const complete = progress.planned > 0 && progress.ratio >= 1;
  const stack = fillStack(progress).map((b) => ({ color: CARE[b.type].color, from: b.from, to: b.to }));
  const itemW = Math.floor((W - 16) / 5);
  const doneOcc = occ.filter((o) => o.status === 'done').length;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        onLayout={(e) => setVh(e.nativeEvent.layout.height)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center' }}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 40)}
      >
      <View style={[styles.col, { width: W, height: vh || height, paddingTop: insets.top + 70, paddingBottom: insets.bottom + 86 }]}>

        <View style={styles.header} accessibilityRole="header" accessibilityLabel={`${big} · ${progressSentence(progress)}`}>
          {complete ? (
            <Animated.View key="done" entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}>
              <T weight="black" style={styles.cheer} numberOfLines={1} adjustsFontSizeToFit>
                {t('Wonderful {day}!', { day: capitalize(weekdayNames()[new Date().getDay()]) })}
              </T>
            </Animated.View>
          ) : (
            <Pop trigger={progress.planned > 0 ? progress.done : events.length} amount={0.12} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <RollingNumber value={progress.planned > 0 ? progress.done : events.length} size={60} lineHeight={68} style={{ color: colors.brand, letterSpacing: -1 }} />
              {progress.planned > 0 ? (
                <T weight="black" style={styles.big}>
                  /{progress.planned}
                </T>
              ) : null}
            </Pop>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={styles.subtitle}>{progressSentence(progress)}</T>
            <View style={styles.dropChip}>
              <Icon name="check" size={11} color={colors.brand} />
            </View>
          </View>
        </View>

        <View style={styles.stage}>
          <PetRig
            species={pet.species}
            appearance={pet.appearance}
            size={complete ? petSize * 0.84 : petSize}
            progress={progress.planned > 0 ? progress.level : events.length > 0 ? 1 : 0}
            stack={progress.planned > 0 ? stack : events.length > 0 ? [{ color: colors.brand, from: 0, to: 1 }] : []}
            interactive
            onTap={() => {
              petFeedback();
              fire('hearts', ['#FF6B9A', '#FF8FA3', '#FFB3C4']);
            }}
            bursts={bursts}
            clip={clip}
            onClipEnd={() => setClip(null)}
            active={focused}
            reduceMotion={reduceMotion}
            rest={night}
            ambient
            accessibilityLabel={t('{name}, {pct} percent colored in today', { name: pet.name, pct: Math.round(progress.ratio * 100) })}
          />
          {isEmptyDay ? (
            <Animated.View entering={FadeInDown.delay(400)} style={styles.hint} pointerEvents="none">
              <T weight="xbold" style={styles.hintText}>
                {t('Tap a care below to color {name} in', { name: pet.name })}
              </T>
            </Animated.View>
          ) : null}
          {complete ? (
            <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(300).springify().damping(15)} style={styles.celebrateWrap}>
              <Bouncy onPress={() => router.push('/summary')} accessibilityRole="button" accessibilityLabel={t('Celebrate my day!')} style={styles.celebrate} testID="celebrate-day">
                <View style={styles.poster}>
                  <PetAvatar species={pet.species} size={40} mood="party" />
                </View>
                <T weight="black" style={styles.celebrateText}>
                  {t('Celebrate my day!')}
                </T>
              </Bouncy>
            </Animated.View>
          ) : null}
        </View>

        {liveWalk ? (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <Bouncy scaleTo={0.97} onPress={() => router.push('/walk')} accessibilityRole="button" accessibilityLabel={t('Walk in progress. Open it')} style={styles.walkLive} testID="home-walk-live">
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 15 }}>
                {liveWalk.status === 'paused' ? t('🐾 Walk paused · tap to continue') : t('🐾 Walk in progress · started {time}', { time: formatClock(liveWalk.startedAt) })}
              </T>
            </Bouncy>
          </Animated.View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ flexGrow: 0 }}>
          <RowItem
            width={itemW}
            label={pet.name}
            onPress={() => router.push('/studio')}
            accessibilityLabel={t("Open {name}'s look", { name: pet.name })}
            icon={
              <View style={styles.avatarBubble}>
                <PetAvatar species={pet.species} appearance={pet.appearance} size={58} />
              </View>
            }
            badge={<View style={[styles.plus, { backgroundColor: '#D6DAE0' }]}><Icon name="more" size={12} color="#FFFFFF" /></View>}
          />
          {row.map((ct) => (
            <RowItem
              key={ct}
              width={itemW}
              label={CARE[ct].label}
              color={CARE[ct].color}
              count={progress.counts[ct] ?? 0}
              onPress={(origin) =>
                // dogs' walks are timed Adventures; the log card stays one tap away from there
                ct === 'walk' && pet.species === 'dog' ? router.push('/walk') : router.push({ pathname: '/log/[type]', params: { type: ct, day: todayKey, ...origin } })
              }
              accessibilityLabel={t('Log {label}', { label: CARE[ct].label })}
              icon={<FillArt source={ART.care[ct]!} size={66} level={careFill(ct, plan, portions, events)} />}
              splashKey={splash?.type === ct ? splash.key : null}
              testID={`quick-${ct}`}
            />
          ))}
          <RowItem
            width={itemW}
            label={t('Add or edit')}
            onPress={() => router.push('/plan')}
            accessibilityLabel={t("{name}'s daily plan", { name: pet.name })}
            icon={
              <View style={styles.addBubble}>
                <View style={styles.addDot}>
                  <Icon name="plus" size={18} color="#FFFFFF" />
                </View>
              </View>
            }
          />
        </ScrollView>

        <Bouncy
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={next ? t('Log {label}', { label: next.title }) : t("Open today's care timeline")}
          onPress={() => {
            // the next care opens its own log card straight away (and ticks that routine when saved)
            if (next && isCareType(next.type)) {
              if (next.type === 'walk' && pet.species === 'dog') return router.push('/walk');
              return router.push({ pathname: '/log/[type]', params: { type: next.type, day: todayKey, scheduleId: next.scheduleId, occ: next.key } });
            }
            return occ.length ? router.push('/care') : router.push({ pathname: '/day', params: { day: todayKey } });
          }}
          style={[styles.peek, { backgroundColor: occ.length ? '#FFE3E8' : '#E3F6F8' }]}
          testID="home-peek"
        >
          <View style={[styles.peekChip, { backgroundColor: occ.length ? '#FFC9D4' : '#C2ECEF' }]}>
            <T weight="black" style={{ fontSize: 15, color: occ.length ? '#D6336C' : colors.brand }}>
              {occ.length ? `${doneOcc}/${occ.length}` : String(events.length)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="black" style={[styles.peekTitle, { color: occ.length ? '#D6336C' : colors.brand }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
              {next ? next.title : occ.length ? t('All done for today') : t("Today's care")}
              {next && isCareType(next.type) && CARE[next.type].amount && portions[next.type] ? ` · ${formatAmount(next.type, portions[next.type]!)}` : ''}
            </T>
            {next ? (
              <T weight="xbold" style={styles.peekMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                {t('Next up')} · {formatTime24to12(next.time)}
              </T>
            ) : null}
          </View>
          <Sticker name={next ? careSticker(next.type, pet.species) : occ.length ? moodSticker(pet.species, 'party') : moodSticker(pet.species, 'happy')} size={58} style={{ marginVertical: -10 }} />
          <Icon name="chevR" size={18} color={occ.length ? '#E8879E' : '#7FD3DA'} />
        </Bouncy>
      </View>
      <HomeFeed width={W} />
      </ScrollView>

      <ConfettiRain fireKey={cheer} />

      {scrolled ? <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} pointerEvents="none" style={[styles.headerBg, { height: insets.top + 70 }]} /> : null}
      <View pointerEvents="box-none" style={[styles.topRow, styles.floating, { top: insets.top + 6, width: W }]}>
        <CircleButton
          label={t('{n}-day streak. Open your summary', { n: streak.current })}
          onPress={() => router.push('/summary')}
          size={54}
          style={{ backgroundColor: 'transparent' }}
          testID="streak-circle"
        >
          <Ring size={58} stroke={4} value={progress.ratio} color="#7BDCE3" track="transparent">
            <View style={styles.streakDisc}>
              {complete ? (
                <Icon name="check" size={22} color="#FFFFFF" />
              ) : (
                <T weight="black" style={{ fontSize: 19, color: '#FFFFFF' }}>
                  {streak.current}
                </T>
              )}
            </View>
          </Ring>
        </CircleButton>
        {scrolled ? (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Back to {name}', { name: pet.name })} onPress={() => scroller.current?.scrollTo({ y: 0, animated: true })} style={styles.backPill}>
              <PetAvatar species={pet.species} appearance={pet.appearance} size={30} />
              <T weight="black" style={{ fontSize: 15 }}>
                {big}
              </T>
            </Pressable>
          </Animated.View>
        ) : null}
        <CircleButton icon="menu" label={t('Explore')} onPress={() => router.push('/explore')} size={54} testID="menu" />
      </View>

      <AddFab bottom={insets.bottom + 14} hidden={!!snack} />
      <ProMomentHost focused={focused} />

      {snack ? (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={[styles.snack, { bottom: insets.bottom + 14 }]}>
          <T weight="xbold" style={styles.snackText}>
            {t('{label} saved', { label: CARE[snack.type].label })}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Undo')} onPress={undo} hitSlop={10} testID="undo">
            <T weight="black" style={styles.snackUndo}>
              {t('UNDO')}
            </T>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The jelly "+" (Clucky's add button): tapping it floods the screen with brand colour from the button,
 * and the New reminder screen splits that colour into its two pills.
 */
function AddFab({ bottom, hidden }: { bottom: number; hidden: boolean }) {
  const { width, height } = useWindowDimensions();
  const grow = useSharedValue(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) grow.value = 0;
  }, [focused, grow]);
  const reach = Math.hypot(width, height) / 30;
  const flood = useAnimatedStyle(() => ({ opacity: grow.value > 0 ? 1 : 0, transform: [{ scale: 1 + grow.value * reach }] }));
  const open = () => {
    popFeedback();
    if (motionReduced()) return router.push('/add');
    grow.value = withTiming(1, { duration: 260, easing: Easing.in(Easing.quad) });
    setTimeout(() => router.push('/add'), 230);
  };
  return (
    <>
      {/* a soft white fade so the button floats over the feed without text running under it */}
      <Svg pointerEvents="none" width={width} height={bottom + 90} style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="fabFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.92" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={bottom + 90} fill="url(#fabFade)" />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.flood, { bottom: bottom + 4 }, flood]} />
      {hidden ? null : (
        <Animated.View entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)} style={[styles.fab, { bottom }]}>
          <JellyPill width={68} height={68} color={colors.brand} idle={1.2} onPress={open} accessibilityLabel={t('New reminder')} testID="add-fab">
            <Icon name="plus" size={30} color="#FFFFFF" />
          </JellyPill>
        </Animated.View>
      )}
    </>
  );
}

type Origin = { ox: string; oy: string; os: string };

function RowItem({
  label,
  icon,
  color,
  count,
  onPress,
  accessibilityLabel,
  splashKey = null,
  width,
  badge,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  color?: string;
  count?: number;
  /** receives the icon's on-screen centre so the next screen can grow out of it */
  onPress: (origin: Origin | undefined) => void;
  accessibilityLabel: string;
  splashKey?: number | null;
  width: number;
  badge?: React.ReactNode;
  testID?: string;
}) {
  const press = usePress(0.9);
  const iconRef = useRef<React.ComponentRef<typeof View>>(null);
  const go = () => {
    tapFeedback();
    const node = iconRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return onPress(undefined);
    let done = false;
    const fire = (origin?: Origin) => {
      if (done) return;
      done = true;
      onPress(origin);
    };
    node.measureInWindow((x: number, y: number, w: number, h: number) => fire({ ox: String(Math.round(x + w / 2)), oy: String(Math.round(y + h / 2)), os: String(Math.round(w)) }));
    setTimeout(() => fire(undefined), 60); // measurement never answered (shouldn't happen): open anyway
  };
  return (
    <APressable {...press.handlers} testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={go} style={[styles.item, { width }, press.style]}>
      <View ref={iconRef} collapsable={false}>
        {icon}
        {color ? (
          <View style={[styles.plus, { backgroundColor: color }]}>
            <Icon name="plus" size={14} color="#FFFFFF" />
          </View>
        ) : (
          badge ?? null
        )}
        {count ? (
          <Pop trigger={count} amount={0.5} style={[styles.count, { borderColor: color }]}>
            <T weight="black" style={{ fontSize: 11, color }}>
              {count}
            </T>
          </Pop>
        ) : null}
        {color ? <Splash fireKey={splashKey} color={color} /> : null}
      </View>
      <T weight="black" style={styles.itemLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {label.toUpperCase()}
      </T>
    </APressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 4 },
  floating: { position: 'absolute', alignSelf: 'center' },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.96)' },
  walkLive: { backgroundColor: '#14B8C4', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  backPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', ...(softShadow as object) },
  streakDisc: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginTop: -8 },
  big: { fontSize: 60, lineHeight: 68, color: colors.brand, letterSpacing: -1 },
  cheer: { fontSize: 40, lineHeight: 50, color: colors.brand, letterSpacing: -0.5, textAlign: 'center', paddingHorizontal: 16 },
  subtitle: { fontSize: 17, color: colors.muted },
  dropChip: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 6, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  hintText: { color: '#FFFFFF', fontSize: 14 },
  celebrateWrap: { alignSelf: 'center', marginTop: -6, marginBottom: 6 },
  celebrate: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, height: 62, borderRadius: 31, paddingLeft: 10, paddingRight: 26 },
  poster: { width: 44, height: 54, borderRadius: 8, backgroundColor: '#E8F7FA', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], marginTop: -18, overflow: 'hidden' },
  celebrateText: { color: '#FFFFFF', fontSize: 17, lineHeight: 20 },
  row: { paddingHorizontal: 8, marginBottom: 14 },
  item: { alignItems: 'center' },
  itemLabel: { fontSize: 11, letterSpacing: 1.2, color: colors.faint, marginTop: 6, fontFamily: font.black, textAlign: 'center' },
  avatarBubble: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF4E3', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  addBubble: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  addDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', bottom: -4, alignSelf: 'center', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#FFFFFF' },
  count: { position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  peek: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 18, paddingVertical: 16, marginHorizontal: 18, marginBottom: 6, minHeight: 72 },
  peekChip: { minWidth: 54, height: 40, borderRadius: 20, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  peekTitle: { fontSize: 19 },
  peekMeta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  fab: { position: 'absolute', alignSelf: 'center' },
  flood: { position: 'absolute', alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand },
  snack: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: colors.ink, paddingHorizontal: 22, height: 52, borderRadius: 26 },
  snackText: { color: '#FFFFFF', fontSize: 16 },
  snackUndo: { color: '#7FE3EA', fontSize: 15, letterSpacing: 1.2 },
});
