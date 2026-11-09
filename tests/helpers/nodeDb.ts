import { DatabaseSync } from 'node:sqlite';
import type { BindValue, Db } from '../../src/data/db';

/** Test adapter: same Db surface as expo-sqlite, backed by Node's built-in SQLite. */
export function openNodeDb(path = ':memory:'): Db & { close(): void } {
  const raw = new DatabaseSync(path);
  return {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: BindValue[]) {
      const r = raw.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, params: BindValue[]) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: BindValue[]) {
      return ((raw.prepare(sql).get(...params) as T | undefined) ?? null) as T | null;
    },
    // exactly like expo-sqlite 58: BEGIN … COMMIT on the one connection, no nesting support.
    // A nested or overlapping call fails the way it does on a phone (SQLite: "cannot start a
    // transaction within a transaction"), and its ROLLBACK cancels the outer one.
    async withTransactionAsync(task: () => Promise<void>) {
      try {
        raw.exec('BEGIN');
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        try {
          raw.exec('ROLLBACK');
        } catch {
          // already rolled back
        }
        throw e;
      }
    },
    close() {
      raw.close();
    },
  };
}
