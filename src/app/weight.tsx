import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Measurement, addMeasurement, deleteMeasurement, listMeasurements } from '../data/careRepo';
import { ValidationError } from '../data/repo';
import { dayKeyOf } from '../domain/time';
import { formatWeight, toUnit } from '../features/weight';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Card, Chip, DateField, ModalScreen, formatDateLong } from '../ui/forms';
import { Icon, Label, Pill, T } from '../ui/primitives';
import { colors, font } from '../ui/theme';
import { errorFeedback, successFeedback } from '../native/haptics';
import { t } from '../i18n';

export default function WeightScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const { pet, db, bump, version, settings, setWeightUnit } = useApp();
  const { width } = useWindowDimensions();
  const [list, setList] = useState<Measurement[]>([]);
  const [adding, setAdding] = useState(params.add === '1');
  const [value, setValue] = useState('');
  const [day, setDay] = useState(dayKeyOf(new Date()));
  const [error, setError] = useState<string | null>(null);
  const unit = settings.weightUnit;

  useEffect(() => {
    if (pet) listMeasurements(db, pet.id).then(setList);
  }, [db, pet, version]);

  const series = useMemo(() => list.map((m) => ({ at: m.at, v: toUnit(m, unit) })), [list, unit]);
  if (!pet) return null;

  const save = async () => {
    setError(null);
    const v = Number(value.replace(',', '.'));
    try {
      const today = dayKeyOf(new Date());
      const [y, mo, d] = day.split('-').map(Number);
      const at = day === today ? Date.now() : new Date(y, mo - 1, d, 12, 0).getTime();
      await addMeasurement(db, { petId: pet.id, kind: 'weight', value: v, unit, at });
      successFeedback();
      setValue('');
      setAdding(false);
      bump();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save the weight.'));
      errorFeedback();
    }
  };

  const chartW = Math.min(width, 560) - 40 - 32;
  return (
    <ModalScreen
      title={t("{name}'s weight", { name: pet.name })}
      onClose={() => router.back()}
      error={adding ? error : null}
      footer={
        adding ? (
          <Pill label={t('SAVE WEIGHT')} onPress={save} disabled={!value.trim()} testID="save-weight" />
        ) : (
          <Pill label={t('+ LOG WEIGHT')} onPress={() => setAdding(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Label style={{ flex: 1 }}>{t('Units')}</Label>
        <Chip label="kg" on={unit === 'kg'} onPress={() => setWeightUnit('kg')} />
        <Chip label="lb" on={unit === 'lb'} onPress={() => setWeightUnit('lb')} />
      </View>

      {adding ? (
        <Card style={{ gap: 14 }}>
          <Label>{t('New weight')}</Label>
          <View style={styles.bigInputRow}>
            <TextInput
              value={value}
              onChangeText={(v) => setValue(v.replace(/[^0-9.,]/g, '').slice(0, 6))}
              placeholder="0.0"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              autoFocus
              style={styles.bigInput}
              accessibilityLabel={t('Weight in {unit}', { unit })}
              onSubmitEditing={save}
            />
            <T weight="black" style={{ fontSize: 28, color: colors.muted }}>
              {unit}
            </T>
          </View>
          <DateField label={t('Weighed on')} value={day} onChange={(v) => v && setDay(v)} maxDay={dayKeyOf(new Date())} />
        </Card>
      ) : null}

      {series.length >= 2 ? (
        <Card>
          <WeightChart data={series} w={chartW} h={180} unit={unit} />
        </Card>
      ) : series.length === 0 && !adding ? (
        <Card>
          <T style={{ color: colors.muted, lineHeight: 21 }}>
            {t('No weights yet. Weigh {name} every few weeks to spot changes early — a chart appears after two entries.', { name: pet.name })}
          </T>
        </Card>
      ) : null}

      {list.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>
          {[...list].reverse().map((m, i, arr) => {
            const prev = arr[i + 1];
            const delta = prev ? toUnit(m, unit) - toUnit(prev, unit) : 0;
            return (
              <View key={m.id} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <T weight="black" style={{ fontSize: 17 }}>
                    {formatWeight(m, unit)}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>{formatDateLong(dayKeyOf(new Date(m.at)))}</T>
                </View>
                {prev ? (
                  <T weight="xbold" style={{ color: Math.abs(delta) < 0.05 ? colors.muted : colors.inkSoft, fontSize: 14 }}>
                    {Math.abs(delta) < 0.05 ? '±0' : `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta * 10) / 10)}`}
                  </T>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Delete weight from {date}', { date: formatDateLong(dayKeyOf(new Date(m.at))) })}
                  hitSlop={8}
                  onPress={async () => {
                    if (!(await confirmAsync(t('Delete this weight?'), formatWeight(m, unit)))) return;
                    await deleteMeasurement(db, m.id);
                    bump();
                  }}
                  style={styles.del}
                >
                  <Icon name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
    </ModalScreen>
  );
}

function WeightChart({ data, w, h, unit }: { data: { at: number; v: number }[]; w: number; h: number; unit: string }) {
  const padL = 34;
  const padB = 22;
  const vs = data.map((d) => d.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }
  const t0 = data[0].at;
  const t1 = data[data.length - 1].at || t0 + 1;
  const x = (ms: number) => padL + ((ms - t0) / Math.max(1, t1 - t0)) * (w - padL - 8);
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (h - padB - 16);
  const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  return (
    <Svg width={w} height={h} accessibilityLabel={t('Weight chart, {n} entries', { n: data.length })}>
      {ticks.map((tk, i) => (
        <React.Fragment key={i}>
          <Line x1={padL} x2={w} y1={y(tk)} y2={y(tk)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={0} y={y(tk) + 4} fontSize={11} fontFamily={font.bold} fill={colors.muted}>
            {tk.toFixed(1)}
          </SvgText>
        </React.Fragment>
      ))}
      <Path d={d} stroke={colors.brand} strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((p, i) => (
        <Circle key={i} cx={x(p.at)} cy={y(p.v)} r={i === data.length - 1 ? 5.5 : 3.5} fill={i === data.length - 1 ? colors.brand : '#FFFFFF'} stroke={colors.brand} strokeWidth={2} />
      ))}
      <SvgText x={padL} y={h - 4} fontSize={11} fontFamily={font.bold} fill={colors.muted}>
        {formatDateLong(dayKeyOf(new Date(t0)))}
      </SvgText>
      <SvgText x={w - 4} y={h - 4} fontSize={11} fontFamily={font.bold} fill={colors.muted} textAnchor="end">
        {unit}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  bigInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'center' },
  bigInput: { fontFamily: font.black, fontSize: 56, color: colors.ink, minWidth: 140, textAlign: 'center', padding: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  del: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
