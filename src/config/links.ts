import { lang } from '../i18n/core';

/** Public pages (site/ → pavurio.com). Override with EXPO_PUBLIC_*. */
const SITE = 'https://pavurio.com';
const fr = () => (lang() === 'en' ? '' : `/${lang()}`);
export const LEGAL = {
  get privacy() {
    return process.env.EXPO_PUBLIC_PRIVACY_URL || `${SITE}${fr()}/privacy.html`;
  },
  get terms() {
    return process.env.EXPO_PUBLIC_TERMS_URL || `${SITE}${fr()}/terms.html`;
  },
  get help() {
    return `${SITE}${fr()}/support.html`;
  },
  get deleteAccount() {
    return `${SITE}${fr()}/delete-account.html`;
  },
  support: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'lesepavistespro@gmail.com',
  appStoreId: process.env.EXPO_PUBLIC_APP_STORE_ID || '',
  androidPackage: 'com.pavurio.app',
};
