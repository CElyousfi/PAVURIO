/**
 * The routine guide's entry points (Home feed, Care tab) and its shared state:
 * the pet's age and life stage, and whether the owner has seen the guide for the current stage.
 * When the pet grows into a new stage (6 months, 1 year, senior…), the card comes back with the new advice.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Species } from '../domain/care';
import { ageInMonths, stageOf, type StageId } from '../domain/lifeStage';
import { STAGE_LABEL } from '../content/routineGuide';
import { getSetting, setSetting, type Pet } from '../data/repo';
import type { Db } from '../data/db';
import { useApp } from '../state/AppState';
import { Sticker, moodSticker } from '../ui/Sticker';
import { Bouncy, Enter } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

export type GuideState = { known: boolean; months: number; stage: StageId; seen: boolean };

const key = (petId: string) => `guideStage:${petId}`;

export function ageLabel(months: number): string {
  if (months < 1) return t('under 1 month');
  if (months < 24) return tn(months, '{n} month old', '{n} months old');
  return tn(Math.floor(months / 12), '{n} year old', '{n} years old');
}

export function stageLabel(species: Species, stage: StageId): string {
  return t(STAGE_LABEL[species][stage]);
}

export function guideStateOf(pet: Pet, seenStage: string | null, now = new Date()): GuideState {
  if (!pet.birthDate) return { known: false, months: 0, stage: 'adult', seen: false };
  const months = ageInMonths(pet.birthDate, now);
  const stage = stageOf(pet.species, months);
  return { known: true, months, stage, seen: seenStage === stage };
}

export function useGuideState(): GuideState | null {
  const { db, pet, version } = useApp();
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (pet) getSetting(db, key(pet.id)).then(setSeen);
  }, [db, pet, version]);
  if (!pet || seen === undefined) return null;
  return guideStateOf(pet, seen);
}

export async function markGuideSeen(db: Db, pet: Pet) {
  const s = guideStateOf(pet, null);
  if (s.known) await setSetting(db, key(pet.id), s.stage);
}

/** Home / Care card. `always` shows it even after the guide was read (the Care tab keeps it). */
export function GuideCard({ always = false, enter }: { always?: boolean; enter?: number }) {
  const { pet } = useApp();
  const g = useGuideState();
  const planned = !!g && g.known && g.seen;
  // once the guide for this age is read, the Care tab card opens the plan itself (numbers to adjust)
  const open = useCallback(() => router.push(planned ? '/plan' : '/guide'), [planned]);
  if (!pet || !g) return null;
  if (!always && g.known && g.seen) return null;
  const grown = g.known && !g.seen;
  const kicker = grown ? t('NEW FOR THIS AGE') : t('ROUTINE GUIDE');
  const title = !g.known
    ? t('How old is {name}?', { name: pet.name })
    : grown
      ? t('Routines for {name} at {age}', { name: pet.name, age: ageLabel(g.months) })
      : t('{name}’s plan', { name: pet.name });
  const sub = !g.known ? t('Get meals, walks and care routines made for their age.') : stageLabel(pet.species, g.stage);
  const card = (
    <Bouncy scaleTo={0.97} onPress={open} style={styles.card} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} testID="guide-card">
      <Sticker name={moodSticker(pet.species, grown || !g.known ? 'hello' : 'happy')} size={64} />
      <View style={{ flex: 1 }}>
        <T weight="black" style={{ color: '#7C5CE6', fontSize: 11, letterSpacing: 1.2 }}>
          {kicker}
        </T>
        <T weight="black" style={{ fontSize: 16, lineHeight: 20 }} numberOfLines={2}>
          {title}
        </T>
        <T style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
          {sub}
        </T>
      </View>
      {grown || !g.known ? <View style={styles.dot} /> : null}
      <Icon name="chevR" size={18} color={colors.faint} />
    </Bouncy>
  );
  return enter != null ? <Enter index={enter}>{card}</Enter> : card;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEE8FE', borderRadius: 28, padding: 14, paddingRight: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C5CE6' },
});
