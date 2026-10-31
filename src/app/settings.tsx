import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plan } from '../domain/progress';
import { countAllEvents, exportAll, exportCareCsv, getSetting as getSettingRaw, resetAll, setPlan, setSetting as setSettingRaw } from '../data/repo';
import * as StoreReview from 'expo-store-review';
import { LEGAL } from '../config/links';
import { formatHM } from '../i18n/dates';
import { shareText } from '../native/files';
import { PermissionState, getPermission, requestPermission } from '../native/notifications';
import { Chip } from '../ui/forms';
import { Icon } from '../ui/primitives';
import { useApp } from '../state/AppState';
import { PlanEditor } from '../features/PetEditors';
import { CircleButton, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { t, tn } from '../i18n';

export default function Settings() {
  const { pet, pets, plan, db, bump, reload, settings, setSetting, setWeightUnit, pro, language, setLanguage } = useApp();
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [nudge, setNudge] = useState(true);
  const [nudgeTime, setNudgeTime] = useState('19:30');
  useEffect(() => {
    void getPermission().then(setPerm);
    void getSettingRaw(db, 'eveningNudge').then((v) => setNudge(v !== '0'));
    void getSettingRaw(db, 'eveningNudgeTime').then((v) => v && setNudgeTime(v));
  }, [db]);
  const rate = async () => {
    if (await StoreReview.hasAction()) await StoreReview.requestReview();
    else {
      const url = StoreReview.storeUrl();
      if (url) Linking.openURL(url);
    }
  };
  const shareApp = () =>
    Share.share({ message: t('I keep track of my pet’s care with Pavurio — the pet colours in as you log meals, walks and more. 🐾') + (StoreReview.storeUrl() ? `\n${StoreReview.storeUrl()}` : '') });
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
      if (window.confirm(tn(pets.length, 'Erase all {n} pet and every record from this device? This cannot be undone.', 'Erase all {n} pets and every record from this device? This cannot be undone.'))) run();
      return;
    }
    Alert.alert(t('Erase all data?'), t('All pets, care logs, routines, records and moments will be removed from this device. Export first if you want a copy.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Erase'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 30 }}>
        <View style={{ width: W, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <CircleButton icon="back" label={t('Back')} onPress={() => router.back()} />
            <T weight="black" style={{ fontSize: 22 }} accessibilityRole="header">
              {t('Settings')}
            </T>
            <View style={{ width: 52 }} />
          </View>

          <Label style={styles.section}>{t("{name}'s daily plan", { name: pet.name })}</Label>
          <PlanEditor species={pet.species} plan={draft} onChange={setDraft} />
          <View style={{ marginTop: 12 }}>
            <Pill label={savedPlan ? t('SAVED ✓') : t('SAVE PLAN')} onPress={savePlan} disabled={!planDirty && !savedPlan} />
          </View>

          <Label style={styles.section}>{t('Experience')}</Label>
          <View style={[styles.card, softShadow]}>
            <ToggleRow label={t('Haptics')} value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
            <View style={styles.sep} />
            <ToggleRow
              label={t('Reduce motion')}
              hint={t('Calmer pet. Care logging works exactly the same.')}
              value={settings.reduceMotion}
              onChange={(v) => setSetting('reduceMotion', v)}
            />
          </View>

          <Label style={styles.section}>{t('Reminders')}</Label>
          <View style={[styles.card, softShadow]}>
            <T weight="xbold" style={{ fontSize: 17 }}>
              {perm === 'granted'
                ? t('Notifications are on')
                : perm === 'denied'
                  ? t('Notifications are off')
                  : perm === 'unsupported'
                    ? t('Reminders need the phone app')
                    : t('Notifications not set up')}
            </T>
            <T style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
              {t('Routines you create in Care send a reminder at each time. Nothing is ever marked done for you.')}
            </T>
            {perm === 'undetermined' ? <SoftPill label={t('Turn on reminders')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={async () => setPerm(await requestPermission())} /> : null}
            {perm === 'denied' && Platform.OS !== 'web' ? <SoftPill label={t('Open phone settings')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => Linking.openSettings()} /> : null}
            <View style={styles.sep} />
            <ToggleRow
              label={t('Evening nudge')}
              hint={t('A reminder in the evening only if today’s plan isn’t coloured in yet — it also protects your streak.')}
              value={nudge}
              onChange={async (v) => {
                setNudge(v);
                await setSettingRaw(db, 'eveningNudge', v ? '1' : '0');
                bump();
              }}
            />
            {nudge ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {['18:30', '19:30', '20:30', '21:30'].map((tm) => (
                  <Chip
                    key={tm}
                    label={formatHM(Number(tm.slice(0, 2)), Number(tm.slice(3)))}
                    on={nudgeTime === tm}
                    onPress={async () => {
                      setNudgeTime(tm);
                      await setSettingRaw(db, 'eveningNudgeTime', tm);
                      bump();
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <Label style={styles.section}>{t('Units & language')}</Label>
          <View style={[styles.card, softShadow, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                {t('Weight')}
              </T>
              <Chip label="kg" on={settings.weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} />
              <Chip label="lb" on={settings.weightUnit === 'lb'} onPress={() => setWeightUnit('lb')} />
            </View>
            <View style={styles.sep} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                {t('Language')}
              </T>
              <Chip label="English" on={language === 'en'} onPress={() => setLanguage('en')} />
              <Chip label="Français" on={language === 'fr'} onPress={() => setLanguage('fr')} />
            </View>
          </View>

          <Label style={styles.section}>Pavurio Pro</Label>
          <Pressable accessibilityRole="button" accessibilityLabel="Pavurio Pro" onPress={() => router.push('/paywall')} style={[styles.card, softShadow, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {pro ? t('Pro is active') : t('More pets & monthly stories')}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{pro ? t('Thank you for supporting Pavurio.') : t('Restore a purchase or see plans')}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Pressable>

          <Label style={styles.section}>{t('Your data')}</Label>
          <View style={[styles.card, softShadow]}>
            <T style={{ color: colors.inkSoft }}>
              {tn(total, '{n} care record for {name}, stored on this device. Nothing is uploaded.', '{n} care records for {name}, stored on this device. Nothing is uploaded.', { name: pet.name })}
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <SoftPill label={t('Care log (CSV)')} onPress={doCsv} small />
              <SoftPill label={t('Full backup (JSON)')} onPress={doExport} small />
              <SoftPill label={t('Erase everything')} onPress={confirmReset} color={colors.danger} tint={colors.dangerSoft} small />
            </View>
          </View>

          <Label style={styles.section}>{t('Help & feedback')}</Label>
          <View style={[styles.card, softShadow, { paddingVertical: 4 }]}>
            {[
              { label: t('Rate Pavurio'), body: t('A review helps other pet parents find us'), go: rate },
              { label: t('Share Pavurio'), body: t('Tell a friend who loves their pet'), go: shareApp },
              { label: t('Achievements'), body: t('Badges, streaks and challenges'), go: () => router.push('/achievements') },
              { label: t('Contact support'), body: LEGAL.support, go: () => Linking.openURL(`mailto:${LEGAL.support}?subject=Pavurio`) },
              { label: t('Privacy policy'), body: t('Your data stays on your phone'), go: () => Linking.openURL(LEGAL.privacy) },
              { label: t('Terms of use'), body: t('Subscriptions and the fine print'), go: () => Linking.openURL(LEGAL.terms) },
            ].map((r, i) => (
              <Pressable key={r.label} accessibilityRole="button" accessibilityLabel={r.label} onPress={r.go} style={[styles.linkRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <T weight="xbold" style={{ fontSize: 16 }}>
                    {r.label}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>{r.body}</T>
                </View>
                <Icon name="chevR" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>

          <Label style={styles.section}>{t('About')}</Label>
          <T style={{ color: colors.muted, lineHeight: 21 }}>
            {t("Pavurio helps you keep track of the care you give. It does not give medical advice or judge your pet's health — your progress is simply how much of your own plan you logged today.")}
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
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
});
