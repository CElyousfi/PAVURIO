import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bouncy, Pop } from '../ui/motion';
import { CARE, SPECIES_CARE, Species, formatAmount } from '../domain/care';
import { ACCESSORIES, Appearance, PALETTES } from '../domain/appearance';
import { Plan, Portions, portionOf } from '../domain/progress';
import { Icon, Label, T } from '../ui/primitives';
import { CareIcon } from '../ui/CareIcon';
import { colors } from '../ui/theme';
import { tickFeedback } from '../native/haptics';
import { t } from '../i18n';

export function LookPicker({ species, appearance, onChange, pro = false }: { species: Species; appearance: Appearance; onChange: (a: Appearance) => void; pro?: boolean }) {
  const chosen = PALETTES[species].find((p) => p.id === appearance.paletteId);
  return (
    <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, gap: 14 }}>
      <Label>{t('Coat')}</Label>
      <View style={styles.swatchRow}>
        {PALETTES[species].map((p) => {
          const on = p.id === appearance.paletteId;
          return (
            <Bouncy
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t('{name} coat', { name: p.name })}
              onPress={() => {
                onChange({ ...appearance, paletteId: p.id });
              }}
              style={[styles.swatchWrap, on && { borderColor: colors.ink }]}
            >
              <View style={[styles.swatch, { backgroundColor: p.coat }]}>
                <View style={[styles.swatchHalf, { backgroundColor: p.patch }]} />
              </View>
              {p.pro && !pro ? (
                <View style={styles.proTag}>
                  <T weight="black" style={styles.proTagText}>
                    PRO
                  </T>
                </View>
              ) : null}
              <T style={styles.swatchName} numberOfLines={1}>
                {p.name}
              </T>
            </Bouncy>
          );
        })}
      </View>
      {chosen?.pro && !pro ? (
        <View style={styles.tryOn}>
          <T weight="black" style={{ fontSize: 14 }}>
            {t('Trying on {coat} ✨', { coat: chosen.name })}
          </T>
          <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{t('Realistic coats come with Pro. Try any of them on — keep the one you love.')}</T>
        </View>
      ) : null}
      <Label>{species === 'dog' ? t('Bandana') : t('Collar')}</Label>
      <View style={styles.swatchRow}>
        {ACCESSORIES.map((a) => {
          const on = a.id === appearance.accessoryId;
          return (
            <Bouncy
              key={a.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={species === 'dog' ? t('{name} bandana', { name: a.name }) : t('{name} collar', { name: a.name })}
              onPress={() => {
                onChange({ ...appearance, accessoryId: a.id });
              }}
              style={[styles.dotWrap, on && { borderColor: colors.ink }]}
            >
              <View style={[styles.dot, { backgroundColor: a.color }]} />
            </Bouncy>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The owner's daily plan: how many times a day, and how much each time. Together they are the goal each
 * care's picture fills toward (2 × 100 g = a full bowl at 200 g), so every pet fills up its own way.
 */
export function PlanEditor({
  species,
  plan,
  portions,
  onChange,
}: {
  species: Species;
  plan: Plan;
  portions: Portions;
  onChange: (p: Plan, portions: Portions) => void;
}) {
  const types = useMemo(() => SPECIES_CARE[species], [species]);
  return (
    <View style={{ gap: 10 }}>
      {types.map((ct) => {
        const n = plan[ct] ?? 0;
        const spec = CARE[ct].amount;
        const portion = portionOf(ct, portions);
        const set = (v: number) => {
          tickFeedback();
          onChange({ ...plan, [ct]: Math.max(0, Math.min(8, v)) }, portions);
        };
        const setPortion = (dir: 1 | -1) => {
          if (!spec) return;
          tickFeedback();
          const next = Math.round((portion + dir * spec.step) * 100) / 100;
          onChange(plan, { ...portions, [ct]: Math.max(spec.min, Math.min(spec.max, next)) });
        };
        const label = CARE[ct].label;
        return (
          <View key={ct} style={styles.planRow}>
            <View style={styles.planTop}>
              <CareIcon type={ct} size={44} />
              <View style={{ flex: 1 }}>
                <T weight="black" style={{ fontSize: 18, color: CARE[ct].color }}>
                  {label}
                </T>
                <T style={{ color: colors.muted, fontSize: 14 }}>{n === 0 ? t('Not in the daily plan') : t('{n}× a day', { n })}</T>
              </View>
              <Bouncy scaleTo={0.88} accessibilityRole="button" accessibilityLabel={t('Fewer {label}', { label })} onPress={() => set(n - 1)} style={styles.stepBtn} hitSlop={6}>
                <T weight="black" style={styles.stepTxt}>
                  −
                </T>
              </Bouncy>
              <Pop trigger={n} amount={0.35} style={{ width: 22, alignItems: 'center' }}>
                <T weight="black" style={{ fontSize: 20 }}>{n}</T>
              </Pop>
              <Bouncy scaleTo={0.88} accessibilityRole="button" accessibilityLabel={t('More {label}', { label })} onPress={() => set(n + 1)} style={styles.stepBtn} hitSlop={6}>
                <Icon name="plus" size={18} />
              </Bouncy>
            </View>
            {spec && n > 0 ? (
              <View style={styles.portionRow}>
                <T weight="xbold" style={{ flex: 1, color: colors.muted, fontSize: 14 }}>
                  {t('Each time')}
                </T>
                <Bouncy scaleTo={0.88} accessibilityRole="button" accessibilityLabel={t('Less {label} each time', { label })} onPress={() => setPortion(-1)} style={styles.stepSmall} hitSlop={6}>
                  <T weight="black" style={{ fontSize: 18, lineHeight: 20 }}>
                    −
                  </T>
                </Bouncy>
                <T weight="black" style={{ minWidth: 70, textAlign: 'center', fontSize: 16, color: CARE[ct].color }} accessibilityLiveRegion="polite">
                  {formatAmount(ct, portion)}
                </T>
                <Bouncy scaleTo={0.88} accessibilityRole="button" accessibilityLabel={t('More {label} each time', { label })} onPress={() => setPortion(1)} style={styles.stepSmall} hitSlop={6}>
                  <Icon name="plus" size={14} />
                </Bouncy>
              </View>
            ) : null}
            {spec && n > 0 ? (
              <T style={styles.goal}>
                {t('Daily goal: {goal}', { goal: formatAmount(ct, Math.round(n * portion * 100) / 100) })}
              </T>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  swatchRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatchWrap: { alignItems: 'center', padding: 6, borderRadius: 18, borderWidth: 2.5, borderColor: 'transparent' },
  swatch: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
  swatchHalf: { position: 'absolute', left: 0, top: 0, width: 50, height: 22 },
  swatchName: { fontSize: 12, color: colors.muted, marginTop: 4, maxWidth: 62 },
  proTag: { position: 'absolute', top: 2, right: 0, backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  proTagText: { color: '#FFFFFF', fontSize: 9, letterSpacing: 0.6 },
  tryOn: { backgroundColor: '#FFF6E5', borderRadius: 18, padding: 12, gap: 2 },
  dotWrap: { padding: 4, borderRadius: 24, borderWidth: 2.5, borderColor: 'transparent' },
  dot: { width: 36, height: 36, borderRadius: 18 },
  planRow: { backgroundColor: colors.card, borderRadius: 22, padding: 12, paddingRight: 14, gap: 8 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 6, paddingLeft: 14, paddingRight: 8 },
  stepSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  goal: { fontSize: 12, color: colors.muted, paddingLeft: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 24, lineHeight: 26 },
});
