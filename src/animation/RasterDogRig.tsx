/**
 * The dog rig built from the approved GPT master (docs/art/gpt-dog/master_b.png).
 * tools/rig.py cuts it into layers (tail, body, bandana, ears, head, eyes) and fills in the
 * hidden parts behind each layer, so parts can move without tearing. tools/rig_export.py
 * recolors the coat layers per palette and writes a gray "sketch" version for the color-in fill.
 * Motion values come from usePetMotion, exactly like the vector rig.
 */
import React, { useEffect, useId, useRef } from 'react';
import { GestureResponderEvent, Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { DOG_IMG, DOG_MANIFEST, DogImgKey } from './dogAssets';
import type { PetRigProps } from './PetRig';
import { BurstLayer } from './Burst';
import { CARE, CareType } from '../domain/care';

const M = DOG_MANIFEST;
const CW = M.canvas.w;
const CH = M.canvas.h;
type LayerKey = keyof typeof M.layers;
type PivotKey = keyof typeof M.pivots;

const PALETTES = ['honey', 'cocoa', 'snow', 'midnight'] as const;
const BANDANAS = ['teal', 'coral', 'leaf', 'sun', 'berry'] as const;

const origin = (k: PivotKey) => {
  const [x, y] = M.pivots[k];
  return `${((x / CW) * 100).toFixed(2)}% ${((y / CH) * 100).toFixed(2)}%`;
};

export function RasterDogRig({
  appearance,
  size,
  progress = 1,
  motion,
  interactive = false,
  onTap,
  rug,
  bursts,
  accessibilityLabel,
}: PetRigProps) {
  const w = size;
  const k = size / CW;
  const h = CH * k;
  const pal = (PALETTES as readonly string[]).includes(appearance.paletteId) ? appearance.paletteId : 'honey';
  const band = (BANDANAS as readonly string[]).includes(appearance.accessoryId) ? appearance.accessoryId : 'teal';

  // ---- color-in fill
  const fill = useSharedValue(progress);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      fill.value = progress;
      return;
    }
    fill.value = withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, fill]);

  // ---- motion
  const zero = useSharedValue(0);
  const one = useSharedValue(1);
  const v = motion?.values;
  const breathe = v?.breathe ?? zero;
  const tail = v?.tail ?? zero;
  const earL = v?.earL ?? zero;
  const earR = v?.earR ?? zero;
  const headTilt = v?.headTilt ?? zero;
  const blink = v?.blink ?? one;
  const lookX = v?.lookX ?? zero;
  const lookY = v?.lookY ?? zero;
  const jump = v?.jump ?? zero;
  const squash = v?.squash ?? zero;
  const happy = v?.happy ?? zero;
  // motion values are authored in the 300-wide vector space
  const u = size / 300;

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jump.value }, { scaleX: 1 + squash.value * 0.07 }, { scaleY: 1 - squash.value * 0.09 }],
  }));
  // tail art sits on the left, so a positive wag rotates it the other way
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-tail.value * 1.1}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + breathe.value * 0.016 }] }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -breathe.value * 2.4 * u }, { rotate: `${headTilt.value}deg` }],
  }));
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.value * 0.7 - breathe.value * 1.2}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.value * 0.7 + breathe.value * 1.2}deg` }] }));
  const eyeL = useAnimatedStyle(() => ({
    opacity: 1 - happy.value,
    transform: [{ translateX: lookX.value * 0.8 * u }, { translateY: lookY.value * 0.8 * u }, { scaleY: blink.value }],
  }));
  const eyeR = useAnimatedStyle(() => ({
    opacity: 1 - happy.value,
    transform: [{ translateX: lookX.value * 0.8 * u }, { translateY: lookY.value * 0.8 * u }, { scaleY: blink.value }],
  }));
  const happyStyle = useAnimatedStyle(() => ({ opacity: happy.value }));

  // ---- touch (same contract as the vector rig: visual only, never logs care)
  const start = useRef({ x: 0, y: 0, t: 0 });
  const handlers = interactive
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          start.current = { x: locationX, y: locationY, t: Date.now() };
          motion?.lookAt(locationX / w, locationY / h);
        },
        onResponderMove: (e: GestureResponderEvent) => motion?.lookAt(e.nativeEvent.locationX / w, e.nativeEvent.locationY / h),
        onResponderRelease: (e: GestureResponderEvent) => {
          const moved = Math.hypot(e.nativeEvent.locationX - start.current.x, e.nativeEvent.locationY - start.current.y);
          motion?.release();
          if (moved < 14 && Date.now() - start.current.t < 400) {
            motion?.tap();
            onTap?.();
          }
        },
        onResponderTerminate: () => motion?.release(),
      }
    : {};

  const img = (layer: LayerKey, file: DogImgKey) => {
    const L = M.layers[layer];
    return (
      <Image
        source={DOG_IMG[file]}
        style={{ position: 'absolute', left: L.x * k, top: L.y * k, width: L.w * k, height: L.h * k }}
        fadeDuration={0}
      />
    );
  };
  /** sketch underneath, real coat revealed from the bottom */
  const fillable = (layer: 'tail' | 'body' | 'earL' | 'earR' | 'head') => (
    <>
      {img(layer, `${layer}_sketch` as DogImgKey)}
      <FillClip fill={fill} h={h}>
        <View style={[styles.full, { height: h, top: undefined, bottom: 0 }]}>{img(layer, `${layer}_${pal}` as DogImgKey)}</View>
      </FillClip>
    </>
  );
  const layerView = (o: string, style: object | null, children: React.ReactNode) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: o }, style]}>
      {children}
    </Animated.View>
  );

  const E = M.eyes;
  const arc = (e: { cx: number; cy: number; rx: number }) =>
    `M${e.cx - e.rx * 0.95} ${e.cy + e.rx * 0.2} Q${e.cx} ${e.cy - e.rx * 1.05} ${e.cx + e.rx * 0.95} ${e.cy + e.rx * 0.2}`;

  return (
    <View
      style={{ width: w, height: h }}
      accessible
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={interactive ? 'Tap to say hello. This does not log any care.' : undefined}
      {...handlers}
    >
      {rug ? <Rug bands={rug.bands} planned={rug.planned} w={w} h={h} /> : <Shadow w={w} h={h} />}
      {layerView(origin('body'), rootStyle, (
        <>
          {layerView(origin('tail'), tailStyle, fillable('tail'))}
          {layerView(origin('body'), bodyStyle, (
            <>
              {fillable('body')}
              {img('bandana', `bandana_${band}` as DogImgKey)}
            </>
          ))}
          {layerView(origin('neck'), headStyle, (
            <>
              {fillable('head')}
              {layerView(origin('earL'), earLStyle, fillable('earL'))}
              {layerView(origin('earR'), earRStyle, fillable('earR'))}
              {layerView(origin('eyeL'), eyeL, img('eyeL', 'eyeL'))}
              {layerView(origin('eyeR'), eyeR, img('eyeR', 'eyeR'))}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, happyStyle]}>
                <Svg width={w} height={h} viewBox={`0 0 ${CW} ${CH}`}>
                  <Path d={arc(E.L)} stroke="#241C2B" strokeWidth={E.L.rx * 0.34} strokeLinecap="round" fill="none" />
                  <Path d={arc(E.R)} stroke="#241C2B" strokeWidth={E.R.rx * 0.34} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            </>
          ))}
        </>
      ))}
      {bursts && bursts.length > 0 ? <BurstLayer bursts={bursts} w={w} h={h} /> : null}
    </View>
  );
}

function FillClip({ fill, h, children }: { fill: SharedValue<number>; h: number; children: React.ReactNode }) {
  const top = M.art.top;
  const bottom = M.art.bottom;
  const style = useAnimatedStyle(() => {
    const units = CH - bottom + (bottom - top) * Math.max(0, Math.min(1, fill.value));
    return { height: (units / CH) * h };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.clip, style]}>
      {children}
    </Animated.View>
  );
}

function Shadow({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${CW} ${CH}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={CW * 0.51} cy={M.art.paws + 2} rx={CW * 0.37} ry={22} fill="#23304A" opacity={0.07} />
    </Svg>
  );
}

function Rug({ bands, planned, w, h }: { bands: CareType[]; planned: number; w: number; h: number }) {
  const raw = useId();
  const clipId = `drug${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const slots = Math.max(1, Math.min(12, planned || bands.length || 1));
  const cx = CW * 0.51;
  const cy = M.art.paws - 14;
  const ry = 64;
  const rx = CW * 0.46;
  const stripe = (ry * 2) / slots;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${CW} ${CH}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={cy - ry} width={CW} height={ry * 2} fill="#ECEDEF" />
        {Array.from({ length: slots }).map((_, i) => {
          const t = bands[i];
          if (!t) return null;
          return <Rect key={i} x={0} y={cy + ry - stripe * (i + 1)} width={CW} height={stripe + 1} fill={CARE[t].color} />;
        })}
        {Array.from({ length: slots - 1 }).map((_, i) => (
          <Rect key={`l${i}`} x={0} y={cy + ry - stripe * (i + 1) - 1.5} width={CW} height={3} fill="#FFFFFF" opacity={0.7} />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  full: { position: 'absolute', left: 0, right: 0 },
});
