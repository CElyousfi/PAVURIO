import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { abandonChallenge, startChallenge } from '../data/engageRepo';
import { challengeDef, pick } from '../domain/challenges';
import { dayKeyOf } from '../domain/time';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { CareIcon } from '../ui/CareIcon';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';
import { confirmAsync } from '../ui/confirm';
import { Bar, Bouncy, Float, PopIn } from '../ui/motion';
import { CircleButton, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { t, tn } from '../i18n';
import { Missing } from '../ui/Missing';

export default function ChallengeScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const def = challengeDef(key ?? '');
  const { db, pet, pro, bump } = useApp();
  const { challenges, completedChallengeKeys } = useEngagement();
  const insets = useSafeAreaInsets();
  if (!def || !pet) return <Missing />;
  const live = challenges.find((c) => c.def.key === def.key && c.progress.state === 'active');
  const doneBefore = completedChallengeKeys.includes(def.key);
  const locked = def.pro && !pro;

  const start = async () => {
    if (locked) return router.push({ pathname: '/paywall', params: { reason: 'challenge' } });
    await startChallenge(db, pet.id, def.key, dayKeyOf(new Date()));
    successFeedback();
    bump();
  };
  const quit = async () => {
    if (!live) return;
    if (!(await confirmAsync(t('Stop this challenge?'), t('Your progress so far will be cleared.'), t('Stop')))) return;
    await abandonChallenge(db, live.run.id);
    bump();
  };

  return (
    <View style={[styles.root, { backgroundColor: def.color }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={44} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={styles.hero}>
          <Float amount={8}>
            <PopIn>
              <View style={[styles.art, ART.challenges[def.key] ? { backgroundColor: 'transparent' } : null]}>
                {ART.challenges[def.key] ? <Scene source={ART.challenges[def.key]!} width={190} height={240} border={6} tilt={-3} /> : <CareIcon type={def.rule.kind === 'care' ? def.rule.type : 'meal'} size={170} />}
              </View>
            </PopIn>
          </Float>
        </View>
        <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.sheet}>
          <T weight="black" style={{ color: def.color, fontSize: 12, letterSpacing: 1.6 }}>
            {tn(def.days, '{n}-DAY CHALLENGE', '{n}-DAY CHALLENGE')}
            {def.pro ? ' · PRO' : ''}
          </T>
          <T weight="black" style={styles.title}>
            {pick(def.title)}
          </T>
          <T style={styles.body}>{pick(def.blurb)}</T>
          <T style={[styles.body, { color: colors.muted, fontSize: 14 }]}>
            {def.grace ? tn(def.grace, 'You can miss up to {n} day.', 'You can miss up to {n} days.') : t('Miss a day and it starts over — no pressure, you can try again any time.')}
          </T>

          {live ? (
            <View style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <T weight="black" style={{ fontSize: 16 }}>
                  {t('Your progress')}
                </T>
                <T weight="black" style={{ fontSize: 16, color: def.color }}>
                  {live.progress.done}/{live.progress.target}
                </T>
              </View>
              <Bar value={live.progress.done / live.progress.target} color={def.color} height={14} />
              <View style={styles.grid}>
                {live.progress.days.map((d, i) => (
                  <View key={i} style={[styles.day, { backgroundColor: d === true ? def.color : d === false ? colors.line : def.tint }]}>
                    <T weight="black" style={{ color: d === true ? '#FFFFFF' : colors.muted, fontSize: 13 }}>
                      {i + 1}
                    </T>
                  </View>
                ))}
              </View>
              <Bouncy onPress={quit} style={styles.ghost} accessibilityRole="button">
                <T weight="black" style={{ color: colors.muted, fontSize: 14 }}>
                  {t('Stop challenge')}
                </T>
              </Bouncy>
            </View>
          ) : (
            <Bouncy onPress={start} style={[styles.cta, { backgroundColor: locked ? colors.ink : def.color }]} accessibilityRole="button" testID="challenge-start">
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 0.5 }}>
                {locked ? t('Unlock with Pro') : doneBefore ? t('Do it again') : t('Start challenge')}
              </T>
            </Bouncy>
          )}
          {doneBefore && !live ? (
            <T weight="black" style={{ textAlign: 'center', color: def.color, marginTop: 12 }}>
              ✓ {t('Completed before')}
            </T>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 },
  hero: { height: 320, alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
  art: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 34, marginHorizontal: 12, padding: 24, maxWidth: 560, alignSelf: 'center', width: '94%' },
  title: { fontSize: 30, lineHeight: 35, marginTop: 6 },
  body: { fontSize: 16, color: colors.inkSoft, lineHeight: 22, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  day: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: 24, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  ghost: { marginTop: 18, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10 },
});
