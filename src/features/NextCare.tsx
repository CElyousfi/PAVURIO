/**
 * "Next care" (Clucky's "Next wakeup" card): a tick dial that fills as the next scheduled care gets
 * closer, the time big on the right, and two chips underneath — what it is (opens Care) and whether
 * it will remind you. Real data only: today's next open occurrence of the owner's routines.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Line } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { nextUp } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';
import { useApp, useOccurrences } from '../state/AppState';
import { KindIcon, kindMeta } from './routines';
import { RollingNumber } from '../ui/Rolling';
import { Bouncy, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { uses24h } from '../i18n/dates';
import { t } from '../i18n';

const WINDOW_MIN = 240; // the dial spans the last 4 hours before it's due

function untilText(min: number) {
  if (min <= 0) return t('Due now');
  if (min < 60) return t('in {n} min', { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? t('in {h} h {m} min', { h, m }) : t('in {h} h', { h });
}

export function NextCareCard({ width }: { width: number }) {
  const { schedules } = useApp();
  const occ = useOccurrences(dayKeyOf(new Date()));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const next = nextUp(occ, now);
  if (!next) return null;
  const meta = kindMeta(next.type);
  const at = next.snoozeUntil && next.status === 'snoozed' ? next.snoozeUntil : next.at;
  const min = Math.max(0, Math.round((at - now) / 60_000));
  const closeness = Math.max(0, Math.min(1, 1 - min / WINDOW_MIN));
  const d = new Date(at);
  const h = d.getHours();
  const clock = uses24h() ? `${h}:${String(d.getMinutes()).padStart(2, '0')}` : `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  const ampm = uses24h() ? '' : h >= 12 ? 'PM' : 'AM';
  const remind = schedules.find((s) => s.id === next.scheduleId)?.remind ?? false;

  // the dial: an arc of ticks over the time; lit ticks = how close it is
  const W = width - 40 - 28;
  const R = W * 0.42;
  const cx = W / 2;
  const cy = R + 14;
  const N = 34;
  const lit = Math.round(closeness * N);

  return (
    <Animated.View entering={motionReduced() ? undefined : FadeIn.duration(260)} style={styles.card} accessible accessibilityLabel={`${t('Next care')}: ${next.title}, ${clock} ${ampm}, ${untilText(min)}`}>
      <Svg width={W} height={cy - R * 0.2} style={{ position: 'absolute', top: 10, left: 14 }} pointerEvents="none">
        {Array.from({ length: N + 1 }, (_, i) => {
          const a = Math.PI * (1.08 + (0.84 * i) / N);
          const long = i % 5 === 0;
          const r1 = R - (long ? 16 : 10);
          return (
            <Line
              key={i}
              x1={cx + r1 * Math.cos(a)}
              y1={cy + r1 * Math.sin(a)}
              x2={cx + R * Math.cos(a)}
              y2={cy + R * Math.sin(a)}
              stroke={i <= lit ? meta.color : '#DADDE3'}
              strokeWidth={long ? 4 : 3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={{ alignItems: 'center', paddingTop: R * 0.42 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <RollingNumber value={clock} size={54} lineHeight={60} style={{ letterSpacing: -1.5 }} />
          {ampm ? (
            <T weight="black" style={{ fontSize: 19, marginBottom: 9, marginLeft: 3 }}>
              {ampm}
            </T>
          ) : null}
        </View>
        <T weight="black" style={{ color: next.status === 'overdue' ? '#E58A00' : meta.color, fontSize: 15, marginTop: 2 }}>
          {next.status === 'overdue' ? t('Overdue') : t('Next care')}
          <T weight="xbold" style={{ color: colors.muted, fontSize: 15 }}>
            {' · '}
            {untilText(min)}
          </T>
        </T>
      </View>
      <View style={styles.chips}>
        <Bouncy scaleTo={0.96} onPress={() => router.push('/care')} accessibilityRole="button" accessibilityLabel={next.title} style={[styles.chip, { flex: 1.7 }]}>
          <KindIcon type={next.type} size={30} />
          <T weight="black" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
            {next.title}
          </T>
          <Icon name="chevR" size={16} color={colors.faint} />
        </Bouncy>
        <Bouncy scaleTo={0.96} onPress={() => router.push({ pathname: '/schedule', params: { id: next.scheduleId } })} accessibilityRole="button" accessibilityLabel={remind ? t('Reminder on') : t('Reminder off')} style={styles.chip}>
          <T style={{ fontSize: 20 }}>{remind ? '🔔' : '🔕'}</T>
          <T weight="black" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
            {remind ? t('On') : t('Off')}
          </T>
          <Icon name="chevR" size={16} color={colors.faint} />
        </Bouncy>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 30, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 14, marginTop: 6, overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 10, borderRadius: 18, backgroundColor: '#FFFFFF' },
});
