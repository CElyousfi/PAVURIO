/**
 * The "moment" offer: when something good just happened with the pet (a streak, a great week, a care
 * milestone), Home celebrates it first in a sheet and only then mentions what Pro adds. One moment at a
 * time, each once, spaced out (domain/proMoments.ts). Never shown over a badge, right after a log, or
 * on the first day.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { PetRig, PetClipName } from '../animation/PetRig';
import { getSetting, setSetting } from '../data/repo';
import type { Db } from '../data/db';
import { computeProgress } from '../domain/progress';
import { addDays, dayKeyOf } from '../domain/time';
import { ProMomentKind, ProMomentState, markShown, parseProMoments, pickProMoment, recordAnswer } from '../domain/proMoments';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { weekGrade } from './Insights';
import { Sheet } from '../ui/forms';
import { Pill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { t } from '../i18n';

const KEY = 'proMoments';

export async function loadProMoments(db: Db): Promise<ProMomentState> {
  return parseProMoments(await getSetting(db, KEY));
}
export async function saveProMoments(db: Db, s: ProMomentState) {
  await setSetting(db, KEY, JSON.stringify(s));
}
/** any time the paywall opens counts as an offer (so a moment never follows right after a lock) */
export async function noteOffer(db: Db) {
  const s = await loadProMoments(db);
  await saveProMoments(db, { ...s, lastOfferAt: Date.now() });
}

const REASON: Record<ProMomentKind, string> = { streak3: 'streak', streak7: 'streak', streak14: 'streak', week: 'week', cares25: 'milestone', cares100: 'milestone' };

export function ProMomentHost({ focused }: { focused: boolean }) {
  const { pet, db, pro, plan, lastLoggedAt } = useApp();
  const { streak, byDay, queue, loaded } = useEngagement();
  const [moment, setMoment] = useState<ProMomentKind | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const stateRef = useRef<ProMomentState | null>(null);

  const today = dayKeyOf(new Date());
  const since = pet ? dayKeyOf(new Date(pet.createdAt)) : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter((k) => k >= since);
  const weekAvg = days.length ? days.reduce((s, k) => s + computeProgress(plan, byDay.get(k) ?? []).ratio, 0) / days.length : 0;
  let totalCares = 0;
  for (const list of byDay.values()) totalCares += list.length;

  useEffect(() => {
    if (!pet || pro || !focused || !loaded || moment) return;
    // let the pet's reaction to a log and any badge go first
    const wait = Math.max(1400, lastLoggedAt + 4000 - Date.now());
    const timer = setTimeout(async () => {
      if (queue.length) return;
      const s = await loadProMoments(db);
      stateRef.current = s;
      const k = pickProMoment(s, { pro, petCreatedAt: pet.createdAt, streak: streak.current, totalCares, weekAvg, weekDays: days.length });
      if (!k) return;
      await saveProMoments(db, markShown(s, k));
      stateRef.current = markShown(s, k);
      setMoment(k);
      successFeedback();
      setTimeout(() => setClip({ name: 'celebrate', nonce: Date.now() }), 450);
    }, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet, pro, focused, loaded, queue.length, streak.current, totalCares, lastLoggedAt]);

  if (!pet || !moment) return null;
  const name = pet.name;
  const grade = weekGrade(weekAvg);
  const copy: Record<ProMomentKind, { title: string; body: string }> = {
    streak3: { title: t('3 days in a row! 🔥'), body: t('{name} is settling into a routine. Pro keeps every week of it — charts, monthly stories and every pet in one place.', { name }) },
    streak7: { title: t('A whole week for {name}! 🏆', { name }), body: t('Seven days straight. Pro lets you see every week like this one and turns each month into a story.') },
    streak14: { title: t('Two weeks in a row! 🌟'), body: t('You and {name} have a real rhythm. Pro keeps months of it, so you can spot changes early.', { name }) },
    week: { title: t('{name}’s week: {grade}', { name, grade: grade.grade }), body: t('{n}% of the plan coloured in. Pro shows how every week and month compares.', { n: Math.round(weekAvg * 100) }) },
    cares25: { title: t('{n} cares for {name} 💛', { n: totalCares, name }), body: t('That’s real care. Pro keeps all of it in one place — weeks and months of charts, stories and every pet.') },
    cares100: { title: t('{n} cares for {name}! 🎉', { n: totalCares, name }), body: t('A hundred moments of care. Pro turns them into monthly stories you can keep and share.') },
  };
  const c = copy[moment];

  const answer = async (open: boolean) => {
    const s = stateRef.current ?? (await loadProMoments(db));
    await saveProMoments(db, recordAnswer(s, open));
    const k = moment;
    setMoment(null);
    if (open) router.push({ pathname: '/paywall', params: { reason: REASON[k], n: String(k === 'week' ? Math.round(weekAvg * 100) : k.startsWith('streak') ? streak.current : totalCares) } });
  };

  return (
    <Sheet visible onClose={() => void answer(false)} title="">
      <View style={{ alignItems: 'center', marginTop: -10 }}>
        <PetRig species={pet.species} appearance={pet.appearance} size={170} clip={clip} onClipEnd={() => setClip(null)} />
        <T weight="black" style={{ fontSize: 26, textAlign: 'center', marginTop: 4 }} accessibilityRole="header">
          {c.title}
        </T>
        <T style={{ color: colors.muted, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 }}>{c.body}</T>
      </View>
      <Pill label={t('See what Pro adds')} color="#FF8A1F" onPress={() => void answer(true)} style={{ marginTop: 20 }} testID="moment-pro" />
      <Pressable onPress={() => void answer(false)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 12 }} testID="moment-later">
        <T weight="black" style={{ color: colors.muted, fontSize: 15 }}>
          {t('Not now')}
        </T>
      </Pressable>
    </Sheet>
  );
}
