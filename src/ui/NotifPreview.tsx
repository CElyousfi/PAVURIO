/**
 * A faithful mock of a Pavurio reminder as it appears on the lock screen: app icon, app name, time,
 * a bold title (two lines, never cut mid-word) and the body. It drops in like a real banner.
 */
import React, { useEffect } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { T } from './primitives';
import { colors } from './theme';
import { motionReduced } from './motion';
import { t } from '../i18n';

const APP_ICON = require('../../assets/icon.png');

export function NotifPreview({ title, body, when, delay = 250, style }: { title: string; body: string; when?: string; delay?: number; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(motionReduced() ? 1 : 0);
  useEffect(() => {
    if (motionReduced()) return;
    // banner physics: quick drop with a hint of overshoot, opacity leads slightly
    p.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 230, mass: 0.8 }));
  }, [delay, p]);
  const fade = useSharedValue(motionReduced() ? 1 : 0);
  useEffect(() => {
    if (motionReduced()) return;
    fade.value = withDelay(delay, withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }));
  }, [delay, fade]);
  const a = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - p.value) * -28 }, { scale: 0.94 + 0.06 * p.value }],
  }));
  return (
    <Animated.View style={[styles.card, style, a]} accessibilityRole="text" accessibilityLabel={`${title}. ${body}`}>
      <Image source={APP_ICON} style={styles.icon} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1 }}>
        <View style={styles.head}>
          <T weight="black" style={styles.app}>
            PAVURIO
          </T>
          <T style={styles.time}>{when ?? t('now')}</T>
        </View>
        <T weight="black" style={styles.title} numberOfLines={2}>
          {title}
        </T>
        <T style={styles.body} numberOfLines={2}>
          {body}
        </T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35,48,74,0.08)',
    shadowColor: '#23304A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  icon: { width: 38, height: 38, borderRadius: 9, marginTop: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 },
  app: { fontSize: 11, letterSpacing: 1, color: colors.muted },
  time: { fontSize: 12, color: colors.muted },
  title: { fontSize: 15, lineHeight: 19, color: colors.ink },
  body: { fontSize: 13, lineHeight: 17, color: colors.inkSoft, marginTop: 1 },
});
