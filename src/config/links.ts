import { lang } from '../i18n/core';

/** Public pages (site/ → GitHub Pages, gh-pages branch). Override with EXPO_PUBLIC_* once a custom domain exists. */
const SITE = 'https://celyousfi.github.io/PAVURIO';
const fr = () => (lang() === 'fr' ? '/fr' : '');
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
