/**
 * What the reminders for a routine will actually do, drawn like Clucky's "Rooster patrol" gauge:
 * a dark card with a dial, the reminder time on the left and — for meals and medicine — the one gentle
 * follow-up 30 minutes later if it's still open (that's how notifications.ts plans them). Read-only.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { KindIcon, kindMeta } from './routines';
import { formatTime24to12 } from '../domain/schedule';
import { motionReduced } from '../ui/motion';
import { T } from '../ui/primitives';
import { t } from '../i18n';

const AnimatedPath = Animated.createAnimatedComponent(Path);
export const FOLLOW_UP_MIN = 30;
const followsUp = (type: string) => type === 'meal' || type === 'medication';

function plus(time: string, min: number) {
  const [h, m] = time.split(':').map(Number);
  const v = (h * 60 + m + min) % (24 * 60);
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

export function FollowUpCard({ type, time, remind }: { type: string; time: string; remind: boolean }) {
  const meta = kindMeta(type);
  const on = remind && followsUp(type);
  const W = 300;
  const H = 150;
  const cx = W / 2;
  const cy = H - 6;
  const r = 118;
  // the coloured stretch from the reminder (left end) to the follow-up (right end) draws in
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = 0;
    sweep.value = motionReduced() ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [on, type, sweep]);
  const arcLen = Math.PI * r;
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: arcLen * (1 - sweep.value) }));
  const pt = (a: number, rr = r) => ({ x: cx + rr * Math.cos(Math.PI + a * Math.PI), y: cy + rr * Math.sin(Math.PI + a * Math.PI) });
  const ticks = Array.from({ length: 25 }, (_, i) => i / 24);
  const start = pt(0);
  const end = pt(1);

  return (
    <View style={styles.card} accessible accessibilityLabel={on ? t('Reminder at {time}, then one follow-up {n} minutes later if it’s still open.', { time: formatTime24to12(time), n: FOLLOW_UP_MIN }) : remind ? t('One reminder at {time}.', { time: formatTime24to12(time) }) : t('No reminders for this routine.')}>
      <View style={{ width: W, alignItems: 'center' }}>
        <Svg width={W} height={H}>
          {ticks.map((a, i) => {
            const p1 = pt(a, r - 10);
            const p2 = pt(a, r + (i % 6 === 0 ? 8 : 2));
            return <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#FFFFFF33" strokeWidth={i % 6 === 0 ? 3 : 2} strokeLinecap="round" />;
          })}
          <AnimatedPath d={`M${start.x} ${start.y} A${r} ${r} 0 0 1 ${end.x} ${end.y}`} stroke={meta.color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${arcLen} ${arcLen}`} animatedProps={arcProps} />
          {remind ? <Circle cx={start.x} cy={start.y} r={11} fill={meta.color} stroke="#23304A" strokeWidth={3} /> : null}
          {on ? <Circle cx={end.x} cy={end.y} r={11} fill="#FFFFFF" stroke={meta.color} strokeWidth={4} /> : null}
        </Svg>
        <View style={[styles.center, { top: H - 74 }]}>
          <KindIcon type={type} size={58} />
        </View>
        {remind ? (
          <T weight="black" style={[styles.mark, { position: 'absolute', left: 0, top: H - 2 }]}>
            {formatTime24to12(time)}
          </T>
        ) : null}
        {on ? (
          <Animated.View entering={motionReduced() ? undefined : FadeIn.delay(500)} style={[styles.markWrap, { right: 0, top: H - 2 }]}>
            <T weight="black" style={styles.mark}>
              {formatTime24to12(plus(time, FOLLOW_UP_MIN))}
            </T>
          </Animated.View>
        ) : null}
      </View>
      <T weight="black" style={styles.big}>
        {on ? t('1 gentle follow-up') : remind ? t('On time, once') : t('Reminders off')}
      </T>
      <T style={styles.small}>
        {on
          ? t('{n} min after, only if it’s still open', { n: FOLLOW_UP_MIN })
          : remind
            ? t('Meals and medicine also get a follow-up')
            : t('Turn on Remind me below')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#23304A', borderRadius: 28, paddingTop: 18, paddingBottom: 18, paddingHorizontal: 16, alignItems: 'center' },
  center: { position: 'absolute', alignSelf: 'center' },
  markWrap: { position: 'absolute' },
  mark: { color: '#FFFFFFB0', fontSize: 12 },
  big: { color: '#FFFFFF', fontSize: 24, marginTop: 22 },
  small: { color: '#FFFFFF99', fontSize: 14, marginTop: 2, textAlign: 'center' },
});
