import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { Bouncy } from '../ui/motion';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countAllEvents, exportAll, exportCareCsv, getSetting as getSettingRaw, resetAll, setSetting as setSettingRaw } from '../data/repo';
import * as StoreReview from 'expo-store-review';
import { LEGAL } from '../config/links';
import { ART } from '../ui/art';
import { formatHM } from '../i18n/dates';
import { shareText } from '../native/files';
import { PermissionState, exactAlarmsAllowed, getPermission, requestExactAlarms, requestPermission } from '../native/notifications';
import { Chip, TabTitle } from '../ui/forms';
import { removeAllMemoryFiles } from '../native/media';
import { useApp } from '../state/AppState';
import { useCloud } from '../state/Cloud';
import { Icon, Label, SoftPill, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { toggleFeedback } from '../native/haptics';
import { analyticsEnabled, setAnalyticsEnabled } from '../native/analytics';
import { LANG_FLAGS, LANG_NAMES, t, tn } from '../i18n';
import { LanguagePicker } from '../ui/LanguagePicker';

export default function Settings() {
  const { pet, pets, db, bump, reload, settings, setSetting, setWeightUnit, pro, language, setLanguage } = useApp();
  const cloudState = useCloud();
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [exact, setExact] = useState(true);
  const [nudge, setNudge] = useState(true);
  const [nudgeTime, setNudgeTime] = useState('19:30');
  const [followUps, setFollowUps] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [pantryRem, setPantryRem] = useState(true);
  useEffect(() => {
    void getSettingRaw(db, 'followUps').then((v) => setFollowUps(v !== '0'));
    void getSettingRaw(db, 'pantryReminders').then((v) => setPantryRem(v !== '0'));
    void getPermission().then(setPerm);
    void exactAlarmsAllowed().then(setExact);
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
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(analyticsEnabled());
  useEffect(() => {
    if (pet) countAllEvents(db, pet.id).then(setTotal);
  }, [db, pet]);

  if (!pet) return null;

  const stamp = () => new Date().toISOString().slice(0, 10);
  const doExport = async () => shareText(await exportAll(db), `pavurio-export-${stamp()}.json`, 'application/json');
  const doCsv = async () => shareText(await exportCareCsv(db), `pavurio-care-${stamp()}.csv`, 'text/csv');

  const confirmReset = () => {
    const run = async () => {
      await resetAll(db);
      removeAllMemoryFiles();
      await reload();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
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
          <View style={{ marginHorizontal: -20 }}>
            <TabTitle title={pet.name} subtitle={t('Care, records, memories & settings')} />
          </View>

          {/* features live in Explore; Settings is only preferences, account, notifications and privacy */}
          <Bouncy scaleTo={0.975} accessibilityRole="button" onPress={() => router.push('/explore')} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} testID="settings-explore">
            <View style={{ flex: 1 }}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {t('Explore')}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{t('Everything Pavurio does for {name}', { name: pet.name })}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Bouncy>
          <View style={styles.divider} />

          {cloudState.enabled ? (
            <>
              <Label style={styles.section}>{t('Account')}</Label>
              <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel={t('Account')} onPress={() => router.push('/account')} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} testID="account-row">
                {ART.duo.privacy ? <Image source={ART.duo.privacy} style={{ width: 46, height: 46 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
                <View style={{ flex: 1 }}>
                  <T weight="xbold" style={{ fontSize: 17 }}>
                    {cloudState.user && !cloudState.user.anonymous ? (cloudState.files.pending > 0 ? t('Signed in · photos uploading') : cloudState.lastBackupAt ? t('Signed in · backed up') : t('Signed in')) : t('Save your account')}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>
                    {cloudState.user && !cloudState.user.anonymous ? (cloudState.user.email ?? t('Backup, sign out, delete account')) : t('Keep your pets safe if you change phones')}
                  </T>
                </View>
                <Icon name="chevR" size={18} color={colors.faint} />
              </Bouncy>
            </>
          ) : null}

          <Label style={styles.section}>{t("{name}'s daily plan", { name: pet.name })}</Label>
          <Bouncy scaleTo={0.975} accessibilityRole="button" onPress={() => router.push('/plan')} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} testID="plan-row">
            <View style={{ flex: 1 }}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {t('Meals, walks, portions and times')}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{t('Recommended for {name}’s age and size. Adjust anything.', { name: pet.name })}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Bouncy>

          <Label style={styles.section}>{t('Experience')}</Label>
          <View style={[styles.card]}>
            <ToggleRow label={t('Sounds')} hint={t('Little sounds when you log, slide and celebrate')} value={settings.sounds} onChange={(v) => setSetting('sounds', v)} />
            <View style={styles.sep} />
            <ToggleRow label={t('Vibrations')} value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
            <View style={styles.sep} />
            <ToggleRow
              label={t('Reduce motion')}
              hint={t('Calmer pet. Care logging works exactly the same.')}
              value={settings.reduceMotion}
              onChange={(v) => setSetting('reduceMotion', v)}
            />
            <View style={styles.sep} />
            <ToggleRow
              label={t('Help improve Pavurio')}
              hint={t('Anonymous usage stats, like which screens are used. Never your pet’s name, photos or notes.')}
              value={stats}
              onChange={(v) => {
                setStats(v);
                void setAnalyticsEnabled(db, v);
              }}
            />
          </View>

          <Label style={styles.section}>{t('Reminders')}</Label>
          <View style={[styles.card]}>
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
            {perm === 'undetermined' ? <SoftPill label={t('Turn on reminders')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={async () => setPerm(await requestPermission(db))} /> : null}
            {perm === 'granted' && !exact ? (
              <View style={{ marginTop: 12 }}>
                <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{t('Your phone may deliver reminders a few minutes late. Allow alarms & reminders so meals and medicine are on time.')}</T>
                <SoftPill label={t('Allow on-time reminders')} small style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={async () => setExact(await requestExactAlarms(db))} />
              </View>
            ) : null}
            {perm === 'denied' && Platform.OS !== 'web' ? <SoftPill label={t('Open phone settings')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => Linking.openSettings()} /> : null}
            <View style={styles.sep} />
            <ToggleRow
              label={t('Second reminder for meals & medicine')}
              hint={t('If a meal or dose is still open 30 minutes later, one gentle follow-up.')}
              value={followUps}
              onChange={async (v) => {
                setFollowUps(v);
                await setSettingRaw(db, 'followUps', v ? '1' : '0');
                bump();
              }}
            />
            <View style={styles.sep} />
            <ToggleRow
              label={t('Pantry reminders')}
              hint={t('When it’s time to order food and supplies, and if something has run out.')}
              value={pantryRem}
              onChange={async (v) => {
                setPantryRem(v);
                await setSettingRaw(db, 'pantryReminders', v ? '1' : '0');
                bump();
              }}
            />
            <View style={styles.sep} />
            <ToggleRow
              label={t('Evening check-in')}
              hint={t('One reminder in the evening, only if some of today’s care isn’t logged yet.')}
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
          <View style={[styles.card, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                {t('Weight')}
              </T>
              <Chip label="kg" on={settings.weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} />
              <Chip label="lb" on={settings.weightUnit === 'lb'} onPress={() => setWeightUnit('lb')} />
            </View>
            <View style={styles.sep} />
            <Bouncy scaleTo={0.98} onPress={() => setLangOpen(true)} accessibilityRole="button" accessibilityLabel={`${t('Language')}: ${LANG_NAMES[language]}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }} testID="settings-language">
              <T weight="xbold" style={{ fontSize: 17, flex: 1 }}>
                {t('Language')}
              </T>
              <T weight="black" style={{ fontSize: 16, color: colors.brand }}>
                {LANG_FLAGS[language]} {LANG_NAMES[language]}
              </T>
              <Icon name="chevR" size={16} color={colors.faint} />
            </Bouncy>
            <LanguagePicker visible={langOpen} value={language} onChange={(l) => void setLanguage(l)} onClose={() => setLangOpen(false)} />
          </View>

          <Label style={styles.section}>Pavurio Pro</Label>
          <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel="Pavurio Pro" onPress={() => router.push('/paywall')} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            {ART.icons.gem ? <Image source={ART.icons.gem} style={{ width: 34, height: 40 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
            <View style={{ flex: 1 }}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {pro ? t('Pro is active') : t('More pets & monthly stories')}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{pro ? t('Thank you for supporting Pavurio.') : t('Restore a purchase or see plans')}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Bouncy>

          <Label style={styles.section}>{t('Your data')}</Label>
          <View style={[styles.card]}>
            <T style={{ color: colors.inkSoft }}>
              {cloudState.enabled
                ? tn(total, '{n} care record for {name}, stored on this phone and backed up to your account.', '{n} care records for {name}, stored on this phone and backed up to your account.', { name: pet.name })
                : tn(total, '{n} care record for {name}, stored on this device. Nothing is uploaded.', '{n} care records for {name}, stored on this device. Nothing is uploaded.', { name: pet.name })}
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <SoftPill label={t('Care log (CSV)')} onPress={doCsv} small />
              <SoftPill label={t('Full backup (JSON)')} onPress={doExport} small />
              <SoftPill label={t('Erase everything')} onPress={confirmReset} color={colors.danger} tint={colors.dangerSoft} small />
            </View>
          </View>

          <Label style={styles.section}>{t('Help & feedback')}</Label>
          <View style={[styles.card, { paddingVertical: 4 }]}>
            {[
              { label: t('Rate Pavurio'), body: t('A review helps other pet parents find us'), go: rate, icon: ART.icons.heart },
              { label: t('Share Pavurio'), body: t('Tell a friend who loves their pet'), go: shareApp, icon: ART.icons.gift },
              { label: t('Achievements'), body: t('Milestones from your life together'), go: () => router.push('/achievements'), icon: ART.duo.awards },
              { label: t('Help center'), body: t('Restoring, subscriptions, reminders'), go: () => Linking.openURL(LEGAL.help), icon: ART.icons.paw },
              { label: t('Contact support'), body: LEGAL.support, go: () => Linking.openURL(`mailto:${LEGAL.support}?subject=Pavurio`), icon: ART.icons.paw },
              { label: t('Privacy policy'), body: cloudState.enabled ? t('What we keep and why') : t('Your data stays on your phone'), go: () => Linking.openURL(LEGAL.privacy), icon: ART.duo.privacy },
              { label: t('Terms of use'), body: t('Subscriptions and the fine print'), go: () => Linking.openURL(LEGAL.terms), icon: ART.duo.privacy },
            ].map((r, i) => (
              <Bouncy scaleTo={0.975} key={r.label} accessibilityRole="button" accessibilityLabel={r.label} onPress={r.go} style={[styles.linkRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                {r.icon ? <Image source={r.icon} style={{ width: 38, height: 38 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
                <View style={{ flex: 1 }}>
                  <T weight="xbold" style={{ fontSize: 16 }}>
                    {r.label}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>{r.body}</T>
                </View>
                <Icon name="chevR" size={18} color={colors.faint} />
              </Bouncy>
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
      <Switch value={value} onValueChange={(v) => {
          // the switch you just turned on answers with its own feedback (turning sounds on plays one)
          onChange(v);
          setTimeout(() => toggleFeedback(v), 0);
        }} trackColor={{ true: colors.brand, false: colors.line }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  hub: { marginTop: 18, gap: 10 },
  hubRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  tileArt: { width: 86, height: 86 },
  tileArtSm: { width: 64, height: 64, marginRight: 8, marginBottom: 8 },
  menuArt: { width: 28, height: 28, resizeMode: 'contain' },
  menuArtBig: { width: 46, height: 46, resizeMode: 'contain' },
  divider: { alignSelf: 'center', width: 120, height: 3, borderRadius: 2, backgroundColor: colors.line, marginTop: 14, marginBottom: 6 },
  whatsNew: { height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: '#FFFFFF', justifyContent: 'center', ...(softShadow as object) },
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { marginTop: 26, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
});
