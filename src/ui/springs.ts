/** Spring tokens + press feedback. Kept dependency-free so primitives and motion can both use it. */
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

/** One set of springs for the whole app, so every surface moves with the same character. */
export const springs = {
  /** finger down: quick, no overshoot */
  pressIn: { damping: 20, stiffness: 420, mass: 0.6 },
  /** finger up: a little bounce back */
  pressOut: { damping: 11, stiffness: 320, mass: 0.7 },
  /** things that pop into view (badges, counts, chips) */
  pop: { damping: 9, stiffness: 240, mass: 0.8 },
  /** panels, sheets, layout moves */
  gentle: { damping: 18, stiffness: 190, mass: 0.9 },
  /** a value that just changed (numbers, rings) */
  settle: { damping: 14, stiffness: 160 },
} as const;

/**
 * Springy press feedback for any Pressable. Spread `handlers` on the Pressable and put `style`
 * on an Animated.View inside it (or on the Pressable itself when it is an Animated component).
 */
export function usePress(scaleTo = 0.95, opts?: { dim?: boolean }) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: opts?.dim ? 1 - (1 - s.value) * 2 : 1 }));
  const handlers = {
    onPressIn: () => {
      s.value = withSpring(scaleTo, springs.pressIn);
    },
    onPressOut: () => {
      s.value = withSpring(1, springs.pressOut);
    },
  };
  return { style, handlers };
}

