/**
 * One supply up close: the container at its level right now, the days it lasts, when to order and why
 * (learned from logs, from the plan or manual), the cost per month, and the purchase history.
 * "I bought more" restocks with a slide; "Check the bag" corrects what's left in one tap.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { monthlyCost } from '../domain/supplies';
import { setStock } from '../data/suppliesRepo';
import { BuySheet, KIND_META, STATUS_META, SupplyArt, headline, qty, sourceLine, useSupplies } from '../features/supplies';
import { useApp } from '../state/AppState';
import { ScreenHeader, Sheet, formatDateLong } from '../ui/forms';
import { RollingNumber } from '../ui/Rolling';
import { Bouncy, motionReduced } from '../ui/motion';
import { Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { dayKeyOf } from '../domain/time';
import { successFeedback } from '../native/haptics';
import { t, tn } from '../i18n';

const CHECK = [1, 0.75, 0.5, 0.25, 0];

export default function SupplyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pet, db, bump } = useApp();
  const insets = useSafeAreaInsets();
  const { forecasts, purchases } = useSupplies();
  const [buying, setBuying] = useState(false);
  const [checking, setChecking] = useState(false);
  const f = forecasts?.find((x) => x.supply.id === id);
  if (!pet || !forecasts) return null;
  if (!f) return null;
  const s = f.supply;
  const now = Date.now();
  const meta = KIND_META[s.kind];
  const st = STATUS_META[f.status];
  const cost = monthlyCost(f);
  const history = purchases.filter((p) => p.supplyId === s.id);
  const full = Math.max(s.packSize, f.left);

  const correct = async (share: number) => {
    await setStock(db, s.id, full * share);
    successFeedback();
    bump();
    setChecking(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <ScreenHeader title={s.name} onClose={() => router.back()} right={undefined} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={motionReduced() ? undefined : FadeInDown.springify().damping(16)} style={[styles.hero, { backgroundColor: meta.tint }]}>
          <SupplyArt kind={s.kind} level={f.level} size={120} status={f.status} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[styles.status, { backgroundColor: st.tint }]}>
              <T weight="black" style={{ color: st.color, fontSize: 11, letterSpacing: 0.5 }}>
                {st.label().toUpperCase()}
              </T>
            </View>
            {Number.isFinite(f.daysLeft) ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <RollingNumber value={Math.max(0, Math.floor(f.daysLeft))} size={52} lineHeight={58} style={{ color: st.color }} />
                <T weight="black" style={{ color: colors.inkSoft, fontSize: 16, marginBottom: 9 }}>
                  {tn(Math.floor(f.daysLeft), 'day left', 'days left')}
                </T>
              </View>
            ) : null}
            <T weight="black" style={{ fontSize: 16 }}>
              {t('{q} left', { q: qty(f.left, s.unit) })}
            </T>
            <T weight="xbold" style={{ color: colors.inkSoft, fontSize: 14 }}>
              {headline(f, now)}
            </T>
          </View>
        </Animated.View>

        <View style={styles.card}>
          <T weight="black" style={{ fontSize: 16 }}>
            {sourceLine(f, pet.name)}
          </T>
          {f.runOutAt ? (
            <T style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
              {t('Runs out around {date}', { date: formatDateLong(dayKeyOf(new Date(f.runOutAt))) })}
              {f.buyBy ? ` · ${t('reminder {n} before', { n: tn(s.leadDays, '{n} day', '{n} days') })}` : ''}
            </T>
          ) : null}
          {cost != null ? (
            <T style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>{t('About {n} a month', { n: cost.toFixed(cost >= 10 ? 0 : 2) })}</T>
          ) : null}
        </View>

        <Pill label={t('I bought more')} color={meta.color} onPress={() => setBuying(true)} testID="supply-bought" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SoftPill label={t('Check level')} onPress={() => setChecking(true)} style={{ flex: 1 }} />
          <SoftPill label={t('Edit')} onPress={() => router.push({ pathname: '/supply-edit', params: { id: s.id } })} style={{ flex: 1 }} />
        </View>

        {history.length ? (
          <View style={styles.card}>
            <T weight="black" style={{ fontSize: 16, marginBottom: 6 }}>
              {t('Bought')}
            </T>
            {history.slice(0, 8).map((h) => (
              <View key={h.id} style={styles.histRow}>
                <T weight="xbold" style={{ flex: 1 }}>
                  {formatDateLong(dayKeyOf(new Date(h.at)))}
                </T>
                <T weight="black">
                  {h.packs} × {qty(h.packSize, s.unit)}
                  {h.price != null ? ` · ${h.price}` : ''}
                </T>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <BuySheet forecast={f} purchases={purchases} visible={buying} onClose={() => setBuying(false)} />
      <Sheet visible={checking} onClose={() => setChecking(false)} title={t('How full is it?')}>
        <T style={{ color: colors.muted, marginBottom: 12 }}>{t('A quick look in the bag keeps the forecast honest.')}</T>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {CHECK.map((v) => (
            <Bouncy key={v} scaleTo={0.92} onPress={() => void correct(v)} accessibilityRole="button" accessibilityLabel={v === 0 ? t('Empty') : v === 1 ? t('Full') : `${v * 100}%`} style={{ alignItems: 'center', gap: 4 }}>
              <SupplyArt kind={s.kind} level={v} size={50} />
              <T weight="black" style={{ fontSize: 13 }}>
                {v === 0 ? t('Empty') : v === 1 ? t('Full') : v === 0.75 ? '¾' : v === 0.5 ? '½' : '¼'}
              </T>
            </Bouncy>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 30, padding: 18 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  card: { backgroundColor: colors.card, borderRadius: 26, padding: 16 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
});
