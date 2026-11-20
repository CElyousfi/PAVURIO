/**
 * Minimal database surface used by repositories. `expo-sqlite`'s SQLiteDatabase satisfies it
 * structurally on device/web; tests provide a node:sqlite adapter (tests/helpers/nodeDb.ts).
 */
export type BindValue = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: BindValue[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params: BindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: BindValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * The app's database with transactions queued: expo-sqlite has one connection and a second
 * BEGIN while one is open fails ("cannot start a transaction within a transaction") and its
 * ROLLBACK cancels the first one. Here a transaction waits for the previous one to finish, however
 * long it takes (a large restore can take many seconds; giving up on the wait would start exactly
 * that colliding BEGIN).
 *
 * Never call withTransactionAsync inside a transaction's task: it would wait for itself. No code
 * does, and the tests run on a driver that rejects nesting like a phone does, so it can't creep in.
 */
export function serialTransactions(db: Db): Db {
  let tail: Promise<void> = Promise.resolve();
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    withTransactionAsync(task) {
      const run = tail.then(() => db.withTransactionAsync(task));
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
