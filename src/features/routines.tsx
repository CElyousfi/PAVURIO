/** Shared pieces for scheduled care: kind metadata, icons, occurrence rows and their actions. */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Db } from '../data/db';
import { clearMark, setMark } from '../data/careRepo';
import { CARE, CareType, Species, careAllowedFor, isCareType } from '../domain/care';
import { Occurrence, formatTime24to12 } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';
import { CareIcon } from '../ui/CareIcon';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback, tapFeedback } from '../native/haptics';

export const EXTRA_KINDS = {
  medication: { label: 'Medication', color: '#E5484D' },
  custom: { label: 'Other', color: '#64748B' },
} as const;

export function kindMeta(type: string): { label: string; color: string } {
  if (isCareType(type)) return { label: CARE[type].label, color: CARE[type].color };
  return EXTRA_KINDS[type as keyof typeof EXTRA_KINDS] ?? EXTRA_KINDS.custom;
}

export function routineKindsFor(species: Species): string[] {
  return [...(Object.keys(CARE) as CareType[]).filter((t) => careAllowedFor(species, t)), 'medication', 'custom'];
}

export function KindIcon({ type, size }: { type: string; size: number }) {
  if (isCareType(type)) return <CareIcon type={type} size={size} />;
  const { color } = kindMeta(type);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
        {type === 'medication' ? (
          <>
            <Rect x={3} y={8.5} width={18} height={7} rx={3.5} transform="rotate(-35 12 12)" fill={color} />
            <Path d="M12 8.5V15.5" stroke="#FFFFFF" strokeWidth={2} transform="rotate(-35 12 12)" />
          </>
        ) : (
          <>
            <Circle cx={12} cy={12} r={8} fill={color} />
            <Path d="M8.5 12.2l2.3 2.3 4.7-4.9" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

const STATUS_LABEL: Record<Occurrence['status'], string> = {
  upcoming: 'Upcoming',
  due: 'Due now',
  overdue: 'Overdue',
  done: 'Done',
  skipped: 'Skipped',
  snoozed: 'Snoozed',
};
const STATUS_COLOR: Record<Occurrence['status'], string> = {
  upcoming: colors.muted,
  due: colors.brand,
  overdue: '#E58A00',
  done: '#3FA34D',
  skipped: colors.muted,
  snoozed: '#8E7CF0',
};

/** Done on a care type opens its log card (so the log is a real record); other kinds are just ticked. */
export function completeOccurrence(db: Db, species: Species, o: Occurrence, bump: () => void) {
  tapFeedback();
  if (isCareType(o.type) && careAllowedFor(species, o.type) && o.at <= Date.now() + 60 * 60_000) {
    router.push({ pathname: '/log/[type]', params: { type: o.type, day: dayKeyOf(new Date(Math.min(o.at, Date.now()))), scheduleId: o.scheduleId, occ: o.key } });
    return;
  }
  void setMark(db, o.scheduleId, o.key, 'done').then(() => {
    successFeedback();
    bump();
  });
}
export async function skipOccurrence(db: Db, o: Occurrence, bump: () => void) {
  tapFeedback();
  await setMark(db, o.scheduleId, o.key, 'skipped');
  bump();
}
export async function snoozeOccurrence(db: Db, o: Occurrence, bump: () => void, minutes = 30) {
  tapFeedback();
  await setMark(db, o.scheduleId, o.key, 'snoozed', { snoozeUntil: Date.now() + minutes * 60_000 });
  bump();
}
export async function reopenOccurrence(db: Db, o: Occurrence, bump: () => void) {
  tapFeedback();
  await clearMark(db, o.scheduleId, o.key);
  bump();
}

export function OccurrenceRow({
  o,
  db,
  species,
  bump,
  compact,
}: {
  o: Occurrence;
  db: Db;
  species: Species;
  bump: () => void;
  compact?: boolean;
}) {
  const closed = o.status === 'done' || o.status === 'skipped';
  const future = o.at > Date.now() + 60 * 60_000;
  const when =
    o.status === 'snoozed' && o.snoozeUntil
      ? `Snoozed to ${formatTime24to12(`${new Date(o.snoozeUntil).getHours()}:${String(new Date(o.snoozeUntil).getMinutes()).padStart(2, '0')}`)}`
      : formatTime24to12(o.time);
  return (
    <View style={[styles.row, closed && { opacity: 0.62 }]} accessibilityLabel={`${o.title}, ${when}, ${STATUS_LABEL[o.status]}`}>
      <KindIcon type={o.type} size={compact ? 40 : 44} />
      <View style={{ flex: 1 }}>
        <T weight="black" style={[styles.title, closed && o.status === 'skipped' && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
          {o.title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T style={styles.meta}>{when}</T>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[o.status] }]} />
          <T weight="xbold" style={[styles.meta, { color: STATUS_COLOR[o.status] }]}>
            {STATUS_LABEL[o.status]}
          </T>
        </View>
      </View>
      {closed ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Reopen ${o.title}`} onPress={() => reopenOccurrence(db, o, bump)} style={styles.ghost} hitSlop={6}>
          <T weight="black" style={styles.ghostText}>
            REOPEN
          </T>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {!future ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Snooze ${o.title} 30 minutes`} onPress={() => snoozeOccurrence(db, o, bump)} style={styles.round} hitSlop={4}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Circle cx={12} cy={13} r={7.5} stroke={colors.inkSoft} strokeWidth={2.2} fill="none" />
                <Path d="M12 9.5V13l2.3 1.6M4.5 5.5 7 3.5M19.5 5.5 17 3.5" stroke={colors.inkSoft} strokeWidth={2.2} strokeLinecap="round" fill="none" />
              </Svg>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Skip ${o.title}`} onPress={() => skipOccurrence(db, o, bump)} style={styles.round} hitSlop={4}>
            <Icon name="close" size={18} color={colors.inkSoft} />
          </Pressable>
          {!future ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${o.title} done`}
              onPress={() => completeOccurrence(db, species, o, bump)}
              style={[styles.round, { backgroundColor: kindMeta(o.type).color }]}
              hitSlop={4}
              testID={`occ-done-${o.key}`}
            >
              <Icon name="check" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  title: { fontSize: 16 },
  meta: { fontSize: 13, color: colors.muted },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  round: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ghost: { paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 12, letterSpacing: 1, color: colors.inkSoft },
});
