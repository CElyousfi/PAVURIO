import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { T } from '../../ui/primitives';
import { colors, font } from '../../ui/theme';
import { tapFeedback } from '../../native/haptics';
import { t } from '../../i18n';

type TabName = 'index' | 'care' | 'moments' | 'records' | 'pets';
const LABELS: Record<TabName, () => string> = {
  index: () => t('Home'),
  care: () => t('Care'),
  moments: () => t('Moments'),
  records: () => t('Records'),
  pets: () => t('Pets'),
};

function TabIcon({ name, color }: { name: TabName; color: string }) {
  const p = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {name === 'index' && <Path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5.5h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" {...p} />}
      {name === 'care' && (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
          <Circle cx={8.5} cy={14.5} r={1.2} fill={color} />
          <Circle cx={12} cy={14.5} r={1.2} fill={color} />
        </>
      )}
      {name === 'moments' && (
        <>
          <Rect x={3.5} y={5.5} width={17} height={14} rx={3} {...p} />
          <Path d="M3.5 16.5 8.5 12l4 3.5 3-2.5 5 4" {...p} />
          <Circle cx={15.5} cy={9.5} r={1.6} {...p} />
        </>
      )}
      {name === 'records' && (
        <>
          <Path d="M7 4h7.5L19 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 19V5.5A1.5 1.5 0 0 1 7 4z" {...p} />
          <Path d="M14 4v5h5M9 13h6M9 16.5h4" {...p} />
        </>
      )}
      {name === 'pets' && (
        <>
          <Path d="M12 20c-3.4 0-5.5-1.6-5.5-3.8 0-2.6 2.6-4.7 5.5-4.7s5.5 2.1 5.5 4.7C17.5 18.4 15.4 20 12 20z" {...p} />
          <Circle cx={6} cy={9.5} r={1.8} {...p} />
          <Circle cx={9.5} cy={6} r={1.8} {...p} />
          <Circle cx={14.5} cy={6} r={1.8} {...p} />
          <Circle cx={18} cy={9.5} r={1.8} {...p} />
        </>
      )}
    </Svg>
  );
}

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const name = route.name as TabName;
        if (!LABELS[name]) return null;
        const focused = state.index === i;
        const color = focused ? colors.ink : colors.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABELS[name]()}
            testID={`tab-${name}`}
            onPress={() => {
              if (focused) return;
              tapFeedback();
              navigateToTab(route.key);
            }}
            style={styles.item}
          >
            <View style={[styles.iconWrap, focused && styles.iconOn]}>
              <TabIcon name={name} color={color} />
            </View>
            <T weight={focused ? 'black' : 'xbold'} style={[styles.label, { color }]}>
              {LABELS[name]()}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="care" />
      <Tabs.Screen name="moments" />
      <Tabs.Screen name="records" />
      <Tabs.Screen name="pets" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.brandSoft },
  label: { fontSize: 11, fontFamily: font.xbold, letterSpacing: 0.2 },
});
