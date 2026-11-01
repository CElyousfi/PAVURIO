import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, font, radius, shadow } from './theme';
import { tapFeedback } from '../native/haptics';
import { usePress } from './springs';
import { t } from '../i18n';

const APressable = Animated.createAnimatedComponent(Pressable);

export function T({ style, weight = 'bold', ...rest }: TextProps & { weight?: 'bold' | 'xbold' | 'black' }) {
  return <Text {...rest} style={[{ fontFamily: font[weight], color: colors.ink }, style]} />;
}

type PillProps = {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

/** Big rounded CTA pill (dark navy by default, or a care color). */
export function Pill({ label, onPress, color = colors.ink, textColor = '#FFFFFF', disabled, loading, style, accessibilityHint, testID }: PillProps) {
  const press = usePress(0.96);
  return (
    <APressable
      {...press.handlers}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label.replace('+ ', t('Add '))}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.pill, { backgroundColor: color, opacity: disabled ? 0.45 : 1 }, style, press.style]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pillText, { color: textColor }, label.length > 16 && { fontSize: 17, letterSpacing: 0.6 }]}>{label}</Text>}
    </APressable>
  );
}

/** Soft tinted pill (secondary actions like "Delete / Edit"). */
export function SoftPill({ label, onPress, color = colors.brand, tint = colors.brandSoft, style, small }: { label: string; onPress: () => void; color?: string; tint?: string; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const press = usePress(0.95);
  return (
    <APressable
      {...press.handlers}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.soft, small && styles.softSmall, { backgroundColor: tint }, style, press.style]}
    >
      <Text style={[styles.softText, small && { fontSize: 14 }, { color }]}>{label}</Text>
    </APressable>
  );
}

export type IconName = 'close' | 'menu' | 'back' | 'chevL' | 'chevR' | 'up' | 'down' | 'plus' | 'check' | 'more';

export function Icon({ name, size = 22, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  const d: Record<IconName, string> = {
    close: 'M6 6 L18 18 M18 6 L6 18',
    menu: 'M4 8 Q8 5 12 8 T20 8 M4 13 Q8 10 12 13 T20 13 M4 18 Q8 15 12 18 T20 18',
    back: 'M15 5 L8 12 L15 19',
    chevL: 'M15 5 L8 12 L15 19',
    chevR: 'M9 5 L16 12 L9 19',
    up: 'M6 15 L12 9 L18 15',
    down: 'M6 9 L12 15 L18 9',
    plus: 'M12 5 V19 M5 12 H19',
    check: 'M5 12.5 L10 17 L19 7',
    more: 'M6 12 h.01 M12 12 h.01 M18 12 h.01',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d[name]} stroke={color} strokeWidth={name === 'more' ? 4 : 2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** White floating circle button with soft shadow (close, settings, back). */
export function CircleButton({ icon, onPress, label, size = 52, children, style }: { icon?: IconName; onPress: () => void; label: string; size?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const press = usePress(0.9);
  return (
    <APressable
      {...press.handlers}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.circle, shadow, { width: size, height: size, borderRadius: size / 2 }, style, press.style]}
    >
      {children ?? (icon ? <Icon name={icon} /> : null)}
    </APressable>
  );
}

export function Label({ children, color = colors.muted, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: { height: 62, borderRadius: radius.pill, paddingHorizontal: 34, alignItems: 'center', justifyContent: 'center', minWidth: 200 },
  pillText: { fontFamily: font.black, fontSize: 20, letterSpacing: 1.2 },
  soft: { paddingHorizontal: 20, height: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  softSmall: { height: 38, paddingHorizontal: 16 },
  softText: { fontFamily: font.xbold, fontSize: 16 },
  circle: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.black, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 20 },
});
