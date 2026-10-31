import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../animation/PetRig';
import { cloud } from '../cloud/firebase';
import { PetAvatar } from '../animation/PetAvatar';
import { CARE, CareType, Species } from '../domain/care';
import { Appearance, defaultAppearance } from '../domain/appearance';
import { Plan, computeProgress } from '../domain/progress';
import { Pet, ValidationError, createPet, defaultPlan, logCare } from '../data/repo';
import { createSchedule } from '../data/careRepo';
import { useApp } from '../state/AppState';
import { CircleButton, Pill, T } from '../ui/primitives';
import { LookPicker, PlanEditor } from '../features/PetEditors';
import { KindIcon } from '../features/routines';
import { ART } from '../ui/art';
import { CareIcon } from '../ui/CareIcon';
import { colors, font, shadow } from '../ui/theme';
import { DateField, Sheet, TimeField, Toggle } from '../ui/forms';
import { Bouncy, ConfettiRain, Float, Pulse } from '../ui/motion';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { reminderCopy, requestPermission } from '../native/notifications';
import { dayKeyOf } from '../domain/time';
import { formatHM } from '../i18n/dates';
import { newId } from '../domain/ids';
import { t } from '../i18n';

type Suggestion = { key: string; type: string; title: string; times: string[]; on: boolean };
function suggestions(species: Species, plan: Plan): Suggestion[] {
  const out: Suggestion[] = [];
  const meals = plan.meal ?? 0;
  if (meals > 0) out.push({ key: 'meal', type: 'meal', title: meals === 1 ? t('Dinner') : t('Meals'), times: meals === 1 ? ['18:00'] : meals === 2 ? ['08:00', '18:00'] : ['08:00', '13:00', '18:00'], on: true });
  if (species === 'dog' && (plan.walk ?? 0) > 0) out.push({ key: 'walk', type: 'walk', title: t('Walk'), times: (plan.walk ?? 0) >= 2 ? ['07:30', '18:30'] : ['18:30'], on: true });
  if (species === 'cat' && (plan.litter ?? 0) > 0) out.push({ key: 'litter', type: 'litter', title: t('Scoop the litter'), times: ['09:00'], on: true });
  out.push({ key: 'medication', type: 'medication', title: t('Medication'), times: ['20:00'], on: false });
  return out;
}

type Step = 'welcome' | 'species' | 'name' | 'look' | 'dates' | 'plan' | 'first' | 'reminders';
const ORDER: Step[] = ['welcome', 'species', 'name', 'look', 'dates', 'plan', 'first', 'reminders'];
const CLIP_FOR: Partial<Record<CareType, PetClipName>> = { meal: 'eat', water: 'drink', walk: 'walk', play: 'play', grooming: 'groom' };

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const { db, reload, bump, reduceMotion, language, setLanguage, setWeightUnit, settings, pets } = useApp();
  const params = useLocalSearchParams<{ add?: string }>();
  const adding = params.add === '1';
  const [step, setStep] = useState<Step>(adding ? 'species' : 'welcome');
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [adoptionDate, setAdoptionDate] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Suggestion[]>([]);
  const [customize, setCustomize] = useState(false);
  const [species, setSpecies] = useState<Species>('dog');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance('dog'));
  const [plan, setPlan] = useState<Plan>(defaultPlan('dog'));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Pet | null>(null);
  const [firstLogged, setFirstLogged] = useState<CareType | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const [confetti, setConfetti] = useState<number | null>(null);

  // a backup restored in the background (same account after a reinstall): straight to Home
  useEffect(() => {
    if (!adding && !created && step === 'welcome' && pets.length > 0) router.replace('/');
  }, [adding, created, step, pets.length]);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const back = () => {
    if (adding && step === 'species') return router.back();
    if (created) return; // the pet exists: no going back into setup
    const i = ORDER.indexOf(step);
    if (i > 0) go(ORDER[i - 1]);
  };

  const chooseSpecies = (s: Species) => {
    tapFeedback();
    setSpecies(s);
    setAppearance(defaultAppearance(s));
    setPlan(defaultPlan(s));
    go('name');
  };

  const submitName = () => {
    if (!name.trim()) {
      setError(t('Please give them a name.'));
      errorFeedback();
      return;
    }
    go('look');
  };

  const createTheirPet = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const pet = await createPet(db, { species, name, appearance, plan, birthDate, adoptionDate });
      setCreated(pet);
      setRoutines(suggestions(species, plan));
      await reload();
      successFeedback();
      go('first');
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Something went wrong while saving. Please try again.'));
      errorFeedback();
    } finally {
      setSaving(false);
    }
  };

  const firstType: CareType = 'meal';
  const logFirst = async () => {
    if (!created || firstLogged) return;
    try {
      await logCare(db, { petId: created.id, type: firstType, occurredAt: Date.now(), mutationId: newId() });
      setFirstLogged(firstType);
      bump();
      successFeedback();
      if (!reduceMotion && CLIP_FOR[firstType]) setClip({ name: CLIP_FOR[firstType]!, nonce: Date.now() });
      setTimeout(() => setConfetti(Date.now()), 500);
    } catch {
      errorFeedback();
    }
  };

  const finish = async (withReminders: boolean) => {
    if (!created || saving) return;
    setSaving(true);
    try {
      if (withReminders) {
        for (const r of routines.filter((x) => x.on)) await createSchedule(db, { petId: created.id, type: r.type, title: r.title, times: r.times, remind: true });
        await requestPermission().catch(() => null);
      }
      await reload();
      if (adding) router.dismissTo('/');
      else router.replace({ pathname: '/paywall', params: { reason: 'onboarding' } });
    } finally {
      setSaving(false);
    }
  };

  const petSize = Math.min(W * 0.72, 330);
  const displayName = name.trim() || (species === 'dog' ? t('your dog') : t('your cat'));
  const setupSteps: Step[] = ['species', 'name', 'look', 'dates', 'plan'];
  const showBack = step !== 'welcome' && !created;
  const showSkip = step === 'first' || step === 'reminders';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.topRow, { width: W }]}>
        {showBack ? <CircleButton icon="back" label={t('Back')} onPress={back} size={46} /> : <View style={{ width: 46 }} />}
        {setupSteps.includes(step) ? <Dots index={setupSteps.indexOf(step)} total={setupSteps.length} /> : null}
        {showSkip ? (
          <Pressable accessibilityRole="button" onPress={() => (step === 'first' ? go('reminders') : finish(false))} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }} testID="skip">
            <T weight="black" style={{ color: colors.faint, fontSize: 14, letterSpacing: 1 }}>
              {t('SKIP')}
            </T>
          </Pressable>
        ) : (
          <View style={{ width: 46 }} />
        )}
      </View>

      {step === 'welcome' && (
        <Welcome
          width={W}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
          language={language}
          onLanguage={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          onStart={() => setUnitsOpen(true)}
        />
      )}

      {step === 'species' && (
        <Animated.View key="species" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('Who are we caring for?')}
          </T>
          <T style={styles.sub}>{t('Pavurio starts with dogs and cats. More friends later.')}</T>
          <View style={styles.speciesRow}>
            {(['dog', 'cat'] as Species[]).map((s, i) => (
              <Animated.View key={s} entering={ZoomIn.delay(120 + i * 120).springify().damping(12)} style={{ flex: 1 }}>
                <Bouncy accessibilityRole="button" accessibilityLabel={s === 'dog' ? t('Dog') : t('Cat')} onPress={() => chooseSpecies(s)} style={[styles.speciesCard, shadow]} testID={`species-${s}`}>
                  <PetRig species={s} appearance={defaultAppearance(s)} size={Math.min(150, W * 0.36)} />
                  <T weight="black" style={styles.speciesLabel}>
                    {s === 'dog' ? t('DOG') : t('CAT')}
                  </T>
                </Bouncy>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {step === 'name' && (
        <Animated.View key="name" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t("What's their name?")}
          </T>
          <View style={styles.hero}>
            <PetRig species={species} appearance={appearance} size={petSize * 0.78} reduceMotion={reduceMotion} interactive />
          </View>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError(null);
            }}
            placeholder={species === 'dog' ? 'Biscuit' : 'Mochi'}
            placeholderTextColor={colors.faint}
            style={styles.nameInput}
            maxLength={40}
            autoFocus={Platform.OS !== 'web'}
            returnKeyType="next"
            onSubmitEditing={submitName}
            accessibilityLabel={t('Pet name')}
            testID="name-input"
          />
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('NEXT')} onPress={submitName} disabled={!name.trim()} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="name-next" />
          </View>
        </Animated.View>
      )}

      {step === 'look' && (
        <Animated.View key="look" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('Make {name} look like {name}', { name: displayName })}
          </T>
          <View style={styles.hero}>
            <PetRig species={species} appearance={appearance} size={petSize * 0.8} reduceMotion={reduceMotion} interactive />
          </View>
          <LookPicker species={species} appearance={appearance} onChange={setAppearance} />
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('LOOKS RIGHT')} onPress={() => go('dates')} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="look-next" />
          </View>
        </Animated.View>
      )}

      {step === 'dates' && (
        <Animated.View key="dates" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('Special days')}
          </T>
          <T style={styles.sub}>{t("Optional. We'll celebrate {name}'s birthday and your anniversary together.", { name: displayName })}</T>
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, gap: 16, marginTop: 24 }}>
            <DateField label={t('Birthday')} value={birthDate} onChange={setBirthDate} allowClear maxDay={dayKeyOf(new Date())} placeholder={t('Not sure? Skip it')} />
            <DateField label={t('Adoption day')} value={adoptionDate} onChange={setAdoptionDate} allowClear maxDay={dayKeyOf(new Date())} placeholder={t('When they came home')} />
          </View>
          <View style={styles.hero}>
            <Float amount={6}>
              <PetRig species={species} appearance={appearance} size={petSize * 0.6} reduceMotion={reduceMotion} />
            </Float>
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={birthDate || adoptionDate ? t('NEXT') : t('SKIP FOR NOW')} onPress={() => go('plan')} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="dates-next" />
          </View>
        </Animated.View>
      )}

      {step === 'plan' && (
        <Animated.View key="plan" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t("{name}'s daily plan", { name: displayName })}
          </T>
          {ART.ui.planHeader != null ? <Image source={ART.ui.planHeader} style={{ width: 240, height: 160, marginTop: 6 }} resizeMode="contain" /> : null}
          <T style={styles.sub}>{t('You decide what a good day looks like. Each thing you log colors in a bit more of {name}.', { name: displayName })}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <PlanEditor species={species} plan={plan} onChange={setPlan} />
          </ScrollView>
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('NEXT')} onPress={createTheirPet} loading={saving} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="plan-next" />
          </View>
        </Animated.View>
      )}

      {step === 'first' && created && (
        <Animated.View key="first" entering={FadeIn.duration(300)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {firstLogged ? t('Look at {name} go!', { name: created.name }) : t("Log {name}'s first care", { name: created.name })}
          </T>
          <T style={styles.sub}>
            {firstLogged
              ? t('Every care you log colours in a little more of {name}. That’s the whole idea!', { name: created.name })
              : t('Fed {name} today? Tap the bowl and watch them colour in.', { name: created.name })}
          </T>
          <View style={styles.hero}>
            <PetRig
              species={created.species}
              appearance={created.appearance}
              size={petSize * 0.9}
              progress={firstLogged ? Math.max(0.08, computeProgress(plan, [{ type: firstType, occurredAt: Date.now() }]).ratio) : 0}
              clip={clip}
              onClipEnd={() => setClip(null)}
              reduceMotion={reduceMotion}
              interactive
              active
            />
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18, alignItems: 'center' }]}>
            {firstLogged ? (
              <Animated.View entering={FadeInUp.springify().damping(14)} style={{ alignSelf: 'stretch' }}>
                <Pill label={t('NEXT')} onPress={() => go('reminders')} style={{ marginHorizontal: 24 }} testID="first-next" />
              </Animated.View>
            ) : (
              <>
                <Pulse amount={0.08} period={1100}>
                  <Bouncy onPress={logFirst} style={styles.firstBtn} accessibilityRole="button" accessibilityLabel={t('Log {care}', { care: CARE[firstType].label })} testID="first-log">
                    <CareIcon type={firstType} size={88} />
                  </Bouncy>
                </Pulse>
                <View style={[styles.firstChip, { backgroundColor: CARE[firstType].color }]}>
                  <T weight="black" style={{ color: '#FFFFFF', fontSize: 15, letterSpacing: 1 }}>
                    + {CARE[firstType].label.toUpperCase()}
                  </T>
                </View>
              </>
            )}
          </View>
          <ConfettiRain fireKey={confetti} />
        </Animated.View>
      )}

      {step === 'reminders' && created && (
        <Animated.View key="reminders" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('Smart Reminders')}
          </T>
          <T style={styles.sub}>{t('Gentle nudges at the times you choose — never ticked off for you.')}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12, gap: 12 }}>
            <ReminderPreview pet={created} />
            <Pressable accessibilityRole="button" onPress={() => setCustomize(!customize)} style={{ alignSelf: 'center', padding: 6 }}>
              <T weight="black" style={{ color: colors.brand }}>
                {customize ? t('Hide times') : t('Choose the times')}
              </T>
            </Pressable>
            {customize
              ? routines.map((r, i) => (
                  <Animated.View key={r.key} entering={FadeInDown.delay(i * 60)} style={styles.routine}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <KindIcon type={r.type} size={42} />
                      <View style={{ flex: 1 }}>
                        <Toggle label={r.title} value={r.on} onChange={(v) => setRoutines(routines.map((x, j) => (j === i ? { ...x, on: v } : x)))} />
                      </View>
                    </View>
                    {r.on ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        {r.times.map((tm, ti) => (
                          <View key={ti} style={{ flex: 1 }}>
                            <TimeField label="" value={tm} onChange={(v) => setRoutines(routines.map((x, j) => (j === i ? { ...x, times: x.times.map((y, k) => (k === ti ? v : y)) } : x)))} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Animated.View>
                ))
              : (
                <T style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
                  {routines
                    .filter((r) => r.on)
                    .map((r) => `${r.title} ${r.times.map((x) => formatHM(Number(x.slice(0, 2)), Number(x.slice(3)))).join(' · ')}`)
                    .join('\n')}
                </T>
              )}
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill
              label={routines.some((r) => r.on) ? t('Remind me') : t('Continue')}
              onPress={() => finish(routines.some((r) => r.on))}
              loading={saving}
              style={{ alignSelf: 'stretch', marginHorizontal: 24 }}
              testID="finish"
            />
          </View>
        </Animated.View>
      )}

      <Sheet visible={unitsOpen} onClose={() => setUnitsOpen(false)} title={t('Choose your units')}>
        <View style={{ gap: 10, paddingBottom: 8 }}>
          {(['kg', 'lb'] as const).map((u) => (
            <Bouncy
              key={u}
              accessibilityRole="button"
              onPress={async () => {
                await setWeightUnit(u);
                setUnitsOpen(false);
                setTimeout(() => go('species'), 250);
              }}
              style={[styles.unit, settings.weightUnit === u && { backgroundColor: colors.brand }]}
              testID={`unit-${u}`}
            >
              <T weight="black" style={{ color: settings.weightUnit === u ? '#FFFFFF' : colors.brand, fontSize: 18 }}>
                {u === 'kg' ? t('kg (kilograms)') : t('lb (pounds)')}
              </T>
            </Bouncy>
          ))}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** A friendly mock of the notification they'll get, on a card with their pet. */
function ReminderPreview({ pet }: { pet: Pet }) {
  const copy = reminderCopy('meal', t('Meals'), pet.name);
  return (
    <View style={styles.previewCard}>
      <Animated.View entering={FadeInDown.delay(300).springify().damping(14)} style={styles.notif}>
        <View style={styles.notifIcon}>
          <PetAvatar species={pet.species} appearance={pet.appearance} size={40} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 15 }} numberOfLines={1}>
            {copy.title}
          </T>
          <T style={{ fontSize: 13, color: colors.inkSoft }} numberOfLines={1}>
            {copy.body}
          </T>
        </View>
        <T style={{ fontSize: 12, color: colors.muted }}>{formatHM(8, 0)}</T>
      </Animated.View>
      {!ART.ui.remindersHero ? <View style={styles.previewGround} /> : null}
      {ART.ui.remindersHero ? (
        <Float style={{ alignSelf: 'center', marginTop: 4, zIndex: -1 }} amount={6} period={2200}>
          <Image source={ART.ui.remindersHero} style={{ width: 240, height: 240 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Float>
      ) : (
        <Float style={{ alignSelf: 'center', marginTop: 10 }} amount={10} period={1600}>
          <PetAvatar species={pet.species} appearance={pet.appearance} size={150} />
        </Float>
      )}
    </View>
  );
}

function Welcome({ width, bottomInset, reduceMotion, language, onLanguage, onStart }: { width: number; bottomInset: number; reduceMotion: boolean; language: string; onLanguage: () => void; onStart: () => void }) {
  const [page, setPage] = useState(0);
  const [fill, setFill] = useState(0.15);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const touched = useRef(false);
  const frames = [
    { care: 'meal' as CareType, title: t('Track every care'), sub: t('Log the care you give. Watch them color in.') },
    { care: 'water' as CareType, title: t('Never miss a thing'), sub: t('Meals, walks, pills and vet visits — gently reminded.') },
    { care: 'play' as CareType, title: t('Celebrate together'), sub: t('Streaks, challenges and stories of your life together.') },
  ];
  // frame 1 colours in on a loop; frame 3 plays the happy clip
  useEffect(() => {
    if (reduceMotion) return setFill(1);
    const seq = [0.15, 0.45, 0.75, 1, 1];
    let i = 0;
    const timer = setInterval(() => setFill(seq[(i = (i + 1) % seq.length)]), 1000);
    return () => clearInterval(timer);
  }, [reduceMotion]);
  useEffect(() => {
    if (page === 2 && !reduceMotion) setClip({ name: 'celebrate', nonce: Date.now() });
  }, [page, reduceMotion]);
  // auto-advance until the user swipes
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      if (touched.current) return;
      setPage((p) => {
        const n = (p + 1) % frames.length;
        pager.current?.scrollTo({ x: n * width, animated: true });
        return n;
      });
    }, 3800);
    return () => clearInterval(timer);
  }, [width, reduceMotion, frames.length]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const size = Math.min(width * 0.72, 320);

  return (
    <Animated.View entering={FadeIn} style={[styles.page, { width }]}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (touched.current = true)}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
        style={{ flex: 1, width }}
      >
        {frames.map((f, i) => (
          <View key={i} style={{ width, alignItems: 'center' }}>
            <View style={styles.center}>
              <View style={styles.badge}>
                {i === 0 && ART.ui.welcomeBadge != null ? <Image source={ART.ui.welcomeBadge} style={{ width: 52, height: 52 }} /> : <CareIcon type={f.care} size={44} />}
              </View>
              <T weight="black" style={styles.h1}>
                {f.title}
              </T>
              <T style={styles.sub}>{f.sub}</T>
            </View>
            <View style={styles.hero}>
              {i === 0 ? (
                <PetRig species="dog" appearance={defaultAppearance('dog')} size={size} progress={fill} reduceMotion={reduceMotion} interactive />
              ) : i === 1 ? (
                <View style={{ alignItems: 'center' }}>
                  <Animated.View entering={FadeInDown.delay(200)} style={[styles.notif, { marginBottom: 10, width: size + 20 }]}>
                    <View style={styles.notifIcon}>
                      <PetAvatar species="cat" appearance={defaultAppearance('cat')} size={40} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T weight="black" style={{ fontSize: 14 }} numberOfLines={1}>
                        {t('Fresh water for {name} 💧', { name: 'Mochi' })}
                      </T>
                      <T style={{ fontSize: 12, color: colors.inkSoft }}>{t('Tap Done when it’s done')}</T>
                    </View>
                  </Animated.View>
                  <PetRig species="cat" appearance={defaultAppearance('cat')} size={size * 0.85} progress={1} reduceMotion={reduceMotion} />
                </View>
              ) : (
                <PetRig species="dog" appearance={defaultAppearance('dog')} size={size} progress={1} clip={page === 2 ? clip : null} onClipEnd={() => setClip(page === 2 ? { name: 'celebrate', nonce: Date.now() } : null)} reduceMotion={reduceMotion} active={page === 2} />
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'center', marginBottom: 14 }}>
        {frames.map((_, i) => (
          <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.ink : colors.line }} />
        ))}
      </View>
      <View style={[styles.welcomeBottom, { paddingBottom: bottomInset + 18 }]}>
        <Bouncy onPress={onLanguage} style={styles.lang} accessibilityRole="button" accessibilityLabel={language === 'fr' ? 'English' : 'Français'}>
          <T weight="black" style={{ fontSize: 14 }}>
            {language === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
          </T>
        </Bouncy>
        <Pill label={t('GET STARTED')} onPress={onStart} style={{ flex: 1 }} testID="get-started" />
      </View>
      {cloud.enabled() ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/account', params: { mode: 'signin' } })} style={{ alignSelf: 'center', paddingBottom: bottomInset + 10, marginTop: -8 }} testID="have-account">
          <T weight="xbold" style={{ color: colors.brand }}>
            {t('I already have an account')}
          </T>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function Dots({ index, total }: { index: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t('Step {n} of {total}', { n: index + 1, total })}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= index ? colors.ink : colors.line }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 54 },
  page: { flex: 1, alignItems: 'center' },
  center: { alignItems: 'center', marginTop: 12, paddingHorizontal: 24 },
  badge: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FEF3DC', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  h1: { fontSize: 32, lineHeight: 38, textAlign: 'center' },
  h2: { fontSize: 28, lineHeight: 34, textAlign: 'center', paddingHorizontal: 24, marginTop: 10 },
  sub: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 30, lineHeight: 22 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  bottom: { alignSelf: 'stretch', paddingTop: 10 },
  welcomeBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', paddingHorizontal: 24 },
  lang: { height: 60, paddingHorizontal: 14, borderRadius: 30, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  speciesRow: { flexDirection: 'row', gap: 16, marginTop: 40, paddingHorizontal: 20 },
  speciesCard: { backgroundColor: colors.white, borderRadius: 28, alignItems: 'center', paddingVertical: 22 },
  speciesLabel: { fontSize: 15, letterSpacing: 1.6, color: colors.muted, marginTop: 10 },
  nameInput: {
    fontFamily: font.black,
    fontSize: 34,
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 30,
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: colors.line,
    marginBottom: 6,
  },
  firstBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center' },
  firstChip: { marginTop: -14, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 14 },
  routine: { backgroundColor: colors.canvasWarm, borderRadius: 20, padding: 12, borderWidth: 1.5, borderColor: colors.line },
  previewCard: { height: 330, borderRadius: 34, backgroundColor: '#BFEFF3', overflow: 'hidden', padding: 16 },
  previewGround: { position: 'absolute', left: -30, right: -30, bottom: -60, height: 110, borderRadius: 60, backgroundColor: '#7FD6A0' },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, padding: 12, ...(shadow as object) },
  notifIcon: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  unit: { height: 60, borderRadius: 30, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
});
