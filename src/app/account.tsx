/**
 * Account & backup.
 * - /account            manage: save the guest account with Apple / Google / email, back up, sign out, delete
 * - /account?mode=signin  "I already have an account" from the welcome screen: sign in and restore
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCloud } from '../state/Cloud';
import { useApp } from '../state/AppState';
import type { AuthResult } from '../cloud/types';
import { ART } from '../ui/art';
import { Field } from '../ui/forms';
import { CircleButton, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors, softShadow } from '../ui/theme';
import { successFeedback } from '../native/haptics';
import { formatRelative } from '../i18n/dates';
import { t } from '../i18n';

type Method = 'apple' | 'google' | 'email';

function ask(title: string, body: string, buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; value: string }[]): Promise<string> {
  return new Promise((resolve) => {
    Alert.alert(title, body, buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) })), { cancelable: true, onDismiss: () => resolve('cancel') });
  });
}

export default function Account() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const signinMode = mode === 'signin';
  const cloudState = useCloud();
  const { enabled, user, busy, lastBackupAt, appleAvailable, crashReports } = cloudState;
  const { pets, reload } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const saved = !!user && !user.anonymous;

  const finishSignIn = async (r: AuthResult & { restored?: boolean }) => {
    if (r.kind !== 'ok') return handleFail(r);
    successFeedback();
    await reload();
    if (r.restored) router.replace('/');
    else if (signinMode) {
      setNote(t('Signed in. There are no saved pets on this account yet — let’s set one up.'));
      setTimeout(() => router.replace('/onboarding'), 1400);
    } else setNote(t('Signed in.'));
  };

  const handleFail = (r: AuthResult) => {
    if (r.kind === 'error') setError(r.message);
    if (r.kind === 'reauth') setError(t('For your safety, confirm it’s you first.'));
  };

  const signIn = async (m: Method) => {
    setError(null);
    if (pets.length > 0) {
      const v = await ask(t('Use your saved data?'), t('Signing in replaces the pets on this phone with the ones saved in that account.'), [
        { text: t('Cancel'), style: 'cancel', value: 'cancel' },
        { text: t('Sign in'), style: 'destructive', value: 'go' },
      ]);
      if (v !== 'go') return;
    }
    await finishSignIn(await cloudState.signIn(m, { email, password, replaceLocal: true }));
  };

  const save = async (m: Method) => {
    setError(null);
    const r = await cloudState.save(m, email, password);
    if (r.kind === 'ok') {
      successFeedback();
      setEmailOpen(false);
      setNote(t('Account saved. Your pets are backed up.'));
      return;
    }
    if (r.kind === 'exists') {
      const v = await ask(t('You already have an account'), t('That sign-in belongs to another Pavurio account. Sign in to it? The pets on this phone will be replaced by the ones saved there.'), [
        { text: t('Cancel'), style: 'cancel', value: 'cancel' },
        { text: t('Sign in'), style: 'destructive', value: 'go' },
      ]);
      if (v === 'go') await finishSignIn(await cloudState.signIn(m, { email, password, replaceLocal: true }));
      return;
    }
    handleFail(r);
  };

  const go = (m: Method) => (signinMode ? signIn(m) : saved ? signIn(m) : save(m));

  const signOut = async () => {
    const v = await ask(t('Sign out?'), t('Your pets are backed up to your account. This phone will be cleared until you sign in again.'), [
      { text: t('Cancel'), style: 'cancel', value: 'cancel' },
      { text: t('Sign out'), style: 'destructive', value: 'go' },
    ]);
    if (v !== 'go') return;
    await cloudState.signOut();
    await reload();
    router.replace('/onboarding');
  };

  const deleteAccount = async () => {
    const v = await ask(t('Delete your account?'), t('Your account, your backup and every pet and record on this phone will be deleted. This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel', value: 'cancel' },
      { text: t('Delete'), style: 'destructive', value: 'go' },
    ]);
    if (v !== 'go') return;
    let r = await cloudState.deleteAccount();
    if (r.kind === 'reauth' && user) {
      const m: Method = user.providers.includes('apple') ? 'apple' : user.providers.includes('google') ? 'google' : 'email';
      if (m === 'email' && !password) {
        setEmailOpen(true);
        setError(t('Enter your password, then tap Delete account again.'));
        return;
      }
      r = await cloudState.deleteAccount({ m, email: user.email ?? email, password });
    }
    if (r.kind !== 'ok') return handleFail(r);
    await reload();
    router.replace('/onboarding');
  };

  const forgot = async () => {
    if (!email.trim()) return setError(t('Enter your email first.'));
    try {
      await cloudState.resetPassword(email);
      setNote(t('Check your inbox for a link to choose a new password.'));
    } catch {
      setError(t('Something went wrong. Please try again.'));
    }
  };

  const providerLabel = user?.providers.includes('apple') ? 'Apple' : user?.providers.includes('google') ? 'Google' : user?.email ?? '';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: W, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <CircleButton icon="back" label={t('Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace(signinMode ? '/onboarding' : '/'))} />
            <T weight="black" style={{ fontSize: 22 }} accessibilityRole="header">
              {signinMode ? t('Welcome back') : t('Account')}
            </T>
            <View style={{ width: 52 }} />
          </View>

          <View style={{ alignItems: 'center', marginTop: 18 }}>
            {ART.icons.shield ? <Image source={ART.icons.shield} style={{ width: 92, height: 92 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
            <T weight="black" style={styles.h1}>
              {signinMode ? t('Sign in to get your pets back') : saved ? t('Your pets are safe') : t('Save your account')}
            </T>
            <T style={styles.sub}>
              {signinMode
                ? t('Use the same Apple, Google or email you used before. Your care history comes right back.')
                : saved
                  ? t('Signed in with {who}. Everything is backed up automatically.', { who: providerLabel })
                  : t('Your care history is backed up while you use Pavurio. Save your account to get it back on a new phone.')}
            </T>
          </View>

          {!enabled ? (
            <View style={[styles.card, softShadow, { marginTop: 22 }]}>
              <T style={{ color: colors.inkSoft, lineHeight: 21 }}>{t('Accounts and cloud backup are available in the iPhone and Android app.')}</T>
            </View>
          ) : (
            <>
              {saved && !signinMode ? (
                <View style={[styles.card, softShadow, { marginTop: 22 }]}>
                  <T weight="xbold" style={{ fontSize: 17 }}>
                    {lastBackupAt ? t('Backed up {when}', { when: formatRelative(lastBackupAt) }) : t('Not backed up yet')}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                    {t('Pets, care log, routines, visits, weights and records. Photos stay on this phone.')}
                  </T>
                  <SoftPill label={busy ? t('Backing up…') : t('Back up now')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => void cloudState.backupNow()} />
                </View>
              ) : (
                <View style={{ gap: 12, marginTop: 24 }}>
                  {appleAvailable ? <AppleButton signin={signinMode || saved} onPress={() => void go('apple')} /> : null}
                  <GoogleButton signin={signinMode || saved} onPress={() => void go('google')} />
                  <Pill
                    label={signinMode ? t('SIGN IN WITH EMAIL') : t('CONTINUE WITH EMAIL')}
                    color={colors.white}
                    textColor={colors.ink}
                    style={{ borderWidth: 2, borderColor: colors.line }}
                    onPress={() => setEmailOpen((o) => !o)}
                    testID="email-open"
                  />
                </View>
              )}

              {emailOpen ? (
                <View style={[styles.card, softShadow, { marginTop: 14, gap: 12 }]}>
                  <Field label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
                  <Field
                    label={t('Password')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete={signinMode ? 'current-password' : 'new-password'}
                    textContentType={signinMode ? 'password' : 'newPassword'}
                  />
                  <Pill label={signinMode ? t('SIGN IN') : t('SAVE MY ACCOUNT')} onPress={() => void go('email')} disabled={!email.trim() || password.length < 6} loading={busy} />
                  {signinMode ? (
                    <Pressable accessibilityRole="button" onPress={() => void forgot()} style={{ alignSelf: 'center', padding: 6 }}>
                      <T weight="xbold" style={{ color: colors.brand }}>
                        {t('Forgot password?')}
                      </T>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {busy ? <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} /> : null}
              {error ? <T style={styles.error}>{error}</T> : null}
              {note ? <T style={styles.note}>{note}</T> : null}

              {!signinMode && saved ? (
                <>
                  <Label style={styles.section}>{t('Account')}</Label>
                  <View style={[styles.card, softShadow, { gap: 10 }]}>
                    <SoftPill label={t('Sign out')} onPress={() => void signOut()} small style={{ alignSelf: 'flex-start' }} />
                    <SoftPill label={t('Delete account')} onPress={() => void deleteAccount()} color={colors.danger} tint={colors.dangerSoft} small style={{ alignSelf: 'flex-start' }} />
                  </View>
                </>
              ) : null}

              {!signinMode && !saved ? (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/account', params: { mode: 'signin' } })} style={{ alignSelf: 'center', padding: 14 }}>
                  <T weight="xbold" style={{ color: colors.brand }}>
                    {t('I already have an account')}
                  </T>
                </Pressable>
              ) : null}

              {!signinMode ? (
                <>
                  <Label style={styles.section}>{t('Privacy')}</Label>
                  <View style={[styles.card, softShadow, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <T weight="xbold" style={{ fontSize: 17 }}>
                        {t('Share crash reports')}
                      </T>
                      <T style={{ color: colors.muted, fontSize: 13 }}>{t('Anonymous technical details when the app crashes, so we can fix it.')}</T>
                    </View>
                    <Switch value={crashReports} onValueChange={(v) => void cloudState.setCrashReports(v)} trackColor={{ true: colors.brand, false: colors.line }} accessibilityLabel={t('Share crash reports')} />
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AppleButton({ signin, onPress }: { signin: boolean; onPress: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  return (
    <Apple.AppleAuthenticationButton
      buttonType={signin ? Apple.AppleAuthenticationButtonType.SIGN_IN : Apple.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={30}
      style={{ height: 58 }}
      onPress={onPress}
    />
  );
}

function GoogleButton({ signin, onPress }: { signin: boolean; onPress: () => void }) {
  if (Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const G = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  return (
    <View style={{ alignItems: 'stretch' }} accessibilityLabel={signin ? t('Sign in with Google') : t('Continue with Google')}>
      <G.GoogleSigninButton size={G.GoogleSigninButton.Size.Wide} color={G.GoogleSigninButton.Color.Light} onPress={onPress} style={{ width: '100%', height: 56 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 26, textAlign: 'center', marginTop: 12 },
  sub: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 8 },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 16 },
  section: { marginTop: 26, marginBottom: 10 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 14, lineHeight: 20 },
  note: { color: colors.brand, textAlign: 'center', marginTop: 14, lineHeight: 20 },
});
