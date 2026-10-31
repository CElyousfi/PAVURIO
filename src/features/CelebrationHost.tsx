/** Pops a full-screen celebration for each newly earned badge or finished challenge, one at a time. */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { BADGES, badgeText } from '../domain/badges';
import { challengeDef, pick } from '../domain/challenges';
import { useEngagement } from '../state/Engagement';
import { useApp } from '../state/AppState';
import { Medal } from './Medal';
import { CareIcon } from '../ui/CareIcon';
import { Bouncy, ConfettiRain, PopIn } from '../ui/motion';
import { T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { maybeAskForReview } from '../native/review';
import { t } from '../i18n';

export function CelebrationHost() {
  const { queue, shift } = useEngagement();
  const { db } = useApp();
  const [fire, setFire] = useState<number | null>(null);
  const path = usePathname();
  // don't interrupt onboarding or a purchase; the queue waits
  const blocked = path.startsWith('/onboarding') || path.startsWith('/paywall');
  const head = blocked ? undefined : queue[0];
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
  const ch = head.kind === 'challenge' ? challengeDef(head.key) : null;
  const color = badge?.color ?? ch?.color ?? colors.brand;
  const close = () => {
    shift();
    if (queue.length <= 1) void maybeAskForReview(db);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.card}>
          <View style={[styles.rays, { backgroundColor: `${color}1A` }]} />
          <T weight="black" style={[styles.kicker, { color }]}>
            {badge ? t('NEW BADGE') : t('CHALLENGE COMPLETE')}
          </T>
          <PopIn delay={200} style={{ marginTop: 16 }}>
            {badge ? (
              <Medal def={badge} size={150} />
            ) : ch ? (
              <View style={[styles.chArt, { backgroundColor: ch.tint }]}>
                <CareIcon type={ch.rule.kind === 'care' ? ch.rule.type : 'meal'} size={110} />
              </View>
            ) : null}
          </PopIn>
          <T weight="black" style={styles.title}>
            {badge ? badgeText(badge.title) : ch ? pick(ch.title) : ''}
          </T>
          <T style={styles.body}>{badge ? badgeText(badge.how) : t('You did it! The badge is in your collection.')}</T>
          <Bouncy onPress={close} style={[styles.btn, { backgroundColor: color }]} accessibilityRole="button" testID="celebrate-ok">
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 1 }}>
              {t('AWESOME!')}
            </T>
          </Bouncy>
        </Animated.View>
        <ConfettiRain fireKey={fire} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(14,19,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, borderRadius: 34, backgroundColor: '#FFFFFF', alignItems: 'center', padding: 26, overflow: 'hidden' },
  rays: { position: 'absolute', top: -80, width: 360, height: 300, borderRadius: 180 },
  kicker: { fontSize: 13, letterSpacing: 2 },
  chArt: { width: 160, height: 160, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, textAlign: 'center', marginTop: 16 },
  body: { fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  btn: { marginTop: 22, height: 56, alignSelf: 'stretch', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
