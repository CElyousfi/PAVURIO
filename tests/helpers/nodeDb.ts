import { DatabaseSync } from 'node:sqlite';
import type { BindValue, Db } from '../../src/data/db';

/** Test adapter: same Db surface as expo-sqlite, backed by Node's built-in SQLite. */
export function openNodeDb(path = ':memory:'): Db & { close(): void } {
  const raw = new DatabaseSync(path);
  let depth = 0;
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
    async withTransactionAsync(task: () => Promise<void>) {
      if (depth > 0) return task();
      depth++;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      raw.close();
    },
  };
}
