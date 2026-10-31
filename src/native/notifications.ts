/**
 * Local reminders. We keep a rolling window of scheduled notifications that mirrors the schedules,
 * marks and appointments in SQLite, and rebuild it from scratch on every relevant change and app
 * start (deterministic: nothing can drift or duplicate). Reminders are never a paid feature.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Db } from '../data/db';
import { getSetting, getPlan, listEventsBetween, listPets } from '../data/repo';
import { listAllSchedules, marksBetween, upcomingAppointments } from '../data/careRepo';
import { planReminders } from '../domain/schedule';
import { computeStreak, groupByDay } from '../domain/streak';
import { computeProgress } from '../domain/progress';
import { addDays, dayKeyOf, parseDayKey } from '../domain/time';
import { t } from '../i18n';

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const CHANNEL = 'care-reminders';
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
  }
  // action buttons on care reminders (long-press / expand the notification)
  Notifications.setNotificationCategoryAsync('care', [
    { identifier: 'done', buttonTitle: t('Done ✓'), options: { opensAppToForeground: true } },
    { identifier: 'snooze', buttonTitle: t('Snooze 30 min'), options: { opensAppToForeground: false } },
  ]).catch(() => {});
}

/** Friendly, care-specific wording; the routine's own name stays in the body. */
export function reminderCopy(type: string | null, routineTitle: string, petName: string): { title: string; body: string } {
  const body = t('{title} · tap Done when it’s done', { title: routineTitle });
  switch (type) {
    case 'meal':
      return { title: t('{name} is getting hungry 🍽️', { name: petName }), body };
    case 'walk':
      return { title: t('{name} is ready for a walk 🐾', { name: petName }), body };
    case 'water':
      return { title: t('Fresh water for {name} 💧', { name: petName }), body };
    case 'play':
      return { title: t('Playtime with {name}? 🎾', { name: petName }), body };
    case 'grooming':
      return { title: t('Brushing time for {name} ✨', { name: petName }), body };
    case 'litter':
      return { title: t('{name}’s litter box needs you 🧹', { name: petName }), body };
    case 'medication':
      return { title: t('{title} for {name} 💊', { title: routineTitle, name: petName }), body: t('Tap Done once it’s given.') };
    default:
      return { title: t('{title} for {name}', { title: routineTitle, name: petName }), body: t('Tap to log it when it’s done.') };
  }
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

export async function requestPermission(): Promise<PermissionState> {
  if (!SUPPORTED) return 'unsupported';
  const p = await Notifications.requestPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
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
      const plans = [];
      for (const pet of pets) {
        const name = names.get(pet.id) ?? t('your pet');
        for (const r of planReminders(schedules.filter((s) => s.petId === pet.id), marks, name, now, 4, 40)) {
          const sch = schedules.find((s) => s.id === r.scheduleId);
          plans.push({ ...r, ...reminderCopy(sch?.type ?? null, sch?.title ?? r.title, name) });
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
          const streak = computeStreak(plan, byDay, today);
          const prog = computeProgress(plan, byDay.get(today) ?? []);
          const name = names.get(pet.id) ?? t('your pet');
          for (let i = 0; i < 2; i++) {
            const day = addDays(today, i);
            const d = parseDayKey(day);
            const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
            if (at <= now) continue;
            if (i === 0 && prog.ratio >= 1) continue;
            const streakN = streak.current;
            plans.push({
              id: `pv:nudge:${pet.id}:${day}`,
              at,
              title: streakN >= 2 ? t('Keep your {n}-day streak 🔥', { n: streakN }) : t('{name}’s day isn’t finished yet', { name }),
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
      plans.sort((x, y) => x.at - y.at);
      for (const p of plans.slice(0, 60)) {
        const kind = p.key.startsWith('appt:') ? 'appointment' : p.key.startsWith('nudge:') ? 'nudge' : 'care';
        const sch = kind === 'care' ? schedules.find((s) => s.id === p.scheduleId) : undefined;
        const type = sch?.type ?? null;
        const petId = sch?.petId ?? (kind === 'nudge' ? p.key.slice(6) : null);
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: {
            title: p.title,
            body: p.body,
            sound: true,
            categoryIdentifier: kind === 'care' ? 'care' : undefined,
            data: { kind, type, petId, scheduleId: p.scheduleId, key: p.key },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL },
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

export type ReminderTap = { kind: 'care' | 'appointment' | 'nudge' | 'trial'; type: string | null; petId: string | null; scheduleId: string; key: string; action: 'open' | 'done' | 'snooze' };

/** Calls back when the user taps one of our notifications (also for the one that launched the app). */
const handled = new Set<string>();

export function onReminderTap(cb: (t: ReminderTap) => void): () => void {
  if (!SUPPORTED) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const d = r.notification.request.content.data as Partial<ReminderTap> | undefined;
    const action = r.actionIdentifier === 'done' ? 'done' : r.actionIdentifier === 'snooze' ? 'snooze' : 'open';
    if (d && (d.kind === 'care' || d.kind === 'appointment' || d.kind === 'nudge' || d.kind === 'trial')) {
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
