import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BadgeDef } from '../domain/badges';
import { isCareType } from '../domain/care';
import { CareIcon } from '../ui/CareIcon';
import { ART } from '../ui/art';

function Glyph({ icon, color, size }: { icon: BadgeDef['icon']; color: string; size: number }) {
  const p = { stroke: color, strokeWidth: 2.3, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icon === 'star' && <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />}
      {icon === 'heart' && <Path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill={color} stroke={color} strokeWidth={1.4} />}
      {icon === 'trophy' && <Path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" {...p} />}
      {icon === 'calendar' && <Path d="M5 6h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6zM3.5 10.5h17M8 3.5v4M16 3.5v4" {...p} />}
      {icon === 'file' && <Path d="M7 4h7.5L19 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 19V5.5A1.5 1.5 0 0 1 7 4zM14 4v5h5M9 13h6M9 16.5h4" {...p} />}
      {icon === 'camera' && <Path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" {...p} />}
      {icon === 'scale' && <Path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9a4 4 0 0 1 8 0zM12 9l1.5-2" {...p} />}
      {icon === 'paw' && (
        <>
          <Path d="M12 20c-3.4 0-5.5-1.6-5.5-3.8 0-2.6 2.6-4.7 5.5-4.7s5.5 2.1 5.5 4.7C17.5 18.4 15.4 20 12 20z" fill={color} />
          <Circle cx={6} cy={9.5} r={1.9} fill={color} />
          <Circle cx={9.5} cy={6} r={1.9} fill={color} />
          <Circle cx={14.5} cy={6} r={1.9} fill={color} />
          <Circle cx={18} cy={9.5} r={1.9} fill={color} />
        </>
      )}
    </Svg>
  );
}

const LOCKED_TINT = '#E3E8EE';

/** Achievement medal: GPT art when provided, otherwise a ring in the badge colour around its icon. */
export function Medal({ def, size, locked }: { def: BadgeDef; size: number; locked?: boolean }) {
  const art = ART.badges[def.key];
  if (art)
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* locked: a clean flat silhouette of the medal (like an uncollected character), never a faded copy */}
        <Image source={art} style={{ width: size, height: size, tintColor: locked ? LOCKED_TINT : undefined }} resizeMode="contain" accessibilityIgnoresInvertColors />
        {locked ? (
          <View style={{ position: 'absolute', width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size * 0.19} height={size * 0.19} viewBox="0 0 24 24">
              <Path d="M7.5 11V8.2a4.5 4.5 0 0 1 9 0V11" stroke="#AEB6C2" strokeWidth={2.6} fill="none" strokeLinecap="round" />
              <Path d="M5.5 11.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z" fill="#AEB6C2" />
            </Svg>
          </View>
        ) : null}
      </View>
    );
  const color = locked ? '#C5CAD3' : def.color;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: locked ? '#F1F2F4' : `${color}22`, alignItems: 'center', justifyContent: 'center', borderWidth: size * 0.06, borderColor: color }}>
      <View style={{ width: size * 0.68, height: size * 0.68, borderRadius: size * 0.34, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.6 : 1 }}>
        {isCareType(def.icon) ? <View style={{ opacity: locked ? 0.35 : 1 }}><CareIcon type={def.icon} size={size * 0.5} /></View> : <Glyph icon={def.icon} color={color} size={size * 0.38} />}
      </View>
    </View>
  );
}
