import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { CARE, CareType, SPECIES_CARE } from '../domain/care';
import { computeProgress } from '../domain/progress';
import { addDays, dayKeyOf, parseDayKey } from '../domain/time';
import { monthNamesShort, weekdayInitials } from '../i18n/dates';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { MonthGrid, MonthNav } from '../ui/forms';
import { Bouncy, CountUp, Ring, motionReduced } from '../ui/motion';
import { CircleButton, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { tapFeedback } from '../native/haptics';
import { t } from '../i18n';

type Range = 'days' | 'weeks' | 'months';
type Col = { label: string; total: number; parts: { type: CareType; n: number }[]; highlight: boolean };

function Column({ col, max, h, index }: { col: Col; max: number; h: number; index: number }) {
  const v = useSharedValue(motionReduced() ? 1 : 0);
  useEffect(() => {
    if (motionReduced()) return;
    v.value = 0;
    v.value = withDelay(index * 60, withSpring(1, { damping: 14, stiffness: 120 }));
  }, [col, v, index]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: v.value }], opacity: Math.min(1, v.value * 2) }));
  const height = max ? (col.total / max) * h : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ height: h + 18, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
        {col.total ? (
          <T weight="black" style={{ fontSize: 11, color: colors.brand, marginBottom: 3 }}>
            {col.total}
          </T>
        ) : null}
        <Animated.View style={[{ width: '72%', height, justifyContent: 'flex-end', gap: 2, transformOrigin: 'bottom' }, a]}>
          {col.parts.map((p) => (
            <View key={p.type} style={{ height: Math.max(3, (p.n / col.total) * height - 2), borderRadius: 6, backgroundColor: CARE[p.type].color }} />
          ))}
        </Animated.View>
      </View>
      <T weight="black" style={{ fontSize: 11, marginTop: 6, color: col.highlight ? colors.brand : colors.muted }}>
        {col.label}
      </T>
    </View>
  );
}

export default function Summary() {
  const { pet, plan, pro } = useApp();
  const { byDay, streak } = useEngagement();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>('days');
  const today = dayKeyOf(new Date());
  const [month, setMonth] = useState(today);
  const W = Math.min(width, 560);

  const todayProgress = computeProgress(plan, byDay.get(today) ?? []);

  const cols: Col[] = useMemo(() => {
    const sum = (keys: string[]) => {
      const counts = new Map<CareType, number>();
      for (const k of keys) for (const e of byDay.get(k) ?? []) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      const parts = [...counts.entries()].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n);
      return { parts, total: parts.reduce((s, p) => s + p.n, 0) };
    };
    const ini = weekdayInitials();
    if (range === 'days') {
      return Array.from({ length: 7 }, (_, i) => {
        const k = addDays(today, i - 6);
        return { label: ini[parseDayKey(k).getDay()], ...sum([k]), highlight: k === today };
      });
    }
    if (range === 'weeks') {
      const d = parseDayKey(today);
      const monday = addDays(today, -((d.getDay() + 6) % 7));
      return Array.from({ length: 8 }, (_, i) => {
        const start = addDays(monday, (i - 7) * 7);
        const keys = Array.from({ length: 7 }, (_, j) => addDays(start, j));
        return { label: String(parseDayKey(start).getDate()), ...sum(keys), highlight: i === 7 };
      });
    }
    const d = parseDayKey(today);
    return Array.from({ length: 6 }, (_, i) => {
      const m0 = new Date(d.getFullYear(), d.getMonth() - (5 - i), 1);
      const days = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
      const keys = Array.from({ length: days }, (_, j) => dayKeyOf(new Date(m0.getFullYear(), m0.getMonth(), j + 1)));
      return { label: monthNamesShort()[m0.getMonth()].replace('.', ''), ...sum(keys), highlight: i === 5 };
    });
  }, [range, byDay, today]);

  const max = Math.max(1, ...cols.map((c) => c.total));
  const legend = useMemo(() => {
    const m = new Map<CareType, number>();
    cols.forEach((c) => c.parts.forEach((p) => m.set(p.type, (m.get(p.type) ?? 0) + p.n)));
    const total = [...m.values()].reduce((s, n) => s + n, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, pct: Math.round((n / Math.max(1, total)) * 100) }));
  }, [cols]);

  const dots = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [k, list] of byDay) out[k] = [...new Set(list.map((e) => CARE[e.type].color))];
    return out;
  }, [byDay]);

  if (!pet) return null;
  const pick = (r: Range) => {
    tapFeedback();
    if (r !== 'days' && !pro) return router.push({ pathname: '/paywall', params: { reason: 'stats' } });
    setRange(r);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <View style={styles.top}>
          <View style={{ width: 44 }} />
          <View style={{ flex: 1 }} />
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={44} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Ring size={170} stroke={16} value={todayProgress.ratio} track={colors.brandSoft}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <CountUp value={Math.round(todayProgress.ratio * 100)} style={{ fontSize: 44, color: colors.brand }} />
                  <T weight="black" style={{ fontSize: 22, color: colors.brand }}>
                    %
                  </T>
                </View>
                <T weight="black" style={{ fontSize: 11, color: colors.muted, letterSpacing: 1.2, textAlign: 'center' }}>
                  {t("TODAY'S PLAN")}
                </T>
              </View>
            </Ring>
            <T weight="xbold" style={{ color: colors.muted, marginTop: 10 }}>
              {t('{name} · {n}-day streak · best {b}', { name: pet.name, n: streak.current, b: streak.best })}
            </T>
          </View>

          <View style={[styles.card, softShadow]}>
            <View style={styles.seg}>
              {(['days', 'weeks', 'months'] as Range[]).map((r) => (
                <Pressable key={r} accessibilityRole="tab" accessibilityState={{ selected: range === r }} onPress={() => pick(r)} style={[styles.segBtn, range === r && styles.segOn]}>
                  <T weight="black" style={{ fontSize: 15, color: range === r ? colors.ink : colors.muted }}>
                    {r === 'days' ? t('Days') : r === 'weeks' ? t('Weeks') : t('Months')}
                    {r !== 'days' && !pro ? ' 🔒' : ''}
                  </T>
                </Pressable>
              ))}
            </View>
            <T weight="black" style={{ textAlign: 'center', fontSize: 17, marginTop: 14 }}>
              {range === 'days' ? t('Last 7 days') : range === 'weeks' ? t('Last 8 weeks') : t('Last 6 months')}
            </T>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {cols.map((c, i) => (
                <Column key={`${range}-${i}`} col={c} max={max} h={150} index={i} />
              ))}
            </View>
            <View style={styles.legend}>
              {legend.length === 0 ? (
                <T style={{ color: colors.muted }}>{t('Nothing logged in this period yet.')}</T>
              ) : (
                legend.map((l) => (
                  <View key={l.type} style={[styles.chip, { backgroundColor: CARE[l.type].tint }]}>
                    <T weight="black" style={{ fontSize: 12, color: CARE[l.type].color }}>
                      {l.pct}% {CARE[l.type].label}
                    </T>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={[styles.card, softShadow]}>
            <MonthNav month={month} onChange={setMonth} />
            <MonthGrid month={month} selected={null} dots={dots} maxDay={today} onSelect={(k) => router.push({ pathname: '/day', params: { day: k } })} />
            <View style={styles.legend}>
              {SPECIES_CARE[pet.species].map((ty) => (
                <View key={ty} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CARE[ty].color }} />
                  <T weight="xbold" style={{ fontSize: 12, color: colors.muted }}>
                    {CARE[ty].label}
                  </T>
                </View>
              ))}
            </View>
          </View>
          <Bouncy onPress={() => router.push({ pathname: '/day', params: { day: today } })} style={styles.link} accessibilityRole="button">
            <T weight="black" style={{ color: colors.brand, fontSize: 15 }}>
              {t("Open today's log")}
            </T>
          </Bouncy>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, zIndex: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 16, marginTop: 20 },
  seg: { flexDirection: 'row', backgroundColor: colors.line, borderRadius: 18, padding: 4 },
  segBtn: { flex: 1, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  link: { alignSelf: 'center', marginTop: 16, padding: 10 },
});
