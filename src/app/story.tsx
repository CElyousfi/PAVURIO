import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { PetAvatar } from '../animation/PetAvatar';
import { listAppointments, listMeasurements } from '../data/careRepo';
import { listMemories } from '../data/recordsRepo';
import { listEventsBetween } from '../data/repo';
import { CARE, CareType } from '../domain/care';
import { StoryInput, StoryRange, StorySlide, buildStory, storyWindow } from '../domain/stories';
import { dayKeyOf } from '../domain/time';
import { toUnit } from '../features/weight';
import { useApp } from '../state/AppState';
import { CareIcon } from '../ui/CareIcon';
import { Sheet, Toggle } from '../ui/forms';
import { CircleButton, Pill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { tapFeedback } from '../native/haptics';
import { t, tn } from '../i18n';

const SLIDE_MS = 5000;
/** singular / plural nouns for the totals slide (English: the lowercase label + "s") */
const COUNT_NOUN: Record<CareType, (n: number) => string> = {
  meal: (n) => tn(n, 'meal', 'meals'),
  walk: (n) => tn(n, 'walk', 'walks'),
  water: (n) => tn(n, 'water', 'waters'),
  play: (n) => tn(n, 'play', 'plays'),
  grooming: (n) => tn(n, 'grooming', 'groomings'),
  litter: (n) => tn(n, 'litter', 'litters'),
};
const DARK = new Set<StorySlide['kind']>(['cover', 'streak', 'photo', 'outro']);
const BG: Record<StorySlide['kind'], string> = {
  cover: '#14B8C4',
  totals: '#FFF4E3',
  streak: '#23304A',
  top: '#E6F7DA',
  photo: '#111827',
  weight: '#DDF3FE',
  visits: '#EEE8FE',
  outro: '#FF6B9A',
};

export default function StoryPlayer() {
  const params = useLocalSearchParams<{ range?: string }>();
  const range: StoryRange = params.range === 'month' ? 'month' : 'week';
  const { pet, db, plan, settings, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [input, setInput] = useState<StoryInput | null>(null);
  const [showName, setShowName] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const frame = useRef<React.ComponentRef<typeof View>>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!pet) return;
    const today = dayKeyOf(new Date());
    const w = storyWindow(range, today);
    const [y, m, d] = w.from.split('-').map(Number);
    const from = new Date(y, m - 1, d).getTime();
    const to = Date.now() + 1;
    Promise.all([listEventsBetween(db, pet.id, from, to), listMemories(db, pet.id), listMeasurements(db, pet.id), listAppointments(db, pet.id, from, to)]).then(([ev, mem, ws, ap]) =>
      setInput({
        petName: pet.name,
        range,
        endDay: today,
        plan,
        events: ev.map((e) => ({ type: e.type, occurredAt: e.occurredAt, amount: e.amount })),
        photos: mem.filter((x) => x.photoUri).map((x) => ({ uri: x.photoUri!, title: x.title, caption: x.caption, date: x.date })),
        weights: ws.map((x) => ({ at: x.at, value: Math.round(toUnit(x, settings.weightUnit) * 10) / 10 })),
        weightUnit: settings.weightUnit,
        visits: ap.filter((a) => a.doneAt || a.at <= Date.now()).map((a) => ({ title: a.title, at: a.at })),
      }),
    );
  }, [db, pet, plan, range, settings.weightUnit]);

  const slides = useMemo(() => (input ? buildStory({ ...input, petName: showName ? input.petName : t('My buddy') }) : null), [input, showName]);
  const count = slides?.length ?? 0;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const n = i + delta;
        if (n >= count) {
          router.back();
          return i;
        }
        return Math.max(0, n);
      });
    },
    [count],
  );

  // auto-advance with a progress bar; pauses while held or while the share sheet is open
  useEffect(() => {
    if (!count) return;
    cancelAnimation(progress);
    progress.value = 0;
    if (paused || shareOpen) return;
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.linear }, (done) => {
      if (done) runOnJS(go)(1);
    });
  }, [index, count, paused, shareOpen, go, progress]);

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!pet) return null;
  const fw = Math.min(width - 24, (height - insets.top - insets.bottom - 120) * (9 / 16), 460);
  const fh = fw * (16 / 9);

  const capture = async (): Promise<string> =>
    captureRef(frame as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });

  const share = async () => {
    setBusy('share');
    try {
      const uri = await capture();
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `${pet.name}-${range}-story-${index + 1}.png`;
        a.click();
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t("{name}'s story", { name: pet.name }) });
      }
    } catch (e) {
      console.warn('[pavurio] story share failed', e);
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (Platform.OS === 'web') return share();
    setBusy('save');
    try {
      const MediaLibrary = await import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return;
      await MediaLibrary.saveToLibraryAsync(await capture());
    } catch (e) {
      console.warn('[pavurio] story save failed', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.topBar}>
        <CircleButton icon="close" label={t('Close story')} onPress={() => router.back()} size={44} />
        <View style={{ flex: 1 }} />
        {slides ? <Pill label={t('SHARE')} onPress={() => setShareOpen(true)} style={{ height: 44, paddingHorizontal: 22, minWidth: 0 }} color={colors.brand} testID="story-share" /> : null}
      </View>

      {!slides ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <T weight="black" style={{ color: '#FFFFFF', fontSize: 20, textAlign: 'center' }}>
            {input ? t('Log a few more cares for {name} to make this story.', { name: pet.name }) : ' '}
          </T>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={[styles.bars, { width: fw }]}>
            {slides.map((_, i) => (
              <View key={i} style={styles.barTrack}>
                {i < index ? <View style={[styles.barFill, { width: '100%' }]} /> : i === index ? <Animated.View style={[styles.barFill, bar]} /> : null}
              </View>
            ))}
          </View>
          <View ref={frame} collapsable={false} style={[styles.frame, { width: fw, height: fh, backgroundColor: BG[slides[index].kind] }]}>
            <Animated.View key={`${index}-${showName}`} entering={reduceMotion ? undefined : FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
              <Slide slide={slides[index]} pet={pet} w={fw} h={fh} />
            </Animated.View>
            <T weight="black" style={[styles.brand, { color: DARK.has(slides[index].kind) ? '#FFFFFF' : colors.ink }]}>
              pavurio
            </T>
          </View>
          {/* tap zones: left third back, rest forward; hold to pause */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', top: 40 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Previous')} style={{ flex: 1 }} onPress={() => (tapFeedback(), go(-1))} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('Next')} style={{ flex: 2 }} onPress={() => (tapFeedback(), go(1))} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} testID="story-next" />
          </View>
        </View>
      )}

      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)} title={t('Share this slide')}>
        <T style={{ color: colors.muted, lineHeight: 20, marginBottom: 8 }}>
          {t("The image shows only what's on the slide: care counts, your photos and {name}'s look. No location, health records or notes are included.", { name: pet.name })}
        </T>
        <Toggle label={t("Show {name}'s name", { name: pet.name })} value={showName} onChange={setShowName} />
        <View style={{ gap: 8, marginTop: 14 }}>
          <Pill label={busy === 'share' ? t('PREPARING…') : Platform.OS === 'web' ? t('DOWNLOAD IMAGE') : t('SHARE')} onPress={share} loading={busy === 'share'} />
          {Platform.OS !== 'web' ? <Pill label={t('SAVE TO PHOTOS')} color={colors.brand} onPress={save} loading={busy === 'save'} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

function Slide({ slide, pet, w }: { slide: StorySlide; pet: NonNullable<ReturnType<typeof useApp>['pet']>; w: number; h: number }) {
  const big = w * 0.13;
  switch (slide.kind) {
    case 'cover':
      return (
        <View style={styles.center}>
          <View style={[styles.avatarRing, { width: w * 0.62, height: w * 0.62, borderRadius: w * 0.31 }]}>
            <PetAvatar species={pet.species} appearance={pet.appearance} size={w * 0.56} />
          </View>
          <T weight="black" style={{ color: '#FFFFFF', fontSize: big, textAlign: 'center', marginTop: 24 }}>
            {slide.title}
          </T>
          <T weight="xbold" style={{ color: '#FFFFFFC0', fontSize: w * 0.05, marginTop: 6 }}>
            {slide.subtitle}
          </T>
        </View>
      );
    case 'totals':
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1, alignItems: 'stretch' }]}>
          <T weight="black" style={{ fontSize: w * 0.075, marginBottom: 18, textAlign: 'center' }}>
            {t('All the care')}
          </T>
          {slide.items.slice(0, 5).map((it) => (
            <View key={it.type} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 7 }}>
              <CareIcon type={it.type} size={w * 0.14} />
              <View style={{ flex: 1 }}>
                <T weight="black" style={{ fontSize: w * 0.075, color: CARE[it.type].color }}>
                  {it.count}
                </T>
                <T weight="xbold" style={{ fontSize: w * 0.04, color: colors.inkSoft, marginTop: -4 }}>
                  {COUNT_NOUN[it.type](it.count)}
                  {it.minutes
                    ? ` · ${it.minutes >= 60 ? t('{h}h {m}m', { h: Math.floor(it.minutes / 60), m: it.minutes % 60 }) : t('{n} min', { n: it.minutes })}`
                    : ''}
                </T>
              </View>
            </View>
          ))}
        </View>
      );
    case 'streak':
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1 }]}>
          <T weight="black" style={{ color: colors.brand, fontSize: w * 0.3, lineHeight: w * 0.34 }}>
            {slide.fullDays > 0 ? slide.fullDays : slide.activeDays}
          </T>
          <T weight="black" style={{ color: '#FFFFFF', fontSize: w * 0.065, textAlign: 'center' }}>
            {slide.fullDays > 0
              ? tn(slide.fullDays, 'day fully colored in', 'days fully colored in')
              : tn(slide.activeDays, 'day with care logged', 'days with care logged')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 22, maxWidth: w * 0.8 }}>
            {Array.from({ length: slide.totalDays }).map((_, i) => (
              <View key={i} style={{ width: w * 0.06, height: w * 0.06, borderRadius: w * 0.03, backgroundColor: i < slide.activeDays ? colors.brand : '#FFFFFF22' }} />
            ))}
          </View>
          <T style={{ color: '#FFFFFF99', fontSize: w * 0.038, marginTop: 14, textAlign: 'center' }}>
            {t('{n} of {total} days with care logged', { n: slide.activeDays, total: slide.totalDays })}
          </T>
        </View>
      );
    case 'top':
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1 }]}>
          <CareIcon type={slide.type} size={w * 0.5} />
          <T weight="black" style={{ fontSize: w * 0.075, textAlign: 'center', marginTop: 18, color: colors.ink }}>
            {slide.line}
          </T>
        </View>
      );
    case 'photo':
      return (
        <View style={{ flex: 1 }}>
          <Image source={{ uri: slide.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[styles.photoFoot, { padding: w * 0.07 }]}>
            <T weight="black" style={{ color: '#FFFFFF', fontSize: w * 0.07 }}>
              {slide.title}
            </T>
            {slide.caption ? <T style={{ color: '#FFFFFFD8', fontSize: w * 0.042, marginTop: 4 }}>{slide.caption}</T> : null}
          </View>
        </View>
      );
    case 'weight': {
      const d = Math.round((slide.to - slide.from) * 10) / 10;
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1 }]}>
          <T weight="xbold" style={{ fontSize: w * 0.045, color: colors.inkSoft }}>
            {t('Weigh-ins')}
          </T>
          <T weight="black" style={{ fontSize: w * 0.18, color: '#1CB0F6' }}>
            {slide.to.toFixed(1)}
          </T>
          <T weight="black" style={{ fontSize: w * 0.06, color: colors.ink, marginTop: -6 }}>
            {slide.unit}
          </T>
          <T style={{ fontSize: w * 0.042, color: colors.inkSoft, marginTop: 12 }}>
            {d === 0 ? t('Steady as can be') : t('{delta} since {from}', { delta: `${d > 0 ? '+' : '−'}${Math.abs(d)} ${slide.unit}`, from: slide.from.toFixed(1) })}
          </T>
        </View>
      );
    }
    case 'visits':
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1 }]}>
          <T weight="black" style={{ fontSize: w * 0.075, color: '#6D4FD8', marginBottom: 14 }}>
            {t('Visits')}
          </T>
          {slide.titles.map((title, i) => (
            <T key={i} weight="xbold" style={{ fontSize: w * 0.05, color: colors.ink, marginVertical: 3, textAlign: 'center' }}>
              ✓ {title}
            </T>
          ))}
        </View>
      );
    case 'outro':
      return (
        <View style={[styles.center, { paddingHorizontal: w * 0.1 }]}>
          <PetAvatar species={pet.species} appearance={pet.appearance} size={w * 0.5} />
          <T weight="black" style={{ color: '#FFFFFF', fontSize: w * 0.075, textAlign: 'center', marginTop: 20, lineHeight: w * 0.095 }}>
            {slide.line}
          </T>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1320' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 8, zIndex: 3 },
  bars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  barTrack: { flex: 1, height: 3.5, borderRadius: 2, backgroundColor: '#FFFFFF33', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  frame: { borderRadius: 26, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)' },
  brand: { position: 'absolute', bottom: 14, alignSelf: 'center', color: '#FFFFFF', opacity: 0.55, fontSize: 13, letterSpacing: 2 },
});
