import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useReducedMotion } from 'react-native-reanimated';
import type { Db } from '../data/db';
import * as repo from '../data/repo';
import { Plan, computeProgress } from '../domain/progress';
import { dayRange, parseDayKey } from '../domain/time';
import { setHapticsEnabled } from '../native/haptics';
import type { CareType } from '../domain/care';

export type Settings = { haptics: boolean; reduceMotion: boolean };

export type LoggedSignal = { eventId: string; type: CareType; nonce: number };

type Ctx = {
  db: Db;
  ready: boolean;
  pet: repo.Pet | null;
  plan: Plan;
  settings: Settings;
  /** effective: user setting OR OS reduce-motion */
  reduceMotion: boolean;
  /** increments on every data mutation so screens can reload */
  version: number;
  bump: () => void;
  reload: () => Promise<void>;
  setSetting: (k: keyof Settings, v: boolean) => Promise<void>;
  /** set by the log card AFTER a record is persisted; Home consumes it to celebrate + offer undo */
  logged: LoggedSignal | null;
  signalLogged: (s: Omit<LoggedSignal, 'nonce'>) => void;
  clearLogged: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext() as unknown as Db;
  const osReduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [pet, setPet] = useState<repo.Pet | null>(null);
  const [plan, setPlanState] = useState<Plan>({});
  const [settings, setSettings] = useState<Settings>({ haptics: true, reduceMotion: false });
  const [version, setVersion] = useState(0);
  const [logged, setLogged] = useState<LoggedSignal | null>(null);

  const reload = useCallback(async () => {
    const p = await repo.getActivePet(db);
    setPet(p);
    setPlanState(p ? await repo.getPlan(db, p.id) : {});
    const haptics = (await repo.getSetting(db, 'haptics')) !== '0';
    const reduceMotion = (await repo.getSetting(db, 'reduceMotion')) === '1';
    setSettings({ haptics, reduceMotion });
    setHapticsEnabled(haptics);
    setReady(true);
  }, [db]);

  useEffect(() => {
    reload().catch((e) => {
      console.error('[pavurio] failed to load state', e);
      setReady(true);
    });
  }, [reload, version]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setSetting = useCallback(
    async (k: keyof Settings, v: boolean) => {
      await repo.setSetting(db, k, v ? '1' : '0');
      setSettings((s) => ({ ...s, [k]: v }));
      if (k === 'haptics') setHapticsEnabled(v);
    },
    [db],
  );

  const signalLogged = useCallback((s: Omit<LoggedSignal, 'nonce'>) => setLogged({ ...s, nonce: Date.now() }), []);
  const clearLogged = useCallback(() => setLogged(null), []);

  const value = useMemo<Ctx>(
    () => ({
      db,
      ready,
      pet,
      plan,
      settings,
      reduceMotion: settings.reduceMotion || osReduce,
      version,
      bump,
      reload,
      setSetting,
      logged,
      signalLogged,
      clearLogged,
    }),
    [db, ready, pet, plan, settings, osReduce, version, bump, reload, setSetting, logged, signalLogged, clearLogged],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

/** Loads one local day of care for the active pet and recomputes when data changes. */
export function useDay(dayKey: string) {
  const { db, pet, plan, version } = useApp();
  const [events, setEvents] = useState<repo.CareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    if (!pet) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const { start, end } = dayRange(parseDayKey(dayKey));
    repo
      .listEventsBetween(db, pet.id, start, end)
      .then((ev) => {
        if (alive) setEvents(ev);
      })
      .catch((e) => console.error('[pavurio] failed to load day', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [db, pet, dayKey, version]);
  const progress = useMemo(() => computeProgress(plan, events), [plan, events]);
  return { events, progress, loading };
}
