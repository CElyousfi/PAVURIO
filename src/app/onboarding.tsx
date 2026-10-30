import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { PetRig } from '../animation/PetRig';
import { usePetMotion } from '../animation/usePetMotion';
import { Species } from '../domain/care';
import { Appearance, defaultAppearance } from '../domain/appearance';
import { Plan } from '../domain/progress';
import { ValidationError, createPet, defaultPlan } from '../data/repo';
import { useApp } from '../state/AppState';
import { CircleButton, Pill, T } from '../ui/primitives';
import { LookPicker, PlanEditor } from '../features/PetEditors';
import { CareIcon } from '../ui/CareIcon';
import { colors, font, shadow } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';

type Step = 'welcome' | 'species' | 'name' | 'look' | 'plan';
const ORDER: Step[] = ['welcome', 'species', 'name', 'look', 'plan'];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const { db, reload, reduceMotion } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [species, setSpecies] = useState<Species>('dog');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance('dog'));
  const [plan, setPlan] = useState<Plan>(defaultPlan('dog'));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const motion = usePetMotion({ active: true, reduceMotion });

  // Welcome: the sketch colors itself in, on a gentle loop (skippable, decorative).
  const [demoFill, setDemoFill] = useState(0.15);
  useEffect(() => {
    if (step !== 'welcome' || reduceMotion) {
      setDemoFill(1);
      return;
    }
    const seq = [0.15, 0.45, 0.75, 1, 1, 0.15];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % seq.length;
      setDemoFill(seq[i]);
    }, 1300);
    return () => clearInterval(t);
  }, [step, reduceMotion]);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const back = () => {
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
    const n = name.trim();
    if (!n) {
      setError('Please give them a name.');
      errorFeedback();
      return;
    }
    go('look');
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createPet(db, { species, name, appearance, plan });
      successFeedback();
      await reload();
      router.replace('/');
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Something went wrong while saving. Please try again.');
      errorFeedback();
      setSaving(false);
    }
  };

  const petSize = Math.min(W * 0.72, 330);
  const displayName = name.trim() || (species === 'dog' ? 'your dog' : 'your cat');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.topRow, { width: W }]}>
        {step !== 'welcome' ? <CircleButton icon="back" label="Back" onPress={back} size={46} /> : <View style={{ width: 46 }} />}
        {step !== 'welcome' ? <Dots index={ORDER.indexOf(step) - 1} total={ORDER.length - 1} /> : null}
        <View style={{ width: 46 }} />
      </View>

      {step === 'welcome' && (
        <Animated.View key="welcome" entering={FadeIn} exiting={FadeOut} style={[styles.page, { width: W }]}>
          <View style={styles.center}>
            <View style={styles.badge}>
              <CareIcon type="meal" size={44} />
            </View>
            <T weight="black" style={styles.h1}>
              A little world for all{'\n'}their big moments
            </T>
            <T style={styles.sub}>Log the care you give. Watch them color in.</T>
          </View>
          <View style={styles.hero}>
            <PetRig species="dog" appearance={defaultAppearance('dog')} size={petSize} progress={demoFill} motion={motion} reduceMotion={reduceMotion} interactive />
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label="GET STARTED" onPress={() => go('species')} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="get-started" />
          </View>
        </Animated.View>
      )}

      {step === 'species' && (
        <Animated.View key="species" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            Who are we caring for?
          </T>
          <T style={styles.sub}>Pavurio starts with dogs and cats. More friends later.</T>
          <View style={styles.speciesRow}>
            {(['dog', 'cat'] as Species[]).map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={s === 'dog' ? 'Dog' : 'Cat'}
                onPress={() => chooseSpecies(s)}
                style={({ pressed }) => [styles.speciesCard, shadow, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                testID={`species-${s}`}
              >
                <PetRig species={s} appearance={defaultAppearance(s)} size={Math.min(150, W * 0.36)} />
                <T weight="black" style={styles.speciesLabel}>
                  {s === 'dog' ? 'DOG' : 'CAT'}
                </T>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {step === 'name' && (
        <Animated.View key="name" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            What's their name?
          </T>
          <View style={styles.hero}>
            <PetRig species={species} appearance={appearance} size={petSize * 0.78} motion={motion} reduceMotion={reduceMotion} interactive />
          </View>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError(null);
            }}
            placeholder={species === 'dog' ? 'Biscuit' : 'Mochi'}
            placeholderTextColor={colors.faint}
            style={styles.nameInput}
            maxLength={40}
            autoFocus={Platform.OS !== 'web'}
            returnKeyType="next"
            onSubmitEditing={submitName}
            accessibilityLabel="Pet name"
            testID="name-input"
          />
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label="NEXT" onPress={submitName} disabled={!name.trim()} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="name-next" />
          </View>
        </Animated.View>
      )}

      {step === 'look' && (
        <Animated.View key="look" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            Make {displayName} look like {displayName}
          </T>
          <View style={styles.hero}>
            <PetRig species={species} appearance={appearance} size={petSize * 0.8} motion={motion} reduceMotion={reduceMotion} interactive />
          </View>
          <LookPicker species={species} appearance={appearance} onChange={setAppearance} />
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label="LOOKS RIGHT" onPress={() => go('plan')} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="look-next" />
          </View>
        </Animated.View>
      )}

      {step === 'plan' && (
        <Animated.View key="plan" entering={FadeInDown.duration(260)} style={[styles.page, { width: W }]}>
          <T weight="black" style={styles.h2}>
            {displayName}'s daily plan
          </T>
          <T style={styles.sub}>You decide what a good day looks like. Each thing you log colors in a bit more of {displayName}.</T>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
            <PlanEditor species={species} plan={plan} onChange={setPlan} />
          </ScrollView>
          {error ? <T style={styles.error}>{error}</T> : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            <Pill label="LET'S GO" onPress={finish} loading={saving} style={{ alignSelf: 'stretch', marginHorizontal: 24 }} testID="finish" />
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function Dots({ index, total }: { index: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${index + 1} of ${total}`}>
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
  speciesRow: { flexDirection: 'row', gap: 16, marginTop: 40, paddingHorizontal: 20 },
  speciesCard: { flex: 1, backgroundColor: colors.white, borderRadius: 28, alignItems: 'center', paddingVertical: 22 },
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
  error: { color: colors.danger, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
});
