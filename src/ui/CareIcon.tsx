import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { motionReduced } from './motion';
import { ART } from './art';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { CARE, CareType } from '../domain/care';

/**
 * Original flat care illustrations. `level` (0..1) lets the log card react to the amount:
 * kibble mound grows, water rises, a time ring fills for minute-based care.
 */
function artFor(type: CareType, level: number): number | null {
  const entry = ART.care[type];
  if (entry == null) return null;
  if (typeof entry === 'number') return entry;
  const pick = level < 0.34 ? entry.empty : level < 0.67 ? entry.half : entry.full;
  return pick ?? entry.full ?? entry.half ?? entry.empty;
}

export function CareIcon({ type, size, level = 0.7, ring = false }: { type: CareType; size: number; level?: number; ring?: boolean }) {
  const c = CARE[type].color;
  const l = Math.max(0, Math.min(1, level));
  const art = artFor(type, l);
  if (art != null) {
    // real illustration from the art registry (src/ui/art.ts)
    return (
      <View style={{ width: size, height: size }}>
        {ring ? (
          <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
            <TimeRing color={c} level={l} />
          </Svg>
        ) : null}
        <ArtSwap source={art} style={{ position: 'absolute', left: size * 0.06, top: size * 0.06, width: size * 0.88, height: size * 0.88 }} />
      </View>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {ring ? <TimeRing color={c} level={l} /> : null}
      {type === 'meal' && <Meal c={c} l={l} />}
      {type === 'water' && <Water c={c} l={l} />}
      {type === 'walk' && <Walk c={c} />}
      {type === 'play' && <Play c={c} />}
      {type === 'grooming' && <Groom c={c} />}
      {type === 'litter' && <Litter c={c} />}
    </Svg>
  );
}

/** When the art changes (empty → half → full) the new image fades in over the old one (200 ms, like a pour). */
function ArtSwap({ source, style }: { source: number; style: object }) {
  // previous-value-in-state pattern: the old art is known in the same render the new one appears,
  // so there is never a frame with the new art at full opacity before the fade starts
  const [cur, setCur] = useState(source);
  const [prev, setPrev] = useState<number | null>(null);
  if (source !== cur) {
    setPrev(cur);
    setCur(source);
  }
  useEffect(() => {
    if (prev == null) return;
    const t = setTimeout(() => setPrev(null), 240);
    return () => clearTimeout(t);
  }, [prev, cur]);
  return (
    <>
      {prev != null ? <Image source={prev} style={style} fadeDuration={0} /> : null}
      <Animated.Image key={cur} entering={prev != null && !motionReduced() ? FadeIn.duration(200) : undefined} source={cur} style={style} fadeDuration={0} />
    </>
  );
}

function TimeRing({ color, level }: { color: string; level: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  return (
    <G>
      <Circle cx={50} cy={50} r={r} stroke="#EEF0F3" strokeWidth={4} fill="none" />
      <Circle
        cx={50}
        cy={50}
        r={r}
        stroke={color}
        strokeWidth={4}
        fill="none"
        strokeDasharray={`${circ * level} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
    </G>
  );
}

function Meal({ c, l }: { c: string; l: number }) {
  const mound = 6 + l * 20;
  return (
    <G>
      <Path d={`M22 62 Q50 ${62 - mound * 2} 78 62 Z`} fill="#B9773F" />
      <Circle cx={38} cy={62 - mound * 0.55} r={4.5} fill="#9A5F2E" />
      <Circle cx={50} cy={62 - mound * 0.85} r={4.5} fill="#C98A4E" />
      <Circle cx={61} cy={62 - mound * 0.5} r={4.5} fill="#9A5F2E" />
      <Circle cx={45} cy={60 - mound * 0.3} r={3.5} fill="#D79A5C" />
      <Path d="M14 58 H86 L80 80 Q78 86 72 86 H28 Q22 86 20 80 Z" fill={c} />
      <Rect x={14} y={56} width={72} height={8} rx={4} fill={c} />
      <Rect x={14} y={56} width={72} height={4} rx={2} fill="#FFFFFF" opacity={0.35} />
      <G fill="#FFFFFF" opacity={0.9}>
        <Ellipse cx={50} cy={75} rx={4.4} ry={3.8} />
        <Circle cx={44.5} cy={69.5} r={2} />
        <Circle cx={48.5} cy={67.5} r={2} />
        <Circle cx={52.5} cy={67.5} r={2} />
        <Circle cx={56} cy={69.5} r={2} />
      </G>
    </G>
  );
}

function Water({ c, l }: { c: string; l: number }) {
  const top = 74 - l * 16;
  return (
    <G>
      <Path d="M12 52 H88 L82 80 Q80 88 72 88 H28 Q20 88 18 80 Z" fill="#E7F6FE" />
      <Path d={`M${16 + (74 - top) * 0.05} ${top} H${84 - (74 - top) * 0.05} L81 80 Q79 86 72 86 H28 Q21 86 19 80 Z`} fill={c} />
      <Ellipse cx={50} cy={top} rx={33} ry={3} fill="#7FD3FB" />
      <Rect x={10} y={48} width={80} height={8} rx={4} fill="#B7E6FC" />
      <Path d="M50 14 C50 14 38 28 38 36 C38 43 43.5 47 50 47 C56.5 47 62 43 62 36 C62 28 50 14 50 14 Z" fill={c} />
      <Ellipse cx={45.5} cy={35} rx={2.6} ry={4} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}

function Walk({ c }: { c: string }) {
  return (
    <G>
      <Path d="M70 16 C88 18 90 44 72 48 C60 51 54 60 50 66" stroke="#3D4A63" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Circle cx={68} cy={22} r={7} stroke="#3D4A63" strokeWidth={4} fill="none" />
      <G fill={c}>
        <Path d="M38 86 C24 86 22 74 30 66 C35 61 41 61 46 66 C54 74 52 86 38 86 Z" />
        <Ellipse cx={22} cy={56} rx={6} ry={8} />
        <Ellipse cx={33} cy={47} rx={6} ry={8} />
        <Ellipse cx={46} cy={47} rx={6} ry={8} />
        <Ellipse cx={56} cy={57} rx={6} ry={8} />
      </G>
    </G>
  );
}

function Play({ c }: { c: string }) {
  return (
    <G>
      <Circle cx={50} cy={54} r={32} fill={c} />
      <Path d="M24 36 C40 44 40 66 24 74" stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M76 36 C60 44 60 66 76 74" stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Ellipse cx={40} cy={38} rx={6} ry={3.5} fill="#FFFFFF" opacity={0.45} transform="rotate(-30 40 38)" />
    </G>
  );
}

function Groom({ c }: { c: string }) {
  return (
    <G>
      <Rect x={22} y={30} width={56} height={26} rx={12} fill={c} />
      <Rect x={44} y={56} width={12} height={32} rx={6} fill="#7A5CE0" />
      <G fill="#FFFFFF" opacity={0.85}>
        {[30, 38, 46, 54, 62, 70].map((x) => (
          <Rect key={x} x={x - 1.5} y={18} width={3} height={14} rx={1.5} />
        ))}
      </G>
      <Rect x={26} y={36} width={48} height={4} rx={2} fill="#FFFFFF" opacity={0.35} />
    </G>
  );
}

function Litter({ c }: { c: string }) {
  return (
    <G>
      <Path d="M62 14 L78 46" stroke="#3D4A63" strokeWidth={5} strokeLinecap="round" />
      <Path d="M70 42 L86 38 L90 54 L76 58 Z" fill="#9AA1AE" />
      <Ellipse cx={50} cy={56} rx={34} ry={6} fill="#EBD9C3" />
      <Path d="M12 52 H88 L82 82 Q80 88 72 88 H28 Q20 88 18 82 Z" fill={c} />
      <Rect x={10} y={48} width={80} height={8} rx={4} fill="#C79469" />
      <G fill="#FFFFFF" opacity={0.9}>
        <Ellipse cx={50} cy={74} rx={4.4} ry={3.8} />
        <Circle cx={44.5} cy={68.5} r={2} />
        <Circle cx={48.5} cy={66.5} r={2} />
        <Circle cx={52.5} cy={66.5} r={2} />
        <Circle cx={56} cy={68.5} r={2} />
      </G>
    </G>
  );
}
