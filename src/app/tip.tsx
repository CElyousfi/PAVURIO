import React, { useRef, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TIPS, tipText } from '../content/tips';
import { TIP_ICON } from '../features/HomeFeed';
import { CareIcon } from '../ui/CareIcon';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';
import { Bouncy, Float } from '../ui/motion';
import { CircleButton, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { tapFeedback } from '../native/haptics';
import { t } from '../i18n';

export default function TipReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tip = TIPS.find((x) => x.id === id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  if (!tip) return null;
  const W = Math.min(width, 560);
  const last = tip.slides.length - 1;

  const go = (i: number) => {
    tapFeedback();
    pager.current?.scrollTo({ x: i * W, animated: true });
    setPage(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));

  return (
    <View style={[styles.root, { backgroundColor: tip.tint, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <View style={styles.top}>
          <View style={styles.bars}>
            {tip.slides.map((_, i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= page ? tip.color : '#00000014' }]} />
            ))}
          </View>
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={44} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <T weight="black" style={{ color: tip.color, fontSize: 12, letterSpacing: 1.6 }}>
            {tipText(tip.kicker).toUpperCase()}
          </T>
          <T weight="black" style={{ fontSize: 22, textAlign: 'center', marginTop: 2, paddingHorizontal: 24 }}>
            {tipText(tip.title)}
          </T>
        </View>
        <Float style={{ alignItems: 'center', marginVertical: 18 }} amount={7}>
          {ART.tips[tip.id] ? <Scene source={ART.tips[tip.id]!} width={170} height={200} border={5} tilt={2} /> : <CareIcon type={TIP_ICON[tip.id] ?? 'meal'} size={150} />}
        </Float>
        <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={32} style={{ flexGrow: 0 }}>
          {tip.slides.map((s, i) => (
            <View key={i} style={{ width: W, paddingHorizontal: 22 }}>
              <Animated.View entering={FadeIn.delay(i === 0 ? 150 : 0)} style={styles.card}>
                <T weight="black" style={{ color: tip.color, fontSize: 14 }}>
                  {i + 1}/{tip.slides.length}
                </T>
                <T weight="black" style={{ fontSize: 22, marginTop: 6, lineHeight: 27 }}>
                  {tipText(s.title)}
                </T>
                <T style={{ fontSize: 17, color: colors.inkSoft, marginTop: 10, lineHeight: 25 }}>{tipText(s.body)}</T>
              </Animated.View>
            </View>
          ))}
        </ScrollView>
        <View style={{ flex: 1 }} />
        <View style={{ paddingHorizontal: 22, gap: 10 }}>
          <Bouncy onPress={() => (page < last ? go(page + 1) : router.back())} style={[styles.cta, { backgroundColor: tip.color }]} accessibilityRole="button" testID="tip-next">
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 18 }}>
              {page < last ? t('Next') : t('Got it!')}
            </T>
          </Bouncy>
          {page === last ? (
            <Bouncy
              onPress={() => Share.share({ message: `${tipText(tip.title)}\n\n${tip.slides.map((s) => `• ${tipText(s.title)} — ${tipText(s.body)}`).join('\n')}\n\n${t('From Pavurio')}` })}
              style={styles.ghost}
              accessibilityRole="button"
            >
              <T weight="black" style={{ color: tip.color, fontSize: 15 }}>
                {t('Share this tip')}
              </T>
            </Bouncy>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, minHeight: 190 },
  cta: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
});
