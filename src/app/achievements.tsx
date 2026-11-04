import React, { useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeDef, badgeText, badgesFor } from '../domain/badges';
import { CHALLENGES, careOk } from '../domain/challenges';
import { ChallengeCard, Flame } from '../features/HomeFeed';
import { Medal } from '../features/Medal';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { Bar, Bouncy, CountUp, Enter, PopIn } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';
import { TabTitle } from '../ui/forms';

export default function Achievements() {
  const { pet, pro } = useApp();
  const { streak, earned, stats, completedChallengeKeys } = useEngagement();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState<string | null>(null);
  if (!pet) return null;
  const W = Math.min(width, 560);
  const cols = 4;
  const gap = 8;
  const cell = (W - 40 - (cols - 1) * gap) / cols;
  const list = CHALLENGES.filter((c) => careOk(c, pet.species));
  const mine = badgesFor(pet.species);
  const got = mine.filter((b) => earned.includes(b.key));
  // the header shows the tapped badge, else the latest earned one, else the first to earn
  const shown: BadgeDef = mine.find((b) => b.key === sel) ?? got[got.length - 1] ?? mine[0];
  const shownGot = earned.includes(shown.key);
  const goal = stats ? shown.goal(stats) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <TabTitle title={t('Achievements')} subtitle={t('Badges, streaks and challenges')} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <Animated.View key={shown.key} entering={FadeIn.duration(200)} style={styles.head}>
            <View style={styles.headArt}>
              <PopIn key={shown.key}>
                <Medal def={shown} size={92} locked={!shownGot} />
              </PopIn>
            </View>
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 21 }} numberOfLines={2}>
                {badgeText(shown.title)}
              </T>
              <T style={{ color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: 2 }}>{badgeText(shown.how)}</T>
              <T weight="black" style={{ color: colors.brand, fontSize: 13, marginTop: 4 }}>
                {shownGot ? `✓ ${t('Earned')}` : goal ? `${goal[0]} / ${goal[1]}` : ''}
              </T>
            </View>
          </Animated.View>
          {!shownGot && goal ? (
            <View style={{ marginTop: 12 }}>
              <Bar value={goal[0] / goal[1]} color={shown.color} height={10} />
            </View>
          ) : null}

          <View style={styles.sectionRow}>
            <T weight="black" style={styles.h2}>
              {t('Badges')}
            </T>
            <View style={styles.countPill}>
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 13 }}>
                {got.length}/{mine.length}
              </T>
            </View>
          </View>
          <View style={styles.grid}>
            {mine.map((b, i) => {
              const has = earned.includes(b.key);
              const on = b.key === shown.key;
              return (
                <Enter key={b.key} index={i} style={{ width: cell }}>
                  <Bouncy onPress={() => setSel(b.key)} scaleTo={0.92} style={[styles.cell, { height: cell }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${badgeText(b.title)}${has ? '' : `, ${t('locked')}`}`}>
                    <Medal def={b} size={cell * 0.78} locked={!has} lockedTint="#C9EBF0" plain />
                    {on ? (
                      <View style={styles.check}>
                        <Icon name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Bouncy>
                </Enter>
              );
            })}
          </View>

          <View style={styles.streak}>
            <Flame size={44} lit={streak.current > 0} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <CountUp value={streak.current} style={{ fontSize: 30, color: '#FF7A1A' }} />
                <T weight="black" style={{ fontSize: 16, color: '#FF7A1A' }}>
                  {tn(streak.current, 'day', 'days')}
                </T>
              </View>
              <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
                {t('Current streak · best {n}', { n: streak.best })}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <CountUp value={stats?.logs ?? 0} style={{ fontSize: 22 }} />
              <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
                {t('cares logged')}
              </T>
            </View>
          </View>

          <T weight="black" style={[styles.h2, { marginTop: 26, marginBottom: 12 }]}>
            {t('Challenges')}
          </T>
          <View style={{ gap: 12 }}>
            {list.map((c) => (
              <ChallengeCard key={c.key} def={c} width={W - 40} locked={c.pro && !pro} done={completedChallengeKeys.includes(c.key)} />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  tag: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  headArt: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  h2: { fontSize: 24, color: colors.brand },
  countPill: { backgroundColor: colors.brand, borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E3F6F8' },
  check: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF6EC', borderRadius: 26, padding: 16, marginTop: 22 },
});
