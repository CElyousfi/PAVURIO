/** Pavurio CAT — motion data only; integration example, not app runtime code.
 * Claude should map these keyframes to Reanimated values or equivalent
 * and use the approved rig/clip when available. Coordinates in dp.
 */
export type CatMotionName =
  | 'idle' | 'tap' | 'celebrate' | 'eat' | 'drink'
  | 'play' | 'groom' | 'litter' | 'sleep';

export type CatPose = {
  at: number; // normalized 0..1
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  rotateDeg?: number;
};

export type MotionSpec = {
  durationMs: number;
  repeat: boolean;
  poses: readonly CatPose[];
};

export const CAT_MOTIONS: Record<CatMotionName, MotionSpec> = {
  idle: { durationMs: 2400, repeat: true, poses: [
    { at: 0, scaleY: 1 }, { at: 0.5, scaleY: 1.015 },
    { at: 1, scaleY: 1 }
  ] },
  tap: { durationMs: 620, repeat: false, poses: [
    { at: 0, scaleX: 1, scaleY: 1 },
    { at: 0.2, scaleX: 1.04, scaleY: 0.95 },
    { at: 0.58, scaleX: 0.97, scaleY: 1.035, translateY: -6 },
    { at: 1, scaleX: 1, scaleY: 1, translateY: 0 }
  ] },
  celebrate: { durationMs: 1050, repeat: false, poses: [
    { at: 0, translateY: 0, scaleY: 1 },
    { at: 0.2, scaleY: 0.95 },
    { at: 0.45, translateY: -10, scaleY: 1.025 },
    { at: 0.78, translateY: 0, scaleY: 0.97 },
    { at: 1, translateY: 0, scaleY: 1 }
  ] },
  eat: { durationMs: 1500, repeat: false, poses: [
    { at: 0 }, { at: 0.27, rotateDeg: 3, translateY: 3 },
    { at: 0.55, rotateDeg: 0 }, { at: 0.78, rotateDeg: 3, translateY: 2 },
    { at: 1, rotateDeg: 0, translateY: 0 }
  ] },
  drink: { durationMs: 1200, repeat: false, poses: [
    { at: 0 }, { at: 0.3, translateY: 3, rotateDeg: 2 },
    { at: 0.65, translateY: 4, rotateDeg: -1 }, { at: 1, translateY: 0, rotateDeg: 0 }
  ] },
  play: { durationMs: 1350, repeat: false, poses: [
    { at: 0 }, { at: 0.25, scaleY: 0.95 },
    { at: 0.52, translateY: -9, rotateDeg: -5 },
    { at: 0.8, translateY: 1, rotateDeg: 3 }, { at: 1, translateY: 0, rotateDeg: 0 }
  ] },
  groom: { durationMs: 1300, repeat: false, poses: [
    { at: 0 }, { at: 0.3, rotateDeg: -5 },
    { at: 0.68, rotateDeg: 4 }, { at: 1, rotateDeg: 0 }
  ] },
  litter: { durationMs: 1100, repeat: false, poses: [
    { at: 0 }, { at: 0.45, translateY: -5 },
    { at: 0.7, translateY: 1 }, { at: 1, translateY: 0 }
  ] },
  sleep: { durationMs: 2600, repeat: true, poses: [
    { at: 0, scaleY: 1 }, { at: 0.5, scaleY: 1.008 },
    { at: 1, scaleY: 1 }
  ] }
};
