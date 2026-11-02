/**
 * Pavurio Adventures — the walk. Three moments on one screen:
 *  1. Ready: today's weather where you walk, an honest tip, one big Start Walk.
 *  2. On an adventure: a big timer computed from stored timestamps (correct after locking the phone or
 *     closing the app), the dog walking along, Pause / Resume / Finish. Mirrored on the lock screen.
 *  3. Adventure complete: saved first (Daily Care, calendar, Moments, Paw Passport), then celebrated.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../animation/PetRig';
import { useApp } from '../state/AppState';
import { careAllowedFor } from '../domain/care';
import { WeatherSnapshot, formatTemp, placeOnlySnapshot, weatherArt, walkGreeting, conditionLabel, Place } from '../domain/weather';
import { AdventureBadgeId, LONG_WALK_MS, Walk, adventureBadge, clockText, durationText, elapsedMs, timeOfDay, timeOfDayLabel, walkEnd } from '../domain/walks';
import { discardWalk, finishWalk, getLiveWalk, getWalk, listWalks, pauseWalk, resumeWalk, setWalkWeather, startWalk, type FinishResult } from '../data/walkRepo';
import { currentWeather, getPlace, savePlace } from '../native/weather';
import { mirrorWalk, reconcileLockScreen } from '../features/walkSession';
import { confirmOccurrence } from '../features/careLink';
import { getEvent, ValidationError } from '../data/repo';
import { bumpCounter } from '../data/engageRepo';
import { PlacePicker, Stamp, TIME_ART, WEATHER_ART, WeatherCard } from '../features/adventures';
import { CircleButton, Pill, SoftPill, T } from '../ui/primitives';
import { ConfettiRain, Pulse } from '../ui/motion';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { confirmAsync } from '../ui/confirm';
import { ART } from '../ui/art';
import { t } from '../i18n';

const GREEN = '#14B8C4';

export default function WalkScreen() {
  const params = useLocalSearchParams<{ done?: string }>();
  const { pet, db, bump, schedules, signalLogged, markLogged, reduceMotion, settings } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const unit = settings.weightUnit === 'lb' ? 'F' : 'C';

  const [walk, setWalk] = useState<Walk | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [place, setPlaceState] = useState<Place | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<FinishResult | null>(null);
  const [count, setCount] = useState(0);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const [cheer, setCheer] = useState<number | null>(null);
  const finishing = useRef(false);

  // ---- load the walk in progress (or the one just finished), and pick up lock-screen presses
  const load = useCallback(async () => {
    if (!pet) return;
    if (params.done) {
      const w = await getWalk(db, params.done);
      if (w && w.status === 'completed') {
        setDone({ walk: w, newBadges: [] });
        setCount((await listWalks(db, pet.id)).length);
      }
    }
    let w = await getLiveWalk(db, pet.id);
    if (w && (w.status === 'active' || w.status === 'paused')) {
      const r = await reconcileLockScreen(db, w.id);
      if (r.finished) {
        await afterFinish(r.finished);
        w = null;
      } else w = r.walk;
    } else if (w && w.status === 'completing') {
      // the app closed mid-save: finish the job (idempotent)
      const r = await finishWalk(db, w.id);
      await afterFinish(r);
      w = null;
    }
    setWalk(w && (w.status === 'active' || w.status === 'paused') ? w : null);
    setNow(Date.now());
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, pet, params.done]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
      return () => sub.remove();
    }, [load]),
  );

  // ---- weather (cached 20 min by the provider module)
  const loadWeather = useCallback(
    async (force = false) => {
      setWeatherLoading(true);
      const p = await getPlace(db);
      setPlaceState(p);
      setWeather(p ? await currentWeather(db, { force }) : null);
      setWeatherLoading(false);
    },
    [db],
  );
  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  // ---- the clock on screen only *displays* time; the time itself comes from stored timestamps
  const running = walk?.status === 'active';
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);

  // the dog walks along while the walk runs
  useEffect(() => {
    if (done) return;
    if (running && !reduceMotion) setClip({ name: 'walk', nonce: Date.now() });
    else setClip(null);
  }, [running, reduceMotion, done]);

  // lock screen mirrors the walk
  useEffect(() => {
    if (!loaded || !pet) return;
    void mirrorWalk(walk, pet.name);
  }, [walk, loaded, pet]);

  if (!pet || !loaded) return <View style={styles.root} />;
  if (!careAllowedFor(pet.species, 'walk')) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, alignItems: 'center' }]}>
        <T weight="black" style={{ fontSize: 20 }}>
          {t('Walks are for dogs.')}
        </T>
        <Pill label={t('BACK')} onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  async function afterFinish(r: FinishResult) {
    if (!pet) return;
    if (r.walk.eventId) {
      const ev = await getEvent(db, r.walk.eventId);
      if (ev) await confirmOccurrence(db, schedules, ev).catch(() => null);
    }
    await bumpCounter(db, `walksTimed:${pet.id}`).catch(() => null);
    setCount((await listWalks(db, pet.id)).length);
    setDone(r);
    setWalk(null);
    markLogged();
    bump();
    if (r.walk.eventId) signalLogged({ eventId: r.walk.eventId, type: 'walk' });
    successFeedback();
    if (!reduceMotion) setClip({ name: 'celebrate', nonce: Date.now() });
    setCheer(Date.now());
  }

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      tapFeedback();
      const snap = weather ?? placeOnlySnapshot(place, Date.now());
      const w = await startWalk(db, pet.id, snap);
      setWalk(w);
      setNow(Date.now());
      // weather that was still loading is attached when it lands
      if (!weather?.available && place) {
        currentWeather(db).then((s) => s && setWalkWeather(db, w.id, s)).catch(() => null);
      }
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not start the walk. Please try again.'));
      errorFeedback();
    } finally {
      setBusy(false);
    }
  };
  const togglePause = async () => {
    if (!walk) return;
    tapFeedback();
    const next = walk.status === 'active' ? await pauseWalk(db, walk.id) : await resumeWalk(db, walk.id);
    if (next) setWalk(next);
    setNow(Date.now());
  };
  const finish = async () => {
    if (!walk || finishing.current) return;
    finishing.current = true; // a second tap does nothing; the database guards too
    setBusy(true);
    setError(null);
    try {
      const r = await finishWalk(db, walk.id);
      await afterFinish(r);
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save the walk. It’s kept — try Finish again.'));
      errorFeedback();
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  };
  const discard = async () => {
    if (!walk) return;
    if (!(await confirmAsync(t('Discard this walk?'), t('Nothing will be saved.'), t('Discard')))) return;
    await discardWalk(db, walk.id);
    setWalk(null);
  };
  const pickPlace = async (p: Place) => {
    setPicking(false);
    await savePlace(db, p);
    await loadWeather(true);
  };

  const petSize = Math.min(width * 0.72, height * 0.32, 320);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  // ------------------------------------------------------------ 3. adventure complete
  if (done) {
    const w = done.walk;
    const ms = w.durationMs ?? 0;
    const tod = timeOfDay(w.startedAt, walkEnd(w), w.weather?.sunset);
    const art = weatherArt(w.weather);
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <ConfettiRain fireKey={cheer} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <View />
            <CircleButton icon="close" label={t('Done')} onPress={() => router.dismissTo('/')} />
          </View>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)} style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <T weight="black" style={styles.bigTitle} accessibilityRole="header">
              {t('Another adventure together!')}
            </T>
            <T style={styles.sub}>{t('Adventure #{n} with {name}', { n: Math.max(1, count), name: pet.name })}</T>
          </Animated.View>
          <PetRig species={pet.species} appearance={pet.appearance} size={petSize * 0.9} progress={1} clip={clip} onClipEnd={() => setClip(null)} active reduceMotion={reduceMotion} accessibilityLabel={pet.name} />
          <View style={styles.chips}>
            <Fact label={t('Walk time')} value={durationText(ms)} art={ART.adventures.t_afternoon} hideArt />
            <Fact label={t('Weather')} value={w.weather?.available ? formatTemp(w.weather.tempC, unit) : '–'} sub={w.weather?.available ? conditionLabel(w.weather.condition) : t('Not recorded')} art={art ? WEATHER_ART[art] : null} />
            <Fact label={t('Time of day')} value={timeOfDayLabel(tod)} art={TIME_ART[tod]} />
          </View>
          {done.newBadges.length ? <NewBadges ids={done.newBadges} reduceMotion={reduceMotion} /> : null}
          <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(300)} style={styles.saved} accessibilityLiveRegion="polite" testID="walk-saved">
            <T weight="xbold" style={{ color: '#0E8F98', fontSize: 14, textAlign: 'center' }}>
              {t('✓ Saved to {name}’s day, calendar, moments and Paw Passport', { name: pet.name })}
            </T>
          </Animated.View>
          <View style={styles.actionsRow}>
            <SoftPill label={t('Photo or note')} onPress={() => router.push({ pathname: '/adventure', params: { id: w.id } })} style={{ flex: 1 }} />
            <SoftPill label={t('Edit time')} color={colors.inkSoft} tint={colors.card} onPress={() => router.push({ pathname: '/adventure', params: { id: w.id, edit: 'time' } })} style={{ flex: 1 }} />
          </View>
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 20, gap: 10, marginTop: 10 }}>
            <Pill label={t('VIEW PAW PASSPORT')} color={GREEN} onPress={() => router.replace('/passport')} testID="walk-passport" />
            <Pill label={t('DONE')} onPress={() => router.dismissTo('/')} testID="walk-done" />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------------------ 2. on an adventure
  if (walk) {
    const ms = elapsedMs(walk, now);
    const paused = walk.status === 'paused';
    const long = ms > LONG_WALK_MS;
    const art = weatherArt(walk.weather);
    return (
      <View style={[styles.root, styles.liveBg, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.topRow}>
          <CircleButton icon="back" label={t('Back')} onPress={close} />
          {walk.weather?.available ? (
            <View style={styles.weatherChip} accessibilityLabel={`${formatTemp(walk.weather.tempC, unit)}, ${conditionLabel(walk.weather.condition)}`}>
              {art ? <Image source={WEATHER_ART[art]} style={{ width: 26, height: 26 }} /> : null}
              <T weight="xbold" style={{ fontSize: 14 }}>
                {formatTemp(walk.weather.tempC, unit)} · {conditionLabel(walk.weather.condition)}
              </T>
            </View>
          ) : (
            <View />
          )}
        </View>
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <T weight="black" style={styles.liveTitle} accessibilityRole="header">
            {paused ? t('Taking a break') : t('On an adventure!')}
          </T>
          <T style={styles.sub}>{t('Enjoy your time together, {name}', { name: pet.name })}</T>
        </View>
        <View style={styles.clockWrap}>
          <T weight="black" style={[styles.clock, paused && { color: colors.muted }]} accessibilityRole="timer" accessibilityLabel={t('Elapsed {time}', { time: clockText(ms) })} testID="walk-clock">
            {clockText(ms)}
          </T>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={styles.scene} />
          <PetRig
            species={pet.species}
            appearance={pet.appearance}
            size={petSize}
            progress={1}
            clip={clip}
            onClipEnd={() => (walk.status === 'active' && !reduceMotion ? setClip({ name: 'walk', nonce: Date.now() }) : setClip(null))}
            active
            reduceMotion={reduceMotion}
            accessibilityLabel={pet.name}
          />
        </View>
        {long ? (
          <View style={styles.longNote}>
            <T weight="xbold" style={{ color: '#B26A00', fontSize: 14, textAlign: 'center' }}>
              {t('Still walking? If you forgot to finish, finish now and correct the time after.')}
            </T>
          </View>
        ) : null}
        {error ? (
          <T weight="xbold" style={{ color: colors.danger, textAlign: 'center', marginBottom: 6 }} accessibilityLiveRegion="assertive">
            {error}
          </T>
        ) : null}
        <View style={styles.controls}>
          <SoftPill label={paused ? t('▶  Resume') : t('❚❚  Pause')} color={colors.ink} tint="#FFFFFF" onPress={togglePause} style={{ flex: 1 }} />
          <Pill label={t('Finish Walk')} color="#FF7A6B" onPress={finish} loading={busy} style={{ flex: 1.3 }} testID="walk-finish" />
        </View>
        <SoftPill label={t('Discard')} small color={colors.muted} tint="transparent" onPress={discard} style={{ alignSelf: 'center', marginTop: 6 }} />
      </View>
    );
  }

  // ------------------------------------------------------------ 1. ready for an adventure
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <CircleButton icon="back" label={t('Back')} onPress={close} />
          <Pill label={t('Paw Passport')} color="#FFFFFF" textColor={colors.ink} onPress={() => router.push('/passport')} style={styles.passportPill} testID="open-passport" />
        </View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260)} style={{ paddingHorizontal: 22 }}>
          <T weight="black" style={styles.bigTitle} accessibilityRole="header">
            {t('Ready for an adventure?')}
          </T>
          <T style={styles.sub}>{walkGreeting(weather, pet.name)}</T>
        </Animated.View>
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <WeatherCard weather={weather} place={place} loading={weatherLoading} unit={unit} onChoosePlace={() => setPicking(true)} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <PetRig species={pet.species} appearance={pet.appearance} size={petSize} progress={1} active reduceMotion={reduceMotion} accessibilityLabel={pet.name} />
        </View>
        {error ? (
          <T weight="xbold" style={{ color: colors.danger, textAlign: 'center', marginBottom: 8 }}>
            {error}
          </T>
        ) : null}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(120).springify().damping(16)} style={{ paddingHorizontal: 20 }}>
          <Pulse amount={0.025} period={1700} active={!reduceMotion}>
            <Pill label={t('Start Walk')} color={GREEN} onPress={start} loading={busy} testID="walk-start" />
          </Pulse>
          <T style={styles.hint}>{t('The timer keeps going if you lock your phone or close the app.')}</T>
          <SoftPill label={t('Log a past walk instead')} small color={colors.muted} tint="transparent" onPress={() => router.replace({ pathname: '/log/[type]', params: { type: 'walk' } })} style={{ alignSelf: 'center' }} />
        </Animated.View>
      </ScrollView>
      <PlacePicker visible={picking} onClose={() => setPicking(false)} onPick={pickPlace} />
    </View>
  );
}

function Fact({ label, value, sub, art, hideArt }: { label: string; value: string; sub?: string; art: number | null; hideArt?: boolean }) {
  return (
    <View style={styles.fact} accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      {hideArt ? <T style={{ fontSize: 24 }}>⏱️</T> : <Image source={art ?? WEATHER_ART.partly} style={{ width: 34, height: 34, opacity: art ? 1 : 0.4 }} />}
      <T weight="black" style={{ fontSize: 17, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }} numberOfLines={2}>
        {sub ?? label}
      </T>
    </View>
  );
}

function NewBadges({ ids, reduceMotion }: { ids: AdventureBadgeId[]; reduceMotion: boolean }) {
  return (
    <View style={styles.newBadge} accessibilityLiveRegion="polite">
      <T weight="black" style={{ fontSize: 16, color: '#B26A00' }}>
        {ids.length > 1 ? t('New stamps unlocked!') : t('New stamp unlocked!')}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 8 }}>
        {ids.map((id, i) => (
          <Animated.View key={id} entering={reduceMotion ? undefined : ZoomIn.delay(400 + i * 180).springify().damping(10)} style={{ alignItems: 'center', width: 104 }}>
            <Stamp id={id} size={84} earned />
            <T weight="black" style={{ fontSize: 14, textAlign: 'center', marginTop: 4 }}>
              {adventureBadge(id).title}
            </T>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  liveBg: { backgroundColor: '#F2FBF4' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, alignSelf: 'stretch' },
  passportPill: { height: 46, paddingHorizontal: 18, shadowOpacity: 0, elevation: 0, borderWidth: 2, borderColor: colors.line },
  bigTitle: { fontSize: 30, lineHeight: 36, textAlign: 'center', marginTop: 10, color: colors.ink },
  liveTitle: { fontSize: 26, lineHeight: 32, color: colors.ink },
  sub: { color: colors.muted, fontSize: 16, textAlign: 'center', marginTop: 4 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 13, marginTop: 10 },
  clockWrap: { alignSelf: 'center', marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 30, paddingHorizontal: 26, paddingVertical: 6 },
  clock: { fontSize: 64, lineHeight: 74, color: colors.ink, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  scene: { position: 'absolute', bottom: '8%', width: '86%', height: '36%', borderRadius: 999, backgroundColor: '#DDF2D2' },
  weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 12, height: 40 },
  controls: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  longNote: { marginHorizontal: 20, marginBottom: 10, backgroundColor: '#FFF4E0', borderRadius: 16, padding: 10 },
  chips: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 6, alignSelf: 'stretch' },
  fact: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 3 },
  newBadge: { marginTop: 14, marginHorizontal: 20, alignSelf: 'stretch', backgroundColor: '#FFF6E6', borderRadius: 24, padding: 14, alignItems: 'center' },
  saved: { marginTop: 14, marginHorizontal: 20, backgroundColor: '#E6F7F8', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12, alignSelf: 'stretch' },
});
