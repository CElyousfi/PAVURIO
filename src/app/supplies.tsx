/**
 * Supplies: the pet's shelf. Every bag, can and bottle shows how full it is right now (worked out from
 * the care you log), how many days it lasts, and when to order so you never run out. The week's
 * shopping list sits on top, ready to share.
 */
import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Forecast, monthlyCost, shoppingList } from '../domain/supplies';
import { BuySheet, STATUS_META, SupplyArt, headline, qty, templatesFor, useSupplies } from '../features/supplies';
import { useApp } from '../state/AppState';
import { TabTitle } from '../ui/forms';
import { DarkTile } from '../ui/Tiles';
import { RollingNumber } from '../ui/Rolling';
import { Bouncy, motionReduced } from '../ui/motion';
import { CircleButton, Icon, Pill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

export default function Supplies() {
  const { pet, plan } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const { forecasts, purchases } = useSupplies();
  const [buying, setBuying] = useState<Forecast | null>(null);
  if (!pet) return null;
  const now = Date.now();
  const list = forecasts ? shoppingList(forecasts, now) : [];
  const monthly = (forecasts ?? []).map(monthlyCost).filter((x): x is number => x != null);
  const monthTotal = monthly.reduce((a, b) => a + b, 0);
  const cardW = (W - 40 - 12) / 2;

  const share = () => {
    const lines = list.map(({ f, packs }) => `• ${f.supply.name} — ${packs} × ${qty(f.supply.packSize, f.supply.unit)}`);
    void Share.share({ message: `${t('Shopping list for {name} 🐾', { name: pet.name })}\n${lines.join('\n')}` });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <TabTitle
          title={t('Supplies')}
          subtitle={t('Food, treats & meds for {name}', { name: pet.name })}
          right={<CircleButton icon="plus" label={t('Add a supply')} onPress={() => router.push('/supply-edit')} size={46} testID="supplies-add" />}
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 14 }} showsVerticalScrollIndicator={false}>
          {forecasts && forecasts.length === 0 ? (
            <View style={{ gap: 14 }}>
              <View style={styles.intro}>
                <T weight="black" style={{ fontSize: 22, color: '#FFFFFF' }}>
                  {t('Never run out of {name}’s food', { name: pet.name })}
                </T>
                <T style={{ color: '#FFFFFFB0', fontSize: 15, lineHeight: 21, marginTop: 6 }}>
                  {t('Add what’s on the shelf once. Pavurio follows the meals you log, works out what’s left and tells you when to order — before it runs out.')}
                </T>
              </View>
              <T weight="black" style={{ fontSize: 17 }}>
                {t('Start with')}
              </T>
              <View style={styles.grid}>
                {templatesFor(pet.species, plan).map((tp) => (
                  <DarkTile
                    key={tp.kind + tp.name()}
                    title={tp.name()}
                    subtitle={tp.link === 'meal' ? t('Follows logged meals') : tp.link === 'medication' ? t('Follows logged doses') : undefined}
                    art={<SupplyArt kind={tp.kind} level={0.7} size={62} />}
                    onPress={() => router.push({ pathname: '/supply-edit', params: { template: tp.kind, name: tp.name() } })}
                    height={112}
                    style={{ width: cardW }}
                    testID={`supply-template-${tp.kind}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {forecasts && forecasts.length > 0 ? (
            <>
              {/* the one card that tells you what to do this week */}
              <Animated.View entering={motionReduced() ? undefined : FadeInDown.springify().damping(16)} style={styles.summary}>
                {list.length ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <T style={{ fontSize: 26 }}>🛒</T>
                      <View style={{ flex: 1 }}>
                        <T weight="black" style={{ color: '#FFFFFF', fontSize: 20 }}>
                          {tn(list.length, '1 thing to buy this week', '{n} things to buy this week')}
                        </T>
                        <T weight="xbold" style={{ color: '#FFFFFFB0', fontSize: 14 }} numberOfLines={1}>
                          {list[0].f.supply.name} · {headline(list[0].f, now)}
                        </T>
                      </View>
                    </View>
                    <View style={{ gap: 8, marginTop: 12 }}>
                      {list.map(({ f, packs }) => (
                        <Bouncy key={f.supply.id} scaleTo={0.97} onPress={() => setBuying(f)} accessibilityRole="button" accessibilityLabel={t('Bought {name}', { name: f.supply.name })} style={styles.listRow}>
                          <View style={[styles.check, { borderColor: STATUS_META[f.status].color }]} />
                          <T weight="black" style={{ flex: 1, color: '#FFFFFF', fontSize: 15 }} numberOfLines={1}>
                            {f.supply.name}
                          </T>
                          <T weight="xbold" style={{ color: '#FFFFFFB0', fontSize: 13 }}>
                            {packs} × {qty(f.supply.packSize, f.supply.unit)}
                          </T>
                        </Bouncy>
                      ))}
                    </View>
                    <Pill label={t('Share list')} color="#FFFFFF" textColor={colors.ink} onPress={share} style={{ marginTop: 14, height: 50 }} testID="supplies-share" />
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <T style={{ fontSize: 26 }}>✅</T>
                    <View style={{ flex: 1 }}>
                      <T weight="black" style={{ color: '#FFFFFF', fontSize: 20 }}>
                        {t('All stocked up')}
                      </T>
                      <T weight="xbold" style={{ color: '#FFFFFFB0', fontSize: 14 }} numberOfLines={2}>
                        {forecasts[0].supply.name} · {headline(forecasts[0], now)}
                      </T>
                    </View>
                  </View>
                )}
                {monthTotal > 0 ? (
                  <T weight="xbold" style={{ color: '#FFFFFF80', fontSize: 13, marginTop: 10 }}>
                    {t('About {n} a month on supplies', { n: monthTotal.toFixed(monthTotal >= 10 ? 0 : 2) })}
                  </T>
                ) : null}
              </Animated.View>

              {/* the shelf */}
              <View style={styles.grid}>
                {forecasts.map((f, i) => (
                  <Animated.View key={f.supply.id} entering={motionReduced() ? undefined : FadeInDown.delay(i * 50).springify().damping(16)} layout={motionReduced() ? undefined : LinearTransition.springify()}>
                    <Bouncy scaleTo={0.96} onPress={() => router.push({ pathname: '/supply', params: { id: f.supply.id } })} accessibilityRole="button" accessibilityLabel={`${f.supply.name}, ${headline(f, now)}`} style={[styles.card, { width: cardW }]} testID={`supply-${f.supply.id}`}>
                      <View style={[styles.status, { backgroundColor: STATUS_META[f.status].tint }]}>
                        <T weight="black" style={{ fontSize: 11, color: STATUS_META[f.status].color, letterSpacing: 0.4 }}>
                          {STATUS_META[f.status].label().toUpperCase()}
                        </T>
                      </View>
                      <View style={{ alignItems: 'center', marginTop: 4 }}>
                        <SupplyArt kind={f.supply.kind} level={f.level} size={70} status={f.status} />
                      </View>
                      <T weight="black" style={{ fontSize: 16, marginTop: 6 }} numberOfLines={1}>
                        {f.supply.name}
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                        {Number.isFinite(f.daysLeft) ? (
                          <>
                            <RollingNumber value={Math.max(0, Math.floor(f.daysLeft))} size={28} lineHeight={32} style={{ color: STATUS_META[f.status].color }} />
                            <T weight="black" style={{ color: colors.muted, fontSize: 13, marginBottom: 5 }}>
                              {tn(Math.floor(f.daysLeft), 'day left', 'days left')}
                            </T>
                          </>
                        ) : (
                          <T weight="black" style={{ color: colors.muted, fontSize: 15, marginTop: 6 }}>
                            {qty(f.left, f.supply.unit)}
                          </T>
                        )}
                      </View>
                      <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                        {headline(f, now)}
                      </T>
                    </Bouncy>
                  </Animated.View>
                ))}
                <Bouncy scaleTo={0.96} onPress={() => router.push('/supply-edit')} accessibilityRole="button" accessibilityLabel={t('Add a supply')} style={[styles.card, styles.addCard, { width: cardW }]}>
                  <Icon name="plus" size={26} color={colors.brand} />
                  <T weight="black" style={{ color: colors.brand, fontSize: 15 }}>
                    {t('Add a supply')}
                  </T>
                </Bouncy>
              </View>
              <T style={{ color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                {t('Food and medicine go down by themselves as you log meals and doses. Everything else follows how long a pack lasts.')}
              </T>
            </>
          ) : null}
        </ScrollView>
      </View>
      <BuySheet forecast={buying} purchases={purchases} visible={!!buying} onClose={() => setBuying(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  intro: { backgroundColor: colors.ink, borderRadius: 30, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summary: { backgroundColor: colors.ink, borderRadius: 30, padding: 18 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF14' },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5 },
  card: { backgroundColor: colors.card, borderRadius: 28, padding: 14, minHeight: 210 },
  addCard: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: '#FFFFFF' },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
