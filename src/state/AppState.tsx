import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Db } from '../data/db';
import * as repo from '../data/repo';
import { Plan, Portions, computeProgress } from '../domain/progress';
import { dayRange, parseDayKey } from '../domain/time';
import { setHapticsEnabled } from '../native/haptics';
import { preloadSounds, setSoundsEnabled } from '../native/sound';
import type { CareType } from '../domain/care';
import { listSchedules, marksBetween } from '../data/careRepo';
import { Occurrence, Schedule, occurrencesForDay } from '../domain/schedule';
import { configureNotifications, syncReminders } from '../native/notifications';
import { followAll } from '../data/autoPlan';
import { recoverSetups } from '../data/setup';
import { cloud } from '../cloud/firebase';
import { initAnalytics, track } from '../native/analytics';
import { listenToWidgetActions, syncWidgets } from '../native/widgets';
import { registerBackgroundTasks } from '../native/backgroundTasks';
import { isPro } from '../native/purchases';
import { setMotionReduced } from '../ui/motion';
import { Lang, deviceLanguage, isLang, setLang } from '../i18n';
import { useDb } from './DbProvider';


export type WeightUnit = 'kg' | 'lb';
export type Settings = { haptics: boolean; sounds: boolean; reduceMotion: boolean; weightUnit: WeightUnit };

export type LoggedSignal = { eventId: string; type: CareType; nonce: number };

type Ctx = {
  db: Db;
  ready: boolean;
  /** loading the saved data failed before the app was ever ready: show a retry, never "no pets" */
  loadError: string | null;
  retryLoad: () => void;
  pet: repo.Pet | null;
  pets: repo.Pet[];
  plan: Plan;
  /** the owner's usual amount per care (the daily goal = times × portion) */
  portions: Portions;
  schedules: Schedule[];
  settings: Settings;
  /** effective: user setting OR OS reduce-motion */
  reduceMotion: boolean;
  /** increments on every data mutation so screens can reload */
  version: number;
  bump: () => void;
  reload: () => Promise<void>;
  setSetting: (k: 'haptics' | 'sounds' | 'reduceMotion', v: boolean) => Promise<void>;
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
  /** when care was last logged (ms); lets celebrations wait for the pet's reaction to finish */
  lastLoggedAt: number;
  /** start that wait now (call before `bump()` so no badge flashes in between) */
  markLogged: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useDb();
  const osReduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pet, setPet] = useState<repo.Pet | null>(null);
  const [pets, setPets] = useState<repo.Pet[]>([]);
  const [plan, setPlanState] = useState<Plan>({});
  const [portions, setPortions] = useState<Portions>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [settings, setSettings] = useState<Settings>({ haptics: true, sounds: true, reduceMotion: false, weightUnit: 'kg' });
  const [version, setVersion] = useState(0);
  const [logged, setLogged] = useState<LoggedSignal | null>(null);
  const [pro, setProState] = useState(false);
  const [language, setLanguageState] = useState<Lang>('en');

  const reload = useCallback(async () => {
    // a setup interrupted after the pet was created (app killed, error) is finished first, so the
    // pet never stays half configured (src/data/setup.ts)
    // (on every load: a failed attempt is retried, never skipped for the rest of the session)
    await recoverSetups(db).catch(() => 0);
    const p = await repo.getActivePet(db);
    setPet(p);
    setPets(await repo.listPets(db));
    setPlanState(p ? await repo.getPlan(db, p.id) : {});
    setPortions(p ? await repo.getPortions(db, p.id) : {});
    setSchedules(p ? await listSchedules(db, p.id) : []);
    const haptics = (await repo.getSetting(db, 'haptics')) !== '0';
    const sounds = (await repo.getSetting(db, 'sounds')) !== '0';
    const reduceMotion = (await repo.getSetting(db, 'reduceMotion')) === '1';
    const weightUnit = ((await repo.getSetting(db, 'weightUnit')) as WeightUnit) || 'kg';
    setSettings({ haptics, sounds, reduceMotion, weightUnit: weightUnit === 'lb' ? 'lb' : 'kg' });
    setHapticsEnabled(haptics);
    setSoundsEnabled(sounds);
    if (sounds) preloadSounds();
    setProState((await repo.getSetting(db, 'proCache')) === '1');
    await initAnalytics(db);
    if (!(await repo.getSetting(db, 'firstOpenAt'))) await repo.setSetting(db, 'firstOpenAt', String(Date.now()));
    const storedLang = await repo.getSetting(db, 'lang');
    const l: Lang = isLang(storedLang) ? storedLang : deviceLanguage();
    setLang(l);
    setLanguageState(l);
    setLoadError(null);
    setReady(true);
  }, [db]);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    reload().catch((e) => {
      console.error('[pavurio] failed to load state', e);
      cloud.crash.record(e instanceof Error ? e : new Error(String(e)), 'startup: load state');
      // A failed load is NOT "this person has no pets": before the first successful load we show a
      // retry instead of sending them to setup (which could look like their pets were lost).
      // After that, the last good state stays on screen.
      setLoadError(String((e as Error)?.message ?? e));
    });
  }, [reload, version, attempt]);
  const retryLoad = useCallback(() => setAttempt((a) => a + 1), []);

  // reminders mirror the database: rebuild after every change (debounced) and on start
  useEffect(() => {
    configureNotifications();
    const t = setTimeout(() => {
      // the automatic plan grows with the pet (age, new weigh-in, profile): a change reloads everything
      void followAll(db)
        .then((moved) => {
          if (!moved) return;
          track('plan_auto_updated');
          setVersion((v) => v + 1);
        })
        .catch(() => null);
      void syncReminders(db);
      // home-screen widgets and the care Live Activity follow the same data
      void syncWidgets(db);
    }, 600);
    return () => clearTimeout(t);
  }, [db, version]);
  // Done pressed on the care Live Activity
  useEffect(() => listenToWidgetActions(db, () => setVersion((v) => v + 1)), [db]);
  // …and every time the app comes back (permissions may have changed in Settings, days may have passed)
  useEffect(() => {
    void registerBackgroundTasks();
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void syncReminders(db);
        void followAll(db)
          .then((moved) => moved && setVersion((v) => v + 1))
          .catch(() => null);
      }
      // leaving the app: the widgets show the very latest state
      if (s === 'active' || s === 'background') void syncWidgets(db);
    });
    return () => sub.remove();
  }, [db]);

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
    async (k: 'haptics' | 'sounds' | 'reduceMotion', v: boolean) => {
      await repo.setSetting(db, k, v ? '1' : '0');
      setSettings((s) => ({ ...s, [k]: v }));
      if (k === 'haptics') setHapticsEnabled(v);
      if (k === 'sounds') {
        setSoundsEnabled(v);
        if (v) preloadSounds();
      }
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

  const [lastLoggedAt, setLastLoggedAt] = useState(0);
  const markLogged = useCallback(() => setLastLoggedAt(Date.now()), []);
  const signalLogged = useCallback((s: Omit<LoggedSignal, 'nonce'>) => {
    const nonce = Date.now();
    setLastLoggedAt(nonce);
    setLogged({ ...s, nonce });
  }, []);
  const clearLogged = useCallback(() => setLogged(null), []);

  const value = useMemo<Ctx>(
    () => ({
      db,
      ready,
      loadError,
      retryLoad,
      pet,
      pets,
      plan,
      portions,
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
      lastLoggedAt,
      markLogged,
    }),
    [db, ready, loadError, retryLoad, pet, pets, plan, portions, schedules, settings, osReduce, version, bump, reload, setSetting, setWeightUnit, switchPet, pro, setPro, language, setLanguage, logged, signalLogged, clearLogged, lastLoggedAt, markLogged],
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
  const { db, pet, plan, portions, version } = useApp();
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
  const progress = useMemo(() => computeProgress(plan, events, portions), [plan, events, portions]);
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
