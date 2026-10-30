import React, { useEffect, useId, useMemo, useRef } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Rect } from 'react-native-svg';
import { ART, ART_BOTTOM, ART_TOP, Paint, SKETCH, VB_H, VB_W, colorPaint } from './art';
import { CARE, CareType, Species } from '../domain/care';
import { Appearance, resolveAccessory, resolvePalette } from '../domain/appearance';
import type { PetMotion } from './usePetMotion';
import { BurstLayer, Burst } from './Burst';
import { RasterDogRig } from './RasterDogRig';

export type PetRigProps = {
  species: Species;
  appearance: Appearance;
  /** width in px; height is derived from the art aspect ratio */
  size: number;
  /** 0..1 — how much of the pet is colored in */
  progress?: number;
  motion?: PetMotion;
  interactive?: boolean;
  onTap?: () => void;
  /** care rug under the pet (Waterllama-style banded base) */
  rug?: { bands: CareType[]; planned: number };
  bursts?: Burst[];
  accessibilityLabel?: string;
  /** dog only: play a pre-rendered clip ('celebrate' | 'eat' | 'drink'); nonce restarts it */
  clip?: { name: 'celebrate' | 'eat' | 'drink'; nonce: number } | null;
  onClipEnd?: () => void;
};

const origin = (x: number, y: number) => `${((x / VB_W) * 100).toFixed(2)}% ${((y / VB_H) * 100).toFixed(2)}%`;

function VectorPetRig({
  species,
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
  const art = ART[species];
  const w = size;
  const h = (size * VB_H) / VB_W;
  const paint = useMemo(
    () => colorPaint(resolvePalette(species, appearance.paletteId), resolveAccessory(appearance.accessoryId)),
    [species, appearance.paletteId, appearance.accessoryId],
  );

  // ---- fill (color-in) -----------------------------------------------------
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

  // ---- motion values (fall back to static zeros) -----------------------------
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
  const tongue = v?.tongue ?? zero;
  const happy = v?.happy ?? zero;
  const kx = w / VB_W;
  const ky = h / VB_H;

  const rootStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: jump.value },
      { scaleX: 1 + squash.value * 0.07 },
      { scaleY: 1 - squash.value * 0.09 },
    ],
  }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tail.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + breathe.value * 0.018 }] }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -breathe.value * 2.2 * ky }, { rotate: `${headTilt.value}deg` }],
  }));
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.value + breathe.value * -1.5}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.value + breathe.value * 1.5}deg` }] }));
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lookX.value * 0.45 * kx }, { translateY: lookY.value * 0.45 * ky }],
  }));
  const eyesStyle = useAnimatedStyle(() => ({
    opacity: 1 - happy.value,
    transform: [{ translateX: lookX.value * kx }, { translateY: lookY.value * ky }, { scaleY: blink.value }],
  }));
  const happyStyle = useAnimatedStyle(() => ({
    opacity: happy.value,
    transform: [{ translateX: lookX.value * 0.6 * kx }, { translateY: lookY.value * 0.6 * ky }],
  }));
  const tongueStyle = useAnimatedStyle(() => ({
    opacity: tongue.value,
    transform: [{ translateX: lookX.value * 0.45 * kx }, { scaleY: 0.3 + tongue.value * 0.7 }],
  }));

  // ---- touch ---------------------------------------------------------------
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
        onResponderMove: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          motion?.lookAt(locationX / w, locationY / h);
        },
        onResponderRelease: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          const moved = Math.hypot(locationX - start.current.x, locationY - start.current.y);
          motion?.release();
          if (moved < 14 && Date.now() - start.current.t < 400) {
            motion?.tap();
            onTap?.();
          }
        },
        onResponderTerminate: () => motion?.release(),
      }
    : {};

  const svgProps = { width: w, height: h, viewBox: `0 0 ${VB_W} ${VB_H}` } as const;

  /** A part drawn twice: sketch underneath, real colors revealed from the bottom by `fill`. */
  const fillable = (part: (p: Paint) => React.ReactElement) => (
    <>
      <Svg {...svgProps} style={StyleSheet.absoluteFill}>
        {part(SKETCH)}
      </Svg>
      <FillClip fill={fill} h={h}>
        <Svg {...svgProps} style={styles.bottomAnchored}>
          {part(paint)}
        </Svg>
      </FillClip>
    </>
  );
  const still = (part: (p: Paint) => React.ReactElement) => (
    <Svg {...svgProps} style={StyleSheet.absoluteFill}>
      {part(paint)}
    </Svg>
  );

  const ears = (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(...art.pivots.earL) }, earLStyle]}>
        {fillable(art.earL)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(...art.pivots.earR) }, earRStyle]}>
        {fillable(art.earR)}
      </Animated.View>
    </>
  );

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
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: '50% 96%' }, rootStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(...art.pivots.tail) }, tailStyle]}>
          {fillable(art.tail)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: '50% 96%' }, bodyStyle]}>
          {fillable(art.body)}
          {still(art.accessory)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(...art.pivots.neck) }, headStyle]}>
          {art.earsBehindHead ? ears : null}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {fillable(art.head)}
          </View>
          {art.earsBehindHead ? null : ears}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, faceStyle]}>
            {still(art.face)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(150, 158) }, tongueStyle]}>
            {still(art.tongue)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(...art.pivots.eyes) }, eyesStyle]}>
            {still(art.eyes)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, happyStyle]}>
            {still(art.happyEyes)}
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {bursts && bursts.length > 0 ? <BurstLayer bursts={bursts} w={w} h={h} /> : null}
    </View>
  );
}

function FillClip({ fill, h, children }: { fill: SharedValue<number>; h: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const units = VB_H - ART_BOTTOM + (ART_BOTTOM - ART_TOP) * Math.max(0, Math.min(1, fill.value));
    return { height: (units / VB_H) * h };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.clip, style]}>
      {children}
    </Animated.View>
  );
}

function Shadow({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={150} cy={314} rx={110} ry={10} fill="#23304A" opacity={0.07} />
    </Svg>
  );
}

/** Banded base under the pet: one stripe per planned care slot, colored as care is logged. */
function Rug({ bands, planned, w, h }: { bands: CareType[]; planned: number; w: number; h: number }) {
  const raw = useId();
  const clipId = `rug${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const slots = Math.max(1, Math.min(12, planned || bands.length || 1));
  const cy = 302;
  const ry = 25;
  const rx = 142;
  const top = cy - ry;
  const stripe = (ry * 2) / slots;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          <Ellipse cx={150} cy={cy} rx={rx} ry={ry} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={top} width={VB_W} height={ry * 2} fill="#ECEDEF" />
        {Array.from({ length: slots }).map((_, i) => {
          const t = bands[i];
          if (!t) return null;
          const y = cy + ry - stripe * (i + 1);
          return <Rect key={i} x={0} y={y} width={VB_W} height={stripe + 0.6} fill={CARE[t].color} />;
        })}
        {Array.from({ length: slots - 1 }).map((_, i) => (
          <Rect key={`l${i}`} x={0} y={cy + ry - stripe * (i + 1) - 0.6} width={VB_W} height={1.2} fill="#FFFFFF" opacity={0.7} />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  bottomAnchored: { position: 'absolute', left: 0, bottom: 0 },
});

/** Dog uses the approved GPT artwork (layered raster rig); cat uses the vector rig until its art arrives. */
export function PetRig(props: PetRigProps) {
  return props.species === 'dog' ? <RasterDogRig {...props} /> : <VectorPetRig {...props} />;
}
