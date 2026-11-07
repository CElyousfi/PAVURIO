import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../animation/PetRig';
import { cloud } from '../cloud/firebase';
import { CARE, CareType, Species } from '../domain/care';
import { Appearance, defaultAppearance, isProCoat } from '../domain/appearance';
import { Plan, Portions, computeProgress, portionOf } from '../domain/progress';
import { Pet, ValidationError, createPet, defaultPlan, logCare, setSetting } from '../data/repo';
import { addMeasurement } from '../data/careRepo';
import { applyChoices, setProfile } from '../data/autoPlan';
import { Choice, defaultProfile, estimateWeightKg, planBasis, recommendedChoice, targetsFor } from '../domain/carePlan';
import { approxBirthDate } from '../domain/lifeStage';
import { About, AboutPet, CarePage, PlanReview, targetHeadline } from '../features/AutoPlan';
import { markGuideSeen } from '../features/RoutineGuide';
import { useApp } from '../state/AppState';
import { CircleButton, Pill, T } from '../ui/primitives';
import { LookPicker } from '../features/PetEditors';
import { ART } from '../ui/art';
import { CareIcon } from '../ui/CareIcon';
import { NotifPreview } from '../ui/NotifPreview';
import { colors, font, shadow } from '../ui/theme';
import { Sheet } from '../ui/forms';
import { Bouncy, ConfettiRain, Float, Pulse } from '../ui/motion';
import { errorFeedback, logFeedback, petFeedback, selectFeedback, successFeedback } from '../native/haptics';
import { requestPermission } from '../native/notifications';
import { newId } from '../domain/ids';
import { LANG_NAMES, Lang, t } from '../i18n';
import { LanguagePicker, langShort } from '../ui/LanguagePicker';


/** the welcome pet colours in band by band, like Waterllama's llama */
const WELCOME_STACK = [
  { color: CARE.meal.color, from: 0, to: 0.24 },
  { color: CARE.water.color, from: 0.24, to: 0.46 },
  { color: CARE.walk.color, from: 0.46, to: 0.7 },
  { color: CARE.play.color, from: 0.7, to: 1 },
];
const WELCOME_STACK_CAT = [
  { color: CARE.water.color, from: 0, to: 0.3 },
  { color: CARE.meal.color, from: 0.3, to: 0.62 },
];

type Step = 'welcome' | 'species' | 'name' | 'look' | 'about' | 'care' | 'plan' | 'first';
// age, size and food build the whole plan; the exact birthday and adoption day can be added later in the profile
// 'care' is one page per care (meals, water, walks…), with the same bowl-and-drag controls as logging
const ORDER: Step[] = ['welcome', 'species', 'name', 'look', 'about', 'care', 'plan', 'first'];
const CLIP_FOR: Partial<Record<CareType, PetClipName>> = { meal: 'eat', water: 'drink', walk: 'walk', play: 'play', grooming: 'groom', medication: 'meds' };

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const { db, reload, bump, reduceMotion, language, setLanguage, setWeightUnit, settings, pets, pro } = useApp();
  const params = useLocalSearchParams<{ add?: string }>();
  const adding = params.add === '1';
  const [step, setStep] = useState<Step>(adding ? 'species' : 'welcome');
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [species, setSpecies] = useState<Species>('dog');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance('dog'));
  const [plan, setPlan] = useState<Plan>(defaultPlan('dog'));
  const [portions, setPortions] = useState<Portions>({});
  const [about, setAbout] = useState<About>({ stage: null, months: null, profile: defaultProfile('dog'), kg: 0, kgTouched: false });
  const [choices, setChoices] = useState<Choice[]>([]);
  const [careIdx, setCareIdx] = useState(0);
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

  // steps slide in the direction of travel
  const dir = useRef<1 | -1>(1);
  const go = (s: Step) => {
    setError(null);
    dir.current = ORDER.indexOf(s) >= ORDER.indexOf(step) ? 1 : -1;
    setStep(s);
  };
  const slide = () => (reduceMotion ? undefined : (dir.current > 0 ? FadeInRight : FadeInLeft).springify().damping(20).stiffness(180).mass(0.8));
  const back = () => {
    if (adding && step === 'species') return router.back();
    if (created) return; // the pet exists: no going back into setup
    if (step === 'care' && careIdx > 0) {
      dir.current = -1;
      return setCareIdx(careIdx - 1);
    }
    const i = ORDER.indexOf(step);
    if (i > 0) go(ORDER[i - 1]);
  };

  const chooseSpecies = (s: Species) => {
    selectFeedback();
    setSpecies(s);
    setAppearance(defaultAppearance(s));
    setPlan(defaultPlan(s));
    setAbout({ stage: null, months: null, profile: defaultProfile(s), kg: 0, kgTouched: false });
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

  const estimateKg = estimateWeightKg(species, about.profile.size, about.months ?? 36);
  const basis = about.months != null ? planBasis(species, about.months, about.profile, about.kgTouched ? about.kg : null) : null;
  const targets = basis ? targetsFor(basis) : [];
  const toPlan = () => {
    if (!basis) return;
    setChoices(targets.map(recommendedChoice).filter((c): c is Choice => !!c));
    setCareIdx(0);
    go('care');
  };
  const nextCare = () => {
    if (careIdx < choices.length - 1) {
      dir.current = 1;
      setCareIdx(careIdx + 1);
    } else go('plan');
  };

  const createTheirPet = async () => {
    if (saving || !basis) return;
    setSaving(true);
    setError(null);
    try {
      const p: Plan = {};
      const por: Portions = {};
      for (const c of choices) {
        p[c.care] = c.on && c.kind === 'daily' ? c.count : 0;
        if (c.on && c.portion != null) por[c.care] = c.portion;
      }
      const pet = await createPet(db, { species, name, appearance, plan: p, portions: por, birthDate: approxBirthDate(basis.months) });
      await setSetting(db, `birthApprox:${pet.id}`, '1');
      await setProfile(db, pet.id, about.profile);
      if (about.kgTouched) {
        const unit = settings.weightUnit;
        await addMeasurement(db, { petId: pet.id, kind: 'weight', value: Math.round((unit === 'lb' ? about.kg / 0.45359237 : about.kg) * 10) / 10, unit, at: Date.now() });
      }
      await applyChoices(db, pet, basis, choices);
      // the plan was just built for this age: no "new for this age" card on day one
      await markGuideSeen(db, { ...pet, birthDate: approxBirthDate(basis.months) });
      setPlan(p);
      setPortions(por);
      setCreated(pet);
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
      await logCare(db, { petId: created.id, type: firstType, occurredAt: Date.now(), amount: CARE[firstType].amount ? portionOf(firstType, portions) : undefined, mutationId: newId() });
      setFirstLogged(firstType);
      bump();
      logFeedback();
      if (!reduceMotion && CLIP_FOR[firstType]) setClip({ name: CLIP_FOR[firstType]!, nonce: Date.now() });
      setTimeout(() => setConfetti(Date.now()), 500);
    } catch {
      errorFeedback();
    }
  };

  const finish = async () => {
    if (!created || saving) return;
    setSaving(true);
    try {
      // the plan's reminders are already set up: just ask for the permission they need
      if (choices.some((c) => c.on && c.remind)) await requestPermission(db).catch(() => null);
      await reload();
      if (adding) router.dismissTo('/');
      // a Pro coat chosen while setting up: the paywall leads with keeping it (it goes back to a drawn
      // coat if they close without Pro)
      else if (created && !pro && isProCoat(created.species, created.appearance.paletteId)) router.replace({ pathname: '/paywall', params: { reason: 'coat', coat: created.appearance.paletteId, from: 'onboarding' } });
      else router.replace({ pathname: '/paywall', params: { reason: 'onboarding' } });
    } finally {
      setSaving(false);
    }
  };

  const petSize = Math.min(W * 0.72, 330);
  const displayName = name.trim() || (species === 'dog' ? t('your dog') : t('your cat'));
  const setupSteps: Step[] = ['species', 'name', 'look', 'about', 'care', 'plan'];
  const dotIndex = step === 'care' ? 4 + careIdx : step === 'plan' ? 4 + choices.length : setupSteps.indexOf(step);
  const dotTotal = 5 + Math.max(1, choices.length);
  const careChoice = step === 'care' ? choices[careIdx] : undefined;
  const careTarget = careChoice ? targets.find((x) => x.care === careChoice.care) : undefined;
  const showBack = step !== 'welcome' && !created;
  const showSkip = step === 'first';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.topRow, { width: W }]}>
        {showBack ? <CircleButton icon="back" label={t('Back')} onPress={back} size={46} /> : <View style={{ width: 46 }} />}
        {setupSteps.includes(step) ? <Dots index={dotIndex} total={dotTotal} /> : null}
        {showSkip ? (
          <Pressable accessibilityRole="button" onPress={() => finish()} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }} testID="skip">
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
          onLanguage={() => setLangOpen(true)}
          onStart={() => setUnitsOpen(true)}
        />
      )}

      {step === 'species' && (
        <Animated.View key="species" entering={slide()} style={[styles.page, { width: W }]}>
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
        <Animated.View key="name" entering={slide()} style={[styles.page, { width: W }]}>
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
        <Animated.View key="look" entering={slide()} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('Make {name} look like {name}', { name: displayName })}
          </T>
          <View style={styles.hero}>
            <PetRig species={species} appearance={appearance} size={petSize * 0.8} reduceMotion={reduceMotion} interactive />
          </View>
          <LookPicker species={species} appearance={appearance} onChange={setAppearance} pro={pro} />
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('LOOKS RIGHT')} onPress={() => go('about')} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="look-next" />
          </View>
        </Animated.View>
      )}

      {step === 'about' && (
        <Animated.View key="about" entering={slide()} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('About {name}', { name: displayName })}
          </T>
          <T style={styles.sub}>{t('A few taps, and we’ll build {name}’s whole routine for you.', { name: displayName })}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <AboutPet species={species} name={displayName} about={about} estimateKg={estimateKg} unit={settings.weightUnit} onChange={setAbout} />
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('BUILD THE PLAN')} onPress={toPlan} disabled={about.months == null} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="about-next" />
          </View>
        </Animated.View>
      )}

      {step === 'care' && basis && careChoice && careTarget && (
        <Animated.View key={`care-${careIdx}`} entering={slide()} style={[styles.page, { width: W }]}>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12, alignItems: 'center' }}>
            <T weight="black" style={{ color: CARE[careChoice.care].color, fontSize: 13, letterSpacing: 1.6, marginTop: 4 }}>
              {CARE[careChoice.care].label.toUpperCase()}
            </T>
            <T weight="black" style={[styles.h2, { marginTop: 2 }]}>
              {targetHeadline(careTarget)}
            </T>
            <T style={[styles.sub, { marginBottom: 4 }]}>{t(careTarget.guide.why)}</T>
            <CarePage name={displayName} unit={settings.weightUnit} basis={basis} target={careTarget} choice={careChoice} onChange={(c) => setChoices(choices.map((x) => (x.care === c.care ? c : x)))} size={Math.min(W * 0.56, 230)} />
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('NEXT')} color={CARE[careChoice.care].color} onPress={nextCare} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="care-next" />
          </View>
        </Animated.View>
      )}

      {step === 'plan' && basis && (
        <Animated.View key="plan" entering={slide()} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('{name}’s plan is ready', { name: displayName })}
          </T>
          <T style={styles.sub}>{t('Made for {name}’s age, size and food. Tap any line to change it.', { name: displayName })}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <PlanReview unit={settings.weightUnit} name={displayName} basis={basis} targets={targets} choices={choices} onChange={setChoices} />
            <T style={styles.planNote}>{t('🔔 Reminders only where they help. Everything else is on the list, ready to tick.')}</T>
          </ScrollView>
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label={t('LOOKS GOOD')} onPress={createTheirPet} loading={saving} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="plan-next" />
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
              progress={firstLogged ? Math.max(0.12, computeProgress(plan, [{ type: firstType, occurredAt: Date.now() }], portions).level) : 0}
              stack={[{ color: CARE[firstType].color, from: 0, to: 1 }]}
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
                <Pill label={t('NEXT')} onPress={() => finish()} loading={saving} style={{ marginHorizontal: 24 }} testID="first-next" />
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

      <LanguagePicker visible={langOpen} value={language} onChange={(l) => void setLanguage(l)} onClose={() => setLangOpen(false)} />
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

/** session flag: the pet is only woken once (going back to the welcome step doesn't put it to sleep again) */
let wokenOnce = false;

function Welcome(props: { width: number; bottomInset: number; reduceMotion: boolean; language: Lang; onLanguage: () => void; onStart: () => void }) {
  const [awake, setAwake] = useState(wokenOnce || props.reduceMotion);
  if (!awake)
    return (
      <WakeIntro
        width={props.width}
        bottomInset={props.bottomInset}
        onAwake={() => {
          wokenOnce = true;
          setAwake(true);
        }}
      />
    );
  return <WelcomePager {...props} />;
}

/**
 * Clucky's opener: the pet is asleep, a hand says "Tap to wake". The tap plays the hello clip, the pet
 * says hi, and the welcome slides in. Skipped entirely with reduce-motion.
 */
function WakeIntro({ width, bottomInset, onAwake }: { width: number; bottomInset: number; onAwake: () => void }) {
  const [phase, setPhase] = useState<'asleep' | 'waking' | 'hi'>('asleep');
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const size = Math.min(width * 0.78, 340);
  const wake = () => {
    if (phase === 'hi') return onAwake();
    if (phase !== 'asleep') return;
    petFeedback();
    setTimeout(() => successFeedback(), 500);
    setPhase('waking');
    setClip({ name: 'hello', nonce: Date.now() });
    timers.current.push(setTimeout(() => setPhase('hi'), 900));
    timers.current.push(setTimeout(onAwake, 3400));
  };
  return (
    <Pressable onPress={wake} accessibilityRole="button" accessibilityLabel={phase === 'asleep' ? t('Tap to wake') : t('Continue')} style={[styles.page, { width, justifyContent: 'center' }]} testID="wake">
      <View style={{ height: 120, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 24 }}>
        {phase === 'hi' ? (
          <Animated.View entering={ZoomIn.springify().damping(11)} style={{ alignItems: 'center' }}>
            <T weight="black" style={styles.h1}>
              {t('Woof! Hi there!')}
            </T>
            <T style={styles.sub}>{t('Let’s take care of someone special.')}</T>
          </Animated.View>
        ) : null}
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <View>
          <PetRig species="dog" appearance={defaultAppearance('dog')} size={size} rest={phase === 'asleep'} clip={clip} onClipEnd={() => setClip(null)} active />
          {phase === 'asleep' ? <Zzz size={size} /> : null}
        </View>
      </View>
      <View style={{ height: 130, alignItems: 'center', paddingBottom: bottomInset + 20 }}>
        {phase === 'asleep' ? (
          <Animated.View entering={FadeInUp.delay(600)} style={{ alignItems: 'center', gap: 6 }}>
            <Float amount={8} period={1100}>
              <T style={{ fontSize: 40 }}>👆</T>
            </Float>
            <T weight="black" style={{ fontSize: 18, color: colors.muted }}>
              {t('Tap to wake')}
            </T>
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** three z's drifting up off the sleeping pet */
function Zzz({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: size * 0.12, right: size * 0.1 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} entering={FadeIn.delay(300 + i * 350)} style={{ marginLeft: (2 - i) * 18, marginTop: -6 }}>
          <Float amount={5 + i * 2} period={1600 + i * 300}>
            <T weight="black" style={{ fontSize: 36 - i * 8, color: colors.brand, opacity: 0.9 - i * 0.25 }}>
              z
            </T>
          </Float>
        </Animated.View>
      ))}
    </View>
  );
}

function WelcomePager({ width, bottomInset, reduceMotion, language, onLanguage, onStart }: { width: number; bottomInset: number; reduceMotion: boolean; language: Lang; onLanguage: () => void; onStart: () => void }) {
  const [page, setPage] = useState(0);
  const [fill, setFill] = useState(0.15);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const touched = useRef(false);
  const frames = [
    { care: 'meal' as CareType, title: t('Track every care'), sub: t('Log the care you give. Watch them color in.') },
    { care: 'water' as CareType, title: t('Never miss a thing'), sub: t('Meals, walks, pills and vet visits — gently reminded.') },
    { care: 'play' as CareType, title: t('Celebrate together'), sub: t('Milestones, memories and stories of your life together.') },
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
                <PetRig species="dog" appearance={defaultAppearance('dog')} size={size} progress={fill} stack={WELCOME_STACK} reduceMotion={reduceMotion} interactive active={page === 0} />
              ) : i === 1 ? (
                <View style={{ alignItems: 'center' }}>
                  <NotifPreview
                    title={t('Fresh water for {name} 💧', { name: 'Mochi' })}
                    body={t('Tap Done when it’s done')}
                    delay={300}
                    play={page === 1}
                    style={{ marginBottom: 10, width: size + 20 }}
                  />
                  <PetRig species="cat" appearance={defaultAppearance('cat')} size={size * 0.85} progress={0.62} stack={WELCOME_STACK_CAT} reduceMotion={reduceMotion} active={page === 1} />
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
        <Bouncy onPress={onLanguage} style={styles.lang} accessibilityRole="button" accessibilityLabel={`${t('Language')}: ${LANG_NAMES[language]}`} testID="language">
          <T weight="black" style={{ fontSize: 14 }}>
            {langShort(language)}
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
  planNote: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 18 },
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
  unit: { height: 60, borderRadius: 30, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
});
