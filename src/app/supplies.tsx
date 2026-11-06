/**
 * Pantry: everything on the shelf for the pet and the household, how much is left right now (worked
 * out from the care you log), and the shopping list that falls out of it. Two views:
 *  - My pantry: each product with its illustration filling with colour, a stock bar and the days left.
 *  - Shopping list: what to buy now (enough for the buffer you choose), what's coming up, and your
 *    own extras. Ticking a tracked item restocks it; the whole list can be shared.
 */
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Sticker } from '../ui/Sticker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { DAY, Forecast, monthlyCost, shoppingList } from '../domain/supplies';
import { ShoppingItem, addShoppingItem, deleteShoppingItem, listShoppingItems, toggleShoppingItem } from '../data/suppliesRepo';
import { BUFFERS, BuySheet, GROUPS, Group, KIND_META, PantryIcon, SCENES, STATUS_META, StockBar, daysLeftLabel, headline, qty, templatesFor, useBuffer, useSupplies, whoUses } from '../features/supplies';
import { useApp } from '../state/AppState';
import { TabTitle } from '../ui/forms';
import { DarkTile } from '../ui/Tiles';
import { Segmented } from '../ui/Segmented';
import { Bouncy, motionReduced } from '../ui/motion';
import { CircleButton, Icon, Pill, T } from '../ui/primitives';
import { colors, font } from '../ui/theme';
import { successFeedback, tapFeedback } from '../native/haptics';
import { t, tn } from '../i18n';

type Tab = 'pantry' | 'list';

export default function Pantry() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { pet, pets, plan, db, version } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const { forecasts, purchases, now } = useSupplies();
  const [tab, setTab] = useState<Tab>(params.tab === 'list' ? 'list' : 'pantry');
  const [group, setGroup] = useState<'all' | Group>('all');
  const [buying, setBuying] = useState<Forecast | null>(null);
  const [buffer, setBuffer] = useBuffer();
  const [extras, setExtras] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState('');
  React.useEffect(() => {
    void listShoppingItems(db).then(setExtras);
  }, [db, version]);
  const toBuy = useMemo(() => (forecasts ? shoppingList(forecasts, now, buffer) : []), [forecasts, now, buffer]);
  if (!pet) return null;
  const household = pets.length > 1;
  const comingSoon = (forecasts ?? []).filter((f) => !toBuy.some((x) => x.f.supply.id === f.supply.id) && f.buyBy != null && f.buyBy <= now + 21 * DAY);
  const shown = (forecasts ?? []).filter((f) => group === 'all' || KIND_META[f.supply.kind].group === group);
  const monthTotal = (forecasts ?? []).map(monthlyCost).reduce<number>((a, b) => a + (b ?? 0), 0);
  const openExtras = extras.filter((x) => !x.doneAt);
  const cardW = (W - 40 - 12) / 2;

  const refreshExtras = () => listShoppingItems(db).then(setExtras);
  const addExtra = async () => {
    if (!draft.trim()) return;
    await addShoppingItem(db, draft, null);
    setDraft('');
    tapFeedback();
    await refreshExtras();
  };
  const share = () => {
    const lines = [...toBuy.map(({ f, packs }) => `• ${f.supply.name} — ${packs} × ${qty(f.supply.packSize, f.supply.unit)}`), ...openExtras.map((x) => `• ${x.name}`)];
    void Share.share({ message: `${t('Shopping list for {name} 🐾', { name: household ? pets.map((p) => p.name).join(' & ') : pet.name })}\n${lines.join('\n')}` });
  };

  const empty = forecasts && forecasts.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <TabTitle
          title={t('Pantry')}
          subtitle={household ? t('{name} & the household', { name: pet.name }) : t('Food, treats & meds for {name}', { name: pet.name })}
          right={<CircleButton icon="plus" label={t('Add an item')} onPress={() => router.push('/supply-edit')} size={46} testID="supplies-add" />}
        />
        {!empty ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <Segmented<Tab>
              options={[
                { key: 'pantry', label: t('My pantry'), testID: 'tab-pantry' },
                { key: 'list', label: toBuy.length + openExtras.length ? `${t('Shopping list')} · ${toBuy.length + openExtras.length}` : t('Shopping list'), testID: 'tab-list' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {empty ? (
            <View style={{ gap: 14 }}>
              <View style={styles.intro}>
                <Sticker name={SCENES.welcome} size={170} style={{ alignSelf: 'center' }} />
                <T weight="black" style={{ fontSize: 22, textAlign: 'center' }}>
                  {t('Never run out of {name}’s food', { name: pet.name })}
                </T>
                <T style={{ color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 6, textAlign: 'center' }}>
                  {t('Add what’s on the shelf once. Pavurio follows the meals you log, works out what’s left and tells you when to order — before it runs out.')}
                </T>
              </View>
              <T weight="black" style={{ fontSize: 17 }}>
                {t('Start with')}
              </T>
              <View style={styles.grid}>
                {templatesFor(pet.species, plan).map((tp) => (
                  <DarkTile
                    key={tp.id}
                    title={tp.name()}
                    subtitle={tp.link === 'meal' ? t('Follows logged meals') : tp.link === 'medication' ? t('Follows logged doses') : undefined}
                    art={<PantryIcon kind={tp.kind} size={64} />}
                    onPress={() => router.push({ pathname: '/supply-edit', params: { template: tp.id } })}
                    height={104}
                    style={{ width: cardW }}
                    testID={`supply-template-${tp.id}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {forecasts && !empty && tab === 'pantry' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {GROUPS.filter((g) => g.key === 'all' || forecasts.some((f) => KIND_META[f.supply.kind].group === g.key)).map((g) => {
                  const on = group === g.key;
                  return (
                    <Bouncy key={g.key} scaleTo={0.94} onPress={() => setGroup(g.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.filter, on && { backgroundColor: colors.ink }]}>
                      <T weight="black" style={{ fontSize: 14, color: on ? '#FFFFFF' : colors.inkSoft }}>
                        {g.label()}
                      </T>
                    </Bouncy>
                  );
                })}
              </ScrollView>
              {shown.map((f, i) => {
                const st = STATUS_META[f.status];
                const who = household ? whoUses(f, pets) : '';
                return (
                  <Animated.View key={f.supply.id} entering={motionReduced() ? undefined : FadeInDown.delay(i * 40).springify().damping(17)} layout={motionReduced() ? undefined : LinearTransition.springify().damping(18)}>
                    <Bouncy scaleTo={0.97} onPress={() => router.push({ pathname: '/supply', params: { id: f.supply.id } })} accessibilityRole="button" accessibilityLabel={`${f.supply.name}, ${daysLeftLabel(f)}, ${headline(f, now)}`} style={styles.row} testID={`supply-${f.supply.id}`}>
                      <PantryIcon kind={f.supply.kind} size={58} level={f.level} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <T weight="black" style={{ fontSize: 17, flex: 1 }} numberOfLines={1}>
                            {f.supply.name}
                          </T>
                          {f.status !== 'ok' ? (
                            <View style={[styles.badge, { backgroundColor: st.tint }]}>
                              <T weight="black" style={{ fontSize: 10, color: st.color, letterSpacing: 0.4 }}>
                                {st.label().toUpperCase()}
                              </T>
                            </View>
                          ) : null}
                        </View>
                        <T weight="xbold" style={{ fontSize: 13, color: f.status === 'ok' ? colors.muted : st.color }} numberOfLines={1}>
                          {daysLeftLabel(f)}
                          {f.confidence === 'estimated' ? ` · ${t('estimated')}` : ''}
                          {who ? ` · ${who}` : ''}
                        </T>
                        <StockBar f={f} delay={i * 50} />
                      </View>
                      <Icon name="chevR" size={18} color={colors.faint} />
                    </Bouncy>
                  </Animated.View>
                );
              })}
              <Bouncy scaleTo={0.97} onPress={() => router.push('/supply-edit')} accessibilityRole="button" accessibilityLabel={t('Add an item')} style={styles.addRow}>
                <Icon name="plus" size={22} color={colors.brand} />
                <T weight="black" style={{ color: colors.brand, fontSize: 15 }}>
                  {t('Add an item')}
                </T>
              </Bouncy>
              {monthTotal > 0 ? (
                <T weight="xbold" style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
                  {t('About {n} a month on supplies', { n: monthTotal.toFixed(monthTotal >= 10 ? 0 : 2) })}
                </T>
              ) : null}
            </>
          ) : null}

          {forecasts && !empty && tab === 'list' ? (
            <>
              {!toBuy.length && !openExtras.length ? (
                <View style={[styles.intro, { paddingVertical: 14 }]}>
                  <Sticker name={SCENES.list} size={130} style={{ alignSelf: 'center' }} />
                  <T weight="black" style={{ fontSize: 20, textAlign: 'center' }}>
                    {t('Nothing to buy right now')}
                  </T>
                  <T style={{ color: colors.muted, textAlign: 'center', marginTop: 4 }}>{t('Pavurio will add things here before they run out.')}</T>
                </View>
              ) : null}

              {toBuy.length ? (
                <View style={styles.section}>
                  <View style={[styles.sectionHead, { backgroundColor: '#FFF0DF' }]}>
                    <T weight="black" style={{ color: '#E26A00', fontSize: 14 }}>
                      {t('To buy ({n})', { n: toBuy.length })}
                    </T>
                  </View>
                  {toBuy.map(({ f, packs }) => (
                    <Animated.View key={f.supply.id} exiting={motionReduced() ? undefined : FadeOut.duration(160)} layout={motionReduced() ? undefined : LinearTransition.springify().damping(18)}>
                      <Bouncy scaleTo={0.98} onPress={() => setBuying(f)} accessibilityRole="checkbox" accessibilityLabel={t('Restock {name}', { name: f.supply.name })} style={styles.listRow} testID={`buy-${f.supply.id}`}>
                        <View style={[styles.box, { borderColor: STATUS_META[f.status].color }]} />
                        <PantryIcon kind={f.supply.kind} size={36} />
                        <View style={{ flex: 1 }}>
                          <T weight="black" style={{ fontSize: 15 }} numberOfLines={1}>
                            {f.supply.name}
                          </T>
                          <T weight="xbold" style={{ fontSize: 12, color: STATUS_META[f.status].color }} numberOfLines={1}>
                            {headline(f, now)}
                          </T>
                        </View>
                        <T weight="black" style={{ fontSize: 14, color: colors.inkSoft }}>
                          {packs} × {qty(f.supply.packSize, f.supply.unit)}
                        </T>
                      </Bouncy>
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              {comingSoon.length ? (
                <View style={styles.section}>
                  <View style={[styles.sectionHead, { backgroundColor: '#FFF7D6' }]}>
                    <T weight="black" style={{ color: '#A07C00', fontSize: 14 }}>
                      {t('Coming soon')}
                    </T>
                  </View>
                  {comingSoon.map((f) => (
                    <Bouncy key={f.supply.id} scaleTo={0.98} onPress={() => setBuying(f)} accessibilityRole="button" accessibilityLabel={t('Restock {name}', { name: f.supply.name })} style={styles.listRow}>
                      <View style={[styles.box, { borderColor: colors.line }]} />
                      <PantryIcon kind={f.supply.kind} size={36} />
                      <View style={{ flex: 1 }}>
                        <T weight="black" style={{ fontSize: 15 }} numberOfLines={1}>
                          {f.supply.name}
                        </T>
                        <T weight="xbold" style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                          {headline(f, now)}
                        </T>
                      </View>
                    </Bouncy>
                  ))}
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={[styles.sectionHead, { backgroundColor: colors.line }]}>
                  <T weight="black" style={{ color: colors.inkSoft, fontSize: 14 }}>
                    {t('Also pick up')}
                  </T>
                </View>
                {extras.map((x) => (
                  <Animated.View key={x.id} layout={motionReduced() ? undefined : LinearTransition.springify().damping(18)} style={styles.listRow}>
                    <Bouncy
                      scaleTo={0.9}
                      onPress={async () => {
                        await toggleShoppingItem(db, x.id, !x.doneAt);
                        if (!x.doneAt) successFeedback();
                        await refreshExtras();
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: !!x.doneAt }}
                      accessibilityLabel={x.name}
                      style={[styles.box, { borderColor: x.doneAt ? '#3FA34D' : colors.faint, backgroundColor: x.doneAt ? '#3FA34D' : 'transparent' }]}
                    >
                      {x.doneAt ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                    </Bouncy>
                    <T weight="black" style={{ flex: 1, fontSize: 15, color: x.doneAt ? colors.faint : colors.ink, textDecorationLine: x.doneAt ? 'line-through' : 'none' }} numberOfLines={1}>
                      {x.name}
                    </T>
                    <Bouncy scaleTo={0.9} onPress={async () => (await deleteShoppingItem(db, x.id), await refreshExtras())} accessibilityRole="button" accessibilityLabel={t('Remove')} style={{ padding: 6 }}>
                      <Icon name="close" size={16} color={colors.faint} />
                    </Bouncy>
                  </Animated.View>
                ))}
                <View style={styles.listRow}>
                  <Icon name="plus" size={20} color={colors.faint} />
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={() => void addExtra()}
                    placeholder={t('Add something (a new toy, a harness…)')}
                    placeholderTextColor={colors.faint}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    maxLength={60}
                    style={styles.input}
                    testID="extra-input"
                  />
                  {draft.trim() ? (
                    <Bouncy onPress={() => void addExtra()} accessibilityRole="button" accessibilityLabel={t('Add')} style={styles.addBtn}>
                      <Icon name="check" size={16} color="#FFFFFF" />
                    </Bouncy>
                  ) : null}
                </View>
              </View>

              <View style={[styles.section, { padding: 14, gap: 8 }]}>
                <T weight="black" style={{ fontSize: 15 }}>
                  {t('Buy enough for')}
                </T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {BUFFERS.map((d) => (
                    <Bouncy key={d} scaleTo={0.94} onPress={() => setBuffer(d)} accessibilityRole="radio" accessibilityState={{ selected: buffer === d }} style={[styles.filter, { flex: 1, alignItems: 'center' }, buffer === d && { backgroundColor: colors.ink }]}>
                      <T weight="black" style={{ fontSize: 13, color: buffer === d ? '#FFFFFF' : colors.inkSoft }}>
                        {d === 30 ? t('1 month') : tn(d / 7, '{n} week', '{n} weeks')}
                      </T>
                    </Bouncy>
                  ))}
                </View>
                <T style={{ fontSize: 13, color: colors.muted }}>{t('Pack counts keep this much in stock after the order arrives.')}</T>
              </View>

              {toBuy.length || openExtras.length ? <Pill label={t('Share list')} onPress={share} testID="supplies-share" /> : null}
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
  intro: { backgroundColor: colors.card, borderRadius: 30, padding: 18, alignItems: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filter: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.line, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 24, padding: 12, paddingRight: 14 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line },
  section: { backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden' },
  sectionHead: { paddingHorizontal: 14, paddingVertical: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#FFFFFF' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  // no browser focus ring on web; the row itself is the field
  input: { flex: 1, fontSize: 15, fontFamily: font.xbold, color: colors.ink, paddingVertical: 10, ...({ outlineStyle: 'none' } as object) },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
