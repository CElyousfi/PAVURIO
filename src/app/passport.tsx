/**
 * The Paw Passport: every adventure with this dog, at a glance (Overview), as stamps (Badges) and as a
 * diary (History). Everything is derived from the stored walks, so it's always consistent.
 */
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useApp } from '../state/AppState';
import { listWalkBadges, listWalks, type WalkBadge } from '../data/walkRepo';
import { ADVENTURE_BADGES, AdventureBadgeId, Walk, adventureBadge, badgeProgress, durationText, isValidWalk, timeOfDay, timeOfDayLabel, walkEnd, walkStats } from '../domain/walks';
import { formatTemp, weatherArt } from '../domain/weather';
import { formatDateLong } from '../ui/forms';
import { Stamp, TimeArt, WEATHER_ART } from '../features/adventures';
import { PetAvatar } from '../animation/PetAvatar';
import { CircleButton, Pill, T } from '../ui/primitives';
import { Bouncy } from '../ui/motion';
import { colors } from '../ui/theme';
import { ART } from '../ui/art';
import { t, tn } from '../i18n';

type Tab = 'overview' | 'badges' | 'history';

export default function Passport() {
  const { pet, db, version, settings, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('overview');
  const [walks, setWalks] = useState<Walk[]>([]);
  const [badges, setBadges] = useState<WalkBadge[]>([]);
  const [sel, setSel] = useState<AdventureBadgeId | null>(null);
  const unit = settings.weightUnit === 'lb' ? 'F' : 'C';

  useFocusEffect(
    useCallback(() => {
      if (!pet) return;
      let alive = true;
      Promise.all([listWalks(db, pet.id), listWalkBadges(db, pet.id)]).then(([w, b]) => {
        if (!alive) return;
        setWalks(w);
        setBadges(b);
      });
      return () => {
        alive = false;
      };
      // version: reload after any change (a walk edited or deleted elsewhere)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, pet, version]),
  );

  if (!pet) return null;
  const stats = walkStats(walks, Date.now());
  const earned = new Map(badges.map((b) => [b.badge, b]));
  const validCount = walks.filter(isValidWalk).length;
  const W = Math.min(width, 560);
  const tile = Math.floor((W - 40 - 3 * 12) / 4);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30, width: W, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <CircleButton icon="back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
        </View>
        {/* the cover */}
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260)} style={styles.cover}>
          <Image source={ART.adventures.passport_cover} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1 }}>
            <T weight="black" style={styles.coverTitle} accessibilityRole="header">
              {t('{name}’s Paw Passport', { name: pet.name })}
            </T>
            <T style={{ color: '#2F6B3A', fontSize: 14 }}>{tn(stats.total, '{n} adventure together', '{n} adventures together')}</T>
          </View>
          <PetAvatar species={pet.species} appearance={pet.appearance} size={72} />
        </Animated.View>

        <View style={styles.seg} accessibilityRole="tablist">
          {(['overview', 'badges', 'history'] as Tab[]).map((k) => (
            <Bouncy key={k} scaleTo={0.96} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.segBtn, tab === k && styles.segOn]} testID={`passport-${k}`}>
              <T weight="black" style={{ color: tab === k ? '#FFFFFF' : colors.inkSoft, fontSize: 15 }}>
                {k === 'overview' ? t('Overview') : k === 'badges' ? t('Badges') : t('History')}
              </T>
            </Bouncy>
          ))}
        </View>

        {tab === 'overview' ? (
          <Animated.View key="o" entering={reduceMotion ? undefined : FadeIn.duration(200)} style={{ paddingHorizontal: 20, gap: 14 }}>
            <View style={styles.statRow}>
              <Stat value={String(stats.total)} label={t('Total walks')} />
              <Stat value={durationText(stats.totalMs)} label={t('Time together')} />
              <Stat value={String(stats.thisMonth)} label={t('This month')} />
              <Stat value={stats.favourite ? timeOfDayLabel(stats.favourite) : '–'} label={t('Favourite time')} small />
            </View>
            <T weight="black" style={styles.h2}>
              {t('Stamps')}
            </T>
            <View style={styles.stampRow}>
              {ADVENTURE_BADGES.filter((b) => earned.has(b)).length ? (
                ADVENTURE_BADGES.filter((b) => earned.has(b)).map((b) => <Stamp key={b} id={b} size={58} earned />)
              ) : (
                <T style={styles.muted}>{t('Your first walk earns the first stamp.')}</T>
              )}
            </View>
            <T weight="black" style={styles.h2}>
              {t('Latest adventure')}
            </T>
            {stats.latest ? <WalkCard w={stats.latest} unit={unit} badges={badges} /> : <Empty name={pet.name} />}
          </Animated.View>
        ) : null}

        {tab === 'badges' ? (
          <Animated.View key="b" entering={reduceMotion ? undefined : FadeIn.duration(200)} style={{ paddingHorizontal: 20 }}>
            {sel ? <BadgeDetail id={sel} got={earned.get(sel) ?? null} valid={validCount} /> : <T style={[styles.muted, { marginBottom: 12 }]}>{t('Tap a stamp to see how to earn it.')}</T>}
            <View style={styles.grid}>
              {ADVENTURE_BADGES.map((b) => (
                <Bouncy key={b} scaleTo={0.94} onPress={() => setSel(b)} accessibilityRole="button" accessibilityLabel={`${adventureBadge(b).title}${earned.has(b) ? `, ${t('earned')}` : `, ${t('locked')}`}`} style={[styles.tile, { width: tile }, sel === b && styles.tileOn]} testID={`stamp-${b}`}>
                  <Stamp id={b} size={tile - 14} earned={earned.has(b)} />
                  <T weight="xbold" style={styles.tileText} numberOfLines={2}>
                    {adventureBadge(b).title}
                  </T>
                </Bouncy>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {tab === 'history' ? (
          <Animated.View key="h" entering={reduceMotion ? undefined : FadeIn.duration(200)} style={{ paddingHorizontal: 20, gap: 12 }}>
            {walks.length ? walks.map((w) => <WalkCard key={w.id} w={w} unit={unit} badges={badges} />) : <Empty name={pet.name} />}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <T weight="black" style={{ fontSize: small ? 14 : 20, color: colors.ink, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

function WalkCard({ w, unit, badges }: { w: Walk; unit: 'C' | 'F'; badges: WalkBadge[] }) {
  const tod = timeOfDay(w.startedAt, walkEnd(w), w.weather?.sunset);
  const art = weatherArt(w.weather);
  const mine = badges.filter((b) => b.walkId === w.id);
  const date = formatDateLong(dayKey(w.startedAt));
  return (
    <Bouncy scaleTo={0.98} onPress={() => router.push({ pathname: '/adventure', params: { id: w.id } })} accessibilityRole="button" accessibilityLabel={`${date}, ${durationText(w.durationMs ?? 0)}, ${timeOfDayLabel(tod)}`} style={styles.walkCard}>
      {art ? <Image source={WEATHER_ART[art]} style={{ width: 52, height: 52 }} /> : <TimeArt tod={tod} size={52} />}
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="black" style={{ fontSize: 16 }}>
          {date}
        </T>
        <T style={{ color: colors.inkSoft, fontSize: 14 }}>
          {durationText(w.durationMs ?? 0)}
          {w.weather?.available ? ` · ${formatTemp(w.weather.tempC, unit)}` : ''}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TimeArt tod={tod} size={22} />
          <T style={{ color: colors.muted, fontSize: 13 }}>{timeOfDayLabel(tod)}</T>
          {w.note ? <T style={{ color: colors.muted, fontSize: 13 }}>· ✎</T> : null}
          {w.photoUri ? <T style={{ color: colors.muted, fontSize: 13 }}>· 📷</T> : null}
        </View>
      </View>
      {w.photoUri ? <Image source={{ uri: w.photoUri }} style={styles.thumb} /> : null}
      {mine.length ? (
        <View style={{ flexDirection: 'row' }}>
          {mine.slice(0, 2).map((b) => (
            <Stamp key={b.badge} id={b.badge} size={34} earned />
          ))}
        </View>
      ) : null}
    </Bouncy>
  );
}

function BadgeDetail({ id, got, valid }: { id: AdventureBadgeId; got: WalkBadge | null; valid: number }) {
  const def = adventureBadge(id);
  const prog = badgeProgress(id, valid);
  return (
    <View style={styles.detail} accessibilityLiveRegion="polite">
      <Stamp id={id} size={86} earned={!!got} />
      <View style={{ flex: 1, gap: 4 }}>
        <T weight="black" style={{ fontSize: 18 }}>
          {def.title}
        </T>
        <T style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 19 }}>{def.how}</T>
        {got ? (
          <T weight="xbold" style={{ color: '#0E8F98', fontSize: 13 }}>
            {t('✓ Earned {date}', { date: formatDateLong(dayKey(got.unlockedAt)) })}
          </T>
        ) : prog ? (
          <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
            {t('{have} of {goal} walks', { have: prog.have, goal: prog.goal })}
          </T>
        ) : (
          <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
            {t('Not yet')}
          </T>
        )}
      </View>
    </View>
  );
}

function Empty({ name }: { name: string }) {
  return (
    <View style={styles.empty}>
      <Image source={ART.adventures.walk_ready} style={{ width: 130, height: 130 }} />
      <T weight="black" style={{ fontSize: 18, textAlign: 'center' }}>
        {t('No adventures yet')}
      </T>
      <T style={[styles.muted, { textAlign: 'center' }]}>{t('Start a walk with {name} and it’ll appear here, with the weather and the time of day.', { name })}</T>
      <Pill label={t('Start a Walk')} color="#14B8C4" onPress={() => router.replace('/walk')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
  );
}

function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', paddingHorizontal: 16 },
  cover: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 20, marginTop: 10, padding: 16, borderRadius: 26, backgroundColor: '#E6F4DE' },
  coverTitle: { fontSize: 22, lineHeight: 27, color: '#1F4D2B' },
  seg: { flexDirection: 'row', backgroundColor: '#E8EAEE', borderRadius: 22, padding: 4, marginHorizontal: 20, marginBottom: 16 },
  segBtn: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#14B8C4' },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 2 },
  h2: { fontSize: 19, marginTop: 4 },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 40, alignItems: 'center' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { backgroundColor: '#FFF6E6', borderRadius: 20, paddingVertical: 8, alignItems: 'center', gap: 4, borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: '#F5B94A' },
  tileText: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4, color: colors.inkSoft },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 22, padding: 14, marginBottom: 14 },
  walkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 12 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  empty: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 24, padding: 20 },
});
