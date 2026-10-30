import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
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
  const { ready } = useApp();
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
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="log/[type]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="day" options={{ presentation: 'modal' }} />
        <Stack.Screen name="studio" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
