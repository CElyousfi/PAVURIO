import React, { useEffect, useReducer, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stack, router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { Pill, T } from '../ui/primitives';
import { t } from '../i18n';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { FullScreen } from '../native/fullScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from '@expo-google-fonts/nunito';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { AppProvider, useApp } from '../state/AppState';
import { CloudProvider } from '../state/Cloud';
import { cloud } from '../cloud/firebase';
import { colors } from '../ui/theme';
import { SNOOZE_MS, onReminderTap } from '../native/notifications';
import { EngagementProvider } from '../state/Engagement';
import { CelebrationHost } from '../features/CelebrationHost';
import { WalkLiveBridge } from '../features/WalkLiveBridge';
import { BrandSplash } from '../features/BrandSplash';
import { Sticker } from '../ui/Sticker';
import { CARE, careAllowedFor, isCareType } from '../domain/care';
import { portionOf } from '../domain/progress';
import { getPortions, logCare } from '../data/repo';
import { setMark } from '../data/careRepo';
import { confirmOccurrence } from '../features/careLink';
import { dayKeyOf } from '../domain/time';
import { track, trackScreen } from '../native/analytics';
import { TipHost } from '../features/Tips';
import { DbProvider } from '../state/DbProvider';
import { STALL_MS, showSlowNotice, startupInitial, startupReducer } from '../features/startup';

/** A tapped reminder opens the right place: the care's log card (linked to its occurrence) or the visit. */
function ReminderRouter() {
  const app = useApp();
  const ref = React.useRef(app);
  ref.current = app;
  useEffect(
    () =>
      onReminderTap(async (n) => {
        const { pet: cur, pets: all, switchPet: sw, db, schedules, bump, signalLogged } = ref.current;
        if (n.petId && n.petId !== cur?.id && all.some((p) => p.id === n.petId)) await sw(n.petId);
        const species = all.find((p) => p.id === (n.petId ?? cur?.id))?.species ?? cur?.species;
        if (n.action === 'snooze' && n.kind === 'care') {
          await setMark(db, n.scheduleId, n.key, 'snoozed', { snoozeUntil: Date.now() + SNOOZE_MS });
          bump();
          return;
        }
        if (n.action === 'done' && n.kind === 'care') {
          // the owner confirmed it from the notification: record it (idempotent per occurrence)
          if (n.type && isCareType(n.type) && species && careAllowedFor(species, n.type) && n.petId) {
            try {
              const portion = CARE[n.type].amount ? portionOf(n.type, await getPortions(db, n.petId)) : undefined;
              const saved = await logCare(db, { petId: n.petId, type: n.type, occurredAt: Date.now(), amount: portion, mutationId: `notif:${n.key}` });
              await confirmOccurrence(db, schedules, saved, { scheduleId: n.scheduleId, key: n.key });
              track('care_logged', { type: n.type, via: 'notification', as_planned: true });
              bump();
              router.navigate('/');
              signalLogged({ eventId: saved.id, type: n.type });
            } catch (e) {
              console.warn('[pavurio] could not log from notification', e);
            }
          } else {
            await setMark(db, n.scheduleId, n.key, 'done');
            bump();
          }
          return;
        }
        if (n.kind === 'supply') {
          router.push('/supplies');
          return;
        }
        if (n.kind === 'nudge' && n.key.endsWith(':guide')) {
          router.push('/guide');
          return;
        }
        if (n.kind === 'appointment') {
          router.push({ pathname: '/appointment', params: { id: n.key.replace(/^appt:/, '') } });
        } else if (n.kind === 'care' && n.type === 'walk' && species === 'dog') {
          // a walk reminder opens the Adventure, ready to start
          router.push('/walk');
        } else if (n.kind === 'care' && n.type && isCareType(n.type)) {
          router.push({ pathname: '/log/[type]', params: { type: n.type, day: dayKeyOf(new Date()), scheduleId: n.scheduleId, occ: n.key } });
        } else if (n.kind === 'care') {
          router.navigate('/care');
        } else {
          router.navigate('/');
        }
      }),
    [],
  );
  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  // a retry re-mounts the database and the app state from scratch (nothing is deleted)
  const [boot, setBoot] = useState(0);
  // React state: when the app becomes ready, the slow-start notice disappears by itself
  const [startup, dispatch] = useReducer(startupReducer, startupInitial);
  const startedRef = useRef(false);
  startedRef.current = startup.started;
  useEffect(() => {
    // watchdog: whatever happens below (fonts, database, first load), the logo never stays forever
    const timer = setTimeout(() => {
      if (startedRef.current) return;
      SplashScreen.hideAsync().catch(() => {});
      dispatch({ type: 'stall' });
      cloud.crash.log('startup stalled');
    }, STALL_MS);
    return () => clearTimeout(timer);
  }, [boot]);
  // a retry re-mounts the app state; the database attempt already under way is shared, never doubled
  const retry = () => {
    dispatch({ type: 'retry' });
    setBoot((b) => b + 1);
  };
  const onStarted = React.useCallback(() => dispatch({ type: 'started' }), []);
  return (
    <SafeAreaProvider>
      {fontsLoaded || fontError ? (
        <StartupBoundary key={boot} onRetry={retry}>
          <DbProvider>
            <AppProvider>
              <CloudProvider>
                <EngagementProvider>
                  <Gate onStarted={onStarted} />
                </EngagementProvider>
              </CloudProvider>
            </AppProvider>
          </DbProvider>
        </StartupBoundary>
      ) : null}
      {showSlowNotice(startup) ? <StartupProblem slow onRetry={retry} /> : null}
    </SafeAreaProvider>
  );
}

/** Catches a failure to open or migrate the database: a friendly retry instead of an endless logo. */
class StartupBoundary extends React.Component<{ children: React.ReactNode; onRetry: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[pavurio] startup failed', error);
    cloud.crash.record(error, 'startup: database');
  }
  render() {
    return this.state.error ? <StartupProblem onRetry={this.props.onRetry} /> : this.props.children;
  }
}

/** Start-up went wrong or is very slow: say so kindly, keep the data, offer a retry. */
function StartupProblem({ onRetry, slow = false }: { onRetry: () => void; slow?: boolean }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32 }} testID="startup-problem">
      <Sticker name="cat_walk" size={150} />
      <T weight="black" style={{ fontSize: 22, textAlign: 'center', marginTop: 18 }}>
        {slow ? t('This is taking longer than usual') : t('We couldn’t open your data')}
      </T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>{t('Your pets are safe on this phone. Let’s try again.')}</T>
      <Pill label={t('TRY AGAIN')} onPress={onRetry} style={{ marginTop: 24, minWidth: 220 }} testID="startup-retry" />
    </View>
  );
}

/** one screen view per route (ids are in params, not in the path, so names stay generic) */
function ScreenTracker() {
  const path = usePathname();
  useEffect(() => {
    trackScreen(path);
  }, [path]);
  return null;
}

function Gate({ onStarted }: { onStarted: () => void }) {
  const { ready, language, loadError, retryLoad } = useApp();
  // once per cold start the native splash (the store icon) hands over to BrandSplash, which hides it
  const [brand, setBrand] = useState(true);
  useEffect(() => {
    if (ready) onStarted();
  }, [ready, onStarted]);
  // loading the saved data failed: retry, never "no pets" (that would look like the pets were lost)
  if (!ready && loadError) return <StartupProblem onRetry={retryLoad} />;
  // the native splash stays up until `ready`; this only shows for a few frames on web
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return (
    <View style={{ flex: 1 }}>
      <Animated.View key={language} entering={FadeIn.duration(260)} style={{ flex: 1 }}>
        <ReminderRouter />
        <ScreenTracker />
        <WalkLiveBridge />
        <CelebrationHost />
        <StatusBar style="dark" />
        <FullScreen />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right', animationDuration: 280, gestureEnabled: true, freezeOnBlur: true }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="care" />
          <Stack.Screen name="moments" />
          <Stack.Screen name="records" />
          <Stack.Screen name="pets" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="log/[type]" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 150 }} />
          <Stack.Screen name="day" options={{ presentation: 'modal' }} />
          <Stack.Screen name="studio" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="schedule" options={{ presentation: 'modal' }} />
          <Stack.Screen name="appointment" options={{ presentation: 'modal' }} />
          <Stack.Screen name="weight" options={{ presentation: 'modal' }} />
          <Stack.Screen name="walk" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', animationDuration: 300 }} />
          <Stack.Screen name="passport" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="adventure" options={{ presentation: 'modal' }} />
          <Stack.Screen name="record" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
          <Stack.Screen name="moment" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 220 }} />
          <Stack.Screen name="cards" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="card" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', animationDuration: 300 }} />
          <Stack.Screen name="story" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 320 }} />
          <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', animationDuration: 300 }} />
          <Stack.Screen name="pet" options={{ presentation: 'modal' }} />
          <Stack.Screen name="summary" options={{ presentation: 'modal' }} />
          <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="add" options={{ presentation: 'fullScreenModal', animation: 'none', gestureEnabled: false }} />
          <Stack.Screen name="supplies" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="supply" options={{ presentation: 'modal' }} />
          <Stack.Screen name="supply-edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="done" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 220, gestureEnabled: false }} />
          <Stack.Screen name="tip" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom', animationDuration: 260 }} />
          <Stack.Screen name="guide" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom', animationDuration: 260 }} />
          <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="explore" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <TipHost />
      </Animated.View>
      {brand ? <BrandSplash onDone={() => setBrand(false)} /> : null}
    </View>
  );
}

/** Shown by expo-router if a screen crashes: friendly art, nothing technical, a way back. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    cloud.crash.record(error, 'screen crashed');
    // a crash before the brand splash ran must not leave the logo on screen
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Sticker name="cat_walk" size={160} />
      <T weight="black" style={{ fontSize: 24, textAlign: 'center', marginTop: 18 }}>
        {t('Something went wrong')}
      </T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>{t('Your data is safe on this device. Let’s try that again.')}</T>
      <Pill label={t('TRY AGAIN')} onPress={() => void retry()} style={{ marginTop: 24, minWidth: 220 }} />
    </View>
  );
}
