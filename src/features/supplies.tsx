/**
 * Supplies UI kit: the forecasts hook, the container pictures (a bag / can / jar / bottle / box that
 * empties as it's used), smart starter templates from the pet's own plan, the human sentences
 * ("Order by Saturday"), and the "I bought it" sheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect, Circle } from 'react-native-svg';
import type { CareType, Species } from '../domain/care';
import { Plan, Portions, portionOf } from '../domain/progress';
import { DAY, Forecast, Purchase, Supply, SupplyKind, SupplyUnit, forecastAll, formatQty, lastPurchase } from '../domain/supplies';
import { listEventsBetween } from '../data/repo';
import { addPurchase, listPurchases, listSupplies } from '../data/suppliesRepo';
import { useApp } from '../state/AppState';
import { Sheet } from '../ui/forms';
import { RollingNumber } from '../ui/Rolling';
import { SlideToConfirm } from '../ui/Slide';
import { Bouncy, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback, tapFeedback } from '../native/haptics';
import { capitalize, monthNamesShort, weekdayNames } from '../i18n/dates';
import { lang, t, tn } from '../i18n';

// ------------------------------------------------------------------ data

export function useSupplies() {
  const { db, pet, plan, portions, version } = useApp();
  const [supplies, setSupplies] = useState<Supply[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [events, setEvents] = useState<{ type: CareType; occurredAt: number; amount: number | null }[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pet) return;
    let alive = true;
    (async () => {
      const list = await listSupplies(db, pet.id);
      const from = Math.min(Date.now() - 31 * DAY, ...list.map((s) => s.stockAt));
      const [ev, pu] = await Promise.all([listEventsBetween(db, pet.id, from, Date.now() + 60_000), listPurchases(db, list.map((s) => s.id))]);
      if (!alive) return;
      setSupplies(list);
      setPurchases(pu);
      setEvents(ev.map((e) => ({ type: e.type, occurredAt: e.occurredAt, amount: e.amount })));
      setNow(Date.now());
    })().catch((e) => console.warn('[pavurio] supplies', e));
    return () => {
      alive = false;
    };
  }, [db, pet, version]);
  const forecasts = useMemo(
    () => (supplies ? forecastAll(supplies, events, plan as Plan, portions as Portions, purchases, now, (ty, p) => portionOf(ty, p as Portions)) : null),
    [supplies, events, plan, portions, purchases, now],
  );
  return { forecasts, purchases, loading: supplies == null };
}

// ------------------------------------------------------------------ words

export const KIND_META: Record<SupplyKind, { label: () => string; color: string; tint: string }> = {
  food: { label: () => t('Dry food'), color: '#E8892A', tint: '#FFF1E0' },
  wet: { label: () => t('Wet food'), color: '#D9603B', tint: '#FDE9E2' },
  treats: { label: () => t('Treats'), color: '#B07A4F', tint: '#F6ECE2' },
  litter: { label: () => t('Litter'), color: '#7E8796', tint: '#EEF0F3' },
  medicine: { label: () => t('Medicine'), color: '#E5484D', tint: '#FDECEC' },
  bags: { label: () => t('Poop bags'), color: '#58A222', tint: '#E8F6DD' },
  other: { label: () => t('Other'), color: '#64748B', tint: '#EEF0F3' },
};

export const STATUS_META: Record<Forecast['status'], { label: () => string; color: string; tint: string }> = {
  out: { label: () => t('Out'), color: '#E5484D', tint: '#FDECEC' },
  buy: { label: () => t('Buy now'), color: '#E26A00', tint: '#FFF0DF' },
  soon: { label: () => t('Soon'), color: '#C79A00', tint: '#FFF7D6' },
  ok: { label: () => t('Stocked'), color: '#3FA34D', tint: '#E7F6E9' },
  unknown: { label: () => t('Add usage'), color: colors.muted, tint: colors.line },
};

export const qty = (n: number, unit: SupplyUnit) => {
  const q = formatQty(n, unit);
  const u = q.unit === 'dose' ? (Number(q.value) === 1 ? t('dose') : t('doses')) : q.unit === 'pcs' ? t('pcs') : q.unit;
  return `${q.value} ${u}`;
};

function dayName(at: number, now: number) {
  const d = new Date(at);
  const today = new Date(now);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY);
  if (diff <= 0) return t('today');
  if (diff === 1) return t('tomorrow');
  if (diff < 7) return capitalize(weekdayNames()[d.getDay()]);
  const mon = monthNamesShort()[d.getMonth()].replace('.', '');
  return lang() === 'en' ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
}

/** The one line that matters for a supply. */
export function headline(f: Forecast, now: number): string {
  if (f.status === 'out') return t('Ran out — time to restock');
  if (f.status === 'unknown') return t('Tell Pavurio how fast it goes');
  if (f.status === 'buy') return f.buyBy != null && f.buyBy <= now ? t('Order today — about {n} left', { n: tn(Math.max(1, Math.round(f.daysLeft)), '{n} day', '{n} days') }) : t('Order by {day}', { day: dayName(f.buyBy!, now) });
  if (f.status === 'soon') return t('Order by {day}', { day: dayName(f.buyBy!, now) });
  return t('Good until {day}', { day: dayName(f.runOutAt!, now) });
}

export function sourceLine(f: Forecast, name: string): string {
  const per = qty(f.perDay, f.supply.unit);
  if (f.source === 'logs') return t('{name} uses about {q} a day — from your logs', { name, q: per });
  if (f.source === 'plan') return t('About {q} a day, from {name}’s plan', { name, q: per });
  if (f.source === 'manual') return t('About {q} a day', { q: per });
  return t('Set how long a pack lasts to get a forecast');
}

// ------------------------------------------------------------------ templates

export type Template = { kind: SupplyKind; name: () => string; unit: SupplyUnit; packSize: number; presets: number[]; link: CareType | null; perDay: (ctx: { plan: Plan; portions: Portions }) => number | null; lasting?: number[] };

export function templatesFor(species: Species, plan: Plan): Template[] {
  const list: Template[] = [
    { kind: 'food', name: () => t('Dry food'), unit: 'g', packSize: species === 'dog' ? 12000 : 4000, presets: species === 'dog' ? [2000, 6000, 12000, 15000] : [1500, 4000, 7000, 10000], link: 'meal', perDay: () => null },
    { kind: 'wet', name: () => t('Wet food'), unit: 'pcs', packSize: 12, presets: [6, 12, 24, 48], link: null, perDay: () => 1, lasting: [] },
    { kind: 'treats', name: () => t('Treats'), unit: 'g', packSize: 500, presets: [200, 500, 1000], link: null, perDay: () => 500 / 21, lasting: [7, 14, 21, 30] },
  ];
  if (species === 'cat') list.push({ kind: 'litter', name: () => t('Litter'), unit: 'L', packSize: 10, presets: [5, 10, 20, 30], link: null, perDay: () => 10 / 21, lasting: [7, 14, 21, 30, 45] });
  if (species === 'dog') list.push({ kind: 'bags', name: () => t('Poop bags'), unit: 'pcs', packSize: 120, presets: [60, 120, 240, 300], link: null, perDay: ({ plan: p }) => Math.max(1, p.walk ?? 2), lasting: [] });
  list.push({ kind: 'medicine', name: () => t('Medicine'), unit: 'dose', packSize: 30, presets: [10, 30, 60, 90], link: (plan.medication ?? 0) > 0 ? 'medication' : null, perDay: ({ plan: p }) => ((p.medication ?? 0) > 0 ? null : 1), lasting: [] });
  list.push({ kind: 'other', name: () => t('Flea & tick'), unit: 'dose', packSize: 3, presets: [1, 3, 6, 12], link: null, perDay: () => 1 / 30, lasting: [] });
  return list;
}

// ------------------------------------------------------------------ pictures

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const SHAPES: Record<SupplyKind, string> = {
  // a kibble bag with a folded top
  food: 'M14 14 L86 14 L92 30 L88 112 Q50 120 12 112 L8 30 Z',
  treats: 'M14 14 L86 14 L92 30 L88 112 Q50 120 12 112 L8 30 Z',
  // a can
  wet: 'M18 26 Q50 16 82 26 L82 104 Q50 114 18 104 Z',
  // a litter box / bucket
  litter: 'M12 30 L88 30 L82 112 L18 112 Z',
  // a pill bottle
  medicine: 'M26 34 L74 34 L74 112 Q50 118 26 112 Z',
  // a roll of bags
  bags: 'M20 22 L80 22 L80 112 L20 112 Z',
  other: 'M22 30 L78 30 L78 112 L22 112 Z',
};

/** The container for a supply, filled to `level` (0..1) in its colour; the fill springs to new levels. */
export function SupplyArt({ kind, level, size = 92, status }: { kind: SupplyKind; level: number; size?: number; status?: Forecast['status'] }) {
  const m = KIND_META[kind];
  const lv = useSharedValue(motionReduced() ? level : 0);
  useEffect(() => {
    lv.value = motionReduced() ? level : withSpring(level, { damping: 15, stiffness: 90 });
  }, [level, lv]);
  const top = 14;
  const bottom = 118;
  const fill = useAnimatedProps(() => {
    const y = bottom - (bottom - top) * Math.max(0, Math.min(1, lv.value));
    return { y, height: bottom - y };
  });
  const id = `clip-${kind}`;
  const warn = status === 'out' || status === 'buy';
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 100 125">
      <Defs>
        <ClipPath id={id}>
          <Path d={SHAPES[kind]} />
        </ClipPath>
      </Defs>
      {/* lids and caps */}
      {kind === 'medicine' ? <Rect x={22} y={20} width={56} height={16} rx={5} fill="#FFFFFF" stroke={colors.ink} strokeWidth={3} /> : null}
      {kind === 'litter' ? <Path d="M28 30 Q50 6 72 30" fill="none" stroke={colors.ink} strokeWidth={3} strokeLinecap="round" /> : null}
      <Path d={SHAPES[kind]} fill="#FFFFFF" />
      <G clipPath={`url(#${id})`}>
        <AnimatedRect x={0} width={100} animatedProps={fill} fill={warn ? '#FFB27A' : m.color} opacity={0.9} />
      </G>
      <Path d={SHAPES[kind]} fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" />
      {kind === 'food' || kind === 'treats' ? (
        <>
          <Path d="M14 14 L50 22 L86 14" fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" />
          <Circle cx={50} cy={64} r={13} fill="#FFFFFFE6" />
          <Path d="M44 64 a3 3 0 1 1 3-3 h6 a3 3 0 1 1 3 3 a3 3 0 1 1-3 3 h-6 a3 3 0 1 1-3-3z" fill={m.color} />
        </>
      ) : null}
      {kind === 'wet' ? <Path d="M18 26 Q50 36 82 26" fill="none" stroke={colors.ink} strokeWidth={3} /> : null}
      {kind === 'bags' ? <Rect x={36} y={58} width={28} height={12} rx={6} fill="#FFFFFFE6" /> : null}
      {kind === 'medicine' ? <Rect x={34} y={62} width={32} height={22} rx={4} fill="#FFFFFFE6" /> : null}
    </Svg>
  );
}

// ------------------------------------------------------------------ bought it

/** "I bought it": same as last time in one tap, or a pack count with the bag filling up as you choose. */
export function BuySheet({ forecast: f, purchases, visible, onClose }: { forecast: Forecast | null; purchases: Purchase[]; visible: boolean; onClose: () => void }) {
  const { db, bump } = useApp();
  const last = f ? lastPurchase(purchases, f.supply.id) : null;
  const [packs, setPacks] = useState(1);
  useEffect(() => {
    if (visible) setPacks(last?.packs ?? 1);
  }, [visible, last?.packs]);
  const confirm = useCallback(async () => {
    if (!f) return;
    await addPurchase(db, f.supply, packs, f.left, f.supply.price);
    successFeedback();
    bump();
    onClose();
  }, [db, f, packs, bump, onClose]);
  if (!f) return null;
  const s = f.supply;
  const after = f.left + packs * s.packSize;
  const afterDays = f.perDay > 0 ? Math.round(after / f.perDay) : null;
  const full = Math.max(after, s.packSize);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Bought {name}', { name: s.name })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <SupplyArt kind={s.kind} level={after / full} size={84} />
        <View style={{ flex: 1, gap: 4 }}>
          <T weight="xbold" style={{ color: colors.muted }}>
            {t('Packs of {q}', { q: qty(s.packSize, s.unit) })}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bouncy accessibilityRole="button" accessibilityLabel={t('One less')} onPress={() => (tapFeedback(), setPacks((p) => Math.max(1, p - 1)))} style={styles.step}>
              <Icon name="down" size={20} />
            </Bouncy>
            <RollingNumber value={packs} size={44} lineHeight={50} />
            <Bouncy accessibilityRole="button" accessibilityLabel={t('One more')} onPress={() => (tapFeedback(), setPacks((p) => Math.min(20, p + 1)))} style={styles.step}>
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
          {t('Last time: {n} × {q}', { n: last.packs, q: qty(last.packSize, s.unit) })}
          {last.price != null ? ` · ${last.price}` : ''}
        </T>
      ) : null}
      <View style={{ marginTop: 16 }}>
        <SlideToConfirm label={t('Slide to add to stock')} doneLabel={t('Restocked!')} color={KIND_META[s.kind].color} tint={KIND_META[s.kind].tint} onComplete={confirm} testID="buy-slide" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});

// ------------------------------------------------------------------ Home card

/**
 * On Home: the shelf at a glance (or, before anything is set up, the offer to track the food).
 * The most urgent supply leads with what to do about it.
 */
export function SuppliesCard() {
  const { pet } = useApp();
  const { forecasts } = useSupplies();
  if (!pet || !forecasts) return null;
  const now = Date.now();
  if (forecasts.length === 0)
    return (
      <Bouncy scaleTo={0.97} onPress={() => (tapFeedback(), router.push('/supplies'))} accessibilityRole="button" accessibilityLabel={t('Track {name}’s food and supplies', { name: pet.name })} style={homeStyles.card} testID="feed-supplies-setup">
        <SupplyArt kind="food" level={0.35} size={54} />
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
  const top = forecasts[0];
  const st = STATUS_META[top.status];
  const urgent = top.status === 'out' || top.status === 'buy';
  return (
    <Bouncy scaleTo={0.97} onPress={() => (tapFeedback(), router.push('/supplies'))} accessibilityRole="button" accessibilityLabel={`${t('Supplies')}: ${top.supply.name}, ${headline(top, now)}`} style={[homeStyles.card, urgent && { backgroundColor: st.tint }]} testID="feed-supplies">
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T weight="black" style={{ fontSize: 18, flex: 1 }} numberOfLines={1}>
            {urgent ? `🛒 ${top.supply.name}` : t('Supplies')}
          </T>
          <T weight="black" style={{ color: st.color, fontSize: 13 }} numberOfLines={1}>
            {headline(top, now)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {forecasts.slice(0, 4).map((f) => (
            <View key={f.supply.id} style={{ alignItems: 'center', width: 64 }}>
              <SupplyArt kind={f.supply.kind} level={f.level} size={38} status={f.status} />
              <T weight="black" style={{ fontSize: 12, color: STATUS_META[f.status].color }} numberOfLines={1}>
                {Number.isFinite(f.daysLeft) ? tn(Math.max(0, Math.floor(f.daysLeft)), '{n} day', '{n} days') : qty(f.left, f.supply.unit)}
              </T>
              <T style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                {f.supply.name}
              </T>
            </View>
          ))}
        </View>
      </View>
      <Icon name="chevR" size={18} color={colors.faint} />
    </Bouncy>
  );
}

/** Under a meal or medicine in the log card: what this log leaves in the bag. */
export function LinkedStockChip({ type }: { type: CareType }) {
  const { forecasts } = useSupplies();
  const f = forecasts?.find((x) => x.supply.link === type);
  if (!f) return null;
  const st = STATUS_META[f.status];
  return (
    <Bouncy scaleTo={0.95} onPress={() => router.push({ pathname: '/supply', params: { id: f.supply.id } })} accessibilityRole="button" style={[homeStyles.chip, { backgroundColor: st.tint }]}>
      <T weight="xbold" style={{ color: st.color, fontSize: 13 }} numberOfLines={1}>
        🛍 {f.supply.name}: {qty(f.left, f.supply.unit)}
        {Number.isFinite(f.daysLeft) ? ` · ${tn(Math.max(0, Math.floor(f.daysLeft)), '{n} day', '{n} days')}` : ''}
      </T>
    </Bouncy>
  );
}

const homeStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 28, padding: 16, marginTop: 14 },
  chip: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, maxWidth: 320 },
});
