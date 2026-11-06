/**
 * The log card's picture, Waterllama style: the care's own illustration as a gray picture that fills
 * with its real colours from the bottom up as the amount grows — the same fill as the pet on Home and
 * the care row, so everything fillable in the app reads the same way. The level eases to a new amount
 * in 200 ms (Waterllama's pour, measured at 60 fps). A round chevron control sits in the middle: tap its
 * top or bottom half, or drag anywhere on the picture, to change the amount. Care without an amount
 * (litter) fills by times against the plan.
 */
import React, { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { CareType } from '../domain/care';
import { colors } from './theme';
import { tickFeedback } from '../native/haptics';
import { t } from '../i18n';
import { ART } from './art';
import { FillArt } from './FillArt';
import { CareIcon } from './CareIcon';

/** mix a colour with white (0 = colour, 1 = white) */
function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function Vessel({
  type,
  color,
  level,
  size,
  onStep,
  testIDPrefix = 'amount',
}: {
  type: CareType;
  color: string;
  /** 0..1 of the picture */
  level: number;
  size: number;
  /** +1 / −1 one step; omitted for care without an amount */
  onStep?: (dir: 1 | -1) => void;
  testIDPrefix?: string;
}) {
  // drag up / down on the picture to change the amount, one step every ~16 pt
  const acc = useRef(0);
  // the responder is created once (a new one mid-drag would restart dy at 0); it reads the latest callback
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !!stepRef.current && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          acc.current = 0;
        },
        onPanResponderMove: (_e, g) => {
          const steps = Math.trunc(-g.dy / 16);
          // every step of a drag is felt and heard, like turning a dial
          while (acc.current < steps) {
            acc.current += 1;
            stepRef.current?.(1);
            tickFeedback();
          }
          while (acc.current > steps) {
            acc.current -= 1;
            stepRef.current?.(-1);
            tickFeedback();
          }
        },
      }),
    [],
  );

  const art = ART.care[type];
  const R = Math.round(size * 0.13);
  const cx = size / 2;
  const cy = size * 0.56;
  return (
    <View style={{ width: size, height: size }} {...responder.panHandlers}>
      {art != null ? <FillArt source={art} size={size} level={level} /> : <CareIcon type={type} size={size} level={level} />}
      {onStep ? (
        <>
          <View pointerEvents="none" style={[styles.control, { left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, borderRadius: R, backgroundColor: lighten(color, 0.55) }]}>
            <Svg width={2 * R} height={2 * R} viewBox="0 0 26 26">
              <Circle cx={13} cy={13} r={12} fill="none" />
              <Path d="M9 10.2 L13 6.4 L17 10.2" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d="M9 15.8 L13 19.6 L17 15.8" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('More')}
            hitSlop={6}
            onPress={() => {
              tickFeedback();
              onStep(1);
            }}
            style={{ position: 'absolute', left: cx - R, top: cy - R, width: 2 * R, height: R }}
            testID={`${testIDPrefix}-up`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Less')}
            hitSlop={6}
            onPress={() => {
              tickFeedback();
              onStep(-1);
            }}
            style={{ position: 'absolute', left: cx - R, top: cy, width: 2 * R, height: R }}
            testID={`${testIDPrefix}-down`}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
