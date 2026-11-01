import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useReducedMotion } from 'react-native-reanimated';
import type { Db } from '../data/db';
import * as repo from '../data/repo';
import { Plan, computeProgress } from '../domain/progress';
import { dayRange, parseDayKey } from '../domain/time';
import { setHapticsEnabled } from '../native/haptics';
import type { CareType } from '../domain/care';
import { listSchedules, marksBetween } from '../data/careRepo';
import { Occurrence, Schedule, occurrencesForDay } from '../domain/schedule';
import { configureNotifications, syncReminders } from '../native/notifications';
import { isPro } from '../native/purchases';
import { setMotionReduced } from '../ui/motion';
import { Lang, deviceLanguage, isLang, setLang } from '../i18n';

export type WeightUnit = 'kg' | 'lb';
export type Settings = { haptics: boolean; reduceMotion: boolean; weightUnit: WeightUnit };

export type LoggedSignal = { eventId: string; type: CareType; nonce: number };

type Ctx = {
  db: Db;
  ready: boolean;
  pet: repo.Pet | null;
  pets: repo.Pet[];
  plan: Plan;
  schedules: Schedule[];
  settings: Settings;
  /** effective: user setting OR OS reduce-motion */
  reduceMotion: boolean;
  /** increments on every data mutation so screens can reload */
  version: number;
  bump: () => void;
  reload: () => Promise<void>;
  setSetting: (k: 'haptics' | 'reduceMotion', v: boolean) => Promise<void>;
  setWeightUnit: (u: WeightUnit) => Promise<void>;
  switchPet: (id: string) => Promise<void>;
  /** Pavurio Pro entitlement (cached locally, refreshed from the store when configured) */
  pro: boolean;
  setPro: (v: boolean) => Promise<void>;
  language: Lang;
  setLanguage: (l: Lang) => Promise<void>;
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
  const [pets, setPets] = useState<repo.Pet[]>([]);
  const [plan, setPlanState] = useState<Plan>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [settings, setSettings] = useState<Settings>({ haptics: true, reduceMotion: false, weightUnit: 'kg' });
  const [version, setVersion] = useState(0);
  const [logged, setLogged] = useState<LoggedSignal | null>(null);
  const [pro, setProState] = useState(false);
  const [language, setLanguageState] = useState<Lang>('en');

  const reload = useCallback(async () => {
    const p = await repo.getActivePet(db);
    setPet(p);
    setPets(await repo.listPets(db));
    setPlanState(p ? await repo.getPlan(db, p.id) : {});
    setSchedules(p ? await listSchedules(db, p.id) : []);
    const haptics = (await repo.getSetting(db, 'haptics')) !== '0';
    const reduceMotion = (await repo.getSetting(db, 'reduceMotion')) === '1';
    const weightUnit = ((await repo.getSetting(db, 'weightUnit')) as WeightUnit) || 'kg';
    setSettings({ haptics, reduceMotion, weightUnit: weightUnit === 'lb' ? 'lb' : 'kg' });
    setHapticsEnabled(haptics);
    setProState((await repo.getSetting(db, 'proCache')) === '1');
    if (!(await repo.getSetting(db, 'firstOpenAt'))) await repo.setSetting(db, 'firstOpenAt', String(Date.now()));
    const storedLang = await repo.getSetting(db, 'lang');
    const l: Lang = isLang(storedLang) ? storedLang : deviceLanguage();
    setLang(l);
    setLanguageState(l);
    setReady(true);
  }, [db]);

  useEffect(() => {
    reload().catch((e) => {
      console.error('[pavurio] failed to load state', e);
      setReady(true);
    });
  }, [reload, version]);

  // reminders mirror the database: rebuild after every change (debounced) and on start
  useEffect(() => {
    configureNotifications();
    const t = setTimeout(() => void syncReminders(db), 600);
    return () => clearTimeout(t);
  }, [db, version]);

  const setPro = useCallback(
    async (v: boolean) => {
      await repo.setSetting(db, 'proCache', v ? '1' : '0');
      setProState(v);
    },
    [db],
  );
  // the store is the source of truth when it's reachable; otherwise keep the cached answer
  useEffect(() => {
    void isPro().then((v) => {
      if (v != null) void setPro(v);
    });
  }, [setPro]);

  const setLanguage = useCallback(
    async (l: Lang) => {
      await repo.setSetting(db, 'lang', l);
      setLang(l);
      setLanguageState(l);
    },
    [db],
  );

  useEffect(() => {
    setMotionReduced(settings.reduceMotion || !!osReduce);
  }, [settings.reduceMotion, osReduce]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setSetting = useCallback(
    async (k: 'haptics' | 'reduceMotion', v: boolean) => {
      await repo.setSetting(db, k, v ? '1' : '0');
      setSettings((s) => ({ ...s, [k]: v }));
      if (k === 'haptics') setHapticsEnabled(v);
    },
    [db],
  );
  const setWeightUnit = useCallback(
    async (u: WeightUnit) => {
      await repo.setSetting(db, 'weightUnit', u);
      setSettings((s) => ({ ...s, weightUnit: u }));
    },
    [db],
  );
  const switchPet = useCallback(
    async (id: string) => {
      await repo.setActivePet(db, id);
      await reload();
    },
    [db, reload],
  );

  const signalLogged = useCallback((s: Omit<LoggedSignal, 'nonce'>) => setLogged({ ...s, nonce: Date.now() }), []);
  const clearLogged = useCallback(() => setLogged(null), []);

  const value = useMemo<Ctx>(
    () => ({
      db,
      ready,
      pet,
      pets,
      plan,
      schedules,
      settings,
      reduceMotion: settings.reduceMotion || osReduce,
      version,
      bump,
      reload,
      setSetting,
      setWeightUnit,
      switchPet,
      pro,
      setPro,
      language,
      setLanguage,
      logged,
      signalLogged,
      clearLogged,
    }),
    [db, ready, pet, pets, plan, schedules, settings, osReduce, version, bump, reload, setSetting, setWeightUnit, switchPet, pro, setPro, language, setLanguage, logged, signalLogged, clearLogged],
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

/** Scheduled occurrences for the active pet on one local day, with their live status. */
export function useOccurrences(dayKey: string) {
  const { db, schedules, version } = useApp();
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [tick, setTick] = useState(0);
  // statuses depend on the clock (upcoming → due → overdue): refresh every minute
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let alive = true;
    marksBetween(
      db,
      schedules.map((s) => s.id),
      dayKey,
      dayKey,
    )
      .then((marks) => alive && setOcc(occurrencesForDay(schedules, marks, dayKey)))
      .catch((e) => console.error('[pavurio] failed to load occurrences', e));
    return () => {
      alive = false;
    };
  }, [db, schedules, dayKey, version, tick]);
  return occ;
}
