/**
 * Moment editor (new or existing): photo, title, caption, date, milestone, pets sharing it, favorite
 * and an optional link to one of that day's adventures. Everything is optional except having a photo,
 * a title or a milestone. `focus` scrolls the quick action the owner tapped in the viewer into view.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addMoment, deleteMoment, ensureLegacyMedia, getMoment, releaseMedia, updateMoment } from '../data/memoriesRepo';
import { ValidationError } from '../data/repo';
import { listWalks } from '../data/walkRepo';
import { MILESTONES, MILESTONE_EMOJI, MILESTONE_LABEL, MilestoneKind, momentDay } from '../domain/memories';
import { Walk } from '../domain/walks';
import { dayKeyOf, formatClock } from '../domain/time';
import { PickedPhoto, deleteFiles, importPhoto, pickPhotos } from '../native/media';
import { useApp } from '../state/AppState';
import { confirmAsync } from '../ui/confirm';
import { Chip, DateField, Field, ModalScreen } from '../ui/forms';
import { Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, photoFeedback } from '../native/haptics';
import { MEM_COLORS } from '../features/MemoriesKit';
import { t } from '../i18n';

export default function MemoryEditor() {
  const params = useLocalSearchParams<{ id?: string; focus?: string; milestone?: string }>();
  const { pet, pets, db, bump } = useApp();
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState(!params.id);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [storedUri, setStoredUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(dayKeyOf(new Date()));
  const [dateTouched, setDateTouched] = useState(!!params.id);
  const [milestone, setMilestone] = useState<MilestoneKind | null>(params.milestone && (MILESTONES as readonly string[]).includes(params.milestone) ? (params.milestone as MilestoneKind) : null);
  const [petIds, setPetIds] = useState<string[]>(pet ? [pet.id] : []);
  const [favorite, setFav] = useState(false);
  const [walkId, setWalkId] = useState<string | null>(null);
  const [walks, setWalks] = useState<Walk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const captionRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!params.id) return;
    const id = params.id;
    ensureLegacyMedia(db, id)
      .then(() => getMoment(db, id))
      .then((m) => {
      if (!m) return router.back();
      if (m.kind === 'adventure' && m.walkId) return router.replace({ pathname: '/adventure', params: { id: m.walkId } });
      setMediaId(m.mediaId);
      setStoredUri(m.photoUri);
      setTitle(m.title);
      setCaption(m.caption ?? '');
      setDate(m.date);
      setMilestone(m.milestone);
      setPetIds(m.petIds);
      setFav(m.favorite);
      setWalkId(m.walkId);
      setLoaded(true);
      });
  }, [db, params.id]);

  // adventures of the primary pet on the chosen day (to link this photo to one)
  const primary = petIds[0] ?? pet?.id;
  useEffect(() => {
    if (!primary) return;
    setWalks(null);
    listWalks(db, primary).then((all) => setWalks(all.filter((w) => dayKeyOf(new Date(w.startedAt)) === date)));
  }, [db, primary, date]);

  useEffect(() => {
    if (loaded && params.focus === 'caption') setTimeout(() => captionRef.current?.focus(), 350);
  }, [loaded, params.focus]);

  if (!pet || !loaded) return null;
  const shown = picked?.uri ?? storedUri;

  const choose = async (from: 'camera' | 'library') => {
    setError(null);
    try {
      const p = await pickPhotos(from, false);
      if (!p?.[0]) return;
      setPicked(p[0]);
      // a new photo's capture day is the moment's day unless the owner already chose one
      if (!dateTouched) setDate(momentDay(p[0].capturedAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not open photos.'));
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    let imported: string | null = null;
    try {
      if (milestone === 'custom' && !title.trim()) throw new ValidationError(t('Name your milestone.'));
      let mid = storedUri ? mediaId : null;
      let capturedAt: number | null | undefined;
      if (picked) {
        const media = await importPhoto(db, picked);
        imported = mid = media.id;
        capturedAt = media.capturedAt;
      }
      const input = { petIds, mediaId: mid, title, caption, date, milestone, favorite, // until that day's walks are loaded the link is kept as it was
        walkId: walks === null ? walkId : walks.some((w) => w.id === walkId) ? walkId : null, capturedAt };
      if (params.id) {
        const r = await updateMoment(db, params.id, input);
        deleteFiles(r.freedFiles);
      } else {
        await addMoment(db, input);
      }
      photoFeedback();
      bump();
      router.back();
    } catch (e) {
      // a photo copied for a save that didn't happen is not kept
      if (imported) deleteFiles(await releaseMedia(db, imported));
      setError(e instanceof ValidationError ? e.message : e instanceof Error ? e.message : t('Could not save the moment.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!params.id) return;
    if (!(await confirmAsync(t('Delete this moment?'), t('The photo is removed from Pavurio (your camera roll keeps its copy).')))) return;
    deleteFiles(await deleteMoment(db, params.id));
    bump();
    // the viewer behind this editor shows the deleted moment: close both
    if (router.canDismiss()) router.dismissAll();
    else router.back();
  };

  const togglePet = (id: string) =>
    setPetIds((cur) => {
      if (cur.includes(id)) return cur.length > 1 ? cur.filter((x) => x !== id) : cur;
      return [...cur, id];
    });

  const pw = Math.min(width, 560) - 40;
  return (
    <ModalScreen
      title={params.id ? t('Edit moment') : t('New moment')}
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
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
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
        <SoftPill label={t('Gallery')} small onPress={() => choose('library')} />
        {shown ? (
          <SoftPill
            label={t('Remove photo')}
            small
            color={colors.inkSoft}
            tint={colors.line}
            onPress={() => {
              setPicked(null);
              setStoredUri(null);
            }}
          />
        ) : null}
      </View>

      <Field label={t('Title (optional)')} value={title} onChangeText={setTitle} placeholder={t('What happened?')} maxLength={60} />
      <Field ref={captionRef} label={t('Caption (optional)')} value={caption} onChangeText={setCaption} placeholder={t('A line to remember it by')} multiline maxLength={500} />
      <DateField
        label={t('Date')}
        value={date}
        onChange={(v) => {
          if (!v) return;
          setDate(v);
          setDateTouched(true);
        }}
        maxDay={dayKeyOf(new Date())}
      />

      <View style={{ gap: 8 }}>
        <Label>{t('Milestone (optional)')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={t('None')} on={!milestone} onPress={() => setMilestone(null)} />
          {MILESTONES.map((k) => (
            <Chip key={k} label={`${MILESTONE_EMOJI[k]} ${t(MILESTONE_LABEL[k])}`} on={milestone === k} color={MEM_COLORS.warmInk} tint={MEM_COLORS.warm} onPress={() => setMilestone(k)} />
          ))}
        </View>
        {milestone === 'custom' ? (
          <T weight="xbold" style={{ color: colors.muted, fontSize: 12.5 }}>
            {t('Give your milestone a title above.')}
          </T>
        ) : null}
      </View>

      {pets.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Label>{t('Who’s in it?')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {pets.map((p) => (
              <Chip key={p.id} label={p.name} on={petIds.includes(p.id)} onPress={() => togglePet(p.id)} />
            ))}
          </View>
        </View>
      ) : null}

      {walks?.length ? (
        <View style={{ gap: 8 }}>
          <Label>{t('Part of an adventure?')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t('No')} on={!walkId} onPress={() => setWalkId(null)} />
            {walks.map((w) => (
              <Chip key={w.id} label={`🐾 ${formatClock(w.startedAt)}`} on={walkId === w.id} color="#3E8E1F" tint="#E6F4DE" onPress={() => setWalkId(w.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={favorite ? t('♥ Favorite') : t('♡ Favorite')} on={favorite} color={MEM_COLORS.pinkInk} tint={MEM_COLORS.pink} onPress={() => setFav(!favorite)} />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed' },
});
