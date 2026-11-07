/**
 * Contextual education: one short, friendly line the FIRST time something meaningful happens
 * (first care logged, first walk, first pantry product, first photo) — shown after the save really
 * happened, dismissible, never again after that. No missions, no streaks, no tutorials.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSetting, setSetting } from '../data/repo';
import type { Db } from '../data/db';
import { Bouncy, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { t } from '../i18n';
import { track } from '../native/analytics';

export type TipKey = 'first_care' | 'first_walk' | 'first_supply' | 'first_photo';

const COPY: Record<TipKey, { emoji: string; text: () => string }> = {
  first_care: { emoji: '🎉', text: () => t('Your first care is saved! You can see it in today’s history.') },
  first_walk: { emoji: '🐾', text: () => t('Your adventure is saved. You’ll find it in your records.') },
  first_supply: { emoji: '🛒', text: () => t('Your pantry is ready. You can update the amount anytime.') },
  first_photo: { emoji: '📸', text: () => t('Your first memory is safe in the scrapbook.') },
};

type Listener = (k: TipKey) => void;
const listeners = new Set<Listener>();

/** Shows the tip once per install (after a real, saved action). Safe to call every time. */
export async function firstTimeTip(db: Db, key: TipKey): Promise<void> {
  try {
    if (await getSetting(db, `tip:${key}`)) return;
    await setSetting(db, `tip:${key}`, String(Date.now()));
    // the first care already gets its "First care" badge moment: no second message on top of it
    if (key === 'first_care') return track('first_care_logged');
    listeners.forEach((l) => l(key));
  } catch {
    // a tip is never worth an error
  }
}

/** Mounted once at the root: shows the current tip above everything, at the bottom. */
export function TipHost() {
  const insets = useSafeAreaInsets();
  const [tip, setTip] = useState<TipKey | null>(null);
  useEffect(() => {
    const l: Listener = (k) => setTip(k);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), 6000);
    return () => clearTimeout(timer);
  }, [tip]);
  if (!tip) return null;
  const c = COPY[tip];
  const reduced = motionReduced();
  return (
    <Animated.View
      key={tip}
      entering={reduced ? undefined : FadeInDown.springify().damping(16)}
      exiting={reduced ? undefined : FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom: insets.bottom + 92 }]}
      pointerEvents="box-none"
    >
      <View style={styles.card} accessibilityLiveRegion="polite" testID={`tip-${tip}`}>
        <T style={{ fontSize: 22 }}>{c.emoji}</T>
        <T weight="xbold" style={{ flex: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 20 }}>
          {c.text()}
        </T>
        <Bouncy onPress={() => setTip(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Close')} testID="tip-close">
          <Icon name="close" size={16} color="#FFFFFFAA" />
        </Bouncy>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 50, elevation: 50 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16 },
});
