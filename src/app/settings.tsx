import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plan } from '../domain/progress';
import { countAllEvents, exportAll, resetAll, setPlan } from '../data/repo';
import { useApp } from '../state/AppState';
import { PlanEditor } from '../features/PetEditors';
import { CircleButton, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { successFeedback } from '../native/haptics';

export default function Settings() {
  const { pet, plan, db, bump, reload, settings, setSetting } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const [draft, setDraft] = useState<Plan>(plan);
  const [total, setTotal] = useState(0);
  const [savedPlan, setSavedPlan] = useState(false);

  useEffect(() => setDraft(plan), [plan]);
  useEffect(() => {
    if (pet) countAllEvents(db, pet.id).then(setTotal);
  }, [db, pet]);

  if (!pet) return null;
  const planDirty = JSON.stringify(draft) !== JSON.stringify(plan);

  const savePlan = async () => {
    await setPlan(db, pet, draft);
    successFeedback();
    setSavedPlan(true);
    bump();
    setTimeout(() => setSavedPlan(false), 1800);
  };

  const doExport = async () => {
    const json = await exportAll(db);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pavurio-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ message: json, title: 'Pavurio data export' });
  };

  const confirmReset = () => {
    const run = async () => {
      await resetAll(db);
      await reload();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Erase ${pet.name} and all ${total} care records from this device? This cannot be undone.`)) run();
      return;
    }
    Alert.alert('Erase all data?', `${pet.name} and ${total} care records will be removed from this device. Export first if you want a copy.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 30 }}>
        <View style={{ width: W, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <CircleButton icon="back" label="Back" onPress={() => router.back()} />
            <T weight="black" style={{ fontSize: 22 }} accessibilityRole="header">
              Settings
            </T>
            <View style={{ width: 52 }} />
          </View>

          <Label style={styles.section}>{pet.name}'s daily plan</Label>
          <PlanEditor species={pet.species} plan={draft} onChange={setDraft} />
          <View style={{ marginTop: 12 }}>
            <Pill label={savedPlan ? 'SAVED ✓' : 'SAVE PLAN'} onPress={savePlan} disabled={!planDirty && !savedPlan} />
          </View>

          <Label style={styles.section}>Experience</Label>
          <View style={[styles.card, softShadow]}>
            <ToggleRow label="Haptics" value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
            <View style={styles.sep} />
            <ToggleRow
              label="Reduce motion"
              hint="Calmer pet. Care logging works exactly the same."
              value={settings.reduceMotion}
              onChange={(v) => setSetting('reduceMotion', v)}
            />
          </View>

          <Label style={styles.section}>Your data</Label>
          <View style={[styles.card, softShadow]}>
            <T style={{ color: colors.inkSoft }}>
              {total} care record{total === 1 ? '' : 's'} stored on this device. Nothing is uploaded.
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <SoftPill label="Export JSON" onPress={doExport} small />
              <SoftPill label="Erase everything" onPress={confirmReset} color={colors.danger} tint={colors.dangerSoft} small />
            </View>
          </View>

          <Label style={styles.section}>About</Label>
          <T style={{ color: colors.muted, lineHeight: 21 }}>
            Pavurio helps you keep track of the care you give. It does not give medical advice or judge your pet's
            health — your progress is simply how much of your own plan you logged today.
          </T>
          <T style={{ color: colors.faint, marginTop: 14, fontSize: 12 }}>Pavurio 0.1.0 · vertical slice</T>
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T weight="xbold" style={{ fontSize: 17 }}>
          {label}
        </T>
        {hint ? <T style={{ color: colors.muted, fontSize: 13 }}>{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors.line }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { marginTop: 26, marginBottom: 10 },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 16 },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
});
