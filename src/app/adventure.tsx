/**
 * One adventure: its facts, plus the owner's corrections (real duration if they forgot to finish, a note,
 * a photo) and delete. Edits flow through walkRepo so the care log, Moments and badges stay in step.
 */
import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { deleteWalk, editWalk, getWalk } from '../data/walkRepo';
import { Walk, durationText, timeOfDay, timeOfDayLabel, walkEnd } from '../domain/walks';
import { conditionLabel, formatTemp, weatherArt } from '../domain/weather';
import { formatClock } from '../domain/time';
import { persistFile, pickPhoto } from '../native/files';
import { TIME_ART, WEATHER_ART } from '../features/adventures';
import { Missing } from '../ui/Missing';
import { CircleButton, Pill, SoftPill, T } from '../ui/primitives';
import { Bouncy } from '../ui/motion';
import { formatDateLong } from '../ui/forms';
import { colors, font } from '../ui/theme';
import { confirmAsync } from '../ui/confirm';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { t } from '../i18n';

export default function Adventure() {
  const { id, edit } = useLocalSearchParams<{ id?: string; edit?: string }>();
  const { db, bump, settings, pet } = useApp();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState<Walk | null | undefined>(undefined);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const unit = settings.weightUnit === 'lb' ? 'F' : 'C';

  useEffect(() => {
    if (!id) return setW(null);
    getWalk(db, id).then((x) => {
      const ok = x && x.status === 'completed' ? x : null;
      setW(ok);
      if (ok) {
        setMinutes(Math.max(1, Math.round((ok.durationMs ?? 0) / 60_000)));
        setNote(ok.note ?? '');
        setPhoto(ok.photoUri);
      }
    });
  }, [db, id]);

  if (w === undefined) return <View style={styles.root} />;
  if (!w) return <Missing />;

  const tod = timeOfDay(w.startedAt, walkEnd(w), w.weather?.sunset);
  const art = weatherArt(w.weather);
  const dirty = minutes !== Math.max(1, Math.round((w.durationMs ?? 0) / 60_000)) || note.trim() !== (w.note ?? '') || photo !== w.photoUri;
  const d = new Date(w.startedAt);
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const step = (dir: 1 | -1) => {
    tapFeedback();
    setMinutes((m) => Math.max(1, Math.min(600, m + dir * (m >= 30 ? 5 : 1))));
  };
  const addPhoto = async () => {
    try {
      const p = await pickPhoto('library');
      if (!p) return;
      setPhoto((await persistFile(p, 'moments')).uri);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      // only a changed duration is written (a note or photo edit never rounds the walk's real time)
      const timeChanged = minutes !== Math.max(1, Math.round((w.durationMs ?? 0) / 60_000));
      const next = await editWalk(db, w.id, { durationMs: timeChanged ? minutes * 60_000 : undefined, note, photoUri: photo });
      setW(next);
      bump();
      successFeedback();
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      errorFeedback();
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!(await confirmAsync(t('Delete this adventure?'), t('It will also be removed from the day, Moments and the Paw Passport.')))) return;
    await deleteWalk(db, w.id);
    bump();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30, paddingHorizontal: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} />
        </View>
        <View>
          <T weight="black" style={{ fontSize: 26 }} accessibilityRole="header">
            {t('Adventure with {name}', { name: pet?.name ?? '' })}
          </T>
          <T style={{ color: colors.muted, fontSize: 15 }}>
            {formatDateLong(dayKey)} · {formatClock(w.startedAt)}
          </T>
        </View>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <Image source={TIME_ART[tod]} style={styles.factArt} />
            <T weight="xbold">{timeOfDayLabel(tod)}</T>
          </View>
          <View style={styles.fact}>
            {art ? <Image source={WEATHER_ART[art]} style={styles.factArt} /> : <View style={styles.factArt} />}
            <T weight="xbold">{w.weather?.available ? `${formatTemp(w.weather.tempC, unit)} · ${conditionLabel(w.weather.condition)}` : t('Weather not recorded')}</T>
          </View>
        </View>

        <View style={[styles.card, edit === 'time' && styles.focus]}>
          <T weight="black" style={{ fontSize: 16 }}>
            {t('Walking time')}
          </T>
          <T style={{ color: colors.muted, fontSize: 13 }}>{t('Left the timer running? Set how long you really walked.')}</T>
          <View style={styles.stepper}>
            <Bouncy scaleTo={0.9} onPress={() => step(-1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('Shorter')} testID="adv-less">
              <T weight="black" style={{ fontSize: 26 }}>
                −
              </T>
            </Bouncy>
            <T weight="black" style={{ fontSize: 30, minWidth: 140, textAlign: 'center' }} accessibilityLiveRegion="polite" testID="adv-minutes">
              {durationText(minutes * 60_000)}
            </T>
            <Bouncy scaleTo={0.9} onPress={() => step(1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('Longer')} testID="adv-more">
              <T weight="black" style={{ fontSize: 24 }}>
                +
              </T>
            </Bouncy>
          </View>
        </View>

        <View style={styles.card}>
          <T weight="black" style={{ fontSize: 16 }}>
            {t('Note')}
          </T>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('A new friend at the park, a puddle jump…')}
            placeholderTextColor={colors.faint}
            multiline
            maxLength={500}
            style={styles.input}
            accessibilityLabel={t('Note')}
          />
        </View>

        <View style={styles.card}>
          <T weight="black" style={{ fontSize: 16 }}>
            {t('Photo')}
          </T>
          {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityIgnoresInvertColors /> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SoftPill label={photo ? t('Change photo') : t('Add a photo')} onPress={addPhoto} style={{ flex: 1 }} />
            {photo ? <SoftPill label={t('Remove')} color={colors.danger} tint={colors.dangerSoft} onPress={() => setPhoto(null)} style={{ flex: 1 }} /> : null}
          </View>
        </View>

        {err ? (
          <T weight="xbold" style={{ color: colors.danger }} accessibilityLiveRegion="assertive">
            {err}
          </T>
        ) : null}
        <Pill label={t('SAVE CHANGES')} color="#14B8C4" onPress={save} loading={saving} disabled={!dirty} testID="adv-save" />
        <SoftPill label={t('Delete this adventure')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} style={{ alignSelf: 'center' }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  facts: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 18, padding: 10 },
  factArt: { width: 36, height: 36 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 14, gap: 8, borderWidth: 2, borderColor: 'transparent' },
  focus: { borderColor: '#14B8C4' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 80, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 12, fontFamily: font.bold, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
});
