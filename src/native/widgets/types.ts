/** Props the widget and Live Activity layouts receive (plain JSON: they cross into the widget process). */
export type TodayProps = {
  petName: string;
  title: string;
  body: string;
  progress: number;
  progressLabel: string;
  /** ms epoch to count down to, or 0 */
  countdownTo: number;
  /** app route opened on tap, e.g. "log/meal" */
  route: string;
  accent: string;
  tint: string;
  /** file URI of the illustration in the shared widgets folder ('' when unavailable) */
  art: string;
  /** Lock Screen circular: "50%" */
  short: string;
  /** Lock Screen inline line */
  inline: string;
};

export type PantryProps = {
  title: string;
  items: { name: string; label: string; level: number; color: string; urgent: boolean; kind: string }[];
  empty: string;
  art: string;
};

export type CareLiveProps = {
  key: string;
  type: string;
  title: string;
  body: string;
  at: number;
  art: string;
  emoji: string;
  accent: string;
  doneLabel: string;
  label: string;
};
