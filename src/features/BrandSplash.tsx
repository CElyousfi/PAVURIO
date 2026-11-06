import React, { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { T } from "../ui/primitives";
import { colors } from "../ui/theme";
import { t } from "../i18n";
import { motionReduced } from "../ui/motion";

/** Same picture, size and background as the native splash (app.json → expo-splash-screen), so the hand-off is invisible. */
const ICON = require("../../assets/splash-icon.png");
const ICON_SIZE = 150;
/** how far the icon rises to make room for the name and tagline */
const LIFT = 56;
const HOLD_MS = 1100;

/**
 * The brand moment on every cold start: the store icon (already on screen as the native splash), then
 * "Pavurio" and the tagline rise in under it, then the whole thing fades away to reveal the app.
 * Rendered over the app once data is ready, so the language is the user's own.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const reduced = motionReduced();
  const lift = useSharedValue(0);
  const text = useSharedValue(0);
  const veil = useSharedValue(1);
  const hidden = useRef(false);

  const hideNative = () => {
    if (hidden.current) return;
    hidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  useEffect(() => {
    // the icon is bundled, so it's normally decoded at once; never keep the native splash up for long
    const safety = setTimeout(hideNative, 400);
    const ease = Easing.out(Easing.cubic);
    if (reduced) {
      text.value = 1;
      lift.value = 1;
    } else {
      lift.value = withDelay(
        120,
        withTiming(1, { duration: 520, easing: ease }),
      );
      text.value = withDelay(
        260,
        withTiming(1, { duration: 480, easing: ease }),
      );
    }
    veil.value = withDelay(
      HOLD_MS + (reduced ? 0 : 400),
      withTiming(
        0,
        { duration: reduced ? 150 : 320, easing: Easing.inOut(Easing.quad) },
        (fin) => {
          if (fin) runOnJS(onDone)();
        },
      ),
    );
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -LIFT * lift.value },
      { scale: 1 - 0.06 * lift.value },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 14 - LIFT }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={iconStyle}>
        <Image
          source={ICON}
          style={styles.icon}
          onLoad={hideNative}
          fadeDuration={0}
        />
      </Animated.View>
      <Animated.View style={[styles.textBox, textStyle]}>
        <T weight="black" style={styles.name}>
          Pavurio
        </T>
        <T style={styles.tagline}>{t("A calm companion for real pet care.")}</T>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // matches the native splash background exactly
  root: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    elevation: 100,
  },
  icon: { width: ICON_SIZE, height: ICON_SIZE },
  // sits just under the icon's resting place; the whole group stays visually centred once the icon lifts
  textBox: {
    position: "absolute",
    top: "50%",
    marginTop: ICON_SIZE / 2 + 22,
    left: 32,
    right: 32,
    alignItems: "center",
  },
  name: { fontSize: 34, letterSpacing: 0.3, color: colors.ink },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
  },
});
