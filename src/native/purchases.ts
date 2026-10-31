/**
 * Pavurio Pro through RevenueCat. Keys come from EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.
 * Without keys (or on web) the store is reported as "not configured" — the paywall says so honestly
 * instead of pretending a purchase can happen. Reminders, records and exports are never paid features.
 */
import { Platform } from 'react-native';

export const ENTITLEMENT = 'pro';
export const FREE_PET_LIMIT = 1;

export type Plan = { id: string; title: string; price: string; period: string; packageRef: unknown };
export type StoreState = { configured: boolean; reason?: string };

type RC = typeof import('react-native-purchases').default;
let rc: RC | null = null;
let configured = false;

function apiKey(): string | null {
  const k = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY : undefined;
  return k && k.trim() ? k.trim() : null;
}

export function storeState(): StoreState {
  if (Platform.OS === 'web') return { configured: false, reason: 'Purchases are available in the iPhone and Android app.' };
  if (!apiKey()) return { configured: false, reason: "The store isn't connected in this build yet." };
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
  return (o.current?.availablePackages ?? []).map((p) => ({
    id: p.identifier,
    title: p.product.title,
    price: p.product.priceString,
    period: p.packageType === 'ANNUAL' ? 'year' : p.packageType === 'MONTHLY' ? 'month' : p.packageType === 'LIFETIME' ? 'once' : '',
    packageRef: p,
  }));
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
