/**
 * Moment viewer: the photo full screen with its pets, date, caption, milestone and favorite.
 * Right after a save (fresh=n) it celebrates and offers the optional quick additions.
 */
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Moment, deleteMoment, getMoment, removeMomentFromPet, milestoneLabel, momentsOn, setFavorite, setFeatured } from '../data/memoriesRepo';
import { MILESTONE_EMOJI, momentLabel } from '../domain/memories';
import { deleteFiles, sharePhoto } from '../native/media';
import { toggleFeedback } from '../native/haptics';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { formatDateLong } from '../ui/forms';
import { Bouncy, ConfettiRain, PopIn, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { Sticker, moodSticker } from '../ui/Sticker';
import { MEM_COLORS } from '../features/MemoriesKit';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

export default function MomentViewer() {
  const params = useLocalSearchParams<{ id: string; fresh?: string; failed?: string }>();
  const { db, pets, pet, bump, version } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [m, setM] = useState<Moment | null>(null);
  const [sameDay, setSameDay] = useState(0);
  const [missing, setMissing] = useState(false);
  const [fire, setFire] = useState<number | null>(null);
  const fresh = Number(params.fresh ?? 0);

  useEffect(() => {
    if (!params.id) return;
    getMoment(db, params.id).then((x) => {
      if (!x) return setMissing(true);
      if (x.kind === 'adventure' && x.walkId) return router.replace({ pathname: '/adventure', params: { id: x.walkId } });
      setM(x);
      momentsOn(db, x.petId, x.date).then((all) => setSameDay(all.length));
    });
  }, [db, params.id, version]);
  useEffect(() => {
    if (fresh) setFire(Date.now());
  }, [fresh]);

  if (missing) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Sticker name={moodSticker(pet?.species ?? 'dog', 'curious')} size={140} />
        <T weight="black" style={{ color: '#FFF', fontSize: 18 }}>
          {t('This moment no longer exists.')}
        </T>
        <Bouncy accessibilityRole="button" onPress={() => router.back()} style={styles.chip}>
          <T weight="black">{t('Close')}</T>
        </Bouncy>
      </View>
    );
  }
  if (!m) return <View style={styles.root} />;

  const label = momentLabel(m, t);
  const petNames = m.petIds.map((id) => pets.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  const photoH = Math.min(height * 0.62, (width - 0) * 1.35);
  const ratio = m.width && m.height ? m.width / m.height : 3 / 4;

  const toggleFav = async () => {
    await setFavorite(db, m.id, !m.favorite);
    setM({ ...m, favorite: !m.favorite });
    toggleFeedback(!m.favorite);
    bump();
  };
  const toggleFeatured = async () => {
    await setFeatured(db, m.id, !m.featured);
    setM({ ...m, featured: !m.featured });
    bump();
  };
  const remove = async () => {
    // a moment shared with other pets: take it out of this pet's scrapbook only, the photo stays
    const others = pets.filter((p) => m.petIds.includes(p.id) && p.id !== pet?.id);
    if (pet && others.length && m.petIds.includes(pet.id)) {
      if (!(await confirmAsync(t('Remove from {name}’s memories?', { name: pet.name }), t('It stays in {others}’s memories with its photo.', { others: others.map((p) => p.name).join(' & ') })))) return;
      await removeMomentFromPet(db, m.id, pet.id);
      bump();
      router.back();
      return;
    }
    if (!(await confirmAsync(t('Delete this moment?'), t('The photo is removed from Pavurio (your camera roll keeps its copy).')))) return;
    deleteFiles(await deleteMoment(db, m.id));
    bump();
    router.back();
  };
  const edit = (focus?: string) => router.push({ pathname: '/memory', params: { id: m.id, focus } });

  return (
    <View style={styles.root}>
      <ConfettiRain fireKey={fire} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Bouncy accessibilityRole="button" accessibilityLabel={t('Close')} onPress={() => router.back()} style={styles.round} testID="moment-close">
            <Icon name="close" color="#FFF" />
          </Bouncy>
          <View style={{ flex: 1 }} />
          <Bouncy accessibilityRole="button" accessibilityLabel={m.favorite ? t('Remove from favorites') : t('Add to favorites')} accessibilityState={{ selected: m.favorite }} onPress={toggleFav} style={styles.round} testID="moment-fav">
            <T style={{ fontSize: 20, color: m.favorite ? '#FF6B9A' : '#FFF' }}>{m.favorite ? '♥' : '♡'}</T>
          </Bouncy>
          {m.photoUri ? (
            <Bouncy accessibilityRole="button" accessibilityLabel={t('Share photo')} onPress={() => sharePhoto(m.photoUri!).catch((e) => console.warn('[pavurio] share failed', e))} style={styles.round}>
              <T weight="black" style={{ color: '#FFF', fontSize: 18 }}>
                ↑
              </T>
            </Bouncy>
          ) : null}
        </View>

        {fresh ? (
          <Animated.View entering={motionReduced() ? FadeIn : FadeInDown.springify().damping(16)} style={styles.saved} accessibilityLiveRegion="polite">
            <PopIn>
              <Sticker name={moodSticker(pet?.species ?? 'dog', 'party')} size={54} />
            </PopIn>
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 17 }}>
                {fresh > 1 ? tn(fresh, 'Moment saved!', '{n} moments saved!') : t('Moment saved!')}
              </T>
              <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
                {params.failed ? tn(Number(params.failed), '1 photo couldn’t be saved.', '{n} photos couldn’t be saved.') : t('Add more if you like — or just enjoy it.')}
              </T>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: 'center', marginTop: 10 }}>
          {m.photoUri ? (
            <Image
              source={{ uri: m.photoUri }}
              style={{ width: Math.min(width - 24, photoH * ratio), height: Math.min(photoH, (width - 24) / ratio), borderRadius: 22 }}
              resizeMode="cover"
              accessibilityLabel={label || t('Photo of {name}', { name: petNames.join(', ') })}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.noPhoto, { width: width - 40 }]}>
              <Sticker name={m.milestone ? moodSticker(pet?.species ?? 'dog', 'trophy') : moodSticker(pet?.species ?? 'dog', 'love')} size={150} />
            </View>
          )}
        </Animated.View>

        <View style={{ paddingHorizontal: 22, marginTop: 18, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {m.milestone ? (
            <View style={styles.badge}>
              <T style={{ fontSize: 14 }}>{MILESTONE_EMOJI[m.milestone]}</T>
              <T weight="black" style={{ color: MEM_COLORS.warmInk, fontSize: 13 }}>
                {milestoneLabel(m.milestone)}
              </T>
            </View>
          ) : null}
          {label ? (
            <T weight="black" style={{ color: '#FFF', fontSize: 24 }}>
              {label}
            </T>
          ) : null}
          <T weight="xbold" style={{ color: '#FFFFFFB8', fontSize: 14 }}>
            {formatDateLong(m.date)} · {petNames.join(' & ')}
          </T>
          {m.caption ? <T style={{ color: '#FFFFFFE6', fontSize: 16, lineHeight: 23, marginTop: 4 }}>{m.caption}</T> : null}

          {fresh ? (
            <View style={styles.quick}>
              {!m.caption ? <QuickChip label={t('Add caption')} onPress={() => edit('caption')} /> : null}
              {!m.milestone ? <QuickChip label={t('★ Milestone')} onPress={() => edit('milestone')} /> : null}
              {pets.length > 1 ? <QuickChip label={t('Other pets')} onPress={() => edit('pets')} /> : null}
              <QuickChip label={t('Fix date')} onPress={() => edit('date')} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Action label={t('Create Memory Card')} primary onPress={() => router.push({ pathname: '/card', params: { moment: m.id } })} testID="moment-card" />
            {sameDay > 1 ? <Action label={m.featured ? t('★ Featured today') : t('Feature for this day')} onPress={toggleFeatured} /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Action label={t('Edit')} onPress={() => edit()} />
              </View>
              <View style={{ flex: 1 }}>
                <Action label={t('Delete')} danger onPress={remove} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Bouncy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.chip}>
      <T weight="black" style={{ fontSize: 13.5 }}>
        {label}
      </T>
    </Bouncy>
  );
}

function Action({ label, onPress, primary, danger, testID }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; testID?: string }) {
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={[styles.action, primary && { backgroundColor: '#FFFFFF' }, danger && { backgroundColor: '#FFFFFF14' }]}
    >
      <T weight="black" style={{ fontSize: 15.5, color: primary ? colors.ink : danger ? '#FF8A8E' : '#FFF' }}>
        {label}
      </T>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141A28' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 22, backgroundColor: '#FFFFFF' },
  noPhoto: { height: 260, borderRadius: 26, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: MEM_COLORS.warm },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFFFFF' },
  actions: { gap: 10, marginTop: 18 },
  action: { height: 52, borderRadius: 26, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
});
