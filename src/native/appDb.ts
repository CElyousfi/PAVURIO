import { openDatabaseAsync } from 'expo-sqlite';
import { migrate } from '../data/migrations';
import { type Db, serialTransactions } from '../data/db';
import { openPrepared, singleFlight } from '../features/startup';

/**
 * The app's one database connection, shared by the app (DbProvider) and background tasks
 * (notification actions, reminder refresh): one open, one migration, one transaction queue.
 * Every caller shares the attempt in progress; a failed attempt closes its connection and the next
 * call starts fresh.
 */
export const openAppDb = singleFlight(() =>
  openPrepared(
    () => openDatabaseAsync('pavurio.db'),
    (db) => migrate(db as unknown as Db),
  ).then((db) => serialTransactions(db as unknown as Db)),
);
