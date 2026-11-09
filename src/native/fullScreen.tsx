/**
 * Android: the app runs full screen, with the system navigation bar (back / home / recents, or the
 * gesture handle) hidden. A swipe up from the bottom edge shows it for a moment, then it hides again
 * (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE, set by expo-navigation-bar). The status bar (time, battery)
 * stays. The bar starts hidden from launch (app.json plugin option `hidden`); this keeps it hidden after
 * the app comes back from the background, a permission dialog or the keyboard, which can bring it back.
 *
 * Android never lets an app disable the home button itself: the owner can always leave the app.
 * Screens already pad with the safe-area insets, which become 0 at the bottom while the bar is hidden.
 */
import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';

function hide() {
  if (Platform.OS !== 'android') return;
  try {
    NavigationBar.setHidden(true);
  } catch {
    // a phone that refuses keeps its bar: never worth an error
  }
}

export function FullScreen() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    hide();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') hide();
    });
    const kb = Keyboard.addListener('keyboardDidHide', hide);
    return () => {
      app.remove();
      kb.remove();
    };
  }, []);
  if (Platform.OS !== 'android') return null;
  return <NavigationBar hidden />;
}
