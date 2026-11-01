import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bouncy } from '../ui/motion';
import { CARE, SPECIES_CARE, Species } from '../domain/care';
import { ACCESSORIES, Appearance, PALETTES } from '../domain/appearance';
import { Plan } from '../domain/progress';
import { Icon, Label, T } from '../ui/primitives';
import { CareIcon } from '../ui/CareIcon';
import { colors, softShadow } from '../ui/theme';
import { tapFeedback } from '../native/haptics';
import { t } from '../i18n';

export function LookPicker({ species, appearance, onChange }: { species: Species; appearance: Appearance; onChange: (a: Appearance) => void }) {
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
                tapFeedback();
                onChange({ ...appearance, paletteId: p.id });
              }}
              style={[styles.swatchWrap, on && { borderColor: colors.ink }]}
            >
              <View style={[styles.swatch, { backgroundColor: p.coat }]}>
                <View style={[styles.swatchHalf, { backgroundColor: p.patch }]} />
              </View>
              <T style={styles.swatchName}>{p.name}</T>
            </Bouncy>
          );
        })}
      </View>
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
                tapFeedback();
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

export function PlanEditor({ species, plan, onChange }: { species: Species; plan: Plan; onChange: (p: Plan) => void }) {
  const types = useMemo(() => SPECIES_CARE[species], [species]);
  return (
    <View style={{ gap: 10 }}>
      {types.map((ct) => {
        const n = plan[ct] ?? 0;
        const set = (v: number) => {
          tapFeedback();
          onChange({ ...plan, [ct]: Math.max(0, Math.min(8, v)) });
        };
        return (
          <View key={ct} style={[styles.planRow, softShadow]}>
            <CareIcon type={ct} size={44} />
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 18, color: CARE[ct].color }}>
                {CARE[ct].label}
              </T>
              <T style={{ color: colors.muted, fontSize: 14 }}>{n === 0 ? t('Not in the daily plan') : t('{n}× a day', { n })}</T>
            </View>
            <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel={t('Fewer {label}', { label: CARE[ct].label })} onPress={() => set(n - 1)} style={styles.stepBtn} hitSlop={6}>
              <T weight="black" style={styles.stepTxt}>
                −
              </T>
            </Bouncy>
            <T weight="black" style={{ width: 22, textAlign: 'center', fontSize: 20 }}>
              {n}
            </T>
            <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel={t('More {label}', { label: CARE[ct].label })} onPress={() => set(n + 1)} style={styles.stepBtn} hitSlop={6}>
              <Icon name="plus" size={18} />
            </Bouncy>
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
  swatchName: { fontSize: 12, color: colors.muted, marginTop: 4 },
  dotWrap: { padding: 4, borderRadius: 24, borderWidth: 2.5, borderColor: 'transparent' },
  dot: { width: 36, height: 36, borderRadius: 18 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 22, padding: 12, paddingRight: 14 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 24, lineHeight: 26 },
});
