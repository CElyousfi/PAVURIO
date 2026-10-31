import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { PetRecord, RECORD_KINDS, RecordKind, listRecords, recordKind } from '../../data/recordsRepo';
import { addDays, dayKeyOf } from '../../domain/time';
import { buildCareSummary } from '../../features/summary';
import { shareText } from '../../native/files';
import { useApp } from '../../state/AppState';
import { Card, Chip, EmptyState, TabTitle, formatDateLong } from '../../ui/forms';
import { CircleButton, Icon, T } from '../../ui/primitives';
import { KindGlyph } from '../../features/RecordGlyph';
import { colors } from '../../ui/theme';
import { t, tn } from '../../i18n';

export default function RecordsTab() {
  const { pet, db, version, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<PetRecord[]>([]);
  const [filter, setFilter] = useState<RecordKind | 'all'>('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pet) listRecords(db, pet.id).then(setRecords);
  }, [db, pet, version]);

  const today = dayKeyOf(new Date());
  const soon = addDays(today, 60);
  const due = useMemo(
    () => records.filter((r) => r.dueDate && r.dueDate <= soon).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)),
    [records, soon],
  );
  const shown = filter === 'all' ? records : records.filter((r) => r.kind === filter);
  if (!pet) return null;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const text = await buildCareSummary(db, pet, settings.weightUnit);
      await shareText(text, `${pet.name.replace(/[^\w-]+/g, '_')}-care-summary.txt`, 'text/plain');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <TabTitle
        title={t('Records')}
        subtitle={t("{name}'s health file", { name: pet.name })}
        right={<CircleButton icon="plus" label={t('Add a record')} onPress={() => router.push('/record')} size={50} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        {due.length > 0 ? (
          <Card style={{ backgroundColor: '#FFF8EC' }}>
            <T weight="black" style={{ fontSize: 16, marginBottom: 6 }}>
              {t('Coming up')}
            </T>
            {due.slice(0, 4).map((r) => {
              const late = r.dueDate! < today;
              return (
                <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={t('{title} due {date}', { title: r.title, date: formatDateLong(r.dueDate) })} onPress={() => router.push({ pathname: '/record', params: { id: r.id } })} style={styles.dueRow}>
                  <View style={[styles.kindDot, { backgroundColor: recordKind(r.kind).color }]} />
                  <T weight="xbold" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
                    {r.title}
                  </T>
                  <T weight="black" style={{ fontSize: 13, color: late ? colors.danger : '#B45309' }}>
                    {late ? `${t('Overdue')} · ` : ''}
                    {formatDateLong(r.dueDate)}
                  </T>
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label={t('All')} on={filter === 'all'} onPress={() => setFilter('all')} />
          {RECORD_KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} on={filter === k.kind} color={k.color} tint={k.tint} onPress={() => setFilter(k.kind)} />
          ))}
        </ScrollView>

        {shown.length === 0 ? (
          <EmptyState
            title={records.length === 0 ? t('Keep it all in one place') : t('Nothing here yet')}
            body={
              records.length === 0
                ? t("Vaccines, vet visits, medication and allergies — with photos of the paperwork. Share a summary with {name}'s vet or sitter in one tap.", { name: pet.name })
                : t('Add a record of this kind with the + button.')
            }
            action={records.length === 0 ? t('ADD FIRST RECORD') : undefined}
            onAction={() => router.push('/record')}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {shown.map((r) => {
              const k = recordKind(r.kind);
              const thumb = r.attachments.find((a) => a.mime?.startsWith('image/'));
              return (
                <Card key={r.id} onPress={() => router.push({ pathname: '/record', params: { id: r.id } })} accessibilityLabel={`${k.label}: ${r.title}`} style={styles.rec}>
                  <View style={[styles.kindBadge, { backgroundColor: k.tint }]}>
                    <KindGlyph kind={r.kind} color={k.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="black" style={{ fontSize: 16 }} numberOfLines={1}>
                      {r.title}
                    </T>
                    <T style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                      {k.label} · {formatDateLong(r.date)}
                      {r.dueDate ? ` · ${t('next {date}', { date: formatDateLong(r.dueDate) })}` : ''}
                    </T>
                    {r.attachments.length ? (
                      <T weight="xbold" style={{ color: k.color, fontSize: 12, marginTop: 2 }}>
                        {tn(r.attachments.length, '{n} attachment', '{n} attachments')}
                      </T>
                    ) : null}
                  </View>
                  {thumb ? <Image source={{ uri: thumb.uri }} style={styles.thumb} accessibilityIgnoresInvertColors /> : <Icon name="chevR" size={18} color={colors.faint} />}
                </Card>
              );
            })}
          </View>
        )}

        <Card onPress={share} accessibilityLabel={t('Share a care summary')} style={styles.share}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" stroke={colors.brand} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <View style={{ flex: 1 }}>
            <T weight="black" style={{ fontSize: 16 }}>
              {busy ? t('Preparing…') : t('Share care summary')}
            </T>
            <T style={{ color: colors.muted, fontSize: 13 }}>{t('Records, routine, visits and weight — for the vet or a sitter')}</T>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  kindDot: { width: 10, height: 10, borderRadius: 5 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kindBadge: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.line },
  share: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
});
