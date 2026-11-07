/**
 * Account + cloud backup state.
 *
 * - Everyone gets a hidden guest account on first launch, so their data is backed up from day one.
 * - "Save your account" links Apple / Google / email to that same account (same uid, same backup).
 * - The backup is a snapshot of the local database (src/data/snapshot.ts), uploaded a few seconds
 *   after changes and when the app goes to the background. The phone stays the source of truth.
 * - Photos and documents are files, not rows: they're uploaded to the owner's cloud storage before
 *   each snapshot (src/data/mediaBackup.ts), and the snapshot lists them. A restore brings them back
 *   and checks each one. "Backed up" is only shown when the files are in the cloud too.
 * - Signing in on a new phone restores the latest backup. If another phone backed up more recently
 *   and this one has nothing new (no unsaved data, no photos waiting to upload), it's pulled on launch.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { cloud } from '../cloud/firebase';
import type { AuthResult, CloudUser } from '../cloud/types';
import { fromChunks, restoreSnapshot } from '../data/snapshot';
import { runBackup } from '../data/backupRun';
import { getSetting, resetAll, setSetting } from '../data/repo';
import { adoptManifest, backupState, relinkFiles, restoreMissing } from '../data/mediaBackup';
import { documentsRoot, localFiles, remoteFiles } from '../native/backupFiles';
import { removeAllMemoryFiles } from '../native/media';
import { identify } from '../native/purchases';
import { useApp } from './AppState';

const BACKUP_DELAY = 15_000;

type Method = 'apple' | 'google' | 'email';
type Cloud = {
  enabled: boolean;
  user: CloudUser | null;
  appleAvailable: boolean;
  lastBackupAt: number | null;
  /** photos & documents: how many are still waiting to upload, and how many couldn't be restored yet */
  files: { referenced: number; pending: number; missing: number; lost: number };
  busy: boolean;
  crashReports: boolean;
  setCrashReports: (on: boolean) => Promise<void>;
  backupNow: () => Promise<boolean>;
  /** link a sign-in method to this (guest) account */
  save: (m: Method, email?: string, password?: string) => Promise<AuthResult>;
  /** switch to an existing account; `replaceLocal` restores its backup over this phone's data.
   *  An email account that isn't verified yet comes back with `needsCode`: nothing is restored or
   *  backed up until `verifyCode` succeeds. */
  signIn: (m: Method, opts: { email?: string; password?: string; replaceLocal: boolean }) => Promise<AuthResult & { restored?: boolean; needsCode?: boolean }>;
  sendCode: (lang: string) => Promise<Awaited<ReturnType<typeof cloud.sendCode>>>;
  /** confirms the 6-digit code; then restores (pending sign-in) or backs up (new account) */
  verifyCode: (code: string, marketing: boolean) => Promise<{ kind: 'ok'; restored: boolean } | { kind: 'error'; message: string; retryIn?: number }>;
  /** gave up on the code step: drop the unverified email from this account */
  cancelEmail: () => Promise<void>;
  sendResetCode: (email: string, lang: string) => Promise<Awaited<ReturnType<typeof cloud.sendResetCode>>>;
  resetPasswordWithCode: (email: string, code: string, password: string) => Promise<Awaited<ReturnType<typeof cloud.resetPasswordWithCode>>>;
  setMarketing: (optIn: boolean, source: string) => Promise<void>;
  /** does the signed-in account have a backup with pets? */
  cloudPets: () => Promise<number>;
  /** false (and nothing cleared) when this phone has data or photos that couldn't be backed up */
  signOut: (force?: boolean) => Promise<boolean>;
  deleteAccount: (reauth?: { m: Method; email?: string; password?: string }) => Promise<AuthResult>;
};

const Ctx = createContext<Cloud | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const { db, version, bump, pets, ready } = useApp();
  const enabled = cloud.enabled();
  const [user, setUser] = useState<CloudUser | null>(enabled ? cloud.current() : null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState({ referenced: 0, pending: 0, missing: 0, lost: 0 });
  const [crashReports, setCrashState] = useState(true);
  const quiet = useRef(true); // ignore the version change caused by our own restore / first load
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uidRef = useRef<string | null>(null);
  const pendingRestore = useRef(false); // signed in with an unverified email: restore after the code
  useEffect(() => {
    uidRef.current = user?.uid ?? null;
  }, [user?.uid]);

  // ---------------------------------------------------------------- backup / restore
  // files that didn't make it (no network, too many at once) are retried with a growing delay
  const retry = useRef<{ timer: ReturnType<typeof setTimeout> | null; n: number }>({ timer: null, n: 0 });
  const backupNow = useCallback(async (): Promise<boolean> => {
    const uid = uidRef.current;
    if (!enabled || !uid || paused.current) return false;
    const r = await runBackup(db, uid, {
      local: localFiles,
      remote: remoteFiles(uid),
      upload: (chunks, meta) => cloud.upload(uid, chunks, { ...meta, platform: Platform.OS }),
    });
    if (r.status === 'empty') return true; // nothing worth saving yet (mid-onboarding): nothing to lose either
    if (r.status === 'failed') {
      cloud.crash.record(r.error, 'backup:upload');
      return false;
    }
    if (r.fileError) cloud.crash.record(r.fileError, 'backup:files');
    setFiles((f) => ({ ...f, referenced: r.files.referenced, pending: r.files.pending, lost: r.files.lost }));
    setLastBackupAt(r.updatedAt);
    if (retry.current.timer) clearTimeout(retry.current.timer);
    if (r.complete) retry.current = { timer: null, n: 0 };
    else if (r.files.pending > 0 || r.fileError) {
      // uploads still waiting: 30 s, 1, 2, 4, 8, 16 min, then every 30 min for as long as the app is
      // open (and again whenever it comes back to the foreground). "Unsaved changes" stays set until
      // every file is up. Files missing everywhere (`lost`) aren't retried: they need the owner.
      const delay = Math.min(30 * 60_000, 30_000 * Math.pow(2, retry.current.n++));
      retry.current.timer = setTimeout(() => void backupNowRef.current?.(), delay);
    }
    return r.complete;
  }, [db, enabled]);
  const backupNowRef = useRef<(() => Promise<boolean>) | null>(null);
  useEffect(() => {
    backupNowRef.current = backupNow;
    return () => {
      if (retry.current.timer) clearTimeout(retry.current.timer);
    };
  }, [backupNow]);

  /** Downloads photos/documents this phone is missing (after a restore, or a failed earlier try). */
  const fetchFiles = useCallback(
    async (uid: string) => {
      try {
        const r = await restoreMissing(db, uid, localFiles, remoteFiles(uid));
        const st = await backupState(db, uid, localFiles);
        setFiles({ referenced: st.referenced, pending: st.pending, missing: r.missing.length, lost: st.lost });
        if (r.restored || r.rebuilt) bump();
      } catch (e) {
        cloud.crash.record(e, 'backup:files-restore');
      }
    },
    [db, bump],
  );

  const pull = useCallback(
    async (uid: string): Promise<boolean> => {
      const meta = await cloud.readMeta(uid);
      if (!meta || !meta.pets) return false;
      const snap = fromChunks(await cloud.download(uid, meta));
      quiet.current = true;
      await restoreSnapshot(db, snap);
      // the rows now point at the other phone's folder: point them here, then fetch the files
      await relinkFiles(db, documentsRoot());
      await adoptManifest(db, uid, snap.files);
      await setSetting(db, 'cloud.syncedAt', String(meta.updatedAt));
      await setSetting(db, 'cloud.dirty', '0');
      setLastBackupAt(meta.updatedAt);
      bump();
      await fetchFiles(uid);
      return true;
    },
    [db, bump, fetchFiles],
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
        const synced = Number((await getSetting(db, 'cloud.syncedAt')) ?? 0);
        const dirty = (await getSetting(db, 'cloud.dirty')) === '1';
        // photos that exist only on this phone count as unsaved: never replace them with an older backup
        const st = await backupState(db, uid, localFiles);
        setFiles((f) => ({ ...f, referenced: st.referenced, pending: st.pending, lost: st.lost }));
        if (meta && meta.updatedAt > synced && ((!dirty && st.pending === 0) || pets.length === 0)) await pull(uid);
        else await fetchFiles(uid);
        if (st.pending > 0 && !paused.current) void backupNow();
      } catch (e) {
        cloud.crash.record(e, 'backup:launch-check');
      }
    })();
  }, [enabled, user?.uid, ready, db, pull, pets.length, fetchFiles, backupNow]);

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

  // leaving the app: flush a pending backup; coming back (maybe back online after a long time
  // offline): try again straight away, with a fresh retry schedule
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'background' && s !== 'active') return;
      void getSetting(db, 'cloud.dirty').then((d) => {
        if (d !== '1') return;
        if (s === 'active') retry.current.n = 0;
        void backupNow();
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
          if (!r.user.verified) {
            // hold every sync until the email is confirmed
            pendingRestore.current = opts.replaceLocal;
            return { ...r, needsCode: true, restored: false };
          }
          let restored = false;
          if (opts.replaceLocal) restored = await pull(r.user.uid);
          paused.current = false;
          if (!restored) await backupNow(); // a new account, or keeping this phone's data
          return { ...r, restored };
        } finally {
          paused.current = pendingRestore.current || !!cloud.current()?.providers.includes('password') && !cloud.current()?.verified;
        }
      }),
    [run, auth, pull, backupNow],
  );

  const sendCode = useCallback((lang: string) => cloud.sendCode(lang), []);

  const verifyCode = useCallback(
    (code: string, marketing: boolean) =>
      run(async () => {
        // '' = the server already marked the email verified: only refresh and finish
        const r = code === '' ? ({ kind: 'ok' } as const) : await cloud.verifyCode(code, marketing);
        if (r.kind !== 'ok') return r;
        const u = await cloud.refresh();
        if (u) setUser(u);
        let restored = false;
        if (pendingRestore.current && u) {
          pendingRestore.current = false;
          restored = await pull(u.uid);
        }
        paused.current = false;
        if (!restored) await backupNow();
        return { kind: 'ok' as const, restored };
      }),
    [run, pull, backupNow],
  );

  const cancelEmail = useCallback(async () => {
    pendingRestore.current = false;
    const u = cloud.current();
    if (u && !u.verified && u.providers.length === 1 && u.providers[0] === 'password' && !u.anonymous) {
      // a fresh sign-in to an unverified account: leave it and go back to this phone's guest
      await cloud.signOut();
      await cloud.ensureGuest();
    } else {
      await cloud.unlinkEmail();
    }
    setUser(await cloud.refresh());
    paused.current = false;
  }, []);

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
    setFiles({ referenced: 0, pending: 0, missing: 0, lost: 0 });
    bump();
  }, [db, bump]);

  const signOut = useCallback(
    (force = false) =>
      run(async () => {
        const safe = await backupNow();
        // never clear a phone whose photos or data aren't in the cloud yet (offline, upload failed)
        if (!safe && !force) return false;
        paused.current = true;
        await cloud.signOut();
        await wipeLocal();
        removeAllMemoryFiles();
        checked.current = null;
        paused.current = false;
        await cloud.ensureGuest();
        return true;
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
          removeAllMemoryFiles();
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
      files,
      busy,
      crashReports,
      setCrashReports,
      backupNow: () => run(backupNow),
      save,
      signIn,
      cloudPets,
      signOut,
      deleteAccount,
      sendCode,
      verifyCode,
      cancelEmail,
      sendResetCode: (email, lang) => cloud.sendResetCode(email, lang),
      resetPasswordWithCode: (email, code, password) => cloud.resetPasswordWithCode(email, code, password),
      setMarketing: (optIn, source) => cloud.setMarketing(optIn, source),
    }),
    [enabled, user, appleAvailable, lastBackupAt, files, busy, crashReports, setCrashReports, run, backupNow, save, signIn, cloudPets, signOut, deleteAccount, sendCode, verifyCode, cancelEmail],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): Cloud {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud must be used inside CloudProvider');
  return c;
}
