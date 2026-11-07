/**
 * Anonymous product analytics: which steps of setup people finish, who sees the paywall and buys,
 * what gets logged — never the pet's name, photos, notes or any free text. Firebase Analytics with
 * the advertising ID and ad storage turned off (firebase.json → "react-native"). Owners can switch it
 * off in Settings (setting `cloud.analytics`); web and builds without Firebase do nothing.
 */
import { cloud } from '../cloud/firebase';
import { getSetting, setSetting } from '../data/repo';
import type { Db } from '../data/db';

export type AnalyticsEvent =
  | 'onboarding_step'
  | 'onboarding_care_page'
  | 'plan_built'
  | 'onboarding_complete'
  | 'paywall_view'
  | 'purchase_start'
  | 'purchase_success'
  | 'purchase_cancel'
  | 'purchase_restore'
  | 'care_logged'
  | 'plan_saved'
  | 'plan_auto_updated'
  | 'guide_opened'
  | 'routine_applied'
  // first-use funnel (fired from handlers only, never from renders)
  | 'species_selected'
  | 'name_completed'
  | 'appearance_opened'
  | 'coat_selected'
  | 'accessory_selected'
  | 'appearance_confirmed'
  | 'plan_overview_reached'
  | 'onboarding_completed'
  | 'home_reached'
  | 'first_care_logged'
  | 'feature_discovered'
  | 'intro_choice';

type Params = Record<string, string | number | boolean>;

let enabled = true;

export async function initAnalytics(db: Db): Promise<void> {
  enabled = (await getSetting(db, 'cloud.analytics')) !== '0';
  cloud.analytics.setEnabled(enabled);
}

export function analyticsEnabled(): boolean {
  return enabled;
}

export async function setAnalyticsEnabled(db: Db, on: boolean): Promise<void> {
  enabled = on;
  await setSetting(db, 'cloud.analytics', on ? '1' : '0');
  cloud.analytics.setEnabled(on);
}

export function track(name: AnalyticsEvent, params?: Params): void {
  if (!enabled) return;
  cloud.analytics.event(name, params);
}

/** screen names are route paths without ids (e.g. "log/meal", "plan") */
export function trackScreen(path: string): void {
  if (!enabled) return;
  const name = path.replace(/^\//, '') || 'home';
  cloud.analytics.screen(name.slice(0, 100));
}
