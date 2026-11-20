/**
 * When backups run. Separated from React so it can be tested with fake timers.
 *
 * - One run at a time: a request while a run is in progress is queued (once) and runs right after,
 *   so it includes the latest changes; several requests in the meantime share that one run.
 * - Retries: while something is waiting to upload, or the run failed (offline, storage down), it is
 *   tried again after 30 s, 1, 2, 4, 8, 16 min, then every 30 min. `resetBackoff` (app back in the
 *   foreground) starts that schedule again from 30 s.
 * - After `dispose` (signed out, app state torn down) nothing runs or gets scheduled any more, even
 *   if a run was still in progress.
 */

export type BackupOutcome =
  /** everything on this phone is in the cloud */
  | 'saved'
  /** nothing worth saving yet */
  | 'empty'
  /** snapshot saved, but files are still waiting to upload */
  | 'waiting'
  /** the run failed (offline, storage unavailable) */
  | 'failed'
  /** not signed in / paused: nothing to do */
  | 'skipped';

export const RETRY_MAX_MS = 30 * 60_000;
export const retryDelay = (n: number) => Math.min(RETRY_MAX_MS, 30_000 * Math.pow(2, n));

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>) };

export class BackupRunner {
  private running: Promise<BackupOutcome> | null = null;
  private queued: Promise<BackupOutcome> | null = null;
  private timer: unknown = null;
  private attempt = 0;
  private disposed = false;

  constructor(
    private readonly runOnce: () => Promise<BackupOutcome>,
    private readonly timers: Timers = realTimers,
  ) {}

  /** Back up now (or right after the run in progress). Resolves with that run's outcome. */
  request(): Promise<BackupOutcome> {
    if (this.disposed) return Promise.resolve('skipped');
    if (!this.running) return this.start();
    if (!this.queued) {
      this.queued = this.running.then(() => {
        this.queued = null;
        return this.disposed ? 'skipped' : this.start();
      });
    }
    return this.queued;
  }

  /** The app came back to the foreground: retry soon again rather than after the long delay. */
  resetBackoff() {
    this.attempt = 0;
  }

  /** Is a retry scheduled? (for tests and diagnostics) */
  get retryPending() {
    return this.timer != null;
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
  }

  private start(): Promise<BackupOutcome> {
    this.clearTimer();
    const run = this.runOnce()
      .catch((): BackupOutcome => 'failed')
      .then((outcome) => {
        this.running = null;
        this.afterRun(outcome);
        return outcome;
      });
    this.running = run;
    return run;
  }

  private afterRun(outcome: BackupOutcome) {
    if (this.disposed) return;
    if (outcome === 'saved' || outcome === 'empty') {
      this.attempt = 0;
      return;
    }
    if (outcome === 'skipped' || this.queued) return; // a queued run follows straight away
    const delay = retryDelay(this.attempt++);
    this.timer = this.timers.set(() => {
      this.timer = null;
      void this.request();
    }, delay);
  }

  private clearTimer() {
    if (this.timer != null) this.timers.clear(this.timer);
    this.timer = null;
  }
}
