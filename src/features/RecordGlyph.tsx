import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function KindGlyph({ kind, color, size = 22 }: { kind: string; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2.3, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'vaccine' && <Path d="M15 3.5l5.5 5.5M17.8 6.2 9 15l-3-3 8.8-8.8M10.5 9.5l2 2M8 13.5l2.5 2.5M6 18l-2.5 2.5" {...p} />}
      {kind === 'vet_visit' && <Path d="M10 4h4v5h5v4h-5v5h-4v-5H5V9h5z" {...p} />}
      {kind === 'medication' && <Path d="M8.5 15.5l7-7a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5zM12 12l3.5 3.5" {...p} />}
      {kind === 'allergy' && <Path d="M12 3.5 21 19.5H3zM12 10v4.5M12 17v.3" {...p} />}
      {kind === 'other' && <Path d="M7 4h7.5L19 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 19V5.5A1.5 1.5 0 0 1 7 4zM9 13h6M9 16.5h4" {...p} />}
    </Svg>
  );
}

