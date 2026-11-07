/**
 * Local reminders. We keep a rolling window of scheduled notifications that mirrors the schedules,
 * marks and appointments in SQLite, and rebuild it from scratch on every relevant change and app
 * start (deterministic: nothing can drift or duplicate). Reminders are never a paid feature.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { nextStageDate } from '../domain/lifeStage';
import type { Db } from '../data/db';
import { getSetting, getPlan, getPortions, listEventsBetween, listPets } from '../data/repo';
import { getAnyLiveWalk } from '../data/walkRepo';
import { LONG_WALK_MS } from '../domain/walks';
import { CARE, formatAmount, isCareType } from '../domain/care';
import { listAllSchedules, marksBetween, upcomingAppointments } from '../data/careRepo';
import { planReminders, type PlannedReminder } from '../domain/schedule';
import { groupByDay } from '../domain/streak';
import { computeProgress, portionOf } from '../domain/progress';
import { addDays, dayKeyOf, parseDayKey } from '../domain/time';
import { t, tn } from '../i18n';
import { loadPantry } from '../data/pantry';
import { restockReminders } from '../domain/supplies';

const DAY_MS = 86_400_000;

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const CHANNEL = 'care-reminders';
const MED_CHANNEL = 'medicine-reminders';
const NUDGE_CHANNEL = 'daily-nudges';
/** a care reminder not marked done gets one gentle follow-up this long after */
const FOLLOW_UP_MS = 30 * 60_000;
/** snoozing from the notification */
export const SNOOZE_MS = 15 * 60_000;
let configured = false;

export function configureNotifications() {
  if (!SUPPORTED || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('Care reminders'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    }).catch(() => {});
    Notifications.setNotificationChannelAsync(MED_CHANNEL, {
      name: t('Medicine reminders'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
    }).catch(() => {});
    Notifications.setNotificationChannelAsync(NUDGE_CHANNEL, {
      name: t('Daily nudges'),
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
    // the walk in progress (lock-screen controls): silent, no pop-up
    Notifications.setNotificationChannelAsync('walk-live', {
      name: t('Walk in progress'),
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});
  }
  // action buttons on care reminders (long-press / expand the notification)
  // Android handles Done in the background (src/native/backgroundTasks.ts); iOS opens the app to log it
  const doneOpens = Platform.OS !== 'android';
  Notifications.setNotificationCategoryAsync('care', [
    { identifier: 'done', buttonTitle: t('Done ✓'), options: { opensAppToForeground: doneOpens } },
    { identifier: 'snooze', buttonTitle: t('In 15 min'), options: { opensAppToForeground: false } },
  ]).catch(() => {});
  Notifications.setNotificationCategoryAsync('medication', [
    { identifier: 'done', buttonTitle: t('Given ✓'), options: { opensAppToForeground: doneOpens } },
    { identifier: 'snooze', buttonTitle: t('In 15 min'), options: { opensAppToForeground: false } },
  ]).catch(() => {});
  Notifications.setNotificationCategoryAsync('walk', [{ identifier: 'open', buttonTitle: t('Start the walk'), options: { opensAppToForeground: true } }]).catch(() => {});
}

/**
 * Friendly, care-specific wording; the routine's own name stays in the body, with the owner's usual
 * portion when there is one ("Dinner · 100 g") so the reminder says exactly what to do.
 */
export function reminderCopy(type: string | null, routineTitle: string, petName: string, portion?: string | null): { title: string; body: string } {
  const what = portion ? `${routineTitle} · ${portion}` : routineTitle;
  const body = t('{title} · tap Done when it’s done', { title: what });
  switch (type) {
    case 'meal':
      return { title: t('{name} is getting hungry 🍽️', { name: petName }), body };
    case 'walk':
      return { title: t('{name} is ready for a walk 🐾', { name: petName }), body: t('Tap to start the walk — the timer does the rest.') };
    case 'water':
      return { title: t('Fresh water for {name} 💧', { name: petName }), body };
    case 'play':
      return { title: t('Playtime with {name}? 🎾', { name: petName }), body };
    case 'grooming':
      return { title: t('Brushing time for {name} ✨', { name: petName }), body };
    case 'litter':
      return { title: t('{name}’s litter box needs you 🧹', { name: petName }), body };
    case 'medication':
      return {
        title: t('Medicine time for {name} 💊', { name: petName }),
        body: portion ? t('{title}: {dose}. Tap Given once it’s done.', { title: routineTitle, dose: portion }) : t('{title}. Tap Given once it’s done.', { title: routineTitle }),
      };
    default:
      return { title: t('{title} for {name}', { title: routineTitle, name: petName }), body: t('Tap to log it when it’s done.') };
  }
}

/** The gentle second reminder when a care still isn't marked done. */
export function followUpCopy(type: string | null, routineTitle: string, petName: string): { title: string; body: string } {
  if (type === 'medication') return { title: t('Did {name} get the medicine? 💊', { name: petName }), body: t('{title} is still open. Tap Given if it’s done.', { title: routineTitle }) };
  return { title: t('Still to do for {name}', { name: petName }), body: t('{title} is still open. Tap Done if it’s done.', { title: routineTitle }) };
}

/** One reminder before a free trial converts (outside the rebuilt `pv:` window). */
export async function scheduleTrialReminder(trialDays: number) {
  if (!SUPPORTED || trialDays < 3) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await Notifications.cancelScheduledNotificationAsync('trial-ending').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'trial-ending',
    content: { title: t('Your Pavurio Pro trial ends in 2 days'), body: t('Nothing to do if you’re enjoying it. You can cancel anytime in your store settings.'), data: { kind: 'trial' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: Date.now() + (trialDays - 2) * 86_400_000, channelId: CHANNEL },
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermission(): Promise<PermissionState> {
  if (!SUPPORTED) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Asks for notifications; with a database, schedules the reminders right away once allowed. */
export async function requestPermission(db?: Db): Promise<PermissionState> {
  if (!SUPPORTED) return 'unsupported';
  const p = await Notifications.requestPermissionsAsync();
  if (p.granted) {
    if (db) void syncReminders(db);
    return 'granted';
  }
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Android 12+: whether reminders can ring at the exact minute (otherwise the system may delay them a little). */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

/** Opens the system screen to allow on-time reminders; resolves when the owner comes back. */
export async function requestExactAlarms(db?: Db): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const r = await Notifications.requestExactAlarmPermissionsAsync();
    if (r.granted && db) void syncReminders(db);
    return r.granted;
  } catch {
    return false;
  }
}

/**
 * Clears notifications already in the shade that are no longer true: a care reminder whose occurrence
 * has been done (or skipped), a "time to order" for something that has been restocked.
 */
async function dismissObsolete(marks: { scheduleId: string; key: string; status: string }[], pantryOk: Set<string>) {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    const closed = new Set(marks.filter((m) => m.status === 'done' || m.status === 'skipped').map((m) => m.key));
    for (const n of shown) {
      const d = n.request.content.data as { kind?: string; key?: string } | undefined;
      const key = String(d?.key ?? '');
      const stale = (d?.kind === 'care' && closed.has(key)) || (d?.kind === 'supply' && pantryOk.has(key.split(':')[2] ?? ''));
      if (stale) await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  } catch {
    // not supported on this platform: nothing to clear
  }
}

let syncing: Promise<number> | null = null;
let again = false;

/** Rebuild all pending Pavurio reminders. Safe to call often; concurrent calls are coalesced. */
export function syncReminders(db: Db): Promise<number> {
  if (!SUPPORTED) return Promise.resolve(0);
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    let n = 0;
    try {
      const perm = await Notifications.getPermissionsAsync();
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending.filter((r) => String(r.identifier).startsWith('pv:')).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
      );
      if (!perm.granted) return 0;
      const now = Date.now();
      const pets = await listPets(db);
      const names = new Map(pets.map((p) => [p.id, p.name]));
      const schedules = await listAllSchedules(db);
      const today = dayKeyOf(new Date(now));
      const marks = await marksBetween(
        db,
        schedules.map((s) => s.id),
        today,
        addDays(today, 5),
      );
      let pantryOk = new Set<string>();
      const plans: (PlannedReminder & { followUp?: boolean })[] = [];
      const followUps = (await getSetting(db, 'followUps')) !== '0';
      for (const pet of pets) {
        const name = names.get(pet.id) ?? t('your pet');
        const portions = await getPortions(db, pet.id);
        for (const r of planReminders(schedules.filter((s) => s.petId === pet.id), marks, name, now, 5, 40)) {
          const sch = schedules.find((s) => s.id === r.scheduleId);
          const type = sch?.type ?? null;
          const portion = type && isCareType(type) && CARE[type].amount ? formatAmount(type, portionOf(type, portions)) : null;
          plans.push({ ...r, ...reminderCopy(type, sch?.title ?? r.title, name, portion) });
          // meals and medicine matter most: one gentle follow-up if it's still open, in the next day and a half
          if (followUps && (type === 'meal' || type === 'medication') && r.at + FOLLOW_UP_MS - now < 36 * 3600_000) {
            plans.push({ ...r, id: `pv:f:${r.key}`, at: r.at + FOLLOW_UP_MS, ...followUpCopy(type, sch?.title ?? r.title, name), followUp: true });
          }
        }
      }
      // a walk left running: one nudge after three hours, in case the owner forgot to finish
      const live = await getAnyLiveWalk(db).catch(() => null);
      if (live && live.status === 'active') {
        const at = live.startedAt + LONG_WALK_MS;
        if (at > now) {
          const name = names.get(live.petId) ?? t('your pet');
          plans.push({ id: `pv:walk:${live.id}`, at, title: t('Still walking with {name}?', { name }), body: t('Tap to finish the walk — you can correct the time after.'), scheduleId: '', key: `walk:${live.petId}` });
        }
      }
      // evening nudge: only while today's plan isn't coloured in; logging cancels it on the next sync
      if ((await getSetting(db, 'eveningNudge')) !== '0') {
        const [hh, mm] = ((await getSetting(db, 'eveningNudgeTime')) ?? '19:30').split(':').map(Number);
        for (const pet of pets) {
          const plan = await getPlan(db, pet.id);
          const planned = Object.values(plan).reduce<number>((a, n) => a + (n ?? 0), 0);
          if (!planned) continue;
          const from = parseDayKey(addDays(today, -60)).getTime();
          const events = await listEventsBetween(db, pet.id, from, now + 60_000);
          const byDay = groupByDay(events);
          const prog = computeProgress(plan, byDay.get(today) ?? []);
          const name = names.get(pet.id) ?? t('your pet');
          for (let i = 0; i < 2; i++) {
            const day = addDays(today, i);
            const d = parseDayKey(day);
            const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
            if (at <= now) continue;
            if (i === 0 && prog.ratio >= 1) continue;
            plans.push({
              id: `pv:nudge:${pet.id}:${day}`,
              at,
              title: t('{name}’s day isn’t finished yet', { name }),
              body:
                i === 0 && prog.planned > 0
                  ? t('{done} of {planned} cares logged — colour {name} in before bedtime.', { done: prog.done, planned: prog.planned, name })
                  : t('A few cares left to colour {name} in today.', { name }),
              scheduleId: '',
              key: `nudge:${pet.id}`,
            });
          }
        }
      }
      // pantry: the buy-by day (10:00), a last call on the run-out day (9:00), then every 3 days while
      // it's still not restocked. Household items name every pet that uses them.
      try {
        const { forecasts } = await loadPantry(db, now);
        pantryOk = new Set(forecasts.filter((f) => f.status !== 'buy' && f.status !== 'out').map((f) => f.supply.id));
        for (const f of (await getSetting(db, 'pantryReminders')) === '0' ? [] : forecasts) {
          const who = f.petIds.map((id) => names.get(id)).filter(Boolean).join(' & ') || t('your pet');
          const key = `supply:${f.supply.petId}:${f.supply.id}`;
          for (const r of restockReminders(f, now)) {
            if (r.kind === 'buy')
              plans.push({ id: r.id, at: r.at, title: t('Time to order {item} 🛒', { item: f.supply.name }), body: t('{name} has about {n} left. Order today and it arrives before it runs out.', { name: who, n: tn(Math.max(1, Math.round((f.runOutAt! - r.at) / DAY_MS)), '{n} day', '{n} days') }), scheduleId: '', key });
            else if (r.kind === 'last')
              plans.push({ id: r.id, at: r.at, title: t('{item} runs out today', { item: f.supply.name }), body: t('Bought it already? Tap to add it to {name}’s shelf.', { name: who }), scheduleId: '', key });
            else
              plans.push({ id: r.id, at: r.at, title: t('Still need {item}?', { item: f.supply.name }), body: t('Pavurio thinks {name} is out. Bought some? One tap restocks it.', { name: who }), scheduleId: '', key });
          }
        }
      } catch (e) {
        console.warn('[pavurio] supply reminders', e);
      }
      // a pet reaching a new life stage (6 months, 1 year, senior…): its routine advice changes that day
      for (const pet of pets) {
        if (!pet.birthDate) continue;
        const next = nextStageDate(pet.species, pet.birthDate, new Date(now));
        if (!next) continue;
        const [y, m, d] = next.date.split('-').map(Number);
        const at = new Date(y, m - 1, d, 10, 0).getTime();
        if (at <= now) continue;
        plans.push({
          id: `pv:guide:${pet.id}`,
          at,
          title: t('{name} is growing up! 🎉', { name: pet.name }),
          body: t('New stage, new routine: see what changes for meals, walks and care.'),
          scheduleId: '',
          key: `nudge:${pet.id}:guide`,
        });
      }
      for (const a of await upcomingAppointments(db, null, now, 20)) {
        if (a.remindMinutes == null) continue;
        const at = a.at - a.remindMinutes * 60_000;
        if (at <= now) continue;
        plans.push({
          id: `pv:appt:${a.id}`,
          at,
          title: `${a.title} · ${names.get(a.petId) ?? ''}`.trim(),
          body:
            a.remindMinutes >= 1440
              ? t('Tomorrow')
              : a.remindMinutes >= 60
                ? t('In {n} h', { n: Math.round(a.remindMinutes / 60) })
                : t('In {n} min', { n: a.remindMinutes }),
          scheduleId: '',
          key: `appt:${a.id}`,
        });
      }
      await dismissObsolete(marks, pantryOk);
      plans.sort((x, y) => x.at - y.at);
      // medicine is time-critical: on Android, alarm-clock delivery when the owner allowed exact alarms
      const exact = Platform.OS === 'android' ? (await Notifications.getExactAlarmPermissionsAsync().catch(() => null))?.granted === true : false;
      for (const p of plans.slice(0, 60)) {
        const kind = p.key.startsWith('appt:') ? 'appointment' : p.key.startsWith('nudge:') ? 'nudge' : p.key.startsWith('walk:') ? 'walk' : p.key.startsWith('supply:') ? 'supply' : 'care';
        const sch = kind === 'care' ? schedules.find((s) => s.id === p.scheduleId) : undefined;
        const type = sch?.type ?? (kind === 'walk' ? 'walk' : null);
        const petId = sch?.petId ?? (kind === 'nudge' || kind === 'walk' || kind === 'supply' ? p.key.split(':')[1] : null);
        const med = type === 'medication';
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: {
            title: p.title,
            body: p.body,
            sound: true,
            categoryIdentifier: kind === 'care' ? (med ? 'medication' : type === 'walk' ? 'walk' : 'care') : undefined,
            // one stack per pet in the notification shade
            threadIdentifier: petId ? `pet:${petId}` : undefined,
            interruptionLevel: med ? 'timeSensitive' : undefined,
            data: { kind: kind === 'walk' ? 'care' : kind, type, petId, scheduleId: p.scheduleId, key: p.key },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: p.at,
            channelId: med ? MED_CHANNEL : kind === 'nudge' ? NUDGE_CHANNEL : CHANNEL,
            delivery: med && exact && !p.followUp ? 'alarmClock' : undefined,
          },
        });
        n++;
      }
    } catch (e) {
      console.warn('[pavurio] reminder sync failed', e);
    } finally {
      syncing = null;
      if (again) {
        again = false;
        void syncReminders(db);
      }
    }
    return n;
  })();
  return syncing;
}

export type ReminderTap = { kind: 'care' | 'appointment' | 'nudge' | 'trial' | 'supply'; type: string | null; petId: string | null; scheduleId: string; key: string; action: 'open' | 'done' | 'snooze' };

/** Calls back when the user taps one of our notifications (also for the one that launched the app). */
const handled = new Set<string>();

export function onReminderTap(cb: (t: ReminderTap) => void): () => void {
  if (!SUPPORTED) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const d = r.notification.request.content.data as Partial<ReminderTap> | undefined;
    const action = r.actionIdentifier === 'done' ? 'done' : r.actionIdentifier === 'snooze' ? 'snooze' : 'open';
    if (d && (d.kind === 'care' || d.kind === 'appointment' || d.kind === 'nudge' || d.kind === 'trial' || d.kind === 'supply')) {
      // a launch response is delivered again by getLastNotificationResponseAsync: handle each once
      const id = `${r.notification.request.identifier}:${r.actionIdentifier}:${r.notification.date}`;
      if (handled.has(id)) return;
      handled.add(id);
      cb({ ...(d as ReminderTap), action });
    }
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
