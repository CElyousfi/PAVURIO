import React, { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInLeft, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../animation/PetRig';
import { cloud } from '../cloud/firebase';
import { CARE, CareType, Species } from '../domain/care';
import { Appearance, PALETTES, defaultAppearance, isProCoat } from '../domain/appearance';
import { Plan, Portions } from '../domain/progress';
import { Pet, ValidationError, getSetting, setSetting } from '../data/repo';
import { Choice, defaultProfile, estimateWeightKg, planBasis, recommendedChoice, targetsFor } from '../domain/carePlan';
import { approxBirthDate } from '../domain/lifeStage';
import { About, AboutPet, CarePage, PlanReview, targetHeadline } from '../features/AutoPlan';
import { useScreenBudget } from '../ui/layout';
import { fitHeroPet } from '../ui/sizing';
import { DRAFT_KEY, finishSetup, startPetSetup } from '../data/setup';
import { PetPreview } from '../ui/PetPreview';
import { StudioPicker } from '../features/PetEditors';
import { track } from '../native/analytics';
import { useApp } from '../state/AppState';
import { CircleButton, Pill, T } from '../ui/primitives';
import { ART } from '../ui/art';
import { CareIcon } from '../ui/CareIcon';
import { NotifPreview } from '../ui/NotifPreview';
import { colors, font, shadow } from '../ui/theme';
import { Sheet } from '../ui/forms';
import { Bouncy, ConfettiRain } from '../ui/motion';
import { errorFeedback, selectFeedback, successFeedback } from '../native/haptics';
import { requestPermission } from '../native/notifications';
import { LANG_NAMES, Lang, t } from '../i18n';
import { LanguagePicker, langShort } from '../ui/LanguagePicker';
import { savedValue } from '../domain/weight';
import { dropWhileBusy } from '../data/lock';


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

type Step = 'welcome' | 'species' | 'name' | 'look' | 'about' | 'plan' | 'care' | 'home';
// meet your pet (species, name) → make them yours (look) → their needs (about: all optional) →
// the first plan on ONE screen ('care' = optional page-by-page customising with the bowl controls) →
// welcome home. No paywall on the way: the free app is the first experience.
const ORDER: Step[] = ['welcome', 'species', 'name', 'look', 'about', 'plan', 'care', 'home'];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const { db, reload, reduceMotion, language, setLanguage, setWeightUnit, settings, pets, pro } = useApp();
  const params = useLocalSearchParams<{ add?: string }>();
  const adding = params.add === '1';
  const [step, setStep] = useState<Step>(adding ? 'species' : 'welcome');
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [species, setSpecies] = useState<Species>('dog');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance('dog'));
  const [about, setAbout] = useState<About>({ stage: null, months: null, profile: defaultProfile('dog'), kg: 0, kgTouched: false });
  const [choices, setChoices] = useState<Choice[]>([]);
  const [careIdx, setCareIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Pet | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const [confetti, setConfetti] = useState<number | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const nameRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const budget = useScreenBudget(250);

  // interrupted setup (call, app killed…) resumes where it was, with what was already chosen
  const restored = useRef(false);
  useEffect(() => {
    if (adding) return;
    getSetting(db, DRAFT_KEY)
      .then((raw) => {
        if (!raw || restored.current) return;
        const d = JSON.parse(raw) as { step: Step; species: Species; name: string; appearance: Appearance; about: About };
        if (!d?.species || !['name', 'look', 'about', 'plan', 'care'].includes(d.step)) return;
        restored.current = true;
        setSpecies(d.species);
        setName(d.name ?? '');
        if (d.appearance) setAppearance(d.appearance);
        if (d.about) setAbout(d.about);
        setStep(d.step === 'care' || d.step === 'plan' ? 'about' : d.step);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (adding || created || ['welcome', 'species', 'home'].includes(step)) return;
    const timer = setTimeout(() => void setSetting(db, DRAFT_KEY, JSON.stringify({ step, species, name, appearance, about })).catch(() => null), 300);
    return () => clearTimeout(timer);
  }, [adding, created, step, species, name, appearance, about, db]);

  // a backup restored in the background (same account after a reinstall): straight to Home
  useEffect(() => {
    if (!adding && !created && step === 'welcome' && pets.length > 0) router.replace('/');
  }, [adding, created, step, pets.length]);

  // steps slide in the direction of travel
  const dir = useRef<1 | -1>(1);
  const go = (s: Step) => {
    setError(null);
    track('onboarding_step', { step: s, adding });
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
    setAbout({ stage: null, months: null, profile: defaultProfile(s), kg: 0, kgTouched: false });
    track('species_selected', { species: s });
    go('name');
  };

  const submitName = () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      setError(t('Please give them a name.'));
      errorFeedback();
      nameRef.current?.focus();
      return;
    }
    setName(clean);
    // the keyboard goes away before the studio slides in, so the pet has its full space
    Keyboard.dismiss();
    track('name_completed', { length: clean.length > 12 ? 'long' : 'short' });
    track('appearance_opened', { species });
    go('look');
  };

  const estimateKg = estimateWeightKg(species, about.profile.size, about.months ?? 36);
  // age unknown: the plan starts from an adult's needs (said so on screen) and adjusts once the age is added
  const planMonths = about.months ?? (about.unsure ? 24 : null);
  const basis = planMonths != null ? planBasis(species, planMonths, about.profile, about.kgTouched ? about.kg : null) : null;
  const targets = basis ? targetsFor(basis) : [];
  const toPlan = () => {
    if (!basis) return;
    // treatments are never a default: prevention is offered, off, "if your vet recommends it"
    setChoices(targets.map(recommendedChoice).filter((c): c is Choice => !!c).map((c) => (c.kind === 'interval' ? { ...c, on: false } : c)));
    setCareIdx(0);
    track('plan_built', { species, stage: basis.stage, size: about.profile.size, food: about.profile.food, weighed: about.kgTouched, age_known: about.months != null });
    track('plan_overview_reached', { species });
    go('plan');
  };
  const nextCare = () => {
    if (careIdx < choices.length - 1) {
      dir.current = 1;
      track('onboarding_care_page', { care: choices[careIdx + 1].care, index: careIdx + 1 });
      setCareIdx(careIdx + 1);
    } else go('plan');
  };
  const useLook = () => {
    if (!pro && isProCoat(species, appearance.paletteId)) {
      // a Pro coat was only tried on: the free app keeps a free coat (Pro is offered later, never here)
      const free = PALETTES[species].find((p) => !p.pro) ?? PALETTES[species][0];
      setAppearance({ ...appearance, paletteId: free.id });
    }
    track('appearance_confirmed', { species, default: appearance.paletteId === defaultAppearance(species).paletteId && appearance.accessoryId === defaultAppearance(species).accessoryId });
    go('about');
  };

  // one save at a time, even for two taps in the same frame (state only changes on the next render)
  const oneSave = useRef(dropWhileBusy()).current;
  const createTheirPet = () => oneSave(saveTheirPet);
  const saveTheirPet = async () => {
    if (!basis) return;
    setSaving(true);
    setError(null);
    try {
      const p: Plan = {};
      const por: Portions = {};
      for (const c of choices) {
        p[c.care] = c.on && c.kind === 'daily' ? c.count : 0;
        if (c.on && c.portion != null) por[c.care] = c.portion;
      }
      const unit = settings.weightUnit;
      // the pet is created once; a retry (or a restart) only finishes its setup — never a twin
      let pet = created;
      if (!pet) {
        pet = await startPetSetup(
          db,
          { species, name: name.trim(), appearance, plan: p, portions: por, birthDate: about.months != null ? approxBirthDate(about.months) : undefined },
          {
            profile: about.profile,
            months: basis.months,
            weight: about.kgTouched ? { value: savedValue(about.kg, unit), unit, at: Date.now() } : null,
            weighedKg: about.kgTouched ? about.kg : null,
            choices,
            birthApprox: about.months != null,
          },
        );
        setCreated(pet);
      }
      await finishSetup(db, pet.id);
      track('onboarding_complete', {
        species,
        stage: basis.stage,
        cares: choices.filter((c) => c.on).length,
        reminders: choices.filter((c) => c.on && c.remind).length,
        // how many cares the owner moved away from the recommendation (0 = took the plan as is)
        adjusted: choices.filter((c) => {
          const tg = targets.find((x) => x.care === c.care);
          const rec = tg ? recommendedChoice(tg) : null;
          return !rec || !c.on || rec.count !== c.count || rec.portion !== c.portion;
        }).length,
      });
      await reload();
      successFeedback();
      go('home');
      if (!reduceMotion) setTimeout(() => setClip({ name: 'celebrate', nonce: Date.now() }), 450);
      setTimeout(() => setConfetti(Date.now()), 350);
    } catch (e) {
      // the pet (if created) is kept; tapping again finishes its setup, and so does the next app start
      setError(e instanceof ValidationError ? e.message : t('Something went wrong while saving. Please try again.'));
      errorFeedback();
    } finally {
      setSaving(false);
    }
  };

  /** Into the app. Always reaches Home: a slow permission prompt or a failed reload can't hold it. */
  const finish = (then?: 'log-meal') => oneSave(() => enterHome(then));
  const enterHome = async (then?: 'log-meal') => {
    if (!created) return;
    setSaving(true);
    try {
      // the plan's reminders are already set up: just ask for the permission they need (never wait long)
      if (choices.some((c) => c.on && c.remind)) await Promise.race([requestPermission(db).catch(() => null), new Promise((r) => setTimeout(r, 8000))]);
      await reload().catch(() => null);
    } finally {
      setSaving(false);
      track('onboarding_completed', { species: created.species, then: then ?? 'explore' });
      if (adding) router.dismissTo('/');
      else router.replace('/');
      // logging is the owner's choice, about care that really happened: the normal log card, nothing automatic
      if (then === 'log-meal') setTimeout(() => router.push({ pathname: '/log/[type]', params: { type: 'meal' } }), 400);
    }
  };

  const displayName = name.trim() || (species === 'dog' ? t('your dog') : t('your cat'));
  const setupSteps: Step[] = ['species', 'name', 'look', 'about', 'plan'];
  const dotIndex = step === 'care' ? 4 : setupSteps.indexOf(step);
  const dotTotal = setupSteps.length;
  const careChoice = step === 'care' ? choices[careIdx] : undefined;
  const careTarget = careChoice ? targets.find((x) => x.care === careChoice.care) : undefined;
  const showBack = step !== 'welcome' && !created;
  const showSkip = false;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { paddingTop: insets.top + 8 }]}>
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
          petSize={budget.pet('hero')}
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
                  <PetRig species={s} appearance={defaultAppearance(s)} size={budget.pet('card')} />
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
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <T weight="black" style={styles.h2}>
              {species === 'dog' ? t('What’s your dog’s name?') : t('What’s your cat’s name?')}
            </T>
            {/* the pet steps back when the keyboard opens: the name being typed comes first */}
            <View style={{ marginTop: 8, minHeight: budget.keyboardOpen ? 0 : 120, justifyContent: 'center' }}>
              <PetPreview species={species} appearance={appearance} size={budget.pet('form')} reduceMotion={reduceMotion} />
            </View>
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 8 }}>
              <T weight="black" style={styles.fieldLabel}>
                {t('Pet name')}
              </T>
              <TextInput maxFontSizeMultiplier={1.4}
                ref={nameRef}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (error) setError(null);
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder={species === 'dog' ? 'Biscuit' : 'Mochi'}
                placeholderTextColor={colors.faint}
                selectionColor={colors.brand}
                cursorColor={colors.brand}
                style={[styles.nameInput, nameFocused && styles.nameInputFocus, error ? { borderColor: colors.danger } : null]}
                maxLength={40}
                autoFocus={Platform.OS !== 'web'}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={submitName}
                accessibilityLabel={t('Pet name')}
                accessibilityHint={error ?? undefined}
                testID="name-input"
              />
              {error ? (
                <T style={styles.error} accessibilityLiveRegion="assertive" testID="name-error">
                  {error}
                </T>
              ) : null}
            </View>
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: (budget.keyboardOpen ? 10 : insets.bottom) + 14 }]}>
            <Pill label={t('CONTINUE')} onPress={submitName} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="name-next" />
          </View>
        </Animated.View>
      )}

      {step === 'look' && (
        <Animated.View key="look" entering={slide()} style={[styles.page, { width: W }]}>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 12 }}>
            <T weight="black" style={styles.h2}>
              {t('Make {name} yours', { name: displayName })}
            </T>
            <View style={styles.studioStage}>
              <PetPreview species={species} appearance={appearance} size={budget.pet('studio')} reduceMotion={reduceMotion} interactive testID="studio-preview" />
            </View>
            <StudioPicker species={species} appearance={appearance} onChange={setAppearance} pro={pro} onPick={(what, id) => track(what === 'coat' ? 'coat_selected' : 'accessory_selected', { species, id })} />
          </ScrollView>
          {/* always on screen, outside the scrolling part, above the system navigation bar */}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
            <Pill label={t('USE THIS LOOK')} onPress={useLook} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="look-next" />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAppearance(defaultAppearance(species));
                track('appearance_confirmed', { species, default: true });
                go('about');
              }}
              style={{ alignSelf: 'center', padding: 10 }}
              testID="look-default"
            >
              <T weight="xbold" style={{ color: colors.muted, fontSize: 14 }}>
                {t('Keep the default look')}
              </T>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'about' && (
        <Animated.View key="about" entering={slide()} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {t('About {name}', { name: displayName })}
          </T>
          <T style={styles.sub}>{t('A few taps, and we’ll build {name}’s whole routine for you. Not sure about something? Keep what’s already chosen.', { name: displayName })}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <AboutPet species={species} name={displayName} about={about} estimateKg={estimateKg} unit={settings.weightUnit} onChange={setAbout} allowUnsure />
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            {planMonths == null ? <T style={[styles.hint, { marginBottom: 8 }]}>{t('Choose an age, or “I’m not sure”.')}</T> : null}
            <Pill label={t('BUILD THE PLAN')} onPress={toPlan} disabled={planMonths == null} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="about-next" />
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
          <T style={styles.sub}>{about.unsure ? t('A starting plan for an adult. Tap any line to change it.') : t('Made for {name}’s age, size and food. Tap any line to change it.', { name: displayName })}</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <PlanReview unit={settings.weightUnit} name={displayName} basis={basis} targets={targets} choices={choices} onChange={setChoices} />
            <T style={styles.planNote}>{t('🔔 Reminders only where they help. Everything else is on the list, ready to tick.')}</T>
            <T style={styles.planNote}>{t('These are starting points from general vet guidance, not medical advice. Your vet knows {name} best.', { name: displayName })}</T>
          </ScrollView>
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
            <Pill label={t('START WITH THIS PLAN')} onPress={createTheirPet} loading={saving} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="plan-next" />
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setCareIdx(0);
                go('care');
              }}
              style={{ alignSelf: 'center', padding: 10 }}
              testID="plan-customize"
            >
              <T weight="black" style={{ color: colors.brand, fontSize: 15 }}>
                {t('Customize')}
              </T>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'home' && created && (
        <Animated.View key="home" entering={FadeIn.duration(320)} style={[styles.page, { width: W }]}>
          <T weight="black" style={[styles.h1, { marginTop: 18, paddingHorizontal: 24 }]}>
            {t('Welcome home, {name}!', { name: created.name })}
          </T>
          <T style={styles.sub}>{t('Let’s take care of {name} together.', { name: created.name })}</T>
          <View style={styles.hero}>
            <PetPreview species={created.species} appearance={created.appearance} size={budget.pet('hero')} clip={clip} onClipEnd={() => setClip(null)} reduceMotion={reduceMotion} interactive active testID="home-pet" />
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
            <Pill label={t('LET’S GO')} onPress={() => void finish()} loading={saving} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="home-enter" />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void finish('log-meal')} style={{ alignSelf: 'center', padding: 12 }} testID="home-log-meal">
              <T weight="black" style={{ color: CARE.meal.color, fontSize: 15 }}>
                {t('{name} just ate? Log the meal', { name: created.name })}
              </T>
            </Pressable>
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

/** The welcome: one screen, the pets, what Pavurio is, one clear way in (and a sign-in for returning owners). */
function Welcome(props: { width: number; petSize: number; bottomInset: number; reduceMotion: boolean; language: Lang; onLanguage: () => void; onStart: () => void }) {
  return <WelcomePager {...props} />;
}

function WelcomePager({ width, petSize, bottomInset, reduceMotion, language, onLanguage, onStart }: { width: number; petSize: number; bottomInset: number; reduceMotion: boolean; language: Lang; onLanguage: () => void; onStart: () => void }) {
  const [page, setPage] = useState(0);
  const [fill, setFill] = useState(0.15);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const touched = useRef(false);
  const frames = [
    { care: 'meal' as CareType, title: t('Every little care makes a big difference.'), sub: t('Routines, food, health and memories. Everything your pet needs, in one happy place.') },
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
  // the pet fits the space the slide really has left (measured), on every phone and tablet
  const [heroBox, setHeroBox] = useState<{ w: number; h: number } | null>(null);
  const onHeroLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setHeroBox((b) => (b && Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
  };
  const size = heroBox ? fitHeroPet('pet', petSize, heroBox) : 0;
  const catSize = heroBox ? fitHeroPet('notif', petSize, heroBox) : 0;
  const { height: screenH } = useWindowDimensions();
  const compact = screenH < 700;
  // each slide is exactly as tall as the pager, so the pet area gets the real space that is left
  const [pagerH, setPagerH] = useState(0);

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
        onLayout={(e) => setPagerH(e.nativeEvent.layout.height)}
      >
        {frames.map((f, i) => (
          <View key={i} style={{ width, height: pagerH || undefined, alignItems: 'center' }}>
            <View style={[styles.center, compact && { marginTop: 4 }]}>
              <View style={[styles.badge, compact && styles.badgeCompact]}>
                {i === 0 && ART.ui.welcomeBadge != null ? <Image source={ART.ui.welcomeBadge} style={{ width: compact ? 40 : 52, height: compact ? 40 : 52 }} /> : <CareIcon type={f.care} size={compact ? 34 : 44} />}
              </View>
              <T weight="black" style={[styles.h1, compact && styles.h1Compact]}>
                {f.title}
              </T>
              <T style={[styles.sub, compact && styles.subCompact]}>{f.sub}</T>
            </View>
            <View style={styles.hero} onLayout={i === 0 ? onHeroLayout : undefined}>
              {!heroBox ? null : i === 0 ? (
                <PetPreview species="dog" appearance={defaultAppearance('dog')} size={size} progress={fill} stack={WELCOME_STACK} reduceMotion={reduceMotion} interactive active={page === 0} />
              ) : i === 1 ? (
                <View style={{ alignItems: 'center' }}>
                  <NotifPreview
                    title={t('Fresh water for {name} 💧', { name: 'Mochi' })}
                    body={t('Tap Done when it’s done')}
                    delay={300}
                    play={page === 1}
                    style={{ marginBottom: 10, width: Math.min(width - 48, 320) }}
                  />
                  {catSize > 0 ? <PetRig species="cat" appearance={defaultAppearance('cat')} size={catSize * 0.85} progress={0.62} stack={WELCOME_STACK_CAT} reduceMotion={reduceMotion} active={page === 1} /> : null}
                </View>
              ) : (
                <PetPreview species="dog" appearance={defaultAppearance('dog')} size={size} progress={1} clip={page === 2 ? clip : null} onClipEnd={() => setClip(page === 2 ? { name: 'celebrate', nonce: Date.now() } : null)} reduceMotion={reduceMotion} active={page === 2} />
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
        {/* narrow phones get the short label, so it never shrinks to unreadable or cuts off */}
        <Pill label={width < 360 ? t('GET STARTED') : t('LET’S MEET YOUR PET')} onPress={onStart} style={{ flex: 1 }} testID="get-started" />
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
  studioStage: { marginTop: 6, marginBottom: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: 32, paddingHorizontal: 18 },
  fieldLabel: { fontSize: 13, letterSpacing: 1.2, color: colors.muted, marginBottom: 6 },
  nameInputFocus: { borderColor: colors.brand },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  center: { alignItems: 'center', marginTop: 12, paddingHorizontal: 24 },
  badge: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FEF3DC', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  h1: { fontSize: 32, lineHeight: 38, textAlign: 'center' },
  h1Compact: { fontSize: 26, lineHeight: 31 },
  subCompact: { fontSize: 15, lineHeight: 20, marginTop: 6 },
  badgeCompact: { width: 50, height: 50, borderRadius: 17, marginBottom: 8 },
  h2: { fontSize: 28, lineHeight: 34, textAlign: 'center', paddingHorizontal: 24, marginTop: 10 },
  sub: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 30, lineHeight: 22 },
  hero: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' },
  bottom: { alignSelf: 'stretch', paddingTop: 10 },
  welcomeBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', paddingHorizontal: 24 },
  lang: { height: 60, paddingHorizontal: 14, borderRadius: 30, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  speciesRow: { flexDirection: 'row', gap: 16, marginTop: 40, paddingHorizontal: 20 },
  speciesCard: { backgroundColor: colors.white, borderRadius: 28, alignItems: 'center', paddingVertical: 22 },
  speciesLabel: { fontSize: 15, letterSpacing: 1.6, color: colors.muted, marginTop: 10 },
  nameInput: {
    fontFamily: font.black,
    fontSize: 26,
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2.5,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.white,
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
