import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plan } from '../domain/progress';
import { countAllEvents, exportAll, exportCareCsv, resetAll, setPlan } from '../data/repo';
import { shareText } from '../native/files';
import { PermissionState, getPermission, requestPermission } from '../native/notifications';
import { Chip } from '../ui/forms';
import { Icon } from '../ui/primitives';
import { useApp } from '../state/AppState';
import { PlanEditor } from '../features/PetEditors';
import { CircleButton, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { successFeedback } from '../native/haptics';

export default function Settings() {
  const { pet, pets, plan, db, bump, reload, settings, setSetting, setWeightUnit, pro, language, setLanguage } = useApp();
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  useEffect(() => {
    void getPermission().then(setPerm);
  }, []);
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

  const stamp = () => new Date().toISOString().slice(0, 10);
  const doExport = async () => shareText(await exportAll(db), `pavurio-export-${stamp()}.json`, 'application/json');
  const doCsv = async () => shareText(await exportCareCsv(db), `pavurio-care-${stamp()}.csv`, 'text/csv');

  const confirmReset = () => {
    const run = async () => {
      await resetAll(db);
      await reload();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Erase all ${pets.length} pet${pets.length === 1 ? '' : 's'} and every record from this device? This cannot be undone.`)) run();
      return;
    }
    Alert.alert('Erase all data?', `All pets, care logs, routines, records and moments will be removed from this device. Export first if you want a copy.`, [
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

          <Label style={styles.section}>Reminders</Label>
          <View style={[styles.card, softShadow]}>
            <T weight="xbold" style={{ fontSize: 17 }}>
              {perm === 'granted' ? 'Notifications are on' : perm === 'denied' ? 'Notifications are off' : perm === 'unsupported' ? 'Reminders need the phone app' : 'Notifications not set up'}
            </T>
            <T style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
              Routines you create in Care send a reminder at each time. Nothing is ever marked done for you.
            </T>
            {perm === 'undetermined' ? <SoftPill label="Turn on reminders" small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={async () => setPerm(await requestPermission())} /> : null}
            {perm === 'denied' && Platform.OS !== 'web' ? <SoftPill label="Open phone settings" small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => Linking.openSettings()} /> : null}
          </View>

          <Label style={styles.section}>Units & language</Label>
          <View style={[styles.card, softShadow, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                Weight
              </T>
              <Chip label="kg" on={settings.weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} />
              <Chip label="lb" on={settings.weightUnit === 'lb'} onPress={() => setWeightUnit('lb')} />
            </View>
            <View style={styles.sep} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                Language
              </T>
              <Chip label="English" on={language === 'en'} onPress={() => setLanguage('en')} />
              <Chip label="Français" on={language === 'fr'} onPress={() => setLanguage('fr')} />
            </View>
          </View>

          <Label style={styles.section}>Pavurio Pro</Label>
          <Pressable accessibilityRole="button" accessibilityLabel="Pavurio Pro" onPress={() => router.push('/paywall')} style={[styles.card, softShadow, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {pro ? 'Pro is active' : 'More pets & monthly stories'}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{pro ? 'Thank you for supporting Pavurio.' : 'Restore a purchase or see plans'}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Pressable>

          <Label style={styles.section}>Your data</Label>
          <View style={[styles.card, softShadow]}>
            <T style={{ color: colors.inkSoft }}>
              {total} care record{total === 1 ? '' : 's'} for {pet.name}, stored on this device. Nothing is uploaded.
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <SoftPill label="Care log (CSV)" onPress={doCsv} small />
              <SoftPill label="Full backup (JSON)" onPress={doExport} small />
              <SoftPill label="Erase everything" onPress={confirmReset} color={colors.danger} tint={colors.dangerSoft} small />
            </View>
          </View>

          <Label style={styles.section}>About</Label>
          <T style={{ color: colors.muted, lineHeight: 21 }}>
            Pavurio helps you keep track of the care you give. It does not give medical advice or judge your pet's
            health — your progress is simply how much of your own plan you logged today.
          </T>
          <T style={{ color: colors.faint, marginTop: 14, fontSize: 12 }}>Pavurio 1.0.0</T>
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
