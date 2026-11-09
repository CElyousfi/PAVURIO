/**
 * A tiny async lock: tasks run one after another, in the order they asked. expo-sqlite has one
 * connection and no nested or overlapping transactions, and several flows write the care plan
 * (setup, the reload that recovers a setup, plan updates as a pet grows, the plan screen). Two of
 * them at once could fail ("UNIQUE constraint failed") or create the same routine twice.
 * Not re-entrant: a locked task must not ask for the same lock again.
 */
export function createLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
    return next;
  };
}

/** Everything that writes routines, plan counts and portions (applyChoices). */
export const planLock = createLock();
/** Finishing a pet's setup (onboarding and the recovery on every load). */
export const setupLock = createLock();

/**
 * Ignores calls while one is still running (a second tap on "Start with this plan" before the
 * screen re-rendered). Unlike React state, the flag changes synchronously, so even two taps in the
 * same frame start the work once.
 */
export function dropWhileBusy() {
  let busy = false;
  return async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined;
    busy = true;
    try {
      return await task();
    } finally {
      busy = false;
    }
  };
}

/**
 * Waits for `task` at most `ms`. A task that fails still fails (its error is passed on); one that is
 * merely slow is left to finish in the background and the caller moves on (`ok: false`). Used where a
 * screen must never stay stuck on a spinner: the work is recoverable (setup is finished again on every
 * load), being stuck is not.
 */
export function withinTime<T>(task: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ ok: false }), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve({ ok: true, value });
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
