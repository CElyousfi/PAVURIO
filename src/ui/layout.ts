/**
 * Responsive sizing from the space that is really there: window height minus the status bar, the
 * system navigation bar and the keyboard — not just the screen width. Decorative pets shrink first;
 * inputs and buttons keep their size. (Android draws edge to edge, so the window does NOT shrink when
 * the keyboard opens: we have to read the keyboard's height ourselves.)
 */
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { previewSize, type PreviewKind } from './sizing';

/** keyboard height in points (0 when closed) */
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    // iOS announces the keyboard before it moves; Android only after
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEv, (e: KeyboardEvent) => setH(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hideEv, () => setH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return h;
}

export { previewSize, type PreviewKind };

/** Window size minus system bars, and the keyboard; plus the right pet size for a kind of screen. */
export function useScreenBudget(chrome = 0) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // what the screen's own fixed parts (top row, title, bottom button) don't use
  const available = Math.max(0, height - insets.top - insets.bottom - chrome);
  return {
    width,
    height,
    available,
    keyboard,
    keyboardOpen: keyboard > 0,
    pet: (kind: PreviewKind) => previewSize(kind, Math.min(width, 520), available, keyboard),
  };
}
