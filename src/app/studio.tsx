import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetRig } from '../animation/PetRig';
import { useBursts } from '../animation/Burst';
import { Appearance } from '../domain/appearance';
import { ValidationError, updatePet } from '../data/repo';
import { useApp } from '../state/AppState';
import { LookPicker } from '../features/PetEditors';
import { CircleButton, Pill, T } from '../ui/primitives';
import { colors, font } from '../ui/theme';
import { errorFeedback, petFeedback, successFeedback } from '../native/haptics';

/** Character Studio — appearance is stored locally per pet and previewed live. */
export default function Studio() {
  const { pet, db, bump, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const focused = useIsFocused();
  const { bursts, fire } = useBursts(!reduceMotion);
  const [appearance, setAppearance] = useState<Appearance | null>(pet?.appearance ?? null);
  const [name, setName] = useState(pet?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pet) {
      setAppearance(pet.appearance);
      setName(pet.name);
    }
  }, [pet]);

  if (!pet || !appearance) return null;
  const dirty = name.trim() !== pet.name || JSON.stringify(appearance) !== JSON.stringify(pet.appearance);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePet(db, pet.id, { name, appearance });
      successFeedback();
      bump();
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save changes.');
      errorFeedback();
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: W }}>
          <View style={styles.topRow}>
            <T weight="black" style={{ fontSize: 22 }} accessibilityRole="header">
              Character Studio
            </T>
            <CircleButton icon="close" label="Close" onPress={() => router.back()} />
          </View>
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <PetRig
              species={pet.species}
              appearance={appearance}
              size={Math.min(W * 0.7, height * 0.36, 300)}
             
              active={focused}
              reduceMotion={reduceMotion}
              interactive
              onTap={() => {
                petFeedback();
                fire('hearts', ['#FF6B9A', '#FF8FA3']);
              }}
              bursts={bursts}
              accessibilityLabel={`${pet.name} preview`}
            />
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.name}
            maxLength={40}
            accessibilityLabel="Pet name"
          />
          <LookPicker species={pet.species} appearance={appearance} onChange={setAppearance} />
          {error ? <T style={{ color: colors.danger, textAlign: 'center', marginTop: 10 }}>{error}</T> : null}
          <View style={{ paddingHorizontal: 24, marginTop: 26 }}>
            <Pill label="SAVE LOOK" onPress={save} loading={saving} disabled={!dirty || !name.trim()} />
          </View>
          <T style={styles.note}>More accessories, outfits and Little World items arrive in a later update.</T>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  name: {
    fontFamily: font.black,
    fontSize: 30,
    color: colors.ink,
    textAlign: 'center',
    marginHorizontal: 40,
    marginVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.line,
    paddingVertical: 6,
  },
  note: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 16, paddingHorizontal: 30 },
});
