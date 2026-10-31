import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createAppointment, deleteAppointment, getAppointment, setAppointmentDone, updateAppointment } from '../data/careRepo';
import { ValidationError } from '../data/repo';
import { addDays, dayKeyOf } from '../domain/time';
import { localInstant } from '../domain/schedule';
import { requestPermission } from '../native/notifications';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen, TimeField } from '../ui/forms';
import { Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback } from '../native/haptics';

const REMIND: { label: string; minutes: number | null }[] = [
  { label: 'No reminder', minutes: null },
  { label: '1 hour before', minutes: 60 },
  { label: '3 hours before', minutes: 180 },
  { label: 'Day before', minutes: 1440 },
];
const PRESETS = ['Vet check-up', 'Vaccination', 'Groomer', 'Dental cleaning', 'Pet sitter'];

export default function AppointmentEditor() {
  const params = useLocalSearchParams<{ id?: string; day?: string }>();
  const { pet, db, bump } = useApp();
  const [loaded, setLoaded] = useState(!params.id);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(params.day ?? addDays(dayKeyOf(new Date()), 1));
  const [time, setTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [remind, setRemind] = useState<number | null>(1440);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getAppointment(db, params.id).then((a) => {
      if (!a) return router.back();
      const d = new Date(a.at);
      setTitle(a.title);
      setDay(dayKeyOf(d));
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setLocation(a.location ?? '');
      setNotes(a.notes ?? '');
      setRemind(a.remindMinutes);
      setDoneAt(a.doneAt);
      setLoaded(true);
    });
  }, [db, params.id]);

  if (!pet || !loaded) return null;
  const at = localInstant(day, time);
  const past = at < Date.now();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = { petId: pet.id, title, at, location, notes, remindMinutes: remind };
      if (params.id) await updateAppointment(db, params.id, input);
      else await createAppointment(db, input);
      if (remind != null) await requestPermission();
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save the appointment.');
      errorFeedback();
      setSaving(false);
    }
  };

  return (
    <ModalScreen
      title={params.id ? 'Appointment' : 'New appointment'}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={params.id ? 'SAVE' : 'ADD APPOINTMENT'} onPress={save} loading={saving} testID="save-appointment" />
          {params.id ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SoftPill
                label={doneAt ? 'Mark not done' : 'Mark as done'}
                style={{ flex: 1 }}
                onPress={async () => {
                  await setAppointmentDone(db, params.id!, !doneAt);
                  bump();
                  router.back();
                }}
              />
              <SoftPill
                label="Delete"
                color={colors.danger}
                tint={colors.dangerSoft}
                style={{ flex: 1 }}
                onPress={async () => {
                  if (!(await confirmAsync('Delete this appointment?', 'Its reminder is cancelled too.'))) return;
                  await deleteAppointment(db, params.id!);
                  bump();
                  router.back();
                }}
              />
            </View>
          ) : null}
        </>
      }
    >
      <Field label="What" value={title} onChangeText={setTitle} placeholder="e.g. Annual check-up" maxLength={80} />
      {!params.id ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
          {PRESETS.map((p) => (
            <Chip key={p} label={p} on={title === p} onPress={() => setTitle(p)} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1.2 }}>
          <DateField label="Day" value={day} onChange={(v) => v && setDay(v)} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="Time" value={time} onChange={setTime} />
        </View>
      </View>
      {past && !params.id ? (
        <T weight="xbold" style={{ color: '#B45309', fontSize: 13, marginTop: -8 }}>
          This is in the past — fine for keeping a record of a visit.
        </T>
      ) : null}
      <Field label="Where (optional)" value={location} onChangeText={setLocation} placeholder="Clinic or address" maxLength={120} />
      <View style={{ gap: 8 }}>
        <Label>Reminder</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REMIND.map((r) => (
            <Chip key={r.label} label={r.label} on={remind === r.minutes} onPress={() => setRemind(r.minutes)} />
          ))}
        </View>
      </View>
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Questions for the vet, things to bring…" multiline maxLength={2000} />
    </ModalScreen>
  );
}
