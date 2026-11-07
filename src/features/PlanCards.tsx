/**
 * Two small Home cards that keep the automatic plan right without any work:
 * - "Biscuit's plan grew": what changed when the pet got older or heavier (tap → the plan);
 * - "Time to weigh Biscuit": monthly while growing (portions follow the weight), once for adults.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CARE } from '../domain/care';
import { ageInMonths } from '../domain/lifeStage';
import { PlanNews, dismissPlanNews, getPlanNews, hasAutoPlan } from '../data/autoPlan';
import { listMeasurements } from '../data/careRepo';
import { getSetting, setSetting } from '../data/repo';
import { useApp } from '../state/AppState';
import { CareIcon } from '../ui/CareIcon';
import { Bouncy, Enter } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { selectFeedback } from '../native/haptics';
import { t } from '../i18n';
import { choiceSummary } from './AutoPlan';
import { ageLabel } from './RoutineGuide';

const DAY = 86_400_000;

export function PlanNewsCard({ enter = 0 }: { enter?: number }) {
  const { db, pet, version, bump } = useApp();
  const [news, setNews] = useState<PlanNews | null>(null);
  useEffect(() => {
    if (pet) getPlanNews(db, pet.id).then(setNews);
  }, [db, pet, version]);
  if (!pet || !news) return null;
  const dismiss = async () => {
    selectFeedback();
    await dismissPlanNews(db, pet.id);
    setNews(null);
    bump();
  };
  const lines = news.choices.filter((c) => c.on).slice(0, 3);
  return (
    <Enter index={enter}>
      <Bouncy
        onPress={() => {
          void dismissPlanNews(db, pet.id);
          router.push('/plan');
        }}
        style={styles.news}
        accessibilityRole="button"
        testID="plan-news"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T weight="black" style={{ flex: 1, color: '#7C5CE6', fontSize: 11, letterSpacing: 1.2 }}>
            {t('PLAN UPDATED')} · {ageLabel(news.months).toUpperCase()}
          </T>
          <Bouncy onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Close')} testID="plan-news-close">
            <Icon name="close" size={16} color={colors.muted} />
          </Bouncy>
        </View>
        <T weight="black" style={{ fontSize: 17, marginTop: 2 }}>
          {t('{name}’s plan grew with them', { name: pet.name })}
        </T>
        <View style={{ gap: 6, marginTop: 8 }}>
          {lines.map((c) => (
            <View key={c.care} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <CareIcon type={c.care} size={30} />
              <T weight="xbold" style={{ fontSize: 14, flex: 1 }}>
                <T weight="black" style={{ color: CARE[c.care].color, fontSize: 14 }}>
                  {CARE[c.care].label}
                </T>{' '}
                {choiceSummary(c)}
              </T>
            </View>
          ))}
        </View>
      </Bouncy>
    </Enter>
  );
}

export function WeighNudgeCard({ enter = 0 }: { enter?: number }) {
  const { db, pet, version } = useApp();
  const [show, setShow] = useState(false);
  const months = pet?.birthDate ? ageInMonths(pet.birthDate) : null;
  useEffect(() => {
    if (!pet || months == null) return setShow(false);
    let live = true;
    (async () => {
      if (!(await hasAutoPlan(db, pet.id))) return live && setShow(false);
      const list = await listMeasurements(db, pet.id);
      const last = list[list.length - 1]?.at ?? 0;
      const snoozed = Number((await getSetting(db, `weighNudge:${pet.id}`)) ?? 0);
      const now = Date.now();
      // growing pets: every month (portions follow the weight); adults: until the first weigh-in
      const due = months < 12 ? now - last > 30 * DAY : last === 0;
      if (live) setShow(due && now - snoozed > (months < 12 ? 7 : 60) * DAY);
    })();
    return () => {
      live = false;
    };
  }, [db, pet, version, months]);
  if (!pet || !show || months == null) return null;
  const snooze = async () => {
    selectFeedback();
    await setSetting(db, `weighNudge:${pet.id}`, String(Date.now()));
    setShow(false);
  };
  return (
    <Enter index={enter}>
      <Bouncy onPress={() => router.push('/weight')} style={styles.weigh} accessibilityRole="button" testID="weigh-nudge">
        <T style={{ fontSize: 30 }}>⚖️</T>
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 16 }}>
            {t('Time to weigh {name}', { name: pet.name })}
          </T>
          <T style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
            {months < 12 ? t('{name} grows fast. A weigh-in keeps the portions right.', { name: pet.name }) : t('One weigh-in makes {name}’s portions exact.', { name: pet.name })}
          </T>
        </View>
        <Bouncy onPress={snooze} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Later')} testID="weigh-later">
          <Icon name="close" size={16} color={colors.muted} />
        </Bouncy>
      </Bouncy>
    </Enter>
  );
}

const styles = StyleSheet.create({
  news: { backgroundColor: '#EEE8FE', borderRadius: 28, padding: 16, marginTop: 12 },
  weigh: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 28, padding: 14, marginTop: 12 },
});
