/**
 * Pavurio Pro through RevenueCat. Keys come from EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.
 * Without keys (or on web) the store is reported as "not configured" — the paywall says so honestly
 * instead of pretending a purchase can happen. Reminders, records and exports are never paid features.
 */
import { Platform } from 'react-native';
import { t } from '../i18n';

export const ENTITLEMENT = 'pro';
export const FREE_PET_LIMIT = 1;

export type Plan = {
  id: string;
  title: string;
  /** formatted by the store, e.g. "€29.99" */
  price: string;
  priceValue: number;
  /** 'year' | 'month' | 'week' | 'once' | '' */
  period: string;
  /** monthly equivalent from the store, formatted (yearly plans) */
  perMonth: string | null;
  /** free-trial length in days from the store's intro offer, or 0 */
  trialDays: number;
  packageRef: unknown;
  /** true for display-only plans when the store isn't connected */
  preview?: boolean;
};

const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365, D: 1, W: 7, M: 30, Y: 365 };

function trialDaysOf(product: any): number {
  const intro = product?.introPrice;
  if (intro && intro.price === 0) return (intro.periodNumberOfUnits ?? 0) * (UNIT_DAYS[intro.periodUnit] ?? 0) * Math.max(1, intro.cycles ?? 1);
  const free = product?.defaultOption?.freePhase?.billingPeriod;
  if (free) return (free.value ?? 0) * (UNIT_DAYS[free.unit] ?? 0);
  return 0;
}

/**
 * Shown when no store is connected (web, or a build without keys), so the paywall can be designed and
 * reviewed. Clearly marked as previews and can't be bought.
 */
export const PREVIEW_PLANS: Plan[] = [
  { id: 'preview_annual', title: 'Yearly', price: '€29.99', priceValue: 29.99, period: 'year', perMonth: '€2.50', trialDays: 7, packageRef: null, preview: true },
  { id: 'preview_monthly', title: 'Monthly', price: '€4.99', priceValue: 4.99, period: 'month', perMonth: null, trialDays: 0, packageRef: null, preview: true },
  { id: 'preview_lifetime', title: 'Lifetime', price: '€59.99', priceValue: 59.99, period: 'once', perMonth: null, trialDays: 0, packageRef: null, preview: true },
];

/** Honest saving of the yearly plan versus paying monthly for 12 months (null when it can't be computed). */
export function yearlySaving(plans: Plan[]): number | null {
  const y = plans.find((p) => p.period === 'year');
  const m = plans.find((p) => p.period === 'month');
  if (!y || !m || m.priceValue <= 0) return null;
  const pct = Math.round((1 - y.priceValue / (m.priceValue * 12)) * 100);
  return pct >= 5 ? pct : null;
}
export type StoreState = { configured: boolean; reason?: string };

type RC = typeof import('react-native-purchases').default;
let rc: RC | null = null;
let configured = false;

function apiKey(): string | null {
  const k = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY : undefined;
  return k && k.trim() ? k.trim() : null;
}

export function storeState(): StoreState {
  if (Platform.OS === 'web') return { configured: false, reason: t('Purchases are available in the iPhone and Android app.') };
  if (!apiKey()) return { configured: false, reason: t("The store isn't connected in this build yet.") };
  return { configured: true };
}

async function client(): Promise<RC | null> {
  if (!storeState().configured) return null;
  if (!rc) rc = (await import('react-native-purchases')).default;
  if (!configured) {
    rc.configure({ apiKey: apiKey()! });
    configured = true;
  }
  return rc;
}

export async function isPro(): Promise<boolean | null> {
  const c = await client();
  if (!c) return null;
  try {
    const info = await c.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return null;
  }
}

export async function loadPlans(): Promise<Plan[]> {
  const c = await client();
  if (!c) return [];
  const o = await c.getOfferings();
  const ORDER: Record<string, number> = { year: 0, month: 1, week: 2, once: 3 };
  const plans = (o.current?.availablePackages ?? []).map((p) => ({
    id: p.identifier,
    title: p.product.title,
    price: p.product.priceString,
    priceValue: p.product.price,
    period: p.packageType === 'ANNUAL' ? 'year' : p.packageType === 'MONTHLY' ? 'month' : p.packageType === 'WEEKLY' ? 'week' : p.packageType === 'LIFETIME' ? 'once' : '',
    perMonth: p.packageType === 'ANNUAL' ? (p.product as { pricePerMonthString?: string | null }).pricePerMonthString ?? null : null,
    trialDays: trialDaysOf(p.product),
    packageRef: p,
  }));
  // yearly first (the highlighted plan), whatever order the offering lists them in
  return plans.sort((a, b) => (ORDER[a.period] ?? 9) - (ORDER[b.period] ?? 9));
}

/** Resolves true when Pro is active afterwards; false when the user cancelled. Throws on store errors. */
export async function purchase(plan: Plan): Promise<boolean> {
  const c = await client();
  if (!c) throw new Error(storeState().reason);
  try {
    const r = await c.purchasePackage(plan.packageRef as Parameters<RC['purchasePackage']>[0]);
    return !!r.customerInfo.entitlements.active[ENTITLEMENT];
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  const c = await client();
  if (!c) throw new Error(storeState().reason);
  const info = await c.restorePurchases();
  return !!info.entitlements.active[ENTITLEMENT];
}

/** Ties purchases to the Pavurio account so Pro follows the owner to a new phone. */
export async function identify(uid: string | null): Promise<void> {
  const c = await client();
  if (!c) return;
  try {
    if (uid) await c.logIn(uid);
    else if (!(await c.isAnonymous())) await c.logOut();
  } catch (e) {
    console.warn('[pavurio] purchases identify failed', e);
  }
}
