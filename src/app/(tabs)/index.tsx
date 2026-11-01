import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../../animation/PetRig';
import { catClip } from '../../animation/CatStage';
import { useBursts } from '../../animation/Burst';
import { PetAvatar } from '../../animation/PetAvatar';
import { CARE, CareType, HOME_ROW_SIZE, SPECIES_CARE, formatAmount } from '../../domain/care';
import { progressSentence } from '../../domain/progress';
import { dayKeyOf, formatClock } from '../../domain/time';
import { voidEvent } from '../../data/repo';
import { useApp, useDay, useOccurrences } from '../../state/AppState';
import { OccurrenceRow } from '../../features/routines';
import { nextUp } from '../../domain/schedule';
import { CircleButton, Icon, Label, T } from '../../ui/primitives';
import { CareIcon } from '../../ui/CareIcon';
import { colors, font, radius, softShadow } from '../../ui/theme';
import { petFeedback, successFeedback, tapFeedback } from '../../native/haptics';
import { t } from '../../i18n';
import { CountUp, Pop, Ring, Splash, usePress } from '../../ui/motion';
import { HomeFeed } from '../../features/HomeFeed';

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
  const { pet, db, bump, reduceMotion, logged, clearLogged } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const focused = useIsFocused();
  const todayKey = useTodayKey();
  const { events, progress, loading } = useDay(todayKey);
  const occ = useOccurrences(todayKey);
  const next = nextUp(occ);
  const openCount = occ.filter((o) => o.status !== 'done' && o.status !== 'skipped').length;
  const { bursts, fire } = useBursts(!reduceMotion);
  const [snack, setSnack] = useState<{ eventId: string; type: CareType } | null>(null);
  // droplets over the care icon that was just logged (the Waterllama "sip")
  const [splash, setSplash] = useState<{ type: CareType; key: number } | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const night = useNight();
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
        // each care plays its own generated clip; anything without one gets the happy jump
        const CLIP_FOR: Partial<Record<CareType, PetClipName>> = {
          meal: 'eat',
          water: 'drink',
          walk: 'walk',
          play: 'play',
          grooming: 'groom',
          litter: 'litter',
        };
        const name = CLIP_FOR[type] ?? 'celebrate';
        setClip({ name, nonce: Date.now() });
        const played = pet.species === 'cat' ? catClip(name) : name;
        if (played === 'celebrate') setTimeout(confetti, 600);
        else setTimeout(() => fire('hearts', ['#FF6B9A', '#FF8FA3', '#FFB3C4']), 400);
      } else {
        confetti();
      }
      successFeedback();
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
    await voidEvent(db, id);
    bump();
    tapFeedback();
  }, [snack, db, bump]);

  if (!pet) return null;
  const row = SPECIES_CARE[pet.species].slice(0, HOME_ROW_SIZE);
  const petSize = Math.min(W * 0.78, height * 0.4, 360);
  const last = events[0];
  const isEmptyDay = !loading && events.length === 0;
  const big = progress.planned > 0 ? `${progress.done}/${progress.planned}` : String(events.length);

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
      <View style={[styles.col, { width: W, height: vh || height, paddingTop: insets.top + 64 }]}>

        <View style={styles.header} accessibilityRole="header" accessibilityLabel={`${big} · ${progressSentence(progress)}`}>
          <Label style={{ marginBottom: 2 }}>{t("{name}'s day", { name: pet.name })}</Label>
          <Pop trigger={progress.planned > 0 ? progress.done : events.length} amount={0.12} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp value={progress.planned > 0 ? progress.done : events.length} style={styles.big} />
            {progress.planned > 0 ? (
              <T weight="black" style={styles.big}>
                /{progress.planned}
              </T>
            ) : null}
          </Pop>
          <T style={styles.subtitle}>{progressSentence(progress)}</T>
        </View>

        <View style={styles.stage}>
          <PetRig
            species={pet.species}
            appearance={pet.appearance}
            size={petSize}
            progress={progress.planned > 0 ? progress.ratio : events.length > 0 ? 1 : 0}
           
            interactive
            onTap={() => {
              petFeedback();
              fire('hearts', ['#FF6B9A', '#FF8FA3', '#FFB3C4']);
            }}
            rug={{ bands: progress.bands, planned: progress.planned }}
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
        </View>

        <View style={styles.row}>
          <RowItem
            label={pet.name}
            onPress={() => router.push('/studio')}
            accessibilityLabel={t("Open {name}'s look", { name: pet.name })}
            icon={
              <View style={styles.avatarBubble}>
                <PetAvatar species={pet.species} appearance={pet.appearance} size={58} />
              </View>
            }
          />
          {row.map((ct) => (
            <RowItem
              key={ct}
              label={CARE[ct].label}
              color={CARE[ct].color}
              count={progress.counts[ct] ?? 0}
              onPress={(origin) => router.push({ pathname: '/log/[type]', params: { type: ct, day: todayKey, ...origin } })}
              accessibilityLabel={t('Log {label}', { label: CARE[ct].label })}
              icon={<CareIcon type={ct} size={62} />}
              splashKey={splash?.type === ct ? splash.key : null}
              testID={`quick-${ct}`}
            />
          ))}
        </View>

        <View style={[styles.peek, softShadow]}>
          {next ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: -2 }}>
                <Label style={{ flex: 1 }}>{t('Next up')}</Label>
                <Pressable accessibilityRole="button" accessibilityLabel={t('Open care schedule')} onPress={() => router.navigate('/care')} hitSlop={8}>
                  <T weight="xbold" style={styles.peekLink}>
                    {openCount > 1 ? t('{n} more today', { n: openCount - 1 }) : t('Schedule')}
                  </T>
                </Pressable>
              </View>
              <OccurrenceRow o={next} db={db} species={pet.species} bump={bump} compact />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Open today's care timeline")}
              onPress={() => router.push({ pathname: '/day', params: { day: todayKey } })}
              style={styles.peekRow}
            >
              {last ? (
                <>
                  <CareIcon type={last.type} size={34} />
                  <T weight="xbold" style={[styles.peekTitle, { color: CARE[last.type].color }]}>
                    {CARE[last.type].label}
                  </T>
                  <T style={styles.peekMeta}>
                    {formatAmount(last.type, last.amount)} · {formatClock(last.occurredAt)}
                  </T>
                  <View style={{ flex: 1 }} />
                  <T weight="xbold" style={styles.peekLink}>
                    {t('{n} today', { n: events.length })}
                  </T>
                </>
              ) : (
                <>
                  <T weight="xbold" style={[styles.peekTitle, { color: colors.brand }]}>
                    {t("Today's care")}
                  </T>
                  <View style={{ flex: 1 }} />
                  <T style={styles.peekMeta}>{occ.length ? t('All done for today') : t('Nothing logged yet')}</T>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
      <HomeFeed width={W} />
      </ScrollView>

      {scrolled ? <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} pointerEvents="none" style={[styles.headerBg, { height: insets.top + 70 }]} /> : null}
      <View pointerEvents="box-none" style={[styles.topRow, styles.floating, { top: insets.top + 6, width: W }]}>
        <CircleButton label={t("Today, {pct} percent colored in. Open your summary", { pct: Math.round(progress.ratio * 100) })} onPress={() => router.push('/summary')} size={54}>
          <Ring size={54} stroke={4} value={progress.ratio}>
            <T weight="black" style={{ fontSize: 18, color: colors.brand }}>
              {new Date().getDate()}
            </T>
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
        <CircleButton icon="menu" label={t('Settings')} onPress={() => router.push('/settings')} size={54} />
      </View>

      {snack ? (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={[styles.snack, { bottom: 14 }]}>
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

type Origin = { ox: string; oy: string; os: string };

function RowItem({
  label,
  icon,
  color,
  count,
  onPress,
  accessibilityLabel,
  splashKey = null,
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
    <APressable {...press.handlers} testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={go} style={[styles.item, press.style]}>
      <View ref={iconRef} collapsable={false}>
        {icon}
        {color ? (
          <View style={[styles.plus, { backgroundColor: color }]}>
            <Icon name="plus" size={14} color="#FFFFFF" />
          </View>
        ) : null}
        {count ? (
          <Pop trigger={count} amount={0.5} style={[styles.count, { borderColor: color }]}>
            <T weight="black" style={{ fontSize: 11, color }}>
              {count}
            </T>
          </Pop>
        ) : null}
        {color ? <Splash fireKey={splashKey} color={color} /> : null}
      </View>
      <T weight="black" style={styles.itemLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label.toUpperCase()}
      </T>
    </APressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
  floating: { position: 'absolute', alignSelf: 'center' },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 1, borderBottomColor: colors.line },
  backPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.line },
  header: { alignItems: 'center', marginTop: -6 },
  big: { fontSize: 64, lineHeight: 72, color: colors.brand, letterSpacing: -1 },
  subtitle: { fontSize: 17, color: colors.muted, marginTop: -2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 6, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  hintText: { color: '#FFFFFF', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 14 },
  item: { alignItems: 'center', width: '20%' },
  itemLabel: { fontSize: 11, letterSpacing: 1.2, color: colors.muted, marginTop: 6, fontFamily: font.black },
  avatarBubble: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF4E3', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', bottom: -4, alignSelf: 'center', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#FFFFFF' },
  count: { position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  peek: { backgroundColor: colors.canvasWarm, borderRadius: radius.card - 6, paddingHorizontal: 18, paddingVertical: 12, marginHorizontal: 12, marginBottom: 10, minHeight: 62, justifyContent: 'center' },
  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  peekTitle: { fontSize: 18 },
  peekMeta: { fontSize: 15, color: colors.muted },
  peekLink: { fontSize: 14, color: colors.brand },
  snack: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: colors.ink, paddingHorizontal: 22, height: 52, borderRadius: 26 },
  snackText: { color: '#FFFFFF', fontSize: 16 },
  snackUndo: { color: '#7FE3EA', fontSize: 15, letterSpacing: 1.2 },
});

