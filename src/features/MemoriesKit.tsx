/**
 * Pavurio Memories building blocks shared by Home and the Memories tab:
 * - useCaptureMoment: camera / gallery → durable copy + thumbnail → saved moment (no confirm step)
 * - TodayMomentCard: "Today's little moment"
 * - AnniversaryCard: birthday / adoption prompt from the pet's real dates (dismissible, once a year)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Moment, addMoment, momentsOn, releaseMedia } from '../data/memoriesRepo';
import { getSetting, setSetting } from '../data/repo';
import { Anniversary, anniversaryDismissKey, anniversaryPrompts, momentDay } from '../domain/memories';
import { dayKeyOf } from '../domain/time';
import { MediaError, PickedPhoto, deleteFiles, importPhoto, pickPhotos } from '../native/media';
import { errorFeedback, photoFeedback } from '../native/haptics';
import { useApp } from '../state/AppState';
import { Sticker, moodSticker } from '../ui/Sticker';
import { Bouncy, Enter } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { formatDateLong } from '../ui/forms';
import { suggestedTemplates } from './memoryCards';
import { t, tn } from '../i18n';

export const MEM_COLORS = { warm: '#FFF4E3', warmInk: '#B86A00', pink: '#FFE8EF', pinkInk: '#D9487A', star: '#FFB020' };

/**
 * Picks one photo (camera) or several (gallery), imports each and saves it as a moment for the
 * current pet on its capture day. Opens the first one in the viewer with a small celebration.
 */
export function useCaptureMoment() {
  const { pet, db, bump } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAll = useCallback(
    async (picked: PickedPhoto[]) => {
      if (!pet) return;
      const ids: string[] = [];
      let failed = 0;
      for (const p of picked) {
        let media: { id: string; capturedAt: number | null } | null = null;
        try {
          media = await importPhoto(db, p);
          const m = await addMoment(db, { petIds: [pet.id], mediaId: media.id, date: momentDay(media.capturedAt), capturedAt: media.capturedAt });
          ids.push(m.id);
        } catch (e) {
          if (media) deleteFiles(await releaseMedia(db, media.id));
          failed++;
          if (picked.length === 1) throw e;
        }
      }
      if (!ids.length) throw new MediaError(t('This photo couldn’t be saved. Please try another one.'));
      bump();
      photoFeedback();
      router.push({ pathname: '/moment', params: { id: ids[0], fresh: String(ids.length), failed: failed ? String(failed) : undefined } });
    },
    [pet, db, bump],
  );

  const capture = useCallback(
    async (from: 'camera' | 'library') => {
      if (busy) return;
      setError(null);
      try {
        const picked = await pickPhotos(from);
        if (!picked?.length) return;
        setBusy(true);
        await saveAll(picked);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('Could not open photos.'));
        errorFeedback();
      } finally {
        setBusy(false);
      }
    },
    [busy, saveAll],
  );
  return { capture, busy, error, clearError: () => setError(null) };
}

/** Square photo thumbnail with a soft placeholder while loading / for photo-less moments. */
export function MomentThumb({ m, size, radius = 18, species }: { m: Moment; size: number | { w: number; h: number }; radius?: number; species: 'dog' | 'cat' }) {
  const w = typeof size === 'number' ? size : size.w;
  const h = typeof size === 'number' ? size : size.h;
  const uri = m.thumbUri ?? m.photoUri;
  return (
    <View style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: m.milestone ? MEM_COLORS.warm : m.kind === 'adventure' ? '#E6F4DE' : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Sticker name={m.kind === 'adventure' ? 'dog_trot' : m.milestone ? moodSticker(species, 'trophy') : moodSticker(species, 'love')} size={Math.min(w, h) * 0.7} />
      )}
      {m.favorite ? (
        <View style={styles.heart} accessibilityElementsHidden importantForAccessibility="no">
          <T style={{ fontSize: Math.max(10, Math.min(w, h) * 0.12), color: MEM_COLORS.pinkInk }}>♥</T>
        </View>
      ) : null}
    </View>
  );
}

/** "Today's little moment" — one tap to the camera, one to the gallery. Shows today's photos once added. */
export function TodayMomentCard({ width, compact }: { width: number; compact?: boolean }) {
  const { pet, db, version } = useApp();
  const { capture, busy, error } = useCaptureMoment();
  const [today, setToday] = useState<Moment[]>([]);
  const day = dayKeyOf(new Date());
  useEffect(() => {
    if (pet) momentsOn(db, pet.id, day).then((all) => setToday(all.filter((m) => m.photoUri && m.kind !== 'adventure')));
  }, [db, pet, day, version]);
  if (!pet) return null;
  const has = today.length > 0;
  const featured = today.find((m) => m.featured) ?? today[0];
  const inner = width - 36;

  return (
    <View style={[styles.today, compact && { marginTop: 0 }]} testID="today-moment">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 20 }} accessibilityRole="header">
            {t("Today's little moment")}
          </T>
          <T weight="xbold" style={{ color: colors.muted, fontSize: 13.5, marginTop: 2 }}>
            {has ? tn(today.length, '1 photo of {name} today', '{n} photos of {name} today', { name: pet.name }) : t('One photo of {name}, kept forever.', { name: pet.name })}
          </T>
        </View>
        {!has ? <Sticker name={moodSticker(pet.species, 'hello')} size={58} /> : null}
      </View>

      {has && featured ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Bouncy accessibilityRole="imagebutton" accessibilityLabel={t('Open today’s moment')} onPress={() => router.push({ pathname: '/moment', params: { id: featured.id } })} scaleTo={0.97}>
            <MomentThumb m={featured} size={{ w: today.length > 1 ? inner * 0.62 : inner, h: inner * 0.62 }} radius={20} species={pet.species} />
          </Bouncy>
          {today.length > 1 ? (
            <View style={{ flex: 1, gap: 8 }}>
              {today
                .filter((m) => m.id !== featured.id)
                .slice(0, 2)
                .map((m, i, arr) => (
                  <Bouncy key={m.id} accessibilityRole="imagebutton" accessibilityLabel={t('Open moment')} onPress={() => router.push({ pathname: '/moment', params: { id: m.id } })} scaleTo={0.97}>
                    <MomentThumb m={m} size={{ w: inner * 0.38 - 8, h: arr.length === 1 ? inner * 0.62 : (inner * 0.62 - 8) / 2 }} radius={16} species={pet.species} />
                    {i === 1 && today.length > 3 ? (
                      <View style={[StyleSheet.absoluteFill, styles.more]}>
                        <T weight="black" style={{ color: '#FFF', fontSize: 20 }}>
                          +{today.length - 3}
                        </T>
                      </View>
                    ) : null}
                  </Bouncy>
                ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Bouncy accessibilityRole="button" accessibilityLabel={t('Take Photo')} onPress={() => capture('camera')} disabled={busy} style={[styles.btn, { backgroundColor: colors.ink }]} testID="moment-camera">
          <T weight="black" style={{ color: '#FFF', fontSize: 14.5 }} numberOfLines={1}>
            {t('Take Photo')}
          </T>
        </Bouncy>
        <Bouncy accessibilityRole="button" accessibilityLabel={t('Choose from Gallery')} onPress={() => capture('library')} disabled={busy} style={[styles.btn, { backgroundColor: '#FFFFFF', flex: 1.35 }]} testID="moment-gallery">
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <T weight="black" style={{ color: colors.ink, fontSize: 14.5 }} numberOfLines={1} adjustsFontSizeToFit>
              {t('Choose from Gallery')}
            </T>
          )}
        </Bouncy>
      </View>
      {error ? (
        <T weight="xbold" style={{ color: colors.danger, marginTop: 10, textAlign: 'center' }} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
    </View>
  );
}

/** Birthday / adoption anniversary prompt. Uses the pet's real dates; dismissed = not shown again that year. */
export function AnniversaryCard() {
  const { pet, db, version } = useApp();
  const [items, setItems] = useState<Anniversary[]>([]);
  const today = dayKeyOf(new Date());
  useEffect(() => {
    if (!pet) return;
    // a birthday estimated from an age range (routine guide) isn't a real date to celebrate
    void getSetting(db, `birthApprox:${pet.id}`).then(async (approx) => {
      const all = anniversaryPrompts(approx === '1' ? { ...pet, birthDate: null } : pet, today);
      const d = await Promise.all(all.map((a) => getSetting(db, anniversaryDismissKey(pet.id, a))));
      setItems(all.filter((_, i) => !d[i]));
    });
  }, [db, pet, today, version]);
  if (!pet || !items.length) return null;
  const a = items[0];
  const birthday = a.kind === 'birthday';
  const when = a.daysAway === 0 ? t('Today!') : a.daysAway === 1 ? t('Tomorrow') : a.daysAway < 0 ? formatDateLong(a.day) : tn(a.daysAway, 'in {n} day', 'in {n} days');
  const title = birthday ? t('{name} turns {n}', { name: pet.name, n: a.years }) : tn(a.years, '{n} year together', '{n} years together');
  const dismiss = async () => {
    await setSetting(db, anniversaryDismissKey(pet.id, a), String(Date.now()));
    setItems((x) => x.slice(1));
  };
  return (
    <Enter index={1}>
      <View style={[styles.anniv, { backgroundColor: birthday ? MEM_COLORS.pink : MEM_COLORS.warm }]} testID="anniversary-card">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <T style={{ fontSize: 34 }} accessibilityElementsHidden importantForAccessibility="no">
            {birthday ? '🎂' : '💛'}
          </T>
          <View style={{ flex: 1 }}>
            <T weight="black" style={{ fontSize: 18 }}>
              {title}
            </T>
            <T weight="xbold" style={{ color: birthday ? MEM_COLORS.pinkInk : MEM_COLORS.warmInk, fontSize: 13.5 }}>
              {when} · {birthday ? t('Birthday') : t('Adoption Anniversary')}
            </T>
          </View>
          <Bouncy accessibilityRole="button" accessibilityLabel={t('Dismiss')} onPress={dismiss} hitSlop={12} style={styles.close}>
            <Icon name="close" size={16} color={colors.inkSoft} />
          </Bouncy>
        </View>
        <T style={{ color: colors.inkSoft, marginTop: 8, lineHeight: 20 }}>{t('Celebrate with a Memory Card made from your own photos.')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {suggestedTemplates(a.kind).map((id) => (
            <Bouncy key={id} accessibilityRole="button" onPress={() => router.push({ pathname: '/card', params: { template: id } })} style={styles.tplChip} accessibilityLabel={t(TEMPLATE_CHIP[id] ?? id)}>
              <T weight="black" style={{ fontSize: 13.5 }}>
                {t(TEMPLATE_CHIP[id] ?? id)}
              </T>
            </Bouncy>
          ))}
        </View>
      </View>
    </Enter>
  );
}
const TEMPLATE_CHIP: Record<string, string> = { birthday: 'Birthday Pawty', gotcha: 'Gotcha Day', thennow: 'Then & Now', year: 'A Year Together' };

const styles = StyleSheet.create({
  today: { marginTop: 26, padding: 18, borderRadius: 28, backgroundColor: colors.card },
  btn: { flex: 1, height: 50, borderRadius: 25, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink },
  more: { backgroundColor: 'rgba(20,26,40,0.45)', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  heart: { position: 'absolute', top: 6, right: 6, backgroundColor: '#FFFFFFE6', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  anniv: { marginTop: 18, padding: 16, borderRadius: 24 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFFB0', alignItems: 'center', justifyContent: 'center' },
  tplChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFFFFF' },
});
