import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Attachment, RECORD_KINDS, RecordKind, RecordSource, SOURCES, addAttachment, createRecord, deleteAttachment, deleteRecord, getRecord, recordKind, updateRecord } from '../data/recordsRepo';
import { ValidationError } from '../data/repo';
import { dayKeyOf } from '../domain/time';
import { PickedFile, openFile, persistFile, pickDocument, pickPhoto, removeStoredFile } from '../native/files';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen } from '../ui/forms';
import { Icon, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { KindGlyph } from '../features/RecordGlyph';
import { t } from '../i18n';

type Draft = { id?: string; uri: string; mime: string | null; name: string | null };

const TITLE_HINT: Record<RecordKind, () => string> = {
  vaccine: () => t('e.g. Rabies'),
  vet_visit: () => t('e.g. Annual check-up'),
  medication: () => t('e.g. Flea & tick treatment'),
  allergy: () => t('e.g. Chicken'),
  other: () => t('e.g. Microchip number'),
};

export default function RecordEditor() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { pet, db, bump } = useApp();
  const [loaded, setLoaded] = useState(!params.id);
  const [kind, setKind] = useState<RecordKind>((params.kind as RecordKind) ?? 'vaccine');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayKeyOf(new Date()));
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [source, setSource] = useState<RecordSource>('owner');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<Draft[]>([]);
  const [removed, setRemoved] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getRecord(db, params.id).then((r) => {
      if (!r) return router.back();
      setKind(r.kind);
      setTitle(r.title);
      setDate(r.date);
      setDueDate(r.dueDate);
      setSource(r.source);
      setNotes(r.notes ?? '');
      setFiles(r.attachments.map((a) => ({ id: a.id, uri: a.uri, mime: a.mime, name: a.name })));
      setLoaded(true);
    });
  }, [db, params.id]);

  if (!pet || !loaded) return null;
  const k = recordKind(kind);

  const add = async (how: 'camera' | 'library' | 'document') => {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const picked: PickedFile | null = how === 'document' ? await pickDocument() : await pickPhoto(how);
      if (picked) setFiles((f) => [...f, { ...picked, id: undefined }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not add that file.'));
    } finally {
      setPicking(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = { petId: pet.id, kind, title, date, dueDate, source, notes };
      let id = params.id;
      if (id) await updateRecord(db, id, input);
      else id = await createRecord(db, input);
      for (const f of files.filter((x) => !x.id)) {
        const stored = await persistFile(f);
        await addAttachment(db, 'record', id, stored);
      }
      for (const a of removed) {
        await deleteAttachment(db, a.id);
        removeStoredFile(a.uri);
      }
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : e instanceof Error ? e.message : t('Could not save the record.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!params.id) return;
    if (!(await confirmAsync(t('Delete this record?'), t('Its attachments are deleted from this device too.')))) return;
    for (const f of files) if (f.id) removeStoredFile(f.uri);
    await deleteRecord(db, params.id);
    bump();
    router.back();
  };

  return (
    <ModalScreen
      title={params.id ? t('Record') : t('New record')}
      onClose={() => router.back()}
      error={error}
      footer={
        <>
          <Pill label={params.id ? t('SAVE RECORD') : t('ADD RECORD')} color={k.color} onPress={save} loading={saving} testID="save-record" />
          {params.id ? <SoftPill label={t('Delete record')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} /> : null}
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Label>{t('Type')}</Label>
        <View style={styles.kinds}>
          {RECORD_KINDS.map((r) => {
            const on = r.kind === kind;
            return (
              <Pressable
                key={r.kind}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={r.label}
                onPress={() => {
                  tapFeedback();
                  setKind(r.kind);
                }}
                style={[styles.kind, { backgroundColor: on ? r.color : r.tint }]}
              >
                <KindGlyph kind={r.kind} color={on ? '#FFFFFF' : r.color} size={24} />
                <T weight="black" style={{ fontSize: 12, color: on ? '#FFFFFF' : r.color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {r.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field label={t('Name')} value={title} onChangeText={setTitle} placeholder={TITLE_HINT[kind]()} maxLength={80} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label={kind === 'allergy' ? t('Noted on') : t('Date')} value={date} onChange={(v) => v && setDate(v)} />
        </View>
        {kind !== 'allergy' ? (
          <View style={{ flex: 1 }}>
            <DateField label={t('Next due')} value={dueDate} onChange={setDueDate} allowClear placeholder={t('None')} />
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Label>{t('Source')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SOURCES.map((s) => (
            <Chip key={s.id} label={s.label} on={source === s.id} onPress={() => setSource(s.id)} />
          ))}
        </View>
      </View>

      <Field label={t('Notes (optional)')} value={notes} onChangeText={setNotes} placeholder={t('Batch number, dosage, what the vet said…')} multiline maxLength={2000} />

      <View style={{ gap: 10 }}>
        <Label>{t('Attachments')}</Label>
        {files.length ? (
          <View style={styles.files}>
            {files.map((f, i) => (
              <View key={`${f.id ?? 'new'}-${i}`} style={styles.file}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('Open {name}', { name: f.name ?? t('attachment') })} onPress={() => openFile(f)} style={{ flex: 1 }}>
                  {f.mime?.startsWith('image/') ? (
                    <Image source={{ uri: f.uri }} style={styles.fileImg} />
                  ) : (
                    <View style={[styles.fileImg, styles.doc]}>
                      <T weight="black" style={{ color: colors.danger, fontSize: 13 }}>
                        {f.mime === 'application/pdf' ? 'PDF' : t('FILE')}
                      </T>
                      <T style={{ fontSize: 10, color: colors.muted, paddingHorizontal: 4 }} numberOfLines={2}>
                        {f.name ?? ''}
                      </T>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Remove attachment')}
                  hitSlop={8}
                  onPress={() => {
                    tapFeedback();
                    if (f.id) setRemoved((r) => [...r, { id: f.id!, ownerType: 'record', ownerId: params.id ?? '', uri: f.uri, mime: f.mime, name: f.name }]);
                    setFiles((all) => all.filter((_, j) => j !== i));
                  }}
                  style={styles.fileX}
                >
                  <Icon name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <T style={{ color: colors.muted, fontSize: 14 }}>{t("Add a photo of the certificate or the vet's PDF.")}</T>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SoftPill label={t('Camera')} small onPress={() => add('camera')} />
          <SoftPill label={t('Photo')} small onPress={() => add('library')} />
          <SoftPill label={t('PDF / file')} small onPress={() => add('document')} />
        </View>
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', gap: 6 },
  kind: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16 },
  files: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  file: { width: 92, height: 92 },
  fileImg: { width: 92, height: 92, borderRadius: 16, backgroundColor: colors.line },
  doc: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.canvasWarm },
  fileX: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
});
