/**
 * Local reminders. We keep a rolling window of scheduled notifications that mirrors the schedules,
 * marks and appointments in SQLite, and rebuild it from scratch on every relevant change and app
 * start (deterministic: nothing can drift or duplicate). Reminders are never a paid feature.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Db } from '../data/db';
import { listPets } from '../data/repo';
import { listAllSchedules, marksBetween, upcomingAppointments } from '../data/careRepo';
import { planReminders } from '../domain/schedule';
import { addDays, dayKeyOf } from '../domain/time';

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
      name: 'Care reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    }).catch(() => {});
  }
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
        plans.push(...planReminders(schedules.filter((s) => s.petId === pet.id), marks, names.get(pet.id) ?? 'your pet', now, 4, 40));
      }
      for (const a of await upcomingAppointments(db, null, now, 20)) {
        if (a.remindMinutes == null) continue;
        const at = a.at - a.remindMinutes * 60_000;
        if (at <= now) continue;
        plans.push({
          id: `pv:appt:${a.id}`,
          at,
          title: `${a.title} · ${names.get(a.petId) ?? ''}`.trim(),
          body: a.remindMinutes >= 1440 ? 'Tomorrow' : `In ${a.remindMinutes >= 60 ? `${Math.round(a.remindMinutes / 60)} h` : `${a.remindMinutes} min`}`,
          scheduleId: '',
          key: `appt:${a.id}`,
        });
      }
      plans.sort((x, y) => x.at - y.at);
      for (const p of plans.slice(0, 60)) {
        const type = p.key.startsWith('appt:') ? null : schedules.find((s) => s.id === p.scheduleId)?.type ?? null;
        const petId = p.key.startsWith('appt:') ? null : schedules.find((s) => s.id === p.scheduleId)?.petId ?? null;
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: { title: p.title, body: p.body, sound: true, data: { kind: p.key.startsWith('appt:') ? 'appointment' : 'care', type, petId, scheduleId: p.scheduleId, key: p.key } },
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

export type ReminderTap = { kind: 'care' | 'appointment'; type: string | null; petId: string | null; scheduleId: string; key: string };

/** Calls back when the user taps one of our notifications (also for the one that launched the app). */
export function onReminderTap(cb: (t: ReminderTap) => void): () => void {
  if (!SUPPORTED) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    const d = r?.notification.request.content.data as Partial<ReminderTap> | undefined;
    if (d && (d.kind === 'care' || d.kind === 'appointment')) cb(d as ReminderTap);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
