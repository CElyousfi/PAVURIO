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
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: def.color, paddingTop: insets.top + 64 }]}>
          <View style={{ flex: 1 }}>
            <T weight="black" style={styles.kicker}>
              {tn(def.days, '{n}-DAY CHALLENGE', '{n}-DAY CHALLENGE')}
              {def.pro ? ' · PRO' : ''}
            </T>
            <T weight="black" style={styles.title}>
              {pick(def.title)}
            </T>
          </View>
          <Float amount={6}>
            <PopIn>
              {ART.challenges[def.key] ? <Scene source={ART.challenges[def.key]!} width={120} height={152} border={5} tilt={4} /> : <CareIcon type={def.rule.kind === 'care' ? def.rule.type : 'meal'} size={120} />}
            </PopIn>
          </Float>
        </View>
        <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.body}>
          <T style={styles.text}>{pick(def.blurb)}</T>

          {live ? (
            <View style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <T weight="black" style={[styles.h, { marginTop: 0, color: def.color }]}>
                  {t('Your progress')}
                </T>
                <T weight="black" style={{ fontSize: 18, color: def.color }}>
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
            </View>
          ) : null}

          <T weight="black" style={[styles.h, { color: def.color }]}>
            {t('What to do')}
          </T>
          <View style={styles.step}>
            <View style={[styles.num, { backgroundColor: def.color }]}>
              <T weight="black" style={styles.numText}>
                1
              </T>
            </View>
            <T style={[styles.text, { flex: 1, marginTop: 0 }]}>{pick(def.blurb)}</T>
          </View>
          <View style={styles.step}>
            <View style={[styles.num, { backgroundColor: def.color }]}>
              <T weight="black" style={styles.numText}>
                2
              </T>
            </View>
            <T style={[styles.text, { flex: 1, marginTop: 0 }]}>
              {def.grace ? tn(def.grace, 'You can miss up to {n} day.', 'You can miss up to {n} days.') : t('Miss a day and it starts over — no pressure, you can try again any time.')}
            </T>
          </View>
          {doneBefore && !live ? (
            <T weight="black" style={{ color: def.color, marginTop: 18 }}>
              ✓ {t('Completed before')}
            </T>
          ) : null}
          {live ? (
            <Bouncy onPress={quit} style={styles.ghost} accessibilityRole="button">
              <T weight="black" style={{ color: colors.muted, fontSize: 14 }}>
                {t('Stop challenge')}
              </T>
            </Bouncy>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={44} />
      </View>
      {!live ? (
        <View pointerEvents="box-none" style={[styles.ctaWrap, { bottom: insets.bottom + 18 }]}>
          <Bouncy onPress={start} style={styles.cta} accessibilityRole="button" testID="challenge-start">
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 1 }}>
              {locked ? t('Unlock with Pro') : doneBefore ? t('Do it again') : t('START NOW')}
            </T>
          </Bouncy>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 24, paddingBottom: 28, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  kicker: { color: '#FFFFFFB0', fontSize: 12, letterSpacing: 1.6 },
  title: { fontSize: 32, lineHeight: 37, marginTop: 6, color: '#FFFFFF' },
  body: { paddingHorizontal: 24, paddingTop: 20, maxWidth: 560, alignSelf: 'center', width: '100%' },
  h: { fontSize: 24, marginTop: 26 },
  text: { fontSize: 16, color: colors.inkSoft, lineHeight: 23, marginTop: 6 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 14 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#FFFFFF', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  day: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  cta: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, paddingHorizontal: 44, minWidth: 220 },
  ghost: { marginTop: 18, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10 },
});
