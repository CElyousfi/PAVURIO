/**
 * The result screen after a care reminder is slid to done (Clucky's "You beat the rooster"):
 * the pet plays its clip in front of a turning sunburst, chunky chips sum it up, one big way back.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PetRig, PetClipName } from '../animation/PetRig';
import { CareType, isCareType } from '../domain/care';
import { KindIcon, kindMeta } from '../features/routines';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { Flame } from '../features/HomeFeed';
import { Icon, Pill, T } from '../ui/primitives';
import { LipChip, Sunburst } from '../ui/Reward';
import { ConfettiRain, motionReduced } from '../ui/motion';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';

const CLIP_FOR: Partial<Record<CareType, PetClipName>> = { meal: 'eat', water: 'drink', walk: 'walk', play: 'play', grooming: 'groom', litter: 'litter' };

/** a line for how it went: on time, a bit late, early */
function timingText(lateMin: number): { value: string; caption: string; onTime: boolean } {
  if (Math.abs(lateMin) <= 15) return { value: t('On time'), caption: t('Timing'), onTime: true };
  if (lateMin < 0) return { value: `−${Math.abs(lateMin)} min`, caption: t('Early'), onTime: true };
  if (lateMin < 120) return { value: `+${lateMin} min`, caption: t('Late'), onTime: false };
  return { value: `+${Math.round(lateMin / 60)} h`, caption: t('Late'), onTime: false };
}

export default function Done() {
  const p = useLocalSearchParams<{ type?: string; title?: string; late?: string }>();
  const { pet, reduceMotion } = useApp();
  const { streak } = useEngagement();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const [fire, setFire] = useState<number | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const type = p.type ?? 'meal';
  const meta = kindMeta(type);
  const timing = timingText(Number(p.late ?? 0) || 0);

  useEffect(() => {
    const a = setTimeout(() => setFire(Date.now()), 250);
    const b = setTimeout(() => setClip({ name: (isCareType(type) && CLIP_FOR[type]) || 'celebrate', nonce: Date.now() }), 350);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [type]);

  if (!pet) return null;
  const hero = Math.min(W * 0.72, height * 0.4, 340);
  const home = () => (router.canDismiss() ? router.dismissAll() : router.replace('/'));
  const title = timing.onTime ? t('Right on time!') : t('Done. {name} noticed.', { name: pet.name });
  const body = timing.onTime ? t('{name} didn’t even have to ask. Respect.', { name: pet.name }) : t('Better late than never. Tail wags all round.');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.col, { width: W }]}>
        <View style={styles.stage}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Sunburst size={hero * 1.9} color={meta.color} />
            </View>
          </View>
          <PetRig species={pet.species} appearance={pet.appearance} size={hero} clip={clip} onClipEnd={() => setClip(null)} reduceMotion={reduceMotion} active />
        </View>

        <Animated.View entering={motionReduced() ? undefined : FadeInUp.delay(200).springify().damping(16)} style={{ alignItems: 'center', paddingHorizontal: 24 }}>
          <T weight="black" style={styles.title} accessibilityRole="header">
            {title}
          </T>
          <T style={styles.body}>{body}</T>
        </Animated.View>

        <View style={styles.chips}>
          <LipChip icon={<KindIcon type={type} size={30} />} value={p.title || meta.label} caption={t('Done')} color={meta.color} delay={350} />
          <LipChip
            icon={streak.current > 0 ? <Flame size={26} /> : <Icon name="check" size={22} color={timing.onTime ? '#3FA34D' : '#E58A00'} />}
            value={streak.current > 0 ? tn(streak.current, '{n} day', '{n} days') : timing.value}
            caption={streak.current > 0 ? t('Streak') : timing.caption}
            color={streak.current > 0 ? '#FF8A1F' : timing.onTime ? '#3FA34D' : '#E58A00'}
            delay={470}
          />
        </View>

        <Pill label={t('Back to {name}', { name: pet.name })} onPress={home} style={{ marginHorizontal: 22, alignSelf: 'stretch' }} testID="done-home" />
      </View>
      <ConfettiRain fireKey={fire} colorsList={[meta.color, '#FFC83D', colors.brand, '#FF6B9A']} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, lineHeight: 38, textAlign: 'center', letterSpacing: -0.5 },
  body: { fontSize: 17, lineHeight: 24, color: colors.muted, textAlign: 'center', marginTop: 8 },
  chips: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, marginTop: 24, marginBottom: 26 },
  cta: { marginHorizontal: 22, height: 66, borderRadius: 24, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
  ctaText: { color: '#FFFFFF', fontSize: 20 },
});
