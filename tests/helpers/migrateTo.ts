import type { Db } from '../../src/data/db';
import { MIGRATIONS } from '../../src/data/migrations';

/** Applies migrations up to `version` only (to test upgrades from an older schema). */
export async function migrateTo(db: Db, version: number) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  for (let v = 0; v < version; v++) {
    await db.execAsync(MIGRATIONS[v]);
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
}
