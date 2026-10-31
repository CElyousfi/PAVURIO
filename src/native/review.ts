/** Ask for an App Store / Play rating at a happy moment, at most every 60 days and never on the first days. */
import * as StoreReview from 'expo-store-review';
import type { Db } from '../data/db';
import { getSetting, setSetting } from '../data/repo';

export async function maybeAskForReview(db: Db) {
  try {
    const first = Number((await getSetting(db, 'firstOpenAt')) ?? 0);
    if (!first || Date.now() - first < 3 * 86_400_000) return;
    const last = Number((await getSetting(db, 'reviewAskedAt')) ?? 0);
    if (Date.now() - last < 60 * 86_400_000) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    await setSetting(db, 'reviewAskedAt', String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    /* never block the UI on this */
  }
}

export async function openStorePage() {
  const url = StoreReview.storeUrl();
  return url;
}
