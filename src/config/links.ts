/** Public pages. Override with EXPO_PUBLIC_* variables once the website exists. */
const REPO = 'https://github.com/CElyousfi/PAVURIO/blob/main/docs/legal';
export const LEGAL = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL || `${REPO}/PRIVACY.md`,
  terms: process.env.EXPO_PUBLIC_TERMS_URL || `${REPO}/TERMS.md`,
  support: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'lesepavistespro@gmail.com',
  appStoreId: process.env.EXPO_PUBLIC_APP_STORE_ID || '',
  androidPackage: 'com.pavurio.app',
};
