import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { PetRig, PetClipName } from '../../animation/PetRig';
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

export default function Home() {
  const { pet, ready } = useApp();
  if (ready && !pet) return <Redirect href="/onboarding" />;
  if (!pet) return null;
  return <HomeScreen />;
}

function useTodayKey() {
  const [key, setKey] = useState(() => dayKeyOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => {
      const k = dayKeyOf(new Date());
      setKey((prev) => (prev === k ? prev : k));
    }, 30_000);
    return () => clearInterval(t);
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
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (pet?.species === 'dog' && !reduceMotion) {
        // each care plays its own generated clip; anything without one gets the happy jump
        const CLIP_FOR: Partial<Record<CareType, 'eat' | 'drink' | 'walk' | 'play' | 'groom'>> = {
          meal: 'eat',
          water: 'drink',
          walk: 'walk',
          play: 'play',
          grooming: 'groom',
        };
        const name = CLIP_FOR[type] ?? 'celebrate';
        setClip({ name, nonce: Date.now() });
        if (name === 'celebrate') setTimeout(confetti, 600);
        else setTimeout(() => fire('hearts', ['#FF6B9A', '#FF8FA3', '#FFB3C4']), 400);
      } else {
        confetti();
      }
      successFeedback();
    }, 380);
    setSnack({ eventId, type });
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 6000);
  }, [logged, focused, clearLogged, fire, pet?.species, reduceMotion]);

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
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={[styles.col, { width: W }]}>
        <View style={styles.topRow}>
          <CircleButton label={`Today, ${Math.round(progress.ratio * 100)} percent colored in. Open today's care`} onPress={() => router.push({ pathname: '/day', params: { day: todayKey } })} size={54}>
            <DayRing ratio={progress.ratio} day={new Date().getDate()} />
          </CircleButton>
          <CircleButton icon="menu" label="Settings" onPress={() => router.push('/settings')} size={54} />
        </View>

        <View style={styles.header}>
          <Label style={{ marginBottom: 2 }}>{pet.name}'s day</Label>
          <T weight="black" style={styles.big} accessibilityRole="header">
            {big}
          </T>
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
            accessibilityLabel={`${pet.name}, ${Math.round(progress.ratio * 100)} percent colored in today`}
          />
          {isEmptyDay ? (
            <Animated.View entering={FadeInDown.delay(400)} style={styles.hint} pointerEvents="none">
              <T weight="xbold" style={styles.hintText}>
                Tap a care below to color {pet.name} in
              </T>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.row}>
          <RowItem
            label={pet.name}
            onPress={() => router.push('/studio')}
            accessibilityLabel={`Open ${pet.name}'s look`}
            icon={
              <View style={styles.avatarBubble}>
                <PetAvatar species={pet.species} appearance={pet.appearance} size={58} />
              </View>
            }
          />
          {row.map((t) => (
            <RowItem
              key={t}
              label={CARE[t].label}
              color={CARE[t].color}
              count={progress.counts[t] ?? 0}
              onPress={() => router.push({ pathname: '/log/[type]', params: { type: t, day: todayKey } })}
              accessibilityLabel={`Log ${CARE[t].label}`}
              icon={<CareIcon type={t} size={62} />}
              testID={`quick-${t}`}
            />
          ))}
        </View>

        <View style={[styles.peek, softShadow]}>
          {next ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: -2 }}>
                <Label style={{ flex: 1 }}>Next up</Label>
                <Pressable accessibilityRole="button" accessibilityLabel="Open care schedule" onPress={() => router.navigate('/care')} hitSlop={8}>
                  <T weight="xbold" style={styles.peekLink}>
                    {openCount > 1 ? `${openCount - 1} more today` : 'Schedule'}
                  </T>
                </Pressable>
              </View>
              <OccurrenceRow o={next} db={db} species={pet.species} bump={bump} compact />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open today's care timeline"
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
                    {events.length} today
                  </T>
                </>
              ) : (
                <>
                  <T weight="xbold" style={[styles.peekTitle, { color: colors.brand }]}>
                    Today's care
                  </T>
                  <View style={{ flex: 1 }} />
                  <T style={styles.peekMeta}>{occ.length ? 'All done for today' : 'Nothing logged yet'}</T>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {snack ? (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={[styles.snack, { bottom: 14 }]}>
          <T weight="xbold" style={styles.snackText}>
            {CARE[snack.type].label} saved
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={undo} hitSlop={10} testID="undo">
            <T weight="black" style={styles.snackUndo}>
              UNDO
            </T>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

function RowItem({
  label,
  icon,
  color,
  count,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  color?: string;
  count?: number;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.item, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <View>
        {icon}
        {color ? (
          <View style={[styles.plus, { backgroundColor: color }]}>
            <Icon name="plus" size={14} color="#FFFFFF" />
          </View>
        ) : null}
        {count ? (
          <View style={[styles.count, { borderColor: color }]}>
            <T weight="black" style={{ fontSize: 11, color }}>
              {count}
            </T>
          </View>
        ) : null}
      </View>
      <T weight="black" style={styles.itemLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </T>
    </Pressable>
  );
}

function DayRing({ ratio, day }: { ratio: number; day: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={54} height={54} style={StyleSheet.absoluteFill}>
        <Circle cx={27} cy={27} r={r} stroke={colors.line} strokeWidth={4} fill="none" />
        <Circle
          cx={27}
          cy={27}
          r={r}
          stroke={colors.brand}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${c * Math.max(0.001, ratio)} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 27 27)"
        />
      </Svg>
      <T weight="black" style={{ fontSize: 18, color: colors.brand }}>
        {day}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 },
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

