import { Alert, Platform } from 'react-native';
import { t } from '../i18n';
import { bumpFeedback, deleteFeedback } from '../native/haptics';

/**
 * Destructive confirmation that works on native (Alert) and web (window.confirm).
 * The question is felt (a bump) and the confirmed removal is felt and heard (delete feedback), so every
 * delete in the app sounds the same.
 */
export function confirmAsync(title: string, message: string, confirmLabel = t('Delete'), kind: 'delete' | 'confirm' = 'delete'): Promise<boolean> {
  bumpFeedback();
  const done = (ok: boolean) => {
    if (ok && kind === 'delete') deleteFeedback();
    return ok;
  };
  if (Platform.OS === 'web') {
    return Promise.resolve(done(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${title}\n\n${message}`) : false));
  }
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: kind === 'delete' ? 'destructive' : 'default', onPress: () => resolve(done(true)) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
