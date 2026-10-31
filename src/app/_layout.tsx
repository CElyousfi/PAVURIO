import React, { useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { ART } from '../ui/art';
import { Pill, T } from '../ui/primitives';
import { t } from '../i18n';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from '@expo-google-fonts/nunito';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { migrate } from '../data/migrations';
import type { Db } from '../data/db';
import { AppProvider, useApp } from '../state/AppState';
import { colors } from '../ui/theme';
import { onReminderTap } from '../native/notifications';
import { EngagementProvider } from '../state/Engagement';
import { CelebrationHost } from '../features/CelebrationHost';
import { careAllowedFor, isCareType } from '../domain/care';
import { logCare } from '../data/repo';
import { setMark } from '../data/careRepo';
import { confirmOccurrence } from '../features/careLink';
import { dayKeyOf } from '../domain/time';

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
          await setMark(db, n.scheduleId, n.key, 'snoozed', { snoozeUntil: Date.now() + 30 * 60_000 });
          bump();
          return;
        }
        if (n.action === 'done' && n.kind === 'care') {
          // the owner confirmed it from the notification: record it (idempotent per occurrence)
          if (n.type && isCareType(n.type) && species && careAllowedFor(species, n.type) && n.petId) {
            try {
              const saved = await logCare(db, { petId: n.petId, type: n.type, occurredAt: Date.now(), mutationId: `notif:${n.key}` });
              await confirmOccurrence(db, schedules, saved, { scheduleId: n.scheduleId, key: n.key });
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
        if (n.kind === 'appointment') {
          router.push({ pathname: '/appointment', params: { id: n.key.replace(/^appt:/, '') } });
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
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="pavurio.db" onInit={(db) => migrate(db as unknown as Db)}>
        <AppProvider>
          <EngagementProvider>
            <Gate />
          </EngagementProvider>
        </AppProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { ready, language } = useApp();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return (
    <React.Fragment key={language}>
      <ReminderRouter />
      <CelebrationHost />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="log/[type]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="day" options={{ presentation: 'modal' }} />
        <Stack.Screen name="studio" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="schedule" options={{ presentation: 'modal' }} />
        <Stack.Screen name="appointment" options={{ presentation: 'modal' }} />
        <Stack.Screen name="weight" options={{ presentation: 'modal' }} />
        <Stack.Screen name="walk" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="record" options={{ presentation: 'modal' }} />
        <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
        <Stack.Screen name="story" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pet" options={{ presentation: 'modal' }} />
        <Stack.Screen name="summary" options={{ presentation: 'modal' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="challenge" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tip" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
      </Stack>
    </React.Fragment>
  );
}

/** Shown by expo-router if a screen crashes: friendly art, nothing technical, a way back. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {ART.icons.error ? <Image source={ART.icons.error} style={{ width: 170, height: 130 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      <T weight="black" style={{ fontSize: 24, textAlign: 'center', marginTop: 18 }}>
        {t('Something went wrong')}
      </T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>{t('Your data is safe on this device. Let’s try that again.')}</T>
      <Pill label={t('TRY AGAIN')} onPress={() => void retry()} style={{ marginTop: 24, minWidth: 220 }} />
    </View>
  );
}
