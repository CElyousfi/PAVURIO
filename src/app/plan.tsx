/**
 * {name}'s plan: everything the pet needs in a day, built from age, size, weight and food. Each care
 * starts at the recommendation; the owner moves what they want (the usual range is shown) and saves.
 * The plan then follows the pet as it grows (src/data/autoPlan.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Schedule } from '../domain/schedule';
import type { Portions } from '../domain/progress';
import { Choice, PetProfile, Target, estimateWeightKg, planBasis, portionFor, recommendedChoice, sizeInfo, targetsFor } from '../domain/carePlan';
import { ageInMonths, approxBirthDate, stageOf } from '../domain/lifeStage';
import { addMeasurement } from '../data/careRepo';
import { applyChoices, getProfile, hasAutoPlan, setProfile, weighedKg } from '../data/autoPlan';
import { getSetting, setSetting, updatePet } from '../data/repo';
import { requestPermission } from '../native/notifications';
import { useApp } from '../state/AppState';
import { About, AboutPet, PlanReview, formatWeight } from '../features/AutoPlan';
import { ageLabel, markGuideSeen } from '../features/RoutineGuide';
import { ModalScreen } from '../ui/forms';
import { Bouncy } from '../ui/motion';
import { Pill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { completeFeedback, errorFeedback } from '../native/haptics';
import { t } from '../i18n';
import { Missing } from '../ui/Missing';
import { track } from '../native/analytics';
import { savedValue } from '../domain/weight';


/** The plan as it is now: existing routines where there are some, the recommendation elsewhere. */
function currentChoices(targets: Target[], schedules: Schedule[], portions: Portions, auto: boolean): Choice[] {
  const out: Choice[] = [];
  for (const tg of targets) {
    const rec = recommendedChoice(tg);
    if (!rec) continue;
    const s = schedules.find((x) => x.type === tg.care && x.enabled && (tg.kind === 'interval' ? !!x.everyDays : !x.everyDays));
    if (!s) {
      out.push(auto ? { ...rec, on: false } : rec);
      continue;
    }
    if (tg.kind === 'interval') {
      out.push({ ...rec, count: s.everyDays ? Math.max(1, Math.round(s.everyDays / 7)) : rec.count, times: s.times.slice(0, 1), remind: s.remind });
      continue;
    }
    const weekly = s.days.length > 0 && s.days.length < 7 && tg.kind === 'weekly';
    const count = weekly ? s.days.length : s.times.length;
    out.push({
      ...rec,
      kind: weekly ? 'weekly' : tg.kind === 'weekly' ? 'weekly' : 'daily',
      count: tg.kind === 'weekly' && !weekly ? rec.count : count,
      times: s.times,
      days: weekly ? s.days : rec.days,
      remind: s.remind,
      portion: portions[tg.care] ?? portionFor(tg, count)?.rec ?? null,
    });
  }
  return out;
}

export default function PlanScreen() {
  const { pet, db, bump, schedules, portions, settings } = useApp();
  const [about, setAbout] = useState<About | null>(null);
  const [editing, setEditing] = useState(false);
  const [approx, setApprox] = useState(false);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [auto, setAuto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pet) return;
    (async () => {
      const profile: PetProfile = await getProfile(db, pet);
      const months = pet.birthDate ? ageInMonths(pet.birthDate) : null;
      const kg = months != null ? await weighedKg(db, pet, months) : null;
      setApprox((await getSetting(db, `birthApprox:${pet.id}`)) === '1');
      setAuto(await hasAutoPlan(db, pet.id));
      setAbout({ stage: months != null ? stageOf(pet.species, months) : null, months, profile, kg: kg ?? 0, kgTouched: kg != null });
      if (months == null) setEditing(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.id]);

  const basis = useMemo(() => (pet && about?.months != null ? planBasis(pet.species, about.months, about.profile, about.kgTouched ? about.kg : null) : null), [pet, about]);
  const targets = useMemo(() => (basis ? targetsFor(basis) : []), [basis]);

  // first time (and after "about" changes): start from what's set up now, filled in with the recommendation
  useEffect(() => {
    if (!editing && basis && choices == null) setChoices(currentChoices(targets, schedules, portions, auto));
  }, [editing, basis, targets, schedules, portions, auto, choices]);

  if (!pet) return <Missing />;
  if (!about) return null;
  const unit = settings.weightUnit;
  const estimate = estimateWeightKg(pet.species, about.profile.size, about.months ?? 36);

  const save = async () => {
    if (!basis || !choices || saving) return;
    setSaving(true);
    setError(null);
    try {
      const months0 = pet.birthDate ? ageInMonths(pet.birthDate) : null;
      let birthDate = pet.birthDate;
      if (about.months != null && about.months !== months0) {
        birthDate = approxBirthDate(about.months);
        await updatePet(db, pet.id, { birthDate });
        await setSetting(db, `birthApprox:${pet.id}`, '1');
      }
      await markGuideSeen(db, { ...pet, birthDate });
      await setProfile(db, pet.id, about.profile);
      const had = await weighedKg(db, pet, about.months ?? 36);
      if (about.kgTouched && (had == null || Math.abs(had - about.kg) > 0.05)) {
        await addMeasurement(db, { petId: pet.id, kind: 'weight', value: savedValue(about.kg, unit), unit, at: Date.now() });
      }
      await applyChoices(db, pet, basis, choices);
      track('plan_saved', { cares: choices.filter((c) => c.on).length, stage: basis.stage });
      if (choices.some((c) => c.on && c.remind)) requestPermission(db).catch(() => null);
      completeFeedback();
      bump();
      router.back();
    } catch {
      errorFeedback();
      setError(t('Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const food = about.profile.food === 'dry' ? t('Dry food') : about.profile.food === 'wet' ? t('Wet food') : t('Dry and wet food');
  return (
    <ModalScreen
      title={t('{name}’s plan', { name: pet.name })}
      onClose={() => router.back()}
      error={error}
      footer={
        editing ? (
          <Pill
            label={t('BUILD THE PLAN')}
            disabled={about.months == null}
            onPress={() => {
              setChoices(targets.map(recommendedChoice).filter((c): c is Choice => !!c).map((c) => {
                // keep routines the owner turned off
                const prev = choices?.find((x) => x.care === c.care);
                return prev && !prev.on ? { ...c, on: false } : c;
              }));
              setEditing(false);
            }}
            testID="about-next"
          />
        ) : (
          <Pill label={t('SAVE PLAN')} onPress={save} loading={saving} testID="plan-save" />
        )
      }
    >
      {editing ? (
        <>
          <T style={styles.sub}>{t('Meals, walks and care change as {name} grows. These few details are all we need.', { name: pet.name })}</T>
          <AboutPet species={pet.species} name={pet.name} about={about} estimateKg={estimate} unit={unit} onChange={setAbout} ageKnown={!!pet.birthDate && !approx} />
        </>
      ) : basis && choices ? (
        <>
          <Bouncy onPress={() => setEditing(true)} style={styles.about} accessibilityRole="button" testID="plan-about">
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 15 }}>
                {[ageLabel(basis.months), t(sizeInfo(pet.species, about.profile.size).label), formatWeight(basis.kg, unit)].join(' · ')}
              </T>
              <T weight="xbold" style={{ fontSize: 13, color: colors.muted }}>
                {basis.weighed ? food : `${food} · ${t('weight estimated')}`}
              </T>
            </View>
            <T weight="black" style={{ color: colors.brand, fontSize: 13, letterSpacing: 1 }}>
              {t('EDIT')}
            </T>
          </Bouncy>
          <PlanReview unit={unit} name={pet.name} basis={basis} targets={targets} choices={choices} onChange={setChoices} />
          <T style={styles.note}>{t('It grows with {name}: portions and routines update by themselves as {name} gets older or heavier. The changes you make here are kept.', { name: pet.name })}</T>
          <Bouncy onPress={() => router.push('/guide')} style={{ alignSelf: 'center', padding: 10 }} accessibilityRole="button">
            <T weight="black" style={{ color: '#7C5CE6', fontSize: 15 }}>
              {t('Why these numbers? Read the guide')}
            </T>
          </Bouncy>
        </>
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
  about: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEE8FE', borderRadius: 20, padding: 14 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17, textAlign: 'center' },
});
