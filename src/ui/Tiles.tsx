/**
 * Clucky's dark illustrated tiles (missions, sounds, settings): an ink card with a bold title, a quiet
 * subtitle and its art spilling off the bottom-right corner. Selected tiles get a coloured outline and a
 * check. They squish when pressed like every other button.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Bouncy } from './motion';
import { Icon, T } from './primitives';
import { colors } from './theme';

export function DarkTile({
  title,
  subtitle,
  subtitleColor,
  art,
  selected,
  accent = colors.brand,
  onPress,
  height = 130,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
  children,
}: {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  art?: React.ReactNode;
  selected?: boolean;
  accent?: string;
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio';
  testID?: string;
  children?: React.ReactNode;
}) {
  return (
    <Bouncy
      scaleTo={0.95}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={[styles.tile, { height }, selected && { borderColor: accent }, style]}
      testID={testID}
    >
      {art ? (
        <View pointerEvents="none" style={styles.art}>
          {art}
        </View>
      ) : null}
      <T weight="black" style={[styles.title, selected ? { marginRight: 26 } : null]} numberOfLines={2}>
        {title}
      </T>
      {subtitle ? (
        <T weight="xbold" style={[styles.sub, subtitleColor ? { color: subtitleColor } : null]} numberOfLines={2}>
          {subtitle}
        </T>
      ) : null}
      {children}
      {selected ? (
        <View style={[styles.check, { backgroundColor: accent }]}>
          <Icon name="check" size={14} color="#FFFFFF" />
        </View>
      ) : null}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 26, backgroundColor: colors.ink, padding: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  art: { position: 'absolute', right: -8, bottom: -8 },
  title: { color: '#FFFFFF', fontSize: 17, lineHeight: 21 },
  sub: { color: '#FFFFFF99', fontSize: 13, marginTop: 1 },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
