/**
 * Insights cards for the Summary screen, in Clucky's style — all from the owner's own logs against
 * their own daily plan:
 *  - a weekly report card with a grade (how much of the plan was coloured in over the last 7 days);
 *  - stat chips on rolling digits;
 *  - "Days coloured in": a pill bar per day, today highlighted;
 *  - a care heatmap of the last 18 weeks (tap a day to open it).
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import type { CareType, Species } from '../domain/care';
import { Plan, computeProgress } from '../domain/progress';
import { addDays, parseDayKey } from '../domain/time';
import { monthNamesShort, weekdayInitials } from '../i18n/dates';
import { Flame } from './HomeFeed';
import { PetAvatar } from '../animation/PetAvatar';
import { RollingNumber } from '../ui/Rolling';
import { Ring, motionReduced } from '../ui/motion';
import { T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t } from '../i18n';

type DayLogs = Map<string, { type: CareType; occurredAt: number; amount?: number | null }[]>;

const ratioOf = (plan: Plan, byDay: DayLogs, k: string) => computeProgress(plan, byDay.get(k) ?? []).ratio;

export function weekGrade(avg: number): { grade: string; line: string; color: string } {
  if (avg >= 0.95) return { grade: 'A+', line: t('Clockwork week.'), color: '#14B8C4' };
  if (avg >= 0.85) return { grade: 'A', line: t('Great week.'), color: '#14B8C4' };
  if (avg >= 0.7) return { grade: 'B', line: t('Good week.'), color: '#58C322' };
  if (avg >= 0.5) return { grade: 'C', line: t('Getting there.'), color: '#FFB648' };
  return { grade: 'D', line: t('A fresh start awaits.'), color: '#FF8A1F' };
}

export function WeekReport({ plan, byDay, today, species, name, since }: { plan: Plan; byDay: DayLogs; today: string; species: Species; name: string; since: string }) {
  // only days since the pet joined count (a new owner isn't graded on days before they started)
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter((k) => k >= since);
  const tracked = days.length;
  const ratios = days.map((k) => ratioOf(plan, byDay, k));
  const avg = ratios.reduce((a, b) => a + b, 0) / Math.max(1, tracked);
  const full = ratios.filter((r) => r >= 1).length;
  const cares = days.reduce((s, k) => s + (byDay.get(k)?.length ?? 0), 0);
  const early = tracked < 3;
  const g = early ? { grade: '', line: t('Your first report is on its way.'), color: colors.brand } : weekGrade(avg);
  return (
    <Animated.View entering={motionReduced() ? undefined : FadeInDown.springify().damping(16)} style={styles.report} accessible accessibilityLabel={`${t('{name}’s week', { name })}: ${g.grade}. ${g.line}`}>
      <Ring size={96} stroke={8} value={avg} color={g.color} track="#FFFFFF22">
        <View style={[styles.gradeDisc, { backgroundColor: g.color }]}>
          {early ? (
            <PetAvatar species={species} size={56} mood="hello" />
          ) : (
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 30, letterSpacing: -1 }}>
              {g.grade}
            </T>
          )}
        </View>
      </Ring>
      <View style={{ flex: 1, marginRight: early ? 0 : 34 }}>
        <View style={[styles.reportTag, { backgroundColor: g.color }]}>
          <T weight="black" style={{ color: '#FFFFFF', fontSize: 11, letterSpacing: 1 }}>
            {t('WEEKLY REPORT')}
          </T>
        </View>
        <T weight="black" style={{ color: '#FFFFFF', fontSize: 22, marginTop: 6 }}>
          {g.line}
        </T>
        <T weight="xbold" style={{ color: '#FFFFFFA0', fontSize: 13, marginTop: 2 }}>
          {early ? t('Grades start after 3 days of care. {n} so far.', { n: tracked }) : t('{n} of {d} days coloured in · {c} cares', { n: full, d: tracked, c: cares })}
        </T>
      </View>
      {early ? null : (
        <View style={styles.reportPet} pointerEvents="none">
          <PetAvatar species={species} size={64} mood={avg >= 0.7 ? 'trophy' : 'please'} />
        </View>
      )}
    </Animated.View>
  );
}

export function StatChips({ plan, byDay, today, streak }: { plan: Plan; byDay: DayLogs; today: string; streak: number }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const cares = days.reduce((s, k) => s + (byDay.get(k)?.length ?? 0), 0);
  const full = days.filter((k) => ratioOf(plan, byDay, k) >= 1).length;
  const items = [
    { icon: <T style={{ fontSize: 18 }}>🐾</T>, value: cares, label: t('Cares this week') },
    { icon: <T style={{ fontSize: 18 }}>✅</T>, value: full, label: t('Full days') },
    { icon: <Flame size={22} lit={streak > 0} />, value: streak, label: t('Streak') },
  ];
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <View key={it.label} style={styles.chip} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
          {it.icon}
          <RollingNumber value={it.value} size={26} lineHeight={30} />
          <T weight="xbold" style={{ fontSize: 12, color: colors.muted }} numberOfLines={1} adjustsFontSizeToFit>
            {it.label}
          </T>
        </View>
      ))}
    </View>
  );
}

function DayBar({ ratio, label, today, index }: { ratio: number; label: string; today: boolean; index: number }) {
  const v = useSharedValue(motionReduced() ? ratio : 0);
  useEffect(() => {
    if (motionReduced()) return;
    v.value = withDelay(index * 70, withSpring(ratio, { damping: 15, stiffness: 110 }));
  }, [ratio, index, v]);
  const fill = useAnimatedStyle(() => ({ height: `${Math.max(v.value, 0.001) * 100}%` }));
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <T weight="black" style={{ fontSize: 11, color: today ? colors.brand : colors.muted }}>
        {Math.round(ratio * 100)}%
      </T>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: today ? colors.brand : '#B9BFCB' }, fill]} />
      </View>
      <T weight="black" style={{ fontSize: 12, color: today ? colors.ink : colors.muted }}>
        {label}
      </T>
    </View>
  );
}

export function DaysColoured({ plan, byDay, today }: { plan: Plan; byDay: DayLogs; today: string }) {
  const ini = weekdayInitials();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const ratios = days.map((k) => ratioOf(plan, byDay, k));
  const avg = Math.round((ratios.reduce((a, b) => a + b, 0) / 7) * 100);
  return (
    <View style={styles.cardWhite}>
      <T weight="black" style={styles.cardTitle}>
        {t('Days coloured in')}
      </T>
      <T weight="xbold" style={styles.cardSub}>
        {t('{n}% of the plan on average', { n: avg })}
      </T>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {days.map((k, i) => (
          <DayBar key={k} ratio={ratios[i]} label={ini[parseDayKey(k).getDay()]} today={k === today} index={i} />
        ))}
      </View>
    </View>
  );
}

const WEEKS = 18;

export function CareHeatmap({ plan, byDay, today }: { plan: Plan; byDay: DayLogs; today: string }) {
  const grid = useMemo(() => {
    const d = parseDayKey(today);
    const monday = addDays(today, -((d.getDay() + 6) % 7));
    return Array.from({ length: WEEKS }, (_, w) => {
      const start = addDays(monday, (w - (WEEKS - 1)) * 7);
      return Array.from({ length: 7 }, (_, r) => {
        const k = addDays(start, r);
        const future = k > today;
        return { k, future, ratio: future ? 0 : ratioOf(plan, byDay, k), logged: (byDay.get(k)?.length ?? 0) > 0 };
      });
    });
  }, [plan, byDay, today]);
  const total = grid.flat().filter((c) => c.ratio >= 1).length;
  const months = grid.map((col, i) => {
    const m = parseDayKey(col[0].k).getMonth();
    const prev = i > 0 ? parseDayKey(grid[i - 1][0].k).getMonth() : -1;
    return m !== prev ? monthNamesShort()[m].replace('.', '') : '';
  });
  const shade = (r: number, logged: boolean) => (r >= 1 ? colors.brand : r >= 0.66 ? '#5CCFD7' : r >= 0.33 ? '#A6E4E8' : logged || r > 0 ? '#D3F1F3' : '#E9EBEF');
  return (
    <View style={styles.cardWhite}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <T weight="black" style={[styles.cardTitle, { flex: 1 }]}>
          {t('Care calendar')}
        </T>
        <RollingNumber value={total} size={22} lineHeight={26} />
        <T weight="xbold" style={{ color: colors.muted, marginLeft: 4 }}>
          {t('full days')}
        </T>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 3, height: 16 }}>
            {months.map((m, i) => (
              <View key={i} style={{ flex: 1 }}>
                <T weight="black" style={{ fontSize: 10, color: colors.muted, width: 40 }} numberOfLines={1}>
                  {m}
                </T>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {grid.map((col, i) => (
              <View key={i} style={{ flex: 1, gap: 3 }}>
                {col.map((c) => (
                  <Pressable
                    key={c.k}
                    disabled={c.future}
                    onPress={() => router.push({ pathname: '/day', params: { day: c.k } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.k}: ${Math.round(c.ratio * 100)}%`}
                    style={[styles.cell, { backgroundColor: c.future ? 'transparent' : shade(c.ratio, c.logged) }, c.k === today && styles.cellToday]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.legendRow}>
        <T weight="xbold" style={{ fontSize: 11, color: colors.muted }}>
          {t('Less')}
        </T>
        {[0, 0.2, 0.5, 0.8, 1].map((r) => (
          <View key={r} style={[styles.legendCell, { backgroundColor: shade(r, r > 0) }]} />
        ))}
        <T weight="xbold" style={{ fontSize: 11, color: colors.muted }}>
          {t('More')}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  report: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.ink, borderRadius: 30, padding: 16, marginTop: 22, overflow: 'hidden' },
  gradeDisc: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  reportTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  reportPet: { position: 'absolute', right: -6, bottom: -10, opacity: 0.9 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, backgroundColor: colors.card, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'flex-start', gap: 2 },
  cardWhite: { backgroundColor: '#FFFFFF', borderRadius: 30, borderWidth: 2, borderColor: colors.line, padding: 16, marginTop: 12 },
  cardTitle: { fontSize: 19 },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 1 },
  barTrack: { width: '82%', height: 120, borderRadius: 20, backgroundColor: '#EEF0F3', overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 20 },
  cell: { aspectRatio: 1, borderRadius: 4 },
  cellToday: { borderWidth: 2, borderColor: colors.ink },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 10 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
});
