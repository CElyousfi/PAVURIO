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
