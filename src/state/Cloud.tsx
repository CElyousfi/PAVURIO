/**
 * Account + cloud backup state.
 *
 * - Everyone gets a hidden guest account on first launch, so their data is backed up from day one.
 * - "Save your account" links Apple / Google / email to that same account (same uid, same backup).
 * - The backup is a snapshot of the local database (src/data/snapshot.ts), uploaded a few seconds
 *   after changes and when the app goes to the background. The phone stays the source of truth.
 * - Signing in on a new phone restores the latest backup. If another phone backed up more recently
 *   and this one has nothing new, the newer backup is pulled on launch.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { cloud } from '../cloud/firebase';
import type { AuthResult, CloudUser } from '../cloud/types';
import { dumpSnapshot, fromChunks, petCount, restoreSnapshot, toChunks } from '../data/snapshot';
import { getSetting, resetAll, setSetting } from '../data/repo';
import { identify } from '../native/purchases';
import { useApp } from './AppState';

const BACKUP_DELAY = 15_000;

type Method = 'apple' | 'google' | 'email';
type Cloud = {
  enabled: boolean;
  user: CloudUser | null;
  appleAvailable: boolean;
  lastBackupAt: number | null;
  busy: boolean;
  crashReports: boolean;
  setCrashReports: (on: boolean) => Promise<void>;
  backupNow: () => Promise<boolean>;
  /** link a sign-in method to this (guest) account */
  save: (m: Method, email?: string, password?: string) => Promise<AuthResult>;
  /** switch to an existing account; `replaceLocal` restores its backup over this phone's data */
  signIn: (m: Method, opts: { email?: string; password?: string; replaceLocal: boolean }) => Promise<AuthResult & { restored?: boolean }>;
  /** does the signed-in account have a backup with pets? */
  cloudPets: () => Promise<number>;
  signOut: () => Promise<void>;
  deleteAccount: (reauth?: { m: Method; email?: string; password?: string }) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<void>;
};

const Ctx = createContext<Cloud | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const { db, version, bump, pets, ready } = useApp();
  const enabled = cloud.enabled();
  const [user, setUser] = useState<CloudUser | null>(enabled ? cloud.current() : null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [crashReports, setCrashState] = useState(true);
  const quiet = useRef(true); // ignore the version change caused by our own restore / first load
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uidRef = useRef<string | null>(null);
  useEffect(() => {
    uidRef.current = user?.uid ?? null;
  }, [user?.uid]);

  // ---------------------------------------------------------------- backup / restore
  const backupNow = useCallback(async (): Promise<boolean> => {
    const uid = uidRef.current;
    if (!enabled || !uid || paused.current) return false;
    try {
      const snap = await dumpSnapshot(db);
      if (!petCount(snap)) return false; // nothing worth saving yet (mid-onboarding)
      const meta = await cloud.upload(uid, toChunks(snap), { updatedAt: snap.createdAt, pets: petCount(snap), schema: snap.schema, platform: Platform.OS });
      await setSetting(db, 'cloud.syncedAt', String(meta.updatedAt));
      await setSetting(db, 'cloud.dirty', '0');
      setLastBackupAt(meta.updatedAt);
      return true;
    } catch (e) {
      cloud.crash.record(e, 'backup:upload');
      return false;
    }
  }, [db, enabled]);

  const pull = useCallback(
    async (uid: string): Promise<boolean> => {
      const meta = await cloud.readMeta(uid);
      if (!meta || !meta.pets) return false;
      const snap = fromChunks(await cloud.download(uid, meta));
      quiet.current = true;
      await restoreSnapshot(db, snap);
      await setSetting(db, 'cloud.syncedAt', String(meta.updatedAt));
      await setSetting(db, 'cloud.dirty', '0');
      setLastBackupAt(meta.updatedAt);
      bump();
      return true;
    },
    [db, bump],
  );

  // ---------------------------------------------------------------- account lifecycle
  useEffect(() => {
    if (!enabled) return;
    void cloud.appleAvailable().then(setAppleAvailable);
    void getSetting(db, 'cloud.crash').then((v) => {
      const on = v !== '0';
      setCrashState(on);
      cloud.crash.setEnabled(on);
    });
    void getSetting(db, 'cloud.syncedAt').then((v) => setLastBackupAt(v ? Number(v) : null));
    const off = cloud.onUser((u) => {
      setUser(u);
      cloud.crash.setUser(u?.uid ?? null);
      void identify(u?.uid ?? null);
    });
    void cloud.ensureGuest();
    return off;
  }, [db, enabled]);

  // on launch with an account: take a newer backup from another phone if this one has nothing new
  const checked = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.uid;
    if (!enabled || !uid || !ready || checked.current === uid) return;
    checked.current = uid;
    void (async () => {
      try {
        const meta = await cloud.readMeta(uid);
        if (!meta) return;
        const synced = Number((await getSetting(db, 'cloud.syncedAt')) ?? 0);
        const dirty = (await getSetting(db, 'cloud.dirty')) === '1';
        if (meta.updatedAt > synced && (!dirty || pets.length === 0)) await pull(uid);
      } catch (e) {
        cloud.crash.record(e, 'backup:launch-check');
      }
    })();
  }, [enabled, user?.uid, ready, db, pull, pets.length]);

  // every data change: mark dirty, back up shortly after
  useEffect(() => {
    if (!enabled || !user) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    void setSetting(db, 'cloud.dirty', '1');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void backupNow(), BACKUP_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [version, enabled, user, db, backupNow]);

  // leaving the app: flush a pending backup
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'background') return;
      void getSetting(db, 'cloud.dirty').then((d) => {
        if (d === '1') void backupNow();
      });
    });
    return () => sub.remove();
  }, [enabled, db, backupNow]);

  // ---------------------------------------------------------------- actions
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const auth = useCallback((m: Method, mode: 'save' | 'signin' | 'reauth', email = '', password = '') => {
    if (m === 'apple') return cloud.withApple(mode);
    if (m === 'google') return cloud.withGoogle(mode);
    return cloud.withEmail(mode, email, password);
  }, []);

  const save = useCallback(
    (m: Method, email?: string, password?: string) =>
      run(async () => {
        const r = await auth(m, 'save', email, password);
        if (r.kind === 'ok') {
          setUser(r.user);
          await backupNow();
        }
        return r;
      }),
    [run, auth, backupNow],
  );

  const signIn = useCallback(
    (m: Method, opts: { email?: string; password?: string; replaceLocal: boolean }) =>
      run(async () => {
        paused.current = true;
        try {
          const r = await auth(m, 'signin', opts.email, opts.password);
          if (r.kind !== 'ok') return r;
          setUser(r.user);
          uidRef.current = r.user.uid;
          checked.current = r.user.uid;
          let restored = false;
          if (opts.replaceLocal) restored = await pull(r.user.uid);
          paused.current = false;
          if (!restored) await backupNow(); // a new account, or keeping this phone's data
          return { ...r, restored };
        } finally {
          paused.current = false;
        }
      }),
    [run, auth, pull, backupNow],
  );

  const cloudPets = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return 0;
    try {
      return (await cloud.readMeta(uid))?.pets ?? 0;
    } catch {
      return 0;
    }
  }, []);

  const wipeLocal = useCallback(async () => {
    quiet.current = true;
    await resetAll(db);
    await setSetting(db, 'cloud.syncedAt', '0');
    await setSetting(db, 'cloud.dirty', '0');
    setLastBackupAt(null);
    bump();
  }, [db, bump]);

  const signOut = useCallback(
    () =>
      run(async () => {
        await backupNow();
        paused.current = true;
        await cloud.signOut();
        await wipeLocal();
        checked.current = null;
        paused.current = false;
        await cloud.ensureGuest();
      }),
    [run, backupNow, wipeLocal],
  );

  const deleteAccount = useCallback(
    (reauth?: { m: Method; email?: string; password?: string }) =>
      run(async () => {
        paused.current = true;
        try {
          if (reauth) {
            const r = await auth(reauth.m, 'reauth', reauth.email, reauth.password);
            if (r.kind !== 'ok') return r;
          }
          const r = await cloud.deleteAccount();
          if (r.kind !== 'ok') return r;
          await wipeLocal();
          checked.current = null;
          setUser(null);
          paused.current = false;
          await cloud.ensureGuest();
          return r;
        } finally {
          paused.current = false;
        }
      }),
    [run, auth, wipeLocal],
  );

  const setCrashReports = useCallback(
    async (on: boolean) => {
      await setSetting(db, 'cloud.crash', on ? '1' : '0');
      cloud.crash.setEnabled(on);
      setCrashState(on);
    },
    [db],
  );

  const value = useMemo<Cloud>(
    () => ({
      enabled,
      user,
      appleAvailable,
      lastBackupAt,
      busy,
      crashReports,
      setCrashReports,
      backupNow: () => run(backupNow),
      save,
      signIn,
      cloudPets,
      signOut,
      deleteAccount,
      resetPassword: (email) => cloud.resetPassword(email),
    }),
    [enabled, user, appleAvailable, lastBackupAt, busy, crashReports, setCrashReports, run, backupNow, save, signIn, cloudPets, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): Cloud {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud must be used inside CloudProvider');
  return c;
}
