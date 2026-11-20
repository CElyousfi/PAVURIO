import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Db } from '../data/db';
import { openAppDb } from '../native/appDb';

/**
 * Provides the app's database (src/native/appDb.ts). Replaces expo-sqlite's SQLiteProvider, which
 * opens a new connection on every remount: a retry during a slow start would then migrate twice at
 * once. Here every mount shares the same attempt, and the connection stays open for the app's life.
 */
const DbContext = createContext<Db | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let live = true;
    openAppDb().then(
      (d) => live && setDb(d),
      (e: unknown) => live && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      live = false;
    };
  }, []);
  // StartupBoundary catches this and offers a retry (which opens a fresh attempt)
  if (error) throw error;
  if (!db) return null;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb outside DbProvider');
  return db;
}
