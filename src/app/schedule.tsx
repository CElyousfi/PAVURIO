import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from '../data/careRepo';
import { ValidationError } from '../data/repo';
import { weekdayInitials } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';
import { KindIcon, kindMeta, routineKindsFor } from '../features/routines';
import { getPermission, requestPermission, PermissionState } from '../native/notifications';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen, TimeField, Toggle } from '../ui/forms';
import { Icon, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { t } from '../i18n';
import { capitalize, weekdayNames } from '../i18n/dates';

const DEFAULT_TIMES: Record<string, string[]> = {
  meal: ['08:00', '18:00'],
  walk: ['07:30', '18:30'],
  water: ['09:00'],
  play: ['17:00'],
  grooming: ['10:00'],
  litter: ['09:00'],
  medication: ['20:00'],
  custom: ['12:00'],
};
const DEFAULT_TITLE: Record<string, () => string> = {
  meal: () => t('Meals'),
  walk: () => t('Walk'),
  water: () => t('Fresh water'),
  play: () => t('Playtime'),
  grooming: () => t('Brushing'),
  litter: () => t('Scoop the litter'),
  medication: () => t('Medication'),
  custom: () => '',
};

export default function ScheduleEditor() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const { pet, db, bump } = useApp();
  const [loaded, setLoaded] = useState(!params.id);
  const [type, setType] = useState(params.type ?? 'meal');
  const [title, setTitle] = useState(DEFAULT_TITLE[params.type ?? 'meal']?.() ?? '');
  const [titleTouched, setTitleTouched] = useState(!!params.id);
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES[params.type ?? 'meal'] ?? ['08:00']);
  const [days, setDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(dayKeyOf(new Date()));
  const [endDate, setEndDate] = useState<string | null>(null);
  const [remind, setRemind] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [perm, setPerm] = useState<PermissionState>('undetermined');

  useEffect(() => {
    void getPermission().then(setPerm);
  }, []);

  useEffect(() => {
    if (!params.id || !pet) return;
    listSchedules(db, pet.id).then((all) => {
      const s = all.find((x) => x.id === params.id);
      if (!s) return router.back();
      setType(s.type);
      setTitle(s.title);
      setTimes(s.times);
      setDays(s.days);
      setStartDate(s.startDate);
      setEndDate(s.endDate);
      setRemind(s.remind);
      setEnabled(s.enabled);
      setLoaded(true);
    });
  }, [db, pet, params.id]);

  if (!pet || !loaded) return null;
  const color = kindMeta(type).color;

  const pickType = (k: string) => {
    setType(k);
    if (!titleTouched) setTitle(DEFAULT_TITLE[k]?.() ?? '');
    if (!params.id) setTimes(DEFAULT_TIMES[k] ?? ['12:00']);
  };

  const toggleDay = (d: number) => {
    tapFeedback();
    const all = days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days;
    const next = all.includes(d) ? all.filter((x) => x !== d) : [...all, d];
    setDays(next.length === 7 ? [] : next);
  };

  const save = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const input = { petId: pet.id, type, title, times, days, startDate, endDate, remind, enabled };
      if (params.id) await updateSchedule(db, params.id, input);
      else await createSchedule(db, input);
      if (remind && perm === 'undetermined') setPerm(await requestPermission());
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save the routine. Please try again.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!params.id) return;
    if (!(await confirmAsync(t('Delete this routine?'), t('Its reminders stop. Care you already logged stays in your history.')))) return;
    await deleteSchedule(db, params.id);
    bump();
    router.back();
  };

  const activeDays = days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days;

  return (
    <ModalScreen
      title={params.id ? t('Edit routine') : t('New routine')}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={params.id ? t('SAVE ROUTINE') : t('ADD ROUTINE')} color={color} onPress={save} loading={saving} testID="save-schedule" />
          {params.id ? <SoftPill label={t('Delete routine')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} /> : null}
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Label>{t('What')}</Label>
        <View style={styles.kinds}>
          {routineKindsFor(pet.species).map((k) => {
            const on = k === type;
            const m = kindMeta(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m.label}
                onPress={() => {
                  tapFeedback();
                  pickType(k);
                }}
                style={[styles.kind, on && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
              >
                <KindIcon type={k} size={44} />
                <T weight="black" style={{ fontSize: 12, color: on ? m.color : colors.inkSoft }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {m.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field
        label={t('Name')}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTitleTouched(true);
        }}
        placeholder={type === 'medication' ? t('e.g. Heartworm pill') : t('e.g. Breakfast')}
        maxLength={60}
      />

      <View style={{ gap: 8 }}>
        <Label>{t('Times')}</Label>
        {times.map((tm, i) => (
          <View key={`${i}-${tm}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TimeField label="" value={tm} onChange={(v) => setTimes(times.map((x, j) => (j === i ? v : x)))} />
            </View>
            {times.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('Remove time')} onPress={() => setTimes(times.filter((_, j) => j !== i))} style={styles.remove} hitSlop={6}>
                <Icon name="close" size={18} color={colors.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {times.length < 12 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Add a time')}
            onPress={() => {
              tapFeedback();
              const last = times[times.length - 1] ?? '08:00';
              const h = (Number(last.slice(0, 2)) + 4) % 24;
              setTimes([...times, `${String(h).padStart(2, '0')}:${last.slice(3)}`]);
            }}
            style={styles.addTime}
          >
            <Icon name="plus" size={18} color={color} />
            <T weight="black" style={{ color, fontSize: 15 }}>
              {t('Add a time')}
            </T>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Label>{t('Days')}</Label>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {weekdayInitials().map((d, i) => {
            const on = activeDays.includes(i);
            return (
              <Pressable
                key={i}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={capitalize(weekdayNames()[i])}
                onPress={() => toggleDay(i)}
                style={[styles.day, { backgroundColor: on ? color : colors.line }]}
              >
                <T weight="black" style={{ color: on ? '#FFFFFF' : colors.inkSoft, fontSize: 15 }}>
                  {d}
                </T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={t('Every day')} on={days.length === 0} onPress={() => setDays([])} />
          <Chip label={t('Weekdays')} on={days.join() === '1,2,3,4,5'} onPress={() => setDays([1, 2, 3, 4, 5])} />
          <Chip label={t('Weekends')} on={days.join() === '0,6'} onPress={() => setDays([0, 6])} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label={t('Starts')} value={startDate} onChange={(v) => v && setStartDate(v)} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label={t('Ends')} value={endDate} onChange={setEndDate} allowClear placeholder={t('Never')} />
        </View>
      </View>

      <View style={styles.box}>
        <Toggle label={t('Remind me')} body={t('A notification at each time. Nothing is ever marked done for you.')} value={remind} onChange={setRemind} />
        {remind && perm === 'denied' ? (
          <T weight="xbold" style={{ color: '#B45309', fontSize: 13, lineHeight: 18 }}>
            {t("Notifications are off for Pavurio. Turn them on in your phone's Settings to get reminders.")}
          </T>
        ) : null}
        {remind && perm === 'unsupported' ? (
          <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{t('Reminders arrive on the iPhone and Android app.')}</T>
        ) : null}
        {params.id ? <Toggle label={t('Active')} body={t('Pause a routine without deleting it.')} value={enabled} onChange={setEnabled} /> : null}
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '23%', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 18, borderWidth: 2, borderColor: colors.line },
  remove: { width: 44, height: 54, borderRadius: 18, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  addTime: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, justifyContent: 'center' },
  day: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: colors.canvasWarm, borderRadius: 20, padding: 14, gap: 8 },
});
