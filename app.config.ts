import fs from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the static config. This file adds the cloud features (Firebase accounts,
 * backup, Crashlytics, Sign in with Apple/Google) once the two Firebase files are in the repo:
 *   firebase/GoogleService-Info.plist   (Firebase console → iOS app)
 *   firebase/google-services.json       (Firebase console → Android app)
 * Without them the app builds and runs as before, with every cloud feature hidden.
 */
const IOS_FILE = './firebase/GoogleService-Info.plist';
const ANDROID_FILE = './firebase/google-services.json';

/** OAuth "web" client from google-services.json: Google Sign-In needs it to return an ID token for Firebase. */
function googleWebClientId(): string | undefined {
  try {
    const json = JSON.parse(fs.readFileSync(ANDROID_FILE, 'utf8')) as {
      client?: { oauth_client?: { client_id: string; client_type: number }[] }[];
    };
    for (const c of json.client ?? []) for (const o of c.oauth_client ?? []) if (o.client_type === 3) return o.client_id;
  } catch {
    // no file yet
  }
  return undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const firebase = fs.existsSync(IOS_FILE) && fs.existsSync(ANDROID_FILE);
  const plugins: ExpoConfig['plugins'] = [...(config.plugins ?? []), 'expo-apple-authentication'];
  if (firebase) {
    plugins.push(
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/crashlytics',
      '@react-native-google-signin/google-signin',
      // Firebase Apple SDK 13+ ships through Swift Package Manager, which needs dynamic frameworks.
      // Firebase Android BoM 35 (firebase-auth 25) is built with Kotlin 2.4; RN's default 2.2 can't read it.
      ['expo-build-properties', { ios: { useFrameworks: 'dynamic' }, android: { kotlinVersion: '2.3.21' } }],
    );
  }
  return {
    ...(config as ExpoConfig),
    plugins,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      ...(firebase ? { googleServicesFile: IOS_FILE } : {}),
    },
    android: {
      ...config.android,
      ...(firebase ? { googleServicesFile: ANDROID_FILE } : {}),
    },
    extra: {
      ...config.extra,
      firebase,
      googleWebClientId: googleWebClientId(),
    },
  };
};
