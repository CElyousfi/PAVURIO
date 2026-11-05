/** Pops a full-screen celebration for each newly earned Paw Passport milestone, one at a time. */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { BADGES, badgeText } from '../domain/badges';
import { useEngagement } from '../state/Engagement';
import { useApp } from '../state/AppState';
import { Medal } from './Medal';
import { Bouncy, ConfettiRain, PopIn } from '../ui/motion';
import { T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { maybeAskForReview } from '../native/review';
import { t } from '../i18n';

/** How long the pet's reaction to a log (clip + hearts) is left alone before a badge may pop. */
const REACTION_MS = 3200;

export function CelebrationHost() {
  const { queue, shift } = useEngagement();
  const { db, lastLoggedAt } = useApp();
  const [fire, setFire] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const path = usePathname();
  // don't interrupt onboarding, a purchase, or the pet's reaction to the care that was just logged; the queue waits
  const blocked = path.startsWith('/onboarding') || path.startsWith('/paywall') || path.startsWith('/done');
  const holdUntil = lastLoggedAt + REACTION_MS;
  const holding = Date.now() < holdUntil;
  useEffect(() => {
    if (!holding || !queue.length) return;
    const timer = setTimeout(() => setTick((x) => x + 1), holdUntil - Date.now() + 20);
    return () => clearTimeout(timer);
  }, [holding, holdUntil, queue.length]);
  const head = blocked || holding ? undefined : queue[0];
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => {
      setFire(Date.now());
      successFeedback();
    }, 250);
    return () => clearTimeout(timer);
  }, [head]);
  if (!head) return null;

  const badge = head.kind === 'badge' ? BADGES.find((b) => b.key === head.key) : null;
  const color = badge?.color ?? colors.brand;
  const close = () => {
    shift();
    if (queue.length <= 1) void maybeAskForReview(db);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.screen}>
        <Animated.View entering={FadeIn.duration(260)} style={[styles.arch, { backgroundColor: `${color}22` }]} />
        <View style={styles.center}>
          <PopIn delay={150}>
            {badge ? <Medal def={badge} size={190} /> : null}
          </PopIn>
          <Animated.View entering={ZoomIn.delay(260).springify().damping(14)} style={{ alignItems: 'center' }}>
            <T weight="black" style={[styles.kicker, { color }]}>
              {t('NEW BADGE')}
            </T>
            <T weight="black" style={styles.title}>
              {badge ? badgeText(badge.title) : ''}
            </T>
            <T style={styles.body}>{badge ? badgeText(badge.how) : ''}</T>
          </Animated.View>
        </View>
        <Bouncy onPress={close} style={[styles.btn, { backgroundColor: color }]} accessibilityRole="button" testID="celebrate-ok">
          <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 1 }}>
            {t('AWESOME!')}
          </T>
        </Bouncy>
        <ConfettiRain fireKey={fire} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'space-between', paddingTop: 80, paddingBottom: 50, paddingHorizontal: 28, overflow: 'hidden' },
  arch: { position: 'absolute', top: -220, width: 620, height: 620, borderRadius: 310 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  kicker: { fontSize: 13, letterSpacing: 2 },
  title: { fontSize: 34, lineHeight: 40, textAlign: 'center', marginTop: 8 },
  body: { fontSize: 17, color: colors.inkSoft, textAlign: 'center', marginTop: 8, lineHeight: 24, maxWidth: 320 },
  btn: { height: 62, alignSelf: 'stretch', maxWidth: 360, width: '100%', borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});
