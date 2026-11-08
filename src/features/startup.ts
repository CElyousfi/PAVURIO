/** Start-up bookkeeping, kept free of React Native so it can be tested on its own. */

/** How long the logo may stay before the "taking longer than usual" screen offers a retry. */
export const STALL_MS = 10_000;

export type StartupState = { started: boolean; stalled: boolean };
export type StartupEvent = { type: 'stall' } | { type: 'started' } | { type: 'retry' };

export const startupInitial: StartupState = { started: false, stalled: false };

/** React state (not a module variable), so the screen updates the moment the app is ready. */
export function startupReducer(s: StartupState, e: StartupEvent): StartupState {
  switch (e.type) {
    case 'stall':
      // the watchdog only matters while the app is not on screen yet
      return s.started || s.stalled ? s : { ...s, stalled: true };
    case 'started':
      // ready: the slow-start notice goes away by itself, no tap needed
      return s.started && !s.stalled ? s : { started: true, stalled: false };
    case 'retry':
      return s.stalled ? { ...s, stalled: false } : s;
  }
}

export const showSlowNotice = (s: StartupState) => s.stalled && !s.started;

/**
 * Runs `task` at most once at a time. While it runs, every caller shares the same attempt (a
 * retry during a slow start never opens the database a second time). A finished attempt is
 * remembered; a failed one is forgotten so the next call starts fresh.
 */
export function singleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | null = null;
  return () => {
    if (!current) {
      const attempt = task();
      current = attempt;
      attempt.catch(() => {
        if (current === attempt) current = null;
      });
    }
    return current;
  };
}

/** Opens and prepares the database. If preparing fails, the connection is closed before the
 * error is passed on, so a retry never leaves an earlier connection open behind it. */
export async function openPrepared<D extends { closeAsync(): Promise<void> }>(open: () => Promise<D>, prepare: (db: D) => Promise<void>): Promise<D> {
  const db = await open();
  try {
    await prepare(db);
  } catch (e) {
    await db.closeAsync().catch(() => {});
    throw e;
  }
  return db;
}
