/**
 * New reminder (Clucky's "+" clock, PAVURIO edition). The jelly "+" from Home swells into this screen and
 * splits into two pills around the arc clock:
 *  - the top pill holds what it's for; drag it down (or tap it) and the care grid comes down with it;
 *  - "At a time" / "In a while" swaps the wheels between a clock time and a duration;
 *  - the bottom jelly "+" saves, jiggles, and the pet's bubble confirms.
 */
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { createSchedule } from '../data/careRepo';
import { dayKeyOf } from '../domain/time';
import { formatTime24to12 } from '../domain/schedule';
import { KindIcon, kindMeta, routineKindsFor } from '../features/routines';
import { useApp } from '../state/AppState';
import { requestPermission } from '../native/notifications';
import { bumpFeedback, errorFeedback, successFeedback, tapFeedback, tickFeedback } from '../native/haptics';
import { ArcDurationPicker, ArcTimePicker } from '../ui/ArcTime';
import { JellyPill } from '../ui/Jelly';
import { Bouncy, motionReduced } from '../ui/motion';
import { CircleButton, Icon, T } from '../ui/primitives';
import { PetAvatar } from '../animation/PetAvatar';
import { colors } from '../ui/theme';
import { uses24h } from '../i18n/dates';
import { t } from '../i18n';
import { Segmented } from '../ui/Segmented';

const BG = '#F1F2F4';
const PILL_W = 150;
const PILL_H = 210;

/** next half hour from now, as "HH:MM" */
function nextSlot(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes() + 30;
  const r = Math.ceil(m / 30) * 30;
  return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function AddReminder() {
  const { pet, db, bump, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const kinds = pet ? routineKindsFor(pet.species) : [];
  const [type, setType] = useState<string>(kinds.includes('meal') ? 'meal' : kinds[0] ?? 'custom');
  const [mode, setMode] = useState<'at' | 'in'>('at');
  const [time, setTime] = useState(nextSlot);
  const [inMin, setInMin] = useState(60);
  const [daily, setDaily] = useState(true);
  const [poke, setPoke] = useState(0);
  const [topPoke, setTopPoke] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const saving = useRef(false);

  // ---- the two pills split out of the middle (where the "+" swelled)
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  React.useEffect(() => {
    if (!reduceMotion) enter.value = withSpring(1, { damping: 13, stiffness: 120, mass: 0.9 });
  }, [enter, reduceMotion]);
  const mid = height / 2;
  const topIn = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(enter.value, [0, 1], [mid - 60, 0]) }, { scale: interpolate(enter.value, [0, 1], [0.7, 1]) }] }));
  const botIn = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(enter.value, [0, 1], [-(mid - 60), 0]) }, { scale: interpolate(enter.value, [0, 1], [0.7, 1]) }] }));
  const flood = useAnimatedStyle(() => ({ opacity: interpolate(enter.value, [0, 0.6], [1, 0], 'clamp') }));

  // ---- the care grid hangs above the screen and follows the finger down
  const drop = useSharedValue(0); // 0 = hidden, 1 = open
  const [gridOpen, setGridOpen] = useState(false);
  const openGrid = (open: boolean) => {
    setGridOpen(open);
    drop.value = motionReduced() ? (open ? 1 : 0) : withSpring(open ? 1 : 0, { damping: 17, stiffness: 150 });
  };
  const pull = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => tickFeedback(),
        onPanResponderMove: (_e, g) => {
          drop.value = Math.max(0, Math.min(1, g.dy / (height * 0.7)));
        },
        onPanResponderRelease: (_e, g) => {
          const tap = Math.abs(g.dy) < 6;
          const open = tap || g.dy > 70 || g.vy > 0.6;
          setGridOpen(open);
          drop.value = withSpring(open ? 1 : 0, { damping: 17, stiffness: 150, velocity: g.vy });
          // the grid dropping open is a whoosh; snapping back is just a bump
          if (open) tapFeedback('open');
          else bumpFeedback();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height],
  );
  const gridStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(drop.value, [0, 1], [-height, 0]) }] }));
  const dim = useAnimatedStyle(() => ({ opacity: drop.value * 0.25 }));

  if (!pet) return null;
  const meta = kindMeta(type);
  const h24 = uses24h();
  const target = mode === 'in' ? new Date(Date.now() + inMin * 60_000) : null;
  const caption =
    mode === 'in'
      ? t('Reminds at {time}', { time: formatTime24to12(hm(target!)) })
      : daily
        ? t('Every day at {time}', { time: formatTime24to12(time) })
        : t('Just once, at {time}', { time: formatTime24to12(time) });

  const save = async () => {
    if (saving.current) return;
    if (mode === 'in' && inMin < 5) {
      errorFeedback();
      return;
    }
    saving.current = true;
    try {
      const at = mode === 'in' ? hm(new Date(Date.now() + inMin * 60_000)) : time;
      let day = dayKeyOf(mode === 'in' ? new Date(Date.now() + inMin * 60_000) : new Date());
      if (mode === 'at' && !daily) {
        // a one-off at a time that's already gone today means tomorrow
        const [hh, mm] = time.split(':').map(Number);
        const now = new Date();
        if (hh * 60 + mm <= now.getHours() * 60 + now.getMinutes()) day = dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      }
      const once = mode === 'in' || !daily;
      await createSchedule(db, {
        petId: pet.id,
        type,
        title: type === 'custom' ? t('Reminder') : meta.label,
        times: [at],
        remind: true,
        ...(once ? { startDate: day, endDate: day } : {}),
      });
      bump();
      successFeedback();
      setPoke((p) => p + 1);
      setSaved(t('Got it! I’ll nudge you at {time}.', { time: formatTime24to12(at) }));
      requestPermission(db).catch(() => null);
      setTimeout(() => router.back(), 1700);
    } catch {
      saving.current = false;
      errorFeedback();
    }
  };

  const tileW = (W - 20 * 2 - 12) / 2;

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <View style={[styles.col, { width: W }]}>
        {/* top pill: what it's for — pull it down */}
        <Animated.View style={[styles.topPill, topIn]} {...pull.panHandlers}>
          <JellyPill width={PILL_W} height={PILL_H} color={colors.brand} poke={topPoke} accessibilityLabel={t('What it’s for: {label}. Tap to change', { label: meta.label })} onPress={() => openGrid(true)} testID="add-kind">
            <View style={{ position: 'absolute', bottom: 22, alignItems: 'center', gap: 4 }}>
              <View style={styles.kindBubble}>
                <KindIcon type={type} size={42} />
              </View>
              <Svg width={18} height={10} viewBox="0 0 18 10">
                <Path d="M2 2 L9 8 L16 2" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          </JellyPill>
        </Animated.View>

        {/* mode toggle with a little tail, like a speech bubble */}
        <Animated.View entering={motionReduced() ? undefined : FadeInDown.delay(220).springify().damping(16)} style={[styles.toggleWrap, { top: insets.top + PILL_H - 40 }]}>
          <Segmented
            style={{ width: 290, backgroundColor: '#FFFFFF' }}
            height={40}
            value={mode}
            onChange={setMode}
            accent="#FFFFFF"
            thumbColor={colors.brand}
            options={[
              { key: 'at', label: `☀︎ ${t('At a time')}`, testID: 'add-mode-at' },
              { key: 'in', label: `⏳ ${t('In a while')}`, testID: 'add-mode-in' },
            ]}
          />
          <View style={styles.tail} />
        </Animated.View>

        {/* the clock */}
        <Animated.View entering={motionReduced() ? undefined : FadeIn.delay(160).duration(260)} style={styles.clock}>
          {mode === 'at' ? (
            <Animated.View key="at" entering={motionReduced() ? undefined : ZoomIn.springify().damping(16)}>
              <ArcTimePicker value={time} onChange={setTime} h24={h24} height={Math.min(320, height * 0.36)} />
            </Animated.View>
          ) : (
            <Animated.View key="in" entering={motionReduced() ? undefined : ZoomIn.springify().damping(16)}>
              <ArcDurationPicker minutes={inMin} onChange={setInMin} hourUnit={t('hr')} minUnit={t('min')} height={Math.min(320, height * 0.36)} />
            </Animated.View>
          )}
          <View style={{ alignItems: 'center', gap: 10, marginTop: 6 }}>
            <T weight="black" style={{ color: colors.muted, fontSize: 15 }} accessibilityLiveRegion="polite">
              {caption}
            </T>
            {mode === 'at' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[true, false].map((d) => (
                  <Bouncy key={String(d)} scaleTo={0.94} onPress={() => setDaily(d)} accessibilityRole="button" accessibilityState={{ selected: daily === d }} style={[styles.chip, daily === d && { backgroundColor: colors.ink }]}>
                    <T weight="black" style={{ fontSize: 13, color: daily === d ? '#FFFFFF' : colors.inkSoft }}>
                      {d ? t('Every day') : t('Just once')}
                    </T>
                  </Bouncy>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* bottom: play · jelly + · close */}
        <View style={[styles.bottom, { bottom: -64 }]} pointerEvents="box-none">
          <View style={{ width: 58 }} />
          <Animated.View style={botIn}>
            <JellyPill width={PILL_W} height={PILL_H} color={colors.brand} poke={poke} onPress={save} accessibilityLabel={t('Save reminder')} testID="add-save">
              <View style={{ position: 'absolute', top: 40 }}>
                {saved ? (
                  <Animated.View entering={ZoomIn.springify().damping(10)}>
                    <Icon name="check" size={40} color="#FFFFFF" />
                  </Animated.View>
                ) : (
                  <Icon name="plus" size={40} color="#FFFFFF" />
                )}
              </View>
            </JellyPill>
          </Animated.View>
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={58} style={{ marginBottom: 90 }} />
        </View>

      </View>

      {/* care grid, hanging above until it's pulled down */}
      <Animated.View pointerEvents={gridOpen ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, dim]} />
      <Animated.View style={[styles.grid, { paddingTop: insets.top + 10 }, gridStyle]} pointerEvents={gridOpen ? 'auto' : 'none'}>
        <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
          <View style={styles.gridHead}>
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 32, letterSpacing: -0.6 }}>
                {t('What’s it for?')}
              </T>
              <T weight="xbold" style={{ color: colors.muted, fontSize: 14 }}>
                {t('Tap one · it goes in the top pill')}
              </T>
            </View>
            <CircleButton icon="up" label={t('Close')} onPress={() => openGrid(false)} size={46} />
          </View>
          <ScrollView contentContainerStyle={styles.tiles} showsVerticalScrollIndicator={false}>
            {kinds.map((k, i) => {
              const sel = k === type;
              const km = kindMeta(k);
              return (
                <Animated.View key={k} entering={gridOpen && !motionReduced() ? FadeInDown.delay(i * 40).springify().damping(16) : undefined}>
                  <Bouncy
                    scaleTo={0.94}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={km.label}
                    onPress={() => {
                      setType(k);
                      setTopPoke((p) => p + 1);
                      openGrid(false);
                    }}
                    style={[styles.tile, { width: tileW, height: tileW * 0.92 }, sel && { borderColor: km.color }]}
                    testID={`kind-${k}`}
                  >
                    <T weight="black" style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {km.label}
                    </T>
                    <View style={styles.tileArt}>
                      <KindIcon type={k} size={tileW * 0.5} />
                    </View>
                    {sel ? (
                      <View style={[styles.tileCheck, { backgroundColor: km.color }]}>
                        <Icon name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Bouncy>
                </Animated.View>
              );
            })}
          </ScrollView>
          {/* a handle to push it back up */}
          <Pressable onPress={() => openGrid(false)} accessibilityRole="button" accessibilityLabel={t('Close')} style={[styles.handleArea, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.handle} />
          </Pressable>
        </View>
      </Animated.View>

  {/* the pet confirms in a bubble */}
      {saved ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOut} style={[styles.bubbleWrap, { bottom: 170 }]} pointerEvents="none">
          <PetAvatar species={pet.species} appearance={pet.appearance} size={40} />
          <View style={styles.bubble}>
            <T weight="black" style={{ fontSize: 15 }}>
              {saved}
            </T>
          </View>
        </Animated.View>
      ) : null}

      {/* the brand flood the "+" swelled into, fading to reveal the clock */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.brand }, flood]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  col: { flex: 1 },
  topPill: { position: 'absolute', top: -70, alignSelf: 'center' },
  kindBubble: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  toggleWrap: { position: 'absolute', alignSelf: 'center', alignItems: 'center', zIndex: 2 },
  toggle: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 4, gap: 2 },
  seg: { height: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tail: { width: 14, height: 14, backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }], marginTop: -8 },
  clock: { position: 'absolute', left: 0, right: 0, top: '30%' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24 },
  bubbleWrap: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 280, ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(35,48,74,0.12)' } as object) : { elevation: 4, shadowColor: '#23304A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }) },
  grid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: BG, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  gridHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingBottom: 20 },
  tile: { borderRadius: 28, backgroundColor: colors.ink, padding: 16, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden' },
  tileLabel: { color: '#FFFFFF', fontSize: 20 },
  tileArt: { position: 'absolute', right: -6, bottom: -6, width: '70%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center' },
  tileCheck: { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  handleArea: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 56, height: 6, borderRadius: 3, backgroundColor: colors.faint },
});
