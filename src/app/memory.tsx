import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createMemory, deleteMemory, getMemory, updateMemory } from '../data/recordsRepo';
import { ValidationError } from '../data/repo';
import { dayKeyOf } from '../domain/time';
import { PickedFile, persistFile, pickPhoto, removeStoredFile } from '../native/files';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen } from '../ui/forms';
import { Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback } from '../native/haptics';
import { t } from '../i18n';

const IDEAS = () => [t('First walk'), t('New trick'), t('Bath day'), t('Vet hero'), t('Nap champion'), t('Birthday')];

export default function MemoryEditor() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { pet, db, bump } = useApp();
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState(!params.id);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [storedUri, setStoredUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(dayKeyOf(new Date()));
  const [milestone, setMilestone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getMemory(db, params.id).then((m) => {
      if (!m) return router.back();
      setStoredUri(m.photoUri);
      setTitle(m.title);
      setCaption(m.caption ?? '');
      setDate(m.date);
      setMilestone(m.kind === 'milestone');
      setLoaded(true);
    });
  }, [db, params.id]);

  if (!pet || !loaded) return null;
  const shown = photo?.uri ?? storedUri;

  const choose = async (from: 'camera' | 'library') => {
    setError(null);
    try {
      const p = await pickPhoto(from);
      if (p) setPhoto(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not open photos.'));
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      let uri = storedUri;
      if (photo) uri = (await persistFile(photo, 'moments')).uri;
      const input = { petId: pet.id, photoUri: uri, title, caption, date, kind: milestone ? ('milestone' as const) : ('moment' as const) };
      if (params.id) await updateMemory(db, params.id, input);
      else await createMemory(db, input);
      if (photo && storedUri && storedUri !== uri) removeStoredFile(storedUri);
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : e instanceof Error ? e.message : t('Could not save the moment.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!params.id) return;
    if (!(await confirmAsync(t('Delete this moment?'), t('The photo is removed from Pavurio (your camera roll keeps its copy).')))) return;
    if (storedUri) removeStoredFile(storedUri);
    await deleteMemory(db, params.id);
    bump();
    router.back();
  };

  const pw = Math.min(width, 560) - 40;
  return (
    <ModalScreen
      title={params.id ? t('Moment') : t('New moment')}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={params.id ? t('SAVE') : t('ADD MOMENT')} onPress={save} loading={saving} testID="save-memory" />
          {params.id ? <SoftPill label={t('Delete moment')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} /> : null}
        </>
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={shown ? t('Change photo') : t('Add a photo')} onPress={() => choose('library')} style={[styles.photo, { height: pw * 0.8 }]}>
        {shown ? (
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T weight="black" style={{ fontSize: 40, color: colors.brand }}>
              +
            </T>
            <T weight="xbold" style={{ color: colors.brand }}>
              {t('Add a photo')}
            </T>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: -6 }}>
        <SoftPill label={t('Camera')} small onPress={() => choose('camera')} />
        <SoftPill label={t('Library')} small onPress={() => choose('library')} />
        {shown ? (
          <SoftPill
            label={t('Remove photo')}
            small
            color={colors.inkSoft}
            tint={colors.line}
            onPress={() => {
              setPhoto(null);
              setStoredUri(null);
            }}
          />
        ) : null}
      </View>

      <Field label={t('Title')} value={title} onChangeText={setTitle} placeholder={t('What happened?')} maxLength={60} />
      {!params.id ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
          {IDEAS().map((i) => (
            <Chip key={i} label={i} on={title === i} onPress={() => setTitle(i)} />
          ))}
        </View>
      ) : null}
      <Field label={t('Caption (optional)')} value={caption} onChangeText={setCaption} placeholder={t('A line to remember it by')} multiline maxLength={500} />
      <DateField label={t('Date')} value={date} onChange={(v) => v && setDate(v)} maxDay={dayKeyOf(new Date())} />
      <View style={{ gap: 8 }}>
        <Label>{t('Kind')}</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('Moment')} on={!milestone} onPress={() => setMilestone(false)} />
          <Chip label={t('★ Milestone')} on={milestone} color="#E58A00" tint="#FFF1DC" onPress={() => setMilestone(true)} />
        </View>
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed' },
});
