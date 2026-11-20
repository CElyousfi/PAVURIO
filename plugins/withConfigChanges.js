/**
 * Android: keep Pavurio's activity alive through font-size changes.
 *
 * Expo's MainActivity handles orientation/size changes itself but not `fontScale`, so Android recreates it
 * when the user changes Font size in Settings. A recreated activity remounts the whole React tree, which
 * drops the user back on Home and closes the SQLite connection under in-flight queries. React Native
 * re-measures text with the new scale on the configuration change, so the activity can handle it.
 *
 * `density` is deliberately left out: handled in-process, React Native keeps text measured at the old
 * density (labels clip until the next restart), so a Display size change still recreates the activity.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const EXTRA = ['fontScale'];

module.exports = function withConfigChanges(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const current = (activity.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    activity.$['android:configChanges'] = [...new Set([...current, ...EXTRA])].join('|');
    return cfg;
  });
};
