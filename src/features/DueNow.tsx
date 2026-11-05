/**
 * "Due now" hero on the Care tab: the reminder that's due (or overdue) right now, done with one slide.
 * Care types are logged with the owner's usual portion (exactly what the log card would save by default)
 * and ticked on the schedule; other kinds are just ticked. Then the result screen plays.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import type { Occurrence } from '../domain/schedule';
import { formatTime24to12 } from '../domain/schedule';
import { CARE, careAllowedFor, isCareType } from '../domain/care';
import { portionOf } from '../domain/progress';
import { logCare } from '../data/repo';
import { setMark } from '../data/careRepo';
import { confirmOccurrence } from './careLink';
import { KindIcon, kindMeta, snoozeOccurrence } from './routines';
import { useApp } from '../state/AppState';
import { SlideToConfirm } from '../ui/Slide';
import { Bouncy, motionReduced, Pulse } from '../ui/motion';
import { T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback } from '../native/haptics';
import { t } from '../i18n';

export function DueNowCard({ o }: { o: Occurrence }) {
  const { pet, db, bump, schedules, portions, markLogged, signalLogged } = useApp();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  if (!pet) return null;
  const meta = kindMeta(o.type);
  const overdue = o.status === 'overdue';

  const complete = async () => {
    if (busy.current) return;
    busy.current = true;
    const now = Date.now();
    const late = Math.round((now - o.at) / 60_000);
    try {
      if (isCareType(o.type) && careAllowedFor(pet.species, o.type)) {
        const spec = CARE[o.type].amount;
        const saved = await logCare(db, { petId: pet.id, type: o.type, occurredAt: now, amount: spec ? portionOf(o.type, portions) : null, note: null, mutationId: `notif:${o.key}` });
        await confirmOccurrence(db, schedules, saved, { scheduleId: o.scheduleId, key: o.key }).catch(() => {});
        markLogged();
        signalLogged({ eventId: saved.id, type: o.type });
      } else {
        await setMark(db, o.scheduleId, o.key, 'done');
      }
      bump();
      router.push({ pathname: '/done', params: { type: o.type, title: o.title, late: String(late) } });
    } catch {
      errorFeedback();
      setError(t('Could not save. Your entry was not recorded — please try again.'));
    } finally {
      busy.current = false;
    }
  };

  return (
    <Animated.View
      key={o.key}
      entering={motionReduced() ? undefined : FadeInDown.springify().damping(16)}
      exiting={motionReduced() ? undefined : FadeOutUp.duration(180)}
      style={[styles.card, { backgroundColor: `${meta.color}1A` }]}
    >
      <View style={styles.top}>
        <Pulse amount={0.06} period={1300} active={!motionReduced()}>
          <KindIcon type={o.type} size={58} />
        </Pulse>
        <View style={{ flex: 1 }}>
          <T weight="black" style={[styles.kicker, { color: overdue ? '#E58A00' : meta.color }]}>
            {overdue ? t('OVERDUE') : t('DUE NOW')} · {formatTime24to12(o.time)}
          </T>
          <T weight="black" style={styles.title} numberOfLines={2}>
            {o.title}
          </T>
        </View>
        <Bouncy accessibilityRole="button" accessibilityLabel={t('Snooze {title} 30 minutes', { title: o.title })} onPress={() => snoozeOccurrence(db, o, bump)} style={styles.snooze} hitSlop={6}>
          <T weight="black" style={{ fontSize: 12, letterSpacing: 0.8, color: colors.inkSoft }}>
            {t('+30 MIN')}
          </T>
        </Bouncy>
      </View>
      <SlideToConfirm label={t('Slide when it’s done')} doneLabel={t('Done!')} color={meta.color} tint="#FFFFFF" onComplete={complete} testID={`slide-${o.key}`} />
      {error ? <T style={styles.error}>{error}</T> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 30, padding: 14, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 4 },
  kicker: { fontSize: 12, letterSpacing: 1.2 },
  title: { fontSize: 21, lineHeight: 26 },
  snooze: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
});
