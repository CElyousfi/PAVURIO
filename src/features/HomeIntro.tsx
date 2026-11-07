/**
 * The first visit to Home: a compact card (inside the feed, never over the app) presenting the four
 * places to know, with "Show me around" or "I'll explore myself". The tour is four short tips, one at
 * a time, each with an Open button; it can be ended anytime and Explore keeps everything afterwards.
 * Setting `homeIntro`: '' (not seen) | 'tour:<n>' | 'done'.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { getSetting, setSetting } from '../data/repo';
import { useApp } from '../state/AppState';
import { ART } from '../ui/art';
import { Bouncy, Enter } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { selectFeedback } from '../native/haptics';
import { t } from '../i18n';
import { track } from '../native/analytics';
import { PantryIcon } from './supplies';

const KEY = 'homeIntro';

type Place = { key: string; title: string; body: string; path: string; art: React.ReactNode };

export function HomeIntro() {
  const { db, pet } = useApp();
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    getSetting(db, KEY).then((v) => {
      setState(v ?? '');
      if (!v) track('home_reached', { first: true });
    });
  }, [db]);
  if (!pet || state == null || state === 'done') return null;
  const save = (v: string) => {
    setState(v);
    void setSetting(db, KEY, v);
  };
  const places: Place[] = [
    { key: 'care', title: t('Care'), body: t('Their day, routines and appointments.'), path: '/care', art: <Image source={ART.duo.routines} style={styles.placeArt} resizeMode="contain" /> },
    { key: 'pantry', title: t('Pantry'), body: t('Food and supplies, remembered for you.'), path: '/supplies', art: <PantryIcon kind="food" size={44} /> },
    { key: 'memories', title: t('Memories'), body: t('Real moments you never want to forget.'), path: '/moments', art: <Image source={ART.icons.gift} style={styles.placeArt} resizeMode="contain" /> },
    { key: 'explore', title: t('Explore'), body: t('Health records, Adventures, milestones and more.'), path: '/explore', art: <Image source={ART.section.records} style={styles.placeArt} resizeMode="contain" /> },
  ];
  const openPlace = (p: Place, from: string) => {
    track('feature_discovered', { feature: p.key, from });
    router.push(p.path as never);
  };

  if (state === '') {
    return (
      <Enter index={0}>
        <View style={styles.card} testID="home-intro">
          <T weight="black" style={{ fontSize: 19 }}>
            {t('Here’s {name}’s happy little world.', { name: pet.name })}
          </T>
          <View style={styles.grid}>
            {places.map((p) => (
              <Bouncy key={p.key} onPress={() => openPlace(p, 'intro')} style={styles.place} accessibilityRole="button" accessibilityHint={p.body} testID={`intro-${p.key}`}>
                {p.art}
                <T weight="black" style={{ fontSize: 15, marginTop: 4 }}>
                  {p.title}
                </T>
                <T style={{ color: colors.muted, fontSize: 12, lineHeight: 16, textAlign: 'center' }} numberOfLines={3}>
                  {p.body}
                </T>
              </Bouncy>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Bouncy
              onPress={() => {
                selectFeedback();
                track('intro_choice', { choice: 'tour' });
                save('tour:0');
              }}
              style={[styles.btn, { backgroundColor: colors.ink }]}
              accessibilityRole="button"
              testID="intro-tour"
            >
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 15 }}>
                {t('Show me around')}
              </T>
            </Bouncy>
            <Bouncy
              onPress={() => {
                track('intro_choice', { choice: 'self' });
                save('done');
              }}
              style={[styles.btn, { backgroundColor: colors.line }]}
              accessibilityRole="button"
              testID="intro-skip"
            >
              <T weight="black" style={{ fontSize: 15 }}>
                {t('I’ll explore myself')}
              </T>
            </Bouncy>
          </View>
        </View>
      </Enter>
    );
  }

  const n = Math.max(0, Math.min(3, Number(state.split(':')[1] ?? 0)));
  const tour = [
    { place: places[0], text: t('Everything your pet needs today starts here: tap the next care just above to log it, and find the full day in Care.') },
    { place: places[1], text: t('Add your pet’s food once. Pavurio helps you remember when to buy more.') },
    { place: places[2], text: t('A photo today becomes a memory to treasure later.') },
    { place: places[3], text: t('Health records, visits, adventures, milestones, widgets and settings: it’s all in Explore, anytime.') },
  ][n];
  return (
    <Enter index={0}>
      <View style={[styles.card, { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }]} testID={`tour-${n}`}>
        <View style={{ width: 52, alignItems: 'center' }}>{tour.place.art}</View>
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 11, letterSpacing: 1.2, color: '#7C5CE6' }}>
            {t('TIP {n} OF {total}', { n: n + 1, total: 4 })} · {tour.place.title.toUpperCase()}
          </T>
          <T style={{ fontSize: 15, lineHeight: 21, marginTop: 4 }}>{tour.text}</T>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <Bouncy onPress={() => openPlace(tour.place, 'tour')} accessibilityRole="button" testID="tour-open">
              <T weight="black" style={{ color: colors.brand, fontSize: 15 }}>
                {t('Open {place}', { place: tour.place.title })}
              </T>
            </Bouncy>
            <Bouncy
              onPress={() => {
                selectFeedback();
                save(n >= 3 ? 'done' : `tour:${n + 1}`);
              }}
              accessibilityRole="button"
              testID="tour-next"
            >
              <T weight="black" style={{ color: colors.ink, fontSize: 15 }}>
                {n >= 3 ? t('Done') : t('Next tip')}
              </T>
            </Bouncy>
          </View>
        </View>
        <Bouncy onPress={() => save('done')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Close')} testID="tour-close">
          <Icon name="close" size={16} color={colors.muted} />
        </Bouncy>
      </View>
    </Enter>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#EEE8FE', borderRadius: 28, padding: 16, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  place: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 10, alignItems: 'center' },
  placeArt: { width: 44, height: 44 },
  btn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
});
