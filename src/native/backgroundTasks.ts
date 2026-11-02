/**
 * Work Pavurio does while it isn't open:
 * - every few hours (as the OS allows), rebuild the reminder window so reminders never run out, even
 *   when the app isn't opened for days, and drop the ones for care already logged;
 * - on Android, handle the reminder buttons ("Done ✓", "In 15 min") right from the notification, without
 *   opening the app.
 * Both open their own database connection (the app may not be running) and are idempotent.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import type { Db } from '../data/db';
import { migrate } from '../data/migrations';
import { getPet, getPortions, getSetting, logCare } from '../data/repo';
import { listSchedules, setMark } from '../data/careRepo';
import { confirmOccurrence } from '../features/careLink';
import { CARE, careAllowedFor, isCareType } from '../domain/care';
import { portionOf } from '../domain/progress';
import { deviceLanguage, isLang, setLang } from '../i18n';
import { SNOOZE_MS, syncReminders } from './notifications';

export const REFRESH_TASK = 'pavurio-refresh-reminders';
export const ACTION_TASK = 'pavurio-notification-actions';
const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

let dbPromise: Promise<Db> | null = null;
function openDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const db = (await SQLite.openDatabaseAsync('pavurio.db')) as unknown as Db;
    await migrate(db);
    const l = await getSetting(db, 'lang');
    setLang(isLang(l) ? l : deviceLanguage());
    return db;
  })();
  return dbPromise;
}

/** "Done" / "In 15 min" pressed on a care reminder. Same keys as in-app handling, so it never double-logs. */
export async function handleReminderAction(db: Db, action: string, d: { kind?: string; type?: string | null; petId?: string | null; scheduleId?: string; key?: string }): Promise<boolean> {
  if (d.kind !== 'care' || !d.scheduleId || !d.key) return false;
  if (action === 'snooze') {
    await setMark(db, d.scheduleId, d.key, 'snoozed', { snoozeUntil: Date.now() + SNOOZE_MS });
    return true;
  }
  if (action === 'done') {
    const pet = d.petId ? await getPet(db, d.petId) : null;
    if (pet && d.type && isCareType(d.type) && careAllowedFor(pet.species, d.type)) {
      const amount = CARE[d.type].amount ? portionOf(d.type, await getPortions(db, pet.id)) : undefined;
      const saved = await logCare(db, { petId: pet.id, type: d.type, occurredAt: Date.now(), amount, mutationId: `notif:${d.key}` });
      await confirmOccurrence(db, await listSchedules(db, pet.id), saved, { scheduleId: d.scheduleId, key: d.key });
    } else {
      await setMark(db, d.scheduleId, d.key, 'done');
    }
    return true;
  }
  return false;
}

if (NATIVE) {
  TaskManager.defineTask(REFRESH_TASK, async () => {
    try {
      await syncReminders(await openDb());
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(ACTION_TASK, async ({ data, error }) => {
    if (error || !data || !('actionIdentifier' in data)) return;
    const r = data as Notifications.NotificationResponse;
    const d = r.notification.request.content.data as Parameters<typeof handleReminderAction>[2];
    try {
      const db = await openDb();
      if (await handleReminderAction(db, r.actionIdentifier, d)) {
        await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
        await syncReminders(db);
      }
    } catch (e) {
      console.warn('[pavurio] reminder action failed', e);
    }
  });
}

/** Registers both tasks (safe to call on every start). */
export async function registerBackgroundTasks(): Promise<void> {
  if (!NATIVE) return;
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(REFRESH_TASK))) await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 });
  } catch (e) {
    console.warn('[pavurio] background refresh unavailable', e);
  }
  try {
    await Notifications.registerTaskAsync(ACTION_TASK);
  } catch (e) {
    console.warn('[pavurio] notification task unavailable', e);
  }
}
