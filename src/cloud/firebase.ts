/**
 * Firebase on the phone (React Native Firebase): accounts, the cloud backup and Crashlytics.
 * Only active when the build was made with the Firebase files (see app.config.ts → extra.firebase);
 * otherwise every call is a no-op and the UI hides the cloud features.
 *
 * Data model (Firestore):  users/{uid}                      → BackupMeta of the latest backup
 *                          users/{uid}/backup/{gen}_{i}     → { gen, i, data } snapshot chunks
 * A new backup writes its chunks under a new `gen`, then flips the meta in the same batch, then
 * removes the previous generation: a cut-off upload never leaves a half-written backup behind.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { AuthResult, BackupMeta, CloudApi, CloudUser, Provider } from './types';
import { t } from '../i18n';

type AuthMod = typeof import('@react-native-firebase/auth');
type FsMod = typeof import('@react-native-firebase/firestore');
type CrashMod = typeof import('@react-native-firebase/crashlytics');

const ENABLED = Platform.OS !== 'web' && (Constants.expoConfig?.extra as { firebase?: boolean } | undefined)?.firebase === true;
const WEB_CLIENT_ID = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId;

// loaded lazily so a build without Firebase never touches the native modules
let A: AuthMod | null = null;
let F: FsMod | null = null;
let C: CrashMod | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const auth = () => (A ??= require('@react-native-firebase/auth') as AuthMod);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = () => (F ??= require('@react-native-firebase/firestore') as FsMod);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crashMod = () => (C ??= require('@react-native-firebase/crashlytics') as CrashMod);

function toUser(u: { uid: string; isAnonymous: boolean; email: string | null; providerData: { providerId: string }[] } | null): CloudUser | null {
  if (!u) return null;
  const ids: Record<string, Provider> = { 'apple.com': 'apple', 'google.com': 'google', password: 'password' };
  const providers = u.providerData.map((p) => ids[p.providerId]).filter((p): p is Provider => !!p);
  return { uid: u.uid, anonymous: u.isAnonymous, email: u.email, providers: u.isAnonymous ? ['anonymous'] : providers };
}

function code(e: unknown): string {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
}

function failure(e: unknown): AuthResult {
  const c = code(e);
  if (c === 'auth/credential-already-in-use' || c === 'auth/email-already-in-use' || c === 'auth/account-exists-with-different-credential') return { kind: 'exists' };
  if (c === 'auth/requires-recent-login') return { kind: 'reauth' };
  if (c === 'ERR_REQUEST_CANCELED' || c === 'ERR_CANCELED' || c === '-5' || c === 'SIGN_IN_CANCELLED' || c === '12501') return { kind: 'cancelled' };
  const known: Record<string, string> = {
    'auth/invalid-credential': t('That email and password don’t match an account.'),
    'auth/invalid-login-credentials': t('That email and password don’t match an account.'),
    'auth/wrong-password': t('That email and password don’t match an account.'),
    'auth/user-not-found': t('That email and password don’t match an account.'),
    'auth/invalid-email': t('That email address doesn’t look right.'),
    'auth/weak-password': t('Use at least 6 characters for the password.'),
    'auth/too-many-requests': t('Too many tries. Wait a minute and try again.'),
    'auth/network-request-failed': t('No connection. Check your internet and try again.'),
  };
  if (!known[c]) cloud.crash.record(e, `auth:${c || 'unknown'}`);
  const message = known[c] ?? t('Something went wrong. Please try again.');
  return { kind: 'error', message };
}

type Cred = ReturnType<AuthMod['GoogleAuthProvider']['credential']>;

/** save: attach to the current (guest) account · signin: switch to that account · reauth: confirm identity before deleting */
async function applyCredential(cred: Cred, mode: 'save' | 'signin' | 'reauth'): Promise<AuthResult> {
  const a = auth();
  const inst = a.getAuth();
  const me = inst.currentUser;
  try {
    if (mode === 'reauth') {
      if (!me) return { kind: 'error', message: t('Something went wrong. Please try again.') };
      await a.reauthenticateWithCredential(me, cred);
      return { kind: 'ok', user: toUser(inst.currentUser)! };
    }
    if (mode === 'save' && me?.isAnonymous) {
      const r = await a.linkWithCredential(me, cred);
      await r.user.reload?.();
      return { kind: 'ok', user: toUser(inst.currentUser ?? r.user)! };
    }
    const r = await a.signInWithCredential(inst, cred);
    return { kind: 'ok', user: toUser(r.user)! };
  } catch (e) {
    return failure(e);
  }
}

let googleReady = false;
function google() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const g = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!googleReady) {
    g.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    googleReady = true;
  }
  return g;
}

const userDoc = (uid: string) => fs().doc(fs().getFirestore(), 'users', uid);
const backupCol = (uid: string) => fs().collection(fs().getFirestore(), 'users', uid, 'backup');

export const cloud: CloudApi = {
  enabled: () => ENABLED,

  async appleAvailable() {
    if (!ENABLED || Platform.OS !== 'ios') return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    return Apple.isAvailableAsync();
  },

  current: () => (ENABLED ? toUser(auth().getAuth().currentUser) : null),

  onUser(cb) {
    if (!ENABLED) return () => {};
    return auth().onAuthStateChanged(auth().getAuth(), (u) => cb(toUser(u)));
  },

  async ensureGuest() {
    if (!ENABLED) return null;
    const inst = auth().getAuth();
    if (inst.currentUser) return toUser(inst.currentUser);
    try {
      const r = await auth().signInAnonymously(inst);
      return toUser(r.user);
    } catch (e) {
      cloud.crash.record(e, 'auth:anonymous');
      return null;
    }
  },

  async withApple(mode) {
    if (!ENABLED) return { kind: 'error', message: 'unavailable' };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    try {
      const raw = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
      const r = await Apple.signInAsync({
        requestedScopes: [Apple.AppleAuthenticationScope.EMAIL], // no name: Pavurio doesn't need it
        nonce: hashed,
      });
      if (!r.identityToken) return { kind: 'error', message: t('Something went wrong. Please try again.') };
      return applyCredential(auth().AppleAuthProvider.credential(r.identityToken, raw), mode);
    } catch (e) {
      return failure(e);
    }
  },

  async withGoogle(mode) {
    if (!ENABLED) return { kind: 'error', message: 'unavailable' };
    try {
      const g = google();
      if (Platform.OS === 'android') await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await g.GoogleSignin.signIn();
      if (r.type !== 'success') return { kind: 'cancelled' };
      if (!r.data.idToken) return { kind: 'error', message: t('Something went wrong. Please try again.') };
      return applyCredential(auth().GoogleAuthProvider.credential(r.data.idToken), mode);
    } catch (e) {
      if (code(e) === google().statusCodes.SIGN_IN_CANCELLED || code(e) === google().statusCodes.IN_PROGRESS) return { kind: 'cancelled' };
      return failure(e);
    }
  },

  async withEmail(mode, email, password) {
    if (!ENABLED) return { kind: 'error', message: 'unavailable' };
    const e = email.trim();
    const a = auth();
    const inst = a.getAuth();
    try {
      if (mode === 'signin') {
        const r = await a.signInWithEmailAndPassword(inst, e, password);
        return { kind: 'ok', user: toUser(r.user)! };
      }
      const cred = a.EmailAuthProvider.credential(e, password);
      if (mode === 'save' && !inst.currentUser) {
        const r = await a.createUserWithEmailAndPassword(inst, e, password);
        return { kind: 'ok', user: toUser(r.user)! };
      }
      return applyCredential(cred, mode);
    } catch (err) {
      return failure(err);
    }
  },

  async resetPassword(email) {
    if (!ENABLED) return;
    await auth().sendPasswordResetEmail(auth().getAuth(), email.trim());
  },

  async signOut() {
    if (!ENABLED) return;
    try {
      if (cloud.current()?.providers.includes('google')) await google().GoogleSignin.signOut();
    } catch {
      // not signed in with Google on this device
    }
    await auth().signOut(auth().getAuth());
  },

  async deleteAccount() {
    if (!ENABLED) return { kind: 'error', message: 'unavailable' };
    const inst = auth().getAuth();
    const u = inst.currentUser;
    if (!u) return { kind: 'error', message: t('Something went wrong. Please try again.') };
    try {
      const f = fs();
      const docs = await f.getDocs(backupCol(u.uid));
      const batch = f.writeBatch(f.getFirestore());
      docs.forEach((d) => batch.delete(d.ref));
      batch.delete(userDoc(u.uid));
      await batch.commit();
      await auth().deleteUser(u);
      return { kind: 'ok', user: toUser(u)! };
    } catch (e) {
      return failure(e);
    }
  },

  async readMeta(uid) {
    if (!ENABLED) return null;
    const snap = await fs().getDoc(userDoc(uid));
    const d = snap.data() as (BackupMeta & { gen?: string }) | undefined;
    return d && d.gen ? d : null;
  },

  async upload(uid, chunks, info) {
    const f = fs();
    const db = f.getFirestore();
    const gen = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const meta: BackupMeta = { ...info, gen, chunks: chunks.length };
    const batch = f.writeBatch(db);
    chunks.forEach((data, i) => batch.set(f.doc(db, 'users', uid, 'backup', `${gen}_${i}`), { gen, i, data }));
    batch.set(userDoc(uid), meta);
    await batch.commit();
    // drop older generations (best effort: a leftover is harmless and cleaned next time)
    try {
      const all = await f.getDocs(backupCol(uid));
      const old = f.writeBatch(db);
      let n = 0;
      all.forEach((d) => {
        if (!d.id.startsWith(`${gen}_`) && n < 450) {
          old.delete(d.ref);
          n++;
        }
      });
      if (n) await old.commit();
    } catch (e) {
      cloud.crash.record(e, 'backup:cleanup');
    }
    return meta;
  },

  async download(uid, meta) {
    const f = fs();
    const db = f.getFirestore();
    const out: string[] = [];
    for (let i = 0; i < meta.chunks; i++) {
      const s = await f.getDoc(f.doc(db, 'users', uid, 'backup', `${meta.gen}_${i}`));
      const d = s.data() as { data?: string } | undefined;
      if (typeof d?.data !== 'string') throw new Error(`backup chunk ${i} missing`);
      out.push(d.data);
    }
    return out;
  },

  crash: {
    setUser(uid) {
      if (!ENABLED) return;
      void crashMod().setUserId(crashMod().getCrashlytics(), uid ?? '');
    },
    record(e, context) {
      if (!ENABLED) return;
      const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e));
      const c = crashMod().getCrashlytics();
      if (context) crashMod().log(c, context);
      crashMod().recordError(c, err);
    },
    log(message) {
      if (ENABLED) crashMod().log(crashMod().getCrashlytics(), message);
    },
    setEnabled(on) {
      if (ENABLED) void crashMod().setCrashlyticsCollectionEnabled(crashMod().getCrashlytics(), on);
    },
  },
};

