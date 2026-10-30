/**
 * PetAnimationController — typed, cancellable motion for the layered pet.
 * States: idle (breathe/tail/blink/ear twitch), lookAt (touch), tap, celebrate.
 * Priority: direct touch > confirmation (celebrate) > ambient idle.
 * Purely visual: it never reads or writes care records.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type PetMotion = ReturnType<typeof usePetMotion>;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function usePetMotion({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const breathe = useSharedValue(0); // 0..1
  const tail = useSharedValue(0); // degrees
  const earL = useSharedValue(0);
  const earR = useSharedValue(0);
  const headTilt = useSharedValue(0);
  const blink = useSharedValue(1); // eye scaleY
  const lookX = useSharedValue(0); // viewBox units
  const lookY = useSharedValue(0);
  const jump = useSharedValue(0); // px (negative = up)
  const squash = useSharedValue(0); // -1..1
  const tongue = useSharedValue(0); // 0..1
  const happy = useSharedValue(0); // 0..1 crossfade to ^^ eyes

  const touching = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // -------------------------------------------------------------- ambient idle
  useEffect(() => {
    if (!active || reduceMotion) {
      [breathe, tail].forEach((v) => cancelAnimation(v));
      breathe.value = withTiming(0, { duration: 200 });
      tail.value = withTiming(0, { duration: 200 });
      return;
    }
    breathe.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true);
    tail.value = withSequence(
      withTiming(-6, { duration: 600 }),
      withRepeat(withTiming(8, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true),
    );

    let alive = true;
    const scheduleBlink = () => {
      if (!alive) return;
      const t = setTimeout(() => {
        if (!alive) return;
        const double = Math.random() < 0.2;
        blink.value = double
          ? withSequence(
              withTiming(0.08, { duration: 70 }),
              withTiming(1, { duration: 90 }),
              withTiming(0.08, { duration: 70 }),
              withTiming(1, { duration: 110 }),
            )
          : withSequence(withTiming(0.08, { duration: 80 }), withTiming(1, { duration: 120 }));
        if (Math.random() < 0.35 && !touching.current) {
          const ear = Math.random() < 0.5 ? earL : earR;
          const dir = ear === earL ? -1 : 1;
          ear.value = withSequence(withTiming(dir * 9, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 180 }));
        }
        scheduleBlink();
      }, rand(2400, 5200));
      timers.current.push(t);
    };
    scheduleBlink();
    return () => {
      alive = false;
    };
    // shared values are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  // -------------------------------------------------------------- touch
  /** nx, ny: touch position normalized to the rig (0..1). */
  const lookAt = useCallback(
    (nx: number, ny: number) => {
      touching.current = true;
      const dx = Math.max(-1, Math.min(1, (nx - 0.5) * 2));
      const dy = Math.max(-1, Math.min(1, (ny - 0.38) * 2));
      if (reduceMotion) {
        lookX.value = dx * 4;
        lookY.value = dy * 3;
        return;
      }
      lookX.value = withSpring(dx * 6, { damping: 14, stiffness: 160 });
      lookY.value = withSpring(dy * 4.5, { damping: 14, stiffness: 160 });
      headTilt.value = withSpring(dx * 6, { damping: 12, stiffness: 120 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduceMotion],
  );

  const release = useCallback(() => {
    touching.current = false;
    lookX.value = withSpring(0, { damping: 16 });
    lookY.value = withSpring(0, { damping: 16 });
    headTilt.value = withSpring(0, { damping: 10, stiffness: 90 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = useCallback(() => {
    if (reduceMotion) {
      happy.value = withSequence(withTiming(1, { duration: 120 }), withDelay(700, withTiming(0, { duration: 200 })));
      return;
    }
    squash.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 5, stiffness: 220 }));
    jump.value = withSequence(withTiming(-14, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 7 }));
    earL.value = withSequence(withTiming(-16, { duration: 120 }), withSpring(0, { damping: 5, stiffness: 140 }));
    earR.value = withSequence(withTiming(16, { duration: 120 }), withSpring(0, { damping: 5, stiffness: 140 }));
    tongue.value = withSequence(withTiming(1, { duration: 140 }), withDelay(650, withTiming(0, { duration: 180 })));
    happy.value = withSequence(withTiming(1, { duration: 100 }), withDelay(600, withTiming(0, { duration: 180 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  /** Only call AFTER a care record is confirmed persisted. */
  const celebrate = useCallback(() => {
    happy.value = withSequence(withTiming(1, { duration: 120 }), withDelay(1300, withTiming(0, { duration: 250 })));
    if (reduceMotion) return;
    tongue.value = withSequence(withTiming(1, { duration: 150 }), withDelay(1200, withTiming(0, { duration: 200 })));
    squash.value = withSequence(
      withTiming(1, { duration: 110 }),
      withTiming(-0.8, { duration: 160 }),
      withSpring(0, { damping: 6, stiffness: 200 }),
    );
    jump.value = withSequence(
      withDelay(90, withTiming(-46, { duration: 260, easing: Easing.out(Easing.quad) })),
      withTiming(0, { duration: 230, easing: Easing.in(Easing.quad) }),
      withTiming(-14, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 8 }),
    );
    earL.value = withSequence(withTiming(-22, { duration: 160 }), withSpring(0, { damping: 4, stiffness: 120 }));
    earR.value = withSequence(withTiming(22, { duration: 160 }), withSpring(0, { damping: 4, stiffness: 120 }));
    headTilt.value = withSequence(withTiming(-7, { duration: 200 }), withTiming(7, { duration: 260 }), withSpring(0));
    tail.value = withSequence(
      withRepeat(withTiming(20, { duration: 110 }), 10, true),
      withRepeat(withTiming(8, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useMemo(
    () => ({
      values: { breathe, tail, earL, earR, headTilt, blink, lookX, lookY, jump, squash, tongue, happy },
      lookAt,
      release,
      tap,
      celebrate,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookAt, release, tap, celebrate],
  );
}
