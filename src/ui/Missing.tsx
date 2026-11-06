/** Friendly fallback for a screen opened without the thing it needs (a stale link or notification). */
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill, T } from './primitives';
import { colors } from './theme';
import { Sticker } from './Sticker';
import { t } from '../i18n';

export function Missing({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: insets.top }}>
      <Sticker name="dog_eat" size={150} />
      <T weight="black" style={{ fontSize: 22, textAlign: 'center', marginTop: 12 }}>
        {title ?? t("That's not here any more")}
      </T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>{t('It may have been removed, or the link is out of date.')}</T>
      <Pill label={t('BACK')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: 24, minWidth: 200 }} />
    </View>
  );
}
