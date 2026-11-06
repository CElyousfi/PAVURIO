import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TIPS, tipText } from '../content/tips';
import { TIP_ICON } from '../features/HomeFeed';
import { CareIcon } from '../ui/CareIcon';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';
import { Bouncy, Float } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { tapFeedback } from '../native/haptics';
import { t } from '../i18n';
import { Missing } from '../ui/Missing';

export default function TipReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tip = TIPS.find((x) => x.id === id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  if (!tip) return <Missing />;
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
          <Bouncy onPress={() => router.back()} style={styles.leave} accessibilityRole="button" accessibilityLabel={t('Close')} scaleTo={0.92}>
            <T weight="black" style={{ fontSize: 13, letterSpacing: 1.2, color: '#00000055' }}>
              {t('LEAVE')}
            </T>
          </Bouncy>
        </View>
        <View style={styles.progress}>
          <View style={styles.bars}>
            {tip.slides.map((_, i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= page ? colors.ink : '#FFFFFF99', flex: i === page ? 1.6 : 1 }]} />
            ))}
          </View>
          <View style={[styles.done, { backgroundColor: page === last ? colors.ink : '#FFFFFF99' }]}>
            <Icon name="check" size={16} color={page === last ? '#FFFFFF' : tip.color} />
          </View>
        </View>
        <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={32} style={{ flex: 1 }}>
          {tip.slides.map((sl, i) => (
            <View key={i} style={{ width: W, paddingHorizontal: 26 }}>
              <Animated.View entering={FadeIn.delay(i === 0 ? 120 : 0)}>
                <T weight="black" style={{ color: tip.color, fontSize: 13, letterSpacing: 1.6, marginTop: 22 }}>
                  {i === 0 ? tipText(tip.kicker).toUpperCase() : `${i + 1}/${tip.slides.length}`}
                </T>
                <T weight="black" style={styles.title}>
                  {i === 0 ? tipText(tip.title) : tipText(sl.title)}
                </T>
                <T style={styles.body}>{i === 0 ? `${tipText(sl.title)} — ${tipText(sl.body)}` : tipText(sl.body)}</T>
              </Animated.View>
            </View>
          ))}
        </ScrollView>
        <Float style={{ alignItems: 'center', marginBottom: 14 }} amount={6}>
          {ART.tips[tip.id] ? <Scene art={ART.tips[tip.id]!} width={200} height={230} border={6} tilt={-2} /> : <CareIcon type={TIP_ICON[tip.id] ?? 'meal'} size={170} />}
        </Float>
        <View style={{ paddingHorizontal: 22, gap: 6, alignItems: 'center' }}>
          <Bouncy onPress={() => (page < last ? go(page + 1) : router.back())} style={[styles.cta, { backgroundColor: colors.ink }]} accessibilityRole="button" testID="tip-next">
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 1 }}>
              {page < last ? t('NEXT') : t('Got it!')}
            </T>
          </Bouncy>
          {page === last ? (
            <Bouncy
              onPress={() => Share.share({ message: `${tipText(tip.title)}\n\n${tip.slides.map((x) => `• ${tipText(x.title)} — ${tipText(x.body)}`).join('\n')}\n\n${t('From Pavurio')}` })}
              style={styles.ghost}
              accessibilityRole="button"
            >
              <T weight="black" style={{ color: colors.ink, fontSize: 14, letterSpacing: 1 }}>
                {t('TELL FRIENDS')}
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
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22 },
  leave: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#FFFFFFAA', justifyContent: 'center' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 26, marginTop: 18 },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { height: 6, borderRadius: 3 },
  done: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, lineHeight: 40, marginTop: 6, color: colors.ink },
  body: { fontSize: 18, color: colors.inkSoft, marginTop: 14, lineHeight: 28 },
  cta: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', minWidth: 240, paddingHorizontal: 34 },
  ghost: { height: 40, alignItems: 'center', justifyContent: 'center' },
});
