/**
 * The walk on the lock screen: an iOS Live Activity, an Android ongoing notification with buttons.
 * Both carry the session's timestamps, so a Pause / Resume / Finish pressed on the lock screen (even with
 * the app closed) is recorded with its real time and applied to the walk when the app next runs.
 */
export type WalkLiveProps = {
  walkId: string;
  petName: string;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  status: 'active' | 'paused' | 'finished';
  /** when Finish was pressed on the lock screen */
  finishAt: number | null;
  /** translated strings (the lock-screen layout runs outside the app and can't translate) */
  title: string;
  /** e.g. "Started 3:12 PM" */
  since: string;
  walking: string;
  pausedText: string;
  finishedText: string;
  pause: string;
  resume: string;
  finish: string;
};

export type WalkLiveAction = 'pause' | 'resume' | 'finish';
