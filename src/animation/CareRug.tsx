import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Rect } from 'react-native-svg';
import { CARE, CareType } from '../domain/care';

/** Banded base under the pet: one stripe per planned care slot, colored bottom-up as care is logged. */
export function CareRug({
  bands,
  planned,
  w,
  h,
  cy,
  rx,
  ry,
}: {
  bands: CareType[];
  planned: number;
  w: number;
  h: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  const raw = useId();
  const clipId = `rug${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const slots = Math.max(1, Math.min(12, planned || bands.length || 1));
  const cx = w / 2;
  const stripe = (ry * 2) / slots;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={cy - ry} width={w} height={ry * 2} fill="#ECEDEF" />
        {Array.from({ length: slots }).map((_, i) => {
          const t = bands[i];
          if (!t) return null;
          return <Rect key={i} x={0} y={cy + ry - stripe * (i + 1)} width={w} height={stripe + 0.5} fill={CARE[t].color} />;
        })}
        {Array.from({ length: slots - 1 }).map((_, i) => (
          <Rect key={`l${i}`} x={0} y={cy + ry - stripe * (i + 1) - 0.5} width={w} height={1} fill="#FFFFFF" opacity={0.7} />
        ))}
      </G>
    </Svg>
  );
}
