import { Alert, Platform } from 'react-native';
import { t } from '../i18n';

/** Destructive confirmation that works on native (Alert) and web (window.confirm). */
export function confirmAsync(title: string, message: string, confirmLabel = t('Delete')): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
