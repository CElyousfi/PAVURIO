import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BADGES, BadgeDef, badgeText } from '../domain/badges';
import { CHALLENGES, careOk } from '../domain/challenges';
import { ChallengeCard, Flame } from '../features/HomeFeed';
import { Medal } from '../features/Medal';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { Sheet } from '../ui/forms';
import { Bar, Bouncy, CountUp, Enter, PopIn } from '../ui/motion';
import { CircleButton, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { t, tn } from '../i18n';

export default function Achievements() {
  const { pet, pro } = useApp();
  const { streak, earned, stats, completedChallengeKeys } = useEngagement();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<BadgeDef | null>(null);
  if (!pet) return null;
  const W = Math.min(width, 560);
  const cols = 3;
  const cell = (W - 40 - (cols - 1) * 12) / cols;
  const list = CHALLENGES.filter((c) => careOk(c, pet.species));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <View style={styles.top}>
          <CircleButton icon="back" label={t('Back')} onPress={() => router.back()} size={46} />
          <T weight="black" style={{ fontSize: 20 }} accessibilityRole="header">
            {t('Achievements')}
          </T>
          <View style={{ width: 46 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.streak, softShadow]}>
            <PopIn>
              <Flame size={64} lit={streak.current > 0} />
            </PopIn>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <CountUp value={streak.current} style={{ fontSize: 56, color: '#FF7A1A', lineHeight: 62 }} />
              <T weight="black" style={{ fontSize: 20, color: '#FF7A1A' }}>
                {tn(streak.current, 'day', 'days')}
              </T>
            </View>
            <T weight="xbold" style={{ color: colors.muted }}>
              {t('Current streak · best {n}', { n: streak.best })}
            </T>
          </View>

          <View style={styles.statsRow}>
            {[
              { n: stats?.logs ?? 0, l: t('cares logged') },
              { n: earned.length, l: t('badges') },
              { n: stats?.challengesDone ?? 0, l: t('challenges') },
            ].map((s, i) => (
              <View key={i} style={styles.stat}>
                <CountUp value={s.n} style={{ fontSize: 26 }} />
                <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
                  {s.l}
                </T>
              </View>
            ))}
          </View>

          <T weight="black" style={styles.h2}>
            {t('Badges')} · {earned.length}/{BADGES.length}
          </T>
          <View style={styles.grid}>
            {BADGES.map((b, i) => {
              const got = earned.includes(b.key);
              return (
                <Enter key={b.key} index={i} style={{ width: cell }}>
                  <Bouncy onPress={() => setOpen(b)} style={styles.cell} accessibilityRole="button" accessibilityLabel={`${badgeText(b.title)}${got ? '' : `, ${t('locked')}`}`}>
                    <Medal def={b} size={cell * 0.7} locked={!got} />
                    <T weight="black" style={{ fontSize: 13, textAlign: 'center', marginTop: 8, color: got ? colors.ink : colors.muted }} numberOfLines={2}>
                      {badgeText(b.title)}
                    </T>
                  </Bouncy>
                </Enter>
              );
            })}
          </View>

          <T weight="black" style={styles.h2}>
            {t('Challenges')}
          </T>
          <View style={{ gap: 12 }}>
            {list.map((c) => (
              <ChallengeCard key={c.key} def={c} width={W - 40} locked={c.pro && !pro} done={completedChallengeKeys.includes(c.key)} />
            ))}
          </View>
        </ScrollView>
      </View>

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? badgeText(open.title) : ''}>
        {open ? (
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <PopIn>
              <Medal def={open} size={130} locked={!earned.includes(open.key)} />
            </PopIn>
            <T style={{ color: colors.inkSoft, fontSize: 16, marginTop: 14, textAlign: 'center' }}>{badgeText(open.how)}</T>
            {!earned.includes(open.key) && stats ? (
              <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
                <Bar value={open.goal(stats)[0] / open.goal(stats)[1]} color={open.color} height={12} />
                <T weight="black" style={{ textAlign: 'center', marginTop: 6, color: open.color }}>
                  {open.goal(stats)[0]} / {open.goal(stats)[1]}
                </T>
              </View>
            ) : (
              <T weight="black" style={{ color: open.color, marginTop: 12 }}>
                ✓ {t('Earned')}
              </T>
            )}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  streak: { alignItems: 'center', backgroundColor: '#FFF6EC', borderRadius: 30, padding: 22, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.canvasWarm, borderRadius: 20, paddingVertical: 14 },
  h2: { fontSize: 21, marginTop: 28, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { alignItems: 'center', paddingVertical: 12, borderRadius: 22, backgroundColor: colors.canvasWarm },
});
