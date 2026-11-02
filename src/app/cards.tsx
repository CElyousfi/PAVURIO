/** Memory Cards gallery: the ten illustrated templates (Story 9:16 and Post 4:5). */
import React from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEMPLATES, layoutFor } from '../features/memoryCards';
import { TEMPLATE_ART } from '../features/memoryTemplateArt.generated';
import { useApp } from '../state/AppState';
import { TabTitle } from '../ui/forms';
import { Bouncy, Enter } from '../ui/motion';
import { T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

const HOLE = ['#DDF6F7', '#FFE8EF', '#FFF4E3', '#E6F4DE', '#EEE8FF'];

export default function CardsGallery() {
  const { pet } = useApp();
  const { moment } = useLocalSearchParams<{ moment?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const colW = (W - 40 - 12) / 2;
  if (!pet) return null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + 6 }}>
      <TabTitle title={t('Memory Cards')} subtitle={t('Pick a frame for your photos of {name}', { name: pet.name })} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30, flexDirection: 'row', flexWrap: 'wrap', gap: 12, maxWidth: 560, alignSelf: 'center' }}>
        {TEMPLATES.map((tpl, i) => {
          const L = layoutFor(tpl.id, 'story');
          const s = colW / L.w;
          return (
            <Enter key={tpl.id} index={i}>
              <Bouncy
                accessibilityRole="button"
                accessibilityLabel={`${t(tpl.name)}, ${tn(tpl.slots, '1 photo', '{n} photos')}`}
                onPress={() => router.push({ pathname: '/card', params: { template: tpl.id, moment } })}
                scaleTo={0.96}
                style={{ width: colW }}
                testID={`tpl-${tpl.id}`}
              >
                <View style={[styles.thumb, { width: colW, height: L.h * s }]}>
                  {L.slots.map((sl, j) => (
                    <View key={j} style={{ position: 'absolute', left: sl.x * s, top: sl.y * s, width: sl.w * s, height: sl.h * s, backgroundColor: HOLE[(i + j) % HOLE.length] }} />
                  ))}
                  <Image source={TEMPLATE_ART[tpl.id].story} style={{ position: 'absolute', left: 0, top: 0, width: colW, height: L.h * s }} resizeMode="stretch" />
                </View>
                <T weight="black" style={{ fontSize: 15, marginTop: 8 }} numberOfLines={1}>
                  {t(tpl.name)}
                </T>
                <T weight="xbold" style={{ color: colors.muted, fontSize: 12.5 }} numberOfLines={1}>
                  {tn(tpl.slots, '1 photo', '{n} photos')} · {t(tpl.blurb, { name: pet.name })}
                </T>
              </Bouncy>
            </Enter>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card },
});
