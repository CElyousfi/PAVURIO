import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';
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
import { isCareType } from '../domain/care';
import { dayKeyOf } from '../domain/time';

/** A tapped reminder opens the right place: the care's log card (linked to its occurrence) or the visit. */
function ReminderRouter() {
  const { pet, pets, switchPet } = useApp();
  const ref = React.useRef({ pet, pets, switchPet });
  ref.current = { pet, pets, switchPet };
  useEffect(
    () =>
      onReminderTap(async (t) => {
        const { pet: cur, pets: all, switchPet: sw } = ref.current;
        if (t.petId && t.petId !== cur?.id && all.some((p) => p.id === t.petId)) await sw(t.petId);
        if (t.kind === 'appointment') {
          router.push({ pathname: '/appointment', params: { id: t.key.replace(/^appt:/, '') } });
          return;
        }
        if (t.type && isCareType(t.type)) {
          router.push({ pathname: '/log/[type]', params: { type: t.type, day: dayKeyOf(new Date()), scheduleId: t.scheduleId, occ: t.key } });
        } else {
          router.navigate('/care');
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
          <Gate />
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
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pet" options={{ presentation: 'modal' }} />
      </Stack>
    </React.Fragment>
  );
}
