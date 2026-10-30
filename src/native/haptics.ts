import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

const ok = () => enabled && Platform.OS !== 'web';

export function tapFeedback() {
  if (ok()) Haptics.selectionAsync().catch(() => {});
}

export function petFeedback() {
  if (ok()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function successFeedback() {
  if (ok()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function errorFeedback() {
  if (ok()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
