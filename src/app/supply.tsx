/**
 * One product up close: its illustration filled to what's left, the days it lasts, the three numbers
 * that matter (in stock, daily use, order by) and "Why this estimate?" in plain words. Restock with a
 * slide, correct the level after a look in the bag, and undo the last purchase if it was a mistake.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { monthlyCost } from '../domain/supplies';
import { setDefault, setStock, undoPurchase } from '../data/suppliesRepo';
import { BuySheet, KIND_META, PantryIcon, STATUS_META, StockBar, dayName, formatShort, headline, qty, useSupplies, whoUses, whyLines } from '../features/supplies';
import { useApp } from '../state/AppState';
import { ScreenHeader, Sheet } from '../ui/forms';
import { RollingNumber } from '../ui/Rolling';
import { Bouncy, motionReduced } from '../ui/motion';
import { Icon, Pill, SoftPill, T, Column } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback, tapFeedback, undoFeedback } from '../native/haptics';
import { t, tn } from '../i18n';

const CHECK = [1, 0.75, 0.5, 0.25, 0];

export default function SupplyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pet, pets, db, bump } = useApp();
  const insets = useSafeAreaInsets();
  const { forecasts, all, purchases, defaults, now } = useSupplies();
  const [buying, setBuying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [why, setWhy] = useState(false);
  const f = all?.find((x) => x.supply.id === id) ?? forecasts?.find((x) => x.supply.id === id);
  if (!pet || !all || !f) return null;
  const s = f.supply;
  const meta = KIND_META[s.kind];
  const st = STATUS_META[f.status];
  const cost = monthlyCost(f);
  const history = purchases.filter((p) => p.supplyId === s.id);
  const full = Math.max(s.packSize, f.left);
  const who = whoUses(f, pets) || pet.name;
  const isDefault = s.link ? defaults[pet.id]?.[s.link] === s.id : true;

  const correct = async (share: number) => {
    await setStock(db, s.id, full * share);
    successFeedback();
    bump();
    setChecking(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Column>
      <View style={{ paddingHorizontal: 18 }}>
        <ScreenHeader title={s.name} onClose={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={motionReduced() ? undefined : FadeInDown.springify().damping(16)} style={[styles.hero, { backgroundColor: meta.tint }]}>
          <PantryIcon kind={s.kind} size={150} level={f.level} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
            {Number.isFinite(f.daysLeft) ? (
              <>
                <RollingNumber value={Math.max(0, Math.floor(f.daysLeft))} size={52} lineHeight={58} style={{ color: st.color }} />
                <T weight="black" style={{ color: colors.inkSoft, fontSize: 17, marginBottom: 9 }}>
                  {tn(Math.max(0, Math.floor(f.daysLeft)), 'day left', 'days left')}
                </T>
              </>
            ) : (
              <T weight="black" style={{ fontSize: 28 }}>
                {qty(f.left, s.unit)}
              </T>
            )}
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <StockBar f={f} height={12} />
          </View>
          <T weight="xbold" style={{ color: st.color, fontSize: 15, marginTop: 10 }}>
            {headline(f, now)}
          </T>
        </Animated.View>

        <View style={styles.card}>
          <Stat icon="📦" label={t('In stock')} value={qty(f.left, s.unit)} />
          <Stat icon="📈" label={t('Daily use')} value={f.perDay > 0 ? qty(f.perDay, s.unit) : '—'} />
          <Stat icon="🛒" label={t('Order by')} value={f.buyBy != null ? (f.buyBy <= now ? t('today') : dayName(f.buyBy, now)) : '—'} />
          {cost != null ? <Stat icon="💶" label={t('Per month')} value={cost.toFixed(cost >= 10 ? 0 : 2)} /> : null}
          {pets.length > 1 ? <Stat icon="🐾" label={t('Used by')} value={who} /> : null}
          <Bouncy scaleTo={0.98} onPress={() => (tapFeedback(), setWhy((w) => !w))} accessibilityRole="button" accessibilityState={{ expanded: why }} style={styles.whyHead} testID="supply-why">
            <T weight="black" style={{ color: colors.brand, flex: 1, fontSize: 15 }}>
              {t('Why this estimate?')}
            </T>
            {f.confidence === 'estimated' ? (
              <View style={[styles.conf, { backgroundColor: '#FFF7D6' }]}>
                <T weight="black" style={{ fontSize: 11, color: '#A07C00' }}>
                  {t('Estimated')}
                </T>
              </View>
            ) : f.source === 'logs' || f.source === 'plan' ? (
              <View style={[styles.conf, { backgroundColor: '#E7F6E9' }]}>
                <T weight="black" style={{ fontSize: 11, color: '#3FA34D' }}>
                  {f.source === 'logs' ? t('From your logs') : t('From the routine')}
                </T>
              </View>
            ) : null}
            <Icon name={why ? 'up' : 'down'} size={18} color={colors.brand} />
          </Bouncy>
          {why ? (
            <Animated.View entering={motionReduced() ? undefined : FadeIn.duration(160)} style={{ gap: 6, paddingTop: 2 }}>
              {whyLines(f, who, now).map((l) => (
                <T key={l} style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 20 }}>
                  • {l}
                </T>
              ))}
            </Animated.View>
          ) : null}
        </View>

        {s.link && !isDefault ? (
          <Bouncy
            scaleTo={0.98}
            onPress={async () => {
              await setDefault(db, pet.id, s.link!, s.id);
              successFeedback();
              bump();
            }}
            accessibilityRole="button"
            style={styles.notice}
          >
            <T weight="xbold" style={{ flex: 1, color: colors.inkSoft, fontSize: 14 }}>
              {s.link === 'meal' ? t('Use this for {name}’s meals from now on', { name: pet.name }) : t('Use this for {name}’s doses from now on', { name: pet.name })}
            </T>
            <Icon name="chevR" size={16} color={colors.faint} />
          </Bouncy>
        ) : null}

        <Pill label={t('Restock')} color={meta.color} onPress={() => setBuying(true)} testID="supply-bought" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SoftPill label={t('Update stock')} onPress={() => setChecking(true)} style={{ flex: 1 }} />
          <SoftPill label={t('Edit')} onPress={() => router.push({ pathname: '/supply-edit', params: { id: s.id } })} style={{ flex: 1 }} />
        </View>

        {history.length ? (
          <View style={styles.card}>
            <T weight="black" style={{ fontSize: 16, marginBottom: 6 }}>
              {t('Bought')}
            </T>
            {history.slice(0, 8).map((h, i) => (
              <View key={h.id} style={styles.histRow}>
                <T weight="xbold" style={{ flex: 1 }}>
                  {formatShort(h.at)}
                </T>
                <T weight="black">
                  {h.packs} × {qty(h.packSize, s.unit)}
                  {h.price != null ? ` · ${h.price}` : ''}
                </T>
                {i === 0 ? (
                  <Bouncy
                    scaleTo={0.92}
                    onPress={async () => {
                      await undoPurchase(db, h.id);
                      undoFeedback();
                      bump();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Undo')}
                    style={styles.undo}
                  >
                    <T weight="black" style={{ fontSize: 12, color: colors.inkSoft }}>
                      {t('Undo')}
                    </T>
                  </Bouncy>
                ) : null}
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
              <PantryIcon kind={s.kind} level={v} size={54} />
              <T weight="black" style={{ fontSize: 13 }}>
                {v === 0 ? t('Empty') : v === 1 ? t('Full') : v === 0.75 ? '¾' : v === 0.5 ? '½' : '¼'}
              </T>
            </Bouncy>
          ))}
        </View>
      </Sheet>
      </Column>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <T style={{ fontSize: 16, width: 26 }}>{icon}</T>
      <T weight="xbold" style={{ flex: 1, color: colors.muted, fontSize: 15 }}>
        {label}
      </T>
      <T weight="black" style={{ fontSize: 15 }} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  hero: { alignItems: 'center', borderRadius: 30, padding: 18 },
  card: { backgroundColor: colors.card, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#FFFFFF' },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  conf: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.canvasWarm, borderRadius: 20, padding: 14 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF' },
  undo: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.line },
});
