/**
 * Explore: everything Pavurio does, in one calm directory, each with a line saying what it's for.
 * Product navigation lives here; Settings is just one entry at the bottom (it used to be the hub).
 * Always reachable from Home's menu button, and the last stop of "Show me around".
 */
import React, { useState } from 'react';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { PetAvatar } from '../animation/PetAvatar';
import { PantryIcon } from '../features/supplies';
import { ART } from '../ui/art';
import { Sticker } from '../ui/Sticker';
import { Sheet, TabTitle } from '../ui/forms';
import { Bouncy, Enter } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t } from '../i18n';
import { track } from '../native/analytics';

type Item = { key: string; title: string; body: string; art: React.ReactNode; go: () => void };

const img = (src: ImageSourcePropType | null | undefined) => (src ? <Image source={src} style={{ width: 52, height: 52 }} resizeMode="contain" /> : null);

export default function Explore() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const { pet, pets } = useApp();
  const [widgets, setWidgets] = useState(false);
  if (!pet) return null;
  const open = (key: string, path: Parameters<typeof router.push>[0]) => () => {
    track('feature_discovered', { feature: key, from: 'explore' });
    router.push(path);
  };
  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('Every day'),
      items: [
        { key: 'care', title: t('Care'), body: t('Their day, routines and appointments.'), art: img(ART.duo.routines), go: open('care', '/care') },
        { key: 'pantry', title: t('Pantry'), body: t('Food and supplies, remembered for you.'), art: <PantryIcon kind="food" size={52} />, go: open('pantry', '/supplies') },
        { key: 'memories', title: t('Memories'), body: t('Real moments you never want to forget.'), art: img(ART.icons.gift), go: open('memories', '/moments') },
      ],
    },
    {
      title: t('Health'),
      items: [
        { key: 'records', title: t('Health records'), body: t('Vaccines, vet notes and documents in one file.'), art: img(ART.section.records), go: open('records', '/records') },
        { key: 'visits', title: t('Visits'), body: t('Vet, groomer or sitter: add a visit and get reminded the day before.'), art: <Sticker name={pet.species === 'cat' ? 'cat_happy' : 'dog_meds'} size={52} />, go: open('visits', '/appointment') },
        { key: 'plan', title: t('{name}’s plan', { name: pet.name }), body: t('Meals, walks, portions and times, recommended for their age.'), art: img(ART.care.meal), go: open('plan', '/plan') },
        { key: 'summary', title: t('Weekly summary'), body: t('A short recap of the week you shared.'), art: img(ART.duo.awards), go: open('summary', '/summary') },
      ],
    },
    {
      title: t('Adventures & milestones'),
      items: [
        ...(pet.species === 'dog'
          ? [{ key: 'passport', title: t('Paw Passport'), body: t('A walk timer and a passport of your walks together. No GPS, no tracking.'), art: img(ART.care.walk), go: open('passport', '/passport') }]
          : []),
        { key: 'achievements', title: t('Milestones'), body: t('Little badges for your life together.'), art: img(ART.duo.awards), go: open('achievements', '/achievements') },
        { key: 'cards', title: t('Memory Cards'), body: t('Turn a photo into a card to keep or share.'), art: img(ART.icons.gift), go: open('cards', '/cards') },
      ],
    },
    {
      title: t('Make it yours'),
      items: [
        { key: 'studio', title: t('Appearance Studio'), body: t('Change {name}’s coat and collar anytime.', { name: pet.name }), art: <PetAvatar species={pet.species} appearance={pet.appearance} size={52} />, go: open('studio', '/studio') },
        { key: 'pets', title: t('All pets'), body: pets.length > 1 ? t('Switch between your pets, or add another.') : t('Add another pet.'), art: <Sticker name={pet.species === 'cat' ? 'cat_bed' : 'dog_sleep'} size={52} />, go: open('pets', '/pets') },
        {
          key: 'widgets',
          title: t('Widgets'),
          body: t('See the next care right on your home screen.'),
          art: <T style={{ fontSize: 34 }}>📱</T>,
          go: () => {
            track('feature_discovered', { feature: 'widgets', from: 'explore' });
            setWidgets(true);
          },
        },
        { key: 'settings', title: t('Settings'), body: t('Reminders, sounds, language, account and Pro.'), art: <View style={styles.gear}><Icon name="menu" size={24} color={colors.ink} /></View>, go: open('settings', '/settings') },
      ],
    },
  ];
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <TabTitle title={t('Explore')} subtitle={t('Everything Pavurio does for {name}', { name: pet.name })} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          {groups.map((g, gi) => (
            <View key={g.title} style={{ marginTop: gi ? 22 : 10 }}>
              <T weight="black" style={styles.group}>
                {g.title.toUpperCase()}
              </T>
              <View style={styles.card}>
                {g.items.map((it, i) => (
                  <Enter key={it.key} index={i}>
                    <Bouncy scaleTo={0.98} onPress={it.go} style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button" accessibilityHint={it.body} testID={`explore-${it.key}`}>
                      <View style={styles.art}>{it.art}</View>
                      <View style={{ flex: 1 }}>
                        <T weight="black" style={{ fontSize: 17 }}>
                          {it.title}
                        </T>
                        <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 1 }}>{it.body}</T>
                      </View>
                      <Icon name="chevR" size={18} color={colors.faint} />
                    </Bouncy>
                  </Enter>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <Sheet visible={widgets} onClose={() => setWidgets(false)} title={t('Widgets')}>
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <T style={{ fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>{t('Touch and hold an empty spot on your home screen, choose Widgets, then Pavurio. Pick the size you like.')}</T>
          <T style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>{t('The widget shows the next care and fills in as you log. A tap opens Pavurio.')}</T>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  group: { fontSize: 12, letterSpacing: 1.4, color: colors.muted, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  art: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  gear: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
