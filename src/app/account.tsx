/**
 * Account & backup.
 * - /account               manage: create / save the account (Google, Apple on iPhone, email + password),
 *                          back up, sign out, delete
 * - /account?mode=signin   "I already have an account": sign in and restore
 *
 * Email accounts are confirmed with a 6-digit code sent by email (Cloud Functions + Resend), so every
 * saved email exists and belongs to its owner. Forgotten passwords are reset with a code too.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
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
import { lang } from '../i18n/core';
import { t } from '../i18n';

type Method = 'apple' | 'google' | 'email';
/** create: new account (links this phone's guest) · signin: existing account · code: 6-digit check
 *  forgot → reset: password reset with a code */
type Step = 'create' | 'signin' | 'code' | 'forgot' | 'reset';

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

  const [step, setStep] = useState<Step>(signinMode ? 'signin' : 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [codeTo, setCodeTo] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // an email account that still needs its code (e.g. the app was closed during sign-up)
  const unverifiedEmail = !!user && !user.anonymous && !user.verified && user.providers.includes('password');
  const saved = !!user && !user.anonymous && user.verified;
  useEffect(() => {
    if (unverifiedEmail && step !== 'code') {
      setCodeTo(user?.email ?? '');
      setStep('code');
    }
  }, [unverifiedEmail, step, user?.email]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const fail = (r: { kind: string; message?: string; retryIn?: number } | AuthResult) => {
    if (r.kind === 'error' && 'message' in r) {
      setError(r.message ?? t('Something went wrong. Please try again.'));
      if ('retryIn' in r && r.retryIn) setWait(r.retryIn);
    }
    if (r.kind === 'reauth') setError(t('For your safety, confirm it’s you first.'));
  };

  const busyDo = async (fn: () => Promise<void>) => {
    setError(null);
    setNote(null);
    setWorking(true);
    try {
      await fn();
    } finally {
      setWorking(false);
    }
  };

  const done = async (restored: boolean) => {
    successFeedback();
    await reload();
    if (restored) return router.replace('/');
    if (signinMode && pets.length === 0) {
      setNote(t('Signed in. There are no saved pets on this account yet — let’s set one up.'));
      setTimeout(() => router.replace('/onboarding'), 1400);
      return;
    }
    setNote(saved || signinMode ? t('Signed in.') : t('Account saved. Your pets are backed up.'));
    setStep('create');
  };

  /** send (or re-send) the code to the account's email */
  const sendCode = async () => {
    const r = await cloudState.sendCode(lang());
    if (r.kind === 'sent') {
      setCodeTo(r.email);
      setCode('');
      setStep('code');
      setWait(45);
    } else if (r.kind === 'verified') {
      const v = await cloudState.verifyCode('', marketing); // already verified server-side: just refresh
      if (v.kind === 'ok') await done(v.restored);
    } else fail(r);
  };

  const confirmReplace = async () => {
    if (pets.length === 0) return true;
    const v = await ask(t('Use your saved data?'), t('Signing in replaces the pets on this phone with the ones saved in that account.'), [
      { text: t('Cancel'), style: 'cancel', value: 'cancel' },
      { text: t('Sign in'), style: 'destructive', value: 'go' },
    ]);
    return v === 'go';
  };

  const signIn = (m: Method) =>
    busyDo(async () => {
      if (!(await confirmReplace())) return;
      const r = await cloudState.signIn(m, { email, password, replaceLocal: true });
      if (r.kind !== 'ok') return fail(r);
      if (r.needsCode) return sendCode();
      if (m === 'google' && marketing) void cloudState.setMarketing(true, 'google');
      await done(!!r.restored);
    });

  const create = (m: Method) =>
    busyDo(async () => {
      const r = await cloudState.save(m, email, password);
      if (r.kind === 'ok') {
        if (m === 'email') return sendCode();
        if (marketing) void cloudState.setMarketing(true, m);
        return done(false);
      }
      if (r.kind === 'exists') {
        const v = await ask(t('You already have an account'), t('That sign-in belongs to another Pavurio account. Sign in to it? The pets on this phone will be replaced by the ones saved there.'), [
          { text: t('Cancel'), style: 'cancel', value: 'cancel' },
          { text: t('Sign in'), style: 'destructive', value: 'go' },
        ]);
        if (v !== 'go') return;
        const s = await cloudState.signIn(m, { email, password, replaceLocal: true });
        if (s.kind !== 'ok') return fail(s);
        if (s.needsCode) return sendCode();
        return done(!!s.restored);
      }
      fail(r);
    });

  const go = (m: Method) => (step === 'signin' ? signIn(m) : create(m));

  const verify = (value: string) =>
    busyDo(async () => {
      const r = await cloudState.verifyCode(value, marketing);
      if (r.kind !== 'ok') {
        setCode('');
        return fail(r);
      }
      await done(r.restored);
    });

  const sendReset = () =>
    busyDo(async () => {
      const r = await cloudState.sendResetCode(email, lang());
      if (r.kind !== 'sent') return fail(r);
      setCode('');
      setPassword('');
      setStep('reset');
      setWait(45);
      setNote(t('If an account uses {email}, a code is on its way.', { email: email.trim() }));
    });

  const reset = () =>
    busyDo(async () => {
      const r = await cloudState.resetPasswordWithCode(email, code, password);
      if (r.kind !== 'ok') return fail(r);
      if (!(await confirmReplace())) return setStep('signin');
      const s = await cloudState.signIn('email', { email, password, replaceLocal: true });
      if (s.kind !== 'ok') return fail(s);
      await done(!!s.restored);
    });

  const switchEmail = () =>
    busyDo(async () => {
      await cloudState.cancelEmail();
      setCode('');
      setStep(signinMode ? 'signin' : 'create');
    });

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
    if (r.kind === 'cancelled') return;
    if (r.kind === 'reauth' && user) {
      const m: Method = user.providers.includes('apple') ? 'apple' : user.providers.includes('google') ? 'google' : 'email';
      if (m === 'email' && !password) {
        setError(t('Enter your password, then tap Delete account again.'));
        setShowPw(true);
        return;
      }
      r = await cloudState.deleteAccount({ m, email: user.email ?? email, password });
    }
    if (r.kind !== 'ok') return fail(r);
    await reload();
    router.replace('/onboarding');
  };

  const providerLabel = user?.providers.includes('apple') ? 'Apple' : user?.providers.includes('google') ? 'Google' : user?.email ?? '';
  const spinner = busy || working;
  const title =
    step === 'code' ? t('Check your email') : step === 'forgot' || step === 'reset' ? t('Reset your password') : step === 'signin' ? t('Sign in to get your pets back') : saved ? t('Your pets are safe') : t('Save your account');
  const subtitle =
    step === 'code'
      ? t('We sent a 6-digit code to {email}.', { email: codeTo || user?.email || email })
      : step === 'forgot'
        ? t('Enter your email and we’ll send you a code.')
        : step === 'reset'
          ? t('Enter the code from the email and choose a new password.')
          : step === 'signin'
            ? t('Use the same Google, Apple or email you used before. Your care history comes right back.')
            : saved
              ? t('Signed in with {who}. Everything is backed up automatically.', { who: providerLabel })
              : t('Your care history is backed up while you use Pavurio. Save your account to get it back on a new phone.');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: W, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <CircleButton
              icon="back"
              label={t('Back')}
              onPress={() => {
                if (step === 'forgot' || step === 'reset') return setStep('signin');
                if (step === 'code') return void switchEmail();
                return router.canGoBack() ? router.back() : router.replace(signinMode ? '/onboarding' : '/');
              }}
            />
            <T weight="black" style={{ fontSize: 22 }} accessibilityRole="header">
              {signinMode ? t('Welcome back') : t('Account')}
            </T>
            <View style={{ width: 52 }} />
          </View>

          <View style={{ alignItems: 'center', marginTop: 18 }}>
            {ART.icons.shield ? <Image source={ART.icons.shield} style={{ width: 84, height: 84 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
            <T weight="black" style={styles.h1}>
              {title}
            </T>
            <T style={styles.sub}>{subtitle}</T>
          </View>

          {!enabled ? (
            <View style={[styles.card, softShadow, { marginTop: 22 }]}>
              <T style={{ color: colors.inkSoft, lineHeight: 21 }}>{t('Accounts and cloud backup are available in the iPhone and Android app.')}</T>
            </View>
          ) : step === 'code' ? (
            <View style={{ marginTop: 22, gap: 14 }}>
              <CodeInput value={code} onChange={(v) => {
                setCode(v);
                setError(null);
                if (v.length === 6) void verify(v);
              }} />
              <Pill label={t('CONFIRM')} onPress={() => void verify(code)} disabled={code.length !== 6} loading={spinner} testID="code-confirm" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Pressable accessibilityRole="button" disabled={wait > 0 || spinner} onPress={() => void busyDo(sendCode)} style={{ padding: 8 }}>
                  <T weight="xbold" style={{ color: wait > 0 ? colors.muted : colors.brand }}>
                    {wait > 0 ? t('Resend in {s}s', { s: wait }) : t('Resend the code')}
                  </T>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void switchEmail()} style={{ padding: 8 }}>
                  <T weight="xbold" style={{ color: colors.brand }}>
                    {t('Use another email')}
                  </T>
                </Pressable>
              </View>
              <T style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>{t('Can’t find it? Check your spam folder.')}</T>
            </View>
          ) : step === 'forgot' || step === 'reset' ? (
            <View style={[styles.card, softShadow, { marginTop: 22, gap: 12 }]}>
              <Field label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" editable={step === 'forgot'} />
              {step === 'reset' ? (
                <>
                  <Label>{t('Code')}</Label>
                  <CodeInput value={code} onChange={setCode} small />
                  <PasswordField value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} label={t('New password')} isNew />
                  <Pill label={t('SAVE NEW PASSWORD')} onPress={() => void reset()} disabled={code.length !== 6 || password.length < 6} loading={spinner} />
                  <Pressable accessibilityRole="button" disabled={wait > 0} onPress={() => void sendReset()} style={{ alignSelf: 'center', padding: 6 }}>
                    <T weight="xbold" style={{ color: wait > 0 ? colors.muted : colors.brand }}>
                      {wait > 0 ? t('Resend in {s}s', { s: wait }) : t('Resend the code')}
                    </T>
                  </Pressable>
                </>
              ) : (
                <Pill label={t('SEND CODE')} onPress={() => void sendReset()} disabled={!email.includes('@')} loading={spinner} />
              )}
            </View>
          ) : saved && !signinMode ? (
            <View style={[styles.card, softShadow, { marginTop: 22 }]}>
              <T weight="xbold" style={{ fontSize: 17 }}>
                {lastBackupAt ? t('Backed up {when}', { when: formatRelative(lastBackupAt) }) : t('Not backed up yet')}
              </T>
              <T style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{t('Pets, care log, routines, visits, weights and records. Photos stay on this phone.')}</T>
              <SoftPill label={busy ? t('Backing up…') : t('Back up now')} small style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => void cloudState.backupNow()} />
            </View>
          ) : (
            <View style={{ marginTop: 22, gap: 12 }}>
              <GoogleButton signin={step === 'signin'} onPress={() => void go('google')} />
              {appleAvailable ? <AppleButton signin={step === 'signin'} onPress={() => void go('apple')} /> : null}
              <View style={styles.or}>
                <View style={styles.orLine} />
                <T style={{ color: colors.muted, fontSize: 13 }}>{t('or with email')}</T>
                <View style={styles.orLine} />
              </View>
              <View style={[styles.card, softShadow, { gap: 12 }]}>
                <Field label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" testID="email-input" />
                <PasswordField value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} label={t('Password')} isNew={step === 'create'} />
                {step === 'create' ? <T style={{ color: colors.muted, fontSize: 12, marginTop: -6 }}>{t('At least 6 characters. We’ll email you a code to confirm it’s you.')}</T> : null}
                <Pill
                  label={step === 'signin' ? t('SIGN IN') : t('CREATE ACCOUNT')}
                  onPress={() => void go('email')}
                  disabled={!email.includes('@') || password.length < 6}
                  loading={spinner}
                  testID="email-submit"
                />
                {step === 'signin' ? (
                  <Pressable accessibilityRole="button" onPress={() => setStep('forgot')} style={{ alignSelf: 'center', padding: 6 }}>
                    <T weight="xbold" style={{ color: colors.brand }}>
                      {t('Forgot password?')}
                    </T>
                  </Pressable>
                ) : null}
              </View>
              {step === 'create' ? (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: marketing }} onPress={() => setMarketing((v) => !v)} style={styles.optin}>
                  <View style={[styles.box, marketing && { backgroundColor: colors.brand, borderColor: colors.brand }]}>{marketing ? <T style={{ color: '#fff', fontSize: 14 }}>✓</T> : null}</View>
                  <T style={{ flex: 1, color: colors.inkSoft, fontSize: 13, lineHeight: 18 }}>{t('Send me pet-care tips and Pavurio news by email (optional, unsubscribe anytime).')}</T>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => setStep(step === 'signin' ? 'create' : 'signin')} style={{ alignSelf: 'center', padding: 10 }}>
                <T weight="xbold" style={{ color: colors.brand }}>
                  {step === 'signin' ? t('New here? Create an account') : t('I already have an account')}
                </T>
              </Pressable>
            </View>
          )}

          {spinner && step !== 'code' ? <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} /> : null}
          {error ? <T style={styles.error}>{error}</T> : null}
          {note ? <T style={styles.note}>{note}</T> : null}

          {enabled && !signinMode && saved && step === 'create' ? (
            <>
              <Label style={styles.section}>{t('Account')}</Label>
              <View style={[styles.card, softShadow, { gap: 10 }]}>
                <SoftPill label={t('Sign out')} onPress={() => void signOut()} small style={{ alignSelf: 'flex-start' }} />
                <SoftPill label={t('Delete account')} onPress={() => void deleteAccount()} color={colors.danger} tint={colors.dangerSoft} small style={{ alignSelf: 'flex-start' }} />
                {showPw && user?.providers.includes('password') ? <PasswordField value={password} onChange={setPassword} show={false} onToggle={() => {}} label={t('Password')} /> : null}
              </View>
            </>
          ) : null}

          {enabled && !signinMode && step === 'create' ? (
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One field, six boxes: works with paste and with the "from Mail" code suggestion on iOS. */
function CodeInput({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const size = small ? 44 : 50;
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={t('Code')} style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.digit, { width: size, height: size + 8 }, value.length === i && styles.digitOn]}>
            <T weight="black" style={{ fontSize: small ? 22 : 26 }}>
              {value[i] ?? ''}
            </T>
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        style={styles.hiddenInput}
        accessibilityLabel={t('Code')}
        testID="code-input"
      />
    </Pressable>
  );
}

function PasswordField({ value, onChange, show, onToggle, label, isNew }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; label: string; isNew?: boolean }) {
  return (
    <View>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        testID="password-input"
      />
      <Pressable accessibilityRole="button" accessibilityLabel={show ? t('Hide password') : t('Show password')} onPress={onToggle} style={styles.eye} hitSlop={8}>
        <T weight="xbold" style={{ color: colors.brand, fontSize: 13 }}>
          {show ? t('Hide') : t('Show')}
        </T>
      </Pressable>
    </View>
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
      style={{ height: 56 }}
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
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  optin: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  digit: { borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  digitOn: { borderColor: colors.brand },
  hiddenInput: { position: 'absolute', opacity: 0.011, width: '100%', height: '100%' },
  eye: { position: 'absolute', right: 14, bottom: 16 },
});
