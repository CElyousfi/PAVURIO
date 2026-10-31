import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetAvatar } from '../../animation/PetAvatar';
import { Memory, listMemories } from '../../data/recordsRepo';
import { listEventsBetween } from '../../data/repo';
import { StoryRange, storyWindow } from '../../domain/stories';
import { dayKeyOf, parseDayKey } from '../../domain/time';
import { useApp } from '../../state/AppState';
import { EmptyState, TabTitle, formatDateLong } from '../../ui/forms';
import { CircleButton, T } from '../../ui/primitives';
import { Enter } from '../../ui/motion';
import { colors } from '../../ui/theme';
import { t, tn } from '../../i18n';

function nextAnniversary(date: string | null, today: string): { day: string; years: number } | null {
  if (!date) return null;
  const d = parseDayKey(date);
  const td = parseDayKey(today);
  let y = td.getFullYear();
  let next = new Date(y, d.getMonth(), d.getDate());
  if (dayKeyOf(next) < today) next = new Date(++y, d.getMonth(), d.getDate());
  const years = y - d.getFullYear();
  if (years <= 0) return null;
  return { day: dayKeyOf(next), years };
}

export default function MomentsTab() {
  const { pet, db, version, pro } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const [items, setItems] = useState<Memory[]>([]);
  const [ready, setReady] = useState<Record<StoryRange, boolean>>({ week: false, month: false });
  const today = dayKeyOf(new Date());

  useEffect(() => {
    if (!pet) return;
    listMemories(db, pet.id).then(setItems);
    // a story is offered only with at least 3 logs in its window (same rule as buildStory)
    (['week', 'month'] as StoryRange[]).forEach((r) => {
      const w = storyWindow(r, today);
      const [y, m, d] = w.from.split('-').map(Number);
      listEventsBetween(db, pet.id, new Date(y, m - 1, d).getTime(), Date.now() + 1).then((ev) => setReady((s) => ({ ...s, [r]: ev.length >= 3 })));
    });
  }, [db, pet, version, today]);

  if (!pet) return null;
  const birthday = nextAnniversary(pet.birthDate, today);
  const gotcha = nextAnniversary(pet.adoptionDate, today);
  const tile = (W - 40 - 10) / 2;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <TabTitle
        title={t('Moments')}
        subtitle={t('Photos & milestones with {name}', { name: pet.name })}
        right={<CircleButton icon="plus" label={t('Add a moment')} onPress={() => router.push('/memory')} size={50} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        <View>
          <T weight="black" style={styles.section}>
            {t('Stories')}
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['week', 'month'] as StoryRange[]).map((r) => (
              <Pressable
                key={r}
                disabled={!ready[r]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready[r] }}
                accessibilityLabel={r === 'week' ? t('Play this week story') : t('Play this month story')}
                onPress={() => (r === 'month' && !pro ? router.push({ pathname: '/paywall', params: { reason: 'story' } }) : router.push({ pathname: '/story', params: { range: r } }))}
                style={({ pressed }) => [styles.story, { opacity: ready[r] ? 1 : 0.5, transform: [{ scale: pressed ? 0.97 : 1 }] }, r === 'month' && { backgroundColor: '#FFE9D6' }]}
                testID={`story-${r}`}
              >
                <View style={[styles.ring, { borderColor: r === 'week' ? colors.brand : '#F59E0B' }]}>
                  <PetAvatar species={pet.species} appearance={pet.appearance} size={60} />
                </View>
                <T weight="black" style={{ fontSize: 16, marginTop: 8 }}>
                  {r === 'week' ? t('This week') : t('This month')}
                </T>
                <T style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>{!ready[r] ? t('Log a few cares to unlock') : r === 'month' && !pro ? t('Pro · tap to see') : t('Tap to play')}</T>
              </Pressable>
            ))}
          </View>
        </View>

        {birthday || gotcha ? (
          <View style={{ gap: 8 }}>
            {birthday ? <Milestone emoji="🎂" title={t('{name} turns {n}', { name: pet.name, n: birthday.years })} day={birthday.day} today={today} /> : null}
            {gotcha ? <Milestone emoji="🏡" title={gotcha.years === 1 ? t('{n} year together', { n: gotcha.years }) : t('{n} years together', { n: gotcha.years })} day={gotcha.day} today={today} /> : null}
          </View>
        ) : !pet.birthDate ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Add birthday')} onPress={() => router.push({ pathname: '/pet', params: { id: pet.id } })} style={styles.hintCard}>
            <T weight="xbold" style={{ color: colors.inkSoft, fontSize: 14 }}>
              {t("Add {name}'s birthday or adoption day to celebrate milestones →", { name: pet.name })}
            </T>
          </Pressable>
        ) : null}

        <View>
          <T weight="black" style={styles.section}>
            {t('Moments')}
          </T>
          {items.length === 0 ? (
            <EmptyState
              title={t('Your first moment')}
              body={t("First bath, a new trick, a lazy Sunday — add a photo and it shows up in {name}'s stories.", { name: pet.name })}
              action={t('ADD A MOMENT')} onAction={() => router.push('/memory')} />
          ) : (
            <View style={styles.grid}>
              {items.map((m, mi) => (
                <Enter key={m.id} index={mi}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${m.title}, ${formatDateLong(m.date)}`} onPress={() => router.push({ pathname: '/memory', params: { id: m.id } })} style={[styles.tile, { width: tile, height: tile * 1.25 }]}>
                  {m.photoUri ? (
                    <Image source={{ uri: m.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: m.kind === 'milestone' ? '#FFF4E3' : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }]}>
                      <PetAvatar species={pet.species} appearance={pet.appearance} size={tile * 0.5} />
                    </View>
                  )}
                  <View style={styles.tileFoot}>
                    <T weight="black" style={{ color: '#FFFFFF', fontSize: 14 }} numberOfLines={1}>
                      {m.kind === 'milestone' ? '★ ' : ''}
                      {m.title}
                    </T>
                    <T style={{ color: '#FFFFFFD0', fontSize: 11 }}>{formatDateLong(m.date)}</T>
                  </View>
                </Pressable>
                </Enter>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Milestone({ emoji, title, day, today }: { emoji: string; title: string; day: string; today: string }) {
  const diff = Math.round((parseDayKey(day).getTime() - parseDayKey(today).getTime()) / 86_400_000);
  return (
    <View style={styles.milestone} accessibilityLabel={`${title}, ${diff === 0 ? t('today') : tn(diff, 'in {n} day', 'in {n} days')}`}>
      <T style={{ fontSize: 26 }}>{emoji}</T>
      <View style={{ flex: 1 }}>
        <T weight="black" style={{ fontSize: 16 }}>
          {title}
        </T>
        <T style={{ color: colors.muted, fontSize: 13 }}>{formatDateLong(day)}</T>
      </View>
      <T weight="black" style={{ color: diff === 0 ? '#E58A00' : colors.brand, fontSize: 14 }}>
        {diff === 0 ? t('Today!') : diff === 1 ? t('Tomorrow') : tn(diff, 'in {n} day', 'in {n} days')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  section: { fontSize: 19, marginBottom: 10 },
  story: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 24, backgroundColor: colors.brandSoft },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  hintCard: { padding: 14, borderRadius: 18, backgroundColor: colors.canvasWarm, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#FFF8EC' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.line },
  tileFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(20,26,40,0.45)' },
});
