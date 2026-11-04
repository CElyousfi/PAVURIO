/**
 * Pantry UI kit: the household pantry hook, the illustrated product icons (they fill with colour as
 * the stock does), the stock bar, starter templates from the pet's own plan, the human sentences
 * ("Order by Saturday", "Why this estimate?") and the restock sheet with its undo.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState as RNAppState, Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import type { CareType, Species } from '../domain/care';
import { Plan, Portions } from '../domain/progress';
import { DAY, Defaults, Forecast, Purchase, Supply, SupplyKind, SupplyUnit, formatQty, lastPurchase } from '../domain/supplies';
import { Pantry, forPet, loadPantry } from '../data/pantry';
import { getSetting, setSetting } from '../data/repo';
import { addPurchase, productsFor, undoPurchase } from '../data/suppliesRepo';
import { useApp } from '../state/AppState';
import { Sheet } from '../ui/forms';
import { FillArt } from '../ui/FillArt';
import { Sunburst } from '../ui/Reward';
import { RollingNumber } from '../ui/Rolling';
import { SlideToConfirm } from '../ui/Slide';
import { Bar, Bouncy, motionReduced } from '../ui/motion';
import { Icon, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback, tapFeedback } from '../native/haptics';
import { capitalize, monthNamesShort, weekdayNames } from '../i18n/dates';
import { lang, t, tn } from '../i18n';

// ------------------------------------------------------------------ data

/**
 * The household pantry, forecast with every pet's logs (so a shared bag is counted right), narrowed
 * to what the current pet uses. Recalculated whenever data changes and whenever the app comes back,
 * so "days left" is never yesterday's number.
 */
export function useSupplies() {
  const { db, pet, version } = useApp();
  const [pantry, setPantry] = useState<Pantry | null>(null);
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && setWake((w) => w + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    loadPantry(db)
      .then((p) => alive && setPantry(p))
      .catch((e) => console.warn('[pavurio] pantry', e));
    return () => {
      alive = false;
    };
  }, [db, version, wake]);
  const forecasts = useMemo(() => (pantry && pet ? forPet(pantry.forecasts, pet.id) : null), [pantry, pet]);
  return { forecasts, all: pantry?.forecasts ?? null, purchases: pantry?.purchases ?? [], defaults: pantry?.defaults ?? ({} as Defaults), now: pantry?.now ?? Date.now(), loading: pantry == null };
}

/** How much to stock up when shopping (days kept after the order arrives). */
export const BUFFERS = [7, 14, 30] as const;
export function useBuffer(): [number, (d: number) => void] {
  const { db } = useApp();
  const [days, setDays] = useState(14);
  useEffect(() => {
    void getSetting(db, 'pantryBuffer').then((v) => v && setDays(Number(v) || 14));
  }, [db]);
  const set = useCallback(
    (d: number) => {
      setDays(d);
      void setSetting(db, 'pantryBuffer', String(d));
    },
    [db],
  );
  return [days, set];
}

// ------------------------------------------------------------------ art & words

const ICONS = {
  food: require('../../assets/art/pantry/icon_food.webp'),
  wet: require('../../assets/art/pantry/icon_wet.webp'),
  treats: require('../../assets/art/pantry/icon_treats.webp'),
  supplements: require('../../assets/art/pantry/icon_supplements.webp'),
  health: require('../../assets/art/pantry/icon_health.webp'),
  grooming: require('../../assets/art/pantry/icon_grooming.webp'),
  litter: require('../../assets/art/pantry/icon_litter.webp'),
  hygiene: require('../../assets/art/pantry/icon_hygiene.webp'),
  toys: require('../../assets/art/pantry/icon_toys.webp'),
  walk: require('../../assets/art/pantry/icon_walk.webp'),
  comfort: require('../../assets/art/pantry/icon_comfort.webp'),
  tools: require('../../assets/art/pantry/icon_tools.webp'),
};
export const SCENES = {
  welcome: require('../../assets/art/pantry/scene_welcome.webp'),
  list: require('../../assets/art/pantry/scene_list.webp'),
  reminder: require('../../assets/art/pantry/scene_reminder.webp'),
  restock: require('../../assets/art/pantry/scene_restock.webp'),
};

export type Group = 'food' | 'treats' | 'health' | 'care';
export const KIND_META: Record<SupplyKind, { label: () => string; icon: number; color: string; tint: string; group: Group }> = {
  food: { label: () => t('Dry food'), icon: ICONS.food, color: '#E8892A', tint: '#FFF1E0', group: 'food' },
  wet: { label: () => t('Wet food'), icon: ICONS.wet, color: '#2F8FB5', tint: '#E4F3F9', group: 'food' },
  treats: { label: () => t('Treats'), icon: ICONS.treats, color: '#D99A2B', tint: '#FFF4DC', group: 'treats' },
  supplements: { label: () => t('Supplements'), icon: ICONS.supplements, color: '#E39A1E', tint: '#FFF3DA', group: 'health' },
  medicine: { label: () => t('Medicine'), icon: ICONS.health, color: '#E5484D', tint: '#FDECEC', group: 'health' },
  grooming: { label: () => t('Grooming'), icon: ICONS.grooming, color: '#1F9E92', tint: '#E1F5F2', group: 'care' },
  litter: { label: () => t('Litter'), icon: ICONS.litter, color: '#7E8796', tint: '#EEF0F3', group: 'care' },
  bags: { label: () => t('Poop bags'), icon: ICONS.hygiene, color: '#3FA34D', tint: '#E7F6E9', group: 'care' },
  toys: { label: () => t('Toys'), icon: ICONS.toys, color: '#E25C6B', tint: '#FDE8EA', group: 'care' },
  walk: { label: () => t('Walk gear'), icon: ICONS.walk, color: '#1F9E92', tint: '#E1F5F2', group: 'care' },
  comfort: { label: () => t('Bedding'), icon: ICONS.comfort, color: '#8A6FD1', tint: '#EFEAFB', group: 'care' },
  tools: { label: () => t('Tools'), icon: ICONS.tools, color: '#64748B', tint: '#EEF0F3', group: 'care' },
  other: { label: () => t('Other'), icon: ICONS.tools, color: '#64748B', tint: '#EEF0F3', group: 'care' },
};

export const GROUPS: { key: 'all' | Group; label: () => string }[] = [
  { key: 'all', label: () => t('All') },
  { key: 'food', label: () => t('Food') },
  { key: 'treats', label: () => t('Treats') },
  { key: 'health', label: () => t('Health') },
  { key: 'care', label: () => t('Care') },
];

export const STATUS_META: Record<Forecast['status'], { label: () => string; color: string; tint: string }> = {
  out: { label: () => t('Out'), color: '#E5484D', tint: '#FDECEC' },
  buy: { label: () => t('Buy now'), color: '#E26A00', tint: '#FFF0DF' },
  soon: { label: () => t('Soon'), color: '#C79A00', tint: '#FFF7D6' },
  ok: { label: () => t('Stocked'), color: '#3FA34D', tint: '#E7F6E9' },
  unknown: { label: () => t('Add usage'), color: colors.muted, tint: colors.line },
};

/** The product's own illustration; with `level` it shows gray and fills with colour up to it. */
export function PantryIcon({ kind, size, level, source }: { kind: SupplyKind; size: number; level?: number; source?: number }) {
  const src = source ?? KIND_META[kind].icon;
  if (level == null) return <Image source={src} style={{ width: size, height: size }} fadeDuration={0} />;
  return <FillArt source={src} size={size} level={Math.max(0.08, level)} />;
}

/** The stock bar: green while it's fine, amber when it's time, red when it's out. */
export function StockBar({ f, height = 8, delay = 0 }: { f: Forecast; height?: number; delay?: number }) {
  return <Bar value={f.status === 'out' ? 0.02 : f.level} color={STATUS_META[f.status].color} height={height} delay={delay} />;
}

export const qty = (n: number, unit: SupplyUnit) => {
  const q = formatQty(n, unit);
  const u = q.unit === 'dose' ? (Number(q.value) === 1 ? t('dose') : t('doses')) : q.unit === 'pcs' ? t('pcs') : q.unit;
  return `${q.value} ${u}`;
};

export function dayName(at: number, now: number) {
  const d = new Date(at);
  const today = new Date(now);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY);
  if (diff <= 0) return t('today');
  if (diff === 1) return t('tomorrow');
  if (diff < 7) return capitalize(weekdayNames()[d.getDay()]);
  const mon = monthNamesShort()[d.getMonth()].replace('.', '');
  return lang() === 'en' ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
}

export const daysLeftLabel = (f: Forecast) => (Number.isFinite(f.daysLeft) ? tn(Math.max(0, Math.floor(f.daysLeft)), '{n} day left', '{n} days left') : qty(f.left, f.supply.unit));

/** The one line that matters for a product. */
export function headline(f: Forecast, now: number): string {
  if (f.status === 'out') return t('Ran out — time to restock');
  if (f.status === 'unknown') return t('Tell Pavurio how fast it goes');
  if (f.status === 'buy') return f.buyBy != null && f.buyBy <= now ? t('Order today — about {n} left', { n: tn(Math.max(1, Math.round(f.daysLeft)), '{n} day', '{n} days') }) : t('Order by {day}', { day: dayName(f.buyBy!, now) });
  if (f.status === 'soon') return t('Order by {day}', { day: dayName(f.buyBy!, now) });
  return t('Good until {day}', { day: dayName(f.runOutAt!, now) });
}

/** Names of the pets using a product ("Honey & Tabby"). */
export function whoUses(f: Forecast, pets: { id: string; name: string }[]): string {
  return f.petIds.map((id) => pets.find((p) => p.id === id)?.name).filter(Boolean).join(' & ');
}

/** "Why this estimate?" — where the rate comes from and how sure Pavurio is, in plain words. */
export function whyLines(f: Forecast, who: string, now: number): string[] {
  const per = qty(f.perDay, f.supply.unit);
  const out: string[] = [];
  if (f.source === 'logs') out.push(t('{name} eats about {q} a day, measured from the last two weeks of logged meals.', { name: who, q: per }));
  else if (f.source === 'plan') out.push(t('About {q} a day from {name}’s routine (times a day × usual portion). After 4 days of logged meals Pavurio switches to what’s really eaten.', { name: who, q: per }));
  else if (f.source === 'manual') out.push(t('About {q} a day, from how long you said a pack lasts.', { q: per }));
  else out.push(t('Pavurio doesn’t know how fast this goes yet. Set how long a pack lasts.'));
  if (f.supply.link) {
    out.push(f.supply.link === 'meal' ? t('Every meal logged for {name} with this food comes out of the bag.', { name: who }) : t('Every dose logged for {name} comes out of the box.', { name: who }));
    if (f.confidence === 'estimated') out.push(t('No meals logged for {n} — those days are estimated at the usual rate.', { n: tn(Math.max(1, Math.round(f.gapDays)), '{n} day', '{n} days') }));
  }
  out.push(t('Counted from {q} on {day}.', { q: qty(f.supply.stock, f.supply.unit), day: dayName(f.supply.stockAt, now) === t('today') ? t('today') : formatShort(f.supply.stockAt) }));
  if (f.buyBy != null) out.push(t('Reminder {n} before it runs out, so there’s time to order.', { n: tn(f.supply.leadDays, '{n} day', '{n} days') }));
  return out;
}

export function formatShort(at: number) {
  const d = new Date(at);
  const mon = monthNamesShort()[d.getMonth()].replace('.', '');
  return lang() === 'en' ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
}

// ------------------------------------------------------------------ templates

export type Template = {
  id: string;
  kind: SupplyKind;
  name: () => string;
  unit: SupplyUnit;
  packSize: number;
  presets: number[];
  link: CareType | null;
  perDay: (ctx: { plan: Plan; portions: Portions }) => number | null;
  /** "a pack lasts about…" choices (days); empty = ask "how many a day" */
  lasting?: number[];
};

export function templatesFor(species: Species, plan: Plan): Template[] {
  const dog = species === 'dog';
  const list: Template[] = [
    { id: 'food', kind: 'food', name: () => t('Dry food'), unit: 'g', packSize: dog ? 12000 : 4000, presets: dog ? [2000, 6000, 12000, 15000] : [1500, 4000, 7000, 10000], link: 'meal', perDay: () => null },
    { id: 'wet', kind: 'wet', name: () => t('Wet food'), unit: 'pcs', packSize: 12, presets: [6, 12, 24, 48], link: null, perDay: () => 1, lasting: [] },
    { id: 'treats', kind: 'treats', name: () => t('Treats'), unit: 'g', packSize: 500, presets: [200, 500, 1000], link: null, perDay: () => 500 / 21, lasting: [7, 14, 21, 30] },
    { id: 'supplements', kind: 'supplements', name: () => t('Supplements'), unit: 'dose', packSize: 60, presets: [30, 60, 90, 120], link: null, perDay: () => 1, lasting: [] },
    { id: 'medicine', kind: 'medicine', name: () => t('Medicine'), unit: 'dose', packSize: 30, presets: [10, 30, 60, 90], link: (plan.medication ?? 0) > 0 ? 'medication' : null, perDay: ({ plan: p }) => ((p.medication ?? 0) > 0 ? null : 1), lasting: [] },
    { id: 'flea', kind: 'medicine', name: () => t('Flea & tick'), unit: 'dose', packSize: 3, presets: [1, 3, 6, 12], link: null, perDay: () => 1 / 30, lasting: [] },
  ];
  if (dog) list.push({ id: 'bags', kind: 'bags', name: () => t('Poop bags'), unit: 'pcs', packSize: 120, presets: [60, 120, 240, 300], link: null, perDay: ({ plan: p }) => Math.max(1, p.walk ?? 2), lasting: [] });
  else list.push({ id: 'litter', kind: 'litter', name: () => t('Litter'), unit: 'L', packSize: 10, presets: [5, 10, 20, 30], link: null, perDay: () => 10 / 21, lasting: [7, 14, 21, 30, 45] });
  list.push({ id: 'grooming', kind: 'grooming', name: () => t('Shampoo'), unit: 'pcs', packSize: 1, presets: [1, 2], link: null, perDay: () => 1 / 60, lasting: [30, 60, 90] });
  return list;
}

// ------------------------------------------------------------------ restock

const WHEN = [0, 1, 2] as const;

/**
 * Restock: proposes what was bought last time, a pack stepper with the icon filling up as you choose,
 * and when it was bought. Slide to add; then a short celebration with the new "days left" and an Undo
 * for a mistaken tap.
 */
export function BuySheet({ forecast: f, purchases, visible, onClose }: { forecast: Forecast | null; purchases: Purchase[]; visible: boolean; onClose: () => void }) {
  const { db, bump } = useApp();
  const last = f ? lastPurchase(purchases, f.supply.id) : null;
  const [packs, setPacks] = useState(1);
  const [when, setWhen] = useState<(typeof WHEN)[number]>(0);
  const [done, setDone] = useState<{ id: string; days: number | null; q: string } | null>(null);
  useEffect(() => {
    if (visible) {
      setPacks(last?.packs ?? 1);
      setWhen(0);
      setDone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const s = f?.supply;
  const after = f && s ? f.left + packs * s.packSize : 0;
  const afterDays = f && f.perDay > 0 ? Math.round(after / f.perDay) : null;
  const confirm = useCallback(async () => {
    if (!f || !s) return;
    const now = Date.now();
    const id = await addPurchase(db, s, packs, f.left, s.price, now, now - when * DAY);
    successFeedback();
    setDone({ id, days: afterDays, q: qty(after, s.unit) });
    bump();
  }, [db, f, s, packs, when, after, afterDays, bump]);
  const undo = useCallback(async () => {
    if (!done) return;
    await undoPurchase(db, done.id);
    tapFeedback();
    bump();
    onClose();
  }, [db, done, bump, onClose]);
  if (!f || !s) return null;
  const meta = KIND_META[s.kind];
  const full = Math.max(after, s.packSize);
  return (
    <Sheet visible={visible} onClose={onClose} title={done ? t('Restocked!') : t('Restock {name}', { name: s.name })}>
      {done ? (
        <Animated.View entering={motionReduced() ? undefined : FadeIn.duration(160)} style={{ alignItems: 'center', gap: 6 }} testID="restock-done">
          <View style={{ width: 200, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <View style={StyleSheet.absoluteFill}>
              <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Sunburst size={190} color={meta.color} />
              </View>
            </View>
            <Animated.Image entering={motionReduced() ? undefined : ZoomIn.springify().damping(12)} source={SCENES.restock} style={{ width: 170, height: 130 }} resizeMode="contain" />
          </View>
          <T weight="black" style={{ fontSize: 22 }}>
            {done.days != null ? tn(done.days, '{n} day of {item}', '{n} days of {item}', { item: s.name }) : done.q}
          </T>
          <T weight="xbold" style={{ color: colors.muted }}>
            {t('{q} on hand now', { q: done.q })}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' }}>
            <SoftPill label={t('Undo')} color={colors.inkSoft} tint={colors.line} onPress={() => void undo()} style={{ flex: 1 }} />
            <Pill label={t('Done')} color={meta.color} onPress={onClose} style={{ flex: 2 }} testID="restock-close" />
          </View>
        </Animated.View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <PantryIcon kind={s.kind} size={86} level={after / full} />
            <View style={{ flex: 1, gap: 4 }}>
              <T weight="xbold" style={{ color: colors.muted }}>
                {t('Packs of {q}', { q: qty(s.packSize, s.unit) })}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Bouncy accessibilityRole="button" accessibilityLabel={t('One less')} onPress={() => (tapFeedback(), setPacks((p) => Math.max(1, p - 1)))} style={styles.step}>
                  <Icon name="down" size={20} />
                </Bouncy>
                <RollingNumber value={packs} size={44} lineHeight={50} />
                <Bouncy accessibilityRole="button" accessibilityLabel={t('One more')} onPress={() => (tapFeedback(), setPacks((p) => Math.min(20, p + 1)))} style={styles.step} testID="buy-more">
                  <Icon name="up" size={20} />
                </Bouncy>
              </View>
              <T weight="black" style={{ fontSize: 15 }}>
                {afterDays != null ? t('{q} on hand · about {n}', { q: qty(after, s.unit), n: tn(afterDays, '{n} day', '{n} days') }) : t('{q} on hand', { q: qty(after, s.unit) })}
              </T>
            </View>
          </View>
          {last ? (
            <T style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>
              {t('Same as last time: {n} × {q}', { n: last.packs, q: qty(last.packSize, s.unit) })}
              {last.price != null ? ` · ${last.price}` : ''}
            </T>
          ) : null}
          <View style={styles.whenRow}>
            {WHEN.map((w) => (
              <Bouncy key={w} scaleTo={0.94} onPress={() => setWhen(w)} accessibilityRole="radio" accessibilityState={{ selected: when === w }} style={[styles.when, when === w && { backgroundColor: colors.ink }]}>
                <T weight="black" style={{ fontSize: 13, color: when === w ? '#FFFFFF' : colors.inkSoft }}>
                  {w === 0 ? t('Bought today') : w === 1 ? t('Yesterday') : t('2 days ago')}
                </T>
              </Bouncy>
            ))}
          </View>
          <View style={{ marginTop: 14 }}>
            <SlideToConfirm label={t('Slide to add to stock')} doneLabel={t('Restocked!')} color={meta.color} tint={meta.tint} onComplete={confirm} testID="buy-slide" />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  whenRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  when: { flex: 1, height: 38, borderRadius: 19, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});

// ------------------------------------------------------------------ Home card

/**
 * On Home, "What needs buying?": the products that need attention with their bars, or a quiet
 * "all stocked" line; before anything is set up, the offer to track the food.
 */
export function SuppliesCard() {
  const { pet } = useApp();
  const { forecasts, now } = useSupplies();
  if (!pet || !forecasts) return null;
  if (forecasts.length === 0)
    return (
      <Bouncy scaleTo={0.97} onPress={() => (tapFeedback(), router.push('/supplies'))} accessibilityRole="button" accessibilityLabel={t('Track {name}’s food and supplies', { name: pet.name })} style={homeStyles.card} testID="feed-supplies-setup">
        <Image source={SCENES.welcome} style={{ width: 92, height: 70 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 18 }}>
            {t('Never run out of food')}
          </T>
          <T weight="xbold" style={{ color: colors.muted, fontSize: 14 }}>
            {t('Pavurio counts what {name} eats and tells you when to buy more.', { name: pet.name })}
          </T>
        </View>
        <Icon name="chevR" size={18} color={colors.faint} />
      </Bouncy>
    );
  const need = forecasts.filter((f) => f.status === 'out' || f.status === 'buy' || f.status === 'soon');
  const rows = (need.length ? need : forecasts).slice(0, 3);
  return (
    <Bouncy scaleTo={0.97} onPress={() => (tapFeedback(), router.push(need.length ? { pathname: '/supplies', params: { tab: 'list' } } : '/supplies'))} accessibilityRole="button" accessibilityLabel={`${t('Pantry')}: ${rows.map((f) => `${f.supply.name}, ${headline(f, now)}`).join('; ')}`} style={[homeStyles.card, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]} testID="feed-supplies">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T weight="black" style={{ fontSize: 18, flex: 1 }}>
          {need.length ? tn(need.length, '1 thing to buy soon', '{n} things to buy soon') : t('Pantry stocked')}
        </T>
        <Icon name="chevR" size={18} color={colors.faint} />
      </View>
      {rows.map((f, i) => (
        <View key={f.supply.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PantryIcon kind={f.supply.kind} size={40} />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: 'row' }}>
              <T weight="black" style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
                {f.supply.name}
              </T>
              <T weight="black" style={{ fontSize: 13, color: STATUS_META[f.status].color }} numberOfLines={1}>
                {need.length ? headline(f, now) : daysLeftLabel(f)}
              </T>
            </View>
            <StockBar f={f} height={7} delay={i * 60} />
          </View>
        </View>
      ))}
    </Bouncy>
  );
}

// ------------------------------------------------------------------ log card

/**
 * Under a meal or a dose in the log card: which product it comes out of and what that leaves. One
 * product → a quiet line; several → tap to choose (the pet's usual one is pre-selected).
 */
export function ProductPicker({ type, amount, value, onChange }: { type: CareType; amount: number; value: string | null; onChange: (id: string | null) => void }) {
  const { db, pet, version } = useApp();
  const { forecasts, defaults } = useSupplies();
  const [list, setList] = useState<Supply[]>([]);
  useEffect(() => {
    if (!pet) return;
    void productsFor(db, pet.id, type).then(setList);
  }, [db, pet, type, version]);
  const def = pet ? defaults[pet.id]?.[type] : undefined;
  useEffect(() => {
    if (value == null && list.length) onChange(def && list.some((s) => s.id === def) ? def : list[0].id);
  }, [list, def, value, onChange]);
  if (!list.length || !forecasts) return null;
  const chosen = list.find((s) => s.id === value) ?? list[0];
  const f = forecasts.find((x) => x.supply.id === chosen.id);
  const leftAfter = f ? Math.max(0, f.left - (chosen.unit === 'g' || chosen.unit === 'dose' ? amount : 0)) : null;
  return (
    <View style={{ marginTop: 10, alignItems: 'center', gap: 6 }} testID="product-picker">
      {list.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          {list.map((s) => {
            const on = s.id === chosen.id;
            return (
              <Bouncy key={s.id} scaleTo={0.94} onPress={() => onChange(s.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[pickStyles.chip, on && { backgroundColor: colors.ink }]} testID={`product-${s.id}`}>
                <PantryIcon kind={s.kind} size={22} />
                <T weight="black" style={{ fontSize: 13, color: on ? '#FFFFFF' : colors.inkSoft }} numberOfLines={1}>
                  {s.name}
                </T>
              </Bouncy>
            );
          })}
        </View>
      ) : null}
      {f && leftAfter != null ? (
        <Bouncy scaleTo={0.95} onPress={() => router.push({ pathname: '/supply', params: { id: chosen.id } })} accessibilityRole="button" style={[pickStyles.left, { backgroundColor: STATUS_META[f.status].tint }]}>
          {list.length === 1 ? <PantryIcon kind={chosen.kind} size={20} /> : null}
          <T weight="xbold" style={{ color: STATUS_META[f.status].color, fontSize: 13 }} numberOfLines={1}>
            {t('{q} of {item} left after this', { q: qty(leftAfter, chosen.unit), item: chosen.name })}
          </T>
        </Bouncy>
      ) : null}
    </View>
  );
}

const pickStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: colors.line, maxWidth: 180 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, maxWidth: 320 },
});

const homeStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 28, padding: 16, marginTop: 14 },
});
