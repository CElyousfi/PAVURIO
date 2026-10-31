import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from '../data/careRepo';
import { ValidationError } from '../data/repo';
import { WEEKDAYS_SHORT } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';
import { KindIcon, kindMeta, routineKindsFor } from '../features/routines';
import { getPermission, requestPermission, PermissionState } from '../native/notifications';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen, TimeField, Toggle } from '../ui/forms';
import { Icon, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';

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
const DEFAULT_TITLE: Record<string, string> = {
  meal: 'Meals',
  walk: 'Walk',
  water: 'Fresh water',
  play: 'Playtime',
  grooming: 'Brushing',
  litter: 'Scoop the litter',
  medication: 'Medication',
  custom: '',
};

export default function ScheduleEditor() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const { pet, db, bump } = useApp();
  const [loaded, setLoaded] = useState(!params.id);
  const [type, setType] = useState(params.type ?? 'meal');
  const [title, setTitle] = useState(DEFAULT_TITLE[params.type ?? 'meal'] ?? '');
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

  const pickType = (t: string) => {
    setType(t);
    if (!titleTouched) setTitle(DEFAULT_TITLE[t] ?? '');
    if (!params.id) setTimes(DEFAULT_TIMES[t] ?? ['12:00']);
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
      setError(e instanceof ValidationError ? e.message : 'Could not save the routine. Please try again.');
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!params.id) return;
    if (!(await confirmAsync('Delete this routine?', 'Its reminders stop. Care you already logged stays in your history.'))) return;
    await deleteSchedule(db, params.id);
    bump();
    router.back();
  };

  const activeDays = days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days;

  return (
    <ModalScreen
      title={params.id ? 'Edit routine' : 'New routine'}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={params.id ? 'SAVE ROUTINE' : 'ADD ROUTINE'} color={color} onPress={save} loading={saving} testID="save-schedule" />
          {params.id ? <SoftPill label="Delete routine" color={colors.danger} tint={colors.dangerSoft} onPress={remove} /> : null}
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Label>What</Label>
        <View style={styles.kinds}>
          {routineKindsFor(pet.species).map((t) => {
            const on = t === type;
            const m = kindMeta(t);
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m.label}
                onPress={() => {
                  tapFeedback();
                  pickType(t);
                }}
                style={[styles.kind, on && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
              >
                <KindIcon type={t} size={44} />
                <T weight="black" style={{ fontSize: 12, color: on ? m.color : colors.inkSoft }} numberOfLines={1}>
                  {m.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field
        label="Name"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTitleTouched(true);
        }}
        placeholder={type === 'medication' ? 'e.g. Heartworm pill' : 'e.g. Breakfast'}
        maxLength={60}
      />

      <View style={{ gap: 8 }}>
        <Label>Times</Label>
        {times.map((t, i) => (
          <View key={`${i}-${t}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TimeField label="" value={t} onChange={(v) => setTimes(times.map((x, j) => (j === i ? v : x)))} />
            </View>
            {times.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Remove time" onPress={() => setTimes(times.filter((_, j) => j !== i))} style={styles.remove} hitSlop={6}>
                <Icon name="close" size={18} color={colors.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {times.length < 12 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a time"
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
              Add a time
            </T>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Days</Label>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {WEEKDAYS_SHORT.map((d, i) => {
            const on = activeDays.includes(i);
            return (
              <Pressable
                key={i}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
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
          <Chip label="Every day" on={days.length === 0} onPress={() => setDays([])} />
          <Chip label="Weekdays" on={days.join() === '1,2,3,4,5'} onPress={() => setDays([1, 2, 3, 4, 5])} />
          <Chip label="Weekends" on={days.join() === '0,6'} onPress={() => setDays([0, 6])} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label="Starts" value={startDate} onChange={(v) => v && setStartDate(v)} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="Ends" value={endDate} onChange={setEndDate} allowClear placeholder="Never" />
        </View>
      </View>

      <View style={styles.box}>
        <Toggle label="Remind me" body="A notification at each time. Nothing is ever marked done for you." value={remind} onChange={setRemind} />
        {remind && perm === 'denied' ? (
          <T weight="xbold" style={{ color: '#B45309', fontSize: 13, lineHeight: 18 }}>
            Notifications are off for Pavurio. Turn them on in your phone's Settings to get reminders.
          </T>
        ) : null}
        {remind && perm === 'unsupported' ? (
          <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>Reminders arrive on the iPhone and Android app.</T>
        ) : null}
        {params.id ? <Toggle label="Active" body="Pause a routine without deleting it." value={enabled} onChange={setEnabled} /> : null}
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
